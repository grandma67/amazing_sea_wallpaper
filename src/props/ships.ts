import {
  DoubleSide,
  Euler,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry
} from 'three'

import type { RGB } from '../biome'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

// Vessels on the water: sailboats, small fishing boats and distant cargo
// ships. Built with their waterline at y = 0 and bow toward +X.

/** A hull lofted from U-shaped sections, with a flat deck. */
function hull(b: MeshBuilder, length: number, beam: number, freeboard: number, draft: number, color: RGB, deck: RGB): void {
  const stations = 14
  const around = 9
  const rings: number[][] = []
  const deckLeft: number[] = []
  const deckRight: number[] = []
  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const x = (t - 0.5) * length
    // Fine bow, fuller stern with a transom.
    const width = beam * 0.5 * Math.max(0.02, t < 0.6 ? 0.75 + 0.25 * Math.sin((t / 0.6) * Math.PI * 0.5) : 1 - ((t - 0.6) / 0.4) ** 1.6)
    const depth = draft * (0.4 + 0.6 * Math.sin(Math.min(t, 0.95) * Math.PI))
    const sheer = freeboard * (1 + 0.35 * t * t)
    const ring: number[] = []
    for (let k = 0; k <= around; k++) {
      // U-shaped section: 0 = left deck edge, π = right deck edge.
      const a = (k / around) * Math.PI
      const y = sheer - (sheer + depth) * Math.sin(a) ** 0.6
      const z = -width * Math.cos(a)
      ring.push(b.vertex(new Vector3(x, y, z), color))
    }
    rings.push(ring)
    deckLeft.push(b.vertex(new Vector3(x, sheer, -width), deck))
    deckRight.push(b.vertex(new Vector3(x, sheer, width), deck))
  }
  for (let i = 0; i < stations; i++) {
    for (let k = 0; k < around; k++) {
      b.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1])
    }
    b.quad(deckLeft[i], deckRight[i], deckRight[i + 1], deckLeft[i + 1])
  }
}

