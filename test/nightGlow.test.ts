import { describe, expect, it } from 'vitest'

import {
  airglowZenith,
  ARTIFICIAL,
  galactic,
  MILKY_WAY_LOG2,
  s10ToMag,
  solarActivity,
  vanRhijn,
  zodiacalS10,
  GREEN_LAYER_KM
} from '../src/nightGlow'
import { PLACES } from '../src/places'
import { generateParams } from '../src/params'
import { allParams, scene, share } from './days'
import { milkyWayMap } from './milkyWayMap.mjs'

// NIGHT_SKY phase 3: the night sky's own light.

const DEG = Math.PI / 180
const radec = (raDeg: number, decDeg: number): [number, number, number] => [
  Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG),
  Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG),
  Math.sin(decDeg * DEG)
]

describe('night glow', () => {
  it('turns J2000 into galactic coordinates', () => {
    // Sgr A* and the north galactic pole.
    const centre = galactic(radec(266.405, -28.936))
    expect(Math.min(centre.l, 360 - centre.l)).toBeLessThan(0.1)
    expect(Math.abs(centre.b)).toBeLessThan(0.1)
    expect(galactic(radec(192.859, 27.128)).b).toBeGreaterThan(89.9)
  })

  it('has a Milky Way map calibrated in S10', () => {
    const at = milkyWayMap(MILKY_WAY_LOG2)
    // The Sagittarius star cloud ~1,000 S10 (~20.2 mag/arcsec²), the poles
    // a few S10, the anticentre between, dust lanes darker than the clouds.
    const cloud = at(2, -5)
    expect(s10ToMag(cloud)).toBeGreaterThan(19.7)
    expect(s10ToMag(cloud)).toBeLessThan(20.7)
    expect(at(0, 89)).toBeLessThan(20)
    expect(at(180, 0)).toBeGreaterThan(30)
    expect(at(180, 0)).toBeLessThan(cloud / 4)
    expect(at(40, 3)).toBeLessThan(at(27, -2) / 3) // Aquila rift vs Scutum cloud
  })

  it('reads Leinert’s zodiacal table', () => {
    expect(zodiacalS10(0, 90)).toBe(77)
    expect(zodiacalS10(90, 0)).toBe(259)
    expect(zodiacalS10(30, 0)).toBe(2480)
    // Halfway along both axes.
    expect(zodiacalS10(32.5, 2.5)).toBeCloseTo((2480 + 1870 + 1650 + 1270) / 4, 6)
    // Gegenschein: brighter opposite the sun than at 150°.
    expect(zodiacalS10(180, 0)).toBeGreaterThan(zodiacalS10(150, 0) * 1.2)
    // Symmetric about the sun and the ecliptic.
    expect(zodiacalS10(-60, -20)).toBe(zodiacalS10(60, 20))
  })

  it('makes a dark sky of the right brightness', () => {
    // Zenith at high ecliptic latitude, away from the Milky Way: airglow +
    // zodiacal + starlight ~ 21.4–22.0 mag/arcsec² over a solar cycle
    // (Wikipedia "Sky brightness": ~220 S10, 21.9).
    for (const date of ['2019-12-01', '2024-11-01']) {
      const sky = airglowZenith(date) + zodiacalS10(90, 60) + 20
      expect(s10ToMag(sky)).toBeGreaterThan(21.2)
      expect(s10ToMag(sky)).toBeLessThan(22.1)
    }
    expect(solarActivity('2024-11-01')).toBeGreaterThan(0.95)
    expect(solarActivity('2019-12-01')).toBeLessThan(0.1)
    // Van Rhijn: 1 overhead, ~5.6 edge-on for a 95 km shell.
    expect(vanRhijn(1, GREEN_LAYER_KM)).toBeCloseTo(1, 6)
    expect(vanRhijn(0, GREEN_LAYER_KM)).toBeGreaterThan(5)
    expect(vanRhijn(0, GREEN_LAYER_KM)).toBeLessThan(6.5)
    // Light pollution grows with the Bortle class.
    expect(ARTIFICIAL[4].zenith).toBeGreaterThan(ARTIFICIAL[3].zenith)
    expect(s10ToMag(airglowZenith('2024-11-01') + 60 + ARTIFICIAL[4].zenith)).toBeGreaterThan(20.4)
  })

  it('is there whenever the sun is down, never by day', () => {
    for (const p of allParams()) expect(p.nightGlow != null).toBe(p.sunElevationDeg < 0)
  })

  it('gives most coasts a dark sky', () => {
    expect(PLACES.every(p => [1, 2, 3, 4].includes(p.bortle))).toBe(true)
    const nights = allParams().filter(p => p.nightGlow != null)
    // Wild coasts: Bortle 1–2 on most nights, 4 on a minority.
    expect(share(nights, p => p.nightGlow!.bortle <= 2)).toBeGreaterThan(0.5)
    expect(share(nights, p => p.nightGlow!.bortle === 4)).toBeLessThan(0.25)
    expect(share(nights, p => p.nightGlow!.bortle === 4)).toBeGreaterThan(0.03)
  })

  it('follows the spec switches without changing the drawn night', () => {
    const base = { timeOfDay: 'night', nightSky: 'starlit', eclipse: null } as const
    const p = scene(base)
    const off = scene({ ...base, milkyWay: false, airglow: null, zodiacalLight: false, skyDarkness: 4 })
    expect(p.nightGlow!.milkyWay && p.nightGlow!.airglow && p.nightGlow!.zodiacal).toBe(true)
    expect(off.nightGlow).toMatchObject({ milkyWay: false, airglow: false, zodiacal: false, bortle: 4 })
    expect(off.nightGlow!.airglowS10).toBe(p.nightGlow!.airglowS10)
    expect(off.title).toBe(p.title)
  })

  it('is deterministic', () => {
    const a = generateParams('2026-06-02', 0, 16 / 9, { timeOfDay: 'night' }).nightGlow
    const b = generateParams('2026-06-02', 0, 16 / 9, { timeOfDay: 'night' }).nightGlow
    expect(a).toEqual(b)
  })
})
