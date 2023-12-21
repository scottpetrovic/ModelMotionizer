import { BoneEnvelopeGeometry, BoneEnvelopeGeometryUtils } from '../geometry/BoneEnvelopeGeometry.js'
import { Generators } from '../Generators.js'
import { Utility } from '../Utilities.ts'
import BoneCalculationData from '../models/BoneCalculationData.ts'
import { BufferGeometry, Scene, Bone, Object3D, Mesh, Vector3, Raycaster, Intersection } from 'three'

export class BoneWeightsByEnvelope
{
  private bones_master_data: Array<BoneCalculationData> = []
  private geometry: BufferGeometry
  private show_debug: boolean = false
  private bone_idx_test: number = -1

  private debugging_scene_object: Object3D = new Object3D()
  private debug_sphere_size = 0.06
  private debug_sphere_color_success = 0x00ff00 // vertices that are part of envelope
  private debug_sphere_color_failure = 0xff0000 // vertices that will have to use closest bone

  // two variables used for testing to see if we have an ok bone envelope to bind
  private bone_names_with_errors: string[] = []
  private bone_vertices_with_errors: Vector3[] = []

  constructor(bone_hier: Object3D)
  {
    this.init_bone_weights_data_structure(bone_hier)
  }

  public set_geometry(geom: BufferGeometry): void
  {
    this.geometry = geom
  }

  private init_bone_weights_data_structure(bone_hier: Object3D)
  {
    const bones: Bone[] = Utility.bone_list_from_hierarchy(bone_hier)
    this.bones_master_data = []
    bones.forEach((bone) => {
      const has_child_bone: boolean = bone.children.length > 0
      const supports_envelope: boolean = is_bone_valid_for_envelope_calculation(bone)

      // 4 leg creature has entire word "right", while human has appreviation "R"
      let use_minimum_expand_distance: boolean = false
      if (bone.name === 'Right_Front_Leg_Upper' ||
            bone.name === 'Left_Front_Leg_Upper' ||
            bone.name === 'Right_Back_Leg_Upper' ||
            bone.name === 'L_Toe' ||
            bone.name === 'R_Toe' ||
            bone.name.includes('UpLeg') ||
            bone.name === 'Left_Back_Leg_Upper')
      {
        use_minimum_expand_distance = true
      }

      const new_bone_object: BoneCalculationData = new BoneCalculationData(bone.name, bone, supports_envelope, has_child_bone, [], use_minimum_expand_distance)

      this.bones_master_data.push(new_bone_object)
    })
  }

  public set_show_debug(debug_value: boolean): void
  {
    this.show_debug = debug_value
  }

  public set_bone_index_to_test(bone_idx: number): void
  {
    this.bone_idx_test = bone_idx
  }

  public set_debugging_scene_object(scene_object: Object3D): void
  {
    this.debugging_scene_object = scene_object
  }

  private geometry_vertex_count(): number
  {
    return this.geometry?.attributes?.position.array.length / 3
  }

  public test_bones_outside_in_mesh(): [string[], Vector3[]]
  {
    this.bones_master_data.forEach((bone: BoneCalculationData, bone_index: number) => {
      if (bone.supports_envelope_calculation)
      {
        const rays_to_cast: number = 4
        const bone_start: Bone = bone.bone_object
        const bone_end: Bone = bone.bone_object.children[0] as Bone
        const intersection_plane_mesh = Generators.create_bone_plane_mesh(bone_start, bone_end, rays_to_cast)
        const [intersection_distances] = this.intersections_for_geometry(rays_to_cast, intersection_plane_mesh)
        const envelope_mesh = this.create_envelope_mesh_for_bone(bone)
        this.expand_envelope_mesh_to_fit_bone(envelope_mesh, intersection_distances, bone)
      }
    })

    // there are some errors in bone positions being outside of the mesh.
    // avoid future calculations and eventually exit out
    if (this.bone_names_with_errors.length > 0)
    {
      return [this.bone_names_with_errors, this.bone_vertices_with_errors]
    }

    return [[], []]
  }

