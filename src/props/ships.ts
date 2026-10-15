import { DoubleSide, Euler, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three'

import type { RGB } from '../biome'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced, type ShipKind } from '../sceneSpec'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { fbm3, noise3 } from './noise'

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

/** Lofted hull with a paint stripe at the waterline, antifouling below it,
 * and rust that blooms in patches and runs down from the deck in streaks. */
function hull(b: MeshBuilder, s: HullSpec): void {
  const stations = 36
  const around = 14
  const rings: number[][] = []
  const deckLeft: number[] = []
  const deckRight: number[] = []
  const sheerRise = s.sheerRise ?? 0.35
  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const x = (t - 0.5) * s.length
    // Full transom at the stern, widest just aft of midships, fine bow.
    const shape =
      t < 0.45 ? 0.8 + 0.2 * Math.sin((t / 0.45) * Math.PI * 0.5) : Math.max(0.015, 1 - ((t - 0.45) / 0.55) ** 1.7)
    const half = (s.beam / 2) * shape
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
  return b.build()
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
  box(b, new Vector3(-length * 0.4, deckY, -length * 0.26), new Vector3(length * 0.2, deckY + 0.3, length * 0.26), WHITE)
  cabin(b, new Vector3(-length * 0.3, deckY + 0.3, -length * 0.18), new Vector3(length * 0.05, deckY + 0.3 + length * 0.09, length * 0.18), WHITE)
  rig(b, rng, length * 0.08, deckY + 0.3, length, length * 1.3)
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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
  return b.build()
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

export function createShips(ctx: PropContext): Mesh[] {
  const { params } = ctx
  const rng = ctx.rng('ships')
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: DoubleSide })
  const meshes: Mesh[] = []
  const camera = ctx.camera
  const windAz = (params.ocean.windHeadingDeg * Math.PI) / 180
  const warm = params.biome.name === 'tropical' || params.biome.name === 'desert'

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

  const launch = (geometry: BufferGeometry, minDistance: number, maxDistance: number, sailing: boolean): void => {
    const position = seaSpot(minDistance, maxDistance)
    if (position == null) return
    const heading = sailing ? windAz + rng.range(0.6, 1.4) * (rng.chance(0.5) ? 1 : -1) : rng.range(0, Math.PI * 2)
    const heel = sailing ? rng.range(0.06, 0.25) : rng.normal(0, 0.02)
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.quaternion.setFromEuler(new Euler(heel, -heading + Math.PI / 2, rng.normal(0, 0.02), 'YXZ'))
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
  }

  // A scene spec's list of boats: one of each.
  const force = params.overrides?.ships
  if (Array.isArray(force)) {
    const builders: Record<ShipKind, () => void> = {
      sloop: () => launch(sloop(rng), 150, 3000, true),
      catamaran: () => launch(catamaran(rng), 150, 3000, true),
      dhow: () => launch(dhow(rng), 150, 3000, true),
      'motor-yacht': () => launch(motorYacht(rng), 150, 3000, false),
      trawler: () => launch(trawler(rng), 120, 2500, false),
      'container-ship': () => launch(containerShip(rng), 4000, 16000, false),
      tanker: () => launch(tanker(rng), 4000, 16000, false),
      dinghy: () => launch(dinghy(rng), 60, 700, false),
      'expedition-ship': () => launch(expeditionShip(rng), 1200, 6000, false),
      icebreaker: () => launch(icebreaker(rng), 2000, 12000, false)
    }
    for (const kind of force) builders[kind]()
    return meshes
  }
  // false: none; true: some of every class.
  const any = (chance: number): boolean => forced(force, rng.chance(chance))

  if (polarWaters(params)) {
    for (const kind of polarFleet(params, rng, any)) {
      if (kind === 'dinghy') launch(dinghy(rng), 60, 700, false)
      else if (kind === 'trawler') launch(trawler(rng), 120, 2500, false)
      else if (kind === 'expedition-ship') launch(expeditionShip(rng), 1200, 6000, false)
      else launch(icebreaker(rng), 2000, 12000, false)
    }
    return meshes
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
      launch(geometry, 150, 3000, true)
    }
  }
  if (any(0.2)) launch(motorYacht(rng), 150, 3000, false)
  if (any(0.25)) {
    for (let i = rng.int(1, 2); i > 0; i--) launch(trawler(rng), 120, 2500, false)
  }
  // Shipping on the horizon.
  if (any(0.3)) launch(rng.chance(0.6) ? containerShip(rng) : tanker(rng), 4000, 16000, false)

  return meshes
}
