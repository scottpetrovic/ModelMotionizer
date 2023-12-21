import { Bone, BufferGeometry, Object3D, Scene, Vector3 } from 'three'
import { Utility } from '../Utilities.js'
import BoneCalculationData from '../models/BoneCalculationData.js'

export default class BoneWeightsByDistance
{
  private bones_master_data: Array<BoneCalculationData> = []
  private geometry: BufferGeometry
  private show_debug: boolean = false
  private bone_idx_test: number = -1
  private debugging_scene_object: Scene

  constructor(bone_hier: Object3D)
  {
    this.init_bone_weights_data_structure(bone_hier)
  }

  public set_debugging_scene_object(scene_object: Scene): void
  {
    this.debugging_scene_object = scene_object
  }

  public set_geometry(geom: BufferGeometry): void
  {
    this.geometry = geom
  }

  private get_vertex_count(): number
  {
    if(this.geometry === null) {
      return -1
    }

    return this.geometry.attributes.position.array.length / 3
  }

  public set_show_debug(debug_value: boolean): void
  {
    this.show_debug = debug_value
  }

  public set_bone_index_to_test(bone_idx: number): void
  {
    this.bone_idx_test = bone_idx
  }

  private init_bone_weights_data_structure(bone_hier: Object3D): void
  {
    const bones_list: Bone[] = Utility.bone_list_from_hierarchy(bone_hier)
    bones_list.forEach((bone) => {
      const has_child_bone: boolean = bone.children.length > 0
      const supports_envelope: boolean = false
      const new_bone_object: BoneCalculationData =
          new BoneCalculationData(bone.name, bone, supports_envelope, has_child_bone)
      this.bones_master_data.push(new_bone_object)
    })
  }

  public calculate_indexes_and_weights(): number[][]
  {
    const skinIndices: number[] = []
    const skinWeights: number[] = []

    // loop through each vertex and find the closest bone
    // then assign the closest vertices to that bone in the assigned_vertices property
    for(let i = 0; i < this.get_vertex_count(); i++)
    {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      let closest_bone: Bone = this.bones_master_data[0].bone_object
      let closest_bone_distance: number = 10000
      let closest_bone_index: number = 0

      this.bones_master_data.forEach((bone, idx) => {
        const distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position)

        if(distance < closest_bone_distance)
        {
          closest_bone = bone.bone_object
          closest_bone_distance = distance
          closest_bone_index = idx
        }
      })

      this.bones_master_data[closest_bone_index].assigned_vertices.push(i)

      // assign to final weights. closest bone is always 100% weight
      skinIndices.push(closest_bone_index, 0, 0, 0)
      skinWeights.push(1.0, 0, 0, 0)
    }

    if(this.show_debug)
    {
      console.log('Assigned all the bones to vertices: ', this.bones_master_data)
    }

    return [skinIndices, skinWeights]
  }

  public test_bones_outside_in_mesh(): never[][]
  {
    // don't do test for now and just return success
    const return_data = [[], []]
    return return_data
  }
}
