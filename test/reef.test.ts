import { describe, expect, it } from 'vitest'

import { hasBeach } from '../src/coastKind'
import type { CoastParams } from '../src/params'
import { placeNamed, PLACES } from '../src/places'
import { createBeachrock } from '../src/props/beachrock'
import { mangroveFor } from '../src/props/mangroves'
import { Random } from '../src/random'
import { reefFor } from '../src/reef'
import { shelterAt } from '../src/shelter'
import { reefCrest, reefGap, seaDistance, shoreToWorld, surfWave, worldToShore } from '../src/terrain'
import { allParams, expectShare, heightAt as at, scene, scenes, view } from './days'

const base = { eclipse: null, coast: 'beach', beachMaterial: 'sand', tide: 'mid' } as const
/** The along-shore coordinate of the reef (not a pass) nearest a = 0. */
const onReef = (coast: CoastParams): number => {
  for (let a = 0; ; a += 10) if (reefGap(coast, a) === 0) return a
}
const inPass = (coast: CoastParams): number => {
  for (let a = 0; ; a += 2) if (reefGap(coast, a) === 1) return a
}

describe('reef chances', () => {
  it('are set on tropical coasts only: islands most, continents less, Hawaii and the Red Sea a few', () => {
    for (const p of PLACES) {
      expect(p.reef).toBeGreaterThanOrEqual(0)
      expect(p.reef).toBeLessThanOrEqual(1)
      if (p.biome === 'nordic' || p.biome === 'mediterranean') expect(p.reef).toBe(0)
    }
    for (const id of ['maldives', 'pacific-islands', 'bahamas-bermuda']) expect(placeNamed(id).reef).toBeGreaterThanOrEqual(0.75)
    for (const id of ['central-america', 'india', 'west-africa']) expect(placeNamed(id).reef).toBeLessThan(0.25)
    expect(placeNamed('hawaii').reef).toBeCloseTo(0.2)
    expect(placeNamed('red-sea').reef).toBeCloseTo(0.2)
  })

  it('give reefs on about half the tropical beach days, only on beaches of places that have them', () => {
    const days = allParams()
    for (const p of days) if (p.coast.reef != null) expect(placeNamed(p.place.id).reef, p.date).toBeGreaterThan(0)
    // Over forced tropical beach days, the place-weighted chance (0.46, params.mjs --expect:
    // continental coasts, a third of tropical days, have few reefs).
    expectShare(scenes({ ...base, biome: 'tropical' }, 400), p => p.coast.reef != null, 0.46)
    expectShare(scenes({ ...base, place: 'maldives' }, 100), p => p.coast.reef != null, 0.95)
  })

  it('give beachrock on ~30% of reef beaches', () => {
    expectShare(scenes({ ...base, reef: true }, 300), p => p.coast.reef!.beachrock, 0.3)
  })
})

describe('reef spec', () => {
  it('forces a reef on any beach', () => {
    for (const date of ['2024-02-01', '2025-06-15', '2026-09-30']) {
      expect(scene({ place: 'norway-west', ...base }, date).coast.reef).toBeNull()
      expect(scene({ place: 'norway-west', ...base, reef: true }, date).coast.reef).not.toBeNull()
    }
  })

  it('removes it with null, and beachrock implies a reef and a beach', () => {
    for (const p of scenes({ ...base, place: 'maldives', reef: null }, 20)) expect(p.coast.reef).toBeNull()
    for (const p of scenes({ place: 'maldives', beachrock: true }, 20)) {
      expect(hasBeach(p.coast)).toBe(true)
      expect(p.coast.reef?.beachrock).toBe(true)
    }
    for (const p of scenes({ ...base, reef: true, beachrock: null }, 20)) expect(p.coast.reef!.beachrock).toBe(false)
  })

  it('draws every value before deciding, so forcing changes nothing else', () => {
    const a = reefFor(0, true, 1, Random.derive('x', 'reef'), { reef: true })
    const b = reefFor(1, true, 1, Random.derive('x', 'reef'))
    expect(a).toEqual(b)
    expect(reefFor(1, false, 1, Random.derive('x', 'reef'))).toBeNull()
  })

  it('is titled', () => {
    expect(scene({ ...base, reef: true }, '2025-03-01').title).toContain('coral reef')
  })
})

