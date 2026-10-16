import { Uniform, Vector3, Vector4, type Matrix4 } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import { CLOUD_GENERA } from './cloudTypes'
import type { OceanName } from './oceans'
import type { SceneParams } from './params'
import type { Random } from './random'

// Contrails (homogenitus), and old ones spread into cirrus-like bands
// (homomutatus), ~9–12 km up.
//
// A trail only lasts where the upper air is ice-supersaturated: on dry days
// it's a short line behind the aircraft that evaporates within a minute or
// two; on humid days (the days with cirrus) trails persist for hours and
// spread. Most North Atlantic trails last under 6 h, ~5% a day (Irvine et
// al., EGU 2016). Air traffic sets how many there are: the North Atlantic
// tracks and the European and Mediterranean skies are busy, the Indian Ocean
// (Gulf–Asia) and the Pacific less so, polar routes thin, and the Southern
// Ocean has almost none. In the tropics the cruise levels are often too
// warm for trails to form.
//
// Drawn in takram's sky shader (patchSkyContrails), so clouds, land and haze
// composite over them as over the sky, and lit by the sun at their height:
// after sunset they glow pink and orange while the sea is already dark.

export interface Contrail {
  /** Azimuth the trail runs toward (deg, world). */
  headingDeg: number
  altitudeM: number
  /** Where its middle is, from the camera: azimuth (deg) and ground distance (m). */
  bearingDeg: number
  distanceM: number
  lengthM: number
  /** Minutes since the aircraft passed: 0 sharp, 60+ spread and fading. */
  ageMin: number
  /** Width (m) and optical depth across it. */
  widthM: number
  opticalDepth: number
  seed: number
}

export const MAX_CONTRAILS = 5

/** Air traffic over each sea (busy corridors = 1). */
export const TRAFFIC: Record<OceanName, number> = { atlantic: 1, indian: 0.6, pacific: 0.45, arctic: 0.25, southern: 0.04 }
/** By coast: Mediterranean skies are among the busiest; in the tropics
 * trails form less often (warmer cruise levels). */
const BIOME_TRAFFIC: Record<SceneParams['biome']['name'], number> = {
  mediterranean: 1.3,
  nordic: 0.9,
  volcanic: 0.8,
  desert: 0.8,
  tropical: 0.5
}

/** Is the upper air humid enough for trails to persist? Cirrus says yes. */
function persistence(params: SceneParams): number {
  const high = params.weather.formations.some(g => CLOUD_GENERA[g].etage === 'high')
  if (high) return 0.75
  const amount: Record<string, number> = { clear: 0.2, cirrus: 0.75, few: 0.35, scattered: 0.3, broken: 0.25 }
  return amount[params.weather.kind] ?? 0
}

/**
 * Which trails are in today's sky. None at night (unlit), under overcast or
 * storms, or inside fog. `force`: false/null none, true at least one, a
 * number that many.
 */
export function contrailsFor(params: SceneParams, rng: Random, force?: boolean | number | null): Contrail[] {
  const { weather } = params
  const traffic = TRAFFIC[params.sea.ocean] * BIOME_TRAFFIC[params.biome.name]
  const persist = persistence(params)
  const visible =
    params.timeOfDay !== 'night' &&
    weather.kind !== 'overcast' &&
    weather.kind !== 'storm' &&
    !(params.fog != null && params.fog.start === 0) &&
    params.eclipse == null
  // Always draw the same numbers, so forcing changes only the count.
  const [r, k] = [rng.float(), rng.float()]
  const drawnCount = visible && r < Math.min(0.85, traffic * (0.25 + 0.6 * persist)) ? 1 + Math.floor(k * 4 * persist * Math.min(1, traffic)) : 0
  const count =
    force === undefined
      ? drawnCount
      : force === null || force === false
        ? 0
        : force === true
          ? Math.max(1, drawnCount)
          : Math.max(0, Math.min(MAX_CONTRAILS, Math.round(force)))
  // Airways: most trails over a stretch of sea follow one or two routes.
  const routes = [rng.range(0, 180), rng.range(0, 180)]
  const out: Contrail[] = []
  for (let i = 0; i < count; i++) {
    const persistent = rng.chance(persist) || force === true || typeof force === 'number'
    // Young trails are common; old spread ones less so, and only persistent.
    const ageMin = persistent ? rng.weighted<() => number>([[() => rng.range(0, 8), 3], [() => rng.range(8, 40), 3], [() => rng.range(40, 120), 2]])() : rng.range(0, 1.5)
    const spread = Math.min(1, ageMin / 60)
    const route = routes[rng.chance(0.7) ? 0 : 1]
    out.push({
      headingDeg: route + rng.normal(0, 6) + (rng.chance(0.5) ? 180 : 0),
      altitudeM: rng.range(9500, 11800),
      bearingDeg: params.camera.headingDeg + rng.range(-55, 55),
      // 15–80 km off: 7–34° up, where a landscape frame shows sky.
      distanceM: 15000 * Math.exp(rng.range(0, Math.log(80 / 15))),
      // A dry-day trail is only the stretch behind the aircraft that hasn't
      // evaporated yet: a few km.
      lengthM: persistent ? rng.range(40, 160) * 1000 : rng.range(3, 12) * 1000,
      ageMin,
      // ~wingspan when fresh, spreading to kilometres over an hour or two.
      widthM: 40 + spread * rng.range(800, 3000) + ageMin * 6,
      opticalDepth: persistent ? rng.range(0.25, 0.5) * (1 - 0.6 * spread) : rng.range(0.15, 0.35),
      seed: rng.range(0, 100)
    })
  }
  return out
}

