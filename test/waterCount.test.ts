import { describe, expect, it } from 'vitest'

import { tallyWater, WATER_KINDS } from '../src/waterCount'

/** A target of w × h pixels, rows bottom-up: [kind name | null, metres, mirror]. */
function target(rows: ([string, number, number] | null)[][]): { values: Float32Array; w: number; h: number } {
  const h = rows.length
  const w = rows[0].length
  const values = new Float32Array(w * h * 4)
  rows.forEach((row, r) =>
    row.forEach((px, c) => {
      if (px == null) return
      const i = (r * w + c) * 4
      values.set([WATER_KINDS.indexOf(px[0] as never) + 1, px[1], px[2], 1], i)
    })
  )
  return { values, w, h }
}

describe('tallyWater', () => {
  it('shares each kind of the whole frame; sky and props (alpha 0) count as none', () => {
    const { values, w, h } = target([
      [['seabed', 30, 0], ['swash', 20, 0.5], ['damp', 12, 0.2], ['dry', 5, 0]],
      [['pool', 40, 0.9], ['pool', 9, 0.7], null, null]
    ])
    const t = tallyWater(values, w, h)
    expect(t.size).toEqual([4, 2])
    expect(t.share).toEqual({ dry: 0.125, damp: 0.125, wetRock: 0, swash: 0.125, pool: 0.25, seabed: 0.125 })
    expect(t.poolWithin15m).toBe(0.125)
    expect(t.poolMirror).toBe(0.8)
  })

  it('finds the nearest pixel of each film, in image fractions with y down', () => {
    const { values, w, h } = target([
      [['pool', 40, 1], ['pool', 9, 1]],
      [['swash', 20, 0], null]
    ])
    const t = tallyWater(values, w, h)
    // Row 0 is the image's bottom row.
    expect(t.nearest.pool).toEqual({ m: 9, at: [0.75, 0.75] })
    expect(t.nearest.swash).toEqual({ m: 20, at: [0.25, 0.25] })
    expect(t.nearest.damp).toBeNull()
    expect(t.nearest.wetRock).toBeNull()
  })

  it('reports no pools as null mirror and zero shares', () => {
    const { values, w, h } = target([[null, ['dry', 3, 0]]])
    const t = tallyWater(values, w, h)
    expect(t.poolMirror).toBeNull()
    expect(t.share.pool).toBe(0)
    expect(t.poolWithin15m).toBe(0)
  })
})
