import { PerspectiveCamera } from 'three'

import { EARTH_RADIUS, type SceneParams } from './params'
import { terrainHeight } from './terrain'

const DEG = Math.PI / 180

export interface SceneCamera {
  camera: PerspectiveCamera
  /** Angle of the true horizon below level (radians). */
  dip: number
}

/** The scene camera: lens from the focal length, standing on the ground, with
 * pitch solved so the (dipped) horizon lands at the chosen height. */
export function createCamera(params: SceneParams, width: number, height: number): SceneCamera {
  const aspect = width / height
  // The lens's 36 mm side lies along the image's long side.
  const longHalf = Math.atan(18 / params.camera.focalLengthMm)
  const vfov = aspect >= 1 ? 2 * Math.atan(Math.tan(longHalf) / aspect) : 2 * longHalf
  const camera = new PerspectiveCamera(vfov / DEG, aspect, 0.5, 400_000)
  const ground = params.coast.type === 'beach' ? Math.max(terrainHeight(params.coast, 0, 0), 0) : 0
  const h = ground + params.camera.heightM
  camera.position.set(0, h, 0)
  const dip = Math.acos(EARTH_RADIUS / (EARTH_RADIUS + h))
  const ndcY = 1 - 2 * params.camera.horizonFraction
  const pitch = -dip - Math.atan(ndcY * Math.tan(vfov / 2))
  camera.rotation.order = 'YXZ'
  camera.rotation.set(pitch, -params.camera.headingDeg * DEG, params.camera.rollDeg * DEG)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return { camera, dip }
}
