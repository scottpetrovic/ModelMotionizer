import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { Utility } from './lib/Utilities.ts';
import { Generators } from './lib/Generators.ts';

import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import { UI } from './lib/UI.js';

import { StepLoadModel } from './lib/processes/StepLoadModel.js';
import { StepLoadSkeleton } from './lib/processes/StepLoadSkeleton.js';
import { StepEditSkeleton } from './lib/processes/StepEditSkeleton.js';
import { StepAnimationsListing } from './lib/processes/StepAnimationsListing.js';
import { StepExportToFile } from './lib/processes/StepExportToFile.js';
import { StepWeightSkin } from './lib/processes/StepWeightSkin.js';

import { ProcessStep } from './lib/enums/ProcessStep.js';

// Initialize basic sene things that are not related to the main work that is being tested
const camera = Generators.create_camera();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

Generators.create_window_resize_listener(renderer, camera);
document.body.appendChild(renderer.domElement);

// center orbit controls around mid-section area with target change
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.75, 0);
controls.update();

// setup transform controls to eventually test out differnt bone rotations
let transformControls = new TransformControls(camera, renderer.domElement);
let is_transform_controls_dragging = false;

// has UI elements on the HTML page that we will reference/use
let ui = new UI();
let load_model_step = new StepLoadModel()
let load_skeleton_step = new StepLoadSkeleton()
let edit_skeleton_step = new StepEditSkeleton()
let weight_skin_step = new StepWeightSkin()
let animations_listing_step = new StepAnimationsListing()
let file_export_step = new StepExportToFile()

const scene = new THREE.Scene();
scene.add(transformControls);

// basic things in another group, to better isolate what we are working on
const environment_container = new THREE.Group();
environment_container.name = 'Setup objects';
environment_container.add(...Generators.create_default_lights());
environment_container.add(...Generators.create_grid_helper())
scene.add(environment_container);


const fog_near = 0
const fog_far = 80
const fog_color = 0x0d2525
scene.fog = new THREE.Fog(fog_color, fog_near, fog_far);

// for looking at specific bones
let skeleton_helper;
let debugging_visual_object = null;
let process_step = null;

let clock = new THREE.Clock();

process_step = process_step_changed(ProcessStep.LoadModel)

function regenerate_skeleton_helper(new_skeleton, helper_name = 'Skeleton Helper')
{
  // if skeleton helper exists...remove it
  if(skeleton_helper)
  {
    scene.remove(skeleton_helper);
  }

  skeleton_helper = new THREE.SkeletonHelper(new_skeleton.bones[0]);
  skeleton_helper.name = helper_name;
  scene.add(skeleton_helper)
}

function handle_transform_controls_moving()
{
  if(edit_skeleton_step.is_mirror_mode_enabled())
  {
    const selected_bone = transformControls.object
    edit_skeleton_step.apply_mirror_mode(selected_bone, transformControls.getMode())
  }
}

function clear_info_panel_message()
{
  ui.dom_info_panel.innerHTML = 'Everything ok';
}

function show_skin_failure_message(bones_with_errors)
{
  // add the bone vertices as sphere to debugging object
  const sphere_failures = Generators.create_spheres_for_points(bones_with_errors, 0.02, 0xff0000)
  debugging_visual_object.add(sphere_failures)

  // add information to the info panel
  ui.dom_info_panel.innerHTML = 'Some bones are outside the mesh. Fix them up and try to bind again';
  ui.dom_info_panel.innerHTML += '<br>';

  // display the bones names in an HTML list
  let bones_error_list = '<ol id="bone-list">'
  bones_with_errors.forEach((bone) => {
    bones_error_list += `<li>${ Utility.clean_bone_name_for_messaging(bone) }</li>`
  });

  bones_error_list += '</ol>'
  ui.dom_info_panel.innerHTML += bones_error_list
}

function test_bone_weighting_success()
{
  debugging_visual_object = Utility.regenerate_debugging_scene(scene); // clear out the debugging scene

  weight_skin_step.create_bone_formula_object(edit_skeleton_step.armature(), edit_skeleton_step.algorithm())
  
  if(edit_skeleton_step.show_debugging())
  {
    weight_skin_step.set_show_debug(edit_skeleton_step.show_debugging());
    weight_skin_step.set_debug_scene_object(debugging_visual_object);
    weight_skin_step.set_bone_index_to_test(-1);
  }

  // Don't do skinning operation if there are bones outside of the mesh
  // that messes up the bone envelope calculation
  let testing_geometry_success = true;
  load_model_step.models_geometry_list().forEach((mesh_geometry, index) => {

    weight_skin_step.set_mesh_geometry(mesh_geometry)
    const [bone_names_failing_skin_test, bone_positions_failing_skin_test] = weight_skin_step.test_geometry()

    if(bone_names_failing_skin_test.length > 0)
    {
      let names_with_object_index = bone_names_failing_skin_test.map((bone_name) => bone_name + ` (${mesh_geometry.name})`  );
      show_skin_failure_message(names_with_object_index)
      testing_geometry_success = false;
    }
  });

  if(testing_geometry_success === false)
  {
    return false
  }

  return true
}

