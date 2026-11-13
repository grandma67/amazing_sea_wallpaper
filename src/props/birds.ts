import {
  Color,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry
} from 'three'

import { gullSeason } from '../animalSeasons'
import type { RGB } from '../biome'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced } from '../sceneSpec'
import { MeshBuilder } from './builder'
import { beak, eye, onBlob } from './faces'
import { skinBlob, skinFlat, skinMaterial, skinsOn } from './skins'
import { windDirection } from './wind'
import { stormy, type PropContext } from './context'

// Seabirds: a gull body with two-segment wings in a few flight poses,
// gathered into loose flocks somewhere in the frame. In a storm gulls don't
// fly: they rest on the water (heads into the wind, rafted together) or on
// the shore until it passes.

const WHITE: RGB = [0.75, 0.75, 0.73]
const GREY: RGB = [0.42, 0.44, 0.46]
const BLACK: RGB = [0.04, 0.04, 0.045]
const BILL: RGB = [0.6, 0.45, 0.1]
/** A large gull's red spot near the lower bill's tip, its pale iris and
 * orange-red orbital ring (herring gull). */
const GONYS: RGB = [0.55, 0.06, 0.03]

/** A gull's face on its head blob: eye, and the bill from the head's front. */
function gullFace(b: MeshBuilder, head: Vector3, radii: Vector3, dark: boolean): void {
  for (const side of [-1, 1]) {
    const e = onBlob(head, radii, new Vector3(0.45, 0.35, side * 0.8))
    eye(b, e.at, e.out, radii.y * 0.16, { iris: dark ? [0.05, 0.04, 0.03] : [0.7, 0.66, 0.42], lid: dark ? [0.05, 0.05, 0.05] : [0.6, 0.22, 0.08], irisSize: 0.85 }, 2)
  }
  const base = onBlob(head, radii, new Vector3(1, -0.15, 0)).at.addScaledVector(new Vector3(1, 0, 0), -radii.x * 0.15)
  beak(b, base, new Vector3(1, -0.08, 0), new Vector3(0, 1, 0), 0.055, 0.022, 0.016, { upper: dark ? BLACK : BILL, lower: dark ? BLACK : BILL, gonys: dark ? undefined : GONYS, hook: 0.35, blunt: 0.35 })
}

/** `lift` raises the inner wing, `droop` lowers the outer wing (radians). */
export function gull(lift: number, droop: number, dark: boolean, skin = false): BufferGeometry {
  const b = new MeshBuilder()
  // Feathers from a photo (props/skins.ts) on body and wings.
  const body3 = skin ? skinBlob('feathers', 0.6, 'wrap') : undefined
  const flat = skinFlat('feathers', 0.6)
  const v = (p: Vector3, c: RGB): number => {
    const id = b.vertex(p, c)
    if (skin) b.setSkin(id, flat(p))
    return id
  }
  const body = dark ? BLACK : WHITE
  const wing = dark ? BLACK : GREY
  b.blob(new Vector3(0, 0, 0), new Vector3(0.22, 0.05, 0.05), () => body, () => 1, 4, undefined, body3)
  b.blob(new Vector3(0.21, 0.025, 0), new Vector3(0.055, 0.045, 0.04), () => body, () => 1, 3, undefined, body3)
  gullFace(b, new Vector3(0.21, 0.025, 0), new Vector3(0.055, 0.045, 0.04), dark)
  // Tail: a fan, narrow where it leaves the body and broad, squarish at
  // the end (a gull's is white; it was a point before, which read as an
  // arrowhead).
  const t0 = v(new Vector3(-0.19, 0.01, -0.03), body)
  const t1 = v(new Vector3(-0.19, 0.01, 0.03), body)
  const t2 = v(new Vector3(-0.33, 0.0, 0.065), body)
  const t3 = v(new Vector3(-0.345, 0.0, 0), body)
  const t4 = v(new Vector3(-0.33, 0.0, -0.065), body)
  b.quad(t0, t1, t2, t3)
  b.triangle(t0, t3, t4)
  for (const side of [-1, 1]) {
    const shoulder = new Vector3(0.05, 0.02, side * 0.05)
    const elbow = shoulder
      .clone()
      .add(new Vector3(-0.04, Math.sin(lift) * 0.42, side * Math.cos(lift) * 0.42))
    const tip = elbow
      .clone()
      .add(new Vector3(-0.14, Math.sin(lift - droop) * 0.5, side * Math.cos(lift - droop) * 0.5))
    // Inner wing: broad, leading edge at the front.
    const a = v(shoulder.clone().add(new Vector3(0.08, 0, 0)), wing)
    const c = v(shoulder.clone().add(new Vector3(-0.1, 0, 0)), wing)
    const d = v(elbow.clone().add(new Vector3(0.06, 0, 0)), wing)
    const e = v(elbow.clone().add(new Vector3(-0.12, 0, 0)), wing)
    b.quad(a, d, e, c)
    // Outer wing tapering to a black tip.
    const f = v(tip, BLACK)
    const g = v(tip.clone().add(new Vector3(-0.06, 0, 0)), BLACK)
    b.quad(d, f, g, e)
  }
  return b.build()
}

