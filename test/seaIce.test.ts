import { describe, expect, it } from 'vitest'

import { PLACES } from '../src/places'
import { InstancedMesh, Matrix4, Vector3 } from 'three'

import type { SceneParams } from '../src/params'
import type { SceneSpec } from '../src/sceneSpec'
import { hasLand, terrainHeight } from '../src/terrain'
import { createSeaIce, offshore, seaIceFor, slabGeometry, lumpGeometry, BLOCK_SETS, iceBlock } from '../src/props/seaIce'
import { marineFor } from '../src/props/marine'
import { Random } from '../src/random'
import { ICE_FREEBOARD, ICE_WAVE_WIND, iceDrift, iceRubble, iceZone, pickSeaIce, SEA_ICE_PLACES, seaIceChance } from '../src/seaIce'
import { iceFootChance } from '../src/snow'
import { allParams, expectDryCameras, scene, scenes, viewOf } from './days'

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
  it('near slabs are deterministic, finite and in budget', () => checks(r => slabGeometry(r), 100))
  it('far slabs are cheaper', () => checks(r => slabGeometry(r, false), 50))
  it('lumps too', () => checks(lumpGeometry, 320))
  it('slabs are closed underneath and face out', () => {
    const g = slabGeometry(new Random('y'))
    const position = g.attributes.position
    const normal = g.attributes.normal
    let down = 0
    let up = 0
    for (let i = 0; i < normal.count; i++) {
      if (normal.getY(i) < -0.9 && Math.abs(position.getY(i)) < 0.01) down++
      if (normal.getY(i) > 0.9) up++
    }
    expect(down).toBeGreaterThan(0)
    expect(up).toBeGreaterThan(0)
  })
  it('every set stays in budget: under 100k triangles a mesh', () => {
    // Near: 100 triangles, split over 3 variants. Far: 50.
    expect(BLOCK_SETS[0].budget * 100 / 3).toBeLessThanOrEqual(100_000)
    expect(BLOCK_SETS[1].budget * 50 / 3).toBeLessThanOrEqual(100_000)
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

describe('the ice foot goes with the sea', () => {
  const winter = at('2025-02-15', 72)
  it('is likelier on sea ice, half as likely on open water, and none where the sea never freezes', () => {
    const base = iceFootChance('greenland', 'polar', winter)
    expect(iceFootChance('greenland', 'polar', winter, true)).toBeGreaterThan(base)
    expect(iceFootChance('greenland', 'polar', winter, false)).toBeCloseTo(base / 2)
    expect(iceFootChance('kamchatka-kurils-aleutians', 'boreal', at('2025-02-15', 48))).toBe(0)
    expect(iceFootChance('south-georgia', 'polar', at('2025-08-15', -54.5))).toBe(0)
    expect(iceFootChance('kamchatka-kurils-aleutians', 'boreal', at('2025-02-15', 58))).toBeGreaterThan(0)
  })

  it('is far commoner with sea ice than without', () => {
    const days = allParams().filter(p => p.snow != null && iceZone(p.place.id, p.latitudeDeg) != null)
    const share = (list: typeof days): number => list.filter(p => p.snow?.iceFoot).length / Math.max(1, list.length)
    expect(share(days.filter(p => p.seaIce != null))).toBeGreaterThan(share(days.filter(p => p.seaIce == null)))
  })
})

describe('the ice round the camera, at every tide', () => {
  const COASTS: SceneSpec[] = [
    { coast: 'beach', beachMaterial: 'sand' },
    { coast: 'beach', beachMaterial: 'cobble' },
    { rockShore: 'platform' },
    { rockShore: 'boulder' },
    { rockShore: 'cliff' },
    { coast: 'tidal-flat' }
  ]
  const instances = (p: SceneParams): { d: number; y: number; ground: number; eye: number }[] => {
    const ctx = viewOf(p)
    const out: { d: number; y: number; ground: number; eye: number }[] = []
    const m = new Matrix4()
    const v = new Vector3()
    for (const o of createSeaIce(ctx)) {
      if (!(o instanceof InstancedMesh)) continue
      for (let i = 0; i < o.count; i++) {
        v.setFromMatrixPosition((o.getMatrixAt(i, m), m))
        out.push({ d: ctx.distance(v.x, v.z), y: v.y, ground: hasLand(p.coast) ? terrainHeight(p.coast, v.x, v.z) : -1, eye: ctx.camera.position.y })
      }
    }
    return out
  }
  // A spread of tidal ranges: the Baltic's nothing to Ungava's many metres.
  const table = COASTS.flatMap(coast => ['arctic-canada', 'baltic'].flatMap(place => expectDryCameras({ place, seaIce: 'fast', snow: true, ...coast, ...(place === 'arctic-canada' ? { tidalRange: 8 } : {}) }, { count: 1, above: () => -20, compositions: coast.rockShore != null || coast.coast === 'tidal-flat' ? ['framed', 'overlook'] : undefined })))

  it('the eye is above the ice', () => {
    for (const p of table) {
      const ctx = viewOf(p)
      expect(ctx.camera.position.y, `${p.date} ${p.coast.type} ${p.coast.tide}`).toBeGreaterThan(ICE_FREEBOARD + 1)
    }
  })

  it('no piece stands within 4 m of the camera', () => {
    for (const p of table) for (const b of instances(p)) expect(b.d, `${p.date} ${p.coast.type}`).toBeGreaterThanOrEqual(4)
  })

  it('no piece near the camera stands above the eye, blocking the view', () => {
    for (const p of table) {
      for (const b of instances(p)) if (b.d < 40) expect(b.y, `${p.date} ${p.coast.type} at ${b.d.toFixed(1)} m`).toBeLessThan(b.eye)
    }
  })

  it('a pile stays a pile: no piece floats far above what is under it', () => {
    for (const p of table) for (const b of instances(p)) expect(b.y - Math.max(b.ground, ICE_FREEBOARD)).toBeLessThanOrEqual(2.2)
  })

  it('stays within budget on every coast', () => {
    for (const p of table) expect(instances(p).length).toBeLessThanOrEqual(BLOCK_SETS[0].budget + BLOCK_SETS[1].budget)
  })
})

describe('the study behind Arctic Canada’s dates', () => {
  it('breaks up from 18 June, the channels clear by mid-July, the High Arctic stays into August', () => {
    expect(seaIceChance('arctic-canada', at('2025-06-10', 66))).toBe(1)
    expect(seaIceChance('arctic-canada', at('2025-07-20', 66))).toBe(0)
    expect(seaIceChance('arctic-canada', at('2025-07-20', 74))).toBeGreaterThan(0)
    expect(seaIceChance('arctic-canada', at('2025-09-01', 74))).toBe(0)
  })

  it('keeps the air’s wind apart from the waves’', () => {
    const open = scene({ seaIce: null, wind: undefined, eclipse: null, storm: null }, '2025-02-20')
    const frozen = scene({ seaIce: 'fast', eclipse: null, storm: null }, '2025-02-20')
    expect(frozen.ocean.windSpeed).toBeLessThanOrEqual(ICE_WAVE_WIND)
    expect(frozen.ocean.airWindSpeed).toBe(open.ocean.airWindSpeed)
  })
})
