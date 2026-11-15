import { describe, expect, it } from 'vitest'

import { BLOOM, bloomGrows, saltCanopy, SHRUB_LEE, sprayBelt, sprayExposure } from '../src/phenology'
import { crownBlossom, crownShrub, plantInstances, saltFront, saltOn, type PlantInstance } from '../src/props/vegetation'
import type { SceneSpec } from '../src/sceneSpec'
import { SALT_TOLERANCE, SHRUB_KINDS, shrubsHere } from '../src/shrubs'
import { worldToShore } from '../src/terrain'
import { expectEvery, view, withProps } from './days'

// Salt on plants (NATURE.md §9): the canopy wedge on trees, tender shrubs
// kept off the first line (phenology.ts saltCanopy, SHRUB_LEE; shrubs.ts
// SALT_TOLERANCE; props/vegetation.ts saltOn).

const OFF = { saltShear: false }
const plants = (spec: SceneSpec, date: string): PlantInstance[] => plantInstances(view(spec, 1080, date))
const at = (t: PlantInstance) => `${t.x},${t.z}`

describe('saltCanopy', () => {
  it('follows the Northland survey: 5 m at 10 m, 15 at 100, 25 at 1 km', () => {
    expect(saltCanopy(10, 'moderate')).toBeCloseTo(5)
    expect(saltCanopy(100, 'moderate')).toBeCloseTo(15)
    expect(saltCanopy(1000, 'moderate')).toBeCloseTo(25)
    // Nearer than 10 m: as at 10 m.
    expect(saltCanopy(0, 'moderate')).toBeCloseTo(5)
  })

  it('stays at 5 m for 100 m on exposed coasts, ~18 m at 800 m', () => {
    expect(saltCanopy(60, 'exposed')).toBe(5)
    expect(saltCanopy(100, 'exposed')).toBe(5)
    expect(saltCanopy(800, 'exposed')).toBeCloseTo(18, 0)
  })

  it('rises inland and orders the exposures', () => {
    for (const u of [10, 50, 150, 400, 2000]) {
      expect(saltCanopy(u * 1.5, 'moderate')).toBeGreaterThan(saltCanopy(u, 'moderate'))
      expect(saltCanopy(u, 'sheltered')).toBeGreaterThan(saltCanopy(u, 'moderate'))
      expect(saltCanopy(u, 'moderate')).toBeGreaterThanOrEqual(saltCanopy(u, 'exposed'))
    }
  })

  it('shares the spray belt’s exposure lists', () => {
    expect(sprayExposure('baltic')).toBe('sheltered')
    expect(sprayExposure('scotland')).toBe('exposed')
    expect(sprayExposure('brittany')).toBe('moderate')
    expect(sprayBelt('baltic')).toBe(1.5)
    expect(sprayBelt('scotland')).toBe(12)
  })
})

