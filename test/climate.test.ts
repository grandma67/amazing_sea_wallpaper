import { describe, expect, it } from 'vitest'

import { hasLand } from '../src/coastKind'
import { biomeNamed, climateBiome } from '../src/biome'
import { climateTitle } from '../src/places'
import { cloudLeaning, stormChance, type SceneParams } from '../src/params'
import type { SceneSpec } from '../src/sceneSpec'
import { monthInSeason } from '../src/seasons'
import { allParams, DAYS, expectShare, scene, scenes as scenesOf, share } from './days'

// PLAN_BIOMES 11: the climate is the place's own choice (1a); the biome stays
// the look preset.
describe('climate', () => {
  const days = allParams()
  const of = (biome: string) => days.filter(p => p.biome.name === biome)

  it('splits the biomes as REGIONS.md weighs the places (params.mjs --expect)', () => {
    const nordic = of('nordic')
    expectShare(nordic, p => p.place.climate === 'temperate', 0.42)
    expectShare(nordic, p => p.place.climate === 'polar', 0.39)
    expectShare(nordic, p => p.place.climate === 'boreal', 0.19)
    const med = of('mediterranean')
    expectShare(med, p => p.place.climate === 'mediterranean', 0.53)
    expectShare(med, p => p.place.climate === 'subtropical', 0.42)
    expectShare(med, p => p.place.climate === 'temperate', 0.05)
    for (const p of of('tropical')) expect(p.place.climate).toBe('tropical')
    for (const p of of('desert')) expect(p.place.climate).toBe('arid')
  })

  it('names the climate in titles (decision 2)', () => {
    expect(climateTitle('nordic', 'temperate')).toBe('temperate')
    expect(climateTitle('mediterranean', 'subtropical')).toBe('subtropical')
    expect(climateTitle('desert', 'arid')).toBe('desert')
    expect(climateTitle('volcanic', 'tropical')).toBe('volcanic')
    expect(scene({ place: 'florida-carolinas', coast: 'beach', beachMaterial: 'sand' }).title).toContain('subtropical')
    expect(scene({ place: 'svalbard', coast: 'rock-shore' }).title).toMatch(/polar (rock platform|boulder shore|sea cliffs)/)
    expect(scene({ place: 'scotland', coast: 'beach' }).title).toContain('temperate')
    for (const p of days.filter(p => hasLand(p.coast))) {
      expect(p.title, p.date).toContain(climateTitle(p.biome.name, p.place.climate))
      expect(p.title).not.toMatch(/\bnordic\b/)
    }
  })

  describe('land (11b)', () => {
    const kinds = (p: { biome: { vegetation: readonly (readonly [string, number])[] } }) => p.biome.vegetation.map(([k]) => k)

    it('patches only what the climate changes', () => {
      const med = biomeNamed('mediterranean')
      const florida = climateBiome(med, 'subtropical')
      expect(florida.name).toBe('mediterranean')
      expect(florida.rockColors).toBe(med.rockColors)
      expect(florida.water).toBe(med.water)
      expect(climateBiome(med, 'mediterranean')).toBe(med)
      expect(climateBiome(biomeNamed('tropical'), 'tropical')).toBe(biomeNamed('tropical'))
    })

    it('gives subtropical coasts live oak, palmetto, cabbage palm and pale sand, no olives or cypress', () => {
      const days = scenesOf({ place: 'florida-carolinas', coast: 'beach', beachMaterial: 'sand' })
      for (const p of days) {
        expect(kinds(p)).toEqual(expect.arrayContaining(['palm', 'broadleaf', 'bush', 'grass']))
        expect(kinds(p)).not.toContain('olive')
        expect(kinds(p)).not.toContain('cypress')
        expect(['white', 'golden']).toContain(p.coast.sand.name)
      }
      expectShare(days, p => p.coast.sand.name === 'white', 0.6)
      // The Mediterranean itself keeps its olives and stone pines.
      for (const p of scenesOf({ place: 'aegean' }, 10)) expect(kinds(p)).toContain('olive')
    })

    it('gives temperate nordic coasts broadleaf woods, boreal ones conifer and birch', () => {
      for (const p of scenesOf({ place: 'cornwall-wales' }, 10)) expect(kinds(p)).toContain('broadleaf')
      for (const p of scenesOf({ place: 'baltic', climate: 'boreal' }, 10)) {
        expect(kinds(p)).toContain('conifer')
        expect(kinds(p)).not.toContain('broadleaf')
      }
    })

    it('makes a polar climate tundra on any water, and keeps palms off Iceland and Kamchatka', () => {
      for (const p of scenesOf({ place: 'greenland', ocean: 'atlantic' }, 20)) {
        expect(kinds(p).every(k => k === 'grass' || k === 'bush' || k === 'birch'), p.date).toBe(true)
      }
      for (const p of scenesOf({ place: 'norway-north', ocean: 'atlantic', climate: 'polar' }, 10)) expect(kinds(p)).not.toContain('conifer')
      for (const p of days.filter(p => p.biome.name === 'volcanic' && p.place.climate !== 'tropical' && p.place.climate !== 'subtropical')) {
        expect(kinds(p), p.place.id).not.toContain('palm')
      }
      for (const p of scenesOf({ place: 'hawaii' }, 10)) expect(kinds(p)).toContain('palm')
    })

    it('whitens the Hebrides with shell sand sometimes', () => {
      expectShare(scenesOf({ place: 'scotland', coast: 'beach', beachMaterial: 'sand' }, 200), p => p.coast.sand.name === 'white', 0.3)
    })
  })

  describe('sea and sky (11c)', () => {
    // Every real date with the place forced: the same days, only the climate differs.
    const year = (spec: SceneSpec) => DAYS.map(d => scene({ eclipse: null, ...spec }, d))

    it('leans the clouds by climate', () => {
      expect(cloudLeaning('temperate', false)).toEqual({ cool: true, tropical: false })
      expect(cloudLeaning('polar', true).cool).toBe(true)
      expect(cloudLeaning('subtropical', true)).toEqual({ cool: false, tropical: true })
      expect(cloudLeaning('subtropical', false).tropical).toBe(false)
      expect(cloudLeaning('tropical', false).tropical).toBe(true)
      expect(cloudLeaning('mediterranean', true)).toEqual({ cool: false, tropical: false })
    })

    it('doubles thunderstorms in a subtropical summer', () => {
      expect(stormChance('subtropical', true)).toBe(0.14)
      expect(stormChance('subtropical', false)).toBe(0.07)
      expect(stormChance('temperate', true)).toBe(0.07)
      const florida = year({ place: 'florida-carolinas' })
      const summer = florida.filter(p => monthInSeason(p, 6, 9))
      const rest = florida.filter(p => !monthInSeason(p, 6, 9))
      expect(share(summer, p => p.storm != null)).toBeGreaterThan(1.4 * share(rest, p => p.storm != null))
    })

    it('raises big swell on temperate coasts and haar there, less fog on subtropical ones', () => {
      const temperate = year({ place: 'yellow-sea', climate: 'temperate', coast: 'beach' })
      const subtropical = year({ place: 'yellow-sea', climate: 'subtropical', coast: 'beach' })
      const big = (p: SceneParams) => p.ocean.swellHeight > 1
      expect(share(temperate, big)).toBeGreaterThan(share(subtropical, big) + 0.05)
      const fog = (p: SceneParams) => p.fog?.kind === 'advection'
      expect(share(temperate, fog)).toBeGreaterThan(2 * share(subtropical, fog))
    })
  })
})
