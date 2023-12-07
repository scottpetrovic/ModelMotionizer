import { Vector3, Vector2, Object3D, Mesh, Group, Bone, Skeleton, Euler, Raycaster} from 'three';
import BoneTransformState from './models/BoneTransformState';

export class Utility {
  static distance_between_objects(
    object_1: Object3D,
    object_2: Object3D
  ): number {
    const object_1_position = new Vector3();
    const object_2_position = new Vector3();
    object_1.getWorldPosition(object_1_position);
    object_2.getWorldPosition(object_2_position);
    return object_1_position.distanceTo(object_2_position);
  }

  /**
   * Converts an object's local position to world position
   * This is similar to "localToWorld()", but makes sure the object's world matrix is up to date
   * https://stackoverflow.com/questions/70016922/three-js-getworldposition-localtoworld-position-not-correct
   * (see Mugen87's comment at the bottom)
   * @param {*} object
   * @returns local position for object in a Vector3 object
   */
  static world_position_from_object(object: Object3D): Vector3 {
    const position: Vector3 = new Vector3();
    return object.getWorldPosition(position);
  }

  static direction_between_points(point_1: Vector3, point_2: Vector3): Vector3 {
    let direction: Vector3 = new Vector3();
    direction.subVectors(point_2, point_1).normalize();
    return direction;
  }

  static is_point_in_box(point: Vector3, box_mesh: Mesh): boolean {
    //Transform the point from world space into the objects space
    box_mesh.updateMatrixWorld();
    let localPt: Vector3 = box_mesh.worldToLocal(point.clone()); 
    return box_mesh.geometry.boundingBox.containsPoint(localPt);
  }

  static remove_object_array(obj: Object3D): void {
    obj.traverse((child: any) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();

        for (const key in child.material) {
          const value = child.material[key];
          if (value && typeof value.dispose === "function") {
            value.dispose();
          }
        }

        obj.remove(obj);
      }
    });
  }

  static remove_object_with_children(obj: Object3D): void {
    if (obj.children.length > 0) {
      obj.children.forEach((child) => {
        this.remove_object_with_children(child);
      });
    }

    if (obj instanceof Mesh) {
      if (obj.geometry) {
        obj.geometry.dispose();
      }

      if (obj.material) {
        if (obj.material.map) {
          obj.material.map.dispose();
        }

        obj.material.dispose();
      }
    }

    if (obj.parent) {
      obj.parent.remove(obj);
    }

    obj.removeFromParent();
  }

  static bone_list_from_hierarchy(bone_hierarchy: Object3D): Array<Bone> {
    if (bone_hierarchy === undefined || bone_hierarchy === null) {
      throw new Error(
        "bone_list_from_hierarchy() - bone_hierarchy parameter is undefined or null"
      );
    }

    const bone_list: Array<Bone> = [];
    bone_hierarchy.traverse((bone) => {
      if (bone instanceof Bone) {
        bone_list.push(bone);
      }
    });
    return bone_list;
  }

  static intersection_points_between_positions_and_mesh(positions, envelope_mesh) {
    const vertex_positions_inside_bone_envelope: Array<Vector3> = [];
    const vertex_indexes_inside_bone_evelope: Array<number> = [];
    const vertex_count: number = positions.array.length / 3;

    for( let i = 0; i < vertex_count; i++)
    {
        const vertexPosition: Vector3 = new Vector3().fromBufferAttribute(positions, i);
        const is_intersecting: boolean = Utility.is_point_in_box(vertexPosition, envelope_mesh)

        if(is_intersecting)
        {
            vertex_positions_inside_bone_envelope.push(vertexPosition)
            vertex_indexes_inside_bone_evelope.push(i)
        }
    }

    return { vertex_positions_inside_bone_envelope, vertex_indexes_inside_bone_evelope };
  }

  /**
   * From a mouse event, return a normalized vector2 for screen space between -1 and 1 (0 being center of screen)
   * This is used for turning a mouse event into a raycaster when determining screen space intersections
   * Top right of screen would return 1, 1. Bottom left would return -1, -1
   * @param {*} mouse_event
   * @returns x and y coordinates normalized between -1 and 1
   */
  static normalized_mouse_position(mouse_event): Vector2 {
    let mouse: Vector2 = new Vector2();
    mouse.x = (mouse_event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(mouse_event.clientY / window.innerHeight) * 2 + 1;
    return mouse;
  }

  /**
   * Store all the debugging objects in a separate group so they can be easily organized
   * and removed when needed
   * @param {*} scene
   * @returns
   */
  static regenerate_debugging_scene(scene): Group {
    const debugging_object_name: string = "Skinning Debug Container";

    // clear out debugging container if it exists
    const existing_debugging_container: Object3D = scene.getObjectByName(
      debugging_object_name
    );
    if (existing_debugging_container) {
      this.remove_object_array(existing_debugging_container);
      existing_debugging_container.clear();
      scene.remove(existing_debugging_container);
    }

    // add a reusable container for debugging
    const debugging_scene_object: Group = new Group();
    debugging_scene_object.name = debugging_object_name;
    scene.add(debugging_scene_object);
    return debugging_scene_object;
  }

  static store_bone_transforms(skeleton: Skeleton): Array<BoneTransformState> {
    const bone_transforms: Array<BoneTransformState> = [];
    skeleton.bones.forEach((bone) => {
      const new_transform_state = new BoneTransformState(
        bone.name,
        bone.position.clone(),
        bone.rotation.clone(),
        bone.scale.clone()
      );
      bone_transforms.push(new_transform_state);
    });

    return bone_transforms;
  }

  static restore_bone_transforms(
    skeleton: Skeleton,
    original_bone_transforms: Array<BoneTransformState>
  ) {
    original_bone_transforms.forEach((bone_transform) => {
      const bone: Bone | null =
        skeleton.bones.find((bone) => bone.name === bone_transform.name) ??
        null;

      if (bone !== null) {
        bone.position.copy(bone_transform.position);
        let euler = new Euler();
        euler.setFromVector3(bone_transform.rotation);
        bone.rotation.copy(euler);
        bone.scale.copy(bone_transform.scale);
      }
    });
  }

  static calculate_bone_base_name(bone_name) {
    return bone_name
      .replace("mixamorig_", "")
      .replace(/(Right|Right_|R_|_Right|_R|Left|Left_|_Left|L_)/g, "");
  }

  static raycast_closest_bone_test(camera, mouse_event, skeleton)
  {
   // Find the closest bone for raycaster. Select that
   let raycaster = new Raycaster();
   raycaster.setFromCamera(Utility.normalized_mouse_position(mouse_event), camera);
   let closestBone = null;
   let closestBoneIndex = 0;
   let closestDistance = Infinity;
 
   skeleton.bones.forEach((bone, bone_index) => {
     let worldPosition = Utility.world_position_from_object(bone);
     let target = new Vector3();
     let point = raycaster.ray.closestPointToPoint(worldPosition, target);
     let distance = point.distanceTo(worldPosition);
 
     if (distance < closestDistance) {
       closestBone = bone;
       closestDistance = distance;
       closestBoneIndex = bone_index;
     }
   });
 
   return [closestBone, closestBoneIndex, closestDistance]
  }

  static scale_armature_by_scalar(armature, scalar)
  {
    armature.traverse((bone) => {
      if(bone.type === 'Bone')
      {
        bone.position.multiplyScalar(scalar);
      }
    });
  
  }

  static clean_bone_name_for_messaging(bone_name: string): string
  {
    return bone_name.replace('mixamorig_', '')
  }
 
}
