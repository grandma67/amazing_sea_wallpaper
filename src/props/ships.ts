import { DoubleSide, Euler, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry, type Object3D } from 'three'

import type { RGB } from '../biome'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced, type ShipKind } from '../sceneSpec'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { fbm3, noise3 } from './noise'
import { lampSprite, lightsOn, shipLightsFor, shows } from './shipLights'
import { SprayBuilder } from './surf'

// Vessels on the water: sloops, catamarans, motor yachts, trawlers, dhows,
// container ships and tankers; in polar seas dinghies, trawlers, expedition
// cruise ships and research icebreakers instead (polarFleet). Everything is built per date with randomised
// colours, paint stripes and weathering. Waterline at y = 0, bow toward +X.

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]

const WHITE: RGB = [0.78, 0.78, 0.76]
const DARK_GLASS: RGB = [0.02, 0.025, 0.03]
const TEAK: RGB = [0.36, 0.24, 0.13]
const STEEL: RGB = [0.45, 0.46, 0.47]
const RUST: RGB = [0.28, 0.11, 0.04]
const ANTIFOULING: RGB[] = [
  [0.35, 0.04, 0.03],
  [0.03, 0.03, 0.035],
  [0.05, 0.12, 0.25]
]

interface HullSpec {
  length: number
  beam: number
  freeboard: number
  draft: number
  color: RGB
  stripe: RGB
  bottom: RGB
  deck: RGB
  /** 0 = pristine, 1 = heavily rusted / weathered. */
  rust: number
  /** How much higher the bow is than the stern, as a fraction of freeboard. */
  sheerRise?: number
  seed: number
}

/** A boat's waterline size, for floating it and for its wake: length and
 * beam of one hull (m), freeboard, and for a catamaran the distance of each
 * hull's centreline from the middle. Stored on `geometry.userData.hull`. */
export interface HullSize {
  length: number
  beam: number
  freeboard: number
  spacing: number
}

const hullSizes = new WeakMap<MeshBuilder, HullSize>()

function withHull(b: MeshBuilder): BufferGeometry {
  const geometry = b.build()
  geometry.userData.hull = hullSizes.get(b)
  return geometry
}

/** Half-width of the hull at `t` (0 stern, 1 bow) as a fraction of half the
 * beam: full transom, widest just aft of midships, fine bow. Mirrored in
 * ocean.ts hullHalfWidth. */
export function hullShape(t: number): number {
  return t < 0.45 ? 0.8 + 0.2 * Math.sin((t / 0.45) * Math.PI * 0.5) : Math.max(0.015, 1 - ((t - 0.45) / 0.55) ** 1.7)
}

/** Lofted hull with a paint stripe at the waterline, antifouling below it,
 * and rust that blooms in patches and runs down from the deck in streaks. */
function hull(b: MeshBuilder, s: HullSpec): void {
  hullSizes.set(b, { length: s.length, beam: s.beam, freeboard: s.freeboard, spacing: 0 })
  const stations = 36
  const around = 14
  const rings: number[][] = []
  const deckLeft: number[] = []
  const deckRight: number[] = []
  const sheerRise = s.sheerRise ?? 0.35
  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const x = (t - 0.5) * s.length
    const half = (s.beam / 2) * hullShape(t)
    const depth = s.draft * (0.45 + 0.55 * Math.sin(Math.min(t, 0.96) * Math.PI))
    const sheer = s.freeboard * (1 + sheerRise * t * t)
    const ring: number[] = []
    for (let k = 0; k <= around; k++) {
      const a = (k / around) * Math.PI
      const y = sheer - (sheer + depth) * Math.sin(a) ** 0.55
      const z = -half * Math.cos(a) * (0.92 + 0.08 * Math.min(1, y / s.freeboard + 0.5))
      let color: RGB = y < 0 ? s.bottom : y < s.freeboard * 0.16 ? s.stripe : s.color
      if (y > sheer * 0.9) color = shade(s.color, 0.85)
      if (s.rust > 0 && y > 0) {
        const patches = Math.max(0, fbm3(x * 0.5, y * 2.2, z * 0.5, s.seed) - 0.45) * 3
        const streak = Math.max(0, noise3(x * 1.9, 0.5, z * 0.3, s.seed + 9) - 0.62) * 4 * Math.min(1, y / sheer + 0.2)
        color = mix(color, shade(RUST, 0.8 + 0.4 * noise3(x, y, z, s.seed + 3)), Math.min(0.85, s.rust * (patches + streak)))
      }
      ring.push(b.vertex(new Vector3(x, y, z), color))
    }
    rings.push(ring)
    deckLeft.push(b.vertex(new Vector3(x, sheer, -half * 0.97), s.deck))
    deckRight.push(b.vertex(new Vector3(x, sheer, half * 0.97), s.deck))
  }
  for (let i = 0; i < stations; i++) {
    for (let k = 0; k < around; k++) b.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1])
    b.quad(deckLeft[i], deckRight[i], deckRight[i + 1], deckLeft[i + 1])
  }
  // Transom.
  const stern = rings[0]
  const center = b.vertex(new Vector3(-s.length / 2, s.freeboard * 0.3, 0), shade(s.color, 0.8))
  for (let k = 0; k < around; k++) b.triangle(center, stern[k + 1], stern[k])
}

