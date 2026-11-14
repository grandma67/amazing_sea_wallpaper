import { Uniform, Vector3, Vector4, type ShaderMaterial } from 'three'

import { CLOUD_GENERA, cloudBase } from './cloudTypes'
import type { Climate } from './places'
import { dirFromAzEl, type SceneParams, type StormParams } from './params'
import { Random } from './random'
import type { Season } from './seasons'

// Where a lightning flash is (plans/CLOUD_ILLUMINATION.md).
//
// A negative cloud-to-ground flash starts at the lower edge of the storm's
// main negative charge, at about −10 to −20 °C (graupel charges negatively
// below ~−15 °C). From there a stepped leader runs sideways for kilometres
// inside the cloud, branching, then leaves the base and steps to the ground;
// the return stroke lights the whole path, inside the cloud too (IEEE
// TechNav; NAP, The Earth's Electrical Environment; Surv. Geophys. 2013
// review). So the flash's light comes from a channel that starts kilometres
// up and off to one side of where the bolt leaves the base, as in night
// photos of a storm lit from inside.

/**
 * Height of the −15 °C level (m above the sea) in a storm, by climate and
 * season: the freezing level + 15 K / 6.5 K km⁻¹ (≈ + 2.3 km). Anchors: the
 * tropical freezing level, ~4.8–5 km all year; Japan's winter lightning,
 * −10 °C at 1–2.8 km (IEEJ 2018, URSI AP 2025). The rest interpolated
 * (estimate).
 */
export const CHARGE_HEIGHT_M: Record<Climate, { summer: number; mid: number; winter: number }> = {
  tropical: { summer: 7000, mid: 7000, winter: 6800 },
  subtropical: { summer: 6600, mid: 5800, winter: 4600 },
  arid: { summer: 6500, mid: 5500, winter: 4200 },
  mediterranean: { summer: 6000, mid: 5000, winter: 3600 },
  temperate: { summer: 5500, mid: 4500, winter: 3000 },
  boreal: { summer: 5000, mid: 3800, winter: 2600 },
  polar: { summer: 4200, mid: 3200, winter: 2400 }
}

export function chargeHeightM(climate: Climate, season: Season): number {
  const row = CHARGE_HEIGHT_M[climate]
  return season === 'summer' ? row.summer : season === 'winter' ? row.winter : row.mid
}

/** A spec's forcing of the flash's origin (all bolts). */
export interface LightningForce {
  /** Horizontal distance from where the bolt leaves the base (km). */
  offsetKm?: number
  /** Compass bearing from the exit to the origin (deg). */
  azimuthDeg?: number
  /** Origin height (m above the sea). */
  originM?: number
}

/** Where a flash started, relative to its bolt's exit from the cloud base. */
export interface FlashOrigin {
  offsetM: number
  azimuthDeg: number
  heightM: number
}

/** The ordinary CG's offset from its start to its exit (m): bolts from the
 * blue reach 1–17 km (Edens); an ordinary flash a few km (estimate). */
export const ORIGIN_OFFSET_M: [number, number] = [500, 3000]

/** The Cb layer's bottom and top (m above the sea). */
function cbLayer(formations: SceneParams['weather']['formations']): [number, number] {
  const key = formations.find(f => CLOUD_GENERA[f].genus === 'cumulonimbus')
  const base = cloudBase(formations, 'cumulonimbus')
  return [base, base + (key != null ? CLOUD_GENERA[key].height : 9500)]
}

/**
 * Each bolt's origin, on its own stream (the draws are made whatever the
 * force, so forcing changes nothing else). The height is the −15 °C level,
 * kept 300 m above the base and 1.5 km under the Cb's top.
 */
