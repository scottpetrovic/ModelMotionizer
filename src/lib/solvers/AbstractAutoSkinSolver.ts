import { BufferGeometry, Object3D, type Bone } from 'three'
import { type SkeletonType } from '../enums/SkeletonType.js'
import BoneTesterData from '../models/BoneTesterData.js'
import BoneCalculationData from '../models/BoneCalculationData.js'
import { Utility } from '../Utilities.js'

export abstract class AbstractAutoSkinSolver {
  protected readonly bones_master_data: BoneCalculationData[] = []
  protected geometry: BufferGeometry = new BufferGeometry()
  protected show_debug: boolean = false
  protected bone_idx_test: number = -1
  protected skeleton_type: SkeletonType | null = null
  protected debugging_scene_object: Object3D = new Object3D()

  constructor (bone_hier: Object3D, skeleton_type: SkeletonType) {
    this.set_skeleton_type(skeleton_type)
    this.init_bone_weights_data_structure(bone_hier)
  }

  // calculation that will bring back the skin indices and weights
  public abstract calculate_indexes_and_weights (): number[][]

  public set_geometry (geom: BufferGeometry): void {
    this.geometry = geom
  }

  public set_show_debug (debug_value: boolean): void {
    this.show_debug = debug_value
  }

  public set_bone_index_to_test (bone_idx: number): void {
    this.bone_idx_test = bone_idx
  }

  public set_debugging_scene_object (scene_object: Object3D): void {
    this.debugging_scene_object = scene_object
  }

  public set_skeleton_type (skinning_type: SkeletonType): void {
    this.skeleton_type = skinning_type
  }

  public get_bone_master_data (): BoneCalculationData[] {
    return this.bones_master_data
  }

  public test_bones_outside_in_mesh (): BoneTesterData {
    return new BoneTesterData([], [])
  }

  protected geometry_vertex_count (): number {
    if (this.geometry === null) {
      console.error('Geometry is null. cannot get vertex count')
      return -1
    }

    return this.geometry.attributes.position.array.length / 3
  }

  protected init_bone_weights_data_structure (bone_hier: Object3D): void {
    const bones_list: Bone[] = Utility.bone_list_from_hierarchy(bone_hier)
    bones_list.forEach((bone: Bone) => {
      const has_child_bone: boolean = bone.children.length > 0
      const supports_envelope: boolean = false
      const new_bone_object: BoneCalculationData =
          new BoneCalculationData(bone.name, bone, supports_envelope, has_child_bone)
      this.bones_master_data.push(new_bone_object)
    })
  }
}
