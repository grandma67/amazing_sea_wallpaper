import { describe, expect, it } from 'vitest'

import { frameBoost, frameBoostRule, longExposureLook, median, shutterSeconds } from '../src/frameMeter'
import { allParams, expectEvery } from './days'

describe('median', () => {
  it('takes the middle, leaving out what is not finite', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([1, NaN, Infinity, 5, 3])).toBe(3)
    expect(median([])).toBe(0)
  })
})

describe('frameBoost', () => {
  const rule = { floor: 0.03, maxStops: 6 }

  it('lifts a dark frame to the floor, never darkens one above it', () => {
    expect(frameBoost(0.003, rule)).toBeCloseTo(10)
    expect(frameBoost(0.03, rule)).toBe(1)
    expect(frameBoost(0.5, rule)).toBe(1)
  })

  it('stops at its most, even on a black frame', () => {
    expect(frameBoost(1e-6, rule)).toBe(64)
    expect(frameBoost(0, rule)).toBe(64)
  })
})

describe('frameBoostRule over real days', () => {
  const days = allParams()
  const cloudyNight = (p: (typeof days)[number]): boolean => p.timeOfDay === 'night' && ['broken', 'overcast'].includes(p.weather.kind)

  it('lifts nights only where cloud hides the stars, ~22 of 1095 days', () => {
    const nights = days.filter(p => p.timeOfDay === 'night' && frameBoostRule(p) != null)
    expectEvery(nights, cloudyNight, { what: p => p.date })
    expect(nights.length).toBeGreaterThan(10)
    expect(nights.length).toBeLessThan(40)
  })

  it('leaves open nights, blue hour and storms alone', () => {
    const left = days.filter(p => (p.timeOfDay === 'night' && !cloudyNight(p)) || p.timeOfDay === 'blue-hour' || p.storm != null)
    expectEvery(left, p => frameBoostRule(p) == null, { what: p => p.date })
  })

  it('gives sun-up days a small lift at most, nights a long one', () => {
    for (const p of days.filter(d => d.timeOfDay !== 'night' && frameBoostRule(d) != null)) expect(frameBoostRule(p)!.maxStops).toBeLessThanOrEqual(1.5)
    const night = days.find(cloudyNight)!
    expect(frameBoostRule(night)!.maxStops).toBe(6)
  })
})

describe('the shutter', () => {
  it('meters f/2.8, ISO 1600: mid-grey at 0.061 / L seconds', () => {
    expect(shutterSeconds(0.061, 0.18)).toBeCloseTo(1)
    // A cloudy night's frame (~1e-4 cd/m²) lifted to 0.03: ~100 s, as the plan reckoned.
    expect(shutterSeconds(1e-4, 0.03)).toBeGreaterThan(50)
    expect(shutterSeconds(1e-4, 0.03)).toBeLessThan(200)
    expect(shutterSeconds(0, 0.1)).toBe(0)
  })

  it('shows no look under half a second, all of it past 30 s, rising between', () => {
    expect(longExposureLook(0.1)).toBe(0)
    expect(longExposureLook(0.5)).toBe(0)
    expect(longExposureLook(30)).toBeCloseTo(1)
    expect(longExposureLook(300)).toBe(1)
    const looks = [1, 2, 5, 10, 20].map(longExposureLook)
    for (let i = 1; i < looks.length; i++) expect(looks[i]).toBeGreaterThan(looks[i - 1])
  })
})
