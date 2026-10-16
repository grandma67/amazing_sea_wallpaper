import { describe, expect, it } from 'vitest'

import { CLOUD_GENERA, layerChannels, MAX_LAYERS, pickFormations, type CloudGenus } from '../src/cloudTypes'
import type { SceneParams } from '../src/params'
import { Random } from '../src/random'
import { allParams, scene, scenes, share } from './days'

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

describe('cloud species over the real days', () => {
  const days = allParams()
  const has = (p: SceneParams, g: CloudGenus): boolean => p.weather.formations.includes(g)
  const morning = (p: SceneParams): boolean => !p.evening && ['golden-hour', 'daylight', 'sun-on-horizon'].includes(p.timeOfDay)

  it('keeps every sky within takram\'s four layers, each on its own channel', () => {
    for (const p of days) {
      expect(p.weather.formations.length).toBeLessThanOrEqual(MAX_LAYERS)
      const channels = layerChannels(p.weather.formations)
      expect(new Set(channels).size).toBe(channels.length)
    }
  })

  it('makes humilis a morning or trade-wind cloud on fair days', () => {
    const humilis = days.filter(p => has(p, 'cumulus-humilis'))
    expect(humilis.length).toBeGreaterThan(20)
    for (const p of humilis) expect(p.weather.kind).toBe('few')
    expect(share(humilis, p => p.biome.name === 'tropical' || morning(p))).toBeGreaterThan(0.8)
  })

  it('tears cumulus into fractus only when windy', () => {
    const fractus = days.filter(p => has(p, 'cumulus-fractus'))
    expect(fractus.length).toBeGreaterThan(10)
    for (const p of fractus) {
      expect(['scattered', 'broken']).toContain(p.weather.kind)
      expect(p.ocean.windSpeed).toBeGreaterThan(5)
    }
  })

  it('puts scud only under nimbostratus or cumulonimbus', () => {
    const scud = days.filter(p => has(p, 'stratus-fractus'))
    expect(scud.length).toBeGreaterThan(5)
    for (const p of scud)
      expect(p.weather.formations.some(g => g === 'nimbostratus' || CLOUD_GENERA[g].genus === 'cumulonimbus')).toBe(true)
  })

  it('raises altocumulus turrets and tufts on warm summer mornings', () => {
    const ac = days.filter(p => has(p, 'altocumulus-castellanus') || has(p, 'altocumulus-floccus'))
    expect(ac.length).toBeGreaterThan(5)
    for (const p of ac) {
      expect(['mediterranean', 'tropical']).toContain(p.biome.name)
      const month = Number(p.date.slice(5, 7))
      expect(p.sea.ocean === 'southern' ? month <= 3 || month === 12 : month >= 6 && month <= 9).toBe(true)
      expect(morning(p)).toBe(true)
    }
    for (const p of days.filter(q => has(q, 'stratocumulus-castellanus'))) {
      expect(['nordic', 'volcanic']).toContain(p.biome.name)
      expect(['broken', 'overcast']).toContain(p.weather.kind)
    }
  })

  it('hides the sun behind opacus only on overcast and storm days', () => {
    const opacus = days.filter(p => has(p, 'altostratus-opacus'))
    expect(opacus.length).toBeGreaterThan(10)
    for (const p of opacus) expect(['overcast', 'storm']).toContain(p.weather.kind)
    for (const p of days.filter(q => q.weather.kind === 'overcast')) expect(has(p, 'altostratus')).toBe(false)
  })

  it('gives each species its sun', () => {
    for (const g of Object.keys(CLOUD_GENERA) as CloudGenus[]) {
      const [lo, hi] = CLOUD_GENERA[g].sunVisibility
      expect(lo).toBeGreaterThanOrEqual(0)
      expect(hi).toBeLessThanOrEqual(1)
      expect(lo).toBeLessThanOrEqual(hi)
    }
    expect(CLOUD_GENERA['altostratus-opacus'].sunVisibility[1]).toBeLessThan(CLOUD_GENERA.altostratus.sunVisibility[0])
    expect(CLOUD_GENERA['cirrus-spissatus'].densityScale).toBeGreaterThanOrEqual(5 * CLOUD_GENERA.cirrus.densityScale)
  })

  it('stacks a duplicatus deck 300–800 m above the first, on cloudy days', () => {
    const dup = days.filter(p => new Set(p.weather.formations).size < p.weather.formations.length)
    expect(dup.length).toBeGreaterThan(10)
    for (const p of dup) {
      expect(['broken', 'overcast']).toContain(p.weather.kind)
      expect(p.weather.duplicatusLiftM).toBeGreaterThanOrEqual(300)
      expect(p.weather.duplicatusLiftM).toBeLessThanOrEqual(800)
    }
  })

  it('splits storms into calvus and capillatus, the anvil on top', () => {
    const storms = scenes({ storm: 'thunderstorm', timeOfDay: 'daylight', eclipse: null }, 60)
    const capillatus = storms.filter(p => has(p, 'cumulonimbus-capillatus'))
    expect(capillatus.length).toBeGreaterThan(15)
    expect(capillatus.length).toBeLessThan(45)
    for (const p of capillatus) expect(has(p, 'cirrus-spissatus')).toBe(true)
    for (const p of storms) expect(p.weather.formations.length).toBeLessThanOrEqual(MAX_LAYERS)
  })

  it('forces each species with a spec', () => {
    for (const g of Object.keys(CLOUD_GENERA) as CloudGenus[]) {
      const p = scene({ weather: 'scattered', clouds: [g], storm: null, eclipse: null })
      expect(p.weather.formations).toEqual([g])
    }
  })
})
