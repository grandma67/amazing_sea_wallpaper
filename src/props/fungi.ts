import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'

import type { Climate, RGB, VegetationKind } from '../biome'
import { hashCell } from '../cellNoise'
import { FAIRY_CELL, fairyRingCell, fairyRingPoint } from '../fairyRings'
import { groundCoverAt, heathMaskAt } from '../groundCover'
import type { SceneParams } from '../params'
import { fairyRingsFor, fungiSeason, heathFor, isWetDay, mossWetness } from '../phenology'
import { terrainNormal } from '../terrain'
import { tideMarks } from '../tides'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { plantMaterial } from './vegetation'

// Mushrooms (NATURE_PLAN phase 12, NATURE.md §2): fruiting bodies near the
// camera in their season, by climate. Two habits: mycorrhizal kinds under
// the crowns of their host trees; saprotrophs on open turf, scattered in
// troops or along a fairy ring's dark band (fairyRings.ts).
//
// Every mushroom comes from hashes of where it stands (a tree's position, a
// turf cell, a ring and a slot round it), not from a stream: the same
// mushroom from anywhere, and only `createFungi`'s range and frustum tests
// read the camera (the leaf-litter pattern, ready for the move-around mode).

export const FUNGUS_KINDS = ['fly-agaric', 'bolete', 'saffron-milk-cap', 'field-mushroom', 'fairy-ring-champignon', 'false-parasol'] as const
export type FungusKind = (typeof FUNGUS_KINDS)[number]

type CapShape = 'convex' | 'bun' | 'funnel' | 'umbo'

interface FungusRow {
  /** The trees it fruits under (mycorrhizal), or the turf. */
  hosts: readonly VegetationKind[] | 'grass'
  climates: readonly Climate[]
  /** Cap diameter (m), smallest to largest. */
  cap: readonly [number, number]
  /** Stem height and width, as shares of the cap's diameter (open cap). */
  stem: number
  stemWidth: number
  /** A bulb at the stem's foot (× its width). */
  bulb: number
  /** The open cap's shape. */
  shape: CapShape
  /** Linear albedo. */
  capColor: RGB
  stemColor: RGB
  gillColor: RGB
  /** Warts or scales on the cap, and their share of it. */
  spots?: { color: RGB; share: number }
  /** Fruits along fairy rings' bands too. */
  rings?: boolean
}

/**
 * The kinds (NATURE_PLAN phase 12; seasons checked 2026-11-12, Wild Food UK;
 * hosts field-guide knowledge). Sizes: field guides (First Nature, Wild Food
 * UK; false parasol Qld Fungi, 8–30 cm). Cap colours measured from photos
 * (NATURE_PLAN §12: `asset.mjs measure`, brightness as noted there); stems,
 * gills and spots est.
 */
export const FUNGI: Record<FungusKind, FungusRow> = {
  // Red cap with white warts, 8–20 cm; stem as tall, a bulb at the foot.
  'fly-agaric': {
    hosts: ['birch', 'conifer', 'stone-pine'], climates: ['temperate', 'boreal', 'polar'], cap: [0.08, 0.2], stem: 1, stemWidth: 0.14, bulb: 1.8, shape: 'convex',
    capColor: [0.38, 0.021, 0.013], stemColor: [0.62, 0.6, 0.54], gillColor: [0.62, 0.6, 0.54], spots: { color: [0.62, 0.6, 0.52], share: 0.3 }
  },
  // Penny bun: a brown bun 10–20 cm on a fat pale stem.
  bolete: {
    hosts: ['conifer', 'birch', 'broadleaf', 'stone-pine'], climates: ['temperate', 'boreal', 'polar', 'mediterranean'], cap: [0.08, 0.2], stem: 0.7, stemWidth: 0.32, bulb: 1.4, shape: 'bun',
    capColor: [0.17, 0.092, 0.049], stemColor: [0.42, 0.37, 0.25], gillColor: [0.3, 0.27, 0.12]
  },
  // Saffron milk cap: an orange funnel 4–12 cm under Mediterranean pines.
  'saffron-milk-cap': {
    hosts: ['stone-pine', 'conifer'], climates: ['mediterranean'], cap: [0.04, 0.12], stem: 0.5, stemWidth: 0.22, bulb: 1, shape: 'funnel',
    capColor: [0.52, 0.32, 0.13], stemColor: [0.45, 0.26, 0.1], gillColor: [0.45, 0.22, 0.06]
  },
  // Field mushroom: white, 3–10 cm, pink-brown gills, in grazed turf.
  'field-mushroom': {
    hosts: 'grass', climates: ['temperate', 'boreal', 'mediterranean'], cap: [0.03, 0.1], stem: 0.7, stemWidth: 0.22, bulb: 1, shape: 'convex',
    capColor: [0.71, 0.71, 0.72], stemColor: [0.62, 0.6, 0.57], gillColor: [0.3, 0.16, 0.13]
  },
  // Fairy-ring champignon: buff, 2–5 cm on a thin tall stem, in rings.
  'fairy-ring-champignon': {
    hosts: 'grass', climates: ['temperate', 'boreal', 'mediterranean'], cap: [0.02, 0.05], stem: 1.6, stemWidth: 0.12, bulb: 1, shape: 'umbo',
    capColor: [0.64, 0.47, 0.42], stemColor: [0.55, 0.42, 0.34], gillColor: [0.6, 0.5, 0.42], rings: true
  },
  // False parasol: a white cap 8–30 cm with brown scales on lawns of warm
  // coasts, in troops and rings, after rain (Qld Fungi, UF/IFAS).
  'false-parasol': {
    hosts: 'grass', climates: ['subtropical', 'tropical'], cap: [0.08, 0.28], stem: 0.9, stemWidth: 0.1, bulb: 1.3, shape: 'umbo',
    capColor: [0.62, 0.6, 0.55], stemColor: [0.6, 0.58, 0.53], gillColor: [0.55, 0.56, 0.5], spots: { color: [0.3, 0.2, 0.12], share: 0.35 }, rings: true
  }
}

