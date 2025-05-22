import { Vector3, Group, Raycaster, type Bone, Mesh,
  MeshBasicMaterial, DoubleSide, BufferAttribute, type WireframeGeometry, type BufferGeometry
} from 'three'

import { Utility } from '../Utilities.js'
import { SkeletonType } from '../enums/SkeletonType.js'
import { AbstractAutoSkinSolver } from './AbstractAutoSkinSolver.js'
import { Generators } from '../Generators.js'
import BoneCalculationData from '../models/BoneCalculationData.js'

/**
 * SolverDistanceChildTargeting
 * This works very similar to the normal distance + child solver
  * This adds extra logic to target ares in the arms and hips to help with assigning weights
 */
export default class SolverDistanceChildTargeting extends AbstractAutoSkinSolver {
  private readonly points_to_show_for_debugging: Vector3[] = []

  // cache objects to help speed up calculations
  private cached_bone_positions: Vector3[] = [] // bone positions don't change
  private readonly bone_object_to_index = new Map<Bone, number>() // map to get the index of the bone object
  private distance_to_bottom_of_hip: number = 0 // distance to the bottom of the hip bone

  public calculate_indexes_and_weights (): number[][] {
    // There can be multiple objects that need skinning, so
    // this will make sure we have a clean slate by putting it in function
    const skin_indices: number[] = []
    const skin_weights: number[] = []

    // create cached items for all the vertex calculations later
    this.cached_bone_positions = this.get_bone_master_data().map(b => Utility.world_position_from_object(b.bone_object))
    this.get_bone_master_data().forEach((b, idx) => this.bone_object_to_index.set(b.bone_object, idx))
    this.distance_to_bottom_of_hip = this.calculate_distance_to_bottom_of_hip()

    // mutates (assigns) skin_indices and skin_weights
    console.time('calculate_closest_bone_weights')
    this.calculate_closest_bone_weights(skin_indices, skin_weights)
    console.timeEnd('calculate_closest_bone_weights')

    // this is the second pass, where we look at the parent bone and assign weights
    // to it if the direction is similar. This will help bones mostly affect their children
    console.time('calculate_parent_bone_weights')
    this.calculate_parent_bone_weights(skin_indices, skin_weights)
    console.timeEnd('calculate_parent_bone_weights')

    if (this.show_debug) {
      this.debugging_scene_object.add(this.objects_to_show_for_debugging(skin_indices))
      this.points_to_show_for_debugging.length = 0 // Clear the points after adding to the scene
    }

    return [skin_indices, skin_weights]
  }

  // every vertex checks to see if it is below the hips area,
  // so do this calculation once and cache it for the lookup later
  private calculate_distance_to_bottom_of_hip (): number {
    const hip_bone_object: BoneCalculationData | undefined = this.get_bone_master_data().find(b => b.bone_object.name.toLowerCase().includes('hips'))
    if (hip_bone_object === undefined) {
      throw new Error('Hip bone not found')
    }
    const intesection_point: Vector3 | null = this.cast_intersection_ray_down_from_bone(hip_bone_object.bone_object)

    // get the distance from the bone point to the intersection point
    const bone_index = this.get_bone_master_data().findIndex(b => b.bone_object === hip_bone_object.bone_object)
    const bone_position: Vector3 = this.cached_bone_positions[bone_index]

    let distance_to_bottom_of_hip: number = intesection_point?.distanceTo(bone_position) ?? 0
    distance_to_bottom_of_hip *= 1.1 // buffer zone to make sure to include vertices at intersection

    return distance_to_bottom_of_hip
  }