function start_skin_weighting_step()
{

  // we only need one binding skeleton. All skinned meshes will use this.
  weight_skin_step.create_binding_skeleton()
  
  weight_skin_step.clear_skinned_meshes() // clear out any existing skinned meshes in storage
  load_model_step.models_geometry_list().forEach((mesh_geometry, index) => {
    
    // we passed the bone test, so we can do the skinning process
    weight_skin_step.set_mesh_geometry(mesh_geometry)
    const [final_skin_indices, final_skin_weights] = weight_skin_step.calculate_weights()

    mesh_geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( final_skin_indices, 4 ) );
    mesh_geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute(final_skin_weights, 4 ) );

    // create a separate skinned skeleton and helper for the binding pose
    // having a separate one will help us if we want to go back and edit the original skeleton
    const mesh_material = load_model_step.models_material_list()[index]
    weight_skin_step.create_skinned_mesh(mesh_geometry, mesh_material)

    scene.add(...weight_skin_step.final_skinned_meshes())
  });




  // remember our skeleton position before we do the skinning process
  // that way if we revert to try again...we will have the original positions/rotations
  load_model_step.model_mesh().visible = false;   // hide our unskinned mesh after we have done the skinning process

  // re-define skeleton helper to use the skinned mesh)
  regenerate_skeleton_helper(weight_skin_step.skeleton())

  // we might want to test out the binding algorithm to see various hitboxes
  // if we are doing debugging, go to that view, if no debugging, go straight to thd animation listing step
  if(edit_skeleton_step.show_debugging())
  {
    return
  }

  process_step_changed(ProcessStep.AnimationsListing)

}

function process_step_changed(process_step)
{
  // we will have the current step turn on the UI elements it needs
  ui.hideAllElements(); 

  // clean up any event listeners from the previous steps
  edit_skeleton_step.removeEventListeners()
  animations_listing_step.removeEventListeners()

  switch(process_step)
  {
    case ProcessStep.LoadModel:
      process_step = ProcessStep.LoadModel
      load_model_step.begin()
      ui.dom_info_panel.innerHTML = load_model_step.instructions_text()
      break;
    case ProcessStep.LoadSkeleton:
      process_step = ProcessStep.LoadSkeleton
      load_skeleton_step.begin()
      ui.dom_info_panel.innerHTML = load_skeleton_step.instructions_text()
      break;
    case ProcessStep.EditSkeleton:
      process_step = ProcessStep.EditSkeleton
      edit_skeleton_step.begin()
      transformControls.enabled = true;
      transformControls.setMode("translate");
      ui.dom_transform_controls_switch.style.display = 'none'; // hide the UI control until we have a bone selected
      ui.dom_info_panel.innerHTML = edit_skeleton_step.instructions_text()
      break;
    case ProcessStep.BindPose:
      process_step = ProcessStep.BindPose
      ui.dom_info_panel.innerHTML = weight_skin_step.instructions_text()
      weight_skin_step.begin()
      transformControls.enabled = false; // shouldn't be editing bones
      start_skin_weighting_step()
      break;
    case ProcessStep.AnimationsListing:
      process_step = ProcessStep.AnimationsListing
      ui.dom_info_panel.innerHTML = animations_listing_step.instructions_text()
      animations_listing_step.begin()
      transformControls.setMode("rotate");
      animations_listing_step.load_and_apply_default_animation_to_skinned_mesh(weight_skin_step.final_skinned_meshes(), 
        load_skeleton_step.skeleton_type()  )
      break;
  }

  // when we change steps, we are re-creating the skeleeton and helper
  // so the current transform control reference will be lost/give an error
  transformControls.detach();

  return process_step;
}

const animate = () => {
  requestAnimationFrame(animate);

  if(animations_listing_step?.mixer())
  {
    const deltaTime = clock.getDelta();
    animations_listing_step.mixer().update(deltaTime);
  }

  renderer.render(scene, camera);
};
animate();

