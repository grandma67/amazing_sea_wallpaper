import { SunPosition } from 'astronomy-engine'
import { Uniform, Vector3, Vector4, type Matrix4 } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import type { SceneParams } from './params'
import type { Random } from './random'
import { apply, skyRotation, sunECI } from './skyClock'
import { frameFov, inSky, unproject } from './skyFrame'
import { PSF } from './starLight'

// Shooting stars (NIGHT_SKY phase 4, STARS.md §5).
//
// A single 20 s exposure almost never holds a meteor; real meteor photos are
// the photographer's best frame of a session. So: the expected number of
// meteors that cross the frame in a ~4 h session,
//   N = Σ ZHR(λ⊙) · sin(radiant height) · r^−(6.5 − Lcam) · frame share · hours,
// over the active showers and the sporadics, × the clear share of the sky,
// gives P(at least one) = 1 − e^−N. Lcam is the faintest meteor the camera
// records (~+2.5 under a dark sky; less under the moon or a lit sky). The
// meteor shown is the brightest of the session's: the population law's
// maximum over N.
//
// A shower meteor runs along the great circle away from its radiant, shorter
// near it; its light is its flux × duration / exposure (the 500 rule) spread
// along the streak with the stars' point spread, in the stars' units, and
// brightest after the middle with a final flare. Drawn in the sky shader
// (main sky only: too thin for the cube), behind the clouds.

type Vec3 = [number, number, number]
const DEG = Math.PI / 180

export interface Shower {
  id: string
  name: string
  /** Solar longitude of the peak (deg, J2000). */
  peak: number
  /** Activity falls by 10^(−slope · |Δλ⊙|) (per degree). */
  slope: number
  zhr: number
  /** Radiant at the peak (deg). */
  ra: number
  dec: number
  /** Entry speed (km/s) and population index. */
  speed: number
  r: number
}

/** IMO working list (STARS.md §5): peaks, ZHR, radiants, speeds and r from
 * the table there; solar longitudes of the peaks and the activity slopes are
 * the IMO handbook's (general). */
export const SHOWERS: readonly Shower[] = [
  { id: 'quadrantids', name: 'Quadrantids', peak: 283.15, slope: 2.5, zhr: 110, ra: 230, dec: 49, speed: 41, r: 2.1 },
  { id: 'lyrids', name: 'Lyrids', peak: 32.32, slope: 0.9, zhr: 18, ra: 271, dec: 34, speed: 49, r: 2.1 },
  { id: 'eta-aquariids', name: 'η-Aquariids', peak: 45.5, slope: 0.08, zhr: 50, ra: 338, dec: -1, speed: 66, r: 2.4 },
  { id: 'southern-delta-aquariids', name: 'δ-Aquariids', peak: 127, slope: 0.09, zhr: 25, ra: 340, dec: -16, speed: 41, r: 2.5 },
  { id: 'alpha-capricornids', name: 'α-Capricornids', peak: 127, slope: 0.05, zhr: 5, ra: 307, dec: -10, speed: 23, r: 2.5 },
  { id: 'perseids', name: 'Perseids', peak: 140.0, slope: 0.25, zhr: 100, ra: 48, dec: 58, speed: 59, r: 2.2 },
  { id: 'orionids', name: 'Orionids', peak: 208, slope: 0.12, zhr: 20, ra: 95, dec: 16, speed: 66, r: 2.5 },
  { id: 'southern-taurids', name: 'Taurids', peak: 197, slope: 0.03, zhr: 5, ra: 32, dec: 9, speed: 27, r: 2.3 },
  { id: 'northern-taurids', name: 'Taurids', peak: 230, slope: 0.03, zhr: 5, ra: 58, dec: 22, speed: 29, r: 2.3 },
  { id: 'leonids', name: 'Leonids', peak: 235.27, slope: 0.4, zhr: 15, ra: 152, dec: 22, speed: 71, r: 2.5 },
  { id: 'geminids', name: 'Geminids', peak: 262.2, slope: 0.39, zhr: 150, ra: 112, dec: 33, speed: 35, r: 2.6 },
  { id: 'ursids', name: 'Ursids', peak: 270.7, slope: 0.9, zhr: 10, ra: 217, dec: 76, speed: 33, r: 3.0 }
]

