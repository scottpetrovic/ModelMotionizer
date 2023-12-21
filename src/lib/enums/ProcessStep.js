export const ProcessStep = {
  LoadModel: 'load-model',
  LoadSkeleton: 'load-skeleton',
  EditSkeleton: 'edit-skeleton',
  WeightSkin: 'weight-skin',
  AnimationsListing: 'animations-export',
  StepExportToFile: 'export-to-file'
}

export const step_data = [
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
    instructions: 'Upload your own skeleton, or choose from a pre-existing skeleton.',
  },
  {
    name: ProcessStep.EditSkeleton,
    index: 2,
    title: 'Edit Skeleton',
    description: 'Edit the skeleton',
    instructions: 'Edit the skeleton',
  },
  {
    name: ProcessStep.WeightSkin,
    index: 3,
    title: 'Weight Skin',
    description: 'Weight the skin',
    instructions: 'Weight the skin',
  },
  {
    name: ProcessStep.AnimationsListing,
    index: 4,
    title: 'Animations Listing',
    description: 'Load and edit animations',
    instructions: 'Load and edit animations',
  },
  {
    name: ProcessStep.StepExportToFile,
    index: 5,
    title: 'Export to File',
    description: 'Export to File',
    instructions: 'Export to File',
  }

]
