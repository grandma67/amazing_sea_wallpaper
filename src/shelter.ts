import { Vector2, Vector4 } from 'three'

import { smoothstep } from './cellNoise'
import type { CoastParams } from './params'

// Calm water (PLAN_BIOMES 6): behind a reef or barrier, or in a lagoon or a
// fjord, the swell is gone and only the wind chop the water inside can raise
// remains. One mask, 0..1 over shore coordinates, scales the swell cascades
// (ocean.ts), the surf (SURF_GLSL, surfWave) and seaLevel(); the reef (phase
// 7) and later landforms (phase 10) set its sources.

const G = 9.81

/** Shelter sources at most (GLSL array size). */
export const MAX_BASINS = 4

/** A calm ellipse in shore coordinates: centre (s, a) and half-axes (m). */
export interface ShelterBasin {
  s: number
  a: number
  halfS: number
  halfA: number
}

export interface Shelter {
  /** Share of the swell it stops, 0..1: waves past a reef re-form at
   * 1 − strength of the offshore height (0.7–0.9 on reefs, so 10–30%). */
  strength: number
  /** A reef or barrier at this `s` (m from s = 0): calm shoreward of it; null: none. */
  line: number | null
  /** Lagoons and fjord interiors (up to MAX_BASINS). */
  basins: ShelterBasin[]
  /** Width of the edge (m), about one swell wavelength (waves bend round an
   * edge over about their own length), all of it on the calm side. */
  blur: number
}

/** The mask at (s, a), 0 (open sea) .. strength (calm). Mirrors `shelter` in SHELTER_GLSL. */
export function shelterAt(coast: Pick<CoastParams, 'shelter'>, s: number, a: number): number {
  const shelter = coast.shelter
  if (shelter == null || shelter.strength <= 0) return 0
  let m = shelter.line != null ? 1 - smoothstep(shelter.line - shelter.blur, shelter.line, s) : 0
  for (const b of shelter.basins.slice(0, MAX_BASINS)) {
    m = Math.max(m, 1 - smoothstep(-shelter.blur, 0, basinEdge(b, s, a)))
  }
  return shelter.strength * m
}

/** Distance (m) outside a basin's edge, negative inside: (e − 1) / |∇e| for
 * the ellipse's normalised radius e. Mirrors `basinEdge` in SHELTER_GLSL. */
function basinEdge(b: ShelterBasin, s: number, a: number): number {
  const ds = s - b.s
  const da = a - b.a
  const e = Math.hypot(ds / b.halfS, da / b.halfA)
  const grad = Math.hypot(ds / (b.halfS * b.halfS), da / (b.halfA * b.halfA)) / Math.max(e, 1e-6)
  return (e - 1) / Math.max(grad, 1e-9)
}

/** Open water the wind blows over inside (m): the lagoon's width behind a
 * line, a basin's mean diameter; the largest. */
export function shelterFetch(coast: Pick<CoastParams, 'shelter' | 'waterline'>): number {
  const shelter = coast.shelter
  if (shelter == null) return 0
  const widths = shelter.basins.map(b => b.halfS + b.halfA)
  if (shelter.line != null) widths.push(shelter.line - coast.waterline)
  return Math.max(0, ...widths)
}

/** How much of the wind sea up to `longest` m wavelength (height) a fetch
 * keeps, 0..1. Fetch-limited JONSWAP growth (Hasselmann et al. 1973): Hs ∝ √F,
 * and the peak U·fp/g = 3.5 (gF/U²)^−0.33, so the share is √(F / F_full),
 * F_full being the fetch whose peak reaches `longest` (or the open sea's
 * fully developed peak, spectrum.ts, if that is shorter). */
export function chopFactor(fetch: number, windSpeed: number, longest: number): number {
  const U = Math.max(windSpeed, 0.5)
  const omegaPeak = (0.855 * G) / U
  const wavelength = Math.min(longest, (2 * Math.PI * G) / (omegaPeak * omegaPeak))
  const fp = Math.sqrt(G / (2 * Math.PI * wavelength))
  const full = ((3.5 * G) / (U * fp)) ** (1 / 0.33) * (U * U) / G
  return Math.min(1, Math.sqrt(Math.max(fetch, 0) / full))
}

/** Per cascade (spectrum.ts, longest first), how much of it survives inside
 * at full shelter: the swell cascade none, the middle one the chop the fetch
 * raises, the shortest all. */
export function cascadeShelter(sheltered: number, chop: number): [number, number, number] {
  return [1 - sheltered, 1 - sheltered * (1 - chop), 1]
}

export const SHELTER_GLSL = /* glsl */ `
// shelter.ts: strength (0: no shelter), the line's s and whether there is
// one, the basins (s, a, half-axes), the edge width, and the chop share kept
// in the middle cascade.
uniform float shelterStrength;
uniform vec2 shelterLine;
uniform vec4 shelterBasins[${MAX_BASINS}];
uniform int shelterBasinCount;
uniform float shelterBlur;
uniform float shelterChop;

// Distance outside a basin's edge, negative inside (shelter.ts basinEdge).
float basinEdge(vec4 b, vec2 sa) {
  vec2 d = sa - b.xy;
  float e = length(d / b.zw);
  float grad = length(d / (b.zw * b.zw)) / max(e, 1e-6);
  return (e - 1.0) / max(grad, 1e-9);
}

float shelter(vec2 sa) {
  if (shelterStrength <= 0.0) return 0.0;
  float m = shelterLine.y > 0.0 ? 1.0 - smoothstep(shelterLine.x - shelterBlur, shelterLine.x, sa.x) : 0.0;
  for (int i = 0; i < ${MAX_BASINS}; i++) {
    if (i >= shelterBasinCount) break;
    m = max(m, 1.0 - smoothstep(-shelterBlur, 0.0, basinEdge(shelterBasins[i], sa)));
  }
  return shelterStrength * m;
}
`

/** Uniform values for SHELTER_GLSL; `longest`: the longest wave in the
 * middle cascade (m). */
export function shelterUniforms(coast: CoastParams, windSpeed: number, longest: number): Record<string, { value: unknown }> {
  const shelter = coast.shelter
  const basins = shelter?.basins.slice(0, MAX_BASINS) ?? []
  return {
    shelterStrength: { value: shelter?.strength ?? 0 },
    shelterLine: { value: new Vector2(shelter?.line ?? 0, shelter?.line != null ? 1 : 0) },
    shelterBasins: { value: Array.from({ length: MAX_BASINS }, (_, i) => (basins[i] != null ? new Vector4(basins[i].s, basins[i].a, basins[i].halfS, basins[i].halfA) : new Vector4(0, 0, 1, 1))) },
    shelterBasinCount: { value: basins.length },
    shelterBlur: { value: Math.max(shelter?.blur ?? 1, 1e-3) },
    shelterChop: { value: chopFactor(shelterFetch(coast), windSpeed, longest) }
  }
}

/** The longest wave in the middle cascade (spectrum.ts: each cascade owns
 * the band up to 6 wavelengths per tile of the next). */
export function middleCascadeLongest(cascadeSizes: readonly number[]): number {
  return cascadeSizes[1] / 6
}
