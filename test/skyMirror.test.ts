import { describe, expect, it } from 'vitest'

import { airglowPattern, MILKY_WAY_LOG2, nightSkyCd } from '../src/nightGlow'
import { dirFromAzEl } from '../src/skyFrame'
import { airTransmittance, hashCell, lineDirections, lineStats, mirrorLine, pcg, seedInt } from '../src/skyMirror'
import { darkZenithLuminance } from '../src/starLight'
import { DARK, scene } from './days'
import { milkyWayMap } from './milkyWayMap.mjs'

// The CPU mirrors' tools (skyMirror.ts) and the night glow's mirror. Their
// match with the GPU is checked by rendering: `params.debug.probeLine` on
// the same line as `params.mjs --line` (tools/DEBUG.md); at the time of
// writing the airglow and the aurora agreed within 1–3% in mean and shape.

const STEP = 0.05
const line = (f: (el: number) => number, from = 6, to = 30): number[] => Array.from({ length: Math.round((to - from) / STEP) + 1 }, (_, i) => f(from + i * STEP))

describe('line stats', () => {
  it('finds bands and their period', () => {
    const v = line(el => 1e-3 * (1 + 0.5 * Math.exp(-(((el - 12) / 3) ** 2))) * (1 + 0.02 * Math.sin((2 * Math.PI * el) / 0.6)))
    const s = lineStats(v, STEP)
    expect(s.periodDeg).not.toBeNull()
    expect(s.periodDeg!).toBeCloseTo(0.6, 1)
    expect(s.ripple).toBeGreaterThan(0.01)
    expect(s.summary).toMatch(/^bands every 0\.6/)
  })

  it('calls an arc, an edge or a gradient smooth', () => {
    const arc = line(el => 1e-3 * (1 + 2 * Math.exp(-(((el - 12) / 1.5) ** 2))))
    const edge = line(el => 1e-3 * (el < 10 ? 1 : 2))
    const sky = line(el => 1e-3 / Math.sin((el * Math.PI) / 180))
    for (const v of [arc, edge, sky]) expect(lineStats(v, STEP).periodDeg).toBeNull()
  })

  it('tells grain from bands and leaves stars out', () => {
    let seed = 1
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const grain = line(() => 1e-3 * (1 + 0.02 * (rand() - 0.5)))
    const g = lineStats(grain, STEP)
    expect(g.periodDeg).toBeNull()
    expect(g.ripple).toBeGreaterThan(0.003)
    const stars = line((el: number) => 1e-3 * (1 + 0.02 * Math.sin((2 * Math.PI * el) / 0.8)))
    for (const i of [40, 170, 300]) stars[i] *= 8
    const s = lineStats(stars, STEP)
    expect(s.spikes).toBe(3)
    expect(s.periodDeg!).toBeCloseTo(0.8, 1)
  })

  it('samples a line from the view and averages over layer offsets', () => {
    const p = scene({ ...DARK, place: 'scotland' }, '2026-02-18')
    const pts = lineDirections(p, { az: 10, el: [5, 6], step: 0.5 })
    expect(pts.map(q => q.el)).toEqual([5, 5.5, 6])
    expect(() => lineDirections(p, { az: [0, 1], el: [0, 1] })).toThrow()
    const m = mirrorLine(p, { az: [0, 2], el: 10, step: 1 }, (_, j) => 1 + j, 4)
    expect(m.points[0].value).toBeCloseTo(1.5, 9)
    expect(m.grain).toBeCloseTo(0.5, 9)
  })
})

describe('mirror tools', () => {
  it('hashes integer cells the same every time, evenly', () => {
    // PCG on a known input (the reference implementation's arithmetic).
    expect(pcg(0)).toBe(pcg(0))
    expect(pcg(1)).not.toBe(pcg(2))
    let sum = 0
    for (let x = -200; x < 200; x++) for (let y = -5; y < 5; y++) sum += hashCell(seedInt(42.5), x, y)
    expect(sum / 4000).toBeGreaterThan(0.47)
    expect(sum / 4000).toBeLessThan(0.53)
    for (const x of [-3, 0, 7]) {
      const h = hashCell(seedInt(1), x)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(1)
    }
    // Seeds are exact in a float32 uniform.
    expect(seedInt(99.9999)).toBeLessThan(2 ** 24)
  })

  it('dims the sky through the air as takram does: bluer loses more, low more', () => {
    const zenith = airTransmittance(90)
    expect(zenith[1]).toBeGreaterThan(0.85)
    expect(zenith[1]).toBeLessThan(0.92)
    expect(zenith[2]).toBeLessThan(zenith[1])
    expect(zenith[1]).toBeLessThan(zenith[0])
    const low = airTransmittance(5)
    expect(low[1]).toBeLessThan(0.5)
    expect(airTransmittance(10)[1]).toBeGreaterThan(low[1])
  })
})

describe('night glow mirror', () => {
  const milkyWay = milkyWayMap(MILKY_WAY_LOG2)

  it('draws a dark-site sky near its zenith calibration, brighter low down', () => {
    const p = scene({ ...DARK, place: 'scotland', milkyWay: false }, '2026-02-18')
    const zenith = nightSkyCd(p, [0, 1, 0])
    // Bortle 2, solar maximum: ~21–22 mag/arcsec² (the dark zenith is 21.6).
    const mag = 21.6 - 2.5 * Math.log10(zenith / darkZenithLuminance())
    expect(mag).toBeGreaterThan(20.8)
    expect(mag).toBeLessThan(22.2)
    const low = nightSkyCd(p, dirFromAzEl(p.camera.headingDeg, 10))
    expect(low / zenith).toBeGreaterThan(1.5)
    expect(low / zenith).toBeLessThan(4)
    // The Milky Way adds where it is.
    expect(nightSkyCd({ ...p, nightGlow: { ...p.nightGlow!, milkyWay: true } }, [0, 1, 0], milkyWay)).toBeGreaterThanOrEqual(zenith)
  })

  it('shows the airglow bands edge-on, in their patches', () => {
    const p = scene({ ...DARK, place: 'scotland' }, '2026-02-18')
    const g = { ...p.nightGlow!, bands: { ...p.nightGlow!.bands, strength: 0.2 } }
    const low = airglowPattern(g, dirFromAzEl(0, 8))
    expect(low.edgeOn).toBe(1)
    expect(airglowPattern(g, [0, 1, 0]).edgeOn).toBe(0)
    // Crests repeat every 2π·4.5 km across the band direction on the layer.
    expect(Math.abs(low.crests)).toBeLessThanOrEqual(1)
    const off = airglowPattern({ ...g, bands: { ...g.bands, strength: 0 } }, dirFromAzEl(0, 8))
    expect(off.pattern).toBe(1)
  })
})
