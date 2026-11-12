import { describe, expect, it } from 'vitest'

import { BLOOM_PLANTS, BLOOM_REGIONS, bloomRegion, bloomYear, desertBloomFor } from '../src/bloomYears'
import type { SceneParams } from '../src/params'
import { PLACES } from '../src/places'
import { createDesertBloom } from '../src/props/bloomYears'
import { parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, scene, viewOf } from './days'

// NATURE_PLAN phase 16: bloom years (bloomYears.ts; plants props/bloomYears.ts,
// far tint terrain.ts and props/landforms.ts).

const BASE: SceneSpec = { eclipse: null, storm: null, fog: null, snow: null, weather: 'few', timeOfDay: 'daylight' }
/** A day in a region's place at a given latitude and ocean, the rest as drawn. */
const at = (place: string, date: string, latitudeDeg: number, ocean = 'atlantic', patch: Partial<SceneParams> = {}): SceneParams => {
  const p = scene({ ...BASE, place, coast: 'beach' }, date)
  return { ...p, latitudeDeg, sea: { ...p.sea, ocean: ocean as SceneParams['sea']['ocean'] }, overrides: undefined, ...patch }
}

describe('bloom years', () => {
  it('one draw per region and calendar year: every day of a year agrees, whatever the seed', () => {
    for (const region of ['atacama', 'namaqualand', 'baja'] as const) {
      for (const year of [2024, 2025, 2026]) expect(bloomYear(region, year)).toEqual(bloomYear(region, year))
    }
    const a = desertBloomFor(at('namibia', '2025-08-10', -31))
    const b = desertBloomFor({ ...at('namibia', '2025-08-25', -31), seed: 'another' })
    expect(a?.strength).toBe(b?.strength)
  })

  it('bloom-year shares as planned (Atacama 0.37, Baja 0.3, Namaqualand every year)', () => {
    const years = Array.from({ length: 2000 }, (_, i) => 1000 + i)
    const share = (r: 'atacama' | 'baja'): number => years.filter(y => bloomYear(r, y).blooms).length / years.length
    expect(Math.abs(share('atacama') - 0.37)).toBeLessThan(0.04)
    expect(Math.abs(share('baja') - 0.3)).toBeLessThan(0.04)
    expect(years.every(y => bloomYear('namaqualand', y).blooms)).toBe(true)
    for (const y of years.slice(0, 200)) {
      const s = bloomYear('namaqualand', y).strength
      expect(s).toBeGreaterThanOrEqual(0.3)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('regions by place, ocean and latitude', () => {
    expect(bloomRegion(at('atacama-peru', '2025-10-10', -27))).toBe('atacama')
    expect(bloomRegion(at('atacama-peru', '2025-10-10', -20))).toBeNull()
    expect(bloomRegion(at('namibia', '2025-08-10', -31))).toBe('namaqualand')
    expect(bloomRegion(at('namibia', '2025-08-10', -22))).toBeNull()
    expect(bloomRegion(at('cape', '2025-08-10', -33.2, 'atlantic'))).toBe('namaqualand')
    expect(bloomRegion(at('cape', '2025-08-10', -33.2, 'indian'))).toBeNull()
    expect(bloomRegion(at('cape', '2025-08-10', -34.2, 'atlantic'))).toBeNull()
    expect(bloomRegion(at('baja-sonora', '2025-03-10', 28, 'pacific'))).toBe('baja')
    expect(bloomRegion(at('baja-sonora', '2025-03-10', 28, 'gulf-of-california'))).toBeNull()
    for (const id of ['atacama-peru', 'namibia', 'cape', 'baja-sonora']) expect(PLACES.some(p => p.id === id), id).toBe(true)
  })

  it('by local month: Namaqualand Aug–Sep, Jul and Oct ×0.4; the Atacama Sep–Nov; Baja Feb–Apr; nothing out of season', () => {
    const nama = (date: string): number => desertBloomFor(at('namibia', date, -31))?.strength ?? 0
    const year = bloomYear('namaqualand', 2025).strength
    expect(nama('2025-08-15')).toBeCloseTo(year)
    expect(nama('2025-07-15')).toBeCloseTo(0.4 * year)
    expect(nama('2025-02-15')).toBe(0)
    // Cape West Coast: Aug–Sep only.
    expect(desertBloomFor(at('cape', '2025-07-15', -33.2))).toBeNull()
    const ata = bloomYear('atacama', 2025)
    const atacamaOct = desertBloomFor(at('atacama-peru', '2025-10-10', -27))?.strength ?? 0
    expect(atacamaOct).toBeCloseTo(ata.blooms ? ata.strength : 0)
    expect(desertBloomFor(at('atacama-peru', '2025-02-10', -27))).toBeNull()
    const baja = bloomYear('baja', 2026)
    expect(desertBloomFor(at('baja-sonora', '2026-03-10', 28, 'pacific'))?.strength ?? 0).toBeCloseTo(baja.blooms ? baja.strength : 0)
    expect(desertBloomFor(at('baja-sonora', '2026-08-10', 28, 'pacific'))).toBeNull()
  })

  it('daisies close on a cloudy day', () => {
    const p = at('namibia', '2025-08-15', -31)
    const sunny = desertBloomFor(p)!.strength
    expect(desertBloomFor({ ...p, weather: { ...p.weather, kind: 'overcast' } })!.strength).toBeCloseTo(sunny * 0.3)
  })

  it('forced, a strength, switched off, none under snow or on open sea', () => {
    const p = at('namibia', '2025-02-15', -22)
    expect(desertBloomFor({ ...p, overrides: { desertBloom: true } })?.region).toBe('namaqualand')
    expect(desertBloomFor({ ...p, overrides: { desertBloom: 0.4 } })?.strength).toBeCloseTo(0.4)
    expect(desertBloomFor({ ...at('namibia', '2025-08-15', -31), overrides: { desertBloom: false } })).toBeNull()
    expect(desertBloomFor({ ...at('aegean', '2025-08-15', 38), overrides: { desertBloom: true } })).toBeNull()
    expect(desertBloomFor({ ...at('namibia', '2025-08-15', -31), snow: { cover: 0.8 } as SceneParams['snow'] })).toBeNull()
    expect(() => parseSceneSpec({ props: { desertBloom: 'yes' } })).toThrow(/spec\.props\.desertBloom/)
    const plain = scene({ ...BASE, place: 'namibia', coast: 'beach' }, '2025-08-15')
    const forced = scene({ ...BASE, place: 'namibia', coast: 'beach', props: { desertBloom: true } }, '2025-08-15')
    expect({ ...forced, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })

  it('every region’s plants are known, their shares sum to 1; far colours are linear albedo', () => {
    for (const [region, row] of Object.entries(BLOOM_REGIONS)) {
      expect(row.plants.reduce((s, [, w]) => s + w, 0), region).toBeCloseTo(1)
      for (const [p] of row.plants) expect(BLOOM_PLANTS).toContain(p)
    }
    const b = desertBloomFor({ ...at('namibia', '2025-08-15', -31) })!
    for (const c of [...b.farMain, ...b.farRest, ...b.far]) expect(c >= 0 && c <= 1).toBe(true)
  })

  it('on real days, only in a region in its season', () => {
    expectEvery(allParams().filter(p => desertBloomFor(p) != null), p => bloomRegion(p) != null, { what: p => [p.date, p.place.id] })
  })

  it('plants placed behind the shore, deterministic', () => {
    const p = scene({ ...BASE, place: 'atacama-peru', coast: 'beach', composition: 'framed', props: { desertBloom: true } }, '2025-09-11')
    const ctx = viewOf(p)
    const meshes = createDesertBloom(ctx)
    const count = meshes.reduce((n, m) => n + m.count, 0)
    expect(createDesertBloom(ctx).reduce((n, m) => n + m.count, 0)).toBe(count)
    expect(createDesertBloom(viewOf(scene({ ...BASE, place: 'atacama-peru', coast: 'beach', composition: 'framed', props: { desertBloom: false } }, '2025-09-11')))).toEqual([])
  })
})
