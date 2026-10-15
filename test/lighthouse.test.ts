import { describe, expect, it } from 'vitest'

import { beamDirections } from '../src/lighthouse'
import type { LighthouseParams } from '../src/params'

const light = (flashes: number, groups: number, beamAzimuthDeg = 0): LighthouseParams => ({
  site: 'rock',
  paint: 'white',
  height: 30,
  character: '',
  flashes,
  groups,
  beamAzimuthDeg,
  lit: true,
  seed: 1
})

const azimuth = (v: { x: number; z: number }): number => ((Math.atan2(v.x, -v.z) * 180) / Math.PI + 360) % 360

describe('beamDirections', () => {
  it('makes flashes × groups horizontal unit beams on a rock', () => {
    for (const [f, g] of [[1, 1], [2, 2], [3, 4]]) {
      const beams = beamDirections(light(f, g), null)
      expect(beams.length).toBe(f * g)
      for (const b of beams) {
        expect(b.length()).toBeCloseTo(1)
        expect(b.y).toBeCloseTo(0)
      }
    }
  })

  it('spaces groups evenly round the lens and keeps a group close together', () => {
    const az = beamDirections(light(2, 3, 40), null).map(azimuth)
    expect(az[0]).toBeCloseTo(35)
    expect(az[1]).toBeCloseTo(45)
    expect(az[2]).toBeCloseTo(155)
    expect(az[4]).toBeCloseTo(275)
  })

  it('screens the landward side on a point', () => {
    const seaward = 90
    const beams = beamDirections(light(1, 4, 0), seaward)
    // Beams at 0, 90 and 180 face the sea (within 110°); 270 faces inland.
    expect(beams.map(azimuth).map(Math.round).sort((a, b) => a - b)).toEqual([0, 90, 180])
  })

  it('never returns more beams than the shader takes', () => {
    expect(beamDirections(light(4, 4), null).length).toBeLessThanOrEqual(12)
  })
})
