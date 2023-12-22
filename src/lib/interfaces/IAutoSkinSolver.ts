import { type Object3D, type BufferGeometry } from 'three'

export interface IAutoSkinSolver {
  set_geometry: (geom: BufferGeometry) => void
  set_debugging_scene_object: (scene_object: Object3D) => void
  set_show_debug: (debug_value: boolean) => void
  set_bone_index_to_test: (bone_idx: number) => void
  calculate_indexes_and_weights: () => number[][]
}