function box(b: MeshBuilder, min: Vector3, max: Vector3, color: RGB): void {
  const faces: [number, number, number][][] = [
    [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
  ]
  for (const face of faces) {
    const [a, c, d, e] = face.map(([x, y, z]) =>
      b.vertex(new Vector3(x ? max.x : min.x, y ? max.y : min.y, z ? max.z : min.z), color)
    )
    b.quad(a, c, d, e)
  }
}

/** A cabin/bridge block with a band of dark windows around it. */
function cabin(b: MeshBuilder, min: Vector3, max: Vector3, color: RGB, windows = true): void {
  box(b, min, max, color)
  if (!windows) return
  const h = max.y - min.y
  const e = 0.02
  box(
    b,
    new Vector3(min.x - e, min.y + h * 0.5, min.z - e),
    new Vector3(max.x + e, min.y + h * 0.8, max.z + e),
    DARK_GLASS
  )
}

/** A cambered sail between three corners, with horizontal panel seams. */
function sail(b: MeshBuilder, head: Vector3, tack: Vector3, clew: Vector3, camber: number, color: RGB, side: Vector3): void {
  const rows = 10
  const cols = 6
  const grid: number[][] = []
  for (let r = 0; r <= rows; r++) {
    const v = r / rows
    const row: number[] = []
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * (1 - v)
      // Bilinear blend of the triangle corners.
      const p = tack.clone().lerp(clew, u).lerp(head, v)
      const belly = Math.sin(Math.PI * (u / Math.max(1 - v, 1e-3))) * camber * (1 - v * 0.7)
      p.addScaledVector(side, belly)
      const seam = r % 2 === 0 ? 0.88 : 1
      row.push(b.vertex(p, shade(color, seam)))
    }
    grid.push(row)
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) b.quad(grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c])
  }
}

function sailColor(rng: Random): RGB {
  return rng.weighted<RGB>([
    [[0.86, 0.85, 0.8], 8],
    [[0.75, 0.62, 0.45], 2],
    [[0.7, 0.25, 0.12], 1],
    [[0.15, 0.22, 0.5], 1]
  ])
}

function yachtHullColor(rng: Random): RGB {
  return rng.weighted<RGB>([
    [WHITE, 6],
    [[0.04, 0.07, 0.16], 2],
    [[0.45, 0.06, 0.05], 1],
    [[0.06, 0.25, 0.22], 1],
    [[0.55, 0.55, 0.52], 1]
  ])
}

function rig(b: MeshBuilder, rng: Random, mastX: number, deckY: number, length: number, mastHeight: number): void {
  b.tube([new Vector3(mastX, deckY, 0), new Vector3(mastX, deckY + mastHeight, 0)], () => 0.06 + length * 0.002, () => STEEL, 6)
  b.tube([new Vector3(mastX, deckY + 1.1, 0), new Vector3(mastX - length * 0.45, deckY + 1.15, 0)], () => 0.05, () => STEEL, 5)
  const color = sailColor(rng)
  const side = new Vector3(0, 0, rng.chance(0.5) ? 1 : -1)
  sail(
    b,
    new Vector3(mastX, deckY + mastHeight * 0.97, 0),
    new Vector3(mastX, deckY + 1.15, 0),
    new Vector3(mastX - length * 0.45, deckY + 1.2, 0),
    rng.range(0.3, 0.7),
    color,
    side
  )
  sail(
    b,
    new Vector3(mastX, deckY + mastHeight * 0.82, 0),
    new Vector3(length * 0.47, deckY + 0.35, 0),
    new Vector3(mastX + length * 0.03, deckY + 0.7, 0),
    rng.range(0.3, 0.8),
    rng.chance(0.85) ? color : sailColor(rng),
    side
  )
}

function sloop(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(8, 16)
  const deckY = length * 0.09
  hull(b, {
    length,
    beam: length * 0.32,
    freeboard: deckY,
    draft: length * 0.12,
    color: yachtHullColor(rng),
    stripe: rng.pick<RGB>([[0.05, 0.08, 0.2], [0.5, 0.05, 0.04], WHITE]),
    bottom: rng.pick(ANTIFOULING),
    deck: TEAK,
    rust: 0,
    seed: rng.int(0, 1e6)
  })
  cabin(b, new Vector3(-length * 0.2, deckY, -length * 0.1), new Vector3(length * 0.08, deckY + length * 0.06, length * 0.1), WHITE)
  rig(b, rng, length * 0.08, deckY, length, length * rng.range(1.2, 1.45))
  return withHull(b)
}

function catamaran(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(10, 16)
  const deckY = length * 0.1
  const color = rng.chance(0.8) ? WHITE : yachtHullColor(rng)
  const bottom = rng.pick(ANTIFOULING)
  const seed = rng.int(0, 1e6)
  // Two slender hulls, side by side.
  const single = new MeshBuilder()
  hull(single, { length, beam: length * 0.11, freeboard: deckY, draft: length * 0.06, color, stripe: color, bottom, deck: WHITE, rust: 0, sheerRise: 0.1, seed })
  for (const side of [-1, 1]) b.merge(single, new Vector3(0, 0, side * length * 0.24))
  hullSizes.set(b, { ...hullSizes.get(single)!, spacing: length * 0.24 })
  box(b, new Vector3(-length * 0.4, deckY, -length * 0.26), new Vector3(length * 0.2, deckY + 0.3, length * 0.26), WHITE)
  cabin(b, new Vector3(-length * 0.3, deckY + 0.3, -length * 0.18), new Vector3(length * 0.05, deckY + 0.3 + length * 0.09, length * 0.18), WHITE)
  rig(b, rng, length * 0.08, deckY + 0.3, length, length * 1.3)
  return withHull(b)
}

function motorYacht(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(14, 30)
  const deckY = length * 0.09
  const color = yachtHullColor(rng)
  hull(b, {
    length,
    beam: length * 0.27,
    freeboard: deckY,
    draft: length * 0.07,
    color,
    stripe: rng.pick<RGB>([DARK_GLASS, [0.6, 0.5, 0.3], WHITE]),
    bottom: rng.pick(ANTIFOULING),
    deck: TEAK,
    rust: 0,
    sheerRise: 0.5,
    seed: rng.int(0, 1e6)
  })
  // Stacked, receding superstructure decks.
  const decks = rng.int(1, 3)
  let y = deckY
  for (let d = 0; d < decks; d++) {
    const inset = d * length * 0.08
    const h = length * 0.065
    cabin(
      b,
      new Vector3(-length * 0.38 + inset, y, -length * (0.11 - d * 0.015)),
      new Vector3(length * 0.18 - inset, y + h, length * (0.11 - d * 0.015)),
      WHITE
    )
    y += h
  }
  b.tube([new Vector3(-length * 0.05, y, -length * 0.06), new Vector3(-length * 0.02, y + length * 0.06, 0), new Vector3(-length * 0.05, y, length * 0.06)], () => 0.08, () => WHITE, 5)
  return withHull(b)
}

