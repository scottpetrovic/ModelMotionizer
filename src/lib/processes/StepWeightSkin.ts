import { UI } from '../UI.ts'

import { BoneWeightsByEnvelope } from '../solvers/BoneWeightsByEnvelope.ts'
import BoneWeightsByDistance from '../solvers/BoneWeightsByDistance.ts'
import BoneWeightsByMedianDistance from '../solvers/BoneWeightsByMedianDistance.ts'

import { SkinningFormula } from '../enums/SkinningFormula.ts'

import { Generators } from '../Generators.ts'

import { type BufferGeometry, type Material, type Object3D, type Skeleton, SkinnedMesh, type Scene } from 'three'
import BoneTesterData from '../models/BoneTesterData.ts'
import { type SkeletonType } from '../enums/SkeletonType.ts'
import BoneWeightsByDistanceChild from '../solvers/BoneWeightsByDistanceChild.ts'
import { type AbstractAutoSkinSolver } from '../solvers/AbstractAutoSkinSolver.ts'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepWeightSkin extends EventTarget {
  private readonly ui: UI = new UI()
  private skinning_armature: Object3D | undefined
  private bone_skinning_formula: AbstractAutoSkinSolver | undefined
  private binding_skeleton: Skeleton | undefined
  private skinned_meshes: SkinnedMesh[] = []

  // debug options for bone skinning formula
  private show_debug: boolean = false
  private debug_scene_object: Object3D | undefined
  private bone_index_to_test: number = -1

  public begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '3.5'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Skin Debug'
    }

    if (this.ui.dom_skinned_mesh_tools !== null) {
      this.ui.dom_skinned_mesh_tools.style.display = 'flex'
    }
  }

  public create_bone_formula_object (editable_armature: Object3D, skinning_formula: string, skeleton_type: SkeletonType): any {
    this.skinning_armature = editable_armature.clone()
    this.skinning_armature.name = 'Armature for skinning'

    // Swap out formulas to see different results
    if (skinning_formula === SkinningFormula.Distance) {
      this.bone_skinning_formula = new BoneWeightsByDistance(this.skinning_armature.children[0], skeleton_type)
    }

    if (skinning_formula === SkinningFormula.DistanceChild) {
      this.bone_skinning_formula = new BoneWeightsByDistanceChild(this.skinning_armature.children[0], skeleton_type)
    }

    // if (skinning_formula === SkinningFormula.Envelope) {
    //   this.bone_skinning_formula = new BoneWeightsByEnvelope(this.skinning_armature.children[0], skeleton_type)
    // }

    return this.bone_skinning_formula
  }

  public skeleton (): Skeleton | undefined {
    // gets bone hierarchy from the armature
    return this.binding_skeleton
  }

  public set_mesh_geometry (geometry: BufferGeometry): void {
    if (this.bone_skinning_formula === undefined) {
      console.warn('Tried to set_mesh_geometry() in weight skinning step, but bone_skinning_formula is undefined!')
      return
    }

    this.bone_skinning_formula.set_geometry(geometry)
  }

  public test_geometry (): BoneTesterData {
    if (this.bone_skinning_formula === undefined) {
      console.warn('Tried to test_geometry() in weight skinning step, but bone_skinning_formula is undefined!')
      return new BoneTesterData([], [])
    }

    if (this.show_debug) {
      this.bone_skinning_formula.set_show_debug(this.show_debug)
      this.bone_skinning_formula.set_debugging_scene_object(this.debug_scene_object)
      this.bone_skinning_formula.set_bone_index_to_test(this.bone_index_to_test)
    }

    return this.bone_skinning_formula.test_bones_outside_in_mesh()
  }

  public create_binding_skeleton (): void {
    if (this.skinning_armature !== undefined) {
      // when we copy over the armature with the bind, we will lose the reference in the variable
      this.binding_skeleton = Generators.create_skeleton(this.skinning_armature.children[0])
      this.binding_skeleton.name = 'Mesh Binding Skeleton'
    } else {
      console.warn('Tried to create_binding_skeleton() but skinning_armature is undefined!')
    }
  }

  public clear_skinned_meshes (): void {
    this.skinned_meshes = []
  }

  public create_skinned_mesh (geometry: BufferGeometry, material: Material): void {
    if (this.binding_skeleton === undefined) {
      console.warn('Tried to create_skinned_mesh() but binding_skeleton is undefined!')
      return
    }

    // create skinned mesh
    const skinned_mesh: SkinnedMesh = new SkinnedMesh(geometry, material)
    skinned_mesh.name = 'Skinned Mesh'
    skinned_mesh.castShadow = true // skinned mesh won't update right if this is false

    // do the binding for the mesh to the skelleton
    skinned_mesh.add(this.binding_skeleton.bones[0])
    skinned_mesh.bind(this.binding_skeleton)

    // keep track of all the skinned meshes we create to access later
    this.skinned_meshes.push(skinned_mesh)
  }

  public final_skinned_meshes (): SkinnedMesh[] {
    return this.skinned_meshes
  }

  public set_show_debug (value: boolean): void {
    this.show_debug = value
  }

  public set_debug_scene_object (scene: Scene): void {
    this.debug_scene_object = scene
  }

  public set_bone_index_to_test (index: number): void {
    this.bone_index_to_test = index
  }

  public calculate_weights (): number[][] {
    if (this.bone_skinning_formula === undefined) {
      console.warn('Tried to calculate_weights() but bone_skinning_formula is null for some reason!')
      return [[], []]
    }

    return this.bone_skinning_formula.calculate_indexes_and_weights()
  }
}
