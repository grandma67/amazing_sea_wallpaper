import {
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3
} from 'three'

import type { RGB } from '../biome'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { shoreToWorld, terrainNormal, worldToShore } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { beachLines } from './debris'
import { noise3 } from './noise'

// Larger beach animals, at real size, so they show only near the camera.
//
// Sea turtles come ashore at night to nest on tropical and warm sandy beaches,
// each species in its months: leatherbacks March–July and greens and
// hawksbills July–October in the Caribbean; olive ridleys July–December on
// Pacific Central America (the arribadas) and November–March round the Bay
// of Bengal; greens and hawksbills April–September in South-East Asia; greens
// all year in Oman, East Africa and the Galápagos; loggerheads June–August in
// the Mediterranean. The female crawls up past the tide line, digs a body pit
// and a nest, and crawls back: the tracks (symmetric for greens and
// leatherbacks, alternating for the others) are what the morning shows.
// About 60 days later the hatchlings run to the sea, mostly at night. On
// Hawaii, green turtles haul out to bask by day.
//
// Monkeys forage on beaches by day: long-tailed macaques in South-East Asia,
// white-faced capuchins in Central America, vervets in East Africa.
//
// Lizards: marine iguanas bask in black heaps on Galápagos lava shores, facing
// the sun; green iguanas on Central American and Caribbean beaches, water
// monitors on South-East Asian ones, spiny-tailed lizards (Uromastyx) on the
// Arabian coast.

export type TurtleSpecies = 'green' | 'loggerhead' | 'leatherback' | 'hawksbill' | 'olive-ridley'
export type MonkeyKind = 'macaque' | 'capuchin' | 'vervet'
export type LizardKind = 'marine-iguana' | 'green-iguana' | 'monitor' | 'spiny-tailed'
export type WildRegion =
  | 'se-asia'
  | 'central-america'
  | 'east-africa'
  | 'caribbean'
  | 'galapagos'
  | 'hawaii'
  | 'mediterranean'
  | 'arabia'

export interface Wildlife {
  region: WildRegion | null
  turtle: TurtleSpecies | null
  /** A female nesting near us now. */
  nesting: boolean
  /** Crawl tracks (up the beach and back) from tonight's nesting. */
  tracks: number
  hatchlings: number
  /** Turtles hauled out to bask (Hawaii). */
  basking: number
  monkey: MonkeyKind | null
  monkeys: number
  lizard: LizardKind | null
  lizards: number
}

/** Which part of the world a warm beach is on, from its biome and ocean. */
function regionFor(params: SceneParams, rng: Random): WildRegion | null {
  const { biome } = params
  const ocean = params.sea.ocean
  const draw = rng.float()
  if (biome.name === 'tropical') {
    if (ocean === 'pacific') return draw < 0.6 ? 'se-asia' : 'central-america'
    if (ocean === 'indian') return draw < 0.65 ? 'se-asia' : 'east-africa'
    if (ocean === 'atlantic') return 'caribbean'
  }
  if (biome.name === 'volcanic' && ocean === 'pacific' && Math.abs(params.latitudeDeg) < 25) {
    return draw < 0.5 ? 'galapagos' : 'hawaii'
  }
  // The Mediterranean Sea itself (not California or Chile).
  if (biome.name === 'mediterranean' && ocean === 'atlantic') return 'mediterranean'
  if (biome.name === 'desert' && ocean === 'indian') return 'arabia'
  return null
}

const inMonths = (month: number, from: number, to: number): boolean =>
  from <= to ? month >= from && month <= to : month >= from || month <= to

/** The species nesting in `region` in `month` (1–12), or null out of season. */
export function nestingSpecies(region: WildRegion | null, month: number, pick: number): TurtleSpecies | null {
  switch (region) {
    case 'caribbean':
      return inMonths(month, 3, 6) ? 'leatherback' : inMonths(month, 7, 10) ? (pick < 0.7 ? 'green' : 'hawksbill') : null
    case 'central-america':
      return inMonths(month, 7, 12) ? 'olive-ridley' : 'green'
    case 'se-asia':
      return inMonths(month, 4, 9) ? (pick < 0.7 ? 'green' : 'hawksbill') : inMonths(month, 11, 3) ? 'olive-ridley' : null
    case 'east-africa':
    case 'galapagos':
    case 'arabia':
      return 'green'
    case 'mediterranean':
      return inMonths(month, 6, 8) ? (pick < 0.85 ? 'loggerhead' : 'green') : null
    default:
      return null
  }
}

