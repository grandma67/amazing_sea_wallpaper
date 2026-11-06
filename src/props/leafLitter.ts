import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Quaternion,
  RedFormat,
  UnsignedByteType,
  Vector3
} from 'three'

import type { RGB, VegetationKind } from '../biome'
import type { SceneParams } from '../params'
import { autumnColors, fallenLeafSize, LITTER_BROWN, litterTint, phenologyFor, type Phenology } from '../phenology'
import { terrainNormal } from '../terrain'
import { tideMarks } from '../tides'
import type { PropContext } from './context'
import { noise3 } from './noise'
import { plantMaterial } from './vegetation'

// Fallen leaves under deciduous trees (SEASONS.md §2.5, plans/SEASONS_PLAN.md
// phase 8). Near the camera, real leaves lying on the ground; further off,
// where a leaf is under a few pixels, the colour they give the ground (a world
// map the terrain shader reads, litterField), which also lies under the leaves
// so the two have no seam.
//
// Everything about a leaf comes from hashes of its tree's position, not from a
// stream or the view: a leaf is the same leaf from anywhere, and coming closer
// only adds more of the same (`keep` is a threshold on each leaf's own hash).
// Only `createLeafLitter`'s range and frustum tests read the camera, so a
// moving camera can re-run them per tree without anything changing underfoot.

/** Leaves per m² near the camera at full litter, before the frame's budget.
 * A real oak floor has hundreds (est. from ~300 g/m² a year); these sit on the
 * ground colour, which stands in for the rest. */
const DENSITY = 60
/** A leaf is drawn at full density while at least this many pixels long… */
const FULL_PIXELS = 15
/** …thins with distance after that, and is left to the ground colour under this. */
const MIN_PIXELS = 3
/** Instances in the frame, over all the variants (8 triangles each). */
export const MAX_LEAVES = 16000
const VARIANTS = 4
/** Leaves fall this far out, in crown radii. */
const SPREAD = 1.3
/** Below this much litter there is nothing to see. */
const MIN_LITTER = 0.02
/** The map: at most this many texels a side, and no finer than this (m): the
 * discs are soft, and a close group of trees needn't fill the whole map. */
const MAP_SIZE = 1024
const MAP_TEXEL = 0.5

export interface LitterDay {
  /** How much lies on the ground (0–1). */
  amount: number
  /** 1 still coloured … 0 weathered brown. */
  fresh: number
}

/** The day's fallen leaves; null out of season or with `props.leafLitter: false`.
 * Not random: it follows the date and climate like the leaves on the trees. */
export function litterFor(params: SceneParams, phen: Phenology = phenologyFor(params)): LitterDay | null {
  if (params.overrides?.leafLitter === false || phen.litter < MIN_LITTER) return null
  // Under a closed snow cover; patchy snow leaves them showing between.
  if (params.snow != null && params.snow.cover > 0.6) return null
  return { amount: phen.litter, fresh: phen.litterFresh }
}

export interface LitterTree {
  x: number
  y: number
  z: number
  /** Crown radius (m). */
  radius: number
  kind: VegetationKind
}

/** The deciduous trees among the plants: their builders say which shapes are
 * (`geometry.userData.deciduous`, trees.ts `leaves`). */
export function deciduousTrees(plants: readonly InstancedMesh[]): LitterTree[] {
  const trees: LitterTree[] = []
  const s = new Vector3()
  const m = new Matrix4()
  for (const mesh of plants) {
    const kind = mesh.userData.plantKind as VegetationKind | undefined
    if (kind == null || mesh.geometry.userData.deciduous !== true) continue
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const crown = (box.max.x - box.min.x + box.max.z - box.min.z) / 4
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      s.setFromMatrixColumn(m, 0)
      const e = m.elements
      trees.push({ x: e[12], y: e[13], z: e[14], radius: crown * s.length(), kind })
    }
  }
  return trees
}

