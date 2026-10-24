import { BufferAttribute, Color, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

import { beachLines, isStony, STONE_DITHER, STONE_LEVELS, stoneAt, stoneCover, stoneGrade, stoneGridCell, stoneLevel, type Stone } from '../beach'
import type { Random } from '../random'
import { hasBeach, shoreToWorld, terrainNormal, worldToShore } from '../terrain'
import type { PropContext } from './context'
import { noise3 } from './noise'
import { rockMaterial } from './rocks'

// Stones near the camera (PLAN_BIOMES 2d): the shader (terrain.ts STONE_GLSL)
// draws every stone of a shingle or cobble beach as a cell; while a stone is
// big on screen (≥ ~10 px), where its silhouette, parallax and shadow show,
// it also gets a mesh, sitting on its own cell with that cell's size and
// colour. Inside the mesh radius the shader drops its dome normal; across
// the radius edge the meshes sink into the ground, so no ring shows.

const VARIANTS = 6
/** A stone gets a mesh while it is at least this many pixels wide. */
export const MESH_PIXELS = 10
/** Furthest mesh stone (m). The plan's 15 m left most days without any:
 * the cameras stand 2–5 m up and see the ground from 10–25 m on, where a
 * 15 cm cobble is still 20–50 px wide at 4K. MAX_STONES bounds the cost. */
export const MAX_RADIUS = 30
/** Smaller stones are shader only (≈ a pixel's worth of silhouette). */
export const MIN_SIZE = 0.02
/** At most this many mesh stones, nearest first. */
export const MAX_STONES = 8000
/** Side (m) of the beach blocks meshStones() scans. */
const BLOCK = 1
/** The meshes sink fully into the ground over the last 20% of the radius. */
const FADE = 0.8
/** A plain vertex-coloured mesh lights brighter than the terrain shader
 * (LESSONS.md, sand overlays). */
const TINT = 0.8

/** How far (m) stones of this size keep a mesh: while ≥ MESH_PIXELS wide,
 * at `pixelAngle` radians per pixel; 0 under MIN_SIZE. */
export function meshRadius(size: number, pixelAngle: number): number {
  if (size < MIN_SIZE) return 0
  return Math.min(MAX_RADIUS, size / (MESH_PIXELS * pixelAngle))
}

/** A stone 1 m wide (scaled per instance), resting on y = 0: a flattened,
 * slightly lumpy ellipsoid, a pebble worn smooth; `faceted` cuts a few
 * flat faces (cobbles, frost-shattered stones). 80 triangles. The base is
 * darker (contact shadow). */
export function stoneGeometry(rng: Random, size = 1, faceted = false): BufferGeometry {
  const ico = new IcosahedronGeometry(0.5, 1)
  ico.deleteAttribute('normal')
  ico.deleteAttribute('uv')
  const geometry = mergeVertices(ico)
  const position = geometry.attributes.position as BufferAttribute
  const seed = rng.int(0, 1_000_000)
  // Height and length over width: pebbles flat, cobbles rounder.
  const flat = faceted ? rng.range(0.45, 0.7) : rng.range(0.3, 0.55)
  const long = rng.range(1, 1.35)
  const lumpy = faceted ? 0.18 : 0.1
  const planes = Array.from({ length: faceted ? rng.int(2, 4) : 0 }, () => ({
    n: new Vector3(rng.normal(), rng.normal() * 0.6, rng.normal()).normalize(),
    d: rng.range(0.3, 0.42)
  }))
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    v.multiplyScalar(1 + lumpy * (noise3(v.x * 2.5 + 7, v.y * 2.5, v.z * 2.5, seed) - 0.5))
    for (const { n, d } of planes) {
      const over = v.dot(n) - d
      if (over > 0) v.addScaledVector(n, -over)
    }
    // Stones come to rest on their flattest side.
    v.y = Math.max(v.y, -0.32)
    position.setXYZ(i, v.x * long, v.y * flat, v.z)
  }
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox!
  const height = max.y - min.y
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const y = v.y - min.y
    // Contact shadow at the base, a little speckle and banding.
    const contact = 0.55 + 0.45 * smoothstep(0, 0.45 * height, y)
    const c = contact * (0.88 + 0.24 * noise3(v.x * 6, v.y * 6, v.z * 6, seed + 3))
    colors.set([c, c, c], i * 3)
    position.setXYZ(i, v.x * size, y * size, v.z * size)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

export interface MeshStone {
  stone: Stone
  x: number
  /** Ground height at the centre. */
  y: number
  z: number
  distance: number
}

/** The shader's stones that get a mesh: within each size class's radius,
 * in view, present (mixed beaches) and of the size class drawn there;
 * nearest first, at most MAX_STONES. `radius` is per size class
 * (STONE_LEVELS), shrunk to the furthest kept stone when capped. */
export function meshStones(ctx: PropContext): { stones: MeshStone[]; radius: [number, number, number] } {
  const { coast } = ctx.params
  const radius: [number, number, number] = [0, 0, 0]
  if (!hasBeach(coast) || !isStony(coast.material)) return { stones: [], radius }
  const cam = ctx.camera.position
  const [camS, camA] = worldToShore(coast, cam.x, cam.z)
  const camU = -camS
  const { highTide } = beachLines(coast)
  const [ox, oz] = coast.noiseOffset
  // Blocks of the beach (BLOCK m square in shore coords) in view and in
  // reach, per size class, nearest first: most of the circle is out of
  // frame, and once MAX_STONES are found further blocks can't add any.
  const blocks: { level: number; u: number; a: number; near: number; far: number }[] = []
  const half = BLOCK * Math.SQRT1_2
  for (let level = 0; level < STONE_LEVELS.length; level++) {
    const r = meshRadius(coast.stoneSize * STONE_LEVELS[level], ctx.pixelAngle)
    radius[level] = r
    if (r === 0) continue
    for (let a = Math.floor((camA - r) / BLOCK) * BLOCK; a < camA + r; a += BLOCK) {
      for (let u = Math.max(Math.floor((camU - r) / BLOCK) * BLOCK, -BLOCK); u < camU + r; u += BLOCK) {
        // Skip blocks where the grading never picks this size class.
        const grades = [u, u + BLOCK / 2, u + BLOCK].map(v => stoneGrade(coast, v, highTide))
        if (Math.max(...grades) + STONE_DITHER / 2 + 0.05 < level - 0.5 || Math.min(...grades) - STONE_DITHER / 2 - 0.05 >= level + 0.5) continue
        const [x, z] = shoreToWorld(coast, -(u + BLOCK / 2), a + BLOCK / 2)
        const d = Math.hypot(x - cam.x, z - cam.z)
        if (d - half > r || !ctx.visible(x, ctx.ground(x, z), z, half + 0.15)) continue
        blocks.push({ level, u, a, near: Math.max(0, d - half), far: d + half })
      }
    }
  }
  blocks.sort((p, q) => p.near - q.near)
  const stones: MeshStone[] = []
  let reach = Infinity
  for (const block of blocks) {
    if (block.near > reach) break
    const { level } = block
    const size = coast.stoneSize * STONE_LEVELS[level]
    const r = radius[level]
    const [i0, j0] = stoneGridCell(coast, level, Math.max(block.u, -0.5), block.a)
    const [i1, j1] = stoneGridCell(coast, level, block.u + BLOCK, block.a + BLOCK)
    // Blocks straddling the radius: drop cells beyond it first, on a
    // linear map of the block (the shore bends little over a metre).
    const edge = block.far > r
    const [bx, bz] = shoreToWorld(coast, -block.u, block.a)
    const [ux, uz] = shoreToWorld(coast, -block.u - BLOCK, block.a)
    const [ax, az] = shoreToWorld(coast, -block.u, block.a + BLOCK)
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (edge) {
          const fu = ((i + 0.5 - ox) * size - block.u) / BLOCK
          const fa = ((j + 0.5 - oz) * size - block.a) / BLOCK
          const x = bx + (ux - bx) * fu + (ax - bx) * fa
          const z = bz + (uz - bz) * fu + (az - bz) * fa
          if (Math.hypot(x - cam.x, z - cam.z) > r + size) continue
        }
        const stone = stoneAt(coast, level, i, j)
        const u = -stone.s
        // Each stone belongs to the block holding its centre.
        if (u < Math.max(block.u, -0.5) || u >= block.u + BLOCK || stone.a < block.a || stone.a >= block.a + BLOCK) continue
        if (stoneLevel(coast, u, stone.a, highTide) !== level) continue
        if (stone.presence >= stoneCover(coast, u, stone.a, highTide)) continue
        const [x, z] = shoreToWorld(coast, stone.s, stone.a)
        const distance = Math.hypot(x - cam.x, z - cam.z)
        if (distance > r || distance < 0.5) continue
        const y = ctx.ground(x, z)
        if (!ctx.visible(x, y, z, size)) continue
        stones.push({ stone, x, y, z, distance })
      }
    }
    // Every stone found so far is within this block's far edge.
    if (stones.length >= MAX_STONES && reach === Infinity) reach = block.far
  }
  stones.sort((p, q) => p.distance - q.distance)
  if (stones.length > MAX_STONES) {
    const cut = stones[MAX_STONES - 1].distance
    stones.length = MAX_STONES
    for (let level = 0; level < 3; level++) radius[level] = Math.min(radius[level], cut)
  }
  return { stones, radius }
}

