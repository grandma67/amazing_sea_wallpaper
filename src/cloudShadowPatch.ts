import type { CloudsEffect } from '@takram/three-clouds'

/** The largest finite half float: takram's shadow map is HalfFloatType. */
export const HALF_MAX = 65504
/** The lines of takram's shadow.frag `cascade()` that write the half-float map (0.203). */
export const SHADOW_COLOR_OUT = 'outputColor = color;'
export const SHADOW_DEPTH_OUT = 'outputDepthVelocity = vec3(color.x, velocity);'
/** marchClouds' front depth: 0 / 0 when the first sample is already opaque (transmittance
 * underflows); Apple's min(NaN, x) returns x, SwiftShader NaN. The guard returns x too. */
export const SHADOW_READ = 'return min(shadow.b + shadow.a, shadow.g * distanceToFront);'
export const SHADOW_RESOLVE_OUT ='outputColor = mix(clippedHistory, current, temporalAlpha);'
export const SHADOW_FRONT ='float frontDepth = min(weightedDistanceSum / transmittanceSum, maxRayDistance);'

/**
 * Keeps takram's cloud shadow map finite. It is HalfFloat (≤ 65 504) and holds the front
 * depth along the sun's ray in metres; under a sun within a few degrees of the horizon that
 * ray grazes the cloud shell for hundreds of km. Apple GPUs saturate the write; x86 and ARM
 * SwiftShader (CI) write ∞, linear filtering between ∞ and finite texels gives NaN, and the
 * clouds' self-shadowing, the sky cube and every lit material went NaN: 2026-11-17 was
 * published white (tools/RENDER.md "Broken frames"). Clamping in the shader does what the
 * Mac did, so its image is unchanged. Throws if takram's shader changes.
 *
 * `dump` (debug.shadowDump): a GLSL vec4 written unclamped in place of the output, with the
 * shadow's temporal resolve off so nanTrace reads it raw (through the resolve every dump read
 * NaN: it reprojects by r and clips by the neighbours).
 */
export function clampShadowToHalf(clouds: CloudsEffect, dump: string | null = null): void {
  const material = clouds.shadowPass.currentMaterial
  const source = material.fragmentShader
  if ([SHADOW_COLOR_OUT, SHADOW_DEPTH_OUT, SHADOW_FRONT].some(line => source.split(line).length !== 2))
    throw new Error('clampShadowToHalf: takram shadow.frag has changed; update the patch')
  if (dump != null) clouds.shadowPass.temporalPass = false
  material.fragmentShader = source
    .replace(SHADOW_FRONT, 'float frontDepth = transmittanceSum > 0.0 ? min(weightedDistanceSum / transmittanceSum, maxRayDistance) : maxRayDistance;')
    // NaN/∞ by the bits (fast-math folds isnan away): no front depth reads as none in range
    // (HALF_MAX, what the Mac's saturating write gives), other channels 0; then clamp.
    .replace(
      SHADOW_COLOR_OUT,
      dump != null
        ? `outputColor = ${dump};`
        : `vec4 safe = color;
  if ((floatBitsToUint(safe.x) & 0x7f800000u) == 0x7f800000u) safe.x = ${HALF_MAX}.0;
  for (int k = 1; k < 4; ++k) if ((floatBitsToUint(safe[k]) & 0x7f800000u) == 0x7f800000u) safe[k] = 0.0;
  outputColor = min(safe, vec4(${HALF_MAX}.0));`
    )
    // A NaN depth made a NaN velocity, and the resolve then read its history at a NaN uv.
    .replace(SHADOW_DEPTH_OUT, `outputDepthVelocity = vec3(outputColor.x, all(lessThan(abs(velocity), vec2(1e6))) ? velocity : vec2(0.0));`)
  material.needsUpdate = true

  // The temporal resolve (shadowResolve.frag) still made NaN in the far cascade from finite
  // inputs on SwiftShader (2024-02-19, measured with nanTrace): a non-finite blend keeps the
  // current frame's texel, which is what an Apple GPU's result equals there.
  const resolve = clouds.shadowPass.resolveMaterial
  const resolveSource = resolve.fragmentShader
  if (resolveSource.split(SHADOW_RESOLVE_OUT).length !== 2) throw new Error('clampShadowToHalf: takram shadowResolve.frag has changed; update the patch')
  resolve.fragmentShader = resolveSource.replace(
    SHADOW_RESOLVE_OUT,
    `vec4 blended = mix(clippedHistory, current, temporalAlpha);
  bool bad = false;
  for (int k = 0; k < 4; ++k) bad = bad || (floatBitsToUint(blended[k]) & 0x7f800000u) == 0x7f800000u;
  outputColor = bad ? current : blended;`
  )
  resolve.needsUpdate = true

  // And where the clouds read it (self-shadowing and the light shafts' march, clouds.frag):
  // one NaN texel on a shaft made the whole shaft NaN, a band along the horizon toward a
  // low sun (2024-02-19). A bad reading counts as no shadow.
  const march = clouds.cloudsPass.currentMaterial
  const marchSource = march.fragmentShader
  if (marchSource.split(SHADOW_READ).length !== 2) throw new Error('clampShadowToHalf: takram clouds.frag has changed; update the patch')
  march.fragmentShader = marchSource.replace(
    SHADOW_READ,
    `float opticalDepth = min(shadow.b + shadow.a, shadow.g * distanceToFront);
  return (floatBitsToUint(opticalDepth) & 0x7f800000u) == 0x7f800000u ? 0.0 : opticalDepth;`
  )
  march.needsUpdate = true
}
