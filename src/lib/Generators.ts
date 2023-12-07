import { PerspectiveCamera, MeshStandardMaterial, DoubleSide, DirectionalLight, GridHelper, 
    Bone, Skeleton, DirectionalLightHelper, AmbientLight, PlaneGeometry, Mesh, 
    SphereGeometry, SkeletonHelper, MeshBasicMaterial, MeshPhongMaterial, AxesHelper,
    Vector3,  PointsMaterial, BufferGeometry, Points } from 'three';

import { Utility } from './Utilities';


export class Generators 
{ 
    static create_material( wireframeValue = true, colorHex = 0x00ff00): MeshPhongMaterial
    {
        const material = new MeshPhongMaterial({ color: colorHex, wireframe: wireframeValue });
        material.side = DoubleSide;
        return material; 
    }
    
    static create_grid_helper(color = 0x111155): any[]
    {
        // create floor mesh and add to scene to help with shadows
        const floor_geometry = new PlaneGeometry(100, 100, 10, 10);
        const floor_material = Generators.create_material(false, 0x4e4e7a);
        const floor_mesh = new Mesh(floor_geometry, floor_material);
        floor_mesh.name = 'Floor Mesh';
        floor_mesh.rotation.x = -Math.PI / 2;
        floor_mesh.position.y = -.01;
        floor_mesh.receiveShadow = true;

        // xyz axes helper display
        const axesHelper = new AxesHelper(0.15);
        axesHelper.name = 'Axes Helper';
        axesHelper.position.copy(new Vector3(0, 0.002, 0)); // offset a bit to avoid z-fighting

        // grid display on floor
        const size: number = 10;
        const divisions: number = 10;   
        const gridHelper: GridHelper = new GridHelper(size, divisions, color, color);
        
        
        return [gridHelper, floor_mesh, axesHelper];
    }
    
    static create_bone_hierarchy()
    {
        // offset root bone down to move entire bone structure
        const bone0 = new Bone();
        bone0.name = 'rootBone';
    
        const bone1 = new Bone();
        bone1.name = 'childBone';
    
        const bone2 = new Bone();
        bone2.name = 'grandchildBone';
    
        const bone3 = new Bone();
        bone3.name = 'greatGrandchildBone';
    
        bone0.add(bone1);
        bone1.add(bone2);
        bone2.add(bone3);
    
        // this is the local position...relative to the parent
        // @ts-ignore 
        bone0.position.y = -0.8;  
        
        // @ts-ignore 
        bone1.position.y = 0.5;
    
        // @ts-ignore 
        bone2.position.y = 0.5;
        // bone2.position.x = 0.5; // temporarily to test cylinder
    
        // @ts-ignore 
        bone3.position.y = 0.5; 
    
        return bone0;
    }
    
    static create_skeleton(bone_hierarchy): Skeleton
    {
        const bone_list = Utility.bone_list_from_hierarchy(bone_hierarchy);
        const skeleton = new Skeleton(bone_list);
        return skeleton;
    }
    
    static create_skeleton_helper(skeleton): SkeletonHelper
    {
        const skeletonHelper = new SkeletonHelper(skeleton.bones[0]);
        return skeletonHelper;
    }
    
    static create_spheres_for_points(points, sphere_size = 0.01, color = 0x00ffff, name = '' ): Points
    {
        let points_material = new PointsMaterial({ size: sphere_size, color: color }); 
        const points_geometry = new BufferGeometry().setFromPoints(points);
        const point_objects: Points = new Points(points_geometry, points_material);
        point_objects.name = `Point display: ${name} `;
   
        return point_objects;
    }
    
    static create_test_plane_mesh(size: number = 0.08, color: number = 0x0000ff): Mesh
    {
        const plane_width = size;
        const plane_height = size;
        const plane_width_segments = 2;
        const plane_height_segments = 2;
        const plane_geometry = new PlaneGeometry( plane_width, plane_height, plane_width_segments, plane_height_segments );
        const plane_material: MeshBasicMaterial = Generators.create_material(false, color);
        const mesh_object = new Mesh(plane_geometry, plane_material);
        mesh_object.name = 'Plane Intersection Mesh'
        return mesh_object
    }
    
