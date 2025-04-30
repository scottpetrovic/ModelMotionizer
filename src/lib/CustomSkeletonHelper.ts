// Original code from
// https://github.com/mrdoob/three.js/blob/master/src/helpers/SkeletonHelper.js
// and ideas from
// https://discourse.threejs.org/t/extend-skeletonhelper-to-accommodate-fat-lines-perhaps-with-linesegments2/59436/2

import { Color, Matrix4, Vector2, Vector3, SphereGeometry, MeshBasicMaterial, Mesh } from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js'

const _vector = /*@__PURE__*/ new Vector3()
const _boneMatrix = /*@__PURE__*/ new Matrix4()
const _matrixWorldInv = /*@__PURE__*/ new Matrix4()

class CustomSkeletonHelper extends Line2 {
  private readonly joint_spheres: Mesh[] = []

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

    // add sphere geometry for joints
    const sphereGeometry = new SphereGeometry(0.01, 16, 16)
    const joint_color: Color = new Color(options.jointColor || 0x0000ff)
    const sphereMaterial = new MeshBasicMaterial({ color: joint_color, depthTest: false })

    for (let i = 0; i < bones.length; i++) {
      const sphere = new Mesh(sphereGeometry, sphereMaterial)
      this.add(sphere)
      this.joint_spheres.push(sphere)
    }
  }

  updateMatrixWorld (force: boolean): void {
    const bones = this.bones;

    const geometry = this.geometry
    const lineStart = geometry.getAttribute('instanceStart')
    const lineEnd = geometry.getAttribute('instanceEnd')

    _matrixWorldInv.copy(this.root.matrixWorld).invert()

    let lineIndex = 0
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
      _vector.setFromMatrixPosition(_boneMatrix)
      this.joint_spheres[i].position.copy(_vector)
    
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

    this.joint_spheres.forEach(sphere => {
      sphere.geometry.dispose()
      sphere.material.dispose()
    })
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
