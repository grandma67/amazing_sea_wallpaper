import {
  BufferAttribute,
  Color,
  DoubleSide,
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

import type { RGB } from '../biome'
import type { ColonyKind } from '../params'
import type { Random } from '../random'
import { shoreToWorld } from '../terrain'
import { gull } from './birds'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { beachLines } from './debris'
import { fbm3 } from './noise'
import { rockGeometry, rockMaterial, type RockGrowth } from './rocks'

// Seabird islands: an offshore rock where thousands of birds nest, with a
// cloud of them wheeling overhead.
//
// - Gannetries (Bass Rock, Shetland, Brittany, New Zealand): so many gannets
//   that the rock looks white — guano coats the ledges and the top and runs
//   down the cliffs in streaks.
// - Puffin and guillemot islands (Skomer, the Westman Islands, Norway): a
//   grassy, burrowed cap over dark cliffs; dark birds against the sky.
// - Tropical islets (boobies and frigatebirds): a bushy top, guano-washed
//   rock, frigatebirds hanging dark and high above.
// - Penguin rookeries (South Georgia, the sub-Antarctic islands): the gentle
//   lower slopes crowded with penguins; petrels and skuas overhead.
//
// On the mainland (params.colony.site), the birds nest on the cliffs of a
// headland along the coast (Bempton Cliffs, Muriwai, Látrabjarg), and
// penguins crowd the beach itself (St Andrews Bay, Salisbury Plain).

interface ColonyStyle {
  guano: number
  growth: RockGrowth | null
  /** Birds in the air: white or dark, how many. */
  darkBirds: boolean
  flying: [number, number]
}

const NO_GROWTH: Omit<RockGrowth, 'moss' | 'mossColor'> = {
  lichen: 0,
  lichenColor: [0, 0, 0],
  algae: 0.6,
  algaeColor: [0.06, 0.08, 0.03]
}

const STYLES: Record<ColonyKind, ColonyStyle> = {
  gannet: { guano: 1, growth: { ...NO_GROWTH, moss: 0, mossColor: [0, 0, 0] }, darkBirds: false, flying: [300, 700] },
  puffin: {
    guano: 0.35,
    growth: { ...NO_GROWTH, moss: 1, mossColor: [0.09, 0.16, 0.04], lichen: 0.5, lichenColor: [0.55, 0.5, 0.35] },
    darkBirds: true,
    flying: [120, 300]
  },
  tropical: {
    guano: 0.3,
    growth: { ...NO_GROWTH, moss: 0.9, mossColor: [0.06, 0.13, 0.03] },
    darkBirds: true,
    flying: [60, 160]
  },
  penguin: { guano: 0.5, growth: { ...NO_GROWTH, moss: 0.4, mossColor: [0.12, 0.14, 0.05] }, darkBirds: true, flying: [20, 60] }
}

const GUANO: RGB = [0.78, 0.77, 0.7]

/** Rock island geometry with the rock colour and guano baked into the
 * vertex colours (the material colour stays white). */
function islandGeometry(rng: Random, style: ColonyStyle, rock: RGB, stack: boolean): BufferGeometry {
  const geometry = rockGeometry(rng, stack)
  const position = geometry.attributes.position as BufferAttribute
  const normal = geometry.attributes.normal as BufferAttribute
  const color = geometry.attributes.color as BufferAttribute
  const seed = rng.int(0, 100_000)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const shade = color.getX(i)
    // Guano: thick on ledges and the top, running down in vertical streaks.
    const streaks = fbm3(x * 9, y * 1.2, z * 9, seed)
    const ledge = Math.max(0, normal.getY(i))
    const height = Math.min(1, Math.max(0, (y + 0.2) / 0.8))
    const g = style.guano * Math.min(1, Math.max(0, ledge * 1.4 * height + (streaks - 0.5) * 2.5 * height))
    const c = rock.map((r, k) => r * shade * (1 - g) + GUANO[k] * g * (0.85 + 0.15 * shade))
    color.setXYZ(i, c[0], c[1], c[2])
  }
  color.needsUpdate = true
  return geometry
}

/** A standing penguin, ~0.7 m: black back, white front. */
function penguin(): BufferGeometry {
  const b = new MeshBuilder()
  b.blob(new Vector3(0, 0.32, 0), new Vector3(0.14, 0.32, 0.12), n => (n.x > 0.2 ? [0.75, 0.75, 0.72] : [0.02, 0.02, 0.025]), () => 1, 4)
  b.blob(new Vector3(0.02, 0.66, 0), new Vector3(0.08, 0.08, 0.07), () => [0.02, 0.02, 0.025], () => 1, 3)
  return b.build()
}

/** Where the colony is: the rock it nests on (null for a beach rookery),
 * the centre and size of the cloud of birds over it. */
