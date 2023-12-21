import { UI } from '../UI.ts'
import { Generators } from '../Generators.ts'
import { Utility } from '../Utilities.ts'
import { Vector3, Euler, Object3D, Skeleton, Bone } from 'three'
import { SkinningFormula } from '../enums/SkinningFormula.js'

export class StepEditSkeleton extends EventTarget {
  private readonly ui: UI
  private edited_armature: Object3D = new Object3D()
  private edited_skeleton: Skeleton = new Skeleton()
  private mirror_mode_enabled: boolean = true
  private skinning_algorithm: string = SkinningFormula.Envelope
  private show_debug: boolean = true

  constructor () {
    super()
    this.ui = new UI()
  }

  public begin (): void {
    // show UI elemnents for editing mesh
    if (this.ui.dom_current_step_index != null) {
      this.ui.dom_current_step_index.innerHTML = '3'
    }

    if (this.ui.dom_current_step_element != null) {
      this.ui.dom_current_step_element.innerHTML = 'Edit Skeleton'
    }

    if (this.ui.dom_transform_controls_switch != null) {
      this.ui.dom_transform_controls_switch.style.display = 'flex'
    }

    if (this.ui.dom_skeleton_edit_tools != null) {
      this.ui.dom_skeleton_edit_tools.style.display = 'flex'
    }

    if (this.ui.dom_enable_skin_debugging != null) {
      this.show_debug = this.ui.dom_enable_skin_debugging.checked
    }

    this.update_bind_button_text()

    this.add_event_listeners()
  }

  public instructions_text (): string {
    return `<div>Instructions</div> 
        <div>Position skeleton into correct postion</div>
                <ol>
                  <li>Context clicking in model will select bones</li>
                  <li>Move and rotate bones into position with transform controls</li>
                  <li>Use the "Mirror" option to help position symmetrical bones</li>
                  <li>Debug skinning allows you to preview skinning results for testing</li>
                  <li>Try a different skinning algorithm if you aren't getting the results you like</li>
                </ol>`
  }

  private update_bind_button_text (): void {
    if (this.show_debug && this.ui.dom_bind_pose_button !== null) {
      this.ui.dom_bind_pose_button.innerHTML = 'Test Skinning'
      return
    }

    if (this.ui.dom_bind_pose_button !== null) {
      this.ui.dom_bind_pose_button.innerHTML = 'Skin Model'
    }
  }

  public show_debugging (): boolean {
    return this.show_debug
  }

  public set_mirror_mode_enabled (value: boolean): void {
    this.mirror_mode_enabled = value
  }

  public is_mirror_mode_enabled (): boolean {
    return this.mirror_mode_enabled
  }

  public algorithm (): string {
    return this.skinning_algorithm
  }

  public add_event_listeners (): void {
    if (this.ui.dom_move_to_origin_button !== null) {
      this.ui.dom_move_to_origin_button.addEventListener('click', () => {
        // the base bone itself is not at the origin, but the parent is the armature object
        this.edited_skeleton.bones[0].position.set(0, 0, 0)
        this.edited_skeleton.bones[0].updateWorldMatrix(true, true) // update on renderer
      })
    }

    if (this.ui.dom_scale_skeleton_button !== null && this.ui.dom_scale_skeleton_input_box !== null) {
      this.ui.dom_scale_skeleton_button.addEventListener('click', () => {
        const modify_scale = 1.0 + (this.ui.dom_scale_skeleton_input_box.value / 100.0)
        Utility.scale_armature_by_scalar(this.edited_armature, modify_scale)
        this.edited_armature.updateWorldMatrix(true, true)
      })
    }

    if (this.ui.dom_mirror_skeleton_checkbox !== null) {
      this.ui.dom_mirror_skeleton_checkbox.addEventListener('change', (event) => {
        // mirror skeleton movements along the X axis
        this.set_mirror_mode_enabled(event.target.checked)
      })
    }

    if (this.ui.dom_skinning_algorithm_selection !== null) {
      this.ui.dom_skinning_algorithm_selection.addEventListener('change', (event) => {
        const selection = event.target.value

        if (selection === 'bone-envelope') {
          this.skinning_algorithm = SkinningFormula.Envelope
        } else if (selection === 'closest-bone') {
          this.skinning_algorithm = SkinningFormula.Distance
        } else if (selection === 'closest-bone-middle') {
          this.skinning_algorithm = SkinningFormula.MedianDistance
        }
      })
    }

    if (this.ui.dom_enable_skin_debugging !== null) {
      this.ui.dom_enable_skin_debugging.addEventListener('change', (event) => {
        this.show_debug = event.target.checked
        this.update_bind_button_text()
      })
    }
  }

