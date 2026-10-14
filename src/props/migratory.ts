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
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

// Migratory birds of the coast, each seen the way it's usually seen:
//
// - Geese (brent, barnacle, greylag): skeins in a V or a slanting line, high
//   overhead, following the coast in spring (March–May) and autumn
//   (September–November). Temperate and northern coasts.
// - Sea ducks (eiders, scoters): long, wavering lines just above the waves,
//   also on the move in spring and autumn; northern coasts.
// - Flamingos: in warm, salty lagoons and shallow bays (the Camargue and
//   Andalusia, the Caribbean, East Africa, Gujarat); flocks wade and feed in
//   the shallows, or fly in pink lines with neck and legs stretched out.
//
// Birds are built in a local frame facing +x, then instanced in formation.

type Species = 'goose' | 'duck' | 'flamingo'

interface Plumage {
  body: RGB
  neck: RGB
  head: RGB
  bill: RGB
  wing: RGB
  wingTip: RGB
  legs: RGB
  /** Pale cheek patch / white belly etc. */
  accent: RGB
}

const PLUMAGE: Record<Species, Plumage> = {
  goose: {
    body: [0.16, 0.14, 0.12],
    neck: [0.02, 0.02, 0.02],
    head: [0.02, 0.02, 0.02],
    bill: [0.02, 0.02, 0.02],
    wing: [0.2, 0.19, 0.17],
    wingTip: [0.05, 0.05, 0.05],
    legs: [0.03, 0.03, 0.03],
    accent: [0.7, 0.7, 0.68]
  },
  duck: {
    body: [0.65, 0.65, 0.62],
    neck: [0.65, 0.65, 0.62],
    head: [0.03, 0.03, 0.03],
    bill: [0.45, 0.4, 0.12],
    wing: [0.03, 0.03, 0.035],
    wingTip: [0.03, 0.03, 0.035],
    legs: [0.3, 0.25, 0.1],
    accent: [0.03, 0.03, 0.035]
  },
  flamingo: {
    body: [0.85, 0.32, 0.3],
    neck: [0.85, 0.4, 0.38],
    head: [0.85, 0.42, 0.4],
    bill: [0.04, 0.03, 0.03],
    wing: [0.8, 0.2, 0.22],
    wingTip: [0.02, 0.02, 0.02],
    legs: [0.75, 0.3, 0.3],
    accent: [0.85, 0.65, 0.6]
  }
}

interface Build {
  length: number
  /** Neck length relative to the body. */
  neck: number
  span: number
  legs: number
}

const BUILD: Record<Species, Build> = {
  goose: { length: 0.75, neck: 0.45, span: 1.5, legs: 0 },
  duck: { length: 0.55, neck: 0.15, span: 0.95, legs: 0 },
  flamingo: { length: 0.6, neck: 1.0, span: 1.55, legs: 0.9 }
}

/** A bird in flight, facing +x. `lift` raises the wings (radians). */
function flying(species: Species, lift: number): BufferGeometry {
  const p = PLUMAGE[species]
  const s = BUILD[species]
  const b = new MeshBuilder()
  const L = s.length
  b.blob(new Vector3(0, 0, 0), new Vector3(L * 0.42, L * 0.13, L * 0.14), n => (n.y < -0.3 ? p.accent : p.body), () => 1, 4)
  // Neck stretched forward; head and bill.
  const neckEnd = new Vector3(L * (0.35 + s.neck * 0.6), L * 0.03, 0)
  b.tube([new Vector3(L * 0.3, 0.02 * L, 0), neckEnd], () => L * 0.045, () => p.neck, 6)
  b.blob(neckEnd, new Vector3(L * 0.08, L * 0.06, L * 0.055), n => (species === 'goose' && Math.abs(n.z) > 0.6 && n.y < 0.3 ? p.accent : p.head), () => 1, 3)
  const billLength = species === 'flamingo' ? 0.14 : 0.08
  b.tube([neckEnd.clone().add(new Vector3(L * 0.06, 0, 0)), neckEnd.clone().add(new Vector3(L * billLength + L * 0.06, -L * (species === 'flamingo' ? 0.05 : 0.01), 0))], t => L * 0.025 * (1 - t * 0.6), () => p.bill, 5)
  // Legs trailing behind (flamingos).
  if (s.legs > 0) {
    for (const z of [-0.02, 0.02]) {
      b.tube([new Vector3(-L * 0.3, -L * 0.05, z * L), new Vector3(-L * (0.3 + s.legs), -L * 0.08, z * L * 2)], () => L * 0.015, () => p.legs, 4)
    }
  }
  // Tail.
  const t0 = b.vertex(new Vector3(-L * 0.35, 0, -L * 0.07), p.body)
  const t1 = b.vertex(new Vector3(-L * 0.35, 0, L * 0.07), p.body)
  const t2 = b.vertex(new Vector3(-L * 0.55, 0, 0), p.wing)
  b.triangle(t0, t1, t2)
  // Two-segment wings with dark primaries.
  const half = s.span / 2
  for (const side of [-1, 1]) {
    const shoulder = new Vector3(L * 0.05, L * 0.05, side * L * 0.12)
    const elbow = shoulder.clone().add(new Vector3(-0.03, Math.sin(lift) * half * 0.45, side * Math.cos(lift) * half * 0.45))
    const tip = elbow.clone().add(new Vector3(-0.08, Math.sin(lift * 0.6) * half * 0.55, side * Math.cos(lift * 0.6) * half * 0.55))
    const a = b.vertex(shoulder.clone().add(new Vector3(L * 0.12, 0, 0)), p.wing)
    const c = b.vertex(shoulder.clone().add(new Vector3(-L * 0.18, 0, 0)), p.wing)
    const d = b.vertex(elbow.clone().add(new Vector3(L * 0.08, 0, 0)), p.wing)
    const e = b.vertex(elbow.clone().add(new Vector3(-L * 0.2, 0, 0)), p.wingTip)
    b.quad(a, d, e, c)
    const f = b.vertex(tip, p.wingTip)
    const g = b.vertex(tip.clone().add(new Vector3(-L * 0.12, 0, 0)), p.wingTip)
    b.quad(d, f, g, e)
  }
  return b.build()
}

