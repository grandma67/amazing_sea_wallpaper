import { describe, expect, it } from 'vitest'

import { NIGHT_WHITE_BALANCE_K, planckXY, whiteBalanceGains, xyToRgb } from '../src/whiteBalance'

// A camera's white balance at night (the "camera, ~4000 K" night look).

const luma = (c: number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

describe('white balance', () => {
  it('follows the Planckian locus', () => {
    // Known points: 2856 K (illuminant A) ≈ (0.4476, 0.4074); ~6500 K ≈ (0.313, 0.324).
    const a = planckXY(2856)
    expect(a[0]).toBeCloseTo(0.4476, 2)
    expect(a[1]).toBeCloseTo(0.4074, 2)
    const d = planckXY(6504)
    expect(d[0]).toBeCloseTo(0.313, 2)
    // D65 is white in linear Rec. 709.
    const w = xyToRgb([0.3127, 0.329])
    expect(w[0]).toBeCloseTo(w[1], 2)
    expect(w[2]).toBeCloseTo(w[1], 2)
  })

  it('cools the frame at a night setting and keeps its brightness', () => {
    const g = whiteBalanceGains(NIGHT_WHITE_BALANCE_K)
    expect(luma(g)).toBeCloseTo(1, 6)
    expect(g[2]).toBeGreaterThan(1.4)
    expect(g[0]).toBeLessThan(0.8)
    // About daylight's own setting, nothing changes.
    for (const c of whiteBalanceGains(6504)) expect(c).toBeCloseTo(1, 1)
  })

  it('keeps an aurora green, a sodium town orange and the night sky blue', () => {
    const g = whiteBalanceGains(NIGHT_WHITE_BALANCE_K)
    const apply = (c: number[]): number[] => c.map((v, i) => v * g[i])
    const green = apply([0.25, 1.0, 0.35])
    expect(green[1]).toBeGreaterThan(green[0] * 2)
    expect(green[1]).toBeGreaterThan(green[2] * 1.3)
    const sodium = apply(xyToRgb(planckXY(2100)))
    expect(sodium[0]).toBeGreaterThan(sodium[2] * 1.5)
    // Moonlight is sunlight: a moonlit grey turns blue.
    const moonlit = apply([1, 1, 1])
    expect(moonlit[2]).toBeGreaterThan(moonlit[0] * 2)
  })
})
