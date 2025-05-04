import c3d  # Install with: pip install c3d
import os
import struct

# place file you wan to analyze in the source folder
file_name = "ActorE_TPose.c3d"


# You shouldn't have to be changing anything below this line
# Construct the relative path to the .c3d file
current_dir = os.path.dirname(__file__)  # Directory of the current Python script
filepath = os.path.join(current_dir, "source", file_name)

def analyze_c3d_file(filepath):
    with open(filepath, 'rb') as f:
        reader = c3d.Reader(f)
        
        # Print header information
        print("C3D File Analysis:")
        print("===================")
        print(f"Frame Rate: {reader.header.frame_rate}")
        print(f"Number of Frames: {reader.header.last_frame - reader.header.first_frame + 1}")
        print(f"Number of Markers: {reader.header.point_count}")
        
        # Extract and print marker names
        marker_names = reader.point_labels
        print("\nMarker Names:")
        for i, name in enumerate(marker_names):
            print(f"  {i + 1}: {name}")
        
        # Analyze the first frame to display marker positions
        print("\nFirst Frame Marker Positions (x, y, z):")
        for frame_idx, frame_data in enumerate(reader.read_frames()):
            _, points, _ = frame_data  # Unpack the frame data
            for i, point in enumerate(points):
                print(f"  Marker {i + 1} ({marker_names[i]}): {point[:3]}")
            break  # Only analyze the first frame


        print(f"Number of Analog Channels: {reader.header.analog_count}")
        analog_sample_rate = reader.header.frame_rate * reader.header.analog_per_frame
        print(f"Analog Sample Rate: {analog_sample_rate}")


        print("\nC3D Parameters:")
        for group_name, group in reader._groups.items():
            print(f"Group: {group_name}")
            for param_name, param in group._params.items():
                try:
                    # Attempt to decode bytes as UTF-8
                    value = param.bytes.decode('utf-8') if param.bytes else param.value
                except UnicodeDecodeError:
                    # Fallback to displaying raw bytes if decoding fails
                    value = param.bytes if param.bytes else param.value

                    # this struct unpacking doesn't seem to be right
                    # the numbers it is giving in my examples are extremely small like
                    # 6.905598832192699e-4
                    #value = struct.unpack('f', value)[0]
                print(f"  {param_name}: {value}")



        if reader.header.event_count > 0:
            print("\nEvent Markers:")
        for event in reader.header.events:
            print(f"  Event: {event.label}, Time: {event.time}, Context: {event.context}")
        else:
            print("\nNo Event Markers Found.")

        print("\nSuccessfully analyzed the C3D file.")

# Main execution
if __name__ == "__main__":
    if os.path.exists(filepath):
        analyze_c3d_file(filepath)
    else:
        print(f"Error: File not found at {filepath}")