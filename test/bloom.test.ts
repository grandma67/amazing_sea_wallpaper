import { describe, expect, it } from 'vitest'
import type { BufferGeometry, InstancedMesh } from 'three'

import type { RGB } from '../src/biome'
import { BLOOM, bloomFor, canopyTint, phenologyFor, plantSeason, withBlossom, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { createVegetation, crownBlossom } from '../src/props/vegetation'
import { broadleaf, bush } from '../src/props/trees'
import { Random } from '../src/random'
import { worldToShore } from '../src/terrain'
import type { SceneSpec } from '../src/sceneSpec'
import { expectEvery, expectShare, MONTHS, view } from './days'

// NATURE_PLAN phases 3–4: rock rose, gorse and wattle on `bush`; flamboyant
// and pōhutukawa on `broadleaf` (phenology.ts BLOOM).

const FOLIAGE: RGB = [0.05, 0.1, 0.03]
const day = (date: string, id: string, overrides?: PhenologyDay['overrides'], latitudeDeg?: number): PhenologyDay => {
  const place = PLACES.find(p => p.id === id)!
  const climate = Object.keys(place.climate)[0] as PhenologyDay['place']['climate']
  return { date, latitudeDeg: latitudeDeg ?? (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate }, overrides }
}
const kindsOn = (d: PhenologyDay): string[] => phenologyFor(d).bloom.map(b => b.row.kind)
const bloomOf = (d: PhenologyDay, kind: string) => phenologyFor(d).bloom.find(b => b.row.kind === kind)
/** Vertices coloured like one of the row's flowers (hue: the leaves are green, flowers aren't). */
const flowerVertices = (g: BufferGeometry, kind: string): number => {
  const c = g.getAttribute('color')
  let n = 0
  for (let i = 0; i < c.count; i++) {
    const [r, gr, b] = [c.getX(i), c.getY(i), c.getZ(i)]
    const red = r > gr * 6 && r > b * 6
    if (kind === 'rock-rose' ? r > gr * 1.6 && b > gr * 1.6 : kind === 'gorse' ? r > gr * 1.4 && gr > b * 4 && !red : kind === 'wattle' ? gr > 1e-6 && r > gr * 0.75 && b < gr * 0.5 && r > b * 2 && !red : red) n++
  }
  return n
}
const MONTH_STARTS = Array.from({ length: 36 }, (_, i) => `2025-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-${['01', '11', '21'][i % 3]}`)

describe('the blossom table', () => {
  it('has real places, shares in 0..1 and colours, and today’s values in 0..1 every place × 10 days', () => {
    const ids = new Set(PLACES.map(p => p.id))
    for (const row of BLOOM) {
      expectEvery(row.places, id => ids.has(id))
      expect(row.crowns).toBeGreaterThan(0)
      expect(row.crowns * row.leaves).toBeLessThanOrEqual(1)
      expect(row.colors.length).toBeGreaterThan(0)
      expectEvery(row.colors.flat(), v => v >= 0 && v <= 1)
    }
    for (const place of PLACES) {
      for (const date of MONTH_STARTS) {
        for (const b of phenologyFor(day(date, place.id)).bloom) {
          expect(b.row.places, `${place.id}`).toContain(place.id)
          for (const v of [b.strength, b.crowns, b.leaves, b.on]) expect(v, `${b.row.kind} ${place.id} ${date}`).toBeGreaterThanOrEqual(0)
          for (const v of [b.strength, b.crowns, b.leaves, b.on]) expect(v, `${b.row.kind} ${place.id} ${date}`).toBeLessThanOrEqual(1)
          expect(b.strength).toBeGreaterThan(0)
        }
      }
    }
  })

  it('flowers each bush row only in its places and months (no sampling)', () => {
    for (const place of PLACES) {
      MONTHS.forEach(date => {
        const want = BLOOM.filter(r => r.places.includes(place.id) && r.today(day(date, place.id)).strength > 0).map(r => r.kind)
        expect(kindsOn(day(date, place.id)), `${place.id} ${date}`).toEqual(want)
      })
    }
  })

  it('bushes in local calendar months: gorse peaks in April–May in Cornwall and in spring (Aug–Oct) in New Zealand', () => {
    expect(bloomOf(day('2025-05-15', 'cornwall-wales'), 'gorse')?.strength).toBe(1)
    expect(bloomOf(day('2025-09-15', 'cornwall-wales'), 'gorse')?.strength).toBe(0.1)
    expect(bloomOf(day('2025-09-15', 'new-zealand-north'), 'gorse')?.strength).toBe(1)
    expect(bloomOf(day('2025-04-15', 'new-zealand-north'), 'gorse')?.strength).toBe(0.1)
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
    expect(kindsOn(day('2025-12-15', 'maine', { bloom: ['gorse', 'flamboyant'] }))).toEqual(['gorse', 'flamboyant'])
    expect(kindsOn(day('2025-06-01', 'western-med', { bloom: false }))).toEqual([])
    expect(kindsOn(day('2025-06-01', 'western-med', { phenology: false }))).toEqual([])
  })
})

describe('flamboyant', () => {
  it('flowers bare at the end of a dry season and on into the rains, in both hemispheres', () => {
    // India (dry Dec–May, 15–22°N): the rains from 1 June.
    const may = bloomOf(day('2025-05-15', 'india', undefined, 18), 'flamboyant')!
    expect(may.strength).toBe(1)
    expect(may.on).toBeCloseTo(0.4)
    expect(may.leaves).toBeCloseTo(0.8)
    const july = bloomOf(day('2025-07-01', 'india', undefined, 18), 'flamboyant')!
    expect(july.strength).toBe(1)
    expect(july.on).toBeGreaterThan(0.7)
    expect(july.leaves).toBeLessThan(0.65)
    // Out of the window: a scattered tree, leaves on.
    const oct = bloomOf(day('2025-10-15', 'india', undefined, 18), 'flamboyant')!
    expect(oct.strength).toBe(0.2)
    expect(oct.on).toBe(1)
    // The Top End (dry May–Oct): bare and in flower in October.
    const darwin = bloomOf(day('2025-10-15', 'north-australia', undefined, -12.5), 'flamboyant')!
    expect(darwin.strength).toBe(1)
    expect(darwin.on).toBeCloseTo(0.4)
    expect(bloomOf(day('2025-04-15', 'north-australia', undefined, -12.5), 'flamboyant')!.strength).toBe(0.2)
    // Kerala (8–12°N, a wetter coast of the same place): scattered all year.
    expect(bloomOf(day('2025-05-15', 'india', undefined, 10), 'flamboyant')!.strength).toBe(0.2)
  })

  it('is a crown share, about one tree in 70 at full strength, and none on Galápagos', () => {
    expect(bloomOf(day('2025-06-15', 'antilles'), 'flamboyant')!.crowns).toBeCloseTo(0.15)
    expect(bloomOf(day('2025-12-15', 'antilles'), 'flamboyant')).toBeUndefined()
    expect(bloomOf(day('2025-12-15', 'hawaii'), 'flamboyant')!.crowns).toBeCloseTo(0.03)
    expect(kindsOn(day('2025-06-15', 'galapagos'))).toEqual([])
  })

  it('has no far tint', () => {
    const plants = [['broadleaf', 3], ['palm', 4]] as const
    const phen = phenologyFor(day('2025-06-15', 'antilles'))
    expect(canopyTint(FOLIAGE, phen, plants)).toEqual(canopyTint(FOLIAGE, { ...phen, bloom: [] }, plants))
  })
})

describe('pōhutukawa', () => {
  it('flowers 15 Dec – 5 Jan, ramping a month either side', () => {
    const s = (date: string) => bloomOf(day(date, 'new-zealand-north'), 'pohutukawa')?.strength ?? 0
    expect(s('2025-12-25')).toBe(1)
    expect(s('2025-01-03')).toBe(1)
    expect(s('2025-11-01')).toBe(0)
    expect(s('2025-01-20')).toBe(0)
    expect(s('2025-11-30')).toBeGreaterThan(0.3)
    expect(s('2025-11-30')).toBeLessThan(0.7)
    expect(kindsOn(day('2025-12-25', 'new-zealand-south'))).not.toContain('pohutukawa')
  })
})

describe('which crowns flower', () => {
  const coast = view({ eclipse: null, place: 'western-med', coast: 'beach' }).params.coast
  const spots = Array.from({ length: 4000 }, (_, i) => [Math.sin(i * 1.7) * 800, -Math.abs(Math.cos(i * 0.9)) * 600 - 20] as const)

  it('by position: the rows’ crown shares, colours in turn, the same tree every time', () => {
    const rose = phenologyFor(day('2025-06-01', 'western-med')).bloom
    const picks = spots.map(([x, z]) => crownBlossom(rose, 'bush', x, z, coast))
    expectShare(picks, p => p != null, 0.4)
    expectShare(picks.filter(p => p != null), p => p!.color === 0, 0.5)
    expect(spots.map(([x, z]) => crownBlossom(rose, 'bush', x, z, coast)?.color)).toEqual(picks.map(p => p?.color))
    // Tasmania in September: gorse and wattle each take their share.
    const tas = phenologyFor(day('2025-09-15', 'tasmania')).bloom
    const kinds = spots.map(([x, z]) => crownBlossom(tas, 'bush', x, z, coast)?.b.row.kind)
    expectShare(kinds, k => k === 'gorse', 0.5)
    expectShare(kinds, k => k === 'wattle', 0.35)
  })

  it('pōhutukawa only on the coast’s first trees: within 60 m of where the trees start', () => {
    const nz = view({ eclipse: null, place: 'new-zealand-north', coast: 'beach' }, 1080, '2025-12-25').params.coast
    const bloom = phenologyFor(day('2025-12-25', 'new-zealand-north')).bloom
    const treeline = 80
    const picked = spots.filter(([x, z]) => crownBlossom(bloom, 'broadleaf', x, z, nz, treeline) != null)
    expect(picked.length).toBeGreaterThan(20)
    expectEvery(picked, ([x, z]) => -worldToShore(nz, x, z)[0] - treeline <= 60)
  })
})

describe('flowering twins', () => {
  const season = (kind: 'bush' | 'broadleaf', date: string, d: PhenologyDay = day(date, 'western-med')) => plantSeason(kind, phenologyFor(d))
  const twin = (kind: 'bush' | 'broadleaf', d: PhenologyDay, color = 0) => {
    const s = plantSeason(kind, phenologyFor(d))!
    return withBlossom(s, bloomFor(kind, phenologyFor(d))[0], color)
  }

  it('keep the plant’s shape (draws), and show flowers only in flower', () => {
    const build = (b: typeof bush, s: ReturnType<typeof season>) => {
      const rng = new Random('plant')
      const g = b(rng, FOLIAGE, s)
      return { g, next: rng.float() }
    }
    const rose = build(bush, twin('bush', day('2025-06-01', 'western-med')))
    const plain = build(bush, season('bush', '2025-06-01'))
    expect(rose.next).toBe(plain.next)
    expect(rose.g.getAttribute('position').count).toBe(plain.g.getAttribute('position').count)
    expect(flowerVertices(rose.g, 'rock-rose')).toBeGreaterThan(50)
    expect(flowerVertices(plain.g, 'rock-rose')).toBe(0)
    // Weak months: fewer flowers on the same crown.
    const gorse = (date: string) => flowerVertices(build(bush, twin('bush', day(date, 'cornwall-wales'))).g, 'gorse')
    expect(gorse('2025-10-01')).toBeLessThan(gorse('2025-05-01') * 0.4)
    // Flamboyant at the end of India's dry season: scarlet, and thinner.
    const india = day('2025-05-15', 'india', undefined, 18)
    const flame = build(broadleaf, twin('broadleaf', india))
    const tree = build(broadleaf, plantSeason('broadleaf', phenologyFor(india)))
    expect(flame.next).toBe(tree.next)
    // Mostly flowers, fewer leaves: the cards that aren't flowers thin to 0.4.
    expect(flowerVertices(flame.g, 'flamboyant')).toBeGreaterThan(flame.g.getAttribute('position').count * 0.4)
    expect(flame.g.getAttribute('position').count).toBeLessThan(tree.g.getAttribute('position').count)
  })

  const spec: SceneSpec = { eclipse: null, place: 'western-med', coast: 'beach', composition: 'framed', timeOfDay: 'midday', props: { vegetation: ['bush', 'broadleaf'] } }
  const plants = (s: SceneSpec, date: string) => createVegetation(view(s, 1080, date)) as InstancedMesh[]
  const matrices = (meshes: InstancedMesh[], kind: string) =>
    meshes
      .filter(m => m.userData.plantKind === kind)
      .flatMap(m => Array.from({ length: m.count }, (_, i) => Array.from(m.instanceMatrix.array.slice(i * 16, i * 16 + 16)).join()))
      .sort()

  it('reach the scene, move no plant, and props.bloom: false gives back the summer plants exactly', () => {
    const on = plants(spec, '2025-06-01')
    expect(on.filter(m => m.userData.blossom != null).length).toBeGreaterThan(0)
    expect(on.reduce((n, m) => n + flowerVertices(m.geometry, 'rock-rose'), 0)).toBeGreaterThan(100)
    const off = plants({ ...spec, props: { ...spec.props, bloom: false } }, '2025-06-01')
    expect(off.reduce((n, m) => n + flowerVertices(m.geometry, 'rock-rose'), 0)).toBe(0)
    for (const kind of ['bush', 'broadleaf']) expect(matrices(on, kind)).toEqual(matrices(off, kind))
    // The same as before blossom existed: summer plants, no other change.
    const summer = plants({ ...spec, props: { ...spec.props, phenology: false } }, '2025-06-01')
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
