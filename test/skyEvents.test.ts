import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { rollGeometry, shelfGeometry } from '../src/props/cloudEvents'
import { allParams, scene, scenes, share } from './days'

describe('cloud events', () => {
  const days = allParams()

  it('puts a shelf cloud on ~40% of storms, facing the rain, with no scud hiding it', () => {
    const storms = days.filter(p => p.storm != null)
    const rate = share(storms, p => p.storm!.shelf != null)
    expect(rate).toBeGreaterThan(0.2)
    expect(rate).toBeLessThan(0.6)
    for (const p of days.filter(q => q.storm == null)) expect(p.storm?.shelf ?? null).toBeNull()
    for (const p of storms.filter(q => q.storm!.shelf != null)) expect(p.weather.formations).not.toContain('stratus-fractus')
    expect(scene({ storm: 'squall', shelfCloud: true, eclipse: null, timeOfDay: 'daylight' }).storm?.shelf).not.toBeNull()
  })

  it('brings the Morning Glory only to tropical Indo-Pacific dawns in Sep–Nov', () => {
    for (const p of days.filter(q => q.rollCloud != null)) {
      expect(p.biome.name).toBe('tropical')
      expect(['indian', 'pacific']).toContain(p.sea.ocean)
      expect([9, 10, 11]).toContain(Number(p.date.slice(5, 7)))
      expect(p.evening).toBe(false)
      expect(p.title).toContain('Morning Glory')
    }
    expect(scene({ rollCloud: true }).rollCloud).not.toBeNull()
  })

  it('stands lenticulars only over a landform in strong wind', () => {
    for (const p of days.filter(q => q.landform?.lenticular != null)) {
      expect(p.ocean.windSpeed).toBeGreaterThanOrEqual(8)
      expect(['storm', 'overcast']).not.toContain(p.weather.kind)
    }
    expect(scene({ landform: 'strato', lenticular: true, wind: 14 }).landform?.lenticular).not.toBeNull()
  })

  it('caps only active plumes with pyrocumulus, about half of them', () => {
    const active = scenes({ landform: 'strato' }, 200).filter(p => p.landform?.plume != null)
    for (const p of scenes({ landform: 'strato' }, 200)) if (p.landform?.pyrocumulus) expect(p.landform.plume).not.toBeNull()
    const rate = share(active, p => p.landform!.pyrocumulus)
    expect(rate).toBeGreaterThan(0.25)
    expect(rate).toBeLessThan(0.75)
  })

  it('builds finite meshes within budget', () => {
    const p = scene({ storm: 'squall', shelfCloud: true, rollCloud: true, eclipse: null, timeOfDay: 'golden-hour' })
    const shelf = shelfGeometry(p.storm!.shelf!, new Vector3(0, 0, -1), new Vector3(), 600).build()
    const roll = rollGeometry(p.rollCloud!, new Vector3(1, 0, 0), new Vector3(0, 0, -3000)).build()
    for (const g of [shelf, roll]) {
      const pos = g.getAttribute('position')
      for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
    }
    // The shelf hangs under the 600 m base, not into it.
    const ys = Array.from({ length: shelf.getAttribute('position').count }, (_, i) => shelf.getAttribute('position').getY(i))
    expect(Math.max(...ys)).toBeLessThan(800)
    expect(roll.index!.count / 3).toBeLessThan(50_000)
  })
})
