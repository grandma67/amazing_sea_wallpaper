import { describe, expect, it } from 'vitest'

import type { IslandKind } from '../src/params'
import { islandHeight } from '../src/props/islands'
import { allParams, scenes, share } from './days'

describe('islands at sea', () => {
  const days = allParams()

  it('show on about a quarter to a third of days', () => {
    const s = share(days, p => p.islands != null)
    expect(s).toBeGreaterThan(0.2)
    expect(s).toBeLessThan(0.4)
  })

  it('are the kinds each coast has', () => {
    const kinds: Record<string, IslandKind[]> = {
      nordic: ['skerries', 'rocky', 'high'],
      mediterranean: ['rocky'],
      tropical: ['cay', 'high', 'karst'],
      volcanic: ['high', 'rocky'],
      desert: ['rocky']
    }
    for (const p of days) if (p.islands != null) expect(kinds[p.biome.name]).toContain(p.islands.kind)
    // Skerries are the nordic archipelago's; cays are most tropical islands.
    const tropical = days.filter(p => p.islands != null && p.biome.name === 'tropical')
    expect(share(tropical, p => p.islands!.kind === 'cay')).toBeGreaterThan(0.35)
  })

  it('are sized and placed for their kind', () => {
    for (const p of scenes({ islands: true }, 60)) {
      const { kind, islands } = p.islands!
      expect(islands.length).toBeGreaterThan(0)
      for (const i of islands) {
        expect(Math.abs(i.offset)).toBeLessThanOrEqual(0.95)
        expect(i.height).toBeGreaterThan(0)
        // Karst towers can be taller than wide; the rest are broader.
        if (kind !== 'karst') expect(i.width).toBeGreaterThan(i.height)
        // Low islands near, high ones far: none so close it crowds the beach.
        expect(i.distance).toBeGreaterThan(kind === 'high' ? 7000 : 500)
        if (kind === 'cay') expect(i.height).toBeLessThan(4)
      }
    }
  })

  it('can be forced, and the title names them', () => {
    for (const kind of ['skerries', 'rocky', 'cay', 'karst', 'high'] as const) {
      for (const p of scenes({ islands: kind }, 5)) {
        expect(p.islands!.kind).toBe(kind)
        expect(p.title).toMatch(/skerries|island|islet/)
      }
    }
    for (const p of scenes({ islands: null }, 5)) expect(p.islands).toBeNull()
  })

  it('have a shoreline: land in the middle, sea round the edge', () => {
    for (const kind of ['skerries', 'rocky', 'cay', 'karst', 'high'] as const) {
      const shape = { kind, rx: 300, ry: 200, height: kind === 'cay' ? 2 : 100, seed: 7 }
      expect(islandHeight(shape, 0, 0)).toBeGreaterThan(0)
      for (let a = 0; a < 6.28; a += 0.3) {
        const h = islandHeight(shape, Math.cos(a) * 600, Math.sin(a) * 400)
        expect(h).toBeLessThan(0)
        expect(Number.isFinite(h)).toBe(true)
      }
      // Deterministic.
      expect(islandHeight(shape, 40, -30)).toBe(islandHeight({ ...shape }, 40, -30))
    }
  })
})