export function flashOriginsFor(
  storm: StormParams,
  formations: SceneParams['weather']['formations'],
  climate: Climate,
  season: Season,
  rng: Random,
  force?: LightningForce
): FlashOrigin[] {
  const [base, top] = cbLayer(formations)
  const height = Math.min(Math.max(chargeHeightM(climate, season), base + 300), top - 1500)
  return storm.bolts.map(() => {
    const offsetM = rng.range(...ORIGIN_OFFSET_M)
    const azimuthDeg = rng.range(0, 360)
    return {
      offsetM: force?.offsetKm != null ? force.offsetKm * 1000 : offsetM,
      azimuthDeg: force?.azimuthDeg ?? azimuthDeg,
      heightM: force?.originM ?? height
    }
  })
}

/** One flash's channel in the world. */
export interface Flash {
  /** Where the bolt leaves the cloud base (its visible channel starts here). */
  exit: Vector3
  /** Where the flash started, in the charge region. */
  origin: Vector3
  /** The channel inside the cloud, origin first, exit last. */
  inCloud: Vector3[]
  /** Branches off the sideways part, each a path from the channel. */
  branches: Vector3[][]
  /** Light sources along the channel: position and share of the flash's
   * light (the shares add to 1). */
  lights: { position: Vector3; share: number }[]
}

/** Where the bolt's ground point is (world, y = 0). */
export function boltGround(strike: StormParams['bolts'][number], camera: Vector3): Vector3 {
  const [dx, , dz] = dirFromAzEl(strike.azimuthDeg, 0)
  return new Vector3(camera.x + dx * strike.distance, 0, camera.z + dz * strike.distance)
}

/** The bolt mesh's stream (props/storm.ts): its first draw sets how far
 * above the base the visible channel starts. */
export function boltRandom(params: Pick<SceneParams, 'seed'>, strike: StormParams['bolts'][number]): Random {
  return new Random(`${params.seed}/bolt/${strike.seed}`)
}

/** The exit's height above the base (m): the bolt stream's first draw. */
export function exitLift(params: Pick<SceneParams, 'seed'>, strike: StormParams['bolts'][number]): number {
  return boltRandom(params, strike).range(0, 200)
}

/** The storm cell over a bolt (stormCells.ts): radius 3.5 km + 10% of the
 * distance, centred between the strike and the flash's origin and widened by
 * half their offset, so both lie in its full-weather core (≤ 0.45 of the
 * radius). */
export function boltCell(strike: StormParams['bolts'][number], origin: FlashOrigin | undefined, camera: Vector3): { x: number; z: number; radius: number } {
  const ground = boltGround(strike, camera)
  const cell = { x: ground.x, z: ground.z, radius: 3500 + strike.distance * 0.1 }
  if (origin != null && origin.offsetM > 0) {
    const [ox, , oz] = dirFromAzEl(origin.azimuthDeg, 0)
    cell.x += (ox * origin.offsetM) / 2
    cell.z += (oz * origin.offsetM) / 2
    cell.radius += origin.offsetM / 2
  }
  return cell
}

/** How far from its cell's centre the channel may run (share of the radius):
 * inside the full-weather core with room for the map's ragged edge. */
const CHANNEL_REACH = 0.38

/** Midpoint displacement of origin → end, in every direction across it. */
function jagged(rng: Random, from: Vector3, to: Vector3, roughness: number, depth: number): Vector3[] {
  let points = [from, to]
  for (let level = 0; level < depth; level++) {
    const next: Vector3[] = [points[0]]
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const c = points[i + 1]
      const length = a.distanceTo(c)
      const mid = a.clone().lerp(c, rng.range(0.4, 0.6))
      mid.x += rng.normal(0, length * roughness)
      mid.z += rng.normal(0, length * roughness)
      mid.y += rng.normal(0, length * roughness * 0.3)
      next.push(mid, c)
    }
    points = next
  }
  return points
}

/** Points every `step` of the way along a path (by length), start and end included. */
function alongPath(path: Vector3[], count: number): Vector3[] {
  const lengths = [0]
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]))
  const total = lengths[lengths.length - 1]
  const out: Vector3[] = []
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1)
    let i = 1
    while (i < path.length - 1 && lengths[i] < target) i++
    const t = (target - lengths[i - 1]) / Math.max(lengths[i] - lengths[i - 1], 1e-6)
    out.push(path[i - 1].clone().lerp(path[i], Math.min(Math.max(t, 0), 1)))
  }
  return out
}

