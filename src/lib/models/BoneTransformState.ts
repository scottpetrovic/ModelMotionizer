import { type Vector3 } from 'three'

export default class BoneTransformState {
  public name: string
  public position: Vector3
  public rotation: Vector3 // Not sure if this is right
  public scale: Vector3

  constructor (name = '', position: Vector3, rotation: Vector3, scale: Vector3) {
    this.name = name
    this.position = position
    this.rotation = rotation
    this.scale = scale
  }
}
