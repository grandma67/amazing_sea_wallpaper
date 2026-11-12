// The bake for scripts/asset.mjs (NATURE_PLAN phase 11, steps 3–5): a scanned
// glTF model → vertex-coloured meshes at real size, one per glTF node (Poly
// Haven puts each variant of a plant in its own node), in a quantised TS
// module the props build synchronously (src/props/scans/). Pure functions over
// typed arrays; the image decode stays in asset.mjs (Chromium).
//
// 1. Alpha cut: scans of plants are cards whose alpha map draws the leaf or
//    petal. Edges are split until none is longer than `texel` texels in UV;
//    the triangles whose alpha (at the corners and centre) is mostly solid
//    stay. The silhouette is then the alpha's, at `texel` resolution.
// 2. Colour: the albedo (sRGB, calibrated on Poly Haven) at each vertex's UV.
// 3. Weld by position, simplify to `triangles` per variant (meshoptimizer,
//    colour as an attribute so petal and leaf edges hold), compact.
// 4. Emit: positions Int16 over the box, normals Int8, colours sRGB Uint8,
//    indices Uint16, base64.

import { MeshoptSimplifier } from 'meshoptimizer'

const COMPONENTS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

/** An accessor as a flat typed array (no sparse, no normalised ints). */
function accessor(gltf, bin, i) {
  const a = gltf.accessors[i]
  const view = gltf.bufferViews[a.bufferView]
  const T = COMPONENTS[a.componentType]
  const n = a.count * SIZE[a.type]
  if (view.byteStride != null && view.byteStride !== SIZE[a.type] * T.BYTES_PER_ELEMENT) throw new Error('interleaved accessors are not supported')
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return new T(bin.buffer.slice(bin.byteOffset + offset, bin.byteOffset + offset + n * T.BYTES_PER_ELEMENT))
}

/** Each node with a mesh: its primitives' positions (node rotation and scale
 * applied, not its translation: each variant at its own origin), normals, UVs
 * and indices. */
export function readNodes(gltf, bin) {
  const out = []
  for (const node of gltf.nodes ?? []) {
    if (node.mesh == null) continue
    if (node.rotation != null && node.rotation.some((v, i) => v !== (i === 3 ? 1 : 0))) throw new Error(`${node.name}: node rotation is not supported yet`)
    const s = node.scale ?? [1, 1, 1]
    const prims = gltf.meshes[node.mesh].primitives.map(p => {
      if (p.attributes.TEXCOORD_0 == null || p.attributes.NORMAL == null) throw new Error(`${node.name}: needs normals and UVs`)
      const pos = accessor(gltf, bin, p.attributes.POSITION)
      for (let i = 0; i < pos.length; i++) pos[i] *= s[i % 3]
      return { pos, nor: accessor(gltf, bin, p.attributes.NORMAL), uv: accessor(gltf, bin, p.attributes.TEXCOORD_0), index: Uint32Array.from(accessor(gltf, bin, p.indices)) }
    })
    out.push({ name: node.name, prims })
  }
  return out
}