/** A gull sitting on the water or the sand, wings folded over the back and
 * the black tips crossed past the tail; base on y = 0. */
export function restingGull(dark: boolean, skin = false): BufferGeometry {
  const b = new MeshBuilder()
  const body3 = (offset: number): ((n: Vector3, p: Vector3) => [number, number, number]) | undefined => (skin ? skinBlob('feathers', 0.6, 'wrap', offset) : undefined)
  const body = dark ? BLACK : WHITE
  const wing = dark ? BLACK : GREY
  b.blob(new Vector3(0, 0.07, 0), new Vector3(0.2, 0.07, 0.075), () => body, () => 1, 4, undefined, body3(0))
  b.blob(new Vector3(0.17, 0.15, 0), new Vector3(0.055, 0.05, 0.045), () => body, () => 1, 3, undefined, body3(0.1))
  gullFace(b, new Vector3(0.17, 0.15, 0), new Vector3(0.055, 0.05, 0.045), dark)
  // Folded wings over the back and flanks.
  for (const side of [-1, 1]) {
    b.blob(new Vector3(-0.03, 0.105, side * 0.045), new Vector3(0.19, 0.035, 0.04), () => wing, () => 1, 3, undefined, body3(0.2 * side))
  }
  b.blob(new Vector3(-0.23, 0.11, 0), new Vector3(0.09, 0.015, 0.035), () => BLACK, () => 1, 2)
  return b.build()
}

/** Storm: no gulls up. They sit it out in rafts on the water (heads into
 * the wind) or huddled on the beach. */
function restingGulls(ctx: PropContext, rng: Random, dark: boolean): InstancedMesh[] {
  const { camera } = ctx
  const facing = windDirection(ctx.params).negate()
  const yaw = Math.atan2(-facing.z, facing.x)
  const matrices: Matrix4[] = []
  for (let raft = 0, rafts = rng.int(1, 3), tries = 0; raft < rafts && tries < 200; tries++) {
    // A ray through the lower frame, marched to the sea or the sand.
    const dir = new Vector3(rng.range(-0.9, 0.9), rng.range(-0.9, 0.1), 0.5).unproject(camera).sub(camera.position).normalize()
    if (dir.y > -0.002) continue
    let hit: Vector3 | null = null
    for (let t = 4; t < 150; t += Math.max(0.3, t * 0.03)) {
      const p = camera.position.clone().addScaledVector(dir, t)
      const ground = ctx.ground(p.x, p.z)
      if (p.y > Math.max(0, ground)) continue
      // Water at least knee deep, or dry sand above the swash.
      if (ground < -0.6 || ground > 0.3) hit = p.setY(0)
      break
    }
    if (hit == null) continue
    raft++
    const onSea = ctx.ground(hit.x, hit.z) < 0
    const count = rng.int(4, 20)
    const spread = Math.max(1.5, Math.sqrt(count) * 0.8)
    for (let i = 0; i < count; i++) {
      const x = hit.x + rng.normal(0, spread)
      const z = hit.z + rng.normal(0, spread)
      const ground = ctx.ground(x, z)
      if (onSea !== ground < 0 || (!onSea && ground < 0.3)) continue
      // Floating birds ride low, half the body under water.
      const y = onSea ? ctx.seaLevel(x, z) - 0.05 : ground
      const q = new Quaternion().setFromEuler(new Euler(0, yaw + rng.normal(0, 0.3), 0))
      matrices.push(new Matrix4().compose(new Vector3(x, y, z), q, new Vector3().setScalar(rng.range(0.9, 1.15))))
    }
  }
  if (matrices.length === 0) return []
  const skins = skinsOn(ctx.params.overrides)
  const material = skinMaterial(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }))
  const mesh = new InstancedMesh(restingGull(dark, skins), material, matrices.length)
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  return [mesh]
}