interface Site {
  objects: Object3D[]
  at: Vector3
  width: number
  height: number
}

/** Penguins crowding the gentle slopes of a rock, below `maxHeight`. */
function penguinsOn(rng: Random, mesh: Mesh, maxHeight: number): InstancedMesh | null {
  const geometry = mesh.geometry
  const position = geometry.attributes.position as BufferAttribute
  const normal = geometry.attributes.normal as BufferAttribute
  const spots: Matrix4[] = []
  const p = new Vector3()
  const n = new Vector3()
  for (let i = 0; i < 6000 && spots.length < 2500; i++) {
    const v = rng.int(0, position.count - 1)
    n.fromBufferAttribute(normal, v).transformDirection(mesh.matrixWorld)
    p.fromBufferAttribute(position, v).applyMatrix4(mesh.matrixWorld)
    if (n.y < 0.75 || p.y < 1 || p.y > maxHeight) continue
    const jitter = new Vector3(rng.normal(0, 1.5), 0, rng.normal(0, 1.5))
    spots.push(new Matrix4().compose(p.clone().add(jitter), new Quaternion().setFromEuler(new Euler(0, rng.range(0, 6.3), 0)), new Vector3().setScalar(rng.range(0.9, 1.1))))
  }
  return flock(spots)
}

function flock(spots: Matrix4[]): InstancedMesh | null {
  if (spots.length === 0) return null
  const mesh = new InstancedMesh(penguin(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), spots.length)
  spots.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  return mesh
}

function rockMesh(ctx: PropContext, geometry: BufferGeometry, style: ColonyStyle): Mesh {
  const mesh = new Mesh(geometry, rockMaterial([1, 1, 1], ctx.params.coast.runup * 3, style.growth))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.island = true
  return mesh
}

/** Offshore, in view, near the horizon line; all of it over deep water. */
function island(ctx: PropContext, rng: Random, kind: ColonyKind, style: ColonyStyle): Site | null {
  const width = rng.range(70, 180)
  let at: Vector3 | null = null
  for (let i = 0; i < 300 && at == null; i++) {
    const p = ctx.seaPoint(rng, [-0.3, 0.02], 300, 1500, 6)
    if (p == null) continue
    const clear = [0, 1, 2, 3, 4, 5, 6, 7].every(k => {
      const a = (k / 8) * Math.PI * 2
      return ctx.ground(p.x + Math.cos(a) * width, p.z + Math.sin(a) * width) < -3
    })
    if (clear) at = p
  }
  if (at == null) return null

  const rock = rng.pick(ctx.params.biome.rockColors)
  // Sheer cliff islands for gannets and puffins (Bass Rock: 107 m high).
  const height = (width / 2) * (kind === 'penguin' || kind === 'tropical' ? rng.range(0.5, 0.8) : rng.range(0.8, 1.3))
  const mesh = rockMesh(ctx, islandGeometry(ctx.rng('colony/island'), style, rock, true), style)
  // The stack geometry spans y ≈ −0.45…0.75 (flat underside below); sink it
  // a little so the cliffs rise straight out of the water.
  mesh.position.copy(at).setY(-height * 0.1)
  mesh.scale.set(width / 2, height, (width / 2) * rng.range(0.6, 1.1))
  mesh.rotation.y = rng.range(0, Math.PI * 2)
  mesh.updateMatrixWorld()
  const objects: Object3D[] = [mesh]
  // Penguins crowd the gentle lower slopes.
  if (kind === 'penguin') {
    const penguins = penguinsOn(rng, mesh, height * 0.5)
    if (penguins != null) objects.push(penguins)
  }
  return { objects, at, width, height }
}

/** Seabird cliffs on a headland along the coast: a ridge running from the
 * land out into the sea, its seaward end a sheer cliff, far enough along the
 * shore to be seen side on. */
function headland(ctx: PropContext, rng: Random, kind: ColonyKind, style: ColonyStyle): Site | null {
  const { coast } = ctx.params
  const seaward = (coast.seawardAzimuthDeg * Math.PI) / 180
  for (let i = 0; i < 400; i++) {
    const reach = 1 + i / 100
    const length = rng.range(220, 420)
    const width = rng.range(70, 140)
    // Bempton's chalk cliffs are 100 m, Látrabjarg's over 400 m.
    const height = kind === 'tropical' ? rng.range(25, 45) : rng.range(40, 90)
    const a = (rng.chance(0.5) ? 1 : -1) * rng.range(150, 400 * reach)
    // Mostly on land; the seaward tip juts 15–40% of its length into the sea.
    const s = -rng.range(0.1, 0.35) * length
    const [x, z] = shoreToWorld(coast, s, a)
    const [tx, tz] = shoreToWorld(coast, s + length * 0.4, a)
    const d = ctx.distance(tx, tz)
    if (d < width || d > 1200) continue
    const base = Math.max(0, ctx.ground(x, z))
    // Its cliff end well inside the frame.
    if (!ctx.inFrame(tx, height * 0.4, tz, 0.8)) continue
    // Mainland cliffs are less whitewashed than a gannet rock.
    const mesh = rockMesh(ctx, islandGeometry(rng, { ...style, guano: style.guano * 0.6 }, rng.pick(ctx.params.biome.rockColors), true), style)
    mesh.position.set(x, base - height * 0.15, z)
    mesh.scale.set(length / 2, height, width / 2)
    // Its length (local x) along the seaward direction, give or take.
    mesh.rotation.y = Math.PI / 2 - seaward + rng.normal(0, 0.15)
    mesh.updateMatrixWorld()
    return { objects: [mesh], at: new Vector3(tx, base, tz), width, height }
  }
  return null
}

