import { describe, expect, it } from 'vitest'

import { cloudSkylightRatio } from '../src/skylight'

describe('cloudSkylightRatio', () => {
  it('leaves the light alone when the clouds add nothing', () => {
    expect(cloudSkylightRatio([0.05, 0.1, 0.2], [0.05, 0.1, 0.2])).toEqual([1, 1, 1])
  })

  it('gains most in red: clouds scatter white light into a blue sky', () => {
    const [r, g, b] = cloudSkylightRatio([0.05, 0.1, 0.2], [0.15, 0.2, 0.2])
    expect(r).toBeCloseTo(3)
    expect(g).toBeCloseTo(2)
    expect(b).toBeCloseTo(1)
  })

  it('can darken: a thick deck sends down less than the clear sky', () => {
    expect(cloudSkylightRatio([0.2, 0.2, 0.2], [0.1, 0.1, 0.1])[0]).toBeCloseTo(0.5)
  })

  it('changes nothing without a clear reading to compare', () => {
    expect(cloudSkylightRatio([0, 0, 0], [0.1, 0.1, 0.1])).toEqual([1, 1, 1])
    expect(cloudSkylightRatio([0.1, Number.NaN, 0.1], [0.1, 0.1, 0.1])).toEqual([1, 1, 1])
  })
})