const MONKEYS: Partial<Record<WildRegion, [MonkeyKind, number]>> = {
  'se-asia': ['macaque', 0.3],
  'central-america': ['capuchin', 0.2],
  'east-africa': ['vervet', 0.25]
}

const LIZARDS: Partial<Record<WildRegion, [LizardKind, number]>> = {
  galapagos: ['marine-iguana', 0.85],
  'central-america': ['green-iguana', 0.25],
  caribbean: ['green-iguana', 0.2],
  'se-asia': ['monitor', 0.2],
  arabia: ['spiny-tailed', 0.25]
}

/** What's on this beach today, or null for no beach; a scene spec's
 * `props.wildlife` replaces the drawn fields (null: nothing). */
export function wildlifeFor(params: SceneParams, rng: Random): Wildlife | null {
  const drawn = drawWildlife(params, rng)
  const force = params.overrides?.wildlife
  if (force === undefined || drawn == null) return drawn
  if (force === null) return null
  const life = { ...drawn, ...force }
  // A kind named without numbers: a typical showing.
  if (force.turtle != null && force.nesting === undefined && force.tracks === undefined && force.hatchlings === undefined && force.basking === undefined && life.tracks + life.hatchlings + life.basking === 0 && !life.nesting) {
    life.nesting = true
    life.tracks = 2
  }
  if (force.monkey != null && force.monkeys === undefined && life.monkeys === 0) life.monkeys = 7
  if (force.lizard != null && force.lizards === undefined && life.lizards === 0) life.lizards = force.lizard === 'marine-iguana' ? 15 : 2
  return life
}

function drawWildlife(params: SceneParams, rng: Random): Wildlife | null {
  if (params.coast.type !== 'beach') return null
  const region = regionFor(params, rng)
  const month = Number(params.date.slice(5, 7))
  const time = params.timeOfDay
  const dark = time === 'night' || time === 'blue-hour'
  const day = !dark
  const morning = !params.evening
  // Every draw is made whatever happens, so forcing one thing keeps the rest.
  const pick = rng.float()
  const active = rng.chance(0.35)
  const nestNow = rng.chance(0.6)
  const tracks = rng.int(1, 4)
  const hatchDraw = rng.chance(0.3)
  const hatchCount = rng.int(15, 60)
  const baskDraw = rng.chance(0.45)
  const baskCount = rng.int(1, 3)
  const monkeyDraw = rng.float()
  const monkeyCount = rng.int(3, 10)
  const lizardDraw = rng.float()
  const lizardCount = rng.int(1, 3)
  const colonySize = rng.int(6, 30)

  const life: Wildlife = {
    region,
    turtle: null,
    nesting: false,
    tracks: 0,
    hatchlings: 0,
    basking: 0,
    monkey: null,
    monkeys: 0,
    lizard: null,
    lizards: 0
  }
  // Turtles: nesting (and its tracks) in season, hatchlings ~2 months later.
  const nester = nestingSpecies(region, month, pick)
  const hatcher = nestingSpecies(region, ((month + 9) % 12) + 1, pick)
  if (nester != null && active) {
    life.turtle = nester
    if (dark) {
      life.nesting = nestNow
      life.tracks = Math.max(0, tracks - 2)
    } else {
      // Fresh in the morning; by evening the wind and feet have softened them.
      life.tracks = morning ? tracks : Math.max(0, tracks - 2)
    }
  }
  if (hatcher != null && active && hatchDraw && (dark || (time === 'sun-on-horizon' && morning))) {
    life.turtle ??= hatcher
    life.hatchlings = hatchCount
  }
  if (region === 'hawaii' && day && baskDraw) {
    life.turtle = 'green'
    life.basking = baskCount
  }
  // Monkeys and lizards are out by day.
  const monkey = region != null ? MONKEYS[region] : undefined
  if (monkey != null && day && monkeyDraw < monkey[1]) {
    life.monkey = monkey[0]
    life.monkeys = monkeyCount
  }
  const lizard = region != null ? LIZARDS[region] : undefined
  if (lizard != null && day && lizardDraw < lizard[1]) {
    life.lizard = lizard[0]
    life.lizards = lizard[0] === 'marine-iguana' ? colonySize : lizardCount
  }
  return life
}

// ---------------------------------------------------------------------------
// Geometry. Everything at real size, facing +X, base on y = 0.

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]
const yawQ = (yaw: number): Quaternion => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)

