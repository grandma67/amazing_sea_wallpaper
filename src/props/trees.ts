import { Vector3, type BufferGeometry } from 'three'

import type { RGB } from '../biome'
import type { PlantSeason } from '../phenology'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import { fbm3 } from './noise'

// Branching trees: a recursive skeleton of tapered, gnarled limbs with bark
// colouring, and clusters of individual leaf meshes at the twig tips. Each
// species is a set of growth parameters plus its own bark and leaf styles.
// Geometry is built at a nominal size with its base at the origin.

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]
const UP = new Vector3(0, 1, 0)
/** Bare winter twigs: grey-brown. */
const TWIG: RGB = [0.085, 0.07, 0.06]

/** A repeatable pseudo-random number in [0, 1) from two values. */
function hash(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return v - Math.floor(v)
}

/** Ridged noise in [0, 1]: thin dark lines where fbm crosses its midpoint. */
function ridged(x: number, y: number, z: number, seed: number): number {
  return 1 - Math.abs(fbm3(x, y, z, seed) * 2 - 1)
}

/**
 * Bark at a point on a limb (`around` is the angle around the limb): its
 * colour, and its relief, 0 on the outer surface down to −1 at the bottom of
 * a fissure or crack. The relief is real geometry on trunks and big limbs.
 */
interface Bark {
  color: (height: number, around: number, radius: number) => RGB
  relief: (height: number, around: number) => number
  /** How much moss and lichen it carries (default 1): smooth shedding
   * bark little (NATURE_PLAN phase 9). */
  moss?: number
}

/** Furrowed bark: dark vertical fissures between lighter ridges. */
export function furrowed(base: RGB, seed: number, depth = 0.6): Bark {
  // About a dozen fissures round a trunk, long and vertical.
  const fissure = (h: number, a: number): number => ridged(Math.cos(a) * 3.5, h * 0.45, Math.sin(a) * 3.5, seed) ** 3
  return {
    color: (h, a) => {
      const patch = fbm3(Math.cos(a), h * 0.8, Math.sin(a), seed + 1)
      return scale(base, (1 - depth + depth * fissure(h, a) * 1.6) * (0.8 + 0.4 * patch))
    },
    relief: (h, a) => -depth * Math.max(0, 1 - fissure(h, a) * 2)
  }
}

/** Birch: chalky white with dark horizontal marks, blacker toward the base,
 * smooth but for those marks, and rugged where it's black. */
function birchBark(seed: number): Bark {
  const white: RGB = [0.62, 0.6, 0.55]
  const dark: RGB = [0.06, 0.05, 0.05]
  const darkness = (h: number, a: number): number => {
    const marks = fbm3(Math.cos(a) * 0.8, h * 4, Math.sin(a) * 0.8, seed)
    const base = Math.max(0, 1 - h / 1.6) * fbm3(Math.cos(a) * 2, h * 2, Math.sin(a) * 2, seed + 5)
    return Math.min(1, Math.max(0, (marks - 0.62) * 5) + base * 1.4)
  }
  return {
    color: (h, a, r) => (r < 0.04 ? [0.18, 0.12, 0.09] : mix(white, dark, darkness(h, a))),
    relief: (h, a) => -0.5 * darkness(h, a)
  }
}

/** Smooth-barked gum (blue gum, spotted gum, scribbly gum): pale and
 * mottled where old bark has shed in patches, fresh bark darker and warmer,
 * ribbons of old bark hanging on the lower trunk. Pale est. (smooth gums are
 * cream to grey: not measured, NATURE_PLAN §1); fresh = the measured blue gum
 * bark. Nearly smooth: a little relief at the ribbons only. */
function gumBark(seed: number): Bark {
  const pale: RGB = [0.34, 0.31, 0.26]
  const fresh: RGB = [0.11, 0.08, 0.05]
  const salmon: RGB = [0.27, 0.17, 0.11]
  const ribbon = (h: number, a: number): number => Math.max(0, 1 - h / 3) * Math.max(0, ridged(Math.cos(a) * 4, h * 0.25, Math.sin(a) * 4, seed + 3) - 0.75) * 4
  return {
    color: (h, a, r) => {
      if (r < 0.03) return [0.16, 0.12, 0.08]
      const patch = fbm3(Math.cos(a) * 2.2, h * 0.9, Math.sin(a) * 2.2, seed)
      const warm = fbm3(Math.cos(a) * 1.3, h * 0.5, Math.sin(a) * 1.3, seed + 1)
      let c = patch > 0.56 ? mix(fresh, salmon, warm) : mix(pale, scale(pale, 0.75), fbm3(Math.cos(a) * 6, h * 3, Math.sin(a) * 6, seed + 2))
      c = mix(c, [0.13, 0.1, 0.07], Math.min(1, ribbon(h, a)))
      return c
    },
    relief: (h, a) => -0.3 * Math.min(1, ribbon(h, a)),
    // Shedding bark takes its moss with it (est.).
    moss: 0.3
  }
}

/** Pine: rusty orange plates separated by dark cracks. */
export function platedBark(seed: number): Bark {
  const crack = (h: number, a: number): number => ridged(Math.cos(a) * 3.5, h * 1.2, Math.sin(a) * 3.5, seed) ** 4
  return {
    color: (h, a, r) => {
      const base: RGB = r > 0.12 ? [0.24, 0.12, 0.07] : [0.17, 0.11, 0.08]
      return scale(base, 0.45 + 0.75 * (1 - crack(h, a)))
    },
    relief: (h, a) => -crack(h, a)
  }
}

/** How deep bark relief cuts into a limb of this radius (m): a few cm on a
 * trunk, nothing on twigs. */
function barkDepth(radius: number): number {
  return radius < 0.05 ? 0 : Math.min(radius * 0.2, 0.05)
}

/** Catmull–Rom points between a path's points, so bark relief has rings to
 * live on without changing the path. */
