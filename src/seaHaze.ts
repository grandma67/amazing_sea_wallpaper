// Sea haze: the aerosol near the sea that sets how far you can see.
//
// The Bruneton sky's own aerosol gives ~220 km visibility; damp sea air is
// 15–60 km. So distant clouds (40–130 km off, piled into one band on the sea
// line), islands and the sea's edge stayed sharp. takram's clouds pass has a
// ground haze term, but it is switched off on clear days (scaled by coverage)
// and coloured by the ground irradiance (a dim grey at sunrise). Here it gets a
// density from the visibility (Koschmieder: extinction = 3.912 / V) and the
// colour a long path through haze converges to: the sky behind it. Clear days
// have no clouds pass, so no haze either.
//
// How far you see over the sea (WMO: good 10–20 km, very good 20–50 km,
// excellent > 50 km) depends on the air: cleanest in polar air, hazier in
// humid tropical air and the Mediterranean summer, dusty off deserts; sea salt
// from breaking waves rises with the wind; showers wash the air clean.
import { Uniform } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import type { Biome } from './biome'
import type { OceanName } from './oceans'
import type { SceneParams, WeatherParams } from './params'
import type { Random } from './random'
import { monthInSeason } from './seasons'

/** Extinction of the Bruneton sky's own air at sea level (1/m, ~550 nm). */
const SKY_EXTINCTION = 1.8e-5

/** Visibility range (km), drawn log-uniform, by biome; polar oceans override. */
const VISIBILITY: Record<Biome['name'], [number, number]> = {
  nordic: [40, 80],
  volcanic: [35, 70],
  tropical: [35, 65],
  mediterranean: [35, 70],
  desert: [12, 35]
}
const POLAR: Partial<Record<OceanName, [number, number]>> = {
  arctic: [45, 90],
  southern: [40, 80]
}
/** Hazy Mediterranean-climate summer. */
const MEDITERRANEAN_SUMMER: [number, number] = [25, 50]
/** Dust: Saharan episodes over the Mediterranean in spring and autumn, any
 * month off the deserts. */
const DUST: [number, number] = [8, 20]
const DUST_CHANCE = { mediterranean: 0.12, desert: 0.15 }
export const MIN_VISIBILITY_KM = 5
export const MAX_VISIBILITY_KM = 100

/** How far one sees through the haze today (km). Always draws the same
 * numbers, so forcing it changes nothing else. */
export function visibilityFor(params: SceneParams, rng: Random, force?: number): number {
  const month = Number(params.date.slice(5, 7))
  const biome = params.biome.name
  const [t, dust] = [rng.float(), rng.float()]
  let range = POLAR[params.sea.ocean] ?? VISIBILITY[biome]
  // Summer is Jun–Sep north of the equator, Dec–Mar south of it.
  const summer = monthInSeason(params, 6, 9)
  if (biome === 'mediterranean' && summer) range = MEDITERRANEAN_SUMMER
  // Arctic haze: pollution trapped under the polar winter's inversion, worst
  // in spring.
  if (params.sea.ocean === 'arctic' && month >= 3 && month <= 5) range = [range[0] * 0.7, range[1] * 0.75]
  const dustSeason = biome === 'desert' || (biome === 'mediterranean' && (month <= 5 || month >= 10))
  if (dustSeason && dust < DUST_CHANCE[biome as keyof typeof DUST_CHANCE]) range = DUST
  let km = range[0] * (range[1] / range[0]) ** t
  // Sea salt off breaking waves in strong winds.
  const wind = params.ocean.windSpeed
  if (wind > 10) km *= Math.max(0.6, 1 - (wind - 10) * 0.03)
  // Damp air under a grey sky, rain under storms; showers wash it clean.
  const weather: Partial<Record<SceneParams['weather']['kind'], number>> = { broken: 0.9, overcast: 0.75, storm: 0.6 }
  km *= weather[params.weather.kind] ?? 1
  if (params.rainbow != null) km *= 1.25
  km = Math.min(MAX_VISIBILITY_KM, Math.max(MIN_VISIBILITY_KM, km))
  return force ?? km
}

const MODULATION = 'float modulation = remapClamped(coverage, 0.2, 0.4);'
const INSCATTER = `  vec3 skyIrradiance = vGroundIrradiance.sky;
  vec3 sunIrradiance = vGroundIrradiance.sun;
  vec3 inscatter = sunIrradiance * phaseFunction(cosTheta) * shadowTransmittance;
  inscatter += skyIrradiance * RECIPROCAL_PI4 * skyLightScale * transmittance;
  inscatter *= hazeScatteringCoefficient / (hazeAbsorptionCoefficient + hazeScatteringCoefficient);`
const HORIZON_INSCATTER = `  // A long path through haze takes the colour of the sky behind it: what's
  // far away fades into the sky. Rays at or below the horizon take the sky
  // just above it in their azimuth (Bruneton's tables are unstable right at
  // the horizon). Dimmed by the light the cloud cover lets through.
  vec3 up = normalize(rayOrigin);
  float sinElevation = dot(rayDirection, up);
  vec3 hazeDirection = rayDirection;
  if (sinElevation < 0.02) {
    vec3 level = normalize(rayDirection - sinElevation * up);
    hazeDirection = level * sqrt(1.0 - 0.02 * 0.02) + up * 0.02;
  }
  vec3 skyTransmittance;
  vec3 inscatter = GetSkyRadiance(
    rayOrigin * METER_TO_LENGTH_UNIT,
    hazeDirection,
    0.0,
    sunDirection,
    skyTransmittance
  ) * hazeLight * transmittance;`

/** Light reaching the haze under today's clouds, as a fraction of the clear
 * sky's: the sun where it gets through, else the grey sky, which is dim under
 * an overcast and dark under a storm's deck. */
export function hazeLight(weather: Pick<WeatherParams, 'kind' | 'sunVisibility'>): number {
  const diffuse = weather.kind === 'storm' ? 0.06 : weather.kind === 'overcast' ? 0.3 : 0.35
  return diffuse + (1 - diffuse) * weather.sunVisibility
}

/** Give the clouds pass sea haze of the given visibility (m). */
export function applySeaHaze(clouds: CloudsEffect, visibilityM: number, weather: WeatherParams): void {
  const material = clouds.cloudsPass.currentMaterial
  const source = material.fragmentShader
  if (!source.includes(MODULATION) || !source.includes(INSCATTER)) {
    throw new Error('applySeaHaze: the clouds shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace(MODULATION, 'float modulation = 1.0;')
    .replace(INSCATTER, HORIZON_INSCATTER)
    .replace('vec4 approximateHaze(', 'uniform float hazeLight;\nvec4 approximateHaze(')
  material.uniforms.hazeLight = new Uniform(hazeLight(weather))
  material.needsUpdate = true
  clouds.haze = true
  clouds.clouds.hazeDensityScale = Math.max(3.912 / visibilityM - SKY_EXTINCTION, 0)
}
