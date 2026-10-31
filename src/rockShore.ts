import { fbm, hashCell, smoothstep, vnoise } from './cellNoise'
import type { Biome, RGB } from './biome'
import type { Random } from './random'

// Rocky shores (PLAN_BIOMES 8; knowledge/plans/ROCK_SHORE.md): no beach, the
// sea meets rock. Three kinds:
// - platform: a wave-cut shore platform below a low cliff. Sloping (1–4°)
//   and running below low water where the tide is big (Brittany, the
//   Bristol Channel), near level at about high water and ending in a
//   low-tide cliff (a scarp) where it is small (Kaikoura, the
//   Mediterranean);
// - boulder: a steep apron of boulders from below low water up to the land
//   (Newfoundland, Scotland, Big Sur coves);
// - cliff: a cliff 15–70 m high, plunging into the sea or with a narrow
//   platform at its foot, seen from the top (the overlook).
//
// The land frame's s = 0 is the back of the platform (the foot of the back
// face); heights are above mean sea and the terrain sits `tide.level` lower,
// as on beaches. The bare profile, inland to seaward:
//   plateau at top + backHeight | back face over backWidth | platform from
//   top (s = 0) to edge (s = width) | scarp down by `scarp` at scarpSlope |
//   seabed at the nearshore slope toward −seabedDepth.
// Ledges, gullies and boulders are added on top (terrain.ts rockRelief).
// No imports from terrain.ts or tides.ts (they import each other's
// dependents).

export type RockKind = 'platform' | 'boulder' | 'cliff'
export const ROCK_KINDS: readonly RockKind[] = ['platform', 'boulder', 'cliff']
/** Title words. */
export const ROCK_NAMES: Record<RockKind, string> = { platform: 'rock platform', boulder: 'boulder shore', cliff: 'sea cliffs' }

export interface RockShore {
  kind: RockKind
  /** Platform width (m), 0: none (boulder ramps, plunging cliffs). */
  width: number
  /** Height of the platform's back (s = 0) and seaward edge above mean sea (m). */
  top: number
  edge: number
  /** The drop seaward of the edge (m) and its slope (rise over run). */
  scarp: number
  scarpSlope: number
  /** The back face: height above `top` and horizontal width (m). */
  backHeight: number
  backWidth: number
  /** Ledges: noise relief (m), bedding step (m), the beds' dip (tan) and
   * strike (rad, from the along-shore axis). */
  relief: number
  bedding: number
  dip: number
  strike: number
  /** Gullies along joints: spacing (m), angle from the shore normal (rad),
   * depth (m). */
  jointSpacing: number
  jointAngle: number
  gully: number
  /** Boulder size (m) on a boulder shore; 0: none. */
  boulder: number
  /** The rock's colour (linear albedo), one of the biome's rock colours. */
  color: RGB
}

/** Lichen crusts on dry rock by biome (as props/rocks.ts GROWTH). */
export const LICHEN: Record<Biome['name'], RGB> = {
  tropical: [0.45, 0.42, 0.35],
  mediterranean: [0.55, 0.38, 0.08],
  nordic: [0.5, 0.5, 0.42],
  volcanic: [0.45, 0.45, 0.4],
  desert: [0.5, 0.32, 0.1]
}

/** Kind weights: cliff tops about a third (much rocky coast is only seen
 * from above), platforms most of the rest. */
const KIND_WEIGHTS: readonly (readonly [RockKind, number])[] = [
  ['platform', 45],
  ['boulder', 22],
  ['cliff', 33]
]

/** Below this spring range (m) platforms are near level (Sunamura type B). */
const LEVEL_PLATFORM_RANGE = 2

/** What a scene spec can force: the kind, or whether the camera is on the
 * cliff top (overlook: a cliff; another composition: not a cliff). */
export interface RockForce {
  kind?: RockKind
  overlook?: boolean
}

/** The day's rocky shore: every draw made first on `rng` (stream
 * 'rock-shore'), then the kind is forced. `springRange`: the tide the shore
 * is built for (tides.ts). */
