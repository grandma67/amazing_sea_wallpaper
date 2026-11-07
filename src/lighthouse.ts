import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3, Vector4, type PerspectiveCamera } from 'three'

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
// where its axis meets them (beamReach): its shadow, without a shadow map.

const MAX = 12
const DEG = Math.PI / 180
/** Half-width of a beam (rad): Fresnel panels spread it a few degrees. */
const DIVERGENCE = 2.2 * DEG
/** Gap between the beams of one group (deg). */
const GROUP_SPREAD = 10

/** Unit beam directions, screened landward on a point. */
export function beamDirections(light: LighthouseParams, seawardAzimuthDeg: number | null): Vector3[] {
  const beams: Vector3[] = []
  for (let g = 0; g < light.groups; g++) {
    for (let f = 0; f < light.flashes; f++) {
      const az = light.beamAzimuthDeg + (g * 360) / light.groups + (f - (light.flashes - 1) / 2) * GROUP_SPREAD
      if (seawardAzimuthDeg != null) {
        const off = Math.abs((((az - seawardAzimuthDeg) % 360) + 540) % 360 - 180)
        if (off > 110) continue
      }
      beams.push(new Vector3(...dirFromAzEl(az, 0)))
    }
  }
  return beams.slice(0, MAX)
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

export class LighthouseBeamEffect extends Effect {
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
          ['tanDivergence', new Uniform(Math.tan(DIVERGENCE))]
        ])
      }
    )
  }
}
