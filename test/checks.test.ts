import { describe, expect, it } from 'vitest'

import { snapshotWarnings } from '../scripts/checks.mjs'
import { dirFromAzEl } from '../src/params'

// The warnings snapshot.mjs prints after a render: they stop a wasted render
// round only if they fire when they should, and only then.

/** A day with the sun at this bearing from the view and this elevation. */
const day = (off: number, elevation: number, extra: Record<string, unknown> = {}) => ({
  sunDirection: dirFromAzEl(100 + off, elevation),
  camera: { headingDeg: 100 },
  timeOfDay: 'daylight',
  ...extra
})
const FRONT = day(160, 30)

describe('snapshot warnings', () => {
  it('stay quiet on a front-lit render with nothing wrong', () => {
    expect(snapshotWarnings(FRONT)).toEqual([])
  })

  it('pass on every GL message: always a bug here', () => {
    expect(snapshotWarnings(FRONT, [], ['shader failed', 'bad texture'])).toEqual([expect.stringContaining('GL: shader failed'), expect.stringContaining('GL: bad texture')])
  })

  it.each([
    ['low, ahead', 0, 10, true],
    ['just inside the view angle', 59, 10, true],
    ['just outside the view angle', 61, 10, false],
    ['behind the camera', 180, 10, false],
    ['high, ahead', 0, 31, false],
    ['below the horizon, ahead', 0, -3, false]
  ])('warn of a backlit sun: %s', (_, off, elevation, warned) => {
    expect(snapshotWarnings(day(off, elevation)).some(w => w.startsWith('backlit'))).toBe(warned)
  })

  it('are not backlit at night, whatever the sun does', () => {
    expect(snapshotWarnings(day(0, 10, { timeOfDay: 'night' }))).toEqual([])
  })

  it('name a prop asked for that is missing or out of frame', () => {
    const debug = { props: { rocks: { placed: 5, inFrame: 0 }, ships: { placed: 2, inFrame: 1 } } }
    const p = { ...FRONT, debug }
    expect(snapshotWarnings(p, ['birds'])).toEqual([expect.stringContaining('birds: nothing placed')])
    expect(snapshotWarnings(p, ['rocks'])).toEqual([expect.stringContaining('rocks: 5 placed but none in frame')])
    expect(snapshotWarnings(p, ['ships'])).toEqual([])
    // 'all': every kind reported, and only what's out of frame warns.
    expect(snapshotWarnings(p, ['all'])).toEqual([expect.stringContaining('rocks: 5 placed')])
    // Not asked about: not named.
    expect(snapshotWarnings(p)).toEqual([])
  })

  it('name lit objects that do not read the shade', () => {
    const p = { ...FRONT, debug: { shadowCoverage: { rocks: { lit: 4, shaded: 1 }, ships: { lit: 2, shaded: 2 } } } }
    expect(snapshotWarnings(p)).toEqual([expect.stringContaining('rocks: 3 of 4 lit objects')])
  })
})
