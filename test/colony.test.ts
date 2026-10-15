import { describe, expect, it } from 'vitest'

import type { ColonyKind, PinnipedKind } from '../src/params'
import { allParams, scenes, share } from './days'

describe('colonies on the mainland', () => {
  const days = allParams()
  const colonies = days.filter(p => p.colony != null)
  const hauled = days.filter(p => p.pinnipeds != null)

  it('are only on beach coasts: the open sea has islands and rocks', () => {
    for (const p of colonies) if (p.coast.type !== 'beach') expect(p.colony!.site).toBe('island')
    for (const p of hauled) if (p.coast.type !== 'beach') expect(p.pinnipeds!.site).toBe('rock')
  })

  it('happen at roughly the rate set for each kind', () => {
    const beach = colonies.filter(p => p.coast.type === 'beach')
    const mainland = share(beach, p => p.colony!.site === 'mainland')
    expect(mainland).toBeGreaterThan(0.15)
    expect(mainland).toBeLessThan(0.6)
    const onSand = share(hauled.filter(p => p.coast.type === 'beach'), p => p.pinnipeds!.site === 'beach')
    expect(onSand).toBeGreaterThan(0.2)
    expect(onSand).toBeLessThan(0.75)
  })

  it('mostly put penguins on the beach and seabirds on islands', () => {
    const mainlandShare = (kind: ColonyKind): number =>
      share(scenes({ colony: kind, coast: 'beach' }, 120), p => p.colony!.site === 'mainland')
    expect(mainlandShare('penguin')).toBeGreaterThan(0.45)
    expect(mainlandShare('tropical')).toBeLessThan(0.3)
    expect(mainlandShare('gannet')).toBeLessThan(0.5)
    const beachShare = (kind: PinnipedKind): number =>
      share(scenes({ pinnipeds: kind, coast: 'beach' }, 120), p => p.pinnipeds!.site === 'beach')
    expect(beachShare('elephant-seal')).toBeGreaterThan(0.7)
    expect(beachShare('seal')).toBeLessThan(0.5)
  })

  it('can be forced, and the title says seabird cliffs on the mainland', () => {
    for (const p of scenes({ colony: 'gannet', colonySite: 'mainland', coast: 'beach' }, 10)) {
      expect(p.colony).toEqual({ kind: 'gannet', site: 'mainland' })
      expect(p.title).toContain('seabird cliffs')
    }
    for (const p of scenes({ colony: 'penguin', colonySite: 'island' }, 10)) {
      expect(p.colony).toEqual({ kind: 'penguin', site: 'island' })
      expect(p.title).toContain('penguin colony')
    }
    for (const p of scenes({ pinnipeds: 'sea-lion', haulOut: 'beach', coast: 'beach' }, 10)) expect(p.pinnipeds).toEqual({ kind: 'sea-lion', site: 'beach' })
    // No mainland on the open sea, whatever the spec says.
    for (const p of scenes({ colony: 'puffin', colonySite: 'mainland', coast: 'open-sea' }, 5)) expect(p.colony!.site).toBe('island')
  })
})
