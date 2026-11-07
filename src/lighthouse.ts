import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat, RepeatWrapping, Uniform, Vector3, Vector4, type PerspectiveCamera } from 'three'

import { fogProfile, fogSigma } from './fogLayer'
import { dirFromAzEl, EARTH_RADIUS, type FogParams, type LighthouseParams } from './params'
import type { LanternInfo } from './props/lighthouse'
import { outlineRadius, type WaterIsland } from './props/surf'

// A lighthouse's beams, seen side-on in the haze or fog (see
// LighthouseParams), drawn in screen space from the depth buffer before
// exposure, after the fog. Each beam is a cone a few degrees wide leaving
// the lantern horizontally. For each pixel the view ray passes the beam's
// axis closest at one point; the light scattered toward us there is the
// beam's irradiance (spreading with distance) times the air's scattering
// coefficient and phase function, times the path through the beam, dimmed
// by the haze along beam and view ray. Anything nearer than that point (the
// tower, land, the sea) hides it. A beam turned toward the camera is a
// blinding flash: a glare round the lantern. Land and islands stop a beam
// where its axis meets them (beamLight): its shadow, without a shadow map.
//
// The lens turns while the shutter is open (setShutter): a beam frozen on a
// night's seconds-long exposure would hold a sweeping flash on the camera the
// whole time and white out the frame. Past SWEEP_MIN the beams are drawn as
// their time average over the shutter: each azimuth lit for its share of the
// sweep (sweptWindow, exact with erf, baked into a texture with the beam
// shadows), the light scattered along the view ray summed where the ray runs
// through the thin layer of air the beams sweep, sampled evenly in angle round
// the lantern (equiangular sampling: the 1/r² near the lamp drops out).

const MAX = 12
const DEG = Math.PI / 180
/** Half-width of a beam (rad): Fresnel panels spread it a few degrees. */
const DIVERGENCE = 2.2 * DEG
/** Gap between the beams of one group (deg). */
const GROUP_SPREAD = 10

/** Every beam's azimuth (deg, world), unscreened: groups evenly round the
 * lens, a group's flashes GROUP_SPREAD apart. */
export function beamAzimuths(light: LighthouseParams): number[] {
  const out: number[] = []
  for (let g = 0; g < light.groups; g++) {
    for (let f = 0; f < light.flashes; f++) out.push(light.beamAzimuthDeg + (g * 360) / light.groups + (f - (light.flashes - 1) / 2) * GROUP_SPREAD)
  }
  return out
}

/** Degrees from azimuth a to b, 0–180. */
function azimuthOff(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180)
}

/** A point's lens is shaded on the landward side: no light more than this
 * far (deg) from seaward. */
const SCREEN = 110
/** Half-width (deg) of the shade's soft edge on swept beams: a ~0.4 m lamp
 * ~1 m behind the shade gives a ~20° penumbra (estimate). Frozen beams keep
 * the hard cut (beamDirections). */
const SCREEN_EDGE = 6

/** How much of a point's light passes the landward shade at this azimuth. */
function screenAt(azimuthDeg: number, seawardAzimuthDeg: number | null): number {
  if (seawardAzimuthDeg == null) return 1
  const x = Math.min(1, Math.max(0, (SCREEN + SCREEN_EDGE - azimuthOff(azimuthDeg, seawardAzimuthDeg)) / (2 * SCREEN_EDGE)))
  return x * x * (3 - 2 * x)
}

/** Unit beam directions, screened landward on a point. */
export function beamDirections(light: LighthouseParams, seawardAzimuthDeg: number | null): Vector3[] {
  return beamAzimuths(light)
    .filter(az => seawardAzimuthDeg == null || azimuthOff(az, seawardAzimuthDeg) <= SCREEN)
    .map(az => new Vector3(...dirFromAzEl(az, 0)))
    .slice(0, MAX)
}

/** One turn of the lens (s). A lens shows one group per panel group per turn,
 * so a turn is the chart period times the groups (the Cuckolds, Fl(2) 6s:
 * two lit panels, one turn in 6 s; USLHS "Lens rotation"). */
export function lensTurnSeconds(light: LighthouseParams): number {
  return light.periodS * light.groups
}

/** How far the lens turns (rad) while the shutter is open. */
export function sweepAngle(light: LighthouseParams, shutterSeconds: number): number {
  return (2 * Math.PI * Math.max(0, shutterSeconds)) / lensTurnSeconds(light)
}

