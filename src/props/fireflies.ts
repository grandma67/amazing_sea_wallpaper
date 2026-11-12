import { Matrix4, Vector3, type InstancedMesh } from 'three'

import { fbm, hashCell } from '../cellNoise'
import { groundCoverAt } from '../groundCover'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import type { PropContext } from './context'
import { stormy } from './context'
import type { MangroveStand } from './mangroves'

// Fireflies and glow-worms (NATURE_PLAN phases 13–14, NATURE.md §3): what's
// out tonight (firefliesFor: region by place and local month, the evening,
// the moon, the weather, one draw), and where (fireflyLights: from density ×
// the vegetated ground in view, by hash of where each light is). Drawing is
// phase 14. Never by day, at dawn, over sand, bare rock or water.

export { FIREFLY_KINDS, type FireflyKind } from './fireflyKinds'
import type { FireflyKind } from './fireflyKinds'

interface FireflyRow {
  places: readonly string[]
  kind: FireflyKind
  /** Local calendar months, inclusive (may wrap the year). */
  months: readonly [number, number]
  /** The peak, inside `months`; the rest of the months ×0.4 (est.). Unset:
   * every month is the peak. */
  peak?: readonly [number, number]
}

/**
 * Where and when (NATURE_PLAN §13; NHM, UK Glow-worm Survey, Finland study,
 * Biologer.hr, state guides, Japan Times, Selangor survey, Illawarra and Coffs
 * Coast reports, Mongabay, Bechara & Stevani 2018). `synchronous` only where
 * mangroves are drawn; Sri Lanka's `flash` elsewhere.
 */
export const FIREFLY_REGIONS: readonly FireflyRow[] = [
  { places: ['cornwall-wales', 'brittany', 'ireland', 'bristol-channel', 'wadden-north-sea', 'mont-saint-michel', 'scotland'], kind: 'glow', months: [5, 9], peak: [6, 7] },
  { places: ['norway-west', 'baltic'], kind: 'glow', months: [6, 8], peak: [7, 7] },
  { places: ['western-med', 'adriatic', 'aegean', 'portugal-morocco'], kind: 'flash', months: [5, 6], peak: [6, 6] },
  { places: ['maine', 'fundy', 'nova-scotia'], kind: 'flash', months: [6, 8], peak: [6, 7] },
  { places: ['florida-carolinas'], kind: 'flash', months: [5, 9], peak: [6, 7] },
  { places: ['south-japan', 'japan', 'taiwan-south-china', 'yellow-sea'], kind: 'flash', months: [5, 7], peak: [6, 6] },
  { places: ['indonesia', 'philippines', 'mainland-se-asia', 'sumatra-java-south', 'sri-lanka'], kind: 'synchronous', months: [1, 12], peak: [11, 12] },
  { places: ['east-australia'], kind: 'flash', months: [10, 3], peak: [11, 12] },
  { places: ['north-australia'], kind: 'synchronous', months: [11, 3] },
  { places: ['india'], kind: 'flash', months: [5, 6], peak: [5, 5] },
  { places: ['sri-lanka'], kind: 'flash', months: [5, 7], peak: [6, 6] },
  { places: ['south-brazil'], kind: 'flash', months: [11, 3] },
  { places: ['northeast-brazil'], kind: 'flash', months: [4, 7] }
]

const inMonths = (m: number, [a, b]: readonly [number, number]): boolean => (a <= b ? m >= a && m <= b : m >= a || m <= b)

/** Outside the peak (est.). */
const OFF_PEAK = 0.4
/** Chance of a display on an eligible evening at the peak (est.). */
const PEAK_CHANCE = 0.7

export interface FirefliesTonight {
  kind: FireflyKind
  /** The month's factor (1 at the peak, 0.4 around it): scales how many. */
  month: number
  /** Forced by a spec. */
  forced: boolean
}

/** The evening's eligibility: 1, 0.5 (glow-worms' first light) or 0. */
function evening(params: SceneParams, kind: FireflyKind): number {
  if (params.timeOfDay === 'night') return 1
  if (params.timeOfDay !== 'blue-hour' || !params.evening) return 0
  // Glow-worm females light up near 1 lux, ~−7° (AMS Glossary; Elgert 2021).
  if (kind === 'glow') return params.sunElevationDeg <= -6 ? 0.5 : 0
  return 1
}

