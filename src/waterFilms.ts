import { Vector3 } from 'three'

import { createCamera } from './camera'
import { fbm, smoothstep, vnoise } from './cellNoise'
import type { SceneParams } from './params'
import { REEF_RAMP } from './reef'
import { rockGully } from './rockShore'
import { snowLook } from './props/snowCap'
import { flatCreeks } from './tidalFlat'
import { tideMarks } from './tides'
import { reefCrest, reefGap, seaDistance, terrainHeight, worldToShore } from './terrain'

// CPU mirror of the terrain shader's standing water (terrain.ts main():
// `pools`, plans/WATER_VIEW.md step 3): terrace runnels, reef-flat hollows,
// rock pools, flat creeks and sheets, with the same "is it a pool" rule as
// debug.water (waterCount.ts): mask > 0.5, not under snow, not below
// today's still water. So params.mjs can ask "is there a pool near the
// camera?" without rendering. The terrain in front is checked; props and
// the sea-ice sheet aren't, so `nearestPool` can be nearer than a render's
// count (debug.water) on days with rocks or sea ice in front. Rings are 3%
// of the distance apart: a strip under ~2 m across can be missed past ~70 m.

export interface PoolSample {
  /** The shader's `pools` mask, 0–1. */
  pools: number
  /** Height above today's still water (m). */
  h: number
  /** Lying snow, 0–1 (the shader's `snowW`). */
  snow: number
  /** A pool as debug.water counts one. */
  isPool: boolean
}

/** The pool mask at world (x, z). `footprint`: the ground size of a pixel
 * there (m), which only sets the step of the snow's slope test. */
