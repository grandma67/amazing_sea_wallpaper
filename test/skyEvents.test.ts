import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { rollGeometry } from '../src/props/cloudEvents'
import { SHELF_BOLT_BEHIND_M, SHELF_LEAD_M, SHELF_SECTOR_DEG } from '../src/skyEvents'
import { allParams, scene, scenes, share } from './days'

describe('cloud events', () => {
  const days = allParams()

  it('puts a shelf cloud on ~40% of storms, facing the rain, with no scud hiding it', () => {
    const storms = days.filter(p => p.storm != null)
    const rate = share(storms, p => p.storm!.shelf != null)
    expect(rate).toBeGreaterThan(0.2)
    expect(rate).toBeLessThan(0.6)
    expect(scene({ storm: 'squall', shelfCloud: true, eclipse: null, timeOfDay: 'daylight' }).storm?.shelf).not.toBeNull()
  })

  it('stands the shelf ahead of the rain and bolts in its direction', () => {
    const shelfDays = [...days, ...scenes({ storm: 'thunderstorm', shelfCloud: true, eclipse: null }, 100)].filter(p => p.storm?.shelf != null)
    expect(shelfDays.length).toBeGreaterThan(80)
    const gap = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180)
    for (const p of shelfDays) {
      const { shelf, curtains, bolts } = p.storm!
      const inSector = (r: { azimuthDeg: number }) => gap(r.azimuthDeg, shelf!.azimuthDeg) <= SHELF_SECTOR_DEG
      for (const c of curtains.filter(inSector)) expect(c.distance).toBeGreaterThanOrEqual(shelf!.distanceM + SHELF_LEAD_M[0] - 1e-6)
      for (const b of bolts.filter(inSector)) expect(b.distance).toBeGreaterThanOrEqual(shelf!.distanceM + SHELF_BOLT_BEHIND_M - 1e-6)
    }
  })

  it('forces the Morning Glory', () => {
    expect(scene({ rollCloud: true }).rollCloud).not.toBeNull()
  })

  it('forces a lenticular over a landform', () => {
    expect(scene({ landform: 'strato', lenticular: true, wind: 14 }).landform?.lenticular).not.toBeNull()
  })

  it('caps only active plumes with pyrocumulus, about half of them', () => {
    const active = scenes({ landform: 'strato' }, 200).filter(p => p.landform?.plume != null)
    for (const p of scenes({ landform: 'strato' }, 200)) if (p.landform?.pyrocumulus) expect(p.landform.plume).not.toBeNull()
    const rate = share(active, p => p.landform!.pyrocumulus)
    expect(rate).toBeGreaterThan(0.25)
    expect(rate).toBeLessThan(0.75)
  })

  it('builds a finite roll cloud within budget', () => {
    const p = scene({ rollCloud: true, eclipse: null, timeOfDay: 'golden-hour' })
    const roll = rollGeometry(p.rollCloud!, new Vector3(1, 0, 0), new Vector3(0, 0, -3000)).build()
    const pos = roll.getAttribute('position')
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
    expect(roll.index!.count / 3).toBeLessThan(50_000)
  })
})
