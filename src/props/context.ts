import { Frustum, Matrix4, Vector3, type PerspectiveCamera } from 'three'

import type { SceneParams } from '../params'
import { Random } from '../random'
import { terrainHeight } from '../terrain'

/** Shared inputs for placing props deterministically in view. */
export class PropContext {
  readonly frustum = new Frustum()
  private readonly point = new Vector3()

  constructor(
    readonly params: SceneParams,
    readonly camera: PerspectiveCamera
  ) {
    camera.updateMatrixWorld()
    this.frustum.setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    )
  }

  /** A random stream for one kind of prop, independent of all others. */
  rng(stream: string): Random {
    return Random.derive(this.params.seed, `props/${stream}`)
  }

  ground(x: number, z: number): number {
    return terrainHeight(this.params.coast, x, z)
  }

  distance(x: number, z: number): number {
    return Math.hypot(x - this.camera.position.x, z - this.camera.position.z)
  }

  /** A random point on the open sea in view: a ray through a random spot in
   * the frame (`ndcY` = vertical range) meeting the sea `minDistance` to
   * `maxDistance` away over water at least `minDepth` deep; null on a miss. */
  seaPoint(rng: Random, ndcY: [number, number], minDistance: number, maxDistance: number, minDepth = 0.6): Vector3 | null {
    const dir = new Vector3(rng.range(-1.05, 1.05), rng.range(...ndcY), 0.5)
      .unproject(this.camera)
      .sub(this.camera.position)
      .normalize()
    if (dir.y >= -0.0003) return null
    const distance = -this.camera.position.y / dir.y
    if (distance < minDistance || distance > maxDistance) return null
    const p = this.camera.position.clone().addScaledVector(dir, distance).setY(0)
    return this.ground(p.x, p.z) < -minDepth ? p : null
  }

  /** Is a sphere at (x, y, z) with this radius at least partly in view? */
  visible(x: number, y: number, z: number, radius: number): boolean {
    this.point.set(x, y, z)
    for (const plane of this.frustum.planes) {
      if (plane.distanceToPoint(this.point) < -radius) return false
    }
    return true
  }
}
