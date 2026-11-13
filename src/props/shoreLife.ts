import {
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry
} from 'three'

import { ghostCrabSeason, shoreCrabsOut } from '../animalSeasons'
import { beachLines, isStony, type BeachMaterial } from '../beach'
import type { Biome, RGB } from '../biome'
import type { OceanName } from '../oceans'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { monthInSeason } from '../seasons'
import { hasBeach, shoreToWorld, terrainNormal } from '../terrain'
import { tideMarks } from '../tides'
import { MeshBuilder } from './builder'
import { eye } from './faces'
import { skinBlob, skinCoords, skinMaterial, skinsOn } from './skins'
import { stormy, type PropContext } from './context'
import { noise3 } from './noise'

// Life at the top and bottom of the beach.
//
// Crabs: ghost crabs (Ocypode) rule tropical and subtropical sand, the
// Mediterranean's east included. They dig deep burrows, the biggest high up
// the beach with a fan of thrown-out sand beside them, and come out mostly at
// dusk and night to forage down to the water. Cooler coasts have shore crabs
// (Carcinus) at the water's edge; tropical wrack lines have hermit crabs.
//
// Shells: what lives offshore washes up. Cockles, mussels and razor clams on
// the North Atlantic; clams, mussels and sand dollars on the North Pacific;
// clams, cockles, scallops and razors in the Mediterranean; and starfish
// after a blow.
//
// Flowers grow along the strandline and the foredune, each in its season:
// beach morning glory (Ipomoea pes-caprae) round the tropics all year; sea
// bindweed (Jun–Aug), sea holly (Jul–Sep), sea daffodil (Aug–Oct) and ice
// plant (spring) in the Mediterranean; sea thrift (Apr–Aug), sea rocket
// (Jun–Oct) and the blue oysterplant (Jun–Aug, Iceland and the Arctic) up north.
//
// Stony beaches (PLAN_BIOMES 2e): ghost crabs need sand to dig in, so none on
// shingle or cobble; shore crabs hide under cobbles; fewer shells survive the
// grinding stones, and no sand dollars. Their flowers are the vegetated-shingle
// flora on the storm ridge: sea kale (May–Jul), yellow horned poppy (May–Oct),
// sea pea (Jun–Aug) and sea campion (May–Aug), with sea rocket, thrift, sea
// holly and oysterplant, which grow on sand and stones alike.

export type CrabKind = 'ghost' | 'shore' | 'hermit'
export type ShellKind = 'clam' | 'cockle' | 'scallop' | 'mussel' | 'razor' | 'sand-dollar'
export type FlowerKind =
  | 'morning-glory'
  | 'bindweed'
  | 'sea-holly'
  | 'sea-daffodil'
  | 'ice-plant'
  | 'thrift'
  | 'sea-rocket'
  | 'oysterplant'
  | 'sea-kale'
  | 'horned-poppy'
  | 'sea-pea'
  | 'sea-campion'

export interface ShoreLife {
  crab: CrabKind | null
  crabs: number
  /** Ghost crab burrows with their sand fans. */
  burrows: number
  shells: ShellKind[]
  shellCount: number
  starfish: number
  /** Flowers in bloom today. */
  flowers: FlowerKind[]
  flowerAmount: number
}

type BiomeName = Biome['name']

/** What a flower roots in: dune sand, the stones of a shingle ridge, or
 * either. Mixed beaches have both. */
export type FlowerGround = 'sand' | 'stones' | 'both'

/** Where each flower grows and its months in bloom (northern-hemisphere
 * months, shifted south of the equator by monthInSeason; null = all year). */
export const FLOWERS: Record<FlowerKind, { biomes: BiomeName[]; months: [number, number] | null; oceans?: OceanName[]; ground: FlowerGround }> = {
  'morning-glory': { biomes: ['tropical'], months: null, ground: 'sand' },
  bindweed: { biomes: ['mediterranean', 'nordic'], months: [6, 8], oceans: ['atlantic', 'pacific', 'indian'], ground: 'sand' },
  'sea-holly': { biomes: ['mediterranean', 'nordic'], months: [7, 9], oceans: ['atlantic', 'pacific', 'indian'], ground: 'both' },
  'sea-daffodil': { biomes: ['mediterranean'], months: [8, 10], ground: 'sand' },
  'ice-plant': { biomes: ['mediterranean', 'desert'], months: [3, 6], ground: 'sand' },
  thrift: { biomes: ['nordic', 'volcanic'], months: [4, 8], ground: 'both' },
  'sea-rocket': { biomes: ['nordic', 'volcanic', 'mediterranean'], months: [6, 10], ground: 'both' },
  oysterplant: { biomes: ['nordic', 'volcanic'], months: [6, 8], oceans: ['arctic', 'atlantic'], ground: 'both' },
  // Vegetated shingle: Atlantic Europe and the Baltic (sea kale), Atlantic
  // Europe and the Mediterranean (horned poppy), circumboreal (sea pea, also
  // Iceland), north-west Europe, Iceland and Norway (sea campion).
  'sea-kale': { biomes: ['nordic'], months: [5, 7], oceans: ['atlantic'], ground: 'stones' },
  'horned-poppy': { biomes: ['mediterranean', 'nordic'], months: [5, 10], oceans: ['atlantic'], ground: 'stones' },
  'sea-pea': { biomes: ['nordic', 'volcanic'], months: [6, 8], oceans: ['atlantic', 'pacific', 'arctic'], ground: 'stones' },
  'sea-campion': { biomes: ['nordic', 'volcanic'], months: [5, 8], oceans: ['atlantic', 'arctic'], ground: 'stones' }
}

/** Whether a flower roots on a beach of this material. */
export function growsOn(ground: FlowerGround, material: BeachMaterial | undefined): boolean {
  if (ground === 'both' || material === 'mixed') return true
  return (ground === 'stones') === isStony(material)
}

const SHELLS: Record<BiomeName, Partial<Record<OceanName, ShellKind[]>> & { other: ShellKind[] }> = {
  nordic: { arctic: ['mussel', 'cockle'], pacific: ['clam', 'mussel', 'sand-dollar'], other: ['cockle', 'mussel', 'razor'] },
  volcanic: { pacific: ['clam', 'mussel', 'sand-dollar'], southern: ['mussel'], other: ['mussel', 'cockle'] },
  mediterranean: { other: ['clam', 'cockle', 'scallop', 'razor'] },
  tropical: { other: ['clam', 'cockle', 'scallop'] },
  desert: { other: ['mussel', 'clam', 'cockle'] }
}

