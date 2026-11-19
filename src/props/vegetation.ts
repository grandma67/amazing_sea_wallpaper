import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry
} from 'three'

import type { RGB, VegetationKind } from '../biome'
import { beachLines } from '../beach'
import { fruitFor, fruitStage, withFruit, type Fruiting } from '../fruits'
import { BELT_RUNUP, BLOOM, bloomGrows, mossLook, phenologyFor, plantSeason, saltCanopy, SHRUB_LEE, sprayExposure, treeSaltLee, treeSaltTolerance, withBlossom, type BloomRow, type Blooming, type PlantSeason } from '../phenology'
import { SALT_TOLERANCE, shrubsHere, type ShrubSpecies } from '../shrubs'
import { placeNamed } from '../places'
import { LICHEN, MOSS_COLOR } from '../rockShore'
import { Random } from '../random'
import { hasLand, shoreToWorld, terrainNormal, worldToShore } from '../terrain'
import { tideMarks } from '../tides'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { noise3 } from './noise'
import { windDirection, windMaterials, type Bend } from './wind'
import { acacia, birch, broadleaf, bush, conifer, cypress, eucalyptus, olive, pandanus, stonePine } from './trees'
import { snowCap, snowLook, type SnowLook } from './snowCap'
import { setTrunkGrowth, trunkMoss } from './trunkMoss'

// Procedural plants, generated per scene from the seed, then scattered over
// the land behind the beach. Geometry is built at a nominal size with its
// base at the origin; instances scale and rotate it.

type Builder = (rng: Random, foliage: RGB, season?: PlantSeason) => BufferGeometry

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

const PALM_BARK: RGB = [0.3, 0.26, 0.21]
const DRY: RGB = [0.28, 0.22, 0.12]

export function palm(rng: Random, foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(8, 12)
  const bend = height * rng.range(0.05, 0.16)
  const trunk: Vector3[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    trunk.push(new Vector3(bend * t * t, height * t, bend * 0.2 * Math.sin(t * 3)))
  }
  b.mossy = 1
  b.tube(
    trunk,
    t => 0.2 * (1 - 0.35 * t) + 0.12 * Math.exp(-t * 18),
    t => scale(PALM_BARK, 0.8 + 0.25 * Math.sin(t * height * 11)),
    10
  )
  b.mossy = 0
  const crown = trunk[trunk.length - 1]

  const fronds = rng.int(12, 17)
  const up = new Vector3(0, 1, 0)
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + rng.normal(0, 0.15)
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az))
    const dead = f < 2 && rng.chance(0.5)
    const elevation = dead ? -1.0 : rng.range(0.15, 0.9)
    const length = rng.range(3.2, 4.6)
    const droop = dead ? 0.2 : rng.range(0.7, 1.3)
    const color = dead ? DRY : mix(foliage, scale(foliage, 1.4), rng.float())
    const rib: Vector3[] = []
    for (let k = 0; k <= 12; k++) {
      const s = k / 12
      rib.push(
        crown
          .clone()
          .addScaledVector(dir, length * s * Math.cos(elevation))
          .addScaledVector(up, length * s * Math.sin(elevation) - droop * length * s * s * 0.6)
      )
    }
    // Leaflets on both sides of the rib, hanging down and out.
    for (let k = 1; k < rib.length; k++) {
      const s = k / 12
      const tangent = rib[Math.min(k + 1, 12)].clone().sub(rib[k - 1]).normalize()
      const side = new Vector3().crossVectors(tangent, up).normalize()
      const leafLength = 1.1 * (1 - 0.55 * s) + 0.15
      const width = 0.11
      const tipColor = mix(color, [0.25, 0.22, 0.08], s * 0.5)
      for (const sign of [-1, 1]) {
        const out = side
          .clone()
          .multiplyScalar(sign * 0.75)
          .addScaledVector(up, -0.65)
          .addScaledVector(tangent, 0.35)
          .normalize()
        const base = rib[k]
        const tip = base.clone().addScaledVector(out, leafLength)
        const i0 = b.vertex(base.clone().addScaledVector(tangent, -width), color)
        const i1 = b.vertex(base.clone().addScaledVector(tangent, width), color)
        const i2 = b.vertex(tip.clone().addScaledVector(tangent, width * 0.2), tipColor)
        const i3 = b.vertex(tip.clone().addScaledVector(tangent, -width * 0.2), tipColor)
        b.quad(i0, i1, i2, i3)
      }
    }
    b.tube(rib, t => 0.04 * (1 - t) + 0.01, () => scale(color, 0.8), 4)
  }
  // Coconuts, or a subtropical palm's bunches (fruits.ts): the same draws
  // either way, so the palm keeps its shape; without a fruit row (phenology
  // off) the nuts as they always were.
  const fruit = season?.fruit?.[0]
  for (let c = 0; c < rng.int(3, 7); c++) {
    const az = rng.range(0, Math.PI * 2)
    const at = crown.clone().add(new Vector3(Math.cos(az) * 0.3, -0.35 - rng.float() * 0.3, Math.sin(az) * 0.3))
    if (fruit == null) {
      b.blob(at, new Vector3(0.16, 0.18, 0.16), () => [0.22, 0.2, 0.06], () => 1, 3)
      continue
    }
    const h = fruitHash(at.x * 17.3 + c, at.z * 11.1 + at.y)
    // Bunches: two or three to a crown; nuts: as many as drawn, by the crop.
    if (h >= fruit.crop * (fruit.row.shape === 'cluster' ? 0.6 : 1)) continue
    const st = fruitStage(fruit, fruitHash(h * 7.7, c + 0.5))
    if (fruit.row.shape === 'ball') {
      const k = 0.85 + 0.3 * fruitHash(c, h)
      b.blob(at, new Vector3(0.16 * k, 0.18 * k, 0.16 * k), n => scale(st.color, 0.8 + 0.3 * Math.max(0, n.y)), () => 1, 3)
      continue
    }
    // A bunch from under the crown: out on its stalk, then hanging.
    const length = fruit.row.length * st.size * (0.8 + 0.4 * fruitHash(h, c))
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const knee = at.clone().addScaledVector(out, 0.3 + length * 0.3).add(new Vector3(0, -0.1, 0))
    b.tube([crown.clone().add(new Vector3(0, -0.3, 0)), knee], () => 0.025, () => scale(st.color, 0.7), 3)
    // A broom of fruiting strands fanning down from the knee (a Canary
    // palm's bunch: orange strings of dates; plumes are the same, cream).
    const w = length * fruit.row.width * 0.5
    const strands = 14
    for (let k = 0; k < strands; k++) {
      const t = fruitHash(h * 31.7 + k, c * 3.3)
      const turn = (k / strands) * Math.PI * 2 + t
      const spread = new Vector3(Math.cos(turn), 0, Math.sin(turn)).multiplyScalar(w * (0.4 + 0.6 * t))
      const reach = length * (0.7 + 0.3 * fruitHash(k, h))
      const tip = knee.clone().add(spread).add(new Vector3(0, -reach, 0))
      const mid = knee.clone().addScaledVector(spread, 0.6).add(new Vector3(0, -reach * 0.45, 0))
      b.tube([knee, mid, tip], s => 0.018 * (1 - 0.3 * s), s => scale(st.color, 0.7 + 0.4 * s * (0.8 + 0.4 * t)), 3)
    }
  }
  return b.build()
}