function subdivide(path: Vector3[], k: number): Vector3[] {
  if (k <= 1) return path
  const out: Vector3[] = []
  const at = (i: number): Vector3 => path[Math.max(0, Math.min(path.length - 1, i))]
  for (let i = 0; i < path.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let j = 0; j < k; j++) {
      const t = j / k
      const t2 = t * t
      const t3 = t2 * t
      out.push(
        new Vector3()
          .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
          .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
          .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
          .addScaledVector(p3, 0.5 * t3 - 0.5 * t2)
      )
    }
  }
  out.push(path[path.length - 1].clone())
  return out
}

interface Tip {
  p: Vector3
  d: Vector3
}

interface Growth {
  /** Branching levels below the trunk. */
  levels: number
  trunkLength: number
  trunkRadius: number
  /** Children per limb, per level. */
  children: (level: number) => number
  /** Where along a limb its children start (0..1). */
  childStart: number
  /** Angle between a child and its parent (radians). */
  spread: (level: number) => number
  lengthRatio: number
  radiusRatio: number
  /** Per-segment bend toward the sky (+) or the ground (−). */
  upward: (level: number) => number
  /** Random wandering of the limbs. */
  gnarl: number
  /** Leaf clusters also along the outer half of the twigs, not just the ends. */
  tipsAlong: number
  bark: Bark
}

function growTree(b: MeshBuilder, rng: Random, g: Growth, start: Vector3, dir: Vector3): Tip[] {
  const tips: Tip[] = []
  const grow = (from: Vector3, heading: Vector3, length: number, radius: number, level: number): void => {
    const segments = Math.max(3, Math.min(10, Math.round(length / 0.7)))
    const path = [from.clone()]
    const d = heading.clone()
    // Trunks wander less than limbs.
    const wander = g.gnarl * (level === 0 ? 0.4 : 1)
    for (let i = 1; i <= segments; i++) {
      d.x += rng.normal(0, wander)
      d.y += rng.normal(0, wander * 0.5) + g.upward(level) / segments
      d.z += rng.normal(0, wander)
      d.normalize()
      path.push(path[i - 1].clone().addScaledVector(d, length / segments))
    }
    const last = level === g.levels
    const end = last ? radius * 0.3 : radius * 0.55
    // Trunks and limbs get enough sides and rings to carry the bark's relief.
    const sides = level === 0 ? 28 : level === 1 ? 12 : last ? 3 : 5
    const ringSpacing = level === 0 ? 0.15 : level === 1 ? 0.3 : Infinity
    const rings = subdivide(path, Math.min(8, Math.ceil(length / segments / ringSpacing)))
    // Buttress roots flare out at the base of the trunk. (Hashed, not drawn,
    // so the tree's shape stays the same.)
    const roots = 4 + Math.floor(hash(length, radius) * 3)
    const rootPhase = hash(radius, length) * Math.PI * 2
    const flare =
      level === 0
        ? (t: number, a: number) => 1 + (0.35 + 0.5 * Math.max(0, Math.cos(roots * a + rootPhase)) ** 2) * Math.exp(-t * 25)
        : () => 1
    // The limb narrows into its leader (the child that carries on), so the
    // fork has no step.
    const leaderRadius = end * g.radiusRatio * 1.15
    const narrow = (t: number): number => (last ? 1 : 1 + (leaderRadius / end - 1) * Math.max(0, (t - 0.75) / 0.25) ** 2)
    const depth = barkDepth(radius)
    b.mossy = g.bark.moss ?? 1
    b.tube(
      rings,
      (t, a) => {
        const r = (radius + (end - radius) * t) * flare(t, a) * narrow(t)
        const p = rings[Math.round(t * (rings.length - 1))]
        return r + depth * (1 - t * 0.6) * g.bark.relief(p.y + p.x * 0.3, a)
      },
      (t, a) => {
        const p = rings[Math.round(t * (rings.length - 1))]
        return g.bark.color(p.y + p.x * 0.3, a, radius + (end - radius) * t)
      },
      sides
    )
    b.mossy = 0
    if (last) {
      for (let i = Math.max(1, Math.round(segments * (1 - g.tipsAlong))); i <= segments; i++) {
        tips.push({ p: path[i], d: path[i].clone().sub(path[i - 1]).normalize() })
      }
      return
    }
    const n = g.children(level)
    const roll = rng.range(0, Math.PI * 2)
    for (let c = 0; c < n; c++) {
      // The last child continues the limb (a leader); the others fork off it.
      const leader = c === n - 1
      const t = leader ? 1 : g.childStart + (1 - g.childStart) * ((c + rng.float()) / n)
      const i = Math.min(segments, Math.max(1, Math.round(t * segments)))
      const at = path[i]
      const parentDir = path[i].clone().sub(path[i - 1]).normalize()
      const side = new Vector3().crossVectors(parentDir, UP)
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
      side.normalize().applyAxisAngle(parentDir, roll + c * 2.4 + rng.normal(0, 0.3))
      const angle = g.spread(level) * (leader ? 0.35 : rng.range(0.75, 1.2))
      const childDir = parentDir.clone().applyAxisAngle(side, angle)
      const childLength = length * g.lengthRatio * (leader ? 0.9 : 1 - 0.35 * t) * rng.range(0.8, 1.15)
      const childRadius = leader ? leaderRadius : (radius + (end - radius) * t) * g.radiusRatio
      grow(at, childDir, childLength, childRadius, level + 1)
    }
  }
  grow(start, dir.clone().normalize(), g.trunkLength, g.trunkRadius, 0)
  return tips
}

/**
 * A leaf's shape. Simple leaves are a blade: an outline from the stalk to the
 * tip, folded a little along the midrib and arching down toward the tip.
 * Acacias have feathery compound leaves: pairs of tiny leaflets along a rib.
 */
interface LeafShape {
  /** Stations from base to tip: [along (0..1), half-width (0..1)]. */
  outline: readonly (readonly [number, number])[]
  /** Edges sit this far below the midrib (fraction of the half-width). */
  fold: number
  /** The tip droops this far (fraction of the length). */
  curl: number
  /** Pairs of leaflets along a rib instead of a blade. */
  leaflets?: number
}

