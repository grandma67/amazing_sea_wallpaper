import {
  BufferAttribute,
  CatmullRomCurve3,
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

import { beachLines, isStony } from '../beach'
import type { RGB } from '../biome'
import type { PinnipedKind } from '../params'
import type { Random } from '../random'
import { shoreToWorld, terrainNormal } from '../terrain'
import { MeshBuilder } from './builder'
import { stormy, type PropContext } from './context'
import { fbm3 } from './noise'
import { rockMaterial, type RockGrowth } from './rocks'
import { snowLook } from './snowCap'
import { unitSphere } from './sphere'
import { eye, mouthLine, nostril, onTube, whiskers, type WhiskerLook } from './faces'
import { skinCoords, skinMaterial, skinsOn, type SkinId } from './skins'

// Seals and sea lions hauled out on the rocks (see PinnipedKind):
//
// - True seals (harbour, grey, elephant seals) have no ear flaps and can't
//   turn their hind flippers forward: on land they lie on their bellies and
//   hump along. Resting, they often hold head and tail up in a "banana".
// - Eared seals (sea lions, fur seals) walk on all four flippers and sit
//   propped up on their long fore flippers, chest high and head up.
//
// They crowd the low, flat tops of skerries and the lower slopes of seabird
// islands, or lie in a herd on the beach between the waterline and the
// storm line; a few heads bob in the water nearby, and wet ones are darker
// and glossier than dry ones. In a storm they go into the water (harbour
// seals leave the haul-out for the calm under the surface in wind and rain).

interface Look {
  /** Back and belly colours (linear albedo), dry. */
  back: RGB
  belly: RGB
  /** Dark spots and blotches (harbour seals), 0..1. */
  spots: number
  /** Body length range (m). */
  length: [number, number]
  /** Eared seals sit up; true seals lie down. */
  eared: boolean
  /** Bulk: radius / length. */
  girth: number
  /** Animals on one haul-out. */
  count: [number, number]
}

const LOOKS: Record<PinnipedKind, Look> = {
  seal: { back: [0.08, 0.08, 0.075], belly: [0.24, 0.23, 0.2], spots: 0.7, length: [1.4, 2.3], eared: false, girth: 0.16, count: [8, 30] },
  'sea-lion': { back: [0.22, 0.15, 0.08], belly: [0.3, 0.21, 0.12], spots: 0, length: [1.6, 2.4], eared: true, girth: 0.13, count: [15, 60] },
  'fur-seal': { back: [0.07, 0.055, 0.045], belly: [0.13, 0.1, 0.07], spots: 0, length: [1.2, 1.8], eared: true, girth: 0.13, count: [40, 140] },
  'elephant-seal': { back: [0.16, 0.13, 0.1], belly: [0.22, 0.19, 0.15], spots: 0.25, length: [2.8, 4.5], eared: false, girth: 0.19, count: [8, 30] }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

/** Smooth piecewise-linear profile through (t, value) knots. */
function profile(knots: [number, number][]): (t: number) => number {
  return t => {
    for (let i = 0; i < knots.length - 1; i++) {
      const [t0, v0] = knots[i]
      const [t1, v1] = knots[i + 1]
      if (t <= t1) {
        const u = Math.max(0, (t - t0) / (t1 - t0))
        return v0 + (v1 - v0) * (u * u * (3 - 2 * u))
      }
    }
    return knots[knots.length - 1][1]
  }
}

type Pose = 'lying' | 'banana' | 'sitting'

/** Whiskers by kind (sizes in body lengths): true seals' are flattened and
 * beaded (wavy), eared seals' smooth; fur seals' the longest and palest,
 * elephant seals' short and dark (Hanke et al. 2010, PMC3317988; Ginter
 * et al. 2012). */
const WHISKERS: Record<PinnipedKind, Omit<WhiskerLook, 'length' | 'r'> & { length: number }> = {
  seal: { count: 12, length: 0.065, color: [0.6, 0.57, 0.5], wavy: true, droop: 0.15 },
  'sea-lion': { count: 12, length: 0.1, color: [0.68, 0.65, 0.56], droop: 0.25 },
  'fur-seal': { count: 12, length: 0.14, color: [0.75, 0.72, 0.62], droop: 0.3 },
  'elephant-seal': { count: 9, length: 0.045, color: [0.12, 0.1, 0.08], wavy: true, droop: 0.4 }
}

/** A pinniped's face on its head tube (`path` nose first, `radius` the
 * tube's): big dark eyes high on the sides, nostril slits on the muzzle
 * tip, the mouth line each side, whiskers from the muzzle pads. `eyeT`
 * places the eyes along the tube (the snout's length differs). */
function face(b: MeshBuilder, path: Vector3[], radius: (t: number, angle: number) => number, kind: PinnipedKind, L: number, back: RGB, eyeT: number, eyeR: number, muzzleT: number): void {
  const lid: RGB = [back[0] * 0.55, back[1] * 0.55, back[2] * 0.55]
  for (const side of [-1, 1]) {
    const e = onTube(path, radius, eyeT, side * 0.95)
    eye(b, e.at, e.out, eyeR, { iris: [0.025, 0.018, 0.014], lid, irisSize: 0.95 })
    const n = onTube(path, radius, 0.006, side * 0.42)
    const up = onTube(path, radius, 0.006, 0).out
    nostril(b, n.at, n.out, 0.007 * L, 0.35, up)
    mouthLine(b, [0.004, 0.015, 0.028, 0.04].map(t => onTube(path, radius, t * (muzzleT / 0.03), side * (2.05 + t * 2)).at), 0.0016 * L)
  }
  const mid = onTube(path, radius, muzzleT, 0)
  const centre = path[Math.round(muzzleT * (path.length - 1))].clone().addScaledVector(mid.out, -radius(muzzleT, Math.PI / 2) * 0.25)
  const forward = path[0].clone().sub(path[Math.min(path.length - 1, 3)])
  const w = WHISKERS[kind]
  whiskers(b, centre, forward, mid.out, radius(muzzleT, Math.PI / 2) * 0.85, { ...w, length: w.length * L, r: 0.0012 * (L / 1.7) })
}

/** Each kind's photo skin (props/skins.ts): sea lions share the fur seal's
 * coat (both eared seals' short fur). */
const SKIN: Record<PinnipedKind, SkinId> = { seal: 'harbour-seal', 'sea-lion': 'eared-seal', 'fur-seal': 'eared-seal', 'elephant-seal': 'elephant-seal' }

/**
 * One animal, nose toward +x, lying on y = 0. `wet` darkens it. The spine
 * runs nose → tail; the body is lofted round it with a head, a thicker
 * neck (bulls), a fat middle and a tapering tail.
 */
export function pinniped(rng: Random, kind: PinnipedKind, pose: Pose, wet: number, skin = false): BufferGeometry {
  const look = LOOKS[kind]
  const b = new MeshBuilder()
  const L = rng.range(...look.length)
  const g = look.girth * L
  const bull = kind === 'elephant-seal' && L > 3.8
  const radius = profile(
    look.eared
      ? [[0, 0.15], [0.05, 0.4], [0.1, 0.5], [0.17, 0.42], [0.3, 0.75], [0.45, 1], [0.7, 0.75], [0.9, 0.3], [1, 0.15]]
      : [[0, 0.2], [0.06, 0.5], [0.12, 0.62], [0.2, bull ? 0.9 : 0.66], [0.45, 1], [0.7, 0.8], [0.9, 0.32], [1, 0.18]]
  )
  // Spine control points, nose first.
  const points: Vector3[] =
    pose === 'sitting'
      ? [
          new Vector3(0.4 * L, 0.44 * L, 0),
          new Vector3(0.33 * L, 0.47 * L, 0),
          new Vector3(0.24 * L, 0.42 * L, 0),
          new Vector3(0.13 * L, 0.3 * L, 0),
          new Vector3(0, 0.17 * L, 0),
          new Vector3(-0.15 * L, g * 0.95, 0),
          new Vector3(-0.35 * L, g * 0.55, 0),
          new Vector3(-0.5 * L, g * 0.2, 0)
        ]
      : Array.from({ length: 9 }, (_, i) => {
          const t = i / 8
          // Lying on the belly; in a banana, head and tail curl up.
          const lift = pose === 'banana' ? 0.25 * L * (Math.max(0, 1 - t / 0.35) ** 2 + Math.max(0, (t - 0.7) / 0.3) ** 2) : 0
          const headUp = look.eared ? 0.12 * L * Math.max(0, 1 - t / 0.3) : 0
          return new Vector3((0.5 - t) * L, g * radius(t) * 0.92 + lift + headUp, 0)
        })
  const spine = new CatmullRomCurve3(points).getSpacedPoints(36)
  const skinned = skin
  const seed = rng.int(0, 100_000)
  const back = mix(look.back, [look.back[0] * 0.45, look.back[1] * 0.45, look.back[2] * 0.45], wet)
  const belly = mix(look.belly, [look.belly[0] * 0.5, look.belly[1] * 0.5, look.belly[2] * 0.5], wet)
  const bodyRings = b.tube(
    spine,
    t => g * radius(t),
    (t, angle) => {
      const up = (1 + Math.cos(angle)) / 2
      let c = mix(belly, back, Math.min(1, Math.max(0, (up - 0.25) * 1.8)))
      const p = spine[Math.round(t * (spine.length - 1))]
      // Blotches and spots (with a photo skin, the photo's), and a pale muzzle.
      if (look.spots > 0 && !skinned && fbm3(p.x * 6, p.y * 6 + angle, Math.sin(angle) * 2, seed) > 1 - look.spots * 0.5) c = mix(c, [0.02, 0.02, 0.02], 0.6)
      if (t < 0.05) c = mix(c, belly, 0.4)
      return c
    },
    12,
    skinned ? skinCoords(SKIN[kind], L) : undefined
  )
  // Flippers: thin fans off the body.
  const fin = (points: Vector3[], color: RGB): void => {
    const ids = points.map(p => b.vertex(p, color))
    for (let i = 1; i < ids.length - 1; i++) b.triangle(ids[0], ids[i], ids[i + 1])
    for (let i = 1; i < ids.length - 1; i++) b.triangle(ids[0], ids[i + 1], ids[i])
  }
  const at = (t: number): Vector3 => spine[Math.round(t * (spine.length - 1))]
  for (const side of [-1, 1]) {
    const shoulder = at(look.eared ? 0.28 : 0.3)
    if (look.eared && pose === 'sitting') {
      // Long fore flippers planted on the rock like arms, palms forward.
      const top = shoulder.clone().add(new Vector3(0, -g * 0.3, side * g * 0.75))
      const foot = new Vector3(shoulder.x + 0.1 * L, 0.01, side * g * 0.95)
      fin([top, top.clone().add(new Vector3(-0.08 * L, 0, 0)), foot.clone().add(new Vector3(-0.02 * L, 0, 0)), foot.clone().add(new Vector3(0.14 * L, 0, side * 0.03 * L)), foot.clone().add(new Vector3(0.06 * L, 0.02 * L, 0))], back)
    } else {
      const reach = look.eared ? 0.28 * L : 0.14 * L
      // Rooted inside the flank (at 0.7 g the root stood outside the body).
      fin([shoulder.clone().add(new Vector3(0, -g * 0.45, side * g * 0.45)), shoulder.clone().add(new Vector3(-reach * 0.6, -g * 0.8, side * (g + reach * 0.6))), shoulder.clone().add(new Vector3(-reach * 0.3, -g * 0.8, side * (g + reach * 0.3)))], back)
    }
    // Hind flippers: trailing behind (true seals), or turned forward under
    // the body (eared seals sitting up).
    const tail = at(1)
    if (look.eared && pose === 'sitting') {
      // From the end of the body (where an eared seal's pelvis is), turned
      // forward and lying flat on the ground: a webbed fan, its toes
      // forward and out (it was one triangle hinged at the tail tip that
      // hung in the air, then a fan from the hip, too far forward).
      const root = tail.clone().add(new Vector3(0.01 * L, -tail.y * 0.6, side * g * 0.12))
      const toe = (fwd: number, out: number): Vector3 => new Vector3(root.x + fwd * L, 0.008 * L, side * (Math.abs(root.z) + out * L))
      fin([root, toe(0.06, 0.02), toe(0.17, 0.05), toe(0.2, 0.09), toe(0.15, 0.13), toe(0.04, 0.07)], back)
    } else {
      // Webbed fans, held together and a little spread.
      const lift = pose === 'banana' ? 0.08 * L : 0
      fin([tail, tail.clone().add(new Vector3(-0.1 * L, lift * 0.6, side * 0.07 * L)), tail.clone().add(new Vector3(-0.19 * L, lift, side * 0.1 * L)), tail.clone().add(new Vector3(-0.2 * L, lift, side * 0.03 * L)), tail.clone().add(new Vector3(-0.12 * L, lift * 0.6, side * 0.005 * L))], back)
    }
  }
  // An elephant seal bull's trunk-like nose hanging over the mouth.
  if (bull) b.blob(at(0).clone().add(new Vector3(0.02 * L, -0.02 * L, 0)), new Vector3(0.06 * L, 0.035 * L, 0.035 * L), () => back, () => 1, 4)
  // Close the nose: the tube's open end showed the hollow inside.
  b.cap(bodyRings[0], spine[0].clone().sub(spine[1]), [0.03, 0.025, 0.02])
  face(b, spine, t => g * radius(t), kind, L, back, 0.055, (look.eared ? 0.012 : 0.011) * L, 0.02)
  return b.build()
}

/**
 * A head and neck above the water, nose toward +x, waterline at y = 0: a
 * seal watching (snout level) or "bottling" (snout tipped up), `pitch`
 * radians. One lofted tube, nose first: a tapered muzzle, a sloping
 * forehead into a round crown, and a thick neck as wide as the head going
 * down into the water; seals have no visible neck "waist". Sizes from the
 * body length (head ~ 0.12 L long, neck ~ 0.1 L across).
 */
export function swimmingHead(rng: Random, kind: PinnipedKind, pitch: number, skin = false): BufferGeometry {
  const look = LOOKS[kind]
  const b = new MeshBuilder()
  const L = rng.range(...look.length)
  const bull = kind === 'elephant-seal' && L > 3.8
  // Spine nose → under water (units of L). Little neck shows: the waterline
  // is at the throat, the skull a bulb wider than the neck behind it. The
  // head tips up about the skull's centre.
  const skull = new Vector3(0.0, 0.06 * L, 0)
  const head = [[0.085, 0.056], [0.065, 0.058], [0.04, 0.064], [0.01, 0.066], [-0.02, 0.052]].map(([x, y]) =>
    new Vector3(x * L, y * L, 0).sub(skull).applyAxisAngle(new Vector3(0, 0, 1), pitch).add(skull)
  )
  const neck = [new Vector3(-0.035 * L, 0.01 * L, 0), new Vector3(-0.04 * L, -0.07 * L, 0)]
  const spine = new CatmullRomCurve3([...head, ...neck]).getSpacedPoints(20)
  // A broad, blunt muzzle (a thin one reads as a beak or hook).
  const radius = profile([[0, 0.016], [0.03, 0.025], [0.12, 0.031], [0.3, 0.041], [0.48, 0.052], [0.62, 0.052], [0.78, 0.046], [1, 0.05]])
  const wet = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
  const back = wet(look.back, 0.45)
  const belly = wet(look.belly, 0.6)
  const rings = b.tube(
    spine,
    // A little wider than tall: a broad skull and muzzle.
    (t, angle) => radius(t) * L * (1 + 0.12 * Math.sin(angle) ** 2),
    // angle 0 is the top of the head and back of the neck.
    (_t, angle) => mix(belly, back, Math.min(1, Math.max(0, (Math.cos(angle) + 0.3) * 0.9))),
    12,
    skin ? skinCoords(SKIN[kind], L) : undefined
  )
  b.cap(rings[0], new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 0, 1), pitch), back)
  // Big dark eyes high on the sides of the head behind the muzzle,
  // nostrils, mouth and whiskers.
  const at = (t: number): Vector3 => spine[Math.round(t * (spine.length - 1))]
  face(b, spine, (t, angle) => radius(t) * L * (1 + 0.12 * Math.sin(angle) ** 2), kind, L, back, 0.27, radius(0.27) * L * 0.2, 0.1)
  // An elephant seal bull's trunk hanging over the mouth.
  if (bull) b.blob(at(0.04).clone().add(new Vector3(0, -0.02 * L, 0)), new Vector3(0.045 * L, 0.03 * L, 0.028 * L), () => back, () => 1, 4)
  return b.build()
}

