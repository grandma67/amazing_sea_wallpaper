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

import type { RGB } from '../biome'
import type { CoastParams, SceneParams } from '../params'
import type { Random } from '../random'
import { shoreToWorld, terrainNormal } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { noise3 } from './noise'

// What the sea leaves on the beach. Two lines run along most beaches: the
// wrack line at the last high tide (seaweed, seagrass, a few sticks), and
// higher up, at the back of the beach, the storm line where big waves threw
// logs that the tides can't reach to move again.
//
// Driftwood comes from forested coasts and rivers: the Pacific Northwest and
// New Zealand pile whole trees at the back of their beaches, and the treeless
// Arctic (Iceland, Svalbard, Greenland) gets logs from Siberian rivers carried
// by the Transpolar Drift — larch often with its roots on. Southern Ocean
// coasts have no forests upstream, so no wood. Mediterranean beaches gather
// banquettes of dead Posidonia seagrass leaves and its fibre balls; kelp coasts
// (the north, the cold upwelling deserts) get kelp; the tropical Atlantic gets
// golden sargassum; palm coasts get coconuts.

export type WrackKind = 'kelp' | 'seagrass' | 'sargassum'

export interface DebrisSpec {
  /** How much driftwood, 0 = none, 1 = a log-strewn northern beach. */
  driftwood: number
  /** Logs that came down rivers with their roots on. */
  rootWads: boolean
  wrack: WrackKind | null
  wrackAmount: number
  coconuts: number
}

/** What washes up on this coast, or null for no beach. */
export function debrisFor(params: SceneParams, rng: Random): DebrisSpec | null {
  if (params.coast.type !== 'beach') return null
  const ocean = params.sea.ocean
  const spec: DebrisSpec = { driftwood: 0, rootWads: false, wrack: null, wrackAmount: 0, coconuts: 0 }
  const wood = (chance: number, min: number, max: number): void => {
    if (rng.chance(chance)) spec.driftwood = rng.range(min, max)
  }
  const wrack = (kind: WrackKind, chance: number): void => {
    if (rng.chance(chance)) {
      spec.wrack = kind
      spec.wrackAmount = rng.range(0.3, 1)
    }
  }
  switch (params.biome.name) {
    case 'nordic':
      if (ocean === 'arctic') wood(0.9, 0.6, 1)
      else if (ocean !== 'southern') wood(0.6, 0.25, 0.9)
      wrack('kelp', 0.8)
      break
    case 'volcanic':
      if (ocean === 'pacific') wood(0.65, 0.4, 1)
      else if (ocean !== 'southern') wood(0.4, 0.2, 0.7)
      wrack('kelp', 0.6)
      break
    case 'mediterranean':
      wood(0.35, 0.1, 0.35)
      wrack('seagrass', 0.65)
      break
    case 'tropical':
      wood(0.3, 0.1, 0.4)
      if (ocean === 'atlantic') wrack('sargassum', 0.5)
      else wrack('seagrass', 0.25)
      if (rng.chance(0.6)) spec.coconuts = rng.range(0.3, 1)
      break
    case 'desert':
      wood(0.08, 0.05, 0.2)
      wrack('kelp', 0.6)
      break
  }
  spec.rootWads = spec.driftwood > 0 && rng.chance(ocean === 'arctic' || ocean === 'pacific' ? 0.8 : 0.4)
  return spec
}

/** How far inland (m from the waterline) the high-tide wrack line and the
 * storm line lie, from the beach profile in terrain.ts without its bumps. */
export function beachLines(coast: CoastParams): { highTide: number; stormLine: number } {
  const maxHeight = coast.beachSlope * coast.beachWidth
  const inland = (h: number): number => -coast.beachWidth * Math.log(1 - Math.min(h / maxHeight, 0.9))
  const highTide = inland(coast.runup * 1.1)
  return { highTide, stormLine: Math.max(inland(coast.runup * 2.2), highTide + 3) }
}

const BLEACHED: RGB = [0.27, 0.25, 0.22]
const BARK: RGB = [0.11, 0.085, 0.06]
const END_GRAIN: RGB = [0.32, 0.28, 0.22]
const WRACK_COLORS: Record<WrackKind, RGB> = {
  kelp: [0.05, 0.04, 0.018],
  seagrass: [0.085, 0.072, 0.055],
  sargassum: [0.27, 0.17, 0.045]
}
const COCONUT: RGB = [0.2, 0.13, 0.065]

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

