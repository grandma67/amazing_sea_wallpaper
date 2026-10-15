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

import type { RGB } from '../biome'
import { forced } from '../sceneSpec'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

// Seabirds: a gull body with two-segment wings in a few flight poses,
// gathered into loose flocks somewhere in the frame.

const WHITE: RGB = [0.75, 0.75, 0.73]
const GREY: RGB = [0.42, 0.44, 0.46]
const BLACK: RGB = [0.04, 0.04, 0.045]
const BILL: RGB = [0.6, 0.45, 0.1]

/** `lift` raises the inner wing, `droop` lowers the outer wing (radians). */
export function gull(lift: number, droop: number, dark: boolean): BufferGeometry {
  const b = new MeshBuilder()
  const body = dark ? BLACK : WHITE
  const wing = dark ? BLACK : GREY
  b.blob(new Vector3(0, 0, 0), new Vector3(0.22, 0.05, 0.05), () => body, () => 1, 4)
  b.blob(new Vector3(0.21, 0.025, 0), new Vector3(0.055, 0.045, 0.04), () => body, () => 1, 3)
  b.blob(new Vector3(0.29, 0.015, 0), new Vector3(0.04, 0.01, 0.01), () => BILL, () => 1, 2)
  // Tail.
  const t0 = b.vertex(new Vector3(-0.2, 0.01, -0.05), body)
  const t1 = b.vertex(new Vector3(-0.2, 0.01, 0.05), body)
  const t2 = b.vertex(new Vector3(-0.36, 0.0, 0.0), wing)
  b.triangle(t0, t1, t2)
  for (const side of [-1, 1]) {
    const shoulder = new Vector3(0.05, 0.02, side * 0.05)
    const elbow = shoulder
      .clone()
      .add(new Vector3(-0.04, Math.sin(lift) * 0.42, side * Math.cos(lift) * 0.42))
    const tip = elbow
      .clone()
      .add(new Vector3(-0.14, Math.sin(lift - droop) * 0.5, side * Math.cos(lift - droop) * 0.5))
    // Inner wing: broad, leading edge at the front.
    const a = b.vertex(shoulder.clone().add(new Vector3(0.08, 0, 0)), wing)
    const c = b.vertex(shoulder.clone().add(new Vector3(-0.1, 0, 0)), wing)
    const d = b.vertex(elbow.clone().add(new Vector3(0.06, 0, 0)), wing)
    const e = b.vertex(elbow.clone().add(new Vector3(-0.12, 0, 0)), wing)
    b.quad(a, d, e, c)
    // Outer wing tapering to a black tip.
    const f = b.vertex(tip, BLACK)
    const g = b.vertex(tip.clone().add(new Vector3(-0.06, 0, 0)), BLACK)
    b.quad(d, f, g, e)
  }
  return b.build()
}

export function createBirds(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const rng = ctx.rng('birds')
  if (!forced(params.overrides?.birds, rng.chance(0.6))) return []

  // Seen against a bright low sky, birds read as dark silhouettes.
  const dark = params.sunElevationDeg < 4 || params.timeOfDay === 'night' || rng.chance(0.2)
  const poses = [gull(0.25, 0.35, dark), gull(0.6, 0.2, dark), gull(-0.15, -0.1, dark)]
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide })

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
    mesh.frustumCulled = false
    meshes.push(mesh)
  })
  return meshes
}
