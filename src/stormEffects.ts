import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3, Vector4, type PerspectiveCamera } from 'three'

import { cloudBase } from './cloudTypes'
import { dirFromAzEl, type RainbowParams, type SceneParams, type StormParams } from './params'
import { boltTops } from './props/storm'
import { Random } from './random'

// Screen-space rain, applied after exposure on top of the composited clouds:
// distant rain shafts, rainbows, the lightning flash on the cloud base, and
// rain falling right in front of the camera.

const DEG = Math.PI / 180
const MAX = 4

/** Grey shafts of rain hanging from the cloud base to the sea, kilometres
 * away. Drawn in screen space (a mesh would have to be transparent, which
 * the volumetric clouds and haze don't composite), hidden behind anything
 * nearer than the shaft. */
class RainShaftEffect extends Effect {
  constructor(params: SceneParams, curtains: StormParams['curtains'], camera: PerspectiveCamera) {
    const base = cloudBase(params.weather.formations, 'cumulonimbus')
    const tanHalfH = Math.tan((camera.fov * DEG) / 2) * camera.aspect
    const shafts: Vector4[] = []
    const shapes: Vector4[] = []
    const rng = Random.derive(params.seed, 'rain-shafts')
    curtains.slice(0, MAX).forEach(curtain => {
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

/**
 * A rainbow in the rain: sunlight refracted and reflected inside drops comes
 * back at 42° around the antisolar point (red outside, violet inside), the
 * secondary bow at ~51° with the colours reversed, a brighter sky inside the
 * primary and Alexander's darker band between the two. Only where there's
 * rain — in front of distant scenery, patchy along the arc.
 */
class RainbowEffect extends Effect {
  constructor(params: SceneParams, rainbow: RainbowParams, camera: PerspectiveCamera) {
    const [sx, sy, sz] = params.sunDirection
    super(
      'RainbowEffect',
      /* glsl */ `
      uniform vec3 antisolar;
      uniform mat4 cameraWorld;
      uniform mat4 projectionInverse;
      uniform float strength;
      uniform float secondary;
      uniform float seed;
      float hash1(float x) { return fract(sin(x * 127.1 + seed) * 43758.5453); }
      float noise1(float x) {
        float i = floor(x);
        float f = fract(x);
        return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
      }
      // Colours across a bow, t = 0 violet (inner) … 1 red (outer); the
      // sun's half-degree disc blurs the edges.
      vec3 bow(float t) {
        vec3 c;
        c.r = smoothstep(0.35, 0.75, t) + 0.35 * (1.0 - smoothstep(0.0, 0.18, t));
        c.g = exp(-pow((t - 0.5) / 0.22, 2.0));
        c.b = 1.0 - smoothstep(0.1, 0.45, t);
        return c * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.88, 1.0, t));
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        vec4 view = projectionInverse * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 dir = normalize((cameraWorld * vec4(view.xyz / view.w, 0.0)).xyz);
        float theta = degrees(acos(clamp(dot(dir, antisolar), -1.0, 1.0)));
        // Where the rain is: kilometres away, patchy along the arc, fading
        // a little below the horizon.
        float distance = -getViewZ(depth);
        vec3 side = normalize(cross(antisolar, vec3(0.0, 1.0, 0.0)));
        float phi = atan(dot(dir, side), dir.y);
        float rain = smoothstep(800.0, 2500.0, distance) *
          smoothstep(0.25, 0.65, noise1(phi * 2.5) * 0.7 + noise1(phi * 7.0 + 3.0) * 0.3) *
          mix(0.5, 1.0, smoothstep(-0.02, 0.01, dir.y));
        vec3 c = inputColor.rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float k = strength * rain;
        // Brighter inside the primary, darker in Alexander's band.
        c *= 1.0 + k * (0.12 * smoothstep(20.0, 40.0, theta) * (1.0 - smoothstep(40.0, 41.0, theta)) -
          0.08 * smoothstep(42.5, 43.5, theta) * (1.0 - smoothstep(49.5, 50.5, theta)));
        vec3 light = bow((theta - 40.4) / 2.3) + secondary * 0.43 * bow(1.0 - (theta - 50.0) / 3.8);
        // Added light, scaled to the scene so it reads on dark rain and on
        // brighter sky alike.
        c += light * k * (0.05 + 0.35 * lum);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>([
          ['antisolar', new Uniform(new Vector3(-sx, -sy, -sz))],
          ['cameraWorld', new Uniform(camera.matrixWorld)],
          ['projectionInverse', new Uniform(camera.projectionMatrixInverse)],
          ['strength', new Uniform(rainbow.strength)],
          ['secondary', new Uniform(rainbow.secondary ? 1 : 0)],
          ['seed', new Uniform(params.ocean.time % 100)]
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

/** The day's rain effects (storm or rainbow shower), in compositing order. */
export function stormEffects(params: SceneParams, camera: PerspectiveCamera): Effect[] {
  const effects: Effect[] = []
  const { rainbow, storm } = params
  if (rainbow != null) {
    effects.push(new RainShaftEffect(params, rainbow.showers, camera), new RainbowEffect(params, rainbow, camera))
  }
  if (storm == null) return effects
  if (storm.curtains.length > 0) effects.push(new RainShaftEffect(params, storm.curtains, camera))
  const tops = boltTops(params, camera.position)
  if (tops.length > 0) effects.push(new FlashEffect(tops, camera))
  if (storm.rain > 0) effects.push(new RainEffect(storm.rain, camera.aspect, params.ocean.windSpeed))
  return effects
}
