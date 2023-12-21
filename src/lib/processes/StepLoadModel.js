import { UI } from '../UI.js'
import * as THREE from 'three'
import { Box3 } from 'three/src/math/Box3.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadModel extends EventTarget
{
  loader = null
  ui = null
  original_model_data = null

  final_mesh_data = null

  debug_model_loading = false

  // there can be multiple objects in a model, so store them in a list
  geometry_list = []
  material_list = []

  // for debugging, let's count these to help us test performance things better
  vertex_count = 0
  triangle_count = 0
  objects_count = 0

  // function that goes through all our geometry data and calculates how many triangles we have
  _calculate_mesh_metrics()
  {
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

  _calculate_geometry_list()
  {
    if(this.final_mesh_data === undefined)
    {
      console.error('original model not loaded yet. Cannot do calculations')
    }

    this.final_mesh_data.traverse((child) => {
      if(child.type === 'Mesh')
      {
        const geometry_to_add = child.geometry.clone()
        geometry_to_add.name = child.name
        this.geometry_list.push(geometry_to_add)
        this.material_list.push(child.material.clone())
      }
    })

    // debugging type data
    this._calculate_mesh_metrics()
    console.log( `Vertex count:${this.vertex_count}    Triangle Count:${this.triangle_count}     Object Count:${this.objects_count} `)
  }

  constructor()
  {
    super()
  }

  begin()
  {
    this.ui = new UI()
    this.ui.dom_current_step_index.innerHTML = '1'
    this.ui.dom_current_step_element.innerHTML = 'Load Model'
    this.ui.dom_load_model_tools.style.display = 'flex'

    this.addEventListeners()
  }

  addEventListeners()
  {
    this.ui.dom_upload_model_button.addEventListener('change', (event) => {
      const file = event.target.files[0]
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = () => {
        this._load_model_file(reader.result)
      }
    })

    this.ui.dom_load_model_debug_checkbox.addEventListener('change', (event) => {
      const debug_mode = event.target.checked
      this.debug_model_loading = debug_mode
    })

    this.ui.dom_load_model_button.addEventListener('click', () => {
      // get currently selected option out of the model-selection drop-down
      const model_selection = document.querySelector('#model-selection')
      const selected_model = model_selection.options[model_selection.selectedIndex].value
      this._load_model_file(selected_model)
    })
  }

  instructions_text()
  {
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

  _load_model_file(model_file)
  {
    this.loader = new GLTFLoader()
    const max_height = 1.5 // have 3d model scaled to be 1.5 units tall. helps normalize the models to work with

    this.loader.load(model_file, (gltf) => {
      const loaded_scene = gltf.scene

      this.original_model_data = loaded_scene.clone()
      this.original_model_data.name = 'Cloned Scene'

      this.original_model_data.traverse((child) => {
        child.castShadow = true
      })

      // strip out stuff that we are not bringing into the model step
      const clean_scene_with_only_models = this._strip_out_all_unecessary_model_data(this.original_model_data)
      this._scale_model_on_import(clean_scene_with_only_models, max_height) // if we have multiple objects, we want to scale them all the same

      // assign the final cleaned up model to the original model data
      this.final_mesh_data = clean_scene_with_only_models

      this._calculate_geometry_list()

      this.dispatchEvent(new CustomEvent('modelLoaded'))
    })
  }

  _strip_out_all_unecessary_model_data(model_data)
  {
    // create a new scene object, and only include meshes
    const new_scene = new THREE.Scene()
    new_scene.name = 'New Scene'
    model_data.traverse((child) => {
      let new_mesh

      // if the schild is a skinned mesh, create a new mesh object and apply the geometry and material
      if(child.type === 'SkinnedMesh')
      {
        new_mesh = new THREE.Mesh(child.geometry, child.material)
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      }
      else if(child.type === 'Mesh')
      {
        new_mesh = child.clone()
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      }

      // potentially use normal material to help debugging models that look odd
      // some materials have some odd transparency or back-face things that make it look odd
      let material_to_use
      if(this.debug_model_loading && new_mesh !== undefined)
      {
        material_to_use = new THREE.MeshNormalMaterial()
        material_to_use.side = THREE.FrontSide
        new_mesh.material = material_to_use
      }
    })

    return new_scene
  }

  _scale_model_on_import(mesh, max_height = 1.0)
  {
    let scale_factor = null

    // calculate all the meshes to find out the max height
    let bounding_box = this._calculate_bounding_box(mesh)

    const height = bounding_box.max.y - bounding_box.min.y
    scale_factor = max_height / height

    // scale all the meshes down by the calculated amount
    mesh.traverse((child) =>
    {
      if(child.type === 'Mesh')
      {
        child.geometry.scale(scale_factor, scale_factor, scale_factor)
      }
    })
  }

  _calculate_bounding_box(mesh)
  {
    // calculate all the meshes to find out the max height
    let found_mesh = false
    let bounding_box = null

    mesh.traverse((child) => {
      if(child.type === 'Mesh' && found_mesh === false)
      {
        found_mesh = true
        bounding_box = new Box3().setFromObject(child.parent)
      }
    })

    return bounding_box
  }

  model_meshes()
  {
    if(this.final_mesh_data !== undefined)
    {
      return this.final_mesh_data
    }

    // create a new scene object, and only include meshes
    const new_scene = new THREE.Scene()
    new_scene.name = 'Model data'

    // do a for loop to add all the meshes to the scene from the geometry and material list
    for(let i = 0; i < this.geometry_list.length; i++)
    {
      const mesh = new THREE.Mesh(this.geometry_list[i], this.material_list[i])
      new_scene.add(mesh)
    }

    this.final_mesh_data = new_scene

    return this.final_mesh_data
  }

  models_geometry_list()
  {
    // loop through final mesh data and return the geometeries
    const geometries_to_return = []
    this.final_mesh_data.traverse((child) => {
      if(child.type === 'Mesh')
      {
        geometries_to_return.push(child.geometry.clone())
      }
    })

    return geometries_to_return
  }

  models_material_list()
  {
    return this.material_list
  }

  rotate_model_by_axis(axis, angle)
  {
    this.final_mesh_data.traverse((obj) => {
      // if object is a mesh, rotate the geometry data
      if(obj.type === 'Mesh')
      {
        switch( axis )
        {
          case 'x':
            obj.geometry.rotateX(THREE.MathUtils.degToRad(angle))
            break
          case 'y':
            obj.geometry.rotateY(THREE.MathUtils.degToRad(angle))
            break
          case 'z':
            obj.geometry.rotateZ(THREE.MathUtils.degToRad(angle))
            break
        }
      }
    })
  }
}