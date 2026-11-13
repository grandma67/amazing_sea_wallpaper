import { Box3, Triangle, Vector3, type BufferGeometry } from 'three'

// Shape integrity for prop meshes built from parts (tubes, blobs, fans): no
// part floating free of the rest, no open tube end you can see into. Catches
// what sizes and budgets don't: crab legs off the shell (0.163), a sea lion's
// hind flipper hanging in the air and open seal and lizard snouts (0.164).

interface Part {
  vertices: number[]
  triangles: number[][]
  box: Box3
}

/** The mesh's connected parts (triangles sharing vertices). */
export function parts(g: BufferGeometry): Part[] {
  const p = g.attributes.position
  const index = g.index?.array ?? Array.from({ length: p.count }, (_, i) => i)
  const parent = Array.from({ length: p.count }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < index.length; i += 3) {
    const a = find(index[i])
    parent[find(index[i + 1])] = a
    parent[find(index[i + 2])] = a
  }
  const byRoot = new Map<number, Part>()
  const v = new Vector3()
  for (let i = 0; i < index.length; i += 3) {
    const root = find(index[i])
    let part = byRoot.get(root)
    if (part == null) byRoot.set(root, (part = { vertices: [], triangles: [], box: new Box3() }))
    part.triangles.push([index[i], index[i + 1], index[i + 2]])
  }
  for (const part of byRoot.values()) {
    const seen = new Set<number>()
    for (const t of part.triangles) for (const k of t) if (!seen.has(k)) (seen.add(k), part.vertices.push(k), part.box.expandByPoint(v.fromBufferAttribute(p, k)))
  }
  return [...byRoot.values()]
}

const size = (g: BufferGeometry): number => {
  g.computeBoundingBox()
  return g.boundingBox!.getSize(new Vector3()).length()
}

/** Distance from a point to the nearest triangle of a part. */
function distanceToPart(g: BufferGeometry, point: Vector3, part: Part): number {
  const p = g.attributes.position
  const tri = new Triangle()
  const closest = new Vector3()
  let best = Infinity
  for (const [a, b, c] of part.triangles) {
    tri.set(new Vector3().fromBufferAttribute(p, a), new Vector3().fromBufferAttribute(p, b), new Vector3().fromBufferAttribute(p, c))
    best = Math.min(best, tri.closestPointToPoint(point, closest).distanceTo(point))
  }
  return best
}

/** Whether `point` is inside a part: a ray along +z, or one about +y,
 * crosses its surface an odd number of times (works for a tube with open
 * ends, cast sideways). */
function inside(g: BufferGeometry, point: Vector3, part: Part): boolean {
  if (!part.box.containsPoint(point)) return false
  const p = g.attributes.position
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const e1 = new Vector3()
  const e2 = new Vector3()
  const h = new Vector3()
  const s = new Vector3()
  const q = new Vector3()
  const odd = (dir: Vector3): boolean => {
    let hits = 0
    for (const [i, j, k] of part.triangles) {
      a.fromBufferAttribute(p, i)
      b.fromBufferAttribute(p, j)
      c.fromBufferAttribute(p, k)
      e1.subVectors(b, a)
      e2.subVectors(c, a)
      h.crossVectors(dir, e2)
      const det = e1.dot(h)
      if (Math.abs(det) < 1e-12) continue
      s.subVectors(point, a)
      const u = s.dot(h) / det
      if (u < 0 || u > 1) continue
      q.crossVectors(s, e1)
      const v = dir.dot(q) / det
      if (v < 0 || u + v > 1) continue
      if (e2.dot(q) / det > 1e-9) hits++
    }
    return hits % 2 === 1
  }
  return odd(new Vector3(0, 0, 1)) || odd(new Vector3(0.0123, 1, 0.0071).normalize())
}

/** Parts not joined (within `tolerance` × the mesh's size) to the largest
 * one, directly or through other parts: each as its box's centre. */
export function looseParts(g: BufferGeometry, tolerance = 0.004): Vector3[] {
  const all = parts(g)
  if (all.length < 2) return []
  const tol = tolerance * size(g)
  const p = g.attributes.position
  const touches = (a: Part, b: Part): boolean => {
    if (!a.box.clone().expandByScalar(tol).intersectsBox(b.box)) return false
    const [small, big] = a.vertices.length <= b.vertices.length ? [a, b] : [b, a]
    const v = new Vector3()
    // Touching: a vertex of one on the other's surface, or inside it (a fan
    // rooted in a tube's open end, a leg starting inside a body).
    return small.vertices.some(k => distanceToPart(g, v.fromBufferAttribute(p, k), big) <= tol || inside(g, v, big)) || big.vertices.some(k => inside(g, v.fromBufferAttribute(p, k), small))
  }
  const main = all.reduce((m, q) => (q.triangles.length > m.triangles.length ? q : m))
  const joined = new Set([main])
  for (let grew = true; grew; ) {
    grew = false
    for (const q of all) if (!joined.has(q) && [...joined].some(j => touches(q, j))) (joined.add(q), (grew = true))
  }
  return all.filter(q => !joined.has(q)).map(q => q.box.getCenter(new Vector3()))
}

