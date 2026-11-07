// CPU mirrors of the integer-hash noise in TERRAIN_GLSL (terrain.ts): the
// same bits on the CPU and GPU, so props can stand on the shader's terrain
// and sit on its stones (beach.ts stoneCell).

export function hashCell(x: number, y: number): number {
  const px = (x + (1 << 20)) >>> 0
  const py = (y + (1 << 20)) >>> 0
  let n = (Math.imul(px, 1597334677) ^ Math.imul(py, 3812015801)) >>> 0
  n ^= n >>> 16
  n = Math.imul(n, 2246822519) >>> 0
  n ^= n >>> 13
  n = Math.imul(n, 3266489917) >>> 0
  n ^= n >>> 16
  return n >>> 0
}

export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const v00 = hashCell(ix, iy) / 4294967295
  const v10 = hashCell(ix + 1, iy) / 4294967295
  const v01 = hashCell(ix, iy + 1) / 4294967295
  const v11 = hashCell(ix + 1, iy + 1) / 4294967295
  const a = v00 + (v10 - v00) * ux
  const b = v01 + (v11 - v01) * ux
  return a + (b - a) * uy
}

export function fbm(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  for (let i = 0; i < 4; i++) {
    sum += amp * vnoise(x, y)
    x = x * 2.03 + 17.1
    y = y * 2.03 + 9.3
    amp *= 0.5
  }
  return sum / 0.9375
}

/** The hills inland of a shore, `mask` of the way in (0: no noise to pay for). */
export function hillNoise(hillHeight: number, mask: number, qx: number, qz: number): number {
  if (mask <= 0 || hillHeight === 0) return 0
  return hillHeight * mask * (0.25 + 0.75 * fbm(qx / 450, qz / 450)) * smoothstep(-0.2, 1, fbm(qx / 1400 + 7, qz / 1400 + 7))
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