const GLSL = (count: number): string => /* glsl */ `
uniform vec4 contrailA[${MAX_CONTRAILS}]; // centre (tangent, length units), radius above the earth's centre
uniform vec4 contrailB[${MAX_CONTRAILS}]; // direction (unit tangent), half length
uniform vec4 contrailC[${MAX_CONTRAILS}]; // width, optical depth, spread 0..1, seed

float contrailHash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float contrailNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(contrailHash(i), contrailHash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

vec3 contrails(vec3 radiance, const vec3 cameraPosition, const vec3 rayDirection, const vec3 sunDirection, const float fragmentAngle) {
  vec3 up = normalize(cameraPosition);
  for (int i = 0; i < ${count}; i++) {
    vec4 a = contrailA[i];
    vec4 b = contrailB[i];
    vec4 c = contrailC[i];
    // Where the view ray meets the trail's height (from inside that sphere).
    float bq = dot(cameraPosition, rayDirection);
    float cq = dot(cameraPosition, cameraPosition) - a.w * a.w;
    float disc = bq * bq - cq;
    if (disc < 0.0) continue;
    float t = -bq + sqrt(disc);
    if (t <= 0.0) continue;
    vec3 p = cameraPosition + rayDirection * t;
    vec3 v = p - cameraPosition;
    vec3 local = v - up * dot(v, up) - a.xyz;
    float s = dot(local, b.xyz);
    float halfLength = b.w;
    if (abs(s) > halfLength) continue;
    vec3 across = local - b.xyz * s;
    float spread = c.z;
    float seed = c.w;
    // Gentle meanders, more as it ages, and its edge breaks into puffs.
    float scale = c.x;
    float wander = (contrailNoise(s / (scale * 40.0 + 1.0) + seed) - 0.5) * scale * (1.0 + 3.0 * spread);
    float side = length(across) * sign(dot(across, cross(up, b.xyz))) - wander;
    // Never thinner than a pixel; keep the trail's optical depth (a thin
    // far trail gets fainter rather than vanishing in aliasing).
    float pixel = fragmentAngle * t;
    float width = max(scale, pixel * 1.5);
    float x = side / width;
    float tau = c.y * (scale / width) * exp(-2.0 * x * x);
    tau *= mix(1.0, 0.45 + 0.9 * contrailNoise(s / (scale * 6.0 + 0.5) * 2.0 + seed * 3.0), spread);
    // Fades at the ends: the tail spreading and evaporating, the head new.
    float u = s / halfLength;
    tau *= smoothstep(1.0, 0.85, abs(u)) * mix(1.0, smoothstep(-1.0, 0.2, -u), 0.6);
    float alpha = 1.0 - exp(-tau);
    if (alpha < 1e-4) continue;
    // Sunlight at the trail's height (dims and reddens below the horizon),
    // scattered by ice: strongly forward, with an isotropic part; plus the
    // sky's light. Haze in front from the sky model.
    vec3 skyIrradiance;
    vec3 sunIrradiance = GetSunAndSkyScalarIrradiance(p, sunDirection, skyIrradiance);
    float mu = dot(rayDirection, sunDirection);
    const float g = 0.75;
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
    float phase = (0.6 * hg + 0.4) / (4.0 * PI);
    vec3 scattered = sunIrradiance * phase + skyIrradiance / (4.0 * PI);
    vec3 transmittance;
    vec3 inscatter = GetSkyRadianceToPoint(cameraPosition, p, 0.0, sunDirection, transmittance);
    radiance = mix(radiance, inscatter + transmittance * scattered, alpha);
  }
  return radiance;
}
`

/** Patch a sky material to draw today's contrails (only the visible sky:
 * not the environment cube, whose 256² texels would turn them into
 * blocks in wet-sand reflections). */
export function patchSkyContrails(material: SkyMaterial, list: Contrail[], worldToECEF: Matrix4, bottomRadiusM: number, meterToLength: number): void {
  if (list.length === 0) return
  // transformDirection normalises: scale after.
  const toECEF = (v: Vector3): Vector3 => v.clone().transformDirection(worldToECEF)
  const dir = (azDeg: number): Vector3 => new Vector3(Math.sin((azDeg * Math.PI) / 180), 0, -Math.cos((azDeg * Math.PI) / 180))
  const pad = <T>(values: T[], filler: T): T[] => [...values, ...Array.from({ length: MAX_CONTRAILS - values.length }, () => filler)]
  const a = list.map(cr => {
    const centre = toECEF(dir(cr.bearingDeg)).multiplyScalar(cr.distanceM * meterToLength)
    return new Vector4(centre.x, centre.y, centre.z, (bottomRadiusM + cr.altitudeM) * meterToLength)
  })
  const b = list.map(cr => {
    const d = toECEF(dir(cr.headingDeg))
    return new Vector4(d.x, d.y, d.z, (cr.lengthM / 2) * meterToLength)
  })
  const c = list.map(cr => new Vector4(cr.widthM * meterToLength, cr.opticalDepth, Math.min(1, cr.ageMin / 60), cr.seed))
  Object.assign(material.uniforms, {
    contrailA: new Uniform(pad(a, new Vector4())),
    contrailB: new Uniform(pad(b, new Vector4(1, 0, 0, 0))),
    contrailC: new Uniform(pad(c, new Vector4()))
  })
  const source = material.fragmentShader
  const call = /(vec3 radiance = GetSkyRadiance\([^;]*\);)/
  if (!source.includes('vec3 getSkyRadiance(') || !call.test(source)) {
    throw new Error('patchSkyContrails: the sky shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec3 getSkyRadiance(', `${GLSL(list.length)}\nvec3 getSkyRadiance(`)
    .replace(call, '$1\n  radiance = contrails(radiance, cameraPosition, rayDirection, sunDirection, fragmentAngle);')
  material.needsUpdate = true
}
