import { describe, expect, it } from 'vitest'

import { hasLand } from '../src/coastKind'
import { climateTitle } from '../src/places'
import { allParams, expectShare, scene } from './days'

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
})