/** A rookery on the beach: thousands of penguins packed on the sand above
 * the tide line, in a patch drawn out along the shore. */
function rookery(ctx: PropContext, rng: Random): Site | null {
  const { coast } = ctx.params
  const { highTide } = beachLines(coast)
  const top = Math.max(highTide + 6, coast.beachWidth * 0.9)
  for (let i = 0; i < 300; i++) {
    const a0 = rng.normal(0, 150 * (1 + i / 100))
    const u0 = rng.range(highTide, top)
    const [x0, z0] = shoreToWorld(coast, -u0, a0)
    const d = ctx.distance(x0, z0)
    if (d < 25 || d > 500 || !ctx.inFrame(x0, ctx.ground(x0, z0), z0, 0.85)) continue
    const length = rng.range(40, 140)
    const depth = top - highTide * 0.6
    const spots: Matrix4[] = []
    const count = rng.int(800, 2500)
    for (let k = 0; k < count * 3 && spots.length < count; k++) {
      const a = a0 + rng.normal(0, length / 3)
      const u = u0 + rng.normal(0, depth / 3)
      if (u < highTide * 0.6 || u > top) continue
      const [x, z] = shoreToWorld(coast, -u, a)
      const y = ctx.ground(x, z)
      if (y < 0.15 || ctx.distance(x, z) < 6) continue
      // Mostly facing the sea or each other.
      const yaw = rng.range(0, Math.PI * 2)
      spots.push(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3().setScalar(rng.range(0.9, 1.15))))
    }
    const penguins = flock(spots)
    if (penguins == null) continue
    return { objects: [penguins], at: new Vector3(x0, ctx.ground(x0, z0), z0), width: length, height: 12 }
  }
  return null
}

export function createColony(ctx: PropContext): Object3D[] {
  const colony = ctx.params.colony
  if (colony == null) return []
  const { kind } = colony
  const rng = ctx.rng('colony')
  const style = STYLES[kind]

  // On the mainland if it fits the frame, else on an island.
  const local = ctx.rng('colony/mainland')
  const site =
    (colony.site === 'mainland' ? (kind === 'penguin' ? rookery(ctx, local) : headland(ctx, local, kind, style)) : null) ??
    island(ctx, rng, kind, style)
  if (site == null) return []
  const { objects, at, width, height } = site

  // The colony in the air: a loose cloud of birds circling over the island,
  // densest close to it.
  const poses = [gull(0.25, 0.35, style.darkBirds), gull(0.6, 0.2, style.darkBirds), gull(-0.15, -0.1, style.darkBirds)]
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide })
  const count = rng.int(...style.flying)
  const top = height * 0.7
  const placed: Matrix4[][] = poses.map(() => [])
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = width * (0.2 + 0.9 * rng.float() ** 0.7)
    const y = top * rng.range(0.2, 1.6) + rng.float() ** 3 * height * 2
    const position = at.clone().add(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
    // Circling: flying tangentially, banked into the turn.
    const q = new Quaternion().setFromEuler(new Euler(rng.normal(0.35, 0.2), -a + rng.normal(0, 0.3), 0, 'YXZ'))
    // Gannets and frigatebirds are big seabirds (1.7–2.3 m wings).
    const size = kind === 'puffin' ? rng.range(0.6, 0.8) : rng.range(1.3, 1.8)
    placed[rng.int(0, poses.length - 1)].push(new Matrix4().compose(position, q, new Vector3().setScalar(size)))
  }
  poses.forEach((geometry, k) => {
    if (placed[k].length === 0) return
    const birds = new InstancedMesh(geometry, material, placed[k].length)
    placed[k].forEach((m, i) => {
      birds.setMatrixAt(i, m)
      birds.setColorAt(i, new Color(1, 1, 1))
    })
    birds.frustumCulled = false
    objects.push(birds)
  })
  return objects
}