function grass(rng: Random, foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const blades = rng.int(14, 26)
  const straw: RGB = [0.32, 0.28, 0.14]
  for (let i = 0; i < blades; i++) {
    const az = rng.range(0, Math.PI * 2)
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const side = new Vector3(-out.z, 0, out.x)
    const base = out.clone().multiplyScalar(rng.range(0, 0.2))
    const height = rng.range(0.4, 0.95)
    const bendAmount = rng.range(0.1, 0.5)
    // Dry season or winter: more of the blades straw (phenology.ts).
    const t = rng.float() * 0.8
    const color = mix(scale(foliage, 1.6), straw, t + (1 - t) * (season?.dry ?? 0) * 0.9)
    let prevL = -1
    let prevR = -1
    for (let k = 0; k <= 4; k++) {
      const t = k / 4
      const p = base
        .clone()
        .addScaledVector(out, bendAmount * height * t * t)
        .setY(height * t * (1 - 0.25 * bendAmount * t))
      const w = 0.025 * (1 - t) + 0.002
      const c = mix(scale(color, 0.6), color, t)
      const l = b.vertex(p.clone().addScaledVector(side, -w), c)
      const r = b.vertex(p.clone().addScaledVector(side, w), c)
      if (prevL >= 0) b.quad(prevL, prevR, r, l)
      prevL = l
      prevR = r
    }
  }
  return b.build()
}

interface KindSpec {
  build: Builder
  /** Range of distance inland from the waterline (in beach widths / metres). */
  inland: (beachWidth: number, duneWidth: number) => [number, number]
  maxDistance: number
  count: number
  scale: [number, number]
  /** Grove clumping: higher = patchier. */
  clumping: number
  /** Max tilt (radians) and whether to lean toward the sea. */
  tilt: number
  leanSeaward: boolean
  minSlope: number
  castShadow: boolean
  /** Distinct meshes generated per scene; more means less visible repetition. */
  variants: number
  /** How the plant bends in the wind. */
  bend: Bend
}

