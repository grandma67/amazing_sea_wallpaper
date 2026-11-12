import { describe, expect, it } from 'vitest'
import type { BufferGeometry, InstancedMesh } from 'three'

import type { RGB } from '../src/biome'
import { BLOOM, blossomFor, canopyTint, phenologyFor, plantSeason, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { createVegetation } from '../src/props/vegetation'
import { bush } from '../src/props/trees'
import { Random } from '../src/random'
import type { SceneSpec } from '../src/sceneSpec'
import { expectEvery, MONTHS, view } from './days'

// NATURE_PLAN phase 3: rock rose, gorse and wattle on `bush`, by place and
// local month (phenology.ts BLOOM).

const FOLIAGE: RGB = [0.05, 0.1, 0.03]
const day = (date: string, id: string, overrides?: PhenologyDay['overrides']): PhenologyDay => {
  const place = PLACES.find(p => p.id === id)!
  const climate = Object.keys(place.climate)[0] as PhenologyDay['place']['climate']
  return { date, latitudeDeg: (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate }, overrides }
}
const kindsOn = (d: PhenologyDay): string[] => phenologyFor(d).bloom.map(b => b.row.kind)
/** Vertices coloured like one of the row's flowers (hue: the leaves are green, flowers aren't). */
const flowerVertices = (g: BufferGeometry, kind: string): number => {
  const c = g.getAttribute('color')
  let n = 0
  for (let i = 0; i < c.count; i++) {
    const [r, gr, b] = [c.getX(i), c.getY(i), c.getZ(i)]
    if (kind === 'rock-rose' ? r > gr * 1.6 && b > gr * 1.6 : kind === 'gorse' ? r > gr * 1.4 && gr > b * 4 : gr > 1e-6 && r > gr * 0.75 && b < gr * 0.5 && r > b * 2) n++
  }
  return n
}

describe('the blossom table', () => {
  it('has real places, months in 0..1, shares in 0..1 and one colour per crown', () => {
    const ids = new Set(PLACES.map(p => p.id))
    for (const row of BLOOM) {
      expectEvery(row.places, id => ids.has(id))
      expect(row.months).toHaveLength(12)
      expectEvery(row.months, m => m >= 0 && m <= 1)
      expect(row.crowns).toBeGreaterThan(0)
      expect(row.crowns * row.leaves).toBeLessThanOrEqual(1)
      expect(row.colors.length).toBeGreaterThan(0)
      expectEvery(row.colors.flat(), v => v >= 0 && v <= 1)
    }
  })

  it('flowers each row only in its places and months, every place × month (no sampling)', () => {
    for (const place of PLACES) {
      MONTHS.forEach((date, m) => {
        const want = BLOOM.filter(r => r.places.includes(place.id) && r.months[m] > 0).map(r => r.kind)
        expect(kindsOn(day(date, place.id)), `${place.id} ${date}`).toEqual(want)
      })
    }
  })

  it('in local calendar months: gorse peaks in April–May in Cornwall and in spring (Aug–Oct) in New Zealand', () => {
    const strength = (date: string, id: string) => phenologyFor(day(date, id)).bloom.find(b => b.row.kind === 'gorse')?.strength ?? 0
    expect(strength('2025-05-15', 'cornwall-wales')).toBe(1)
    expect(strength('2025-09-15', 'cornwall-wales')).toBe(0.1)
    expect(strength('2025-09-15', 'new-zealand-north')).toBe(1)
    expect(strength('2025-04-15', 'new-zealand-north')).toBe(0.1)
    expect(kindsOn(day('2025-06-01', 'western-med'))).toEqual(['rock-rose'])
    expect(kindsOn(day('2025-09-01', 'western-med'))).toEqual([])
    expect(kindsOn(day('2025-09-01', 'east-australia'))).toEqual(['wattle'])
    // Tasmania has both.
    expect(kindsOn(day('2025-09-01', 'tasmania'))).toEqual(['gorse', 'wattle'])
  })

  it('is forced by props.bloom and switched off by it, and by phenology: false', () => {
    expect(kindsOn(day('2025-12-15', 'western-med', { bloom: true }))).toEqual(['rock-rose'])
    expect(phenologyFor(day('2025-12-15', 'western-med', { bloom: true })).bloom[0].strength).toBe(1)
    expect(kindsOn(day('2025-12-15', 'maine', { bloom: true }))).toEqual([])
    expect(kindsOn(day('2025-12-15', 'maine', { bloom: ['gorse', 'wattle'] }))).toEqual(['gorse', 'wattle'])
    expect(kindsOn(day('2025-06-01', 'western-med', { bloom: false }))).toEqual([])
    expect(kindsOn(day('2025-06-01', 'western-med', { phenology: false }))).toEqual([])
  })
})

describe('flowering crowns', () => {
  const season = (date: string, id: string) => plantSeason('bush', phenologyFor(day(date, id)))

  it('spread over the variants: 2 of 5 rock-rose bushes, one pink and one white', () => {
    const s = season('2025-06-01', 'western-med')
    const blossoms = [0, 1, 2, 3, 4].map(v => blossomFor(s, v, 5)?.blossom)
    expect(blossoms.filter(b => b != null)).toHaveLength(2)
    expect(new Set(blossoms.filter(b => b != null).map(b => b!.color.join()))).toEqual(new Set(BLOOM[0].colors.map(c => c.join())))
    // Tasmania in September: gorse and wattle each get theirs.
    const tas = [0, 1, 2, 3, 4].map(v => blossomFor(season('2025-09-15', 'tasmania'), v, 5)?.blossom?.kind)
    expect(tas.filter(k => k === 'gorse').length).toBeGreaterThan(0)
    expect(tas.filter(k => k === 'wattle').length).toBeGreaterThan(0)
  })

  it('keep the bush’s shape (draws), and show flowers only in flower', () => {
    const build = (date: string, id: string, v: number) => {
      const rng = new Random('bush')
      const g = bush(rng, FOLIAGE, blossomFor(season(date, id), v, 5))
      return { g, next: rng.float() }
    }
    const inBloom = build('2025-06-01', 'western-med', 0)
    const out = build('2025-09-01', 'western-med', 0)
    expect(inBloom.next).toBe(out.next)
    expect(flowerVertices(inBloom.g, 'rock-rose')).toBeGreaterThan(50)
    expect(flowerVertices(out.g, 'rock-rose')).toBe(0)
    expect(flowerVertices(build('2025-05-01', 'cornwall-wales', 0).g, 'gorse')).toBeGreaterThan(50)
    // Weak months: fewer flowers on the same crown.
    expect(flowerVertices(build('2025-10-01', 'cornwall-wales', 0).g, 'gorse')).toBeLessThan(flowerVertices(build('2025-05-01', 'cornwall-wales', 0).g, 'gorse') * 0.4)
  })

  it('reach the scene’s bushes, and props.bloom: false gives back the summer bushes exactly', () => {
    const spec: SceneSpec = { eclipse: null, place: 'western-med', coast: 'beach', composition: 'framed', timeOfDay: 'midday', props: { vegetation: ['bush'] } }
    const bushes = (s: SceneSpec, date: string) => createVegetation(view(s, 1080, date)).filter(m => m.userData.plantKind === 'bush') as InstancedMesh[]
    const on = bushes(spec, '2025-06-01')
    expect(on.reduce((n, m) => n + flowerVertices(m.geometry, 'rock-rose'), 0)).toBeGreaterThan(100)
    const off = bushes({ ...spec, props: { ...spec.props, bloom: false } }, '2025-06-01')
    expect(off.reduce((n, m) => n + flowerVertices(m.geometry, 'rock-rose'), 0)).toBe(0)
    // The same as before blossom existed: summer bushes, no other change.
    const summer = bushes({ ...spec, props: { ...spec.props, phenology: false } }, '2025-06-01')
    expect(off.map(m => Array.from(m.geometry.getAttribute('color').array))).toEqual(summer.map(m => Array.from(m.geometry.getAttribute('color').array)))
  })
})

describe('far crowns', () => {
  it('tint toward the flowers only in flower, faintly', () => {
    const plants = [['bush', 6], ['stone-pine', 2], ['grass', 3]] as const
    const june = canopyTint(FOLIAGE, phenologyFor(day('2025-06-01', 'western-med')), plants)
    const sept = canopyTint(FOLIAGE, phenologyFor(day('2025-09-01', 'western-med')), plants)
    expect(sept).toEqual(FOLIAGE)
    expect(june).not.toEqual(FOLIAGE)
    // 0.4 crowns × 0.4 cards × 6/8 of the crowns: a 12% mix.
    expect(june[0] - FOLIAGE[0]).toBeCloseTo(0.12 * (0.5 * (0.41 + 0.59) - FOLIAGE[0]), 5)
  })
})