  private calculate_parent_bone_weights (skin_indices: number[], skin_weights: number[]): void {
    for (let i = 0; i < this.geometry_vertex_count(); i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      const current_bone_index = skin_indices[i * 4] // Get the currently assigned bone index
      const current_bone = this.get_bone_master_data()[current_bone_index].bone_object

      // keep the original weights for hips. the parent is the root which never rotates
      // and shouldn't be affected. A better solution would be to assign to upper legs somehow.
      if (current_bone.name.includes('hips') === true) {
        // skip the hip bone because the parent is the root which never rotates/moves
        continue
      }

      const parent_bone = current_bone.parent
      if (parent_bone === null) {
        console.log(`WARNING: No parent bone for vertex on ${current_bone.name}`)
        continue // Skip if there is no parent bone
      }

      // Calculate direction vectors
      const current_bone_position = this.cached_bone_positions[current_bone_index]

      // const parent_bone_index = this.get_bone_master_data().findIndex(b => b.bone_object === parent_bone)
      const parent_bone_index = this.bone_object_to_index.get(parent_bone)
      if (parent_bone_index === -1 || parent_bone_index === undefined) continue
      const parent_bone_position = this.cached_bone_positions[parent_bone_index]


      const direction_to_current_bone = new Vector3().subVectors(vertex_position, current_bone_position).normalize()
      const direction_to_parent_bone = new Vector3().subVectors(vertex_position, parent_bone_position).normalize()

      // Compare directions using dot product
      const similarity = direction_to_current_bone.dot(direction_to_parent_bone)

      // If the directions are similar (e.g., dot product < 0.0), reassign to the parent bone
      // this means the vertex is closer to the parent bone than the current bone
      // and the direction is similar to the parent bone, so we can assign it to the parent
      let similarity_threshold = 0.0 // Adjust this threshold as needed

      // upper arms on humans need to have a higher threshold
      // 0.0 is 50% between the parent and the child bone directions
      // 0.6 will mean we will assign more to the parent bone (shoulder), and less to the upper arm
      // this will help reduce distortions in the upper torso area when arms rotate
      if (this.skeleton_type === SkeletonType.Human) {
        if (current_bone.name.includes('upper_arm') === true) {
          similarity_threshold = 0.6 // strong affinity to parent bone
        }
      }

      if (similarity < similarity_threshold) {
        const parent_bone_index = this.get_bone_master_data().findIndex(b => b.bone_object === parent_bone)
        if (parent_bone_index !== -1) {
          // Update skin indices and weights
          skin_indices[i * 4] = parent_bone_index
          skin_weights[i * 4] = 1.0 // Assign full weight to the parent bone

          this.points_to_show_for_debugging.push(vertex_position) // Add to points to show for debugging
        }
      }
    }
  }

  /**
   * This function will assign the closest bone to each vertex
   * It returns void, but it will modify the skin_indices and skin_weights arrays
   * This function mutates the arrays passed in as arguments
   * @param skin_indices
   * @param skin_weights
   */
  private calculate_closest_bone_weights (skin_indices: number[], skin_weights: number[]): void {
    for (let i = 0; i < this.geometry_vertex_count(); i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      // let closest_bone: Bone = this.bones_master_data[0].bone_object
      let closest_bone_distance: number = 10000
      let closest_bone_index: number = 0

      this.get_bone_master_data().forEach((bone, idx) => {
        // The root bone is only for global transform changes, so we won't assign it to any vertices
        if (bone.bone_object.name === 'root') {
          return // skip the root bone and continue to the next bone
        }

        // hip bones should have custom logic for distance. If the distance is too far away we should ignore it
        // This will help with hips when left/right legs could be closer than knee bones
        if (this.skeleton_type === SkeletonType.Human && bone.bone_object.name.includes('hips') === true) {
          // if the intersection point is lower than the vertex position, that means the vertex is below
          // the hips area, and is part of the left or right leg...ignore that result
          if (this.distance_to_bottom_of_hip !== null && this.distance_to_bottom_of_hip < vertex_position.y) {
            return// this vertex is below our crotch area, so it cannot be part of our hips
          }
        }

        const distance: number = this.cached_bone_positions[idx].distanceTo(vertex_position)
        if (distance < closest_bone_distance) {
          // closest_bone = bone.bone_object
          closest_bone_distance = distance
          closest_bone_index = idx
        }
      })

      this.get_bone_master_data()[closest_bone_index].assigned_vertices.push(i)

      // assign to final weights. closest bone is always 100% weight
      skin_indices.push(closest_bone_index, 0, 0, 0)
      skin_weights.push(1.0, 0, 0, 0)
    }
  }

