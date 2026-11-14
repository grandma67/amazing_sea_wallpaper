import { describe, expect, it } from 'vitest'

import { shapeBaseGlsl, valueNoise1, valueNoise2, withTermsOff } from '../src/cloudShapes'

describe('cloud shapes: the shared base', () => {
  it('has value noise in [0, 1], continuous across cell edges, the same for the same seed', () => {
    for (let i = 0; i < 400; i++) {
      const x = (i - 200) * 0.37
      const a = valueNoise1(12345, x)
      const b = valueNoise2(678, x, x * 0.6 - 3)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
      expect(valueNoise1(12345, x)).toBe(a)
    }
    // No jump at a cell edge (smoothstep between cell hashes).
    for (const edge of [-3, 0, 1, 7]) {
      expect(Math.abs(valueNoise1(9, edge - 1e-6) - valueNoise1(9, edge + 1e-6))).toBeLessThan(1e-4)
      expect(Math.abs(valueNoise2(9, edge - 1e-6, 0.4) - valueNoise2(9, edge + 1e-6, 0.4))).toBeLessThan(1e-4)
    }
  })

  it('switches terms off: only the listed amplitudes go to 0', () => {
    const shape = { aM: 3, bM: 4, scale: 10 }
    const terms = { a: ['aM'], b: ['bM'] } as const
    expect(withTermsOff(shape, terms, undefined)).toEqual(shape)
    expect(withTermsOff(shape, terms, { a: false })).toEqual({ aM: 0, bM: 4, scale: 10 })
    expect(withTermsOff(shape, terms, { a: true, b: false })).toEqual({ aM: 3, bM: 0, scale: 10 })
  })

  it('names its GLSL by the shape: position, seed, noise and world position', () => {
    const glsl = shapeBaseGlsl('foo')
    for (const name of ['vec3 fooPosition', 'uniform float fooSeed', 'float fooNoise1(', 'float fooNoise2(', 'vec3 fooWorld()', 'fooHash1', 'fooHash2'])
      expect(glsl).toContain(name)
  })
})
