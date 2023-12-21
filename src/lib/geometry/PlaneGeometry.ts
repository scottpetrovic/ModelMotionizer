import { BufferAttribute, BufferGeometry } from 'three'

export function create_plane_geometry (): BufferGeometry {
  const geometry = new BufferGeometry()
  const plane_vertice_data = new Float32Array([
    -1.0, -1.0, 1.0, // v0
    1.0, -1.0, 1.0, // v1
    1.0, 1.0, 1.0, // v2
    1.0, 1.0, 1.0, // v3
    -1.0, 1.0, 1.0, // v4
    -1.0, -1.0, 1.0 // v5
  ])

  geometry.setAttribute('position', new BufferAttribute(plane_vertice_data, 3))
  return geometry
}
