import {
  PerspectiveCamera, DoubleSide, DirectionalLight, GridHelper,
  Bone, Skeleton, AmbientLight, PlaneGeometry, Mesh,
  SphereGeometry, type MeshBasicMaterial, MeshPhongMaterial, AxesHelper,
  Vector3, PointsMaterial, BufferGeometry, Points, type Object3D, WebGLRenderer,
  Group, Line, LineBasicMaterial
} from 'three'


import { CustomSkeletonHelper } from './CustomSkeletonHelper'

import { Utility } from './Utilities'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Generators {
  static create_material (wireframe_value = true, color_hex = 0x00ff00): MeshPhongMaterial {
    const material = new MeshPhongMaterial({ color: color_hex, wireframe: wireframe_value })
    material.side = DoubleSide
    return material
  }

  static create_grid_helper (color = 0x111155): any[] {
    // create floor mesh and add to scene to help with shadows
    const floor_geometry = new PlaneGeometry(30, 30, 30, 30)
    const floor_material = new MeshPhongMaterial({ color: 0x4e4e7a, wireframe: false, transparent: false })
    floor_material.side = DoubleSide // helps us see that we are below the character

    const floor_mesh = new Mesh(floor_geometry, floor_material)
    floor_mesh.name = 'Floor Mesh'
    floor_mesh.rotation.x = -Math.PI / 2
    floor_mesh.position.y = -0.01
    floor_mesh.receiveShadow = true

    // xyz axes helper display
    const axes_helper = new AxesHelper(0.3)
    axes_helper.name = 'Axes Helper'
    axes_helper.position.copy(new Vector3(0, 0.008, 0)) // offset a bit to avoid z-fighting

    // grid display on floor
    const size: number = 30
    const divisions: number = 30
    const grid_helper: GridHelper = new GridHelper(size, divisions, color, color)

    return [grid_helper, floor_mesh, axes_helper]
  }


  static create_bone_hierarchy (): Bone {
    // offset root bone down to move entire bone structure
    const bone0 = new Bone()
    bone0.name = 'rootBone'

    const bone1 = new Bone()
    bone1.name = 'childBone'

    const bone2 = new Bone()
    bone2.name = 'grandchildBone'

    const bone3 = new Bone()
    bone3.name = 'greatGrandchildBone'

    bone0.add(bone1)
    bone1.add(bone2)
    bone2.add(bone3)

    // this is the local position...relative to the parent
    bone0.position.y = -0.8
    bone1.position.y = 0.5
    bone2.position.y = 0.5
    // bone2.position.x = 0.5; // temporarily to test cylinder
    bone3.position.y = 0.5

    return bone0
  }

  static create_skeleton (bone_hierarchy: Object3D): Skeleton {
    const bone_list = Utility.bone_list_from_hierarchy(bone_hierarchy)
    const skeleton = new Skeleton(bone_list)
    return skeleton
  }

  static create_skeleton_helper (skeleton: Skeleton): CustomSkeletonHelper {
    const skeleton_helper = new CustomSkeletonHelper(skeleton.bones[0], { lineWidth: 5, dashed: true })
    return skeleton_helper
  }

  // create x markers at a location in space
  static create_x_markers (points: Vector3[], size = 0.1, color = 0xff0000, name = ''): Group {
    const group = new Group()
    group.name = `X markers: ${name}`

    const material = new LineBasicMaterial({
      color,
      depthTest: false
    })

    points.forEach(point => {
      // Create first diagonal line (\ direction)
      const geometry1 = new BufferGeometry().setFromPoints([
        new Vector3(point.x - size, point.y - size, point.z),
        new Vector3(point.x + size, point.y + size, point.z)
      ])
      const line1 = new Line(geometry1, material)

      // Create second diagonal line (/ direction)
      const geometry2 = new BufferGeometry().setFromPoints([
        new Vector3(point.x - size, point.y + size, point.z),
        new Vector3(point.x + size, point.y - size, point.z)
      ])
      const line2 = new Line(geometry2, material)

      group.add(line1)
      group.add(line2)
    })

    return group
  }

  static create_spheres_for_points (points: Vector3[], sphere_size = 0.005, color = 0x00ffff, name = ''): Points {
    const points_material: PointsMaterial = new PointsMaterial({ size: sphere_size, color, depthTest: false })
    const points_geometry = new BufferGeometry().setFromPoints(points)
    const point_objects: Points = new Points(points_geometry, points_material)
    point_objects.name = `Point display: ${name}`
    return point_objects
  }

  static create_test_plane_mesh (size: number = 0.08, color: number = 0x0000ff): Mesh {
    const plane_width = size
    const plane_height = size
    const plane_width_segments = 2
    const plane_height_segments = 2
    const plane_geometry = new PlaneGeometry(plane_width, plane_height, plane_width_segments, plane_height_segments)
    const plane_material: MeshBasicMaterial = Generators.create_material(false, color)
    const mesh_object = new Mesh(plane_geometry, plane_material)
    mesh_object.name = 'Plane Intersection Mesh'
    return mesh_object
  }

  static create_default_lights (): Array<DirectionalLight | AmbientLight> {
    const light_1 = new DirectionalLight(0x777777, 7)
    light_1.castShadow = true

    light_1.position.set(-2, 2, 2)
    const light_2 = new AmbientLight(0xffffff, 0.3)

    // backfill light
    const backfill_light = new DirectionalLight(0x777777, 3)
    backfill_light.castShadow = false // one shadow is enough
    backfill_light.position.set(2, 2, -2)

    const result = [light_1, light_2, backfill_light]
    return result
  }

  static create_camera (): PerspectiveCamera {
    const field_of_view = 15 // in millimeters. Lower makes the camera more isometric
    const camera = new PerspectiveCamera(field_of_view, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 10
    camera.position.y = 5
    camera.position.x = 5
    return camera
  }

  static create_equidistant_spheres_around_circle (sphere_count = 6, color = 0x00ff00, distance = 0.3) {
    const plane_points: Mesh[] = []
    const plane_point_geometry = new SphereGeometry(0.03, 12, 12)
    const plane_point_material: MeshBasicMaterial = Generators.create_material(true, color)

    for (let i = 0; i < sphere_count; i++) {
      // have the points go around the plane in an even circle increments
      const angle = (i / sphere_count) * (Math.PI * 2)
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance
      const z = 0
      const point_mesh: Mesh = new Mesh(plane_point_geometry, plane_point_material)
      point_mesh.position.set(x, y, z)
      plane_points.push(point_mesh)
    }

    return plane_points
  }

  static create_window_resize_listener (renderer: WebGLRenderer, camera: PerspectiveCamera): void {
    // there was a bit of horizontal and vertical scrollbars
    // I tried doing overflow: none, but that wasn't working for some reason
    const contraction_size = 2

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth-contraction_size, window.innerHeight-contraction_size)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix() // update camera
    })
  }

  static create_bone_plane_mesh (bone_start: Bone, bone_end: Bone, rays_to_cast: number): Mesh {
    // create plane mesh to do the ray casting
    // we also want to offset it it half the bone distance up the bone
    // for a better approximation with what counts
    const plane_mesh: Mesh = Generators.create_test_plane_mesh(0.02)

    plane_mesh.position.copy(Utility.world_position_from_object(bone_start))

    plane_mesh.lookAt(Utility.world_position_from_object(bone_end))
    plane_mesh.translateZ(Utility.distance_between_objects(bone_start, bone_end)*0.5)

    // create 4 reference points around the plane that will be used for raycasting
    const plane_point_geometry = new SphereGeometry(0.002, 3, 3)
    const plane_point_material: MeshBasicMaterial = Generators.create_material(true, 0x00ffff)

    for (let i = 0; i < rays_to_cast; i++) {
      // have the points go around the plane in an even circle increments
      const distance: number = 0.005 // set radial distance from origin close to help with close vertices
      const angle: number = (i/rays_to_cast) * (Math.PI*2)
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance
      const z = 0
      const point_mesh = new Mesh(plane_point_geometry, plane_point_material)
      point_mesh.name = 'Point mesh PLANE'

      point_mesh.position.set(x, y, z)
      plane_mesh.add(point_mesh)
    }

    return plane_mesh
  }
}
