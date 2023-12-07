export class UI {
    constructor() 
    {
        this._initializeDOMElements()
    }

    _initializeDOMElements()
    {
        // grab all UI Elements from page that we need to interact with
        this.dom_current_step_index = document.querySelector('#current-step-index')
        this.dom_current_step_element = document.querySelector('#current-step-label')
        this.dom_transform_controls_switch = document.querySelector('#transform-controls')

        // UI controls for loading the model
        this.dom_load_model_tools = document.querySelector('#load-model-tools')
        this.dom_upload_model_button = document.querySelector('#model-upload')
        this.dom_load_model_button = document.querySelector('#load-model-button')
        this.dom_load_model_debug_checkbox = document.querySelector('#load-model-debug-checkbox')

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

        // UI for exporting the animation
        this.dom_export_button_hidden_link = document.querySelector('#download-hidden-link')
    }

    get_animated_selected_elements()
    {
        // this needs to be called ad-hoc as selections might change
        return document.querySelectorAll('#animations-items input[type="checkbox"]')
    }

    hideAllElements()
    {
        this.dom_transform_controls_switch.style.display = 'none';
        this.dom_load_model_tools.style.display = 'none';
        this.dom_load_skeleton_tools.style.display = 'none';
        this.dom_skeleton_edit_tools.style.display = 'none';
        this.dom_skinned_mesh_tools.style.display = 'none';
        this.dom_skinned_mesh_animation_tools.style.display = 'none';
    }

    build_animation_clip_ui(animation_clips_to_load)
    {
        /// take the animation_clips_loaded, loop through them, and build out the UI
        this.dom_animation_clip_list.innerHTML = '';
        animation_clips_to_load.forEach((animation_clip, index) => {
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
        });
    }
}