/** What lives on this beach today, or null for no beach; a scene spec's
 * `props.shoreLife` replaces the drawn fields (null: nothing). */
export function shoreLifeFor(params: SceneParams, rng: Random): ShoreLife | null {
  const drawn = drawShoreLife(params, rng)
  const force = params.overrides?.shoreLife
  if (force === undefined || drawn == null) return drawn
  if (force === null) return null
  const life = { ...drawn, ...force }
  // A crab or flowers named without a number: a typical showing.
  if (force.crab != null && force.crabs === undefined && life.crabs === 0) life.crabs = force.crab === 'ghost' ? 10 : 6
  if (force.crab === 'ghost' && force.burrows === undefined && life.burrows === 0) life.burrows = 24
  if (force.flowers != null && force.flowerAmount === undefined && life.flowerAmount === 0) life.flowerAmount = 0.7
  return life
}

function drawShoreLife(params: SceneParams, rng: Random): ShoreLife | null {
  if (!hasBeach(params.coast)) return null
  const biome = params.biome.name
  const ocean = params.sea.ocean
  const southernOcean = ocean === 'southern'
  const night = params.timeOfDay === 'night' || params.timeOfDay === 'blue-hour'
  const dusk = params.timeOfDay === 'golden-hour' || params.timeOfDay === 'sun-on-horizon'
  const material = params.coast.material
  /** Shingle or cobble all over: no sand to dig in. */
  const stones = material === 'shingle' || material === 'cobble'

  const life: ShoreLife = {
    crab: null,
    crabs: 0,
    burrows: 0,
    shells: [],
    shellCount: 0,
    starfish: 0,
    flowers: [],
    flowerAmount: 0
  }

  // Crabs. Ghost crabs by climate (PLAN_BIOMES 11d): Ocypode quadrata on
  // every subtropical sand beach from the Carolinas to Brazil, the tropics'
  // on lava coasts' sand too (Hawaii, the Galápagos); O. cursor in the
  // eastern Mediterranean.
  const climate = params.place.climate
  const warm = climate === 'tropical' || climate === 'arid'
  const ghostChance = stones
    ? 0
    : { tropical: 0.85, arid: 0.7, subtropical: 0.75, mediterranean: 0.3, temperate: biome === 'mediterranean' ? 0.1 : 0, boreal: 0, polar: 0 }[climate] *
      (biome === 'volcanic' && climate === 'tropical' ? 0.7 : 1)
  if (!southernOcean && ocean !== 'arctic') {
    if (rng.chance(ghostChance)) {
      life.crab = 'ghost'
      // Out of season they stay shut in their burrows (animalSeasons.ts).
      const season = ghostCrabSeason(params)
      life.burrows = Math.round(rng.int(8, 40) * season.burrows)
      life.crabs = Math.round((night ? rng.int(6, 18) : dusk ? rng.int(3, 9) : rng.int(0, 3)) * season.out)
    } else if (climate === 'tropical' && rng.chance(0.6)) {
      life.crab = 'hermit'
      life.crabs = rng.int(3, 12)
    } else if (!warm && rng.chance(0.45)) {
      life.crab = 'shore'
      // In winter they've moved to deeper water (the draw is made anyway).
      const crabs = rng.int(2, 7)
      life.crabs = shoreCrabsOut(params) ? crabs : 0
    }
  }
  // In a storm crabs stay down their burrows or under the wrack.
  if (stormy(params)) life.crabs = 0

  // Shells.
  const table = SHELLS[biome]
  life.shells = southernOcean ? ['mussel'] : (table[ocean] ?? table.other)
  life.shellCount = rng.int(80, 420)
  if (stones) {
    life.shells = life.shells.filter(k => k !== 'sand-dollar')
    life.shellCount = Math.round(life.shellCount * 0.3)
  }
  if ((biome === 'nordic' || biome === 'mediterranean' || (biome === 'volcanic' && ocean === 'pacific')) && rng.chance(0.3)) {
    life.starfish = rng.int(1, 6)
  }

  // Flowers in bloom (none poke through the snow; the draws stay).
  if (!southernOcean) {
    for (const [kind, where] of Object.entries(FLOWERS) as [FlowerKind, (typeof FLOWERS)[FlowerKind]][]) {
      if (!where.biomes.includes(biome)) continue
      if (where.oceans != null && !where.oceans.includes(ocean)) continue
      if (!growsOn(where.ground, material)) continue
      if (where.months != null && !monthInSeason(params, ...where.months)) continue
      if (rng.chance(0.7)) life.flowers.push(kind)
    }
    if (life.flowers.length > 0) life.flowerAmount = rng.range(0.3, 1)
    if (params.snow != null) {
      life.flowers = []
      life.flowerAmount = 0
    }
  }
  return life
}

// ---------------------------------------------------------------------------
// Geometry. Everything at real size, base on y = 0.

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

/** A dome over an outline r(θ) with radial ribs: a half shell lying convex
 * side up. */
function dome(
  b: MeshBuilder,
  center: Vector3,
  size: number,
  outline: (theta: number) => [number, number],
  height: number,
  ribs: number,
  ribDepth: number,
  color: (rho: number, theta: number) => RGB,
  segments = 28,
  rings = 7
): void {
  const c = b.vertex(center.clone().setY(center.y + height * size), color(0, 0))
  const grid: number[][] = []
  for (let r = 1; r <= rings; r++) {
    const rho = r / rings
    const row: number[] = []
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      const [ox, oz] = outline(theta)
      const rib = ribs > 0 ? ribDepth * Math.max(0, Math.cos(theta * ribs)) * rho : 0
      const y = height * Math.sqrt(Math.max(0, 1 - rho * rho)) + rib * height
      row.push(b.vertex(new Vector3(center.x + ox * rho * size, center.y + y * size, center.z + oz * rho * size), color(rho, theta)))
    }
    grid.push(row)
  }
  for (let s = 0; s < segments; s++) b.triangle(c, grid[0][s], grid[0][(s + 1) % segments])
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments
      b.quad(grid[r][s], grid[r + 1][s], grid[r + 1][s2], grid[r][s2])
    }
  }
}