export function rockShoreFor(springRange: number, colors: readonly RGB[], rng: Random, force: RockForce = {}): RockShore {
  const drawn = rng.weighted(KIND_WEIGHTS)
  const u = Array.from({ length: 14 }, () => rng.float())
  const color = colors[Math.min(colors.length - 1, Math.floor(rng.float() * colors.length))]
  const kind = force.kind ?? (force.overlook === true ? 'cliff' : force.overlook === false && drawn === 'cliff' ? 'platform' : drawn)
  const hw = springRange / 2
  const common = {
    dip: Math.tan(((1 + 7 * u[8]) * Math.PI) / 180),
    strike: u[9] * Math.PI,
    jointSpacing: 6 + 14 * u[10],
    jointAngle: ((u[11] - 0.5) * 50 * Math.PI) / 180
  }
  switch (kind) {
    case 'platform': {
      const top = hw + 0.2 + 0.4 * u[1]
      let width: number
      let slope: number
      if (springRange < LEVEL_PLATFORM_RANGE) {
        // Near level, ending in a low-tide cliff.
        width = 25 + 95 * u[0]
        slope = 0.003 + 0.004 * u[2]
      } else {
        // Sloping, steeper for a bigger tide, down to about spring low water.
        const deg = 1 + u[2] + 2 * Math.min(1, (springRange - LEVEL_PLATFORM_RANGE) / 8)
        slope = Math.tan((deg * Math.PI) / 180)
        width = Math.min(200, Math.max(30, (top + hw + 0.3 * u[0]) / slope))
      }
      const backHeight = 2 + 10 * u[3]
      return {
        kind,
        width,
        top,
        edge: top - width * slope,
        scarp: 2 + 4 * u[4],
        scarpSlope: 0.6 + 0.6 * u[5],
        backHeight,
        backWidth: backHeight / (1.5 + 1.5 * u[6]),
        relief: 0.6 + 1.4 * u[7],
        bedding: 0.25 + 0.45 * u[12],
        ...common,
        gully: 0.4 + 1.1 * u[13],
        boulder: 0,
        color
      }
    }
    case 'boulder': {
      const ramp = 0.2 + 0.15 * u[2]
      const top = hw + 0.5
      const backHeight = 2 + 4 * u[3]
      return {
        kind,
        width: 0,
        top,
        edge: top,
        // Down to a few metres below spring low water.
        scarp: top + hw + 2 + 3 * u[4],
        scarpSlope: ramp,
        backHeight,
        backWidth: backHeight / ramp,
        relief: 0.3 + 0.5 * u[7],
        bedding: 0.4,
        ...common,
        gully: 0,
        boulder: 0.8 + 1.4 * u[12],
        color
      }
    }
    case 'cliff': {
      const plunging = u[0] < 0.4
      const width = plunging ? 0 : 5 + 20 * u[1]
      const top = hw + 0.3
      const backHeight = 15 + 55 * u[3]
      return {
        kind,
        width,
        top,
        edge: top - width * 0.01,
        scarp: plunging ? 5 + 10 * u[4] : 3 + 5 * u[4],
        scarpSlope: 0.8 + 0.7 * u[5],
        backHeight,
        backWidth: backHeight / (2 + 3 * u[6]),
        relief: 1 + 1.5 * u[7],
        bedding: 1 + 2 * u[12],
        ...common,
        gully: 0.4 + 1.1 * u[13],
        boulder: 0,
        color
      }
    }
  }
}

/** Where the scarp's foot is: its seaward distance and height (m). */
export function scarpFoot(rock: RockShore): { s: number; height: number } {
  return { s: rock.width + rock.scarp / rock.scarpSlope, height: rock.edge - rock.scarp }
}

/** Steep faces are at least this × the distance from the camera wide: the
 * terrain grid's spacing is 2.2% of it radially (terrain.ts). */
export const ROCK_MIN_FACE = 0.03

/** The bare rocky profile at s (m above mean sea; no ledges, gullies, hills
 * or tide). `width` overrides the platform's width (its ragged edge);
 * `distance` from the camera widens the steep faces (ROCK_MIN_FACE). */
export function bareRock(rock: RockShore, nearshoreSlope: number, seabedDepth: number, s: number, width = rock.width, distance = 0): number {
  const backWidth = Math.max(rock.backWidth, ROCK_MIN_FACE * distance)
  if (s <= -backWidth) return rock.top + rock.backHeight
  if (s < 0) {
    // Rounded at the crest and the foot, steepest (1.5 × the mean) between.
    const t = -s / backWidth
    return rock.top + rock.backHeight * t * t * (3 - 2 * t)
  }
  if (s <= width) return width > 0 ? rock.top + ((rock.edge - rock.top) * s) / width : rock.top
  const edge = rock.top + (rock.edge - rock.top) * (rock.width > 0 ? width / rock.width : 0)
  const run = Math.max(rock.scarp / rock.scarpSlope, ROCK_MIN_FACE * distance)
  const footS = width + run
  if (s <= footS) return edge - ((s - width) * rock.scarp) / run
  const foot = edge - rock.scarp
  const range = Math.max(1, seabedDepth + foot)
  return foot - range * (1 - Math.exp(Math.max((-(s - footS) * nearshoreSlope) / range, -10)))
}