export function poolAt(params: SceneParams, x: number, z: number, footprint = 0.03): PoolSample {
  const { coast } = params
  const none = (h: number): PoolSample => ({ pools: 0, h, snow: 0, isPool: false })
  if (coast.type === 'open-sea') return none(-200)
  const h = terrainHeight(coast, x, z)
  if (h < 0) return none(h)
  const { high: tideHigh, spring: tideSpring } = tideMarks(coast)
  const runup = coast.runup
  const highMark = tideHigh + runup
  const rock = coast.type === 'rock-shore'
  const flat = coast.type === 'tidal-flat'
  // Every mask below needs the ground under one of these heights.
  if (h > Math.max(highMark + 0.3, rock ? tideSpring + 0.1 : -Infinity)) return none(h)

  const [s, a] = worldToShore(coast, x, z)
  const [ox, oz] = coast.noiseOffset
  const qx = x + ox
  const qz = z + oz

  // Coral bared on a reef flat (reefCover).
  let coral = 0
  if (coast.reef != null) {
    const sSea = seaDistance(coast, s)
    const r = reefCrest(coast, a)
    const w = coast.reef.flatWidth
    const onReef = smoothstep(r - w - REEF_RAMP, r - w, sSea) * (1 - reefGap(coast, a))
    const heads = smoothstep(0.62, 0.76, fbm(qx / 14 + 41, qz / 14 + 41)) * smoothstep(10, 40, sSea) * (1 - smoothstep(r - w - 40, r - w - REEF_RAMP, sSea))
    coral = Math.max(onReef * (0.75 + 0.25 * vnoise(qx / 4, qz / 4)), smoothstep(0, 0.6, heads))
  }

  // Mud and creeks on a flat.
  let mudW = 0
  let creek = 0
  if (flat && coast.flat != null) {
    mudW = (1 - smoothstep(0.03, 0.35, s / coast.flat.width + 0.2 * (fbm(qx / 80, qz / 80) - 0.5))) * smoothstep(-1, 0.5, s)
    creek = flatCreeks(coast, s, a, 0)
  }

  // The salt marsh band and its clumps.
  const marsh = coast.marsh ?? { start: -1e5, width: 0 }
  const marshWidth = Math.max(marsh.width, 1)
  const um = -s - marsh.start
  const marshBand = smoothstep(-0.3, 0.6, um) * (1 - smoothstep(marshWidth - 5, marshWidth + 20, um))
  let marshW = 0
  if (marshBand > 0) {
    const clumps = fbm(qx / 2.5, qz / 2.5) * 0.5 + fbm(qx / 12, qz / 12) * 0.5
    marshW = marshBand * smoothstep(0.42, 0.52, clumps + 0.45 * smoothstep(1, 8, um) - 0.1 + 0.15 * smoothstep(0.62, 0.72, fbm(qx / 40 + 2, qz / 40 + 2)) * -2)
    marshW *= 1 - smoothstep(0.15, 0.3, creek)
  }

  // Rock pools in the platform's hollows and gullies.
  let rockPools = 0
  if (rock && coast.rock != null) {
    const g = rockGully(coast, s, a, Math.hypot(x, z))
    const onPlatform = smoothstep(-1, 3, s) * (1 - smoothstep(coast.rock.width - 5, coast.rock.width + 2, s))
    const hollow = Math.max(smoothstep(0.6, 0.85, g), 1 - smoothstep(0.3, 0.36, fbm(qx / 18, qz / 18)))
    rockPools = onPlatform * hollow * (1 - smoothstep(tideSpring - 0.2, tideSpring + 0.1, h))
  }

  // Wet below the run-up line; damp sand the falling tide has left.
  const wetLine = runup * (0.85 + 0.3 * vnoise(a / 25, 7))
  const wet = 1 - smoothstep(wetLine * 0.7, wetLine, h)
  const exposed = (1 - smoothstep(0.8 * highMark, highMark, h)) * (1 - wet) * (1 - marshW) * (1 - 0.8 * marshBand)

  let pools = 0
  const terraceWidth = coast.terrace.width
  if (terraceWidth > 0) {
    const onTerrace = smoothstep(0, 8, s) * (1 - smoothstep(terraceWidth - 8, terraceWidth, s))
    const wx = 1.5 * vnoise(qx / 25 + 5, qz / 25 + 5)
    const wz = 1.5 * vnoise(qx / 25 + 19, qz / 25 + 19)
    const runnels = fbm(a / 30 + wx + ox + 3, s / 12 + wz + oz + 3) + 0.3 * (fbm(qx / 5 + 11, qz / 5 + 11) - 0.5)
    pools = onTerrace * exposed * smoothstep(0.6, 0.7, runnels)
  }
  pools = Math.max(pools, coral * exposed * smoothstep(0.58, 0.68, fbm(qx / 5 + 23, qz / 5 + 23)))
  pools = Math.max(pools, rockPools)
  if (flat) {
    pools = Math.max(pools, smoothstep(0.06, 0.14, creek) * (1 - smoothstep(highMark, highMark + 0.3, h)))
    pools = Math.max(pools, exposed * smoothstep(0.6, 0.68, fbm(qx / 35 + 9, qz / 35 + 9) + 0.1 * (fbm(qx / 4, qz / 4) - 0.5)) * (1 - 0.5 * mudW) * smoothstep(0, 3, s))
  }

  // Lying snow (the shader's snowW, on the land's own slope).
  let snow = 0
  const look = snowLook(params)
  if (look != null && look.cover > 0 && pools > 0.5) {
    const e = Math.max(0.03, footprint)
    const nx = h - terrainHeight(coast, x + e, z)
    const nz = h - terrainHeight(coast, x, z + e)
    const ny = e / Math.hypot(nx, e, nz)
    const wide = fbm(qx / 25, qz / 25) * 0.55 + fbm(qx / 4, qz / 4) * 0.35 + vnoise(qx * 0.9, qz * 0.9) * 0.1
    const open = 0.75 - 0.55 * look.cover
    const above = smoothstep(0, 0.45, h - look.line + 0.5 * (fbm(qx / 5 + 71, qz / 5 + 71) - 0.5))
    snow = above * smoothstep(open - 0.035, open + 0.035, wide) * smoothstep(0.5, 0.78, ny)
  }
  return { pools, h, snow, isPool: pools > 0.5 && snow <= 0.5 }
}

