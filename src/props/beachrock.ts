import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, Vector3 } from 'three'

import type { RGB } from '../biome'
import type { Random } from '../random'
import { shoreToWorld, worldToShore } from '../terrain'
import { tideMarks, waterlineAt } from '../tides'
import type { PropContext } from './context'
import { rockMaterial } from './rocks'
import { snowLook } from './snowCap'

// Beachrock (PLAN_BIOMES 7): beach sand cemented by calcium carbonate in the
// intertidal zone of warm, micro-tidal beaches, then bared as the beach
// retreats. It crops out along the waterline as flat, grey ledges dipping
// seaward at about the beach slope, cracked across into slabs a few metres
// long, often in two or three steps (Vousdoukas et al. 2007). On ~30% of
// reef beaches (reef.ts `beachrock`).

/** Unit slab (1 × 1 m in plan, 1 m thick), base on y = 0: an irregular
 * seven-sided outline, its top a little uneven and its edges rounded off.
 * About 20 triangles. */
export function slabGeometry(rng: Random): BufferGeometry {
  const n = 7
  const outline: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = ((i + rng.range(-0.2, 0.2)) / n) * Math.PI * 2
    // A rounded rectangle: |cos|, |sin| pushed out to the corners.
    const c = Math.cos(t)
    const s = Math.sin(t)
    const r = 1 / Math.max(Math.abs(c), Math.abs(s)) ** 0.6
    outline.push([0.5 * c * r * rng.range(0.85, 1), 0.5 * s * r * rng.range(0.85, 1)])
  }
  const top = outline.map(() => rng.range(0.85, 1))
  const positions: number[] = []
  const colors: number[] = []
  const tri = (a: number[], b: number[], c: number[], shade: number): void => {
    positions.push(...a, ...b, ...c)
    for (let k = 0; k < 3; k++) colors.push(shade, shade, shade)
  }
  // Top: a fan, lighter (dry and weathered); sides darker.
  const centre = [0, 1, 0]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a = [outline[i][0], top[i], outline[i][1]]
    const b = [outline[j][0], top[j], outline[j][1]]
    tri(centre, b, a, 1)
    const a0 = [outline[i][0] * 1.05, 0, outline[i][1] * 1.05]
    const b0 = [outline[j][0] * 1.05, 0, outline[j][1] * 1.05]
    tri(a, b, b0, 0.7)
    tri(a, b0, a0, 0.7)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Cemented coral sand: grey with a brown cast (linear albedo). */
const BEACHROCK_COLOR: RGB = [0.3, 0.28, 0.24]
const VARIANTS = 4
const MAX_SLABS = 600
/** Farther than this a 2 m ledge 20 cm high is a few pixels. */
const MAX_DISTANCE = 250

export function createBeachrock(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast } = params
  if (coast.reef?.beachrock !== true || params.overrides?.beachrock === false) return []
  const rng = ctx.rng('beachrock')
  // The ledges straddle mean sea: from 0.3 m above it to 0.3 m below.
  const upper = waterlineAt(coast, 0.3)
  const lower = waterlineAt(coast, -0.3)
  const [, camA] = worldToShore(coast, ctx.camera.position.x, ctx.camera.position.z)
  const outcrops = rng.int(2, 4)
  const slabs: { x: number; z: number; along: Vector3; seaward: Vector3; length: number; width: number; thickness: number; shade: number }[] = []
  for (let outcrop = 0, tries = 0; outcrop < outcrops && tries < 200; tries++) {
    const start = camA + rng.range(-300, 300)
    const [x, z] = shoreToWorld(coast, (upper + lower) / 2, start)
    if (ctx.distance(x, z) > MAX_DISTANCE || !ctx.visible(x, 0, z, 10)) continue
    outcrop++
    const run = rng.range(20, 80)
    const rows = rng.int(1, 3)
    for (let row = 0; row < rows; row++) {
      // Rows step down seaward; each starts a little further along.
      const s = upper + ((lower - upper) * (row + 0.5)) / rows
      const width = rng.range(1, 2.5)
      let a = start + rng.range(-3, 3)
      while (a < start + run && slabs.length < MAX_SLABS) {
        const length = rng.range(1.5, 5)
        const mid = a + length / 2
        const [px, pz] = shoreToWorld(coast, s + rng.range(-0.3, 0.3), mid)
        const [ax, az] = shoreToWorld(coast, s, mid + 1)
        const [sx, sz] = shoreToWorld(coast, s + 1, mid)
        const along = new Vector3(ax - px, 0, az - pz).normalize()
        const seaward = new Vector3(sx - px, 0, sz - pz).normalize()
        slabs.push({ x: px, z: pz, along, seaward, length, width, thickness: rng.range(0.15, 0.35), shade: rng.range(0.8, 1.15) })
        // Joints between slabs.
        a += length + rng.range(0.2, 0.6)
        if (rng.chance(0.1)) a += rng.range(2, 8)
      }
    }
  }
  if (slabs.length === 0) return []

  const material = rockMaterial([1, 1, 1], coast.runup, null, tideMarks(coast).spring, snowLook(ctx.params))
  const variants = Array.from({ length: VARIANTS }, () => slabGeometry(rng))
  const meshes = variants.map((geometry, v) => {
    const mine = slabs.filter((_, i) => i % VARIANTS === v)
    const mesh = new InstancedMesh(geometry, material, Math.max(1, mine.length))
    mesh.count = mine.length
    const m = new Matrix4()
    const up = new Vector3(0, 1, 0)
    const color = new Color()
    mine.forEach((slab, i) => {
      // Dip seaward a little more steeply than the beach (5–12°), and sit
      // half buried in the sand.
      const dip = Math.atan(coast.beachSlope) * 0.5 + rng.range(0.09, 0.2)
      const y = up.clone().multiplyScalar(Math.cos(dip)).addScaledVector(slab.seaward, Math.sin(dip))
      const zAxis = slab.seaward.clone().multiplyScalar(Math.cos(dip)).addScaledVector(up, -Math.sin(dip))
      const xAxis = new Vector3().crossVectors(y, zAxis).normalize()
      m.makeBasis(xAxis.multiplyScalar(slab.length), y.multiplyScalar(slab.thickness), zAxis.multiplyScalar(slab.width))
      m.setPosition(slab.x, ctx.ground(slab.x, slab.z) - 0.45 * slab.thickness, slab.z)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, color.setRGB(...BEACHROCK_COLOR).multiplyScalar(slab.shade))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    return mesh
  })
  return meshes.filter(m => m.count > 0)
}
