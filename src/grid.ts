import { BufferAttribute, BufferGeometry, type Camera, Vector3 } from 'three'

/**
 * A flat polar grid around the origin (where the camera sits), with rings
 * spaced geometrically so triangles stay roughly constant in screen size from
 * the camera's feet to the horizon. With `span` < 2π it is a wedge from
 * angle `start` (radians, x = r cos a, z = r sin a) over `span`, with
 * `segments` cells across it.
 */
export function createPolarGrid({
  rings = 520,
  segments = 900,
  innerRadius = 0.25,
  outerRadius = 120_000,
  start = 0,
  span = Math.PI * 2
} = {}): BufferGeometry {
  const growth = (outerRadius / innerRadius) ** (1 / (rings - 1))
  const closed = span >= Math.PI * 2
  // A wedge needs one more column of vertices than cells; a full circle wraps.
  const columns = closed ? segments : segments + 1
  const step = (closed ? Math.PI * 2 : span) / segments

  const positions = new Float32Array((rings * columns + 1) * 3)
  // Centre vertex at index 0.
  let p = 3
  for (let i = 0; i < rings; i++) {
    const r = innerRadius * growth ** i
    for (let j = 0; j < columns; j++) {
      const a = start + j * step
      positions[p++] = r * Math.cos(a)
      positions[p++] = 0
      positions[p++] = r * Math.sin(a)
    }
  }

  const index = new Uint32Array(segments * 3 + (rings - 1) * segments * 6)
  let k = 0
  const next = (j: number): number => (closed ? (j + 1) % segments : j + 1)
  for (let j = 0; j < segments; j++) {
    index[k++] = 0
    index[k++] = 1 + next(j)
    index[k++] = 1 + j
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = 1 + i * columns + j
      const b = 1 + i * columns + next(j)
      const c = 1 + (i + 1) * columns + j
      const d = 1 + (i + 1) * columns + next(j)
      index[k++] = a
      index[k++] = b
      index[k++] = c
      index[k++] = b
      index[k++] = d
      index[k++] = c
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  return geometry
}

/** Radial growth per ring (Δr / r) of a grid like createPolarGrid's. */
export function ringStep(rings: number, innerRadius: number, outerRadius: number): number {
  return Math.log(outerRadius / innerRadius) / (rings - 1)
}

/**
 * The angles of ground the camera can see, as a wedge round the origin
 * (createPolarGrid's angle: x = r cos a, z = r sin a), widened by `margin`
 * (radians) each side. The camera stands at x = z = 0, so a ray's ground
 * point has the ray's own azimuth: the frame's border gives the range.
 */
export function viewWedge(camera: Camera, margin: number): { start: number; span: number } {
  camera.updateMatrixWorld()
  const forward = camera.getWorldDirection(new Vector3())
  const centre = Math.atan2(forward.z, forward.x)
  const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld)
  const point = new Vector3()
  let lo = 0
  let hi = 0
  const n = 8
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n
    for (const [x, y] of [[t, -1], [t, 1], [-1, t], [1, t]]) {
      point.set(x, y, 0.5).unproject(camera).sub(eye)
      if (Math.hypot(point.x, point.z) < 1e-9) continue
      const rel = Math.atan2(point.z, point.x) - centre
      const a = Math.atan2(Math.sin(rel), Math.cos(rel))
      lo = Math.min(lo, a)
      hi = Math.max(hi, a)
    }
  }
  const span = hi - lo + 2 * margin
  if (span >= Math.PI * 2) return { start: 0, span: Math.PI * 2 }
  return { start: centre + lo - margin, span }
}

/**
 * Rings and segments for `vertices` grid vertices over `span` radians with
 * near-square cells (Δr / r ≈ the angle between segments), so a steep face
 * crossing the cells at a slant spans as many of them either way.
 */
export function squareGrid(vertices: number, span: number, innerRadius: number, outerRadius: number): { rings: number; segments: number } {
  const log = Math.log(outerRadius / innerRadius)
  const rings = Math.max(2, Math.round(Math.sqrt((vertices * log) / span)))
  return { rings, segments: Math.max(3, Math.round(vertices / rings)) }
}
