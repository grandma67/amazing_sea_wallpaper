import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3, Vector4, type PerspectiveCamera } from 'three'

import { CLOUD_GENERA } from './cloudTypes'
import { dirFromAzEl, type SceneParams } from './params'
import { boltTops } from './props/storm'
import { Random } from './random'

// Screen-space parts of a storm, applied after exposure on top of the
// composited clouds: distant rain shafts, the lightning flash on the cloud
// base, and rain falling right in front of the camera.

const DEG = Math.PI / 180
const MAX = 4

/** Grey shafts of rain hanging from the cloud base to the sea, kilometres
 * away. Drawn in screen space (a mesh would have to be transparent, which
 * the volumetric clouds and haze don't composite), hidden behind anything
 * nearer than the shaft. */
class RainShaftEffect extends Effect {
  constructor(params: SceneParams, camera: PerspectiveCamera) {
    const base = CLOUD_GENERA.cumulonimbus.altitude
    const tanHalfH = Math.tan((camera.fov * DEG) / 2) * camera.aspect
    const shafts: Vector4[] = []
    const shapes: Vector4[] = []
    const rng = Random.derive(params.seed, 'rain-shafts')
    params.storm!.curtains.slice(0, MAX).forEach(curtain => {
      const [dx, , dz] = dirFromAzEl(curtain.azimuthDeg, 0)
      const foot = new Vector3(dx, 0, dz).multiplyScalar(curtain.distance).add(camera.position).setY(0)
      const top = foot.clone().setY(base)
      const a = foot.clone().project(camera)
      const b = top.clone().project(camera)
      if (a.z > 1 || b.z > 1) return
      // Screen x centre, bottom y, top y (uv), width (uv).
      shafts.push(
        new Vector4(a.x * 0.5 + 0.5, a.y * 0.5 + 0.5, b.y * 0.5 + 0.5, curtain.width / curtain.distance / tanHalfH / 2)
      )
      // Distance, opacity, slant, noise seed.
      shapes.push(new Vector4(curtain.distance, rng.range(0.45, 0.8), rng.range(-0.25, 0.25), rng.range(0, 100)))
    })
    const count = shafts.length
    while (shafts.length < MAX) shafts.push(new Vector4(-10, 0, 1, 0.01))
    while (shapes.length < MAX) shapes.push(new Vector4(1, 0, 0, 0))
    super(
      'RainShaftEffect',
      /* glsl */ `
      uniform vec4 shafts[${MAX}];
      uniform vec4 shapes[${MAX}];
      uniform int count;
      float hash(float x, float seed) { return fract(sin(x * 127.1 + seed) * 43758.5453); }
      float noise(float x, float seed) {
        float i = floor(x);
        float f = fract(x);
        return mix(hash(i, seed), hash(i + 1.0, seed), f * f * (3.0 - 2.0 * f));
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float distance = -getViewZ(depth);
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= count) break;
          vec4 s = shafts[i];
          vec4 shape = shapes[i];
          // Anything nearer (sea, land, boats) is in front of the rain.
          if (distance < shape.x) continue;
          float v = (uv.y - s.y) / (s.z - s.y);
          float u = (uv.x - s.x) / s.w + 0.5 + (1.0 - v) * shape.z;
          if (v < 0.0 || v > 1.1 || u < 0.0 || u > 1.0) continue;
          // Uneven streaks, densest in the middle, frayed at the sides,
          // merging into the cloud above and thinning toward the sea.
          float streaks = 0.3 + 0.5 * noise(u * 30.0, shape.w) + 0.2 * noise(u * 140.0, shape.w);
          float edge = smoothstep(0.0, 0.3 + 0.2 * noise(v * 3.0 + 7.0, shape.w), u) *
            (1.0 - smoothstep(0.55 + 0.2 * noise(v * 3.0, shape.w), 1.0, u));
          float vertical = mix(0.6, 1.0, v) * (1.0 - smoothstep(0.75, 1.1, v));
          // Further shafts fade into the haze.
          float alpha = shape.y * streaks * edge * vertical * exp(-shape.x / 30000.0);
          c = mix(c, vec3(lum) * 0.7, clamp(alpha, 0.0, 1.0));
          lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        }
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>([
          ['shafts', new Uniform(shafts)],
          ['shapes', new Uniform(shapes)],
          ['count', new Uniform(count)]
        ])
      }
    )
  }
}

/** Lightning lights up the cloud around the channel: a soft glow centred
 * where each bolt leaves the cloud base. */
class FlashEffect extends Effect {
  constructor(tops: Vector3[], camera: PerspectiveCamera) {
    const points = tops.slice(0, 3).map(top => {
      const ndc = top.clone().project(camera)
      // Glow radius: ~800 m at the bolt's distance, as a fraction of the view.
      const radius = Math.min(0.2, 800 / top.distanceTo(camera.position) / Math.tan((camera.fov * DEG) / 2) / 2)
      return new Vector3(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, radius)
    })
    while (points.length < 3) points.push(new Vector3(-10, -10, 0.001))
    super(
      'FlashEffect',
      /* glsl */ `
      uniform vec3 flashes[3];
      uniform float aspect;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float glow = 0.0;
        for (int i = 0; i < 3; i++) {
          vec2 d = (uv - flashes[i].xy) * vec2(aspect, 1.0) / flashes[i].z;
          // Wider than tall: the light spreads along the cloud base.
          d *= vec2(0.6, 1.2);
          glow += exp(-dot(d, d));
        }
        outputColor = vec4(inputColor.rgb + vec3(0.75, 0.8, 1.0) * glow * 0.12, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([
          ['flashes', new Uniform(points)],
          ['aspect', new Uniform(camera.aspect)]
        ])
      }
    )
  }
}

