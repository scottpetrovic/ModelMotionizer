import { type Vector3 } from 'three'

export default class IntersectionGeometryData {
  public vertices: Vector3[] = []
  public distances: number[] = []

  constructor (vertices: Vector3[], distances: number[]) {
    this.vertices = vertices
    this.distances = distances
  }
}
