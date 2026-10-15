import {
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D
} from 'three'

import type { RGB } from '../biome'
import type { IslandKind, IslandParams } from '../params'
import { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { curvatureDrop } from './landforms'
import { fbm3 } from './noise'
import { palm } from './vegetation'

// Islands offshore, a few kilometres out (see IslandParams). Each is a
// heightfield on a polar grid round its centre, with a noisy outline, its
// profile by kind: rounded granite humps, cliffs under a scrubby cap, a flat
// sand cay, sheer karst towers, or a big ridged volcanic island. Colour is
// baked per vertex from height, slope and noise (rock, wet rock at the
// waterline, beach, scrub or forest, snow). Like the mountains, every vertex
// drops with the Earth's curvature, so far islands sink behind the horizon.
// Palms on cays and pines on skerries are real trees, instanced; the
// forests of bigger islands are colour and relief.

/** Local frame of one island: x across the view, y away from the camera. */
export interface Shape {
  kind: IslandKind
  /** Half-width across the view and half-depth (m). */
  rx: number
  ry: number
  height: number
  seed: number
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const ridged = (x: number, y: number, seed: number): number => 1 - Math.abs(fbm3(x, y, 0.5, seed) * 2 - 1)

/** The island's edge at angle `a`, as a fraction of its radii: a wobbly
 * outline with coves and points. */
function outline(shape: Shape, a: number): number {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const wobble = shape.kind === 'karst' ? 0.25 : shape.kind === 'cay' ? 0.3 : 0.45
  return 1 - wobble * 0.5 + wobble * fbm3(c * 1.6, s * 1.6, 3.3, shape.seed)
}

/** Normalised radius of a local point (1 = the shoreline). */
function radius(shape: Shape, x: number, y: number): number {
  const a = Math.atan2(y / shape.ry, x / shape.rx)
  return Math.hypot(x / shape.rx, y / shape.ry) / outline(shape, a)
}

/** Height above the sea (m) at a local point; below 0 off the island. */
export function islandHeight(shape: Shape, x: number, y: number): number {
  const r = radius(shape, x, y)
  const H = shape.height
  const L = Math.max(shape.rx, shape.ry)
  const n = fbm3(x / (L * 0.35), y / (L * 0.35), 1.7, shape.seed)
  const fine = fbm3(x / (L * 0.08), y / (L * 0.08), 5.1, shape.seed)
  let h: number
  switch (shape.kind) {
    case 'skerries':
      // Smoothed by the ice sheet: a whaleback dome with knobbly bumps.
      h = H * Math.max(0, 1 - r * r) ** 0.6 * (0.65 + 0.5 * n + 0.15 * fine)
      break
    case 'cay':
      // A flat sand bank barely above the tide, under a thicket of
      // beach shrubs (Scaevola, Pemphis) a few metres high, palms over it.
      h = H * smoothstep(1, 0.55, r) * (0.8 + 0.4 * n) + 5 * smoothstep(0.82, 0.6, r) * (0.55 + 0.6 * fine)
      break
    case 'karst': {
      // Sheer walls, a rounded, lumpy top, notched at sea level.
      // Fluted: the wall's foot wanders with angle, so it's never a drum.
      const flute = 0.12 * fbm3(Math.atan2(y, x) * 4, 0.5, 6.2, shape.seed)
      const wall = smoothstep(1, 0.8 - flute, r) ** 0.5
      h = H * wall * (1 - 0.4 * r * r) * (0.55 + 0.7 * n + 0.2 * fine)
      break
    }
    case 'rocky': {
      // Cliffs round the coast, rising to a ridge inland.
      const cliff = smoothstep(1, 0.88, r)
      const ridge = Math.max(0, 1 - r) ** 0.9 * (0.5 + 0.6 * ridged(x / (L * 0.5), y / (L * 0.5), shape.seed + 1))
      h = H * (0.25 * cliff + 0.75 * ridge * cliff) * (0.8 + 0.3 * fine)
      break
    }
    case 'high': {
      // A worn volcano: a main peak off-centre, ridges and gullies, a
      // coastal cliff.
      const cliff = smoothstep(1, 0.93, r)
      const cone = Math.max(0, 1 - r) ** 1.3
      const ridges = 0.55 + 0.45 * ridged(Math.atan2(y, x) * 3, r * 4, shape.seed + 2)
      h = H * cliff * (0.06 + 0.94 * cone * ridges * (0.75 + 0.5 * n))
      break
    }
  }
  // Off the island: drop under the sea so no gap shows at the waterline.
  if (r > 1) h = -Math.min(1, (r - 1) * 12) * Math.max(4, H * 0.1)
  return h
}

interface Palette {
  rock: RGB
  vegetation: RGB | null
  sand: RGB
  snow: boolean
}

const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t))) as RGB

