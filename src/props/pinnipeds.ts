import {
  BufferAttribute,
  CatmullRomCurve3,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D
} from 'three'

import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

import type { RGB } from '../biome'
import type { PinnipedKind } from '../params'
import type { Random } from '../random'
import { shoreToWorld } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { beachLines } from './debris'
import { fbm3 } from './noise'
import { rockMaterial, type RockGrowth } from './rocks'

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
// and glossier than dry ones.

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

/**
 * One animal, nose toward +x, lying on y = 0. `wet` darkens it. The spine
 * runs nose → tail; the body is lofted round it with a head, a thicker
 * neck (bulls), a fat middle and a tapering tail.
 */
function pinniped(rng: Random, kind: PinnipedKind, pose: Pose, wet: number): BufferGeometry {
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
  const seed = rng.int(0, 100_000)
  const back = mix(look.back, [look.back[0] * 0.45, look.back[1] * 0.45, look.back[2] * 0.45], wet)
  const belly = mix(look.belly, [look.belly[0] * 0.5, look.belly[1] * 0.5, look.belly[2] * 0.5], wet)
  b.tube(
    spine,
    t => g * radius(t),
    (t, angle) => {
      const up = (1 + Math.cos(angle)) / 2
      let c = mix(belly, back, Math.min(1, Math.max(0, (up - 0.25) * 1.8)))
      const p = spine[Math.round(t * (spine.length - 1))]
      // Blotches and spots, and a pale muzzle.
      if (look.spots > 0 && fbm3(p.x * 6, p.y * 6 + angle, Math.sin(angle) * 2, seed) > 1 - look.spots * 0.5) c = mix(c, [0.02, 0.02, 0.02], 0.6)
      if (t < 0.05) c = mix(c, belly, 0.4)
      return c
    },
    12
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
      fin([shoulder.clone().add(new Vector3(0, -g * 0.5, side * g * 0.7)), shoulder.clone().add(new Vector3(-reach * 0.6, -g * 0.8, side * (g + reach * 0.6))), shoulder.clone().add(new Vector3(-reach * 0.3, -g * 0.8, side * (g + reach * 0.3)))], back)
    }
    // Hind flippers: trailing behind (true seals), or turned forward under
    // the body (eared seals sitting up).
    const tail = at(1)
    if (look.eared && pose === 'sitting') {
      fin([tail.clone().setZ(side * g * 0.3), tail.clone().add(new Vector3(0.18 * L, -tail.y + 0.01, side * g * 0.9)), tail.clone().add(new Vector3(0.08 * L, -tail.y + 0.01, side * g * 1.1))], back)
    } else {
      // Webbed fans, held together and a little spread.
      const lift = pose === 'banana' ? 0.08 * L : 0
      fin([tail, tail.clone().add(new Vector3(-0.1 * L, lift * 0.6, side * 0.07 * L)), tail.clone().add(new Vector3(-0.19 * L, lift, side * 0.1 * L)), tail.clone().add(new Vector3(-0.2 * L, lift, side * 0.03 * L)), tail.clone().add(new Vector3(-0.12 * L, lift * 0.6, side * 0.005 * L))], back)
    }
  }
  // An elephant seal bull's trunk-like nose hanging over the mouth.
  if (bull) b.blob(at(0).clone().add(new Vector3(0.02 * L, -0.02 * L, 0)), new Vector3(0.06 * L, 0.035 * L, 0.035 * L), () => back, () => 1, 4)
  return b.build()
}

/** A head and neck above the water: a seal "bottling" or watching. */
function swimmingHead(rng: Random, kind: PinnipedKind): BufferGeometry {
  const look = LOOKS[kind]
  const b = new MeshBuilder()
  const L = rng.range(...look.length)
  const r = look.girth * L * 0.6
  const wet: RGB = [look.back[0] * 0.4, look.back[1] * 0.4, look.back[2] * 0.4]
  b.blob(new Vector3(0, r * 0.4, 0), new Vector3(r, r * 1.6, r), () => wet, () => 1, 4)
  b.blob(new Vector3(r * 0.4, r * 1.9, 0), new Vector3(r * 1.3, r * 0.85, r * 0.85), () => wet, () => 1, 4)
  return b.build()
}

/** A low, rounded skerry of rock: a noisy dome, flat underneath, its top
 * smoothed by the sea into slabs and humps seals can lie on. Vertex colours
 * carry the rock shading like rockGeometry's. */
function skerryGeometry(rng: Random): BufferGeometry {
  const geometry = mergeVertices(new IcosahedronGeometry(1, 24))
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
  const mesh = new Mesh(skerryGeometry(rng), rockMaterial(rng.pick(ctx.params.biome.rockColors), 0.6, SKERRY_GROWTH))
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
 * view has room. */
function onBeach(ctx: PropContext, rng: Random, count: number, room: number): { spots: Vector3[]; centre: Vector3; radius: number } | null {
  const { coast } = ctx.params
  const { stormLine } = beachLines(coast)
  const low = coast.runup * 0.5
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
      if (u < 0 || u > stormLine * 1.3) continue
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
  const beach = pinnipeds.site === 'beach' ? onBeach(ctx, ctx.rng('pinnipeds/beach'), count, room) : null
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
  const variants = poses.map(([pose], k) => pinniped(rng, kind, pose, k === 1 ? 0.8 : rng.range(0, 0.3)))
  const placed: Matrix4[][] = variants.map(() => [])
  for (const spot of spots) {
    const k = rng.weighted(poses.map(([, w], i) => [i, w] as const))
    const q = new Quaternion().setFromEuler(new Euler(0, rng.range(0, Math.PI * 2), 0))
    // Sink a little into the rock so bellies rest on it.
    placed[k].push(new Matrix4().compose(spot.clone().setY(spot.y - 0.05), q, new Vector3().setScalar(rng.range(0.85, 1.1))))
  }
  // Dry fur is matte; the wet ones are darkened in their vertex colours.
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  variants.forEach((geometry, k) => {
    if (placed[k].length === 0) return
    const herd = new InstancedMesh(geometry, material, placed[k].length)
    placed[k].forEach((m, i) => herd.setMatrixAt(i, m))
    herd.castShadow = true
    herd.frustumCulled = false
    objects.push(herd)
  })

  // Heads bobbing in the water round the rock or off the beach.
  const head = swimmingHead(rng, kind)
  const heads: Matrix4[] = []
  for (let i = 0, n = rng.int(2, 8); i < 40 && heads.length < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = radius * rng.range(1.2, 2.5)
    const x = centre.x + Math.cos(a) * r
    const z = centre.z + Math.sin(a) * r
    if (ctx.ground(x, z) > -1.5) continue
    const q = new Quaternion().setFromEuler(new Euler(0, rng.range(0, Math.PI * 2), 0))
    heads.push(new Matrix4().compose(new Vector3(x, ctx.seaLevel(x, z) - 0.1, z), q, new Vector3(1, 1, 1)))
  }
  if (heads.length > 0) {
    const bobbing = new InstancedMesh(head, material, heads.length)
    heads.forEach((m, i) => bobbing.setMatrixAt(i, m))
    bobbing.frustumCulled = false
    objects.push(bobbing)
  }
  return objects
}
