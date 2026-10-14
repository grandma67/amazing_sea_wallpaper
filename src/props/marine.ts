import { DoubleSide, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three'

import type { RGB } from '../biome'
import type { OceanName } from '../oceans'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { SprayBuilder } from './surf'

// Marine animals caught at the surface — the moments people photograph:
//
// - Dolphins (common and bottlenose) travel in pods, porpoising: arcing
//   clear of the water, or rolling at the surface with just the back and
//   dorsal fin showing. Warm and temperate seas worldwide.
// - Orcas: black and white, males with a dorsal fin up to 1.8 m tall; pods
//   in cold, rich water (Norway, Alaska, the Southern Ocean).
// - Humpback whales: 12–16 m, long white flippers; they migrate between polar
//   feeding grounds and tropical breeding grounds, so can be in any ocean.
//   Seen as a bushy blow, a humped back, the tail flukes raised before a deep
//   dive, or a full breach.
// - Swordfish (and marlin-like billfish): open-ocean hunters of warm and
//   temperate water that leap clear of the sea, bill first.
//
// Bodies are lofted along a spine (nose → tail on local −x), countershaded
// (dark back, pale belly), with fins, and posed by pitching the whole animal.
//
// The sea hides everything below the surface, so what shows is where the
// animal breaks it: wherever the body crosses the waterline the water is
// torn white (a collar of foam, drops thrown up — more for a fast leap), a
// leaper leaves a column of falling water and a foam patch where it left the
// sea, and a whale's breath hangs over it. Splashes are spray sprites
// (surf.ts), so they're soft and lit like the surf.

type Species = 'dolphin' | 'orca' | 'humpback' | 'swordfish'

interface Look {
  back: RGB
  belly: RGB
  fin: RGB
  /** Extra markings: return a colour or null for the plain countershading. */
  marking?: (t: number, up: number, side: number) => RGB | null
}

const LOOKS: Record<Species, Look> = {
  dolphin: { back: [0.06, 0.07, 0.08], belly: [0.55, 0.56, 0.56], fin: [0.05, 0.055, 0.06] },
  orca: {
    back: [0.012, 0.012, 0.014],
    belly: [0.7, 0.7, 0.68],
    fin: [0.012, 0.012, 0.014],
    marking: (t, up, side) => {
      // White eye patch behind the eye, grey saddle behind the dorsal fin.
      if (t > 0.13 && t < 0.25 && up > 0.05 && up < 0.6 && Math.abs(side) > 0.6) return [0.7, 0.7, 0.68]
      if (t > 0.48 && t < 0.62 && up > 0.75) return [0.2, 0.2, 0.21]
      return null
    }
  },
  humpback: {
    back: [0.03, 0.033, 0.038],
    belly: [0.35, 0.36, 0.36],
    fin: [0.6, 0.6, 0.58],
    // Barnacle-white knobs on the head.
    marking: (t, up) => (t < 0.18 && up > 0.6 && (Math.sin(t * 160) * Math.sin(up * 40)) > 0.75 ? [0.5, 0.5, 0.48] : null)
  },
  swordfish: { back: [0.03, 0.035, 0.07], belly: [0.45, 0.47, 0.5], fin: [0.03, 0.03, 0.06] }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

interface BodyShape {
  length: number
  /** Radius along the body (m), t = 0 at the nose … 1 at the tail. */
  radius: (t: number) => number
  /** Upward bend of the spine (m at mid-body): leaping animals arch. */
  arch: number
}

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

class Animal {
  private readonly b = new MeshBuilder()
  readonly spine: Vector3[] = []

  constructor(
    readonly shape: BodyShape,
    readonly look: Look
  ) {
    const n = 40
    for (let i = 0; i <= n; i++) {
      const t = i / n
      this.spine.push(new Vector3((0.5 - t) * shape.length, shape.arch * Math.sin(Math.PI * t), 0))
    }
    // MeshBuilder.tube along −x: angle 0 points up (back), π down (belly).
    this.b.tube(
      this.spine,
      shape.radius,
      (t, angle) => {
        const up = (1 + Math.cos(angle)) / 2
        const marked = look.marking?.(t, up, -Math.sin(angle))
        return marked ?? mix(look.belly, look.back, Math.min(1, Math.max(0, (up - 0.3) * 2.2)))
      },
      14
    )
  }

  /** Point on the body surface: t along it, `up` = −1 belly … 1 back. */
  surface(t: number, up: number, side = 0): Vector3 {
    const i = Math.min(this.spine.length - 1, Math.round(t * (this.spine.length - 1)))
    const r = this.shape.radius(t)
    return this.spine[i].clone().add(new Vector3(0, up * r, side * r))
  }

  fin(points: Vector3[], color: RGB = this.look.fin): void {
    const ids = points.map(p => this.b.vertex(p, color))
    for (let i = 1; i < ids.length - 1; i++) this.b.triangle(ids[0], ids[i], ids[i + 1])
  }

  /** Horizontal tail flukes (whales and dolphins). */
  flukes(span: number, chord: number, underside?: RGB): void {
    const root = this.spine[this.spine.length - 1]
    for (const side of [-1, 1]) {
      const pts = [
        root.clone().add(new Vector3(chord * 0.3, 0, 0)),
        root.clone().add(new Vector3(-chord * 0.2, 0, side * span * 0.35)),
        root.clone().add(new Vector3(-chord * 0.75, 0.02 * span, side * span * 0.5)),
        root.clone().add(new Vector3(-chord * 0.35, 0, side * span * 0.12)),
        root.clone().add(new Vector3(-chord * 0.2, 0, 0))
      ]
      this.fin(pts)
      // A thin second skin just below, for a pale underside.
      if (underside != null) this.fin(pts.map(p => p.clone().setY(p.y - 0.01 * span)).reverse(), underside)
    }
  }

  /** The mesh, with its spine and radii kept for finding the waterline. */
  build(): BufferGeometry {
    const geometry = this.b.build()
    geometry.userData.spine = this.spine
    geometry.userData.radii = this.spine.map((_, i) => this.shape.radius(i / (this.spine.length - 1)))
    return geometry
  }
}

function dolphin(rng: Random, arch: number): BufferGeometry {
  const length = rng.range(2.2, 2.8)
  const a = new Animal(
    {
      length,
      arch,
      radius: t =>
        profile([
          [0, 0.012],
          [0.07, 0.03],
          [0.12, 0.09],
          [0.25, 0.135],
          [0.5, 0.13],
          [0.8, 0.055],
          [0.95, 0.03],
          [1, 0.02]
        ])(t) * length
    },
    LOOKS.dolphin
  )
  // Falcate dorsal fin, pectorals, flukes.
  a.fin([a.surface(0.42, 0.95), a.surface(0.58, 0.9).add(new Vector3(-0.12, 0.33, 0)), a.surface(0.62, 0.9)])
  for (const side of [-1, 1]) {
    a.fin([a.surface(0.27, -0.3, side * 0.9), a.surface(0.33, -0.5, side * 1.4).add(new Vector3(-0.15, -0.08, side * 0.25)), a.surface(0.34, -0.3, side * 0.9)])
  }
  a.flukes(length * 0.24, length * 0.12)
  return a.build()
}

function orca(rng: Random, male: boolean): BufferGeometry {
  const length = male ? rng.range(7, 8.5) : rng.range(5.5, 6.5)
  const a = new Animal(
    {
      length,
      arch: 0,
      radius: t =>
        profile([
          [0, 0.04],
          [0.08, 0.11],
          [0.3, 0.15],
          [0.55, 0.14],
          [0.85, 0.06],
          [1, 0.03]
        ])(t) * length
    },
    LOOKS.orca
  )
  const fin = male ? rng.range(1.4, 1.8) : rng.range(0.7, 0.9)
  const lean = male ? 0.1 : 0.45
  a.fin([a.surface(0.36, 0.95), a.surface(0.4, 0.95).add(new Vector3(-fin * lean, fin, 0)), a.surface(0.52, 0.9)])
  for (const side of [-1, 1]) {
    a.fin([a.surface(0.2, -0.4, side * 0.9), a.surface(0.26, -0.6, side * 1.3).add(new Vector3(-0.3, -0.3, side * 0.6)), a.surface(0.28, -0.4, side * 0.9)])
  }
  a.flukes(length * 0.26, length * 0.1)
  return a.build()
}

function humpback(rng: Random): BufferGeometry {
  const length = rng.range(12, 15)
  const a = new Animal(
    {
      length,
      arch: 0,
      radius: t =>
        profile([
          [0, 0.03],
          [0.1, 0.09],
          [0.3, 0.13],
          [0.45, 0.12],
          [0.75, 0.05],
          [0.95, 0.025],
          [1, 0.02]
        ])(t) * length
    },
    LOOKS.humpback
  )
  // Small humped dorsal fin, very long white flippers, broad flukes with
  // a pale, individually patterned underside.
  a.fin([a.surface(0.6, 0.95), a.surface(0.64, 0.95).add(new Vector3(-0.3, 0.35, 0)), a.surface(0.68, 0.9)], LOOKS.humpback.back)
  for (const side of [-1, 1]) {
    const flipper = length * rng.range(0.28, 0.33)
    a.fin([
      a.surface(0.22, -0.3, side * 0.9),
      a.surface(0.24, -0.5, side).add(new Vector3(-flipper * 0.5, -flipper * 0.35, side * flipper * 0.8)),
      a.surface(0.24, -0.5, side).add(new Vector3(-flipper * 0.6, -flipper * 0.4, side * flipper * 0.75)),
      a.surface(0.3, -0.3, side * 0.9)
    ])
  }
  a.flukes(length * 0.32, length * 0.11, mix([0.62, 0.62, 0.6], LOOKS.humpback.back, rng.range(0, 0.6)))
  return a.build()
}

function swordfish(rng: Random): BufferGeometry {
  const length = rng.range(2.6, 3.8)
  const a = new Animal(
    {
      length,
      arch: 0,
      radius: t =>
        profile([
          [0, 0.004],
          [0.27, 0.012],
          [0.33, 0.06],
          [0.5, 0.085],
          [0.85, 0.035],
          [0.94, 0.012],
          [1, 0.01]
        ])(t) * length
    },
    LOOKS.swordfish
  )
  const h = length * 0.17
  // Tall sickle dorsal, pectorals, and the vertical crescent tail of a fish.
  a.fin([a.surface(0.38, 0.95), a.surface(0.39, 0.95).add(new Vector3(-h * 0.3, h, 0)), a.surface(0.42, 0.95).add(new Vector3(-h * 0.5, h * 0.75, 0)), a.surface(0.5, 0.9)])
  for (const side of [-1, 1]) {
    a.fin([a.surface(0.36, -0.5, side * 0.9), a.surface(0.4, -0.6, side).add(new Vector3(-h * 0.7, -h * 0.4, side * h * 0.3)), a.surface(0.42, -0.5, side * 0.9)])
  }
  const root = a.spine[a.spine.length - 1]
  for (const s of [-1, 1]) {
    a.fin([root.clone().add(new Vector3(0.05, 0, 0)), root.clone().add(new Vector3(-h * 0.6, s * h * 1.1, 0)), root.clone().add(new Vector3(-h * 0.25, s * h * 0.3, 0)), root.clone().add(new Vector3(-0.05, 0, 0))])
  }
  return a.build()
}

/** A mass of churned white water: big, nearly opaque puffs, densest and
 * highest in the middle. Lifted a little off the mean surface so wave
 * crests in front don't swallow it at grazing angles. */
function whitewater(spray: SprayBuilder, rng: Random, at: Vector3, radius: number, height: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const r = radius * Math.sqrt(rng.float())
    const a = rng.range(0, Math.PI * 2)
    const core = 1 - r / radius
    const y = 0.1 + height * core * rng.float() ** 1.5
    const p = at.clone().add(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
    spray.add(p, radius * rng.range(0.25, 0.5), rng.range(0.6, 0.95))
  }
}

/** White water where a body breaks the surface: a boil of foam, a crown of
 * drops thrown up and out, and mist; `energy` 0..1 scales it from a gentle
 * roll to a leap. */
function crown(spray: SprayBuilder, rng: Random, at: Vector3, size: number, energy: number): void {
  const height = size * (0.5 + 3 * energy)
  whitewater(spray, rng, at, size * (0.6 + energy), height * 0.4, Math.round(6 + 70 * energy))
  for (let i = 0, n = Math.round(60 + 600 * energy * size); i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const t = rng.float()
    const y = 0.1 + height * t * rng.range(0.3, 1)
    // Drops fly up and out: the crown widens with height.
    const r = size * (0.5 + 0.5 * rng.float()) * (1 + t * 0.8)
    spray.add(new Vector3(at.x + Math.cos(a) * r, at.y + y, at.z + Math.sin(a) * r), rng.range(0.04, 0.12), rng.range(0.6, 1) * (1 - 0.5 * t))
  }
  for (let i = 0, n = Math.round(4 + 20 * energy); i < n; i++) {
    const p = at.clone().add(new Vector3(rng.normal(0, size), height * rng.float() * 0.8, rng.normal(0, size)))
    spray.add(p, rng.range(0.5, 1) * size, rng.range(0.06, 0.14))
  }
  foam(spray, rng, at, size * (1.5 + energy))
}

/** A patch of foam on the water, densest in the middle; `stretch` drags it
 * out into a slick behind a moving animal. */
function foam(spray: SprayBuilder, rng: Random, at: Vector3, radius: number, stretch = new Vector3()): void {
  for (let i = 0, n = Math.round(30 + 40 * radius); i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = radius * Math.sqrt(rng.float())
    const p = at.clone().add(new Vector3(Math.cos(a) * r, rng.range(0.08, 0.2), Math.sin(a) * r))
    p.addScaledVector(stretch, rng.float())
    spray.add(p, radius * rng.range(0.2, 0.4), rng.range(0.3, 0.6))
  }
}

/** Water streaming back down where a leaper left the sea: a white column
 * collapsing into a boil of foam, with drops falling round it; `fresh` 1
 * just after it left … 0 when it has all fallen back. */
function exitSplash(spray: SprayBuilder, rng: Random, at: Vector3, size: number, fresh: number): void {
  const height = size * (0.6 + 2.6 * fresh)
  whitewater(spray, rng, at, size * (0.8 + 0.6 * (1 - fresh)), height, Math.round(30 + 60 * fresh))
  for (let i = 0, n = Math.round(400 * size * (0.3 + fresh)); i < n; i++) {
    const t = rng.float()
    const spread = size * (0.3 + 0.6 * t)
    const p = at.clone().add(new Vector3(rng.normal(0, spread), 0.1 + height * t ** 1.5, rng.normal(0, spread)))
    spray.add(p, rng.range(0.04, 0.1), rng.range(0.6, 1) * (1 - 0.5 * t))
  }
  foam(spray, rng, at, size * 2)
}

/** A whale's breath: a bushy column of mist widening as it rises. */
function blow(spray: SprayBuilder, rng: Random, at: Vector3, height: number): void {
  for (let i = 0; i < 260; i++) {
    const t = rng.float() ** 0.7
    const spread = 0.2 + t * height * 0.18
    const p = at.clone().add(new Vector3(rng.normal(0, spread), height * t, rng.normal(0, spread)))
    spray.add(p, 0.25 + t * height * 0.12, rng.range(0.08, 0.2))
  }
}

const SPECIES_BY_OCEAN: Record<OceanName, readonly (readonly [Species, number])[]> = {
  pacific: [['dolphin', 5], ['humpback', 3], ['swordfish', 2], ['orca', 1]],
  atlantic: [['dolphin', 5], ['humpback', 3], ['swordfish', 1.5], ['orca', 1]],
  indian: [['dolphin', 6], ['humpback', 2], ['swordfish', 2]],
  southern: [['orca', 3], ['humpback', 3], ['dolphin', 1]],
  arctic: [['orca', 2], ['humpback', 3]]
}

export function createMarineLife(ctx: PropContext): Object3D[] {
  const { params } = ctx
  const rng = ctx.rng('marine')
  if (!rng.chance(0.35) || params.storm != null) return []
  let table = SPECIES_BY_OCEAN[params.sea.ocean]
  // Orcas on warm-water coasts are rare; keep them to cooler ones.
  if (params.biome.name === 'tropical' || params.biome.name === 'desert') table = table.filter(([s]) => s !== 'orca')
  const species = rng.weighted(table)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: DoubleSide })
  const spray = new SprayBuilder()
  // Mostly side-on to the camera, the view that shows an animal's shape.
  const forward = ctx.camera.getWorldDirection(new Vector3())
  const heading =
    Math.atan2(-forward.z, forward.x) + (rng.chance(0.5) ? 1 : -1) * Math.PI / 2 + rng.normal(0, 0.35)
  const along = (yaw: number, distance: number): Vector3 => new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(distance)
  const objects: Object3D[] = []
  /** The point on the waves above or below `p`. */
  const onSea = (p: Vector3): Vector3 => p.clone().setY(ctx.seaLevel(p.x, p.z))

  /** Place a posed animal: `pitch` raises the nose (rad), `height` = height
   * of the body's middle above the water (m). Where its body crosses the
   * waterline, the water breaks white (`energy` 0..1: how hard). */
  const place = (geometry: BufferGeometry, at: Vector3, yaw: number, pitch: number, height: number, energy: number): Group => {
    const group = new Group()
    const mesh = new Mesh(geometry, material)
    mesh.castShadow = true
    mesh.quaternion.multiplyQuaternions(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), pitch)
    )
    mesh.position.set(0, height, 0)
    group.add(mesh)
    group.position.copy(onSea(at))
    group.updateMatrixWorld(true)
    objects.push(group)
    // The body pierces the surface along the runs of spine where its top is
    // above the water and its belly below; the water breaks white at both
    // ends of each run (around a leaper's body, or a rolling back).
    const spine = (geometry.userData.spine as Vector3[]).map(p => p.clone().applyMatrix4(mesh.matrixWorld))
    const radii = geometry.userData.radii as number[]
    const pierces = spine.map((p, i) => Math.abs(p.y - ctx.seaLevel(p.x, p.z)) < radii[i])
    for (let i = 0; i < spine.length; i++) {
      if (!pierces[i] || (pierces[i - 1] === true && pierces[i + 1] === true)) continue
      crown(spray, rng, onSea(spine[i]), Math.max(0.3, radii[i] * 1.6), energy)
    }
    return group
  }

  // Close enough to see, far enough not to be a portrait; a long lens
  // reaches further. If the frame has no sea that near, look further out.
  const lens = Math.min(2.5, Math.max(0.7, params.camera.focalLengthMm / 35))
  const [near, far] = species === 'humpback' ? [90, 500] : species === 'orca' ? [60, 350] : [40, 220]
  let center: Vector3 | null = null
  // Small animals are lost beyond about twice their range; whales carry.
  const tries = species === 'humpback' || species === 'orca' ? 240 : 120
  for (let i = 0; i < tries && center == null; i++) {
    const reach = lens * (1 + Math.floor(i / 60))
    center = ctx.seaPoint(rng, [-0.75, -0.05], near * lens, far * reach, 4)
  }
  if (center == null) return []

  switch (species) {
    case 'dolphin': {
      const pod = rng.int(3, 9)
      for (let i = 0; i < pod; i++) {
        const at = center.clone().add(new Vector3(rng.normal(0, 7), 0, rng.normal(0, 7)))
        if (ctx.ground(at.x, at.z) > -2) continue
        const yaw = heading + rng.normal(0, 0.15)
        if (rng.chance(0.45)) {
          // Leaping, somewhere on its arc (phase −1 leaving the water … 1
          // landing): water streams off where it left the sea, and the nose
          // throws up a splash where it goes back in.
          const phase = rng.range(-1, 1)
          const reach = rng.range(1.8, 2.6)
          const lift = rng.range(0.6, 1.3)
          place(dolphin(rng, 0.12), at.clone().add(along(yaw, phase * reach)), yaw, -phase * 0.7, (1 - phase * phase) * (0.6 + lift) - 0.15, 0.8)
          exitSplash(spray, rng, onSea(at.clone().add(along(yaw, -reach))), 0.9, (1 - phase) / 2)
        } else {
          // Rolling at the surface: back and fin above water, a little
          // white water where the head and tail stock break it.
          place(dolphin(rng, 0.05), at, yaw, rng.normal(0, 0.08), -0.15, 0.15)
          foam(spray, rng, onSea(at.clone().add(along(yaw, -1.2))), 0.5, along(yaw, -2))
        }
      }
      break
    }
    case 'orca': {
      const pod = rng.int(2, 6)
      for (let i = 0; i < pod; i++) {
        const at = center.clone().add(new Vector3(rng.normal(0, 12), 0, rng.normal(0, 12)))
        if (ctx.ground(at.x, at.z) > -3) continue
        const yaw = heading + rng.normal(0, 0.1)
        place(orca(rng, i === 0 || rng.chance(0.3)), at, yaw, rng.normal(0.03, 0.04), -0.6, 0.25)
        // Surfacing: a wash of white water off the head, a slick behind.
        foam(spray, rng, onSea(at.clone().add(along(yaw, -3))), 0.6, along(yaw, -4))
        if (rng.chance(0.5)) blow(spray, rng, onSea(at.clone().add(along(yaw, 1.5))), rng.range(1.5, 2.5))
      }
      break
    }
    case 'humpback': {
      const pose = rng.weighted([
        ['flukes', 4],
        ['breach', 2],
        ['blow', 3]
      ] as const)
      const geometry = humpback(rng)
      const length = 13.5
      if (pose === 'flukes') {
        // Diving: tail stock and flukes raised clear of the water, water
        // pouring off the trailing edge.
        const g = place(geometry, center, heading, -1.25, -length * 0.3, 0.35)
        const tail = (geometry.userData.spine as Vector3[]).at(-1)!.clone().applyMatrix4(g.children[0].matrixWorld)
        exitSplash(spray, rng, onSea(tail), 1.2, 0.3)
      } else if (pose === 'breach') {
        // Bursting out of the sea: a wall of white water round the body.
        place(geometry, center, heading, rng.range(0.9, 1.25), length * 0.12, 1)
        exitSplash(spray, rng, onSea(center), 3, 1)
      } else {
        // Surfacing: humped back, breath plume, a slick of foam.
        place(geometry, center, heading, 0.03, -length * 0.065, 0.3)
        blow(spray, rng, onSea(center.clone().add(along(heading, length * 0.3))).add(new Vector3(0, 0.5, 0)), rng.range(4, 6))
        foam(spray, rng, onSea(center.clone().add(along(heading, -length * 0.2))), 2, along(heading, -6))
      }
      break
    }
    case 'swordfish': {
      const phase = rng.range(-0.8, 0.4)
      place(swordfish(rng), center, heading, 0.4 - phase, rng.range(0.6, 1.4), 0.8)
      exitSplash(spray, rng, onSea(center.clone().add(along(heading, -1.5))), 0.6, (1 - phase) / 2)
      break
    }
  }
  const points = spray.build()
  if (points != null) objects.push(points)
  return objects
}
