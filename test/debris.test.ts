import { describe, expect, it } from 'vitest'

import { sargassumSeason } from '../src/phenology'
import { debrisFor } from '../src/props/debris'
import { Random } from '../src/random'
import type { SceneSpec } from '../src/sceneSpec'
import { allParams, expectShare, monthOf, scene, scenes, share } from './days'

describe('shore debris', () => {
  const days = allParams()
  const beaches = days.filter(p => p.coast.type === 'beach')
  const spec = (p: (typeof days)[number]) => debrisFor(p, Random.derive(p.seed, 'props/debris'))

  it('only washes up on a beach', () => {
    for (const p of scenes({ coast: 'open-sea' })) expect(spec(p)).toBeNull()
  })

  it('brings driftwood to forested and Arctic coasts, none to the Southern Ocean', () => {
    const wood = (biome: 'nordic' | 'mediterranean' | 'desert', ocean?: 'arctic'): number =>
      share(scenes({ coast: 'beach', biome, ocean }, 60), p => spec(p)!.driftwood > 0)
    expect(wood('nordic', 'arctic')).toBeGreaterThan(0.7)
    expect(wood('nordic')).toBeGreaterThan(wood('mediterranean'))
    expect(wood('desert')).toBeLessThan(0.2)
    for (const biome of ['nordic', 'volcanic'] as const) {
      for (const p of scenes({ coast: 'beach', biome, ocean: 'southern' })) expect(spec(p)!.driftwood).toBe(0)
    }
  })

  it('matches the wrack to the coast', () => {
    for (const p of beaches) {
      const { wrack, coconuts } = spec(p)!
      if (wrack === 'sargassum') expect(p.sea.ocean).toBe('atlantic')
      if (wrack === 'sargassum') expect(['tropical', 'subtropical']).toContain(p.place.climate)
      if (wrack === 'kelp') expect(p.place.climate).not.toBe('tropical')
      if (coconuts > 0) expect(p.place.climate).toBe('tropical')
    }
    expect(share(scenes({ coast: 'beach', place: 'mediterranean-sea' }, 60), p => spec(p)!.wrack === 'seagrass')).toBeGreaterThan(0.5)
  })

  it('follows the climate', () => {
    const wrack = (place: string, kind: string, climate?: 'temperate' | 'subtropical') =>
      share(scenes({ coast: 'beach', place, climate }, 80), p => spec(p)!.wrack === kind)
    expect(wrack('florida-carolinas', 'sargassum')).toBeGreaterThan(0.2)
    expect(wrack('east-australia', 'seagrass')).toBeGreaterThan(0.25)
    expect(wrack('california', 'kelp')).toBeGreaterThan(0.5)
    expect(wrack('yellow-sea', 'kelp', 'temperate')).toBeGreaterThan(0.5)
    expect(share(scenes({ coast: 'beach', place: 'hawaii' }, 60), p => spec(p)!.coconuts > 0)).toBeGreaterThan(0.2)
    expect(wrack('hawaii', 'kelp')).toBe(0)
  })

  describe('sargassum season (SEASONS.md §2.4)', () => {
    const inSeason = (p: (typeof days)[number]): boolean => monthOf(p) >= 4 && monthOf(p) <= 9
    const isSargassum = (p: (typeof days)[number]): boolean => spec(p)?.wrack === 'sargassum'
    const noSeason: SceneSpec = { props: { phenology: false } }
    const antilles = scenes({ coast: 'beach', place: 'antilles' }, 600)
    const drawn = antilles.filter(p => spec({ ...p, overrides: { ...p.overrides, phenology: false } })?.wrack === 'sargassum')

    it('is full April to September and a fifth otherwise, by calendar month', () => {
      for (let m = 1; m <= 12; m++) {
        const date = `2025-${String(m).padStart(2, '0')}-15`
        const at = (id: string, latitudeDeg: number) => sargassumSeason({ date, latitudeDeg, place: { id, climate: 'tropical' } })
        expect(at('antilles', 18)).toBe(m >= 4 && m <= 9 ? 1 : 0.2)
        expect(at('west-africa', 5)).toBe(1)
        expect(at('west-africa', -3)).toBe(1)
        expect(at('northeast-brazil', -8)).toBe(1)
      }
    })

    it('washes up mostly in season on the Caribbean coasts', () => {
      expectShare(drawn.filter(inSeason), isSargassum, 1)
      expectShare(drawn.filter(p => !inSeason(p)), isSargassum, 0.2)
      // Real days too, all places with a season: in season at least twice as often.
      const real = days.filter(p => p.place.id !== 'west-africa' && p.place.id !== 'northeast-brazil' && isSargassum(p))
      expect(real.filter(inSeason).length).toBeGreaterThan(real.filter(p => !inSeason(p)).length * 2)
    })

    it('keeps its own months off West Africa and northeast Brazil', () => {
      for (const place of ['west-africa', 'northeast-brazil']) {
        for (const p of scenes({ coast: 'beach', place }, 60)) {
          expect(spec(p)).toEqual(spec({ ...p, overrides: { ...p.overrides, phenology: false } }))
        }
      }
    })

    it('leaves every other draw of the day alone', () => {
      for (const p of antilles) {
        const on = spec(p)!
        const off = spec({ ...p, overrides: { ...p.overrides, phenology: false } })!
        expect({ ...on, wrack: null, wrackAmount: 0 }).toEqual({ ...off, wrack: null, wrackAmount: 0 })
        if (on.wrack != null) expect(on).toEqual(off)
      }
    })

    it('leaves other wrack kinds alone and a forced wrack in any month', () => {
      for (const p of days) {
        const off = spec({ ...p, overrides: { ...p.overrides, phenology: false } })
        if (off?.wrack !== 'sargassum') expect(spec(p)).toEqual(off)
      }
      const winter = scene({ coast: 'beach', place: 'antilles', props: { debris: { wrack: 'sargassum' } } }, '2025-01-15')
      expect(spec(winter)!.wrack).toBe('sargassum')
      expect(scene({ coast: 'beach', place: 'antilles', ...noSeason }, '2025-01-15').overrides?.phenology).toBe(false)
    })
  })
})