/** Open edge loops you could see into: a boundary loop (edges of one
 * triangle only, so fans drawn both ways don't count) that is a tube's open
 * end (5+ edges, round, on a part that isn't itself flat: a one-sided fin
 * or crest has an outline, not a hole), at least `minSize` × the mesh's
 * size across, above its lowest `ground` share (a leg's end on the sand),
 * and not plugged by another part. Each as its centre. */
export function openHoles(g: BufferGeometry, minSize = 0.02, ground = 0.02): Vector3[] {
  const p = g.attributes.position
  const index = g.index?.array ?? Array.from({ length: p.count }, (_, i) => i)
  // Weld by position first: a blob's seam repeats a column of vertices, so
  // its edges would read as open though the surface is closed.
  const weld = new Map<string, number>()
  const id = Array.from({ length: p.count }, (_, k) => {
    // Rounded to µm, -0 as 0 (toFixed writes a seam's -2e-16 as "-0.000000").
    const key = [p.getX(k), p.getY(k), p.getZ(k)].map(c => Math.round(c * 1e6) || 0).join(',')
    const hit = weld.get(key)
    if (hit != null) return hit
    weld.set(key, k)
    return k
  })
  const count = new Map<string, [number, number]>()
  for (let i = 0; i < index.length; i += 3) {
    const [x, y, z] = [id[index[i]], id[index[i + 1]], id[index[i + 2]]]
    // A blob's pole triangles collapse once welded: no edges of their own.
    if (x === y || y === z || z === x) continue
    for (const [a, b] of [[x, y], [y, z], [z, x]]) {
      const key = a < b ? `${a},${b}` : `${b},${a}`
      const hit = count.get(key)
      count.set(key, hit == null ? [a, b] : [-1, -1])
    }
  }
  const next = new Map<number, number[]>()
  for (const [a, b] of count.values()) {
    if (a < 0) continue
    next.set(a, [...(next.get(a) ?? []), b])
    next.set(b, [...(next.get(b) ?? []), a])
  }
  const s = size(g)
  g.computeBoundingBox()
  const floor = g.boundingBox!.min.y
  const all = parts(g)
  const normal = (t: number[]): Vector3 => new Triangle(new Vector3().fromBufferAttribute(p, t[0]), new Vector3().fromBufferAttribute(p, t[1]), new Vector3().fromBufferAttribute(p, t[2])).getNormal(new Vector3())
  const flat = (part: Part): boolean => {
    const n = normal(part.triangles[0])
    return part.triangles.every(t => Math.abs(normal(t).dot(n)) > 0.99)
  }
  const seen = new Set<number>()
  const holes: Vector3[] = []
  const v = new Vector3()
  for (const start of next.keys()) {
    if (seen.has(start)) continue
    const loop: number[] = []
    const stack = [start]
    while (stack.length > 0) {
      const k = stack.pop()!
      if (seen.has(k)) continue
      seen.add(k)
      loop.push(k)
      for (const n of next.get(k) ?? []) if (!seen.has(n)) stack.push(n)
    }
    const box = new Box3()
    for (const k of loop) box.expandByPoint(v.fromBufferAttribute(p, k))
    const across = box.getSize(new Vector3()).length()
    const centre = box.getCenter(new Vector3())
    if (loop.length < 5 || across < minSize * s || box.min.y < floor + ground * s) continue
    // Round: every point about as far from the centre (a tube's end).
    const radii = loop.map(k => v.fromBufferAttribute(p, k).distanceTo(centre))
    const mean = radii.reduce((x, y) => x + y) / radii.length
    if (radii.some(r => Math.abs(r - mean) > mean * 0.45)) continue
    const own = all.find(q => q.vertices.includes(loop[0]))
    if (own == null || flat(own)) continue
    const plugged = all.some(q => q !== own && (inside(g, centre, q) || distanceToPart(g, centre, q) < across * 0.3))
    if (!plugged) holes.push(Object.assign(centre, { across, edges: loop.length, partTriangles: own.triangles.length }))
  }
  return holes
}
