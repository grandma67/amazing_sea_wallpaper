import { describe, expect, it } from 'vitest'

import { Vector3 } from 'three'

import { BEAM_MAX, BEAM_SAMPLES, beamDirections, beamLight, beamSampleAt } from '../src/lighthouse'
import { EARTH_RADIUS, type LighthouseParams } from '../src/params'
import { tower } from '../src/props/lighthouse'
import { allParams, expectEvery } from './days'

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

describe('beamLight', () => {
  const lantern = new Vector3(0, 30, 0)
  const east = [new Vector3(1, 0, 0)]
  const sea = (): number => -5
  const samples = Array.from({ length: BEAM_SAMPLES }, (_, k) => beamSampleAt(k))
  const at = (lit: number[], t: number): number => lit[samples.findIndex(s => s >= t)]

  it('samples from near the lamp to BEAM_MAX', () => {
    expect(samples[0]).toBeLessThan(50)
    expect(samples.at(-1)).toBeCloseTo(BEAM_MAX)
  })

  it('over open sea, keeps nearly all of it near the lamp and loses the lower half bit by bit', () => {
    const [lit] = beamLight(lantern, east, sea)
    expect(lit).toHaveLength(BEAM_SAMPLES)
    expect(lit[0]).toBeGreaterThan(0.99)
    for (let k = 1; k < lit.length; k++) expect(lit[k]).toBeLessThanOrEqual(lit[k - 1])
    // 30 m up, the sea at 8 km is 0.2° down plus the earth's drop: a bit over half is left.
    expect(lit.at(-1)).toBeGreaterThan(0.5)
    expect(lit.at(-1)).toBeLessThan(0.65)
  })

  it('is stopped at once by a cliff', () => {
    const [lit] = beamLight(lantern, east, x => (x > 500 ? 200 : -5))
    expect(at(lit, 300)).toBeGreaterThan(0.95)
    expect(at(lit, 600)).toBeLessThan(1e-6)
  })

  it('is eaten from below by a rising slope, not all at once', () => {
    const [lit] = beamLight(lantern, east, x => (x > 300 ? (x - 300) / 20 : -5))
    const [open] = beamLight(lantern, east, sea)
    expect(at(lit, 800)).toBeLessThan(at(open, 800))
    expect(at(lit, 800)).toBeGreaterThan(0.1)
    // The beam's upper tail clears the slope a while: 2° up at 3 km is still ~10%.
    expect(at(lit, 3000)).toBeLessThan(0.15)
    for (let k = 1; k < lit.length; k++) expect(lit[k]).toBeLessThanOrEqual(lit[k - 1])
  })

  it('is stopped by a high island, partly by one a little above the lamp, and kept past a low one', () => {
    const outline = Array(32).fill(200)
    const [high] = beamLight(lantern, east, sea, [{ x: 2000, z: 0, outline, top: 300, depth: 20 }])
    expect(at(high, 2500)).toBeLessThan(1e-6)
    // 30 m above the lamp at 1.8 km is +0.95°: the beam's upper ~quarter goes over.
    const [mid] = beamLight(lantern, east, sea, [{ x: 2000, z: 0, outline, top: 60, depth: 20 }])
    expect(at(mid, 2500)).toBeGreaterThan(0.2)
    expect(at(mid, 2500)).toBeLessThan(0.35)
    const [low] = beamLight(lantern, east, sea, [{ x: 2000, z: 0, outline, top: 8, depth: 20 }])
    expect(at(low, 2500)).toBeGreaterThan(0.3)
  })

  it('lets the earth drop far land away as the terrain mesh does', () => {
    expect((0.9 * 7000 ** 2) / (2 * EARTH_RADIUS)).toBeGreaterThan(3)
    // Land at the lamp's height 7 km off is drawn ~3.5 m lower: under the beam's axis.
    const [lit] = beamLight(lantern, east, x => (x > 7000 ? 30 : -5))
    expect(lit.at(-1)).toBeGreaterThan(0.5)
  })
})

describe('tower', () => {
  // A rock tower's flared foot used (1 - t) ** 2.2 with t a hair above 1 at
  // the shaft top: a NaN ring on 3 of 1095 days (2024-06-05).
  it('is finite on every lighthouse day, both sites', () => {
    const lights = allParams().flatMap(p => (p.lighthouse != null ? [p.lighthouse] : []))
    expect(lights.length).toBeGreaterThan(50)
    for (const light of lights) {
      for (const kind of ['rock', 'point'] as const) {
        const { body, lantern } = tower(light, kind, light.seed)
        for (const g of [body.build(), lantern.build()]) {
          expectEvery(g.attributes.position.array as Float32Array, Number.isFinite, { what: () => `${light.height} m ${kind}` })
          expectEvery(g.attributes.normal.array as Float32Array, Number.isFinite)
        }
      }
    }
  })
})