/** Where the water is at `level` (m above mean sea) on the bare profile:
 * its seaward distance s (m). Inverts bareRock. */
export function rockWaterline(rock: RockShore, nearshoreSlope: number, seabedDepth: number, level: number): number {
  if (level >= rock.top) {
    // Invert the back face's smoothstep.
    const k = Math.min(1, (level - rock.top) / rock.backHeight)
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const t = (lo + hi) / 2
      if (t * t * (3 - 2 * t) < k) lo = t
      else hi = t
    }
    return -((lo + hi) / 2) * rock.backWidth
  }
  if (rock.width > 0 && level >= rock.edge) return (rock.width * (rock.top - level)) / Math.max(rock.top - rock.edge, 1e-6)
  const foot = scarpFoot(rock)
  if (level >= foot.height) return rock.width + (rock.edge - level) / rock.scarpSlope
  const range = Math.max(1, seabedDepth + foot.height)
  const depth = Math.min(foot.height - level, 0.95 * range)
  return foot.s - (range / nearshoreSlope) * Math.log(1 - depth / range)
}

/** What the rock height reads of the coast (CoastParams fields). */
export interface RockCoast {
  rock: RockShore | null
  noiseOffset: [number, number]
  nearshoreSlope: number
  seabedDepth: number
  hillHeight: number
  wobble: number
  tide: { level: number }
}

/** The ground under the camera (world origin) above today's sea (m). Its
 * shore coords: s = −distanceToWater less the coast's wobble at a = 0
 * (terrain.ts shoreOffset). */
export function rockGround(coast: RockCoast & { distanceToWater: number }): number {
  return rockSurface(coast, -coast.distanceToWater - wobbleAtCamera(coast), 0, 0, 0)
}

/** How far the wobble pushes the shore seaward at a = 0 (terrain.ts
 * shoreOffset): the camera's s is −distanceToWater less this. */
export function wobbleAtCamera(coast: Pick<RockCoast, 'noiseOffset' | 'wobble'>): number {
  const [ox, oz] = coast.noiseOffset
  return coast.wobble * (vnoise(ox, 3.7 + oz) * 2 - 1) + coast.wobble * 0.3 * (vnoise(ox, 9.1 + oz) * 2 - 1)
}

/** Gullies along the joints, 0..1 (mirrors TERRAIN_GLSL rockGully). */
export function rockGully(coast: RockCoast, s: number, a: number, r = 0): number {
  const rock = coast.rock
  if (rock == null || rock.gully <= 0) return 0
  const [ox, oz] = coast.noiseOffset
  let g = 0
  for (let i = 0; i < 2; i++) {
    const angle = rock.jointAngle + i * 1.05
    const c = Math.cos(angle)
    const sn = Math.sin(angle)
    const along = s * c + a * sn
    const across = -s * sn + a * c
    const spacing = rock.jointSpacing * (1 + 0.7 * i)
    const w = across / spacing + 0.5 * vnoise(along / 30 + i * 5.3 + ox, 43.1 + oz)
    const d = Math.abs(w - Math.floor(w) - 0.5) * spacing
    const half = 0.5 + 0.08 * spacing
    const floor = (1 - smoothstep(0.35 * half * (1 - Math.min(0.9, r / 150)), half * (1 + r / 150), d)) * smoothstep(0.35, 0.6, vnoise(along / 25 + i * 3.7 + ox, 47.9 + oz))
    g = Math.max(g, floor * (1 - 0.5 * i))
  }
  return g
}