const LEAF: Record<'oval' | 'ovate' | 'lance' | 'needle' | 'small' | 'pinnate', LeafShape> = {
  // Oak, holm oak, almond: widest at the middle, round-tipped.
  oval: { outline: [[0.3, 0.9], [0.7, 0.85]], fold: 0.3, curl: 0.15 },
  // Birch: broad near the stalk, tapering to a point.
  ovate: { outline: [[0.25, 1], [0.6, 0.6]], fold: 0.2, curl: 0.1 },
  // Olive: long and narrow, pointed at both ends.
  lance: { outline: [[0.45, 1]], fold: 0.35, curl: 0.2 },
  // Pine needles: thin, nearly straight blades.
  needle: { outline: [[0.5, 1]], fold: 0, curl: 0.08 },
  // Shrubs: small, rounded leaves.
  small: { outline: [[0.4, 1]], fold: 0.3, curl: 0.12 },
  // Acacia: bipinnate fronds, read as one rib of leaflets.
  pinnate: { outline: [], fold: 0, curl: 0.15, leaflets: 4 }
}

interface Foliage {
  shape: LeafShape
  perTip: number
  /** Spread of the leaves around a tip. */
  cluster: number
  length: [number, number]
  /** Width as a fraction of the length. */
  width: number
  /** How much leaves hang (0) or face the sky (1). */
  facing: number
  /** Squash clusters vertically (acacia's flat layers). */
  flatten: number
  colors: RGB[]
  /** Autumn colours and leaf fall (phenology.ts); none: summer leaves. */
  season?: PlantSeason
}

/**
 * Leaves around each twig tip. Leaves inside the crown are darker (they sit
 * in the shade of the others) and the top is lighter, which reads as volume
 * even though there's no ambient occlusion.
 */
function leaves(b: MeshBuilder, rng: Random, tips: Tip[], f: Foliage): void {
  if (tips.length === 0) return
  const center = new Vector3()
  for (const tip of tips) center.add(tip.p)
  center.divideScalar(tips.length)
  let radius = 0
  for (const tip of tips) radius = Math.max(radius, tip.p.distanceTo(center))
  const top = Math.max(...tips.map(t => t.p.y))
  const bottom = Math.min(...tips.map(t => t.p.y))

  const side = new Vector3()
  const normal = new Vector3()
  // Deciduous or not, and how early it turns, per tree (hashed from its
  // shape, not drawn).
  const key = hash(tips[0].p.x * 13.1 + tips.length, tips[0].p.z * 7.7 + tips[0].p.y)
  // A crown in flower (blossomFor) is one of the evergreen shrubs that bloom.
  const blossom = f.season?.blossom
  const season = f.season != null && blossom == null && key < f.season.deciduous ? f.season : undefined
  const early = (hash(key * 91.3, 3.3) - 0.5) * 0.3
  // For what falls from it (props/leafLitter.ts).
  b.userData.deciduous = season != null
  for (const tip of tips) {
    // Leafless twigs: as the leaves fall, the fine twigs they hid show, a
    // few per tip (hashed: no draws).
    if (season != null && season.on < 1) {
      const n = Math.round((1 - season.on) * 3)
      for (let j = 0; j < n; j++) {
        const h1 = hash(tip.p.x * 17.1 + j, tip.p.z * 9.3 + tip.p.y)
        const h2 = hash(tip.p.y * 5.7 + j, tip.p.x * 3.1)
        const h3 = hash(j * 7.7 + tip.p.z, h1)
        const dir = tip.d.clone().multiplyScalar(0.8).add(new Vector3(h1 - 0.5, h2 - 0.3, h3 - 0.5).multiplyScalar(1.4)).normalize()
        const length = f.cluster * (0.5 + 0.6 * h3)
        const bend = new Vector3(h2 - 0.5, 0.3, h1 - 0.5).multiplyScalar(length * 0.25)
        const path = [tip.p.clone(), tip.p.clone().addScaledVector(dir, length * 0.5).add(bend), tip.p.clone().addScaledVector(dir, length)]
        b.tube(path, t => 0.007 * (1 - t) + 0.002, () => TWIG, 3)
      }
    }
    const outward = tip.p.clone().sub(center).setY(0).normalize()
    for (let k = 0; k < f.perTip; k++) {
      const offset = new Vector3(rng.normal(), rng.normal() * (1 - f.flatten), rng.normal()).multiplyScalar(f.cluster * 0.5)
      const base = tip.p.clone().add(offset)
      const dir = tip.d
        .clone()
        .multiplyScalar(0.6)
        .add(outward)
        .add(new Vector3(rng.normal(), rng.normal() - 0.3, rng.normal()).multiplyScalar(0.8))
        .normalize()
      // Blade normal: mostly toward the sky, rolled a little at random.
      normal.copy(UP).addScaledVector(dir, -dir.y).normalize()
      normal.lerp(new Vector3(rng.normal(), rng.normal(), rng.normal()).normalize(), 1 - f.facing).normalize()
      side.crossVectors(dir, normal).normalize()
      const length = rng.range(f.length[0], f.length[1])
      const width = length * f.width * 0.5

      const depth = Math.min(1, base.distanceTo(center) / (radius + 1e-3))
      const height = (base.y - bottom) / (top - bottom + 1e-3)
      const shade = (0.35 + 0.65 * depth ** 1.5) * (0.75 + 0.45 * height) * rng.range(0.85, 1.15)
      let color = scale(f.colors[rng.int(0, f.colors.length - 1)], shade)
      // The season (after every draw, so the tree keeps its shape): leaves
      // fall and turn by hash, the top and outside of the crown first.
      if (season != null) {
        const exposed = 0.5 * height + 0.5 * depth
        if (hash(base.x * 31.7 + k * 0.37, base.z * 17.3 + base.y * 5.1) * 0.8 + (1 - exposed) * 0.2 >= season.on + early * 0.5) continue
        if (hash(base.y * 23.9 + k, base.x * 11.3 - base.z * 3.7) * 0.7 + (1 - exposed) * 0.3 < season.turned + early) {
          const autumn = season.autumn[Math.floor(hash(base.z * 5.3 + k, base.x * 2.1) * season.autumn.length)]
          color = scale(autumn, shade * (0.8 + 0.4 * hash(k, base.y)))
        } else if (season.fresh > 0) {
          // New leaves: a paler yellow-green for their first weeks.
          color = mix(color, scale([0.12, 0.2, 0.03], shade), 0.5 * season.fresh)
        }
      }
      // Blossom (after every draw): a share of the cards are flowers, the
      // outside of the crown first, smaller than a leaf; a crown that flowers
      // bare (flamboyant) drops leaves first, inside first.
      let size = 1
      if (blossom != null) {
        const exposed = 0.5 * height + 0.5 * depth
        if (hash(base.z * 19.3 + k * 0.53, base.x * 27.1 - base.y * 4.3) * 0.7 + (1 - exposed) * 0.3 < blossom.leaves) {
          // Flowers sit on the crown's surface: darkened inside less than leaves.
          color = scale(blossom.color, (0.7 + 0.3 * depth) * (0.85 + 0.3 * hash(k * 3.1, base.z)))
          size = blossom.size
        } else if (blossom.on < 1 && hash(base.x * 41.3 + k * 0.29, base.y * 13.7 - base.z * 6.1) * 0.8 + (1 - exposed) * 0.2 >= blossom.on) continue
      }
      const tipColor = scale(color, 1.12)

      blade(b, f.shape, base, dir, normal, side, length * size, width * size, color, tipColor)
    }
  }
}

