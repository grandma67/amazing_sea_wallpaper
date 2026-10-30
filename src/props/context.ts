import { DataUtils, Frustum, Matrix4, Vector3, type PerspectiveCamera } from 'three'

import type { SceneParams } from '../params'
import { Random } from '../random'
import { cascadeShelter, chopFactor, middleCascadeLongest, shelterAt, shelterFetch } from '../shelter'
import { CASCADE_SIZE, type OceanSurface } from '../spectrum'
import { terrainHeight, worldToShore } from '../terrain'

/** A storm overhead (thunderstorm, squall or storm sky): animals take
 * cover — gulls sit it out on the water, seals go into the sea, crabs stay
 * in their burrows. */
export function stormy(params: SceneParams): boolean {
  return params.storm != null || params.weather.kind === 'storm'
}

/** Shared inputs for placing props deterministically in view. */
export class PropContext {
  readonly frustum = new Frustum()
  private readonly point = new Vector3()

  constructor(
    readonly params: SceneParams,
    readonly camera: PerspectiveCamera,
    /** The frozen wave field, for floating things on the waves. */
    private readonly surface: OceanSurface | null = null,
    /** Radians per output pixel (vertical field of view / height), for
     * sizing things by how big they are on screen. */
    readonly pixelAngle = (camera.fov * Math.PI) / 180 / 1080
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

  /** Height of the open-sea waves at (x, z): the sum of the FFT cascades'
   * heights, sampled like the ocean shader does (ignoring the small
   * sideways displacement and the damping in the shallows), with sheltered
   * water's swell taken out as the shader does (shelter.ts). */
  seaLevel(x: number, z: number): number {
    if (this.surface == null) return 0
    const n = CASCADE_SIZE
    const { coast } = this.params
    const sheltered = coast.shelter != null ? shelterAt(coast, ...worldToShore(coast, x, z)) : 0
    const keep = sheltered > 0 ? cascadeShelter(sheltered, this.chop) : [1, 1, 1]
    let h = 0
    for (const [c, { size, a }] of this.surface.cascades.entries()) {
      if (keep[c] <= 0) continue
      const u = (x / size) * n - 0.5
      const v = (z / size) * n - 0.5
      const i = Math.floor(u)
      const j = Math.floor(v)
      const fu = u - i
      const fv = v - j
      const at = (di: number, dj: number): number => {
        const col = (((i + di) % n) + n) % n
        const row = (((j + dj) % n) + n) % n
        return DataUtils.fromHalfFloat(a[(row * n + col) * 4 + 1])
      }
      const level = (at(0, 0) * (1 - fu) + at(1, 0) * fu) * (1 - fv) + (at(0, 1) * (1 - fu) + at(1, 1) * fu) * fv
      h += keep[c] === 1 ? level : level * keep[c]
    }
    return h
  }

  /** Share of the middle cascade's chop a sheltered fetch keeps (shelter.ts). */
  private get chop(): number {
    if (this.surface == null) return 1
    return chopFactor(shelterFetch(this.params.coast), this.params.ocean.windSpeed, middleCascadeLongest(this.surface.cascades.map(c => c.size)))
  }

  /** Significant wave height of the open sea (m), 0 without waves. */
  get waveHeight(): number {
    return this.surface?.significantHeight ?? 0
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

  /** A spot on the sea in view where the water is `depth` [min, max] m deep,
   * `minDistance` to `maxDistance` away (lower frame first); null if none in
   * `tries`. Gentle (tropical) shelves are only ~1 m deep for the first
   * 150 m: callers wanting deep water near the beach should allow a shallow
   * minimum and adapt (lie down, sink less) rather than find nothing. */
  waterSpot(rng: Random, depth: [number, number], maxDistance: number, minDistance = 6, tries = 80): Vector3 | null {
    for (let i = 0; i < tries; i++) {
      const p = this.seaPoint(rng, [-0.95, 0.15], minDistance, maxDistance, depth[0])
      if (p != null && this.ground(p.x, p.z) >= -depth[1]) return p
    }
    return null
  }

  /** Does (x, y, z) project inside the central `fraction` of the frame? */
  inFrame(x: number, y: number, z: number, fraction = 0.75): boolean {
    this.point.set(x, y, z).project(this.camera)
    return this.point.z < 1 && Math.abs(this.point.x) < fraction && Math.abs(this.point.y) < fraction
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