function trawler(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(10, 22)
  const deckY = length * 0.12
  const color = rng.pick<RGB>([
    [0.1, 0.22, 0.42],
    [0.5, 0.08, 0.05],
    [0.12, 0.3, 0.18],
    [0.05, 0.05, 0.06],
    [0.6, 0.45, 0.12],
    [0.62, 0.62, 0.58]
  ])
  hull(b, {
    length,
    beam: length * 0.34,
    freeboard: deckY,
    draft: length * 0.11,
    color,
    stripe: rng.pick<RGB>([WHITE, [0.6, 0.1, 0.05], [0.7, 0.55, 0.1]]),
    bottom: rng.pick(ANTIFOULING),
    deck: [0.3, 0.3, 0.3],
    rust: rng.range(0.3, 0.9),
    sheerRise: 0.6,
    seed: rng.int(0, 1e6)
  })
  cabin(b, new Vector3(length * 0.02, deckY, -length * 0.12), new Vector3(length * 0.25, deckY + length * 0.16, length * 0.12), rng.chance(0.7) ? WHITE : shade(color, 1.2))
  const mastTop = deckY + length * 0.55
  b.tube([new Vector3(length * 0.12, deckY, 0), new Vector3(length * 0.12, mastTop, 0)], () => 0.08, () => STEEL, 5)
  // Outrigger booms and a stern A-frame.
  for (const side of [-1, 1]) {
    b.tube([new Vector3(length * 0.12, deckY + length * 0.3, 0), new Vector3(length * 0.05, deckY + length * 0.22, side * length * 0.45)], () => 0.05, () => STEEL, 4)
    b.tube([new Vector3(-length * 0.42, deckY, side * length * 0.13), new Vector3(-length * 0.45, deckY + length * 0.25, 0)], () => 0.06, () => STEEL, 4)
  }
  return withHull(b)
}

function dhow(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(10, 18)
  const deckY = length * 0.1
  const wood: RGB = mix([0.3, 0.18, 0.09], [0.45, 0.32, 0.18], rng.float())
  hull(b, {
    length,
    beam: length * 0.3,
    freeboard: deckY,
    draft: length * 0.1,
    color: wood,
    stripe: rng.pick<RGB>([wood, [0.65, 0.6, 0.5], [0.1, 0.3, 0.45]]),
    bottom: [0.55, 0.5, 0.42],
    deck: shade(wood, 0.8),
    rust: rng.range(0.1, 0.4),
    sheerRise: 0.9,
    seed: rng.int(0, 1e6)
  })
  // Raked mast carrying a big lateen sail on a long angled yard.
  const mastFoot = new Vector3(length * 0.05, deckY, 0)
  const mastTop = new Vector3(length * 0.12, deckY + length * 0.8, 0)
  b.tube([mastFoot, mastTop], () => 0.12, () => shade(wood, 0.8), 5)
  const yardFore = new Vector3(length * 0.5, deckY + length * 0.15, 0)
  const yardAft = new Vector3(-length * 0.45, deckY + length * 1.05, 0)
  b.tube([yardFore, yardAft], () => 0.07, () => shade(wood, 0.8), 4)
  const cloth = mix([0.82, 0.77, 0.66], [0.7, 0.6, 0.45], rng.float())
  sail(b, yardAft, yardFore, new Vector3(-length * 0.3, deckY + 0.6, 0), rng.range(0.5, 1.1), cloth, new Vector3(0, 0, 1))
  return withHull(b)
}

function containerShip(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(150, 300)
  const beam = length * 0.14
  const deckY = length * 0.06
  const color = rng.pick<RGB>([
    [0.25, 0.04, 0.03],
    [0.04, 0.06, 0.14],
    [0.05, 0.05, 0.05],
    [0.08, 0.2, 0.12],
    [0.45, 0.45, 0.43]
  ])
  hull(b, {
    length,
    beam,
    freeboard: deckY,
    draft: length * 0.05,
    color,
    stripe: [0.35, 0.04, 0.03],
    bottom: [0.35, 0.04, 0.03],
    deck: [0.3, 0.1, 0.07],
    rust: rng.range(0.15, 0.6),
    sheerRise: 0.15,
    seed: rng.int(0, 1e6)
  })
  cabin(b, new Vector3(-length * 0.47, deckY, -beam * 0.42), new Vector3(-length * 0.39, deckY + length * 0.13, beam * 0.42), WHITE)
  box(b, new Vector3(-length * 0.46, deckY + length * 0.13, -beam * 0.08), new Vector3(-length * 0.43, deckY + length * 0.16, beam * 0.08), rng.pick<RGB>([[0.6, 0.1, 0.05], [0.05, 0.05, 0.05], WHITE]))
  const palette: RGB[] = [
    [0.55, 0.1, 0.06],
    [0.1, 0.25, 0.5],
    [0.6, 0.45, 0.1],
    [0.15, 0.4, 0.2],
    [0.6, 0.6, 0.58],
    [0.45, 0.2, 0.1],
    [0.05, 0.3, 0.35],
    [0.5, 0.3, 0.05]
  ]
  const bays = Math.floor((length * 0.78) / 13)
  for (let i = 0; i < bays; i++) {
    const x0 = -length * 0.37 + i * 13
    const tiers = rng.int(2, 7)
    for (let r = -3; r <= 3; r++) {
      if (!rng.chance(0.85)) continue
      const z0 = r * beam * 0.13
      for (let tier = 0; tier < tiers; tier++) {
        box(
          b,
          new Vector3(x0, deckY + tier * 2.6, z0 - beam * 0.06),
          new Vector3(x0 + 12, deckY + (tier + 1) * 2.6 - 0.1, z0 + beam * 0.06),
          shade(rng.pick(palette), 0.75 + 0.4 * rng.float())
        )
      }
    }
  }
  return withHull(b)
}

