import { Matrix4, Uniform, Vector2, Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { SAMPLE_END } from './stormCells'

// How the cloud cells are arranged (WMO varieties):
// - radiatus (cloud streets): cumulus or stratocumulus in rows along the
//   wind, running to a vanishing point. Common in the trades and in cold air
//   over warm sea. The cells stay as they are (round, lumpy cumulus); the main
//   layer's weather is thinned between rows across the wind (`streetRows`).
//   Stretching the map instead (as before 0.192) drew each cumulus as a
//   brushed streak along the wind.
// - undulatus (wave bands): ripples across the wind in altocumulus,
//   cirrocumulus and stratocumulus, the "mackerel sky": the weather map is
//   stretched across the wind (its billows are long elements).
// The weather map is sampled at a point on a cube-sphere (getGlobeUv), so a
// direction on the ground is some direction in the map's uv; the bands patch
// replaces the map's uv by an affine transform of it that squeezes it across
// the wind, centred on the scene.

export type CloudArrangement = 'streets' | 'bands'

/** takram's getCubeSphereUv, on the CPU, in the stable form (see
 * stabiliseCubeSphereUv). */
export function cubeSphereUv(position: Vector3): Vector2 {
  const n = position.clone().normalize()
  const f = new Vector3(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))
  const max = Math.max(f.x, f.y, f.z)
  const c = n.clone().divideScalar(max)
  let m: [number, number]
  if (f.y > f.x && f.y > f.z) m = c.y > 0 ? [-n.x, n.z] : [n.x, n.z]
  else if (f.x > f.y && f.x > f.z) m = c.x > 0 ? [n.y, n.z] : [-n.y, n.z]
  else m = c.z > 0 ? [n.x, n.y] : [n.x, -n.y]
  const [mx2, my2] = [m[0] * m[0], m[1] * m[1]]
  const a = 1.5 + mx2 - my2
  const ux = Math.sqrt((6 * mx2) / (a + Math.sqrt(Math.max(0, a * a - 6 * mx2)))) * (m[0] > 0 ? 1 : -1)
  const uy = Math.sqrt(6 / (3 - ux * ux)) * m[1]
  return new Vector2(ux * 0.5 + 0.5, uy * 0.5 + 0.5)
}

/** How much the cells stretch for bands: across the wind (and more cells
 * along the band). */
export const BANDS_STRETCH = { along: 1.6, across: 1 / 3 }

/** The weather map's coordinate change per metre along the wind (`d`) and
 * across it (`c`) at the scene, and the scene's own coordinate. */
function mapSteps(worldToECEF: Matrix4, windWorld: Vector3, repeat: Vector2): { d: Vector2; c: Vector2; origin: Vector2 } {
  const origin = new Vector3().applyMatrix4(worldToECEF)
  const toMap = (direction: Vector3): Vector2 => {
    const step = 1000
    const p = origin.clone().add(direction.clone().transformDirection(worldToECEF).multiplyScalar(step))
    return cubeSphereUv(p).sub(cubeSphereUv(origin)).multiply(repeat).divideScalar(step)
  }
  const along = windWorld.clone().setY(0).normalize()
  const across = new Vector3(0, 1, 0).cross(along).normalize()
  return { d: toMap(along), c: toMap(across), origin: cubeSphereUv(origin).multiply(repeat) }
}

/**
 * The 2×2 matrix (column-major) that, applied to the weather map's
 * coordinate round the scene, scales a step along `windWorld` by `along` and
 * one across it by `across`. Solved in the map's own (not quite orthogonal)
 * axes, so the stretch follows the wind exactly.
 */
export function arrangementMatrix(
  worldToECEF: Matrix4,
  windWorld: Vector3,
  repeat: Vector2,
  stretch: { along: number; across: number }
): { matrix: Vector4; origin: Vector2 } {
  const { d, c, origin } = mapSteps(worldToECEF, windWorld, repeat)
  // A·[d c] = [d·along c·across]  →  A = [d·along c·across]·[d c]⁻¹
  const det = d.x * c.y - c.x * d.y
  const inv = [c.y / det, -d.y / det, -c.x / det, d.x / det] // column-major [a b; c d]⁻¹
  const t = [d.x * stretch.along, d.y * stretch.along, c.x * stretch.across, c.y * stretch.across]
  const mul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3]
  ]
  const m = mul(t, inv)
  return { matrix: new Vector4(m[0], m[1], m[2], m[3]), origin }
}