/** One leaf from `base` along `dir`, its face toward `normal`. */
function blade(
  b: MeshBuilder,
  shape: LeafShape,
  base: Vector3,
  dir: Vector3,
  normal: Vector3,
  side: Vector3,
  length: number,
  width: number,
  color: RGB,
  tipColor: RGB
): void {
  // Each leaf arches a little differently.
  const curl = shape.curl * (0.5 + hash(length, width))
  const along = (u: number): Vector3 =>
    base
      .clone()
      .addScaledVector(dir, length * u)
      .addScaledVector(normal, -length * curl * u * u)

  if (shape.leaflets != null) {
    // A rib of separate, narrow leaflets angled forward on both sides.
    const n = shape.leaflets
    const step = 1 / (n + 1)
    for (let k = 1; k <= n; k++) {
      const u = k * step
      const reach = width * (1 - 0.5 * u)
      const c = scale(color, 0.9 + 0.2 * u)
      for (const sign of [-1, 1]) {
        // A narrow lozenge from the rib out to a rounded tip.
        const out = side.clone().multiplyScalar(sign * reach).addScaledVector(dir, length * step * 0.5)
        const at = along(u)
        const stem = b.vertex(at, c)
        const tip = b.vertex(at.clone().add(out).addScaledVector(normal, -reach * 0.2), c)
        const mid = at.clone().addScaledVector(out, 0.5).addScaledVector(normal, -reach * 0.1)
        const back = b.vertex(mid.clone().addScaledVector(dir, -length * step * 0.22), c)
        const front = b.vertex(mid.clone().addScaledVector(dir, length * step * 0.22), c)
        if (sign > 0) {
          b.triangle(stem, back, tip)
          b.triangle(stem, tip, front)
        } else {
          b.triangle(stem, tip, back)
          b.triangle(stem, front, tip)
        }
      }
    }
    return
  }

  if (shape.fold === 0 && shape.outline.length === 1) {
    // A flat, thin blade (needles): no midrib.
    const [u, hw] = shape.outline[0]
    const at = along(u)
    const i0 = b.vertex(base, color)
    const i1 = b.vertex(at.clone().addScaledVector(side, width * hw), color)
    const i2 = b.vertex(along(1), tipColor)
    const i3 = b.vertex(at.clone().addScaledVector(side, -width * hw), color)
    b.triangle(i0, i1, i2)
    b.triangle(i0, i2, i3)
    return
  }

  // Stalk end, then midrib and edges at each station, then the tip.
  const rib = scale(color, 1.06)
  const stalk = b.vertex(base, scale(color, 0.9))
  let prev: [number, number, number] | null = null
  for (const [u, hw] of shape.outline) {
    const at = along(u)
    const w = width * hw
    const drop = normal.clone().multiplyScalar(w * shape.fold)
    const m = b.vertex(at, rib)
    const l = b.vertex(at.clone().addScaledVector(side, w).sub(drop), color)
    const r = b.vertex(at.clone().addScaledVector(side, -w).sub(drop), color)
    if (prev == null) {
      b.triangle(stalk, l, m)
      b.triangle(stalk, m, r)
    } else {
      const [pm, pl, pr] = prev
      b.triangle(pm, pl, l)
      b.triangle(pm, l, m)
      b.triangle(pm, m, r)
      b.triangle(pm, r, pr)
    }
    prev = [m, l, r]
  }
  const tip = b.vertex(along(1), tipColor)
  const [pm, pl, pr] = prev!
  b.triangle(pl, tip, pm)
  b.triangle(pm, tip, pr)
}

/** Foliage colours for a species: the biome's tint shifted per tree. */
function palette(rng: Random, foliage: RGB, shift: RGB, k: number): RGB[] {
  const base = mix(foliage, shift, rng.range(0, k))
  return [base, scale(base, 1.25), mix(base, [0.12, 0.13, 0.03], 0.25), scale(base, 0.85)]
}

/** Broad, spreading crown: oak, holm oak, tropical almond. */
export function broadleaf(rng: Random, foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(4, 6.5)
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: height,
      trunkRadius: rng.range(0.28, 0.42),
      children: level => (level === 0 ? rng.int(3, 5) : level === 1 ? rng.int(3, 4) : rng.int(2, 3)),
      childStart: 0.45,
      spread: level => (level === 0 ? 0.85 : 0.65),
      lengthRatio: 0.62,
      radiusRatio: 0.68,
      upward: level => (level === 0 ? 0.05 : 0.25 - 0.2 * level),
      gnarl: 0.09,
      tipsAlong: 0.7,
      bark: furrowed([0.15, 0.12, 0.09], rng.int(0, 1e6))
    },
    new Vector3(),
    new Vector3(rng.normal(0, 0.08), 1, rng.normal(0, 0.08))
  )
  leaves(b, rng, tips, {
    shape: LEAF.oval,
    perTip: rng.int(26, 34),
    cluster: 0.7,
    length: [0.22, 0.36],
    width: 0.55,
    facing: 0.6,
    flatten: 0.2,
    colors: palette(rng, foliage, [0.05, 0.12, 0.03], 0.4),
    season
  })
  return b.build()
}

