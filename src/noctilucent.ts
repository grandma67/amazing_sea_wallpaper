import { Uniform, Vector2 } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import type { SceneParams } from './params'
import type { Random } from './random'

// Noctilucent clouds: ice at the summer mesopause, ~82 km up, so high that
// they're still in sunlight when the sun is 6–16° below the horizon. Seen
// low in the sky toward the sun after sunset or before sunrise as electric
// blue-white streaks, billows and herring-bone waves.
//
// Where and when (NASA; NERC MST radar facility; WMO Cloud Atlas): about
// 50–65° latitude, late May to mid August in the north (late November to
// mid February in the south), most often in the weeks round the solstice,
// less often and in a shorter season the nearer the equator. In our scenes
// that's nordic coasts and the Southern Ocean, at blue hour on clear nights.
//
// Drawn in takram's sky shader: a thin layer sampled where the view ray
// meets it, lit only where the sun's ray to it clears the earth and its
// lower atmosphere, at its real (tiny) optical depth. In bright twilight it
// is lost in the sky, as it is in reality; it shows as the sky darkens.

export interface NoctilucentParams {
  /** Vertical optical depth of the brightest parts (~1e-4). */
  opticalDepth: number
  /** Azimuth the wave crests run along (deg, world). */
  bandsDeg: number
  seed: number
}

/** 0..1: how far into the season (peaks round the solstice). */
export function noctilucentSeason(month: number, day: number, southern: boolean): number {
  // Days from the solstice, through the year's end in the south.
  const doy = Math.round((Date.UTC(2001, month - 1, day) - Date.UTC(2001, 0, 1)) / 86400000)
  const solstice = southern ? 355 : 172
  let d = Math.abs(doy - solstice)
  d = Math.min(d, 365 - d)
  // Late May (−25 d) to mid August (+55 d): asymmetric, longer after.
  const after = southern ? doy < 100 || doy >= solstice : doy >= solstice
  const reach = after ? 55 : 25
  return d > reach ? 0 : 1 - (d / reach) ** 2
}

export function noctilucentFor(params: SceneParams, rng: Random, force?: boolean | null): NoctilucentParams | null {
  const [month, day] = [Number(params.date.slice(5, 7)), Number(params.date.slice(8, 10))]
  const southern = params.sea.ocean === 'southern'
  const lat = Math.abs(params.latitudeDeg)
  const band = lat < 50 || lat > 67 ? 0 : Math.min(1, (lat - 48) / 10)
  const region = params.biome.name === 'nordic' || southern ? 1 : 0
  const clearSky = ['clear', 'cirrus', 'few'].includes(params.weather.kind)
  const twilight = params.timeOfDay === 'blue-hour'
  const chance = 0.5 * noctilucentSeason(month, day, southern) * band * region * (clearSky && twilight && params.fog == null ? 1 : 0)
  const drawn = rng.float() < chance
  const out: NoctilucentParams = { opticalDepth: rng.range(0.3, 0.8) * 1e-4, bandsDeg: rng.range(0, 180), seed: rng.range(0, 100) }
  return (force === undefined ? drawn : force === true) ? out : null
}

// Nacreous (mother-of-pearl) clouds: polar stratospheric ice at 15–25 km,
// which forms only in the very cold stratosphere of polar winter (Norway,
// Iceland, the Antarctic coast). Lit while the sun is 1–6° below the horizon,
// smooth lens-like sheets glowing in pastel colours that shift with the angle
// to the sun (diffraction by uniform tiny crystals). Rare: a few evenings in
// most winters.

export interface NacreousParams {
  /** Optical depth of the sheets' cores. */
  opticalDepth: number
  seed: number
}

/** Within ~2 months of the winter solstice on Arctic and Southern Ocean
 * coasts, at blue hour (sun 1–6° down) under a clear sky: ~3%. */
