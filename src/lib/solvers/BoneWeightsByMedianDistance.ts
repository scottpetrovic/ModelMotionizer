import { Utility } from '../Utilities.js';
import { Bone, BufferGeometry, Scene, Vector3 } from 'three';
import BoneCalculationData from '../models/BoneCalculationData.js';


/**
 * This calculation is similar to the normal bone weights by distance, but uses the 
 * location half way between the bone and the child's bone. This gives better results with the joints
 * If there is no child bone, it just uses the bone's position for the distance calculation
 */
export default class BoneWeightsByMedianDistance 
{
  private geometry: BufferGeometry;
  private skinIndices: number[] = [];
  private skinWeights: number[] = [];
  private show_debug: boolean = false;
  private bone_idx_test: number = -1;
  private bones_master_data: Array<BoneCalculationData> = [];
  private debugging_scene_object: Scene;

  constructor(bone_hier) 
  {
    this.init_bone_weights_data_structure(bone_hier)
  }

  private get_vertex_count()
  {
    if(this.geometry === null) {
      return -1;
    }

    return this.geometry.attributes.position.array.length / 3
  }

  public set_show_debug(debug_value)
  {
      this.show_debug = debug_value;
  }

  public set_bone_index_to_test(bone_idx)
  {
      this.bone_idx_test = bone_idx;
  }

  public set_debugging_scene_object(scene_object)
  {
      this.debugging_scene_object = scene_object;
  }

  public set_geometry(geom: BufferGeometry): void
  {
      this.geometry = geom;
  }


  private init_bone_weights_data_structure(bone_hier)
  {
    const bones_list = Utility.bone_list_from_hierarchy(bone_hier) 
    bones_list.forEach( (bone) => {
      const has_child_bone = bone.children.length > 0
      const supports_envelope = false
      const new_bone_object = new BoneCalculationData(bone.name, bone, supports_envelope, has_child_bone)
      this.bones_master_data.push( new_bone_object)
    });
  }

  public calculate_indexes_and_weights()
  {
    // loop through each vertex and find the closest bone
    // then assign the closest vertices to that bone in the assigned_vertices property
    for( let i = 0; i < this.get_vertex_count(); i++)
    {
        let closest_bone_index: number = 
          this.find_closest_bone_index_from_vertex_index(i, this.geometry, this.bones_master_data)

        // assign to final weights. closest bone is always 100% weight
        this.skinIndices.push(closest_bone_index, 0, 0, 0);
        this.skinWeights.push(1.0, 0, 0, 0);  
    }
  
    if(this.show_debug)
    {
      console.log('Assigned all the bones to vertices: ', this.bones_master_data)
    }

    return [this.skinIndices, this.skinWeights]
  }

  private find_closest_bone_index_from_vertex_index(vertex_index: number, 
    geometry: BufferGeometry, bones: Array<BoneCalculationData>) : number
  {
    const vertex_position: Vector3 = new Vector3().fromBufferAttribute(geometry.attributes.position, vertex_index);
    let closest_bone: Bone = bones[0].bone_object;
    let closest_bone_distance: number = 10000;
    let closest_bone_index: number = 0;

    bones.forEach((bone: BoneCalculationData, idx: number) => {
      let distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position);

      // if bone has a child, we are going to calculate the distance by getting the half way
      // point between bone and child bone...to hopefully yield better results
      if (bone.has_child_bone) {
        const child_bone: Bone = bone.bone_object.children[0];
        const child_bone_position: Vector3 = Utility.world_position_from_object(child_bone);
        const bone_position: Vector3 = Utility.world_position_from_object(bone.bone_object);
        const half_way_point: Vector3 = bone_position.add(child_bone_position).divideScalar(2);
        const distance_to_half_way_point: number = half_way_point.distanceTo(vertex_position);

        if (distance_to_half_way_point < closest_bone_distance) {
          distance = distance_to_half_way_point;
        }
      }

      if (distance < closest_bone_distance) {
        closest_bone = bone.bone_object;
        closest_bone_distance = distance;
        closest_bone_index = idx;
      }
    });

    bones[closest_bone_index].assigned_vertices.push(vertex_index);
    return closest_bone_index;
  }

  public test_bones_outside_in_mesh()
  {
    // don't do test for now and just return success
    return [[],[]];
  }


} // end class