/** Mesh stones on a stony beach; `userData.stoneRadius` tells the terrain
 * shader where they are (per size class). */
export function createStones(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast } = params
  if (params.overrides?.stones === false) return []
  const { stones, radius } = meshStones(ctx)
  if (stones.length === 0) return []
  const rng = ctx.rng('stones')
  // Shingle is worn smooth; cobbles are rounded or a little angular; polar
  // stones are frost-shattered.
  const polar = params.place.climate === 'polar'
  const faceted = (v: number): boolean => polar || (coast.material === 'cobble' ? v % 2 === 1 : coast.material === 'mixed' && v >= 4)
  const geometries = Array.from({ length: VARIANTS }, (_, v) => stoneGeometry(rng, 1, faceted(v)))
  const heights = geometries.map(g => g.boundingBox!.max.y)
  const material = rockMaterial([1, 1, 1], coast.runup, null)
  material.roughness = 0.8

  const byVariant: { stone: MeshStone; scale: number; sink: number; yaw: number }[][] = geometries.map(() => [])
  for (const m of stones) {
    const variant = rng.int(0, VARIANTS - 1)
    // As wide as the shader's oval in that cell (fill), a little narrower so
    // neighbours don't overlap.
    const scale = m.stone.size * Math.min(1.04 * (0.85 + 0.35 * m.stone.shape), 1.12)
    const r = radius[m.stone.level]
    const fade = smoothstep(FADE * r, r, m.distance)
    const buried = rng.range(0.15, 0.4)
    byVariant[variant].push({ stone: m, scale, sink: buried + (1.05 - buried) * fade, yaw: rng.range(0, Math.PI * 2) })
  }

  const up = new Vector3(0, 1, 0)
  const normal = new Vector3()
  const tilt = new Quaternion()
  const yaw = new Quaternion()
  const matrix = new Matrix4()
  const color = new Color()
  const meshes: InstancedMesh[] = []
  byVariant.forEach((list, v) => {
    if (list.length === 0) return
    const mesh = new InstancedMesh(geometries[v], material, list.length)
    list.forEach(({ stone: m, scale, sink, yaw: angle }, k) => {
      // Lying on the beach face, turned at random.
      normal.set(...terrainNormal(coast, m.x, m.z, Math.max(0.1, m.stone.size)))
      tilt.setFromUnitVectors(up, normal)
      yaw.setFromAxisAngle(up, angle)
      const y = m.y - sink * heights[v] * scale
      matrix.compose(new Vector3(m.x, y, m.z), tilt.multiply(yaw), new Vector3(scale, scale, scale))
      mesh.setMatrixAt(k, matrix)
      const [r, g, b] = m.stone.color
      mesh.setColorAt(k, color.setRGB(r * TINT, g * TINT, b * TINT))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.userData.stoneRadius = radius
    meshes.push(mesh)
  })
  return meshes
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
