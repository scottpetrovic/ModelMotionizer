import { Vector3, type Points } from 'three'
import { Utility } from '../Utilities.js'
import { SkeletonType } from '../enums/SkeletonType.js'
import { AbstractAutoSkinSolver } from './AbstractAutoSkinSolver.js'
import { Generators } from '../Generators.js'

/**
 * BoneWeightsByDistanceChild
 * This works very similar to the normal distance solver. 
 * 1. First pass is to assign closest bone to each vertex like before
 * 2. Second pass is to look through each vertex and look at bone assigned and direction
 *    - if bone to vertex direction  points to a similar direction to parent bone, assign to the parent bone
 */
export default class BoneWeightsByDistanceChild extends AbstractAutoSkinSolver {
  public calculate_indexes_and_weights (): number[][] {
    // There can be multiple objects that need skinning, so 
    // this will make sure we have a clean slate by putting it in function
    const skin_indices: number[] = []
    const skin_weights: number[] = []

    // loop through each vertex and find the closest bone
    // then assign the closest vertices to that bone in the assigned_vertices property
    for (let i = 0; i < this.geometry_vertex_count(); i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      // let closest_bone: Bone = this.bones_master_data[0].bone_object
      let closest_bone_distance: number = 10000
      let closest_bone_index: number = 0

      this.get_bone_master_data().forEach((bone, idx) => {
        // our human skeleton has a root controller bone that isn't in the mesh. Don't assign weights to this?
        if (this.skeleton_type === SkeletonType.Human) {
          if (bone.bone_object.name === 'root') {
            return
          }
        }

        const distance: number = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position)

        if (distance < closest_bone_distance) {
          // closest_bone = bone.bone_object
          closest_bone_distance = distance
          closest_bone_index = idx
        }
      })

      this.get_bone_master_data()[closest_bone_index].assigned_vertices.push(i)

      // assign to final weights. closest bone is always 100% weight
      skin_indices.push(closest_bone_index, 0, 0, 0)
      skin_weights.push(1.0, 0, 0, 0)
    }

    if (this.show_debug) {
      this.debugging_scene_object.add(this.objects_to_show_for_debugging())
    }

    return [skin_indices, skin_weights]
  }

  private objects_to_show_for_debugging (): Points {
    const debug_sphere_size: number = 0.2
    const debug_color = 0xff00ff // vertices that are part of envelope

    const vertex_points_to_show: Vector3[] = []

    // Create a 10 random points to test that are hard-coded
    for (let i = 0; i < 10; i++) {
      const random_point: Vector3 = new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(0.5)

      vertex_points_to_show.push(random_point)
    }

    const debug_assigned_points: Points = Generators.create_spheres_for_points(vertex_points_to_show,
      debug_sphere_size, debug_color, 'Vertices assigned to bone')

    return debug_assigned_points
  }
}
