// The fog layer's shape with height, shared by the fog pass (fog.ts), the
// lighthouse beams and the sun's dimming (scene.ts). No three.js imports.
//
// Advection fog is a marine layer under an inversion: about as dense from the
// sea up to its top, then gone within a few metres, with clear air above
// (tens to a few hundred metres deep: REFERENCES.md "Fog"). So its density is
// σ up to `base` and falls off over `fade` metres above; base + fade = the
// drawn height, so a vertical column holds σ × height as before. Sea smoke
// (steam fog) has no inversion lid: it thins out exponentially from the sea
// (base 0, fade = height).

import type { FogParams } from './params'

/** Koschmieder: extinction (1/m) at the visibility (m) where contrast is 2%. */
export function fogSigma(fog: Pick<FogParams, 'visibility'>): number {
  return 3.912 / fog.visibility
}

/** Height (m) the fog is uniform up to, and the scale (m) of its fade above. */
export function fogProfile(fog: Pick<FogParams, 'kind' | 'height'>): { base: number; fade: number } {
  if (fog.kind === 'sea-smoke') return { base: 0, fade: fog.height }
  const fade = Math.max(2, 0.1 * fog.height)
  return { base: fog.height - fade, fade }
}

/** Optical depth straight up from height y (m) through the fog above it. */
export function fogDepthAbove(fog: Pick<FogParams, 'kind' | 'height' | 'visibility'>, y: number): number {
  const { base, fade } = fogProfile(fog)
  const sigma = fogSigma(fog)
  return y < base ? sigma * (base - y + fade) : sigma * fade * Math.exp(-(y - base) / fade)
}

/** Share of the direct sun that reaches an eye at height y (m) inside or
 * above the fog. A bank offshore (start > 0) isn't overhead. */
export function fogSunTransmittance(fog: FogParams | null, y: number, sunElevationDeg: number): number {
  if (fog == null || fog.start > 0) return 1
  const sinEl = Math.max(0.05, Math.sin(Math.max(sunElevationDeg, 0) * (Math.PI / 180)))
  return Math.exp(-fogDepthAbove(fog, y) / sinEl)
}

/** GLSL: optical depth along y(s) = y0 + s dy for s in [s0, s1] through a
 * layer of density sigma up to `base`, falling off over `fade` above it.
 * Mirrors fogProfile; closed form, so one call per pixel. */
export const FOG_LAYER_GLSL = /* glsl */ `
float fogAboveBase(float ya, float yb, float dy, float len, float base, float fade) {
  // Both ends at or above base: the exponential part.
  if (abs(dy) < 1e-5) return exp(-(ya - base) / fade) * len;
  return fade * abs(exp(-(ya - base) / fade) - exp(-(yb - base) / fade)) / abs(dy);
}
float fogLayerDepth(float sigma, float y0, float dy, float s0, float s1, float base, float fade) {
  if (s1 <= s0) return 0.0;
  float ya = y0 + s0 * dy;
  float yb = y0 + s1 * dy;
  // Where the ray crosses base (if it does within [s0, s1]).
  float sc = abs(dy) < 1e-5 ? -1.0 : clamp((base - y0) / dy, s0, s1);
  if (ya <= base && yb <= base) return sigma * (s1 - s0);
  if (ya >= base && yb >= base) return sigma * fogAboveBase(ya, yb, dy, s1 - s0, base, fade);
  // One end below, the other above.
  float below = ya < base ? sc - s0 : s1 - sc;
  float ye = ya < base ? yb : ya;
  return sigma * (below + fogAboveBase(base, ye, dy, abs(s1 - s0) - below, base, fade));
}
`

/** Optical depth along a ray (mirrors FOG_LAYER_GLSL fogLayerDepth): from
 * height y0 (m) with vertical slope dy per metre, between s0 and s1 (m). */
export function fogRayDepth(fog: Pick<FogParams, 'kind' | 'height' | 'visibility'>, y0: number, dy: number, s0: number, s1: number): number {
  if (s1 <= s0) return 0
  const { base, fade } = fogProfile(fog)
  const sigma = fogSigma(fog)
  const above = (ya: number, yb: number, len: number): number =>
    Math.abs(dy) < 1e-5 ? Math.exp(-(ya - base) / fade) * len : (fade * Math.abs(Math.exp(-(ya - base) / fade) - Math.exp(-(yb - base) / fade))) / Math.abs(dy)
  const ya = y0 + s0 * dy
  const yb = y0 + s1 * dy
  if (ya <= base && yb <= base) return sigma * (s1 - s0)
  if (ya >= base && yb >= base) return sigma * above(ya, yb, s1 - s0)
  const sc = Math.min(s1, Math.max(s0, (base - y0) / dy))
  const below = ya < base ? sc - s0 : s1 - sc
  return sigma * (below + above(base, ya < base ? yb : ya, s1 - s0 - below))
}
