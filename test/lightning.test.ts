import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CLOUD_GENERA, cloudBase } from '../src/cloudTypes'
import { readFileSync } from 'node:fs'

import { CHARGE_HEIGHT_M, chargeHeightM, EXIT_SHARE, exitLift, FLASH, flashGlowCd, flashPower, flashShutter, lightningFor, ORIGIN_OFFSET_M } from '../src/lightning'
import type { SceneParams } from '../src/params'
import type { Climate } from '../src/places'
import { season, type Season } from '../src/seasons'
import { stormCells } from '../src/stormCells'
import { allParams, expectEvery, scene } from './days'

const camera = new Vector3(0, 10, 0)
const boltDays = (): SceneParams[] => allParams().filter(p => (p.storm?.bolts.length ?? 0) > 0)

function cbTop(p: SceneParams): number {
  const key = p.weather.formations.find(f => CLOUD_GENERA[f].genus === 'cumulonimbus')!
  return cloudBase(p.weather.formations, 'cumulonimbus') + CLOUD_GENERA[key].height
}

/** The flashes of a day, checked: origin inside the Cb and its storm cell's
 * full-weather core; the path continuous from origin to exit. */
function expectFlashesSound(p: SceneParams): void {
  const base = cloudBase(p.weather.formations, 'cumulonimbus')
  const flashes = lightningFor(p, camera)
  const cells = stormCells(p.storm, camera)
  expect(flashes.length).toBe(p.storm!.bolts.length)
  flashes.forEach((f, i) => {
    expect(f.origin.y, p.date).toBeGreaterThanOrEqual(base + 300 - 1e-6)
    expect(f.origin.y, p.date).toBeLessThanOrEqual(cbTop(p) - 1500 + 1e-6)
    expect(f.inCloud[0].equals(f.origin)).toBe(true)
    expect(f.inCloud[f.inCloud.length - 1].equals(f.exit)).toBe(true)
    // The exit is where the bolt mesh starts its visible channel.
    expect(f.exit.y).toBeCloseTo(base + exitLift(p, p.storm!.bolts[i]), 6)
    // Steps along the path stay short: no jump across the sky.
    for (let k = 1; k < f.inCloud.length; k++) expect(f.inCloud[k].distanceTo(f.inCloud[k - 1])).toBeLessThan(1500)
    // Both ends of the channel in the cell's core (stormCells.ts: full
    // weather inside 0.45 of the radius, the map's noise ±0.15).
    const inCore = (v: Vector3): boolean => cells.some(c => Math.hypot(v.x - c.x, v.z - c.z) <= 0.3 * c.radius)
    expect(inCore(f.origin), `${p.date} origin`).toBe(true)
    expect(inCore(f.exit), `${p.date} exit`).toBe(true)
    // And the whole channel inside the cell's full weather.
    for (const v of f.inCloud) expect(cells.some(c => Math.hypot(v.x - c.x, v.z - c.z) <= 0.45 * c.radius), `${p.date} path`).toBe(true)
    // Lights: on the channel, shares adding to 1, the exit's share last.
    expect(f.lights.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1, 9)
    expect(f.lights[f.lights.length - 1].share).toBe(EXIT_SHARE)
    for (const l of f.lights) expect(Number.isFinite(l.position.x + l.position.y + l.position.z)).toBe(true)
  })
}

