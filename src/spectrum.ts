import { DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three'

import { ifft2d } from './fft'
import type { SceneParams } from './params'
import { Random } from './random'

// Ocean surface synthesis (Tessendorf, "Simulating Ocean Water"): a JONSWAP
// wind-sea spectrum with Mitsuyasu directional spreading plus a narrow swell
// peak, sampled on three nested FFT cascades so no single tile repeats
// visibly. Everything is computed once on the CPU for a frozen instant and
// uploaded as textures:
//
//   A = (Dx, h, Dz, ∂Dx/∂z)      displacement
//   B = (∂h/∂x, ∂h/∂z, ∂Dx/∂x, ∂Dz/∂z)  derivatives (normals, Jacobian)
//   C = ((∂h/∂x)², (∂h/∂z)², ∂h/∂x·∂h/∂z, 0)  slope moments; their mipmaps give
//       the sub-pixel slope variance that becomes specular roughness (LEAN).

const G = 9.81
export const CASCADE_SIZE = 256

export interface Cascade {
  /** Patch size in metres. */
  size: number
  a: DataTexture
  b: DataTexture
  c: DataTexture
}

export interface OceanSurface {
  cascades: Cascade[]
  significantHeight: number
}

function jonswap(omega: number, omegaPeak: number, alpha: number, gamma: number): number {
  const sigma = omega <= omegaPeak ? 0.07 : 0.09
  const r = Math.exp(-((omega - omegaPeak) ** 2) / (2 * sigma * sigma * omegaPeak * omegaPeak))
  return (
    ((alpha * G * G) / omega ** 5) * Math.exp(-1.25 * (omegaPeak / omega) ** 4) * gamma ** r
  )
}

const spreadNorm = new Map<number, number>()
/** Normalization so ∫ cos^{2s}(θ/2) dθ over [-π, π] = 1. */
function spreadNormalization(s: number): number {
  const key = Math.round(s * 10) / 10
  let n = spreadNorm.get(key)
  if (n == null) {
    let sum = 0
    const steps = 512
    for (let i = 0; i < steps; i++) {
      const theta = -Math.PI + ((i + 0.5) / steps) * 2 * Math.PI
      sum += Math.abs(Math.cos(theta / 2)) ** (2 * key)
    }
    n = 1 / (sum * ((2 * Math.PI) / steps))
    spreadNorm.set(key, n)
  }
  return n
}

/** Mitsuyasu-style spreading: narrow near the peak, broad for short waves. */
function spreading(theta: number, omega: number, omegaPeak: number, base: number): number {
  const ratio = omega / omegaPeak
  const s = Math.max(1, Math.min(40, base * (ratio < 1 ? ratio ** 5 : ratio ** -2.5)))
  return spreadNormalization(s) * Math.abs(Math.cos(theta / 2)) ** (2 * s)
}

function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

function makeTexture(data: Float32Array, n: number): DataTexture {
  const half = new Uint16Array(data.length)
  for (let i = 0; i < data.length; i++) half[i] = DataUtils.toHalfFloat(data[i])
  const texture = new DataTexture(half, n, n, RGBAFormat, HalfFloatType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export function synthesizeOcean(ocean: SceneParams['ocean']): OceanSurface {
  const rng = new Random(ocean.waveSeed)
  const n = CASCADE_SIZE
  const U = Math.max(ocean.windSpeed, 0.5)
  // Azimuth (0 = -Z, clockwise toward +X) → angle of the (x, z) direction.
  const azimuthToTheta = (deg: number): number =>
    Math.atan2(-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180))
  const windTheta = azimuthToTheta(ocean.windHeadingDeg)
  const swellTheta = azimuthToTheta(ocean.swellHeadingDeg)

  const omegaPeak = (0.855 * G) / U
  const peakWavelength = (2 * Math.PI * G) / (omegaPeak * omegaPeak)
  const swellOmega = Math.sqrt((G * 2 * Math.PI) / ocean.swellWavelength)

  // Cascade patch sizes; irrational-ish ratios so the tiles never line up.
  const l0 = Math.max(250, 4 * peakWavelength, 2.2 * ocean.swellWavelength)
  const sizes = [l0, l0 / 6.37, l0 / 6.37 / 5.83]
  // Each cascade owns the wavenumber band between its neighbours.
  const boundaries = sizes.map((_, i) =>
    i + 1 < sizes.length ? ((2 * Math.PI) / sizes[i + 1]) * 6 : Infinity
  )

  // Draw initial spectra h0(k) for the wind sea and the swell separately so
  // each can be scaled to its own target height.
  const cells = n * n
  const h0w = sizes.map(() => ({ re: new Float64Array(cells), im: new Float64Array(cells) }))
  const h0s = sizes.map(() => ({ re: new Float64Array(cells), im: new Float64Array(cells) }))
  let windVariance = 0
  let swellVariance = 0

  sizes.forEach((size, c) => {
    const dk = (2 * Math.PI) / size
    const kLow = c === 0 ? 0 : boundaries[c - 1]
    const kHigh = boundaries[c]
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const index = j * n + i
        const kx = (i < n / 2 ? i : i - n) * dk
        const kz = (j < n / 2 ? j : j - n) * dk
        const k = Math.hypot(kx, kz)
        // Always draw the randoms so the sequence doesn't depend on band edges.
        const g1 = rng.normal()
        const g2 = rng.normal()
        const g3 = rng.normal()
        const g4 = rng.normal()
        if (k < 1e-6 || k < kLow || k >= kHigh) continue
        const omega = Math.sqrt(G * k)
        const theta = Math.atan2(kz, kx)
        const dOmegaDk = G / (2 * omega)

        // Wind sea. Damp centimetre ripples a bit (capillary cutoff).
        const sWind =
          (jonswap(omega, omegaPeak, 0.0081, 3.3) *
            spreading(angleDiff(theta, windTheta), omega, omegaPeak, 8 * ocean.spreadScale) *
            dOmegaDk) /
          k *
          Math.exp(-((k / 600) ** 2))
        const ampW = Math.sqrt(sWind * dk * dk / 2)
        h0w[c].re[index] = g1 * ampW
        h0w[c].im[index] = g2 * ampW
        windVariance += 2 * ampW * ampW * (g1 * g1 + g2 * g2)

        // Swell: narrow in frequency and direction.
        const sigma = 0.06 * swellOmega
        const sSwell =
          (Math.exp(-((omega - swellOmega) ** 2) / (2 * sigma * sigma)) *
            spreadNormalization(30) *
            Math.abs(Math.cos(angleDiff(theta, swellTheta) / 2)) ** 60 *
            dOmegaDk) /
          k
        const ampS = Math.sqrt(sSwell * dk * dk / 2)
        h0s[c].re[index] = g3 * ampS
        h0s[c].im[index] = g4 * ampS
        swellVariance += 2 * ampS * ampS * (g3 * g3 + g4 * g4)
      }
    }
  })

  const windHeight = ((0.21 * U * U) / G) * ocean.seaDevelopment
  const windScale = windVariance > 0 ? Math.sqrt((windHeight / 4) ** 2 / windVariance) : 0
  const swellScale = swellVariance > 0 ? Math.sqrt((ocean.swellHeight / 4) ** 2 / swellVariance) : 0
  const lambda = ocean.choppiness

  const cascades = sizes.map((size, c): Cascade => {
    const dk = (2 * Math.PI) / size
    // Eight real fields packed pairwise into four complex inverse FFTs:
    // (Dx + i·Dz), (h + i·Dxz), (hx + i·hz), (Dxx + i·Dzz).
    const fields = Array.from({ length: 4 }, () => ({
      re: new Float64Array(cells),
      im: new Float64Array(cells)
    }))
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const index = j * n + i
        const kx = (i < n / 2 ? i : i - n) * dk
        const kz = (j < n / 2 ? j : j - n) * dk
        const k = Math.hypot(kx, kz)
        if (k < 1e-6) continue
        const omega = Math.sqrt(G * k)
        const mi = (n - i) % n
        const mj = (n - j) % n
        const mirror = mj * n + mi

        const h0re = h0w[c].re[index] * windScale + h0s[c].re[index] * swellScale
        const h0im = h0w[c].im[index] * windScale + h0s[c].im[index] * swellScale
        const m0re = h0w[c].re[mirror] * windScale + h0s[c].re[mirror] * swellScale
        const m0im = h0w[c].im[mirror] * windScale + h0s[c].im[mirror] * swellScale

        // h(k,t) = h0(k)·e^{iωt} + conj(h0(-k))·e^{-iωt}
        const phase = omega * ocean.time
        const cos = Math.cos(phase)
        const sin = Math.sin(phase)
        const hre = h0re * cos - h0im * sin + (m0re * cos - m0im * sin)
        const him = h0re * sin + h0im * cos - (m0re * sin + m0im * cos)

        const ux = kx / k
        const uz = kz / k
        // Multiplying by i: (a + ib)·i = -b + ia.
        // D = i·k̂·h moves points toward crests (sharpens them).
        const dxRe = -ux * him * lambda
        const dxIm = ux * hre * lambda
        const dzRe = -uz * him * lambda
        const dzIm = uz * hre * lambda
        // ∂h/∂x = i·kx·h
        const hxRe = -kx * him
        const hxIm = kx * hre
        const hzRe = -kz * him
        const hzIm = kz * hre
        // ∂Dx/∂x = -kx²/k·h, ∂Dz/∂z = -kz²/k·h, ∂Dx/∂z = -kx·kz/k·h
        const dxxRe = -(kx * kx / k) * hre * lambda
        const dxxIm = -(kx * kx / k) * him * lambda
        const dzzRe = -(kz * kz / k) * hre * lambda
        const dzzIm = -(kz * kz / k) * him * lambda
        const dxzRe = -(kx * kz / k) * hre * lambda
        const dxzIm = -(kx * kz / k) * him * lambda

        // Pack F1 + i·F2 (each Fn is the spectrum of a real field).
        fields[0].re[index] = dxRe - dzIm
        fields[0].im[index] = dxIm + dzRe
        fields[1].re[index] = hre - dxzIm
        fields[1].im[index] = him + dxzRe
        fields[2].re[index] = hxRe - hzIm
        fields[2].im[index] = hxIm + hzRe
        fields[3].re[index] = dxxRe - dzzIm
        fields[3].im[index] = dxxIm + dzzRe
      }
    }
    for (const f of fields) ifft2d(f.re, f.im, n)

    const a = new Float32Array(cells * 4)
    const b = new Float32Array(cells * 4)
    const cm = new Float32Array(cells * 4)
    for (let index = 0; index < cells; index++) {
      const o = index * 4
      a[o] = fields[0].re[index]
      a[o + 1] = fields[1].re[index]
      a[o + 2] = fields[0].im[index]
      a[o + 3] = fields[1].im[index]
      const hx = fields[2].re[index]
      const hz = fields[2].im[index]
      b[o] = hx
      b[o + 1] = hz
      b[o + 2] = fields[3].re[index]
      b[o + 3] = fields[3].im[index]
      cm[o] = hx * hx
      cm[o + 1] = hz * hz
      cm[o + 2] = hx * hz
    }
    return { size, a: makeTexture(a, n), b: makeTexture(b, n), c: makeTexture(cm, n) }
  })

  return {
    cascades,
    significantHeight: 4 * Math.sqrt((windHeight / 4) ** 2 + (ocean.swellHeight / 4) ** 2)
  }
}