/** A repeatable number in [0, 1) from three integers. */
function hashInts(a: number, b: number, c: number): number {
  let h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(c, 0xc2b2ae3d)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** Leaves under a tree: positions and each leaf's own numbers, by hash of the
 * tree's position. A leaf's index never changes what it is, so more leaves
 * just extend the list. */
export function treeLeaf(tree: LitterTree, i: number): { x: number; z: number; keep: number; yaw: number; tilt: number; variant: number; hue: number; age: number } {
  const key = Math.round(tree.x * 64) ^ Math.imul(Math.round(tree.z * 64), 31)
  const h = (salt: number): number => hashInts(key, i, salt)
  // Thickest under the crown, thinning past it.
  const r = tree.radius * SPREAD * h(1) ** 0.65
  const a = h(2) * Math.PI * 2
  return {
    x: tree.x + Math.cos(a) * r,
    z: tree.z + Math.sin(a) * r,
    keep: h(3),
    yaw: h(4) * Math.PI * 2,
    tilt: h(5),
    variant: Math.floor(h(6) * VARIANTS),
    hue: h(7),
    age: h(8)
  }
}

/**
 * One fallen leaf, 1 long along +X, in eight vertices (midrib, two curled
 * sides): folded along the midrib and curled at the ends as dry leaves are, so
 * it catches the light unevenly. Base on y ≈ 0. White, a darker midrib: the
 * instance colour is the leaf's.
 */
export function fallenLeafGeometry(variant: number): BufferGeometry {
  const curl = 0.05 + 0.05 * variant
  const fold = 0.06 + 0.035 * ((variant * 5) % 4)
  const y = (t: number, side: number): number => curl * (2 * t - 1) ** 2 + fold * Math.abs(side)
  const v: [number, number, number][] = []
  const colors: number[] = []
  const add = (t: number, side: number): void => {
    v.push([t - 0.5, y(t, side), side * 0.5])
    const shade = side === 0 ? 0.8 : 1
    colors.push(shade, shade, shade)
  }
  // Base, midrib points and tip; each side at two stations of an oval outline.
  add(0, 0)
  add(0.35, 0)
  add(0.7, 0)
  add(1, 0)
  for (const side of [1, -1]) {
    add(0.28, side * 0.82)
    add(0.66, side * 0.72)
  }
  const index = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 0, 1, 6, 1, 7, 6, 1, 2, 7, 2, 3, 7]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(v.flat()), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

const leafColor = (kind: VegetationKind, phen: Phenology, hue: number, age: number): RGB => {
  const colors = autumnColors(kind, phen)
  const c = colors[Math.floor(hue * colors.length)]
  // Each leaf weathers at its own pace, the first browning soon after it
  // falls; by the end of LITTER_WEATHERS all are brown.
  const brown = 1 - phen.litterFresh * (1 - 0.6 * age)
  const dim = 0.7 + 0.35 * hue
  return [0, 1, 2].map(i => (c[i] + (LITTER_BROWN[i] - c[i]) * brown) * dim) as RGB
}

/** How many of a leaf's `keep` values stay at this distance: all while it is
 * big on screen, then fewer with its shrinking area; 0 under MIN_PIXELS. */
export function leafShare(size: number, distance: number, pixelAngle: number): number {
  const pixels = size / (Math.max(distance, 0.1) * pixelAngle)
  if (pixels < MIN_PIXELS) return 0
  return Math.min(1, (pixels / FULL_PIXELS) ** 2)
}

/** The leaves in view. */
export function createLeafLitter(ctx: PropContext, plants: readonly InstancedMesh[]): InstancedMesh[] {
  const { params } = ctx
  const phen = phenologyFor(params)
  const day = litterFor(params, phen)
  if (day == null) return []
  const { coast } = params

  // First only where each leaf would be, against the camera; then, if that's
  // over the budget, an even thinning (the leaf's own hash again), so a far
  // tree isn't left bare to pay for a near one.
  const wanted: { tree: LitterTree; size: number; leaf: ReturnType<typeof treeLeaf>; share: number }[] = []
  for (const tree of deciduousTrees(plants)) {
    const size = fallenLeafSize(tree.kind, phen)
    const reach = tree.radius * SPREAD
    if (leafShare(size, ctx.distance(tree.x, tree.z) - reach, ctx.pixelAngle) === 0) continue
    if (!ctx.visible(tree.x, tree.y, tree.z, reach + 1)) continue
    const count = Math.ceil(Math.PI * reach * reach * DENSITY * day.amount)
    for (let i = 0; i < count; i++) {
      const leaf = treeLeaf(tree, i)
      const share = leafShare(size, ctx.distance(leaf.x, leaf.z), ctx.pixelAngle)
      if (leaf.keep >= share || !ctx.visible(leaf.x, tree.y, leaf.z, 2)) continue
      wanted.push({ tree, size, leaf, share })
    }
  }
  const thin = Math.min(1, MAX_LEAVES / Math.max(wanted.length, 1))

  // Above where today's spring tides and swash reach, as the plants are.
  const dry = tideMarks(coast).spring + coast.runup + 0.2
  const up = new Vector3(0, 1, 0)
  const q = new Quaternion()
  const yawQ = new Quaternion()
  const tiltQ = new Quaternion()
  const axis = new Vector3()
  const pieces: { matrix: Matrix4; color: Color }[][] = Array.from({ length: VARIANTS }, () => [])
  for (const { tree, size, leaf, share } of wanted) {
    // Nested with the distance test: the same leaves, just fewer of them.
    if (leaf.keep >= share * thin) continue
    const y = ctx.ground(leaf.x, leaf.z)
    if (y < dry) continue
    const n = terrainNormal(coast, leaf.x, leaf.z, 0.5)
    if (n[1] < 0.6) continue
    // Flat on the ground, some propped on others.
    q.setFromUnitVectors(up, new Vector3(n[0], n[1], n[2]))
    yawQ.setFromAxisAngle(up, leaf.yaw)
    axis.set(Math.cos(leaf.yaw * 3), 0, Math.sin(leaf.yaw * 3))
    tiltQ.setFromAxisAngle(axis, (leaf.tilt - 0.5) * 0.5)
    q.multiply(yawQ).multiply(tiltQ)
    const length = size * (0.7 + 0.6 * leaf.hue)
    const width = length * (tree.kind === 'birch' ? 0.75 : 0.6)
    const matrix = new Matrix4().compose(new Vector3(leaf.x, y + 0.004 + 0.015 * leaf.age, leaf.z), q, new Vector3(length, length, width))
    pieces[leaf.variant].push({ matrix, color: new Color(...leafColor(tree.kind, phen, leaf.hue, leaf.age)) })
  }

  const material = plantMaterial()
  const meshes: InstancedMesh[] = []
  pieces.forEach((mine, variant) => {
    if (mine.length === 0) return
    const mesh = new InstancedMesh(fallenLeafGeometry(variant), material, mine.length)
    mine.forEach((p, i) => {
      mesh.setMatrixAt(i, p.matrix)
      mesh.setColorAt(i, p.color)
    })
    // Smaller than a shadow-map texel; they only receive.
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    meshes.push(mesh)
  })
  return meshes
}

export interface LitterField {
  texture: DataTexture
  /** x0, z0, 1/width, 1/depth of the map (world m). */
  rect: [number, number, number, number]
  color: RGB
  amount: number
}

/** The map of where litter lies, in world space: a soft disc under each
 * deciduous tree in view, for the terrain shader. Null with no such tree. */
export function litterField(ctx: PropContext, plants: readonly InstancedMesh[]): LitterField | null {
  const phen = phenologyFor(ctx.params)
  const day = litterFor(ctx.params, phen)
  if (day == null) return null
  const trees = deciduousTrees(plants).filter(t => ctx.visible(t.x, t.y, t.z, t.radius * SPREAD + 1))
  if (trees.length === 0) return null
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const t of trees) {
    const r = t.radius * SPREAD
    x0 = Math.min(x0, t.x - r)
    x1 = Math.max(x1, t.x + r)
    z0 = Math.min(z0, t.z - r)
    z1 = Math.max(z1, t.z + r)
  }
  // An empty rim, so past the map (clamped) there is no litter.
  const extent = Math.max(x1 - x0, z1 - z0, 1)
  const size = Math.min(MAP_SIZE, Math.ceil(extent / MAP_TEXEL) + 4)
  const texel = extent / (size - 4)
  x0 -= 2 * texel
  z0 -= 2 * texel
  const width = size * texel
  const data = new Uint8Array(size * size)
  for (const t of trees) {
    const r = t.radius * SPREAD
    const [i0, i1] = [Math.floor((t.x - r - x0) / texel), Math.ceil((t.x + r - x0) / texel)]
    const [j0, j1] = [Math.floor((t.z - r - z0) / texel), Math.ceil((t.z + r - z0) / texel)]
    for (let j = Math.max(1, j0); j <= Math.min(size - 2, j1); j++) {
      for (let i = Math.max(1, i0); i <= Math.min(size - 2, i1); i++) {
        const dx = (i + 0.5) * texel + x0 - t.x
        const dz = (j + 0.5) * texel + z0 - t.z
        const f = (1 - (dx * dx + dz * dz) / (r * r)) ** 1.5
        if (!(f > 0)) continue
        // A little lumpy, so a disc doesn't read as one.
        const lump = 0.75 + 0.5 * noise3(((i + 0.5) * texel + x0) / 6, 2, ((j + 0.5) * texel + z0) / 6, 7)
        const v = Math.min(255, Math.round(255 * f * lump))
        const at = j * size + i
        if (v > data[at]) data[at] = v
      }
    }
  }
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  const kinds = [...new Set(trees.map(t => t.kind))]
  return { texture, rect: [x0, z0, 1 / width, 1 / width], color: litterTint(kinds, phen), amount: day.amount }
}