/** The shrub kinds a spec forces (`props.bloom` / `props.fruit` lists), so
 * a forced species has bushes to show on wherever the day is. */
function shrubForce(o: { bloom?: boolean | readonly string[]; fruit?: boolean | readonly string[] } | undefined): string[] {
  return [...(Array.isArray(o?.bloom) ? o.bloom : []), ...(Array.isArray(o?.fruit) ? o.fruit : [])]
}

/** A hash in [0, 1) for a palm's fruit (not a draw). */
function fruitHash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return h - Math.floor(h)
}

/** A hash of a world position in [0, 1) (not a draw). */
function positionHash(x: number, z: number, salt: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453
  return h - Math.floor(h)
}

/** A kind's shrub species here (shrubs.ts): their shares follow `offset`,
 * the crown share the older bloom rows that grow here keep, on the same hash;
 * `fruit`, the species' fruit today. */
export interface CrownShrubs {
  species: readonly ShrubSpecies[]
  offset: number
  fruit: readonly Fruiting[]
}

/** Which row (if any) a tree at (x, z) flowers with, and its colour: the
 * rows' crown shares laid end to end over one position hash; a row with a
 * shore limit only on the coast's first trees, within that many metres of
 * where the kind starts inland (`treeline`, m inland of s = 0). Past the
 * older rows' share a bush is one of the place's shrub species (`shrubs`):
 * its flowers today, its fruit today, or neither (undefined). */
export function crownBlossom(
  bloom: readonly Blooming[] | undefined,
  kind: VegetationKind,
  x: number,
  z: number,
  coast: Parameters<typeof worldToShore>[0],
  treeline = 0,
  shrubs?: CrownShrubs
): { b?: Blooming; color: number; fruit?: Fruiting } | undefined {
  const salt = kind.length * 7.1
  const u = positionHash(x, z, salt)
  const old = (bloom ?? []).filter(b => b.row.species == null)
  const picked = oldBlossom(old, kind, u, x, z, salt, coast, treeline)
  if (picked != null || shrubs == null) return picked
  let start = shrubs.offset
  for (const s of shrubs.species) {
    if (u >= start && u < start + s.share) {
      const b = bloom?.find(r => r.row.species === s.species)
      const fruit = shrubs.fruit.find(f => f.row.species === s.species)
      if (b == null && fruit == null) return undefined
      return { ...(b != null ? { b } : {}), color: b == null ? 0 : Math.floor(positionHash(z, x, salt + 1) * b.row.colors.length), ...(fruit != null ? { fruit } : {}) }
    }
    start += s.share
  }
  return undefined
}

/** The older rows (no species): as before shrub species came. */
function oldBlossom(
  bloom: readonly Blooming[],
  kind: VegetationKind,
  u: number,
  x: number,
  z: number,
  salt: number,
  coast: Parameters<typeof worldToShore>[0],
  treeline: number
): { b: Blooming; color: number } | undefined {
  if (bloom.length === 0) return undefined
  let start = 0
  for (const b of bloom) {
    if (b.row.plant !== kind) continue
    if (u < start + b.crowns) {
      if (b.row.nearShoreM != null && -worldToShore(coast, x, z)[0] - treeline > b.row.nearShoreM) return undefined
      return { b, color: Math.floor(positionHash(z, x, salt + 1) * b.row.colors.length) }
    }
    start += b.crowns
  }
  return undefined
}

/** Which shrub a bush at (x, z) is, on the blossom hash (`crownBlossom`):
 * an older bloom row's kind (`rows`: those growing here, in `BLOOM` order),
 * one of the place's species past `offset`, or `plain`. Whether or not it
 * flowers today. */
export function crownShrub(x: number, z: number, rows: readonly BloomRow[], shrubs: Pick<CrownShrubs, 'species' | 'offset'>): keyof typeof SALT_TOLERANCE {
  const u = positionHash(x, z, 'bush'.length * 7.1)
  let start = 0
  for (const r of rows) {
    if (u < start + r.crowns) return r.kind as 'gorse' | 'rock-rose' | 'wattle'
    start += r.crowns
  }
  start = shrubs.offset
  for (const s of shrubs.species) {
    if (u >= start && u < start + s.share) return s.species
    start += s.share
  }
  return 'plain'
}

/** Trees that salt spray prunes into a wedge (NATURE.md §9); palms and
 * pandanus stand tall on the strand, bushes and grass are under the cap. */