const TURTLES: Record<TurtleSpecies, { length: number; shell: RGB; skin: RGB; track: number; symmetric: boolean }> = {
  green: { length: 1.0, shell: [0.2, 0.17, 0.1], skin: [0.25, 0.22, 0.16], track: 1.1, symmetric: true },
  loggerhead: { length: 0.9, shell: [0.32, 0.17, 0.08], skin: [0.4, 0.28, 0.16], track: 0.8, symmetric: false },
  leatherback: { length: 1.6, shell: [0.04, 0.045, 0.05], skin: [0.06, 0.065, 0.07], track: 1.8, symmetric: true },
  hawksbill: { length: 0.8, shell: [0.32, 0.2, 0.08], skin: [0.3, 0.24, 0.16], track: 0.75, symmetric: false },
  'olive-ridley': { length: 0.65, shell: [0.22, 0.22, 0.15], skin: [0.3, 0.3, 0.24], track: 0.7, symmetric: false }
}

/** A sea turtle on land: domed shell, long front flippers braced on the
 * sand, head forward. `sand` dusts a nesting turtle's shell; a hatchling is
 * 5 cm and dark grey. */
export function turtleGeometry(rng: Random, species: TurtleSpecies, sand: RGB, form: 'adult' | 'nesting' | 'hatchling'): BufferGeometry {
  const b = new MeshBuilder()
  const spec = TURTLES[species]
  const hatchling = form === 'hatchling'
  const length = hatchling ? rng.range(0.045, 0.06) : spec.length * rng.range(0.85, 1.1)
  const shellColor: RGB = hatchling ? [0.08, 0.08, 0.08] : spec.shell
  const skin: RGB = hatchling ? [0.1, 0.1, 0.1] : spec.skin
  const dust = form === 'nesting' ? 0.45 : form === 'adult' ? 0.15 : 0
  const seed = rng.int(0, 1e6)
  const h = length * 0.14
  const leather = species === 'leatherback' && !hatchling
  // Shell: mottled scutes, leatherbacks' seven ridges and white flecks.
  b.blob(
    new Vector3(0, h, 0),
    new Vector3(length * 0.5, length * (leather ? 0.17 : 0.13), length * (leather ? 0.3 : 0.38)),
    n => {
      const mottle = noise3(n.x * 4, n.y * 4, n.z * 4, seed)
      let c = shade(shellColor, 0.75 + 0.5 * mottle)
      if (leather && noise3(n.x * 30, n.y * 30, n.z * 30, seed + 1) > 0.78) c = [0.45, 0.45, 0.45]
      return mix(c, sand, dust * Math.max(0, n.y) * (0.6 + 0.6 * noise3(n.x * 6, 0, n.z * 6, seed + 2)))
    },
    n => {
      // Tapering to a point behind; leatherback ridges.
      const tail = n.x < 0 ? 1 - 0.18 * n.x * n.x : 1
      const ridges = leather ? 1 + 0.04 * Math.abs(Math.sin(n.z * Math.PI * 3.5)) : 1
      return tail * ridges
    },
    hatchling ? 3 : 6
  )
  // Underside.
  b.blob(new Vector3(0, h * 0.6, 0), new Vector3(length * 0.42, h * 0.5, length * 0.3), () => mix(skin, [0.6, 0.55, 0.4], 0.5), () => 1, 3)
  // Head and neck.
  b.blob(
    new Vector3(length * 0.55, h * 0.9, 0),
    new Vector3(length * 0.12, length * 0.075, length * 0.085),
    n => shade(skin, 0.8 + 0.3 * Math.max(0, n.y)),
    () => 1,
    hatchling ? 3 : 4
  )
  // Flippers: long front ones swept out and back, small rear ones.
  for (const side of [-1, 1]) {
    const front = length * (leather ? 0.62 : 0.45)
    const sweep = form === 'hatchling' ? 0.5 : rng.range(0.35, 0.8)
    const frontQ = yawQ(side * (Math.PI / 2 + sweep)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), side * -0.25))
    b.blob(
      new Vector3(length * 0.25, h * 0.5, side * length * 0.3).add(new Vector3(front * 0.45, 0, 0).applyQuaternion(frontQ)),
      new Vector3(front * 0.5, length * 0.025, length * 0.09),
      n => mix(shade(skin, 0.75 + 0.3 * Math.max(0, n.y)), sand, dust * 0.6),
      () => 1,
      3,
      frontQ
    )
    const rear = length * 0.2
    const rearQ = yawQ(side * (Math.PI / 2 + 1.1))
    b.blob(
      new Vector3(-length * 0.38, h * 0.4, side * length * 0.2).add(new Vector3(rear * 0.45, 0, 0).applyQuaternion(rearQ)),
      new Vector3(rear * 0.5, length * 0.02, length * 0.07),
      n => mix(shade(skin, 0.8 + 0.3 * Math.max(0, n.y)), sand, dust * 0.6),
      () => 1,
      3,
      rearQ
    )
  }
  // A nesting turtle sits in her body pit with the sand she threw up
  // heaped behind and round her.
  if (form === 'nesting') {
    b.blob(
      new Vector3(-length * 0.75, 0, 0),
      new Vector3(length * 0.55, length * 0.12, length * 0.75),
      n => shade(sand, 0.92 + 0.12 * noise3(n.x * 5, n.y * 5, n.z * 5, seed + 4)),
      n => 1 + 0.15 * noise3(n.x * 3, n.y * 3, n.z * 3, seed + 5),
      5
    )
  }
  return b.build()
}