export function nacreousFor(params: SceneParams, rng: Random, force?: boolean | null): NacreousParams | null {
  const month = Number(params.date.slice(5, 7))
  const winter =
    params.sea.ocean === 'arctic' ? [11, 12, 1, 2].includes(month) : params.sea.ocean === 'southern' ? [5, 6, 7, 8].includes(month) : false
  const eligible = winter && params.timeOfDay === 'blue-hour' && ['clear', 'cirrus', 'few'].includes(params.weather.kind) && params.fog == null
  const drawn = rng.float() < (eligible ? 0.03 : 0)
  const out: NacreousParams = { opticalDepth: rng.range(0.01, 0.03), seed: rng.range(0, 100) }
  return (force === undefined ? drawn : force === true) ? out : null
}

const NACREOUS_GLSL = /* glsl */ `
uniform float ncrOpticalDepth;
uniform float ncrSeed;

vec3 nacreous(const vec3 cameraPosition, const vec3 rayDirection, const vec3 sunDirection) {
  float layer = ATMOSPHERE.bottom_radius + 22.0;
  float bq = dot(cameraPosition, rayDirection);
  float cq = dot(cameraPosition, cameraPosition) - layer * layer;
  float t = -bq + sqrt(bq * bq - cq);
  vec3 p = cameraPosition + rayDirection * t;
  vec3 up = normalize(p);
  float mu = dot(up, sunDirection);
  float tangent = mu > 0.0 ? 1e9 : layer * sqrt(1.0 - mu * mu);
  float lit = smoothstep(ATMOSPHERE.bottom_radius + 3.0, ATMOSPHERE.bottom_radius + 9.0, tangent);
  if (lit <= 0.0) return vec3(0.0);
  vec3 camUp = normalize(cameraPosition);
  vec3 v = p - cameraPosition;
  vec3 local = v - camUp * dot(v, camUp);
  vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), camUp));
  vec2 q = vec2(dot(local, east), dot(local, cross(camUp, east))) + ncrSeed * 37.0;
  // A few smooth lenses, stretched along one direction, with soft rims.
  float lens = nlcFbm(vec2(q.x / 90.0, q.y / 30.0));
  float sheet = smoothstep(0.55, 0.75, lens);
  float tau = ncrOpticalDepth * sheet * (0.7 + 0.3 * nlcFbm(q / 8.0));
  float slant = 1.0 / max(dot(rayDirection, up), 0.03);
  // Iridescence: hue cycling with the angle to the sun and the sheet's
  // thickness, pastel (mixed with white).
  float angle = acos(clamp(dot(rayDirection, sunDirection), -1.0, 1.0));
  float hue = angle * 12.0 + lens * 6.0;
  vec3 iris = 0.5 + 0.5 * cos(6.2832 * (hue + vec3(0.0, 0.33, 0.67)));
  vec3 colour = mix(vec3(1.0), iris, 0.55);
  float c = dot(rayDirection, sunDirection);
  const float g = 0.7;
  float phase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5));
  vec3 sun = ATMOSPHERE.solar_irradiance * SUN_SPECTRAL_RADIANCE_TO_LUMINANCE * vec3(1.0, 0.9, 0.78);
  return sun * colour * phase * (1.0 - exp(-tau * slant)) * lit;
}
`

