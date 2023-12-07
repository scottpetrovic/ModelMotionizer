import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { UI } from '../UI.js';

import { Box3 } from 'three/src/math/Box3.js';


// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadModel extends EventTarget
{
    loader = null
    ui = null
    original_model_data = null

    // there can be multiple objects in a model, so store them in a list
    geometry_list = []
    material_list = []

    constructor() 
    {
        super();
    }

    begin()
    {
        this.ui = new UI();
        this.ui.dom_current_step_index.innerHTML = '1'
        this.ui.dom_current_step_element.innerHTML = 'Load Model'
        this.ui.dom_load_model_tools.style.display = 'flex';

        this.addEventListeners();
    }

    addEventListeners()
    {
        this.ui.dom_upload_model_button.addEventListener('change', (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);
        
            reader.onload = () => {
                this._load_model_file(reader.result)
            };
        
        });

        this.ui.dom_load_model_button.addEventListener('click', () => {

            // get currently selected option out of the model-selection drop-down
            const model_selection = document.querySelector('#model-selection');
            const selected_model = model_selection.options[model_selection.selectedIndex].value;
          
            this._load_model_file(selected_model)
        });
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
              </ol>`;
    }

    _load_model_file(model_file)
    {
      this.loader = new GLTFLoader();

      this.loader.load(model_file, (gltf) => {
        const model = gltf.scene;
    
        this.original_model_data = model.clone()
        this.original_model_data.name = 'Unskinned Mesh';
        this.original_model_data.traverse((child) => {
          child.castShadow = true;
        })
    
        const max_height = 1.5; // have 3d model scaled to be 1.5 units tall. helps normalize the models to work with
        this._scale_model_on_import(this.original_model_data, max_height); // if we have multiple objects, we want to scale them all the same
        
        this.dispatchEvent(new CustomEvent('modelLoaded'));
      });
    
    }

    _scale_model_on_import(mesh, max_height = 1.0)
    {
      let scale_factor = null;

      // need to get the Box3 from everthing.. not just an individual child object
      console.log(mesh)

      // calculate all the meshes to find out the max height
      let bounding_box = this._calculate_bounding_box(mesh)
      const height = bounding_box.max.y - bounding_box.min.y;
      scale_factor = max_height / height;

      // scale all the meshes down by the calculated amount
      mesh.traverse((child) => 
      {    
        if(child.type === 'Mesh')
        {
          child.geometry.scale(scale_factor, scale_factor, scale_factor);
        }

      })

    }

    _calculate_bounding_box(mesh)
    {
      // calculate all the meshes to find out the max height
      let found_mesh = false;
      let bounding_box = null

      mesh.traverse((child) => {
        if(child.type === 'Mesh' && found_mesh === false)
        {
          found_mesh = true;
          bounding_box = new Box3().setFromObject(child.parent);
        }
      })

      return bounding_box
    }

    model_mesh()
    {
        return this.original_model_data
    }

    models_geometry_list()
    {
      if(this.geometry_list.length > 0)
      {
        return this.geometry_list;
      }

      this.original_model_data.traverse((child) => {
        if(child.type === 'Mesh')
        {
          let geometry_to_add = child.geometry.clone();
          geometry_to_add.name = child.name;
          this.geometry_list.push(geometry_to_add)
        }
      })

      console.log(this.geometry_list)

      return this.geometry_list;
    }

    models_material_list()
    {

      if(this.material_list.length > 0)
      {
        return this.material_list;
      }

      this.original_model_data.traverse((child) => {
        if(child.type === 'Mesh')
        {
          this.material_list.push(child.material.clone())
        }
      })

      return this.material_list;
    }

}