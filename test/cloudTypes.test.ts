import { describe, expect, it } from 'vitest'

import { CLOUD_GENERA, pickFormations } from '../src/cloudTypes'
import { Random } from '../src/random'

const amounts = ['clear', 'cirrus', 'few', 'scattered', 'broken', 'overcast'] as const

describe('CLOUD_GENERA', () => {
  it('names each entry after its WMO genus', () => {
    for (const [key, spec] of Object.entries(CLOUD_GENERA)) expect(key.startsWith(spec.genus)).toBe(true)
  })
})

describe('pickFormations', () => {
  it('leaves a clear sky empty and gives any other sky some cloud', () => {
    const rng = new Random('clouds')
    for (let i = 0; i < 200; i++) {
      for (const amount of amounts) {
        const genera = pickFormations(rng, amount, { cool: i % 2 === 0, tropical: i % 3 === 0 })
        if (amount === 'clear') expect(genera).toEqual([])
        else expect(genera.length).toBeGreaterThan(0)
      }
    }
  })

  it('picks at most one genus per étage', () => {
    const rng = new Random('etages')
    for (let i = 0; i < 300; i++) {
      for (const amount of amounts) {
        const etages = pickFormations(rng, amount, { cool: false, tropical: false }).map(g => CLOUD_GENERA[g].etage)
        expect(new Set(etages).size).toBe(etages.length)
      }
    }
  })

  it('gives a cirrus sky only high cloud', () => {
    const rng = new Random('cirrus')
    for (let i = 0; i < 100; i++)
      for (const g of pickFormations(rng, 'cirrus', { cool: false, tropical: false })) expect(CLOUD_GENERA[g].etage).toBe('high')
  })
})
