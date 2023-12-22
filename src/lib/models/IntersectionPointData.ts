import { type Vector3 } from 'three'

export default class IntersectionPointData {
  public vertex_positions: Vector3[] = []
  public vertex_indices: number[] = []

  constructor (vertex_positions: Vector3[], vertex_indices: number[]) {
    this.vertex_positions = vertex_positions
    this.vertex_indices = vertex_indices
  }
}