export function shellGeometry(rng: Random, kind: ShellKind): BufferGeometry {
  const b = new MeshBuilder()
  const o = new Vector3()
  const bands = (base: RGB, k: number) => (rho: number) => shade(base, 0.8 + k * Math.sin(rho * 23))
  switch (kind) {
    case 'clam': {
      const base = rng.pick<RGB>([[0.6, 0.56, 0.48], [0.55, 0.45, 0.35], [0.62, 0.6, 0.56]])
      dome(b, o, rng.range(0.03, 0.05), t => [Math.cos(t), 0.82 * Math.sin(t)], 0.3, 0, 0, bands(base, 0.15))
      break
    }
    case 'cockle': {
      const base = rng.pick<RGB>([[0.58, 0.5, 0.38], [0.5, 0.38, 0.25]])
      dome(b, o, rng.range(0.02, 0.035), t => [Math.cos(t), 0.95 * Math.sin(t)], 0.5, 22, 0.25, (rho, t) =>
        shade(base, (0.75 + 0.15 * Math.sin(rho * 19)) * (Math.cos(t * 22) > 0.3 ? 1.1 : 0.85))
      )
      break
    }
    case 'scallop': {
      const base = rng.pick<RGB>([[0.55, 0.2, 0.12], [0.6, 0.45, 0.3], [0.62, 0.35, 0.3], [0.5, 0.5, 0.45]])
      // A fan, narrowing to the hinge.
      dome(b, o, rng.range(0.04, 0.07), t => {
        const r = 1 - 0.35 * Math.max(0, -Math.cos(t)) ** 1.5
        return [Math.cos(t) * r, Math.sin(t) * r]
      }, 0.22, 16, 0.3, (rho, t) => shade(base, (0.85 + 0.2 * Math.sin(rho * 15)) * (Math.cos(t * 16) > 0 ? 1.1 : 0.8)))
      break
    }
    case 'mussel': {
      const base: RGB = [0.02, 0.025, 0.04]
      // Pointed at the hinge end.
      dome(b, o, rng.range(0.035, 0.06), t => {
        const narrow = Math.cos(t) < 0 ? 0.25 : 0.45
        return [Math.cos(t), narrow * Math.sin(t)]
      }, 0.35, 0, 0, rho => mix(base, [0.08, 0.1, 0.16], 0.5 + 0.5 * Math.sin(rho * 17)))
      break
    }
    case 'razor': {
      const base: RGB = [0.25, 0.2, 0.12]
      // A long, square-ended tube half.
      dome(b, o, rng.range(0.07, 0.1), t => {
        const c = Math.cos(t)
        const s = Math.sin(t)
        const k = (Math.abs(c) ** 6 + Math.abs(s / 0.15) ** 6) ** (-1 / 6)
        return [c * k, s * k]
      }, 0.12, 0, 0, rho => shade(base, 0.8 + 0.25 * Math.sin(rho * 31)))
      break
    }
    case 'sand-dollar': {
      const base: RGB = [0.5, 0.5, 0.47]
      dome(b, o, rng.range(0.03, 0.045), t => [Math.cos(t), Math.sin(t)], 0.12, 0, 0, (rho, t) =>
        // The five-petal pattern on the test.
        shade(base, rho < 0.55 && Math.abs(Math.cos(t * 2.5)) > 0.85 ? 0.7 : 0.95)
      )
      break
    }
  }
  return b.build()
}

/** A five-armed starfish lying on the sand. */
export function starfishGeometry(rng: Random, skin = false): BufferGeometry {
  const b = new MeshBuilder()
  const color = rng.pick<RGB>([[0.55, 0.16, 0.04], [0.3, 0.07, 0.15], [0.45, 0.25, 0.08]])
  const arm = rng.range(0.05, 0.09)
  const twist = rng.range(0, 1)
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * Math.PI * 2 + 0.15 * Math.sin(i * 3 + twist * 9)
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az))
    const path = [0, 1, 2, 3, 4, 5].map(k => dir.clone().multiplyScalar((arm * k) / 5).setY(0.008 + 0.006 * Math.sin((k / 5) * Math.PI)))
    // Spines from a photo (props/skins.ts) in place of the ridged shading.
    b.tube(path, t => arm * 0.2 * (1 - 0.8 * t), (t, a) => shade(color, skin ? 1 : 0.85 + 0.25 * Math.sin(a * 5 + t * 30)), 6, skin ? skinCoords('starfish', arm * 2) : undefined)
  }
  b.blob(new Vector3(0, 0.01, 0), new Vector3(arm * 0.25, arm * 0.14, arm * 0.25), () => color, () => 1, 3, undefined, skin ? skinBlob('starfish', arm * 2, 'top') : undefined)
  return b.build()
}