function tanker(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(180, 330)
  const beam = length * 0.17
  const deckY = length * 0.045
  const color = rng.pick<RGB>([
    [0.05, 0.05, 0.06],
    [0.3, 0.05, 0.04],
    [0.04, 0.08, 0.18],
    [0.08, 0.18, 0.1]
  ])
  hull(b, {
    length,
    beam,
    freeboard: deckY,
    draft: length * 0.06,
    color,
    stripe: [0.4, 0.05, 0.04],
    bottom: [0.4, 0.05, 0.04],
    deck: [0.25, 0.3, 0.22],
    rust: rng.range(0.2, 0.7),
    sheerRise: 0.1,
    seed: rng.int(0, 1e6)
  })
  cabin(b, new Vector3(-length * 0.48, deckY, -beam * 0.4), new Vector3(-length * 0.38, deckY + length * 0.09, beam * 0.4), WHITE)
  box(b, new Vector3(-length * 0.47, deckY + length * 0.09, -beam * 0.07), new Vector3(-length * 0.44, deckY + length * 0.12, beam * 0.07), rng.pick<RGB>([[0.6, 0.45, 0.1], [0.05, 0.05, 0.05], [0.6, 0.1, 0.05]]))
  // Pipe runs along the deck.
  for (const z of [-beam * 0.08, 0, beam * 0.08]) {
    b.tube([new Vector3(-length * 0.36, deckY + 1.2, z), new Vector3(length * 0.42, deckY + 1.2, z)], () => 0.6, () => STEEL, 5)
  }
  return withHull(b)
}

/** An open boat with an outboard: the Arctic's workhorse (Greenland alone has
 * thousands, for fishing and hunting). Aluminium or painted fibreglass, a
 * steering console, often someone aboard in dark clothes. */
export function dinghy(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(4.5, 7)
  const deckY = length * 0.11
  const color = rng.weighted<RGB>([
    [[0.55, 0.56, 0.56], 4],
    [WHITE, 3],
    [[0.5, 0.07, 0.05], 2],
    [[0.08, 0.2, 0.14], 1],
    [[0.06, 0.12, 0.3], 1]
  ])
  hull(b, {
    length,
    beam: length * 0.38,
    freeboard: deckY,
    draft: length * 0.05,
    color,
    stripe: color,
    bottom: shade(color, 0.6),
    // The deck stands for the open hull's floor, seen from above.
    deck: shade(color, 0.45),
    rust: 0,
    sheerRise: 0.5,
    seed: rng.int(0, 1e6)
  })
  // Outboard on the transom, and a console.
  const stern = -length / 2
  box(b, new Vector3(stern - 0.35, deckY - 0.05, -0.18), new Vector3(stern + 0.05, deckY + 0.55, 0.18), rng.pick<RGB>([[0.04, 0.04, 0.045], [0.55, 0.56, 0.57], WHITE]))
  box(b, new Vector3(stern - 0.2, -0.45, -0.06), new Vector3(stern - 0.08, deckY, 0.06), [0.05, 0.05, 0.05])
  box(b, new Vector3(-length * 0.05, deckY * 0.5, -0.3), new Vector3(length * 0.07, deckY + 0.55, 0.3), shade(color, 0.9))
  if (rng.chance(0.7)) {
    // A seated figure at the tiller or the console.
    const jacket = rng.pick<RGB>([[0.05, 0.05, 0.06], [0.5, 0.08, 0.04], [0.12, 0.14, 0.12], [0.55, 0.35, 0.05]])
    const x = rng.chance(0.5) ? stern + 0.55 : -length * 0.15
    box(b, new Vector3(x - 0.2, deckY * 0.6, -0.22), new Vector3(x + 0.2, deckY + 0.55, 0.22), jacket)
    box(b, new Vector3(x - 0.11, deckY + 0.55, -0.11), new Vector3(x + 0.11, deckY + 0.78, 0.11), [0.06, 0.06, 0.07])
  }
  return withHull(b)
}

/** A small ice-class expedition cruise ship (~100–130 m, a few hundred
 * passengers): dark or red hull, white decks of cabins, orange lifeboats. */
export function expeditionShip(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(90, 130)
  const beam = length * 0.17
  const deckY = length * 0.07
  const color = rng.weighted<RGB>([
    [[0.03, 0.04, 0.08], 4],
    [[0.04, 0.08, 0.2], 3],
    [[0.42, 0.05, 0.04], 2],
    [WHITE, 2]
  ])
  hull(b, {
    length,
    beam,
    freeboard: deckY,
    draft: length * 0.045,
    color,
    stripe: rng.pick<RGB>([WHITE, [0.6, 0.1, 0.05], color]),
    bottom: [0.35, 0.04, 0.03],
    deck: [0.4, 0.4, 0.4],
    rust: rng.range(0, 0.15),
    sheerRise: 0.4,
    seed: rng.int(0, 1e6)
  })
  // Stacked white decks of cabins, the bridge forward.
  let y = deckY
  const decks = rng.int(3, 5)
  for (let d = 0; d < decks; d++) {
    const h = 2.8
    cabin(b, new Vector3(-length * (0.38 - d * 0.03), y, -beam * 0.42), new Vector3(length * (0.22 - d * 0.02), y + h, beam * 0.42), WHITE)
    y += h
  }
  cabin(b, new Vector3(length * 0.1, y, -beam * 0.45), new Vector3(length * 0.2, y + 2.6, beam * 0.45), WHITE)
  // Funnel aft, in the line's colours.
  box(b, new Vector3(-length * 0.22, y, -beam * 0.1), new Vector3(-length * 0.13, y + length * 0.06, beam * 0.1), rng.pick<RGB>([[0.6, 0.1, 0.05], [0.04, 0.06, 0.15], [0.7, 0.55, 0.1]]))
  // Lifeboats along both sides.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = -length * 0.25 + i * length * 0.1
      box(b, new Vector3(x, deckY + 3, side * beam * 0.43 - 1.3), new Vector3(x + length * 0.07, deckY + 5.2, side * beam * 0.43 + 1.3), [0.85, 0.35, 0.05])
    }
  }
  return withHull(b)
}