export interface FungiDay {
  /** Fruiting under trees and in troops, 0 … 1.5 (the season, × 1.5 on a wet day). */
  strength: number
  /** Fruiting along rings: the ring champignon shrivels when dry and revives
   * after rain (× 2 on a wet day, × 0.3 in a Mediterranean drought; est.). */
  ringStrength: number
  kinds: FungusKind[]
}

/** The day's mushrooms, or null: out of season, under lying snow, or
 * `props.fungi: false`. `props.fungi: true` gives the climate's kinds (the
 * temperate ones where it has none) as at the peak. No draws. */
export function fungiFor(params: SceneParams): FungiDay | null {
  const force = params.overrides?.fungi
  if (force === false || params.overrides?.phenology === false) return null
  if (params.snow != null && params.snow.cover > 0.3) return null
  const climate = params.place.climate
  let kinds = FUNGUS_KINDS.filter(k => FUNGI[k].climates.includes(climate))
  if (force === true && kinds.length === 0) kinds = FUNGUS_KINDS.filter(k => FUNGI[k].climates.includes('temperate'))
  const season = force === true ? 1 : fungiSeason(params)
  if (season <= 0 || kinds.length === 0) return null
  const wet = isWetDay(params)
  const drought = climate === 'mediterranean' && mossWetness(params) < 0.5
  return { strength: season * (wet ? 1.5 : 1), ringStrength: season * (wet ? 2 : drought ? 0.3 : 1), kinds }
}

/** Ages: a closed button, half open, open. */
const AGES = 3
const SIDES = 12

/**
 * One mushroom, its cap 1 across (scale the instance by the real diameter),
 * base on y = 0 (the stem's foot 1 cm into the ground at that scale). Age 0
 * a button on a short stem, 2 the kind's open cap. ~200 triangles.
 */
