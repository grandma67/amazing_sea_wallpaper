import {
  BufferAttribute,
  Color,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry
} from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

import type { RGB } from '../biome'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { fbm3 } from './noise'

// Sea ice for the polar oceans (see oceans.ts): Arctic pack ice — flat,
// snow-covered floes with open leads between them — and icebergs: irregular,
// peaked glacier bergs in the Arctic, flat-topped tabular bergs calved from
// Antarctic ice shelves in the Southern Ocean.

const SNOW: RGB = [0.8, 0.82, 0.85]
const ICE: RGB = [0.38, 0.58, 0.68]
const DEEP_ICE: RGB = [0.18, 0.4, 0.52]

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

/** Star-shaped outline of unit size: radius per angle with seeded wobble. */
function outline(rng: Random, points: number, elongation: number, roughness: number): [number, number][] {
  const seed = rng.int(0, 100_000)
  const phase = rng.range(0, Math.PI * 2)
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2
    const r = 1 - roughness + roughness * 2 * fbm3(Math.cos(a) * 1.5, Math.sin(a) * 1.5, phase, seed)
    return [Math.cos(a) * r * elongation, Math.sin(a) * r] as [number, number]
  })
}

/** A slab: flat top at `top`, sides down to `bottom`, from an outline. */
function slab(
  b: MeshBuilder,
  shape: [number, number][],
  top: number,
  bottom: number,
  topColor: (x: number, z: number) => RGB,
  sideColor: (x: number, y: number, z: number) => RGB,
  sideRows = 1
): void {
  const centre = b.vertex(new Vector3(0, top, 0), topColor(0, 0))
  const rim = shape.map(([x, z]) => b.vertex(new Vector3(x, top, z), topColor(x, z)))
  for (let i = 0; i < rim.length; i++) b.triangle(centre, rim[(i + 1) % rim.length], rim[i])
  // Sides (separate vertices so the top edge stays crisp).
  const rows: number[][] = []
  for (let r = 0; r <= sideRows; r++) {
    const t = r / sideRows
    const y = top + (bottom - top) * t
    // Undercut a little toward the waterline and below.
    const inset = 1 - 0.06 * t
    rows.push(shape.map(([x, z]) => b.vertex(new Vector3(x * inset, y, z * inset), sideColor(x, y, z))))
  }
  for (let r = 0; r < sideRows; r++) {
    for (let i = 0; i < shape.length; i++) {
      const j = (i + 1) % shape.length
      b.quad(rows[r][i], rows[r][j], rows[r + 1][j], rows[r + 1][i])
    }
  }
}

/** A pack-ice floe, unit radius, ~0.3 m freeboard. */
function floe(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const seed = rng.int(0, 100_000)
  const shape = outline(rng, rng.int(9, 16), rng.range(1, 1.8), rng.range(0.15, 0.35))
  slab(
    b,
    shape,
    0.3,
    -0.8,
    // Snow with drifts and the odd grey, wet patch.
    (x, z) => mix(SNOW, [0.55, 0.62, 0.68], 0.5 * Math.max(0, fbm3(x * 2, 0, z * 2, seed) - 0.45) * 2),
    (_x, y) => mix(ICE, SNOW, Math.max(0, (y + 0.1) * 2))
  )
  return b.build()
}

