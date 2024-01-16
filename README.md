# ModelMotionizer
Import a 3D Model and automatically assign and export animations. This is kind of similar to a web application like Mixamo, but I would like it to be more flexible in nature. 

Live Demo from my github page: https://www.scottpetrovic.com/model-motionizer/

![Screenshot](./readme.png)

## Usage
There are instructions built into the web application, but this is the general flow of how to use it:
1. Import a 3d model of your choosing (currently only supports GLB/GLTF format)
2. Pick what type of skeleton that the 3d model will use
3. Modify the skeleton to fit inside of the model (optionally test the results)
4. Test out various animations to see the results.
5. Select which animations you want to use, then export (currently only GLB/GLTF supported format)

## Building and running
    npm install
    node run dev


## Vision/TODO
These are some ideas and directions I would like to go with this for the future:
1. Better skinning algorithm to support more model types
2. Allow people to make 3d animations using the skeleton templates and and load them into the web application for use.
3. More import and export formats
4. Support for multi-mesh models for skinning