/** Olive: short, twisted, often split trunk and a silvery-grey crown. */
export function olive(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const silver: RGB = [0.12, 0.14, 0.09]
  const stems = rng.chance(0.5) ? 2 : 1
  for (let s = 0; s < stems; s++) {
    const az = rng.range(0, Math.PI * 2)
    const tips = growTree(
      b,
      rng,
      {
        levels: 4,
        trunkLength: rng.range(1.6, 2.6),
        trunkRadius: rng.range(0.22, 0.35) / Math.sqrt(stems),
        children: level => (level === 0 ? rng.int(3, 4) : rng.int(2, 3)),
        childStart: 0.6,
        spread: () => 0.7,
        lengthRatio: 0.75,
        radiusRatio: 0.65,
        upward: () => 0.1,
        gnarl: 0.2,
        tipsAlong: 0.6,
        bark: furrowed([0.2, 0.19, 0.16], rng.int(0, 1e6), 0.75)
      },
      new Vector3(Math.cos(az) * 0.15 * s, 0, Math.sin(az) * 0.15 * s),
      new Vector3(Math.cos(az) * 0.35 * stems, 1, Math.sin(az) * 0.35 * stems)
    )
    leaves(b, rng, tips, {
    shape: LEAF.lance,
      perTip: rng.int(24, 30),
      cluster: 0.6,
      length: [0.14, 0.24],
      width: 0.3,
      facing: 0.4,
      flatten: 0.1,
      colors: palette(rng, mix(foliage, silver, 0.6), [0.16, 0.17, 0.13], 0.5)
    })
  }
  return b.build()
}

/** Birch: slender white trunk, fine drooping twigs, small light leaves. */
export function birch(rng: Random, foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: rng.range(8, 12),
      trunkRadius: rng.range(0.13, 0.2),
      children: level => (level === 0 ? rng.int(6, 9) : level === 3 ? 2 : rng.int(2, 3)),
      childStart: 0.35,
      spread: level => (level === 0 ? 0.65 : 0.55),
      lengthRatio: 0.38,
      radiusRatio: 0.55,
      upward: level => (level < 2 ? 0.2 : -0.2),
      gnarl: 0.06,
      tipsAlong: 0.7,
      bark: birchBark(rng.int(0, 1e6))
    },
    new Vector3(),
    new Vector3(rng.normal(0, 0.05), 1, rng.normal(0, 0.05))
  )
  leaves(b, rng, tips, {
    shape: LEAF.ovate,
    perTip: rng.int(24, 30),
    cluster: 0.5,
    length: [0.14, 0.22],
    width: 0.75,
    facing: 0.35,
    flatten: 0,
    colors: palette(rng, scale(foliage, 1.4), [0.1, 0.16, 0.03], 0.5),
    season
  })
  return b.build()
}

/** Umbrella thorn acacia: forks low, limbs spread up to a flat-topped crown. */
export function acacia(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: rng.range(2, 3),
      trunkRadius: rng.range(0.18, 0.26),
      children: level => (level === 0 ? rng.int(3, 4) : rng.int(2, 3)),
      childStart: 0.9,
      spread: level => (level === 0 ? 0.6 : level === 1 ? 0.35 : 1.1),
      lengthRatio: 0.85,
      radiusRatio: 0.65,
      // Limbs climb steeply, then the outer branches fan out level.
      upward: level => (level < 2 ? 0.1 : -0.15),
      gnarl: 0.12,
      tipsAlong: 0.6,
      bark: furrowed([0.16, 0.12, 0.09], rng.int(0, 1e6), 0.7)
    },
    new Vector3(),
    new Vector3(rng.normal(0, 0.15), 1, rng.normal(0, 0.15))
  )
  leaves(b, rng, tips, {
    shape: LEAF.pinnate,
    perTip: rng.int(20, 26),
    cluster: 1.0,
    length: [0.18, 0.28],
    width: 0.6,
    facing: 0.85,
    flatten: 0.8,
    colors: palette(rng, mix(foliage, [0.09, 0.11, 0.04], 0.5), [0.14, 0.13, 0.05], 0.4)
  })
  return b.build()
}

/** Stone pine: a forked trunk holding an umbrella of needle tufts. */
export function stonePine(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: rng.range(4, 6.5),
      trunkRadius: rng.range(0.25, 0.35),
      children: level => (level === 0 ? rng.int(3, 4) : rng.int(2, 3)),
      childStart: 0.8,
      spread: level => (level === 0 ? 0.6 : level === 1 ? 0.3 : 0.9),
      lengthRatio: 0.72,
      radiusRatio: 0.7,
      upward: level => (level < 2 ? 0.1 : -0.1),
      gnarl: 0.07,
      tipsAlong: 0.6,
      bark: platedBark(rng.int(0, 1e6))
    },
    new Vector3(),
    new Vector3(rng.normal(0, 0.12), 1, rng.normal(0, 0.12))
  )
  // Needles: brushes of thin blades radiating from each twig end.
  leaves(b, rng, tips, {
    shape: LEAF.needle,
    perTip: rng.int(60, 75),
    cluster: 0.9,
    length: [0.35, 0.55],
    width: 0.15,
    facing: 0.3,
    flatten: 0.7,
    colors: palette(rng, scale(foliage, 0.9), [0.05, 0.08, 0.04], 0.3)
  })
  return b.build()
}

/** Eucalyptus leaves (NATURE_PLAN §1): adult leaf, measured (dark, glossy);
 * grey-leaved and juvenile foliage paler, est. Rough bark: the measured
 * eucalyptus bark (stringybark, ironbark, the stocking of a blackbutt). */
const EUCALYPT_LEAF: RGB = [0.026, 0.065, 0.002]
const EUCALYPT_GREY: RGB = [0.06, 0.08, 0.05]
const EUCALYPT_ROUGH: RGB = [0.09, 0.06, 0.03]

