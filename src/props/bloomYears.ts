import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'

import { BLOOM_LEAF, BLOOM_LOOK, desertBloomFor, type BloomPlant } from '../bloomYears'
import { fbm, hashCell } from '../cellNoise'
import { Random } from '../random'
import { terrainNormal, worldToShore } from '../terrain'
import { tideMarks } from '../tides'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { scanIfLoaded } from './scans'
import { scanGeometry } from './scans/scan'
import { plantMaterial } from './vegetation'

// Bloom years' plants near the viewer (NATURE_PLAN phase 16; the choice is
// bloomYears.ts): flowering annuals in patches on the land behind the shore,
// fixed in the world by hash. Far off, the terrain and a range's lower slopes
// carry the tint (terrain.ts, props/landforms.ts).

export { BLOOM_LOOK, BLOOM_PLANTS, BLOOM_REGIONS, bloomRegion, bloomYear, desertBloomFor, type BloomPlant, type BloomRegion, type DesertBloom } from '../bloomYears'

/** A flowering desert annual: a low rosette, flowers on short stalks.
 * Base on y = 0, about `size` across. ~150–400 triangles. */
export function bloomPlantGeometry(plant: BloomPlant, variant: number): BufferGeometry {
  const look = BLOOM_LOOK[plant]
  const rng = new Random(`bloom:${plant}:${variant}`)
  const b = new MeshBuilder()
  const leaf = BLOOM_LEAF
  const R = look.size / 2
  // Rosette: a few short leaves lying out from the centre, under the
  // flowers (the first render's long dark blades read as weeds).
  for (let i = 0; i < rng.int(4, 6); i++) {
    const a = rng.range(0, Math.PI * 2)
    const len = R * rng.range(0.4, 0.7)
    const path = [0, 0.5, 1].map(t => new Vector3(Math.cos(a) * len * t, 0.02 + 0.03 * Math.sin(Math.PI * t), Math.sin(a) * len * t))
    b.ribbon(path, t => 0.025 * Math.sin(Math.PI * (0.15 + 0.85 * t)) + 0.004, leaf)
  }
  const n = rng.int(look.flowers[0], look.flowers[1])
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = R * Math.sqrt(rng.float()) * 0.8
    const top = new Vector3(Math.cos(a) * r, rng.range(0.06, 0.16) * (look.size / 0.3), Math.sin(a) * r)
    b.tube([new Vector3(top.x * 0.3, 0, top.z * 0.3), top], () => 0.0018, () => [0.06, 0.09, 0.03], 3)
    // The flower: a ring of petals round a centre, facing up (a daisy's
    // rays flat, a cup's tilted up).
    const f = look.flower * rng.range(0.8, 1.2)
    const petals = look.daisy ? 12 : 6
    const centre = b.vertex(top.clone().add(new Vector3(0, 0.003, 0)), look.centre)
    const ring: number[] = []
    for (let k = 0; k < petals; k++) {
      const t = (k / petals) * Math.PI * 2
      const lift = look.daisy ? 0.002 : f * 0.35
      ring.push(b.vertex(top.clone().add(new Vector3(Math.cos(t) * f * 0.5, lift, Math.sin(t) * f * 0.5)), look.petal))
    }
    const inner = ring.map((_, k) => {
      const t = ((k + 0.5) / petals) * Math.PI * 2
      return b.vertex(top.clone().add(new Vector3(Math.cos(t) * f * 0.18, 0.003, Math.sin(t) * f * 0.18)), look.petal)
    })
    for (let k = 0; k < petals; k++) {
      b.triangle(centre, inner[k], ring[(k + 1) % petals])
      b.triangle(inner[k], ring[k], ring[(k + 1) % petals])
      b.triangle(centre, ring[k], inner[k])
    }
  }
  const g = b.build()
  g.userData.kind = plant
  return g
}

const VARIANTS = 3
/** Patch cells (m), plants per cell at full strength (est.: a carpet is
 * tens of plants per m²; these are the ones a camera resolves), range. */
const CELL = 1.5
const PER_CELL = 7
const RANGE = 80
const MIN_PIXELS = 2
export const MAX_BLOOM = 5000

const U32 = 4294967295
const h = (a: number, b: number, salt: number): number => hashCell(a * 37 + salt * 7919, b * 29 - salt * 104729) / U32

