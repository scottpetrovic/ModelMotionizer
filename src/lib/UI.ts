import { type AnimationClip } from 'three'

export class UI {
  dom_current_step_index: HTMLElement | null = null
  dom_current_step_element: HTMLElement | null = null
  dom_transform_controls_switch: HTMLElement | null = null
  dom_load_model_tools: HTMLElement | null = null
  dom_upload_model_button: HTMLButtonElement | null = null
  dom_load_model_button: HTMLButtonElement | null = null
  dom_load_model_debug_checkbox: HTMLInputElement | null = null
  dom_rotate_model_x_button: HTMLButtonElement | null = null
  dom_rotate_model_y_button: HTMLButtonElement | null = null
  dom_rotate_model_z_button: HTMLButtonElement | null = null
  dom_load_skeleton_tools: HTMLElement | null = null
  dom_load_skeleton_button: HTMLButtonElement | null = null
  dom_skeleton_edit_tools: HTMLElement | null = null
  dom_skeleton_drop_type: HTMLElement | null = null
  dom_mirror_skeleton_checkbox: HTMLElement | null = null
  dom_scale_skeleton_button: HTMLButtonElement | null = null
  dom_bind_pose_button: HTMLButtonElement | null = null
  dom_scale_skeleton_input_box: HTMLElement | null = null
  dom_move_to_origin_button: HTMLButtonElement | null = null
  dom_skinning_algorithm_selection: HTMLElement | null = null
  dom_skinned_mesh_tools: HTMLElement | null = null
  dom_skinned_mesh_animation_tools: HTMLElement | null = null
  dom_show_skeleton_checkbox: HTMLElement | null = null
  dom_back_to_edit_skeleton_button: HTMLButtonElement | null = null
  dom_enable_skin_debugging: HTMLInputElement | null = null
  dom_animation_clip_list: HTMLElement | null = null
  dom_export_button: HTMLButtonElement | null = null
  dom_info_panel: HTMLElement | null = null
  dom_import_animations_button: HTMLButtonElement | null = null
  dom_extend_arm_input: HTMLElement | null = null
  dom_extend_arm_button: HTMLButtonElement | null = null
  dom_export_button_hidden_link: HTMLElement | null = null
  dom_build_version: HTMLElement | null = null
  dom_animation_import_options: HTMLElement | null = null
  dom_import_animations_buton: HTMLButtonElement | null = null
  dom_import_animation_upload: HTMLElement | null = null

  constructor () {
    this.initialize_dom_elements()
  }

  private initialize_dom_elements (): void {
    // grab all UI Elements from page that we need to interact with
    this.dom_current_step_index = document.querySelector('#current-step-index')
    this.dom_current_step_element = document.querySelector('#current-step-label')
    this.dom_transform_controls_switch = document.querySelector('#transform-controls')

    // UI controls for loading the model
    this.dom_load_model_tools = document.querySelector('#load-model-tools')
    this.dom_upload_model_button = document.querySelector('#model-upload')
    this.dom_load_model_button = document.querySelector('#load-model-button')
    this.dom_load_model_debug_checkbox = document.querySelector('#load-model-debug-checkbox')

    this.dom_rotate_model_x_button = document.querySelector('#rotate-model-x-button')
    this.dom_rotate_model_y_button = document.querySelector('#rotate-model-y-button')
    this.dom_rotate_model_z_button = document.querySelector('#rotate-model-z-button')

    // UI controls for loading/working with skeleton
    this.dom_load_skeleton_tools = document.querySelector('#load-skeleton-tools')
    this.dom_load_skeleton_button = document.querySelector('#load-skeleton-button')
    this.dom_skeleton_edit_tools = document.querySelector('#skeleton-step-actions')
    this.dom_skeleton_drop_type = document.querySelector('#skeleton-selection')
    this.dom_mirror_skeleton_checkbox = document.querySelector('#mirror-skeleton')
    this.dom_scale_skeleton_button = document.querySelector('#scale-skeleton-button')

    this.dom_bind_pose_button = document.querySelector('#action_bind_pose')
    this.dom_scale_skeleton_input_box = document.querySelector('#scale-input')
    this.dom_move_to_origin_button = document.querySelector('#action_move_to_origin')
    this.dom_skinning_algorithm_selection = document.querySelector('#skinning-algorithm-options')

    // UI controls for working with skinned mesh
    this.dom_skinned_mesh_tools = document.querySelector('#skinned-step-tools')
    this.dom_skinned_mesh_animation_tools = document.querySelector('#skinned-step-animation-export-options')
    this.dom_show_skeleton_checkbox = document.querySelector('#show-skeleton-checkbox')
    this.dom_back_to_edit_skeleton_button = document.querySelector('#action_back_to_edit_skeleton')
    this.dom_enable_skin_debugging = document.querySelector('#debug-skinning-checkbox')

    // UI Controls for working with animation list/selection and export
    this.dom_animation_clip_list = document.querySelector('#animations-items')
    this.dom_export_button = document.querySelector('#export-button')
    this.dom_info_panel = document.querySelector('#info-messaging')

    this.dom_extend_arm_input = document.querySelector('#extend-arm-input')
    this.dom_extend_arm_button = document.querySelector('#extend-arm-button')

    this.dom_build_version = document.querySelector('#build-version')

    this.dom_import_animation_upload = document.querySelector('#import-animations-upload')

    this.dom_import_animations_buton = document.querySelector('#import-animations-button')
    this.dom_animation_import_options = document.querySelector('#animation-import-options')

    // UI for exporting the animation
    this.dom_export_button_hidden_link = document.querySelector('#download-hidden-link')
  }

  public get_animated_selected_elements (): NodeListOf<Element> {
    // this needs to be called ad-hoc as selections might change
    return document.querySelectorAll('#animations-items input[type="checkbox"]')
  }

  public hide_all_elements (): void {
    if (this.dom_transform_controls_switch != null) {
      this.dom_transform_controls_switch.style.display = 'none'
    }
    if (this.dom_load_model_tools != null) {
      this.dom_load_model_tools.style.display = 'none'
    }
    if (this.dom_load_skeleton_tools != null) {
      this.dom_load_skeleton_tools.style.display = 'none'
    }
    if (this.dom_skeleton_edit_tools != null) {
      this.dom_skeleton_edit_tools.style.display = 'none'
    }
    if (this.dom_skinned_mesh_tools != null) {
      this.dom_skinned_mesh_tools.style.display = 'none'
    }
    if (this.dom_skinned_mesh_animation_tools != null) {
      this.dom_skinned_mesh_animation_tools.style.display = 'none'
    }
  }

  public build_animation_clip_ui (animation_clips_to_load: AnimationClip[]): void {
    if (this.dom_animation_clip_list === null) {
      return
    }

    /// take the animation_clips_loaded, loop through them, and build out the UI
    this.dom_animation_clip_list.innerHTML = ''
    animation_clips_to_load.forEach((animation_clip, index) => {
      if (this.dom_animation_clip_list == null) {
        return
      }

      this.dom_animation_clip_list.innerHTML +=
              `<div class="anim-item">
                  <div>
                      <button class="secondary-button play" data-index="${index}">&#9658;</button>
                      <span style="align-self: center">${animation_clip.name}</span>
                  </div>
                  <div>
                      <input type="checkbox" name="${animation_clip.name}" value="${index}">
                  </div>
              </div>`
    })
  }
}
