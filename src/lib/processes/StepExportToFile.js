import { UI } from '../UI.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

// import scene from three.js
import { Scene } from 'three'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepExportToFile extends EventTarget
{
  ui = null
  animation_clips_to_export = []

  constructor() 
  {
    super()
    this.ui = new UI()
  }

  set_animation_clips_to_export(all_animations_clips)
  {
    this.animation_clips_to_export = []
    const animation_checkboxes =  this.ui.get_animated_selected_elements()
    animation_checkboxes.forEach((checkbox) => {
      if(checkbox.checked)
      {
        const animation_index = checkbox.getAttribute('value')
        let originalClip = all_animations_clips[animation_index]
        let clonedClip = originalClip.clone()
        this.animation_clips_to_export.push(clonedClip)
      }
    })
  }

  export(skinned_meshes, filename = 'exported_model')
  {
    if(this.animation_clips_to_export.length == 0)
    {
      console.log('ERROR: No animation clips added to export')
      return
    }

    const export_scene = new Scene()

    skinned_meshes.forEach((final_skinned_mesh) => {
      export_scene.add(SkeletonUtils.clone(final_skinned_mesh))
    })

    this.export_GLB(export_scene, this.animation_clips_to_export, filename)
  }

  export_GLB(exported_scene, animations_to_export, file_name)
  {
    const gltf_exporter = new GLTFExporter()

    let export_options = 
        {
          binary: true,
          onlyVisible: false,
          embedImages: true,
          animations: animations_to_export,
        }

    gltf_exporter.parse(exported_scene, (result) =>
    {
      if (result instanceof ArrayBuffer)
      {
        this._save_array_buffer(result, `${file_name}.glb`)
      }
      else
      {
        console.log('ERROR: result is not an instance of ArrayBuffer')
      }
    },
    (error) =>
    {
      console.log('An error happened during parsing', error)
    },
    export_options
    )
  };

  _save_file(blob, filename) 
  {
    this.ui.dom_export_button_hidden_link.href = URL.createObjectURL(blob)
    this.ui.dom_export_button_hidden_link.download = filename
    this.ui.dom_export_button_hidden_link.click()
  }

  // used for GLB to turn content into a byte array for saving
  _save_array_buffer(buffer, filename) {
    this._save_file(new Blob([buffer], { type: 'application/octet-stream' }), filename)
  }
}
