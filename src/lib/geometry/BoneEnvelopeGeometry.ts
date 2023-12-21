import { BufferGeometry } from 'three/src/core/BufferGeometry.js'
import { BufferAttribute } from 'three/src/core/BufferAttribute.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

class BoneEnvelopeGeometry {
  constructor ()
  {
    let geometry = new BufferGeometry()
    geometry.type = 'BoneEnvelopeGeometry'

    // points for a 0.01x0.01x0.01 cube
    const box_vertice_data = new Float32Array([
      0.01, 0.01, 0.01, -0.01, 0.01, 0.01, -0.01, -0.01, 0.01, 0.01, 0.01, 0.01, -0.01, -0.01, 0.01, 0.01, -0.01, 0.01, 0.01, -0.01, -0.01, 0.01, -0.01, 0.01, -0.01, -0.01, 0.01, 0.01, -0.01, -0.01, -0.01, -0.01, 0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, 0.01, -0.01, 0.01, 0.01, -0.01, -0.01, -0.01, -0.01, 0.01, 0.01, -0.01, 0.01, -0.01, -0.01, 0.01, -0.01, 0.01, 0.01, -0.01, 0.01, -0.01, -0.01, -0.01, 0.01, -0.01, 0.01, -0.01, -0.01, -0.01, -0.01, -0.01, 0.01, 0.01, -0.01, 0.01, 0.01, 0.01, 0.01, -0.01, 0.01, 0.01, 0.01, -0.01, 0.01, -0.01, 0.01, 0.01, -0.01, -0.01, -0.01, 0.01, -0.01, -0.01, 0.01, 0.01, 0.01, 0.01, 0.01, -0.01, 0.01, -0.01, 0.01, 0.01, 0.01, 0.01, 0.01, -0.01
    ])
    geometry.setAttribute('position', new BufferAttribute(box_vertice_data, 3))
    geometry.getAttribute('position').needsUpdate = true

    // create indexed vertex positions for easier manipulation later
    geometry = BufferGeometryUtils.mergeVertices(geometry)
    geometry.computeVertexNormals() // required after setting new position attributes

    return geometry
  }
}

export { BoneEnvelopeGeometry }