/**
 * The flash's lights: two low in the channel just inside the cloud (150 and
 * 450 m above the Cb's base: the depth that sets the lit patch's size), where the return stroke is brightest and which light
 * the patch on the base round the bolt (a light at depth d lights a spot of
 * radius ~d), and the rest spread along the channel above (estimate).
 */
export const LOW_LIGHTS: readonly { aboveM: number; share: number }[] = [
  { aboveM: 150, share: 0.2 },
  { aboveM: 450, share: 0.15 }
]
/** Lights along the rest of the channel, from the origin down. */
export const PATH_LIGHTS = 4
/** Lights per flash. */
export const LIGHTS_PER_FLASH = LOW_LIGHTS.length + PATH_LIGHTS

/** The first point along `path` (walked from its end) at height `y` or above. */
function pointAt(path: Vector3[], y: number): Vector3 {
  for (let i = path.length - 2; i >= 0; i--) {
    if (path[i].y >= y) {
      const a = path[i + 1]
      const b = path[i]
      const t = (y - a.y) / Math.max(b.y - a.y, 1e-6)
      return a.clone().lerp(b, Math.min(Math.max(t, 0), 1))
    }
  }
  return path[0].clone()
}

/**
 * Each bolt's flash in the world (params.storm.bolts order). The channel
 * runs sideways at the origin's height for 60% of the way, then down to the
 * exit; 1–3 branches leave the sideways part.
 */
export function lightningFor(params: SceneParams, camera: Vector3): Flash[] {
  const storm = params.storm
  if (storm == null) return []
  const base = cloudBase(params.weather.formations, 'cumulonimbus')
  return storm.bolts.map((strike, i) => {
    const ground = boltGround(strike, camera)
    const exit = ground.clone().setY(base + exitLift(params, strike))
    const o = storm.origins?.[i] ?? { offsetM: 0, azimuthDeg: 0, heightM: base + 300 }
    const [ox, , oz] = dirFromAzEl(o.azimuthDeg, 0)
    const origin = new Vector3(exit.x + ox * o.offsetM, Math.max(o.heightM, exit.y + 50), exit.z + oz * o.offsetM)
    const rng = new Random(`${params.seed}/flash/${strike.seed}`)
    const corner = origin.clone().lerp(exit, 0.6).setY(origin.y - rng.range(0, 0.15) * (origin.y - exit.y))
    const sideways = jagged(rng, origin, corner, 0.12, 4)
    const down = jagged(rng, corner, exit, 0.12, 4)
    const inCloud = [...sideways, ...down.slice(1)]
    const branches = Array.from({ length: rng.int(1, 3) }, () => {
      const start = sideways[rng.int(1, sideways.length - 1)]
      const length = rng.range(500, 1500)
      const az = rng.range(0, 360)
      const [bx, , bz] = dirFromAzEl(az, 0)
      const end = start.clone().add(new Vector3(bx * length, -length * rng.range(0, 0.6), bz * length))
      end.y = Math.max(end.y, base + 50)
      return jagged(rng, start, end, 0.25, 2)
    })
    // Keep the channel inside its cell's dense core.
    const cell = boltCell(strike, o, camera)
    const reach = CHANNEL_REACH * cell.radius
    for (const v of [...inCloud, ...branches.flat()]) {
      const dx = v.x - cell.x
      const dz = v.z - cell.z
      const d = Math.hypot(dx, dz)
      if (d > reach) {
        v.x = cell.x + (dx * reach) / d
        v.z = cell.z + (dz * reach) / d
      }
    }
    const lowShare = LOW_LIGHTS.reduce((sum, l) => sum + l.share, 0)
    // The path lights skip the channel's lowest stretch, which the low lights carry.
    const upper = inCloud.filter(v => v.y - base > LOW_LIGHTS[LOW_LIGHTS.length - 1].aboveM + 150)
    const lights = [
      ...alongPath(upper.length >= 2 ? upper : inCloud, PATH_LIGHTS).map(position => ({ position, share: (1 - lowShare) / PATH_LIGHTS })),
      // Below the exit (the mesh starts its channel up to 200 m inside the
      // cloud) the channel runs on down through the base: the light sits there.
      ...LOW_LIGHTS.map(l => ({ position: base + l.aboveM >= exit.y ? pointAt(inCloud, base + l.aboveM) : exit.clone().setY(base + l.aboveM), share: l.share }))
    ]
    return { exit, origin, inCloud, branches, lights }
  })
}