/** A small hash in [0, 1) for detail that mustn't consume the stream. */
function hash(...n: number[]): number {
  let h = 2166136261
  for (const v of n) h = Math.imul(h ^ Math.floor(v * 1000), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

/** A path along +X, lying on the ground, with a slight bow and sag. */
function lyingPath(length: number, steps: number, bow: number, x0 = -length / 2): Vector3[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return new Vector3(x0 + length * t, bow * 0.3 * Math.sin(t * Math.PI), bow * Math.sin(t * Math.PI))
  })
}

/** A log lying along X with its underside at y ≈ 0: bleached and split
 * along the grain, or still in dark bark; broken branch stubs; sometimes a
 * flared root wad at one end. */
export function logGeometry(rng: Random, rootWad: boolean): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(3, 12)
  const r0 = rng.range(0.16, 0.42) * (0.6 + length / 15)
  const r1 = r0 * rng.range(0.5, 0.8)
  const barked = rng.chance(0.2)
  const base: RGB = barked ? BARK : shade(BLEACHED, rng.range(0.7, 1.2))
  const oval = rng.range(0.05, 0.18)
  const ovalPhase = rng.range(0, Math.PI)
  const seed = rng.int(0, 1e6)
  const steps = Math.ceil(length / 0.25)
  const path = lyingPath(length, steps, rng.normal(0, length * 0.03)).map(p => p.setY(p.y + r0))
  const radius = (t: number, a: number): number => {
    const flare = rootWad ? 1 + 0.7 * Math.exp(-t * length * 1.2) : 1
    // Splits and checks along the grain, deeper where it has weathered.
    const grain = noise3(a * 3, t * length * 0.6, 0, seed)
    const check = Math.max(0, grain - 0.7) * 0.9
    // Bulges and knots along it, an oval section, and a splintered end.
    const swell = 1 + 0.14 * (noise3(t * length * 0.7, 0, 3, seed) - 0.5) + 0.1 * Math.max(0, noise3(t * length * 2.5, a, 5, seed) - 0.75) * 4
    const section = 1 + oval * Math.cos(2 * a + ovalPhase)
    const splinter = t > 0.96 ? 1 - (t - 0.96) * 12 * noise3(a * 4, 9, 9, seed) : 1
    return (r0 + (r1 - r0) * t) * flare * swell * section * splinter * (1 - check)
  }
  const color = (t: number, a: number): RGB => {
    const grain = noise3(a * 3, t * length * 0.6, 0, seed)
    const streak = 0.85 + 0.25 * noise3(a * 12, t * length * 3, 1, seed)
    // Angle 0 faces down: damp, sand-stained underside.
    const under = 1 - 0.35 * Math.max(0, Math.cos(a))
    const k = streak * under * (grain > 0.7 ? 0.4 : 1)
    return shade(barked && grain > 0.78 ? BLEACHED : base, k)
  }
  const rings = b.tube(path, radius, color, 14)
  const axis = new Vector3(1, 0, 0)
  b.cap(rings[0], axis.clone().negate(), rootWad ? shade(base, 0.7) : END_GRAIN)
  b.cap(rings[rings.length - 1], axis, END_GRAIN)

  // Broken-off branch stubs, upward and sideways (the ones below broke off
  // when it rolled).
  const stubs = rng.int(0, 3)
  for (let i = 0; i < stubs; i++) {
    const t = rng.range(0.2, 0.9)
    const at = path[Math.round(t * steps)]
    // Mostly sideways: ones sticking up snapped off in the surf.
    const a = Math.PI / 2 + (rng.chance(0.5) ? 0 : Math.PI) + rng.normal(0, 0.35)
    const out = new Vector3(rng.range(0.3, 0.9), -Math.cos(a), -Math.sin(a)).normalize()
    const r = (r0 + (r1 - r0) * t) * rng.range(0.25, 0.4)
    const len = rng.range(0.1, 0.4)
    const stub = [0, 1, 2, 3].map(k => at.clone().addScaledVector(out, r0 * 0.6 + (len * k) / 3))
    const ends = b.tube(stub, s => r * (1 - 0.35 * s), () => base, 8)
    b.cap(ends[ends.length - 1], out, END_GRAIN)
  }

  // Root wad: roots spread round the butt end, curling back along the log.
  if (rootWad) {
    const roots = rng.int(7, 12)
    const butt = path[0]
    for (let i = 0; i < roots; i++) {
      const a = (i / roots) * Math.PI * 2 + rng.normal(0, 0.2)
      // Roots that would dig in are bent flat along the sand.
      const down = -Math.cos(a)
      const side = -Math.sin(a)
      const spread =
        down >= 0
          ? new Vector3(0, down, side)
          : new Vector3(0, down * 0.2, (side < 0 ? -1 : 1) * Math.sqrt(1 - (down * 0.2) ** 2))
      const len = rng.range(0.6, 2) * (0.7 + r0 * 1.5)
      const root: Vector3[] = []
      for (let k = 0; k <= 8; k++) {
        const s = k / 8
        root.push(
          butt
            .clone()
            .addScaledVector(spread, r0 * 0.8 + len * s)
            .add(new Vector3(len * 0.4 * s * s + 0.15, len * 0.15 * (hash(seed, i, k) - 0.5), 0))
        )
      }
      b.tube(root, s => r0 * 0.35 * (1 - 0.85 * s), s => shade(base, 0.75 + 0.2 * s), 7)
    }
  }
  return b.build()
}