/** A wading flamingo, facing +x: standing tall, or head down feeding. */
function wadingFlamingo(feeding: boolean, oneLeg: boolean): BufferGeometry {
  const p = PLUMAGE.flamingo
  const b = new MeshBuilder()
  const legTop = 0.8
  // Long legs with a backward-bending "knee" (actually the ankle).
  for (const z of oneLeg ? [0] : [-0.05, 0.05]) {
    b.tube([new Vector3(0, 0, z), new Vector3(0.02, legTop * 0.5, z), new Vector3(-0.02, legTop, z)], () => 0.012, () => p.legs, 4)
  }
  const body = new Vector3(0, legTop + 0.12, 0)
  b.blob(body, new Vector3(0.24, 0.13, 0.12), n => (n.y > 0.3 && n.x < 0.2 ? p.wing : p.body), () => 1, 5)
  // Tail tip and black primaries showing at the rear.
  b.blob(body.clone().add(new Vector3(-0.22, 0.02, 0)), new Vector3(0.08, 0.04, 0.06), () => p.wingTip, () => 1, 3)
  // S-shaped neck.
  const neck = feeding
    ? [new Vector3(0.18, 0.05, 0), new Vector3(0.32, 0.2, 0), new Vector3(0.45, 0.05, 0), new Vector3(0.5, -0.4, 0), new Vector3(0.5, -0.78, 0)]
    : [new Vector3(0.18, 0.05, 0), new Vector3(0.28, 0.3, 0), new Vector3(0.18, 0.55, 0), new Vector3(0.25, 0.78, 0)]
  const path = neck.map(v => v.add(body))
  b.tube(path, () => 0.022, () => p.neck, 5)
  const head = path[path.length - 1]
  b.blob(head, new Vector3(0.05, 0.04, 0.035), () => p.head, () => 1, 3)
  const billDir = feeding ? new Vector3(-0.02, -0.07, 0) : new Vector3(0.08, -0.04, 0)
  b.tube([head.clone(), head.clone().add(billDir)], t => 0.02 * (1 - t * 0.5), t => (t > 0.5 ? p.bill : [0.8, 0.75, 0.7]), 4)
  return b.build()
}

/** Is it a migration month for the northern temperate species? */
function migrating(month: number): boolean {
  return (month >= 3 && month <= 5) || (month >= 9 && month <= 11)
}