/**
 * Cloud streets' spacing over the convective layer's depth (the main layer's
 * top above the sea). Rolls over the sea are 2–4 times as far apart as the
 * layer is deep (Etling & Brown 1993, via Wikipedia "Horizontal convective
 * rolls"; ~3 in Chlond 1987's model): ~3 km for trade-wind humilis (top
 * 1050 m), ~5 km for mediocris (1600 m).
 */
export const STREET_ASPECT = 3
/** The main layer's weather between rows (×GAP) and along a row's middle
 * (×PEAK). Their mean is 1, so the rows carry the cloud the gaps lose: at
 * 0.3 / 1.25 a 'few' sky over a gap came out nearly empty (2024-07-04). */
export const STREET_GAP = 0.45
export const STREET_PEAK = 1.55
/** Rows wander sideways by this share of their spacing, over WANDER_LENGTH
 * spacings along the wind: straight rows ruled across the sky look drawn. */
export const STREET_WANDER = 0.15
export const STREET_WANDER_LENGTH = 6

export interface StreetRows {
  /** Metres between rows, across the wind. */
  spacingM: number
  /** Phase of the rows' sideways wander (radians). */
  phase: number
}

/** The rows for a main layer whose top stands `topM` above the sea; `phase`
 * from the day's weather offset (no new random draws). */
export function streetRowsFor(topM: number, weatherOffset: [number, number]): StreetRows {
  return { spacingM: STREET_ASPECT * topM, phase: 2 * Math.PI * weatherOffset[0] }
}

/** The weather factor at a point `alongM`, `acrossM` metres from the scene
 * along and across the wind: STREET_PEAK on a row, STREET_GAP between.
 * Mirrors `cloudStreet` in the GLSL. */
export function streetFactor(rows: StreetRows, alongM: number, acrossM: number): number {
  const wander = STREET_WANDER * rows.spacingM * Math.sin((2 * Math.PI * alongM) / (STREET_WANDER_LENGTH * rows.spacingM) + rows.phase)
  const r = 0.5 + 0.5 * Math.cos((2 * Math.PI * (acrossM + wander)) / rows.spacingM)
  const t = r * r * (3 - 2 * r)
  return STREET_GAP + (STREET_PEAK - STREET_GAP) * t
}

/** The weather-map coordinate → metres along and across the wind (rows of a
 * 2×2, column-major for GLSL's mat2) about the scene's map coordinate. */
export function streetFrame(worldToECEF: Matrix4, windWorld: Vector3, repeat: Vector2): { toMetres: Vector4; origin: Vector2 } {
  const { d, c, origin } = mapSteps(worldToECEF, windWorld, repeat)
  // [along, across] = [d c]⁻¹ (t − origin)
  const det = d.x * c.y - c.x * d.y
  return { toMetres: new Vector4(c.y / det, -d.y / det, -c.x / det, d.x / det), origin }
}

/**
 * The shift of takram's weather map (localWeatherOffset) and shape noise
 * (shapeOffset) that moves the clouds `metres` along `windWorld` round the
 * scene: a long exposure draws each accumulated frame a little further on.
 */
export function cloudDrift(
  worldToECEF: Matrix4,
  windWorld: Vector3,
  weatherRepeat: Vector2,
  shapeRepeat: Vector3,
  metres: number
): { weather: Vector2; shape: Vector3 } {
  const origin = new Vector3().applyMatrix4(worldToECEF)
  const step = 1000
  const along = windWorld.clone().setY(0).normalize().transformDirection(worldToECEF)
  const perMetre = cubeSphereUv(origin.clone().addScaledVector(along, step)).sub(cubeSphereUv(origin)).multiply(weatherRepeat).divideScalar(step)
  // Sampling at p shows what was at p − d.
  return { weather: perMetre.multiplyScalar(-metres), shape: along.clone().multiply(shapeRepeat).multiplyScalar(-metres) }
}

// takram's cube-sphere uv takes u = sqrt(a - sqrt(D)/2) with a = 1.5 + mx² -
// my² and D/4 = a² - 6mx²: two numbers near 1.5 that cancel when mx -> 0. In
// float32 u is then only good to ~sqrt(eps) = 3e-4, ×100 repeat = ~16 weather
// texels of noise. Our scenes sit at longitude 0, where mx = 0 runs north-south
// right over the camera, so clouds on that line came out as streaks toward the
// vanishing point. a - sqrt(a² - 6mx²) = 6mx² / (a + sqrt(a² - 6mx²)) is the
// same value, without the cancellation.
const CUBE_SPHERE_U = 'uv.x = sqrt(1.5 + m2.x - m2.y - 0.5 * sqrt(-24.0 * m2.x + q2)) * (m.x > 0.0 ? 1.0 : -1.0);'
const STABLE_CUBE_SPHERE_U = `float a = 1.5 + m2.x - m2.y;
  uv.x = sqrt(6.0 * m2.x / (a + 0.5 * sqrt(-24.0 * m2.x + q2))) * (m.x > 0.0 ? 1.0 : -1.0);`

