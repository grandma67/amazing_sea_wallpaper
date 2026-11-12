import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, Vector3, type InstancedMesh, type Object3D } from 'three'

import { fbm, hashCell } from '../cellNoise'
import { groundCoverAt } from '../groundCover'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import type { PropContext } from './context'
import { stormy } from './context'
import { mangroveFor, type MangroveStand } from './mangroves'

// Fireflies and glow-worms (NATURE_PLAN phases 13–14, NATURE.md §3): what's
// out tonight (firefliesFor: region by place and local month, the evening,
// the moon, the weather, one draw), and where (fireflyLights: from density ×
// the vegetated ground in view, by hash of where each light is). Drawing is
// phase 14. Never by day, at dawn, over sand, bare rock or water.

export { FIREFLY_KINDS, type FireflyKind } from './fireflyKinds'
import { FIREFLY_KINDS, type FireflyKind } from './fireflyKinds'

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
 * flash together: out to SYNC_RANGE (at 100 m one is +11.3, 200 together
 * ~+5.5; past 150 m a whole tree is fainter than the stars round it). */
export const FIREFLY_RANGE: readonly [number, number] = [5, 60]
export const SYNC_RANGE = 150
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
        // Glow-worm females climb a grass stem to glow (5–40 cm, est.; at 4 cm
        // the first render's were all behind the tufts).
        const y = ground + (tonight.kind === 'glow' ? 0.05 + 0.35 * h(i, j, 7) : 0.5 + 2.5 * h(i, j, 7))
        if (!ctx.visible(x, y, z, 0.5) || !vegetated(x, z)) continue
        lights.push({ x, y, z, kind: tonight.kind, seed: h(i, j, 8) })
      }
  }
  // Above where the spring tides reach, as the plants are.
  const kept = lights.filter(l => ctx.ground(l.x, l.z) > 0.3)
  const thin = Math.min(1, MAX_FIREFLIES / Math.max(kept.length, 1))
  return kept.filter(l => l.seed < thin).slice(0, MAX_FIREFLIES)
}

// ---- Drawing (NATURE_PLAN phase 14) ----

/** A flash's luminous intensity toward the camera (cd): 10¹⁰–10¹¹ photons
 * over a ½ s flash at 562 nm into a hemisphere (Silver 2026, Am. J. Phys.):
 * ≈ 7.6e-6 cd at the top, ×0.1 at the bottom. Glow-worms the same, steady. */
export const FIREFLY_CD: readonly [number, number] = [7.6e-7, 7.6e-6]
/** ~560 nm (P. pyralis in vivo 557 nm, luciferase 560–562), linear RGB. */
export const FIREFLY_COLOR: readonly [number, number, number] = [0.66, 1, 0.035]
/** A flash's lit trace (m): ½–1 s at 0.6–1.5 m/s, slower while flashing
 * (the stylised long exposure, Decisions). */
export const STREAK: readonly [number, number] = [0.3, 0.8]
/** J-shaped streaks: Photinus, eastern North America; a short arc elsewhere. */
const J_PLACES = ['maine', 'fundy', 'nova-scotia', 'florida-carolinas']
/** A light is at least this many pixels wide (thinner, it flickers between pixels). */
const MIN_PIXELS = 2.5

/** Apparent V magnitude of a light of intensity `cd` at `d` m
 * (m = −13.99 − 2.5 log₁₀(E), E in lux). */
export function fireflyMagnitude(cd: number, d: number): number {
  return -13.99 - 2.5 * Math.log10(cd / (d * d))
}

/** The flash's path in its own plane (x along, y up), length 1, and how
 * bright each point is (brightest mid-trace, fading at the ends). */
export function streakPath(j: boolean, steps = 12): { x: number; y: number; w: number }[] {
  const raw = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    // J: the bottom of a U and its upswing; else a gentle arc.
    return j ? { x: 0.5 * t, y: 1.2 * t ** 3 - 0.3 * t, t } : { x: t, y: 0.08 * Math.sin(Math.PI * t), t }
  })
  let len = 0
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y)
  return raw.map(p => ({ x: p.x / len, y: p.y / len, w: Math.sin(Math.PI * p.t) ** 0.7 }))
}

/** Mean of the along-trace weights (for the light's area). */
const meanAlong = (path: { w: number }[]): number => path.reduce((s, p, i) => s + (i === 0 || i === path.length - 1 ? p.w / 2 : p.w), 0) / (path.length - 1)

