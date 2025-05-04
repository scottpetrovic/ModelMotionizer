# TRC Animation Data (Track Row Column)
Commonly used in motion capture (MoCap) systems to store 3D positional data for markers over time. Each frame in a TRC file represents the positions of markers in 3D space, typically in millimeters. The data is organized in a tabular format, with rows representing frames and columns representing marker positions (X, Y, Z coordinates).

The format for thes files
- Header section:  metadata about the file. 
- Marker Names: A row listing the names of the markers (bones)
- Frame Data: Each row corresponds to a frame. Columns include the frame number, time, and the X, Y, Z coordinates for each marker 


## Potential issues with this format
This seems to mostly store positional data. This will create issues when bones are moved around or scaled. Animations will not retain the same bone lengths if we only have position data.

## Places to get this data
https://www.mocapclub.com/Pages/Library.htm
