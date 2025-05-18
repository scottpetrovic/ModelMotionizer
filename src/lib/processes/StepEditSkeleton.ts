import { UI } from '../UI.ts'
import { Generators } from '../Generators.ts'
import { Utility } from '../Utilities.ts'
import { Vector3, Euler, Object3D, Skeleton, type Scene, type Bone, BufferGeometry, 
  PointsMaterial, Points, Float32BufferAttribute, TextureLoader,
  Raycaster, type Intersection, type Camera, SphereGeometry, MeshBasicMaterial, Mesh } from 'three'
import { SkinningFormula } from '../enums/SkinningFormula.ts'

/*
 * StepEditSkeleton
 * Handles editing the skeleton of the model
 * Overview of workflow:
 * 1. Load original armature from model
 * 2. Create a skeleton that Three.js can use and we can manipulate
 * 3. Allow user to edit the three.js skeleton
 */
export class StepEditSkeleton extends EventTarget {
  private readonly ui: UI
  // Original armature data from the model data. A Skeleton type object is not
  // part of the original model data that is loaded
  private edited_armature: Object3D = new Object3D()

  // Skeleton created from the armature that Three.js uses
  private threejs_skeleton: Skeleton = new Skeleton()
  private mirror_mode_enabled: boolean = true
  private skinning_algorithm: string | null = null
  private show_debug: boolean = true

  private currently_selected_bone: Bone | null = null

  private joint_hover_point: Object3D | null = null
  private _main_scene_ref: Scene | null = null

  private readonly joint_texture = new TextureLoader().load('images/skeleton-joint-point.png')


  constructor () {
    super()
    this.ui = new UI()
  }

  public setup_scene (main_scene: Scene): void {
    // add the skeleton to the scene
    this._main_scene_ref = main_scene
  }

  public begin (): void {
    // show UI elemnents for editing mesh
    if (this.ui.dom_current_step_index != null) {
      this.ui.dom_current_step_index.innerHTML = '3'
    }

    if (this.ui.dom_current_step_element != null) {
      this.ui.dom_current_step_element.innerHTML = 'Position Joints'
    }

    if (this.ui.dom_skeleton_edit_tools != null) {
      this.ui.dom_skeleton_edit_tools.style.display = 'flex'
    }

    if (this.ui.dom_enable_skin_debugging != null) {
      this.show_debug = this.ui.dom_enable_skin_debugging.checked
    } else {
      this.show_debug = false
    }

    this.update_bind_button_text()

    // set default skinning algorithm based on first option
    const selection = this.ui.dom_skinning_algorithm_selection?.value
    this.skinning_algorithm = this.convert_skinning_algorithm_to_enum(selection)


    this.add_event_listeners()
  }

  private update_bind_button_text (): void {
    if (this.show_debug && this.ui.dom_bind_pose_button !== null) {
      this.ui.dom_bind_pose_button.innerHTML = 'Test Skinning Algorithm &nbsp;&#x203a;'
      return
    }

    if (this.ui.dom_bind_pose_button !== null) {
      this.ui.dom_bind_pose_button.innerHTML = 'Skin Model &nbsp;&#x203a;'
    }
  }

  public show_debugging (): boolean {
    return this.show_debug
  }

  /**
   * @param bone The currently selected bone
   * @description This is the bone that is currently selected in the UI while editing
   * the skeleton.
   */
  public set_currently_selected_bone (bone: Bone): void {
    this.currently_selected_bone = bone
  }

  public get_currently_selected_bone (): Bone | null {
    return this.currently_selected_bone
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
        this.threejs_skeleton.bones[0].position.set(0, 0, 0)
        this.threejs_skeleton.bones[0].updateWorldMatrix(true, true) // update on renderer
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

    this.ui.dom_skinning_algorithm_selection?.addEventListener('change', (event) => {
      const selection = event.target.value
      this.skinning_algorithm = this.convert_skinning_algorithm_to_enum(selection)
    })

    this.ui.dom_enable_skin_debugging?.addEventListener('change', (event) => {
      this.show_debug = event.target.checked
      this.update_bind_button_text()
    })
  }

