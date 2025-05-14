import {
  Vector3, Vector2, type Object3D, Mesh, Group, Bone, type Skeleton, Euler, Raycaster,
  type PerspectiveCamera, type Scene, type Object3DEventMap, type BufferAttribute, BufferGeometry, InterleavedBufferAttribute
} from 'three'
import BoneTransformState from './models/BoneTransformState'
import BoneCalculationData from './models/BoneCalculationData'
import IntersectionPointData from './models/IntersectionPointData'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Utility {
  static distance_between_objects (
    object_1: Object3D,
    object_2: Object3D
  ): number {
    const object_1_position = new Vector3()
    const object_2_position = new Vector3()
    object_1.getWorldPosition(object_1_position)
    object_2.getWorldPosition(object_2_position)
    return object_1_position.distanceTo(object_2_position)
  }

  /**
   * Converts an object's local position to world position
   * This is similar to "localToWorld()", but makes sure the object's world matrix is up to date
   * https://stackoverflow.com/questions/70016922/three-js-getworldposition-localtoworld-position-not-correct
   * (see Mugen87's comment at the bottom)
   * @param {*} object
   * @returns local position for object in a Vector3 object
   */
  static world_position_from_object (object: Object3D): Vector3 {
    const position: Vector3 = new Vector3()
    return object.getWorldPosition(position)
  }

  static direction_between_points (point_1: Vector3, point_2: Vector3): Vector3 {
    const direction: Vector3 = new Vector3()
    direction.subVectors(point_2, point_1).normalize()
    return direction
  }

  static is_point_in_box (point: Vector3, box_mesh: Mesh): boolean {
    // Transform the point from world space into the objects space
    box_mesh.updateMatrixWorld()
    const local_point: Vector3 = box_mesh.worldToLocal(point.clone())

    if (box_mesh.geometry.boundingBox === null) {
      console.warn('is_point_in_box() - box_mesh does not have a bounding box', box_mesh)
      return false
    }

    return box_mesh.geometry.boundingBox.containsPoint(local_point)
  }

  static remove_object_array (obj: Object3D): void {
    obj.traverse((child: any) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()

        for (const key in child.material) {
          const value = child.material[key]
          if (value && typeof value.dispose === 'function') {
            value.dispose()
          }
        }

        obj.remove(obj)
      }
    })
  }

  static remove_object_with_children (obj: Object3D): void {
    if (obj.children.length > 0) {
      obj.children.forEach((child) => {
        this.remove_object_with_children(child)
      })
    }

    if (obj instanceof Mesh) {
      if (obj.geometry !== null) {
        obj.geometry.dispose()
      }

      if (obj.material !== undefined) {
        if (obj.material.map) {
          obj.material.map.dispose()
        }

        obj.material.dispose()
      }
    }

    if (obj.parent != null) {
      obj.parent.remove(obj)
    }

    obj.removeFromParent()
  }

  static bone_list_from_hierarchy (bone_hierarchy: Object3D): Bone[] {
    if (bone_hierarchy === undefined || bone_hierarchy === null) {
      throw new Error(
        'bone_list_from_hierarchy() - bone_hierarchy parameter is undefined or null'
      )
    }

    const bone_list: Bone[] = []
    bone_hierarchy.traverse((bone) => {
      if (bone instanceof Bone) {
        bone_list.push(bone)
      }
    })
    return bone_list
  }

  static intersection_points_between_positions_and_mesh (positions: BufferAttribute | InterleavedBufferAttribute,
    envelope_mesh: Mesh): IntersectionPointData {
    const vertex_positions_inside_bone_envelope: Vector3[] = []
    const vertex_indexes_inside_bone_evelope: number[] = []
    const vertex_count: number = positions.array.length / 3

    for (let i = 0; i < vertex_count; i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(positions, i)
      const is_intersecting: boolean = Utility.is_point_in_box(vertex_position, envelope_mesh)

      if (is_intersecting) {
        vertex_positions_inside_bone_envelope.push(vertex_position)
        vertex_indexes_inside_bone_evelope.push(i)
      }
    }

    return new IntersectionPointData(vertex_positions_inside_bone_envelope, vertex_indexes_inside_bone_evelope)
  }

  /**
   * From a mouse event, return a normalized vector2 for screen space between -1 and 1 (0 being center of screen)
   * This is used for turning a mouse event into a raycaster when determining screen space intersections
   * Top right of screen would return 1, 1. Bottom left would return -1, -1
   * @param {*} mouse_event
   * @returns x and y coordinates normalized between -1 and 1
   */
  static normalized_mouse_position (mouse_event: MouseEvent): Vector2 {
    const mouse: Vector2 = new Vector2()
    mouse.x = (mouse_event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(mouse_event.clientY / window.innerHeight) * 2 + 1
    return mouse
  }

  /**
   * Store all the debugging objects in a separate group so they can be easily organized
   * and removed when needed
   * @param {*} scene
   * @returns
   */
  static regenerate_debugging_scene (scene: Scene): Group {
    const debugging_object_name: string = 'Skinning Debug Container'

    // clear out debugging container if it exists
    const existing_debugging_container: Object3D<Object3DEventMap> | undefined = scene.getObjectByName(
      debugging_object_name
    )
    if (existing_debugging_container !== undefined) {
      this.remove_object_array(existing_debugging_container)
      existing_debugging_container.clear()
      scene.remove(existing_debugging_container)
    }

    // add a reusable container for debugging
    const debugging_scene_object: Group = new Group()
    debugging_scene_object.name = debugging_object_name
    scene.add(debugging_scene_object)
    return debugging_scene_object
  }

  static store_bone_transforms (skeleton: Skeleton): BoneTransformState[] {
    const bone_transforms: BoneTransformState[] = []
    skeleton.bones.forEach((bone) => {
      const new_rotation: Vector3 = new Vector3().setFromEuler(bone.rotation)

      const new_transform_state = new BoneTransformState(
        bone.name,
        bone.position.clone(),
        new_rotation,
        bone.scale.clone()
      )
      bone_transforms.push(new_transform_state)
    })

    return bone_transforms
  }

  static restore_bone_transforms (
    skeleton: Skeleton,
    original_bone_transforms: BoneTransformState[]
  ): void {
    original_bone_transforms.forEach((bone_transform) => {
      const bone: Bone | null =
        skeleton.bones.find((bone) => bone.name === bone_transform.name) ??
        null

      if (bone !== null) {
        bone.position.copy(bone_transform.position)
        const euler: Euler = new Euler()
        euler.setFromVector3(bone_transform.rotation)
        bone.rotation.copy(euler)
        bone.scale.copy(bone_transform.scale)
      }
    })
  }

  static calculate_bone_base_name (bone_name: string): string {
    // human has different bone naming convention than 4 legged animals
    if (bone_name.includes('DEF-')) {
      return bone_name
        .replace('DEF-', '')
        .replace(/(R|L)/g, '')
    }

    // animal rig
    return bone_name
      .replace(/(Right|Right_|R_|_Right|_R|Left|Left_|_Left|L_|_R|_L)/g, '')
  }

  static raycast_closest_bone_test (camera: PerspectiveCamera, mouse_event: MouseEvent, skeleton: Skeleton): Array<number | null> {
    // Find the closest bone for raycaster. Select that
    const raycaster: Raycaster = new Raycaster()
    raycaster.setFromCamera(Utility.normalized_mouse_position(mouse_event), camera)
    let closest_bone = null
    let closest_bone_index = 0
    let closest_distance = Infinity

    skeleton.bones.forEach((bone, bone_index) => {
      const world_position = Utility.world_position_from_object(bone)
      const target = new Vector3()
      const point = raycaster.ray.closestPointToPoint(world_position, target)
      const distance = point.distanceTo(world_position)

      if (distance < closest_distance) {
        closest_bone = bone
        closest_distance = distance
        closest_bone_index = bone_index
      }
    })

    const output = [closest_bone, closest_bone_index, closest_distance]
    return output
  }

  static scale_armature_by_scalar (armature: Object3D, scalar: number): void {
    armature.traverse((bone) => {
      if (bone.type === 'Bone') {
        bone.position.multiplyScalar(scalar)
      }
    })
  }

  static clean_bone_name_for_messaging (bone_name: string): string {
    return bone_name.replace('mixamorig_', '')
  }

  static find_closest_bone_index_from_vertex_index (vertex_index: number, geometry: BufferGeometry, bones: BoneCalculationData[]): number {
    const vertex_position: Vector3 = new Vector3().fromBufferAttribute(geometry.attributes.position, vertex_index)
    // let closest_bone: Bone = bones[0].bone_object
    let closest_bone_distance: number = 10000
    let closest_bone_index: number = 0

    bones.forEach((bone: BoneCalculationData, idx: number) => {
      let distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position)

      // if bone has a child, we are going to calculate the distance by getting the half way
      // point between bone and child bone...to hopefully yield better results
      if (bone.has_child_bone) {
        const child_bone: Bone = bone.bone_object.children[0] as Bone
        const child_bone_position: Vector3 = Utility.world_position_from_object(child_bone)
        const bone_position: Vector3 = Utility.world_position_from_object(bone.bone_object)
        const half_way_point: Vector3 = bone_position.add(child_bone_position).divideScalar(2)
        const distance_to_half_way_point: number = half_way_point.distanceTo(vertex_position)

        if (distance_to_half_way_point < closest_bone_distance) {
          distance = distance_to_half_way_point
        }
      }

      if (distance < closest_bone_distance) {
        // closest_bone = bone.bone_object
        closest_bone_distance = distance
        closest_bone_index = idx
      }
    })

    bones[closest_bone_index].assigned_vertices.push(vertex_index)
    return closest_bone_index
  }
}