/** Under this sweep (rad) a beam is drawn frozen, as before: dusk and
 * blue-hour shutters of milliseconds turn the lens < 0.5°. */
export const SWEEP_MIN = 0.5 * DIVERGENCE

/** Azimuth columns of the swept beams' texture (0.5°: a beam is 2.2° wide). */
export const WINDOW_SIZE = 720

/**
 * The beams' azimuth profile averaged over a sweep (rad) centred on the
 * frame's beam azimuths: at each azimuth (deg), the time-average of
 * Σ exp(−(Δ / DIVERGENCE)²) as the lens turns, as a share of a beam's peak.
 * A beam passing over takes √π·DIVERGENCE / sweep of it; whole turns light
 * every azimuth alike, the part turn past them is centred on the beam. Zero
 * on a point's landward side (seawardAzimuthDeg), through a soft edge
 * (SCREEN_EDGE). As the sweep shrinks it
 * becomes the frozen profile; over a turn it sums to √π·DIVERGENCE per beam.
 */
export function sweptWindow(light: LighthouseParams, seawardAzimuthDeg: number | null, sweep: number, azimuthsDeg: readonly number[]): number[] {
  const beams = beamAzimuths(light)
  const turns = Math.floor(sweep / (2 * Math.PI))
  const part = sweep - turns * 2 * Math.PI
  const erf = (x: number): number => 1 - erfc(x)
  return azimuthsDeg.map(az => {
    const screen = screenAt(az, seawardAzimuthDeg)
    if (screen === 0) return 0
    let sum = 0
    for (const b of beams) {
      const delta = (((((az - b) % 360) + 540) % 360) - 180) * DEG
      let partial = 0
      for (let k = -1; k <= 1; k++) {
        const x = delta + k * 2 * Math.PI
        partial += erf((x + part / 2) / DIVERGENCE) - erf((x - part / 2) / DIVERGENCE)
      }
      sum += (DIVERGENCE / sweep) * Math.sqrt(Math.PI) * (turns + partial / 2)
    }
    return sum * screen
  })
}

/** Beams run at most this far (m): past it the haze has taken them. */
export const BEAM_MAX = 8000
const BEAM_STEP = 10
/** Samples of each beam's lit share, log-spaced from BEAM_NEAR to BEAM_MAX
 * (four to a vec4 uniform). */
export const BEAM_SAMPLES = 16
const BEAM_NEAR = 25

/** Distance (m) along a beam of sample k. */
export function beamSampleAt(k: number): number {
  return BEAM_NEAR * (BEAM_MAX / BEAM_NEAR) ** (k / (BEAM_SAMPLES - 1))
}

/** erfc, to 1.5e-7 (Abramowitz and Stegun 7.1.26). */
function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * z)
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z)
  return x >= 0 ? e : 2 - e
}

/**
 * How much of each beam is still lit along it (SHADOWS.md phase 5): its
 * shadow, without a shadow map, since the lantern is a point and each beam
 * a fan of rays round a horizontal axis. Walking out from the lamp, the
 * highest angle of anything passed (land, the sea's surface, an island's
 * top) is a horizon; the share of the beam above it is lit. The shader
 * draws a beam's profile as exp(−(angle / DIVERGENCE)²), so that share is
 * ½ erfc(horizon / DIVERGENCE): the sea takes the lower half bit by bit
 * (all of it only at the horizon), a cliff stops it at once, a rising slope
 * eats it from below. Ground and sea drop with the earth's curve as the
 * terrain mesh does. From world positions only: a moving camera sees the
 * same. BEAM_SAMPLES values per beam at beamSampleAt(k).
 */
export function beamLight(
  lantern: Vector3,
  beams: readonly Vector3[],
  ground: (x: number, z: number) => number,
  islands: readonly WaterIsland[] = []
): number[][] {
  const drop = (x: number, z: number): number => (0.9 * (x * x + z * z)) / (2 * EARTH_RADIUS)
  return beams.map(b => {
    const lit: number[] = []
    let horizon = -Math.PI / 2
    let k = 0
    for (let t = BEAM_STEP; k < BEAM_SAMPLES; t += BEAM_STEP) {
      const x = lantern.x + b.x * t
      const z = lantern.z + b.z * t
      let land = Math.max(ground(x, z), 0)
      for (const island of islands) {
        const dx = x - island.x
        const dz = z - island.z
        if (Math.hypot(dx, dz) < outlineRadius(island.outline, Math.atan2(dz, dx))) land = Math.max(land, island.top)
      }
      horizon = Math.max(horizon, Math.atan2(land - drop(x, z) - lantern.y, t))
      while (k < BEAM_SAMPLES && beamSampleAt(k) <= t + BEAM_STEP) {
        lit.push(0.5 * erfc(horizon / DIVERGENCE))
        k++
      }
    }
    return lit
  })
}