/**
 * The flowering plants near the camera: in patches (a 25 m noise, about half
 * the land) on the land behind the shore, above the spring tide line, on
 * gentle ground; each by hash of its cell. The orange daisy is Poly Haven's
 * Ursinia scan when loaded (`loadScan` before building, scene.ts), else the
 * procedural plant.
 */
export function createDesertBloom(ctx: PropContext): InstancedMesh[] {
  const bloom = desertBloomFor(ctx.params)
  if (bloom == null) return []
  const { coast } = ctx.params
  const [ox, oz] = coast.noiseOffset
  const start = coast.rock != null ? coast.rock.backWidth + 2 : coast.beachWidth * 0.8
  const dry = tideMarks(coast).spring + coast.runup + 0.4
  const cam = ctx.camera.position
  const scan = scanIfLoaded('ph_flower_ursinia')
  const groups = new Map<string, { geometry: BufferGeometry; items: Matrix4[] }>()
  const pick = (u: number): BloomPlant => {
    let acc = 0
    for (const [p, w] of bloom.plants) if (u < (acc += w)) return p
    return bloom.plants[bloom.plants.length - 1][0]
  }
  let count = 0
  const [c0, c1] = [Math.floor((cam.x + ox - RANGE) / CELL), Math.floor((cam.x + ox + RANGE) / CELL)]
  const [r0, r1] = [Math.floor((cam.z + oz - RANGE) / CELL), Math.floor((cam.z + oz + RANGE) / CELL)]
  for (let j = r0; j <= r1 && count < MAX_BLOOM; j++)
    for (let i = c0; i <= c1 && count < MAX_BLOOM; i++) {
      const [qx, qz] = [(i + 0.5) * CELL, (j + 0.5) * CELL]
      const [cx, cz] = [qx - ox, qz - oz]
      const d = ctx.distance(cx, cz)
      if (d > RANGE || 0.3 / (Math.max(d, 0.5) * ctx.pixelAngle) < MIN_PIXELS) continue
      const patch = fbm(qx / 25 + 301, qz / 25 + 307) * 0.7 + fbm(qx / 6 + 311, qz / 6 + 313) * 0.3
      if (patch < 0.5) continue
      const n = Math.round(PER_CELL * bloom.strength * Math.min(1, (patch - 0.5) / 0.1))
      for (let k = 0; k < n && count < MAX_BLOOM; k++) {
        const [x, z] = [cx + (h(i, j, k * 5 + 1) - 0.5) * CELL, cz + (h(i, j, k * 5 + 2) - 0.5) * CELL]
        const [s] = worldToShore(coast, x, z)
        if (-s < start) continue
        const y = ctx.ground(x, z)
        if (y < dry || terrainNormal(coast, x, z, 0.4)[1] < 0.8) continue
        const plant = pick(h(i, j, k * 5 + 3))
        const variant = Math.floor(h(i, j, k * 5 + 4) * VARIANTS)
        const size = 0.8 + 0.4 * h(i, j, k * 5 + 5)
        if (!ctx.visible(x, y, z, 0.3)) continue
        // Near, the scan's finer level; it's real size already.
        const useScan = plant === 'orange-daisy' && scan != null
        const lod = useScan && ctx.distance(x, z) > 8 ? 1 : 0
        const key = useScan ? `scan/${variant}/${lod}` : `${plant}/${variant}`
        if (!groups.has(key)) groups.set(key, { geometry: useScan ? scanGeometry(scan, variant, lod) : bloomPlantGeometry(plant, variant), items: [] })
        const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), h(i, j, k * 5 + 6) * Math.PI * 2)
        groups.get(key)!.items.push(new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(size, size, size)))
        count++
      }
    }
  const material = plantMaterial()
  const meshes: InstancedMesh[] = []
  for (const [key, { geometry, items }] of groups) {
    const mesh = new InstancedMesh(geometry, material, items.length)
    items.forEach((m, k) => {
      mesh.setMatrixAt(k, m)
      mesh.setColorAt(k, new Color(1, 1, 1))
    })
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.userData.kind = key.startsWith('scan') ? 'orange-daisy' : key.split('/')[0]
    meshes.push(mesh)
  }
  return meshes
}