/** Patch the clouds' and their shadows' shaders to compute the weather map's
 * uv without float cancellation along the scene's meridian. */
export function stabiliseCubeSphereUv(clouds: CloudsEffect): void {
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(CUBE_SPHERE_U).length !== 2) {
      throw new Error('stabiliseCubeSphereUv: the clouds shader has changed; update the patch')
    }
    material.fragmentShader = source.replace(CUBE_SPHERE_U, STABLE_CUBE_SPHERE_U)
    material.needsUpdate = true
  }
}

const SAMPLE = 'uv * localWeatherRepeat + localWeatherOffset,'
const PATCHED = `arrangeWeather(uv * localWeatherRepeat) + localWeatherOffset,`
const GLSL = /* glsl */ `
uniform vec4 weatherArrangement;
uniform vec2 weatherArrangementOrigin;
vec2 arrangeWeather(const vec2 t) {
  return weatherArrangementOrigin + mat2(weatherArrangement.xy, weatherArrangement.zw) * (t - weatherArrangementOrigin);
}
`

const STREET_GLSL = /* glsl */ `
uniform vec4 streetToMetres;
uniform vec2 streetOrigin;
uniform vec2 streetRows; // spacing (m), wander phase
float cloudStreet(const vec2 t) {
  vec2 m = mat2(streetToMetres.xy, streetToMetres.zw) * (t - streetOrigin);
  float wander = ${STREET_WANDER.toFixed(3)} * streetRows.x *
    sin(6.283185 * m.x / (${STREET_WANDER_LENGTH.toFixed(1)} * streetRows.x) + streetRows.y);
  float r = 0.5 + 0.5 * cos(6.283185 * (m.y + wander) / streetRows.x);
  return mix(${STREET_GAP.toFixed(3)}, ${STREET_PEAK.toFixed(3)}, smoothstep(0.0, 1.0, r));
}
`

/** Patch the clouds' and their shadows' shaders: the main layer (layer 0)'s
 * weather thinned between rows along the wind. The rows stay put while a long
 * exposure drifts the cells (`cloudDrift`): they drift along the rows. */
function patchStreets(clouds: CloudsEffect, worldToECEF: Matrix4, windWorld: Vector3, rows: StreetRows): void {
  const { toMetres, origin } = streetFrame(worldToECEF, windWorld, clouds.localWeatherRepeat)
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(SAMPLE_END).length !== 2) throw new Error('arrangeClouds: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replace('WeatherSample sampleWeather(', `${STREET_GLSL}\nWeatherSample sampleWeather(`)
      .replace(SAMPLE_END, `${SAMPLE_END}  localWeather.x = min(1.0, localWeather.x * cloudStreet(uv * localWeatherRepeat));\n`)
    material.uniforms.streetToMetres = new Uniform(toMetres)
    material.uniforms.streetOrigin = new Uniform(origin)
    material.uniforms.streetRows = new Uniform(new Vector2(rows.spacingM, rows.phase))
    material.needsUpdate = true
  }
}

/** Patch the clouds' and their shadows' shaders to arrange the main layer
 * into streets (`rows`) or the weather map into bands. */
export function arrangeClouds(
  clouds: CloudsEffect,
  worldToECEF: Matrix4,
  windWorld: Vector3,
  arrangement: CloudArrangement,
  rows: StreetRows
): void {
  if (arrangement === 'streets') {
    patchStreets(clouds, worldToECEF, windWorld, rows)
    return
  }
  const { matrix, origin } = arrangementMatrix(worldToECEF, windWorld, clouds.localWeatherRepeat, BANDS_STRETCH)
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (!source.includes(SAMPLE)) throw new Error('arrangeClouds: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replace('WeatherSample sampleWeather(', `${GLSL}\nWeatherSample sampleWeather(`)
      .replace(SAMPLE, PATCHED)
    material.uniforms.weatherArrangement = new Uniform(matrix)
    material.uniforms.weatherArrangementOrigin = new Uniform(origin)
    material.needsUpdate = true
  }
}