export function mushroomGeometry(kind: FungusKind, age: number): BufferGeometry {
  const row = FUNGI[kind]
  const b = new MeshBuilder()
  const t = age / (AGES - 1)
  const R = 0.5
  const H = row.stem * (0.5 + 0.5 * t)
  const w = (row.stemWidth / 2) * (1.15 - 0.15 * t)
  // The cap from rim (u = 1) to centre (u = 0): rim height and the top's
  // height over it, opening with age.
  const closed = { rim: H - 0.3 * R, top: 0.55 * R }
  const open: Record<CapShape, { rim: number; top: (u: number) => number }> = {
    convex: { rim: H - 0.04 * R, top: u => 0.35 * R * Math.sqrt(1 - u * u) },
    bun: { rim: H - 0.08 * R, top: u => 0.6 * R * Math.sqrt(1 - u * u) },
    funnel: { rim: H + 0.22 * R, top: u => -0.3 * R * (1 - u ** 1.2) + 0.04 * R * Math.sqrt(1 - u * u) },
    umbo: { rim: H + 0.02 * R, top: u => 0.12 * R * Math.sqrt(1 - u * u) + 0.16 * R * Math.exp(-((u / 0.28) ** 2)) }
  }
  const o = open[row.shape]
  const rimY = closed.rim + (o.rim - closed.rim) * t
  const topAt = (u: number): number => rimY + (1 - t) * closed.top * Math.sqrt(1 - u * u) + t * o.top(u)
  // Cap radius shrinks a little for a button (its rim curled in).
  const capR = R * (0.8 + 0.2 * t)
  const ring = (r: number, y: number, color: (k: number) => RGB): number[] =>
    Array.from({ length: SIDES }, (_, k) => {
      const a = (k / SIDES) * Math.PI * 2
      return b.vertex(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r), color(k))
    })
  const band = (lo: number[], hi: number[]): void => {
    for (let k = 0; k < SIDES; k++) b.quad(lo[k], lo[(k + 1) % SIDES], hi[(k + 1) % SIDES], hi[k])
  }
  const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f]
  // Stem: foot (bulb) to under the cap.
  const stem = [
    ring(w * row.bulb, -0.02, () => shade(row.stemColor, 0.7)),
    ring(w * (1 + (row.bulb - 1) * 0.6), 0.15 * H, () => shade(row.stemColor, 0.85)),
    ring(w, 0.55 * H, () => row.stemColor),
    ring(w * 0.9, rimY + 0.05 * R, () => row.stemColor)
  ]
  for (let i = 0; i < stem.length - 1; i++) band(stem[i], stem[i + 1])
  // Underside: gills from the stem out to the rim.
  const under = [stem[stem.length - 1], ring(capR * 0.6, (rimY + 0.05 * R + rimY) / 2 + 0.02 * R, () => row.gillColor), ring(capR, rimY, () => shade(row.gillColor, 0.9))]
  for (let i = 0; i < under.length - 1; i++) band(under[i + 1], under[i])
  // Top: rim to centre, warts or scales by vertex.
  const spot = (u: number, k: number, i: number): RGB => {
    if (row.spots == null || u > 0.95) return row.capColor
    const h = hashCell(k * 7 + i, i * 13 + age * 101) / 4294967295
    // The false parasol's centre is all brown (its umbo).
    if (kind === 'false-parasol' && u < 0.25) return row.spots.color
    // Flecks, not blotches: a vertex is part spot (a cap is ~10–30 px across
    // from where it's seen, so a wart is under a pixel).
    if (h >= row.spots.share) return row.capColor
    return row.capColor.map((c, j) => c + (row.spots!.color[j] - c) * 0.55) as RGB
  }
  const us = [1, 0.85, 0.65, 0.42, 0.2, 0]
  const top = us.map((u, i) => ring(capR * u, topAt(u), k => spot(u, k, i)))
  // The gills' outer ring and the top's first ring meet at the rim: a crisp edge.
  for (let i = 0; i < top.length - 1; i++) band(top[i], top[i + 1])
  const g = b.build()
  g.userData.kind = kind
  return g
}

/** A plant in the pool as a crown on the ground. */
interface Crown {
  x: number
  y: number
  z: number
  radius: number
  kind: VegetationKind
}

function crownsOf(plants: readonly InstancedMesh[]): Crown[] {
  const out: Crown[] = []
  const m = new Matrix4()
  const s = new Vector3()
  for (const mesh of plants) {
    const kind = mesh.userData.plantKind as VegetationKind | undefined
    if (kind == null || kind === 'grass') continue
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const crown = (box.max.x - box.min.x + box.max.z - box.min.z) / 4
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      s.setFromMatrixColumn(m, 0)
      const e = m.elements
      out.push({ x: e[12], y: e[13], z: e[14], radius: crown * s.length(), kind })
    }
  }
  return out
}

const U32 = 4294967295
const hash = (a: number, b: number, salt: number): number => hashCell(a * 31 + salt * 7919, b * 17 - salt * 104729) / U32

/** Mushrooms a tree can carry at once at the peak (est.: most trees none on
 * a given day, some a few). */
const PER_TREE = 1.2
/** Turf cells (m) and the chance of a troop in one at the peak (est.: a few
 * troops per 100 m² of good pasture in a flush). */
const TROOP_CELL = 4
const TROOP_CHANCE = 0.05
/** Champignons per metre of a ring's band at the peak (est.: rings of them
 * a hand's width apart). */
const RING_PER_M = 3
/** Drawn while the cap is at least this many pixels across, and within this
 * range (m). */
const MIN_PIXELS = 2
/** Ground cover a forest floor has at least (groundCover.ts: 0..1). */
const FLOOR = 0.15
const RANGE = 60
/** Instances in the frame, all kinds. */
export const MAX_FUNGI = 3000

