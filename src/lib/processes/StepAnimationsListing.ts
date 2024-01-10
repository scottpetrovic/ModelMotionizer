import { UI } from '../UI.ts'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'

import { AnimationClip, AnimationMixer, Quaternion, Vector3, type SkinnedMesh, type QuaternionKeyframeTrack, type KeyframeTrack, type AnimationAction } from 'three'

import { SkeletonType } from '../enums/SkeletonType.ts'
import { MixamoToSimpleMapping } from '../mapping/MixamoToSimple.js'
import { BVHToSimpleMapping } from '../mapping/BVHToSimple.ts'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepAnimationsListing extends EventTarget {
  private readonly ui: UI
  private animation_clips_loaded: AnimationClip[] = []
  private gltf_animation_loader: GLTFLoader = new GLTFLoader()
  private fbx_animation_loader: FBXLoader = new FBXLoader()

  private animation_mixer: AnimationMixer = new AnimationMixer()
  private skinned_meshes_to_animate: SkinnedMesh[] = []
  private current_playing_index: number = 0
  private skeleton_type: string = SkeletonType.BipedalSimple

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
  }

  public instructions_text (): string {
    return `<div>Instructions</div> 
        <div>Test and export animations to GLB format</div>
                <ol>
                  <li>Only GLB files can be exported</li>
                  <li>Go back to edit skeleton if results don't look right</li>
                  <li>Select animations you want to export by checking them by animation</li>
                </ol>`
  }

  public mixer (): AnimationMixer {
    return this.animation_mixer
  }

  public animation_clips (): AnimationClip[] {
    return this.animation_clips_loaded
  }

  public load_and_apply_default_animation_to_skinned_mesh (final_skinned_meshes: SkinnedMesh[], skeleton_type: SkeletonType): void {
    this.skinned_meshes_to_animate = final_skinned_meshes
    this.skeleton_type = skeleton_type

    let animations_to_load_filepath: string = ''
    switch (skeleton_type) {
      case SkeletonType.BipedalSimple:
        animations_to_load_filepath = 'animations/character-simple-multiple.glb'
        break
      case SkeletonType.Quadraped:
        animations_to_load_filepath = 'animations/quad-creature-animations.glb'
        break
      case SkeletonType.BipedalFull:
        animations_to_load_filepath = 'animations/animations-mixamo-default.glb'
        break
    }

    this.gltf_animation_loader = new GLTFLoader()
    this.gltf_animation_loader.load(animations_to_load_filepath, (gltf) => {

      // remove the animation position keyframes. That will mess up the skinning
      // process since we will be offsetting and moving the bone root positions
      this.load_animation_clips(gltf.animations)

      // create user interface with all available animation clips
      this.ui.build_animation_clip_ui(this.animation_clips_loaded)

      // create an animation mixer to do the playback. play the first by by default
      this.animation_mixer = new AnimationMixer()

      this.play_animation(0)
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
        const track_name_to_match: string = '_Arm' // for simplified human skeleton
        if (quaterion_track.name.indexOf(track_name_to_match) > -1) {
          const new_track_values: Float32Array = quaterion_track.values.slice() // clone array

          const track_count: number = quaterion_track.times.length
          for (let i = 0; i < track_count; i++) {
            // get correct value since it is a quaternion
            const units_in_quaternions: number = 4
            const quaternion: Quaternion = new Quaternion()
            quaternion.setFromAxisAngle(new Vector3(1, 0, 0), percentage / 100)

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
  }

  private load_animation_clips (animation_clips: AnimationClip[]): void {
    this.animation_clips_loaded = this.remove_position_and_scale_keyframes_from_animations(animation_clips)
  }

  private add_event_listeners (): void {
    if (this.has_added_event_listeners) {
      return
    }

    // event listener for animation clip list with changing the current animation
    if (this.ui.dom_animation_clip_list != null) {
      this.ui.dom_animation_clip_list.addEventListener('click', (event) => {
        if ((event.target != null) && event.target.tagName === 'BUTTON') {
          const animation_index: number = event.target.getAttribute('data-index')
          this.play_animation(animation_index)
        }
      })
    }

    this.ui.dom_import_animations_button?.addEventListener('change', (event) => {
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
        this.ui.dom_import_animations_button.value = ''
      }
    })

    this.ui.dom_extend_arm_button?.addEventListener('click', (event) => {
      const extend_arm_value: number = this.ui.dom_extend_arm_input?.value
      this.extend_arm_animations_by_percentage(extend_arm_value)
      this.play_animation(this.current_playing_index)
    })

    // helps ensure we don't add event listeners multiple times
    this.has_added_event_listeners = true
  }

  private load_fbx_animation_clips (fbx_file: string, file_name: string): void {
    this.fbx_animation_loader = new FBXLoader()

    this.fbx_animation_loader.load(fbx_file, (fbx) => {
      const animations_for_scene: AnimationClip[] = fbx.animations // we only need the animations

      // check to see if the animation is a mixamo skeleton. we will need this later for potential mapping
      const is_mixamo_animation: boolean = animations_for_scene[0].name === 'mixamo.com'

      if (is_mixamo_animation) {
        // mutates animations_for_scene contents
        this.process_mixamo_animation_clips(animations_for_scene, file_name)
      }

      // add the animations to the animation_clips_loaded
      // update the UI with the new animation clips
      this.append_animation_clips(animations_for_scene)
      this.ui.build_animation_clip_ui(this.animation_clips_loaded)
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
    const rotation_tracks = cloned_track.tracks.filter(x => x.name.includes('quaternion'))
    cloned_track.tracks = rotation_tracks

    // keep the root bone position track
    const root_position_track = animation_clip.tracks.filter(x => x.name === 'root.position')[0]
    cloned_track.tracks.push(root_position_track)

    // need to do bone mapping
    // loop through each animation clip to update the tracks
    cloned_track.tracks.forEach((track) => {
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
        animation_clip.tracks = animation_clip.tracks.filter(x => !x.name.includes('mixamorig'))
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

    this.animation_clips_loaded.push(...this.remove_position_and_scale_keyframes_from_animations(animation_clips))
  }

  private remove_position_and_scale_keyframes_from_animations (animation_clip_list: AnimationClip[]): AnimationClip[] {
    // Don't use this for now. Maybe delete this function later

    const animation_clips = this.deep_clone_animation_clips(animation_clip_list)

    // const filtered_tracks = animation_clips.map((animation_clip) => {
    //   const filteredTracks = animation_clip.tracks.filter((track) => {
    //     return track.name.indexOf('quaternion') > 0
    //   })
    //   return new AnimationClip(animation_clip.name, animation_clip.duration, filteredTracks)
    // })

    return animation_clips
  }

  private deep_clone_animation_clips (animation_clips: AnimationClip[]): AnimationClip[] {
    return animation_clips.map((clip: AnimationClip) => {
      const tracks = clip.tracks.map(track => track.clone())
      return new AnimationClip(clip.name, clip.duration, tracks)
    })
  }
}