  private convert_skinning_algorithm_to_enum (value: string): SkinningFormula {
    switch (value) {
      case 'closest-distance-targeting':
        return SkinningFormula.DistanceChildTargeting
      case 'closest-bone-child':
        return SkinningFormula.DistanceChild
    }

    return SkinningFormula.Distance // default if other two don't match
  }

  private remove_event_listeners (): void {
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

  public cleanup_on_exit_step (): void {
    this.remove_event_listeners()
    this.clear_hover_point_if_exists()
  }


  /*
   * Take original armature that we are editing and create a skeleton that Three.js can use
  */
  public load_original_armature_from_model (armature: Object3D): void {
    this.edited_armature = armature.clone()
    this.create_threejs_skeleton_object()
  }

  private create_threejs_skeleton_object (): Skeleton {
    // create skeleton and helper to visualize
    this.threejs_skeleton = Generators.create_skeleton(this.edited_armature.children[0])
    this.threejs_skeleton.name = 'Editing Skeleton'

    // update the world matrix for the skeleton
    // without this the skeleton helper won't appear when the bones are first loaded
    this.threejs_skeleton.bones[0].updateWorldMatrix(true, true)

    return this.threejs_skeleton
  }

  public armature (): Object3D {
    return this.edited_armature
  }

  public skeleton (): Skeleton {
    return this.threejs_skeleton
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

    this.threejs_skeleton.bones.forEach((bone) => {
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
        -selected_bone.rotation.z
      )
      mirror_bone.quaternion.setFromEuler(euler)
    }

    mirror_bone.updateWorldMatrix(true, true)
  }

  /**
   * @param event This will be called every mouse move event
   * the event listener was originally setup in the EventListener.ts file
   * it is needed for the edit skeleton step, so I added logic here
   */
  public calculate_bone_hover_effect (event: MouseEvent, camera: Camera): void {
    // create a raycaster to detect the bone that is being hovered over
    // we will only have a hover effect if the mouse is close enough to the bone
    const [closest_bone, closest_bone_index, closest_distance] =
      Utility.raycast_closest_bone_test(camera, event, this.threejs_skeleton)

    // only do selection if we are close
    // the orbit controls also have panning with alt-click, so we don't want to interfere with that
    if (closest_distance === null || closest_distance > 0.1) {
      this.update_bone_hover_point_position(null)
      return
    }

    this.update_bone_hover_point_position(closest_bone)
  }

  /**
   * Remove the hover point. This is important when we change steps
   */
  private clear_hover_point_if_exists (): void {
    if (this.joint_hover_point !== null) {
      this._main_scene_ref?.remove(this.joint_hover_point)
      this.joint_hover_point = null
    }
  }

  /**
   * Create a hover effect for the bone that would be selected for bone editing
   * @param bone 
   * @param camera 
   */
  private update_bone_hover_point_position (bone: Bone | null): void {
    // create hover point sphere for when our mouse gets close to a bone joint
    if (this.joint_hover_point === null) {
      // Create the hover point if it doesn't exist
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3)) // Single vertex at origin

      const material = new PointsMaterial({
        color: 0x69a1d0, // Blue color
        size: 20, // Size of the point in pixels
        sizeAttenuation: false, // Disable size attenuation
        depthTest: false, // always render on top
        map: this.joint_texture, // Use a circular texture
        transparent: true // Enable transparency for the circular texture
      })

      this.joint_hover_point = new Points(geometry, material)
      this.joint_hover_point.renderOrder = 100 // render on top of everything else
      this.joint_hover_point.name = 'Joint Hover Point'
      this._main_scene_ref?.add(this.joint_hover_point)
    }

    if (bone !== null) {
      // update the position of the hover point
      const world_position = Utility.world_position_from_object(bone)
      this.joint_hover_point.position.copy(world_position)
      this.joint_hover_point.updateWorldMatrix(true, true)
    } else {
      // remove the hover point if we are not hovering over a bone
      this._main_scene_ref?.remove(this.joint_hover_point)
      this.joint_hover_point = null
    }
  }


}