function box(b: MeshBuilder, min: Vector3, max: Vector3, color: RGB): void {
  const v = (x: number, y: number, z: number): number =>
    b.vertex(new Vector3(x ? max.x : min.x, y ? max.y : min.y, z ? max.z : min.z), color)
  // Separate vertices per face for flat shading.
  const faces: [number, number, number][][] = [
    [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
  ]
  for (const face of faces) {
    const [a, c, d, e] = face.map(([x, y, z]) => v(x, y, z))
    b.quad(a, c, d, e)
  }
}

function sailboat(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(8, 14)
  const hullColor: RGB = rng.pick<RGB>([
    [0.75, 0.75, 0.72],
    [0.06, 0.1, 0.2],
    [0.5, 0.06, 0.05]
  ])
  hull(b, length, length * 0.32, length * 0.1, length * 0.12, hullColor, [0.4, 0.3, 0.2])
  const mastX = length * 0.08
  const mastHeight = length * 1.35
  const deckY = length * 0.1
  b.tube([new Vector3(mastX, deckY, 0), new Vector3(mastX, deckY + mastHeight, 0)], () => 0.07, () => [0.6, 0.6, 0.6], 5)
  const sail: RGB = rng.chance(0.85) ? [0.85, 0.84, 0.8] : rng.pick<RGB>([[0.7, 0.25, 0.1], [0.15, 0.2, 0.5]])
  // Mainsail: luff on the mast, foot along the boom, with a little camber.
  const camber = rng.range(0.2, 0.6)
  const head = b.vertex(new Vector3(mastX, deckY + mastHeight * 0.97, 0), sail)
  const tack = b.vertex(new Vector3(mastX, deckY + 1.0, 0), sail)
  const clew = b.vertex(new Vector3(mastX - length * 0.45, deckY + 1.1, camber * 0.8), sail)
  const mid = b.vertex(new Vector3(mastX - length * 0.2, deckY + mastHeight * 0.4, camber), sail)
  b.triangle(head, tack, mid)
  b.triangle(tack, clew, mid)
  b.triangle(head, mid, clew)
  // Jib from the masthead to the bow.
  const jibHead = b.vertex(new Vector3(mastX, deckY + mastHeight * 0.8, 0), sail)
  const jibTack = b.vertex(new Vector3(length * 0.48, deckY + 0.3, 0), sail)
  const jibClew = b.vertex(new Vector3(mastX + length * 0.05, deckY + 0.6, camber * 1.3), sail)
  b.triangle(jibHead, jibTack, jibClew)
  return b.build()
}

function fishingBoat(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(7, 12)
  const color = rng.pick<RGB>([
    [0.1, 0.25, 0.45],
    [0.55, 0.1, 0.06],
    [0.7, 0.7, 0.66],
    [0.15, 0.35, 0.2]
  ])
  hull(b, length, length * 0.36, length * 0.13, length * 0.1, color, [0.35, 0.3, 0.25])
  const deckY = length * 0.13
  box(b, new Vector3(-length * 0.15, deckY, -length * 0.12), new Vector3(length * 0.12, deckY + length * 0.22, length * 0.12), [0.8, 0.8, 0.78])
  b.tube([new Vector3(0, deckY, 0), new Vector3(0, deckY + length * 0.55, 0)], () => 0.05, () => [0.3, 0.3, 0.3], 4)
  return b.build()
}

function freighter(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const length = rng.range(140, 260)
  const beam = length * 0.14
  const hullColor = rng.pick<RGB>([
    [0.25, 0.04, 0.03],
    [0.04, 0.06, 0.12],
    [0.05, 0.05, 0.05]
  ])
  hull(b, length, beam, length * 0.06, length * 0.05, hullColor, [0.3, 0.12, 0.08])
  const deckY = length * 0.06
  // Superstructure at the stern.
  box(b, new Vector3(-length * 0.47, deckY, -beam * 0.42), new Vector3(-length * 0.38, deckY + length * 0.12, beam * 0.42), [0.85, 0.85, 0.82])
  // Container stacks.
  const palette: RGB[] = [
    [0.55, 0.1, 0.06],
    [0.1, 0.25, 0.5],
    [0.6, 0.45, 0.1],
    [0.15, 0.4, 0.2],
    [0.6, 0.6, 0.58],
    [0.45, 0.2, 0.1]
  ]
  const bays = Math.floor(length * 0.75 / 13)
  for (let i = 0; i < bays; i++) {
    const x0 = -length * 0.36 + i * 13
    const tiers = rng.int(2, 6)
    for (let r = -2; r <= 2; r++) {
      if (!rng.chance(0.85)) continue
      const z0 = r * beam * 0.18
      box(
        b,
        new Vector3(x0, deckY, z0 - beam * 0.08),
        new Vector3(x0 + 12, deckY + tiers * 2.6, z0 + beam * 0.08),
        rng.pick(palette)
      )
    }
  }
  return b.build()
}

export function createShips(ctx: PropContext): Mesh[] {
  const { params } = ctx
  const rng = ctx.rng('ships')
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: DoubleSide })
  const meshes: Mesh[] = []
  const camera = ctx.camera
  const windAz = (params.ocean.windHeadingDeg * Math.PI) / 180

  const launch = (geometry: BufferGeometry, minDistance: number, maxDistance: number, sailing: boolean): void => {
    for (let tries = 0; tries < 40; tries++) {
      // Aim somewhere in the lower half of the frame's sea area.
      const ndc = new Vector3(rng.range(-0.85, 0.85), rng.range(-0.6, 0.0), 0.5)
      const dir = ndc.unproject(camera).sub(camera.position).normalize()
      if (dir.y >= -0.0005) continue
      // Intersect with the sea plane.
      const distance = -camera.position.y / dir.y
      if (distance < minDistance || distance > maxDistance) continue
      const position = camera.position.clone().addScaledVector(dir, distance).setY(0)
      if (ctx.ground(position.x, position.z) > -3) continue
      const heading = sailing ? windAz + rng.range(0.6, 1.4) * (rng.chance(0.5) ? 1 : -1) : rng.range(0, Math.PI * 2)
      const heel = sailing ? rng.range(0.06, 0.3) : rng.normal(0, 0.02)
      const mesh = new Mesh(geometry, material)
      mesh.position.copy(position)
      mesh.quaternion.setFromEuler(new Euler(heel, -heading + Math.PI / 2, rng.normal(0, 0.02), 'YXZ'))
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshes.push(mesh)
      return
    }
  }

  if (rng.chance(0.5)) {
    for (let i = rng.int(1, 3); i > 0; i--) launch(sailboat(rng), 150, 3000, true)
  }
  if (rng.chance(0.25)) {
    for (let i = rng.int(1, 2); i > 0; i--) launch(fishingBoat(rng), 120, 2500, false)
  }
  if (rng.chance(0.3)) launch(freighter(rng), 4000, 16000, false)

  return meshes
}