const MONKEY_COLORS: Record<MonkeyKind, { fur: RGB; belly: RGB; face: RGB; cap?: RGB; length: number; tail: number }> = {
  // Grey-brown, pale below, pink face, tail as long as the body.
  macaque: { fur: [0.3, 0.25, 0.18], belly: [0.48, 0.43, 0.35], face: [0.55, 0.38, 0.32], length: 0.45, tail: 1.05 },
  // Black, with a cream face, throat and shoulders; the tail tip curled.
  capuchin: { fur: [0.05, 0.045, 0.04], belly: [0.06, 0.05, 0.045], face: [0.6, 0.45, 0.38], cap: [0.75, 0.68, 0.55], length: 0.4, tail: 1.1 },
  // Grizzled olive-grey, white belly and brow, black face.
  vervet: { fur: [0.4, 0.4, 0.32], belly: [0.7, 0.68, 0.62], face: [0.05, 0.05, 0.05], cap: [0.75, 0.74, 0.7], length: 0.45, tail: 1.3 }
}

/** A monkey walking on all fours or sitting up, tail on the sand. */
export function monkeyGeometry(rng: Random, kind: MonkeyKind, pose: 'walk' | 'sit'): BufferGeometry {
  const b = new MeshBuilder()
  const c = MONKEY_COLORS[kind]
  const size = c.length * rng.range(0.85, 1.1)
  const seed = rng.int(0, 1e6)
  const fur = (n: Vector3): RGB =>
    n.y < -0.3 ? c.belly : shade(c.fur, 0.85 + 0.3 * noise3(n.x * 5, n.y * 5, n.z * 5, seed) + 0.1 * n.y)
  const limb = (path: Vector3[], r: number): void => {
    b.tube(path, t => r * (1 - 0.3 * t), () => shade(c.fur, 0.85), 8)
  }
  let head: Vector3
  let rump: Vector3
  if (pose === 'walk') {
    const legH = size * 0.45
    const body = new Vector3(0, legH + size * 0.14, 0)
    b.blob(body, new Vector3(size * 0.45, size * 0.21, size * 0.19), fur, () => 1, 5)
    for (const side of [-1, 1]) {
      const z = side * size * 0.11
      limb([new Vector3(size * 0.3, legH + size * 0.08, z), new Vector3(size * 0.36, legH * 0.5, z * 1.2), new Vector3(size * 0.4, 0.02, z * 1.3)], size * 0.09)
      limb([new Vector3(-size * 0.3, legH + size * 0.08, z), new Vector3(-size * 0.2, legH * 0.55, z * 1.2), new Vector3(-size * 0.34, 0.02, z * 1.3)], size * 0.11)
    }
    head = new Vector3(size * 0.55, legH + size * 0.28, 0)
    rump = new Vector3(-size * 0.42, legH + size * 0.15, 0)
  } else {
    // Sitting up on its haunches, arms down in front.
    const body = new Vector3(0, size * 0.42, 0)
    // Hunched: a pear-shaped body, broad haunches on the sand.
    b.blob(body, new Vector3(size * 0.24, size * 0.36, size * 0.2), fur, n => 1 + 0.12 * Math.max(0, -n.y), 5, new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.25))
    for (const side of [-1, 1]) {
      const z = side * size * 0.15
      b.blob(new Vector3(size * 0.06, size * 0.13, z * 1.1), new Vector3(size * 0.22, size * 0.12, size * 0.1), fur, () => 1, 4)
      limb([new Vector3(size * 0.1, size * 0.6, z), new Vector3(size * 0.2, size * 0.32, z * 1.1), new Vector3(size * 0.22, 0.02, z * 1.1)], size * 0.08)
    }
    head = new Vector3(size * 0.08, size * 0.86, 0)
    rump = new Vector3(-size * 0.15, size * 0.1, 0)
  }
  // Head, with a pale cap (capuchin, vervet brow) and the bare face forward.
  b.blob(head, new Vector3(size * 0.14, size * 0.14, size * 0.13), n => (c.cap != null && n.y > 0.1 && n.x < 0.5 ? c.cap : fur(n)), () => 1, 4)
  b.blob(head.clone().add(new Vector3(size * 0.1, -size * 0.02, 0)), new Vector3(size * 0.07, size * 0.08, size * 0.08), () => c.face, () => 1, 3)
  // Tail: out behind and down to lie on the sand; a capuchin's tip curls.
  const tail = size * c.tail
  const path: Vector3[] = []
  for (let k = 0; k <= 10; k++) {
    const t = k / 10
    const side = Math.sin(t * 2.2) * tail * 0.15
    const y = Math.max(0.015, rump.y * (1 - t * 1.6))
    const curl = kind === 'capuchin' && t > 0.8 ? (t - 0.8) * tail * 0.6 : 0
    path.push(new Vector3(rump.x - t * tail * 0.85, y + curl, side))
  }
  b.tube(path, t => size * 0.035 * (1 - 0.5 * t), () => shade(c.fur, 0.8), 5)
  return b.build()
}

