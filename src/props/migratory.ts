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
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced, forcedKind, type MigratorySpecies } from '../sceneSpec'
import { waterfowlSeason } from '../animalSeasons'
import { hasBeach } from '../terrain'
import { MeshBuilder } from './builder'
import { beak, eye, onBlob, type BeakLook } from './faces'
import { skinBlob, skinCoords, skinFlat, skinMaterial, skinsOn } from './skins'
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

type Species = MigratorySpecies

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
function flying(species: Species, lift: number, skin = false): BufferGeometry {
  const p = PLUMAGE[species]
  const s = BUILD[species]
  const b = new MeshBuilder()
  const L = s.length
  // Feathers from a photo (props/skins.ts) on body, neck, wings and tail.
  const flat = skinFlat('feathers', L)
  const v = (q: Vector3, c: RGB): number => {
    const id = b.vertex(q, c)
    if (skin) b.setSkin(id, flat(q))
    return id
  }
  b.blob(new Vector3(0, 0, 0), new Vector3(L * 0.42, L * 0.13, L * 0.14), n => (n.y < -0.3 ? p.accent : p.body), () => 1, 4, undefined, skin ? skinBlob('feathers', L, 'wrap') : undefined)
  // Neck stretched forward; head and bill.
  const neckEnd = new Vector3(L * (0.35 + s.neck * 0.6), L * 0.03, 0)
  b.tube([new Vector3(L * 0.3, 0.02 * L, 0), neckEnd], () => L * 0.045, () => p.neck, 6, skin ? skinCoords('feathers', L) : undefined)
  b.blob(neckEnd, new Vector3(L * 0.08, L * 0.06, L * 0.055), n => (species === 'goose' && Math.abs(n.z) > 0.6 && n.y < 0.3 ? p.accent : p.head), () => 1, 3)
  const billLength = species === 'flamingo' ? 0.14 : 0.08
  const headR = new Vector3(L * 0.08, L * 0.06, L * 0.055)
  birdFace(b, species, neckEnd, headR, new Vector3(1, -0.05, 0), L * billLength * 1.3, L)
  // Legs trailing behind (flamingos).
  if (s.legs > 0) {
    for (const z of [-0.02, 0.02]) {
      b.tube([new Vector3(-L * 0.3, -L * 0.05, z * L), new Vector3(-L * (0.3 + s.legs), -L * 0.08, z * L * 2)], () => L * 0.015, () => p.legs, 4)
    }
  }
  // Tail: a short fan, broadest at its end.
  const t0 = v(new Vector3(-L * 0.35, 0, -L * 0.05), p.body)
  const t1 = v(new Vector3(-L * 0.35, 0, L * 0.05), p.body)
  const t2 = v(new Vector3(-L * 0.52, 0, L * 0.1), p.wing)
  const t3 = v(new Vector3(-L * 0.54, 0, 0), p.wing)
  const t4 = v(new Vector3(-L * 0.52, 0, -L * 0.1), p.wing)
  b.quad(t0, t1, t2, t3)
  b.triangle(t0, t3, t4)
  // Two-segment wings with dark primaries.
  const half = s.span / 2
  for (const side of [-1, 1]) {
    const shoulder = new Vector3(L * 0.05, L * 0.05, side * L * 0.12)
    const elbow = shoulder.clone().add(new Vector3(-0.03, Math.sin(lift) * half * 0.45, side * Math.cos(lift) * half * 0.45))
    const tip = elbow.clone().add(new Vector3(-0.08, Math.sin(lift * 0.6) * half * 0.55, side * Math.cos(lift * 0.6) * half * 0.55))
    const a = v(shoulder.clone().add(new Vector3(L * 0.12, 0, 0)), p.wing)
    const c = v(shoulder.clone().add(new Vector3(-L * 0.18, 0, 0)), p.wing)
    const d = v(elbow.clone().add(new Vector3(L * 0.08, 0, 0)), p.wing)
    const e = v(elbow.clone().add(new Vector3(-L * 0.2, 0, 0)), p.wingTip)
    b.quad(a, d, e, c)
    const f = v(tip, p.wingTip)
    const g = v(tip.clone().add(new Vector3(-L * 0.12, 0, 0)), p.wingTip)
    b.quad(d, f, g, e)
  }
  return b.build()
}

/** A wading flamingo, facing +x: standing tall, or head down feeding. */
function wadingFlamingo(feeding: boolean, oneLeg: boolean, skin = false): BufferGeometry {
  const p = PLUMAGE.flamingo
  const b = new MeshBuilder()
  const legTop = 0.8
  // Long legs with a backward-bending "knee" (actually the ankle).
  for (const z of oneLeg ? [0] : [-0.05, 0.05]) {
    b.tube([new Vector3(0, 0, z), new Vector3(0.02, legTop * 0.5, z), new Vector3(-0.02, legTop, z)], () => 0.012, () => p.legs, 4)
  }
  const body = new Vector3(0, legTop + 0.12, 0)
  b.blob(body, new Vector3(0.24, 0.13, 0.12), n => (n.y > 0.3 && n.x < 0.2 ? p.wing : p.body), () => 1, 5, undefined, skin ? skinBlob('feathers', 0.6, 'wrap') : undefined)
  // Tail tip and black primaries showing at the rear.
  b.blob(body.clone().add(new Vector3(-0.22, 0.02, 0)), new Vector3(0.08, 0.04, 0.06), () => p.wingTip, () => 1, 3)
  // S-shaped neck.
  const neck = feeding
    ? [new Vector3(0.18, 0.05, 0), new Vector3(0.32, 0.2, 0), new Vector3(0.45, 0.05, 0), new Vector3(0.5, -0.4, 0), new Vector3(0.5, -0.78, 0)]
    : [new Vector3(0.18, 0.05, 0), new Vector3(0.28, 0.3, 0), new Vector3(0.18, 0.55, 0), new Vector3(0.25, 0.78, 0)]
  const path = neck.map(v => v.add(body))
  b.tube(path, () => 0.022, () => p.neck, 5, skin ? skinCoords('feathers', 0.6) : undefined)
  const head = path[path.length - 1]
  b.blob(head, new Vector3(0.05, 0.04, 0.035), () => p.head, () => 1, 3)
  const billDir = feeding ? new Vector3(-0.02, -0.07, 0) : new Vector3(0.08, -0.04, 0)
  birdFace(b, 'flamingo', head, new Vector3(0.05, 0.04, 0.035), billDir, 0.11, 0.6)
  return b.build()
}

