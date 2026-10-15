import { describe, expect, it } from 'vitest'

import { mangroveFor, SHELTERED_SURF } from '../src/props/mangroves'
import { avicennia, rhizophora } from '../src/props/trees'
import { Random } from '../src/random'
import { allParams, scenes, share } from './days'

describe('mangroves', () => {
  const days = allParams()
  const stand = (p: (typeof days)[number]) => mangroveFor(p, Random.derive(p.seed, 'props/mangroves'))

  it('grow only on sheltered tropical and desert shores', () => {
    for (const p of days) {
      const s = stand(p)
      if (s == null) continue
      expect(p.coast.type).toBe('beach')
      expect(p.coast.surfAmplitude).toBeLessThan(SHELTERED_SURF)
      expect(['tropical', 'desert']).toContain(p.biome.name)
      // Red mangroves need the humid tropics; the desert coasts have grey only.
      if (p.biome.name === 'desert') {
        expect(s.kind).toBe('avicennia')
        expect(p.sea.ocean).not.toBe('atlantic')
      }
    }
  })

  it('are common on calm tropical beaches, absent elsewhere', () => {
    const calm = scenes({ coast: 'beach', biome: 'tropical', params: { coast: { surfAmplitude: 0.2 } } }, 60)
    expect(share(calm, p => stand(p) != null)).toBeGreaterThan(0.3)
    for (const biome of ['nordic', 'mediterranean', 'volcanic'] as const) {
      for (const p of scenes({ coast: 'beach', biome, params: { coast: { surfAmplitude: 0.2 } } })) expect(stand(p)).toBeNull()
    }
    const tropical = days.filter(p => p.coast.type === 'beach' && p.biome.name === 'tropical')
    const rate = share(tropical, p => stand(p) != null)
    expect(rate).toBeGreaterThan(0.08)
    expect(rate).toBeLessThan(0.4)
  })

  it('can be forced, but not onto the open sea', () => {
    const forced = scenes({ coast: 'beach', biome: 'nordic', props: { mangroves: 'rhizophora' } }, 10)
    for (const p of forced) expect(stand(p)?.kind).toBe('rhizophora')
    for (const p of scenes({ coast: 'open-sea', props: { mangroves: true } }, 10)) expect(stand(p)).toBeNull()
    for (const p of scenes({ coast: 'beach', biome: 'tropical', props: { mangroves: null } }, 10)) expect(stand(p)).toBeNull()
  })

  it('builds finite trees rooted at the mud, within budget', () => {
    for (let i = 0; i < 3; i++) {
      for (const g of [rhizophora(new Random(`r${i}`), [0.1, 0.2, 0.05]), avicennia(new Random(`a${i}`), [0.1, 0.2, 0.05])]) {
        const pos = g.attributes.position.array as Float32Array
        expect(pos.every(Number.isFinite)).toBe(true)
        expect((g.attributes.normal.array as Float32Array).every(Number.isFinite)).toBe(true)
        g.computeBoundingBox()
        expect(g.boundingBox!.min.y).toBeGreaterThan(-0.5)
        expect(g.boundingBox!.min.y).toBeLessThan(0.05)
        const triangles = (g.index?.count ?? pos.length / 3) / 3
        expect(triangles).toBeLessThan(100_000)
      }
    }
  })
})