/** A low, rounded skerry of rock: a noisy dome, flat underneath, its top
 * smoothed by the sea into slabs and humps seals can lie on. Vertex colours
 * carry the rock shading like rockGeometry's. */
function skerryGeometry(rng: Random): BufferGeometry {
  const geometry = unitSphere(24)
  const position = geometry.attributes.position as BufferAttribute
  const seed = rng.int(0, 100_000)
  const colors = new Float32Array(position.count * 3)
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const lumps = 0.75 + 0.5 * fbm3(v.x * 1.5, v.y * 1.5, v.z * 1.5, seed)
    const cracks = 0.08 * (fbm3(v.x * 6, v.y * 6, v.z * 6, seed + 1) - 0.5)
    v.multiplyScalar(lumps + cracks)
    // Flat underneath; the top terraced into rough steps.
    v.y = Math.max(v.y, -0.2)
    if (v.y > 0) v.y = v.y * 0.85 + 0.06 * Math.round(v.y / 0.12) * 0.15
    position.setXYZ(i, v.x, v.y, v.z)
    const c = Math.max(0.3, Math.min(1.2, 0.75 + 4 * cracks + 0.25 * fbm3(v.x * 9, v.y * 9, v.z * 9, seed + 2)))
    colors.set([c, c, c], i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Weed and algae low down, crusty lichen on top. */
const SKERRY_GROWTH: RockGrowth = { moss: 0, mossColor: [0, 0, 0], lichen: 0.4, lichenColor: [0.5, 0.48, 0.4], algae: 0.9, algaeColor: [0.07, 0.07, 0.025] }

/** A skerry offshore where they can haul out, standing a few metres out of
 * the water. */
function skerry(ctx: PropContext, rng: Random): Mesh | null {
  const width = rng.range(18, 45)
  const lens = Math.min(2.5, Math.max(0.7, ctx.params.camera.focalLengthMm / 35))
  let at: Vector3 | null = null
  for (let i = 0; i < 300 && at == null; i++) {
    const p = ctx.seaPoint(rng, [-0.7, 0.9], 40 * lens, 200 * lens * (1 + Math.floor(i / 100)), 2)
    if (p == null) continue
    const clear = [0, 1, 2, 3, 4, 5].every(k => {
      const a = (k / 6) * Math.PI * 2
      return ctx.ground(p.x + Math.cos(a) * width * 0.7, p.z + Math.sin(a) * width * 0.7) < -1.5
    })
    if (clear) at = p
  }
  if (at == null) return null
  const mesh = new Mesh(skerryGeometry(rng), rockMaterial(rng.pick(ctx.params.biome.rockColors), 0.6, SKERRY_GROWTH, 0, snowLook(ctx.params)))
  const height = rng.range(2.5, 5)
  mesh.scale.set(width / 2, height, (width / 2) * rng.range(0.5, 0.9))
  mesh.position.copy(at).setY(-height * 0.25)
  mesh.rotation.y = rng.range(0, Math.PI * 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.updateMatrixWorld()
  return mesh
}

/** A herd hauled out on the beach: packed close in a patch along the shore,
 * from just above the waterline up to the storm line; null if no beach in
 * view has room. On a stony beach: above the swash (it surges hard up the
 * steep face), up to the storm ridge crest, not over it. */
function onBeach(ctx: PropContext, rng: Random, count: number, room: number): { spots: Vector3[]; centre: Vector3; radius: number } | null {
  const { coast } = ctx.params
  const { stormLine } = beachLines(coast)
  const stony = isStony(coast.material)
  const low = coast.runup * (stony ? 1 : 0.5)
  const top = stony ? stormLine : stormLine * 1.3
  for (let i = 0; i < 300; i++) {
    const a0 = rng.normal(0, 120 * (1 + i / 100))
    const u0 = rng.range(1, stormLine)
    const [x0, z0] = shoreToWorld(coast, -u0, a0)
    const y0 = ctx.ground(x0, z0)
    const d = ctx.distance(x0, z0)
    if (y0 < low || d < 30 || d > 300 || !ctx.inFrame(x0, y0, z0)) continue
    const length = Math.sqrt(count) * room * rng.range(2.5, 4)
    const spots: Vector3[] = []
    for (let k = 0; k < count * 20 && spots.length < count; k++) {
      const a = a0 + rng.normal(0, length / 3)
      const u = u0 + rng.normal(0, stormLine / 3)
      if (u < 0 || u > top) continue
      const [x, z] = shoreToWorld(coast, -u, a)
      const y = ctx.ground(x, z)
      if (y < low || ctx.distance(x, z) < 5) continue
      const p = new Vector3(x, y, z)
      if (spots.some(s => s.distanceToSquared(p) < room * room)) continue
      spots.push(p)
    }
    if (spots.length < Math.min(4, count)) continue
    return { spots, centre: new Vector3(x0, 0, z0), radius: length / 2 }
  }
  return null
}

/** A herd hauled out on a rocky shore: on fairly level rock just above the
 * swash, within ~40 m of today's water (the platform's seaward part, the
 * foot of the boulders), not up on a cliff; null if none in view. */
function onRockShore(ctx: PropContext, rng: Random, count: number, room: number): { spots: Vector3[]; centre: Vector3; radius: number } | null {
  const { coast } = ctx.params
  const low = coast.runup + 0.2
  const high = coast.runup + 4
  const dry = (x: number, z: number, y: number): boolean => y >= low && y <= high && terrainNormal(coast, x, z, room)[1] > 0.8
  for (let i = 0; i < 300; i++) {
    const a0 = rng.normal(0, 120 * (1 + i / 100))
    const s0 = coast.waterline - rng.range(3, 40)
    const [x0, z0] = shoreToWorld(coast, s0, a0)
    const y0 = ctx.ground(x0, z0)
    const d = ctx.distance(x0, z0)
    if (!dry(x0, z0, y0) || d < 25 || d > 300 || !ctx.inFrame(x0, y0, z0)) continue
    const length = Math.sqrt(count) * room * rng.range(2.5, 4)
    const spots: Vector3[] = []
    for (let k = 0; k < count * 20 && spots.length < count; k++) {
      const [x, z] = shoreToWorld(coast, s0 + rng.normal(0, 6), a0 + rng.normal(0, length / 3))
      const y = ctx.ground(x, z)
      if (!dry(x, z, y)) continue
      const p = new Vector3(x, y, z)
      if (spots.some(s => s.distanceToSquared(p) < room * room)) continue
      spots.push(p)
    }
    if (spots.length < Math.min(4, count)) continue
    return { spots, centre: new Vector3(x0, 0, z0), radius: length / 2 }
  }
  return null
}

/**
 * The day's seals or sea lions. On the beach if the day says so and there is
 * room in view; otherwise on a rock: `island` is the seabird colony's island
 * or headland if there is one, and they share its lower slopes, else they
 * get a skerry of their own.
 */
export function createPinnipeds(ctx: PropContext, island: Mesh | null): Object3D[] {
  const pinnipeds = ctx.params.pinnipeds
  if (pinnipeds == null) return []
  const { kind } = pinnipeds
  const rng = ctx.rng('pinnipeds')
  const look = LOOKS[kind]
  const objects: Object3D[] = []
  const count = rng.int(...look.count)
  const room = look.length[1] * 0.45

  /** Haul-out spots on a rock: gentle, dry slopes just above the waterline
   * (on a high island, only its lower ledges). */
  const haulOut = (rock: Mesh, maxHeight: number): Vector3[] => {
    const position = rock.geometry.attributes.position as BufferAttribute
    const normal = rock.geometry.attributes.normal as BufferAttribute
    const spots: Vector3[] = []
    const p = new Vector3()
    const n = new Vector3()
    for (let i = 0; i < 8000 && spots.length < count; i++) {
      const v = rng.int(0, position.count - 1)
      n.fromBufferAttribute(normal, v).transformDirection(rock.matrixWorld)
      p.fromBufferAttribute(position, v).applyMatrix4(rock.matrixWorld)
      if (n.y < 0.65 || p.y < 0.5 || p.y > maxHeight) continue
      // They lie close, but not inside each other.
      if (spots.some(s => s.distanceToSquared(p) < room * room)) continue
      spots.push(p.clone())
    }
    return spots
  }

  // The beach; or the seabird island if it has room low down (sheer gannet
  // cliffs may not), else a skerry of their own.
  // On a rocky shore, its own rock near the water.
  const beach =
    pinnipeds.site === 'beach'
      ? onBeach(ctx, ctx.rng('pinnipeds/beach'), count, room)
      : ctx.params.coast.rock != null
        ? onRockShore(ctx, ctx.rng('pinnipeds/rock-shore'), count, room)
        : null
  let spots: Vector3[]
  let centre: Vector3
  let radius: number
  if (beach != null) {
    ;({ spots, centre, radius } = beach)
  } else {
    let rock = island
    spots = rock != null ? haulOut(rock, Math.max(12, rock.position.y + 12)) : []
    if (rock == null || spots.length < 4) {
      rock = skerry(ctx, rng)
      if (rock == null) return []
      objects.push(rock)
      spots = haulOut(rock, Infinity)
    }
    centre = rock.position
    radius = Math.max(rock.scale.x, rock.scale.z)
  }

  // A few pose variants per species, instanced. Most rest; eared seals
  // often sit up; true seals curl into bananas.
  const poses: [Pose, number][] = look.eared ? [['lying', 1], ['lying', 1], ['sitting', 1.5]] : [['lying', 1], ['lying', 1], ['banana', 1]]
  // Coats from photos (props/skins.ts), unless switched off.
  const skinned = skinsOn(ctx.params.overrides)
  const variants = poses.map(([pose], k) => pinniped(rng, kind, pose, k === 1 ? 0.8 : rng.range(0, 0.3), skinned))
  const placed: Matrix4[][] = variants.map(() => [])
  // In wind and rain they leave the haul-out for the calm under the
  // surface: only heads show, more of them.
  const storm = stormy(ctx.params)
  if (storm) spots = []
  // Lying along the slope of a steep stony beach or ridge, not level.
  const tilt = beach != null && (isStony(ctx.params.coast.material) || ctx.params.coast.rock != null)
  const up = new Vector3(0, 1, 0)
  for (const spot of spots) {
    const k = rng.weighted(poses.map(([, w], i) => [i, w] as const))
    const q = new Quaternion().setFromEuler(new Euler(0, rng.range(0, Math.PI * 2), 0))
    if (tilt) q.premultiply(new Quaternion().setFromUnitVectors(up, new Vector3(...terrainNormal(ctx.params.coast, spot.x, spot.z, room))))
    // Sink a little into the rock so bellies rest on it.
    placed[k].push(new Matrix4().compose(spot.clone().setY(spot.y - 0.05), q, new Vector3().setScalar(rng.range(0.85, 1.1))))
  }
  // Dry fur is matte; the wet ones are darkened in their vertex colours.
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  if (skinned) skinMaterial(material)
  variants.forEach((geometry, k) => {
    if (placed[k].length === 0) return
    const herd = new InstancedMesh(geometry, material, placed[k].length)
    placed[k].forEach((m, i) => herd.setMatrixAt(i, m))
    herd.castShadow = true
    herd.receiveShadow = true
    herd.frustumCulled = false
    objects.push(herd)
  })

  // Heads bobbing in the water round the rock or off the beach.
  // Watching (snout level) and bottling (snout up); wet fur is glossy.
  const headPoses = [swimmingHead(rng, kind, rng.range(-0.05, 0.15), skinned), swimmingHead(rng, kind, rng.range(0.55, 0.8), skinned)]
  const heads: Matrix4[][] = [[], []]
  for (let i = 0, n = storm ? rng.int(8, 16) : rng.int(2, 8), count = 0; i < 80 && count < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    // In a storm the whole herd is out in the water, spread further off.
    const r = radius * rng.range(1.2, 2.5) + (storm ? rng.range(0, 100) : 0)
    const x = centre.x + Math.cos(a) * r
    const z = centre.z + Math.sin(a) * r
    if (ctx.ground(x, z) > (storm ? -0.8 : -1.5) || ctx.params.seaIce != null) continue
    // Facing any way, head cocked a little.
    const q = new Quaternion().setFromEuler(new Euler(rng.range(-0.12, 0.12), rng.range(0, Math.PI * 2), 0, 'YXZ'))
    heads[rng.int(0, 1)].push(new Matrix4().compose(new Vector3(x, ctx.seaLevel(x, z) - rng.range(0, 0.1), z), q, new Vector3().setScalar(rng.range(0.9, 1.1))))
    count++
  }
  const glossy = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })
  if (skinned) skinMaterial(glossy)
  headPoses.forEach((geometry, k) => {
    if (heads[k].length === 0) return
    const bobbing = new InstancedMesh(geometry, glossy, heads[k].length)
    heads[k].forEach((m, i) => bobbing.setMatrixAt(i, m))
    bobbing.castShadow = true
    bobbing.receiveShadow = true
    bobbing.frustumCulled = false
    objects.push(bobbing)
  })
  return objects
}