/** An image as a sampler: bilinear, UV wraps, (0, 0) the top-left (glTF). */
export function sampler(w, h, data, channels = 4) {
  return (u, v, c) => {
    const x = (((u % 1) + 1) % 1) * w - 0.5
    const y = (((v % 1) + 1) % 1) * h - 0.5
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = x - x0, fy = y - y0
    const at = (xi, yi) => data[((((yi % h) + h) % h) * w + (((xi % w) + w) % w)) * channels + c]
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
  }
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/**
 * Steps 1–2 on one variant: the solid part of its cards as triangles with
 * position, normal and linear colour per vertex. `alpha(u, v)` 0..1 (null:
 * keep everything), `albedo(u, v, c)` sRGB 0..1.
 *
 * Refined by splitting every edge longer than `texel` texels at its midpoint,
 * pass after pass. The split is decided per edge, so both triangles on an
 * edge agree and the cut stays connected (a per-triangle grid left T-joins
 * between neighbours: every card fell into islands the simplifier couldn't
 * merge).
 */
export function alphaCut(prims, { alpha, albedo, w, h, texel = 4, threshold = 0.5, maxPasses = 10 }) {
  const P = [], N = [], C = [], I = []
  for (const { pos, nor, uv, index } of prims) {
    const V = { pos: Array.from(pos), nor: Array.from(nor), uv: Array.from(uv) }
    let tris = Array.from(index)
    const len = (a, b) => Math.hypot((V.uv[a * 2] - V.uv[b * 2]) * w, (V.uv[a * 2 + 1] - V.uv[b * 2 + 1]) * h)
    for (let pass = 0; pass < maxPasses; pass++) {
      const mid = new Map()
      const midpoint = (a, b) => {
        const key = a < b ? a * 4294967296 + b : b * 4294967296 + a
        let m = mid.get(key)
        if (m === undefined) {
          m = len(a, b) > texel ? V.pos.length / 3 : -1
          if (m >= 0) {
            for (let k = 0; k < 3; k++) V.pos.push((V.pos[a * 3 + k] + V.pos[b * 3 + k]) / 2)
            for (let k = 0; k < 3; k++) V.nor.push((V.nor[a * 3 + k] + V.nor[b * 3 + k]) / 2)
            for (let k = 0; k < 2; k++) V.uv.push((V.uv[a * 2 + k] + V.uv[b * 2 + k]) / 2)
          }
          mid.set(key, m)
        }
        return m
      }
      const next = []
      let split = 0
      for (let t = 0; t < tris.length; t += 3) {
        const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]]
        const [ab, bc, ca] = [midpoint(a, b), midpoint(b, c), midpoint(c, a)]
        const marks = (ab >= 0) + (bc >= 0) + (ca >= 0)
        if (marks > 0) split++
        if (marks === 0) next.push(a, b, c)
        else if (marks === 3) next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
        else if (marks === 1) {
          if (ab >= 0) next.push(a, ab, c, ab, b, c)
          else if (bc >= 0) next.push(a, b, bc, a, bc, c)
          else next.push(a, b, ca, ca, b, c)
        } else {
          // Two split edges: the corner between them, and the quad left split
          // along its shorter diagonal.
          const [x, y, z, xy, zx] = ab < 0 ? [c, a, b, ca, bc] : bc < 0 ? [a, b, c, ab, ca] : [b, c, a, bc, ab]
          next.push(x, xy, zx)
          if (len(xy, z) < len(zx, y)) next.push(xy, y, z, xy, z, zx)
          else next.push(xy, y, zx, zx, y, z)
        }
      }
      tris = next
      if (split === 0) break
    }
    // Keep the solid triangles (alpha at the corners and, three times, the centre).
    const base = P.length / 3
    const used = new Map()
    const vertex = i => {
      let id = used.get(i)
      if (id === undefined) {
        id = base + used.size
        used.set(i, id)
        for (let k = 0; k < 3; k++) P.push(V.pos[i * 3 + k])
        const n = [0, 1, 2].map(k => V.nor[i * 3 + k])
        const l = Math.hypot(...n) || 1
        N.push(n[0] / l, n[1] / l, n[2] / l)
        for (let k = 0; k < 3; k++) C.push(toLinear(albedo(V.uv[i * 2], V.uv[i * 2 + 1], k)))
      }
      return id
    }
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]]
      if (alpha != null) {
        let s = alpha(V.uv[a * 2], V.uv[a * 2 + 1]) + alpha(V.uv[b * 2], V.uv[b * 2 + 1]) + alpha(V.uv[c * 2], V.uv[c * 2 + 1])
        s += 3 * alpha((V.uv[a * 2] + V.uv[b * 2] + V.uv[c * 2]) / 3, (V.uv[a * 2 + 1] + V.uv[b * 2 + 1] + V.uv[c * 2 + 1]) / 3)
        if (s / 6 < threshold) continue
      }
      I.push(vertex(a), vertex(b), vertex(c))
    }
  }
  return { pos: Float32Array.from(P), nor: Float32Array.from(N), col: Float32Array.from(C), index: Uint32Array.from(I) }
}

/** Merge vertices at the same position (to `grid` m): normals averaged by
 * side, so a card's two faces don't cancel; the first colour kept. */
