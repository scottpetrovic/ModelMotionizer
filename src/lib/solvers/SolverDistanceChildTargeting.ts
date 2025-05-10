import { Vector3, type Group, Raycaster, type Bone, Mesh, MeshBasicMaterial, DoubleSide } from 'three'
import { Utility } from '../Utilities.js'
import { SkeletonType } from '../enums/SkeletonType.js'
import { AbstractAutoSkinSolver } from './AbstractAutoSkinSolver.js'
import { Generators } from '../Generators.js'

/**
 * SolverDistanceChildTargeting
 * This works very similar to the normal distance + child solver
  * This adds extra logic to target ares in the arms and hips to help with assigning weights
 */
export default class SolverDistanceChildTargeting extends AbstractAutoSkinSolver {
  private readonly points_to_show_for_debugging: Vector3[] = []

  public calculate_indexes_and_weights (): number[][] {
    // There can be multiple objects that need skinning, so
    // this will make sure we have a clean slate by putting it in function
    const skin_indices: number[] = []
    const skin_weights: number[] = []

    // mutates (assigns) skin_indices and skin_weights
    this.calculate_closest_bone_weights(skin_indices, skin_weights)

    // this is the second pass, where we look at the parent bone and assign weights
    // to it if the direction is similar. This will help bones mostly affect their children
    this.calculate_parent_bone_weights(skin_indices, skin_weights)

    if (this.show_debug) {
      this.debugging_scene_object.add(this.objects_to_show_for_debugging())
      // console.log('Debugging points:', this.get_bone_master_data())
      this.points_to_show_for_debugging.length = 0 // Clear the points after adding to the scene
    }

    return [skin_indices, skin_weights]
  }

  private calculate_parent_bone_weights (skin_indices: number[], skin_weights: number[]): void {
    for (let i = 0; i < this.geometry_vertex_count(); i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      const current_bone_index = skin_indices[i * 4] // Get the currently assigned bone index
      const current_bone = this.get_bone_master_data()[current_bone_index].bone_object

      // keep the original weights for hips. the parent is the root which never rotates
      // and shouldn't be affected. A better solution would be to assign to upper legs somehow.
      if (current_bone.name === 'DEF-hips' && this.skeleton_type === SkeletonType.Human) {
        // skip the hip bone because the parent is the root which never rotates/moves
        continue
      }

      const parent_bone = current_bone.parent
      if (parent_bone === null) {
        console.log(`WARNING: No parent bone for vertex on ${current_bone.name}`)
        continue // Skip if there is no parent bone
      }

      // Calculate direction vectors
      const current_bone_position = Utility.world_position_from_object(current_bone)
      const parent_bone_position = Utility.world_position_from_object(parent_bone)

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
        // our human skeleton has a root controller bone that isn't in the mesh. Don't assign weights to this?
        if (this.skeleton_type === SkeletonType.Human) {
          if (bone.bone_object.name === 'root') {
            return // skip the root bone and continue to the next bone
          }
        }

        // hip bones should have custom logic for distance. If the distance is too far away we should ignore it
        // This will help with hips when left/right legs could be closer than knee bones
        if (this.skeleton_type === SkeletonType.Human && bone.bone_object.name.includes('hips') === true) {
          const is_below_hips_area: boolean = this.is_vertex_below_human_hip_bounds(vertex_position, bone)
          if (is_below_hips_area) {
            return // skip this bone if the vertex is below the hips area
          }
        }

        const distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position)
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

  private is_vertex_below_human_hip_bounds (vertex_position: Vector3, bone: Bone): boolean {
    const intesection_point: Vector3 | null = this.cast_intersection_ray_down_from_bone(bone.bone_object)

    // get the distance from the bone point to the intersection point
    const bone_position: Vector3 = Utility.world_position_from_object(bone.bone_object)
    let distance_to_intersection: number = intesection_point?.distanceTo(bone_position) ?? 0
    distance_to_intersection *= 1.1 // buffer zone to make sure to include vertices at intersection

    // if the intersection point is lower than the vertex position, that means the vertex is below
    // the hips area, and is part of the left or right leg...ignore that result
    if (distance_to_intersection !== null && distance_to_intersection < vertex_position.y) {
      return true// this vertex is below our crotch area, so it cannot be part of our hips
    }

    return false
  }

  private objects_to_show_for_debugging (): Group {
    const debug_color = 0xff00ff // vertices that are part of envelope
    const debug_assigned_points: Group = Generators.create_spheres_for_points(this.points_to_show_for_debugging,
      debug_color, 'Vertices assigned to bone')

    return debug_assigned_points
  }

  private cast_intersection_ray_down_from_bone (bone: Bone): Vector3 | null {
    const raycaster = new Raycaster()

    // Set the ray's origin to the bone's world position
    const bone_position = Utility.world_position_from_object(bone)

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