/**
 * Eucalyptus (coastal gums: blue gum, blackbutt, spotted gum): a tall
 * straight trunk to about half the height, a few steep limbs and an open,
 * narrow crown of hanging, edge-on leaves. 15–24 m at scale 1 (medium eucalypt
 * forest is 10–30 m, ABARES; blue gum groves 15–45 m). Smooth pale bark on
 * most, rough dark bark on the rest. Evergreen: `season` only dries nothing.
 */
export function eucalyptus(rng: Random, _foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(15, 24)
  const seed = rng.int(0, 1e6)
  const bark = rng.chance(0.6) ? gumBark(seed) : furrowed(EUCALYPT_ROUGH, seed, 0.5)
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: height * 0.55,
      trunkRadius: height * rng.range(0.016, 0.022),
      children: level => (level === 0 ? rng.int(4, 5) : level === 1 ? 3 : rng.int(2, 3)),
      childStart: 0.65,
      // Limbs climb steeply; the outer twigs hang.
      spread: level => (level === 0 ? 0.5 : level === 1 ? 0.55 : 0.7),
      lengthRatio: 0.5,
      radiusRatio: 0.6,
      upward: level => (level < 2 ? 0.12 : level === 2 ? 0 : -0.25),
      gnarl: 0.1,
      tipsAlong: 0.8,
      bark
    },
    new Vector3(),
    new Vector3(rng.normal(0, 0.05), 1, rng.normal(0, 0.05))
  )
  leaves(b, rng, tips, {
    shape: LEAF.lance,
    perTip: rng.int(34, 40),
    cluster: 1.2,
    length: [0.2, 0.32],
    width: 0.24,
    // Hanging, edge-on to the sky: a eucalypt crown's open, grey look.
    facing: 0.1,
    flatten: 0,
    colors: palette(rng, mix(EUCALYPT_LEAF, EUCALYPT_GREY, rng.range(0, 0.7)), EUCALYPT_GREY, 0.3),
    season
  })
  return b.build()
}

/** Shrub: several stems from the ground, branching into a dense leafy mound. */
export function bush(rng: Random, foliage: RGB, season?: PlantSeason): BufferGeometry {
  const b = new MeshBuilder()
  const bark = furrowed([0.14, 0.11, 0.08], rng.int(0, 1e6))
  const colors = palette(rng, scale(foliage, 1.1), [0.1, 0.12, 0.04], 0.5)
  const stems = rng.int(3, 6)
  const tips: Tip[] = []
  for (let i = 0; i < stems; i++) {
    const az = rng.range(0, Math.PI * 2)
    tips.push(
      ...growTree(
        b,
        rng,
        {
          levels: 2,
          trunkLength: rng.range(0.5, 1.1),
          trunkRadius: 0.025,
          children: () => rng.int(2, 4),
          childStart: 0.3,
          spread: () => 0.7,
          lengthRatio: 0.7,
          radiusRatio: 0.7,
          upward: () => 0.1,
          gnarl: 0.15,
          tipsAlong: 0.8,
          bark
        },
        new Vector3(Math.cos(az) * 0.25, 0, Math.sin(az) * 0.25),
        new Vector3(Math.cos(az) * 0.8, 1, Math.sin(az) * 0.8)
      )
    )
  }
  leaves(b, rng, tips, {
    shape: LEAF.small,
    perTip: rng.int(30, 38),
    cluster: 0.3,
    length: [0.08, 0.13],
    width: 0.55,
    facing: 0.65,
    flatten: 0.2,
    colors,
    season
  })
  return b.build()
}

/** A flat spray of needles: a spine with needles angled forward on both sides. */
function spray(b: MeshBuilder, base: Vector3, dir: Vector3, length: number, color: RGB): void {
  const side = new Vector3().crossVectors(dir, UP)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  const spine = new Vector3()
  const width = length * 0.36
  const steps = 4
  let prev = b.vertex(base, color)
  for (let j = 1; j <= steps; j++) {
    const s = j / steps
    spine.copy(base).addScaledVector(dir, length * s)
    const w = width * Math.sin(Math.PI * Math.min(1, s * 1.1)) + width * 0.15
    const c = scale(color, 0.85 + 0.3 * s)
    const point = b.vertex(spine, c)
    for (const sign of [-1, 1]) {
      const tooth = spine
        .clone()
        .addScaledVector(side, sign * w)
        .addScaledVector(dir, length * 0.12)
        .addScaledVector(UP, -w * 0.3)
      b.triangle(prev, b.vertex(tooth, c), point)
    }
    prev = point
  }
}

/** Italian cypress: a narrow flame of upswept sprays around a hidden trunk. */
export function cypress(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(10, 17)
  const width = height * rng.range(0.07, 0.1)
  const seed = rng.int(0, 1e6)
  const needles = scale(foliage, 0.75)
  const bark = furrowed([0.16, 0.12, 0.09], seed)
  b.tube([new Vector3(), new Vector3(0, height * 0.95, 0)], t => 0.2 * (1 - t) + 0.03, (t, a) => bark.color(t * height, a, 0.2), 6)
  const sprays = Math.round(height * 70)
  for (let i = 0; i < sprays; i++) {
    const t = Math.sqrt(rng.float()) * 0.97
    const y = height * (0.04 + 0.96 * (1 - t))
    const h = y / height
    // Envelope: widest at a third of the height, tapering to a point.
    const envelope = width * Math.min(1, h * 4 + 0.3) * (1 - h ** 1.6) * (0.85 + 0.3 * fbm3(i * 0.01, h * 8, 0, seed))
    const az = rng.range(0, Math.PI * 2)
    const r = envelope * Math.sqrt(rng.float())
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const base = out.clone().multiplyScalar(r).setY(y)
    const dir = out.clone().multiplyScalar(0.35).addScaledVector(UP, 1).normalize()
    dir.applyAxisAngle(UP, rng.normal(0, 0.3))
    const depth = r / (envelope + 1e-3)
    const shade = (0.5 + 0.6 * depth) * (0.8 + 0.3 * h) * rng.range(0.85, 1.15)
    spray(b, base, dir, rng.range(0.4, 0.7), scale(needles, shade))
  }
  return b.build()
}

/**
 * Spruce: a straight trunk with whorls of drooping branches whose tips turn
 * up again, hung with flat, serrated sprays of needles.
 */
