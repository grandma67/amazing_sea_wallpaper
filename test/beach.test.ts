import { describe, expect, it } from 'vitest'

import { BEACH_MATERIALS, beachLines, FUNDY_STONES, materialChances, MATERIAL_CHANCES } from '../src/beach'
import { hasBeach } from '../src/coastKind'
import { PLACES, placeNamed } from '../src/places'
import { bareBeach, highWater } from '../src/tides'
import { allParams, scene, scenes, share } from './days'

describe('beach material', () => {
  const days = allParams()
  const beaches = days.filter(p => hasBeach(p.coast))
  const stony = (p: (typeof days)[number]): boolean => p.coast.material !== 'sand'

  it('is about 59% sand, 17% mixed, 24% shingle or cobble on beach days', () => {
    expect(share(beaches, p => p.coast.material === 'sand')).toBeCloseTo(0.59, 1)
    expect(share(beaches, p => p.coast.material === 'mixed')).toBeCloseTo(0.17, 1)
    expect(share(beaches, p => p.coast.material === 'shingle' || p.coast.material === 'cobble')).toBeCloseTo(0.24, 1)
  })

  it('follows the place: stony in the north, sandy in the tropics', () => {
    const where = (test: (p: (typeof days)[number]) => boolean) => share(beaches.filter(test), stony)
    expect(where(p => p.biome.name === 'nordic')).toBeGreaterThan(0.5)
    expect(where(p => p.biome.name === 'tropical')).toBeLessThan(0.15)
    // Temperate shingle coasts: more shingle than the nordic default (few
    // days, so check the table too).
    expect(where(p => p.place.region === 'britain-ireland' || p.place.region === 'atlantic-canada')).toBeGreaterThan(0.4)
    for (const id of ['scotland', 'brittany', 'nova-scotia']) {
      expect(materialChances(placeNamed(id), 'temperate').shingle!).toBeGreaterThan(MATERIAL_CHANCES.nordic.shingle!)
    }
    // No shingle on tropical coasts, by table and on real days.
    for (const place of PLACES.filter(p => p.biome === 'tropical')) {
      for (const climate of Object.keys(place.climate)) {
        expect(materialChances(place, climate as never).shingle ?? 0).toBe(0)
      }
    }
    expect(beaches.some(p => p.biome.name === 'tropical' && p.coast.material === 'shingle')).toBe(false)
  })

  it('gives every place valid chances and stone colours', () => {
    for (const place of PLACES) {
      for (const climate of Object.keys(place.climate)) {
        const chances = Object.entries(materialChances(place, climate as never))
        expect(chances.length).toBeGreaterThan(0)
        for (const [m, w] of chances) {
          expect(BEACH_MATERIALS).toContain(m)
          expect(w).toBeGreaterThan(0)
        }
      }
      expect(place.stones.length).toBeGreaterThan(0)
      for (const c of place.stones.flat()) expect(c).toBeGreaterThan(0)
    }
    // Polar coasts use the polar row; overrides beat both.
    expect(materialChances(placeNamed('svalbard'), 'polar')).not.toEqual(MATERIAL_CHANCES.nordic)
    expect(materialChances(placeNamed('wadden-north-sea'), 'temperate').sand).toBeGreaterThan(90)
    expect(placeNamed('fundy').stones).toBe(FUNDY_STONES)
  })

  it('gives stony beaches a steep, narrow, ridged profile, and sand ones none', () => {
    for (const p of beaches) {
      const { coast } = p
      if (coast.material === 'sand') {
        expect(coast.ridges).toEqual([])
        continue
      }
      // Pure gravel 0.08–0.24 (Jennings & Shulmeister 2002); mixed 0.08–0.14.
      expect(coast.beachSlope).toBeGreaterThanOrEqual(0.08)
      expect(coast.beachSlope).toBeLessThanOrEqual(coast.material === 'mixed' ? 0.14 : 0.24)
      expect(coast.beachWidth).toBeLessThanOrEqual(40)
      // Reflective (shingle, cobble) or a gravel upper beach over a sand
      // terrace (mixed): no bars beyond the terrace.
      expect(coast.bars.length).toBeLessThanOrEqual(coast.material === 'mixed' ? 1 : 0)
      expect(coast.ridges.length).toBeGreaterThanOrEqual(1)
      expect(coast.ridges.length).toBeLessThanOrEqual(3)
      // The storm ridge stands where storm swash reaches (1–2.5 m above the
      // spring high water), behind
      // the berm at the high-tide line; it is the beach's storm line.
      const [storm, berm] = coast.ridges
      const { highTide, stormLine } = beachLines(coast)
      expect(stormLine).toBe(storm.distance)
      const bare = bareBeach(coast, storm.distance) - highWater(coast)
      if (storm.distance < coast.beachWidth * 1.2) {
        expect(bare).toBeGreaterThan(0.9)
        expect(bare).toBeLessThan(2.6)
        expect(storm.distance).toBeGreaterThanOrEqual(highTide + 6 - 1e-9)
      }
      if (berm != null) expect(berm.distance).toBeCloseTo(highTide, 6)
      for (const r of coast.ridges) {
        expect(r.height).toBeGreaterThanOrEqual(0.3)
        expect(r.width).toBeGreaterThanOrEqual(1.5)
        expect(r.height).toBeLessThanOrEqual(1.2)
        expect(r.distance).toBeGreaterThan(0)
      }
    }
    // The open sea has no material.
    for (const p of days.filter(p => !hasBeach(p.coast))) expect(p.coast.material).toBe('sand')
  })

  it('names stony beaches in the title', () => {
    expect(scene({ place: 'nova-scotia', climate: 'temperate', beachMaterial: 'cobble' }).title).toContain('temperate cobble beach')
    expect(scene({ place: 'western-med', beachMaterial: 'shingle' }).title).toContain('mediterranean shingle beach')
    expect(scene({ place: 'scotland', beachMaterial: 'mixed' }).title).toContain('sand and gravel beach')
    expect(scene({ place: 'maldives', coast: 'beach', beachMaterial: 'sand', sand: 'white' }).title).toContain('white sand beach')
  })

  it('forces a material on any place, and a stony one implies a beach', () => {
    for (const p of scenes({ beachMaterial: 'shingle' }, 30)) {
      expect(p.coast.type).toBe('beach')
      expect(p.coast.material).toBe('shingle')
    }
    expect(scene({ place: 'maldives', beachMaterial: 'cobble' }).coast.material).toBe('cobble')
    expect(scene({ coast: 'open-sea', beachMaterial: 'cobble' }).coast.material).toBe('sand')
  })

  it('draws, then forces: forcing sand leaves the rest of a stony day as drawn', () => {
    for (const p of beaches.filter(stony).slice(0, 20)) {
      const sand = scene({ beachMaterial: 'sand' }, p.date)
      expect(sand.coast.material).toBe('sand')
      expect(sand.place).toEqual(p.place)
      expect(sand.coast.noiseOffset).toEqual(p.coast.noiseOffset)
      expect(sand.camera.focalLengthMm).toBe(p.camera.focalLengthMm)
    }
  })
})
