import { DataTexture, DataUtils, HalfFloatType, LinearFilter, Matrix3, RedFormat, Uniform, Vector2, Vector3, Vector4, type Texture } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import type { SceneParams } from './params'
import { placeNamed } from './places'
import type { Random } from './random'
import { darkZenithLuminance, DARK_ZENITH_MAG, renderPerLux } from './starLight'

// The night sky's own light (NIGHT_SKY phase 3, STARS.md §3, §6, §7, §9):
// the Milky Way, airglow, zodiacal light and light pollution, as terms in
// takram's sky shader in the sky's units, on the main sky and the reflection
// cube (they are smooth, so its 256² faces hold them; the sea reflects them).
//
// Everything is worked in S10 (one 10th-magnitude star per square degree,
// 27.78 mag/arcsec²) and turned into render units by `glowScale`. On a
// starlit night the glow is the sky: it replaces the Bruneton stand-in. In
// twilight and under the moon it is added to the scattered light, which
// hides it by itself (a full-moon sky is ~18 mag/arcsec²).
//
// - Milky Way: NASA SVS Deep Star Maps 2020 (Gaia DR2, Hipparcos, Tycho-2)
//   without the stars we draw as points, calibrated on Masana et al. 2021
//   (scripts/milkyway.mjs): the Sagittarius star cloud ~1,050 S10, the
//   galactic poles ~6–9.
// - Airglow: green 557.7 nm and continuum from a shell at ~95 km, red
//   630 nm at ~250 km, brighter toward the horizon (van Rhijn) until the air
//   absorbs it; 145 S10 at the zenith at solar minimum, ~270 at maximum
//   (Wikipedia "Sky brightness"). Faint gravity-wave bands.
// - Zodiacal light: Leinert et al. 1998 Table 17 (S10, by helio-ecliptic
//   longitude from the sun and ecliptic latitude), gegenschein included.
// - Light pollution: the place's Bortle class; from class 3 a warm dome low
//   over the land.
// All are dimmed by the air's transmittance; the light they put into the air
// comes back as in-scatter, (1 − T) × the sky's mean.

/** Bortle class of the night sky. */
export type Bortle = 1 | 2 | 3 | 4

export interface NightGlowParams {
  bortle: Bortle
  /** Zenith airglow (S10). */
  airglowS10: number
  /** Share of it in the red 630 nm line (high layer). */
  redShare: number
  /** Gravity-wave bands in the green layer. */
  bands: { strength: number; headingDeg: number; seed: number }
  /** The light dome's azimuth from straight inland (deg) and width (σ, deg). */
  dome: { offsetDeg: number; widthDeg: number }
  milkyWay: boolean
  airglow: boolean
  zodiacal: boolean
}

/** One S10 above the zenith calibration (DARK_ZENITH_MAG): its share. */
export const S10_MAG = 27.78
export function s10Luminance(): number {
  return darkZenithLuminance() * 10 ** (-0.4 * (S10_MAG - DARK_ZENITH_MAG))
}
export function s10ToMag(s10: number): number {
  return S10_MAG - 2.5 * Math.log10(s10)
}

