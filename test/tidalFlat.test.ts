import { describe, expect, it } from 'vitest'

import { hasBeach, hasLand, hasSurfZone } from '../src/coastKind'
import { Random } from '../src/random'
import { wobbleAtCamera } from '../src/rockShore'
import { terrainNormal } from '../src/terrain'
import { bareFlat, flatCreeks, flatWaterline, tidalFlatFor } from '../src/tidalFlat'
import { placeNamed, PLACES } from '../src/places'
import { allParams, expectDryCameras, expectShare, heightAt as at, scene, scenes } from './days'

const base = { eclipse: null, coast: 'tidal-flat' } as const
const places = ['wadden-north-sea', 'fundy', 'morecambe-bay', 'mont-saint-michel', 'yellow-sea']
const flats = places.flatMap(place => scenes({ ...base, place, tide: 'low' }, 8))
const MUD: [number, number, number] = [0.16, 0.14, 0.11]

describe('tidal flat shape', () => {
  it('is km wide and near level, steeper for a bigger tide, from mean high water to spring low water', () => {
    for (let i = 0; i < 300; i++) {
      for (const range of [2, 4, 8, 14]) {
        const { flat, marsh, nearshoreSlope } = tidalFlatFor(range, MUD, Random.derive(`f${i}`, 'tidal-flat'))
        expect(flat.width).toBeGreaterThanOrEqual(800)
        expect(flat.width).toBeLessThanOrEqual(5000)
        const slope = (flat.top - flat.low) / flat.width
        expect(slope).toBeGreaterThan(1 / 4000)
        expect(slope).toBeLessThan(1 / 200)
        expect(flat.top).toBeCloseTo(0.42 * range)
        expect(flat.low).toBeLessThan(-range / 2)
        // The marsh: above the flat's top, at most a little above spring high water.
        expect(marsh.height).toBeGreaterThan(flat.top)
        expect(marsh.height).toBeLessThanOrEqual(range / 2 + 0.2 + 1e-9)
        expect(marsh.back).toBeGreaterThan(range / 2)
        expect(marsh.width).toBeGreaterThanOrEqual(80)
        expect(nearshoreSlope).toBeLessThan(0.01)
      }
    }
    const slope = (range: number): number => {
      let sum = 0
      for (let i = 0; i < 200; i++) {
        const { flat } = tidalFlatFor(range, MUD, Random.derive(`s${i}`, 'tidal-flat'))
        sum += (flat.top - flat.low) / flat.width
      }
      return sum / 200
    }
    expect(slope(12)).toBeGreaterThan(1.5 * slope(3))
  })

  it('finds the water on its bare profile (flatWaterline inverts bareFlat)', () => {
    for (const p of flats) {
      const { flat, marsh, nearshoreSlope, seabedDepth } = p.coast
      for (const level of [-7, -3, -1, 0, 0.5, 1.5, 3, 6]) {
        const s = flatWaterline(flat!, marsh!, nearshoreSlope, seabedDepth, level)
        if (level < marsh!.back) expect(bareFlat(flat!, marsh!, nearshoreSlope, seabedDepth, s)).toBeCloseTo(level, 4)
      }
    }
  })

  it('falls from the marsh to the seabed, continuous at every join', () => {
    for (const p of flats) {
      const { flat, marsh, nearshoreSlope, seabedDepth } = p.coast
      const h = (s: number): number => bareFlat(flat!, marsh!, nearshoreSlope, seabedDepth, s)
      for (const join of [-0.6, 0, flat!.width]) expect(Math.abs(h(join + 1e-6) - h(join - 1e-6))).toBeLessThan(1e-3)
      for (let s = -marsh!.width - 50; s < flat!.width + 2000; s += 7) expect(h(s + 7)).toBeLessThanOrEqual(h(s) + 1e-9)
      expect(h(1e5)).toBeGreaterThan(-seabedDepth - 0.01)
    }
  })

  it('cuts creeks near the camera to their drawn depth, wider and shallower far off', () => {
    for (const p of flats.slice(0, 10)) {
      const c = p.coast
      const fl = c.flat!
      // Halfway out, near the camera: the deepest cut over one channel spacing.
      let deepest = 0
      for (let a = -fl.channelSpacing; a <= fl.channelSpacing; a += 0.5) deepest = Math.max(deepest, flatCreeks(c, fl.width / 2, a))
      const t = (fl.width / 2 + 0.6 * c.marsh!.width) / (fl.width + 0.6 * c.marsh!.width)
      const drawn = 0.4 + (fl.channelDepth - 0.4) * (t * t * (3 - 2 * t))
      expect(deepest).toBeGreaterThan(0.95 * drawn)
      expect(deepest).toBeLessThan(fl.channelDepth + 1e-9)
      let far = 0
      for (let a = -fl.channelSpacing; a <= fl.channelSpacing; a += 0.5) far = Math.max(far, flatCreeks(c, fl.width / 2, a, 3000))
      expect(far).toBeLessThan(deepest)
    }
  })
})

