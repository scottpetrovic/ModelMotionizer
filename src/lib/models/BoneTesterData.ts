import { type Vector3 } from 'three'

// returns back if we are having issues with bones inside of mesh
export default class BoneTesterData {
  public bones_names_with_errors: string[] = []
  public bones_vertices_with_errors: Vector3[] = []

  constructor (bones_names_with_errors: string[], bones_vertices_with_errors: Vector3[]) {
    this.bones_names_with_errors = bones_names_with_errors
    this.bones_vertices_with_errors = bones_vertices_with_errors
  }
}