interface Spot {
  x: number
  z: number
  kind: FungusKind
  size: number
  age: number
  yaw: number
  hue: number
}

/** Size and age by hash: the cap across the kind's range, the young ones
 * smaller. */
function grow(kind: FungusKind, h1: number, h2: number): { size: number; age: number } {
  const age = Math.min(AGES - 1, Math.floor(h2 * AGES))
  const [lo, hi] = FUNGI[kind].cap
  return { size: (lo + (hi - lo) * h1 ** 1.3) * (0.6 + 0.4 * (age / (AGES - 1))), age }
}

/** Where today's mushrooms stand, in view and big enough to see (no meshes):
 * for createFungi and the tests. */
export function fungusSpots(ctx: PropContext, plants: readonly InstancedMesh[]): Spot[] {
  const { params } = ctx
  const day = fungiFor(params)
  if (day == null) return []
  const { coast } = params
  const [ox, oz] = coast.noiseOffset
  const crowns = crownsOf(plants)
  const heath = coast.rock != null && heathFor(params) != null
  const cam = ctx.camera.position
  const seen = (x: number, z: number, size: number): boolean => {
    const d = ctx.distance(x, z)
    return d < RANGE && size / (Math.max(d, 0.1) * ctx.pixelAngle) >= MIN_PIXELS && ctx.visible(x, ctx.ground(x, z), z, size)
  }
  /** Open turf: dense cover, no heath, not under a crown. */
  const turf = (x: number, z: number): boolean => {
    if (groundCoverAt(coast, x, z) < 0.5) return false
    if (heath && heathMaskAt(coast, x, z) > 0.5) return false
    return !crowns.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.radius * 0.9) ** 2)
  }
  const spots: Spot[] = []

  // Under the crowns of their hosts.
  for (const tree of crowns) {
    const here = day.kinds.filter(k => FUNGI[k].hosts !== 'grass' && (FUNGI[k].hosts as readonly VegetationKind[]).includes(tree.kind))
    if (here.length === 0) continue
    if (ctx.distance(tree.x, tree.z) - tree.radius > RANGE || !ctx.visible(tree.x, tree.y, tree.z, tree.radius + 1)) continue
    const [kx, kz] = [Math.round((tree.x + ox) * 16), Math.round((tree.z + oz) * 16)]
    const slots = 8
    for (let i = 0; i < slots; i++) {
      if (hash(kx, kz, i * 10 + 1) >= (PER_TREE * day.strength) / slots) continue
      // Under the outer crown, where the fine roots are.
      const r = tree.radius * (0.4 + 0.6 * hash(kx, kz, i * 10 + 2))
      const a = hash(kx, kz, i * 10 + 3) * Math.PI * 2
      const kind = here[Math.floor(hash(kx, kz, i * 10 + 4) * here.length)]
      const { size, age } = grow(kind, hash(kx, kz, i * 10 + 5), hash(kx, kz, i * 10 + 6))
      const [x, z] = [tree.x + Math.cos(a) * r, tree.z + Math.sin(a) * r]
      // On a forest floor, not bare beach sand or shingle under a tree that
      // stands on the backshore (the first render: a fly agaric on pebbles).
      if (seen(x, z, size) && groundCoverAt(coast, x, z) >= FLOOR) spots.push({ x, z, kind, size, age, yaw: hash(kx, kz, i * 10 + 7), hue: hash(kx, kz, i * 10 + 8) })
    }
  }

  // Troops on the turf.
  const grass = day.kinds.filter(k => FUNGI[k].hosts === 'grass')
  const troopKinds = grass.filter(k => k !== 'fairy-ring-champignon')
  if (troopKinds.length > 0) {
    const [c0, c1] = [Math.floor((cam.x + ox - RANGE) / TROOP_CELL), Math.floor((cam.x + ox + RANGE) / TROOP_CELL)]
    const [r0, r1] = [Math.floor((cam.z + oz - RANGE) / TROOP_CELL), Math.floor((cam.z + oz + RANGE) / TROOP_CELL)]
    for (let j = r0; j <= r1; j++)
      for (let i = c0; i <= c1; i++) {
        if (hash(i, j, 101) >= TROOP_CHANCE * day.strength) continue
        const [cx, cz] = [(i + hash(i, j, 102)) * TROOP_CELL - ox, (j + hash(i, j, 103)) * TROOP_CELL - oz]
        if (ctx.distance(cx, cz) > RANGE + 2) continue
        const kind = troopKinds[Math.floor(hash(i, j, 104) * troopKinds.length)]
        const n = 1 + Math.floor(hash(i, j, 105) * 6)
        for (let k = 0; k < n; k++) {
          const a = hash(i, j, 110 + k) * Math.PI * 2
          const r = 0.9 * Math.sqrt(hash(i, j, 120 + k))
          const [x, z] = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
          const { size, age } = grow(kind, hash(i, j, 130 + k), hash(i, j, 140 + k))
          if (seen(x, z, size) && turf(x, z)) spots.push({ x, z, kind, size, age, yaw: hash(i, j, 150 + k), hue: hash(i, j, 160 + k) })
        }
      }
  }

  // Along the fairy rings' bands, where the rings are drawn.
  const ringKinds = grass.filter(k => FUNGI[k].rings === true)
  if (ringKinds.length > 0 && fairyRingsFor(params) > 0) {
    const reach = RANGE + 25
    const [c0, c1] = [Math.floor((cam.x + ox - reach) / FAIRY_CELL), Math.floor((cam.x + ox + reach) / FAIRY_CELL)]
    const [r0, r1] = [Math.floor((cam.z + oz - reach) / FAIRY_CELL), Math.floor((cam.z + oz + reach) / FAIRY_CELL)]
    const keep = Math.min(1, 0.6 * day.ringStrength)
    for (let j = r0; j <= r1; j++)
      for (let i = c0; i <= c1; i++) {
        const ring = fairyRingCell(i, j)
        if (ring == null || ctx.distance(ring.x - ox, ring.z - oz) > RANGE + ring.r) continue
        const kind = ringKinds[Math.floor(hash(i, j, 201) * ringKinds.length)]
        const slots = Math.min(240, Math.ceil(2 * Math.PI * ring.r * RING_PER_M))
        for (let k = 0; k < slots; k++) {
          if (hash(i, j, 300 + k) >= keep) continue
          const p = fairyRingPoint(ring, ((k + hash(i, j, 600 + k)) / slots) * Math.PI * 2)
          if (p.gap < 0.5) continue
          const off = (hash(i, j, 900 + k) - 0.5) * 2 * ring.band
          const d = Math.hypot(p.x - ring.x, p.z - ring.z) || 1
          const [x, z] = [p.x + ((p.x - ring.x) / d) * off - ox, p.z + ((p.z - ring.z) / d) * off - oz]
          const { size, age } = grow(kind, hash(i, j, 1200 + k), hash(i, j, 1500 + k))
          if (seen(x, z, size) && turf(x, z)) spots.push({ x, z, kind, size, age, yaw: hash(i, j, 1800 + k), hue: hash(i, j, 2100 + k) })
        }
      }
  }
  return spots
}