/** Rain falling close to the camera: faint slanted streaks over the image,
 * plus the loss of contrast of looking through a downpour. */
class RainEffect extends Effect {
  constructor(rain: number, aspect: number, windSpeed: number) {
    super(
      'RainEffect',
      /* glsl */ `
      uniform float rain;
      uniform float aspect;
      uniform float slant;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // Look through a veil of rain: flatter, greyer.
        c = mix(c, vec3(lum) * 0.9 + 0.01, rain * 0.25);
        float streaks = 0.0;
        for (int layer = 0; layer < 3; layer++) {
          // Nearer layers: bigger, sparser, softer streaks.
          float fl = float(layer);
          float scale = 90.0 / (1.0 + fl * 0.8);
          vec2 p = vec2(uv.x * aspect + uv.y * slant, uv.y) * scale + fl * 31.7;
          vec2 cell = vec2(floor(p.x), floor(p.y / 7.0));
          vec2 f = vec2(fract(p.x), fract(p.y / 7.0));
          float h = hash(cell);
          if (h > rain * 0.6) continue;
          float x = abs(f.x - 0.2 - 0.6 * fract(h * 13.7));
          float len = 0.25 + 0.4 * fract(h * 7.3);
          float y0 = fract(h * 29.1) * (1.0 - len);
          float along = smoothstep(y0, y0 + len * 0.3, f.y) * (1.0 - smoothstep(y0 + len * 0.7, y0 + len, f.y));
          float width = 0.035 * (1.0 + fl);
          streaks += along * (1.0 - smoothstep(0.0, width, x)) * (0.6 - fl * 0.15);
        }
        // Drops catch the light: a little brighter than what's behind them.
        c = mix(c, vec3(lum * 1.4 + 0.02), clamp(streaks * 0.45, 0.0, 1.0));
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([
          ['rain', new Uniform(rain)],
          ['aspect', new Uniform(aspect)],
          // Wind drives the rain sideways.
          ['slant', new Uniform(Math.min(0.5, windSpeed * 0.02))]
        ])
      }
    )
  }
}

/** The day's storm effects, in compositing order. */
export function stormEffects(params: SceneParams, camera: PerspectiveCamera): Effect[] {
  const storm = params.storm
  if (storm == null) return []
  const effects: Effect[] = []
  if (storm.curtains.length > 0) effects.push(new RainShaftEffect(params, camera))
  const tops = boltTops(params, camera.position)
  if (tops.length > 0) effects.push(new FlashEffect(tops, camera))
  if (storm.rain > 0) effects.push(new RainEffect(storm.rain, camera.aspect, params.ocean.windSpeed))
  return effects
}