/** A forked branch or stick lying on the ground. */
export function branchGeometry(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(1, 4)
  const r = rng.range(0.025, 0.07)
  const color = shade(BLEACHED, rng.range(0.85, 1.15))
  const path = lyingPath(length, 10, rng.normal(0, length * 0.06)).map(p => p.setY(p.y + r))
  b.tube(path, t => r * (1 - 0.6 * t), () => color, 7)
  const forks = rng.int(1, 3)
  for (let i = 0; i < forks; i++) {
    const from = path[rng.int(3, 8)]
    const side = rng.chance(0.5) ? 1 : -1
    const len = rng.range(0.3, 1.2)
    const dir = new Vector3(0.7, 0.05, side * rng.range(0.4, 0.9)).normalize()
    const fork = [0, 1, 2, 3].map(k => from.clone().addScaledVector(dir, (len * k) / 3))
    b.tube(fork, t => r * 0.5 * (1 - 0.6 * t), () => color, 6)
  }
  return b.build()
}

/** A heap of seaweed or seagrass: a low tangled mound with loose leaves,
 * blades or stipes strewn round it. */
function clumpGeometry(rng: Random, kind: WrackKind, big: boolean): BufferGeometry {
  const b = new MeshBuilder()
  const seed = rng.int(0, 1e6)
  // Posidonia banquettes are thick mats; kelp and sargassum lie in thin heaps.
  const size = big ? rng.range(1, 2.6) : kind === 'seagrass' ? rng.range(0.4, 1) : rng.range(0.25, 0.7)
  const height = Math.max(0.04, size * (kind === 'seagrass' ? rng.range(0.07, 0.13) : rng.range(0.08, 0.15)))
  const radii = new Vector3(size, height, size * rng.range(0.35, 0.7))
  const base = WRACK_COLORS[kind]
  // Fine, sharp lumps: a tangle, not a stone. Sargassum is all little floats.
  const fine = kind === 'sargassum' ? 14 : 9
  b.blob(
    new Vector3(0, height * 0.3, 0),
    radii,
    n => shade(base, 0.6 + 0.8 * noise3(n.x * fine, n.y * fine, n.z * fine, seed)),
    n => 0.65 + 0.35 * noise3(n.x * 3 + 5, n.y * 3, n.z * 3, seed) + 0.25 * noise3(n.x * fine, n.y * fine, n.z * fine, seed + 1),
    6
  )
  if (kind === 'sargassum') return b.build()

  // Loose leaves (seagrass: narrow, many, matted over the heap) or blades
  // (kelp: broad, few), draped over the mound and strewn round it.
  const surface = (x: number, z: number): number => {
    const q = 1 - (x / radii.x) ** 2 - (z / radii.z) ** 2
    return q > 0 ? height * (0.3 * Math.min(1, q * 5) + 0.85 * Math.sqrt(q)) : 0
  }
  const dried: RGB = kind === 'seagrass' ? [0.2, 0.16, 0.11] : shade(base, 1.6)
  const leaves = kind === 'seagrass' ? Math.round(30 + size * 140) : rng.int(3, 6)
  for (let i = 0; i < leaves; i++) {
    const az = rng.range(0, Math.PI * 2)
    const from = new Vector3(Math.cos(az) * radii.x, 0, Math.sin(az) * radii.z).multiplyScalar(Math.sqrt(rng.float()) * 1.15)
    const heading = rng.range(0, Math.PI * 2)
    const len = kind === 'seagrass' ? rng.range(0.15, 0.6) : rng.range(0.4, 1.3)
    const curl = rng.normal(0, 1.2)
    const path: Vector3[] = [from]
    for (let k = 1; k <= 6; k++) {
      const h = heading + (curl * k) / 6
      path.push(path[k - 1].clone().add(new Vector3(Math.cos(h), 0, Math.sin(h)).multiplyScalar(len / 6)))
    }
    for (const p of path) p.y = surface(p.x, p.z) + 0.012
    const width = kind === 'seagrass' ? 0.012 : rng.range(0.05, 0.12)
    const color = mixRGB(shade(base, rng.range(0.7, 1.3)), dried, rng.float() ** 2)
    b.ribbon(path, t => width * (1 - 0.6 * t * t), color)
  }
  // Kelp: a stipe or two trailing out of the heap.
  if (kind === 'kelp') {
    for (let i = 0; i < rng.int(0, 2); i++) {
      const az = rng.range(0, Math.PI * 2)
      const len = rng.range(0.6, 1.8)
      const dir = new Vector3(Math.cos(az), 0, Math.sin(az))
      const side = new Vector3(-dir.z, 0, dir.x)
      const stipe = Array.from({ length: 9 }, (_, k) =>
        dir
          .clone()
          .multiplyScalar(size * 0.5 + (len * k) / 8)
          .addScaledVector(side, 0.25 * Math.sin(k * 0.9 + az))
          .setY(0.025)
      )
      b.tube(stipe, t => 0.009 + 0.008 * t, () => shade(base, 0.9), 5)
    }
  }
  return b.build()
}