describe('reef profile', () => {
  const reefs = scenes({ ...base, place: 'maldives', reef: true }, 20)

  it('has a lagoon, a crest near the spring low water and a drop-off, joined without steps', () => {
    for (const p of reefs) {
      const { coast } = p
      const reef = coast.reef!
      const a = onReef(coast)
      const crestS = coast.terrace.width + reefCrest(coast, a)
      const level = coast.tide.level
      // Heights at sea level 0, today's water; + level = above mean sea.
      expect(at(coast, crestS - 2, a) + level).toBeCloseTo(-reef.crestDepth, 0)
      // The lagoon floor (between coral heads).
      let floor = 0
      for (let s = crestS - reef.flatWidth - 80; s < crestS - reef.flatWidth - 40; s += 2) floor = Math.min(floor, at(coast, s, a) + level)
      expect(floor).toBeLessThan(-0.8 * reef.lagoonDepth)
      expect(at(coast, crestS + 60, a) + level).toBeLessThan(-15)
      // No steps at the joins (shore, lagoon to ramp, ramp to flat, crest to
      // drop-off; coral heads in the lagoon are steep-sided on purpose): the
      // steepest part is the drop-off (~0.6).
      for (const along of [a, inPass(coast)]) {
        const crest = coast.terrace.width + reefCrest(coast, along)
        for (const join of [coast.waterline, crest - reef.flatWidth - 15, crest - reef.flatWidth, crest]) {
          let last = at(coast, join - 5, along)
          for (let s = join - 4.5; s <= join + 5; s += 0.5) {
            const h = at(coast, s, along)
            expect(Math.abs(h - last), `s ${s} a ${along}`).toBeLessThan(0.4)
            last = h
          }
        }
      }
      // A pass is deeper than the reef flat.
      expect(at(coast, crestS - 5, inPass(coast))).toBeLessThan(at(coast, crestS - 5, a) - 0.4)
      expect(coast.bars).toEqual([])
      expect(coast.rips).toBeNull()
    }
  })

  it('bares the reef flat at spring low water', () => {
    for (const p of scenes({ ...base, place: 'maldives', reef: true, tide: 'low', tidalRange: 1.2 }, 10)) {
      const a = onReef(p.coast)
      expect(at(p.coast, p.coast.terrace.width + reefCrest(p.coast, a) - 3, a)).toBeGreaterThan(-0.05)
    }
  })

  it('shelters the lagoon: surf there is ≤ 0.3 × the incoming wave', () => {
    for (const p of reefs) {
      const { coast } = p
      const reef = coast.reef!
      expect(coast.shelter!.line).toBeCloseTo(coast.terrace.width + reef.distance)
      const s = coast.waterline + 30
      expect(shelterAt(coast, s, 0)).toBeCloseTo(reef.strength)
      expect(shelterAt(coast, coast.terrace.width + reef.distance + 5, 0)).toBe(0)
      const depth = -at(coast, s)
      expect(surfWave(coast, depth, 1, shelterAt(coast, s, 0)).height).toBeLessThanOrEqual(0.3 * surfWave(coast, depth).height + 1e-9)
      // The crest's seaward face is open to the waves.
      expect(seaDistance(coast, worldToShore(coast, ...shoreToWorld(coast, coast.terrace.width + reef.distance + 5, 0))[0])).toBeGreaterThan(reef.distance)
    }
  })

  it('lowers the run-up and counts as sheltered for mangroves', () => {
    for (const date of ['2024-04-01', '2025-08-01']) {
      const open = scene({ ...base, place: 'pacific-islands', reef: null, swellHeight: 3 }, date)
      const reef = scene({ ...base, place: 'pacific-islands', reef: true, swellHeight: 3 }, date)
      expect(reef.coast.runup).toBeLessThan(open.coast.runup)
    }
    const stands = scenes({ ...base, place: 'pacific-islands', reef: true, swellHeight: 3 }, 60).map(p => mangroveFor(p, Random.derive(p.seed, 'props/mangroves')))
    expect(stands.some(s => s != null)).toBe(true)
  })
})

describe('beachrock', () => {

  it('crops out along the waterline in view, and only with beachrock', () => {
    const ctx = view({ ...base, place: 'antilles', composition: 'along-beach', beachrock: true }, 1080, '2025-07-10')
    const meshes = createBeachrock(ctx)
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBeGreaterThan(10)
    expect(createBeachrock(view({ ...base, place: 'antilles', composition: 'along-beach', beachrock: null }, 1080, '2025-07-10'))).toEqual([])
  })
})