// --- How bright (phase 2) ---------------------------------------------------
//
// One rule for every hour: a flash's real energy, caught over the shutter a
// photographer would use for the scene's real (ambient) light, set against
// that light. Midday, twilight and night differ only through the ambient
// luminance; nothing here knows the time of day.

/**
 * The flash. A first return stroke radiates 2.3 ± 1.8·10⁹ W at peak in
 * 0.4–1.1 µm (Guo & Krider 1982), ~20 kJ to ~4·10⁵ J a stroke (Sandia 2023;
 * Guo & Krider's peak × width); at ~150 lm/W for that band (estimate: about
 * half of it visible, in the N II and Hα lines) that is ~10⁶–10⁸ lm·s, the
 * geometric middle 10⁷. A flash has 3–4 strokes over ~0.3 s. The glow's
 * colour is sampled from a night photo of a lit storm (linear, Hα + N II).
 */
export const FLASH = {
  /** Luminous energy of one stroke (lm·s). */
  strokeLmS: 1e7,
  /** Strokes in a flash. */
  strokes: 3.5,
  /** How long a flash lasts (s). */
  flashS: 0.3,
  /** The glow in the cloud (linear RGB, luma ~0.78). */
  colour: [1, 0.7, 0.74] as [number, number, number]
}

/** A reflected-light meter at f/2.8, ISO 1600 puts L (cd/m²) at mid-grey with
 * a shutter of 0.061 / L s (frameMeter.ts SHUTTER_PER_INV_CD). */
const METER_AT_2_8_ISO_1600 = 0.061
const APERTURE = 8
const ISO_MIN = 100
const ISO_MAX = 3200
const SHUTTER_MAX = 30

/**
 * The shutter (s) a photographer uses for the scene's ambient luminance (cd/m²
 * at mid-grey, without the flash: lightning can't be metered): f/8, ISO 100,
 * raised to at most 3200 only once the shutter would pass 30 s, capped at 30 s.
 */
export function flashShutter(ambientCd: number): number {
  const at = (iso: number): number => (METER_AT_2_8_ISO_1600 * (APERTURE / 2.8) ** 2 * (1600 / iso)) / Math.max(ambientCd, 1e-12)
  const low = at(ISO_MIN)
  if (low <= SHUTTER_MAX) return low
  const iso = Math.min(ISO_MAX, (ISO_MIN * low) / SHUTTER_MAX)
  return Math.min(at(iso), SHUTTER_MAX)
}

/** How fast one stroke's light dies away (s): the return stroke and the
 * start of its continuing current (Guo & Krider: strokes ~160 µs wide;
 * estimate with the current). */
export const STROKE_S = 5e-4

/**
 * The flash's light as the image holds it (lm): the luminous energy caught in
 * the shutter over the shutter. The frame shows a bolt, so it holds a stroke
 * (all of it once the shutter is longer than the stroke) and, on average, the
 * share of the flash's other strokes that fall in the window.
 */
export function flashPower(shutterS: number): number {
  const stroke = FLASH.strokeLmS * (1 - Math.exp(-shutterS / STROKE_S))
  const others = FLASH.strokeLmS * (FLASH.strokes - 1) * Math.min(1, shutterS / FLASH.flashS)
  return (stroke + others) / shutterS
}

