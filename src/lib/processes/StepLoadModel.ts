import { UI } from '../UI.ts'
import { Box3 } from 'three/src/math/Box3.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { Scene } from 'three/src/scenes/Scene.js'
import { Mesh } from 'three/src/objects/Mesh.js'
import { MeshNormalMaterial } from 'three/src/materials/MeshNormalMaterial.js'
import { MathUtils } from 'three/src/math/MathUtils.js'
import { FrontSide } from 'three/src/constants.js'
import { type BufferGeometry, type Material, type Object3D, type SkinnedMesh } from 'three'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadModel extends EventTarget {
  private readonly gltf_loader = new GLTFLoader()
  private readonly ui: UI = new UI()
  private original_model_data: Scene = new Scene()
  private final_mesh_data: Scene = new Scene()
  private debug_model_loading: boolean = false

  // there can be multiple objects in a model, so store them in a list
  private readonly geometry_list: BufferGeometry[] = []
  private readonly material_list: Material[] = []

  // for debugging, let's count these to help us test performance things better
  vertex_count = 0
  triangle_count = 0
  objects_count = 0

  // function that goes through all our geometry data and calculates how many triangles we have
  private calculate_mesh_metrics (): void {
    let triangle_count = 0
    let vertex_count = 0

    // calculate all the loaded mesh data
    this.models_geometry_list().forEach((geometry) => {
      triangle_count += geometry.attributes.position.count / 3
      vertex_count += geometry.attributes.position.count
    })

    this.triangle_count = triangle_count
    this.vertex_count = vertex_count
    this.objects_count = this.models_geometry_list().length
  }

  private calculate_geometry_list(): void {
    if (this.final_mesh_data === undefined) {
      console.error('original model not loaded yet. Cannot do calculations')
    }

    this.final_mesh_data.traverse((child: Object3D) => {
      if (child.type === 'Mesh') {
        const geometry_to_add: BufferGeometry = (child as Mesh).geometry.clone()
        geometry_to_add.name = child.name
        this.geometry_list.push(geometry_to_add)

        const new_material: Material = (child as Mesh).material.clone()
        this.material_list.push(new_material)
      }
    })

    // debugging type data
    this.calculate_mesh_metrics()
    console.log(`Vertex count:${this.vertex_count}    Triangle Count:${this.triangle_count}     Object Count:${this.objects_count} `)
  }

  public begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '1'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Load Model'
    }

    if (this.ui.dom_load_model_tools !== null) {
      this.ui.dom_load_model_tools.style.display = 'flex'
    }

    this.add_event_listeners()
  }

  public add_event_listeners (): void {
    if (this.ui.dom_upload_model_button !== null) {
      this.ui.dom_upload_model_button.addEventListener('change', (event: Event) => {
        const file = event.target.files[0]
        const reader = new FileReader()
        reader.readAsDataURL(file)

        reader.onload = () => {
          this.load_model_file(reader.result)
        }
      })
    }

    if (this.ui.dom_load_model_debug_checkbox !== null) {
      this.ui.dom_load_model_debug_checkbox.addEventListener('change', (event: Event) => {
        const debug_mode = event.target.checked
        this.debug_model_loading = debug_mode
      })
    }

    if (this.ui.dom_load_model_button !== null) {
      this.ui.dom_load_model_button.addEventListener('click', () => {
        // get currently selected option out of the model-selection drop-down
        const model_selection = document.querySelector('#model-selection')

        if (model_selection !== null) {
          const selected_model = model_selection.options[model_selection.selectedIndex].value
          this.load_model_file(selected_model)
        }
      })
    }
  }

  public instructions_text (): string {
    return `<div>Instructions</div> 
      <div>Select existing models or upload your own.</div>
              <ol>
                <li>Only GLTF files can be loaded</li>
                <li>Models with multiple objects won't be rigged correct</li>
                <li>Mouse primary drag to move view</li>
                <li>Mouse context drag to pan view</li>
                <li>Debugging allows you to test odd material artifacts by using a 'Normal' material instead of what is included in the mesh</li>
              </ol>`
  }

  private load_model_file (model_file_path: string): void {
    const max_height = 1.5 // have 3d model scaled to be 1.5 units tall. helps normalize the models to work with

    this.gltf_loader.load(model_file_path, (gltf) => {
      const loaded_scene: Scene = gltf.scene

      this.original_model_data = loaded_scene.clone()
      this.original_model_data.name = 'Cloned Scene'

      this.original_model_data.traverse((child) => {
        child.castShadow = true
      })

      // strip out stuff that we are not bringing into the model step
      const clean_scene_with_only_models = this.strip_out_all_unecessary_model_data(this.original_model_data)
      this.scale_model_on_import(clean_scene_with_only_models, max_height) // if we have multiple objects, we want to scale them all the same

      // loop through each child in scene and reset rotation
      // if we don't the skinning process doesn't take rotation into account
      // and creates odd results
      clean_scene_with_only_models.traverse((child) => {
        child.rotation.set(0, 0, 0)
      })

      console.log('Model loaded', clean_scene_with_only_models)

      // assign the final cleaned up model to the original model data
      this.final_mesh_data = clean_scene_with_only_models

      this.calculate_geometry_list()

      this.dispatchEvent(new CustomEvent('modelLoaded'))
    })
  }

  private strip_out_all_unecessary_model_data (model_data: Scene): Scene {
    // create a new scene object, and only include meshes
    const new_scene = new Scene()
    new_scene.name = 'New Scene'

    model_data.traverse((child) => {
      let new_mesh: Mesh

      // if the schild is a skinned mesh, create a new mesh object and apply the geometry and material
      if (child.type === 'SkinnedMesh') {
        new_mesh = new Mesh((child as SkinnedMesh).geometry, (child as SkinnedMesh).material)
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      } else if (child.type === 'Mesh') {
        new_mesh = (child as Mesh).clone()
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      }

      // potentially use normal material to help debugging models that look odd
      // some materials have some odd transparency or back-face things that make it look odd
      let material_to_use: MeshNormalMaterial
      if (this.debug_model_loading && new_mesh !== undefined) {
        material_to_use = new MeshNormalMaterial()
        material_to_use.side = FrontSide
        new_mesh.material = material_to_use
      }
    })

    return new_scene
  }

  private scale_model_on_import (scene_object: Scene, max_height = 1.0): void {
    let scale_factor: number = 1.0

    // calculate all the meshes to find out the max height
    const bounding_box = this.calculate_bounding_box(scene_object)

    const height = bounding_box.max.y - bounding_box.min.y
    scale_factor = max_height / height

    // scale all the meshes down by the calculated amount
    scene_object.traverse((child) => {
      if (child.type === 'Mesh') {
        (child as Mesh).geometry.scale(scale_factor, scale_factor, scale_factor)
      }
    })
  }

  private calculate_bounding_box (scene_object: Scene): Box3 {
    // calculate all the meshes to find out the max height
    let found_mesh: boolean = false
    let bounding_box: Box3 = new Box3()

    scene_object.traverse((child: Object3D) => {
      if (child.type === 'Mesh' && !found_mesh) {
        found_mesh = true
        bounding_box = new Box3().setFromObject(child.parent)
      }
    })

    return bounding_box
  }

  public model_meshes (): Scene {
    if (this.final_mesh_data !== undefined) {
      return this.final_mesh_data
    }

    // create a new scene object, and only include meshes
    const new_scene = new Scene()
    new_scene.name = 'Model data'

    // do a for loop to add all the meshes to the scene from the geometry and material list
    for (let i = 0; i < this.geometry_list.length; i++) {
      const mesh = new Mesh(this.geometry_list[i], this.material_list[i])
      new_scene.add(mesh)
    }

    this.final_mesh_data = new_scene

    return this.final_mesh_data
  }

  public models_geometry_list(): BufferGeometry[] {
    // loop through final mesh data and return the geometeries
    const geometries_to_return: BufferGeometry[] = []
    this.final_mesh_data.traverse((child) => {
      if (child.type === 'Mesh') {
        geometries_to_return.push((child as Mesh).geometry.clone())
      }
    })

    return geometries_to_return
  }

  public models_material_list(): Material[] {
    return this.material_list
  }

  public rotate_model_by_axis(axis: string, angle: number): void {
    this.final_mesh_data.traverse((obj) => {
      // if object is a mesh, rotate the geometry data
      if (obj.type === 'Mesh') {
        switch (axis) {
          case 'x':
            (obj as Mesh).geometry.rotateX(MathUtils.degToRad(angle))
            break
          case 'y':
            (obj as Mesh).geometry.rotateY(MathUtils.degToRad(angle))
            break
          case 'z':
            (obj as Mesh).geometry.rotateZ(MathUtils.degToRad(angle))
            break
        }
      }
    })
  }
}
