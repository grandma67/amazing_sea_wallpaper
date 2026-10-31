import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform, Vector3, type PerspectiveCamera } from 'three'

import { FOG_LAYER_GLSL, fogProfile, fogSigma } from './fogLayer'
import type { FogParams } from './params'

// Fog over the sea (see FogParams), drawn in screen space from the depth
// buffer before exposure, in the scene's radiance units. The fog is a layer
// with a lid (fogLayer.ts): advection fog is about as dense up to its top,
// then clear within a few metres, so from above it's a sea of fog with
// whatever stands higher showing sharp; sea smoke thins out exponentially.
// The optical depth along each view ray has a closed form; a bank offshore
// starts at a distance from the camera, with a lumpy top and ragged front. Its light is
// the sky's and the sun's (or moon's), scattered strongly forward: fog
// glows toward a low sun and stays grey away from it. Sea smoke is the same
// layer, only a few metres thick and broken into wisps.

export class FogEffect extends Effect {
  constructor(
    fog: FogParams,
    camera: PerspectiveCamera,
    lightDirection: Vector3,
    sunIrradiance: Color,
    skyIrradiance: Color
  ) {
    super(
      'FogEffect',
      /* glsl */ `
      uniform mat4 cameraWorld;
      uniform mat4 projectionInverse;
      uniform vec3 eye;
      uniform float sigma;
      uniform float fogBase;
      uniform float fogFade;
      uniform float deckRelief;
      uniform float start;
      uniform float wisps;
      uniform float seed;
      uniform vec3 lightDirection;
      uniform vec3 sunIrradiance;
      uniform vec3 skyIrradiance;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        return 0.5 * noise(p) + 0.3 * noise(p * 2.03 + 1.7) + 0.2 * noise(p * 4.11 + 3.1);
      }
      ${FOG_LAYER_GLSL}
      // The fog top's relief, -1..1: swells of ~400 m with billows on them.
      float billows(vec2 p) {
        return 2.0 * (0.6 * fbm(p / 400.0) + 0.4 * fbm(p / 120.0 + 17.0)) - 1.0;
      }
      // Henyey-Greenstein phase function.
      float phase(float c, float g) {
        return (1.0 - g * g) / (4.0 * 3.14159265 * pow(1.0 + g * g - 2.0 * g * c, 1.5));
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        vec4 view = projectionInverse * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 viewDir = normalize(view.xyz / view.w);
        vec3 dir = normalize((cameraWorld * vec4(viewDir, 0.0)).xyz);
        // Distance along the ray to what the pixel shows; the sky and the
        // clouds are far beyond the fog.
        float distance = depth >= 0.9999 ? 1e6 : getViewZ(depth) / viewDir.z;
        float azimuth = atan(dir.x, -dir.z);
        // A bank's top rolls and its front is ragged.
        float lumps = fbm(vec2(azimuth * 6.0, 0.0));
        float k = mix(1.0, 0.55 + 0.9 * lumps, step(1.0, start));
        float base = fogBase * k;
        float fade = fogFade * k;
        // The top billows: lift or lower it where the ray meets it; seen
        // from above, its slopes face the sun or turn away from it.
        vec3 topNormal = vec3(0.0, 1.0, 0.0);
        float fromAbove = 0.0;
        if (deckRelief > 0.0 && abs(dir.y) > 1e-4) {
          float sh = (base - eye.y) / dir.y;
          if (sh > 0.0) {
            vec2 p = eye.xz + sh * dir.xz;
            float b0 = billows(p);
            base += deckRelief * b0;
            topNormal = normalize(vec3(-deckRelief * (billows(p + vec2(8.0, 0.0)) - b0) / 8.0, 1.0,
              -deckRelief * (billows(p + vec2(0.0, 8.0)) - b0) / 8.0));
            fromAbove = smoothstep(base, base + 2.0 * fade, eye.y);
          }
        }
        float horizontal = max(length(dir.xz), 1e-4);
        float s0 = start * (0.8 + 0.4 * fbm(vec2(azimuth * 9.0, 5.0))) / horizontal;
        float tau = fogLayerDepth(sigma, eye.y, dir.y, s0, distance, base, fade);
        // Sea smoke rises in wisps; a fog bank thins at its front.
        float elevation = asin(clamp(dir.y, -1.0, 1.0));
        tau *= mix(1.0, 0.25 + 1.5 * fbm(vec2(azimuth * 40.0, elevation * 25.0 - azimuth * 8.0)), wisps);
        float transmittance = exp(-max(tau, 0.0));
        // In-scattered light: skylight from all round, plus the sun's
        // forward glow (dimmed by what fog lies above).
        float cosTheta = dot(dir, lightDirection);
        float up = smoothstep(-0.05, 0.05, lightDirection.y);
        // Seen from above, the top's slopes catch a low sun or lie in shade:
        // the sunlight on them scales with the cosine to the tilted surface.
        float facing = max(dot(topNormal, lightDirection), 0.0) / max(lightDirection.y, 0.03);
        float shade = mix(1.0, clamp(facing, 0.25, 2.0), fromAbove);
        vec3 light = skyIrradiance / 3.14159265 * 0.9 +
          sunIrradiance * up * shade * (0.55 * phase(cosTheta, 0.65) + 0.25 / (4.0 * 3.14159265) + 0.15 * max(lightDirection.y, 0.0) / 3.14159265);
        outputColor = vec4(inputColor.rgb * transmittance + light * (1.0 - transmittance), inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>([
          ['cameraWorld', new Uniform(camera.matrixWorld)],
          ['projectionInverse', new Uniform(camera.projectionMatrixInverse)],
          ['eye', new Uniform(camera.position)],
          ['sigma', new Uniform(fogSigma(fog))],
          ['fogBase', new Uniform(fogProfile(fog).base)],
          ['fogFade', new Uniform(fogProfile(fog).fade)],
          // Billows on an advection fog's top, ± this many metres.
          ['deckRelief', new Uniform(fog.kind === 'advection' ? 0.12 * fog.height : 0)],
          ['start', new Uniform(fog.start)],
          ['wisps', new Uniform(fog.kind === 'sea-smoke' ? 1 : 0)],
          ['seed', new Uniform((fog.seed % 1000) * 0.1)],
          ['lightDirection', new Uniform(lightDirection.clone().normalize())],
          ['sunIrradiance', new Uniform(sunIrradiance.clone())],
          ['skyIrradiance', new Uniform(skyIrradiance.clone())]
        ])
      }
    )
  }
}
