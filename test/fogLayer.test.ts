import { describe, expect, it } from 'vitest'

import { fogDepthAbove, fogProfile, fogRayDepth, fogSigma, fogSunTransmittance } from '../src/fogLayer'
import type { FogParams } from '../src/params'

const deck: FogParams = { kind: 'advection', visibility: 345, height: 55, start: 0, seed: 1 }
const smoke: FogParams = { kind: 'sea-smoke', visibility: 800, height: 15, start: 0, seed: 1 }

/** Numerical optical depth along the ray, for checking the closed form. */
function integrate(fog: FogParams, y0: number, dy: number, s0: number, s1: number): number {
  const { base, fade } = fogProfile(fog)
  const n = 20_000
  const ds = (s1 - s0) / n
  let tau = 0
  for (let i = 0; i < n; i++) {
    const y = y0 + (s0 + (i + 0.5) * ds) * dy
    tau += fogSigma(fog) * Math.exp(-Math.max(y - base, 0) / fade) * ds
  }
  return tau
}

describe('fog layer', () => {
  it('holds σ × height in a column from the sea', () => {
    expect(fogDepthAbove(deck, 0)).toBeCloseTo(fogSigma(deck) * deck.height, 9)
    expect(fogDepthAbove(smoke, 0)).toBeCloseTo(fogSigma(smoke) * smoke.height, 9)
  })

  it('advection fog has a lid: clear a few metres above its top, dense below it', () => {
    const { base, fade } = fogProfile(deck)
    expect(fade).toBeLessThan(0.15 * deck.height)
    // 3 fades above the top: under 5% of the density left.
    expect(Math.exp(-(deck.height + 3 * fade - base) / fade)).toBeLessThan(0.05)
    // A camera 100 m up (2016-08-09) is above it: the sun is barely dimmed.
    expect(fogSunTransmittance(deck, 100, 3.3)).toBeGreaterThan(0.95)
    // On the beach it's inside: the sun is gone at 3° up.
    expect(fogSunTransmittance(deck, 2, 3.3)).toBeLessThan(1e-3)
  })

  it('sea smoke keeps thinning exponentially from the sea', () => {
    expect(fogProfile(smoke)).toEqual({ base: 0, fade: smoke.height })
  })

  it('a bank offshore never dims the sun', () => {
    expect(fogSunTransmittance({ ...deck, start: 900 }, 2, 10)).toBe(1)
    expect(fogSunTransmittance(null, 2, 10)).toBe(1)
  })

  it('the per-ray closed form (the shader mirror) matches numerical integration', () => {
    const rays: [number, number, number, number][] = [
      [100, -0.3, 0, 400], // from above the top down into it
      [100, -0.02, 0, 20_000], // grazing over the top to the horizon
      [100, 0.1, 0, 5000], // above it, looking up
      [2, 0, 0, 3000], // level, inside
      [2, 0.05, 0, 3000], // inside, climbing out through the top
      [40, 0.01, 500, 4000], // a bank's front at 500 m
      [52, -0.001, 0, 8000] // in the fade, almost level
    ]
    for (const fog of [deck, smoke]) {
      for (const [y0, dy, s0, s1] of rays) {
        const exact = integrate(fog, y0, dy, s0, s1)
        expect(Math.abs(fogRayDepth(fog, y0, dy, s0, s1) - exact)).toBeLessThan(1e-3 * Math.max(1, exact))
      }
    }
  })
})