  public calculate_indexes_and_weights(): number[][]
  {
    // go through each bone, build a bone envelope, see which vertices intersect it,
    // then assign it to the bone
    const vertex_points_that_passed: Vector3[] = []
    const envelope_shapes_to_show: Mesh[] = []

    this.bones_master_data.forEach((bone: BoneCalculationData, bone_index: number) => {
      if (bone.supports_envelope_calculation)
      {
        const rays_to_cast: number = 4
        const bone_start: Bone = bone.bone_object
        const bone_end: Bone = bone.bone_object.children[0] as Bone
        const intersection_plane_mesh = Generators.create_bone_plane_mesh(bone_start, bone_end, rays_to_cast)
        const [intersection_distances] = this.intersections_for_geometry(rays_to_cast, intersection_plane_mesh)
        const envelope_mesh = this.create_envelope_mesh_for_bone(bone)

        this.expand_envelope_mesh_to_fit_bone(envelope_mesh, intersection_distances, bone)

        const { vertex_positions_inside_bone_envelope, vertex_indexes_inside_bone_evelope } =
                    Utility.intersection_points_between_positions_and_mesh(this.geometry.attributes.position, envelope_mesh)

        bone.assigned_vertices.push(...vertex_indexes_inside_bone_evelope)

        // show all of these visually when we are done with checks
        vertex_points_that_passed.push(...vertex_positions_inside_bone_envelope)
        envelope_shapes_to_show.push(envelope_mesh)
      }
    })

    // display all the points that passed the bone envelope test
    if (this.show_debug)
    {
      const debug_assigned_points = Generators.create_spheres_for_points(vertex_points_that_passed,
        this.debug_sphere_size, this.debug_sphere_color_success, 'Vertices assigned to bone')
      this.debugging_scene_object.add(debug_assigned_points)

      envelope_shapes_to_show.forEach((envelope_mesh) => {
        this.debugging_scene_object.add(envelope_mesh)
        // this.debugging_scene_object.add(intersection_plane_mesh)
      })
    }

    // There could be some bones that aren't inside the mesh from the last calculation. This will mess up the bone envelope calculations
    // and need to be fixed. We need to abort the calculations
    if (this.bone_names_with_errors.length > 0)
    {
      throw new Error(`ERROR: Some bones are outside the mesh. Need to fix this. Bones: ${this.bone_names_with_errors}`)
    }

    if (this.show_debug)
    {
      console.log('Part A: Done finding vertices for bone envelopes', this.bones_master_data)
    }

    // B.
    // find out if there are any vertices that are not assigned to a bone
    // loop through the vertices without bones and find out what their position is... show that in the debugger
    const vertex_indexes_without_bones = vertices_not_assigned_to_bone(this.geometry_vertex_count(), this.bones_master_data)
    const vertex_positions_without_bones: Vector3[] = []
    vertex_indexes_without_bones.forEach((vertex_index) => {
      const vertex_position = new Vector3().fromBufferAttribute(this.geometry.attributes.position, vertex_index)
      vertex_positions_without_bones.push(vertex_position)
    })

    const debug_vertices_without_points = Generators.create_spheres_for_points(vertex_positions_without_bones,
      this.debug_sphere_size, this.debug_sphere_color_failure, 'Vertices unassigned to bone')

    this.debugging_scene_object.add(debug_vertices_without_points)

    console.log('Part B: Finding vertices that are not assigned to any bones', vertex_indexes_without_bones)

    // C. go through each vertex that has no bone and find the closest bone
    // loop through all bones and find out which one is the closest
    const closest_vertex_list: number[] = [] // vertex index linked list
    const closest_bone_list: number[] = [] // bone index linked list

    vertex_indexes_without_bones.forEach((vertex_index, idx) => {
      const closest_bone_index: number = find_closest_bone_index_from_vertex_index(vertex_index, this.geometry, this.bones_master_data)
      closest_vertex_list.push(vertex_indexes_without_bones[idx])
      closest_bone_list.push(closest_bone_index)
    })

    // combine closest vertex bone calculation results with the bone envelope results
    // the bones_vertex_list is the master list
    closest_bone_list.forEach((bone_index, iter_idx) => {
      this.bones_master_data[bone_index].assigned_vertices.push(closest_vertex_list[iter_idx])
    })

    if (this.show_debug)
    {
      const left_over_after_all_assigned = vertices_not_assigned_to_bone(this.geometry_vertex_count(), this.bones_master_data)
      console.log('Part C: Seeing if anything is leftover after assignment', left_over_after_all_assigned)
    }


    // D. Map all weights for each bone to the final skin indices and weights
    // that the buffer attribute needs for the skinning process
    const { final_skin_indices, final_skin_weights } = this.calculate_final_weights(this.bones_master_data, this.geometry_vertex_count())

    if (this.show_debug)
    {
      console.log('Assigned all the bones to vertices: ', this.bones_master_data)
    }

    const final_data = [final_skin_indices, final_skin_weights]
    return final_data
  }