export function createMigratoryBirds(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const rng = ctx.rng('migratory')
  if (params.storm != null || params.timeOfDay === 'night') return []
  const month = Number(params.date.slice(5, 7))
  const biome = params.biome.name
  const warm = biome === 'tropical' || biome === 'desert' || biome === 'mediterranean'
  const cool = biome === 'nordic' || biome === 'volcanic' || biome === 'mediterranean'
  const polar = params.sea.ocean === 'arctic' || params.sea.ocean === 'southern'
  const season = migrating(month) ? 1 : 0.25
  const species = rng.weighted<Species | null>([
    [null, 6],
    ['goose', cool ? 2 * season : 0],
    ['duck', cool ? 2 * season : 0],
    ['flamingo', warm && !polar ? 1.5 : 0]
  ])
  if (species == null) return []

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide })
  const camera = ctx.camera
  const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
  // Flying across the view (from one side to the other), slightly toward or
  // away from the camera.
  const across = (rng.chance(0.5) ? 1 : -1) as 1 | -1
  const direction = right.clone().multiplyScalar(across).addScaledVector(forward, rng.range(-0.5, 0.5)).normalize()
  const yaw = Math.atan2(-direction.z, direction.x)
  const placed: { pose: number; matrix: Matrix4 }[] = []
  const put = (pose: number, at: Vector3, heading: number, scale: number, bank = 0): void => {
    const q = new Quaternion().setFromEuler(new Euler(bank, heading, 0, 'YXZ'))
    placed.push({ pose, matrix: new Matrix4().compose(at, q, new Vector3().setScalar(scale)) })
  }

  // Flamingos in a lagoon or bay: a wading flock in the shallows when there
  // are any in view, otherwise in flight.
  if (species === 'flamingo' && params.coast.type === 'beach' && rng.chance(0.7)) {
    const poses = [wadingFlamingo(false, false), wadingFlamingo(true, false), wadingFlamingo(false, true)]
    let centre: Vector3 | null = null
    for (let i = 0; i < 200 && centre == null; i++) {
      const p = ctx.seaPoint(rng, [-0.9, -0.05], 15, 350, 0.05)
      if (p != null && ctx.ground(p.x, p.z) > -0.5) centre = p
    }
    if (centre != null) {
      const count = rng.int(8, 40)
      for (let i = 0; i < count; i++) {
        const at = centre.clone().add(new Vector3(rng.normal(0, 6 + count * 0.3), 0, rng.normal(0, 4 + count * 0.2)))
        const depth = -ctx.ground(at.x, at.z)
        if (depth < 0.02 || depth > 0.55) continue
        // Legs stand on the bottom, so the bird sinks by the water depth.
        at.y = -depth
        put(rng.weighted([[0, 3], [1, 4], [2, 1]] as const), at, rng.range(0, Math.PI * 2), rng.range(0.9, 1.1))
      }
      return instance(poses, placed, material)
    }
  }

  const poses = [flying(species, 0.35), flying(species, -0.15), flying(species, 0.7)]
  const count = species === 'goose' ? rng.int(9, 36) : species === 'duck' ? rng.int(6, 22) : rng.int(8, 30)
  // Lead bird: somewhere in the frame. Ducks skim the waves; geese and
  // flamingos fly at some height, found along a view ray that climbs to it.
  let lead: Vector3 | null = null
  for (let i = 0; i < 60 && lead == null; i++) {
    const ray = new Vector3(rng.range(-0.6, 0.6), rng.range(-0.3, 0.8), 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize()
    if (species === 'duck') {
      const p = camera.position.clone().addScaledVector(ray, rng.range(60, 400))
      if (ctx.ground(p.x, p.z) < -1) lead = p.setY(rng.range(1, 4))
    } else if (ray.y > 0.02) {
      const t = (rng.range(15, 70) - camera.position.y) / ray.y
      if (t > 50 && t < 250) lead = camera.position.clone().addScaledVector(ray, t)
    }
  }
  if (lead == null) return []
  const spacing = BUILD[species].span * rng.range(1.1, 1.6)
  const sideways = new Vector3(-direction.z, 0, direction.x)
  const vee = species === 'goose' && rng.chance(0.65)
  for (let i = 0; i < count; i++) {
    let offset: Vector3
    if (vee) {
      // Two arms of a V, uneven in length, trailing the leader.
      const arm = i % 2 === 0 ? 1 : -1
      const k = Math.ceil(i / 2)
      offset = direction.clone().multiplyScalar(-k * spacing * 0.8).addScaledVector(sideways, arm * k * spacing * 0.7)
    } else {
      // A slanting line (geese, flamingos) or a wavering string (ducks).
      offset = direction.clone().multiplyScalar(-i * spacing * (species === 'duck' ? 1.3 : 0.6))
      offset.addScaledVector(sideways, i * spacing * (species === 'duck' ? rng.normal(0, 0.15) : 0.7))
    }
    offset.add(new Vector3(rng.normal(0, spacing * 0.15), rng.normal(0, species === 'duck' ? 0.3 : spacing * 0.2), rng.normal(0, spacing * 0.15)))
    const at = lead.clone().add(offset)
    if (species === 'duck') at.y = Math.max(0.6, at.y)
    put(rng.int(0, poses.length - 1), at, yaw + rng.normal(0, 0.05), rng.range(0.92, 1.08), rng.normal(0, 0.08))
  }
  return instance(poses, placed, material)
}

function instance(poses: BufferGeometry[], placed: { pose: number; matrix: Matrix4 }[], material: MeshStandardMaterial): InstancedMesh[] {
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