/** Half-buried boulders (mirrors boulderField). */
export function boulderField(x: number, z: number, size: number): number {
  const gx = x / size
  const gz = z / size
  const cx = Math.floor(gx)
  const cz = Math.floor(gz)
  const fx = gx - cx
  const fz = gz - cz
  let h = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const n = hashCell(cx + i + 907, cz + j + 311)
      const px = i + 0.25 + (0.5 * (n & 0xff)) / 255
      const pz = j + 0.25 + (0.5 * ((n >>> 8) & 0xff)) / 255
      const r = 0.35 + (0.25 * ((n >>> 16) & 0xff)) / 255
      const dx = fx - px
      const dz = fz - pz
      const lump = 0.8 + 0.4 * vnoise(dx * 3 + (n >>> 24), dz * 3 + 7)
      const k = Math.hypot(dx, dz) / (r * lump)
      const tall = 0.6 + (0.8 * ((n >>> 24) & 0xf)) / 15
      h = Math.max(h, r * tall * Math.min(1, 1.6 * Math.sqrt(Math.max(0, 1 - k * k))))
    }
  }
  return h * size
}

/** The platform's ragged edge at a (mirrors rockHeightAt's width). */
export function rockEdge(coast: RockCoast, a: number, gully: number, distance = 0): number {
  const rock = coast.rock!
  if (rock.width <= 0) return 0
  const [ox, oz] = coast.noiseOffset
  return Math.max(0, rock.width * (1 + 0.25 * (vnoise(a / 40 + ox, 41.3 + oz) * 2 - 1)) - 8 * gully * (1 - smoothstep(50, 150, distance)))
}

/** A rocky shore's height at shore coords (s, a), world (x, z) (mirrors
 * TERRAIN_GLSL rockHeightAt; the camera is at the world origin). */
export function rockSurface(coast: RockCoast, s: number, a: number, x: number, z: number): number {
  const rock = coast.rock!
  const [ox, oz] = coast.noiseOffset
  const u = -s
  const qx = x + ox
  const qz = z + oz
  const dist = Math.hypot(x, z)
  const gully = rockGully(coast, s, a, dist)
  const width = rockEdge(coast, a, gully, dist)
  let h = bareRock(rock, coast.nearshoreSlope, coast.seabedDepth, s, width, dist)
  const back = rock.backWidth
  h += coast.hillHeight * smoothstep(back + 20, back + 520, u) * (0.25 + 0.75 * fbm(qx / 450, qz / 450)) * smoothstep(-0.2, 1, fbm(qx / 1400 + 7, qz / 1400 + 7))
  h += 0.35 * (fbm(qx / 7, qz / 7) - 0.5) * smoothstep(back, back + 10, u)
  const footS = width + Math.max(rock.scarp / rock.scarpSlope, ROCK_MIN_FACE * dist)
  const band = smoothstep(rock.boulder > 0 ? -back - 2 : -back - 25, -back + 1, s) * (1 - smoothstep(footS + 20, footS + 50, s))
  if (band > 0) {
    const n = rock.relief * 2 * (fbm(qx / 18, qz / 18) - 0.5)
    const k1 = vnoise(qx / 6, qz / 6) * 2 - 1
    const k2 = vnoise(qx / 2.3 + 5, qz / 2.3 + 5) * 2 - 1
    const sharp = 0.22 * (1 - Math.sqrt(k1 * k1 + 0.02)) + 0.08 * (1 - Math.sqrt(k2 * k2 + 0.02)) * (1 - smoothstep(40, 120, dist)) - 0.2
    let r: number
    if (rock.boulder > 0) {
      r = h + 0.3 * n + sharp + (boulderField(qx, qz, rock.boulder) - 0.35 * rock.boulder) * (1 - smoothstep(80, 250, dist))
    } else {
      const planes = (-s * Math.sin(rock.strike) + a * Math.cos(rock.strike)) * rock.dip
      const layer = (h + n - planes) / rock.bedding
      const f = layer - Math.floor(layer)
      const steep = Math.abs(
        bareRock(rock, coast.nearshoreSlope, coast.seabedDepth, s + 0.5, width, dist) - bareRock(rock, coast.nearshoreSlope, coast.seabedDepth, s - 0.5, width, dist)
      )
      const riser = Math.min(1, 0.3 + 0.008 * dist + (0.05 * dist * steep) / rock.bedding)
      r = (Math.floor(layer) + smoothstep(1 - riser, 1, f) + 0.5 - 0.5 * riser + 0.01) * rock.bedding + planes + sharp
      r -= rock.gully * gully * (0.4 + 0.6 * smoothstep(0, Math.max(width, 20), s)) * (1 - smoothstep(150, 400, dist))
    }
    h += (r - h) * band
  }
  return h - coast.tide.level
}

