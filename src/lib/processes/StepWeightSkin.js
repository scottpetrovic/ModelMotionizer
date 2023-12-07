import { UI } from '../UI.js';

import { BoneWeightsByEnvelope } from '../solvers/BoneWeightsByEnvelope.ts';
import BoneWeightsByDistance from '../solvers/BoneWeightsByDistance.ts';
import BoneWeightsByMedianDistance from '../solvers/BoneWeightsByMedianDistance.ts';

import { SkinningFormula } from '../enums/SkinningFormula.js';

import { Generators } from '../Generators.ts';

import { SkinnedMesh } from 'three';

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepWeightSkin extends EventTarget
{
    ui = null;
    skinning_armature = null
    bone_skinning_formula = null
    binding_skeleton = null
    skinned_meshes = []

    // debug options for bone skinning formula
    enable_debugging = false
    show_debug = false
    debug_scene_object = null
    bone_index_to_test = -1

    constructor() 
    {
        super();
        this.ui = new UI();
    }

    begin()
    {
        this.ui.dom_current_step_index.innerHTML = '3.5'
        this.ui.dom_current_step_element.innerHTML = 'Skin Debug'
        this.ui.dom_skinned_mesh_tools.style.display = 'flex';
    }

    instructions_text()
    {
      return `<div>Instructions</div> 
            <div>Visualize the results of the skinning. Currently only supported for Bone Envelope</div>
              <ol>
                <li>Green vertices indicate vertex is inside a bone cage</li>
                <li>Red vertex indicates there is no bone found, so relies on closest distance to bone.</li>
                <li>Modifying the position of the bones to be closer to the middle of the mesh can improve results</li>
              </ol>`;
    }


    create_bone_formula_object(editable_armature, skinning_formula)
    {

      this.skinning_armature = editable_armature.clone()
      this.skinning_armature.name = 'Armature for skinning';
      
      // Swap out formulas to see different results
      if(skinning_formula === SkinningFormula.Envelope)
      {
        this.bone_skinning_formula = new BoneWeightsByEnvelope(this.skinning_armature.children[0]);
      }
      else if(skinning_formula === SkinningFormula.Distance)
      {
        this.bone_skinning_formula = new BoneWeightsByDistance(this.skinning_armature.children[0]);
      }
      else if(skinning_formula === SkinningFormula.MedianDistance)
      {
        this.bone_skinning_formula = new BoneWeightsByMedianDistance(this.skinning_armature.children[0]);
      }

      return this.bone_skinning_formula
    }

    skeleton()
    {
        // gets bone hierarchy from the armature
        return this.binding_skeleton
    }

    set_mesh_geometry(geometry)
    {
      this.bone_skinning_formula.set_geometry(geometry)
    }

    test_geometry()
    {
      if(this.show_debug)
      {
        this.bone_skinning_formula.set_show_debug(this.show_debug)
        this.bone_skinning_formula.set_debugging_scene_object(this.debug_scene_object)
        this.bone_skinning_formula.set_bone_index_to_test(this.bone_index_to_test)
      }

        return this.bone_skinning_formula.test_bones_outside_in_mesh()
    }

    create_binding_skeleton()
    {
      // when we copy over the armature with the bind, we will lose the reference in the variable
      this.binding_skeleton = Generators.create_skeleton(this.skinning_armature.children[0]);
      this.binding_skeleton.name = 'Mesh Binding Skeleton';
    }

    clear_skinned_meshes()
    {
      this.skinned_meshes = []
    }

    create_skinned_mesh(geometry, material)
    {
      // create skinned mesh
      let skinned_mesh = new SkinnedMesh(geometry, material);
      skinned_mesh.name = 'Skinned Mesh';
      skinned_mesh.castShadow = true; // skinned mesh won't update right if this is false

      // do the binding for the mesh to the skelleton
      skinned_mesh.add(this.binding_skeleton.bones[0]);
      skinned_mesh.bind(this.binding_skeleton);

      // keep track of all the skinned meshes we create to access later
      this.skinned_meshes.push(skinned_mesh)
    }

    final_skinned_meshes()
    {
      return this.skinned_meshes
    }

    set_show_debug(value)
    {
        this.show_debug = value
    }

    set_debug_scene_object(scene)
    {
        this.debug_scene_object = scene
    }

    set_bone_index_to_test(index)
    {
        this.bone_index_to_test = index
    }

    calculate_weights()
    {
        return this.bone_skinning_formula.calculate_indexes_and_weights()
    }

}