function surfaceColor(shape: Shape, p: Palette, h: number, steep: number, n: number): RGB {
  const H = shape.height
  let c = p.rock.map(v => v * (0.7 + 0.6 * n)) as RGB
  // Wet, dark rock and weed at the waterline; bleached above the splash.
  const wet = 1 - smoothstep(0.2, Math.min(3, H * 0.15), h)
  c = mix(c, c.map(v => v * 0.35) as RGB, wet * (1 - steep * 0.3))
  // A beach round low islands.
  if (shape.kind === 'cay') {
    c = mix(c, p.sand.map(v => v * (0.9 + 0.2 * n)) as RGB, 1 - wet * 0.6)
    if (p.vegetation != null) return mix(c, p.vegetation.map(v => v * (0.6 + 0.5 * n)) as RGB, smoothstep(H * 1.05, H * 1.4, h))
  }
  // Limestone weathers grey with dark streaks of runoff down the walls.
  if (shape.kind === 'karst') c = c.map(v => v * (0.45 + 0.5 * n)) as RGB
  // Scrub and forest on the gentler slopes above the shore; on karst,
  // jungle clings to the walls too.
  if (p.vegetation != null) {
    const above = smoothstep(Math.min(2.5, H * 0.3), Math.min(8, H * 0.5), h)
    const cover = shape.kind === 'rocky' ? 0.6 : shape.kind === 'skerries' ? 0.5 : 1
    const slope = shape.kind === 'karst' ? 0.6 + 0.4 * (1 - steep) : 1 - smoothstep(0.55, 0.9, steep)
    const green = above * slope * smoothstep(0.25, 0.55, n * cover + 0.35 * cover)
    // Forest seen from afar is darker than its leaves: shadow between crowns.
    c = mix(c, p.vegetation.map(v => v * (0.55 + 0.5 * n)) as RGB, green)
  }
  if (p.snow) {
    const snow = smoothstep(H * 0.25, H * 0.45, h + (n - 0.5) * H * 0.3) * (1 - smoothstep(0.5, 0.85, steep))
    c = mix(c, [0.8, 0.82, 0.86], snow)
  }
  return c
}

/** Places a local (x, y, h) of an island centred at `at`, facing `away`. */
type ToWorld = (x: number, y: number, h: number) => Vector3

function islandGeometry(shape: Shape, palette: Palette, toWorld: ToWorld): BufferGeometry {
  const rings = shape.kind === 'high' || shape.kind === 'rocky' ? 90 : 64
  const segments = 192
  const b = new MeshBuilder()
  const grid: number[][] = []
  const e = Math.max(shape.rx, shape.ry) / rings
  for (let i = 0; i <= rings; i++) {
    // Rings bunch up near the shore, where cliffs and beaches are.
    const t = i / rings
    const r = 1.12 * (1 - (1 - t) ** 1.6)
    const row: number[] = []
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2
      const edge = outline(shape, a)
      const x = Math.cos(a) * r * edge * shape.rx
      const y = Math.sin(a) * r * edge * shape.ry
      const h = islandHeight(shape, x, y)
      const steep = Math.min(1, Math.hypot(islandHeight(shape, x + e, y) - h, islandHeight(shape, x, y + e) - h) / e / 1.5)
      const n = fbm3(x / 40, y / 40, 8.2, shape.seed) * 0.6 + fbm3(x / 9, y / 9, 2.9, shape.seed) * 0.4
      row.push(b.vertex(toWorld(x, y, h), surfaceColor(shape, palette, h, steep, n)))
    }
    grid.push(row)
  }
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < segments; k++) {
      const k2 = (k + 1) % segments
      b.quad(grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k])
    }
  }
  return b.build()
}

/** A pine seen from a kilometre or more: a trunk and a dark, narrow cone. */
function distantPine(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(10, 18)
  b.tube([new Vector3(0, 0, 0), new Vector3(0, height * 0.35, 0)], () => 0.25, () => [0.12, 0.08, 0.06], 5)
  const crown: Vector3[] = []
  for (let i = 0; i <= 8; i++) crown.push(new Vector3(rng.normal(0, 0.15), height * (0.2 + 0.8 * (i / 8)), rng.normal(0, 0.15)))
  const dark = foliage.map(v => v * 0.6) as RGB
  b.tube(crown, t => (1 - t) * height * 0.17 * (0.85 + 0.3 * Math.sin(t * 19)), () => dark, 7)
  return b.build()
}

