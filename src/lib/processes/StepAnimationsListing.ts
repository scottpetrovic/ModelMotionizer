import { UI } from '../UI.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { AnimationClip, AnimationMixer, Quaternion, Vector3 } from 'three';
import { SkeletonType } from '../enums/SkeletonType.js';
import { SkinnedMesh } from 'three';
import { QuaternionKeyframeTrack } from 'three';
import { KeyframeTrack } from 'three';
import { AnimationAction } from 'three';

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepAnimationsListing extends EventTarget
{
    private ui: UI;
    private animation_clips_loaded: AnimationClip[] = []
    private animation_loader: GLTFLoader;
    private animation_mixer: AnimationMixer = null;
    private skinned_meshes_to_animate: SkinnedMesh[] = []
    private current_playing_index: number = 0

    constructor() 
    {
        super();
        this.ui = new UI();
    }

    public begin() {
        if(this.ui)
        {
            if (this.ui.dom_current_step_index) 
            {
                this.ui.dom_current_step_index.innerHTML = '4';
            }

            if (this.ui.dom_current_step_element) 
            {
                this.ui.dom_current_step_element.innerHTML = 'Test animations';
            }

            if (this.ui.dom_skinned_mesh_tools) 
            {
                this.ui.dom_skinned_mesh_tools.style.display = 'flex';
            }

            if (this.ui.dom_skinned_mesh_animation_tools) {
                this.ui.dom_skinned_mesh_animation_tools.style.display = 'flex';
            }
       
            this.addEventListeners();       
        }

       
    }

    public instructions_text()
    {
        return `<div>Instructions</div> 
        <div>Test and export animations to GLB format</div>
                <ol>
                  <li>Only GLB files can be exported</li>
                  <li>Go back to edit skeleton if results don't look right</li>
                  <li>Select animations you want to export by checking them by animation</li>
                </ol>`;
    }

    public mixer()
    {
        return this.animation_mixer
    }

    public animation_clips()
    {
        return this.animation_clips_loaded
    }

    public load_and_apply_default_animation_to_skinned_mesh(final_skinned_meshes, skeleton_type)
    {
        this.animation_loader = new GLTFLoader();
        this.skinned_meshes_to_animate = final_skinned_meshes

        let animations_to_load_filepath = null
        switch(skeleton_type)
        {
            case SkeletonType.BipedalSimple:
                animations_to_load_filepath = 'animations/character-simple-multiple.glb'
                break;
            case SkeletonType.Quadraped:
                animations_to_load_filepath = 'animations/quad-creature-animations.glb'
                break;
            case SkeletonType.BipedalFull:
                animations_to_load_filepath = 'animations/animations-mixamo-default.glb'
                break;
        }

        this.animation_loader.load(animations_to_load_filepath, (gltf) => {

            // remove the animation position keyframes. That will mess up the skinning
            // process since we will be offsetting and moving the bone root positions
            this.load_animation_clips(gltf.animations)

            // create user interface with all available animation clips
            this.ui.build_animation_clip_ui(this.animation_clips_loaded);

            // create an animation mixer to do the playback. play the first by by default
            this.animation_mixer = new AnimationMixer();

            this.play_animation(0);          
        });
    }

    private extend_arm_animations_by_percentage(percentage: number): void
    {
         // loop through each animation clip to update the tracks
         this.animation_clips_loaded.forEach((animation_clip: AnimationClip) => {
             
            animation_clip.tracks.forEach((track: KeyframeTrack) => {

                // if our name does not contain 'quaternion', we need to exit
                // since we are only modifying the quaternion tracks (e.g. L_Arm.quaternion )
                if(track.name.indexOf('quaternion') < 0)
                {
                    return
                }

                const quaterion_track: QuaternionKeyframeTrack = track;

                // if the track is an upper arm bone, then modify that
                const track_name_to_match: string = '_Arm' // for simplified human skeleton
                if(quaterion_track.name.indexOf(track_name_to_match) > -1)
                {
                    const new_track_values: Float32Array =  quaterion_track.values.slice(); // clone array

                    const track_count: number = quaterion_track.times.length
                    for(let i = 0; i < track_count; i++)
                    {
                        // get correct value since it is a quaternion
                        const units_in_quaternions: number = 4
                        const quaternion: Quaternion = new Quaternion();
                        quaternion.setFromAxisAngle( new Vector3( 1, 0, 0 ), percentage/100 );


                        // get the existing quaternion
                        const existingQuaternion: Quaternion = new Quaternion(
                            new_track_values[i * units_in_quaternions + 0],
                            new_track_values[i * units_in_quaternions + 1],
                            new_track_values[i * units_in_quaternions + 2],
                            new_track_values[i * units_in_quaternions + 3]
                        );

                        // multiply the existing quaternion by the new quaternion
                        existingQuaternion.multiply(quaternion);


                        // this should change the first quaternion component of the track
                        new_track_values[i * units_in_quaternions + 0] = existingQuaternion.x
                        new_track_values[i * units_in_quaternions + 1] = existingQuaternion.y
                        new_track_values[i * units_in_quaternions + 2] = existingQuaternion.z
                        new_track_values[i * units_in_quaternions + 3] = existingQuaternion.w
                    }

                    track.values = new_track_values
                }

             })

         })

         // test out the new values for the animation
        //  console.log(this.animation_clips_loaded)
        //  this.animation_clips_loaded.forEach((animation_clip) => {
        //     animation_clip.tracks.forEach((track) => {

        //         if(track.name.indexOf('_Arm.quaternion') > -1)
        //         {
        //             console.log(animation_clip.name, track.name, track.values)
        //         }
        //     })
        // })


    }

    private play_animation(index: number = 0): void
    {
        this.current_playing_index = index

        // animation mixer has internal cache with animations. doing this helps clear it
        // otherwise modifications like arm extension will not update
        this.animation_mixer = new AnimationMixer();

        this.skinned_meshes_to_animate.forEach((skinned_mesh) => {

            const clip_to_play: AnimationClip = this.animation_clips_loaded[this.current_playing_index]
            let anim_action: AnimationAction = this.animation_mixer.clipAction(clip_to_play, skinned_mesh);

            anim_action.stop();
            anim_action.play();

        });
    }

    private load_animation_clips(animation_clips): void
    {
        this.animation_clips_loaded = this.remove_position_and_scale_keyframes_from_animations(animation_clips)
    }

    private addEventListeners(): void
    {
        // event listener for animation clip list with changing the current animation
        if (this.ui.dom_animation_clip_list) {
            this.ui.dom_animation_clip_list.addEventListener('click', (event) => {
                if (event.target && event.target.tagName === 'BUTTON') 
                {            
                    let animation_index = event.target.getAttribute('data-index');
                    this.play_animation(animation_index);
                }
            });
        }

        this.ui.dom_import_animations_button.addEventListener('change', (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);

            console.log('loading more files')
        
            reader.onload = () => {
               var animations_import = reader.result

               this.loader = new GLTFLoader();
               this.loader.load(animations_import, (gltf) => {

                    const animations_for_scene = gltf.animations; // we only need the animations

                    // make sure the animations are compatible with the skeleton
                    // TODO: figure out what type of validation I could do with this

                    // add the animations to the animation_clips_loaded
                    // update the UI with the new animation clips
                    this.append_animation_clips(animations_for_scene)
                    this.ui.build_animation_clip_ui(this.animation_clips_loaded);

                    // clear out the file input field in case we want to test by loading same file again
                    this.ui.dom_import_animations_button.value = '';

                });

            };
        
        });

        this.ui.dom_extend_arm_button.addEventListener('click', (event) => {

            let extend_arm_value = this.ui.dom_extend_arm_input.value
            this.extend_arm_animations_by_percentage(extend_arm_value)

            this.play_animation(this.current_playing_index)

        })
    }

    private removeEventListeners()
    {
        this.ui.dom_animation_clip_list.removeEventListener('click', () => {});
    }

    private append_animation_clips(animation_clips)
    {
        // loop through each animation_clip and change name if the animaton name already exists
        // see if the aniation name is already taken.. if so, add a number to the end of the name
        animation_clips.forEach((animation_clip) => {                

            let is_name_found = this.animation_clips_loaded.find((animation_clip_loaded) => {
                return animation_clip_loaded.name === animation_clip.name
            })

            if(is_name_found)
            {
                animation_clip.name = animation_clip.name + ' Copy'
            }
        });

        this.animation_clips_loaded.push(...this.remove_position_and_scale_keyframes_from_animations(animation_clips))
    }

    private remove_position_and_scale_keyframes_from_animations(animation_clip_list)
    {
        let animation_clips = this.deep_clone_animation_clips(animation_clip_list)

        let filtered_tracks = animation_clips.map((animation_clip) => {
            const filteredTracks = animation_clip.tracks.filter((track) => {
                return track.name.indexOf('quaternion') > 0;
            });
            return new AnimationClip(animation_clip.name, animation_clip.duration, filteredTracks);
        });

        return filtered_tracks
    }

    private deep_clone_animation_clips(animation_clips)
    {
        return animation_clips.map(clip => {
            let tracks = clip.tracks.map(track => track.clone());
            return new AnimationClip(clip.name, clip.duration, tracks);
        });
    }

}