/** A polar research or supply icebreaker: a red hull with a white
 * superstructure forward, a mast, cranes and a helideck aft. */
export function icebreaker(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(80, 125)
  const beam = length * 0.22
  const deckY = length * 0.08
  const color = rng.weighted<RGB>([
    [[0.5, 0.06, 0.04], 6],
    [[0.7, 0.25, 0.04], 2],
    [[0.04, 0.05, 0.08], 1]
  ])
  hull(b, {
    length,
    beam,
    freeboard: deckY,
    draft: length * 0.08,
    color,
    stripe: WHITE,
    bottom: shade(color, 0.6),
    deck: [0.35, 0.36, 0.36],
    rust: rng.range(0.2, 0.6),
    sheerRise: 0.5,
    seed: rng.int(0, 1e6)
  })
  const white = rng.chance(0.8) ? WHITE : ([0.75, 0.68, 0.52] as RGB)
  let y = deckY
  for (let d = 0; d < 4; d++) {
    const h = 2.8
    cabin(b, new Vector3(-length * 0.02 + d * length * 0.015, y, -beam * (0.42 - d * 0.04)), new Vector3(length * 0.28 - d * length * 0.01, y + h, beam * (0.42 - d * 0.04)), white, d >= 2)
    y += h
  }
  // Mast and funnel.
  b.tube([new Vector3(length * 0.15, y, 0), new Vector3(length * 0.15, y + length * 0.12, 0)], () => 0.5, () => white, 5)
  box(b, new Vector3(-length * 0.08, y - 2.8, -beam * 0.12), new Vector3(length * 0.0, y + length * 0.05, beam * 0.12), rng.pick<RGB>([[0.5, 0.06, 0.04], [0.04, 0.05, 0.08], [0.7, 0.55, 0.1]]))
  // Cranes over the working deck aft, and a helideck at the stern.
  for (const side of [-1, 1]) {
    b.tube([new Vector3(-length * 0.2, deckY, side * beam * 0.3), new Vector3(-length * 0.28, deckY + length * 0.15, side * beam * 0.15)], () => 0.45, () => [0.75, 0.55, 0.08], 5)
  }
  box(b, new Vector3(-length * 0.5, deckY + 2.5, -beam * 0.4), new Vector3(-length * 0.36, deckY + 2.9, beam * 0.4), [0.2, 0.32, 0.22])
  return withHull(b)
}

export type PolarShip = 'dinghy' | 'trawler' | 'expedition-ship' | 'icebreaker'

/** Arctic and Southern Ocean waters: no leisure sailing. */
export function polarWaters(params: SceneParams): boolean {
  return params.sea.ocean === 'arctic' || params.sea.ocean === 'southern'
}

/** The boats out on a polar sea: dinghies (most in the open-water summer),
 * trawlers all year, expedition cruise ships in their season (Arctic
 * June–September, Antarctic November–March) and the odd research
 * icebreaker. */
export function polarFleet(params: SceneParams, rng: Random, any: (chance: number) => boolean = c => rng.chance(c)): PolarShip[] {
  const month = Number(params.date.slice(5, 7))
  const summer = params.sea.ocean === 'southern' ? month >= 11 || month <= 3 : month >= 6 && month <= 9
  const fleet: PolarShip[] = []
  if (any(summer ? 0.45 : 0.15)) for (let i = rng.int(1, 3); i > 0; i--) fleet.push('dinghy')
  if (any(0.3)) fleet.push('trawler')
  if (any(summer ? 0.25 : 0)) fleet.push('expedition-ship')
  if (any(0.12)) fleet.push('icebreaker')
  return fleet
}

const G = 9.81
const KNOT = 0.5144

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** How each kind goes (knots through the water, by mode and weight), how
 * often it's lying still (anchored, fishing, drifting), and whether it
 * sails. Trawlers tow at 2.5–4 kn and steam at 8–11; motor yachts and
 * dinghies cruise displacement-slow or plane; ships keep service speeds
 * (container ships 13–21 kn, slow steaming included; tankers 11–15). */
export const UNDERWAY: Record<ShipKind, { modes: [number, number, number][]; stopped: number; sail: boolean }> = {
  sloop: { modes: [[4, 7, 1]], stopped: 0.15, sail: true },
  catamaran: { modes: [[5, 9, 1]], stopped: 0.15, sail: true },
  dhow: { modes: [[3, 6, 1]], stopped: 0.1, sail: true },
  'motor-yacht': { modes: [[8, 12, 1], [15, 25, 1]], stopped: 0.35, sail: false },
  trawler: { modes: [[2.5, 4, 1], [8, 11, 1]], stopped: 0.1, sail: false },
  'container-ship': { modes: [[13, 21, 1]], stopped: 0.05, sail: false },
  tanker: { modes: [[11, 15, 1]], stopped: 0.05, sail: false },
  dinghy: { modes: [[3, 6, 1], [12, 25, 2]], stopped: 0.4, sail: false },
  'expedition-ship': { modes: [[9, 13, 1]], stopped: 0.3, sail: false },
  icebreaker: { modes: [[8, 14, 1]], stopped: 0.15, sail: false }
}

/** Speed through the water (m/s), 0 when lying still. Sailing boats are
 * becalmed under 2 m/s of wind and slower in light air. Always makes the
 * same draws. */
export function shipSpeed(kind: ShipKind, windSpeed: number, rng: Random): number {
  const u = UNDERWAY[kind]
  const stopped = rng.chance(u.stopped)
  const [lo, hi] = rng.weighted(u.modes.map(([a, b, w]) => [[a, b], w] as const))
  const speed = rng.range(lo, hi) * KNOT
  if (stopped) return 0
  if (!u.sail) return speed
  return windSpeed < 2 ? 0 : speed * Math.min(1, 0.4 + windSpeed / 10)
}

