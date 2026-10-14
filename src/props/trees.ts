import { Vector3, type BufferGeometry } from 'three'

import type { RGB } from '../biome'
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

/** Ridged noise in [0, 1]: thin dark lines where fbm crosses its midpoint. */
function ridged(x: number, y: number, z: number, seed: number): number {
  return 1 - Math.abs(fbm3(x, y, z, seed) * 2 - 1)
}

/** Bark colour at a point on a limb: `around` is the angle around the limb. */
type Bark = (height: number, around: number, radius: number) => RGB

/** Furrowed bark: dark vertical fissures between lighter ridges. */
export function furrowed(base: RGB, seed: number, depth = 0.6): Bark {
  return (h, a) => {
    const fissure = ridged(Math.cos(a) * 1.6, h * 0.35, Math.sin(a) * 1.6, seed)
    const patch = fbm3(Math.cos(a), h * 0.8, Math.sin(a), seed + 1)
    return scale(base, (1 - depth + depth * fissure ** 3 * 1.6) * (0.8 + 0.4 * patch))
  }
}

/** Birch: chalky white with dark horizontal marks, blacker toward the base. */
function birchBark(seed: number): Bark {
  const white: RGB = [0.62, 0.6, 0.55]
  const dark: RGB = [0.06, 0.05, 0.05]
  return (h, a, r) => {
    if (r < 0.04) return [0.18, 0.12, 0.09]
    const marks = fbm3(Math.cos(a) * 0.8, h * 4, Math.sin(a) * 0.8, seed)
    const base = Math.max(0, 1 - h / 1.6) * fbm3(Math.cos(a) * 2, h * 2, Math.sin(a) * 2, seed + 5)
    return mix(white, dark, Math.min(1, Math.max(0, (marks - 0.62) * 5) + base * 1.4))
  }
}

/** Pine: rusty orange plates separated by dark cracks. */
export function platedBark(seed: number): Bark {
  return (h, a, r) => {
    const plates = ridged(Math.cos(a) * 2.5, h * 1.2, Math.sin(a) * 2.5, seed)
    const base: RGB = r > 0.12 ? [0.24, 0.12, 0.07] : [0.17, 0.11, 0.08]
    return scale(base, 0.45 + 0.75 * (1 - plates ** 4))
  }
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
    const sides = level === 0 ? 10 : level === 1 ? 7 : last ? 3 : 5
    // A flare at the base of the trunk where the roots spread.
    const flare = level === 0 ? (t: number) => 1 + 0.6 * Math.exp(-t * 25) : () => 1
    b.tube(
      path,
      t => (radius + (end - radius) * t) * flare(t),
      (t, a) => {
        const p = path[Math.round(t * segments)]
        return g.bark(p.y + p.x * 0.3, a, radius + (end - radius) * t)
      },
      sides
    )
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
      const childRadius = (radius + (end - radius) * t) * g.radiusRatio * (leader ? 1.15 : 1)
      grow(at, childDir, childLength, childRadius, level + 1)
    }
  }
  grow(start, dir.clone().normalize(), g.trunkLength, g.trunkRadius, 0)
  return tips
}

interface Foliage {
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
  for (const tip of tips) {
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
      const color = scale(f.colors[rng.int(0, f.colors.length - 1)], shade)
      const tipColor = scale(color, 1.12)

      const mid = base.clone().addScaledVector(dir, length * 0.45)
      // A slight fold along the midrib so leaves catch light unevenly.
      const fold = normal.clone().multiplyScalar(width * 0.35)
      const i0 = b.vertex(base, color)
      const i1 = b.vertex(mid.clone().addScaledVector(side, width).sub(fold), color)
      const i2 = b.vertex(base.clone().addScaledVector(dir, length), tipColor)
      const i3 = b.vertex(mid.clone().addScaledVector(side, -width).sub(fold), color)
      b.triangle(i0, i1, i2)
      b.triangle(i0, i2, i3)
    }
  }
}

/** Foliage colours for a species: the biome's tint shifted per tree. */
function palette(rng: Random, foliage: RGB, shift: RGB, k: number): RGB[] {
  const base = mix(foliage, shift, rng.range(0, k))
  return [base, scale(base, 1.25), mix(base, [0.12, 0.13, 0.03], 0.25), scale(base, 0.85)]
}

/** Broad, spreading crown: oak, holm oak, tropical almond. */
export function broadleaf(rng: Random, foliage: RGB): BufferGeometry {
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
    perTip: rng.int(26, 34),
    cluster: 0.7,
    length: [0.22, 0.36],
    width: 0.55,
    facing: 0.6,
    flatten: 0.2,
    colors: palette(rng, foliage, [0.05, 0.12, 0.03], 0.4)
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
export function birch(rng: Random, foliage: RGB): BufferGeometry {
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
    perTip: rng.int(24, 30),
    cluster: 0.5,
    length: [0.14, 0.22],
    width: 0.75,
    facing: 0.35,
    flatten: 0,
    colors: palette(rng, scale(foliage, 1.4), [0.1, 0.16, 0.03], 0.5)
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

/** Shrub: several stems from the ground, branching into a dense leafy mound. */
export function bush(rng: Random, foliage: RGB): BufferGeometry {
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
    perTip: rng.int(30, 38),
    cluster: 0.3,
    length: [0.08, 0.13],
    width: 0.55,
    facing: 0.65,
    flatten: 0.2,
    colors
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
  b.tube([new Vector3(), new Vector3(0, height * 0.95, 0)], t => 0.2 * (1 - t) + 0.03, (t, a) => bark(t * height, a, 0.2), 6)
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
  b.tube(
    Array.from({ length: 8 }, (_, i) => new Vector3(rng.normal(0, 0.03), (height * 0.94 * i) / 7, rng.normal(0, 0.03))),
    t => (0.25 * (1 - t) + 0.03) * (1 + 0.5 * Math.exp(-t * 30)),
    (t, a) => bark(t * height, a, 0.25 * (1 - t)),
    8
  )
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
      b.tube(path, s => 0.05 * (1 - s) + 0.01, (_, a) => bark(y, a, 0.02), 3)
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
      bark: (h, a, r) => scale(bark(h, a, r), 0.8 + 0.3 * Math.sin(h * 25))
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
    b.tube(path, () => 0.045, (t, a) => bark(t * 2, a, 0.05), 4)
  }
  b.tube([new Vector3(0, -0.1, 0), new Vector3(0, 0.95, 0)], () => 0.13, (t, a) => bark(t, a, 0.15), 6)
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
