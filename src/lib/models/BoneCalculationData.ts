import { type Bone } from 'three'

export default class BoneCalculationData
{
  public name: string
  public bone_object: Bone
  public supports_envelope_calculation: boolean
  public has_child_bone: boolean
  public assigned_vertices: number[]
  public use_minimum_envelope_expand: boolean

  constructor(name = '', bone: Bone, supports_envelope = false, has_child_bone = false, assigned_vertices = [], use_minimum_distance = false)
  {
    this.name = name
    this.bone_object = bone
    this.supports_envelope_calculation = supports_envelope
    this.has_child_bone = has_child_bone
    this.assigned_vertices = assigned_vertices
    this.use_minimum_envelope_expand = use_minimum_distance
  }
}
