import { DoubleSide, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three'

import { cloudBase } from '../cloudTypes'
import { dirFromAzEl, type SceneParams } from '../params'
import { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

// Lightning bolts: forked channels from the cloud base to the sea. Their
// brightness depends on the metered exposure, so scene.ts sets it later (see
// setGlowBrightness). Rain shafts, the flash on the clouds and falling rain
// are screen-space effects (stormEffects.ts).

/** A forked lightning channel from the cloud base down to the sea, as a
 * ribbon facing the camera. */
function bolt(rng: Random, base: Vector3, toCamera: Vector3, width: number, cloudBaseM: number): MeshBuilder {
  const b = new MeshBuilder()
  const side = new Vector3(0, 1, 0).cross(toCamera).normalize()
  const ribbon = (points: Vector3[], w: number, brightness: number): void => {
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i]
      const q = points[i + 1]
      const c: [number, number, number] = [brightness, brightness, brightness]
      const a = b.vertex(p.clone().addScaledVector(side, -w / 2), c)
      const d = b.vertex(p.clone().addScaledVector(side, w / 2), c)
      const e = b.vertex(q.clone().addScaledVector(side, w / 2), c)
      const f = b.vertex(q.clone().addScaledVector(side, -w / 2), c)
      b.quad(a, d, e, f)
    }
  }
  /** Jagged path: midpoint displacement of a straight segment. */
  const jagged = (from: Vector3, to: Vector3, roughness: number, depth: number): Vector3[] => {
    let points = [from, to]
    for (let level = 0; level < depth; level++) {
      const next: Vector3[] = [points[0]]
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]
        const c = points[i + 1]
        const length = a.distanceTo(c)
        const mid = a.clone().lerp(c, rng.range(0.4, 0.6))
        mid.addScaledVector(side, rng.normal(0, length * roughness))
        mid.y += rng.normal(0, length * roughness * 0.3)
        next.push(mid, c)
      }
      points = next
    }
    return points
  }

  const top = base.clone().setY(cloudBaseM + rng.range(0, 200))
  const ground = base.clone().addScaledVector(side, rng.normal(0, 150)).setY(0)
  const main = jagged(top, ground, 0.22, 7)
  ribbon(main, width, 1)
  // Forks branch off the upper part and die out in the air.
  const forks = rng.int(2, 6)
  for (let f = 0; f < forks; f++) {
    const start = main[rng.int(4, Math.floor(main.length * 0.6))]
    const length = rng.range(80, 350)
    const end = start
      .clone()
      .addScaledVector(side, rng.range(-1, 1) * length)
      .add(new Vector3(0, -length * rng.range(0.5, 1), 0))
    ribbon(jagged(start, end, 0.25, 4), width * 0.5, rng.range(0.25, 0.6))
  }
  return b
}

/** Where each bolt leaves the cloud base (world), for the flash glow. */
export function boltTops(params: SceneParams, camera: Vector3): Vector3[] {
  const base = cloudBase(params.weather.formations, 'cumulonimbus')
  return (params.storm?.bolts ?? []).map(strike => {
    const [dx, , dz] = dirFromAzEl(strike.azimuthDeg, 0)
    return new Vector3(camera.x + dx * strike.distance, base, camera.z + dz * strike.distance)
  })
}

export function createStorm(ctx: PropContext): Object3D[] {
  const { storm } = ctx.params
  if (storm == null) return []
  const camera = ctx.camera.position
  const objects: Object3D[] = []

  for (const strike of storm.bolts) {
    const brng = new Random(`${ctx.params.seed}/bolt/${strike.seed}`)
    const [dx, , dz] = dirFromAzEl(strike.azimuthDeg, 0)
    const base = new Vector3(camera.x + dx * strike.distance, 0, camera.z + dz * strike.distance)
    const toCamera = camera.clone().sub(base).setY(0).normalize()
    // A few pixels wide at 4K, whatever the distance; bloom does the glow.
    const width = Math.max(3, strike.distance * 0.0012)
    const mesh = new Mesh(
      bolt(brng, base, toCamera, width, cloudBase(ctx.params.weather.formations, 'cumulonimbus')).build(),
      new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })
    )
    // Far brighter than anything else in the frame.
    mesh.userData.glow = { color: [0.85, 0.9, 1], scale: 250 }
    objects.push(mesh)
  }
  return objects
}

/**
 * Light self-luminous props (lightning, lava) once the exposure is known:
 * `userData.glow` = { color, scale } relative to the metered sky luminance.
 */
export function setGlowBrightness(root: Object3D, sceneLuminance: number): void {
  root.traverse(o => {
    const glow = o.userData.glow as { color: [number, number, number]; scale: number } | undefined
    if (glow == null) return
    ;((o as Mesh).material as MeshBasicMaterial).color.setRGB(...glow.color).multiplyScalar(sceneLuminance * glow.scale)
  })
}
