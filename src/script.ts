import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { Utility } from './lib/Utilities.ts'
import { Generators } from './lib/Generators.ts'

import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import { UI } from './lib/UI.ts'

import { StepLoadModel } from './lib/processes/StepLoadModel.ts'
import { StepLoadSkeleton } from './lib/processes/StepLoadSkeleton.ts'
import { StepEditSkeleton } from './lib/processes/StepEditSkeleton.ts'
import { StepAnimationsListing } from './lib/processes/StepAnimationsListing.ts'
import { StepExportToFile } from './lib/processes/StepExportToFile.ts'
import { StepWeightSkin } from './lib/processes/StepWeightSkin.ts'

import { ProcessStep } from './lib/enums/ProcessStep.ts'
import { type Bone, Group, Scene, type Skeleton, type Vector3, type SkeletonHelper, type Points } from 'three'
import type BoneTesterData from './lib/models/BoneTesterData.ts'

import { build_version } from './environment.js'
import { SkeletonType } from './lib/enums/SkeletonType.ts'

export class Bootstrap {
  private readonly camera = Generators.create_camera()
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private controls: OrbitControls | undefined = undefined

  private readonly transform_controls: TransformControls = new TransformControls(this.camera, this.renderer.domElement)
  private is_transform_controls_dragging: boolean = false

  // has UI elements on the HTML page that we will reference/use
  private readonly ui = new UI()
  private readonly load_model_step = new StepLoadModel()
  private readonly load_skeleton_step = new StepLoadSkeleton()
  private readonly edit_skeleton_step = new StepEditSkeleton()
  private readonly weight_skin_step = new StepWeightSkin()
  private readonly animations_listing_step = new StepAnimationsListing()
  private readonly file_export_step = new StepExportToFile()
  private readonly scene: Scene = new Scene()

  // for looking at specific bones
  private skeleton_helper: SkeletonHelper | undefined = undefined
  private debugging_visual_object: Group = new Group()
  private process_step: ProcessStep = ProcessStep.LoadModel

  private readonly clock = new THREE.Clock()

  private readonly environment_container: Group = new Group()

  public initialize (): void {
    this.setup_environment()
    this.add_event_listeners()

    this.process_step = this.process_step_changed(ProcessStep.LoadModel)
    this.animate()
    this.inject_build_version()
  } // end initialize()

  constructor () {
    // helps resolve requestAnimationFrame calling animate() with wrong context
    this.animate = this.animate.bind(this)
  }

  private inject_build_version (): void {
    if (this.ui.dom_build_version !== null) {
      this.ui.dom_build_version.innerHTML = build_version
    } else {
      console.warn('Build version DOM element is null. Cannot set number')
    }
  }

  private setup_environment (): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true

    Generators.create_window_resize_listener(this.renderer, this.camera)
    document.body.appendChild(this.renderer.domElement)