const GLSL = /* glsl */ `
uniform float nlcOpticalDepth;
uniform vec2 nlcBands;
uniform float nlcSeed;

float nlcHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + nlcSeed) * 43758.5453); }
float nlcNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(nlcHash(i), nlcHash(i + vec2(1.0, 0.0)), f.x), mix(nlcHash(i + vec2(0.0, 1.0)), nlcHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float nlcFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * nlcNoise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

vec3 noctilucent(const vec3 cameraPosition, const vec3 rayDirection, const vec3 sunDirection) {
  float layer = ATMOSPHERE.bottom_radius + 82.0;
  float bq = dot(cameraPosition, rayDirection);
  float cq = dot(cameraPosition, cameraPosition) - layer * layer;
  float t = -bq + sqrt(bq * bq - cq);
  vec3 p = cameraPosition + rayDirection * t;
  vec3 up = normalize(p);
  // Sunlit only if the sun's ray to the layer passes above the earth and
  // the dense lower atmosphere (~20 km); a soft edge for the shadow's blur.
  float mu = dot(up, sunDirection);
  float tangent = mu > 0.0 ? 1e9 : layer * sqrt(1.0 - mu * mu);
  float lit = smoothstep(ATMOSPHERE.bottom_radius + 12.0, ATMOSPHERE.bottom_radius + 30.0, tangent);
  if (lit <= 0.0) return vec3(0.0);
  // Pattern in km across the layer: long wave crests (bands), billows
  // across them, patchy overall.
  vec3 camUp = normalize(cameraPosition);
  vec3 v = p - cameraPosition;
  vec3 local = v - camUp * dot(v, camUp);
  vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), camUp));
  vec3 north = cross(camUp, east);
  vec2 q = vec2(dot(local, east), dot(local, north));
  vec2 along = nlcBands.xy;
  vec2 across = vec2(-along.y, along.x);
  // Crests bend and break up: a strongly warped wave field, its strength
  // itself patchy, and herring-bone billows across the crests.
  vec2 qw = q + 25.0 * vec2(nlcFbm(q / 70.0), nlcFbm(q / 70.0 + 5.2));
  float u = dot(qw, along);
  float w = dot(qw, across);
  float crests = pow(0.5 + 0.5 * sin(w / 3.5), 4.0) * (0.4 + 0.8 * nlcFbm(q / 12.0 + 7.0));
  float billows = 0.55 + 0.45 * sin(u / 1.1 + w / 1.8) * nlcFbm(q / 20.0 + 1.0);
  float wisps = nlcFbm(vec2(u / 6.0, w / 40.0));
  float patches = smoothstep(0.5, 0.75, nlcFbm(q / 150.0 + 3.0));
  float tau = nlcOpticalDepth * (0.6 * crests * billows + 0.4 * wisps * wisps) * patches;
  // Slant path through a thin layer.
  float slant = 1.0 / max(dot(rayDirection, up), 0.03);
  // Small ice grains: Mie scattering, forward-peaked.
  float c = dot(rayDirection, sunDirection);
  const float g = 0.6;
  float phase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5));
  // Sunlight reaching 82 km has passed only the ozone layer: bluish white.
  vec3 sun = ATMOSPHERE.solar_irradiance * SUN_SPECTRAL_RADIANCE_TO_LUMINANCE * vec3(0.8, 0.92, 1.0);
  return sun * phase * tau * slant * lit;
}
`

/** Patch the visible sky with today's noctilucent and nacreous clouds (not
 * the env cube). */
export function patchSkyNoctilucent(material: SkyMaterial, nlc: NoctilucentParams | null, nacreous: NacreousParams | null = null): void {
  if (nlc == null && nacreous == null) return
  const angle = ((nlc?.bandsDeg ?? 0) * Math.PI) / 180
  Object.assign(material.uniforms, {
    nlcOpticalDepth: new Uniform(nlc?.opticalDepth ?? 0),
    nlcBands: new Uniform(new Vector2(Math.sin(angle), Math.cos(angle))),
    nlcSeed: new Uniform(nlc?.seed ?? 0),
    ncrOpticalDepth: new Uniform(nacreous?.opticalDepth ?? 0),
    ncrSeed: new Uniform(nacreous?.seed ?? 0)
  })
  const source = material.fragmentShader
  const call = /(vec3 radiance = GetSkyRadiance\([^;]*\);)/
  if (!source.includes('vec3 getSkyRadiance(') || !call.test(source)) {
    throw new Error('patchSkyNoctilucent: the sky shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec3 getSkyRadiance(', `${GLSL}\n${NACREOUS_GLSL}\nvec3 getSkyRadiance(`)
    .replace(
      call,
      `$1\n  radiance += transmittance * (${nlc != null ? 'noctilucent(cameraPosition, rayDirection, sunDirection)' : 'vec3(0.0)'} + ${nacreous != null ? 'nacreous(cameraPosition, rayDirection, sunDirection)' : 'vec3(0.0)'});`
    )
  material.needsUpdate = true
}
