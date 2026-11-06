import { describe, expect, it } from 'vitest'

import {
  dinghy,
  expeditionShip,
  floatOnWaves,
  icebreaker,
  polarFleet,
  polarWaters,
  shipSpeed,
  splashHeight,
  UNDERWAY,
  wakeFor,
  whitecapFraction,
  type HullSize
} from '../src/props/ships'
import type { ShipKind } from '../src/sceneSpec'
import { Random } from '../src/random'
import { allParams, monthOf, scene, share } from './days'

describe('ships in polar seas', () => {
  const polar = allParams().filter(polarWaters)
  const fleet = (p: (typeof polar)[number]) => polarFleet(p, Random.derive(p.seed, 'ships'))
  const summer = (p: (typeof polar)[number]) =>
    p.sea.ocean === 'southern' ? monthOf(p) >= 11 || monthOf(p) <= 3 : monthOf(p) >= 6 && monthOf(p) <= 9

  it('is only the Arctic and the Southern Ocean', () => {
    expect(polar.length).toBeGreaterThan(30)
    for (const p of allParams()) expect(polarWaters(p)).toBe(['arctic', 'southern'].includes(p.sea.ocean))
  })

  it('sends expedition ships only in their season', () => {
    for (const p of polar) if (!summer(p)) expect(fleet(p)).not.toContain('expedition-ship')
    // Antarctic season is the southern summer.
    for (const date of ['2024-07-10', '2024-08-15']) {
      for (let i = 0; i < 20; i++) {
        const p = scene({ date, ocean: 'southern', seed: `s${i}` })
        expect(polarFleet(p, new Random(`f${i}`))).not.toContain('expedition-ship')
      }
    }
  })

  it('has more dinghies out in summer', () => {
    const hasDinghy = (p: (typeof polar)[number]) => fleet(p).includes('dinghy')
    const inSummer = share(polar.filter(summer), hasDinghy)
    const inWinter = share(polar.filter(p => !summer(p)), hasDinghy)
    expect(inSummer).toBeGreaterThan(0.3)
    expect(inWinter).toBeLessThan(inSummer)
  })
})

describe('ships on the waves', () => {
  const small: HullSize = { length: 6, beam: 2.3, freeboard: 0.66, spacing: 0 }
  const big: HullSize = { length: 250, beam: 35, freeboard: 15, spacing: 0 }

  it('records the hull size on every boat', () => {
    for (const g of [dinghy(new Random('a')), expeditionShip(new Random('b')), icebreaker(new Random('c'))]) {
      const hull = g.userData.hull as HullSize
      expect(hull.length).toBeGreaterThan(4)
      expect(hull.beam).toBeGreaterThan(1)
      expect(hull.freeboard).toBeGreaterThan(0)
    }
  })

  it('goes at real speeds, sailing boats becalmed without wind', () => {
    for (const kind of Object.keys(UNDERWAY) as ShipKind[]) {
      const max = Math.max(...UNDERWAY[kind].modes.map(m => m[1])) * 0.5144
      for (let i = 0; i < 50; i++) {
        const u = shipSpeed(kind, 8, new Random(`${kind}${i}`))
        expect(u).toBeGreaterThanOrEqual(0)
        expect(u).toBeLessThanOrEqual(max + 1e-9)
        if (UNDERWAY[kind].sail) expect(shipSpeed(kind, 1, new Random(`${kind}${i}`))).toBe(0)
      }
    }
    // Same draws whatever the outcome, so later draws don't shift.
    const a = new Random('x')
    const b = new Random('x')
    shipSpeed('sloop', 0, a)
    shipSpeed('sloop', 10, b)
    expect(a.float()).toBe(b.float())
  })

  it('leaves no wake when lying still, but the sea still breaks on a low hull', () => {
    const still = wakeFor('dinghy', small, 0, 2)
    expect(still.height).toBe(0)
    expect(still.foam).toBe(0)
    expect(still.collar).toBeGreaterThan(0.4)
    expect(wakeFor('container-ship', big, 0, 2).collar).toBeLessThan(0.25)
  })

  it('makes a bigger, longer-lasting wake behind a bigger ship', () => {
    const ship = wakeFor('container-ship', big, 9, 1)
    const boat = wakeFor('sloop', { length: 12, beam: 3.8, freeboard: 1.1, spacing: 0 }, 3, 1)
    expect(ship.height).toBeGreaterThan(boat.height)
    expect(ship.foamTime).toBeGreaterThan(boat.foamTime)
    // Propellers churn; a sloop under sail barely foams.
    expect(ship.foam).toBeGreaterThan(0.5)
    expect(boat.foam).toBeLessThan(0.3)
    for (const w of [ship, boat]) expect(w.height).toBeLessThan(2)
  })

  it('floats on long waves and rides over short ones', () => {
    const flat = floatOnWaves(() => 0, 0, 0, 0.3, big)
    expect(flat.heave).toBe(0)
    expect(flat.pitch).toBeCloseTo(0)
    // A swell 4× the hull's length: follows it.
    const heading = 0.7
    const fx = Math.sin(heading)
    const fz = -Math.cos(heading)
    const swell = (lambda: number, a: number) => (x: number, z: number) => a * Math.sin(((x * fx + z * fz) / lambda) * 2 * Math.PI + 0.3)
    const long = floatOnWaves(swell(1000, 3), 0, 0, heading, big)
    expect(Math.abs(long.heave - 3 * Math.sin(0.3))).toBeLessThan(0.3)
    expect(long.pitch).toBeGreaterThan(0.01)
    // Chop a twentieth of its length: hardly moves it.
    const chop = floatOnWaves(swell(12, 1), 0, 0, heading, big)
    expect(Math.abs(chop.heave)).toBeLessThan(0.3)
    expect(Math.abs(chop.pitch)).toBeLessThan(0.002)
    // Beam seas roll it.
    const beamSea = (x: number, z: number) => 0.5 * Math.sin(((x * Math.cos(heading) + z * Math.sin(heading)) / 20) * 2 * Math.PI)
    expect(Math.abs(floatOnWaves(beamSea, 0, 0, heading, small).roll)).toBeGreaterThan(0.05)
  })

  it('splashes only when crests climb the hull or the bow drives into them', () => {
    expect(splashHeight(0.05, 0, small)).toBe(0)
    expect(splashHeight(0.5, 0, small)).toBeGreaterThan(0.2)
    expect(splashHeight(0, 4, small)).toBeGreaterThan(0.1)
    expect(splashHeight(2, 0, big)).toBe(0)
    expect(splashHeight(10, 20, small)).toBeLessThanOrEqual(3)
  })
  it('has whitecaps as Monahan measured them', () => {
    expect(whitecapFraction(4)).toBeLessThan(0.002)
    expect(whitecapFraction(15)).toBeGreaterThan(0.03)
    expect(whitecapFraction(15)).toBeLessThan(0.05)
  })
})
