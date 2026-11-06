import { BufferAttribute, Color, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three'

import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

import type { RGB } from '../biome'
import { hashCell } from '../cellNoise'
import type { CoastParams, SceneParams } from '../params'
import { hasLand, shoreToWorld, terrainHeight } from '../terrain'
import { tideMarks } from '../tides'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { noise3 } from './noise'

// The ice foot (plans/SNOW.md, SEASONS.md §4.1): a low bench of frozen spray,
// slush and stranded cakes at the spring high water, fixed on the land through
// the tide. What it is at a place along the shore comes from that place's `a`
// (noise and hashes) and the terrain: only how finely it's cut and which
// stretches are drawn read the camera.

/** Past this it's under a pixel tall, and part of the white shore. */
const MAX_DISTANCE = 6000
/** A section every this many pixels along the shore, and no closer than this (m). */
const SECTION_PIXELS = 12
const MIN_STEP = 0.4
/** The strip's gap round the camera (m), so it never stands in it. */
export const CAMERA_GAP = 4
/** Stranded cakes are seen this near. */
const CAKE_DISTANCE = 300
/** The cakes' cells along the shore (m). */
const CAKE_CELL = 5
const CAKE_VARIANTS = 3
/** Lower than this (m), there's no foot here. */
const MIN_HEIGHT = 0.04
/** A run tapers to nothing over this much shore at each end (m). */
const END_TAPER = 6
/** It comes down to nothing over this much shore beside the camera's gap (m):
 * a long tongue, which from close by doesn't read as a cut. */
const GAP_TAPER = 18
/** Sections are built this far outside the view (m). */
const VIEW_MARGIN = 30
/** The tallest its seaward face may stand above the beach (m). */
const MAX_FACE = 2.2

const SNOW: RGB = [0.82, 0.84, 0.87]
const LIP: RGB = [0.66, 0.71, 0.75]
const ICE: RGB = [0.42, 0.56, 0.63]
const DIRTY: RGB = [0.2, 0.21, 0.21]

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** An ice foot today? It needs snow on the shore and a shore to stand on. */
export function iceFootFor(params: SceneParams): boolean {
  return params.snow?.iceFoot === true && hasLand(params.coast) && params.overrides?.iceFoot !== false
}

const groundAt = (coast: CoastParams, s: number, a: number): number => {
  const [x, z] = shoreToWorld(coast, s, a)
  return terrainHeight(coast, x, z)
}

/**
 * The shore's spring-high-water contour at `a` (s), walking inland from the sea,
 * so a hollow behind the dunes isn't mistaken for it. `from`: where the last
 * section found it, which saves most of the walk. Null if land never reaches it.
 */
export function footLine(coast: CoastParams, a: number, from?: number): number | null {
  const target = tideMarks(coast).spring
  let s = from != null ? from + 6 : 30
  // Start in the water, or at least below the line.
  for (let i = 0; i < 12 && groundAt(coast, s, a) >= target; i++) s += 10
  if (groundAt(coast, s, a) >= target) return null
  for (let i = 0; i < 240; i++) {
    const next = s - 1.5
    if (groundAt(coast, next, a) >= target) {
      let [sea, land] = [s, next]
      for (let k = 0; k < 5; k++) {
        const mid = (sea + land) / 2
        if (groundAt(coast, mid, a) >= target) land = mid
        else sea = mid
      }
      return (sea + land) / 2
    }
    s = next
  }
  return null
}

interface FootShape {
  /** How tall the top stands above the contour (m); 0 where there's none. */
  height: number
  /** Width of the top seaward of the contour (m). */
  width: number
  /** Feather into the land's snow (m). */
  back: number
  /** 0–1: rough lumps and dirt, by place. */
  rough: number
}

/** The foot at `a`: tall in stretches, absent in others (ice-foot forms change
 * over short distances; Point Lay and Svalbard), its lip bitten and lumpy where
 * cakes froze in. It narrows with its height, so a stretch ends round, not cut. */
export function footShape(seed: number, a: number): FootShape {
  const n = (scale: number, salt: number): number => noise3(a / scale, salt, 0.5, seed)
  const stretch = Math.max(0, Math.min(1, (n(70, 1) - 0.25) / 0.2))
  const lumps = n(2.5, 2) - 0.5
  return {
    height: (0.3 + 0.9 * n(18, 3) + 0.35 * lumps) * stretch,
    width: (1.5 + 2.5 * n(40, 4) + 1.6 * (n(7, 7) - 0.5) + 1.4 * lumps + 0.7 * (n(1.1, 8) - 0.5)) * Math.sqrt(stretch),
    back: 2 + 3 * n(30, 5),
    rough: n(3.5, 6)
  }
}

/** A place along the shore where the foot could stand; `s0` null where it
 * can't, or out of view. */
interface Station {
  a: number
  s0: number | null
  shape: FootShape
  /** 0 at the camera's gap, 1 clear of it. */
  gap: number
}

type SectionPoint = { x: number; y: number; z: number; color: RGB }

/** One cross-section, land to sea, from the contour at `s0`. `gap`: 0 at the
 * camera's gap, rounding the strip's end there. */
function section(coast: CoastParams, s0: number, a: number, shape: FootShape, gap: number, seed: number): SectionPoint[] {
  const g0 = groundAt(coast, s0, a)
  const height = shape.height * gap
  const top = g0 + height
  // A steep beach falls away under the top: keep its face a bench, not a cliff.
  let width = Math.max(0.1, shape.width * gap)
  if (top - groundAt(coast, s0 + width, a) > MAX_FACE) width = Math.max(0.1, width * 0.4)
  const point = (s: number, y: number, color: RGB): SectionPoint => {
    const [x, z] = shoreToWorld(coast, s, a)
    return { x, y, z, color }
  }
  const over = (s: number, y: number): number => Math.max(groundAt(coast, s, a) + 0.03, y)
  /** Frozen slush and cakes under the snow: the top's relief at (s, a). */
  const relief = (s: number): number => height * (0.5 * (noise3(s / 1.6, a / 1.6, 3.5, seed) - 0.5) + 0.22 * (noise3(s / 0.55, a / 0.55, 9.5, seed) - 0.5))
  const faceAt = s0 + width + 0.15 * height
  const baseAt = faceAt + 0.2 + 0.25 * height
  const stained = mix(ICE, DIRTY, shape.rough)
  const across = [0, 0.3, 0.55, 0.8].map(t => point(s0 + width * t, Math.max(over(s0 + width * t, top), top + relief(s0 + width * t)), t === 0.8 ? mix(SNOW, LIP, 0.5) : SNOW))
  return [
    point(s0 - shape.back, groundAt(coast, s0 - shape.back, a) - 0.02, SNOW),
    point(s0 - shape.back * 0.35, over(s0 - shape.back * 0.35, top - 0.3 * height + relief(s0 - shape.back * 0.35)), SNOW),
    ...across,
    point(s0 + width, top - 0.08 * height + relief(s0 + width), LIP),
    point(faceAt, top - 0.5 * height - 0.1, stained),
    point(baseAt, groundAt(coast, baseAt, a) - 0.25, mix(stained, DIRTY, 0.5))
  ]
}

/** A stranded ice cake: a blunt, flat-faced lump, about 1 across, base near y = 0. */
export function cakeGeometry(variant: number): BufferGeometry {
  const geometry = mergeVertices(new IcosahedronGeometry(1, 4))
  const position = geometry.attributes.position as BufferAttribute
  const v = new Vector3()
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const r = 0.7 + 0.45 * noise3(v.x * 1.7, v.y * 1.7, v.z * 1.7, variant + 40) + 0.2 * noise3(v.x * 5, v.y * 5, v.z * 5, variant + 50)
    // Flattened top and base: slabs of shore ice, not boulders.
    const y = Math.max(-0.1, Math.min(0.42, v.y * r * 0.5 + 0.12))
    position.setXYZ(i, v.x * r * 0.5, y, v.z * r * 0.5)
    const c = mix(mix(ICE, DIRTY, 0.35 * noise3(v.x * 3, v.y * 3, v.z * 3, variant + 60)), SNOW, Math.max(0, Math.min(1, (y - 0.22) / 0.14)))
    colors.set(c, i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** The stations on one side of the camera, walking out along the shore. */
function walk(ctx: PropContext, seed: number, direction: 1 | -1): Station[] {
  const { coast } = ctx.params
  const out: Station[] = []
  let a = direction > 0 ? 0 : -MIN_STEP
  let last: number | undefined
  let smoothed: number | undefined
  while (Math.abs(a) < MAX_DISTANCE * 1.5) {
    const [gx, gz] = shoreToWorld(coast, last ?? 0, a)
    const distance = ctx.distance(gx, gz)
    if (distance > MAX_DISTANCE) break
    const step = Math.max(MIN_STEP, distance * ctx.pixelAngle * SECTION_PIXELS)
    const shape = footShape(seed, a)
    let s0: number | null = null
    let gap = 1
    // Past the frame by more than the end taper, so culling never shows as an end.
    if (ctx.visible(gx, 1, gz, VIEW_MARGIN + step)) {
      const found = footLine(coast, a, last)
      if (found != null) {
        last = found
        // Smoothed along the shore: a gully or a boulder doesn't bite the strip.
        smoothed = smoothed == null ? found : smoothed + (found - smoothed) * Math.min(1, step / 4)
        s0 = smoothed
        const [cx, cz] = shoreToWorld(coast, smoothed, a)
        const clear = Math.max(0, Math.min(1, (ctx.distance(cx, cz) - CAMERA_GAP) / GAP_TAPER))
        gap = clear * clear * (3 - 2 * clear)
      }
    }
    out.push({ a, s0, shape, gap })
    a += direction * step
  }
  return out
}

/** How far each station is along the shore from the end of its run (m). */
export function runEnds(stations: readonly { a: number; standing: boolean }[]): number[] {
  const out = stations.map(() => Infinity)
  for (const order of [stations.map((_, i) => i), stations.map((_, i) => stations.length - 1 - i)]) {
    let end: number | null = null
    for (const i of order) {
      if (!stations[i].standing) end = stations[i].a
      else if (end != null) out[i] = Math.min(out[i], Math.abs(stations[i].a - end))
      else end = null
    }
  }
  return out
}

export function createIceFoot(ctx: PropContext): Object3D[] {
  const { params } = ctx
  if (!iceFootFor(params)) return []
  const { coast } = params
  const seed = ctx.rng('ice-foot').int(0, 1_000_000)
  const stations = [...walk(ctx, seed, -1).reverse(), ...walk(ctx, seed, 1)]
  const standing = (t: Station): boolean => t.s0 != null && t.shape.height * t.gap > MIN_HEIGHT
  const ends = runEnds(stations.map(t => ({ a: t.a, standing: standing(t) })))
  const b = new MeshBuilder()
  let previous: number[] | null = null
  stations.forEach((t, i) => {
    if (!standing(t)) {
      previous = null
      return
    }
    // A run of it comes to nothing at its ends, whatever ended it.
    const taper = Math.min(1, ends[i] / END_TAPER)
    const ring = section(coast, t.s0!, t.a, t.shape, t.gap * taper, seed).map(p => b.vertex(new Vector3(p.x, p.y, p.z), p.color))
    if (previous != null) {
      for (let k = 0; k + 1 < ring.length; k++) b.quad(previous[k], ring[k], ring[k + 1], previous[k + 1])
    }
    previous = ring
  })
  const objects: Object3D[] = []
  const geometry = b.build()
  if ((geometry.index?.count ?? 0) === 0) {
    geometry.dispose()
    return []
  }
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 })
  const strip = new Mesh(geometry, material)
  strip.castShadow = true
  strip.receiveShadow = true
  strip.frustumCulled = false
  objects.push(strip)

  // Cakes the ice left on the beach below it, by a hash of their cell.
  const placed: Matrix4[][] = Array.from({ length: CAKE_VARIANTS }, () => [])
  const up = new Vector3(0, 1, 0)
  const cam = ctx.camera.position
  for (let cell = -Math.ceil(CAKE_DISTANCE / CAKE_CELL); cell <= CAKE_DISTANCE / CAKE_CELL; cell++) {
    const h = (salt: number): number => hashCell(cell + seed % 4096, salt) / 4294967296
    if (h(1) > 0.4) continue
    const a = (cell + h(2)) * CAKE_CELL
    const shape = footShape(seed, a)
    if (shape.height < 0.1) continue
    const line = footLine(coast, a)
    if (line == null) continue
    const s = line + shape.width + 0.6 + 7 * h(3) ** 2
    const [x, z] = shoreToWorld(coast, s, a)
    const y = groundAt(coast, s, a)
    // Stranded on the beach; afloat they're pack ice's business.
    if (y < 0) continue
    const size = 0.5 + 1.6 * h(4) ** 2
    if (Math.hypot(x - cam.x, z - cam.z) < CAMERA_GAP + size || !ctx.visible(x, y, z, size + 1)) continue
    const q = new Quaternion().setFromAxisAngle(up, h(5) * Math.PI * 2)
    placed[Math.floor(h(6) * CAKE_VARIANTS)].push(new Matrix4().compose(new Vector3(x, y - 0.05, z), q, new Vector3(size, size * (0.7 + 0.5 * h(7)), size * (0.7 + 0.6 * h(8)))))
  }
  placed.forEach((matrices, variant) => {
    if (matrices.length === 0) return
    const mesh = new InstancedMesh(cakeGeometry(variant), material, matrices.length)
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, new Color(1, 1, 1))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    objects.push(mesh)
  })
  return objects
}
