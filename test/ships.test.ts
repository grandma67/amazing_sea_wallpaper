import { describe, expect, it } from 'vitest'

import { dinghy, expeditionShip, icebreaker, polarFleet, polarWaters } from '../src/props/ships'
import { Random } from '../src/random'
import { allParams, scene, share } from './days'

describe('ships in polar seas', () => {
  const polar = allParams().filter(polarWaters)
  const fleet = (p: (typeof polar)[number]) => polarFleet(p, Random.derive(p.seed, 'ships'))
  const month = (p: (typeof polar)[number]) => Number(p.date.slice(5, 7))
  const summer = (p: (typeof polar)[number]) =>
    p.sea.ocean === 'southern' ? month(p) >= 11 || month(p) <= 3 : month(p) >= 6 && month(p) <= 9

  it('is only the Arctic and the Southern Ocean', () => {
    expect(polar.length).toBeGreaterThan(30)
    for (const p of allParams()) expect(polarWaters(p)).toBe(['arctic', 'southern'].includes(p.sea.ocean))
  })

  it('sends expedition ships only in their season', () => {
    for (const p of polar) if (!summer(p)) expect(fleet(p)).not.toContain('expedition-ship')
    // Antarctic season is the southern summer.
    for (const date of ['2024-07-10', '2024-08-15']) {
      for (let i = 0; i < 20; i++) {
        const p = scene({ date, ocean: 'southern', seed: `s${i}` })
        expect(polarFleet(p, new Random(`f${i}`))).not.toContain('expedition-ship')
      }
    }
  })

  it('has more dinghies out in summer', () => {
    const hasDinghy = (p: (typeof polar)[number]) => fleet(p).includes('dinghy')
    const inSummer = share(polar.filter(summer), hasDinghy)
    const inWinter = share(polar.filter(p => !summer(p)), hasDinghy)
    expect(inSummer).toBeGreaterThan(0.3)
    expect(inWinter).toBeLessThan(inSummer)
  })

  it('builds finite boats floating at the waterline', () => {
    for (let i = 0; i < 4; i++) {
      for (const g of [dinghy(new Random(`d${i}`)), expeditionShip(new Random(`e${i}`)), icebreaker(new Random(`i${i}`))]) {
        const pos = g.attributes.position.array as Float32Array
        expect(pos.every(Number.isFinite)).toBe(true)
        g.computeBoundingBox()
        const box = g.boundingBox!
        expect(box.min.y).toBeLessThan(0)
        expect(box.max.y).toBeGreaterThan(0)
        expect(pos.length / 3).toBeLessThan(100_000)
      }
    }
  })

  it('is deterministic', () => {
    const a = icebreaker(new Random('x')).attributes.position.array
    const b = icebreaker(new Random('x')).attributes.position.array
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