/** Nearest a light is taken to be (m): the channel's own glow. */
export const GLOW_MIN_M = 60
/** The share of the dipole's d / r kept on a cloud wall seen from the side
 * (estimate). */
export const GLOW_SIDE = 0.3
/** How far the light spreads in the cloud before it has leaked out of its
 * faces (m, estimate: a Cb cell is 5–10 km across). */
export const GLOW_REACH_M = 4000

/**
 * The cloud's luminance (cd/m²) at `point` from a light of power P (lm) at
 * `source` inside it. Diffusion from a point at depth d under a thick cloud's
 * face leaves it as M = P·d / (2π r³) (the dipole) when that face is the only
 * one; a cloud loses about half through its base, so L = M / π / 2 =
 * P·c / (4π² r²) with c = |Δy| / r (the base seen from below), at least
 * GLOW_SIDE on walls, fading over GLOW_REACH_M. The cloud shader adds the same
 * term (patchCloudsFlash).
 */
export function flashGlowCd(powerLm: number, source: Vector3, point: Vector3): number {
  const r = Math.max(source.distanceTo(point), GLOW_MIN_M)
  const c = Math.min(Math.max(Math.abs(point.y - source.y) / r, GLOW_SIDE), 1)
  return ((powerLm * c) / (4 * Math.PI ** 2 * r * r)) * Math.exp(-r / GLOW_REACH_M)
}

// --- The cloud lit from inside (phase 3) ------------------------------------

/** Bolts lit in the clouds, and lights per bolt (flashLights is MAX × LIGHTS). */
export const MAX_FLASHES = 3
const LIGHTS = LIGHTS_PER_FLASH
/** Past this distance from a bolt's channel the glow is < 1% by day (m). */
const BOUND_M = 8000

/** What the clouds' shader needs: lights in the world (xyz; the march's
 * sample is taken there, as cloudShapes.ts does) with power in render units
 * (w, the cd/m² kernel's P × the render units per cd/m²), each bolt's
 * bounding sphere, and the glow's colour (luma 1). */
export interface FlashSky {
  /** The Cb's base (m): the face is the first cloud a ray meets at or above
   * it (scud and fractus below the base aren't the storm's face). */
  baseM: number
  /** Debug: a fixed face glow (render units) instead of the lights', to read
   * what the march passes on (params.debug.flash.constant). */
  constant?: number
  lights: Vector4[]
  bounds: Vector4[]
  count: number
  colour: [number, number, number]
}

/**
 * The flashes for the clouds' shader: `powerLm` the light the image holds
 * (flashPower), `renderPerCd` render units per cd/m² (renderPerLux), `scale`
 * a debug factor, `only` the light indices kept (debug).
 */
export function flashSky(flashes: Flash[], baseM: number, powerLm: number, renderPerCd: number, scale = 1, only?: number[]): FlashSky | null {
  if (flashes.length === 0 || !(powerLm > 0)) return null
  const used = flashes.slice(0, MAX_FLASHES)
  const lights: Vector4[] = []
  const bounds: Vector4[] = []
  for (const f of used) {
    f.lights.forEach((l, k) => {
      const p = l.position
      const keep = only == null || only.includes(k)
      lights.push(new Vector4(p.x, p.y, p.z, keep ? powerLm * l.share * renderPerCd * scale : 0))
    })
    const centre = f.origin.clone().add(f.exit).multiplyScalar(0.5)
    const c = centre
    bounds.push(new Vector4(c.x, c.y, c.z, BOUND_M + 0.5 * f.origin.distanceTo(f.exit)))
  }
  while (lights.length < MAX_FLASHES * LIGHTS) lights.push(new Vector4(0, 0, 0, 0))
  while (bounds.length < MAX_FLASHES) bounds.push(new Vector4(0, 0, 0, 0))
  const luma = 0.2126 * FLASH.colour[0] + 0.7152 * FLASH.colour[1] + 0.0722 * FLASH.colour[2]
  return { baseM, lights, bounds, count: used.length, colour: FLASH.colour.map(c => c / luma) as [number, number, number] }
}

