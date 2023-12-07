import { UI } from '../UI.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { AnimationClip, AnimationMixer } from 'three';
import { SkeletonType } from '../enums/SkeletonType.js';

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepAnimationsListing extends EventTarget
{
    ui = null;
    animation_clips_loaded = []
    animation_loader = null
    animation_mixer = null
    skinned_meshes_to_animate = []

    constructor() 
    {
        super();
        this.ui = new UI();
    }

    begin()
    {
        this.ui.dom_current_step_index.innerHTML = '4'
        this.ui.dom_current_step_element.innerHTML = 'Test animations'
        this.ui.dom_skinned_mesh_tools.style.display = 'flex';
        this.ui.dom_skinned_mesh_animation_tools.style.display = 'flex';

        this.addEventListeners()
    }

    instructions_text()
    {
        return `<div>Instructions</div> 
        <div>Test and export animations to GLB format</div>
                <ol>
                  <li>Only GLTF files can be loaded</li>
                  <li>Go back to edit skeleton if results don't look right</li>
                  <li>Select animations you want to export by checking them by animation</li>
                </ol>`;
    }

    addEventListeners()
    {
        // event listener for animation clip list with changing the current animation
        this.ui.dom_animation_clip_list.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') 
            {            
                let animation_index = event.target.getAttribute('data-index');
                this._play_animation(animation_index);
            }
        });
    }

    _play_animation(index = 0)
    {
        this.animation_mixer.stopAllAction(); 

        this.skinned_meshes_to_animate.forEach((skinned_mesh) => {
            let anim_clip = this.animation_mixer.clipAction(this.animation_clips_loaded[index], skinned_mesh);
            anim_clip.play();
        });
    }

    removeEventListeners()
    {
        this.ui.dom_animation_clip_list.removeEventListener('click', () => {});
    }


    mixer()
    {
        return this.animation_mixer
    }

    animation_clips()
    {
        return this.animation_clips_loaded
    }

    load_animation_clips(animation_clips)
    {
        this.animation_clips_loaded = this._remove_position_keyframes_from_animations(animation_clips)
    }

    _remove_position_keyframes_from_animations(animation_clip_list)
    {
        let animation_clips = this._deep_clone_animation_clips(animation_clip_list)

        let filtered_tracks = animation_clips.map((animation_clip) => {
            const filteredTracks = animation_clip.tracks.filter((track) => {
                return track.name.indexOf('position') === -1;
            });
            return new AnimationClip(animation_clip.name, animation_clip.duration, filteredTracks);
        });

        return filtered_tracks
    }

    _deep_clone_animation_clips(animation_clips)
    {
        return animation_clips.map(clip => {
            let tracks = clip.tracks.map(track => track.clone());
            return new AnimationClip(clip.name, clip.duration, tracks);
        });
    }

    load_and_apply_default_animation_to_skinned_mesh(final_skinned_meshes, skeleton_type)
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
                // TODO: This file doesn't actually exist
                console.log('NOT IMPLENTENTED YET. NEED TO MAKE ANIMATIONS FOR THIS')
                animations_to_load_filepath = 'animations/character-full-multiple.glb'
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

            this._play_animation(0);          
        });
    }



}