  private create_envelope_mesh_for_bone(bone)
  {
    const envelope_color = 0xaaaaff

    const envelope_geometry: BoneEnvelopeGeometry = new BoneEnvelopeGeometry()
    const envelope_mesh = new Mesh(envelope_geometry as BufferGeometry, Generators.create_material(true, envelope_color))
    envelope_mesh.name = `Envelope Box Mesh: ${bone.name}`
    const padding_multiplier: number = 1.2 // scale the box to help with overlap and points just outside box
    envelope_mesh.scale.set(padding_multiplier, padding_multiplier, padding_multiplier)

    const bone_start: Bone = bone.bone_object
    const bone_end: Bone = bone_start.children[0] as Bone

    // reposition/rotate cylinder to be by the bone
    // to get the right orientation of the cylinder, we need to rotateOnAxis
    // last to make  it face the right direction
    const height: number = Utility.distance_between_objects(bone_start, bone_end)
    const bone_direction = Utility.direction_between_points(Utility.world_position_from_object(bone_start), Utility.world_position_from_object(bone_end))
    const facing_direction = Utility.world_position_from_object(bone_end)
    envelope_mesh.position.copy(Utility.world_position_from_object(bone_start))
    envelope_mesh.translateOnAxis(bone_direction, height*0.5)
    envelope_mesh.lookAt(facing_direction)
    envelope_mesh.rotateOnAxis(new Vector3(1,0,0), Math.PI * 0.5)

    return envelope_mesh
  }

  private expand_envelope_mesh_to_fit_bone(envelope_mesh: Mesh, intersections, bone: BoneCalculationData): void
  {
    const bone_start = bone.bone_object
    const bone_end = bone_start.children[0]

    // Grow bone envelope to fix space
    const height = Utility.distance_between_objects(bone_start, bone_end)
    const left_ray_distance: number = intersections[0]
    const back_ray_distance: number = intersections[1]
    const right_ray_distance: number = intersections[2]
    const forward_ray_distance: number = intersections[3]

    if (bone.use_minimum_envelope_expand)
    {
      const min_x_side = Math.min(right_ray_distance, left_ray_distance)
      const min_z_side = Math.min(forward_ray_distance, back_ray_distance)

      BoneEnvelopeGeometryUtils.expand_x_positive_face(envelope_mesh.geometry, min_x_side)
      BoneEnvelopeGeometryUtils.expand_x_negative_face(envelope_mesh.geometry, min_x_side)
      BoneEnvelopeGeometryUtils.expand_z_positive_face(envelope_mesh.geometry, min_z_side)
      BoneEnvelopeGeometryUtils.expand_z_negative_face(envelope_mesh.geometry, min_z_side)
      BoneEnvelopeGeometryUtils.expand_y_positive_face(envelope_mesh.geometry, height*0.5)
      BoneEnvelopeGeometryUtils.expand_y_negative_face(envelope_mesh.geometry, height*0.5)
    }
    else
    {
      BoneEnvelopeGeometryUtils.expand_x_positive_face(envelope_mesh.geometry, right_ray_distance)
      BoneEnvelopeGeometryUtils.expand_x_negative_face(envelope_mesh.geometry, left_ray_distance)
      BoneEnvelopeGeometryUtils.expand_z_positive_face(envelope_mesh.geometry, forward_ray_distance)
      BoneEnvelopeGeometryUtils.expand_z_negative_face(envelope_mesh.geometry, back_ray_distance)
      BoneEnvelopeGeometryUtils.expand_y_positive_face(envelope_mesh.geometry, height*0.5)
      BoneEnvelopeGeometryUtils.expand_y_negative_face(envelope_mesh.geometry, height*0.5)
    }

    // if a bone goes outside a mesh, the intersection will be undefined. keep track of what bones do this and
    if (left_ray_distance === undefined || right_ray_distance === undefined || back_ray_distance === undefined || forward_ray_distance === undefined)
    {
      this.bone_names_with_errors.push(bone.name)
      this.bone_vertices_with_errors.push(Utility.world_position_from_object(bone_start))
      return
    }

    // updating scene and skeleton allows to correctly calculate the bone envelope positions
    envelope_mesh.geometry.computeBoundingBox() // need to recompute for collision next
  }