/** A crab standing on its legs. */
export function crabGeometry(rng: Random, kind: CrabKind, sand: RGB, skin = false): BufferGeometry {
  const b = new MeshBuilder()
  const width = kind === 'ghost' ? rng.range(0.04, 0.055) : kind === 'shore' ? rng.range(0.05, 0.075) : rng.range(0.02, 0.03)
  const color: RGB =
    kind === 'ghost' ? mix(sand, [0.5, 0.45, 0.35], 0.5) : kind === 'shore' ? [0.06, 0.075, 0.03] : [0.32, 0.08, 0.04]
  const lift = width * 0.45
  const body = new Vector3(0, lift, 0)
  if (kind === 'hermit') {
    // Living in a borrowed snail shell: a cone of whorls on its back.
    const shell = rng.pick<RGB>([[0.5, 0.42, 0.3], [0.35, 0.25, 0.18], [0.55, 0.5, 0.45]])
    for (let w = 0; w < 4; w++) {
      const r = width * (1.1 - w * 0.22)
      b.blob(
        new Vector3(-width * 0.6 - w * width * 0.35, lift + width * 0.5 + w * width * 0.25, 0.1 * width * Math.sin(w * 2)),
        new Vector3(r, r * 0.9, r),
        n => shade(shell, 0.8 + 0.3 * Math.sin(n.y * 9 + w)),
        () => 1,
        4
      )
    }
  }
  // Carapace: wider than long, square for ghost crabs.
  const shellX = width * (kind === 'ghost' ? 0.42 : 0.38)
  const shellZ = width * 0.5
  /** A point just inside the carapace's outline (85% of the way out) in
   * the direction (x, z): legs and claws grow from it, so none floats free
   * of the body on the narrower shore and hermit crabs. */
  const rim = (x: number, z: number): Vector3 => {
    const k = 0.85 / Math.hypot(x / shellX, z / shellZ)
    return new Vector3(x * k, lift, z * k)
  }
  b.blob(
    body,
    new Vector3(shellX, width * 0.22, shellZ),
    n => shade(color, 0.75 + 0.35 * Math.max(0, n.y)),
    n => (kind === 'ghost' ? 1 + 0.12 * (n.x * n.x * n.z * n.z * 16) : 1),
    4,
    undefined,
    // Carapace grain from a photo (props/skins.ts), seen from above.
    skin ? skinBlob('crab', width, 'top') : undefined
  )
  // Four walking legs a side: out, up to the knee, down to the sand.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const along = (i - 1.5) * width * 0.22
      const spread = width * (kind === 'ghost' ? 1.1 : 0.85)
      const sweep = (i - 1.5) * 0.35
      const root = rim(along, side * width * 0.4)
      const knee = new Vector3(along + Math.sin(sweep) * spread * 0.55, lift + width * 0.35, side * (width * 0.4 + Math.cos(sweep) * spread * 0.55))
      const tip = new Vector3(along + Math.sin(sweep) * spread, 0, side * (width * 0.4 + Math.cos(sweep) * spread))
      b.tube([root, knee, tip], t => width * 0.055 * (1 - 0.6 * t), () => shade(color, 0.9), 5, skin ? skinCoords('crab', width) : undefined)
    }
    // Claws in front.
    const claw = kind === 'ghost' && side === 1 ? 1.3 : 1
    const base = rim(width * 0.4, side * width * 0.25)
    const tip = new Vector3(width * 0.75, lift * 0.6, side * width * 0.35)
    b.tube([base, tip], () => width * 0.07 * claw, () => color, 5)
    b.blob(tip, new Vector3(width * 0.16, width * 0.08, width * 0.09).multiplyScalar(claw), () => shade(color, 1.1), () => 1, 3)
    // Short eye stalks (shore and hermit crabs) with dark eyes on top.
    if (kind !== 'ghost') {
      const stalk = new Vector3(width * 0.36, lift + width * 0.16, side * width * 0.11)
      b.tube([rim(width * 0.4, side * width * 0.1).setY(lift + width * 0.08), stalk], () => width * 0.025, () => color, 4)
      eye(b, stalk.clone().add(new Vector3(width * 0.015, width * 0.02, 0)), new Vector3(0.6, 0.6, side * 0.5), width * 0.04, { iris: [0.02, 0.02, 0.02], lid: color, irisSize: 1 }, 2)
    }
    // Ghost crabs' tall eye stalks.
    if (kind === 'ghost') {
      const eye = new Vector3(width * 0.4, lift + width * 0.35, side * width * 0.18)
      b.tube([new Vector3(width * 0.35, lift + width * 0.1, side * width * 0.15), eye], () => width * 0.035, () => color, 4)
      b.blob(eye, new Vector3(width * 0.06, width * 0.1, width * 0.06), () => [0.02, 0.02, 0.02], () => 1, 3)
    }
  }
  // Mouthparts: the dark plates under the carapace's front edge.
  b.blob(rim(width * 0.4, 0).add(new Vector3(-width * 0.02, -width * 0.06, 0)), new Vector3(width * 0.04, width * 0.06, width * 0.1), () => shade(color, 0.45), () => 1, 2)
  return b.build()
}

/** A ghost crab's burrow: a dark hole and a fan of thrown-out sand. */
export function burrowGeometry(rng: Random, sand: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const r = rng.range(0.025, 0.045)
  const hole = b.vertex(new Vector3(0, -0.01, 0), [0.004, 0.004, 0.004])
  const rim: number[] = []
  for (let s = 0; s < 12; s++) {
    const t = (s / 12) * Math.PI * 2
    rim.push(b.vertex(new Vector3(Math.cos(t) * r, 0.006, Math.sin(t) * r), shade(sand, 0.45)))
  }
  for (let s = 0; s < 12; s++) b.triangle(hole, rim[(s + 1) % 12], rim[s])
  const fan = rng.range(0.12, 0.3)
  b.blob(new Vector3(r + fan * 0.6, -fan * 0.04, 0), new Vector3(fan * 0.7, fan * 0.12, fan * 0.5), n => shade(sand, 1.05 + 0.1 * n.y), n => 0.85 + 0.3 * noise3(n.x * 4, n.y * 4, n.z * 4, 7), 4)
  return b.build()
}

const LEAF: RGB = [0.05, 0.1, 0.025]
const GREY_LEAF: RGB = [0.12, 0.17, 0.15]

/** A trumpet flower opening upward at `at`. */
function trumpet(b: MeshBuilder, at: Vector3, radius: number, petal: RGB, throat: RGB, tilt: Vector3): void {
  const base = b.vertex(at, throat)
  const mouth = at.clone().addScaledVector(tilt, radius * 1.1)
  const side = new Vector3(0, 1, 0).cross(tilt)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  const up = tilt.clone().cross(side).normalize()
  const ring: number[] = []
  for (let s = 0; s < 10; s++) {
    const t = (s / 10) * Math.PI * 2
    const p = mouth.clone().addScaledVector(side, Math.cos(t) * radius).addScaledVector(up, Math.sin(t) * radius)
    ring.push(b.vertex(p, petal))
  }
  for (let s = 0; s < 10; s++) b.triangle(base, ring[s], ring[(s + 1) % 10])
  // The open face, paler toward the throat.
  const face = b.vertex(mouth.clone().addScaledVector(tilt, -radius * 0.3), mix(petal, throat, 0.6))
  for (let s = 0; s < 10; s++) b.triangle(face, ring[(s + 1) % 10], ring[s])
}

/** A daisy-like flower: a disc of thin petals round a centre, facing `up`;
 * `width` (× radius) broad petals and `rise` a cup (poppies, campions). */