/** A coconut or a Posidonia fibre ball: a small rough sphere. */
function ballGeometry(rng: Random, color: RGB, r: number): BufferGeometry {
  const b = new MeshBuilder()
  const seed = rng.int(0, 1e6)
  b.blob(
    new Vector3(0, r * 0.8, 0),
    new Vector3(r, r * 0.9, r * 1.1),
    n => shade(color, 0.75 + 0.5 * noise3(n.x * 5, n.y * 5, n.z * 5, seed)),
    n => 0.92 + 0.12 * noise3(n.x * 4, n.y * 4, n.z * 4, seed),
    4
  )
  return b.build()
}

interface Piece {
  variant: number
  matrix: Matrix4
  tint: number
}

export function createDebris(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast } = params
  const rng = ctx.rng('debris')
  const spec = debrisFor(params, rng)
  if (spec == null) return []
  const camera = ctx.camera.position
  const seed = rng.int(0, 1e6)

  const { highTide, stormLine } = beachLines(coast)
  // Turning +X (a log's length) by -azimuth about Y lays it along the shore.
  const alongShore = -(coast.seawardAzimuthDeg * Math.PI) / 180

  /** Place a piece of size `radius` at shore (-u, a), lying on the ground and
   * turned `yaw` from along the shore; false if it's out of view or too close. */
  const place = (
    pieces: Piece[],
    variant: number,
    u: number,
    a: number,
    yaw: number,
    radius: number,
    scale: number,
    sink: number,
    tint: number
  ): boolean => {
    const [x, z] = shoreToWorld(coast, -u, a)
    const y = ctx.ground(x, z)
    if (y < 0.05) return false
    const d = Math.hypot(x - camera.x, z - camera.z)
    if (d < radius + 2.5) return false
    if (!ctx.visible(x, y, z, radius)) return false
    // Nothing big right in front of the lens.
    if (d < 10 && radius > 0.5) {
      const ndc = new Vector3(x, y, z).project(ctx.camera)
      if (Math.abs(ndc.x) < 0.5) return false
    }
    const n = new Vector3(...terrainNormal(coast, x, z, 0.5))
    const q = new Quaternion()
      .setFromUnitVectors(new Vector3(0, 1, 0), n)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), alongShore + yaw))
    const matrix = new Matrix4().compose(new Vector3(x, y - sink * scale, z), q, new Vector3().setScalar(scale))
    pieces.push({ variant, matrix, tint })
    return true
  }

  const meshes: InstancedMesh[] = []
  const build = (geometries: BufferGeometry[], pieces: Piece[], material: MeshStandardMaterial): void => {
    geometries.forEach((geometry, v) => {
      const mine = pieces.filter(p => p.variant === v)
      if (mine.length === 0) {
        geometry.dispose()
        return
      }
      const mesh = new InstancedMesh(geometry, material, mine.length)
      mine.forEach((p, i) => {
        mesh.setMatrixAt(i, p.matrix)
        mesh.setColorAt(i, new Color(p.tint, p.tint, p.tint))
      })
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      meshes.push(mesh)
    })
  }
  const material = (roughness: number): MeshStandardMaterial =>
    new MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, side: DoubleSide })

  // Driftwood: logs heaped along the storm line, in piles, mostly lying
  // parallel to the shore as the waves rolled them; sticks scattered lower.
  if (spec.driftwood > 0) {
    const logs: BufferGeometry[] = []
    const LOGS = 5
    for (let i = 0; i < LOGS; i++) logs.push(logGeometry(rng, spec.rootWads && i >= LOGS - 2))
    const BRANCHES = 4
    for (let i = 0; i < BRANCHES; i++) logs.push(branchGeometry(rng))
    const pieces: Piece[] = []
    const piles = Math.round(3 + spec.driftwood * 14)
    // Try spots until enough piles land in view.
    for (let p = 0, tries = 0; p < piles && tries < piles * 8; tries++) {
      const a = rng.normal(0, 160)
      const u = rng.range(stormLine, Math.max(stormLine + 2, coast.beachWidth * 0.95))
      const [px, pz] = shoreToWorld(coast, -u, a)
      if (!ctx.visible(px, ctx.ground(px, pz), pz, 4)) continue
      p++
      const count = rng.int(1, Math.round(2 + spec.driftwood * 7))
      for (let i = 0; i < count; i++) {
        const variant = rng.int(0, LOGS - 1)
        const yaw = rng.chance(0.75) ? rng.normal(0, 0.3) : rng.range(0, Math.PI)
        place(pieces, variant, u + rng.normal(0, 2), a + rng.normal(0, 6), yaw, 5, rng.range(0.7, 1.2), 0.08, rng.range(0.85, 1.1))
      }
    }
    // Sticks and branches up and down the beach, more on the wrack line.
    const sticks = Math.round(10 + spec.driftwood * 60)
    for (let i = 0; i < sticks; i++) {
      const u = rng.chance(0.5) ? highTide + rng.normal(0, 1) : rng.range(highTide, coast.beachWidth)
      place(pieces, LOGS + rng.int(0, BRANCHES - 1), u, rng.normal(0, 90), rng.range(0, Math.PI * 2), 2, rng.range(0.7, 1.3), 0.02, rng.range(0.85, 1.1))
    }
    build(logs, pieces, material(0.92))
  }

  // The wrack line: patchy heaps along the high-tide mark, a fainter, older
  // and drier line above it. Mediterranean seagrass also piles into
  // banquettes and rolls into fibre balls.
  if (spec.wrack != null) {
    const kind = spec.wrack
    const clumps = [0, 1, 2, 3].map(i => clumpGeometry(rng, kind, kind === 'seagrass' && i === 3))
    if (kind === 'seagrass') clumps.push(ballGeometry(rng, [0.13, 0.095, 0.06], 0.05))
    const pieces: Piece[] = []
    const count = Math.round((80 + spec.wrackAmount * 320) * (kind === 'seagrass' ? 1.5 : 1))
    for (let i = 0; i < count; i++) {
      const a = rng.normal(0, 70) * (rng.chance(0.3) ? 3 : 1)
      // Patchy: the line comes and goes along the shore.
      if (noise3(a / 18, 0, 0, seed) < 0.55 - spec.wrackAmount * 0.25) continue
      const older = rng.chance(0.25)
      const u = (older ? highTide * 1.6 + 1 : highTide) + rng.normal(0, 0.6)
      const r = rng.float()
      const variant = kind !== 'seagrass' ? rng.int(0, 3) : r < 0.12 ? 4 : r < 0.3 ? 3 : rng.int(0, 2)
      const tint = older ? rng.range(0.9, 1.3) : rng.range(0.7, 1)
      place(pieces, variant, u, a, rng.normal(0, 0.4), kind === 'seagrass' && variant === 3 ? 2.6 : 0.8, rng.range(0.7, 1.3), 0.02, tint)
    }
    build(clumps, pieces, material(0.55))
  }

  // Coconuts: a few husks along the wrack line and under the palms.
  if (spec.coconuts > 0) {
    const nuts = [0, 1].map(() => ballGeometry(rng, COCONUT, rng.range(0.1, 0.14)))
    const pieces: Piece[] = []
    for (let i = 0; i < Math.round(4 + spec.coconuts * 20); i++) {
      const u = rng.chance(0.6) ? highTide + rng.normal(0, 1) : rng.range(highTide, coast.beachWidth * 1.1)
      place(pieces, rng.int(0, 1), u, rng.normal(0, 60), rng.range(0, Math.PI * 2), 0.2, rng.range(0.85, 1.15), 0.03, rng.range(0.7, 1.2))
    }
    build(nuts, pieces, material(0.8))
  }
  return meshes
}