const LIZARD: Record<LizardKind, { length: number; tail: number; girth: number; color: RGB; crest: number }> = {
  'marine-iguana': { length: 0.9, tail: 0.55, girth: 0.07, color: [0.07, 0.07, 0.07], crest: 0.025 },
  'green-iguana': { length: 1.3, tail: 0.62, girth: 0.07, color: [0.28, 0.36, 0.2], crest: 0.03 },
  monitor: { length: 1.5, tail: 0.58, girth: 0.085, color: [0.06, 0.055, 0.045], crest: 0 },
  'spiny-tailed': { length: 0.45, tail: 0.4, girth: 0.06, color: [0.55, 0.47, 0.28], crest: 0 }
}

/** A lizard sprawled on the ground: body and tail along a gently curving
 * spine, splayed legs, a crest of spines on iguanas. */
export function lizardGeometry(rng: Random, kind: LizardKind): BufferGeometry {
  const b = new MeshBuilder()
  const spec = LIZARD[kind]
  const length = spec.length * rng.range(0.8, 1.15)
  const seed = rng.int(0, 1e6)
  const bodyLength = length * (1 - spec.tail)
  const girth = length * spec.girth
  const bend = rng.normal(0, 0.35)
  // Spine from snout (+X) to tail tip, curving sideways toward the tail.
  const spine: Vector3[] = []
  const steps = 32
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    const x = bodyLength * 0.5 - t * length
    const tailT = Math.max(0, (t - (1 - spec.tail)) / spec.tail)
    spine.push(new Vector3(x, girth * 0.8 * (1 - 0.7 * tailT), bend * length * 0.3 * tailT * tailT))
  }
  const profile = (t: number): number => {
    const head = 1 - spec.tail
    // Wedge of a head, a narrower neck, then the body.
    if (t < 0.02) return 0.3 + (t / 0.02) * 0.35
    if (t < 0.08) return 0.65 + ((t - 0.02) / 0.06) * 0.15
    if (t < 0.13) return 0.62
    if (t < head) return 0.8 + 0.2 * Math.sin(((t - 0.13) / (head - 0.13)) * Math.PI)
    return 0.8 * (1 - (t - head) / spec.tail) + 0.05
  }
  const colorAt = (t: number, angle: number): RGB => {
    const top = Math.cos(angle) < 0 ? 1 : 0.75
    const spot = noise3(t * 30, Math.cos(angle) * 2, Math.sin(angle) * 2, seed)
    let c = shade(spec.color, top * (0.8 + 0.4 * spot))
    if (kind === 'monitor' && t > 0.13 && noise3(t * length * 18, Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, seed + 3) > 0.7) c = [0.4, 0.36, 0.2]
    if (kind === 'green-iguana' && t > 1 - spec.tail && Math.sin(t * 60) > 0.6) c = shade(spec.color, 0.45)
    // Salt crusts on marine iguanas' heads.
    if (kind === 'marine-iguana' && t < 0.12 && spot > 0.5) c = [0.55, 0.55, 0.52]
    return c
  }
  b.tube(spine, (t, angle) => girth * profile(t) * (1 - 0.3 * Math.cos(angle) ** 2), colorAt, 12)
  // Legs: out from the shoulders and hips, elbows up, feet on the ground.
  for (const at of [0.14, (1 - spec.tail) * 0.92]) {
    const p = spine[Math.round(at * steps)]
    for (const side of [-1, 1]) {
      const reach = girth * 1.6
      b.tube(
        [
          new Vector3(p.x, p.y * 0.9, p.z + side * girth * 0.5),
          new Vector3(p.x + girth * 0.1, p.y * 0.95, p.z + side * reach * 0.65),
          new Vector3(p.x + girth * 0.4, 0.01, p.z + side * reach)
        ],
        t => girth * 0.36 * (1 - 0.45 * t),
        () => shade(spec.color, 0.8),
        5
      )
    }
  }
  // Crest of spines down the back.
  if (spec.crest > 0) {
    const crest = length * spec.crest
    for (let k = 2; k < steps * 0.75; k++) {
      const p = spine[k]
      const r = girth * profile(k / steps) * 0.95
      const i0 = b.vertex(new Vector3(p.x + crest * 0.3, p.y + r, p.z), shade(spec.color, 0.9))
      const i1 = b.vertex(new Vector3(p.x - crest * 0.3, p.y + r, p.z), shade(spec.color, 0.9))
      const i2 = b.vertex(new Vector3(p.x - crest * 0.2, p.y + r + crest * (1 - k / steps), p.z), shade(spec.color, 1.2))
      b.triangle(i0, i1, i2)
    }
  }
  return b.build()
}

