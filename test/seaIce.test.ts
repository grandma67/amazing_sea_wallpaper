import { describe, expect, it } from 'vitest'

import { PLACES } from '../src/places'
import { offshore, seaIceFor, slabGeometry, lumpGeometry, BLOCK_SETS, iceBlock } from '../src/props/seaIce'
import { marineFor } from '../src/props/marine'
import { Random } from '../src/random'
import { ICE_FREEBOARD, ICE_WAVE_WIND, iceDrift, iceRubble, iceZone, pickSeaIce, SEA_ICE_PLACES, seaIceChance } from '../src/seaIce'
import { allParams, scene, scenes } from './days'

const at = (date: string, latitudeDeg: number) => ({ date, latitudeDeg })
const BASE = { place: 'baltic', eclipse: null, storm: null } as const

describe('when the sea freezes', () => {
  it('only where the table has the place', () => {
    for (const place of PLACES) {
      for (const date of ['2025-01-15', '2025-04-15', '2025-07-15']) {
        const chance = seaIceChance(place.id, at(date, 65))
        if (SEA_ICE_PLACES[place.id] == null) expect(chance, place.id).toBe(0)
        expect(chance).toBeGreaterThanOrEqual(0)
        expect(chance).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every winter in the Bay of Bothnia, seldom in the south (FMI)', () => {
    expect(seaIceChance('baltic', at('2025-02-15', 65))).toBe(1)
    expect(seaIceChance('baltic', at('2025-02-15', 61))).toBe(0.75)
    expect(seaIceChance('baltic', at('2025-02-15', 58))).toBe(0.35)
    expect(seaIceChance('baltic', at('2025-02-15', 55))).toBe(0.06)
  })

  it('from November to late May in the north, melting from the south', () => {
    expect(seaIceChance('baltic', at('2025-11-05', 65))).toBe(0)
    expect(seaIceChance('baltic', at('2025-11-25', 65))).toBeGreaterThan(0)
    expect(seaIceChance('baltic', at('2025-05-15', 65))).toBeGreaterThan(0)
    expect(seaIceChance('baltic', at('2025-06-10', 65))).toBe(0)
    // Early May: only the north of the Bay still has ice (FMI).
    expect(seaIceChance('baltic', at('2025-05-05', 61))).toBe(0)
    expect(seaIceChance('baltic', at('2025-04-20', 58))).toBe(0)
    expect(seaIceChance('baltic', at('2025-08-01', 65))).toBe(0)
  })

  it('every zone in the table is well formed, northernmost first', () => {
    for (const zones of Object.values(SEA_ICE_PLACES)) {
      zones.forEach((z, i) => {
        if (i > 0) expect(z.from).toBeLessThan(zones[i - 1].from)
        expect(z.edge[0]).toBeLessThan(z.edge[1])
        expect(z.cover[0]).toBeLessThanOrEqual(z.cover[1])
      })
      expect(iceZone('baltic', 54)).toBeDefined()
    }
  })
})

describe('the day’s ice', () => {
  const all = allParams()
  it('is only on days the table allows, about as often', () => {
    const iced = all.filter(p => p.seaIce != null)
    for (const p of iced) expect(seaIceChance(p.place.id, p), p.date).toBeGreaterThan(0)
    const expected = all.reduce((sum, p) => sum + seaIceChance(p.place.id, p), 0)
    expect(iced.length).toBeLessThanOrEqual(Math.ceil(expected) + 2)
  })

  it('is thin at the freeze-up and wet at the break-up', () => {
    const forming = pickSeaIce('a', 'baltic', at('2025-11-25', 65), true)!
    expect(forming.thin).toBeGreaterThan(0)
    expect(forming.melt).toBe(0)
    const melting = pickSeaIce('a', 'baltic', at('2025-05-15', 65), true)!
    expect(melting.melt).toBeGreaterThan(0)
    expect(melting.thin).toBe(0)
    expect(melting.snow).toBeLessThan(0.5)
    expect(melting.lead).toBeGreaterThan(0)
    const winter = pickSeaIce('a', 'baltic', at('2025-02-15', 65), true)!
    expect(winter.snow).toBeGreaterThan(0.6)
    expect(winter.lead).toBe(0)
  })

  it('forcing it changes nothing but the waves, title and the ice on a day without', () => {
    const open = scene({ seaIce: null }, '2024-07-14')
    const iced = scene({ seaIce: 'fast' }, '2024-07-14')
    expect(open.seaIce).toBeNull()
    expect(iced.seaIce).not.toBeNull()
    expect(iced.place.id).toBe(open.place.id)
    expect(iced.camera.headingDeg).toBe(open.camera.headingDeg)
    expect(iced.weather).toEqual(open.weather)
  })

  it('an unforced day out of season is unchanged by the field', () => {
    expect(scene({}, '2024-07-14')).toEqual(scene({ seaIce: undefined }, '2024-07-14'))
  })

  it('the summer look has none unless forced', () => {
    expect(pickSeaIce('a', 'baltic', at('2025-02-15', 65), undefined, false)).toBeNull()
    expect(pickSeaIce('a', 'baltic', at('2025-02-15', 65), 'fast', false)).not.toBeNull()
  })

  it('a true out of season is a mid-winter one', () => {
    const ice = pickSeaIce('a', 'baltic', at('2025-08-01', 65), true)!
    expect(ice.thin).toBe(0)
    expect(ice.melt).toBe(0)
  })
})

describe('with the sea frozen', () => {
  const days = scenes({ ...BASE, seaIce: true }, 12)
  it('waves stay under the ice, and there is no surf', () => {
    for (const p of days) {
      expect(p.ocean.swellHeight).toBe(0)
      expect(p.ocean.windSpeed).toBeLessThanOrEqual(ICE_WAVE_WIND)
      // Hs of a fully developed sea at that wind; a crest is under ~0.7 Hs + a margin.
      expect((0.21 * p.ocean.windSpeed ** 2) / 9.81).toBeLessThan(ICE_FREEBOARD)
      expect(p.coast.surfAmplitude).toBeLessThan(0.15)
    }
  })

  it('nothing surfaces', () => {
    for (const p of scenes({ ...BASE, seaIce: 'fast', props: { marine: 'dolphin' } }, 6)) expect(marineFor(p, Random.derive(p.seed, 'props/marine'))).toBeNull()
  })

  it('says so in the title', () => {
    for (const p of days) expect(p.title).toMatch(/sea ice|frozen sea|ice-strewn sea/)
  })

  it('the mesh has its own switch, and the waves stay calm', () => {
    const p = scene({ ...BASE, seaIce: 'fast', props: { seaIce: false } }, '2025-02-20')
    expect(seaIceFor(p)).toBeNull()
    expect(p.seaIce).not.toBeNull()
    expect(p.ocean.swellHeight).toBe(0)
  })
})

describe('what the ice is at a point', () => {
  const p = scene({ ...BASE, coast: 'beach', seaIce: true }, '2025-02-20')
  const ice = p.seaIce!
  it('is fast by the shore and drift past the edge', () => {
    expect(iceDrift(ice, 0, 0, 0)).toBe(0)
    expect(iceDrift(ice, 0, 0, ice.edge * 2)).toBe(1)
  })

  it('stays in range, the same every time, with a belt along the shore', () => {
    let near = 0
    let far = 0
    for (let i = 0; i < 2000; i++) {
      const [x, z] = [(i * 37.1) % 3000, (i * 91.7) % 3000]
      const r = iceRubble(ice, x, z, 5)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
      expect(r).toBe(iceRubble(ice, x, z, 5))
      near += r
      far += iceRubble(ice, x, z, 1000)
    }
    expect(near).toBeGreaterThan(far)
  })

  it('open sea has no shore: all of it is drift', () => {
    const q = scene({ ...BASE, coast: 'open-sea', seaIce: 'drift' }, '2025-02-20')
    expect(offshore(q.coast, 100, 100)).toBeGreaterThan(1e6)
    expect(iceDrift(q.seaIce!, 100, 100, offshore(q.coast, 100, 100))).toBe(1)
  })

  it('a piece of rubble is a function of its cell, not of the camera', () => {
    for (const set of BLOCK_SETS) {
      const pieces = []
      for (let c = -30; c < 30; c++) pieces.push(iceBlock(ice, p.coast, set, c, 11))
      const again = pieces.map((_, c) => iceBlock(ice, p.coast, set, c - 30, 11))
      pieces.forEach((b, i) => expect(b?.x).toBe(again[i]?.x))
    }
  })
})

describe('the rubble’s meshes', () => {
  const checks = (make: (r: Random) => ReturnType<typeof slabGeometry>, budget: number) => {
    const a = make(new Random('x'))
    const b = make(new Random('x'))
    expect(Array.from(a.attributes.position.array)).toEqual(Array.from(b.attributes.position.array))
    for (const v of a.attributes.position.array) expect(Number.isFinite(v)).toBe(true)
    for (const v of a.attributes.normal.array) expect(Number.isFinite(v)).toBe(true)
    const triangles = (a.index?.count ?? a.attributes.position.count) / 3
    expect(triangles).toBeLessThanOrEqual(budget)
    a.computeBoundingBox()
    expect(Math.abs(a.boundingBox!.min.y)).toBeLessThan(0.15)
  }
  it('slabs are cheap, deterministic and finite', () => checks(r => slabGeometry(r, 0.8), 50))
  it('lumps too', () => checks(lumpGeometry, 200))
  it('every set stays in budget: under 100k triangles a mesh', () => {
    for (const set of BLOCK_SETS) expect(set.budget * 50).toBeLessThan(250_000)
  })
})

describe('every freezing coast', () => {
  it('has a season on its own coast, none in its summer', () => {
    for (const [id, zones] of Object.entries(SEA_ICE_PLACES)) {
      const place = PLACES.find(q => q.id === id)
      expect(place, id).toBeDefined()
      const south = place!.latitude[0] < 0
      // Each zone reaches into the place's latitudes.
      const lat = Math.max(...place!.latitude.map(Math.abs))
      expect(zones.some(z => lat >= z.from), id).toBe(true)
      const peak = south ? '2025-08-15' : '2025-02-15'
      const summer = south ? '2025-01-20' : '2025-08-20'
      const signed = (south ? -1 : 1) * lat
      if (id !== 'arctic-canada') expect(seaIceChance(id, at(summer, signed)), id).toBe(0)
      expect(seaIceChance(id, at(peak, signed)), id).toBeGreaterThan(0)
    }
  })

  it('leaves the open coasts open', () => {
    for (const id of ['norway-north', 'iceland', 'iceland-faroe', 'gulf-alaska', 'kerguelen-heard', 'south-georgia', 'se-alaska']) {
      expect(seaIceChance(id, at('2025-02-15', 66))).toBe(0)
      expect(seaIceChance(id, at('2025-08-15', -55))).toBe(0)
    }
  })

  it('the far north stays frozen into June, the Gulf of St Lawrence is clear by May', () => {
    expect(seaIceChance('alaska-north', at('2025-06-10', 70))).toBeGreaterThan(0)
    expect(seaIceChance('pei', at('2025-05-10', 46.5))).toBe(0)
    expect(seaIceChance('russian-far-east', at('2025-05-20', 58))).toBeGreaterThan(0)
  })

  it('the bits a frozen sea can’t have are gone, unless forced', () => {
    for (const p of allParams().filter(q => q.seaIce != null)) {
      expect(p.fog?.kind, p.date).not.toBe('sea-smoke')
      expect(p.waterspout, p.date).toBeNull()
      expect(p.title, p.date).not.toMatch(/pack ice|glassy|calm sea/)
    }
  })

  it('keeps the coast’s own geometry whole: run-up is set as it’s built', () => {
    const p = scene({ eclipse: null, place: 'arctic-canada', coast: 'beach', seaIce: true }, '2025-02-15')
    expect(p.coast.runup).toBeLessThanOrEqual(0.03)
  })
})