function daisy(b: MeshBuilder, at: Vector3, radius: number, petal: RGB, centre: RGB, petals: number, width = 0.12, rise = 0.15): void {
  for (let i = 0; i < petals; i++) {
    const az = (i / petals) * Math.PI * 2
    const dir = new Vector3(Math.cos(az), rise, Math.sin(az))
    const thin = width < 0.3
    const steps = thin ? 1 : 2
    b.ribbon(Array.from({ length: steps + 1 }, (_, k) => at.clone().addScaledVector(dir, (radius * k) / steps)), t => radius * width * (thin ? 1 - 0.5 * t : 0.4 + 0.6 * Math.sin(Math.PI * (0.25 + 0.6 * t))), petal, new Vector3(-dir.z, 0, dir.x))
  }
  b.blob(at.clone().setY(at.y + radius * 0.05), new Vector3(radius * 0.25, radius * 0.12, radius * 0.25), () => centre, () => 1, 3)
}

/** A creeping vine: runners over the sand with leaves and trumpets (beach
 * morning glory, sea bindweed). */
function creeper(rng: Random, petal: RGB, throat: RGB, leafSize: number, flowerSize: number): BufferGeometry {
  const b = new MeshBuilder()
  const runners = rng.int(3, 6)
  for (let r = 0; r < runners; r++) {
    let az = rng.range(0, Math.PI * 2)
    const len = rng.range(0.6, 2.2)
    const path: Vector3[] = [new Vector3(0, 0.01, 0)]
    for (let k = 1; k <= 12; k++) {
      az += rng.normal(0, 0.25)
      path.push(path[k - 1].clone().add(new Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(len / 12)).setY(0.01))
    }
    b.tube(path, () => 0.004, () => [0.12, 0.08, 0.05], 4)
    path.forEach((node, k) => {
      if (k === 0) return
      // Leaves on short stalks both sides, tilted up to the sun: a mat.
      for (const side of [-1, 1]) {
        const leafAz = az + side * 1.1 + rng.normal(0, 0.3)
        const dir = new Vector3(Math.cos(leafAz), 0.5, Math.sin(leafAz)).normalize()
        const leaf = [0, 1, 2, 3, 4].map(i => node.clone().addScaledVector(dir, (leafSize * i) / 4))
        b.ribbon(leaf, t => leafSize * 0.9 * Math.sin(Math.PI * Math.min(0.95, t * 0.85 + 0.1)), shade(LEAF, rng.range(1, 1.6)))
      }
      if (rng.chance(0.2)) {
        const tilt = new Vector3(rng.normal(0, 0.4), 1, rng.normal(0, 0.4)).normalize()
        trumpet(b, node.clone().setY(0.02), flowerSize, petal, throat, tilt)
      }
    })
  }
  return b.build()
}

