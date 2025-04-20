// Original code from
// https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
// and ideas from
// https://discourse.threejs.org/t/extend-skeletonhelper-to-accommodate-fat-lines-perhaps-with-linesegments2/59436/2

import { Color, Matrix4, Vector2, Vector3 } from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js'

const _vector = /*@__PURE__*/ new Vector3()
const _boneMatrix = /*@__PURE__*/ new Matrix4()
const _matrixWorldInv = /*@__PURE__*/ new Matrix4()

class CustomSkeletonHelper extends Line2 {
  constructor (object: any, options = {}) {
    const bones = getBoneList(object)
    // const geometry = new BufferGeometry();
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

    // geometry.setAttribute(
    //     'instanceStart', new Float32BufferAttribute(lineStart, 3));
    // geometry.setAttribute(
    //     'instanceEnd', new Float32BufferAttribute(lineStop, 3));
    geometry.setPositions(vertices)
    geometry.setColors(colors)

    const material = new LineMaterial({
      linewidth: options.linewidth || 0.005,
      worldUnits: true,
      vertexColors: true,
      dashed: options.dashed || false, // this doesn't seem to do anything
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

    window.addEventListener('resize', () => {this.updateResolution()})
  }

  // Method to dynamically update the line width
  setLineWidth(newWidth: number): void {
    this.material.linewidth = newWidth
    this.material.needsUpdate = true // Trigger material update
  }

  // Method to dynamically update dashed property
  setDashed(isDashed: boolean): void {
    this.material.dashed = isDashed
    this.material.needsUpdate = true // Trigger material update
  }

  updateResolution (): void {
    this.material.resolution.set(window.innerWidth, window.innerHeight);
    console.log('Resolution updated:', this.material.resolution);
  }

  updateMatrixWorld (force: boolean): void {
    const bones = this.bones;

    const geometry = this.geometry
    const lineStart = geometry.getAttribute('instanceStart')
    const lineEnd = geometry.getAttribute('instanceEnd')

    _matrixWorldInv.copy(this.root.matrixWorld).invert()

    for (const [index, bone] of bones.entries()) {
      if (bone.parent && bone.parent.isBone) {
        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        lineStart.setXYZ(index, _vector.x, _vector.y, _vector.z)

        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.parent.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        lineEnd.setXYZ(index, _vector.x, _vector.y, _vector.z)
      }
    }

    geometry.getAttribute('instanceStart').needsUpdate = true
    geometry.getAttribute('instanceEnd').needsUpdate = true
    super.updateMatrixWorld(force)
  }

  dispose (): void {
    this.geometry.dispose()
    this.material.dispose()
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