/** The weather's factor by kind (0 stops them). */
export function fireflyWeather(params: SceneParams, kind: FireflyKind): number {
  if (params.snow != null || stormy(params)) return 0
  if (kind === 'glow') return 1
  const fog = params.fog != null ? 0.3 : 1
  // 10 m wind over the sea (est.: no threshold in the literature).
  const [calm, still] = kind === 'flash' ? [4, 8] : [6, 10]
  const wind = Math.max(0, Math.min(1, (still - params.ocean.airWindSpeed) / (still - calm)))
  return fog * wind
}

/**
 * Tonight's fireflies, or null. Always one draw from `rng`, so forcing or
 * switching off keeps the stream. `props.fireflies`: true, the place's kind
 * (or `flash`) at its peak; a kind, that kind; false, none. A forced kind
 * still needs night or an evening blue hour and land.
 */
export function firefliesFor(params: SceneParams, rng: Random, mangroves: MangroveStand | null): FirefliesTonight | null {
  const roll = rng.float()
  const force = params.overrides?.fireflies
  if (force === false || params.coast.type === 'open-sea') return null
  const month = Number(params.date.slice(5, 7))
  // Synchronous only where mangroves are drawn (Sri Lanka: flash elsewhere).
  const usable = FIREFLY_REGIONS.filter(r => r.places.includes(params.place.id) && inMonths(month, r.months) && (r.kind !== 'synchronous' || mangroves != null))
  const pick = usable.find(r => r.kind === 'synchronous') ?? usable[0] ?? null
  if (force != null) {
    const kind: FireflyKind = typeof force === 'string' ? force : (FIREFLY_REGIONS.find(r => r.places.includes(params.place.id))?.kind ?? 'flash')
    return evening(params, kind) > 0 ? { kind, month: 1, forced: true } : null
  }
  if (pick == null) return null
  const factor = pick.peak == null || inMonths(month, pick.peak) ? 1 : OFF_PEAK
  const moon = params.moonElevationDeg > 2 && params.moonIllumination > 0.7 ? 0.3 : 1
  const chance = PEAK_CHANCE * factor * moon * evening(params, pick.kind) * fireflyWeather(params, pick.kind)
  return roll < chance ? { kind: pick.kind, month: factor, forced: false } : null
}

/** Lit flashing males per m² of vegetation at the peak (P. carolinus traps:
 * 0.15 per m², ~15% lit in the frame), glowing females (Essex surveys,
 * est. conversion: up to 0.05 per m² at a good site). */
const FLASH_PER_M2 = 0.15
const FLASH_LIT = 0.15
const GLOW_PER_M2 = 0.05
/** A display tree's lights and the share of crowns that are one (est.). */
const SYNC_PER_TREE: readonly [number, number] = [20, 200]
const SYNC_TREES = 0.2
/** Where lights are counted: m from the camera (plan: 5–60 m; past 40 m
 * one firefly is fainter than +6.8, phase 14). A synchronous tree's 20–200
 * flash together and are seen across a creek: out to SYNC_RANGE. */
export const FIREFLY_RANGE: readonly [number, number] = [5, 60]
export const SYNC_RANGE = 400
/** Drawn lights, at most (est.). */
export const MAX_FIREFLIES = 400

export interface FireflyLight {
  x: number
  y: number
  z: number
  kind: FireflyKind
  /** 0..1, by hash: its own flash phase and streak shape (phase 14). */
  seed: number
}

const U32 = 4294967295
const h = (a: number, b: number, salt: number): number => hashCell(a * 41 + salt * 7919, b * 23 - salt * 104729) / U32

/** Crowns of instanced trees or bushes: centre, height of the crown, radius. */
function crowns(meshes: readonly InstancedMesh[]): { x: number; y: number; z: number; top: number; radius: number }[] {
  const out: { x: number; y: number; z: number; top: number; radius: number }[] = []
  const m = new Matrix4()
  const s = new Vector3()
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      s.setFromMatrixColumn(m, 0)
      const k = s.length()
      const e = m.elements
      out.push({ x: e[12], y: e[13], z: e[14], top: box.max.y * k, radius: ((box.max.x - box.min.x + box.max.z - box.min.z) / 4) * k })
    }
  }
  return out
}

