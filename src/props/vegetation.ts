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

import type { RGB, VegetationKind } from '../biome'
import type { Random } from '../random'
import { shoreToWorld, terrainNormal } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { noise3 } from './noise'
import { windMaterials, type Bend } from './wind'
import { acacia, birch, broadleaf, bush, conifer, cypress, olive, pandanus, stonePine } from './trees'

// Procedural plants, generated per scene from the seed, then scattered over
// the land behind the beach. Geometry is built at a nominal size with its
// base at the origin; instances scale and rotate it.

type Builder = (rng: Random, foliage: RGB) => BufferGeometry

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

const PALM_BARK: RGB = [0.3, 0.26, 0.21]
const DRY: RGB = [0.28, 0.22, 0.12]

function palm(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const height = rng.range(8, 12)
  const bend = height * rng.range(0.05, 0.16)
  const trunk: Vector3[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    trunk.push(new Vector3(bend * t * t, height * t, bend * 0.2 * Math.sin(t * 3)))
  }
  b.tube(
    trunk,
    t => 0.2 * (1 - 0.35 * t) + 0.12 * Math.exp(-t * 18),
    t => scale(PALM_BARK, 0.8 + 0.25 * Math.sin(t * height * 11)),
    10
  )
  const crown = trunk[trunk.length - 1]

  const fronds = rng.int(12, 17)
  const up = new Vector3(0, 1, 0)
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + rng.normal(0, 0.15)
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az))
    const dead = f < 2 && rng.chance(0.5)
    const elevation = dead ? -1.0 : rng.range(0.15, 0.9)
    const length = rng.range(3.2, 4.6)
    const droop = dead ? 0.2 : rng.range(0.7, 1.3)
    const color = dead ? DRY : mix(foliage, scale(foliage, 1.4), rng.float())
    const rib: Vector3[] = []
    for (let k = 0; k <= 12; k++) {
      const s = k / 12
      rib.push(
        crown
          .clone()
          .addScaledVector(dir, length * s * Math.cos(elevation))
          .addScaledVector(up, length * s * Math.sin(elevation) - droop * length * s * s * 0.6)
      )
    }
    // Leaflets on both sides of the rib, hanging down and out.
    for (let k = 1; k < rib.length; k++) {
      const s = k / 12
      const tangent = rib[Math.min(k + 1, 12)].clone().sub(rib[k - 1]).normalize()
      const side = new Vector3().crossVectors(tangent, up).normalize()
      const leafLength = 1.1 * (1 - 0.55 * s) + 0.15
      const width = 0.11
      const tipColor = mix(color, [0.25, 0.22, 0.08], s * 0.5)
      for (const sign of [-1, 1]) {
        const out = side
          .clone()
          .multiplyScalar(sign * 0.75)
          .addScaledVector(up, -0.65)
          .addScaledVector(tangent, 0.35)
          .normalize()
        const base = rib[k]
        const tip = base.clone().addScaledVector(out, leafLength)
        const i0 = b.vertex(base.clone().addScaledVector(tangent, -width), color)
        const i1 = b.vertex(base.clone().addScaledVector(tangent, width), color)
        const i2 = b.vertex(tip.clone().addScaledVector(tangent, width * 0.2), tipColor)
        const i3 = b.vertex(tip.clone().addScaledVector(tangent, -width * 0.2), tipColor)
        b.quad(i0, i1, i2, i3)
      }
    }
    b.tube(rib, t => 0.04 * (1 - t) + 0.01, () => scale(color, 0.8), 4)
  }
  // Coconuts.
  for (let c = 0; c < rng.int(3, 7); c++) {
    const az = rng.range(0, Math.PI * 2)
    b.blob(
      crown.clone().add(new Vector3(Math.cos(az) * 0.3, -0.35 - rng.float() * 0.3, Math.sin(az) * 0.3)),
      new Vector3(0.16, 0.18, 0.16),
      () => [0.22, 0.2, 0.06],
      () => 1,
      3
    )
  }
  return b.build()
}