/** Bills by species: a goose's with its pale nail, a duck's broad and flat,
 * a flamingo's pale with a black tip, bent sharply down. */
const BILLS: Record<Species, BeakLook & { depth: number; width: number }> = {
  goose: { upper: [0.03, 0.03, 0.03], lower: [0.03, 0.03, 0.03], tip: [0.35, 0.33, 0.3], tipFrom: 0.85, hook: 0.2, depth: 0.07, width: 0.05, blunt: 0.4 },
  duck: { upper: [0.45, 0.4, 0.12], lower: [0.4, 0.35, 0.1], tip: [0.05, 0.05, 0.04], tipFrom: 0.85, hook: 0.15, depth: 0.04, width: 0.07, blunt: 0.45 },
  flamingo: { upper: [0.82, 0.72, 0.68], lower: [0.82, 0.72, 0.68], tip: [0.03, 0.025, 0.025], tipFrom: 0.5, bend: 0.9, depth: 0.05, width: 0.04, blunt: 0.3 }
}

/** A bird's face on its head blob: dark (a flamingo's yellow) eyes, and
 * the species' bill from the head's front along `dir`. */
function birdFace(b: MeshBuilder, species: Species, head: Vector3, radii: Vector3, dir: Vector3, billLength: number, L: number): void {
  const look = BILLS[species]
  const iris: RGB = species === 'flamingo' ? [0.75, 0.62, 0.15] : [0.06, 0.04, 0.03]
  for (const side of [-1, 1]) {
    const e = onBlob(head, radii, new Vector3(0.4, 0.35, side * 0.85))
    eye(b, e.at, e.out, radii.y * 0.17, { iris, lid: [0.04, 0.04, 0.04], irisSize: 0.8 }, 2)
  }
  const base = onBlob(head, radii, dir).at.addScaledVector(dir.clone().normalize(), -radii.x * 0.2)
  beak(b, base, dir, new Vector3(0, 1, 0), billLength, L * look.depth, L * look.width, look)
}

/** One bird (scripts/mesh.mjs, tests): flying, or a flamingo wading. */
export function migratoryGeometry(species: Species, wading: boolean, skin = false): BufferGeometry {
  return wading ? wadingFlamingo(false, false, skin) : flying(species, 0.35, skin)
}

/** Which migratory flock passes today, or null. */
export function migratoryFor(params: SceneParams, rng: Random): Species | null {
  const force = params.overrides?.migratory
  if (force === undefined && (params.storm != null || params.timeOfDay === 'night')) return null
  // By climate (PLAN_BIOMES 11e): geese and ducks winter as far south as
  // the subtropics (Florida, the Gulf, south China); flamingos from the
  // Mediterranean and subtropics (Florida's returning flocks) to the tropics
  // and deserts.
  const climate = params.place.climate
  const warm = climate === 'tropical' || climate === 'arid' || climate === 'mediterranean' || climate === 'subtropical'
  const cool = climate !== 'tropical' && climate !== 'arid'
  const polar = params.sea.ocean === 'arctic' || params.sea.ocean === 'southern'
  // Passage, breeding and wintering flocks by climate and month
  // (animalSeasons.ts).
  const season = waterfowlSeason(params)
  const species = rng.weighted<Species | null>([
    [null, 6],
    ['goose', cool ? 2 * season.goose : 0],
    ['duck', cool ? 2 * season.duck : 0],
    ['flamingo', warm && !polar ? 1.5 : 0]
  ])
  if (!forced(force, species != null)) return null
  // Forced on where none were drawn: whichever fits the coast.
  return forcedKind(force, species ?? (warm && !polar ? 'flamingo' : 'goose'))
}

export function createMigratoryBirds(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const rng = ctx.rng('migratory')
  const species = migratoryFor(params, rng)
  if (species == null) return []

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide })
  const skins = skinsOn(ctx.params.overrides)
  if (skins) skinMaterial(material)
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
  if (species === 'flamingo' && hasBeach(params.coast) && rng.chance(0.7)) {
    const poses = [wadingFlamingo(false, false, skins), wadingFlamingo(true, false, skins), wadingFlamingo(false, true, skins)]
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

  const poses = [flying(species, 0.35, skins), flying(species, -0.15, skins), flying(species, 0.7, skins)]
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
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    meshes.push(mesh)
  })
  return meshes
}
