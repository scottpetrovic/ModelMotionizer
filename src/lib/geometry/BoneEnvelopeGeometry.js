import { BufferGeometry } from 'three/src/core/BufferGeometry.js'
import { BufferAttribute } from 'three/src/core/BufferAttribute.js'

// eslint-disable-next-line @typescript-eslint/naming-convention
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

class BoneEnvelopeGeometryUtils
{
  static expand_x_positive_face(geometry, x)
  {
    this.move_x_pos_top_left(geometry, x, 0, 0)
    this.move_x_pos_top_right(geometry, x, 0, 0)
    this.move_x_pos_bottom_left(geometry, x, 0, 0)
    this.move_x_pos_bottom_right(geometry, x, 0, 0)
  }

  static expand_x_negative_face(geometry, x)
  {
    this.move_x_neg_top_left(geometry, -x, 0, 0)
    this.move_x_neg_top_right(geometry, -x, 0, 0)
    this.move_x_neg_bottom_left(geometry, -x, 0, 0)
    this.move_x_neg_bottom_right(geometry, -x, 0, 0)
  }

  static expand_z_negative_face(geometry, z)
  {
    this.move_x_pos_top_right(geometry, 0, 0, -z)
    this.move_x_pos_bottom_right(geometry, 0, 0, -z)
    this.move_x_neg_bottom_left(geometry, 0, 0, -z)
    this.move_x_neg_top_right(geometry, 0, 0, -z)
  }

  static expand_z_positive_face(geometry, z)
  {
    this.move_x_pos_top_left(geometry, 0, 0, z)
    this.move_x_pos_bottom_left(geometry, 0, 0, z)
    this.move_x_neg_bottom_right(geometry, 0, 0, z)
    this.move_x_neg_top_left(geometry, 0, 0, z)
  }

  static expand_y_positive_face(geometry, y)
  {
    this.move_x_pos_top_left(geometry, 0, y, 0)
    this.move_x_neg_top_left(geometry, 0, y, 0)
    this.move_x_pos_top_right(geometry, 0, y, 0)
    this.move_x_neg_top_right(geometry, 0, y, 0)
  }

  static expand_y_negative_face(geometry, y)
  {
    this.move_x_pos_bottom_left(geometry, 0, -y, 0)
    this.move_x_neg_bottom_left(geometry, 0, -y, 0)
    this.move_x_pos_bottom_right(geometry, 0, -y, 0)
    this.move_x_neg_bottom_right(geometry, 0, -y, 0)
  }

  static move_x_neg_top_left(geometry, x, y, z)
  {
    // X-Negative Top Right indexed vertex
    geometry.attributes.position.array[3] += x
    geometry.attributes.position.array[4] += y
    geometry.attributes.position.array[5] += z
  }

  static move_x_neg_bottom_right(geometry, x, y, z)
  {
    // X-Negative Bottom Right indexed vertex
    geometry.attributes.position.array[6] += x
    geometry.attributes.position.array[7] += y
    geometry.attributes.position.array[8] += z
  }

  static move_x_neg_bottom_left(geometry, x, y, z)
  {
    // X-Negative Bottom Left indexed vertex
    geometry.attributes.position.array[15] += x
    geometry.attributes.position.array[16] += y
    geometry.attributes.position.array[17] += z
  }

  static move_x_neg_top_right(geometry, x, y, z)
  {
    // X-Negative Top Left indexed vertex
    geometry.attributes.position.array[18] += x
    geometry.attributes.position.array[19] += y
    geometry.attributes.position.array[20] += z
  }

  static move_x_pos_top_left(geometry, x, y, z)
  {
    // X-Positive Top Left indexed vertex
    geometry.attributes.position.array[0] += x
    geometry.attributes.position.array[1] += y
    geometry.attributes.position.array[2] += z
  }

  static move_x_pos_bottom_left(geometry, x, y, z)
  {
    // X-Positive Bottom Left indexed vertex
    geometry.attributes.position.array[9] += x
    geometry.attributes.position.array[10] += y
    geometry.attributes.position.array[11] += z
  }

  static move_x_pos_bottom_right(geometry, x, y, z)
  {
    // X-Positive Bottom Right indexed vertex
    geometry.attributes.position.array[12] += x
    geometry.attributes.position.array[13] += y
    geometry.attributes.position.array[14] += z
  }

  static move_x_pos_top_right(geometry, x, y, z)
  {
    // X-Positive Top Right indexed vertex
    geometry.attributes.position.array[21] += x
    geometry.attributes.position.array[22] += y
    geometry.attributes.position.array[23] += z
  }
}

export { BoneEnvelopeGeometry, BoneEnvelopeGeometryUtils }