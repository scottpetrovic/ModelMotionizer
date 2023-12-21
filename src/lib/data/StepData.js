// helps populate information about the current step along with instructions
export const STEPDATA = [
  {
    name: ProcessStep.LoadModel,
    index: 0,
    title: 'Load Model',
    description: 'Load a model to edit',
    instructions: 'Upload your own model, or choose from a pre-existing model.',
  },
  {
    name: ProcessStep.LoadSkeleton,
    index: 1,
    title: 'Load Skeleton',
    description: 'Load a skeleton to edit',
    instructions: 'Choose what type of skeleton to use.',
  },
  {
    name: ProcessStep.EditSkeleton,
    index: 2,
    title: 'Edit Skeleton',
    description: 'Edit the skeleton',
    instructions: 'Right click by a bone and translate or rotate it. Try to fit the bones evenly inside the mesh.',
  },
  {
    name: ProcessStep.WeightSkin,
    index: 3,
    title: 'Weight Skin',
    description: 'Weight the skin',
    instructions: 'See the bounding boxes that were created from bones. Red circles mean that there are no boxes that contain the vertex. They will use a shortest distance formular for this calculation',
  },
  {
    name: ProcessStep.AnimationsListing,
    index: 4,
    title: 'Animations Listing',
    description: 'Test out animations',
    instructions: 'Play animations and see if the results are good. If not, go back to the edit skeleton step and make modifications to get better results. After you are happy with the animations, select which animations you want to include with the final export.',
  },
  {
    name: ProcessStep.StepExportToFile,
    index: 5,
    title: 'Export to GLB',
    description: 'Export to File',
    instructions: 'GLB is the only available file export format. ',
  }
]
