// Seeded 3D value noise for shaping procedural geometry on the CPU.

/** `n`: the corner's coordinates and seed, multiplied and xored (noise3). */
function hash3(n: number): number {
  n ^= n >>> 15
  n = Math.imul(n, 2246822519)
  n ^= n >>> 13
  n = Math.imul(n, 3266489917)
  n ^= n >>> 16
  return (n >>> 0) / 4294967295
}

export function noise3(x: number, y: number, z: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const x0 = Math.imul(ix | 0, 1597334677)
  const x1 = Math.imul((ix + 1) | 0, 1597334677)
  const s = Math.imul(seed | 0, 2246822519)
  const y0 = Math.imul(iy | 0, 3812015801) ^ s
  const y1 = Math.imul((iy + 1) | 0, 3812015801) ^ s
  const z0 = Math.imul(iz | 0, 2798796415)
  const z1 = Math.imul((iz + 1) | 0, 2798796415)
  const near = lerp(lerp(hash3(x0 ^ y0 ^ z0), hash3(x1 ^ y0 ^ z0), ux), lerp(hash3(x0 ^ y1 ^ z0), hash3(x1 ^ y1 ^ z0), ux), uy)
  const far = lerp(lerp(hash3(x0 ^ y0 ^ z1), hash3(x1 ^ y0 ^ z1), ux), lerp(hash3(x0 ^ y1 ^ z1), hash3(x1 ^ y1 ^ z1), ux), uy)
  return lerp(near, far, uz)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Fractal noise in [0, 1]. */
export function fbm3(x: number, y: number, z: number, seed = 0, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x, y, z, seed + i * 101)
    norm += amp
    x *= 2.03
    y *= 2.03
    z *= 2.03
    amp *= 0.5
  }
  return sum / norm
}
