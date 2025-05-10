# make sure to install: pip install bvhio pygltf numpy
import bvhio
import pygltflib
import numpy as np
import os
import json

def bvh_to_gltf(bvh_file_path, gltf_file_path):
    # Load BVH file
    bvh_scene = bvhio.readAsHierarchy(bvh_file_path)

    # Create a GLTF object
    gltf = pygltflib.GLTF2()

    # Create a scene
    scene = pygltflib.Scene()
    gltf.scenes.append(scene)

    # Get the root joint
    root_joint = bvh_scene

    # Create a node for the root joint
    node = pygltflib.Node()
    node.name = root_joint.Name
    scene.nodes.append(0)
    gltf.nodes.append(node)

    # Create animations
    animation = pygltflib.Animation()
    gltf.animations.append(animation)

    # Get joint positions for each frame
    positions = [root_joint.PositionWorld for frame in bvh_scene.Keyframes]

    # Create input (time) buffer view
    input_data = np.array(range(len(bvh_scene.Keyframes)), dtype=np.float32) / len(bvh_scene.Keyframes)
    input_accessor = pygltflib.Accessor()
    input_accessor.component_type = pygltflib.FLOAT
    input_accessor.count = len(bvh_scene.Keyframes)
    input_accessor.type = pygltflib.SCALAR
    input_buffer_view = pygltflib.BufferView()
    input_buffer_view.buffer = 0
    input_buffer_view.byteOffset = 0
    input_buffer_view.byteLength = input_data.nbytes
    gltf.bufferViews.append(input_buffer_view)
    gltf.accessors.append(input_accessor)
    input_accessor.bufferView = len(gltf.bufferViews) - 1

    # Create output (translation) buffer view
    output_data = np.array(positions, dtype=np.float32)
    output_accessor = pygltflib.Accessor()
    output_accessor.component_type = pygltflib.FLOAT
    output_accessor.count = len(bvh_scene.Keyframes)
    output_accessor.type = pygltflib.VEC3
    output_buffer_view = pygltflib.BufferView()
    output_buffer_view.buffer = 1
    output_buffer_view.byteOffset = 0
    output_buffer_view.byteLength = output_data.nbytes
    gltf.bufferViews.append(output_buffer_view)
    gltf.accessors.append(output_accessor)
    output_accessor.bufferView = len(gltf.bufferViews) - 1

    # Create samplers
    sampler = pygltflib.AnimationSampler()
    animation.samplers.append(sampler)
    sampler.input = 0
    sampler.output = 1

    # Create buffers
    gltf.buffers.append(pygltflib.Buffer(byteLength=input_data.nbytes))
    gltf.buffers.append(pygltflib.Buffer(byteLength=output_data.nbytes))

    # Save buffers to binary file
    with open(gltf_file_path.replace('.gltf', '.bin'), 'wb') as f:
        f.write(input_data.tobytes())
        f.write(output_data.tobytes())

    # Set buffer URIs
    gltf.buffers[0].uri = os.path.basename(gltf_file_path).replace('.gltf', '.bin')
    gltf.buffers[1].uri = os.path.basename(gltf_file_path).replace('.gltf', '.bin')

    # Save GLTF file
    with open(gltf_file_path, 'w') as f:
        gltf_data = gltf.to_dict()


        # Cleanup the glTF data to be valid
        if 'extensionsUsed' in gltf_data and not gltf_data['extensionsUsed']:
            del gltf_data['extensionsUsed']

        if 'extensionsRequired' in gltf_data and not gltf_data['extensionsRequired']:
            del gltf_data['extensionsRequired']

        # glTF validator requires these to be empty strings...without this it is set to null and fails validation
        gltf_data['asset']['copyright'] = ""
        gltf_data['asset']['generator'] = ""

        # write final json data to file
        json.dump(gltf_data, f, indent=4)

# Get the current script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Usage
bvh_file_path = os.path.join(script_dir, 'input.bvh')
gltf_file_path = os.path.join(script_dir + '\\output', 'output.gltf')
bvh_to_gltf(bvh_file_path, gltf_file_path)