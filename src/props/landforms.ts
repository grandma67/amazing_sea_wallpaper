import {
  type BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Object3D
} from 'three'

import type { RGB } from '../biome'
import { dirFromAzEl, EARTH_RADIUS, type LandformParams } from '../params'
import { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { fbm3 } from './noise'
import { SprayBuilder } from './surf'
import { windDirection } from './wind'

// Mountains and volcanoes on the horizon, kilometres away (see
// LandformParams). They're heightfields in a frame facing the camera; every
// vertex drops with the Earth's curvature like the sea does, so their feet
// sink behind the horizon the way real distant land does, and the aerial
// perspective pass hazes them blue with distance.

const ridged = (x: number, y: number, seed: number): number => 1 - Math.abs(fbm3(x, y, 0.5, seed) * 2 - 1)

/** Same curvature as the ocean grid (ocean.ts), so land and sea meet. */
export const curvatureDrop = (x: number, z: number): number => (0.9 * (x * x + z * z)) / (2 * EARTH_RADIUS)

interface Palette {
  rock: RGB
  vegetation: RGB | null
  snow: RGB
}

function palette(ctx: PropContext, rng: Random): Palette {
  const biome = ctx.params.biome
  const vegetation: Record<typeof biome.name, RGB | null> = {
    tropical: [0.035, 0.07, 0.025],
    mediterranean: [0.07, 0.08, 0.04],
    nordic: [0.05, 0.07, 0.04],
    volcanic: [0.05, 0.09, 0.035],
    desert: null
  }
  const polar = ctx.params.sea.ocean === 'arctic' || ctx.params.sea.ocean === 'southern'
  return {
    rock: rng.pick(biome.rockColors),
    vegetation: polar ? null : vegetation[biome.name],
    snow: [0.8, 0.82, 0.86]
  }
}

/** Colour of a point on the mountain from its height, slope and noise. */
function surfaceColor(
  p: Palette,
  land: LandformParams,
  h: number,
  steep: number,
  n: number,
  craterAsh: number
): RGB {
  // Rock strata, scree and old lava flows: uneven tone.
  let c = p.rock.map(v => v * (0.65 + 0.7 * n)) as RGB
  // Forest and scrub on the lower, gentler slopes.
  if (p.vegetation != null) {
    const treeline = land.height * 0.45
    const green = Math.max(0, Math.min(1, (treeline - h) / (treeline * 0.3) + (n - 0.5))) * (1 - steep * 0.8)
    c = c.map((v, i) => v + (p.vegetation![i] - v) * green) as RGB
  }
  // Snow, deeper in the hollows, thinning on steep faces.
  if (Number.isFinite(land.snowLine)) {
    const snow = Math.max(0, Math.min(1, (h - land.snowLine) / (land.height * 0.08) + (n - 0.5) * 1.5)) * (1 - steep * 0.6)
    c = c.map((v, i) => v + (p.snow[i] - v) * snow) as RGB
  }
  // Fresh dark ash around an active crater.
  if (craterAsh > 0) c = c.map(v => v * (1 - 0.6 * craterAsh)) as RGB
  return c
}

/** A coastal range: ridged peaks along a band facing the camera. */
function range(land: LandformParams, frame: Frame, p: Palette): BufferGeometry {
  const { height: H, width: W } = land
  const depth = W * 0.35
  const cols = 240
  const rows = 70
  const b = new MeshBuilder()
  const seed = land.seed
  const heightAt = (u: number, v: number): number => {
    const across = 1 - (2 * u) / W
    const envelope = Math.max(0, 1 - across * across) ** 0.6 * (0.55 + 0.45 * fbm3(u / (W * 0.18), 0.3, 0.7, seed))
    const rise = Math.min(1, v / (depth * 0.35)) ** 0.8
    const peaks = 0.45 + 0.55 * ridged(u / (H * 2.2), v / (H * 2.2), seed + 1) ** 1.5
    return H * envelope * rise * peaks
  }
  const grid: number[][] = []
  for (let j = 0; j <= rows; j++) {
    const v = (j / rows) * depth
    const row: number[] = []
    for (let i = 0; i <= cols; i++) {
      const u = (i / cols) * W
      const h = heightAt(u, v)
      const dh = Math.abs(heightAt(u + W / cols, v) - h) + Math.abs(heightAt(u, v + depth / rows) - h)
      const steep = Math.min(1, dh / (W / cols) / 1.2)
      const n = fbm3(u / 900, v / 900, 2.1, seed + 3)
      const world = frame.toWorld(u - W / 2, v, h)
      row.push(b.vertex(world, surfaceColor(p, land, h, steep, n, 0)))
    }
    grid.push(row)
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) b.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
  }
  return b.build()
}

/** Volcano cone height at radius r (m): concave strato or broad shield. */
function coneHeight(land: LandformParams, r: number, angle: number): number {
  const R = land.width / 2
  const H = land.height
  const t = Math.min(1, r / R)
  const crater = 0.035
  let h = land.kind === 'strato' ? H * (1 - Math.max(t, crater)) ** 1.8 : H * (1 - t * t) ** 1.4
  // Summit crater.
  if (t < crater) h -= H * 0.04 * (1 - (t / crater) ** 2)
  // Radial gullies cut by rain and lahars, deepest on the mid slopes.
  const gully = ridged(angle * 9, t * 5, land.seed + 7)
  h -= H * 0.05 * gully * t * (1 - t) * 4
  return Math.max(0, h)
}