    // center orbit controls around mid-section area with target change
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.9, 0)
    this.controls.update()

    this.scene.add(this.transform_controls)

    // basic things in another group, to better isolate what we are working on
    this.environment_container.name = 'Setup objects'
    this.environment_container.add(...Generators.create_default_lights())
    this.environment_container.add(...Generators.create_grid_helper())
    this.scene.add(this.environment_container)

    const fog_near = 0
    const fog_far = 80
    const fog_color = 0x0d2525
    this.scene.fog = new THREE.Fog(fog_color, fog_near, fog_far)
  } // end setup_environment()

  private regenerate_skeleton_helper (new_skeleton: Skeleton, helper_name = 'Skeleton Helper'): void {
    // if skeleton helper exists...remove it
    if (this.skeleton_helper !== undefined) {
      this.scene.remove(this.skeleton_helper)
    }

    this.skeleton_helper = new THREE.SkeletonHelper(new_skeleton.bones[0])
    this.skeleton_helper.name = helper_name
    this.scene.add(this.skeleton_helper)
  }

  private handle_transform_controls_moving (): void {
    if (this.edit_skeleton_step.is_mirror_mode_enabled()) {
      const selected_bone: Bone = this.transform_controls.object as Bone
      this.edit_skeleton_step.apply_mirror_mode(selected_bone, this.transform_controls.getMode())
    }
  }

  private show_skin_failure_message (bone_names_with_errors: string[], error_point_positions: Vector3[]): void {
    // add the bone vertices as sphere to debugging object
    const sphere_failures: Points = Generators.create_spheres_for_points(error_point_positions, 0.08, 0xff0000)
    this.debugging_visual_object.add(sphere_failures)

    // add information to the info panel
    if (this.ui.dom_info_panel === null) {
      console.warn('There was a skin failure, but the UI Info panel DOM element is not set to show the message.')
      return
    }

    this.ui.dom_info_panel.innerHTML = 'Some bones are outside the mesh. Fix them up and try to bind again'
    this.ui.dom_info_panel.innerHTML += '<br>'

    // display the bones names in an HTML list
    let bones_error_list = '<ol id="bone-list">'
    bone_names_with_errors.forEach((bone_name: string) => {
      bones_error_list += `<li>${Utility.clean_bone_name_for_messaging(bone_name)}</li>`
    })

    bones_error_list += '</ol>'
    this.ui.dom_info_panel.innerHTML += bones_error_list
  }

  private process_step_changed (process_step: ProcessStep): ProcessStep {
    // we will have the current step turn on the UI elements it needs
    this.ui.hide_all_elements()

    // clean up any event listeners from the previous steps
    this.edit_skeleton_step.remove_event_listeners()

    switch (process_step) {
      case ProcessStep.LoadModel:
        process_step = ProcessStep.LoadModel
        this.load_model_step.begin()
        this.ui.dom_info_panel.innerHTML = this.load_model_step.instructions_text()
        break
      case ProcessStep.LoadSkeleton:
        process_step = ProcessStep.LoadSkeleton
        this.load_skeleton_step.begin()
        this.ui.dom_info_panel.innerHTML = this.load_skeleton_step.instructions_text()
        break
      case ProcessStep.EditSkeleton:
        process_step = ProcessStep.EditSkeleton
        this.edit_skeleton_step.begin()
        this.transform_controls.enabled = true
        this.transform_controls.setMode('translate')
        this.ui.dom_transform_controls_switch.style.display = 'none' // hide the UI control until we have a bone selected
        this.ui.dom_info_panel.innerHTML = this.edit_skeleton_step.instructions_text()
        break
      case ProcessStep.BindPose:
        this.process_step = ProcessStep.BindPose
        this.ui.dom_info_panel.innerHTML = this.weight_skin_step.instructions_text()
        this.weight_skin_step.begin()
        this.transform_controls.enabled = false // shouldn't be editing bones
        this.start_skin_weighting_step()
        break
      case ProcessStep.AnimationsListing:
        this.process_step = ProcessStep.AnimationsListing
        this.ui.dom_info_panel.innerHTML = this.animations_listing_step.instructions_text()
        this.animations_listing_step.begin()
        this.transform_controls.setMode('rotate')
        this.animations_listing_step.load_and_apply_default_animation_to_skinned_mesh(this.weight_skin_step.final_skinned_meshes(),
          this.load_skeleton_step.skeleton_type())
        break
    }

    // when we change steps, we are re-creating the skeleeton and helper
    // so the current transform control reference will be lost/give an error
    this.transform_controls.detach()

    return process_step
  } // end process_step_changed()

  private animate (): void {
    requestAnimationFrame(this.animate)
    const delta_time = this.clock.getDelta()
    this.animations_listing_step.mixer().update(delta_time)
    this.renderer.render(this.scene, this.camera)
  }

  private handle_transform_controls_mouse_down (mouse_event: MouseEvent): void {
    // primary click is made for rotating around 3d scene
    const is_primary_button_click = mouse_event.button === 0

    if (is_primary_button_click) { return }
    if (this.edit_skeleton_step.skeleton()?.bones === undefined) { return }

    // when we are done with skinned mesh, we shouldn't be editing transforms
    if (!this.transform_controls.enabled) {
      return
    }

    // we will change which skeleton we do an intersection test with
    // depending on what step we are on. We are either moving the setup skeleton
    // or moving the bind pose skeleton
    let skeleton_to_test: Skeleton | undefined

    if (this.process_step === ProcessStep.EditSkeleton) {
      skeleton_to_test = this.edit_skeleton_step.skeleton()
    } else {
      skeleton_to_test = this.weight_skin_step.skeleton()
    }

    // ig no skeleton to test, abort
    if (skeleton_to_test === undefined) {
      return
    }

    const [closest_bone, closest_bone_index, closest_distance] = Utility.raycast_closest_bone_test(this.camera, mouse_event, skeleton_to_test)

    // only do selection if we are close
    // the orbit controls also have panning with alt-click, so we don't want to interfere with that
    if (closest_distance === null || closest_distance > 0.1) {
      return
    }

    if (closest_bone !== null) {
      this.transform_controls.attach(closest_bone)
      this.weight_skin_step.set_bone_index_to_test(closest_bone_index)
      this.ui.dom_transform_controls_switch.style.display = 'flex'
    }
  }

  private add_event_listeners (): void {
    this.renderer.domElement.addEventListener('mousemove', (event: MouseEvent) => {
      if (this.is_transform_controls_dragging) {
        this.handle_transform_controls_moving()
      }
    })

    this.renderer.domElement.addEventListener('mousedown', (event: MouseEvent) => {
      this.handle_transform_controls_mouse_down(event)
    }, false)

    if (this.transform_controls !== undefined) {
      this.transform_controls.addEventListener('dragging-changed', (event) => {
        console.log(this.is_transform_controls_dragging)
        this.is_transform_controls_dragging = event.value // monitor the dragging state for transform control
      })

      this.transform_controls.addEventListener('dragging-changed', (event) => {
        this.controls.enabled = !event.value
      })
    }

    this.load_model_step.addEventListener('modelLoaded', (event) => {
      this.scene.add(this.load_model_step.model_meshes())
      this.process_step = this.process_step_changed(ProcessStep.LoadSkeleton)
    })

    this.load_skeleton_step.addEventListener('skeletonLoaded', (event) => {
      // pass in our loaded armature to the edit skeleton for further editing
      // keep a reference to our initial skeleton data in case we want to revert
      this.edit_skeleton_step.set_armature(this.load_skeleton_step.armature())

      this.regenerate_skeleton_helper(this.edit_skeleton_step.skeleton())

      this.process_step = this.process_step_changed(ProcessStep.EditSkeleton)
    })

    if (this.ui.dom_bind_pose_button !== null) {
      this.ui.dom_bind_pose_button.addEventListener('click', () => {
        // make sure we have a valid bone position before we try to do any weighting
        // this test validates that bones are inside the mesh
        const passed_bone_skinning_test = this.test_bone_weighting_success()
        if (passed_bone_skinning_test) {
          this.process_step_changed(ProcessStep.BindPose)
        }
      })
    }

    this.ui.dom_rotate_model_x_button.addEventListener('click', () => {
      this.load_model_step.rotate_model_by_axis('x', 90)
    })

    this.ui.dom_rotate_model_y_button.addEventListener('click', () => {
      this.load_model_step.rotate_model_by_axis('y', 90)
    })

    this.ui.dom_show_skeleton_checkbox.addEventListener('click', (event) => {
      if (this.skeleton_helper !== undefined) {
        this.skeleton_helper.visible = event.target.checked
      } else {
        console.warn('Skeleton helper is undefined, so we cannot show it')
      }
    })

    this.ui.dom_export_button.addEventListener('click', () => {
      const all_clips = this.animations_listing_step.animation_clips()
      this.file_export_step.set_animation_clips_to_export(all_clips)
      this.file_export_step.export(this.weight_skin_step.final_skinned_meshes(), 'exported-model')
    })

    this.ui.dom_back_to_edit_skeleton_button.addEventListener('click', () => {
      // clear existing skinned mesh if it exists
      const existing_skinned_meshes = this.scene.children.filter((child) => child.name === 'Skinned Mesh')

      existing_skinned_meshes.forEach((existing_skinned_mesh) => {
        Utility.remove_object_with_children(existing_skinned_mesh)
      })

      this.debugging_visual_object = Utility.regenerate_debugging_scene(this.scene) // clear out the debugging scene
      this.process_step = this.process_step_changed(ProcessStep.EditSkeleton)
      this.regenerate_skeleton_helper(this.edit_skeleton_step.skeleton())
      this.load_model_step.model_meshes().visible = true // show the unskinned mesh again
    })

    this.ui.dom_transform_controls_switch.addEventListener('click', function (event) {
      const targetElement = event.target

      if (targetElement.value === undefined) {
        return // half of events for this are returning null for some reason
      }

      if (targetElement.value === 'translation') {
        this.transform_controls.setMode('translate')
      } else if (targetElement.value === 'rotation') {
        this.transform_controls.setMode('rotate')
      }
    })

    window.addEventListener('click', (event: MouseEvent) => {
      this.handle_closing_drop_down_ui(event)
    }, false)
  } // end event listeners

  private handle_closing_drop_down_ui (event: MouseEvent): void {
    if (event?.target === null) {
      return
    }

    const target_element = event.target as Element

    const target_has_dropdown = target_element.matches('.dropbtn') // button object
    const parent_class_has_dropdown = target_element.parentElement?.matches('.dropbtn') // text inside button

    if (!target_has_dropdown && parent_class_has_dropdown === false) {
      const drop_downs = document.getElementsByClassName('dropdown-content')
      let i = 0
      for (i = 0; i < drop_downs.length; i++) {
        const open_drop_downs = drop_downs[i]
        if (open_drop_downs.classList.contains('show')) {
          open_drop_downs.classList.remove('show')
        }
      }
    }
  }

  private start_skin_weighting_step (): void {
    // we only need one binding skeleton. All skinned meshes will use this.
    this.weight_skin_step.create_binding_skeleton()

    this.weight_skin_step.clear_skinned_meshes() // clear out any existing skinned meshes in storage
    this.load_model_step.models_geometry_list().forEach((mesh_geometry, index) => {
      // we passed the bone test, so we can do the skinning process
      this.weight_skin_step.set_mesh_geometry(mesh_geometry)
      const [final_skin_indices, final_skin_weights]: number[][] = this.weight_skin_step.calculate_weights();

      mesh_geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(final_skin_indices, 4))
      mesh_geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(final_skin_weights, 4))

      // create a separate skinned skeleton and helper for the binding pose
      // having a separate one will help us if we want to go back and edit the original skeleton
      const mesh_material = this.load_model_step.models_material_list()[index]
      this.weight_skin_step.create_skinned_mesh(mesh_geometry, mesh_material)

      this.scene.add(...this.weight_skin_step.final_skinned_meshes())
    })

    // remember our skeleton position before we do the skinning process
    // that way if we revert to try again...we will have the original positions/rotations
    this.load_model_step.model_meshes().visible = false // hide our unskinned mesh after we have done the skinning process

    // re-define skeleton helper to use the skinned mesh)
    if (this.weight_skin_step.skeleton() === undefined) {
      console.warn('Tried to regenerate skeleton helper, but skeleton is undefined!')
      return
    }

    // not sure why typescript linter cannot figure out that the skeleton is defined here as I did a check above
    this.regenerate_skeleton_helper(this.weight_skin_step.skeleton())

    // we might want to test out the binding algorithm to see various hitboxes
    // if we are doing debugging, go to that view, if no debugging, go straight to thd animation listing step
    if (this.edit_skeleton_step.show_debugging()) {
      return
    }

    this.process_step_changed(ProcessStep.AnimationsListing)
  }

  private test_bone_weighting_success (): boolean {
    this.debugging_visual_object = Utility.regenerate_debugging_scene(this.scene) // clear out the debugging scene

    this.weight_skin_step.create_bone_formula_object(this.edit_skeleton_step.armature(), this.edit_skeleton_step.algorithm(),
      this.load_skeleton_step.skeleton_type())

    if (this.edit_skeleton_step.show_debugging()) {
      this.weight_skin_step.set_show_debug(this.edit_skeleton_step.show_debugging())
      this.weight_skin_step.set_debug_scene_object(this.debugging_visual_object)
      this.weight_skin_step.set_bone_index_to_test(-1)
    }

    // Don't do skinning operation if there are bones outside of the mesh
    // that messes up the bone envelope calculation
    let testing_geometry_success = true
    this.load_model_step.models_geometry_list().forEach((mesh_geometry, index) => {
      this.weight_skin_step.set_mesh_geometry(mesh_geometry)
      const tester_data: BoneTesterData = this.weight_skin_step.test_geometry()

      if (tester_data.bones_names_with_errors.length > 0) {
        const names_with_object_index: string[] =
          tester_data.bones_names_with_errors.map((bone_name: string) => bone_name + ` ${mesh_geometry.name}`)
        this.show_skin_failure_message(names_with_object_index, tester_data.bones_vertices_with_errors)
        testing_geometry_success = false
      }
    })

    if (!testing_geometry_success) {
      return false
    }

    return true
  }
} // end Bootstrap class

// Create an instance of the Bootstrap class when the script is loaded
const app = new Bootstrap()
app.initialize()