    static create_default_lights()
    {
        const light_1 = new DirectionalLight(0x777777, 7);
        light_1.castShadow = true;
    
        // @ts-ignore
        light_1.position.set(-2, 2, 2);
    
        //const light_1_helper = new DirectionalLightHelper(light_1, 1, 0x333333);
        const light_2 = new AmbientLight(0xffffff, 0.3);
    
        // backfill light
        const backfill_light = new DirectionalLight(0x777777, 3);
        backfill_light.castShadow = false; // one shadow is enough 
    
        // @ts-ignore
        backfill_light.position.set(2, 2, -2);
      
        return [light_1, light_2, backfill_light]
    }
    
    static create_camera()
    {
        const fieldOfView = 10; // in millimeters. Lower makes the camera more isometric
        const camera = new PerspectiveCamera(fieldOfView, window.innerWidth / window.innerHeight, 0.1, 1000);
    
        // @ts-ignore
        camera.position.z = 10;
    
        // @ts-ignore
        camera.position.y = 10;
    
        // @ts-ignore
        camera.position.x = 10; 
    
        return camera;
    }
    
    static create_equidistant_spheres_around_circle(sphere_count = 6, color = 0x00ff00, distance = 0.3)
    {
        const plane_points: Array<Mesh> = [];
        const plane_point_geometry = new SphereGeometry(0.03, 12, 12)
        const plane_point_material: MeshBasicMaterial = Generators.create_material(true, color);
        for (let i = 0; i < sphere_count; i++)
        {
            // have the points go around the plane in an even circle increments
            const angle = (i/sphere_count) * (Math.PI*2)
            const x = Math.cos(angle) * distance
            const y = Math.sin(angle) * distance
            const z = 0
            const point_mesh: Mesh = new Mesh(plane_point_geometry, plane_point_material)
    
            // @ts-ignore
            point_mesh.position.set(x, y, z)
    
    
            plane_points.push(point_mesh)
        }
    
        return plane_points
    }
    
    static create_window_resize_listener(renderer, camera): void
    {
        // there was a bit of horizontal and vertical scrollbars 
        // I tried doing overflow: none, but that wasn't working for some reason
        const contraction_size = 2; 
    
        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth-contraction_size, window.innerHeight-contraction_size);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix(); // update camera
        })
    }
    
    static create_bone_plane_mesh(bone_start, bone_end, rays_to_cast): Mesh
    {
      // create plane mesh to do the ray casting
      // we also want to offset it it half the bone distance up the bone 
      // for a better approximation with what counts
      const plane_mesh: Mesh = Generators.create_test_plane_mesh(0.02)
    
      // @ts-ignore
      plane_mesh.position.copy(Utility.world_position_from_object(bone_start))
    
      plane_mesh.lookAt(Utility.world_position_from_object(bone_end))
      plane_mesh.translateZ(Utility.distance_between_objects(bone_start, bone_end)*0.5)
    
      // create 4 reference points around the plane that will be used for raycasting
      const plane_point_geometry = new SphereGeometry(0.002, 3, 3)
      const plane_point_material: MeshBasicMaterial = Generators.create_material(true, 0x00ffff);
     
      for (let i = 0; i < rays_to_cast; i++)
      {
        // have the points go around the plane in an even circle increments
        const distance: number = 0.005; // set radial distance from origin close to help with close vertices
        const angle: number = (i/rays_to_cast) * (Math.PI*2)
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const z = 0
        const point_mesh = new Mesh(plane_point_geometry, plane_point_material)
        point_mesh.name = 'Point mesh PLANE';
    
        // @ts-ignore
        point_mesh.position.set(x, y, z)
        plane_mesh.add(point_mesh)
      }
    
      return plane_mesh
    
    }

}


