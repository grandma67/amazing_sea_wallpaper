import {
  Color,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer
} from 'three'

// Planar reflection of the land and everything on it (rocks, sea stacks,
// trees, boats, birds) in the sea surface. The scene is rendered once from a
// camera mirrored below sea level, with an oblique clip plane so nothing below
// the water leaks in, into a transparent target: the ocean shader blends it
// over the sky reflection wherever it has content. Same idea as three.js'
// Reflector, done once for a still.

export interface PlanarReflection {
  target: WebGLRenderTarget
  /** World position → reflection texture coordinates (projective). */
  textureMatrix: Matrix4
}

export function renderPlanarReflection(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  hide: Object3D[]
): PlanarReflection {
  const normal = new Vector3(0, 1, 0)
  const planePoint = new Vector3(0, 0, 0)

  // Mirror the camera position, view target and up vector in the plane.
  const rotation = new Matrix4().extractRotation(camera.matrixWorld)
  const eye = camera.position.clone()
  const position = planePoint.clone().sub(eye).reflect(normal).negate().add(planePoint)
  const lookAt = new Vector3(0, 0, -1).applyMatrix4(rotation).add(eye)
  const target = planePoint.clone().sub(lookAt).reflect(normal).negate().add(planePoint)
  const mirror = new PerspectiveCamera()
  mirror.position.copy(position)
  mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal)
  mirror.lookAt(target)
  mirror.near = camera.near
  mirror.far = camera.far
  mirror.updateMatrixWorld()
  mirror.projectionMatrix.copy(camera.projectionMatrix)
  mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse)

  const textureMatrix = new Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(mirror.projectionMatrix)
    .multiply(mirror.matrixWorldInverse)

  // Oblique near plane at sea level (Lengyel): clip everything underwater.
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, planePoint)
  plane.applyMatrix4(mirror.matrixWorldInverse)
  const clip = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
  const p = mirror.projectionMatrix.elements
  const q = new Vector4(
    (Math.sign(clip.x) + p[8]) / p[0],
    (Math.sign(clip.y) + p[9]) / p[5],
    -1,
    (1 + p[10]) / p[14]
  )
  clip.multiplyScalar(2 / clip.dot(q))
  p[2] = clip.x
  p[6] = clip.y
  p[10] = clip.z + 1 - 0.003
  p[14] = clip.w
  mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert()

  const renderTarget = new WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), {
    type: HalfFloatType,
    samples: 4,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter
  })

  const visibility = hide.map(o => o.visible)
  hide.forEach(o => (o.visible = false))
  const clearColor = renderer.getClearColor(new Color())
  const clearAlpha = renderer.getClearAlpha()
  renderer.setClearColor(0x000000, 0)
  renderer.setRenderTarget(renderTarget)
  renderer.clear()
  renderer.render(scene, mirror)
  renderer.setRenderTarget(null)
  renderer.setClearColor(clearColor, clearAlpha)
  hide.forEach((o, i) => (o.visible = visibility[i]))

  return { target: renderTarget, textureMatrix }
}
