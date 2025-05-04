# C3d format (Coordinate 3D)
C3D is a binary file format commonly used in biomechanics and motion analysis.

# Converting C3D motion capture data to GLTF
I am not sure how useful this will be because of the way the C3D format works. This mostly stores position data which will create issues when we want to have larger and smaller characters. This position data doesn't know about how long our bones/joints will be and will stretch bones as animations are played.