  private intersections_for_geometry(rays_to_cast: number, debug_bone_plane_mesh)
  {
    const intersection_distances: number[] = [] // ray cast around the object and find how far out the mesh goes
    const intersection_vertexes: Vector3[] = [] // output for potentially showing in debugger
    const normal_mesh: Mesh = new Mesh(this.geometry, Generators.create_material(true))
    normal_mesh.name = 'Normal mesh used for intersection'
    for (let j = 0; j < rays_to_cast; j++) {
      const point_2: Vector3 = Utility.world_position_from_object(debug_bone_plane_mesh.children[j])
      const ray_origin: Vector3 = Utility.world_position_from_object(debug_bone_plane_mesh)
      const ray_direction: Vector3 = Utility.direction_between_points(ray_origin, point_2)

      const raycaster: Raycaster = new Raycaster(ray_origin, ray_direction)
      // const ray_helper = new THREE.ArrowHelper(ray_direction, ray_origin, 100, 0xffffff,1,1)
      // this.debugging_scene_object.add(ray_helper)
      // calculate where closest intersection happens
      const intersects: Intersection[] = raycaster.intersectObject(normal_mesh)
      if (intersects && intersects[0]) {
        intersection_distances.push(intersects[0].distance)
        intersection_vertexes.push(intersects[0].point)
      }
    } // end for loop through rays

    const return_value = [intersection_distances, intersection_vertexes]
    return return_value
  }

  /**
     * Three.js needs the bone indexes and weights stored as an index and weight pair
     * Three.js also needs 4 bones per vertex, so we need to manipulate the data to fit that shape
     * @param {*} bones_master_data
     * @param {*} geometry_vertex_count
     * @returns
     */
  private calculate_final_weights(bones_master_data: BoneCalculationData[], geometry_vertex_count: number)
  {
    const final_skin_indices: number[] = []
    const final_skin_weights: number[] = []

    // some debug info variables if I want to print with them
    let vertices_with_1_bone: number = 0
    let vertices_with_2_bones: number = 0
    let vertices_with_3_bones: number = 0
    let vertices_with_4_bones: number = 0
    let vertices_with_too_many_bones: number = 0

    for (let i = 0; i < geometry_vertex_count; i++) {
      // find out which bones this vertex is assigned to
      const bones_for_vertex: number[] = []
      const weights_for_vertex: number[] = []
      bones_master_data.forEach((bone, bone_index) => {
        // bone includes vertex index
        if (bone.assigned_vertices.includes(i)) {
          bones_for_vertex.push(bone_index)
          weights_for_vertex.push(1)
        }
      })

      // we might have 1, 2, 3, or 4 bones. Need to morph
      // the results to always be an array of length 4
      if (bones_for_vertex.length === 1) {
        final_skin_indices.push(bones_for_vertex[0], 0, 0, 0)
        final_skin_weights.push(1, 0, 0, 0)
        vertices_with_1_bone++
      }
      else if (bones_for_vertex.length === 2) {
        final_skin_indices.push(bones_for_vertex[0], bones_for_vertex[1], 0, 0)
        final_skin_weights.push(0.5, 0.5, 0.0, 0)
        vertices_with_2_bones++
      }
      else if (bones_for_vertex.length === 3) {
        final_skin_indices.push(bones_for_vertex[0], bones_for_vertex[1], bones_for_vertex[2], 0)
        final_skin_weights.push(0.6, 0.3, 0.1, 0)
        vertices_with_3_bones++
      }
      else if (bones_for_vertex.length === 4) {
        final_skin_indices.push(...bones_for_vertex) // everything
        final_skin_weights.push(0.7, 0.2, 0.05, 0.25)
        vertices_with_4_bones++
      }
      else if (bones_for_vertex.length > 4) {
        final_skin_indices.push(bones_for_vertex[0], bones_for_vertex[1], bones_for_vertex[2], bones_for_vertex[3])
        final_skin_weights.push(0.25, 0.25, 0.25, 0.25)

        vertices_with_too_many_bones++
        console.log('ERROR: vertex is assigned to more than 4 bones. need to figure out what to do')
      }
    }

    if (this.show_debug)
    {
      console.log(`Part D: Finalizing bone weights. How many bones is each vertex assigned to: 1)${vertices_with_1_bone}  2)${vertices_with_2_bones} 3)${vertices_with_3_bones}  
            4)${vertices_with_4_bones} 5+)${vertices_with_too_many_bones}`)
    }

    const return_value = { final_skin_indices, final_skin_weights }
    return return_value
  }
} // end Class BoneWeightsByEnvelope