export function conifer(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(10, 18)
  const bark = platedBark(rng.int(0, 1e6))
  const needles = scale(foliage, 0.8)
  b.mossy = 1
  b.tube(
    subdivide(
      Array.from({ length: 8 }, (_, i) => new Vector3(rng.normal(0, 0.03), (height * 0.94 * i) / 7, rng.normal(0, 0.03))),
      8
    ),
    (t, a) =>
      (0.25 * (1 - t) + 0.03) * (1 + 0.5 * Math.exp(-t * 30)) + barkDepth(0.25 * (1 - t)) * bark.relief(t * height, a),
    (t, a) => bark.color(t * height, a, 0.25 * (1 - t)),
    14
  )
  b.mossy = 0
  const whorls = rng.int(18, 24)
  for (let w = 0; w < whorls; w++) {
    const t = (w + rng.range(-0.3, 0.3)) / whorls
    const y = height * (0.15 + 0.83 * t)
    const reach = (1 - t) ** 0.9 * height * 0.24 + 0.4
    const branches = rng.int(7, 10)
    const roll = rng.range(0, Math.PI * 2)
    for (let k = 0; k < branches; k++) {
      const az = roll + (k / branches) * Math.PI * 2 + rng.normal(0, 0.25)
      const out = new Vector3(Math.cos(az), 0, Math.sin(az))
      const len = reach * rng.range(0.8, 1.1)
      const droop = rng.range(0.2, 0.4)
      // Out and down, with the tip turning up again.
      const at = (s: number): Vector3 =>
        new Vector3(0, y, 0)
          .addScaledVector(out, len * s)
          .addScaledVector(UP, len * (-droop * s + 0.3 * droop * s ** 3))
      const path = [0, 0.33, 0.66, 1].map(at)
      b.tube(path, s => 0.05 * (1 - s) + 0.01, (_, a) => bark.color(y, a, 0.02), 3)
      // Light catches the outer sprays and the top of the tree.
      const color = scale(needles, (0.75 + 0.4 * t) * rng.range(0.85, 1.15))
      const count = Math.max(3, Math.round(len / 0.2))
      for (let i = 1; i <= count; i++) {
        const s = i / count
        const base = at(s)
        const shade = scale(color, 0.55 + 0.55 * s)
        const sprayLength = 0.35 + 0.45 * (1 - s * 0.5) * Math.min(1, reach / 2)
        for (const sign of [-1, 1]) {
          const dir = out
            .clone()
            .applyAxisAngle(UP, sign * rng.range(0.7, 1.2))
            .addScaledVector(UP, -rng.range(0.2, 0.6))
            .normalize()
          spray(b, base, dir, sprayLength * rng.range(0.8, 1.2), shade)
        }
        // Curtains of sprays hanging under the branch.
        if (rng.chance(0.6)) {
          const dir = out.clone().applyAxisAngle(UP, rng.normal(0, 0.5)).addScaledVector(UP, -1.4).normalize()
          spray(b, base, dir, sprayLength * 0.8, scale(shade, 0.8))
        }
      }
      spray(b, at(1), out.clone().addScaledVector(UP, 0.2).normalize(), 0.5, scale(color, 1.1))
    }
  }
  // The leader at the very top.
  spray(b, new Vector3(0, height * 0.9, 0), UP, height * 0.1, scale(needles, 1.1))
  return b.build()
}

/**
 * Screw pine (pandanus): a leaning trunk on stilt roots, forking into a few
 * arms that each end in a spiral tuft of long strap leaves.
 */
export function pandanus(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const bark = furrowed([0.3, 0.27, 0.21], rng.int(0, 1e6), 0.4)
  const lean = new Vector3(rng.normal(0, 0.3), 1, rng.normal(0, 0.3))
  const tips = growTree(
    b,
    rng,
    {
      levels: 2,
      trunkLength: rng.range(2.5, 4),
      trunkRadius: 0.16,
      children: () => rng.int(2, 3),
      childStart: 0.8,
      spread: () => 0.6,
      lengthRatio: 0.7,
      radiusRatio: 0.85,
      upward: () => 0.3,
      gnarl: 0.08,
      tipsAlong: 0,
      // Ringed with old leaf scars.
      bark: {
        color: (h, a, r) => scale(bark.color(h, a, r), 0.8 + 0.3 * Math.sin(h * 25)),
        relief: h => -0.6 * Math.max(0, -Math.sin(h * 25))
      }
    },
    new Vector3(0, 0.9, 0),
    lean
  )
  // Prop roots from the trunk down to the ground.
  const roots = rng.int(4, 7)
  for (let i = 0; i < roots; i++) {
    const az = (i / roots) * Math.PI * 2 + rng.normal(0, 0.3)
    const top = new Vector3(0, rng.range(0.9, 1.6), 0).addScaledVector(lean.clone().normalize(), 0.3)
    const foot = new Vector3(Math.cos(az) * rng.range(0.5, 0.9), -0.1, Math.sin(az) * rng.range(0.5, 0.9))
    const path = Array.from({ length: 6 }, (_, k) => {
      const t = k / 5
      return top.clone().lerp(foot, t).add(new Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(0.25 * Math.sin(t * Math.PI)))
    })
    b.tube(path, () => 0.045, (t, a) => bark.color(t * 2, a, 0.05), 4)
  }
  b.tube([new Vector3(0, -0.1, 0), new Vector3(0, 0.95, 0)], () => 0.13, (t, a) => bark.color(t, a, 0.15), 6)
  // Tufts of long, arching, keeled strap leaves.
  const colors = palette(rng, scale(foliage, 1.1), [0.12, 0.14, 0.05], 0.4)
  for (const tip of tips) {
    const count = rng.int(18, 26)
    for (let k = 0; k < count; k++) {
      const az = k * 2.4 + rng.normal(0, 0.1)
      const rise = rng.range(-0.2, 1.1)
      const out = new Vector3(Math.cos(az) * Math.cos(rise), Math.sin(rise), Math.sin(az) * Math.cos(rise))
      const length = rng.range(1.0, 1.6)
      const color = scale(colors[k % colors.length], rng.range(0.8, 1.15))
      const dry = rise < 0.1 && rng.chance(0.3)
      const c = dry ? ([0.25, 0.2, 0.1] as RGB) : color
      const side = new Vector3().crossVectors(out, UP).normalize()
      let prevL = -1
      let prevR = -1
      let prevM = -1
      for (let j = 0; j <= 5; j++) {
        const t = j / 5
        const p = tip.p
          .clone()
          .addScaledVector(out, length * t)
          .addScaledVector(UP, -length * 0.45 * t * t)
        const w = 0.06 * (1 - t * 0.8)
        const shade = scale(c, 0.7 + 0.4 * t)
        const l = b.vertex(p.clone().addScaledVector(side, -w).addScaledVector(UP, -w * 0.4), shade)
        const m = b.vertex(p, shade)
        const r = b.vertex(p.clone().addScaledVector(side, w).addScaledVector(UP, -w * 0.4), shade)
        if (prevL >= 0) {
          b.quad(prevL, prevM, m, l)
          b.quad(prevM, prevR, r, m)
        }
        prevL = l
        prevM = m
        prevR = r
      }
    }
  }
  return b.build()
}

