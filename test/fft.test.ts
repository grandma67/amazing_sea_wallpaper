import { describe, expect, it } from 'vitest'

import { ifft2d } from '../src/fft'
import { Random } from '../src/random'

/** Direct O(n⁴) evaluation of f(x) = Σ_k F(k) e^{ik·x}. */
function naive(re: Float64Array, im: Float64Array, n: number): [Float64Array, Float64Array] {
  const outRe = new Float64Array(n * n)
  const outIm = new Float64Array(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      for (let ky = 0; ky < n; ky++)
        for (let kx = 0; kx < n; kx++) {
          const a = (2 * Math.PI * (kx * x + ky * y)) / n
          const c = Math.cos(a)
          const s = Math.sin(a)
          const i = ky * n + kx
          outRe[y * n + x] += re[i] * c - im[i] * s
          outIm[y * n + x] += re[i] * s + im[i] * c
        }
  return [outRe, outIm]
}

describe('ifft2d', () => {
  it('matches the direct inverse DFT', () => {
    const n = 8
    const rng = new Random('fft')
    const re = Float64Array.from({ length: n * n }, () => rng.normal())
    const im = Float64Array.from({ length: n * n }, () => rng.normal())
    const [wantRe, wantIm] = naive(re, im, n)
    ifft2d(re, im, n)
    for (let i = 0; i < n * n; i++) {
      expect(re[i]).toBeCloseTo(wantRe[i], 9)
      expect(im[i]).toBeCloseTo(wantIm[i], 9)
    }
  })

  it('turns a single frequency into a plane wave', () => {
    const n = 16
    const re = new Float64Array(n * n)
    const im = new Float64Array(n * n)
    re[1 * n + 2] = 1 // kx = 2, ky = 1
    ifft2d(re, im, n)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) expect(re[y * n + x]).toBeCloseTo(Math.cos((2 * Math.PI * (2 * x + y)) / n), 9)
  })
})