const SALT_SHEARED: readonly VegetationKind[] = ['stone-pine', 'olive', 'broadleaf', 'birch', 'acacia', 'conifer', 'cypress', 'eucalyptus']

/**
 * Salt on one plant (NATURE.md §9), from where it stands, not the camera:
 * a moderately tolerant shrub (`SALT_TOLERANCE`) within `SHRUB_LEE` of the
 * coast's first line (`front`, m inland of s = 0: `saltFront`) doesn't grow
 * (`drop`), nor a tree within `treeLee` of it (`treeSaltTolerance`); a
 * tree's height is capped by the canopy wedge (`saltCanopy`, ±15% by a
 * position hash, so the pruned canopy isn't a flat lid).
 */
export function saltOn(
  kind: VegetationKind,
  x: number,
  z: number,
  coast: Parameters<typeof worldToShore>[0],
  front: number,
  exposure: ReturnType<typeof sprayExposure>,
  bush?: { rows: readonly BloomRow[]; shrubs: Pick<CrownShrubs, 'species' | 'offset'> },
  /** How far behind `front` this tree kind starts here (`treeSaltLee`). */
  treeLee = 0
): { drop?: true; cap?: number } {
  const u = -worldToShore(coast, x, z)[0]
  if (kind === 'bush' && bush != null) {
    return u < front + SHRUB_LEE[exposure] && SALT_TOLERANCE[crownShrub(x, z, bush.rows, bush.shrubs)] === 'moderate' ? { drop: true } : {}
  }
  if (!SALT_SHEARED.includes(kind)) return {}
  if (treeLee > 0 && u < front + treeLee) return { drop: true }
  return { cap: saltCanopy(u, exposure) * (0.85 + 0.15 * positionHash(x, z, 91.3)) }
}

/** Where a kind's first plants can stand (m inland of s = 0): its start
 * (`uMin`), and on a beach not before the storm line, the frequent storm
 * run-up the vegetation line follows (NATURE.md §9). */
export function saltFront(coast: Parameters<typeof beachLines>[0] & { rock?: unknown; flat?: unknown }, uMin: number): number {
  return coast.rock != null || coast.flat != null ? uMin : Math.max(uMin, beachLines(coast).stormLine)
}

const KINDS: Record<VegetationKind, KindSpec> = {
  palm: {
    build: palm,
    inland: (bw, dw) => [bw * 0.55, bw + dw + 150],
    maxDistance: 1500,
    count: 140,
    scale: [0.75, 1.3],
    clumping: 0.5,
    tilt: 0.35,
    leanSeaward: true,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 10, flex: 0.3 }
  },
  'stone-pine': {
    build: stonePine,
    inland: (bw, dw) => [bw + dw * 0.5, 2500],
    maxDistance: 3000,
    count: 260,
    scale: [0.7, 1.3],
    clumping: 0.55,
    tilt: 0.12,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 5,
    bend: { height: 10, flex: 0.08 }
  },
  cypress: {
    build: cypress,
    inland: (bw, dw) => [bw + dw, 2500],
    maxDistance: 3000,
    count: 120,
    scale: [0.8, 1.2],
    clumping: 0.6,
    tilt: 0.03,
    leanSeaward: false,
    minSlope: 0.8,
    castShadow: true,
    variants: 4,
    bend: { height: 13, flex: 0.1 }
  },
  conifer: {
    build: conifer,
    inland: (bw, dw) => [bw + dw * 0.8, 4000],
    maxDistance: 4000,
    count: 1600,
    scale: [0.6, 1.3],
    clumping: 0.52,
    tilt: 0.05,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 5,
    bend: { height: 14, flex: 0.07 }
  },
  bush: {
    build: bush,
    inland: bw => [bw * 0.7, 1200],
    maxDistance: 900,
    count: 700,
    scale: [0.6, 1.8],
    clumping: 0.5,
    tilt: 0.1,
    leanSeaward: false,
    minSlope: 0.7,
    castShadow: true,
    variants: 5,
    bend: { height: 1.5, flex: 0.2 }
  },
  grass: {
    build: grass,
    inland: bw => [bw * 0.6, 3000],
    maxDistance: 160,
    count: 7000,
    scale: [0.7, 1.5],
    clumping: 0.35,
    tilt: 0.15,
    leanSeaward: false,
    minSlope: 0.6,
    castShadow: true,
    variants: 3,
    bend: { height: 0.8, flex: 0.7 }
  },
  broadleaf: {
    build: broadleaf,
    inland: (bw, dw) => [bw + dw * 0.6, 2500],
    maxDistance: 2500,
    count: 220,
    scale: [0.75, 1.35],
    clumping: 0.55,
    tilt: 0.06,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 10, flex: 0.12 }
  },
  olive: {
    build: olive,
    inland: (bw, dw) => [bw + dw * 0.4, 1800],
    maxDistance: 1800,
    count: 220,
    scale: [0.8, 1.3],
    clumping: 0.5,
    tilt: 0.1,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 6, flex: 0.1 }
  },
  birch: {
    build: birch,
    inland: (bw, dw) => [bw + dw * 0.8, 3000],
    maxDistance: 3000,
    count: 400,
    scale: [0.7, 1.2],
    clumping: 0.5,
    tilt: 0.06,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 13, flex: 0.18 }
  },
  acacia: {
    build: acacia,
    inland: (bw, dw) => [bw + dw * 0.5, 2500],
    maxDistance: 2500,
    count: 60,
    scale: [0.8, 1.4],
    clumping: 0.45,
    tilt: 0.05,
    leanSeaward: false,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 6, flex: 0.07 }
  },
  // Coastal gums: tall, behind the dunes, in open forest (NATURE_PLAN phase 6).
  eucalyptus: {
    build: eucalyptus,
    inland: (bw, dw) => [bw + dw * 0.6, 3000],
    maxDistance: 3000,
    count: 260,
    scale: [0.8, 1.25],
    clumping: 0.5,
    tilt: 0.06,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 20, flex: 0.1 }
  },
  pandanus: {
    build: pandanus,
    inland: (bw, dw) => [bw * 0.5, bw + dw + 120],
    maxDistance: 1200,
    count: 120,
    scale: [0.8, 1.3],
    clumping: 0.5,
    tilt: 0.25,
    leanSeaward: true,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 6, flex: 0.2 }
  }
}

