import { moonlight as phaseLight } from './celestial'
import type { SceneParams } from './params'

// Photometric stars (NIGHT_SKY phase 2): a star's light in the sky's own
// units, so the contrast with the sky decides what shows. Twilight, the moon
// and the night's darkness hide faint stars by themselves (STARS.md §1).
//
// Units. takram's Bruneton sky is in luminance divided by the luminance of a
// unit-radiance sun (`sunRadianceToRelativeLuminance`): one render unit is
// ~75,700 cd/m² (radiance) or lux (irradiance). The sky is drawn lit by one
// light at the sun's full strength:
// - by day and in twilight that light is the sun;
// - on moonlit nights it stands in for the moon (graded down afterwards), so
//   the render is the real sky × 1 / (full moon / sun × phase light);
// - on starlit nights it is a fake sun high overhead; its zenith (measured,
//   `STARLIT_ZENITH`) is taken to be a Bortle-2 zenith, 21.6 mag/arcsec².
// A star's irradiance above the air is then `starScale × 10^(−0.4 m)`
// (`starScale` = a magnitude-0 star); the shader dims it by the air's
// transmittance and spreads it over the lens's point spread (`PSF`).

/** takram's constants (`AtmosphereParameters`): solar irradiance and sun
 * radiance-to-luminance (Rec. 709 weights). */
const SOLAR_IRRADIANCE = [1.474, 1.8504, 1.91198]
const SUN_RADIANCE_TO_LUMINANCE = [98242.786222, 69954.398112, 66475.012354]
const LUMA = [0.2126, 0.7152, 0.0722]
/** cd/m² (or lux) per render unit. */
export const RENDER_UNIT = LUMA.reduce((s, w, i) => s + w * SUN_RADIANCE_TO_LUMINANCE[i], 0)
/** The sun's illuminance above the air, render units (~1.75 ≈ 133,000 lux). */
export const SUN_TOA = LUMA.reduce((s, w, i) => s + w * SOLAR_IRRADIANCE[i] * SUN_RADIANCE_TO_LUMINANCE[i], 0) / RENDER_UNIT

/** Apparent magnitudes: the sun, and the full moon at mean distance. */
export const SUN_MAG = -26.74
export const FULL_MOON_MAG = -12.74
/** One square arcsecond in steradians. */
export const ARCSEC2_SR = (Math.PI / (180 * 3600)) ** 2
/** A Bortle-2 zenith (STARS.md §1): the moonless sky we calibrate on. */
export const DARK_ZENITH_MAG = 21.6
/** Rendered zenith luminance of the starlit night's sky (the fake sun at
 * `STARLIT_LIGHT`), measured with `debug.skyZenith` (2026-11-03). */
export const STARLIT_ZENITH = 0.0653
/** Light on the ground on a clear moonless night: airglow and starlight
 * (STARS.md §1, "Light on the ground"). */
export const STARLIT_LUX = 0.002

/** Render units per real lux (or cd/m²) of the sky as drawn. */
export function renderPerLux(night: 'moonlit' | 'starlit' | null, elongationDeg: number): number {
  if (night === 'starlit') return STARLIT_ZENITH / darkZenithLuminance()
  // The light drawn at the sun's strength is really the sun, or the moon.
  const light = night === 'moonlit' ? 10 ** (-0.4 * (FULL_MOON_MAG - SUN_MAG)) * phaseLight(elongationDeg) : 1
  return 1 / (light * RENDER_UNIT)
}

/** Angle between the sun and the moon (degrees). */
export function elongationDeg(p: Pick<SceneParams, 'sunDirection' | 'moonDirection'>): number {
  const [a, b] = [p.sunDirection, p.moonDirection]
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / (Math.PI / 180)
}

/** The Bortle-2 zenith in cd/m². */
export function darkZenithLuminance(): number {
  // A source of magnitude m gives SUN_TOA·10^(−0.4 (m − SUN_MAG)) render
  // units of irradiance; per arcsec² that is surface brightness.
  return (SUN_TOA * RENDER_UNIT * 10 ** (-0.4 * (DARK_ZENITH_MAG - SUN_MAG))) / ARCSEC2_SR
}

/** Irradiance of a magnitude-0 star above the air, in render units, for the
 * sky as drawn: `night` is `params.nightSky` (null by day and in twilight). */
export function starScale(night: 'moonlit' | 'starlit' | null, elongationDeg: number): number {
  return SUN_TOA * RENDER_UNIT * 10 ** (0.4 * SUN_MAG) * renderPerLux(night, elongationDeg)
}

/** The lens's point spread, in pixels at 1080p (scaled with the image): a
 * Gaussian core (FWHM ~1.4 px) and, for bright stars, a faint wide halo.
 * Brightness then reads as size the way it does in a photo: a faint star
 * shows only the core's peak pixel, a bright one saturates its neighbours
 * and lights the halo (bloom does the rest). */
export const PSF = {
  coreSigma: 0.6,
  haloSigma: 2,
  /** Share of the light in the halo (stars brighter than `haloMag`). */
  haloShare: 0.04,
  haloMag: 2.5,
  /** Sprite sizes (px): enough for 2.5σ of the core, 3σ of the halo. */
  coreSize: 5,
  haloSize: 13
}

/** Share of a star's light falling in a pixel `dx`, `dy` pixels from its
 * centre (`scale` = image height / 1080). Mirrors `starPsf` in stars.ts. */
export function psfWeight(dx: number, dy: number, scale: number, halo: boolean): number {
  const r2 = dx * dx + dy * dy
  const gauss = (sigma: number): number => Math.exp(-r2 / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma)
  const h = halo ? PSF.haloShare : 0
  return (1 - h) * gauss(PSF.coreSigma * scale) + h * gauss(PSF.haloSigma * scale)
}

/** Peak pixel radiance (render units) of a magnitude-`m` star centred on a
 * pixel of `pixelSr` steradians, above the air. */
export function starPeak(m: number, scale: number, pixelSr: number, imageScale = 1): number {
  return (scale * 10 ** (-0.4 * m) * psfWeight(0, 0, imageScale, m < PSF.haloMag)) / pixelSr
}

/** A star shows when its peak pixel adds this share to the sky's. */
export const STAR_CONTRAST = 0.1

/** Faintest magnitude that shows against a sky of `skyRadiance` (render
 * units), before the air's extinction. */
export function limitingMagnitude(scale: number, skyRadiance: number, pixelSr: number): number {
  const peak = psfWeight(0, 0, 1, false)
  return -2.5 * Math.log10((STAR_CONTRAST * skyRadiance * pixelSr) / (scale * peak))
}
