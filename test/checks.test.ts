import { describe, expect, it } from 'vitest'

import { brokenFrame, NON_FINITE_CELLS, snapshotWarnings, WHITE_SHARE } from '../scripts/render/checks.mjs'
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

describe('broken frames (never published: snapshot --fail-blank)', () => {
  // The numbers of real renders (tools/RENDER.md "Broken frames"): 2026-11-17 on SwiftShader,
  // and the Mac's render of the same day.
  const good = {
    debug: { cubeSkylight: [0.0192, 0.0113, 0.0146], skyIrradiance: [0.0167, 0.0117, 0.0163], sunIrradiance: [0, 0, 0], cloudSkylight: [1.03, 0.99, 0.96], frameMedian: 0.085, frameNonFinite: 0 }
  }
  const luma = { min: 20, max: 109, mean: 93, white: 0.02 }

  it('pass a real frame', () => {
    expect(brokenFrame(good, luma)).toEqual([])
  })

  it('catch non-finite sky light, NaN in the page and null in a saved JSON', () => {
    for (const bad of [NaN, null, Infinity]) {
      const p = { debug: { ...good.debug, cubeSkylight: [bad, bad, bad] } }
      expect(brokenFrame(p, luma)).toEqual([expect.stringContaining('cubeSkylight is not finite')])
    }
    // cloudSkylight is null (no array) on a clear day: not broken.
    expect(brokenFrame({ debug: { ...good.debug, cloudSkylight: null } }, luma)).toEqual([])
  })

  it('catch a median at the clamp, many NaN cells and a washed-out frame', () => {
    expect(brokenFrame({ debug: { ...good.debug, frameMedian: 40 } }, luma)).toEqual([expect.stringContaining('clipped white')])
    expect(brokenFrame({ debug: { ...good.debug, frameNonFinite: NON_FINITE_CELLS + 1 } }, luma)).toEqual([expect.stringContaining('meter cells')])
    // 2026-11-15's few NaN cells were zeroed harmlessly: still published.
    expect(brokenFrame({ debug: { ...good.debug, frameNonFinite: 4 } }, luma)).toEqual([])
    expect(brokenFrame(good, { ...luma, white: 0.5 })).toEqual([expect.stringContaining('50% of the frame is white')])
    expect(brokenFrame(good, { ...luma, white: WHITE_SHARE - 0.01 })).toEqual([])
  })

  it('need no debug numbers (an old ref) or luma', () => {
    expect(brokenFrame({})).toEqual([])
  })
})
