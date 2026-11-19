import { describe, expect, it } from 'vitest'

import { HALF_MAX, SHADOW_COLOR_OUT, SHADOW_DEPTH_OUT, SHADOW_FRONT, SHADOW_READ, SHADOW_RESOLVE_OUT } from '../src/cloudShadowPatch'

// clampShadowToHalf (cloudShadowPatch.ts) patches takram's shaders by string: on CI's SwiftShader the
// half-float cloud shadow map overflowed under a low sun and published 2026-11-17 white
// (tools/RENDER.md "Broken frames"). An upgrade of @takram/three-clouds that moves these
// lines would make the patch throw at render time; this fails first.

// The package's bundled shaders, raw (as test/glsl.test.ts reads ours).
const build = Object.values(import.meta.glob('../node_modules/@takram/three-clouds/build/shared.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0] ?? ''
const count = (s: string): number => build.split(s).length - 1

describe('cloud shadow patch', () => {
  it.each([
    ['shadow depth and velocity output', SHADOW_DEPTH_OUT],
    ['shadow front depth', SHADOW_FRONT],
    ['shadow resolve output', SHADOW_RESOLVE_OUT],
    ['clouds shadow read', SHADOW_READ]
  ])('finds the %s once in takram', (_, line) => {
    expect(count(line)).toBe(1)
  })

  it('finds the shadow colour output (once in shadow.frag; another shader has the same line)', () => {
    expect(count(SHADOW_COLOR_OUT)).toBeGreaterThanOrEqual(1)
  })

  it('clamps to the largest finite half float', () => {
    expect(HALF_MAX).toBe(65504)
  })
})