/** Trees on an island where it's low, gentle ground above the shore. */
function trees(
  rng: Random,
  shape: Shape,
  toWorld: ToWorld,
  build: () => BufferGeometry,
  count: number,
  band: [number, number]
): InstancedMesh | null {
  const spots: Matrix4[] = []
  for (let i = 0; i < count * 8 && spots.length < count; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = Math.sqrt(rng.float()) * 0.95
    const x = Math.cos(a) * r * shape.rx
    const y = Math.sin(a) * r * shape.ry
    const h = islandHeight(shape, x, y)
    if (h < band[0] || h > band[1]) continue
    // Groves and clearings.
    if (fbm3(x / 60, y / 60, 4.4, shape.seed) < 0.45) continue
    const q = new Quaternion().setFromEuler(new Euler(rng.normal(0, 0.06), rng.range(0, Math.PI * 2), rng.normal(0, 0.06)))
    spots.push(new Matrix4().compose(toWorld(x, y, h - 0.2), q, new Vector3().setScalar(rng.range(0.8, 1.2))))
  }
  if (spots.length === 0) return null
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide })
  // No sun glints on edge-on leaves (see vegetation.ts).
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);'
    )
  }
  const mesh = new InstancedMesh(build(), material, spots.length)
  spots.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  return mesh
}

/** Where an island fits: over open water (not the shore, not another
 * island or the colony's rock), in the frame. Tries the drawn spot first. */
function place(
  ctx: PropContext,
  rng: Random,
  island: IslandParams['islands'][number],
  taken: { at: Vector3; r: number }[]
): Vector3 | null {
  const camera = ctx.camera
  const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
  const halfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
  const r = island.width / 2
  for (let i = 0; i < 80; i++) {
    const offset = i === 0 ? island.offset : rng.range(-0.95, 0.95)
    const distance = i === 0 ? island.distance : island.distance * rng.range(0.7, 1.5)
    const dir = forward.clone().applyAxisAngle(new Vector3(0, 1, 0), -offset * halfFov)
    const at = camera.position.clone().setY(0).addScaledVector(dir, distance)
    // Its middle in the frame, low enough not to be above the top edge.
    if (!ctx.inFrame(at.x, Math.min(island.height * 0.3, 30) - curvatureDrop(at.x, at.z), at.z, 0.97)) continue
    if (taken.some(t => t.at.distanceTo(at) < (t.r + r) * 1.1)) continue
    const clear = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(k => {
      const a = (k / 12) * Math.PI * 2
      return ctx.ground(at.x + Math.cos(a) * r * 1.4, at.z + Math.sin(a) * r * 1.4) < -3
    })
    if (clear && ctx.ground(at.x, at.z) < -3) return at
  }
  return null
}

export function createIslands(ctx: PropContext, avoid: Object3D | null): Object3D[] {
  const params = ctx.params.islands
  if (params == null) return []
  const { biome, sea } = ctx.params
  const rng = ctx.rng('islands')
  const polar = sea.ocean === 'arctic' || sea.ocean === 'southern'
  const palette: Palette = {
    rock: rng.pick(biome.rockColors),
    // Bare in the polar seas and on desert coasts; dark forest elsewhere.
    vegetation: polar || biome.name === 'desert' ? null : biome.foliage,
    sand: params.kind === 'cay' ? [0.7, 0.66, 0.56] : ctx.params.coast.sand.albedo,
    snow: polar && params.kind !== 'cay'
  }
  const taken: { at: Vector3; r: number }[] = []
  if (avoid != null) taken.push({ at: avoid.position.clone().setY(0), r: 250 })
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
  const objects: Object3D[] = []
  for (const island of params.islands) {
    const at = place(ctx, rng, island, taken)
    if (at == null) continue
    taken.push({ at, r: island.width / 2 })
    // Islands are longer across the view than deep, mostly.
    const shape: Shape = {
      kind: params.kind,
      rx: island.width / 2,
      ry: (island.width / 2) * (params.kind === 'karst' ? rng.range(0.7, 1.1) : rng.range(0.4, 0.8)),
      height: island.height,
      seed: island.seed
    }
    const away = at.clone().sub(ctx.camera.position.clone().setY(0)).normalize()
    const across = new Vector3(-away.z, 0, away.x)
    const toWorld: ToWorld = (x, y, h) => {
      const p = at.clone().addScaledVector(across, x).addScaledVector(away, y)
      p.y = h - curvatureDrop(p.x, p.z)
      return p
    }
    const group: Object3D[] = [new Mesh(islandGeometry(shape, palette, toWorld), material)]
    const local = new Random(`${ctx.params.seed}/island/${island.seed}`)
    if (params.kind === 'cay') {
      const palms = trees(local, shape, toWorld, () => palm(local, biome.foliage), Math.min(250, Math.round(island.width * 0.4)), [0.6, Infinity])
      if (palms != null) group.push(palms)
    } else if (params.kind === 'skerries' && palette.vegetation != null && island.width > 120) {
      const pines = trees(local, shape, toWorld, () => distantPine(local, palette.vegetation!), Math.round(island.width * 0.6), [island.height * 0.25, Infinity])
      if (pines != null) group.push(pines)
    }
    for (const o of group) {
      o.frustumCulled = false
      // Far islands are hazed by aerial perspective, which the reflection
      // pass doesn't apply (see scene.ts): leave them out of the mirror.
      if (at.distanceTo(ctx.camera.position) > 5000) o.userData.distant = true
      objects.push(o)
    }
  }
  return objects
}
