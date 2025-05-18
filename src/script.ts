import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import { Utility } from './lib/Utilities.ts'
import { Generators } from './lib/Generators.ts'

import { UI } from './lib/UI.ts'

import { StepLoadModel } from './lib/processes/StepLoadModel.ts'
import { StepLoadSkeleton } from './lib/processes/StepLoadSkeleton.ts'
import { StepEditSkeleton } from './lib/processes/StepEditSkeleton.ts'
import { StepAnimationsListing } from './lib/processes/StepAnimationsListing.ts'
import { StepExportToFile } from './lib/processes/StepExportToFile.ts'
import { StepWeightSkin } from './lib/processes/StepWeightSkin.ts'

import { ProcessStep } from './lib/enums/ProcessStep.ts'
import { type Bone, Group, Scene, type Skeleton, type Vector3 } from 'three'
import type BoneTesterData from './lib/models/BoneTesterData.ts'

import { build_version } from './environment.js'
import { SkeletonType } from './lib/enums/SkeletonType.ts'

import { CustomSkeletonHelper } from './lib/CustomSkeletonHelper.ts'
import { EventListeners } from './lib/EventListeners.ts'

export class Bootstrap {
  public readonly camera = Generators.create_camera()
  public readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  public controls: OrbitControls | undefined = undefined

  public readonly transform_controls: TransformControls = new TransformControls(this.camera, this.renderer.domElement)
  public is_transform_controls_dragging: boolean = false

  // has UI elements on the HTML page that we will reference/use
  public readonly ui = new UI()
  public readonly load_model_step = new StepLoadModel()
  public readonly load_skeleton_step = new StepLoadSkeleton()
  public readonly edit_skeleton_step = new StepEditSkeleton()
  public readonly weight_skin_step = new StepWeightSkin()
  public readonly animations_listing_step = new StepAnimationsListing()
  public readonly file_export_step = new StepExportToFile()
  public readonly scene: Scene = new Scene()

  // for looking at specific bones
  public process_step: ProcessStep = ProcessStep.LoadModel
  public skeleton_helper: CustomSkeletonHelper | undefined = undefined
  public debugging_visual_object: Group = new Group()

  private readonly clock = new THREE.Clock()

  private readonly environment_container: Group = new Group()
  private readonly eventListeners: EventListeners

  public initialize (): void {
    this.setup_environment()
    this.eventListeners.addEventListeners()
    this.process_step = this.process_step_changed(ProcessStep.LoadModel)
    this.animate()
    this.inject_build_version()
  } // end initialize()

  constructor () {
    this.eventListeners = new EventListeners(this)
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

    // Set default camera position for front view
    // this will help because we first want the user to rotate the model to face the front
    this.camera.position.set(0, 1.7, 15) // X:0 (centered), Y:1.7 (eye-level), Z:5 (front view)

    Generators.create_window_resize_listener(this.renderer, this.camera)
    document.body.appendChild(this.renderer.domElement)

    // center orbit controls around mid-section area with target change
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.9, 0)
    this.controls.update()

    this.scene.add(this.transform_controls.getHelper())