//////////////////////////////////
// EVENT LISTENERS
//////////////////////////////////

renderer.domElement.addEventListener('mousemove', (event) => {
  if(is_transform_controls_dragging)
  {
    handle_transform_controls_moving()
  }
});

renderer.domElement.addEventListener('mousedown', (event) => { 
 
  // primary click is made for rotating around 3d scene
  const is_primary_button_click = event.button === 0;
  
  if(is_primary_button_click)  { return; }
  if(edit_skeleton_step.skeleton()?.bones === undefined) { return }


  // when we are done with skinned mesh, we shouldn't be editing transforms
  if(transformControls.enabled === false)
  {
    return
  }


  // we will change which skeleton we do an intersection test with 
  // depending on what step we are on. We are either moving the setup skeleton
  // or moving the bind pose skeleton
  let skeleton_to_test = null
  if ( process_step === ProcessStep.EditSkeleton)
  {
    skeleton_to_test = edit_skeleton_step.skeleton()
  }
  else if ( process_step === ProcessStep.AnimationsListing)
  {
    skeleton_to_test = weight_skin_step.skeleton()
  }

  const [closestBone, closestBoneIndex, closestDistance] = Utility.raycast_closest_bone_test(camera, event, skeleton_to_test)

  // only do selection if we are close
  // the orbit controls also have panning with alt-click, so we don't want to interfere with that
  if(closestDistance > 0.1) 
  {
    return;
  }

  if (closestBone !== null) 
  {
    transformControls.attach(closestBone);
    weight_skin_step.set_bone_index_to_test(closestBoneIndex);   
    ui.dom_transform_controls_switch.style.display = 'flex'; 
  }
  

 }, false);

transformControls.addEventListener('dragging-changed', function(event) {
  is_transform_controls_dragging = event.value; // monitor the dragging state for transform control
});

transformControls.addEventListener('dragging-changed', function (event) {
  controls.enabled = !event.value;
});

load_model_step.addEventListener('modelLoaded', (event) => {
  scene.add(load_model_step.model_mesh())
  process_step = process_step_changed(ProcessStep.LoadSkeleton)
})

load_skeleton_step.addEventListener('skeletonLoaded', (event) => {

  // pass in our loaded armature to the edit skeleton for further editing
  // keep a reference to our initial skeleton data in case we want to revert
  edit_skeleton_step.set_armature(load_skeleton_step.armature())

  regenerate_skeleton_helper(edit_skeleton_step.skeleton())
  
  process_step = process_step_changed(ProcessStep.EditSkeleton)
})


//////////////////////////////////
// EVENT LISTENERS FOR UI ELEMENTS
//////////////////////////////////

ui.dom_bind_pose_button.addEventListener('click', () => {
  
  // make sure we have a valid bone position before we try to do any weighting
  // this test validates that bones are inside the mesh
  const passed_bone_skinning_test = test_bone_weighting_success()
  if(passed_bone_skinning_test)
  {
    process_step_changed(ProcessStep.BindPose)
  }  

});

ui.dom_back_to_edit_skeleton_button.addEventListener('click', () => {

  // clear existing skinned mesh if it exists
  const existing_skinned_meshes = scene.children.filter((child) => child.name === 'Skinned Mesh');
  
  existing_skinned_meshes.forEach((existing_skinned_mesh) => {
    Utility.remove_object_with_children(existing_skinned_mesh);  
  })
  
  debugging_visual_object = Utility.regenerate_debugging_scene(scene); // clear out the debugging scene

  process_step = process_step_changed(ProcessStep.EditSkeleton)

  regenerate_skeleton_helper(edit_skeleton_step.skeleton())

  load_model_step.model_mesh().visible = true; // show the unskinned mesh again

});


ui.dom_transform_controls_switch.addEventListener('click', function(event) 
{
  const targetElement = event.target;
  
  if(targetElement.value === undefined)
  {    
    return; // half of events for this are returning null for some reason
  }

  if(targetElement.value === 'translation')
  {
    transformControls.setMode("translate");
  }
  else if(targetElement.value === 'rotation')
  {
    transformControls.setMode("rotate");
  }

});

// this is mostly useful after we bind the mesh so we can just see the final mesh
ui.dom_show_skeleton_checkbox.addEventListener('click', (event) => {
  skeleton_helper.visible = event.target.checked;
});

ui.dom_export_button.addEventListener('click', () => {

  const all_clips = animations_listing_step.animation_clips()
  file_export_step.set_animation_clips_to_export(all_clips)
  file_export_step.export(weight_skin_step.final_skinned_meshes(), 'exported-model');
});