/**
 * Tonight's lights in view (no meshes): `flash` 0.5–3 m over grass and bushes,
 * `glow` on the grass, `synchronous` in mangrove crowns (trees or bushes
 * where there are none). 1 m cells of vegetated ground 5–60 m off and in
 * frame, each with its own hashed chance, so near and far come out of the
 * density alone. At most MAX_FIREFLIES, thinned evenly by hash.
 */
export function fireflyLights(ctx: PropContext, tonight: FirefliesTonight | null, plants: readonly InstancedMesh[], mangroves: readonly InstancedMesh[] = []): FireflyLight[] {
  if (tonight == null) return []
  const { coast } = ctx.params
  const [ox, oz] = coast.noiseOffset
  const [near, far] = FIREFLY_RANGE
  const lights: FireflyLight[] = []
  if (tonight.kind === 'synchronous') {
    const trees = crowns(mangroves.length > 0 ? mangroves : plants.filter(p => p.userData.plantKind !== 'grass'))
    for (const t of trees) {
      const d = ctx.distance(t.x, t.z)
      if (d < near || d > SYNC_RANGE || !ctx.visible(t.x, t.y + t.top * 0.7, t.z, t.radius)) continue
      const [kx, kz] = [Math.round((t.x + ox) * 8), Math.round((t.z + oz) * 8)]
      if (h(kx, kz, 1) >= SYNC_TREES) continue
      const n = Math.round((SYNC_PER_TREE[0] + (SYNC_PER_TREE[1] - SYNC_PER_TREE[0]) * h(kx, kz, 2)) * tonight.month)
      for (let i = 0; i < n; i++) {
        // In the outer crown: a shell of the crown's ellipsoid.
        const a = h(kx, kz, 10 + i) * Math.PI * 2
        const up = 0.55 + 0.4 * h(kx, kz, 400 + i)
        const r = t.radius * (0.6 + 0.4 * h(kx, kz, 800 + i)) * Math.sqrt(1 - ((up - 0.75) / 0.25) ** 2 * 0.5)
        lights.push({ x: t.x + Math.cos(a) * r, y: t.y + t.top * up, z: t.z + Math.sin(a) * r, kind: 'synchronous', seed: h(kx, kz, 1200 + i) })
      }
    }
  } else {
    const bushes = crowns(plants.filter(p => p.userData.plantKind === 'bush'))
    const vegetated = (x: number, z: number): boolean => groundCoverAt(coast, x, z) >= 0.3 || (tonight.kind === 'flash' && bushes.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < b.radius ** 2))
    // A good or poor site (glow: ×0.01–1, log-uniform by a 200 m cell), and
    // displaying males in patches (flash: ×0.5–2 by a 20 m noise).
    const cam = ctx.camera.position
    const [c0, c1] = [Math.floor(cam.x + ox - far), Math.ceil(cam.x + ox + far)]
    const [r0, r1] = [Math.floor(cam.z + oz - far), Math.ceil(cam.z + oz + far)]
    for (let j = r0; j < r1; j++)
      for (let i = c0; i < c1; i++) {
        const [x, z] = [i + h(i, j, 3) - ox, j + h(i, j, 4) - oz]
        const d = ctx.distance(x, z)
        if (d < near || d > far) continue
        let density: number
        if (tonight.kind === 'glow') {
          const site = 0.01 ** (1 - h(Math.floor(i / 200), Math.floor(j / 200), 5))
          density = GLOW_PER_M2 * site
        } else density = FLASH_PER_M2 * FLASH_LIT * 2 ** (2 * fbm(i / 20 + 7, j / 20 + 3) - 1)
        if (h(i, j, 6) >= density * tonight.month) continue
        const ground = ctx.ground(x, z)
        const y = ground + (tonight.kind === 'glow' ? 0.04 : 0.5 + 2.5 * h(i, j, 7))
        if (!ctx.visible(x, y, z, 0.5) || !vegetated(x, z)) continue
        lights.push({ x, y, z, kind: tonight.kind, seed: h(i, j, 8) })
      }
  }
  // Above where the spring tides reach, as the plants are.
  const kept = lights.filter(l => ctx.ground(l.x, l.z) > 0.3)
  const thin = Math.min(1, MAX_FIREFLIES / Math.max(kept.length, 1))
  return kept.filter(l => l.seed < thin)
}