/** Solar activity 0..1 (cycle 25: maximum late 2024, ~11 years). */
export function solarActivity(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`) / (365.25 * 86400e3) + 1970
  return 0.5 + 0.5 * Math.cos((2 * Math.PI * (t - 2024.9)) / 11)
}

/** Airglow at the zenith for the solar cycle (S10), before the night's spread. */
export function airglowZenith(date: string): number {
  return 145 + 125 * solarActivity(date)
}

/** Artificial light at the zenith (S10) and in the dome at the horizon. */
export const ARTIFICIAL: Record<Bortle, { zenith: number; dome: number }> = {
  1: { zenith: 0, dome: 0 },
  2: { zenith: 8, dome: 0 },
  3: { zenith: 50, dome: 350 },
  4: { zenith: 200, dome: 2500 }
}

/** Heights of the airglow layers (km). */
export const GREEN_LAYER_KM = 95
export const RED_LAYER_KM = 250
const EARTH_KM = 6360

/** Van Rhijn: a thin shell `heightKm` up seen at zenith angle z is this many
 * times its zenith brightness. */
export function vanRhijn(cosZenith: number, heightKm: number): number {
  const k = EARTH_KM / (EARTH_KM + heightKm)
  return 1 / Math.sqrt(1 - k * k * (1 - cosZenith * cosZenith))
}

/** Leinert et al. 1998, Table 17 (S10): rows helio-ecliptic longitude from the
 * sun, columns ecliptic latitude. −1 near the sun (not tabulated): filled from
 * the nearest row. */
const ZODI_LONGITUDE = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
const ZODI_LATITUDE = [0, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90]
const ZODI = [
  [-1, -1, -1, 3140, 1610, 985, 640, 275, 150, 100, 77],
  [-1, -1, -1, 2940, 1540, 945, 625, 271, 150, 100, 77],
  [-1, -1, 4740, 2470, 1370, 865, 590, 264, 148, 100, 77],
  [11500, 6780, 3440, 1860, 1110, 755, 525, 251, 146, 100, 77],
  [6400, 4480, 2410, 1410, 910, 635, 454, 237, 141, 99, 77],
  [3840, 2830, 1730, 1100, 749, 545, 410, 223, 136, 97, 77],
  [2480, 1870, 1220, 845, 615, 467, 365, 207, 131, 95, 77],
  [1650, 1270, 910, 680, 510, 397, 320, 193, 125, 93, 77],
  [1180, 940, 700, 530, 416, 338, 282, 179, 120, 92, 77],
  [910, 730, 555, 442, 356, 292, 250, 166, 116, 90, 77],
  [505, 442, 352, 292, 243, 209, 183, 134, 104, 86, 77],
  [338, 317, 269, 227, 196, 172, 151, 116, 93, 82, 77],
  [259, 251, 225, 193, 166, 147, 132, 104, 86, 79, 77],
  [212, 210, 197, 170, 150, 133, 119, 96, 82, 77, 77],
  [188, 186, 177, 154, 138, 125, 113, 90, 77, 74, 77],
  [179, 178, 166, 147, 134, 122, 110, 90, 77, 73, 77],
  [179, 178, 165, 148, 137, 127, 116, 96, 79, 72, 77],
  [196, 192, 179, 165, 151, 141, 131, 104, 82, 72, 77],
  [230, 212, 195, 178, 163, 148, 134, 105, 83, 72, 77]
].map((row, i, rows) =>
  row.map((v, j) => {
    if (v >= 0) return v
    for (let k = i + 1; k < rows.length; k++) if (rows[k][j] >= 0) return rows[k][j]
    return 77
  })
)

/** Zodiacal light (S10) at `dLongitudeDeg` (0–180) from the sun along the
 * ecliptic and `latitudeDeg` from it: bilinear in the table. */
export function zodiacalS10(dLongitudeDeg: number, latitudeDeg: number): number {
  const lon = Math.min(180, Math.abs(((dLongitudeDeg + 540) % 360) - 180))
  const lat = Math.min(90, Math.abs(latitudeDeg))
  const find = (axis: number[], x: number): [number, number] => {
    let i = 0
    while (i < axis.length - 2 && axis[i + 1] < x) i++
    return [i, (x - axis[i]) / (axis[i + 1] - axis[i])]
  }
  const [i, u] = find(ZODI_LONGITUDE, lon)
  const [j, v] = find(ZODI_LATITUDE, lat)
  const a = ZODI[i][j] * (1 - v) + ZODI[i][j + 1] * v
  const b = ZODI[i + 1][j] * (1 - v) + ZODI[i + 1][j + 1] * v
  return a * (1 - u) + b * u
}

/** The table resampled every 5° (37 × 19), for the shader. */
export const ZODI_STEP = 5
function zodiacalTexture(): DataTexture {
  const [w, h] = [90 / ZODI_STEP + 1, 180 / ZODI_STEP + 1]
  const data = new Uint16Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = DataUtils.toHalfFloat(zodiacalS10(y * ZODI_STEP, x * ZODI_STEP))
  const texture = new DataTexture(data, w, h, RedFormat, HalfFloatType)
  texture.minFilter = texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Equatorial J2000 → galactic (Hipparcos), row-major. */
export const EQUATORIAL_TO_GALACTIC = [
  -0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.44482963, 0.7469822445, -0.867666149, -0.1980763734, 0.4559837762
]

/** Galactic longitude and latitude (deg) of a J2000 direction. */
export function galactic(eci: [number, number, number]): { l: number; b: number } {
  const m = EQUATORIAL_TO_GALACTIC
  const g = [0, 1, 2].map(r => m[r * 3] * eci[0] + m[r * 3 + 1] * eci[1] + m[r * 3 + 2] * eci[2])
  const l = ((Math.atan2(g[1], g[0]) * 180) / Math.PI + 360) % 360
  return { l, b: (Math.asin(Math.max(-1, Math.min(1, g[2]))) * 180) / Math.PI }
}

/** How milkyway.png is encoded (scripts/milkyway.mjs): log2 S10 over this
 * range in 8 bits. */
export const MILKY_WAY_LOG2: [number, number] = [-2, 12]

/** Luminance-normalised colours (linear Rec. 709). */
const unit = (c: [number, number, number]): [number, number, number] => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return [c[0] / l, c[1] / l, c[2] / l]
}
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t
]
/** The low airglow layer as a camera records it: a warm continuum (sodium,
 * OH and O₂ bands; brownish in raw daylight-balanced photos, blue-grey at a
 * night white balance) carrying ~75% of the light, and the green oxygen line
 * on top (measured raw: R/G ~0.85, B/G ~0.6; teal-blue at ~4000 K). Then the red oxygen line; the sun (zodiacal light is sunlight,
 * slightly reddened); a sodium-and-LED town glow. */
export const GLOW_COLOURS = {
  green: unit(mix(unit([0.82, 0.78, 0.565]), unit([0.25, 1.0, 0.15]), 0.25)),
  red: unit([1.0, 0.08, 0.05]),
  zodiacal: unit([1.0, 0.93, 0.82]),
  town: unit([1.0, 0.66, 0.36])
}

/** The night's glow, when the sun is below the horizon. `force`: the spec's
 * switches; drawn values are kept whatever they say. */
export function nightGlowFor(
  params: SceneParams,
  rng: Random,
  force: { milkyWay?: boolean | null; airglow?: boolean | null; zodiacalLight?: boolean | null; skyDarkness?: Bortle } = {}
): NightGlowParams | null {
  const spread = Math.exp(rng.normal(0, 0.2))
  const red = rng.range(0.6, 1.4)
  // Bands show in photos on some nights; faint on most.
  const bands = { strength: rng.chance(0.35) ? rng.range(0.1, 0.25) : rng.range(0, 0.06), headingDeg: rng.range(0, 180), seed: rng.range(0, 100) }
  const dome = { offsetDeg: rng.normal(0, 35), widthDeg: rng.range(20, 45) }
  if (params.sunElevationDeg >= 0) return null
  const activity = solarActivity(params.date)
  const off = (v: boolean | null | undefined): boolean => v !== false && v !== null
  return {
    bortle: force.skyDarkness ?? placeNamed(params.place.id).bortle,
    airglowS10: airglowZenith(params.date) * spread,
    // The red line follows the solar cycle more than the green. Its share of
    // the luminance is small: ~50–100 R against ~250 R of green and the
    // continuum, at 630 nm where luminance weighs ~0.27 of 555 nm.
    redShare: Math.min(0.1, (0.01 + 0.04 * activity) * red),
    bands,
    dome,
    milkyWay: off(force.milkyWay),
    airglow: off(force.airglow),
    zodiacal: off(force.zodiacalLight)
  }
}

/** Render units per S10 of the sky as drawn. */
export function glowScale(night: SceneParams['nightSky'], elongationDeg: number): number {
  return s10Luminance() * renderPerLux(night, elongationDeg)
}

const GLSL = /* glsl */ `
uniform float glowScale;
uniform float glowReplace;
uniform vec3 glowSwitch; // Milky Way, airglow, zodiacal light
uniform mat3 ecefToGalactic;
uniform vec3 eclipticPoleECEF;
uniform vec3 realSunECEF;
uniform sampler2D milkyWayMap;
uniform sampler2D zodiacalMap;
uniform vec4 airglowA; // zenith S10, red share, band strength, seed
uniform vec2 airglowBands; // crest direction (east, north)
uniform vec4 lightDome; // inland direction (ECEF, unit), artificial zenith S10
uniform vec2 lightDomeB; // dome at the horizon (S10), width (rad)

float ngHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + airglowA.w) * 43758.5453); }
float ngNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ngHash(i), ngHash(i + vec2(1.0, 0.0)), f.x), mix(ngHash(i + vec2(0.0, 1.0)), ngHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ngFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ngNoise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

float vanRhijn(float mu, float heightKm) {
  float k = ATMOSPHERE.bottom_radius / (ATMOSPHERE.bottom_radius + heightKm);
  return inversesqrt(max(1.0 - k * k * (1.0 - mu * mu), 1e-4));
}

vec3 nightGlow(vec3 radiance, const vec3 transmittance, const vec3 cameraPosition, const vec3 rayDirection) {
  float r = length(cameraPosition);
  vec3 up = cameraPosition / r;
  float mu = dot(up, rayDirection);
  if (RayIntersectsGround(ATMOSPHERE, r, mu)) return radiance;
  vec3 glow = vec3(0.0);

  // Milky Way (S10, the map's colours).
  if (glowSwitch.x > 0.5) {
    vec3 g = ecefToGalactic * rayDirection;
    float l = atan(g.y, g.x);
    float b = asin(clamp(g.z, -1.0, 1.0));
    vec2 uv = vec2(fract(0.5 - l / (2.0 * PI)), 0.5 + b / PI);
    vec3 code = textureLod(milkyWayMap, uv, 0.0).rgb;
    glow += exp2(mix(vec3(${MILKY_WAY_LOG2[0].toFixed(1)}), vec3(${MILKY_WAY_LOG2[1].toFixed(1)}), code));
  }

  // Zodiacal light and gegenschein.
  if (glowSwitch.z > 0.5) {
    float sinBeta = dot(rayDirection, eclipticPoleECEF);
    float beta = degrees(asin(clamp(abs(sinBeta), 0.0, 1.0)));
    vec3 rp = rayDirection - eclipticPoleECEF * sinBeta;
    vec3 sp = realSunECEF - eclipticPoleECEF * dot(realSunECEF, eclipticPoleECEF);
    float lon = degrees(acos(clamp(dot(normalize(rp), normalize(sp)), -1.0, 1.0)));
    vec2 size = vec2(${90 / ZODI_STEP + 1}.0, ${180 / ZODI_STEP + 1}.0);
    vec2 uv = (vec2(beta, lon) / ${ZODI_STEP}.0 + 0.5) / size;
    glow += texture(zodiacalMap, uv).r * vec3(${GLOW_COLOURS.zodiacal.map(v => v.toFixed(4)).join(', ')});
  }
  glow *= transmittance;

  // Airglow: two thin shells, brighter edge-on, then dimmed by the air.
  float airglow = 0.0;
  if (glowSwitch.y > 0.5) {
    float layer = ATMOSPHERE.bottom_radius + ${GREEN_LAYER_KM.toFixed(1)};
    float bq = dot(cameraPosition, rayDirection);
    float t = -bq + sqrt(max(bq * bq - dot(cameraPosition, cameraPosition) + layer * layer, 0.0));
    vec3 v = rayDirection * t;
    vec3 local = v - up * dot(v, up);
    vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), up));
    vec2 q = vec2(dot(local, east), dot(local, cross(up, east)));
    vec2 along = airglowBands;
    float w = dot(q, vec2(-along.y, along.x));
    float warp = 25.0 * ngFbm(q / 120.0);
    float crests = sin((w + warp) / 4.5);
    float patches = smoothstep(0.35, 0.75, ngFbm(q / 260.0 + 3.0));
    // Seen edge-on low in the sky the ripples stack up and show; overhead
    // they are lost in the even glow.
    float edgeOn = 1.0 - smoothstep(0.15, 0.8, mu);
    float pattern = max(0.2, 1.0 + airglowA.z * edgeOn * (crests * patches + 1.2 * (ngFbm(q / 60.0) - 0.5)));
    float green = (1.0 - airglowA.y) * vanRhijn(mu, ${GREEN_LAYER_KM.toFixed(1)}) * pattern;
    float red = airglowA.y * vanRhijn(mu, ${RED_LAYER_KM.toFixed(1)}) * (0.8 + 0.4 * ngFbm(q / 400.0 + 7.0));
    airglow = airglowA.x;
    glow += airglowA.x * transmittance * (green * vec3(${GLOW_COLOURS.green.map(v => v.toFixed(4)).join(', ')}) + red * vec3(${GLOW_COLOURS.red.map(v => v.toFixed(4)).join(', ')}));
  }

  // What the air scatters toward us of the whole night sky's light: zenith
  // airglow, a typical zodiacal and starlight share.
  glow += (1.0 - transmittance) * (airglow + 120.0) * vec3(${GLOW_COLOURS.green.map(v => (0.5 + 0.5 * v).toFixed(4)).join(', ')});

  // Light pollution: an even sky glow, brighter low down, and the dome of
  // the towns inland.
  if (lightDome.w > 0.0) {
    float el = asin(clamp(mu, 0.0, 1.0));
    vec3 h = rayDirection - up * mu;
    h = length(h) > 1e-5 ? normalize(h) : lightDome.xyz;
    // Towns inland and along the coast either way (75° off inland).
    vec3 side = cross(up, lightDome.xyz);
    float domes = 0.0;
    for (int i = -1; i <= 1; i++) {
      float a = float(i) * 1.309;
      vec3 d = lightDome.xyz * cos(a) + side * sin(a);
      float az = acos(clamp(dot(h, d), -1.0, 1.0));
      domes += (i == 0 ? 1.0 : 0.7) * exp(-0.5 * az * az / (lightDomeB.y * lightDomeB.y));
    }
    float town = lightDome.w * (1.0 + 2.0 * exp(-el / 0.35)) + lightDomeB.x * exp(-el / 0.12) * domes;
    glow += town * mix(vec3(1.0), transmittance, 0.5) * vec3(${GLOW_COLOURS.town.map(v => v.toFixed(4)).join(', ')});
  }
  glow *= glowScale;
  return glowReplace > 0.5 ? glow : radiance + glow;
}
`

export interface GlowFrame {
  /** Row-major ECI → world (skyClock.ts skyRotation). */
  eciToWorld: readonly number[]
  /** ECEF → world rotation (the inverse of the anchor's frame). */
  worldToECEF: Matrix3
  /** The ecliptic pole and the real sun, world frame (ECI turned). */
  eclipticPole: [number, number, number]
  realSun: [number, number, number]
  /** Unit vector inland, world frame (horizontal); null at sea. */
  inland: [number, number, number] | null
}

/** Patch a sky material (main or reflection cube) with the night's glow.
 * Call it after the other sky patches: its line runs first. */
export function patchSkyNightGlow(
  material: SkyMaterial,
  glow: NightGlowParams,
  frame: GlowFrame,
  milkyWay: Texture,
  scale: number,
  replace: boolean
): void {
  const toECEF = (v: [number, number, number]): Vector3 => new Vector3(...v).applyMatrix3(frame.worldToECEF).normalize()
  // ECEF → world → ECI → galactic.
  const e = frame.eciToWorld
  const worldToECI = new Matrix3().set(e[0], e[3], e[6], e[1], e[4], e[7], e[2], e[5], e[8])
  const g = EQUATORIAL_TO_GALACTIC
  const toGalactic = new Matrix3().set(g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7], g[8])
  const ecefToWorld = frame.worldToECEF.clone().transpose()
  const ecefToGalactic = toGalactic.multiply(worldToECI).multiply(ecefToWorld)
  const heading = (glow.bands.headingDeg * Math.PI) / 180
  const artificial = ARTIFICIAL[glow.bortle]
  const offset = (glow.dome.offsetDeg * Math.PI) / 180
  const inland = frame.inland
  const domeDir =
    inland == null
      ? new Vector3(1, 0, 0)
      : toECEF([inland[0] * Math.cos(offset) - inland[2] * Math.sin(offset), 0, inland[0] * Math.sin(offset) + inland[2] * Math.cos(offset)])
  Object.assign(material.uniforms, {
    glowScale: new Uniform(scale),
    glowReplace: new Uniform(replace ? 1 : 0),
    glowSwitch: new Uniform(new Vector3(glow.milkyWay ? 1 : 0, glow.airglow ? 1 : 0, glow.zodiacal ? 1 : 0)),
    ecefToGalactic: new Uniform(ecefToGalactic),
    eclipticPoleECEF: new Uniform(toECEF(frame.eclipticPole)),
    realSunECEF: new Uniform(toECEF(frame.realSun)),
    milkyWayMap: new Uniform(milkyWay),
    zodiacalMap: new Uniform(zodiacal()),
    airglowA: new Uniform(new Vector4(glow.airglowS10, glow.redShare, glow.bands.strength, glow.bands.seed)),
    airglowBands: new Uniform(new Vector2(Math.sin(heading), Math.cos(heading))),
    lightDome: new Uniform(new Vector4(domeDir.x, domeDir.y, domeDir.z, artificial.zenith)),
    lightDomeB: new Uniform(new Vector2(inland == null ? 0 : artificial.dome, (glow.dome.widthDeg * Math.PI) / 180))
  })
  const source = material.fragmentShader
  const call = /(vec3 radiance = GetSkyRadiance\([^;]*\);)/
  if (!source.includes('vec3 getSkyRadiance(') || !call.test(source)) {
    throw new Error('patchSkyNightGlow: the sky shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec3 getSkyRadiance(', `${GLSL}\nvec3 getSkyRadiance(`)
    .replace(call, '$1\n  radiance = nightGlow(radiance, transmittance, cameraPosition, rayDirection);')
  material.needsUpdate = true
}

/** The zodiacal table as a texture: one per render, freed with the sky
 * material's uniforms (dispose.ts walks them). */
function zodiacal(): DataTexture {
  return zodiacalTexture()
}