describe('tidal flat days', () => {
  it('are land with no beach and no surf: no terrace, bars, rips, cusps, ridges, reef or rock', () => {
    for (const p of flats) {
      const c = p.coast
      expect(hasLand(c) && !hasSurfZone(c) && !hasBeach(c)).toBe(true)
      expect(c.terrace.width).toBe(0)
      expect([c.bars, c.ridges]).toEqual([[], []])
      expect([c.rips, c.cusps, c.reef, c.shelter, c.rock]).toEqual([null, null, null, null, null])
      expect(c.marsh!.start).toBe(0)
      expect(c.runup).toBeLessThan(0.25)
      expect(p.title).toMatch(/tidal flats/)
    }
    expect(scene({ eclipse: null, coast: 'beach' }).coast.flat).toBeNull()
  })

  it("puts today's water far out at low tide (the sea a far line), near sea level there", () => {
    for (const p of flats) {
      const c = p.coast
      expect(c.waterline).toBeGreaterThan(0.6 * c.flat!.width)
      // The median along 400 m of shore (creeks cut single spots).
      const near: number[] = []
      for (let a = -200; a <= 200; a += 5) near.push(Math.abs(at(c, c.waterline, a)))
      near.sort((x, y) => x - y)
      expect(near[near.length >> 1]).toBeLessThan(0.1)
      expect(at(c, c.flat!.width + 500)).toBeLessThan(0)
      expect(Number.isFinite(at(c, -3000))).toBe(true)
    }
  })

  it('stands the camera above the water and the run-up at every tide: on the flat, its edge or in the marsh', () => {
    for (const p of [...places.flatMap(place => expectDryCameras({ ...base, place }, { count: 3, above: q => q.coast.runup }))]) {
      const c = p.coast
      expect(['shoreline', 'along-beach', 'framed']).toContain(c.composition)
      const u = c.distanceToWater + wobbleAtCamera(c)
      if (c.composition !== 'shoreline') expect(u).toBeGreaterThan(0)
      const n = terrainNormal(c, 0, 0)
      expect(Number.isFinite(n[0] + n[1] + n[2])).toBe(true)
    }
    const out = scenes({ ...base, place: 'wadden-north-sea', tide: 'low', composition: 'shoreline' }, 10)
    for (const p of out) expect(p.coast.distanceToWater + wobbleAtCamera(p.coast)).toBeLessThan(0)
  })
})

describe('tidal flat and salt marsh shares', () => {
  it('come only from the five flat places, about half their land days split by the tide', () => {
    for (const p of PLACES) expect((p.coast['tidal-flat'] ?? 0) > 0).toBe(places.includes(p.id))
    for (const id of places) expect(placeNamed(id).coast['tidal-flat']).toBeGreaterThanOrEqual(0.25)
    for (const p of allParams()) {
      if (p.coast.type === 'tidal-flat' || (p.coast.marsh != null && p.coast.flat == null)) expect(places).toContain(p.place.id)
    }
    // 120 days in each flat place: land 65% × flat weight, below mid tide ~half.
    for (const id of ['wadden-north-sea', 'mont-saint-michel']) {
      const land = scenes({ place: id }, 160).filter(p => hasLand(p.coast))
      const flatOrMarsh = land.filter(p => p.coast.marsh != null)
      expectShare(land, p => p.coast.marsh != null, 0.5)
      expectShare(flatOrMarsh, p => p.coast.type === 'tidal-flat', 0.5)
    }
  })

  it('make a flat only below mid tide, and a beach with a marsh at or above it', () => {
    for (const id of places) {
      for (const p of scenes({ place: id }, 60)) {
        if (p.coast.type === 'tidal-flat') expect(p.coast.tide.level).toBeLessThan(0)
        if (p.coast.marsh != null && p.coast.flat == null) {
          expect(p.coast.type).toBe('beach')
          expect(p.coast.tide.level).toBeGreaterThanOrEqual(0)
        }
      }
    }
    // params.mjs --expect: ~0.29% of days are flats (the places are 1.9% of days).
    expectShare(allParams(), p => p.coast.type === 'tidal-flat', 0.0029)
  })

  it('puts a marsh behind any beach on demand, none when asked, without moving other draws', () => {
    for (const p of scenes({ eclipse: null, saltMarsh: true }, 15)) {
      const c = p.coast
      expect(c.type).toBe('beach')
      expect(c.marsh!.start).toBe(c.beachWidth)
      expect(c.beachWidth).toBeLessThanOrEqual(30)
      expect(c.duneHeight).toBe(0)
      expect(p.title).toMatch(/salt marsh/)
    }
    for (const p of scenes({ place: 'wadden-north-sea', coast: 'beach', saltMarsh: null }, 20)) expect(p.coast.marsh).toBeNull()
    const plain = scene({ eclipse: null, place: 'wadden-north-sea', coast: 'beach', saltMarsh: null })
    const marsh = scene({ eclipse: null, place: 'wadden-north-sea', coast: 'beach', saltMarsh: true })
    expect([marsh.camera.headingDeg, marsh.coast.tide, marsh.coast.noiseOffset]).toEqual([plain.camera.headingDeg, plain.coast.tide, plain.coast.noiseOffset])
  })
})