function is_bone_valid_for_envelope_calculation(bone: Bone): boolean
{
  // if our bone doesn't have any children, that means it is the final tip
  // and not a bone we want to use for envelope calculations
  if (bone.children.length === 0)
  {
    return false
  }

  // we are going to ignore certain bones for the bone as they
  // have odd angles and create bad envelopes
  if (
    bone.name.includes('Fingers') ||
        bone.name.includes('HandBase') ||
        bone.name.includes('Shoulder') ||
        bone.name === 'SpineUp')
  {
    return false
  }

  return true // bone is ok to do envelope calculations
}

function vertices_not_assigned_to_bone(geometry_vertex_count: number, bones_master_data: BoneCalculationData[])
{
  const vertex_indexes_without_bones: number[] = []

  for (let i = 0; i < geometry_vertex_count; i++)
  {
    let does_vertex_exist_in_bones: boolean = false
    bones_master_data.forEach((bone) =>
    {
      if (bone.assigned_vertices.includes(i))
      {
        does_vertex_exist_in_bones = true
      }
    })

    if (!does_vertex_exist_in_bones)
    {
      vertex_indexes_without_bones.push(i)
    }
  }

  return vertex_indexes_without_bones
}

function find_closest_bone_index_from_vertex_index(vertex_index: number, geometry: BufferGeometry, bones: BoneCalculationData[]): number
{
  const vertex_position: Vector3 = new Vector3().fromBufferAttribute(geometry.attributes.position, vertex_index)
  let closest_bone: Bone = bones[0].bone_object
  let closest_bone_distance: number = 10000
  let closest_bone_index: number = 0

  bones.forEach((bone: BoneCalculationData, idx: number) => {
    let distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position)

    // if bone has a child, we are going to calculate the distance by getting the half way
    // point between bone and child bone...to hopefully yield better results
    if (bone.has_child_bone) {
      const child_bone: Bone = bone.bone_object.children[0] as Bone
      const child_bone_position: Vector3 = Utility.world_position_from_object(child_bone)
      const bone_position: Vector3 = Utility.world_position_from_object(bone.bone_object)
      const half_way_point: Vector3 = bone_position.add(child_bone_position).divideScalar(2)
      const distance_to_half_way_point: number = half_way_point.distanceTo(vertex_position)

      if (distance_to_half_way_point < closest_bone_distance) {
        distance = distance_to_half_way_point
      }
    }

    if (distance < closest_bone_distance) {
      closest_bone = bone.bone_object
      closest_bone_distance = distance
      closest_bone_index = idx
    }
  })

  bones[closest_bone_index].assigned_vertices.push(vertex_index)
  return closest_bone_index
}