export type ShowerId = (typeof SHOWERS)[number]['id']

export interface Meteor {
  /** Shower id, or null for a sporadic. */
  shower: string | null
  /** Peak visual magnitude. */
  magnitude: number
  /** Start and end of the streak (unit vectors, world frame). */
  start: Vec3
  end: Vec3
  durationS: number
  exposureS: number
  /** Luminance-normalised colour (by speed). */
  colour: Vec3
  seed: number
}

/** Session length (h) and the camera's faintest meteor under a dark sky. */
export const SESSION_HOURS = 4
export const DARK_CAMERA_LIMIT = 2.5
/** Sporadics: population index and a radiant-free height factor. */
const SPORADIC_R = 3
const SPORADIC_HEIGHT = 0.7

/** The sun's ecliptic longitude (deg) at noon UTC. */
export function solarLongitude(date: string): number {
  return SunPosition(new Date(`${date}T12:00:00Z`)).elon
}

/** A shower's ZHR on a day. */
export function showerZhr(shower: Shower, longitude: number): number {
  const d = Math.abs(((longitude - shower.peak + 540) % 360) - 180)
  return shower.zhr * 10 ** (-shower.slope * d)
}

/** Sporadic hourly rate (to +6.5, radiant-free) by local solar hour: dawn
 * ~10, dusk ~2 (STARS.md §5). */
export function sporadicRate(hour: number): number {
  return 6 + 4 * Math.cos((2 * Math.PI * (hour - 6)) / 24)
}

/** Local solar hour of the scene: the sun's hour angle from the sky clock. */
export function localHour(params: Pick<SceneParams, 'date' | 'latitudeDeg' | 'sunDirection' | 'evening'>): number {
  const dec = Math.asin(sunECI(params.date)[2])
  const phi = params.latitudeDeg * DEG
  const el = Math.asin(Math.max(-1, Math.min(1, params.sunDirection[1])))
  const cosH = (Math.sin(el) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG / 15
  return params.evening ? 12 + H : 12 - H
}

/** How bright the night sky is (mag/arcsec²): darkness of the place and the
 * moon (a full moon brightens a dark sky ~3.5 magnitudes). */
export function skyMagnitude(params: Pick<SceneParams, 'moonlight'>, bortle: number): number {
  return 21.6 - 0.4 * Math.max(0, bortle - 2) - 2.5 * Math.log10(1 + 25 * params.moonlight)
}

/** The camera's faintest recorded meteor for that sky. */
export function cameraLimit(skyMag: number): number {
  return DARK_CAMERA_LIMIT - 0.8 * Math.max(0, 21.6 - skyMag)
}

/** Clear share of the sky by weather. */
const CLEAR: Record<string, number> = { clear: 1, cirrus: 0.7, few: 0.9, scattered: 0.6, broken: 0.3, overcast: 0, storm: 0 }

/** Meteors per steradian at an elevation, relative to the sky an observer
 * counts (the ZHR's): low down the ~100 km layer is seen obliquely, so far
 * more of it fits in a steradian; distance (~2.5–3 mag at 10–20°) and the
 * air (~1 mag) dim those meteors, which leaves ~2–3× (general: area ×
 * r^−Δm). Nothing below a few degrees. */
export function meteorDensity(elevationRad: number): number {
  const el = Math.max(elevationRad, 1e-3)
  const fade = Math.max(0, Math.min(1, (el / DEG - 2) / 6))
  return Math.min(3, Math.sin(el) ** -0.6) * fade * fade * (3 - 2 * fade)
}

/** Share of the meteors a whole-sky observer sees that cross the frame:
 * its sky's solid angle, weighted by `meteorDensity`, over the ~3.5 sr an
 * observer's count covers (STARS.md §5). */
export function frameShare(params: Pick<SceneParams, 'camera'>): number {
  const { h, v } = frameFov(params)
  const [nx, ny] = [16, 12]
  let sum = 0
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const x = -1 + (2 * (i + 0.5)) / nx
      const y = -1 + (2 * (j + 0.5)) / ny
      const d = unproject(params, x, y)
      if (d[1] <= 0) continue
      // A pixel's solid angle falls off as cos³ from the axis.
      const tx = x * Math.tan(h / 2)
      const ty = y * Math.tan(v / 2)
      const cos3 = (1 + tx * tx + ty * ty) ** -1.5
      sum += cos3 * meteorDensity(Math.asin(d[1]))
    }
  const pixelSr = (4 * Math.tan(h / 2) * Math.tan(v / 2)) / (nx * ny)
  return Math.min(0.6, (sum * pixelSr) / 3.5)
}

