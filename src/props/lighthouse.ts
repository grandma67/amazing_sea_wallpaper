import {
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Object3D
} from 'three'

import type { RGB } from '../biome'
import type { LighthouseParams, TimeOfDay } from '../params'
import { shoreToWorld } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { fbm3 } from './noise'
import { rockGeometry, rockMaterial } from './rocks'

// A lighthouse (see LighthouseParams): a tapering round tower with a gallery,
// the glazed lantern room and a dome, on a rocky point of the shore (with
// the keeper's house) or a rock out at sea. When it's lit the lantern glows
// and the beams are drawn in screen space (../lighthouse.ts); the tower's
// `userData.lighthouse` tells the scene where the lantern is.

const WHITE: RGB = [0.78, 0.78, 0.75]
const RED: RGB = [0.42, 0.035, 0.03]
const BLACK: RGB = [0.025, 0.025, 0.025]
const IRON: RGB = [0.03, 0.03, 0.032]

export interface LanternInfo {
  /** Centre of the lamp, world. */
  position: Vector3
  /** Azimuth (deg, world) from the lighthouse out to sea on a point (the
   * landward side is screened); null on a rock (lit all round). */
  seawardAzimuthDeg: number | null
}

/** Lantern brightness against the metered sky (setGlowBrightness): a fixed
 * lamp looks brighter the darker the sky. */
const LANTERN_GLOW: Record<TimeOfDay, number> = {
  night: 150,
  'blue-hour': 40,
  'sun-on-horizon': 25,
  'golden-hour': 15,
  daylight: 15,
  midday: 15
}

/** Tower colour at height fraction `t` (0 base … 1 gallery). */
function paintAt(paint: LighthouseParams['paint'], t: number, bands: number, granite: number): RGB {
  switch (paint) {
    case 'white':
      return WHITE
    case 'red':
      return RED
    case 'granite': {
      const c = 0.28 + 0.1 * granite
      return [c, c * 0.95, c * 0.88]
    }
    case 'red-bands':
    case 'black-bands':
      return Math.floor(t * bands) % 2 === 1 ? (paint === 'red-bands' ? RED : BLACK) : WHITE
  }
}

/** A closed box with flat-shaded faces. */
function box(b: MeshBuilder, min: Vector3, max: Vector3, color: RGB): void {
  const corners = (pts: [number, number, number][]): void => {
    const ids = pts.map(([x, y, z]) => b.vertex(new Vector3(x ? max.x : min.x, y ? max.y : min.y, z ? max.z : min.z), color))
    b.quad(ids[0], ids[1], ids[2], ids[3])
  }
  corners([[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]])
  corners([[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]])
  corners([[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]])
  corners([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]])
  corners([[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]])
}

/** The keeper's cottage: whitewashed walls under a red or dark gabled roof. */
function cottage(b: MeshBuilder, at: Vector3, size: number, roof: RGB): void {
  const w = size
  const d = size * 0.7
  const h = size * 0.45
  box(b, new Vector3(at.x - w / 2, at.y - 2, at.z - d / 2), new Vector3(at.x + w / 2, at.y + h, at.z + d / 2), WHITE)
  const eave = (x: number, z: number): Vector3 => new Vector3(at.x + x, at.y + h, at.z + z)
  const ridge = (x: number): Vector3 => new Vector3(at.x + x, at.y + h + d * 0.45, at.z)
  const o = 0.4
  for (const side of [-1, 1]) {
    const a = b.vertex(eave(-w / 2 - o, side * (d / 2 + o)), roof)
    const c = b.vertex(eave(w / 2 + o, side * (d / 2 + o)), roof)
    const e = b.vertex(ridge(w / 2 + o), roof)
    const f = b.vertex(ridge(-w / 2 - o), roof)
    if (side > 0) b.quad(a, c, e, f)
    else b.quad(c, a, f, e)
    // Gable ends.
    const g0 = b.vertex(eave(side * (w / 2), -d / 2), WHITE)
    const g1 = b.vertex(eave(side * (w / 2), d / 2), WHITE)
    const g2 = b.vertex(ridge(side * (w / 2)), WHITE)
    if (side > 0) b.triangle(g0, g2, g1)
    else b.triangle(g0, g1, g2)
  }
}

/** Tower, gallery and dome (vertex coloured), and the lantern glazing as
 * its own mesh so it can glow. Base at the origin. */