export function flowerGeometry(rng: Random, kind: FlowerKind): BufferGeometry {
  switch (kind) {
    case 'morning-glory':
      return creeper(rng, [0.5, 0.08, 0.32], [0.18, 0.02, 0.1], 0.1, 0.035)
    case 'bindweed':
      return creeper(rng, [0.62, 0.3, 0.45], [0.7, 0.68, 0.6], 0.045, 0.025)
  }
  const b = new MeshBuilder()
  switch (kind) {
    case 'thrift': {
      // A cushion of grassy leaves with pink pompoms on bare stalks.
      const cushion = rng.range(0.08, 0.16)
      b.blob(new Vector3(0, cushion * 0.2, 0), new Vector3(cushion, cushion * 0.45, cushion), n => shade(LEAF, 0.9 + 0.4 * n.y), n => 0.75 + 0.4 * noise3(n.x * 14, n.y * 14, n.z * 14, 3), 6)
      const pink = rng.pick<RGB>([[0.6, 0.15, 0.3], [0.55, 0.25, 0.4], [0.65, 0.4, 0.5]])
      for (let i = 0; i < rng.int(8, 22); i++) {
        const base = new Vector3(rng.normal(0, cushion * 0.4), cushion * 0.4, rng.normal(0, cushion * 0.4))
        const top = base.clone().add(new Vector3(rng.normal(0, 0.03), rng.range(0.08, 0.2), rng.normal(0, 0.03)))
        b.tube([base, top], () => 0.0018, () => [0.08, 0.1, 0.04], 3)
        b.blob(top, new Vector3(0.012, 0.011, 0.012), n => shade(pink, 0.8 + 0.3 * n.y), () => 1, 3)
      }
      break
    }
    case 'sea-rocket': {
      // Fleshy branching stems sprawling over the sand, pale lilac flowers
      // at the tips.
      const lilac: RGB = [0.5, 0.36, 0.56]
      for (let i = 0; i < rng.int(3, 6); i++) {
        const az = rng.range(0, Math.PI * 2)
        const len = rng.range(0.15, 0.35)
        const dir = new Vector3(Math.cos(az), 0.5, Math.sin(az)).normalize()
        const path = [0, 1, 2, 3].map(k => dir.clone().multiplyScalar((len * k) / 3).add(new Vector3(0, -0.02 * k * k * 0.3, 0)))
        b.tube(path, t => 0.006 * (1 - 0.5 * t), () => [0.08, 0.13, 0.06], 4)
        for (let k = 1; k <= 3; k++) {
          const leafDir = new Vector3(Math.cos(az + (k % 2 ? 1 : -1)), 0.4, Math.sin(az + (k % 2 ? 1 : -1))).normalize()
          b.ribbon([path[k], path[k].clone().addScaledVector(leafDir, 0.06)], t => 0.02 * Math.sin(Math.PI * (0.15 + t * 0.7)), [0.09, 0.15, 0.08])
        }
        const tip = path[3]
        for (let f = 0; f < 6; f++) {
          b.blob(tip.clone().add(new Vector3(rng.normal(0, 0.012), 0.01 + rng.range(0, 0.02), rng.normal(0, 0.012))), new Vector3(0.007, 0.004, 0.007), () => lilac, () => 1, 2)
        }
      }
      break
    }
    case 'sea-holly': {
      // A rosette of spiny blue-grey leaves and blue thistle heads.
      const blue: RGB = [0.2, 0.26, 0.5]
      for (let i = 0; i < rng.int(6, 10); i++) {
        const az = (i / 8) * Math.PI * 2 + rng.normal(0, 0.2)
        const dir = new Vector3(Math.cos(az), 0.45, Math.sin(az)).normalize()
        const leaf = [0, 1, 2, 3, 4, 5, 6].map(k => dir.clone().multiplyScalar((0.1 * k) / 6))
        b.ribbon(leaf, t => 0.06 * Math.sin(Math.PI * Math.min(0.95, t * 0.9 + 0.05)) * (0.7 + 0.3 * Math.abs(Math.sin(t * 14))), GREY_LEAF)
      }
      for (let i = 0; i < rng.int(1, 4); i++) {
        const top = new Vector3(rng.normal(0, 0.05), rng.range(0.15, 0.3), rng.normal(0, 0.05))
        b.tube([new Vector3(0, 0, 0), top], () => 0.004, () => GREY_LEAF, 4)
        b.blob(top, new Vector3(0.012, 0.014, 0.012), () => blue, n => 1 + 0.2 * Math.abs(Math.sin(n.x * 9) * Math.sin(n.z * 9)), 3)
        // Spiny bracts round the head.
        for (let k = 0; k < 6; k++) {
          const az = (k / 6) * Math.PI * 2
          const dir = new Vector3(Math.cos(az), -0.2, Math.sin(az))
          b.ribbon([top, top.clone().addScaledVector(dir, 0.03)], t => 0.008 * (1 - t), shade(blue, 0.8))
        }
      }
      break
    }
    case 'sea-daffodil': {
      // Strap leaves fanning out, and white lily-like flowers on stalks.
      for (let i = 0; i < rng.int(6, 10); i++) {
        const az = rng.range(0, Math.PI * 2)
        const len = rng.range(0.25, 0.45)
        const path = [0, 1, 2, 3, 4, 5].map(k => {
          const t = k / 5
          return new Vector3(Math.cos(az) * len * t * t * 0.8, len * (t - 0.6 * t * t), Math.sin(az) * len * t * t * 0.8)
        })
        b.ribbon(path, t => 0.016 * (1 - 0.5 * t), GREY_LEAF, new Vector3(-Math.sin(az), 0, Math.cos(az)))
      }
      for (let i = 0; i < rng.int(1, 3); i++) {
        const top = new Vector3(rng.normal(0, 0.04), rng.range(0.25, 0.4), rng.normal(0, 0.04))
        b.tube([new Vector3(0, 0, 0), top], () => 0.005, () => GREY_LEAF, 4)
        for (let f = 0; f < rng.int(3, 6); f++) {
          const az = rng.range(0, Math.PI * 2)
          const at = top.clone().add(new Vector3(Math.cos(az) * 0.03, 0.01, Math.sin(az) * 0.03))
          daisy(b, at, 0.04, [0.75, 0.74, 0.7], [0.7, 0.68, 0.5], 6)
          trumpet(b, at, 0.012, [0.72, 0.72, 0.66], [0.5, 0.55, 0.35], new Vector3(Math.cos(az), 0.6, Math.sin(az)).normalize())
        }
      }
      break
    }
    case 'ice-plant': {
      // A mat of fleshy finger leaves and big magenta or yellow daisies.
      const petal = rng.pick<RGB>([[0.6, 0.05, 0.32], [0.6, 0.05, 0.32], [0.65, 0.5, 0.06]])
      const size = rng.range(0.25, 0.5)
      for (let i = 0; i < Math.round(size * 90); i++) {
        const base = new Vector3(rng.normal(0, size * 0.4), 0.01, rng.normal(0, size * 0.4))
        const az = rng.range(0, Math.PI * 2)
        const tip = base.clone().add(new Vector3(Math.cos(az) * 0.07, rng.range(0.02, 0.06), Math.sin(az) * 0.07))
        b.tube([base, tip], t => 0.006 * (1 - 0.4 * t), t => mix([0.08, 0.15, 0.04], [0.3, 0.08, 0.05], t * t * 0.7), 3)
      }
      for (let i = 0; i < Math.round(size * 12); i++) {
        daisy(b, new Vector3(rng.normal(0, size * 0.35), rng.range(0.05, 0.08), rng.normal(0, size * 0.35)), rng.range(0.03, 0.045), petal, [0.6, 0.5, 0.1], 26)
      }
      break
    }
    case 'oysterplant': {
      // Sprawling blue-grey leaves flat on the black sand, clusters of small
      // pink-to-blue bells.
      const leaf: RGB = [0.15, 0.22, 0.24]
      for (let i = 0; i < rng.int(4, 7); i++) {
        let az = rng.range(0, Math.PI * 2)
        const path: Vector3[] = [new Vector3(0, 0.01, 0)]
        for (let k = 1; k <= 6; k++) {
          az += rng.normal(0, 0.3)
          path.push(path[k - 1].clone().add(new Vector3(Math.cos(az) * 0.05, 0, Math.sin(az) * 0.05)))
        }
        b.tube(path, () => 0.003, () => [0.25, 0.12, 0.15], 3)
        path.forEach((node, k) => {
          if (k === 0) return
          const dir = new Vector3(Math.cos(az + (k % 2 ? 1.1 : -1.1)), 0.1, Math.sin(az + (k % 2 ? 1.1 : -1.1))).normalize()
          b.ribbon([0, 1, 2, 3].map(j => node.clone().addScaledVector(dir, 0.012 * j)), t => 0.03 * Math.sin(Math.PI * (0.1 + t * 0.8)), leaf)
        })
        const tip = path[path.length - 1]
        for (let f = 0; f < 5; f++) {
          const bell = rng.chance(0.6) ? [0.15, 0.25, 0.6] : [0.55, 0.25, 0.45]
          b.blob(tip.clone().add(new Vector3(rng.normal(0, 0.01), 0.015 + rng.range(0, 0.01), rng.normal(0, 0.01))), new Vector3(0.005, 0.007, 0.005), () => bell as RGB, () => 1, 2)
        }
      }
      break
    }
    case 'sea-kale': {
      // A low dome of big, wavy, blue-grey cabbage leaves among the stones,
      // under a mound of small white four-petalled flowers on branched stalks.
      const width = rng.range(0.35, 0.6)
      const kale: RGB = [0.13, 0.2, 0.19]
      for (let i = 0; i < rng.int(12, 18); i++) {
        const az = rng.range(0, Math.PI * 2)
        const len = width * rng.range(0.6, 1)
        const rise = rng.range(0.4, 1.1)
        const path = [0, 1, 2, 3, 4, 5].map(k => {
          const t = k / 5
          return new Vector3(Math.cos(az) * len * t, len * rise * Math.sin(Math.PI * t * 0.8), Math.sin(az) * len * t)
        })
        // Wavy margins: the width ripples along the leaf.
        b.ribbon(path, t => len * 0.55 * Math.sin(Math.PI * Math.min(0.95, t * 0.9 + 0.08)) * (0.85 + 0.15 * Math.sin(t * 25)), t => shade(kale, 0.85 + 0.35 * t))
      }
      const white: RGB = [0.72, 0.72, 0.68]
      for (let i = 0; i < rng.int(3, 6); i++) {
        const top = new Vector3(rng.normal(0, width * 0.3), rng.range(0.3, 0.5), rng.normal(0, width * 0.3))
        b.tube([new Vector3(0, 0.05, 0), top], () => 0.006, () => [0.12, 0.17, 0.12], 4)
        for (let f = 0; f < 12; f++) {
          const at = top.clone().add(new Vector3(rng.normal(0, 0.06), rng.normal(0, 0.02), rng.normal(0, 0.06)))
          b.blob(at, new Vector3(0.028, 0.016, 0.028), n => shade(white, 0.9 + 0.15 * n.y), n => 0.8 + 0.3 * noise3(n.x * 6, n.y * 6, n.z * 6, f), 2)
        }
      }
      break
    }
    case 'horned-poppy': {
      // A rosette of lobed, silvery leaves; tall stalks with yellow
      // four-petalled poppies and long curved seed horns.
      const silver: RGB = [0.2, 0.25, 0.22]
      for (let i = 0; i < rng.int(6, 9); i++) {
        const az = (i / 7) * Math.PI * 2 + rng.normal(0, 0.2)
        const dir = new Vector3(Math.cos(az), 0.3, Math.sin(az)).normalize()
        const leaf = [0, 1, 2, 3, 4, 5, 6].map(k => dir.clone().multiplyScalar((0.18 * k) / 6))
        b.ribbon(leaf, t => 0.07 * Math.sin(Math.PI * Math.min(0.95, t * 0.9 + 0.05)) * (0.6 + 0.4 * Math.abs(Math.sin(t * 11))), silver)
      }
      const yellow: RGB = [0.72, 0.5, 0.03]
      for (let i = 0; i < rng.int(2, 4); i++) {
        const top = new Vector3(rng.normal(0, 0.08), rng.range(0.3, 0.55), rng.normal(0, 0.08))
        b.tube([new Vector3(0, 0, 0), top.clone().multiplyScalar(0.5).add(new Vector3(rng.normal(0, 0.03), 0, rng.normal(0, 0.03))), top], () => 0.004, () => silver, 4)
        daisy(b, top, rng.range(0.03, 0.04), yellow, [0.6, 0.45, 0.05], 4, 1.1, 0.5)
        // A seed horn curving out below the flower.
        const az = rng.range(0, Math.PI * 2)
        const horn = [0, 1, 2, 3].map(k => top.clone().add(new Vector3(Math.cos(az) * 0.05 * k, -0.02 - 0.012 * k * k, Math.sin(az) * 0.05 * k)))
        b.tube(horn, t => 0.003 * (1 - 0.6 * t), () => [0.1, 0.13, 0.09], 3)
      }
      break
    }
    case 'sea-pea': {
      // Sprawling stems over the stones with paired leaflets and clusters
      // of purple pea flowers.
      const leaf: RGB = [0.08, 0.14, 0.08]
      for (let i = 0; i < rng.int(6, 10); i++) {
        let az = rng.range(0, Math.PI * 2)
        const path: Vector3[] = [new Vector3(0, 0.02, 0)]
        for (let k = 1; k <= 6; k++) {
          az += rng.normal(0, 0.3)
          path.push(path[k - 1].clone().add(new Vector3(Math.cos(az) * 0.07, k < 3 ? 0.02 : -0.005, Math.sin(az) * 0.07)))
        }
        b.tube(path, () => 0.003, () => leaf, 3)
        path.forEach((node, k) => {
          if (k === 0) return
          for (const side of [-1, 1]) {
            const dir = new Vector3(Math.cos(az + side * 1.2), 0.3, Math.sin(az + side * 1.2)).normalize()
            b.ribbon([0, 1, 2].map(j => node.clone().addScaledVector(dir, 0.02 * j)), t => 0.024 * Math.sin(Math.PI * (0.1 + t * 0.8)), shade(leaf, 1.2))
          }
        })
        if (rng.chance(0.7)) {
          const tip = path[path.length - 1]
          const purple = rng.pick<RGB>([[0.3, 0.08, 0.32], [0.4, 0.12, 0.38]])
          for (let f = 0; f < 5; f++) {
            b.blob(tip.clone().add(new Vector3(rng.normal(0, 0.012), 0.04 + f * 0.008, rng.normal(0, 0.012))), new Vector3(0.008, 0.009, 0.005), n => shade(purple, 0.8 + 0.3 * n.y), () => 1, 2)
          }
          b.tube([tip, tip.clone().setY(tip.y + 0.04)], () => 0.0025, () => leaf, 3)
        }
      }
      break
    }
    case 'sea-campion': {
      // A low, grey-green cushion spilling over the stones, white flowers
      // over swollen, veined calyces.
      const cushion = rng.range(0.1, 0.22)
      const green: RGB = [0.13, 0.2, 0.15]
      b.blob(new Vector3(0, cushion * 0.05, 0), new Vector3(cushion, cushion * 0.25, cushion), n => shade(green, 0.8 + 0.4 * n.y), n => 0.75 + 0.4 * noise3(n.x * 12, n.y * 12, n.z * 12, 5), 6)
      for (let i = 0; i < rng.int(10, 22); i++) {
        const base = new Vector3(rng.normal(0, cushion * 0.45), cushion * 0.3, rng.normal(0, cushion * 0.45))
        const top = base.clone().add(new Vector3(rng.normal(0, 0.02), rng.range(0.04, 0.1), rng.normal(0, 0.02)))
        b.tube([base, top], () => 0.002, () => GREY_LEAF, 3)
        b.blob(top, new Vector3(0.007, 0.01, 0.007), () => [0.3, 0.25, 0.22], () => 1, 2)
        daisy(b, top.clone().setY(top.y + 0.008), 0.016, [0.78, 0.77, 0.74], [0.6, 0.6, 0.55], 5, 0.9, 0.35)
      }
      break
    }
  }
  return b.build()
}

