import { BufferAttribute, BufferGeometry } from 'three'

// Baked scans (NATURE_PLAN phase 11; `node scripts/asset.mjs bake ID`): each
// module in this folder is one scanned model's variants, each at several
// levels of detail, quantised, with its licence. Loaded on demand
// (index.ts loadScan: a chunk of its own on the page), built synchronously.

export interface ScanLod {
  /** Position = q × scale + offset (q: Int16), metres, base on y = 0. */
  offset: readonly [number, number, number]
  scale: readonly [number, number, number]
  /** base64: Int16 xyz, Int8 normals (/127), Uint8 sRGB colours, Uint16 indices. */
  pos: string
  nor: string
  col: string
  index: string
}

export interface Scan {
  id: string
  source: { page: string; licence: string; author: string }
  /** Real size of each variant (m): x, y (height), z. */
  sizes: readonly (readonly [number, number, number])[]
  /** Each variant's levels of detail, finest first (all on the same base). */
  variants: readonly { lods: readonly ScanLod[] }[]
}

function bytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const cache = new Map<ScanLod, BufferGeometry>()

/** A variant at a level of detail (0 finest; past the last, the last) as a
 * vertex-coloured geometry (linear colours), base on y = 0. Shared: clone it
 * before changing it. */
export function scanGeometry(scan: Scan, variant: number, lod = 0): BufferGeometry {
  const lods = scan.variants[variant % scan.variants.length].lods
  const v = lods[Math.min(lod, lods.length - 1)]
  const hit = cache.get(v)
  if (hit != null) return hit
  const q = new Int16Array(bytes(v.pos).buffer)
  const pos = new Float32Array(q.length)
  for (let i = 0; i < q.length; i++) pos[i] = q[i] * v.scale[i % 3] + v.offset[i % 3]
  const n8 = new Int8Array(bytes(v.nor).buffer)
  const nor = Float32Array.from(n8, x => x / 127)
  const col = Float32Array.from(bytes(v.col), x => toLinear(x / 255))
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setIndex(new BufferAttribute(new Uint16Array(bytes(v.index).buffer), 1))
  cache.set(v, g)
  return g
}
