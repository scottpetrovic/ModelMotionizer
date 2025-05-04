import c3d # need to install c3d package with command: pip install c3d
import os
import json


# Construct the relative path to the .c3d file
current_dir = os.path.dirname(__file__)  # Directory of the current Python script
filepath = os.path.join(current_dir, "source", "ActorE_TPose.c3d")

def extract_c3d_data(filepath):
    animation_data = []
    with open(filepath, 'rb') as f:
        reader = c3d.Reader(f)
        print("Extracting animation data...")
        
        # Iterate through frames and collect marker positions
        for frame_idx, frame_data in enumerate(reader.read_frames()):
            # Unpack the frame data
            frame_number, points, _ = frame_data  # Unpack the tuple
            
            # Convert marker positions to a list
            markers = points[:, :3].tolist()  # Extract only the x, y, z coordinates
            
            frame = {
                "frame": frame_number,
                "markers": markers
            }
            animation_data.append(frame)
    
    return animation_data

def export_to_gltf(animation_data, output_path):
    # Create a basic GLTF structure
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "Custom C3D to GLTF Converter"
        },
        "scenes": [
            {
                "nodes": [0]
            }
        ],
        "nodes": [
            {
                "name": "RootNode",
                "translation": [0, 0, 0],
                "children": []
            }
        ],
        "animations": []
    }

    # Add animation data (simplified example)
    for frame in animation_data:
        gltf["animations"].append({
            "frame": frame["frame"],
            "markers": frame["markers"]
        })

    # Write the GLTF file
    with open(output_path, 'w') as f:
        json.dump(gltf, f, indent=2)
    print(f"GLTF file exported to {output_path}")

# Main execution
animation_data = extract_c3d_data(filepath)
output_gltf_path = os.path.join(current_dir, "converted", "ActorE_TPose.gltf")
os.makedirs(os.path.dirname(output_gltf_path), exist_ok=True)
export_to_gltf(animation_data, output_gltf_path)