describe('shrub salt tolerance', () => {
  it('rates every shrub species', () => {
    for (const s of SHRUB_KINDS) expect(SALT_TOLERANCE[s]).toBeDefined()
  })

  it('names the same species the blossom hash does', () => {
    const day = { latitudeDeg: 38, place: { id: 'western-med', climate: 'mediterranean' as const }, date: '2025-05-10' }
    const rows = BLOOM.filter(r => r.plant === 'bush' && r.species == null && bloomGrows(r, day))
    const species = shrubsHere(day)
    const shrubs = { species, offset: rows.reduce((s, r) => s + r.crowns, 0), fruit: [] }
    const bloom = species.map(s => ({ row: BLOOM.find(r => r.species === s.species)!, strength: 1, crowns: s.share, leaves: 0.5, on: 1 }))
    const coast = { seawardAzimuthDeg: 0 } as Parameters<typeof crownBlossom>[4]
    let checked = 0
    for (let i = 0; i < 400; i++) {
      const x = i * 3.7
      const z = i * -1.3
      const b = crownBlossom(bloom.filter(r => r.row != null), 'bush', x, z, coast, 0, shrubs)
      if (b?.b?.row.species == null) continue
      expect(crownShrub(x, z, rows, shrubs)).toBe(b.b.row.species)
      checked++
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('drops a bush exactly when it is tender and in front of the lee', () => {
    const day = { latitudeDeg: 50, place: { id: 'cornwall-wales', climate: 'temperate' as const }, date: '2025-07-10' }
    const rows = BLOOM.filter(r => r.plant === 'bush' && r.species == null && bloomGrows(r, day))
    const shrubs = { species: shrubsHere(day), offset: rows.reduce((s, r) => s + r.crowns, 0) }
    const coast = view({ eclipse: null, coast: 'beach', place: 'cornwall-wales' }, 1080, '2025-07-10').params.coast
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const [x, z] = [i * 1.37, -i * 0.71]
      const u = -worldToShore(coast, x, z)[0]
      const sp = crownShrub(x, z, rows, shrubs)
      seen.add(sp)
      const salt = saltOn('bush', x, z, coast, 10, 'exposed', { rows, shrubs })
      expect(salt.drop === true).toBe(u < 10 + SHRUB_LEE.exposed && SALT_TOLERANCE[sp] === 'moderate')
    }
    expect([...seen]).toEqual(expect.arrayContaining(['gorse', 'hawthorn', 'blackthorn']))
  })
})

describe('salt on real plants', () => {
  const BASE: SceneSpec = { eclipse: null, timeOfDay: 'daylight', weather: 'few', fog: null, storm: null, coast: 'beach', composition: 'framed' }

  it('keeps every tree under the wedge, which cuts some trees', () => {
    let cut = 0
    for (const [place, kind] of [['brittany', 'broadleaf'], ['scotland', 'conifer'], ['western-med', 'stone-pine']] as const) {
      const spec: SceneSpec = { ...BASE, place, props: { vegetation: [kind] } }
      const on = plants(spec, '2025-07-10').filter(t => t.kind === kind)
      const exposure = sprayExposure(place)
      expectEvery(on, t => t.top <= saltCanopy(t.u, exposure) + 1e-6, { what: t => [t.u, t.top] })
      const without = plants(withProps(spec, OFF), '2025-07-10').filter(t => t.kind === kind)
      cut += without.filter(t => t.top > saltCanopy(t.u, exposure) * 1.05).length
      // Same spots: the rule moves nothing and draws nothing.
      expect(on.map(at)).toEqual(without.map(at))
    }
    expect(cut).toBeGreaterThan(5)
  })

  it('takes only tender shrubs, only on the first line', () => {
    const spec: SceneSpec = { ...BASE, place: 'cornwall-wales', props: { vegetation: ['bush'] } }
    const gone: PlantInstance[] = []
    for (const date of ['2025-03-10', '2025-05-10', '2025-07-10', '2025-09-10', '2025-11-10', '2026-01-10']) {
      const day = view(spec, 1080, date).params
      const lee = saltFront(day.coast, day.coast.beachWidth * 0.7) + SHRUB_LEE.exposed
      const on = plants(spec, date).filter(t => t.kind === 'bush')
      const without = plants(withProps(spec, OFF), date).filter(t => t.kind === 'bush')
      const kept = new Set(on.map(at))
      const dropped = without.filter(t => !kept.has(at(t)))
      expect(on.length + dropped.length).toBe(without.length)
      expectEvery(dropped, t => t.u < lee && SALT_TOLERANCE[t.shrub!] === 'moderate', { what: t => [t.u, t.shrub], allowEmpty: true })
      // The hardy ones stay on the first line.
      expect(on.filter(t => t.u < lee).every(t => SALT_TOLERANCE[t.shrub!] === 'high')).toBe(true)
      gone.push(...dropped)
    }
    expect(gone.map(t => t.shrub)).toContain('hawthorn')
  })
})