/** The mushrooms in view. */
export function createFungi(ctx: PropContext, plants: readonly InstancedMesh[]): InstancedMesh[] {
  const spots = fungusSpots(ctx, plants)
  if (spots.length === 0) return []
  const { coast } = ctx.params
  // Above where the spring tides and swash reach, as the plants are.
  const dry = tideMarks(coast).spring + coast.runup + 0.2
  const thin = Math.min(1, MAX_FUNGI / spots.length)
  const up = new Vector3(0, 1, 0)
  const groups = new Map<string, { kind: FungusKind; age: number; items: { matrix: Matrix4; color: Color }[] }>()
  for (const s of spots) {
    if (s.hue >= thin) continue
    const y = ctx.ground(s.x, s.z)
    if (y < dry) continue
    const n = terrainNormal(coast, s.x, s.z, 0.3)
    if (n[1] < 0.7) continue
    // Upright (they grow against gravity), leaning a little.
    const q = new Quaternion().setFromAxisAngle(up, s.yaw * Math.PI * 2)
    const lean = new Quaternion().setFromAxisAngle(new Vector3(Math.cos(s.yaw * 9), 0, Math.sin(s.yaw * 9)), (s.hue - 0.5) * 0.25)
    const matrix = new Matrix4().compose(new Vector3(s.x, y, s.z), lean.multiply(q), new Vector3(s.size, s.size, s.size))
    const f = 0.85 + 0.3 * s.hue
    const key = `${s.kind}/${s.age}`
    if (!groups.has(key)) groups.set(key, { kind: s.kind, age: s.age, items: [] })
    groups.get(key)!.items.push({ matrix, color: new Color(f, f, f) })
  }
  const material = plantMaterial()
  const meshes: InstancedMesh[] = []
  for (const { kind, age, items } of groups.values()) {
    const mesh = new InstancedMesh(mushroomGeometry(kind, age), material, items.length)
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix)
      mesh.setColorAt(i, it.color)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.userData.kind = kind
    meshes.push(mesh)
  }
  return meshes
}
