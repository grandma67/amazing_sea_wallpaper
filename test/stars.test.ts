import { describe, expect, it } from 'vitest'

import { moonlight as phaseLight } from '../src/celestial'
import {
  darkZenithLuminance,
  elongationDeg,
  limitingMagnitude,
  PSF,
  psfWeight,
  RENDER_UNIT,
  renderPerLux,
  starPeak,
  starScale,
  STARLIT_ZENITH,
  SUN_TOA
} from '../src/starLight'
import { allParams } from './days'

// NIGHT_SKY phase 2: stars in the sky's own units.

/** takram's clear-sky zenith luminance (render units) by sun elevation,
 * measured with debug.skyZenith on 2026-08-12 (`timeOfDay` forced). */
const ZENITH: Record<number, number> = {
  15: 1.856e-2,
  0: 2.132e-3,
  [-2]: 7.388e-4,
  [-4]: 1.382e-4,
  [-6]: 1.415e-5,
  [-8]: 6.378e-7,
  [-10]: 7.45e-8
}
/** One pixel at 1080p with a 50° vertical field. */
const PIXEL_SR = ((50 * Math.PI) / 180 / 1080) ** 2

/** The faintest stars in takram's catalogue (BSC5). */
const CATALOGUE_LIMIT = 6.5

describe('star light', () => {
  it("uses takram's units", () => {
    expect(RENDER_UNIT).toBeGreaterThan(75_000)
    expect(RENDER_UNIT).toBeLessThan(76_500)
    // ~133,000 lux above the air.
    expect(SUN_TOA * RENDER_UNIT).toBeGreaterThan(125_000)
    expect(SUN_TOA * RENDER_UNIT).toBeLessThan(140_000)
    // 21.6 mag/arcsec² ≈ 2.5e-4 cd/m².
    expect(darkZenithLuminance()).toBeGreaterThan(2e-4)
    expect(darkZenithLuminance()).toBeLessThan(3e-4)
  })

  it('has a point spread that keeps all the light', () => {
    for (const scale of [1, 2])
      for (const halo of [false, true]) {
        const size = (halo ? PSF.haloSize : PSF.coreSize) * scale
        const r = Math.floor(size / 2)
        let sum = 0
        for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) sum += psfWeight(x, y, scale, halo)
        expect(sum).toBeGreaterThan(0.97)
        expect(sum).toBeLessThan(1.03)
      }
  })

  it('puts a dark sky and a faint star in a photo’s ratio', () => {
    // STARS.md §1: under a 22 mag/arcsec² sky a 6.5-mag star is ~40× a
    // 200″ pixel; at 21.6 with the point spread's peak, 10–40×.
    const scale = starScale('starlit', 0)
    const ratio = starPeak(6.5, scale, ((200 / 3600) * Math.PI / 180) ** 2) / STARLIT_ZENITH
    expect(ratio).toBeGreaterThan(10)
    expect(ratio).toBeLessThan(40)
  })

  it('brings the brightest stars out first as the sun sinks', () => {
    const scale = starScale(null, 0)
    const limit = (sun: number): number => limitingMagnitude(scale, ZENITH[sun], PIXEL_SR)
    const suns = [0, -2, -4, -6, -8, -10]
    for (let i = 1; i < suns.length; i++) expect(limit(suns[i])).toBeGreaterThan(limit(suns[i - 1]))
    // None with the sun on the horizon; Sirius (−1.46) and Vega (0.03) by −6°;
    // 3rd–4th magnitude in nautical twilight; not yet the faint ones.
    expect(limit(0)).toBeLessThan(-1.5)
    expect(limit(-6)).toBeGreaterThan(0.03)
    expect(limit(-6)).toBeLessThan(4)
    expect(limit(-8)).toBeGreaterThan(3)
    // By the end of nautical twilight the whole catalogue could show.
    expect(limit(-10)).toBeGreaterThan(CATALOGUE_LIMIT)
  })

  it('shows fewer stars under a brighter moon', () => {
    // The moon 15° up; its sky is the sun's at 15° in the moon's units.
    const limit = (elongation: number): number => limitingMagnitude(starScale('moonlit', elongation), ZENITH[15], PIXEL_SR)
    const limits = [30, 60, 90, 120, 150, 180].map(limit)
    for (let i = 1; i < limits.length; i++) expect(limits[i]).toBeLessThan(limits[i - 1])
    // The limit follows the moon's light magnitude for magnitude.
    expect(limits[0] - limits[5]).toBeCloseTo(-2.5 * Math.log10(phaseLight(30) / phaseLight(180)), 6)
    // Moonless is ~3 magnitudes deeper than a full moon. A noise-free render
    // reaches past the catalogue (~6.5) on both: the exposure and the
    // display hide the faint ones under a bright moon.
    const dark = limitingMagnitude(starScale('starlit', 0), STARLIT_ZENITH, PIXEL_SR)
    expect(dark - limits[5]).toBeGreaterThan(2.5)
    expect(limits[5]).toBeGreaterThan(CATALOGUE_LIMIT)
  })

  it('scales the moon’s units with its phase', () => {
    expect(renderPerLux('moonlit', 90) / renderPerLux('moonlit', 180)).toBeCloseTo(phaseLight(180) / phaseLight(90), 6)
    for (const p of allParams()) {
      const s = starScale(p.nightSky, elongationDeg(p))
      expect(Number.isFinite(s) && s > 0).toBe(true)
    }
  })
})