const unit = (c: Vec3): Vec3 => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return [c[0] / l, c[1] / l, c[2] / l]
}
/** Fast meteors are blue-green and white (magnesium, oxygen), slow ones
 * yellow (sodium, iron). */
export function meteorColour(speed: number): Vec3 {
  const t = Math.max(0, Math.min(1, (speed - 25) / 40))
  return unit([1.0 - 0.25 * t, 0.86 + 0.14 * t, 0.55 + 0.4 * t])
}

export interface MeteorRates {
  /** Expected meteors in frame over the session, per source. */
  sources: { shower: Shower | null; n: number; r: number }[]
  total: number
  cameraLimit: number
}

/** The session's expected meteors in frame, before the weather. */
export function meteorRates(params: SceneParams, bortle: number): MeteorRates {
  const limit = cameraLimit(skyMagnitude(params, bortle))
  const share = frameShare(params) * SESSION_HOURS
  const rot = skyRotation(params).matrix
  const lon = solarLongitude(params.date)
  const sources: MeteorRates['sources'] = []
  for (const s of SHOWERS) {
    const zhr = showerZhr(s, lon)
    if (zhr < 0.5) continue
    const radiant = apply(rot, radec(s.ra, s.dec))
    // Below ~10° the rate formula breaks down; a radiant below the horizon
    // still sends a few earth-grazers: keep a small floor.
    const height = Math.max(Math.sin(Math.max(radiant[1], 0)), 0.05)
    sources.push({ shower: s, n: zhr * height * s.r ** -(6.5 - limit) * share, r: s.r })
  }
  sources.push({ shower: null, n: sporadicRate(localHour(params)) * SPORADIC_HEIGHT * SPORADIC_R ** -(6.5 - limit) * share, r: SPORADIC_R })
  return { sources, total: sources.reduce((t, s) => t + s.n, 0), cameraLimit: limit }
}

export function radec(raDeg: number, decDeg: number): Vec3 {
  return [Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG)]
}

/** Whether today's best frame holds a meteor, and which. `force`: false/null
 * none; true at least one; a shower id: one of it; a number: that many. */