/** Leaves' material. No sun glints: a low sun behind the trees catches the
 * many edge-on leaves at grazing angles, where the specular lobe spikes, and
 * the crowns glitter. Real leaves scatter that light through their blades
 * instead. Skylight reflections (indirect specular) stay. */
export function plantMaterial(snow: SnowLook | null = null): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    side: DoubleSide
  })
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);'
    )
  }
  // Boughs hold most of what falls on them; a leaf's whole face reads as snow.
  snowCap(material, snow, 0.8)
  return material
}

/** Is this tuft of grass under the snow? More of them as the cover closes, a
 * few of the tallest always showing (a hash of its position, not a draw). */
export function grassBuried(x: number, z: number, cover: number): boolean {
  const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
  return h < Math.min(0.95, cover * 1.25)
}

export function createVegetation(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast, biome } = params
  if (!hasLand(coast)) return []
  const rng = ctx.rng('vegetation')
  // Plants grow above the spring tides' swash.
  const dry = tideMarks(coast).spring + coast.runup + 0.6

  // Which plants grow here today: each of the biome's kinds, most of the time.
  // The biome's signature plant always grows; the others most of the time.
  // Framed and overlook shots are about the land, so they get everything.
  const allKinds = coast.composition === 'framed' || coast.composition === 'overlook'
  const drawnKinds = biome.vegetation.filter(
    ([, weight], i) => rng.chance(Math.min(0.95, 0.35 + weight * 0.12)) || i === 0 || allKinds
  )
  // Forced by a scene spec: those plants, at the biome's abundance (or a
  // middling one for a plant from another biome).
  const forcedKinds = params.overrides?.vegetation
  const kinds =
    forcedKinds == null
      ? drawnKinds
      : forcedKinds.map(kind => [kind, biome.vegetation.find(([k]) => k === kind)?.[1] ?? 3] as const)
  const lushness = rng.range(0.4, 1.2)
  const phenology = phenologyFor(params)
  const material = plantMaterial(snowLook(params))
  // Moss and spray-belt lichen on trunks (NATURE_PLAN phase 9); none with
  // `props.moss: false`.
  const moss = mossLook(params)
  if (moss != null) trunkMoss(material, { ...moss, mossColor: MOSS_COLOR[biome.name], lichenColor: LICHEN[biome.name] })
  const beltLine = tideMarks(coast).spring + BELT_RUNUP

  const order: VegetationKind[] = [
    'palm',
    'stone-pine',
    'olive',
    'broadleaf',
    'birch',
    'acacia',
    'pandanus',
    'conifer',
    'cypress',
    'bush',
    // Last: a 15–25 m gum 9–30 m off shows only its trunk.
    'eucalyptus'
  ]
  const exposure = sprayExposure(params.place.id)
  // Where each kind's first plants stand (m inland of s = 0): on the bare
  // rock's top or behind the marsh, and trees whose seedlings die in the
  // spray behind the first line (treeSaltTolerance). `props.saltTrees:
  // false`: anywhere, as before 0.220.
  const uMinOf = (kind: VegetationKind): number => {
    const [beachMin] = KINDS[kind].inland(coast.beachWidth, coast.duneWidth)
    return coast.rock != null || coast.flat != null ? Math.max(beachMin, coast.beachWidth) : coast.marsh != null ? Math.max(beachMin, coast.marsh.start + coast.marsh.width) : beachMin
  }
  const leeOf = (kind: VegetationKind): number =>
    params.overrides?.saltShear === false || params.overrides?.saltTrees === false || !SALT_SHEARED.includes(kind)
      ? 0
      : treeSaltLee(treeSaltTolerance(kind, params.place.id, params.place.climate), exposure)
  // Framed shots are framed by what grows between the camera and the sea: the
  // first kind that can stand a few metres in front of it (on an exposed
  // coast's first 100 m: hardy shrubs, not trees cut to stumps).
  const cameraU = -worldToShore(coast, ctx.camera.position.x, ctx.camera.position.z)[0]
  const framesHere = (kind: VegetationKind): boolean => leeOf(kind) === 0 || saltFront(coast, uMinOf(kind)) + leeOf(kind) < cameraU - 9
  const heroKind =
    coast.composition === 'framed' ? order.find(k => kinds.some(([kind]) => kind === k) && framesHere(k)) : undefined

  const meshes: InstancedMesh[] = []
  const m = new Matrix4()
  const q = new Quaternion()
  const p = new Vector3()
  const s = new Vector3()
  // Flag trees (southern beech in Tierra del Fuego) lean downwind.
  const windBent = placeNamed(params.place.id).windBent
  const downwind = windDirection(params)
  const seaward = new Vector3(Math.sin((coast.seawardAzimuthDeg * Math.PI) / 180), 0, -Math.cos((coast.seawardAzimuthDeg * Math.PI) / 180))

  for (const [kind, weight] of kinds) {
    const spec = KINDS[kind]
    const target = Math.round(spec.count * lushness * Math.min(1.5, weight / 3))
    const [, uMax] = spec.inland(coast.beachWidth, coast.duneWidth)
    // On a rocky shore nothing grows on the bare rock: plants start on top
    // of the back face (beachWidth there); behind a tidal flat's marsh.
    const uMin = uMinOf(kind)
    const seed = rng.int(0, 1e6)
    const placed: Matrix4[] = []
    const colors: Color[] = []
    const treeLee = leeOf(kind)
    const treeFront = saltFront(coast, uMin) + treeLee

    // Framed shots: a few big plants near the edges of the frame, close to
    // the camera, so the sea is seen past them.
    if (kind === heroKind) {
      const camera = ctx.camera
      const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
      const halfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
      const heroes = rng.int(2, 4)
      for (let tries = 0; tries < 200 && placed.length < heroes; tries++) {
        const edge = (rng.chance(0.5) ? 1 : -1) * halfFov * rng.range(0.55, 1.05)
        const dir = forward.clone().applyAxisAngle(new Vector3(0, 1, 0), edge)
        const dist = rng.range(9, 30)
        const x = camera.position.x + dir.x * dist
        const z = camera.position.z + dir.z * dist
        const y = ctx.ground(x, z)
        if (y < dry) continue
        // A framing tree where it can grow: further back, not cut to a stump.
        if (treeLee > 0 && -worldToShore(coast, x, z)[0] < treeFront) continue
        const size = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * rng.range(0.4, 0.9)
        const yaw = rng.range(0, Math.PI * 2)
        q.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
        if (windBent.includes(kind)) q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(downwind.z, 0, -downwind.x), rng.range(0.35, 0.6)))
        const stunted = windBent.includes(kind) ? 0.75 : 1
        placed.push(new Matrix4().compose(new Vector3(x, y - 0.1, z), q, new Vector3(size, size * stunted, size)))
        colors.push(new Color(1, 1, 1))
      }
    }

    for (let tries = 0; tries < target * 12 && placed.length < target; tries++) {
      // Concentrate samples near the camera, where plants are big on screen.
      const a = (rng.float() * 2 - 1) * spec.maxDistance * rng.float() ** 0.6
      const u = uMin + (uMax - uMin) * rng.float() ** 1.4
      const [x, z] = shoreToWorld(coast, -u, a)
      if (ctx.distance(x, z) > spec.maxDistance || ctx.distance(x, z) < 3) continue
      // Groves and clearings.
      const forest = noise3(x / 450, 5, z / 450, seed)
      const density =
        forest * 0.45 + noise3(x / 70, 0, z / 70, seed) * 0.4 + noise3(x / 15, 3, z / 15, seed) * 0.15
      if (density < spec.clumping) continue
      const y = ctx.ground(x, z)
      if (y < dry) continue
      const n = terrainNormal(coast, x, z, 1)
      if (n[1] < spec.minSlope) continue
      const size = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * rng.float()
      if (!ctx.visible(x, y + 6 * size, z, 8 * size)) continue
      // Tall plants close to the camera only at the sides of the frame, so
      // they frame the sea instead of blocking it.
      // Bushes likewise, at a closer range, and never right at our feet.
      const near = kind === 'grass' ? 0 : kind === 'bush' ? 12 : 25
      if (kind === 'bush' && ctx.distance(x, z) < 6) continue
      if (ctx.distance(x, z) < near) {
        const ndc = new Vector3(x, y + 3 * size, z).project(ctx.camera)
        if (Math.abs(ndc.x) < 0.6) continue
      }

      const bent = windBent.includes(kind)
      const tiltAxis = spec.leanSeaward
        ? new Vector3(seaward.z, 0, -seaward.x)
        : bent
          ? new Vector3(downwind.z, 0, -downwind.x)
          : new Vector3(rng.normal(), 0, rng.normal()).normalize()
      // Bent trees: 20–35° over, and stunted.
      const tilt = bent ? rng.range(0.35, 0.6) : (spec.leanSeaward ? rng.range(0.3, 1) : rng.normal(0, 0.5)) * spec.tilt
      // Palm geometry bends toward +X; turn that toward the sea.
      const yaw = spec.leanSeaward
        ? Math.atan2(-seaward.z, seaward.x) + rng.normal(0, 0.4)
        : rng.range(0, Math.PI * 2)
      q.setFromAxisAngle(tiltAxis, tilt).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw))
      p.set(x, y - 0.1 * size, z)
      // Slightly different proportions per instance, so copies of the same
      // variant don't read as clones.
      const girth = rng.range(0.85, 1.15)
      s.set(size * girth, size * rng.range(0.88, 1.12) * (bent ? 0.75 : 1), size * girth)
      placed.push(new Matrix4().compose(p, q, s))
      const tint = 0.8 + 0.4 * rng.float()
      colors.push(new Color(tint, tint * (0.9 + 0.2 * rng.float()), tint))
    }
    if (placed.length === 0) continue

    const bent = windMaterials(material, params, spec.bend)

    // Fruit on every crown of the kind (trees), apart from a shrub species'
    // fruit, which hangs on that species' bushes only (the crown's twin).
    const allFruit = fruitFor(kind, params)
    const season = withFruit(plantSeason(kind, phenology), allFruit.filter(f => f.row.species == null), phenology)
    const oldBush = BLOOM.filter(r => r.plant === 'bush' && r.species == null && bloomGrows(r, params))
    const shrubs: CrownShrubs | undefined =
      kind === 'bush'
        ? {
            species: shrubsHere(params, shrubForce(params.overrides)),
            offset: oldBush.reduce((s, r) => s + r.crowns, 0),
            fruit: allFruit.filter(f => f.row.species != null)
          }
        : undefined
    // Salt (NATURE.md §9): no tender shrubs on the front line, trees pruned
    // to the canopy wedge. Decided after placement, by position: no draws.
    // `props.saltShear: false` switches it off.
    const salted = placed.map(t =>
      params.overrides?.saltShear === false ? {} : saltOn(kind, t.elements[12], t.elements[14], coast, saltFront(coast, uMin), exposure, shrubs && { rows: oldBush, shrubs }, treeLee)
    )
    // Blossom: each tree flowers or not by its position (a hash, no draw), so
    // any share shows and a moving camera sees the same trees in flower.
    const flowers = placed.map(t => crownBlossom(season?.bloom, kind, t.elements[12], t.elements[14], coast, uMin, shrubs))
    for (let v = 0; v < spec.variants; v++) {
      const indices = placed.map((_, i) => i).filter(i => i % spec.variants === v)
      if (indices.length === 0) continue
      // A flowering twin repeats the variant's draws: the same shape, and the
      // vegetation stream moves on exactly as without blossom.
      const drawn: number[] = []
      const recorder = Random.from(() => {
        const x = rng.float()
        drawn.push(x)
        return x
      })
      const groups = new Map<string, number[]>([['', []]])
      for (const i of indices) {
        if (salted[i].drop) continue
        const f = flowers[i]
        const key = f == null ? '' : `${f.b?.row.kind ?? ''}:${f.color}:${f.fruit?.row.kind ?? ''}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(i)
      }
      const plain = spec.build(recorder, biome.foliage, season)
      plain.computeBoundingBox()
      const naturalTop = plain.boundingBox!.max.y
      for (const [key, members] of groups) {
        if (members.length === 0) continue
        let geometry = plain
        if (key !== '') {
          const f = flowers[members[0]]!
          let k = 0
          const replay = Random.from(() => {
            if (k >= drawn.length) throw new Error(`blossom twin of ${kind} drew more than its variant`)
            return drawn[k++]
          })
          const base = withFruit(season, f.fruit != null ? [...(season?.fruit ?? []), f.fruit] : [], phenology)!
          geometry = spec.build(replay, biome.foliage, f.b != null ? withBlossom(base, f.b, f.color) : base)
        }
        const mesh = new InstancedMesh(geometry, bent.material, members.length)
        mesh.customDepthMaterial = bent.depth
        mesh.userData.plantKind = kind
        // Each instance's identity at full precision (instanceMatrix is
        // float32, and the position hashes don't survive its rounding):
        // read through `plantInstances`.
        mesh.userData.plants = members.map(i => ({
          x: placed[i].elements[12],
          z: placed[i].elements[14],
          ...(kind === 'bush' && shrubs != null ? { shrub: crownShrub(placed[i].elements[12], placed[i].elements[14], oldBush, shrubs) } : {}),
          salt: salted[i]
        }))
        if (key !== '') mesh.userData.blossom = key
        members.forEach((i, j) => {
          m.copy(placed[i])
          // Above the wedge: shorter, and wider for its height (flat-topped).
          const cap = salted[i].cap
          const top = naturalTop * Math.hypot(m.elements[4], m.elements[5], m.elements[6])
          if (cap != null && top > cap) {
            const f = cap / top
            m.scale(new Vector3(Math.sqrt(f), f, Math.sqrt(f)))
          }
          // Blades under the snow (drawn all the same: the draws stay).
          if (kind === 'grass' && params.snow != null && grassBuried(m.elements[12], m.elements[14], params.snow.cover)) m.scale(new Vector3(0, 0, 0))
          mesh.setMatrixAt(j, m)
          mesh.setColorAt(j, colors[i])
        })
        if (moss != null) {
          setTrunkGrowth(mesh, moss, j => {
            const t = placed[members[j]].elements
            return { aboveLine: ctx.ground(t[12], t[14]) - beltLine, inland: -worldToShore(coast, t[12], t[14])[0] }
          })
        }
        mesh.castShadow = spec.castShadow
        mesh.receiveShadow = true
        mesh.frustumCulled = false
        // The eucalypts' off switch: built and drawn for (the stream moves on
        // as with them), left out, so diff.mjs shows only what they add.
        if (kind === 'eucalyptus' && params.overrides?.eucalyptus === false) continue
        meshes.push(mesh)
      }
    }
  }
  return meshes
}

/** One placed plant, for probes and tests (`params.mjs` `p.plants`). */
export interface PlantInstance {
  kind: VegetationKind
  x: number
  y: number
  z: number
  /** m inland of s = 0. */
  u: number
  /** Height of its top above its base, as drawn (m). */
  top: number
  /** A bush's species (`crownShrub`). */
  shrub?: keyof typeof SALT_TOLERANCE
  /** What salt did (`saltOn`): `cap` for trees; dropped bushes aren't listed. */
  salt: { drop?: true; cap?: number }
  /** From the camera (m), and whether its middle is in frame (`ctx.inFrame`). */
  distance: number
  inFrame: boolean
}

/** Every plant `createVegetation` placed, with its identity from the code's
 * own positions (not re-derived from the float32 instance matrices). */
export function plantInstances(ctx: PropContext, meshes: InstancedMesh[] = createVegetation(ctx)): PlantInstance[] {
  const out: PlantInstance[] = []
  const m = new Matrix4()
  for (const mesh of meshes) {
    const ids = mesh.userData.plants as { x: number; z: number; shrub?: PlantInstance['shrub']; salt: PlantInstance['salt'] }[] | undefined
    if (ids == null) continue
    mesh.geometry.computeBoundingBox()
    const h0 = mesh.geometry.boundingBox!.max.y
    for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, m)
      const e = m.elements
      if (e[0] === 0 && e[5] === 0) continue
      const { x, z, shrub, salt } = ids[j]
      const top = h0 * Math.hypot(e[4], e[5], e[6])
      out.push({ kind: mesh.userData.plantKind, x, y: e[13], z, u: -worldToShore(ctx.params.coast, x, z)[0], top, ...(shrub != null ? { shrub } : {}), salt, distance: ctx.distance(x, z), inFrame: ctx.inFrame(x, e[13] + top / 2, z, 1) })
    }
  }
  return out
}