/** Is the ground point (x, h, z) seen from `eye` past the terrain in
 * between? Marched in steps of 2% of the distance (≥ 0.2 m), leaving the
 * last 0.3 m (the point's own ground). */
export function terrainClear(params: SceneParams, eye: Vector3, x: number, h: number, z: number): boolean {
  const dx = x - eye.x
  const dy = h - eye.y
  const dz = z - eye.z
  const length = Math.hypot(dx, dy, dz)
  const step = Math.max(0.2, 0.02 * length)
  for (let t = step; t < length - 0.3; t += step) {
    const k = t / length
    if (terrainHeight(params.coast, eye.x + dx * k, eye.z + dz * k) > eye.y + dy * k) return false
  }
  return true
}

export interface NearestPool {
  /** Distance from the camera (m, 3D, as debug.water) to the nearest pool
   * in frame; null: none within `maxM`. */
  m: number | null
  /** Where it is in the image (fractions, x right, y down: a `probe` point). */
  at: [number, number] | null
  /** Pool area in frame within 15 m of the camera (m²). */
  areaWithin15M2: number
}

/** The nearest pool in the frame, by sampling the ground in rings round
 * the camera (3% apart in distance, ~0.4° across) out to `maxM`; a pool
 * behind higher ground doesn't count (terrainClear), one behind a prop does. */
export function nearestPool(params: SceneParams, maxM = 300, height = 1080): NearestPool {
  const empty: NearestPool = { m: null, at: null, areaWithin15M2: 0 }
  if (params.coast.type === 'open-sea') return empty
  const { camera } = createCamera(params, params.camera.aspect * height, height)
  camera.updateMatrixWorld()
  const eye = camera.position
  const pixelAngle = (camera.fov * Math.PI) / 180 / height
  const forward = camera.getWorldDirection(new Vector3())
  const heading = Math.atan2(forward.x, forward.z)
  const half = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) + 0.02
  const dTheta = (0.4 * Math.PI) / 180
  const steps = Math.ceil((2 * half) / dTheta)
  const grow = 1.03
  const point = new Vector3()
  let area = 0
  let best: { m: number; at: [number, number] } | null = null
  for (let d = 0.5; d < maxM; d *= grow) {
    // A ring past the nearest pool found can't hold a nearer one (bar
    // height: rings are horizontal distance), but the 15 m area needs its rings.
    if (best != null && d > Math.max(15, best.m)) break
    for (let i = 0; i <= steps; i++) {
      const theta = heading - half + i * dTheta
      const x = eye.x + d * Math.sin(theta)
      const z = eye.z + d * Math.cos(theta)
      const toCamera = Math.hypot(d, eye.y)
      const grazing = Math.max(eye.y / toCamera, 0.05)
      const footprint = Math.min(Math.max((toCamera * pixelAngle) / grazing, 0.001), 200)
      const sample = poolAt(params, x, z, footprint)
      if (!sample.isPool) continue
      point.set(x, sample.h, z).project(camera)
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || point.z > 1) continue
      if (!terrainClear(params, eye, x, sample.h, z)) continue
      const m = Math.hypot(x - eye.x, sample.h - eye.y, z - eye.z)
      if (m <= 15) area += d * dTheta * d * (grow - 1)
      if (best == null || m < best.m) best = { m, at: [(point.x + 1) / 2, (1 - point.y) / 2] }
    }
  }
  if (best == null) return { ...empty, areaWithin15M2: 0 }
  const round = (v: number, k: number): number => +v.toFixed(k)
  return { m: round(best.m, 1), at: [round(best.at[0], 3), round(best.at[1], 3)], areaWithin15M2: round(area, 1) }
}
