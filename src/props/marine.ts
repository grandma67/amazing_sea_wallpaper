import { DoubleSide, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three'

import type { RGB } from '../biome'
import type { OceanName } from '../oceans'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

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

  build(): BufferGeometry {
    return this.b.build()
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

/** White water where an animal breaks the surface: a crown of spray. */
function splash(rng: Random, size: number, height: number): BufferGeometry {
  const b = new MeshBuilder()
  const white: RGB = [0.8, 0.82, 0.84]
  const count = Math.round(40 + size * 30)
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2)
    const y = height * rng.float() ** 2
    // Drops fly up and out: the crown widens with height.
    const r = size * rng.range(0.3, 0.9) * (1 + (y / Math.max(height, 0.01)) * 0.6)
    const s = size * rng.range(0.025, 0.07) * (1 - (y / Math.max(height, 0.01)) * 0.5)
    b.blob(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new Vector3(s, s * rng.range(0.6, 1.4), s), () => white, () => rng.range(0.8, 1.15), 3)
  }
  // Foam disc on the water.
  b.blob(new Vector3(0, 0, 0), new Vector3(size * 1.1, 0.03, size * 1.1), () => white, () => 1, 6)
  return b.build()
}

/** A white plume of breath above a surfacing whale. */
function blow(rng: Random, height: number): BufferGeometry {
  const b = new MeshBuilder()
  const mist: RGB = [0.75, 0.77, 0.8]
  for (let i = 0; i < 26; i++) {
    const y = height * rng.float() ** 0.7
    const spread = 0.25 + (y / height) * height * 0.22
    const s = 0.25 + (y / height) * height * 0.12
    b.blob(new Vector3(rng.normal(0, spread * 0.4), y, rng.normal(0, spread * 0.4)), new Vector3(s, s, s), () => mist, () => rng.range(0.85, 1.15), 3)
  }
  return b.build()
}

const SPECIES_BY_OCEAN: Record<OceanName, readonly (readonly [Species, number])[]> = {
  pacific: [['dolphin', 5], ['humpback', 3], ['swordfish', 2], ['orca', 1]],
  atlantic: [['dolphin', 5], ['humpback', 3], ['swordfish', 1.5], ['orca', 1]],
  indian: [['dolphin', 6], ['humpback', 2], ['swordfish', 2]],
  southern: [['orca', 3], ['humpback', 3], ['dolphin', 1]],
  arctic: [['orca', 2], ['humpback', 3]]
}

export function createMarineLife(ctx: PropContext): Group[] {
  const { params } = ctx
  const rng = ctx.rng('marine')
  if (!rng.chance(0.35) || params.storm != null) return []
  let table = SPECIES_BY_OCEAN[params.sea.ocean]
  // Orcas on warm-water coasts are rare; keep them to cooler ones.
  if (params.biome.name === 'tropical' || params.biome.name === 'desert') table = table.filter(([s]) => s !== 'orca')
  const species = rng.weighted(table)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: DoubleSide })
  const foam = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
  // Mostly side-on to the camera, the view that shows an animal's shape.
  const forward = ctx.camera.getWorldDirection(new Vector3())
  const heading =
    Math.atan2(-forward.z, forward.x) + (rng.chance(0.5) ? 1 : -1) * Math.PI / 2 + rng.normal(0, 0.35)
  const groups: Group[] = []

  /** Place a posed animal: `pitch` raises the nose (rad), `height` = height
   * of the body's middle above the water (m). */
  const place = (geometry: BufferGeometry, at: Vector3, yaw: number, pitch: number, height: number): Group => {
    const group = new Group()
    const mesh = new Mesh(geometry, material)
    mesh.castShadow = true
    mesh.quaternion.multiplyQuaternions(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), pitch)
    )
    mesh.position.set(0, height, 0)
    group.add(mesh)
    group.position.copy(at)
    groups.push(group)
    return group
  }
  const addSplash = (group: Group, size: number, height: number, offset = new Vector3()): void => {
    const s = new Mesh(splash(rng, size, height), foam)
    s.position.copy(offset)
    group.add(s)
  }

  // Close enough to see, far enough not to be a portrait.
  const [near, far] = species === 'humpback' ? [100, 1000] : species === 'orca' ? [50, 500] : [30, 250]
  let center: Vector3 | null = null
  for (let i = 0; i < 80 && center == null; i++) center = ctx.seaPoint(rng, [-0.75, -0.05], near, far, 4)
  if (center == null) return []

  switch (species) {
    case 'dolphin': {
      const pod = rng.int(3, 9)
      for (let i = 0; i < pod; i++) {
        const at = center.clone().add(new Vector3(rng.normal(0, 7), 0, rng.normal(0, 7)))
        if (ctx.ground(at.x, at.z) > -2) continue
        const yaw = heading + rng.normal(0, 0.15)
        if (rng.chance(0.45)) {
          // Leaping: clear of the water at some point on the arc.
          const phase = rng.range(-1, 1)
          const g = place(dolphin(rng, 0.12), at, yaw, -phase * 0.7, 0.6 + (1 - phase * phase) * rng.range(0.6, 1.3))
          if (Math.abs(phase) > 0.55) addSplash(g, 0.9, 0.8, new Vector3(phase * 1.2, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw))
        } else {
          // Rolling at the surface: back and fin above water.
          place(dolphin(rng, 0.05), at, yaw, rng.normal(0, 0.08), -0.12)
        }
      }
      break
    }
    case 'orca': {
      const pod = rng.int(2, 6)
      for (let i = 0; i < pod; i++) {
        const at = center.clone().add(new Vector3(rng.normal(0, 12), 0, rng.normal(0, 12)))
        if (ctx.ground(at.x, at.z) > -3) continue
        place(orca(rng, i === 0 || rng.chance(0.3)), at, heading + rng.normal(0, 0.1), rng.normal(0, 0.05), -0.85)
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
        // Diving: tail stock and flukes raised clear of the water.
        const g = place(geometry, center, heading, -1.25, -length * 0.3)
        addSplash(g, 1.6, 0.6)
      } else if (pose === 'breach') {
        const g = place(geometry, center, heading, rng.range(0.9, 1.25), length * 0.12)
        addSplash(g, 4, 3.5)
      } else {
        // Surfacing: humped back, breath plume.
        const g = place(geometry, center, heading, 0.03, -length * 0.1)
        const plume = new Mesh(blow(rng, rng.range(4, 6)), foam)
        plume.position.set(length * 0.3, 0.5, 0).applyAxisAngle(new Vector3(0, 1, 0), heading)
        g.add(plume)
      }
      break
    }
    case 'swordfish': {
      const g = place(swordfish(rng), center, heading, rng.range(0.7, 1.2), rng.range(0.8, 1.6))
      addSplash(g, 1.2, 1.2, new Vector3(-0.6, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), heading))
      break
    }
  }
  return groups
}