function grass(rng: Random, foliage: RGB): BufferGeometry {
  const b = new MeshBuilder()
  const blades = rng.int(14, 26)
  const straw: RGB = [0.32, 0.28, 0.14]
  for (let i = 0; i < blades; i++) {
    const az = rng.range(0, Math.PI * 2)
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const side = new Vector3(-out.z, 0, out.x)
    const base = out.clone().multiplyScalar(rng.range(0, 0.2))
    const height = rng.range(0.4, 0.95)
    const bendAmount = rng.range(0.1, 0.5)
    const color = mix(scale(foliage, 1.6), straw, rng.float() * 0.8)
    let prevL = -1
    let prevR = -1
    for (let k = 0; k <= 4; k++) {
      const t = k / 4
      const p = base
        .clone()
        .addScaledVector(out, bendAmount * height * t * t)
        .setY(height * t * (1 - 0.25 * bendAmount * t))
      const w = 0.025 * (1 - t) + 0.002
      const c = mix(scale(color, 0.6), color, t)
      const l = b.vertex(p.clone().addScaledVector(side, -w), c)
      const r = b.vertex(p.clone().addScaledVector(side, w), c)
      if (prevL >= 0) b.quad(prevL, prevR, r, l)
      prevL = l
      prevR = r
    }
  }
  return b.build()
}

interface KindSpec {
  build: Builder
  /** Range of distance inland from the waterline (in beach widths / metres). */
  inland: (beachWidth: number, duneWidth: number) => [number, number]
  maxDistance: number
  count: number
  scale: [number, number]
  /** Grove clumping: higher = patchier. */
  clumping: number
  /** Max tilt (radians) and whether to lean toward the sea. */
  tilt: number
  leanSeaward: boolean
  minSlope: number
  castShadow: boolean
  /** Distinct meshes generated per scene; more means less visible repetition. */
  variants: number
  /** How the plant bends in the wind. */
  bend: Bend
}

const KINDS: Record<VegetationKind, KindSpec> = {
  palm: {
    build: palm,
    inland: (bw, dw) => [bw * 0.55, bw + dw + 150],
    maxDistance: 1500,
    count: 140,
    scale: [0.75, 1.3],
    clumping: 0.5,
    tilt: 0.35,
    leanSeaward: true,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 10, flex: 0.3 }
  },
  'stone-pine': {
    build: stonePine,
    inland: (bw, dw) => [bw + dw * 0.5, 2500],
    maxDistance: 3000,
    count: 260,
    scale: [0.7, 1.3],
    clumping: 0.55,
    tilt: 0.12,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 5,
    bend: { height: 10, flex: 0.08 }
  },
  cypress: {
    build: cypress,
    inland: (bw, dw) => [bw + dw, 2500],
    maxDistance: 3000,
    count: 120,
    scale: [0.8, 1.2],
    clumping: 0.6,
    tilt: 0.03,
    leanSeaward: false,
    minSlope: 0.8,
    castShadow: true,
    variants: 4,
    bend: { height: 13, flex: 0.1 }
  },
  conifer: {
    build: conifer,
    inland: (bw, dw) => [bw + dw * 0.8, 4000],
    maxDistance: 4000,
    count: 1600,
    scale: [0.6, 1.3],
    clumping: 0.52,
    tilt: 0.05,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 5,
    bend: { height: 14, flex: 0.07 }
  },
  bush: {
    build: bush,
    inland: bw => [bw * 0.7, 1200],
    maxDistance: 900,
    count: 700,
    scale: [0.6, 1.8],
    clumping: 0.5,
    tilt: 0.1,
    leanSeaward: false,
    minSlope: 0.7,
    castShadow: true,
    variants: 5,
    bend: { height: 1.5, flex: 0.2 }
  },
  grass: {
    build: grass,
    inland: bw => [bw * 0.6, 3000],
    maxDistance: 160,
    count: 7000,
    scale: [0.7, 1.5],
    clumping: 0.35,
    tilt: 0.15,
    leanSeaward: false,
    minSlope: 0.6,
    castShadow: false,
    variants: 3,
    bend: { height: 0.8, flex: 0.7 }
  },
  broadleaf: {
    build: broadleaf,
    inland: (bw, dw) => [bw + dw * 0.6, 2500],
    maxDistance: 2500,
    count: 220,
    scale: [0.75, 1.35],
    clumping: 0.55,
    tilt: 0.06,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 10, flex: 0.12 }
  },
  olive: {
    build: olive,
    inland: (bw, dw) => [bw + dw * 0.4, 1800],
    maxDistance: 1800,
    count: 220,
    scale: [0.8, 1.3],
    clumping: 0.5,
    tilt: 0.1,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 6, flex: 0.1 }
  },
  birch: {
    build: birch,
    inland: (bw, dw) => [bw + dw * 0.8, 3000],
    maxDistance: 3000,
    count: 400,
    scale: [0.7, 1.2],
    clumping: 0.5,
    tilt: 0.06,
    leanSeaward: false,
    minSlope: 0.75,
    castShadow: true,
    variants: 6,
    bend: { height: 13, flex: 0.18 }
  },
  acacia: {
    build: acacia,
    inland: (bw, dw) => [bw + dw * 0.5, 2500],
    maxDistance: 2500,
    count: 60,
    scale: [0.8, 1.4],
    clumping: 0.45,
    tilt: 0.05,
    leanSeaward: false,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 6, flex: 0.07 }
  },
  pandanus: {
    build: pandanus,
    inland: (bw, dw) => [bw * 0.5, bw + dw + 120],
    maxDistance: 1200,
    count: 120,
    scale: [0.8, 1.3],
    clumping: 0.5,
    tilt: 0.25,
    leanSeaward: true,
    minSlope: 0.8,
    castShadow: true,
    variants: 5,
    bend: { height: 6, flex: 0.2 }
  }
}