function tower(light: LighthouseParams, kind: LighthouseParams['site'], seed: number): { body: MeshBuilder; lantern: MeshBuilder; lampHeight: number } {
  const H = light.height
  const rock = light.paint === 'granite' || kind === 'rock'
  // Wave-swept rock towers are stout with a flared, concave foot (Smeaton's
  // oak-tree profile); towers on land are slimmer.
  const R0 = H * (rock ? 0.15 : 0.11)
  const Rt = R0 * (rock ? 0.55 : 0.65)
  const shaft = H * 0.8
  const lanternH = Math.max(2.4, H * 0.1)
  // Odd band counts: white at the foot and under the gallery.
  const bands = H > 25 ? 7 : 5
  const body = new MeshBuilder()
  const radius = (t: number): number => (rock ? Rt + (R0 - Rt) * (1 - t) ** 2.2 : R0 + (Rt - R0) * t)
  // A plinth below the base hides the gap to an uneven rock.
  const plinth = 6
  const path = Array.from({ length: 121 }, (_, i) => new Vector3(0, -plinth + ((shaft + plinth) * i) / 120, 0))
  body.tube(
    path,
    k => {
      const y = path[Math.round(k * 120)].y
      return y < 0 ? R0 * 1.05 : radius(y / shaft)
    },
    (k, angle) => {
      const y = path[Math.round(k * 120)].y
      const g = fbm3(Math.cos(angle) * 3, y * 0.4, Math.sin(angle) * 3, seed)
      if (y < 0) return [0.3 * (0.8 + 0.4 * g), 0.29 * (0.8 + 0.4 * g), 0.27 * (0.8 + 0.4 * g)]
      // Weathering streaks run down from the gallery.
      const dirt = 0.9 + 0.1 * fbm3(Math.cos(angle) * 8, y * 0.05, Math.sin(angle) * 8, seed + 1)
      return paintAt(light.paint, y / shaft, bands, g).map(v => v * dirt) as RGB
    },
    24
  )
  // Gallery: a projecting balcony with a railing, then the lantern's low
  // solid wall.
  const ring = (y0: number, y1: number, r: number, color: RGB): void => {
    body.tube([new Vector3(0, y0, 0), new Vector3(0, y0 + 0.001, 0), new Vector3(0, y1 - 0.001, 0), new Vector3(0, y1, 0)], k => (k === 0 || k === 1 ? 0.01 : r), () => color, 24)
  }
  const gallery = light.paint === 'white' || light.paint === 'granite' ? IRON : light.paint === 'red' ? WHITE : IRON
  ring(shaft - 0.3, shaft + 0.35, Rt * 1.35, gallery)
  ring(shaft + 1.0, shaft + 1.12, Rt * 1.3, gallery)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    body.tube([new Vector3(Math.cos(a) * Rt * 1.3, shaft + 0.3, Math.sin(a) * Rt * 1.3), new Vector3(Math.cos(a) * Rt * 1.3, shaft + 1.1, Math.sin(a) * Rt * 1.3)], () => 0.04, () => gallery, 4)
  }
  const Rl = Rt * 0.78
  const sill = shaft + 0.35 + lanternH * 0.25
  ring(shaft + 0.3, sill, Rl, light.paint === 'red' ? RED : WHITE)
  // Dome: red, black or weathered copper, with a ventilator ball on top.
  const top = sill + lanternH * 0.75
  const domes: RGB[] = [RED, BLACK, [0.09, 0.2, 0.15]]
  const dome = domes[seed % 3]
  const domePath = Array.from({ length: 9 }, (_, i) => new Vector3(0, top - 0.05 + (Rl * 0.75 * i) / 8, 0))
  body.tube(domePath, k => (k === 0 ? 0.01 : Rl * 1.08 * Math.sqrt(Math.max(0, 1 - k * k)) + 0.02), () => dome, 24)
  body.blob(new Vector3(0, top + Rl * 0.8, 0), new Vector3(0.25, 0.25, 0.25).multiplyScalar(Math.max(1, Rl / 1.5)), () => dome, () => 1, 3)
  // The glazing: astragals are too fine to matter at this distance.
  const lantern = new MeshBuilder()
  const glass: RGB = [1, 1, 1]
  lantern.tube([new Vector3(0, sill, 0), new Vector3(0, sill + 0.001, 0), new Vector3(0, top - 0.001, 0), new Vector3(0, top, 0)], k => (k === 0 || k === 1 ? 0.01 : Rl * 0.97), () => glass, 24)
  return { body, lantern, lampHeight: (sill + top) / 2 }
}