/** What a boat does to the sea round it (ocean.ts setOceanShips). */
export interface ShipWake {
  x: number
  z: number
  /** Bow direction on the water (unit). */
  dirX: number
  dirZ: number
  length: number
  beam: number
  spacing: number
  speed: number
  /** Kelvin wave height next to the hull (m). */
  height: number
  /** Whiteness of the turbulent wake (propeller wash) behind the stern. */
  foam: number
  /** Seconds its foam lasts. */
  foamTime: number
  /** White water tearing round the hull: bow wave and waves breaking on it. */
  collar: number
}

/** The wake of a hull at a speed in a sea. Kelvin waves grow with beam and
 * Froude number Fr = U/√(gL); past Fr ≈ 0.5 a hull planes and its long
 * transverse waves fade (the shader weights waves by how well a hull of
 * this length makes them). Propellers churn a white wake whatever the
 * speed; a sailing hull only once it's quick. Foam lasts longer behind a
 * bigger hull (deeper, wider turbulence). Waves break white on a hull the
 * more, the higher they stand against its freeboard. */
export function wakeFor(kind: ShipKind, size: HullSize, speed: number, waveHeight: number): Omit<ShipWake, 'x' | 'z' | 'dirX' | 'dirZ'> {
  const fr = speed / Math.sqrt(G * size.length)
  const moving = speed > 0.2
  const foam = !moving ? 0 : UNDERWAY[kind].sail ? 0.35 * smooth(0.2, 0.45, fr) : Math.min(1, 0.55 + 0.6 * smooth(0.3, 0.8, fr)) * smooth(0.2, 2, speed)
  const seaOnHull = 0.8 * smooth(0.3, 2.5, waveHeight) * Math.min(1, (2 * waveHeight) / size.freeboard)
  return {
    length: size.length,
    beam: size.beam,
    spacing: size.spacing,
    speed: moving ? speed : 0,
    height: moving ? 0.1 * size.beam * Math.min(fr, 0.8) : 0,
    foam,
    foamTime: 8 + 0.8 * size.beam,
    collar: Math.min(1, Math.max(moving ? Math.min(0.9, fr * 1.6) : 0, seaOnHull))
  }
}

/** A hull floating on the waves: it settles on the plane that best fits the
 * sea over its waterplane (least squares over its waterplane), so it follows
 * waves longer than itself and averages shorter ones out, as ships do
 * (heave and pitch response is small below λ ≈ L and near 1 above ~2 L).
 * `rel` is how far the water stands above the floating waterline at a point
 * of the hull (along from midships, across from the centreline), which is
 * where waves climb the hull and burst. */
export interface FloatPose {
  heave: number
  /** Bow up (rad). */
  pitch: number
  /** Starboard (+Z local) down (rad). */
  roll: number
  rel: (along: number, across: number) => number
}

export function floatOnWaves(seaLevel: (x: number, z: number) => number, x: number, z: number, heading: number, size: HullSize): FloatPose {
  const fx = Math.sin(heading)
  const fz = -Math.cos(heading)
  // Local +Z (starboard in the mesh) on the water.
  const sx = Math.cos(heading)
  const sz = Math.sin(heading)
  const at = (a: number, c: number): number => seaLevel(x + fx * a + sx * c, z + fz * a + sz * c)
  const halfSpan = size.spacing + 0.35 * size.beam
  let sum = 0
  let sumA = 0
  let sumAA = 0
  let sumC = 0
  let sumCC = 0
  let n = 0
  // Every ~2 m, or short chop aliases into a sway of the whole ship.
  const stations = Math.min(160, Math.max(6, Math.ceil((0.9 * size.length) / 2)))
  for (let i = 0; i <= stations; i++) {
    const a = (i / stations - 0.5) * 0.9 * size.length
    for (let j = -2; j <= 2; j++) {
      const c = (j / 2) * halfSpan
      const h = at(a, c)
      sum += h
      sumA += h * a
      sumAA += a * a
      sumC += h * c
      sumCC += c * c
      n++
    }
  }
  const heave = sum / n
  const gA = sumA / sumAA
  const gC = sumC / sumCC
  return {
    heave,
    pitch: Math.atan(gA),
    roll: -Math.atan(gC),
    rel: (a, c) => at(a, c) - (heave + gA * a + gC * c)
  }
}

/** How high a sheet of water bursts up a hull (m): the water hits at
 * v² ≈ 2g·rise (a crest standing above the floating waterline) plus
 * (U·slope)² where the bow drives into a wave's face, and about half that
 * energy goes up (v²/2g × 0.5). Nothing until the crest is a fifth of the
 * freeboard up the side. */
export function splashHeight(rise: number, closing: number, size: HullSize): number {
  if (rise < 0.2 * size.freeboard && closing < 1.5) return 0
  const v2 = 2 * G * Math.max(rise, 0) + closing * closing
  return Math.min(0.5 * size.length, 14, (0.5 * v2) / (2 * G))
}

/** Share of the sea surface white with breaking crests at a 10 m wind
 * speed (m/s): Monahan & O'Muircheartaigh 1980, W = 3.84e-6 U^3.41
 * (~4% at 15 m/s). */
export function whitecapFraction(windSpeed: number): number {
  return Math.min(0.3, 3.84e-6 * Math.max(0, windSpeed) ** 3.41)
}

/** Waves tearing on a hull: bursts of spray where crests climb it (bow and
 * both sides), low sheets off a planing hull's chines, blown downwind.
 * A hull rides waves longer than itself, so in a big swell the water hardly
 * climbs it; the spray comes from the short wind-sea crests it can't
 * follow. The bow slams into one about every other wave, throwing a sheet
 * up at a good part of its speed; and a breaking crest is on a hull's
 * side about as often as whitecaps cover the length beside it. */