const f = (x: number): string => x.toFixed(6)

/** The kernel of flashGlowCd in GLSL, summed over the lights near a sample. */
const FLASH_GLSL = /* glsl */ `
uniform vec4 flashLights[${MAX_FLASHES * LIGHTS}];
uniform vec4 flashBounds[${MAX_FLASHES}];
uniform int flashCount;
uniform vec3 flashColour;
uniform float flashFaceHeight;
uniform float flashConstant;
// The glow where the ray first entered cloud (its visible face): a real
// cloud is opaque within tens of metres, takram's within kilometres, so the
// face's luminance is taken there and carried along the ray (patchCloudsFlash).
vec3 flashFaceGlow;
bool flashEntered;
vec3 flashGlow(const vec3 ecef) {
  // The sample in the world (y up), as cloudShapes.ts reads it.
  vec3 p = (ecefToWorldMatrix * vec4(ecef - altitudeCorrection, 1.0)).xyz;
  float sum = 0.0;
  for (int b = 0; b < ${MAX_FLASHES}; b++) {
    if (b >= flashCount) break;
    vec4 bound = flashBounds[b];
    if (distance(p, bound.xyz) > bound.w) continue;
    for (int k = 0; k < ${LIGHTS}; k++) {
      vec4 l = flashLights[b * ${LIGHTS} + k];
      float r = max(distance(p, l.xyz), ${f(GLOW_MIN_M)});
      float c = clamp(abs(p.y - l.y) / r, ${f(GLOW_SIDE)}, 1.0);
      sum += l.w * c / (${f(4 * Math.PI ** 2)} * r * r) * exp(-r / ${f(GLOW_REACH_M)});
    }
  }
  return flashColour * sum;
}
`

/** The line of takram's marchClouds the flash's light is added after (the
 * sky light, before the sum is multiplied by the scattering). */
const SKY_LINE = 'radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;'
/** The end of takram's powder term (darker thin edges toward the sun: a look
 * for sunlight, not for a light inside the cloud): the flash is added after it. */
const POWDER_END = '      #endif // POWDER\n'
/** Where marchClouds sets up its sums (the march's start). */
const MARCH_START = '  float transmittanceSum = 0.0;\n'

/** Light the clouds from inside each flash's channel (flashGlowCd). */
export function patchCloudsFlash(material: ShaderMaterial, sky: FlashSky): void {
  const source = material.fragmentShader
  if (source.split(SKY_LINE).length !== 2 || source.split(MARCH_START).length !== 2 || source.split(POWDER_END).length !== 2 || !source.includes('vec4 marchClouds(')) {
    throw new Error('patchCloudsFlash: the clouds shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec4 marchClouds(', `${FLASH_GLSL}\nvec4 marchClouds(`)
    .replace(MARCH_START, `${MARCH_START}  flashEntered = false;\n`)
    .replace(
      SKY_LINE,
      `${SKY_LINE}
      // Lightning inside the cloud (lightning.ts patchCloudsFlash): the face's
      // glow, added after the powder term below.
      if (!flashEntered && height >= flashFaceHeight) {
        flashFaceGlow = flashConstant > 0.0 ? flashColour * flashConstant : flashGlow(position);
        flashEntered = true;
      }
`
    )
    .replace(POWDER_END, `${POWDER_END}      if (flashEntered) radiance += flashFaceGlow * media.scattering;\n`)
  material.uniforms.flashLights = new Uniform(sky.lights)
  material.uniforms.flashBounds = new Uniform(sky.bounds)
  material.uniforms.flashCount = new Uniform(sky.count)
  material.uniforms.flashColour = new Uniform(new Vector3(...sky.colour))
  material.uniforms.flashFaceHeight = new Uniform(sky.baseM)
  material.uniforms.flashConstant = new Uniform(sky.constant ?? 0)
  material.needsUpdate = true
}
