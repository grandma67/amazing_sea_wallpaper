import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { dirFromAzEl } from '../src/params'
import { MAX_STORM_CELLS, stormCells, stormLayer } from '../src/stormCells'
import { flashGlows } from '../src/stormEffects'
import { scenes } from './days'

describe('storm cells', () => {
  it('put a cumulonimbus over every strike and rain shaft', () => {
    const camera = new Vector3(0, 3, 0)
    let checked = 0
    for (const p of scenes({ storm: 'thunderstorm', eclipse: null }, 20)) {
      const cells = stormCells(p.storm, camera)
      expect(cells.length).toBeLessThanOrEqual(MAX_STORM_CELLS)
      expect(stormLayer(p.weather.formations)).toBeGreaterThanOrEqual(0)
      for (const strike of [...p.storm!.bolts, ...p.storm!.curtains]) {
        const [dx, , dz] = dirFromAzEl(strike.azimuthDeg, 0)
        const x = dx * strike.distance
        const z = dz * strike.distance
        // Well inside a cell: the cell's weather is full out to ~half its radius.
        expect(cells.some(c => Math.hypot(c.x - x, c.z - z) < c.radius * 0.45)).toBe(true)
        checked++
      }
      for (const c of cells) expect(c.radius).toBeGreaterThanOrEqual(3000)
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('are absent without a storm', () => {
    expect(stormCells(null, new Vector3())).toEqual([])
  })
})

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
