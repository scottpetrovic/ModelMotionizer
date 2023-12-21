import { UI } from '../UI.ts'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// eslint-disable-next-line @typescript-eslint/naming-convention
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// import scene from three.js
import { type AnimationClip, Scene, type SkinnedMesh } from 'three'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepExportToFile extends EventTarget {
  private readonly ui: UI = new UI()
  private animation_clips_to_export: AnimationClip[] = []

  public set_animation_clips_to_export(all_animations_clips: AnimationClip[]): void {
    this.animation_clips_to_export = []
    const animation_checkboxes = this.ui.get_animated_selected_elements()
    animation_checkboxes.forEach((checkbox) => {
      if (checkbox.checked === true) {
        const animation_index = checkbox.getAttribute('value')
        const original_clip: AnimationClip = all_animations_clips[animation_index]
        const cloned_clip: AnimationClip = original_clip.clone()
        this.animation_clips_to_export.push(cloned_clip)
      }
    })
  }

  public export (skinned_meshes: SkinnedMesh[], filename = 'exported_model'): void {
    if (this.animation_clips_to_export.length === 0) {
      console.log('ERROR: No animation clips added to export')
      return
    }

    const export_scene = new Scene()

    skinned_meshes.forEach((final_skinned_mesh) => {
      export_scene.add(SkeletonUtils.clone(final_skinned_mesh))
    })

    this.export_glb(export_scene, this.animation_clips_to_export, filename)
  }

  public export_glb(exported_scene: Scene, animations_to_export: AnimationClip[], file_name: string): void {
    const gltf_exporter = new GLTFExporter()

    const export_options =
        {
          binary: true,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          onlyVisible: false,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          embedImages: true,
          animations: animations_to_export
        }

    gltf_exporter.parse(exported_scene, (result) => {
      if (result instanceof ArrayBuffer) {
        this.save_array_buffer(result, `${file_name}.glb`)
      } else {
        console.log('ERROR: result is not an instance of ArrayBuffer')
      }
    },
    (error) => {
      console.log('An error happened during parsing', error)
    },
    export_options
    )
  };

  private save_file(blob: Blob, filename: string): void {
    if (this.ui.dom_export_button_hidden_link != null) {
      this.ui.dom_export_button_hidden_link.href = URL.createObjectURL(blob)
      this.ui.dom_export_button_hidden_link.download = filename
      this.ui.dom_export_button_hidden_link.click()
    } else {
      console.log('ERROR: dom_export_button_hidden_link is null')
    }
  }

  // used for GLB to turn content into a byte array for saving
  private save_array_buffer(buffer: ArrayBuffer, filename: string): void {
    this.save_file(new Blob([buffer], { type: 'application/octet-stream' }), filename)
  }
}