export function createVegetation(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast, biome } = params
  if (coast.type !== 'beach') return []
  const rng = ctx.rng('vegetation')

  // Which plants grow here today: each of the biome's kinds, most of the time.
  // The biome's signature plant always grows; the others most of the time.
  // Framed and overlook shots are about the land, so they get everything.
  const allKinds = coast.composition === 'framed' || coast.composition === 'overlook'
  const kinds = biome.vegetation.filter(
    ([, weight], i) => rng.chance(Math.min(0.95, 0.35 + weight * 0.12)) || i === 0 || allKinds
  )
  const lushness = rng.range(0.4, 1.2)
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    side: DoubleSide
  })
  // No sun glints: a low sun behind the trees catches the many edge-on
  // leaves at grazing angles, where the specular lobe spikes, and the crowns
  // glitter. Real leaves scatter that light through their blades instead.
  // Skylight reflections (indirect specular) stay.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);'
    )
  }

  const order: VegetationKind[] = [
    'palm',
    'stone-pine',
    'olive',
    'broadleaf',
    'birch',
    'acacia',
    'pandanus',
    'conifer',
    'cypress',
    'bush'
  ]
  const heroKind =
    coast.composition === 'framed' ? order.find(k => kinds.some(([kind]) => kind === k)) : undefined

  const meshes: InstancedMesh[] = []
  const m = new Matrix4()
  const q = new Quaternion()
  const p = new Vector3()
  const s = new Vector3()
  const seaward = new Vector3(Math.sin((coast.seawardAzimuthDeg * Math.PI) / 180), 0, -Math.cos((coast.seawardAzimuthDeg * Math.PI) / 180))

  for (const [kind, weight] of kinds) {
    const spec = KINDS[kind]
    const target = Math.round(spec.count * lushness * Math.min(1.5, weight / 3))
    const [uMin, uMax] = spec.inland(coast.beachWidth, coast.duneWidth)
    const seed = rng.int(0, 1e6)
    const placed: Matrix4[] = []
    const colors: Color[] = []

    // Framed shots: a few big plants near the edges of the frame, close to
    // the camera, so the sea is seen past them.
    if (kind === heroKind) {
      const camera = ctx.camera
      const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
      const halfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
      const heroes = rng.int(2, 4)
      for (let tries = 0; tries < 200 && placed.length < heroes; tries++) {
        const edge = (rng.chance(0.5) ? 1 : -1) * halfFov * rng.range(0.55, 1.05)
        const dir = forward.clone().applyAxisAngle(new Vector3(0, 1, 0), edge)
        const dist = rng.range(9, 30)
        const x = camera.position.x + dir.x * dist
        const z = camera.position.z + dir.z * dist
        const y = ctx.ground(x, z)
        if (y < coast.runup + 0.6) continue
        const size = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * rng.range(0.4, 0.9)
        const yaw = rng.range(0, Math.PI * 2)
        q.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
        placed.push(new Matrix4().compose(new Vector3(x, y - 0.1, z), q, new Vector3().setScalar(size)))
        colors.push(new Color(1, 1, 1))
      }
    }

    for (let tries = 0; tries < target * 12 && placed.length < target; tries++) {
      // Concentrate samples near the camera, where plants are big on screen.
      const a = (rng.float() * 2 - 1) * spec.maxDistance * rng.float() ** 0.6
      const u = uMin + (uMax - uMin) * rng.float() ** 1.4
      const [x, z] = shoreToWorld(coast, -u, a)
      if (ctx.distance(x, z) > spec.maxDistance || ctx.distance(x, z) < 3) continue
      // Groves and clearings.
      const forest = noise3(x / 450, 5, z / 450, seed)
      const density =
        forest * 0.45 + noise3(x / 70, 0, z / 70, seed) * 0.4 + noise3(x / 15, 3, z / 15, seed) * 0.15
      if (density < spec.clumping) continue
      const y = ctx.ground(x, z)
      if (y < coast.runup + 0.6) continue
      const n = terrainNormal(coast, x, z, 1)
      if (n[1] < spec.minSlope) continue
      const size = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * rng.float()
      if (!ctx.visible(x, y + 6 * size, z, 8 * size)) continue
      // Tall plants close to the camera only at the sides of the frame, so
      // they frame the sea instead of blocking it.
      // Bushes likewise, at a closer range, and never right at our feet.
      const near = kind === 'grass' ? 0 : kind === 'bush' ? 12 : 25
      if (kind === 'bush' && ctx.distance(x, z) < 6) continue
      if (ctx.distance(x, z) < near) {
        const ndc = new Vector3(x, y + 3 * size, z).project(ctx.camera)
        if (Math.abs(ndc.x) < 0.6) continue
      }

      const tiltAxis = spec.leanSeaward
        ? new Vector3(seaward.z, 0, -seaward.x)
        : new Vector3(rng.normal(), 0, rng.normal()).normalize()
      const tilt = (spec.leanSeaward ? rng.range(0.3, 1) : rng.normal(0, 0.5)) * spec.tilt
      // Palm geometry bends toward +X; turn that toward the sea.
      const yaw = spec.leanSeaward
        ? Math.atan2(-seaward.z, seaward.x) + rng.normal(0, 0.4)
        : rng.range(0, Math.PI * 2)
      q.setFromAxisAngle(tiltAxis, tilt).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw))
      p.set(x, y - 0.1 * size, z)
      // Slightly different proportions per instance, so copies of the same
      // variant don't read as clones.
      const girth = rng.range(0.85, 1.15)
      s.set(size * girth, size * rng.range(0.88, 1.12), size * girth)
      placed.push(new Matrix4().compose(p, q, s))
      const tint = 0.8 + 0.4 * rng.float()
      colors.push(new Color(tint, tint * (0.9 + 0.2 * rng.float()), tint))
    }
    if (placed.length === 0) continue

    const bent = windMaterials(material, params, spec.bend)

    for (let v = 0; v < spec.variants; v++) {
      const indices = placed.map((_, i) => i).filter(i => i % spec.variants === v)
      if (indices.length === 0) continue
      const mesh = new InstancedMesh(spec.build(rng, biome.foliage), bent.material, indices.length)
      mesh.customDepthMaterial = bent.depth
      indices.forEach((i, j) => {
        mesh.setMatrixAt(j, m.copy(placed[i]))
        mesh.setColorAt(j, colors[i])
      })
      mesh.castShadow = spec.castShadow
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      meshes.push(mesh)
    }
  }
  return meshes
}
