import { describe, expect, it } from 'vitest'

import {
  cameraLimit,
  frameShare,
  meteorRates,
  radec,
  showerZhr,
  SHOWERS,
  skyMagnitude,
  solarLongitude,
  sporadicRate
} from '../src/meteors'
import { apply, skyRotation } from '../src/skyClock'
import { project } from '../src/skyFrame'
import { DARK, scene, scenes } from './days'

// NIGHT_SKY phase 4: shooting stars.

type Vec3 = [number, number, number]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sessionP = (n: number): number => 1 - Math.exp(-n)

describe('meteors', () => {
  it('peaks the showers on their dates', () => {
    const perseids = SHOWERS.find(s => s.id === 'perseids')!
    const geminids = SHOWERS.find(s => s.id === 'geminids')!
    expect(showerZhr(perseids, solarLongitude('2026-08-12'))).toBeGreaterThan(80)
    expect(showerZhr(perseids, solarLongitude('2026-09-30'))).toBeLessThan(0.5)
    expect(showerZhr(geminids, solarLongitude('2025-12-14'))).toBeGreaterThan(80)
    // Dawn has several times the evening's sporadics.
    expect(sporadicRate(5) / sporadicRate(19)).toBeGreaterThan(3)
  })

  it('records fewer meteors under a brighter sky', () => {
    expect(cameraLimit(skyMagnitude({ moonlight: 0 }, 1))).toBeCloseTo(2.5, 6)
    // A full moon costs ×3–10 of a shower's meteors (STARS.md §5).
    const full = cameraLimit(skyMagnitude({ moonlight: 1 }, 2))
    const cost = 2.2 ** (2.5 - full)
    expect(cost).toBeGreaterThan(3)
    expect(cost).toBeLessThan(10)
  })

  it('shows a meteor on most clear Perseid peaks and few ordinary nights', () => {
    const peak = ['2024-08-12', '2025-08-12', '2026-08-12'].flatMap(d => scenes({ ...DARK, place: 'scotland', date: d }, 8))
    const peakP = peak.reduce((s, p) => s + sessionP(meteorRates(p, p.nightGlow!.bortle).total), 0) / peak.length
    expect(peakP).toBeGreaterThan(0.5)
    const ordinary = scenes({ ...DARK, date: '2026-03-10' }, 40)
    const ordinaryP = ordinary.reduce((s, p) => s + sessionP(meteorRates(p, p.nightGlow!.bortle).total), 0) / ordinary.length
    expect(ordinaryP).toBeGreaterThan(0.01)
    expect(ordinaryP).toBeLessThan(0.12)
    // The frame's share of the sky's meteors stays sensible.
    for (const p of ordinary) expect(frameShare(p)).toBeLessThanOrEqual(0.6)
  })

  it('none forced into twilight or under overcast', () => {
    expect(scene({ ...DARK, weather: 'overcast', date: '2026-08-12' }).meteors).toEqual([])
    expect(scene({ timeOfDay: 'blue-hour', eclipse: null, date: '2026-08-12' }).meteors).toEqual([])
  })

  it('runs shower meteors away from their radiant, inside the frame', () => {
    for (const p of scenes({ ...DARK, meteors: 'perseids', date: '2026-08-12', place: 'scotland' }, 20)) {
      expect(p.meteors.length).toBeGreaterThan(0)
      expect(p.title).toContain('Perseids')
      const rot = skyRotation(p).matrix
      const radiant = apply(rot, radec(48, 58))
      for (const m of p.meteors) {
        // On the great circle through the radiant, starting nearer it.
        const normal = cross(m.start, m.end)
        expect(Math.abs(dot(normal, radiant)) / Math.hypot(...normal)).toBeLessThan(0.01)
        expect(dot(m.start, radiant)).toBeGreaterThan(dot(m.end, radiant))
        for (const end of [m.start, m.end]) {
          const ndc = project(p, end)!
          expect(Math.abs(ndc[0])).toBeLessThan(1)
          expect(Math.abs(ndc[1])).toBeLessThan(1)
          expect(end[1]).toBeGreaterThan(0)
        }
      }
    }
  })

  it('follows the spec', () => {
    expect(scene({ ...DARK, date: '2026-03-10', meteors: 2 }).meteors).toHaveLength(2)
    expect(scene({ ...DARK, date: '2026-03-10', meteors: null }).meteors).toEqual([])
  })
})