/** Samples along each stretch of a view ray in the swept beams' layer,
 * offset per pixel and frame (interleaved gradient noise) so the edges of a
 * sweep or the shade leave grain, not bands. */
const SWEEP_STEPS = 32
/** Half-thickness of that layer, as a slope from the lantern: 3.2 beam widths,
 * past which a beam's profile is < 4e-5. */
const SLAB = Math.tan(3.2 * DIVERGENCE)
/** Azimuths the beam shadows are marched along for the swept beams (5°). */
const LIT_AZIMUTHS = 72

export class LighthouseBeamEffect extends Effect {
  private readonly light: LighthouseParams
  private readonly lanternInfo: LanternInfo
  private readonly ground: ((x: number, z: number) => number) | null
  private readonly islands: readonly WaterIsland[]
  private readonly eyeAt: Vector3
  /** The swept beams' time-averaged profile × lit share: azimuth across,
   * distance (BEAM_SAMPLES rows) down. Disposed with the effect. */
  readonly window: DataTexture
  private litTable: number[][] | null = null

  constructor(
    light: LighthouseParams,
    lantern: LanternInfo,
    fog: FogParams | null,
    camera: PerspectiveCamera,
    /** Beam brightness in the scene's radiance units. */
    power: number,
    /** Land the beams meet (beamLight); none: every beam lit all the way
     * (passes.beamShadow off, as before phase 5). */
    ground: ((x: number, z: number) => number) | null = null,
    islands: readonly WaterIsland[] = []
  ) {
    const directions = beamDirections(light, lantern.seawardAzimuthDeg)
    const beams = directions.map(b => new Vector4(b.x, b.y, b.z, 1))
    // Each beam's lit share along it (beamLight), four samples to a vec4.
    const lit = ground == null ? [] : beamLight(lantern.position, directions, ground, islands)
    const shares: Vector4[] = []
    for (let i = 0; i < MAX; i++) {
      const row = lit[i] ?? Array<number>(BEAM_SAMPLES).fill(1)
      for (let q = 0; q < BEAM_SAMPLES; q += 4) shares.push(new Vector4(row[q], row[q + 1], row[q + 2], row[q + 3]))
    }
    const count = beams.length
    while (beams.length < MAX) beams.push(new Vector4(0, 0, 1, 0))
    const window = new DataTexture(new Uint16Array(WINDOW_SIZE * BEAM_SAMPLES), WINDOW_SIZE, BEAM_SAMPLES, RedFormat, HalfFloatType)
    window.wrapS = RepeatWrapping
    window.wrapT = ClampToEdgeWrapping
    window.magFilter = LinearFilter
    window.minFilter = LinearFilter
    window.generateMipmaps = false
    window.needsUpdate = true
    super(
      'LighthouseBeamEffect',
      /* glsl */ `
      uniform mat4 cameraWorld;
      uniform mat4 projectionInverse;
      uniform vec3 eye;
      uniform vec3 lantern;
      uniform vec4 beams[${MAX}];
      uniform vec4 beamLit[${(MAX * BEAM_SAMPLES) / 4}];
      // Beam i's lit share at distance t (beamLight), between log-spaced samples.
      float litAt(int i, float t) {
        float f = clamp(log(max(t, ${BEAM_NEAR}.0) / ${BEAM_NEAR}.0) / log(${BEAM_MAX / BEAM_NEAR}.0) * ${BEAM_SAMPLES - 1}.0, 0.0, ${BEAM_SAMPLES - 1}.0);
        int k = int(floor(f));
        int k1 = min(k + 1, ${BEAM_SAMPLES - 1});
        float a = beamLit[(i * ${BEAM_SAMPLES} + k) / 4][(i * ${BEAM_SAMPLES} + k) % 4];
        float b = beamLit[(i * ${BEAM_SAMPLES} + k1) / 4][(i * ${BEAM_SAMPLES} + k1) % 4];
        return mix(a, b, f - float(k));
      }
      uniform int count;
      uniform float power;
      uniform float haze;
      uniform float fogSigma;
      uniform float fogBase;
      uniform float fogFade;
      uniform float fogStart;
      uniform float tanDivergence;

      float hg(float c, float g) {
        return (1.0 - g * g) / (4.0 * 3.14159265 * pow(1.0 + g * g - 2.0 * g * c, 1.5));
      }
      // Scattering coefficient of the air at p: sea haze, plus the fog layer
      // (fogLayer.ts: uniform up to its base, fading above; from where a
      // bank starts).
      float sigmaAt(vec3 p) {
        float fog = fogSigma * exp(-max(p.y - fogBase, 0.0) / fogFade) * step(fogStart, length(p.xz - eye.xz));
        return haze + fog;
      }

      // The lens turning over the shutter (setShutter): the beams averaged.
      uniform bool swept;
      uniform sampler2D sweptWindow;
      uniform float sweptFlash;
      uniform float sweptJitter;
      float phaseAt(float c) {
        return mix(hg(c, 0.55), hg(c, 0.8), clamp(fogSigma / (fogSigma + haze * 20.0), 0.0, 1.0));
      }
      // The swept beams' light along the view ray from s1 to s2, sampled
      // evenly in angle round the lantern (h0: eye − lantern; s0 and d: the
      // ray's closest approach to it). Irradiance as a frozen beam's,
      // exp(−(angle / divergence)²) / w², with the azimuth part time-averaged.
      vec3 sweptSegment(vec3 dir, vec3 h0, float s0, float d, float s1, float s2, float sigmaLantern, float sigmaEye) {
        if (s2 <= s1) return vec3(0.0);
        float t1 = atan((s1 - s0) / d);
        float t2 = atan((s2 - s0) / d);
        float dt = (t2 - t1) / ${SWEEP_STEPS}.0;
        float offset = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + sweptJitter);
        float sum = 0.0;
        for (int j = 0; j < ${SWEEP_STEPS}; j++) {
          float th = t1 + (float(j) + offset) * dt;
          float s = s0 + d * tan(th);
          vec3 h = h0 + dir * s;
          float r2 = d * d + (s - s0) * (s - s0);
          float r = sqrt(r2);
          float el = asin(clamp(h.y / r, -1.0, 1.0)) / ${DIVERGENCE.toFixed(8)};
          float az = atan(h.x, -h.z);
          float f = clamp(log(max(r, ${BEAM_NEAR}.0) / ${BEAM_NEAR}.0) / log(${BEAM_MAX / BEAM_NEAR}.0) * ${BEAM_SAMPLES - 1}.0, 0.0, ${BEAM_SAMPLES - 1}.0);
          float window = texture2D(sweptWindow, vec2(az / 6.28318531 + ${(0.5 / WINDOW_SIZE).toFixed(8)}, (f + 0.5) / ${BEAM_SAMPLES}.0)).r;
          float w = 0.6 + r * tanDivergence;
          float sigma = sigmaAt(eye + dir * s);
          float extinction = 0.5 * (sigma + sigmaLantern) * r + 0.5 * (sigma + sigmaEye) * s;
          // ds = r² / d dθ: the 1/r² of the irradiance drops out.
          sum += sigma * phaseAt(dot(h / r, -dir)) * window * exp(-el * el) * exp(-extinction) * r2 / (w * w * d);
        }
        return vec3(sum * dt * power);
      }
      // Where the view ray runs through the beams' layer (|y − lantern| ≤
      // SLAB × horizontal distance, a double cone round the lantern: up to two
      // stretches) within BEAM_MAX of the lantern and short of the scene.
      vec3 sweptLight(vec3 dir, float sceneDistance, float sigmaLantern, float sigmaEye) {
        vec3 h0 = eye - lantern;
        float s0 = -dot(h0, dir);
        float d = max(length(h0 + dir * s0), 0.3);
        float reach = sqrt(max(${BEAM_MAX * BEAM_MAX}.0 - d * d, 0.0));
        float a = max(0.0, s0 - reach);
        float b = min(sceneDistance, s0 + reach);
        if (b <= a) return vec3(0.0);
        float k2 = ${(SLAB * SLAB).toFixed(8)};
        float qa = dir.y * dir.y - k2 * (dir.x * dir.x + dir.z * dir.z);
        float qb = 2.0 * (h0.y * dir.y - k2 * (h0.x * dir.x + h0.z * dir.z));
        float qc = h0.y * h0.y - k2 * (h0.x * h0.x + h0.z * h0.z);
        float disc = qb * qb - 4.0 * qa * qc;
        vec4 span = vec4(a, b, 1.0, 0.0);
        if (abs(qa) < 1e-6) {
          if (abs(qb) < 1e-9) { if (qc > 0.0) return vec3(0.0); }
          else if (qb > 0.0) span.y = min(b, -qc / qb);
          else span.x = max(a, -qc / qb);
        } else if (qa > 0.0) {
          if (disc <= 0.0) return vec3(0.0);
          float q = sqrt(disc);
          span.xy = vec2(max(a, (-qb - q) / (2.0 * qa)), min(b, (-qb + q) / (2.0 * qa)));
        } else if (disc > 0.0) {
          float q = sqrt(disc);
          span = vec4(a, min(b, (-qb + q) / (2.0 * qa)), max(a, (-qb - q) / (2.0 * qa)), b);
        }
        vec3 near = sweptSegment(dir, h0, s0, d, span.x, span.y, sigmaLantern, sigmaEye);
        return near + sweptSegment(dir, h0, s0, d, span.z, span.w, sigmaLantern, sigmaEye);
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        vec4 view = projectionInverse * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 viewDir = normalize(view.xyz / view.w);
        vec3 dir = normalize((cameraWorld * vec4(viewDir, 0.0)).xyz);
        float sceneDistance = depth >= 0.9999 ? 1e5 : getViewZ(depth) / viewDir.z;
        vec3 r = eye - lantern;
        float toLantern = length(r);
        // Fog and haze between us and the lantern.
        float sigmaLantern = sigmaAt(lantern);
        float sigmaEye = sigmaAt(eye);
        vec3 light = vec3(0.0);
        float flash = 0.0;
        if (swept) {
          light = sweptLight(dir, sceneDistance, sigmaLantern, sigmaEye);
          flash = sweptFlash;
        } else {
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= count) break;
          vec3 B = beams[i].xyz;
          float b = dot(dir, B);
          float d = dot(dir, r);
          float e = dot(B, r);
          float denom = max(1.0 - b * b, 1e-6);
          // Closest approach of the view ray (s) and the beam axis (t).
          float s = (b * e - d) / denom;
          float t = (e - b * d) / denom;
          if (t < 0.0) { t = 0.0; s = -d; }
          s = clamp(s, 0.0, sceneDistance);
          t = max(0.0, e + b * s);
          vec3 P = eye + dir * s;
          vec3 Q = lantern + B * t;
          float w = 0.6 + t * tanDivergence;
          float miss = length(P - Q) / w;
          float sinA = max(sqrt(denom), 0.02);
          float sigma = sigmaAt(P);
          float extinction = 0.5 * (sigmaAt(Q) + sigmaLantern) * t + 0.5 * (sigma + sigmaEye) * s;
          // Fog droplets scatter strongly forward; haze less so.
          float c = dot(B, -dir);
          float phase = mix(hg(c, 0.55), hg(c, 0.8), clamp(fogSigma / (fogSigma + haze * 20.0), 0.0, 1.0));
          // The sea and land take the beam from below, a cliff all at once (beamLight).
          float lit = litAt(i, t);
          light += vec3(lit * power * sigma * phase * 1.7725 * exp(-miss * miss) / (w * sinA) * exp(-extinction));
          // How squarely this beam points at us.
          float off = acos(clamp(dot(B, -r / toLantern), -1.0, 1.0));
          flash += exp(-off * off / ${(DIVERGENCE * DIVERGENCE).toFixed(8)});
        }
        }
        // The lamp seen through the glazing, and a dazzling flash with a
        // wide glare when a beam sweeps over us; wider still in fog.
        vec3 toL = normalize(lantern - eye);
        float angle = acos(clamp(dot(dir, toL), -1.0, 1.0));
        float seen = step(toLantern - 8.0, sceneDistance) * exp(-sigmaAt(mix(eye, lantern, 0.5)) * toLantern);
        float glare = exp(-angle / 0.002) +
          flash * (exp(-angle * angle / 4e-6) * 15.0 + exp(-angle / 0.01) * 1.5 + exp(-angle / 0.06) * 0.15);
        light += vec3(power * seen * glare * 1e-5);
        // Warm incandescent/metal-halide white.
        outputColor = vec4(inputColor.rgb + light * vec3(1.0, 0.9, 0.75), inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>([
          ['cameraWorld', new Uniform(camera.matrixWorld)],
          ['projectionInverse', new Uniform(camera.projectionMatrixInverse)],
          ['eye', new Uniform(camera.position)],
          ['lantern', new Uniform(lantern.position.clone())],
          ['beamLit', new Uniform(shares)],
          ['beams', new Uniform(beams)],
          ['count', new Uniform(count)],
          ['power', new Uniform(power)],
          // Damp sea air: ~25 km visibility.
          ['haze', new Uniform(3.912 / 25_000)],
          ['fogSigma', new Uniform(fog != null ? fogSigma(fog) : 0)],
          ['fogBase', new Uniform(fog != null ? fogProfile(fog).base : 0)],
          ['fogFade', new Uniform(fog != null ? fogProfile(fog).fade : 1)],
          ['fogStart', new Uniform(fog?.start ?? 0)],
          ['tanDivergence', new Uniform(Math.tan(DIVERGENCE))],
          ['swept', new Uniform(false)],
          ['sweptWindow', new Uniform(window)],
          ['sweptFlash', new Uniform(0)],
          ['sweptJitter', new Uniform(0)]
        ])
      }
    )
    this.light = light
    this.lanternInfo = lantern
    this.ground = ground
    this.islands = islands
    this.eyeAt = camera.position
    this.window = window
  }

  /**
   * Draw the beams as the lens turns while a shutter of this many seconds is
   * open: frozen under SWEEP_MIN (dusk, blue hour), else time-averaged.
   */
  setShutter(seconds: number): void {
    const sweep = sweepAngle(this.light, seconds)
    const swept = sweep >= SWEEP_MIN
    this.uniforms.get('swept')!.value = swept
    if (!swept) return
    const seaward = this.lanternInfo.seawardAzimuthDeg
    const azimuths = Array.from({ length: WINDOW_SIZE }, (_, i) => (i * 360) / WINDOW_SIZE)
    const profile = sweptWindow(this.light, seaward, sweep, azimuths)
    const lit = this.litByAzimuth()
    const data = this.window.image.data as Uint16Array
    for (let i = 0; i < WINDOW_SIZE; i++) {
      const at = (azimuths[i] / 360) * LIT_AZIMUTHS
      const j = Math.floor(at)
      const f = at - j
      for (let k = 0; k < BEAM_SAMPLES; k++) {
        const share = lit == null ? 1 : lit[j][k] * (1 - f) + lit[(j + 1) % LIT_AZIMUTHS][k] * f
        data[k * WINDOW_SIZE + i] = DataUtils.toHalfFloat(profile[i] * share)
      }
    }
    this.window.needsUpdate = true
    // The flash: how long a beam is on the camera, as a share of the shutter.
    const r = this.eyeAt.clone().sub(this.lanternInfo.position)
    const azimuth = (Math.atan2(r.x, -r.z) * 180) / Math.PI
    const elevation = Math.asin(r.y / Math.max(r.length(), 1e-6)) / DIVERGENCE
    this.uniforms.get('sweptFlash')!.value = sweptWindow(this.light, seaward, sweep, [azimuth])[0] * Math.exp(-elevation * elevation)
  }

  /** A new sample offset for the swept beams (0–1), one per frame. */
  setJitter(offset: number): void {
    this.uniforms.get('sweptJitter')!.value = offset
  }

  /** Beam shadows (beamLight) every 360 / LIT_AZIMUTHS degrees; null without
   * ground (passes.beamShadow off). */
  private litByAzimuth(): number[][] | null {
    if (this.ground == null) return null
    if (this.litTable == null) {
      const directions = Array.from({ length: LIT_AZIMUTHS }, (_, j) => new Vector3(...dirFromAzEl((j * 360) / LIT_AZIMUTHS, 0)))
      this.litTable = beamLight(this.lanternInfo.position, directions, this.ground, this.islands)
    }
    return this.litTable
  }
}