describe('lightning: where the flash starts', () => {
  it('starts in the charge region, inside the storm cell, on every real bolt day', () => {
    const days = boltDays()
    expect(days.length).toBeGreaterThan(30)
    for (const p of days) expectFlashesSound(p)
  })

  it('starts at the −15 °C height of the climate and season, kilometres off the exit', () => {
    for (const p of boltDays()) {
      const s = season({ date: p.date, latitudeDeg: p.latitudeDeg })
      const base = cloudBase(p.weather.formations, 'cumulonimbus')
      const want = Math.min(Math.max(chargeHeightM(p.place.climate, s), base + 300), cbTop(p) - 1500)
      for (const o of p.storm!.origins) {
        expect(o.heightM).toBe(want)
        expect(o.offsetM).toBeGreaterThanOrEqual(ORIGIN_OFFSET_M[0])
        expect(o.offsetM).toBeLessThanOrEqual(ORIGIN_OFFSET_M[1])
      }
    }
  })

  it('is sound for every climate and season, forced (no sampling)', () => {
    const climates = Object.keys(CHARGE_HEIGHT_M) as Climate[]
    const months: [Season, string][] = [['winter', '2025-01-15'], ['spring', '2025-04-15'], ['summer', '2025-07-15'], ['autumn', '2025-10-15']]
    for (const climate of climates) {
      for (const [, date] of months) {
        const p = scene({ storm: 'thunderstorm', climate, timeOfDay: 'daylight', eclipse: null }, date)
        expect(p.storm!.bolts.length).toBeGreaterThan(0)
        expectFlashesSound(p)
      }
    }
  })

  it('has lower charge in winter and higher in the tropics', () => {
    expectEvery(Object.values(CHARGE_HEIGHT_M), r => r.winter <= r.mid && r.mid <= r.summer)
    expect(CHARGE_HEIGHT_M.tropical.summer).toBeGreaterThan(CHARGE_HEIGHT_M.temperate.summer)
    expect(CHARGE_HEIGHT_M.polar.winter).toBeGreaterThanOrEqual(1800)
  })

  it('is deterministic', () => {
    for (const p of boltDays().slice(0, 5)) expect(lightningFor(p, camera)).toEqual(lightningFor(p, camera))
  })

  it('takes a forced origin and changes nothing else', () => {
    const spec = { storm: 'thunderstorm', timeOfDay: 'daylight', eclipse: null } as const
    const free = scene(spec, '2025-07-15')
    const forced = scene({ ...spec, lightning: { offsetKm: 2, azimuthDeg: 90, originM: 5000 } }, '2025-07-15')
    for (const o of forced.storm!.origins) expect(o).toEqual({ offsetM: 2000, azimuthDeg: 90, heightM: 5000 })
    expect({ ...forced, storm: { ...forced.storm!, origins: [] } }).toEqual({ ...free, storm: { ...free.storm!, origins: [] } })
  })
})

describe('lightning: how bright (one rule for every hour)', () => {
  const STARLIT = 2e-4
  /** Glow ÷ ambient at depth d straight over the source. */
  const ratio = (ambientCd: number, d: number): number => {
    const t = flashShutter(ambientCd)
    return flashGlowCd(flashPower(t), new Vector3(0, d, 0), new Vector3(0, 0, 0)) / ambientCd
  }

  it('meters like a photographer: f/8, ISO 100 by day, up to ISO 3200 and 30 s at night', () => {
    expect(flashShutter(800)).toBeCloseTo(0.01, 3)
    expect(flashShutter(STARLIT)).toBe(30)
    expect(flashShutter(1e6)).toBeLessThan(1e-4)
  })

  it('catches part of a stroke on a very short shutter, the whole flash on a long one', () => {
    expect(flashPower(1e-5) * 1e-5).toBeLessThan(0.05 * FLASH.strokeLmS)
    expect(flashPower(0.01) * 0.01).toBeGreaterThan(FLASH.strokeLmS)
    expect(flashPower(30) * 30).toBeCloseTo(FLASH.strokeLmS * FLASH.strokes, 0)
  })

  it('lights the cloud more, or as much, as the real scene darkens, with no step (no hidden hour)', () => {
    // A metered photo holds the flash against the ambient by how much of it
    // the shutter catches: more as the shutter lengthens, the same once it
    // holds the whole flash, more again past the 30 s cap.
    let last = 0
    for (let log = 4; log >= -4; log -= 0.05) {
      const r = ratio(10 ** log, 200)
      expect(r).toBeGreaterThanOrEqual(last * (1 - 1e-9))
      if (last > 0) expect(r / last).toBeLessThan(1.5)
      last = r
    }
    expect(ratio(STARLIT, 200) / ratio(1e4, 200)).toBeGreaterThan(100)
  })

  it('gives a dim storm day a lit patch at the base and a night a glowing cloud', () => {
    // 2016-06-21: the frame's median ~800 cd/m².
    // The patch where the bolt leaves the base adds most of the base's own light.
    expect(ratio(800, 200)).toBeGreaterThan(0.5)
    expect(ratio(800, 200)).toBeLessThan(1.5)
    expect(ratio(800, 2000)).toBeLessThan(0.03)
    // A starlit night: the upper channel lights the cloud many times over.
    expect(ratio(STARLIT, 2000)).toBeGreaterThan(15)
  })

  it('lets at most half the light out through a face (the dipole, integrated)', () => {
    const P = 1e9
    for (const d of [200, 1000, 3000]) {
      const source = new Vector3(0, d, 0)
      let flux = 0
      const dr = d / 50
      for (let r = dr / 2; r < 50 * d; r += dr) {
        // Lambertian exitance M = π L over a ring.
        flux += Math.PI * flashGlowCd(P, source, new Vector3(r, 0, 0)) * 2 * Math.PI * r * dr
      }
      expect(flux).toBeLessThan((P / 2) * 1.2)
    }
  })

  it('never reads the time of day', () => {
    const source = readFileSync('src/lightning.ts', 'utf8')
    expect(source).not.toMatch(/timeOfDay|sunElevation|nightSky/)
  })
})