function hullSpray(spray: SprayBuilder, rng: Random, mesh: Mesh, pose: FloatPose, size: HullSize, speed: number, windy: number, windAz: number, waveHeight: number, windSpeed: number): void {
  mesh.updateMatrixWorld()
  const { length: L, beam: B } = size
  const downwind = new Vector3(Math.sin(windAz), 0, -Math.cos(windAz))
  const up = new Vector3(0, 1, 0)
  const burst = (along: number, across: number, rise: number, height: number, outward: Vector3): void => {
    const base = mesh.localToWorld(new Vector3(along, 0, across))
    base.y += Math.max(rise, 0)
    const spread = Math.min(B, 0.4 + height * 0.5)
    const count = Math.round(Math.min(1500, height * 200 * Math.max(1, spread)))
    for (let k = 0; k < count; k++) {
      const t = rng.float()
      const p = base
        .clone()
        .addScaledVector(outward, (0.15 + t) * height * 0.45 * rng.float())
        .addScaledVector(up, height * Math.sqrt(t) * rng.range(0.4, 1.1))
        .addScaledVector(downwind, t * height * 0.5 * windy)
      p.x += rng.normal(0, spread * 0.5)
      p.z += rng.normal(0, spread * 0.5)
      spray.add(p, rng.range(0.03, 0.1), rng.range(0.5, 1) * (1 - 0.6 * t))
    }
    for (let k = 0; k < Math.round(height * 20); k++) {
      const t = rng.float()
      const p = base.clone().addScaledVector(up, height * t * rng.range(0.3, 0.9)).addScaledVector(downwind, t * height * windy)
      spray.add(p, rng.range(0.5, 1.5) * (0.4 + height * 0.15), rng.range(0.04, 0.1))
    }
  }
  const sideways = (sign: number): Vector3 => mesh.localToWorld(new Vector3(0, 0, sign)).sub(mesh.position).setY(0).normalize()

  // The bow, driving into the waves at speed.
  const bowA = 0.46 * L
  const rise = Math.max(pose.rel(bowA, 0), pose.rel(0.38 * L, 0.3 * B), pose.rel(0.38 * L, -0.3 * B))
  const slam = rng.chance(0.5) ? 0.6 * speed * smooth(0.4, 2, waveHeight) : 0
  const closing = Math.max(slam, (speed * Math.max(0, pose.rel(bowA + 2, 0) - pose.rel(bowA, 0))) / 2)
  const bow = splashHeight(rise, closing, size)
  if (bow > 0) for (const sign of [-1, 1]) burst(bowA - 0.05 * L, sign * 0.2 * B, rise, bow, sideways(sign))
  // A breaking crest against the weather side.
  const breaking = 1 - Math.exp((-whitecapFraction(windSpeed) * 2 * L) / 1.5)
  const hitAt = rng.range(-0.4, 0.4) * L
  if (rng.chance(Math.min(0.7, breaking))) {
    const weather = Math.sign(mesh.localToWorld(new Vector3(0, 0, 1)).sub(mesh.position).dot(downwind)) || 1
    const across = -weather * (size.spacing + 0.45 * B)
    burst(hitAt, across, 0, Math.min(3, 0.5 * waveHeight) * rng.range(0.5, 1) * windy, sideways(-weather))
  }
  // Crests climbing either side.
  for (let i = 0; i < 5; i++) {
    const along = (i / 4 - 0.5) * 0.8 * L + rng.range(-0.05, 0.05) * L
    for (const sign of [-1, 1]) {
      const across = sign * (size.spacing + 0.45 * B)
      const r = pose.rel(along, across)
      const h = splashHeight(r, 0, size) * windy
      if (h > 0) burst(along, across, r, h, sideways(sign))
    }
  }
  // A planing hull throws a sheet off each chine, aft of the bow.
  const fr = speed / Math.sqrt(G * L)
  const chine = 0.15 * B * smooth(0.6, 1.1, fr)
  if (chine > 0.05) for (const sign of [-1, 1]) burst(0.15 * L, sign * 0.5 * B, 0, chine, sideways(sign))
}

/** The top of the mast (ship frame): where masthead lights go. */
function highestPoint(geometry: BufferGeometry): Vector3 {
  const position = geometry.getAttribute('position')
  const top = new Vector3(0, -Infinity, 0)
  for (let i = 0; i < position.count; i++)
    if (position.getY(i) > top.y) top.set(position.getX(i), position.getY(i), position.getZ(i))
  return top
}

