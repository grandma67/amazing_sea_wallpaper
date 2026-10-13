// Seeded 3D value noise for shaping procedural geometry on the CPU.

function hash3(x: number, y: number, z: number, seed: number): number {
  let n = Math.imul(x | 0, 1597334677) ^ Math.imul(y | 0, 3812015801) ^ Math.imul(z | 0, 2798796415)
  n ^= Math.imul(seed | 0, 2246822519)
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
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz, seed)
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz
  )
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