  private objects_to_show_for_debugging (skin_indices: number[]): Group {
    const weight_painted_mesh = this.create_weight_paint_debug_mesh(skin_indices, this.geometry)
    const wireframe_mesh = this.create_wireframe_debug_mesh(this.geometry)

    const group = new Group()
    group.add(weight_painted_mesh)
    group.add(wireframe_mesh)
    group.name = 'DebuggingNormalGroup'

    return group
  }

  /**
   * This function will create a mesh to show the weights of the vertices
   * It will use the skin_indices to assign colors to the vertices
   * @param skin_indices
   */
  private create_weight_paint_debug_mesh (skin_indices: number[], orig_geometry: BufferGeometry): Mesh {
    // Clone the geometry to avoid modifying the original
    const cloned_geometry = orig_geometry.clone()
    const vertex_count = cloned_geometry.attributes.position.array.length / 3

    // Assign a random color for each bone
    const bone_colors: Vector3[] = this.generateDeterministicBoneColors(80)

    // Loop through each vertex and assign color based on the bone index
    const colors = new Float32Array(vertex_count * 3)
    for (let i = 0; i < vertex_count; i++) {
      const bone_index = skin_indices[i * 4] // Primary bone assignment
      const color = bone_colors[bone_index]
      colors[i * 3] = color.x // red
      colors[i * 3 + 1] = color.y // green
      colors[i * 3 + 2] = color.z // blue
    }
    cloned_geometry.setAttribute('color', new BufferAttribute(colors, 3))

    // Create a mesh with vertex colors
    const material = new MeshBasicMaterial({ vertexColors: true, wireframe: false, opacity: 1.0, transparent: false })
    return new Mesh(cloned_geometry, material)
  }

  private generateDeterministicBoneColors (count: number): Vector3[] {
    // base color, can be any value between 0 and 1
    let r = 0.2
    let g = 0.5
    let b = 0.8

    // Generate a list of colors based on the count
    const colors: Vector3[] = []
    const step = [-0.1, 0.1, 0.3]
    for (let i = 0; i < count; i++) {
      // Ensure values wrap between 0 and 1
      r = (r + step[0] + 1) % 1
      g = (g + step[1] + 1) % 1
      b = (b + step[2] + 1) % 1
      colors.push(new Vector3(r, g, b))
    }
    return colors
  }

  private create_wireframe_debug_mesh (orig_mesh: BufferGeometry): Mesh {
    const wireframe_material = new MeshBasicMaterial({
      color: 0xabd9ef, // light blue color
      wireframe: true,
      opacity: 1.0,
      transparent: false
    })

    const cloned_geometry = orig_mesh.clone()
    return new Mesh(cloned_geometry, wireframe_material)
  }

  private cast_intersection_ray_down_from_bone (bone: Bone): Vector3 | null {
    const raycaster = new Raycaster()

    // Set the ray's origin to the bone's world position
    const bone_index = this.get_bone_master_data().findIndex(b => b.bone_object === bone)
    const bone_position = this.cached_bone_positions[bone_index]

    // Direction is straight down to find the pevlis "gap"
    raycaster.set(bone_position, new Vector3(0, -1, 0))

    // Create a temporary mesh from this.geometry for raycasting
    const temp_mesh = new Mesh(this.geometry, new MeshBasicMaterial())
    temp_mesh.material.side = DoubleSide // DoubleSide is a THREE.js constant

    // Perform the intersection test
    const recursive_check_child_objects: boolean = false
    const intersections = raycaster.intersectObject(temp_mesh, recursive_check_child_objects)

    if (intersections.length > 0) {
      // Return the position of the first intersection
      return intersections[0].point
    }

    // Return null if no intersection is found
    return null
  }
}