export function meteorsFor(params: SceneParams, rng: Random, bortle: number, force?: boolean | string | number | null): Meteor[] {
  const night = params.timeOfDay === 'night' && params.eclipse?.type !== 'lunar-total'
  const clear = (CLEAR[params.weather.kind] ?? 0) * (params.fog == null ? 1 : 0)
  const rates = night ? meteorRates(params, bortle) : { sources: [], total: 0, cameraLimit: DARK_CAMERA_LIMIT }
  const n = rates.total * clear
  // Always the same draws, so forcing changes only what's shown.
  const u = rng.float()
  const u2 = rng.float()
  const drawn = u < 1 - Math.exp(-n) ? (u2 < (1 - Math.exp(-n) - n * Math.exp(-n)) / Math.max(1 - Math.exp(-n), 1e-9) ? 2 : 1) : 0
  const count = force === undefined ? drawn : force === null || force === false ? 0 : typeof force === 'number' ? Math.max(0, Math.min(3, Math.round(force))) : Math.max(1, drawn)
  const forcedShower = typeof force === 'string' ? SHOWERS.find(s => s.id === force) : undefined
  const rot = skyRotation(params).matrix
  const out: Meteor[] = []
  const exposureS = Math.min(25, 500 / params.camera.focalLengthMm)
  for (let i = 0; i < count; i++) {
    // Which source, by its share of the session's meteors.
    let source: { shower: Shower | null; n: number; r: number } | undefined
    if (forcedShower != null) source = { shower: forcedShower, n: 1, r: forcedShower.r }
    else {
      const pick = rng.float() * Math.max(rates.total, 1e-12)
      let acc = 0
      source = rates.sources.find(s => (acc += s.n) >= pick) ?? rates.sources.at(-1) ?? { shower: null, n: 1, r: SPORADIC_R }
    }
    const shower = source.shower
    // The brightest of the session's: the maximum of N draws of the
    // population law above the camera's limit.
    const best = Math.log(Math.max(n, 1)) / Math.log(source.r)
    const magnitude = rates.cameraLimit - Math.log(1 / Math.max(rng.float(), 1e-6)) / Math.log(source.r) - best
    const speed = shower?.speed ?? rng.range(25, 65)
    const radiant = shower != null ? apply(rot, radec(shower.ra, shower.dec)) : null
    const path = meteorPath(params, rng, radiant)
    if (path == null) continue
    out.push({
      shower: shower?.id ?? null,
      magnitude: Math.max(-6, magnitude),
      start: path[0],
      end: path[1],
      // Fast meteors burn out quicker; a fireball lasts seconds.
      durationS: (speed > 50 ? rng.range(0.25, 0.6) : rng.range(0.5, 1.2)) * (magnitude < -3 ? 2 : 1),
      exposureS,
      colour: meteorColour(speed),
      seed: rng.range(0, 100)
    })
  }
  return out
}

/** A streak in the frame's sky: through a random point, away from the
 * radiant along the great circle (sporadics: any direction), 5–30° long
 * and shorter near the radiant, trimmed to the frame. */
export function meteorPath(params: SceneParams, rng: Random, radiant: Vec3 | null): [Vec3, Vec3] | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    // A point in the frame's sky.
    const nx = rng.range(-0.8, 0.8)
    const ny = rng.range(1 - 2 * params.camera.horizonFraction + 0.15, 0.85)
    const mid = unproject(params, nx, ny)
    if (!inSky(params, mid, 0.9)) continue
    let dir: Vec3
    let fromRadiant = 90
    if (radiant != null) {
      // Away from the radiant: the tangent at mid of the great circle from R.
      const c = dot(mid, radiant)
      fromRadiant = Math.acos(Math.max(-1, Math.min(1, c))) / DEG
      if (fromRadiant < 3) continue
      dir = normalize(sub(mid, scale(radiant, 1)))
      dir = normalize(sub(dir, scale(mid, dot(dir, mid))))
    } else {
      const a = rng.range(0, 2 * Math.PI)
      const east = normalize(cross([0, 1, 0], mid))
      const up = cross(mid, east)
      dir = normalize(add(scale(east, Math.cos(a)), scale(up, Math.sin(a))))
    }
    const length = (3 + rng.range(5, 27) * Math.sin(Math.min(90, fromRadiant) * DEG)) * DEG
    // The meteor starts nearer the radiant: before mid.
    let back = rng.range(0.2, 0.8) * length
    let fwd = length - back
    for (let k = 0; k < 12; k++) {
      const s = turn(mid, dir, -back)
      const e = turn(mid, dir, fwd)
      if (inSky(params, s, 0.95, 2) && inSky(params, e, 0.95, 2)) return [s, e]
      back *= 0.8
      fwd *= 0.8
    }
  }
  return null
}

/** Rotate `p` by `angle` along the great circle with tangent `t`. */
function turn(p: Vec3, t: Vec3, angle: number): Vec3 {
  return normalize(add(scale(p, Math.cos(angle)), scale(t, Math.sin(angle))))
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a))

export const MAX_METEORS = 3

