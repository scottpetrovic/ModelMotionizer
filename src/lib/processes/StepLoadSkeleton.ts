import { UI } from '../UI.ts'
import { Generators } from '../Generators.ts'
import {
  BufferGeometry, Float32BufferAttribute, Mesh, Box3, MeshBasicMaterial,
  Object3D, type Object3DEventMap, type Skeleton
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Utility } from '../Utilities.ts'
import { SkeletonType } from '../enums/SkeletonType.js'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadSkeleton extends EventTarget {
  private readonly loader: GLTFLoader = new GLTFLoader()
  private readonly ui: UI = new UI()
  private loaded_armature: Object3D = new Object3D()
  private loaded_skeleton: Skeleton | undefined
  private skeleton_t: SkeletonType = SkeletonType.BipedalSimple

  public skeleton_type (): SkeletonType {
    return this.skeleton_t
  }

  begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '2'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Load Skeleton'
    }

    if (this.ui.dom_load_skeleton_tools !== null) {
      this.ui.dom_load_skeleton_tools.style.display = 'flex'
    }

    this.add_event_listeners()
  }

  private add_event_listeners (): void {
    if (this.ui.dom_load_skeleton_button !== null) {
      this.ui.dom_load_skeleton_button.addEventListener('click', () => {
        if (this.ui.dom_skeleton_drop_type === null) {
          console.warn('could not find skeleton selection drop down HTML element')
          return
        }

        // get currently selected option out of the model-selection drop-down
        const skeleton_selection = this.ui.dom_skeleton_drop_type.options

        const skeleton_file: string = skeleton_selection[skeleton_selection.selectedIndex].value

        // set the skeleton type. This will be used for the animations listing later
        // so it knows what animations to load
        switch (skeleton_file) {
          case 'quadraped':
            this.skeleton_t = SkeletonType.Quadraped
            break
          case 'bipedal-simple':
            this.skeleton_t = SkeletonType.BipedalSimple
            break
          case 'bipedal-full':
            this.skeleton_t = SkeletonType.BipedalFull
            break
        }

        // load skeleton from GLB file
        this.loader.load(this.skeleton_t, (gltf) => {
          // traverse scene and find first bone object
          // we will go to the parent and mark that as the original armature
          let armature_found = false
          let original_armature: Object3D = new Object3D()

          gltf.scene.traverse((child) => {
            if (child.type === 'Bone' && !armature_found) {
              armature_found = true

              if (child.parent != null) {
                original_armature = child.parent
              } else {
                console.warn('could not find armature parent while loading skeleton')
              }
            }
          })

          this.loaded_armature = original_armature.clone()
          this.loaded_armature.name = 'Loaded Armature'

          // scale geometry for skeleton
          const skeleton_geometry = this.buffer_geometry_from_armature(this.loaded_armature)
          const temp_skeleton_mesh = new Mesh(skeleton_geometry, new MeshBasicMaterial({ color: 0x00ff00 }))
          const bounding_box = new Box3().setFromObject(temp_skeleton_mesh)
          const height = bounding_box.max.y - bounding_box.min.y
          const max_height = 1.5
          const scale_factor = max_height / height

          // try to scale each bone down instead of the whole armature object
          Utility.scale_armature_by_scalar(this.loaded_armature, scale_factor)

          // reset the armature to 0,0,0 in case it is off for some reason
          this.loaded_armature.position.set(0, 0, 0)
          this.loaded_armature.updateWorldMatrix(true, true)

          this.dispatchEvent(new CustomEvent('skeletonLoaded', { detail: this.loaded_armature }))
        })
      })
    }// end if statement
  }

  public armature (): Object3D<Object3DEventMap> {
    return this.loaded_armature
  }

  public skeleton (): any {
    if (this.loaded_skeleton !== null) {
      return this.loaded_skeleton
    }

    // create skeleton and helper to visualize
    this.loaded_skeleton = Generators.create_skeleton(this.loaded_armature.children[0])
    this.loaded_skeleton.name = 'Mesh Editing Skeleton'

    // update the world matrix for the skeleton
    // without this the skeleton helper won't appear when the bones are first loaded
    skeleton.bones[0].updateWorldMatrix(true, true)

    return skeleton
  }

  private buffer_geometry_from_armature (armature: Object3D): BufferGeometry {
    // create a geometry object from the skeleton
    // we will use this to calculate the bone weights
    const geometry: BufferGeometry = new BufferGeometry()
    const vertices: number[] = [] //  array of numbers for positions

    armature.traverse((bone) => {
      if (bone.type === 'Bone') {
        const bone_world_pos = Utility.world_position_from_object(bone)
        vertices.push(bone_world_pos.x)
        vertices.push(bone_world_pos.y)
        vertices.push(bone_world_pos.z)
      }
    })

    // add the vertices to the geometry
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))

    return geometry
  }
}
