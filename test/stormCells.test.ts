import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { dirFromAzEl } from '../src/params'
import { MAX_STORM_CELLS, stormCells, stormLayer } from '../src/stormCells'
import { allParams, scenes } from './days'

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

  it('strike close enough for their dark base to show (3–9 km)', () => {
    const bolts = allParams().flatMap(p => p.storm?.bolts ?? [])
    expect(bolts.length).toBeGreaterThan(10)
    for (const b of bolts) {
      expect(b.distance).toBeGreaterThanOrEqual(3000)
      expect(b.distance).toBeLessThanOrEqual(9000)
    }
  })
})