/** Red mangrove (Rhizophora): a trunk held up on arching prop roots that
 * leave it 1–2.5 m above the mud and dive back into it all round, under a
 * dense, rounded crown of dark, glossy, leathery leaves. Base (the mud) at
 * y = 0; the roots end a little below it. */
export function rhizophora(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(5, 9)
  const rootTop = rng.range(1.2, 2.4)
  const barkBase: RGB = [0.22, 0.19, 0.15]
  const bark = furrowed(barkBase, rng.int(0, 1e6), 0.3)
  const trunkFoot = rootTop * 0.55
  const tips = growTree(
    b,
    rng,
    {
      levels: 4,
      trunkLength: height - trunkFoot,
      trunkRadius: rng.range(0.14, 0.22),
      children: level => (level === 0 ? rng.int(3, 5) : rng.int(2, 3)),
      childStart: 0.4,
      spread: level => (level === 0 ? 0.9 : 0.7),
      lengthRatio: 0.6,
      radiusRatio: 0.66,
      upward: level => 0.2 - 0.12 * level,
      gnarl: 0.12,
      tipsAlong: 0.6,
      bark
    },
    new Vector3(0, trunkFoot, 0),
    new Vector3(rng.normal(0, 0.1), 1, rng.normal(0, 0.1))
  )
  // Prop roots: out and slightly up from the trunk, then curving down into
  // the mud. Muddy and barnacled where the tide covers them.
  const roots = rng.int(10, 16)
  for (let i = 0; i < roots; i++) {
    const az = (i / roots) * Math.PI * 2 + rng.normal(0, 0.25)
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const start = rng.range(0.6, 1) * rootTop
    const reach = rng.range(1, 2.6) * (start / rootTop + 0.3)
    const path: Vector3[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      const y = start + 0.3 * start * Math.sin(Math.PI * t) - (start + 0.3) * t * t
      path.push(out.clone().multiplyScalar(0.12 + reach * (1 - (1 - t) ** 1.6)).setY(y))
    }
    b.tube(
      path,
      t => 0.035 + 0.025 * (1 - t),
      t => (path[Math.round(t * 8)].y < 0.6 ? mix(barkBase, [0.17, 0.15, 0.12], 0.6) : scale(barkBase, 1.1)),
      5
    )
  }
  leaves(b, rng, tips, {
    shape: LEAF.oval,
    perTip: rng.int(34, 42),
    cluster: 0.75,
    length: [0.18, 0.26],
    width: 0.5,
    facing: 0.7,
    flatten: 0.25,
    colors: palette(rng, scale(foliage, 0.8), [0.02, 0.1, 0.04], 0.3)
  })
  return b.build()
}

/** Grey mangrove (Avicennia): a low, many-stemmed tree with pale grey bark
 * and grey-green leaves, the only mangrove of the Red Sea and the Gulf,
 * where it stays 2–4 m. Its roots run under the mud and send up a bed of
 * pencil-like breathing roots (pneumatophores) all round. Base at y = 0. */
export function avicennia(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(2, 4.5)
  const bark = furrowed([0.42, 0.4, 0.36], rng.int(0, 1e6), 0.2)
  const colors = palette(rng, mix(foliage, [0.36, 0.42, 0.34], 0.45), [0.1, 0.1, 0.08], 0.3)
  const stems = rng.int(2, 4)
  const tips: Tip[] = []
  for (let i = 0; i < stems; i++) {
    const az = rng.range(0, Math.PI * 2)
    tips.push(
      ...growTree(
        b,
        rng,
        {
          levels: 3,
          trunkLength: height * rng.range(0.7, 1),
          trunkRadius: rng.range(0.06, 0.12),
          children: () => rng.int(2, 4),
          childStart: 0.35,
          spread: () => 0.75,
          lengthRatio: 0.62,
          radiusRatio: 0.68,
          upward: level => 0.15 - 0.1 * level,
          gnarl: 0.16,
          tipsAlong: 0.7,
          bark
        },
        new Vector3(Math.cos(az) * 0.15, 0, Math.sin(az) * 0.15),
        new Vector3(Math.cos(az) * 0.5, 1, Math.sin(az) * 0.5)
      )
    )
  }
  leaves(b, rng, tips, {
    shape: LEAF.ovate,
    perTip: rng.int(24, 30),
    cluster: 0.5,
    length: [0.12, 0.18],
    width: 0.45,
    facing: 0.6,
    flatten: 0.3,
    colors
  })
  // Pneumatophores: 10–30 cm spikes out to a few metres from the stems.
  const spikes = rng.int(70, 110)
  for (let i = 0; i < spikes; i++) {
    const az = rng.range(0, Math.PI * 2)
    const r = 0.5 + 2.8 * Math.sqrt(rng.float())
    const base = new Vector3(Math.cos(az) * r, -0.05, Math.sin(az) * r)
    const top = base.clone().add(new Vector3(rng.normal(0, 0.02), rng.range(0.1, 0.3), rng.normal(0, 0.02)))
    b.tube([base, top], t => 0.012 * (1 - 0.6 * t), () => [0.3, 0.28, 0.24], 3)
  }
  return b.build()
}
