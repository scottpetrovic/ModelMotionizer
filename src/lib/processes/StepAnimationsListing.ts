import { UI } from '../UI.ts'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'

import { AnimationClip, AnimationMixer, Quaternion, Vector3, type SkinnedMesh, type QuaternionKeyframeTrack, 
  type KeyframeTrack, type AnimationAction, type Object3D, Bone } from 'three'

import { SkeletonType } from '../enums/SkeletonType.ts'
import { MixamoToSimpleMapping } from '../mapping/MixamoToSimple.js'
import { BVHToSimpleMapping } from '../mapping/BVHToSimple.ts'
import { CarnegieMellonUniversityToMixamoMapping } from '../mapping/CarnegieMellonUniversityToMixamo.ts'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepAnimationsListing extends EventTarget {
  private readonly ui: UI
  private animation_clips_loaded: AnimationClip[] = []
  private gltf_animation_loader: GLTFLoader = new GLTFLoader()
  private fbx_animation_loader: FBXLoader = new FBXLoader()

  private animation_mixer: AnimationMixer = new AnimationMixer()
  private skinned_meshes_to_animate: SkinnedMesh[] = []
  private current_playing_index: number = 0
  private skeleton_type: string = SkeletonType.Human
  private skeleton_type_trying_to_import: string = 'mixamo-skeleton' // manually importing animation file

  // -z will bring hip bone down
  private hip_bone_offset: Vector3 = new Vector3(0, 0, 0) // -z will bring hip bone down. Helps set new base hip position
  private hip_bone_scale_factor_z: number = 1.0 // this is used to scale the hip bone position for animations

  // the human model has a hip bone that needs position changes applied
  // This will be for animations like falling. We need to capture the offset between
  // the original position and the new position from our edited armature
  public calculate_hip_bone_offset (original_armature: Object3D, edited_armature: Object3D): void {
    const original_hip_bone: Bone = this.find_bone_from_armature(original_armature, 'DEF-hips')
    const edited_hip_bone: Bone = this.find_bone_from_armature(edited_armature, 'DEF-hips')
    this.hip_bone_offset = this.calculate_position_offset(original_hip_bone.position, edited_hip_bone.position)

    // calculate the scale factor for the animation clips
    // this should take the distance between the original and edited armature
    // and divide it by the original armature hip bone position
    this.hip_bone_scale_factor_z = edited_hip_bone.position.z / original_hip_bone.position.z
    //console.log('hip bone scale factor:', this.hip_bone_scale_factor) // should be 1 if no change

    // small T-pose offset that somehow is getting lost
    this.hip_bone_offset = this.hip_bone_offset.sub(new Vector3(0, 0, -0.04))
  }

  private find_bone_from_armature (armature: Object3D, bone_name: string): Bone | null {
    let found_bone: Bone | null = null
    armature.traverse((object: Object3D) => {
      if (found_bone === null && object.name === bone_name && object instanceof Bone) {
        found_bone = object
      }
    })
    return found_bone
  }

  private calculate_position_offset (position_1: Vector3, position_2: Vector3): Vector3 {
    return new Vector3(position_1.x - position_2.x, position_1.y - position_2.y, position_1.z - position_2.z)
  }

  private has_added_event_listeners: boolean = false

  constructor () {
    super()
    this.ui = new UI()
  }

  public begin (): void {
    if (this.ui.dom_current_step_index != null) {
      this.ui.dom_current_step_index.innerHTML = '4'
    }

    if (this.ui.dom_current_step_element != null) {
      this.ui.dom_current_step_element.innerHTML = 'Test animations'
    }

    if (this.ui.dom_skinned_mesh_tools != null) {
      this.ui.dom_skinned_mesh_tools.style.display = 'flex'
    }

    if (this.ui.dom_skinned_mesh_animation_tools != null) {
      this.ui.dom_skinned_mesh_animation_tools.style.display = 'flex'
    }

    this.add_event_listeners()
    this.update_download_button_enabled()
  }

  public mixer (): AnimationMixer {
    return this.animation_mixer
  }

  // setup in the bootstrap.ts file and only called if we are actively
  // on this step
  public frame_change (delta_time: number): void {
    this.mixer().update(delta_time)
    this.update_active_animation_css_progress(delta_time)
  }

  // show a progress bar for teh current animation clip in the form of a gradient background
  // on the button that is playing the animation
  private update_active_animation_css_progress (delta_time: number): void {
    if (this.animation_mixer === null || this.animation_clips_loaded.length === 0) { return }

    this.skinned_meshes_to_animate.forEach((skinned_mesh) => {
      const clip_to_play: AnimationClip = this.animation_clips_loaded[this.current_playing_index]
      const anim_action: AnimationAction = this.animation_mixer.clipAction(clip_to_play, skinned_mesh)

      const progress = Math.min(anim_action.time / clip_to_play.duration, 1)
      const progress_percent: number = progress * 100 // returns 0-100

      // background gradient to simulate a progress bar for the animation
      if (this.ui.dom_animation_clip_list === null) { return }

      const animation_button: HTMLButtonElement | null = this.ui.dom_animation_clip_list.querySelector(`button[data-index="${this.current_playing_index}"]`)
      if (animation_button !== null) {
        animation_button.style.background = `linear-gradient(to right,rgba(50, 94, 114, 0.42) ${progress_percent}%, rgba(50, 94, 113, 0) ${progress_percent}%)`
      }
    })
  }

  public animation_clips (): AnimationClip[] {
    return this.animation_clips_loaded
  }

  public load_and_apply_default_animation_to_skinned_mesh (final_skinned_meshes: SkinnedMesh[], skeleton_type: SkeletonType): void {
    this.skinned_meshes_to_animate = final_skinned_meshes
    this.skeleton_type = skeleton_type

    let animations_to_load_filepaths: string[] = []
    switch (skeleton_type) {
      case SkeletonType.Human:
        animations_to_load_filepaths = ['animations/human-base-animations.glb', 'animations/human-addon-animations.glb']
        break
      case SkeletonType.Quadraped:
        animations_to_load_filepaths = ['animations/quad-creature-animations.glb']
        break
      case SkeletonType.Bird:
        animations_to_load_filepaths = ['animations/bird-animations.glb']
        break
    }

    this.gltf_animation_loader = new GLTFLoader()

    // The GLTF loader doesn't return a promise, so we need some way
    // to know when all the animations are loaded
    let remaining_loads: number = animations_to_load_filepaths.length

    this.animation_clips_loaded = [] // reset the animation clips loaded
    // Create an animation mixer to do the playback. Play the first by default
    this.animation_mixer = new AnimationMixer()

    animations_to_load_filepaths.forEach((filepath) => {
      this.gltf_animation_loader.load(filepath, (gltf: any) => {
        // load the animation clips into a new array
        // then, remove the animation position keyframes. That will mess up the skinning
        // process since we will be offsetting and moving the bone root positions
        const cloned_anims: AnimationClip[] = this.deep_clone_animation_clips(gltf.animations)

        // only keep position tracks
        this.remove_position_tracks(cloned_anims, true)

        // apply hip bone offset
        this.apply_hip_bone_offset(cloned_anims)

        // we did all the processing needed, so add them
        // to the full list of animation clips
        this.animation_clips_loaded.push(...cloned_anims)

        remaining_loads--
        if (remaining_loads === 0) {
          this.onAllAnimationsLoaded()
        }
      })
    })
  }

  private onAllAnimationsLoaded (): void {
    // sort all animation names alphabetically
    this.animation_clips_loaded.sort((a: AnimationClip, b: AnimationClip) => {
      if (a.name < b.name) { return -1 }
      if (a.name > b.name) { return 1 }
      return 0
    })

    console.log('all animations loaded:', this.animation_clips_loaded)

    // create user interface with all available animation clips
    this.ui.build_animation_clip_ui(this.animation_clips_loaded)
    this.play_animation(0) // play the first animation by default
  }

  // mutates the animation clips passed in and only keeps rotation/quaternion tracks
  // also removes scale tracks
  private remove_position_tracks (animation_clips: AnimationClip[], preserve_root_position: boolean = false): void {
    animation_clips.forEach((animation_clip: AnimationClip) => {
      // remove all position nodes except root
      let rotation_tracks: KeyframeTrack[] = []


      //const name: String = "".toLowerCase()

      if (preserve_root_position) {
        rotation_tracks = animation_clip.tracks.filter((x: KeyframeTrack) => x.name.includes('quaternion') || x.name.toLowerCase().includes('hips.position'))
      } else {
        rotation_tracks = animation_clip.tracks.filter((x: KeyframeTrack) => x.name.includes('quaternion') || x.name.includes('hips.position'))
      }

      animation_clip.tracks = rotation_tracks // update track data
      //console.log(animation_clip.tracks)
    })
  }

  private apply_hip_bone_offset (animation_clips: AnimationClip[]): void {
    // update the position keyframes for the hips bone
    // this will be used for animations like falling
    animation_clips.forEach((animation_clip: AnimationClip) => {
      animation_clip.tracks.forEach((track: KeyframeTrack) => {
        if (track.name.includes('hips.position')) {
          const values = track.values
          for (let i = 0; i < values.length; i += 3) {
            values[i] = values[i] - this.hip_bone_offset.x
            values[i + 1] = values[i + 1] - this.hip_bone_offset.y
            values[i + 2] = values[i + 2] * this.hip_bone_scale_factor_z
          }
        }
      })
    })
  }

  private extend_arm_animations_by_percentage (percentage: number): void {

    // loop through each animation clip to update the tracks
    this.animation_clips_loaded.forEach((animation_clip: AnimationClip) => {
      animation_clip.tracks.forEach((track: KeyframeTrack) => {
        // if our name does not contain 'quaternion', we need to exit
        // since we are only modifying the quaternion tracks (e.g. L_Arm.quaternion )
        if (track.name.indexOf('quaternion') < 0) {
          return
        }

        const quaterion_track: QuaternionKeyframeTrack = track

        // if the track is an upper arm bone, then modify that
        const is_right_arm_track_match: boolean = quaterion_track.name.indexOf('upper_armR') > -1
        const is_left_arm_track_match: boolean = quaterion_track.name.indexOf('upper_armL') > -1

        if (is_right_arm_track_match || is_left_arm_track_match) {
          const new_track_values: Float32Array = quaterion_track.values.slice() // clone array

          const track_count: number = quaterion_track.times.length
          for (let i = 0; i < track_count; i++) {
            // get correct value since it is a quaternion
            const units_in_quaternions: number = 4
            const quaternion: Quaternion = new Quaternion()

            // rotate the upper arms in opposite directions to rise/lower arms
            if (is_right_arm_track_match) {
              quaternion.setFromAxisAngle(new Vector3(0, 0, -1), percentage / 100)
            }
            if (is_left_arm_track_match) {
              quaternion.setFromAxisAngle(new Vector3(0, 0, 1), percentage / 100)
            }

            // get the existing quaternion
            const existing_quaternion: Quaternion = new Quaternion(
              new_track_values[i * units_in_quaternions + 0],
              new_track_values[i * units_in_quaternions + 1],
              new_track_values[i * units_in_quaternions + 2],
              new_track_values[i * units_in_quaternions + 3]
            )

            // multiply the existing quaternion by the new quaternion
            existing_quaternion.multiply(quaternion)

            // this should change the first quaternion component of the track
            new_track_values[i * units_in_quaternions + 0] = existing_quaternion.x
            new_track_values[i * units_in_quaternions + 1] = existing_quaternion.y
            new_track_values[i * units_in_quaternions + 2] = existing_quaternion.z
            new_track_values[i * units_in_quaternions + 3] = existing_quaternion.w
          }

          track.values = new_track_values
        }
      })
    })
  }

  private play_animation (index: number = 0): void {
    this.current_playing_index = index

    // animation mixer has internal cache with animations. doing this helps clear it
    // otherwise modifications like arm extension will not update
    this.animation_mixer = new AnimationMixer()

    this.skinned_meshes_to_animate.forEach((skinned_mesh) => {
      const clip_to_play: AnimationClip = this.animation_clips_loaded[this.current_playing_index]
      const anim_action: AnimationAction = this.animation_mixer.clipAction(clip_to_play, skinned_mesh)

      anim_action.stop()
      anim_action.play()
    })

    // reset all the animation button background styles. This will remove the 
    // progress bar effect from whatever was animating before
    if (this.ui.dom_animation_clip_list === null) { return }
    const all_buttons = this.ui.dom_animation_clip_list.querySelectorAll('button[data-index]');
    all_buttons.forEach((btn: HTMLButtonElement) => {
      btn.style.background = '' // or set to your default, e.g. ''
    })
  }

  private update_download_button_enabled (): void {
    // see if any of the "export" checkboxes are active. if not we need to disable the "Download" button
    const animation_checkboxes = this.ui.get_animated_selected_elements()
    const is_any_checkbox_checked: boolean = Array.from(animation_checkboxes).some((checkbox) => {
      return checkbox.checked === true
    })
    this.ui.dom_export_button.disabled = !is_any_checkbox_checked
  }

  private add_event_listeners (): void {
    if (this.has_added_event_listeners) {
      return
    }

    // event listener for animation clip list with changing the current animation
    if (this.ui.dom_animation_clip_list != null) {
      this.ui.dom_animation_clip_list.addEventListener('click', (event) => {
        this.update_download_button_enabled()

        if ((event.target != null) && event.target.tagName === 'BUTTON') {
          const animation_index: number = event.target.getAttribute('data-index')
          this.play_animation(animation_index)
        }
      })
    }

    // manually uploading an animation file with button (not used right now)
    this.ui.dom_import_animation_upload?.addEventListener('change', (event) => {
      const file = event.target?.files[0]
      const reader = new FileReader()
      reader.readAsDataURL(file)

      // extract filename from the file path
      const file_name = file.name.split('.').shift()
      const file_extension = file.name.split('.').pop()

      reader.onload = () => {
        // GLB and FBX will come in as a data:application/octet-stream;base64
        // GLTF will come in as a JSON string
        // even the binary data comes in as string, so treat it all that way for now
        const file_info: string = reader.result

        if (file_extension === 'fbx') {
          this.load_fbx_animation_clips(file_info, file_name)
        } else if (file_extension === 'glb' || file_extension === 'gltf') {
          this.load_gltf_animation_clips(file_info)
        } else if (file_extension === 'bvh') {
          this.load_bvh_animation_clip(file_info)
        }

        // clear out the file input field in case we want to test by loading same file again
        this.ui.dom_import_animation_upload.value = ''
      }
    })

    // A-Pose arm extension event listner
    this.ui.dom_extend_arm_button?.addEventListener('click', (event) => {
      const extend_arm_value: number = this.ui.dom_extend_arm_input?.value
      this.extend_arm_animations_by_percentage(extend_arm_value)
      this.play_animation(this.current_playing_index)
    })

    if (this.ui.dom_import_animations_buton !== null && this.ui.dom_animation_import_options !== null) {
      // toggle the Import button being shown/hidden
      this.ui.dom_import_animations_buton.addEventListener('click', (event) => {
        this.ui.dom_animation_import_options.classList.toggle('show')
      })

      // handle clicking an animation type to import
      this.ui.dom_animation_import_options.addEventListener('click', (event) => {
        const animation_type = event.target.getAttribute('data-value')
        this.skeleton_type_trying_to_import = animation_type
        this.ui.dom_import_animation_upload.click() // initiate file upload
      })
    }

    // helps ensure we don't add event listeners multiple times
    this.has_added_event_listeners = true
  }

  private load_fbx_animation_clips (fbx_file: string, file_name: string): void {
    this.fbx_animation_loader = new FBXLoader()

    this.fbx_animation_loader.load(fbx_file, (fbx) => {
      const animations_for_scene: AnimationClip[] = fbx.animations // we only need the animations

      // check to see if the animation is a mixamo skeleton. we will need this later for potential mapping
      const is_mixamo_animation: boolean = animations_for_scene[0].name === 'mixamo.com' || this.skeleton_type_trying_to_import === 'mixamo'
      const is_carnegie_mellon_skeleton = this.skeleton_type_trying_to_import === 'carnegie-skeleton'

      if (is_mixamo_animation) {
        // mutates animations_for_scene contents
        this.process_mixamo_animation_clips(animations_for_scene, file_name)
      }

      if (is_carnegie_mellon_skeleton) {
        // all these functions mutate animation data
        this.process_carnegie_skeleton_clip(animations_for_scene, file_name)
        this.reduce_position_keyframes(animations_for_scene)
        console.log('animation clips after processing 2:', animations_for_scene)
      }

      // add the animations to the animation_clips_loaded
      // update the UI with the new animation clips
      this.append_animation_clips(animations_for_scene)
      this.ui.build_animation_clip_ui(this.animation_clips_loaded)
    })
  }

  private process_carnegie_skeleton_clip (animation_clips: AnimationClip[], file_name: string): void {
    // Do bone mappings for the carnegie mellon skeleton
    animation_clips.forEach((animation_clip, index) => {
      animation_clip.tracks.forEach((track) => {
        const original_bone_name: string = track.name.split('.')[0]
        const keyframe_type: string = track.name.split('.')[1]

        const bone_mapping_result: boolean = CarnegieMellonUniversityToMixamoMapping[original_bone_name]
        if (bone_mapping_result) {
          track.name = bone_mapping_result + '.' + keyframe_type
        }
      })
    })

    // use file name for animation clip name
    animation_clips.forEach((animation_clip, index) => {
      animation_clip.name = `${file_name} (${index.toString()})`
    })
  }

  /* this will mutate the animation clips passed in by effectively removing the position keyframes */
  private reduce_position_keyframes (animation_clips: AnimationClip[]): void {
    animation_clips.forEach((animation_clip, index) => {
      animation_clip.tracks.forEach((track) => {
        const keyframe_type: string = track.name.split('.')[1]
        if (keyframe_type === 'position') {
          (track.values as Float32Array).forEach((value, index) => {
            track.values[index] = value / 200
          })
        }
      })
    })
  }

  private load_bvh_animation_clip (bvh_file: string): void {
    const bvh_loader = new BVHLoader()

    bvh_loader.load(bvh_file, (result) => {
      let clip: AnimationClip = result.clip

      clip = this.process_bvh_animation_clip(clip, 'bvh')

      // add the animations to the animation_clips_loaded
      // update the UI with the new animation clips
      this.append_animation_clips([clip])
      this.ui.build_animation_clip_ui(this.animation_clips_loaded)
    })
  }

  private process_bvh_animation_clip (animation_clip: AnimationClip, file_name: string): AnimationClip {
    // need to remove the position keyframes from the animation
    // since we will be offsetting the root bone position
    const cloned_track: AnimationClip = this.deep_clone_animation_clips([animation_clip])[0]

    // only keep the rotation tracks...and the root bone position track
    const rotation_tracks = cloned_track.tracks.filter((x: KeyframeTrack) => x.name.includes('quaternion'))
    cloned_track.tracks = rotation_tracks

    // keep the root bone position track
    const root_position_track = animation_clip.tracks.filter((x: KeyframeTrack) => x.name === 'root.position')[0]

    if (root_position_track !== undefined) {
      cloned_track.tracks.push(root_position_track)
    }

    // need to do bone mapping
    // loop through each animation clip to update the tracks
    cloned_track.tracks.forEach((track) => {
      if (track === undefined) {
        throw new Error('Error processing BVH animation clip. Track input is undefined')
      }

      const bvh_bone_name: string = track.name.split('.')[0]
      const keyframe_type: string = track.name.split('.')[1]

      // selected skeleton is a simplified mixamo skeleton. We need to map bone names
      if (this.skeleton_type === SkeletonType.BipedalSimple) {
        const bone_from_mapping: boolean = BVHToSimpleMapping[bvh_bone_name]
        if (bone_from_mapping) {
          track.name = bone_from_mapping + '.' + keyframe_type
        }
      }

      // BVH seems to have something like 1 unit = 1cm. We need to scale position data to compensate for that
      // the 200 value is arbitrary, but the results seem to look good, so I went with that. FBX seems to be the same
      if (keyframe_type === 'position') {
        (track.values as Float32Array).forEach((value, index) => {
          track.values[index] = value / 200
        })
      }
    })

    return cloned_track
  }

  private process_mixamo_animation_clips (animation_clips: AnimationClip[], file_name: string): void {
    // loop through each animation clip to update the tracks
    animation_clips.forEach((animation_clip, index) => {
      animation_clip.name = `${file_name} (${index.toString()})` // mixamo just calles the clip names 'mixamo.com'

      // get the track name and replace it with our simplfied mapping
      animation_clip.tracks.forEach((track) => {
        const mixamo_bone_name: string = track.name.split('.')[0]
        const keyframe_type: string = track.name.split('.')[1]

        // selected skeleton is a simplified mixamo skeleton. We need to map bone names
        if (this.skeleton_type === SkeletonType.BipedalSimple) {
          const is_mappping_found: boolean = MixamoToSimpleMapping[mixamo_bone_name]
          if (is_mappping_found) {
            track.name = MixamoToSimpleMapping[mixamo_bone_name] + '.' + keyframe_type
          }
        }

        // my mixamo skeleton has an underscore character. Maybe need to replace
        // this later so the skeleton doesn't have to do this replacing when importing
        if (this.skeleton_type === SkeletonType.BipedalFull) {
          track.name = mixamo_bone_name.replace('mixamorig', 'mixamorig_') + '.' + keyframe_type
        }

        // Mixamo has 1 unit = 1cm. We need to scale position data to compensate for that
        // the 200 value is arbitrary, but the results seem to look good, so I went with that.
        if (keyframe_type === 'position') {
          (track.values as Float32Array).forEach((value, index) => {
            track.values[index] = value / 200
          })
        }
      })

      // with the simple skeleton, there are many bones that are not used from the full mixamo animation
      // remove unmapped bones since they won't be used
      if (this.skeleton_type === SkeletonType.BipedalSimple) {
        animation_clip.tracks = animation_clip.tracks.filter((x: KeyframeTrack) => !x.name.includes('mixamorig'))
      }
    })
  }

  private load_gltf_animation_clips (gltf_file: string): void {
    this.gltf_animation_loader = new GLTFLoader()

    this.gltf_animation_loader.load(gltf_file, (gltf) => {
      const animations_for_scene = gltf.animations // we only need the animations

      // add the animations to the animation_clips_loaded
      // update the UI with the new animation clips
      this.append_animation_clips(animations_for_scene)
      this.ui.build_animation_clip_ui(this.animation_clips_loaded)
    })
  }

  private append_animation_clips (animation_clips: AnimationClip[]): void {
    // loop through each animation_clip and change name if the animaton name already exists
    // see if the aniation name is already taken.. if so, add a number to the end of the name
    animation_clips.forEach((animation_clip) => {
      const is_name_found: AnimationClip | undefined = this.animation_clips_loaded.find((animation_clip_loaded) => {
        return animation_clip_loaded.name === animation_clip.name
      })

      if (is_name_found !== undefined) {
        animation_clip.name = animation_clip.name + ' Copy'
      }
    })

    this.animation_clips_loaded.push(...this.deep_clone_animation_clips(animation_clips))
  }

  private deep_clone_animation_clips (animation_clips: AnimationClip[]): AnimationClip[] {
    return animation_clips.map((clip: AnimationClip) => {
      const tracks = clip.tracks.map(track => track.clone())
      return new AnimationClip(clip.name, clip.duration, tracks)
    })
  }
}