/** An irregular Arctic glacier berg: domes and pinnacles, blue crevasses. */
function glacierBerg(rng: Random): BufferGeometry {
  const geometry = mergeVertices(new IcosahedronGeometry(1, 14))
  const position = geometry.attributes.position as BufferAttribute
  const seed = rng.int(0, 100_000)
  const peak = rng.range(1, 2.2)
  // Calving and melting leave flat fracture faces and sheer walls.
  const planes = Array.from({ length: rng.int(5, 9) }, () => ({
    n: new Vector3(rng.normal(), rng.normal() * 0.5, rng.normal()).normalize(),
    d: rng.range(0.55, 0.85)
  }))
  const colors = new Float32Array(position.count * 3)
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const ridges = 1 - Math.abs(fbm3(v.x * 2.2, v.y * 2.2, v.z * 2.2, seed) * 2 - 1)
    const r = 0.75 + 0.45 * fbm3(v.x * 1.1, v.y * 1.1, v.z * 1.1, seed + 3) + 0.15 * ridges
    v.multiplyScalar(r)
    let cut = 0
    for (const { n, d } of planes) {
      const over = v.dot(n) - d
      if (over > 0) {
        v.addScaledVector(n, -over)
        cut += over
      }
    }
    // Taller above the water, a flat underside hidden below it.
    if (v.y > 0) v.y *= peak * (0.7 + 0.6 * fbm3(v.x * 0.8, 0, v.z * 0.8, seed + 5))
    else v.y = Math.max(v.y, -0.3)
    position.setXYZ(i, v.x, v.y, v.z)
    // Wave-worn, bluer ice at the waterline; blue in the crevasses.
    const waterline = Math.max(0, 1 - Math.abs(v.y) * 6)
    // Fresh fracture faces show clear blue glacier ice; old surfaces are white.
    const fresh = Math.min(1, cut * 4)
    const c = mix(
      mix(mix(SNOW, ICE, Math.max(0, 0.75 - ridges) * 1.2), ICE, fresh * 0.7),
      DEEP_ICE,
      waterline * 0.6
    )
    colors.set(c, i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** A tabular Antarctic berg: a flat-topped slab with sheer, banded cliffs. */
function tabularBerg(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const seed = rng.int(0, 100_000)
  const shape = outline(rng, 48, rng.range(2, 4.5), rng.range(0.05, 0.12))
  slab(
    b,
    shape,
    1,
    -0.3,
    (x, z) => mix(SNOW, [0.7, 0.74, 0.8], fbm3(x * 0.6, 0, z * 3, seed) * 0.4),
    // Annual snow layers show as faint horizontal bands; bluer low down.
    (x, y, z) => {
      const band = 0.5 + 0.5 * Math.sin(y * 40 + 4 * fbm3(x, y, z, seed + 1))
      return mix(mix([0.68, 0.74, 0.8], [0.6, 0.67, 0.74], band * 0.4), ICE, Math.max(0, 0.45 - y) * 0.9)
    },
    6
  )
  return b.build()
}

export function createIce(ctx: PropContext): (Mesh | InstancedMesh)[] {
  const ice = ctx.params.sea.ice
  if (ice == null) return []
  const rng = ctx.rng('ice')
  const camera = ctx.camera
  const objects: (Mesh | InstancedMesh)[] = []

  /** A random point on the open sea in view, `distance` range in metres. */
  const seaPoint = (ndcY: [number, number], minDistance: number, maxDistance: number): Vector3 | null => {
    const ndc = new Vector3(rng.range(-1.05, 1.05), rng.range(...ndcY), 0.5)
    const dir = ndc.unproject(camera).sub(camera.position).normalize()
    if (dir.y >= -0.0003) return null
    const distance = -camera.position.y / dir.y
    if (distance < minDistance || distance > maxDistance) return null
    const p = camera.position.clone().addScaledVector(dir, distance).setY(0)
    return ctx.ground(p.x, p.z) < -0.6 ? p : null
  }

  if (ice.packIce > 0) {
    const variants = Array.from({ length: 6 }, () => floe(rng))
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
    const placed: Matrix4[][] = variants.map(() => [])
    const seed = rng.int(0, 100_000)
    // fbm sits around 0.5 ± 0.15: map the cover fraction onto that range.
    const threshold = 0.5 + (0.5 - ice.packIce) * 0.4
    for (let i = 0; i < 14000; i++) {
      const p = seaPoint([-1, 0.1], 6, 5000)
      if (p == null) continue
      // Ice lies in fields broken by open leads.
      const field = fbm3(p.x / 400, 0, p.z / 400, seed) * 0.7 + fbm3(p.x / 90, 0, p.z / 90, seed + 1) * 0.3
      if (field < threshold) continue
      // Roughly constant size on screen: floes further away are drawn bigger,
      // which also matches the eye's sense of a wide ice field.
      const distance = ctx.distance(p.x, p.z)
      const size = Math.max(1, distance * rng.range(0.005, 0.016))
      const q = new Quaternion().setFromEuler(new Euler(rng.normal(0, 0.01), rng.range(0, Math.PI * 2), rng.normal(0, 0.01)))
      placed[rng.int(0, variants.length - 1)].push(
        new Matrix4().compose(p.setY(rng.range(-0.05, 0.05)), q, new Vector3(size, Math.min(2.5, 1 + size * 0.02), size))
      )
    }
    variants.forEach((geometry, v) => {
      if (placed[v].length === 0) return
      const mesh = new InstancedMesh(geometry, material, placed[v].length)
      placed[v].forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, new Color().setScalar(rng.range(0.85, 1.05)))
      })
      mesh.receiveShadow = true
      mesh.castShadow = true
      mesh.frustumCulled = false
      objects.push(mesh)
    })
  }

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })
  for (let n = 0; n < ice.bergs; n++) {
    const tabular = ice.bergKind === 'tabular'
    for (let tries = 0; tries < 60; tries++) {
      const p = tabular ? seaPoint([-0.2, 0.05], 2500, 18000) : seaPoint([-0.45, 0.05], 600, 7000)
      if (p == null) continue
      const mesh = new Mesh(tabular ? tabularBerg(rng) : glacierBerg(rng), material)
      const scale = tabular
        ? new Vector3().setScalar(rng.range(150, 450)).setY(rng.range(25, 50))
        : new Vector3().setScalar(rng.range(15, 55)).setY(rng.range(12, 40))
      mesh.position.copy(p)
      mesh.scale.copy(scale)
      mesh.rotation.y = rng.range(0, Math.PI * 2)
      mesh.castShadow = true
      mesh.receiveShadow = true
      objects.push(mesh)
      break
    }
  }
  return objects
}