/** A turtle's crawl: a furrowed band of churned sand along `path` (world
 * x, z), with the flipper ridges paired (symmetric gait) or staggered. */
export function trackGeometry(
  path: [number, number][],
  ground: (x: number, z: number) => number,
  width: number,
  symmetric: boolean,
  sand: RGB,
  seed: number
): BufferGeometry {
  const b = new MeshBuilder()
  const across = 9
  let prev: number[] | null = null
  let distance = 0
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i]
    const [nx, nz] = path[Math.min(i + 1, path.length - 1)]
    const [px, pz] = path[Math.max(i - 1, 0)]
    if (i > 0) distance += Math.hypot(x - path[i - 1][0], z - path[i - 1][1])
    const tx = nx - px
    const tz = nz - pz
    const tl = Math.hypot(tx, tz) || 1
    // Sideways, in the ground plane.
    const sx = -tz / tl
    const sz = tx / tl
    const ring: number[] = []
    for (let k = 0; k < across; k++) {
      const v = k / (across - 1) - 0.5
      const side = v < 0 ? 0 : 0.5
      // One flipper stroke every ~0.3 m: thrown-up ridges across each half.
      const phase = (distance / 0.3 + (symmetric ? 0 : side)) * Math.PI * 2
      const edge = 1 - Math.abs(v) * 2
      const stroke = Math.max(0, Math.sin(phase)) * Math.min(1, edge * 3) * (Math.abs(v) > 0.08 ? 1 : 0)
      // The plastron's drag furrow down the middle is flatter and smoother.
      const wobble = noise3(x * 3, z * 3, k, seed) * 0.01
      const lift = edge > 0 ? 0.012 + 0.035 * stroke + wobble : 0
      const px2 = x + sx * v * width
      const pz2 = z + sz * v * width
      const y = ground(px2, pz2) + lift
      // Churned sand in the shade of its own ridges reads darker than the
      // smooth beach (and this plain material lights a little brighter than
      // the terrain's sand shader).
      const color = shade(sand, edge > 0 ? 0.72 + 0.16 * stroke : 0.85)
      ring.push(b.vertex(new Vector3(px2, y, pz2), color))
    }
    if (prev != null) for (let k = 0; k < across - 1; k++) b.quad(prev[k], prev[k + 1], ring[k + 1], ring[k])
    prev = ring
  }
  return b.build()
}

// ---------------------------------------------------------------------------
// Placement.

interface Piece {
  variant: number
  matrix: Matrix4
}

