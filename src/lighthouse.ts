import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3, Vector4, type PerspectiveCamera } from 'three'

import { dirFromAzEl, type FogParams, type LighthouseParams } from './params'
import type { LanternInfo } from './props/lighthouse'

// A lighthouse's beams, seen side-on in the haze or fog (see
// LighthouseParams), drawn in screen space from the depth buffer before
// exposure, after the fog. Each beam is a cone a few degrees wide leaving
// the lantern horizontally. For each pixel the view ray passes the beam's
// axis closest at one point; the light scattered toward us there is the
// beam's irradiance (spreading with distance) times the air's scattering
// coefficient and phase function, times the path through the beam, dimmed
// by the haze along beam and view ray. Anything nearer than that point (the
// tower, land, the sea) hides it. A beam turned toward the camera is a
// blinding flash: a glare round the lantern.

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

export class LighthouseBeamEffect extends Effect {
  constructor(
    light: LighthouseParams,
    lantern: LanternInfo,
    fog: FogParams | null,
    camera: PerspectiveCamera,
    /** Beam brightness in the scene's radiance units. */
    power: number
  ) {
    const beams = beamDirections(light, lantern.seawardAzimuthDeg).map(b => new Vector4(b.x, b.y, b.z, 1))
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
      uniform int count;
      uniform float power;
      uniform float haze;
      uniform float fogSigma;
      uniform float fogHeight;
      uniform float fogStart;
      uniform float tanDivergence;

      float hg(float c, float g) {
        return (1.0 - g * g) / (4.0 * 3.14159265 * pow(1.0 + g * g - 2.0 * g * c, 1.5));
      }
      // Scattering coefficient of the air at p: sea haze, plus the fog layer
      // (thinning with height, from where a bank starts).
      float sigmaAt(vec3 p) {
        float fog = fogSigma * exp(-max(p.y, 0.0) / fogHeight) * step(fogStart, length(p.xz - eye.xz));
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
          light += vec3(power * sigma * phase * 1.7725 * exp(-miss * miss) / (w * sinA) * exp(-extinction));
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
          ['beams', new Uniform(beams)],
          ['count', new Uniform(count)],
          ['power', new Uniform(power)],
          // Damp sea air: ~25 km visibility.
          ['haze', new Uniform(3.912 / 25_000)],
          ['fogSigma', new Uniform(fog != null ? 3.912 / fog.visibility : 0)],
          ['fogHeight', new Uniform(fog?.height ?? 1)],
          ['fogStart', new Uniform(fog?.start ?? 0)],
          ['tanDivergence', new Uniform(Math.tan(DIVERGENCE))]
        ])
      }
    )
  }
}
