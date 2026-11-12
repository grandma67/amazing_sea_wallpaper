import { describe, expect, it } from 'vitest'

import { generateSceneParams } from '../src/composition'
import { parseSceneSpec } from '../src/sceneSpec'
import { terrainHeight } from '../src/terrain'
import { nearestPool, poolAt, terrainClear } from '../src/waterFilms'
import { DAYS } from './days'
import { Vector3 } from 'three'

// The CPU mirror of the shader's pools (plans/WATER_VIEW.md step 3),
// pinned to what the render's own count (debug.water) found on the same
// frames: the page's params (generateSceneParams), 1080p.

const base = { eclipse: null, storm: null, fog: null, timeOfDay: 'daylight', sunAzimuthDeg: 160 }
const rendered = (date: string, spec: object = {}) => generateSceneParams(date, 16 / 9, parseSceneSpec({ date, ...spec }))

describe('poolAt', () => {
  it('finds no pool below today\'s water, on open sea, or above the films\' reach', () => {
    for (const date of DAYS.filter((_, i) => i % 61 === 0)) {
      const p = rendered(date)
      for (let k = 0; k < 200; k++) {
        const x = ((k * 37) % 120) - 60
        const z = -((k * 53) % 150)
        const s = poolAt(p, x, z)
        if (s.isPool) {
          expect(s.h).toBeGreaterThanOrEqual(0)
          expect(s.pools).toBeGreaterThan(0.5)
          expect(s.snow).toBeLessThanOrEqual(0.5)
        }
        if (p.coast.type === 'open-sea') expect(s.isPool).toBe(false)
      }
    }
  })

  it('is deterministic', () => {
    const p = rendered('2024-06-13')
    expect(poolAt(p, 3.3, -15.1)).toEqual(poolAt(p, 3.3, -15.1))
  })
})

describe('terrainClear', () => {
  it('sees the ground under the camera, and nothing from below the ground', () => {
    const p = rendered('2024-06-13')
    const ground = terrainHeight(p.coast, 0, -5)
    expect(terrainClear(p, new Vector3(0, ground + 1.7, 0), 0, ground, -5)).toBe(true)
    expect(terrainClear(p, new Vector3(0, ground - 20, 0), 30, terrainHeight(p.coast, 30, -60), -60)).toBe(false)
  })
})

describe('nearestPool (against debug.water on the same frames)', () => {
  it('finds the flat\'s creek ~15 m off (GPU 15.2 m, bottom left)', () => {
    const p = rendered('2025-07-10', { ...base, weather: 'scattered', place: 'mont-saint-michel', coast: 'tidal-flat', tide: 'mid', composition: 'along-beach' })
    const r = nearestPool(p)
    expect(r.m).toBeGreaterThan(13)
    expect(r.m).toBeLessThan(18)
    expect(r.at![0]).toBeLessThan(0.2)
    expect(r.at![1]).toBeGreaterThan(0.9)
  })

  it('finds the rock pool in front of the camera on 2024-06-13 (GPU 15.9 m)', () => {
    const r = nearestPool(rendered('2024-06-13'))
    expect(r.m).toBeGreaterThan(14)
    expect(r.m).toBeLessThan(18)
  })

  it('finds none where the render has none (2025-06-15, a beach)', () => {
    expect(nearestPool(rendered('2025-06-15'))).toEqual({ m: null, at: null, areaWithin15M2: 0 })
  })
})
