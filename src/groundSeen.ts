import { Vector3 } from 'three'

import { groundCoverAt } from './groundCover'
import type { CoastParams } from './params'
import type { PropContext } from './props/context'
import { terrainHeight } from './terrain'

// What ground the camera sees (no render): for "will a ground feature be in
// view at all?" before building one. Fairy rings, mushrooms, fireflies and the
// bloom each asked it with a one-off script (knowledge/LESSONS.md
// "Placement"): the cameras face the sea, and the turf near them is mostly
// behind. In params.mjs expressions: `src.groundSeen.groundSeen(p.ctx)`
// (with --rendered).

/** Does the terrain stand between `from` and `to` (world points)? Marches
 * the segment in `steps`, skipping the last 2% (the point's own ground). */
export function terrainHides(coast: CoastParams, from: Vector3, to: Vector3, steps = 24): boolean {
  for (let i = 1; i < steps; i++) {
    const t = (i / steps) * 0.98
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    const z = from.z + (to.z - from.z) * t
    if (terrainHeight(coast, x, z) > y + 0.05) return true
  }
  return false
}

export type GroundKind = 'turf' | 'sparse' | 'bare' | 'sea'
export interface GroundBand {
  /** m² seen, by kind. */
  turf: number
  sparse: number
  bare: number
  sea: number
}

/** Distance bands (m) the area is split into. */
export const GROUND_BANDS: readonly [string, number, number][] = [
  ['near', 0, 20],
  ['mid', 20, 60],
  ['far', 60, Infinity]
]

/** The kind of ground at (x, z): sea below 0.3 m, turf where the shader's
 * cover is ≥ 0.5 of the biome's, sparse ≥ 0.05, else bare. */
export function groundKind(coast: CoastParams, x: number, z: number): GroundKind {
  if (terrainHeight(coast, x, z) < 0.3) return 'sea'
  const c = groundCoverAt(coast, x, z)
  return c >= 0.5 ? 'turf' : c >= 0.05 ? 'sparse' : 'bare'
}

/**
 * The ground in frame and not behind the terrain, by distance band and kind
 * (m²): a polar grid round the camera (rings 6% apart from 1 m to `far`, 1.5°
 * apart). Props aren't checked (a near bush hides little ground area).
 */
export function groundSeen(ctx: PropContext, far = 300): Record<string, GroundBand> {
  const coast = ctx.params.coast
  const cam = ctx.camera.position
  const out: Record<string, GroundBand> = Object.fromEntries(GROUND_BANDS.map(([name]) => [name, { turf: 0, sparse: 0, bare: 0, sea: 0 }]))
  const p = new Vector3()
  const az = 240
  for (let r = 1; r < far; r *= 1.06) {
    const dr = r * 0.06
    for (let k = 0; k < az; k++) {
      const t = (k / az) * Math.PI * 2
      const [x, z] = [cam.x + r * Math.sin(t), cam.z - r * Math.cos(t)]
      const y = Math.max(0, terrainHeight(coast, x, z))
      if (!ctx.inFrame(x, y, z, 1)) continue
      p.set(x, y, z)
      if (terrainHides(coast, cam, p)) continue
      const band = GROUND_BANDS.find(([, a, b]) => r >= a && r < b)
      if (band == null) continue
      out[band[0]][groundKind(coast, x, z)] += r * dr * ((2 * Math.PI) / az)
    }
  }
  for (const band of Object.values(out)) for (const k of Object.keys(band) as GroundKind[]) band[k] = Math.round(band[k])
  return out
}