/** Gulls today: flying, resting (in a storm) or none. */
export function gullsFor(params: SceneParams, rng: Random): 'flying' | 'resting' | null {
  // Fewer in the Arctic winter, when most have flown south.
  if (!forced(params.overrides?.birds, rng.chance(0.6 * gullSeason(params)))) return null
  return stormy(params) ? 'resting' : 'flying'
}

export function createBirds(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const rng = ctx.rng('birds')
  const gulls = gullsFor(params, rng)
  if (gulls == null) return []
  if (gulls === 'resting') return restingGulls(ctx, rng, rng.chance(0.2))

  // Seen against a bright low sky, birds read as dark silhouettes.
  const dark = params.sunElevationDeg < 4 || params.timeOfDay === 'night' || rng.chance(0.2)
  const skins = skinsOn(ctx.params.overrides)
  const poses = [gull(0.25, 0.35, dark, skins), gull(0.6, 0.2, dark, skins), gull(-0.15, -0.1, dark, skins)]
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide })
  if (skins) skinMaterial(material)

  const camera = ctx.camera
  const flocks = rng.weighted<number>([
    [1, 5],
    [2, 2],
    [3, 1]
  ])
  const placed: { pose: number; matrix: Matrix4 }[] = []
  for (let f = 0; f < flocks; f++) {
    // Somewhere in the upper two thirds of the frame.
    const ndc = new Vector3(rng.range(-0.8, 0.8), rng.range(-0.1, 0.75), 0.5)
    const dir = ndc.unproject(camera).sub(camera.position).normalize()
    const distance = rng.weighted<() => number>([
      [() => rng.range(22, 45), 1],
      [() => rng.range(40, 140), 3],
      [() => rng.range(140, 400), 3]
    ])()
    const center = camera.position.clone().addScaledVector(dir, distance)
    const ground = Math.max(0, ctx.ground(center.x, center.z))
    if (center.y < ground + 3) center.y = ground + 3 + rng.range(0, 10)
    // Close birds fly above eye level, so they're seen from below, wings open.
    if (distance < 120) center.y = Math.max(center.y, camera.position.y + distance * rng.range(0.12, 0.3))
    const heading = rng.range(0, Math.PI * 2)
    // Close flocks are small; big flocks keep their distance.
    const count =
      distance < 40
        ? rng.int(1, 3)
        : rng.weighted<() => number>([
            [() => rng.int(1, 3), 3],
            [() => rng.int(4, 9), 3],
            [() => rng.int(10, 24), 1]
          ])()
    const spread = Math.max(3, distance * 0.15)
    for (let i = 0; i < count; i++) {
      const position = center
        .clone()
        .add(new Vector3(rng.normal(0, spread), rng.normal(0, spread * 0.35), rng.normal(0, spread)))
      if (position.y < ground + 1.5) continue
      const q = new Quaternion().setFromEuler(
        // Banking turns show the wings rather than their edges.
        new Euler(rng.normal(0, 0.35), heading + rng.normal(0, 0.35), rng.normal(0, 0.1), 'YXZ')
      )
      const size = rng.range(0.9, 1.3)
      placed.push({
        pose: rng.int(0, poses.length - 1),
        matrix: new Matrix4().compose(position, q, new Vector3().setScalar(size))
      })
    }
  }

  const meshes: InstancedMesh[] = []
  poses.forEach((geometry, pose) => {
    const mine = placed.filter(p => p.pose === pose)
    if (mine.length === 0) return
    const mesh = new InstancedMesh(geometry, material, mine.length)
    mine.forEach((p, i) => {
      mesh.setMatrixAt(i, p.matrix)
      mesh.setColorAt(i, new Color(1, 1, 1))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    meshes.push(mesh)
  })
  return meshes
}
