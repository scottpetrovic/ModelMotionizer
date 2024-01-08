import { Utility } from '../Utilities.js'
import { type Bone, BufferGeometry, Object3D, type Scene, Vector3 } from 'three'
import BoneCalculationData from '../models/BoneCalculationData.js'
import { type IAutoSkinSolver } from '../interfaces/IAutoSkinSolver.js'
import BoneTesterData from '../models/BoneTesterData.js'
import { SkeletonType } from '../enums/SkeletonType.js'

/**
 * This calculation is similar to the normal bone weights by distance, but uses the
 * location half way between the bone and the child's bone. This gives better results with the joints
 * If there is no child bone, it just uses the bone's position for the distance calculation
 */
export default class BoneWeightsByMedianDistance implements IAutoSkinSolver {
  private geometry: BufferGeometry = new BufferGeometry()
  private readonly skin_indices: number[] = []
  private readonly skin_weights: number[] = []
  private show_debug: boolean = false
  private bone_idx_test: number = -1
  private readonly bones_master_data: BoneCalculationData[] = []
  private debugging_scene_object: Object3D = new Object3D()
  private skeleton_type: SkeletonType = SkeletonType.BipedalSimple

  constructor (bone_hier: Object3D, skeleton_type: SkeletonType) {
    this.set_skeleton_type(skeleton_type)
    this.init_bone_weights_data_structure(bone_hier)
  }

  private get_vertex_count (): number {
    if (this.geometry === null) {
      return -1
    }

    return this.geometry.attributes.position.array.length / 3
  }

  public set_show_debug (debug_value: boolean): void {
    this.show_debug = debug_value
  }

  public set_bone_index_to_test (bone_idx: number): void {
    this.bone_idx_test = bone_idx
  }

  public set_skeleton_type (skinning_type: SkeletonType): void {
    this.skeleton_type = skinning_type
  }

  public set_debugging_scene_object (scene_object: Object3D): void {
    this.debugging_scene_object = scene_object
  }

  public set_geometry (geom: BufferGeometry): void {
    this.geometry = geom
  }

  private init_bone_weights_data_structure (bone_hier: Object3D): void {
    const bones_list = Utility.bone_list_from_hierarchy(bone_hier)
    bones_list.forEach((bone) => {
      const has_child_bone = bone.children.length > 0
      const supports_envelope = false
      const new_bone_object = new BoneCalculationData(bone.name, bone, supports_envelope, has_child_bone)
      this.bones_master_data.push(new_bone_object)
    })
  }

  public calculate_indexes_and_weights (): number[][] {
    // loop through each vertex and find the closest bone
    // then assign the closest vertices to that bone in the assigned_vertices property
    for (let i = 0; i < this.get_vertex_count(); i++) {
      const closest_bone_index: number =
          Utility.find_closest_bone_index_from_vertex_index(i, this.geometry, this.bones_master_data)

      // assign to final weights. closest bone is always 100% weight
      this.skin_indices.push(closest_bone_index, 0, 0, 0)
      this.skin_weights.push(1.0, 0, 0, 0)
    }

    if (this.show_debug) {
      console.log('Assigned all the bones to vertices: ', this.bones_master_data)
    }

    const output = [this.skin_indices, this.skin_weights]
    return output
  }

  public test_bones_outside_in_mesh (): BoneTesterData {
    // don't do test for now and just return success
    return new BoneTesterData([], [])
  }
} // end class