const GLSL = (count: number): string => /* glsl */ `
uniform vec4 meteorA[${MAX_METEORS}]; // start (ECEF unit), along-path angle (rad)
uniform vec4 meteorB[${MAX_METEORS}]; // end (ECEF unit), line irradiance per radian (render units)
uniform vec4 meteorC[${MAX_METEORS}]; // colour, seed
uniform float meteorSigma; // the streak's width (rad, Gaussian σ)

float meteorProfile(float t, float seed) {
  // Rising, brightest after the middle, a late flare, tapered ends.
  float body = smoothstep(0.0, 0.55, t) * (1.0 - smoothstep(0.82, 1.0, t));
  float flare = exp(-pow((t - 0.78 - 0.08 * fract(seed)) / 0.05, 2.0));
  float flicker = 0.85 + 0.15 * sin(t * 40.0 + seed * 7.0);
  return (body * flicker + 0.8 * flare) / 0.62;
}

vec3 meteors(vec3 radiance, const vec3 transmittance, const vec3 rayDirection) {
  for (int i = 0; i < ${count}; i++) {
    vec3 a = meteorA[i].xyz;
    vec3 b = meteorB[i].xyz;
    vec3 n = normalize(cross(a, b));
    float across = asin(clamp(dot(rayDirection, n), -1.0, 1.0));
    if (abs(across) > 5.0 * meteorSigma) continue;
    vec3 p = normalize(rayDirection - n * dot(rayDirection, n));
    float along = atan(dot(cross(a, p), n), dot(a, p));
    float t = along / meteorA[i].w;
    if (t < 0.0 || t > 1.0) continue;
    float g = exp(-0.5 * across * across / (meteorSigma * meteorSigma)) / (meteorSigma * 2.5066283);
    radiance += transmittance * meteorC[i].rgb * meteorB[i].w * g * meteorProfile(t, meteorC[i].w);
  }
  return radiance;
}
`

/** Patch the main sky with today's meteors. `starScale` is a magnitude-0
 * star's irradiance (starLight.ts); `vfovRad` the frame's. */
export function patchSkyMeteors(material: SkyMaterial, list: Meteor[], worldToECEF: Matrix4, starScale: number, vfovRad: number): void {
  if (list.length === 0) return
  const toECEF = (v: Vec3): Vector3 => new Vector3(...v).transformDirection(worldToECEF)
  const pad = <T>(values: T[], filler: () => T): T[] => [...values, ...Array.from({ length: MAX_METEORS - values.length }, filler)]
  const a = list.map(m => {
    const s = toECEF(m.start)
    return new Vector4(s.x, s.y, s.z, Math.acos(Math.max(-1, Math.min(1, dot(m.start, m.end)))))
  })
  const b = list.map(m => {
    const e = toECEF(m.end)
    const length = Math.acos(Math.max(-1, Math.min(1, dot(m.start, m.end))))
    // The streak holds flux × duration; a still shows it per exposure, so
    // it is as bright as a star of that much light, spread along its length.
    const irradiance = (starScale * 10 ** (-0.4 * m.magnitude) * m.durationS) / m.exposureS
    return new Vector4(e.x, e.y, e.z, irradiance / Math.max(length, 1e-4))
  })
  const c = list.map(m => new Vector4(...m.colour, m.seed))
  Object.assign(material.uniforms, {
    meteorA: new Uniform(pad(a, () => new Vector4(1, 0, 0, 1))),
    meteorB: new Uniform(pad(b, () => new Vector4(0, 1, 0, 0))),
    meteorC: new Uniform(pad(c, () => new Vector4())),
    // The stars' core (PSF), a little wider for the meteor's own size and
    // the trail's wake: ~1–2 px.
    meteorSigma: new Uniform((1.3 * PSF.coreSigma * vfovRad) / 1080)
  })
  const source = material.fragmentShader
  const call = /(vec3 radiance = GetSkyRadiance\([^;]*\);)/
  if (!source.includes('vec3 getSkyRadiance(') || !call.test(source)) {
    throw new Error('patchSkyMeteors: the sky shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec3 getSkyRadiance(', `${GLSL(list.length)}\nvec3 getSkyRadiance(`)
    .replace(call, '$1\n  radiance = meteors(radiance, transmittance, rayDirection);')
  material.needsUpdate = true
}