  public remove_event_listeners (): void {
    if (this.ui.dom_move_to_origin_button !== null) {
      this.ui.dom_move_to_origin_button.removeEventListener('click', () => {})
    }

    if (this.ui.dom_scale_skeleton_button !== null) {
      this.ui.dom_scale_skeleton_button.removeEventListener('click', () => {})
    }

    if (this.ui.dom_mirror_skeleton_checkbox !== null) {
      this.ui.dom_mirror_skeleton_checkbox.removeEventListener('change', () => {})
    }

    if (this.ui.dom_skinning_algorithm_selection !== null) {
      this.ui.dom_skinning_algorithm_selection.removeEventListener('change', () => {})
    }

    if (this.ui.dom_enable_skin_debugging !== null) {
      this.ui.dom_enable_skin_debugging.removeEventListener('change', () => {})
    }
  }

  public set_armature (armature: Object3D): void {
    this.edited_armature = armature.clone()
    this.create_skeleton()
  }

  private create_skeleton (): Skeleton {
    // create skeleton and helper to visualize
    this.edited_skeleton = Generators.create_skeleton(this.edited_armature.children[0])
    this.edited_skeleton.name = 'Editing Skeleton'

    // update the world matrix for the skeleton
    // without this the skeleton helper won't appear when the bones are first loaded
    this.edited_skeleton.bones[0].updateWorldMatrix(true, true)

    return this.edited_skeleton
  }

  public armature (): Object3D {
    return this.edited_armature
  }

  public skeleton (): Skeleton {
    return this.edited_skeleton
  }

  public apply_mirror_mode (selected_bone: Bone, transform_type: string): void {
    // if we are on the positive side mirror mode is enabled
    // we need to change the position of the bone on the other side of the mirror

    // first step is to find the base bone name 
    // strip out the left/right and _L/_R from the name
    // mixamo is a common skeleton that prefixes everything with mixamorig_, so remove that
    const base_bone_name = Utility.calculate_bone_base_name(selected_bone.name)

    // Find another bone that has the same base name
    // that should be the mirror
    let mirror_bone: Bone | undefined

    this.edited_skeleton.bones.forEach((bone) => {
      const bone_name_to_compare = Utility.calculate_bone_base_name(bone.name)
      if (bone_name_to_compare === base_bone_name && bone.name !== selected_bone.name) {
        mirror_bone = bone
      }
    })

    if (mirror_bone === undefined) {
      return // we probably something along the axis (head, neck, spine)
    }

    if (transform_type === 'translate') {
      // move the mirror bone in the -X value of the transform control
      // this will mirror the movement of the bone
      mirror_bone.position.copy(
        new Vector3(
          -selected_bone.position.x,
          selected_bone.position.y,
          selected_bone.position.z
        ))
    }

    if (transform_type === 'rotate') {
      const euler = new Euler(
        selected_bone.rotation.x,
        -selected_bone.rotation.y,
        -selected_bone.rotation.z,
      )
      mirror_bone.quaternion.setFromEuler(euler)
    }

    mirror_bone.updateWorldMatrix(true, true)
  }
}