export function createWildlife(ctx: PropContext): Mesh[] {
  const { params } = ctx
  const { coast } = params
  const rng = ctx.rng('wildlife')
  const life = wildlifeFor(params, rng)
  if (life == null) return []
  const { highTide, stormLine } = beachLines(coast)
  const sand = coast.sand.albedo
  const seed = rng.int(0, 1e6)
  const up = new Vector3(0, 1, 0)
  const seawardAz = (coast.seawardAzimuthDeg * Math.PI) / 180
  const seaward = new Vector3(Math.sin(seawardAz), 0, -Math.cos(seawardAz))
  const seaYaw = Math.atan2(-seaward.z, seaward.x)
  const sun = new Vector3(...params.sunDirection).setY(0).normalize()
  const sunYaw = Math.atan2(-sun.z, sun.x)

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: DoubleSide })
  const sandMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  const meshes: Mesh[] = []

  /** Place an animal at shore (-u, a) facing `yaw`; false if out of view,
   * in the water or under our feet. */
  const place = (pieces: Piece[], variant: number, u: number, a: number, yaw: number, radius: number, wet = 0.03): boolean => {
    const [x, z] = shoreToWorld(coast, -u, a)
    const y = ctx.ground(x, z)
    if (y < wet) return false
    if (ctx.distance(x, z) < 2) return false
    if (!ctx.visible(x, y, z, radius)) return false
    const n = new Vector3(...terrainNormal(coast, x, z, 0.3))
    const q = new Quaternion().setFromUnitVectors(up, n).multiply(yawQ(yaw))
    pieces.push({ variant, matrix: new Matrix4().compose(new Vector3(x, y - 0.005, z), q, new Vector3(1, 1, 1)) })
    return true
  }
  const build = (geometries: BufferGeometry[], pieces: Piece[]): void => {
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
  /** Where a group goes: shore coordinates [u, a] of a spot in frame on
   * the beach between depths `band`, 4 m to `maxDistance` from the camera.
   * Rays through the lower frame, marched to the ground: everything found is
   * in view, and near spots come up first. */
  const camera = ctx.camera
  const spot = ([uMin, uMax]: [number, number], maxDistance: number): [number, number] | null => {
    const origin = camera.position
    for (let tries = 0; tries < 300; tries++) {
      const dir = new Vector3(rng.range(-0.8, 0.8), rng.range(-0.95, 0.2), 0.5).unproject(camera).sub(origin).normalize()
      if (dir.y > -0.002) continue
      for (let t = 2; t < maxDistance * 1.2; t += Math.max(0.25, t * 0.03)) {
        const x = origin.x + dir.x * t
        const z = origin.z + dir.z * t
        const ground = ctx.ground(x, z)
        if (origin.y + dir.y * t > ground) continue
        const [s, a] = worldToShore(coast, x, z)
        const distance = ctx.distance(x, z)
        if (-s >= uMin && -s <= uMax && ground >= 0.03 && distance >= 4 && distance <= maxDistance) return [-s, a]
        break
      }
    }
    return null
  }
  /** Up-beach nest site: above the high-tide line, below the vegetation. */
  const nestBand: [number, number] = [highTide + 1.5, Math.max(highTide + 2, Math.min(stormLine + 4, coast.beachWidth))]

  // Turtles.
  if (life.turtle != null) {
    const spec = TURTLES[life.turtle]
    // Crawl tracks: up from the water to a nest and back down beside it.
    for (let i = 0; i < life.tracks; i++) {
      const site = spot(nestBand, 45)
      if (site == null) break
      const [top, a0] = site
      const loop = rng.range(2, 6) * (rng.chance(0.5) ? 1 : -1)
      const wander = rng.range(0, 1e3)
      const path: [number, number][] = []
      const steps = Math.ceil((top + 0.5) / 0.15)
      for (const leg of [0, 1]) {
        for (let k = 0; k <= steps; k++) {
          const t = leg === 0 ? k / steps : 1 - k / steps
          const u = -0.5 + t * (top + 0.5)
          const a = a0 + (leg === 1 ? loop * (1 - (1 - t) ** 3) : 0) + 1.2 * noise3(u * 0.15, wander, leg, seed)
          path.push(shoreToWorld(coast, -u, a))
        }
      }
      const [mx, mz] = path[steps]
      const track = new Mesh(trackGeometry(path, ctx.ground.bind(ctx), spec.track, spec.symmetric, sand, seed + i), sandMaterial)
      track.receiveShadow = true
      meshes.push(track)
      // The covered nest: a low, scuffed mound at the top.
      const mound = new MeshBuilder()
      mound.blob(new Vector3(0, 0, 0), new Vector3(spec.track * 0.9, 0.08, spec.track * 1.1), n => shade(sand, 0.9 + 0.15 * noise3(n.x * 4, n.y * 4, n.z * 4, seed + i)), n => 1 + 0.2 * noise3(n.x * 3, n.y * 3, n.z * 3, seed + 7 + i), 5)
      const nest = new Mesh(mound.build(), sandMaterial)
      nest.position.set(mx, ctx.ground(mx, mz) - 0.02, mz)
      nest.receiveShadow = true
      meshes.push(nest)
    }
    if (life.nesting) {
      const pieces: Piece[] = []
      const at = spot(nestBand, 30)
      // Facing up the beach, away from the sea, as she digs.
      if (at != null) place(pieces, 0, at[0], at[1], seaYaw + Math.PI + rng.normal(0, 0.5), spec.length)
      build([turtleGeometry(rng, life.turtle, sand, 'nesting')], pieces)
    }
    if (life.basking > 0) {
      const pieces: Piece[] = []
      const at = spot([1, highTide + 1], 35)
      for (let tries = 0; at != null && tries < life.basking * 15 && pieces.length < life.basking; tries++) {
        place(pieces, rng.int(0, 1), at[0] + rng.normal(0, 1.5), at[1] + rng.normal(0, 4), rng.range(0, Math.PI * 2), spec.length)
      }
      build([0, 1].map(() => turtleGeometry(rng, life.turtle!, sand, 'adult')), pieces)
    }
    if (life.hatchlings > 0) {
      // A boil of hatchlings from one nest, scattering down toward the sea.
      const pieces: Piece[] = []
      const at = spot(nestBand, 15)
      const [u0, a0] = at ?? [0, 0]
      for (let i = 0; at != null && i < life.hatchlings * 3 && pieces.length < life.hatchlings; i++) {
        const t = rng.float()
        const u = u0 * (1 - t) + 0.3 * t
        const a = a0 + rng.normal(0, 0.4 + 2.5 * t)
        place(pieces, rng.int(0, 1), u, a, seaYaw + rng.normal(0, 0.5), 0.1)
      }
      build([0, 1].map(() => turtleGeometry(rng, life.turtle!, sand, 'hatchling')), pieces)
    }
  }

  // Monkeys: a troop on the upper beach, by the trees.
  if (life.monkey != null && life.monkeys > 0) {
    const geometries = [monkeyGeometry(rng, life.monkey, 'walk'), monkeyGeometry(rng, life.monkey, 'sit'), monkeyGeometry(rng, life.monkey, 'walk')]
    const pieces: Piece[] = []
    const at = spot([highTide, Math.max(highTide + 1, coast.beachWidth)], 30)
    const [u0, a0] = at ?? [0, 0]
    for (let i = 0; at != null && i < life.monkeys * 5 && pieces.length < life.monkeys; i++) {
      const u = u0 + rng.normal(0, 3)
      place(pieces, rng.int(0, 2), u, a0 + rng.normal(0, 5), rng.range(0, Math.PI * 2), 0.5)
    }
    build(geometries, pieces)
  }

  // Lizards.
  if (life.lizard != null && life.lizards > 0) {
    const kind = life.lizard
    const geometries = [0, 1, 2].map(() => lizardGeometry(rng, kind))
    const pieces: Piece[] = []
    // Marine iguanas heap together near the water, facing the sun; the others
    // keep to the wrack line (monitors) or the top of the beach.
    const zone: [number, number] =
      kind === 'marine-iguana'
        ? [0.5, highTide + 2]
        : kind === 'monitor'
          ? [highTide - 1, highTide + 1]
          : [stormLine, Math.max(stormLine + 1, coast.beachWidth)]
    const at = spot(zone, kind === 'spiny-tailed' ? 12 : 25)
    const [u0, a0] = at ?? [0, 0]
    const spread = kind === 'marine-iguana' ? 2.5 : 6
    for (let i = 0; at != null && i < life.lizards * 6 && pieces.length < life.lizards; i++) {
      const yaw = kind === 'marine-iguana' ? sunYaw + rng.normal(0, 0.4) : rng.range(0, Math.PI * 2)
      place(pieces, rng.int(0, 2), Math.max(0.3, u0 + rng.normal(0, spread * 0.4)), a0 + rng.normal(0, spread), yaw, 0.6)
    }
    build(geometries, pieces)
  }
  return meshes
}
