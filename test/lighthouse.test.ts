import { describe, expect, it } from 'vitest'

import { Vector3 } from 'three'

import { BEAM_MAX, BEAM_SAMPLES, beamDirections, beamLight, beamSampleAt, lensTurnSeconds, sweepAngle, sweptWindow, SWEEP_MIN } from '../src/lighthouse'
import { EARTH_RADIUS, type LighthouseParams } from '../src/params'
import { tower } from '../src/props/lighthouse'
import { allParams, expectEvery } from './days'

const light = (flashes: number, groups: number, beamAzimuthDeg = 0): LighthouseParams => ({
  site: 'rock',
  paint: 'white',
  height: 30,
  character: '',
  periodS: 6,
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

describe('the lens turning over the shutter', () => {
  const DIV = (2.2 * Math.PI) / 180
  const every = Array.from({ length: 3600 }, (_, i) => i / 10)
  const integral = (w: number[]): number => w.reduce((a, b) => a + b, 0) * ((0.1 * Math.PI) / 180)

  it('turns once per chart period per group (the Cuckolds, Fl(2) 6s, once in 6 s)', () => {
    expect(lensTurnSeconds(light(2, 1))).toBe(6)
    expect(lensTurnSeconds(light(1, 3))).toBe(18)
    expect(sweepAngle(light(1, 1), 3)).toBeCloseTo(Math.PI)
  })

  it('leaves dusk and blue-hour shutters frozen', () => {
    // The test days' widest dusk sweeps: 0.021 s on an 18 s turn, 0.002 s on a 3 s one.
    expect(sweepAngle({ ...light(1, 1), periodS: 18 }, 0.021)).toBeLessThan(SWEEP_MIN)
    expect(sweepAngle({ ...light(1, 1), periodS: 3 }, 0.002)).toBeLessThan(SWEEP_MIN)
  })

  it('is the frozen beam as the sweep shrinks', () => {
    const at = [40, 41, 42.5, 45, 30]
    const w = sweptWindow(light(1, 1, 40), null, 1e-3, at)
    at.forEach((az, i) => expect(w[i]).toBeCloseTo(Math.exp(-((((az - 40) * Math.PI) / 180 / DIV) ** 2)), 3))
  })

  it('keeps each beam\'s light whatever the sweep: √π × divergence over a turn', () => {
    for (const sweep of [SWEEP_MIN, 0.3, 2, 2 * Math.PI, 7.5, 40]) {
      expect(integral(sweptWindow(light(2, 3, 17), null, sweep, every)) / (6 * Math.sqrt(Math.PI) * DIV)).toBeCloseTo(1, 3)
    }
  })

  it('lights every azimuth alike over whole turns, and the part turn round the beam', () => {
    const whole = sweptWindow(light(1, 1, 0), null, 4 * Math.PI, every)
    // Two passes over each azimuth in two turns.
    for (const v of whole) expect(v).toBeCloseTo(Math.sqrt(Math.PI) * DIV / (2 * Math.PI), 6)
    const part = sweptWindow(light(1, 1, 0), null, 2 * Math.PI + Math.PI / 2, [0, 180])
    expect(part[0]).toBeGreaterThan(part[1] * 1.9)
    // Half a turn centred on the beam: lit from −90° to 90°, dark behind.
    const half = sweptWindow(light(1, 1, 0), null, Math.PI, [0, 80, 100, 180])
    expect(half[0]).toBeCloseTo(Math.sqrt(Math.PI) * DIV / Math.PI, 5)
    expect(half[1]).toBeCloseTo(half[0], 3)
    expect(half[2]).toBeLessThan(1e-6)
    expect(half[3]).toBe(0)
  })

  it('stays dark on a point\'s landward side, through a soft edge', () => {
    const w = sweptWindow(light(1, 2, 0), 90, 4 * Math.PI, [0, 90, 180, 200, 210, 270, 330])
    expect(w[0]).toBeCloseTo(w[1], 6)
    expect(w[2]).toBeCloseTo(w[1], 6)
    // 110° off seaward: half through the shade's edge.
    expect(w[3]).toBeCloseTo(w[1] / 2, 6)
    expect(w.slice(4)).toEqual([0, 0, 0])
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