const tint = (): [number, number, number] => {
  const lum = 0.2126 * FIREFLY_COLOR[0] + 0.7152 * FIREFLY_COLOR[1] + 0.0722 * FIREFLY_COLOR[2]
  return FIREFLY_COLOR.map(c => c / lum) as [number, number, number]
}

/**
 * Tonight's fireflies as glowing geometry: per kind one mesh of camera-facing
 * streaks (flash) or dots (glow, synchronous), at least MIN_PIXELS wide. Each
 * vertex colour is radiance per cd/m² of scene: the light's intensity over its
 * area, so the light reaching the camera is its own whatever its size;
 * `setFireflyBrightness` multiplies in the night's scale. Depth-tested, so
 * plants hide those behind them; additive.
 */
export function createFireflies(ctx: PropContext, plants: readonly InstancedMesh[], mangroves: readonly InstancedMesh[]): Mesh[] {
  const tonight = firefliesFor(ctx.params, ctx.rng('fireflies'), mangroveFor(ctx.params, ctx.rng('mangroves')))
  const lights = fireflyLights(ctx, tonight, plants, mangroves)
  if (lights.length === 0) return []
  const cam = ctx.camera.position
  const up = new Vector3(0, 1, 0)
  const color = tint()
  const j = J_PLACES.includes(ctx.params.place.id)
  const out: Mesh[] = []
  for (const kind of FIREFLY_KINDS) {
    const mine = lights.filter(l => l.kind === kind)
    if (mine.length === 0) continue
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    for (const l of mine) {
      const p = new Vector3(l.x, l.y, l.z)
      const toCam = cam.clone().sub(p)
      const d = toCam.length()
      const right = new Vector3().crossVectors(up, toCam).normalize()
      const upIn = new Vector3().crossVectors(toCam, right).normalize()
      const width = Math.max(0.012, MIN_PIXELS * ctx.pixelAngle * d)
      const cd = FIREFLY_CD[0] * (FIREFLY_CD[1] / FIREFLY_CD[0]) ** ((l.seed * 7.31) % 1)
      const base = pos.length / 3
      const vertex = (v: Vector3, w: number): void => {
        pos.push(v.x, v.y, v.z)
        col.push(color[0] * w, color[1] * w, color[2] * w)
      }
      if (kind === 'flash') {
        const length = STREAK[0] + (STREAK[1] - STREAK[0]) * ((l.seed * 13.7) % 1)
        const flip = (l.seed * 3.1) % 1 < 0.5 ? -1 : 1
        const path = streakPath(j)
        // Across: edge, centre, edge (a triangle profile, mean ½).
        const radiance = cd / (length * width * meanAlong(path) * 0.5)
        path.forEach((q, i) => {
          const next = path[Math.min(i + 1, path.length - 1)]
          const prev = path[Math.max(i - 1, 0)]
          const t = new Vector3(flip * (next.x - prev.x), next.y - prev.y, 0).normalize()
          const at = p.clone().addScaledVector(right, flip * (q.x - 0.5 * path[path.length - 1].x) * length).addScaledVector(upIn, (q.y - path[path.length - 1].y / 2) * length)
          const across = right.clone().multiplyScalar(-t.y).addScaledVector(upIn, t.x).multiplyScalar(width / 2)
          vertex(at.clone().add(across), 0)
          vertex(at, radiance * q.w)
          vertex(at.clone().sub(across), 0)
          if (i > 0) {
            const a = base + (i - 1) * 3
            const b = base + i * 3
            idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2)
          }
        })
      } else {
        // A dot: a bright centre fading to its rim (a cone, mean ⅓).
        const r = width / 2
        const radiance = cd / ((Math.PI * r * r) / 3)
        vertex(p, radiance)
        const sides = 8
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * Math.PI * 2
          vertex(p.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(upIn, Math.sin(a) * r), 0)
          idx.push(base, base + 1 + k, base + 1 + ((k + 1) % sides))
        }
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
    geometry.setIndex(idx)
    const material = new MeshBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false })
    // Scene radiance per cd/m², set once the meter has run (scene.ts).
    material.color.setScalar(0)
    const mesh = new Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.userData.fireflies = kind
    mesh.userData.kind = kind
    out.push(mesh)
  }
  return out
}

/** Put the fireflies in the scene's units: `perCdM2` is scene radiance per
 * cd/m² (as ships' lamps, shipLights.ts setLampBrightness). */
export function setFireflyBrightness(root: Object3D, perCdM2: number): void {
  root.traverse(o => {
    if (o.userData.fireflies == null) return
    ;((o as Mesh).material as MeshBasicMaterial).color.setScalar(perCdM2)
  })
}