export function weld(mesh, grid = 1e-5) {
  const key = i => `${Math.round(mesh.pos[i * 3] / grid)},${Math.round(mesh.pos[i * 3 + 1] / grid)},${Math.round(mesh.pos[i * 3 + 2] / grid)}`
  const map = new Map(), remap = new Uint32Array(mesh.pos.length / 3)
  const P = [], N = [], C = []
  for (let i = 0; i < remap.length; i++) {
    const k = key(i)
    let id = map.get(k)
    if (id == null) {
      id = P.length / 3
      map.set(k, id)
      P.push(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2])
      N.push(mesh.nor[i * 3], mesh.nor[i * 3 + 1], mesh.nor[i * 3 + 2])
      C.push(mesh.col[i * 3], mesh.col[i * 3 + 1], mesh.col[i * 3 + 2])
    } else if (N[id * 3] * mesh.nor[i * 3] + N[id * 3 + 1] * mesh.nor[i * 3 + 1] + N[id * 3 + 2] * mesh.nor[i * 3 + 2] > 0) {
      for (let k = 0; k < 3; k++) N[id * 3 + k] += mesh.nor[i * 3 + k]
    }
    remap[i] = id
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1
    N[i] /= l; N[i + 1] /= l; N[i + 2] /= l
  }
  return { pos: Float32Array.from(P), nor: Float32Array.from(N), col: Float32Array.from(C), index: mesh.index.map(i => remap[i]) }
}

/** Step 3: simplify until the error reaches `error` (a share of the mesh's
 * size), at most `triangles`; colour as an attribute; drop unused vertices.
 * By error, not count: a big plant needs more triangles to keep its flower
 * stalks than a small one (a fixed 1000 cut variant a's flowers off). */
export async function simplify(mesh, triangles, error = 0.012, colourWeight = 0.5) {
  await MeshoptSimplifier.ready
  const run = (count, err) => MeshoptSimplifier.simplifyWithAttributes(mesh.index, mesh.pos, 3, mesh.col, 3, [colourWeight, colourWeight, colourWeight], null, Math.min(mesh.index.length, count * 3), err, ['Prune'])
  let [index, reached] = run(3, error)
  if (index.length > triangles * 3) [index, reached] = run(triangles, 1)
  const [remap, count] = MeshoptSimplifier.compactMesh(index)
  const pick = (src, dim) => {
    const out = new Float32Array(count * dim)
    for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) for (let k = 0; k < dim; k++) out[remap[i] * dim + k] = src[i * dim + k]
    return out
  }
  return { pos: pick(mesh.pos, 3), nor: pick(mesh.nor, 3), col: pick(mesh.col, 3), index, error: reached }
}

/** Base on y = 0, centred on its footprint in x and z. */
export function seat(mesh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.pos.length; i++) (lo[i % 3] = Math.min(lo[i % 3], mesh.pos[i])), (hi[i % 3] = Math.max(hi[i % 3], mesh.pos[i]))
  const shift = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
  const pos = mesh.pos.map((v, i) => v - shift[i % 3])
  return { ...mesh, pos, size: hi.map((h, i) => h - lo[i]) }
}

const toSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const b64 = arr => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64')

/** Step 4: one variant, quantised. */
export function quantise(mesh) {
  const lo = [0, 1, 2].map(k => Math.min(...mesh.pos.filter((_, i) => i % 3 === k)))
  const hi = [0, 1, 2].map(k => Math.max(...mesh.pos.filter((_, i) => i % 3 === k)))
  const scale = hi.map((h, k) => Math.max(h - lo[k], 1e-6) / 65534)
  const pos = Int16Array.from(mesh.pos, (v, i) => Math.round((v - lo[i % 3]) / scale[i % 3]) - 32767)
  const nor = Int8Array.from(mesh.nor, v => Math.round(Math.max(-1, Math.min(1, v)) * 127))
  const col = Uint8Array.from(mesh.col, v => Math.round(Math.max(0, Math.min(1, toSrgb(v))) * 255))
  if (mesh.pos.length / 3 > 65535) throw new Error('more than 65535 vertices: Uint16 indices')
  return { offset: lo.map((v, k) => +(v + 32767 * scale[k]).toPrecision(9)), scale: scale.map(v => +v.toPrecision(9)), pos: b64(pos), nor: b64(nor), col: b64(col), index: b64(Uint16Array.from(mesh.index)) }
}