// ---------------------------------------------------------------------------
// Placement.

interface Piece {
  variant: number
  matrix: Matrix4
}

export function createShoreLife(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast } = params
  const rng = ctx.rng('shore-life')
  const life = shoreLifeFor(params, rng)
  if (life == null) return []
  const camera = ctx.camera.position
  const { highTide, stormLine } = beachLines(coast)
  const sand = coast.sand.albedo
  const seed = rng.int(0, 1e6)
  const up = new Vector3(0, 1, 0)

  /** Place a small thing near the camera at shore (-u, a); false if it's
   * out of view or under our feet. */
  const place = (pieces: Piece[], variant: number, u: number, a: number, radius: number, flip = 0): boolean => {
    const [x, z] = shoreToWorld(coast, -u, a)
    const y = ctx.ground(x, z)
    if (y < 0.03) return false
    if (Math.hypot(x - camera.x, z - camera.z) < 1.2) return false
    if (!ctx.visible(x, y, z, radius)) return false
    const n = new Vector3(...terrainNormal(coast, x, z, 0.3))
    const q = new Quaternion()
      .setFromUnitVectors(up, n)
      .multiply(new Quaternion().setFromAxisAngle(up, rng.range(0, Math.PI * 2)))
    // Shells lying hollow side up: turned over and lifted by their height.
    if (flip > 0) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI))
    pieces.push({ variant, matrix: new Matrix4().compose(new Vector3(x, y + flip - 0.003, z), q, new Vector3(1, 1, 1)) })
    return true
  }
  /** Shore coordinates of a random spot within `range` m of the camera. */
  const near = (range: number): number => rng.normal(0, range)
  const camA = 0
  const camU = coast.distanceToWater

  const meshes: InstancedMesh[] = []
  const build = (geometries: BufferGeometry[], pieces: Piece[], material: MeshStandardMaterial): void => {
    geometries.forEach((geometry, v) => {
      const mine = pieces.filter(p => p.variant === v)
      if (mine.length === 0) {
        geometry.dispose()
        return
      }
      const mesh = new InstancedMesh(geometry, material, mine.length)
      mine.forEach((p, i) => mesh.setMatrixAt(i, p.matrix))
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      meshes.push(mesh)
    })
  }
  const material = (roughness: number, glints = true): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, side: DoubleSide })
    // Plants: no sun glints on edge-on petals and leaves (see vegetation.ts).
    if (!glints) {
      m.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);'
        )
      }
    }
    // Photo skins (props/skins.ts) for crabs and starfish; others unchanged.
    if (skins) skinMaterial(m)
    return m
  }
  const skins = skinsOn(params.overrides)

  // Shells and starfish: strewn on the wrack line and the lower beach.
  {
    const geometries = life.shells.flatMap(kind => [0, 1].map(() => shellGeometry(rng, kind)))
    const starfish = life.starfish > 0 ? geometries.push(starfishGeometry(rng, skins)) - 1 : -1
    const pieces: Piece[] = []
    for (let i = 0; i < life.shellCount; i++) {
      const u = rng.chance(0.6) ? highTide + rng.normal(0, 0.8) : rng.range(0.3, highTide + 2)
      const variant = rng.int(0, life.shells.length * 2 - 1)
      place(pieces, variant, u, camA + near(25), 0.1, rng.chance(0.4) ? 0.015 : 0)
    }
    for (let i = 0; i < life.starfish; i++) place(pieces, starfish, rng.range(0.5, highTide + 1), camA + near(15), 0.2)
    build(geometries, pieces, material(0.45))
  }

  // Crabs and burrows.
  if (life.crab != null) {
    const crabs = [0, 1].map(() => crabGeometry(rng, life.crab!, sand, skins))
    const pieces: Piece[] = []
    for (let i = 0; i < life.crabs * 4 && pieces.length < life.crabs; i++) {
      // Ghost crabs forage down to the swash; shore crabs stay near the
      // water; hermit crabs pick over the wrack.
      const u =
        life.crab === 'hermit' ? highTide + rng.normal(0, 1) : life.crab === 'shore' ? rng.range(0.3, highTide) : rng.range(0.5, stormLine)
      place(pieces, rng.int(0, 1), u, camA + near(12), 0.1)
    }
    build(crabs, pieces, material(0.4))
    if (life.burrows > 0) {
      const burrows = [0, 1, 2].map(() => burrowGeometry(rng, sand))
      const holes: Piece[] = []
      for (let i = 0; i < life.burrows; i++) {
        // Bigger and more of them high up the beach, above the tides.
        place(holes, rng.int(0, 2), rng.range(highTide, Math.max(stormLine + 6, camU)), camA + near(20), 0.3)
      }
      build(burrows, holes, material(0.95))
    }
  }

  // Flowers: patches along the storm line and up the foredune.
  if (life.flowers.length > 0) {
    const geometries: BufferGeometry[] = []
    const kinds: number[][] = []
    for (const kind of life.flowers) {
      kinds.push([0, 1, 2].map(() => geometries.push(flowerGeometry(rng, kind)) - 1))
    }
    const pieces: Piece[] = []
    const target = Math.round(30 + life.flowerAmount * 150)
    const uMin = Math.max(stormLine, coast.beachWidth * 0.5)
    // Up the foredune, and into the grass round us when we stand in it.
    const uMax = Math.max(coast.beachWidth + coast.duneWidth * 0.7, Math.min(camU - 2, coast.beachWidth + coast.duneWidth))
    for (let tries = 0; tries < target * 4 && pieces.length < target; tries++) {
      const a = camA + rng.normal(0, 25) * (rng.chance(0.3) ? 3 : 1)
      const u = uMin + (uMax - uMin) * rng.float()
      // Drifts of one kind, a few plants each.
      if (noise3(a / 12, u / 12, 0, seed) < 0.45) continue
      const species = kinds[rng.int(0, kinds.length - 1)]
      for (let k = rng.int(2, 7); k > 0; k--) {
        const pu = u + rng.normal(0, 0.8)
        const pa = a + rng.normal(0, 1.2)
        const [x, z] = shoreToWorld(coast, -pu, pa)
        if (ctx.ground(x, z) < tideMarks(coast).spring + coast.runup + 0.4) continue
        place(pieces, species[rng.int(0, 2)], pu, pa, 1)
      }
    }
    build(geometries, pieces, material(0.75, false))
  }
  return meshes
}