export function createShips(ctx: PropContext): Object3D[] {
  const { params } = ctx
  const rng = ctx.rng('ships')
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: DoubleSide })
  const meshes: Mesh[] = []
  const camera = ctx.camera
  const windAz = (params.ocean.windHeadingDeg * Math.PI) / 180
  const warm = params.biome.name === 'tropical' || params.biome.name === 'desert'
  const lit = lightsOn(params)

  /** Somewhere on deep enough water in frame: first the lower half of the
   * frame's sea area, then by distance and bearing within the view (a low
   * horizon leaves little sea below NDC 0, and far boats lie in a sliver of
   * pixels just under the horizon). */
  const seaSpot = (minDistance: number, maxDistance: number): Vector3 | null => {
    for (let tries = 0; tries < 40; tries++) {
      const ndc = new Vector3(rng.range(-0.85, 0.85), rng.range(-0.6, 0.0), 0.5)
      const dir = ndc.unproject(camera).sub(camera.position).normalize()
      if (dir.y >= -0.0005) continue
      // Intersect with the sea plane.
      const distance = -camera.position.y / dir.y
      if (distance < minDistance || distance > maxDistance) continue
      const position = camera.position.clone().addScaledVector(dir, distance).setY(0)
      if (ctx.ground(position.x, position.z) > -3) continue
      return position
    }
    const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
    const halfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
    for (let tries = 0; tries < 60; tries++) {
      const bearing = rng.range(-0.9, 0.9) * halfFov
      const distance = minDistance * (maxDistance / minDistance) ** rng.float()
      const position = forward
        .clone()
        .applyAxisAngle(new Vector3(0, 1, 0), bearing)
        .multiplyScalar(distance)
        .add(camera.position)
        .setY(0)
      if (ctx.ground(position.x, position.z) > -3) continue
      if (ctx.inFrame(position.x, 0, position.z, 0.9)) return position
    }
    return null
  }

  // Speeds and spray on their own stream, so the fleet stays the same.
  const motion = ctx.rng('ships/motion')
  const spray = new SprayBuilder()
  const windy = Math.min(1.5, 0.6 + params.ocean.windSpeed / 12)
  const waveHeight = ctx.waveHeight
  // The open-sea waves, damped over shallows like the ocean shader does.
  const sea = (x: number, z: number): number =>
    ctx.seaLevel(x, z) * (0.1 + 0.9 * smooth(0, 2 * Math.max(0.05, waveHeight) + 1.5, -ctx.ground(x, z)))

  const launch = (kind: ShipKind, geometry: BufferGeometry, minDistance: number, maxDistance: number): void => {
    const sailing = UNDERWAY[kind].sail
    const position = seaSpot(minDistance, maxDistance)
    if (position == null) return
    let heading = sailing ? windAz + rng.range(0.6, 1.4) * (rng.chance(0.5) ? 1 : -1) : rng.range(0, Math.PI * 2)
    let heel = sailing ? rng.range(0.06, 0.25) : rng.normal(0, 0.02)
    // Was a stand-in for the waves; the hull now floats on the real ones.
    rng.normal(0, 0.02)
    const speed = shipSpeed(kind, params.ocean.windSpeed, motion)
    const size = geometry.userData.hull as HullSize
    // Under sail without way on: lying head to wind, sails barely drawing.
    if (sailing && speed === 0) {
      heading = windAz + Math.PI + motion.normal(0, 0.3)
      heel *= 0.15
    }
    const pose = floatOnWaves(sea, position.x, position.z, heading, size)
    // A planing hull rides bow-up on its own wave (Fr past ~0.5).
    const fr = speed / Math.sqrt(G * size.length)
    const trim = UNDERWAY[kind].sail ? 0 : 0.07 * smooth(0.4, 1, fr)
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(position).setY(pose.heave)
    mesh.quaternion.setFromEuler(new Euler(heel + pose.roll, -heading + Math.PI / 2, pose.pitch + trim, 'YXZ'))
    mesh.castShadow = true
    mesh.receiveShadow = true
    const wake: ShipWake = { x: position.x, z: position.z, dirX: Math.sin(heading), dirZ: -Math.cos(heading), ...wakeFor(kind, size, speed, waveHeight) }
    mesh.userData.wake = wake
    meshes.push(mesh)
    if (lit) {
      // Navigation lights facing us: the camera's bearing from the bow.
      mesh.updateMatrixWorld()
      const local = mesh.worldToLocal(camera.position.clone())
      const bearing = (Math.atan2(local.z, local.x) * 180) / Math.PI
      const distance = camera.position.distanceTo(mesh.position)
      for (const light of shipLightsFor(kind, size, highestPoint(geometry), speed, sailing))
        if (shows(light, bearing)) mesh.add(lampSprite(light, distance, camera))
    }
    if (ctx.distance(position.x, position.z) < 3000 && ctx.visible(position.x, 0, position.z, size.length)) {
      hullSpray(spray, motion, mesh, pose, size, speed, windy, windAz, waveHeight, params.ocean.windSpeed)
    }
  }
  const done = (): Object3D[] => {
    const points = spray.build()
    return points == null ? meshes : [...meshes, points]
  }

  // A scene spec's list of boats: one of each.
  const force = params.overrides?.ships
  if (Array.isArray(force)) {
    const builders: Record<ShipKind, () => void> = {
      sloop: () => launch('sloop', sloop(rng), 150, 3000),
      catamaran: () => launch('catamaran', catamaran(rng), 150, 3000),
      dhow: () => launch('dhow', dhow(rng), 150, 3000),
      'motor-yacht': () => launch('motor-yacht', motorYacht(rng), 150, 3000),
      trawler: () => launch('trawler', trawler(rng), 120, 2500),
      'container-ship': () => launch('container-ship', containerShip(rng), 4000, 16000),
      tanker: () => launch('tanker', tanker(rng), 4000, 16000),
      dinghy: () => launch('dinghy', dinghy(rng), 60, 700),
      'expedition-ship': () => launch('expedition-ship', expeditionShip(rng), 1200, 6000),
      icebreaker: () => launch('icebreaker', icebreaker(rng), 2000, 12000)
    }
    for (const kind of force) builders[kind]()
    return done()
  }
  // false: none; true: some of every class.
  const any = (chance: number): boolean => forced(force, rng.chance(chance))

  if (polarWaters(params)) {
    for (const kind of polarFleet(params, rng, any)) {
      if (kind === 'dinghy') launch('dinghy', dinghy(rng), 60, 700)
      else if (kind === 'trawler') launch('trawler', trawler(rng), 120, 2500)
      else if (kind === 'expedition-ship') launch('expedition-ship', expeditionShip(rng), 1200, 6000)
      else launch('icebreaker', icebreaker(rng), 2000, 12000)
    }
    return done()
  }

  // Leisure craft near the coast.
  if (any(0.5)) {
    for (let i = rng.int(1, 3); i > 0; i--) {
      const kind = rng.weighted<'sloop' | 'catamaran' | 'dhow'>([
        ['sloop', 6],
        ['catamaran', 2],
        ['dhow', warm ? 3 : 0]
      ])
      const geometry = kind === 'sloop' ? sloop(rng) : kind === 'catamaran' ? catamaran(rng) : dhow(rng)
      launch(kind, geometry, 150, 3000)
    }
  }
  if (any(0.2)) launch('motor-yacht', motorYacht(rng), 150, 3000)
  if (any(0.25)) {
    for (let i = rng.int(1, 2); i > 0; i--) launch('trawler', trawler(rng), 120, 2500)
  }
  // Shipping on the horizon.
  if (any(0.3)) {
    if (rng.chance(0.6)) launch('container-ship', containerShip(rng), 4000, 16000)
    else launch('tanker', tanker(rng), 4000, 16000)
  }

  return done()
}