    // basic things in another group, to better isolate what we are working on
    this.environment_container.name = 'Setup objects'
    this.environment_container.add(...Generators.create_default_lights())
    this.environment_container.add(...Generators.create_grid_helper(0x4496a8))
    this.scene.add(this.environment_container)
  } // end setup_environment()

  public regenerate_skeleton_helper (new_skeleton: Skeleton, helper_name = 'Skeleton Helper'): void {
    // if skeleton helper exists...remove it
    if (this.skeleton_helper !== undefined) {
      this.scene.remove(this.skeleton_helper)
    }

    this.skeleton_helper = new CustomSkeletonHelper(new_skeleton.bones[0], { linewidth: 4, color: 0x4e7d58 })
    this.skeleton_helper.name = helper_name
    this.scene.add(this.skeleton_helper)
  }

  public handle_transform_controls_moving (): void {
    if (this.edit_skeleton_step.is_mirror_mode_enabled()) {
      const selected_bone: Bone = this.transform_controls.object as Bone
      this.edit_skeleton_step.apply_mirror_mode(selected_bone, this.transform_controls.getMode())
    }
  }

  private show_skin_failure_message (bone_names_with_errors: string[], error_point_positions: Vector3[]): void {
    // show the DOM HTML container to see error messages for each bone that isn't inside the mesh
    if (this.ui.dom_info_container !== null) {
      this.ui.dom_info_container.style.display = 'block'
    }

    // add the bone vertices as X markers to debugging object
    const error_markers: Group = Generators.create_x_markers(error_point_positions, 0.02, 0xff0000)
    this.debugging_visual_object.add(error_markers)

    // add information to the info panel
    if (this.ui.dom_info_panel === null) {
      console.warn('There was a skin failure, but the UI Info panel DOM element is not set to show the message.')
      return
    }

    this.ui.dom_info_panel.innerHTML = 'Somebones are outside the mesh and are marked with red. Fix them and try again.'
    this.ui.dom_info_panel.innerHTML += '<br>'

    // display the bones names in an HTML list
    let bones_error_list = '<ol id="bone-list">'
    bone_names_with_errors.forEach((bone_name: string) => {
      bones_error_list += `<li>${Utility.clean_bone_name_for_messaging(bone_name)}</li>`
    })

    bones_error_list += '</ol>'
    this.ui.dom_info_panel.innerHTML += bones_error_list
  }

  public process_step_changed (process_step: ProcessStep): ProcessStep {
    // we will have the current step turn on the UI elements it needs
    this.ui.hide_all_elements()

    // clean up things related to edit step in case we are leaving it
    this.edit_skeleton_step.cleanup_on_exit_step()

    // hide the info container by default
    if (this.ui.dom_info_container !== null) {
      this.ui.dom_info_container.style.display = 'none'
    }

    switch (process_step) {
      case ProcessStep.LoadModel:
        process_step = ProcessStep.LoadModel
        this.load_model_step.begin()
        break
      case ProcessStep.LoadSkeleton:
        process_step = ProcessStep.LoadSkeleton
        this.load_skeleton_step.begin()
        break
      case ProcessStep.EditSkeleton:
        process_step = ProcessStep.EditSkeleton
        this.edit_skeleton_step.begin()
        this.edit_skeleton_step.setup_scene(this.scene)
        this.transform_controls.enabled = true
        this.transform_controls.setMode('translate') // 'translate', 'rotate', or 'scale'
        break
      case ProcessStep.BindPose:
        this.process_step = ProcessStep.BindPose
        this.weight_skin_step.begin()
        this.transform_controls.enabled = false // shouldn't be editing bones
        this.start_skin_weighting_step()
        break
      case ProcessStep.AnimationsListing:
        this.process_step = ProcessStep.AnimationsListing
        this.animations_listing_step.begin()

        // calculate hip bone offset for human skeleton type
        if (this.load_skeleton_step.skeleton_type() === SkeletonType.Human) {
          this.animations_listing_step.calculate_hip_bone_offset(this.load_skeleton_step.armature(),
            this.edit_skeleton_step.armature())
        }

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

    // if we are in the animation listing step, we can call 
    // render/update functions in that
    if (this.process_step === ProcessStep.AnimationsListing) {
      this.animations_listing_step.frame_change(delta_time)
    }

    this.renderer.render(this.scene, this.camera)
  }

  public handle_transform_controls_mouse_down (mouse_event: MouseEvent): void {
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
      this.edit_skeleton_step.set_currently_selected_bone(closest_bone)
      this.weight_skin_step.set_bone_index_to_test(closest_bone_index)
    } else {
      this.edit_skeleton_step.set_currently_selected_bone(null)
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

  public test_bone_weighting_success (): boolean {
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

  public switchToView (view: 'front' | 'side' | 'top'): void {
    if (this.controls === undefined) {
      console.log('switching to view failed: controls are undefined')
      return
    }

    const distance = 10
    const target_position = new THREE.Vector3()
    switch (view) {
      case 'front':
        target_position.set(0, 0, distance)
        break
      case 'side':
        target_position.set(distance, 0, 0)
        break
      case 'top':
        target_position.set(0, distance, 0)
        break
    }

    const bounding_box = this.load_model_step.model_meshes().children[0].geometry.boundingBox
    const model_height = bounding_box.max.y - bounding_box.min.y
    const target = new THREE.Vector3(0, model_height / 2, 0) // look at origin, adjusted for model height

    const start_position = this.camera.position.clone()
    const start_time = performance.now()
    const duration = 0.25 // seconds

    const animate = (current_time: number) => {
      const elapsed_time = (current_time - start_time) / 1000
      const t = Math.min(elapsed_time / duration, 1) // normalize time to [0, 1]

      this.camera.position.lerpVectors(start_position, target_position, t)
      this.controls.target.lerp(target, t)
      this.controls.update()

      if (t < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }
} // end Bootstrap class

// Create an instance of the Bootstrap class when the script is loaded
const app = new Bootstrap()
app.initialize()
