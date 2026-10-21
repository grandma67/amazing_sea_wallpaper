import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { flashGlows } from '../src/stormEffects'
import { scenes } from './days'

describe('lightning glows mirrored by the sea', () => {
  it('sit above the horizon in the bolts’ directions, a few degrees wide', () => {
    let count = 0
    for (const p of scenes({ storm: 'thunderstorm', eclipse: null }, 20)) {
      const { camera } = createCamera(p, 1920, 1080)
      const glows = flashGlows(p, camera)
      expect(glows.length).toBe(Math.min(3, p.storm!.bolts.length))
      for (const g of glows) {
        expect(Math.hypot(g.x, g.y, g.z)).toBeCloseTo(1, 6)
        expect(g.y).toBeGreaterThan(0)
        expect(g.w).toBeGreaterThan(0)
        expect(g.w).toBeLessThan(0.3)
        count++
      }
    }
    expect(count).toBeGreaterThan(0)
  })

  it('are absent without a storm', () => {
    for (const p of scenes({ storm: null }, 5)) expect(flashGlows(p, createCamera(p, 1920, 1080).camera)).toEqual([])
  })
})
