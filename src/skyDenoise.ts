import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

// Light shafts in the clouds: takram's clouds pass applies aerial perspective
// to each cloud pixel with a per-pixel, single-sample estimate of how much of
// the air in front of the cloud lies in cloud shadow. That estimate is very
// noisy; averaging 64 frames still left a fine grain over every cloud (it
// took ~256 to vanish), worst in low beach views that look through tens of
// kilometres of air. Clouds are soft, so the final image gets one small
// edge-aware blur over the sky: 5×5 taps a cloud pixel apart, weighted by how
// alike their brightness is, so cloud edges, sunlit rims and the horizon stay
// sharp. Pixels with scene geometry (depth < far) are left alone and never
// sampled.

export class SkyDenoiseEffect extends Effect {
  constructor(cloudPixel: number) {
    super(
      'SkyDenoiseEffect',
      /* glsl */ `
      uniform float spacing;

      float logLuminance(const vec3 c) {
        return log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6));
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        outputColor = inputColor;
        if (depth < 1.0) return;
        float center = logLuminance(inputColor.rgb);
        vec3 sum = inputColor.rgb;
        float weightSum = 1.0;
        for (int y = -2; y <= 2; ++y) {
          for (int x = -2; x <= 2; ++x) {
            if (x == 0 && y == 0) continue;
            vec2 offset = vec2(x, y);
            vec2 p = uv + offset * spacing * texelSize;
            if (readDepth(p) < 1.0) continue;
            vec3 c = texture2D(inputBuffer, p).rgb;
            // Grain is a few percent; edges are tens of percent.
            float d = (logLuminance(c) - center) / 0.3;
            float w = exp(-0.15 * dot(offset, offset) - d * d);
            sum += c * w;
            weightSum += w;
          }
        }
        outputColor = vec4(sum / weightSum, inputColor.a);
      }`,
      {
        attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
        blendFunction: BlendFunction.SET,
        uniforms: new Map([['spacing', new Uniform(cloudPixel)]])
      }
    )
  }
}
