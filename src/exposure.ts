import {
  CubeCamera,
  FloatType,
  PerspectiveCamera,
  Vector3,
  WebGLCubeRenderTarget,
  type Scene,
  type WebGLRenderer
} from 'three'

// Automatic exposure, like a camera's evaluative meter: render the sky into a
// small floating-point cube map, then average the luminance of the directions
// the real camera sees. Sea pixels are approximated as a dim reflection of the
// sky, which is roughly how they render.

const SIZE = 32
const SEA_REFLECTANCE = 0.12

export function meterScene(
  renderer: WebGLRenderer,
  skyScene: Scene,
  camera: PerspectiveCamera,
  horizonDip: number
): number {
  const target = new WebGLCubeRenderTarget(SIZE, { type: FloatType })
  const cubeCamera = new CubeCamera(0.1, 400_000, target)
  cubeCamera.position.copy(camera.position)
  cubeCamera.updateMatrixWorld()
  cubeCamera.update(renderer, skyScene)

  const pixels = new Float32Array(SIZE * SIZE * 4)
  const direction = new Vector3()
  const projected = new Vector3()
  const horizonY = -Math.sin(horizonDip)

  let skySum = 0
  let skyWeight = 0
  let upperSum = 0
  let upperWeight = 0
  let seaWeight = 0

  const faces = cubeCamera.children as PerspectiveCamera[]
  for (let face = 0; face < 6; face++) {
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels, face)
    const faceCamera = faces[face]
    faceCamera.updateMatrixWorld()
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = ((x + 0.5) / SIZE) * 2 - 1
        const v = ((y + 0.5) / SIZE) * 2 - 1
        // Solid angle of a cube-map texel.
        const weight = 1 / (1 + u * u + v * v) ** 1.5

        direction
          .set(u, v, 0.5)
          .unproject(faceCamera)
          .sub(faceCamera.position)
          .normalize()

        const i = (y * SIZE + x) * 4
        const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
        if (!Number.isFinite(lum)) continue

        if (direction.y > 0) {
          upperSum += lum * weight
          upperWeight += weight
        }

        projected.copy(camera.position).add(direction).project(camera)
        const inView =
          projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
        if (!inView) continue
        if (direction.y > horizonY) {
          skySum += lum * weight
          skyWeight += weight
        } else {
          seaWeight += weight
        }
      }
    }
  }
  target.dispose()

  const upperAverage = upperWeight > 0 ? upperSum / upperWeight : 0
  const total = skySum + seaWeight * upperAverage * SEA_REFLECTANCE
  const weight = skyWeight + seaWeight
  return weight > 0 ? total / weight : upperAverage
}