function volcano(land: LandformParams, frame: Frame, p: Palette): BufferGeometry {
  const R = land.width / 2
  const rings = 90
  const segments = 160
  const b = new MeshBuilder()
  const grid: number[][] = []
  for (let i = 0; i <= rings; i++) {
    const r = R * 1.05 * (i / rings) ** 1.3
    const row: number[] = []
    for (let k = 0; k < segments; k++) {
      const angle = (k / segments) * Math.PI * 2
      const h = coneHeight(land, r, angle)
      const dr = R / rings
      const steep = Math.min(1, Math.abs(coneHeight(land, r + dr, angle) - h) / dr / 0.9)
      // Gullies are darker (shadowed, wet, fresh scree).
      const gully = ridged(angle * 9, (r / R) * 5, land.seed + 7)
      const n = fbm3((Math.cos(angle) * r) / 800, (Math.sin(angle) * r) / 800, 4.4, land.seed + 2) * 0.6 + (1 - gully) * 0.4
      const ash = land.plume != null ? Math.max(0, 1 - r / (R * 0.25)) : 0
      row.push(b.vertex(frame.toWorld(Math.cos(angle) * r, R + Math.sin(angle) * r, h), surfaceColor(p, land, h, steep, n, ash)))
    }
    grid.push(row)
  }
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < segments; k++) {
      const k2 = (k + 1) % segments
      b.quad(grid[i][k], grid[i + 1][k], grid[i + 1][k2], grid[i][k2])
    }
  }
  return b.build()
}

/** Local frame: u across the view, v away from the camera, h up. */
class Frame {
  readonly origin: Vector3
  readonly across: Vector3
  readonly away: Vector3
  readonly sink: number

  constructor(ctx: PropContext, land: LandformParams, extentAway: number) {
    const [dx, , dz] = dirFromAzEl(land.azimuthDeg, 0)
    this.away = new Vector3(dx, 0, dz)
    this.across = new Vector3(-dz, 0, dx)
    // The landform's near edge, measured from the camera.
    const near = Math.max(2000, land.distance - extentAway / 2)
    this.origin = ctx.camera.position.clone().setY(0).addScaledVector(this.away, near)
    // Let the foot sink below sea level so no gap shows at the waterline.
    this.sink = 40
  }

  toWorld(u: number, v: number, h: number): Vector3 {
    const p = this.origin.clone().addScaledVector(this.across, u).addScaledVector(this.away, v)
    p.y = h - this.sink - curvatureDrop(p.x, p.z)
    return p
  }
}

export function createLandforms(ctx: PropContext): Object3D[] {
  const land = ctx.params.landform
  if (land == null) return []
  const rng = new Random(`${ctx.params.seed}/landform/${land.seed}`)
  const colors = palette(ctx, rng)
  const isRange = land.kind === 'range'
  const frame = new Frame(ctx, land, isRange ? land.width * 0.35 : land.width)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
  const mountain = new Mesh(isRange ? range(land, frame, colors) : volcano(land, frame, colors), material)
  mountain.frustumCulled = false
  const objects: Object3D[] = [mountain]
  if (isRange) return markDistant(objects)

  const R = land.width / 2
  const summit = frame.toWorld(0, R, coneHeight(land, 0, 0) + frame.sink)

  // An active volcano's plume: puffs rising from the crater, spreading and
  // bending downwind.
  if (land.plume != null) {
    const ash = land.plume === 'ash'
    const plume = new SprayBuilder()
    const rise = land.height * rng.range(0.8, 2)
    const wind = windDirection(ctx.params).multiplyScalar(rise * rng.range(0.6, 1.6))
    for (let i = 0; i < 700; i++) {
      const t = rng.float() ** 0.8
      const spread = 120 + t * rise * 0.3
      const p = summit
        .clone()
        .addScaledVector(wind, t ** 1.5)
        .add(new Vector3(rng.normal(0, spread), t * rise + rng.normal(0, spread * 0.4), rng.normal(0, spread)))
      plume.add(p, 200 + t * rng.range(500, 1100), (ash ? rng.range(0.5, 0.85) : rng.range(0.35, 0.7)) * (1 - t * 0.5))
    }
    const points = plume.build(ash ? new Color(0.22, 0.2, 0.19) : new Color(0.8, 0.8, 0.8), false)
    if (points != null) objects.push(points)
  }

  // Glowing lava: the crater and one to three flows down the flank.
  if (land.lava) {
    const b = new MeshBuilder()
    const glow: RGB = [1, 1, 1]
    b.blob(summit.clone().add(new Vector3(0, -land.height * 0.02, 0)), new Vector3(R * 0.04, R * 0.012, R * 0.04), () => glow, () => 1, 5)
    for (let f = rng.int(1, 3); f > 0; f--) {
      // Down the camera-facing side, wandering along the gullies.
      let angle = -Math.PI / 2 + rng.normal(0, 0.6)
      const path: Vector3[] = []
      for (let r = R * 0.04; r < R * rng.range(0.25, 0.6); r += R * 0.01) {
        angle += rng.normal(0, 0.03)
        path.push(frame.toWorld(Math.cos(angle) * r, R + Math.sin(angle) * r, coneHeight(land, r, angle) + 15))
      }
      if (path.length > 2) b.tube(path, t => R * 0.006 * (1 - t * 0.6), () => glow, 5)
    }
    const lava = new Mesh(b.build(), new MeshBasicMaterial({ vertexColors: true }))
    lava.userData.glow = { color: [1, 0.32, 0.06], scale: 60 }
    lava.frustumCulled = false
    objects.push(lava)
  }
  return markDistant(objects)
}

function markDistant(objects: Object3D[]): Object3D[] {
  for (const o of objects) o.userData.distant = true
  return objects
}
