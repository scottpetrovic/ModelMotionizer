// Original code from
// https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
// and ideas from
// https://discourse.threejs.org/t/extend-skeletonhelper-to-accommodate-fat-lines-perhaps-with-linesegments2/59436/2

import { Color, Matrix4, Vector2, Vector3, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, TextureLoader } from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js'

const _vector = /*@__PURE__*/ new Vector3()
const _boneMatrix = /*@__PURE__*/ new Matrix4()
const _matrixWorldInv = /*@__PURE__*/ new Matrix4()

class CustomSkeletonHelper extends Line2 {
  private readonly joint_points: Points

  constructor (object: any, options = {}) {
    const bones = getBoneList(object)
    const geometry = new LineGeometry()

    const vertices = []
    const colors = []
    const color = new Color(options.color || 0x0000ff) // Default color blue

    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i]

      if (bone.parent && bone.parent.isBone) {
        vertices.push(0, 0, 0) // Start
        vertices.push(0, 0, 0) // End
        colors.push(color.r, color.g, color.b)
        colors.push(color.r, color.g, color.b)
      }
    }
    geometry.setPositions(vertices)
    geometry.setColors(colors)

    const material = new LineMaterial({
      linewidth: options.linewidth || 0.005,
      worldUnits: false,
      vertexColors: true,
      dashed: options.dashed || false,
      alphaToCoverage: true,
      resolution: new Vector2(window.innerWidth, window.innerHeight),
      depthTest: false
    })

    super(geometry, material)

    this.isSkeletonHelper = true
    this.type = 'CustomSkeletonHelper'

    this.root = object
    this.bones = bones

    this.matrix = object.matrixWorld
    this.matrixAutoUpdate = false

    // Add points for joints
    const pointsGeometry = new BufferGeometry()
    const pointsMaterial = new PointsMaterial({
      size: 14, // Size of the joint circles on skeleton
      color: options.jointColor || 0xffffff,
      depthTest: false,
      sizeAttenuation: false, // Disable size attenuation to keep size constant in screen space
      map: new TextureLoader().load('images/skeleton-joint-point.png'), // Use a circular texture
      transparent: true // Enable transparency for the circular texture
    })

    const pointPositions = new Float32BufferAttribute(bones.length * 3, 3)
    pointsGeometry.setAttribute('position', pointPositions)

    this.joint_points = new Points(pointsGeometry, pointsMaterial)
    this.add(this.joint_points)
  }

  updateMatrixWorld (force: boolean): void {
    const bones = this.bones
    const pointPositions = this.joint_points.geometry.getAttribute('position')

    const geometry = this.geometry
    const lineStart = geometry.getAttribute('instanceStart')
    const lineEnd = geometry.getAttribute('instanceEnd')

    _matrixWorldInv.copy(this.root.matrixWorld).invert()

    let lineIndex = 0
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i]
      _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
      _vector.setFromMatrixPosition(_boneMatrix)
      pointPositions.setXYZ(i, _vector.x, _vector.y, _vector.z) // Update point position

      if (bone.parent && bone.parent.isBone) {
        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.parent.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        lineStart.setXYZ(lineIndex, _vector.x, _vector.y, _vector.z)

        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        lineEnd.setXYZ(lineIndex, _vector.x, _vector.y, _vector.z)
        lineIndex++
      }
    }

    pointPositions.needsUpdate = true
    geometry.getAttribute('instanceStart').needsUpdate = true
    geometry.getAttribute('instanceEnd').needsUpdate = true

    // Update bounding box and bounding sphere
    // otherwise the skeleton will be hidden when root bone on ground is off camera
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    super.updateMatrixWorld(force)
  }

  dispose (): void {
    this.geometry.dispose()
    this.material.dispose()
    this.joint_points.geometry.dispose()
    this.joint_points.material.dispose()
  }
}

function getBoneList (object: any): any[] {
  const boneList: any[] = []

  if (object.isBone === true) {
    boneList.push(object)
  }

  for (let i = 0; i < object.children.length; i++) {
    boneList.push.apply(boneList, getBoneList(object.children[i]))
  }

  return boneList
}

export { CustomSkeletonHelper }