/** Where to stand it: a rocky point jutting from the beach, or a rock at sea. */
function site(ctx: PropContext, light: LighthouseParams, avoid: Object3D | null): { foot: Mesh; at: Vector3; seawardAzimuthDeg: number | null; kind: LighthouseParams['site'] } | null {
  const rng = ctx.rng('lighthouse/site')
  const { coast } = ctx.params
  const H = light.height
  // The tower must stand well inside the frame, not cut by its edges.
  const framed = (p: Vector3): boolean => {
    for (const y of [0, H]) {
      const q = p.clone().setY(p.y + y).project(ctx.camera)
      if (q.z > 1 || Math.abs(q.x) > 0.8 || Math.abs(q.y) > 0.9) return false
    }
    return true
  }
  const clearOf = (p: Vector3, r: number): boolean =>
    avoid == null || p.distanceTo(avoid.position) > Math.max(avoid.scale.x, avoid.scale.z) * 1.4 + r

  // Near first, then further; on a beach, a rock if no point fits the
  // frame and the other way round.
  const kinds: LighthouseParams['site'][] = coast.type !== 'beach' ? ['rock'] : light.site === 'point' ? ['point', 'rock'] : ['rock', 'point']
  for (let i = 0; i < 600; i++) {
    const kind = kinds[Math.floor(i / 300) % kinds.length]
    const reach = 1 + (i % 300) / 100
    let p: Vector3 | null
    let width: number
    let height: number
    if (kind === 'point') {
      const side = rng.chance(0.5) ? 1 : -1
      const [x, z] = shoreToWorld(coast, rng.range(-15, 25), side * rng.range(120, 600 * reach))
      p = new Vector3(x, 0, z)
      width = rng.range(50, 110)
      height = rng.range(10, 26)
    } else {
      p = ctx.seaPoint(rng, [-0.9, 0.05], 250, 700 * reach, 4)
      width = rng.range(22, 45)
      height = rng.range(3, 9)
    }
    if (p == null || ctx.distance(p.x, p.z) < 120 + H) continue
    const base = kind === 'point' ? Math.max(0, ctx.ground(p.x, p.z)) : 0
    if (!framed(p.clone().setY(base + height * 0.6)) || !clearOf(p, width)) continue
    if (kind === 'rock') {
      const clear = [0, 1, 2, 3, 4, 5].every(k => {
        const a = (k / 6) * Math.PI * 2
        return ctx.ground(p!.x + Math.cos(a) * width, p!.z + Math.sin(a) * width) < -3
      })
      if (!clear) continue
    }
    const growth = { moss: 0, mossColor: [0, 0, 0] as RGB, lichen: 0.4, lichenColor: [0.5, 0.48, 0.38] as RGB, algae: 0.8, algaeColor: [0.06, 0.07, 0.025] as RGB }
    const foot = new Mesh(rockGeometry(rng, kind === 'rock'), rockMaterial(rng.pick(ctx.params.biome.rockColors), coast.runup * 2 + 0.6, growth))
    foot.scale.set(width / 2, height, (width / 2) * rng.range(0.6, 0.9))
    foot.position.copy(p).setY(base - height * 0.3)
    foot.rotation.y = rng.range(0, Math.PI * 2)
    foot.castShadow = true
    foot.receiveShadow = true
    foot.updateMatrixWorld()
    const [sx, , sz] = [Math.sin(coast.seawardAzimuthDeg * (Math.PI / 180)), 0, -Math.cos(coast.seawardAzimuthDeg * (Math.PI / 180))]
    const seaward = kind === 'point' ? coast.seawardAzimuthDeg : null
    // Seaward of the point's centre, on its highest ground.
    const centre = kind === 'point' ? p.clone().add(new Vector3(sx, 0, sz).multiplyScalar(width * 0.1)) : p
    return { foot, at: summit(foot, centre, width * 0.25), seawardAzimuthDeg: seaward, kind }
  }
  return null
}

/** The highest point of a rock within `radius` of `centre` (horizontally). */
function summit(rock: Mesh, centre: Vector3, radius: number): Vector3 {
  const position = rock.geometry.attributes.position as BufferAttribute
  const v = new Vector3()
  const best = centre.clone().setY(-Infinity)
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(rock.matrixWorld)
    if (Math.hypot(v.x - centre.x, v.z - centre.z) < radius && v.y > best.y) best.copy(v)
  }
  if (!Number.isFinite(best.y)) best.copy(rock.position)
  // Settle it a little into the rock.
  return best.setY(best.y - 0.5)
}

export function createLighthouse(ctx: PropContext, avoid: Object3D | null): Object3D[] {
  const light = ctx.params.lighthouse
  if (light == null) return []
  const placed = site(ctx, light, avoid)
  if (placed == null) return []
  const { foot, at, seawardAzimuthDeg, kind } = placed
  const { body, lantern, lampHeight } = tower(light, kind, light.seed)
  if (kind === 'point') {
    // The keeper's cottage beside the tower, on the landward side.
    const away = new Vector3(-Math.sin((seawardAzimuthDeg! * Math.PI) / 180), 0, Math.cos((seawardAzimuthDeg! * Math.PI) / 180))
    const offset = away.multiplyScalar(light.height * 0.11 + 7)
    const ground = summit(foot, at.clone().add(offset), 4)
    cottage(body, new Vector3(offset.x, Math.min(0, ground.y - at.y) + 0.3, offset.z), 9, light.seed % 2 === 0 ? RED : [0.06, 0.06, 0.07])
  }
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
  const mesh = new Mesh(body.build(), material)
  mesh.position.copy(at)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const glass = new Mesh(
    lantern.build(),
    light.lit
      ? new MeshBasicMaterial({ vertexColors: true })
      : new MeshStandardMaterial({ color: 0x0d1014, roughness: 0.1, metalness: 0.6 })
  )
  glass.position.copy(at)
  if (light.lit) glass.userData.glow = { color: [1, 0.86, 0.62], scale: LANTERN_GLOW[ctx.params.timeOfDay] }
  const info: LanternInfo = { position: at.clone().setY(at.y + lampHeight), seawardAzimuthDeg }
  mesh.userData.lighthouse = info
  return [foot, mesh, glass]
}
