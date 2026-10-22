import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import { propChoices } from '../src/props/choices'
import { wildlifeFor } from '../src/props/wildlife'
import { allParams, scenes } from './days'

describe('prop choices', () => {
  const days = allParams()

  it('matches the creators’ own streams and is deterministic', () => {
    for (const p of days.slice(0, 60)) {
      const choices = propChoices(p)
      expect(choices.wildlife).toEqual(wildlifeFor(p, Random.derive(p.seed, 'props/wildlife')))
      expect(propChoices(p)).toEqual(choices)
    }
  })

  it('keeps animals out of the air and off the sea surface in storms', () => {
    for (const p of scenes({ storm: 'squall', timeOfDay: 'daylight', eclipse: null }, 40)) {
      const c = propChoices(p)
      expect(c.gulls).not.toBe('flying')
      expect(c.marine).toBeNull()
      expect(c.migratory).toBeNull()
    }
    const calm = days.filter(p => p.storm == null && p.weather.kind !== 'storm').map(propChoices)
    expect(calm.some(c => c.gulls === 'flying')).toBe(true)
    expect(calm.every(c => c.gulls !== 'resting')).toBe(true)
  })

  it('has no migratory flocks at night', () => {
    for (const p of scenes({ timeOfDay: 'night', eclipse: null }, 30)) expect(propChoices(p).migratory).toBeNull()
  })
})
