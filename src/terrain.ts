import {
  Color,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture
} from 'three'

import { BEACH_MATERIALS, beachLines, isStony, stoneMean } from './beach'
import { fbm, smoothstep, vnoise } from './cellNoise'
import { COAST_KINDS, hasBeach, hasLand } from './coastKind'
import { createPolarGrid } from './grid'
import { EARTH_RADIUS, type CoastParams, type SceneParams } from './params'
import { SHADOW_GLSL, shadowUniforms } from './shadow'

export { hasBeach, hasLand, hasSurfZone, type CoastKind } from './coastKind'

// Procedural coast: a shoreline (curved, wobbly) with a sloping beach rising
// to dunes inland and a sea floor falling away offshore. The same height
// function runs in GLSL (terrain + water shaders) and in TypeScript (to stand
// the camera on the sand), so the noise uses an integer hash that gives
// identical results on the CPU and GPU.

export const TERRAIN_GLSL = /* glsl */ `
uniform vec2 shoreOrigin;
uniform vec2 shoreNormal;
uniform float shoreCurvature;
uniform float shoreWobble;
uniform float beachSlope;
uniform float nearshoreSlope;
uniform float seabedDepth;
uniform float beachWidth;
uniform float duneHeight;
uniform float duneWidth;
uniform float hillHeight;
uniform float sandbarDistance;
uniform float sandbarHeight;
uniform vec2 noiseOffset;
// Storm ridges on stony beaches (beach.ts Ridge): crest distance inland,
// height, half-width; ridgeCount 0 on sand.
uniform vec3 ridges[3];
uniform int ridgeCount;
// Index into COAST_KINDS (coastKind.ts); one profile branch runs per day.
uniform int coastKind;
#define COAST_OPEN_SEA 0
#define COAST_BEACH 1
#define COAST_ROCK_SHORE 2
#define COAST_TIDAL_FLAT 3

bool hasLand() {
  return coastKind != COAST_OPEN_SEA;
}

bool hasSurfZone() {
  return coastKind == COAST_BEACH || coastKind == COAST_ROCK_SHORE;
}

uint hashCell(ivec2 c) {
  uvec2 p = uvec2(c + ivec2(1 << 20));
  uint n = p.x * 1597334677u ^ p.y * 3812015801u;
  n ^= n >> 16;
  n *= 2246822519u;
  n ^= n >> 13;
  n *= 3266489917u;
  n ^= n >> 16;
  return n;
}

float cellValue(ivec2 c) {
  return float(hashCell(c)) / 4294967295.0;
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  return mix(
    mix(cellValue(c), cellValue(c + ivec2(1, 0)), u.x),
    mix(cellValue(c + ivec2(0, 1)), cellValue(c + ivec2(1, 1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    amp *= 0.5;
  }
  return sum / 0.9375;
}

// Distance to the nearest Voronoi cell border (F2 − F1): 0 on the borders,
// growing toward the middle of each cell.
float cellBorder(vec2 p) {
  ivec2 c = ivec2(floor(p));
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      uint h = hashCell(c + ivec2(i, j));
      vec2 point = vec2(float(h & 0xffffu), float((h >> 16) & 0xffffu)) / 65535.0;
      vec2 o = vec2(float(i), float(j)) + point - f;
      float d = dot(o, o);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

// Sea foam. Spent whitewater isn't a sheet with round holes: the bubbles
// gather into a matted weave of strands ("soup") that the water stretches and
// tears into patches. Two warped scales of cell borders make the strands;
// coverage (0..1) thickens them until the gaps close into solid whitewater,
// and a thin bubbly film fills the gaps so they read as foam thinning out,
// not punched holes. Pass coordinates stretched along the flow. When a pixel
// is too large to show the weave it fades to the average density.
float foamLace(vec2 p, float coverage, float footprint) {
  if (coverage <= 0.001) return 0.0;
  // Warp at the cell scale too, so borders curve instead of meeting in
  // straight polygon edges.
  vec2 w = p + 1.6 * vec2(vnoise(p * 0.3), vnoise(p * 0.3 + 31.7)) - 0.8;
  w += 0.7 * vec2(vnoise(p * 1.9 + 5.0), vnoise(p * 1.9 + 11.0)) - 0.35;
  float density = clamp(coverage * (0.45 + 1.1 * fbm(p * 0.22 + 13.0)), 0.0, 1.0);
  // Strand half-width in cell units: hairlines when thin, closing up when
  // dense, and swelling and pinching along each strand.
  float t = mix(0.03, 0.45, density * density) * (0.45 + 1.1 * vnoise(p * 1.3 + 2.0));
  float coarse = 1.0 - smoothstep(t * 0.4, t, cellBorder(w * 1.7));
  float fine = 1.0 - smoothstep(t * 0.3, t * 0.8, cellBorder(w * 4.3 + 7.0));
  float strands = max(coarse, 0.8 * fine);
  // Single bubbles along the strands.
  strands *= 0.75 + 0.25 * vnoise(p * 11.0);
  // A thin, uneven film of bubbles between the strands.
  float film = density * (0.25 + 0.35 * vnoise(p * 2.3 + 9.0));
  float net = max(strands, film) * smoothstep(0.02, 0.15, density);
  float average = density * (0.35 + 0.5 * density);
  float detail = 1.0 - smoothstep(0.02, 0.12, footprint * 4.3);
  return mix(average, net, detail);
}

// (seaward distance from the waterline, along-shore coordinate)
vec2 shoreCoords(vec2 p) {
  vec2 d = p - shoreOrigin;
  vec2 t = vec2(-shoreNormal.y, shoreNormal.x);
  float a = dot(d, t);
  float s = dot(d, shoreNormal);
  s -= shoreCurvature * a * a;
  s -= shoreWobble * (vnoise(vec2(a / 220.0, 3.7) + noiseOffset) * 2.0 - 1.0);
  s -= shoreWobble * 0.3 * (vnoise(vec2(a / 55.0, 9.1) + noiseOffset) * 2.0 - 1.0);
  return vec2(s, a);
}

// Storm ridges thrown up on a stony beach: Gaussian bumps across the shore,
// their crests wandering a little and rising and falling along it.
float ridgeHeight(float u, float a) {
  float h = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= ridgeCount) break;
    vec3 r = ridges[i];
    float fi = float(i);
    float crest = r.x + 1.5 * (vnoise(vec2(a / 40.0 + fi * 7.3, 11.3) + noiseOffset) * 2.0 - 1.0);
    float k = (u - crest) / r.z;
    h += r.y * (0.7 + 0.6 * vnoise(vec2(a / 70.0 + fi * 3.1, 13.7) + noiseOffset)) * exp(-k * k);
  }
  return h;
}

float beachHeightAt(vec2 p, vec2 sa) {
  float s = sa.x;
  float u = -s;
  vec2 q = p + noiseOffset;

  float sea = -s * nearshoreSlope;
  // Clamped: far inland this overflows to infinity, and mix(inf, land, 1)
  // below is inf * 0 = NaN (white specks along distant skylines).
  sea = -seabedDepth * (1.0 - exp(min(sea / seabedDepth, 10.0)));
  sea += sandbarHeight * exp(-pow((s - sandbarDistance) / 22.0, 2.0));

  // Rises with the beach slope, levelling off at the back of the beach.
  float beach = u > 0.0 ? beachSlope * beachWidth * (1.0 - exp(-u / beachWidth)) : u * beachSlope;
  float duneMask = smoothstep(beachWidth, beachWidth + duneWidth, u);
  float dunes = duneHeight * duneMask * (0.45 + 0.55 * fbm(q / 40.0));
  // Rolling hills inland, rising over a few hundred metres behind the dunes.
  float hills = hillHeight * smoothstep(beachWidth + duneWidth, beachWidth + duneWidth + 500.0, u) *
    (0.25 + 0.75 * fbm(q / 450.0)) * smoothstep(-0.2, 1.0, fbm(q / 1400.0 + 7.0));
  float bumps = 0.35 * (fbm(q / 7.0) - 0.5) * smoothstep(0.0, beachWidth, u);
  float land = beach + dunes + hills + bumps + ridgeHeight(u, sa.y);

  return mix(sea, land, smoothstep(-1.0, 1.0, u));
}

float terrainHeightAt(vec2 p, vec2 sa) {
  if (coastKind == COAST_OPEN_SEA) return -200.0;
  // Rock shores and tidal flats use the beach profile until they get their
  // own (PLAN_BIOMES phases 8 and 9).
  return beachHeightAt(p, sa);
}

float terrainHeight(vec2 p) {
  return terrainHeightAt(p, shoreCoords(p));
}
`

// Stones on shingle, cobble and mixed beaches (PLAN_BIOMES 2c): Voronoi cells
// over shore coordinates, one 3×3 search per pixel. Mirrored in beach.ts
// (stoneLevel, stoneCover, stoneAt, stoneCell) so mesh stones (2d) can sit on
// the same cells.
export const STONE_GLSL = /* glsl */ `
// Index in BEACH_MATERIALS: 0 sand (no stones), 1 mixed, 2 shingle, 3 cobble.
uniform int stoneMaterial;
uniform float stoneSize;
uniform vec3 stoneColors[6];
uniform int stoneColorCount;
uniform vec3 stoneMean;
uniform float stoneHighTide;
// Mesh stones (props/stones.ts) out to this distance per size class.
uniform vec3 stoneMeshRadius;

float stoneNearCrest(float u) {
  if (ridgeCount == 0) return 0.0;
  float k = (u - ridges[0].x) / (1.5 * ridges[0].z);
  return exp(-k * k);
}

// Size class 0..2 (STONE_LEVELS): finer below the high-tide line, coarsest
// on the storm ridge, in dithered patches.
int stoneLevel(float u, float a) {
  float scale = 6.0 * stoneSize;
  float g = 1.0 + stoneNearCrest(u) - 0.8 * (1.0 - smoothstep(0.0, stoneHighTide, u));
  g += 0.9 * (vnoise(vec2(u, a) / scale + 41.0 + noiseOffset) - 0.5);
  return int(clamp(floor(g + 0.5), 0.0, 2.0));
}

float stoneCover(float u, float a) {
  if (stoneMaterial != 1) return 1.0;
  float upper = max(smoothstep(0.5, 1.3, u / max(stoneHighTide, 0.5)), stoneNearCrest(u));
  return min(1.0, upper * (0.55 + 0.6 * vnoise(vec2(u, a) / 3.0 + 57.0 + noiseOffset)));
}

struct StoneHit {
  vec2 offset;    // pixel − stone centre, in cell units (u, a)
  float centre;   // distance to the centre, cell units
  float border;   // distance to the cell border (F2 − F1)
  vec3 albedo;
  float presence;
  float shape;    // 0..1: how much of its cell the stone fills
  float size;     // cell size (m)
  int level;      // size class (STONE_LEVELS)
};

StoneHit stoneCell(float u, float a) {
  int level = stoneLevel(u, a);
  float size = stoneSize * (level == 0 ? 0.6 : level == 1 ? 1.0 : 1.6);
  vec2 g = vec2(u, a) / size + noiseOffset;
  ivec2 c = ivec2(floor(g));
  vec2 f = g - floor(g);
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 o1 = vec2(0.0);
  uint h1 = 0u;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      uint h = hashCell(c + ivec2(i, j + level * 7919));
      vec2 point = 0.1 + 0.8 * vec2(float(h & 0xffffu), float((h >> 16) & 0xffffu)) / 65535.0;
      vec2 o = f - vec2(float(i), float(j)) - point;
      float d = dot(o, o);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        o1 = o;
        h1 = h;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  uint h2 = h1 * 747796405u + 2891336453u;
  vec3 base = stoneColors[int(h2 % uint(stoneColorCount))];
  float bright = 0.7 + 0.6 * float((h2 >> 8) & 255u) / 255.0;
  StoneHit hit;
  hit.offset = o1;
  hit.centre = sqrt(d1);
  hit.border = sqrt(d2) - sqrt(d1);
  hit.albedo = base * bright;
  hit.presence = float((h2 >> 16) & 0xffffu) / 65535.0;
  hit.shape = float(h2 >> 24) / 255.0;
  hit.size = size;
  hit.level = level;
  return hit;
}
`

// --- TypeScript mirror of the GLSL above (heights only) ----------------------

// Mirrors of the surf functions in ocean.ts (SURF_GLSL), for placing spray
// on the breaking crests.

/** Where a point sits in the surf cycle, 0..1, growing seaward; crests at 0.25. */
export function surfCycle(coast: CoastParams, s: number, a: number): number {
  const [ox, oz] = coast.noiseOffset
  const phase =
    (2 * Math.PI * s) / coast.surfWavelength + coast.surfPhase + 2.5 * vnoise(a / 90 + ox, 1.3 + oz)
  const w = phase / (2 * Math.PI)
  return w - Math.floor(w)
}

/** Waves come in sets: 0 where a crest fades out, 1 where it's big. */
export function surfSets(coast: CoastParams, s: number, a: number): number {
  const [ox, oz] = coast.noiseOffset
  return smoothstep(0.15, 0.7, vnoise(a / 60 + s / 90 + ox, 5.5 + oz))
}

/** Breaker index: wave height over depth at breaking (McCowan 0.78;
 * steeper beaches hold higher waves, Weggel: 0.72 + 5.6 × slope). */
export function breakerIndex(coast: CoastParams): number {
  return Math.min(1, 0.72 + 5.6 * coast.nearshoreSlope)
}

/** A surf wave at this depth: its height (m, trough to crest), how close it
 * is to breaking (0..1) and how broken it is (0 = swell, 1 = a bore). It
 * shoals from half a wavelength deep (Green's law, H ~ d^-1/4), breaks at
 * H = index × d and stays depth-limited after. `sets` scales the incoming
 * wave (surfSets). */
export function surfWave(coast: CoastParams, depth: number, sets = 1): { height: number; steepness: number; broken: number } {
  const h0 = 1.3 * coast.surfAmplitude * sets
  const half = 0.5 * coast.surfWavelength
  const shoaled = h0 * (half / Math.min(half, Math.max(0.05, depth))) ** 0.25
  const cap = breakerIndex(coast) * depth
  const ratio = shoaled / Math.max(cap, 1e-3)
  return { height: Math.min(shoaled, cap), steepness: Math.min(1, ratio), broken: smoothstep(0.85, 1.05, ratio) }
}

/** Depth (m) where a wave of this set size breaks. */
export function surfBreakDepth(coast: CoastParams, sets = 1): number {
  const h0 = 1.3 * coast.surfAmplitude * sets
  return (h0 * (0.5 * coast.surfWavelength) ** 0.25 / breakerIndex(coast)) ** 0.8
}

/** Water level over one wave, in wave heights, averaging about zero
 * (ocean.ts surfProfile). x = 0 at the crest, growing seaward down its back
 * to the trough, then up the front face of the next wave to 1. */
export function surfProfile(x: number, steep: number, broken: number, minFace = 0): number {
  const mixf = (a: number, b: number, t: number): number => a + (b - a) * t
  const f = Math.min(0.4, Math.max(minFace, mixf(mixf(0.3, 0.12, steep), 0.06, broken)))
  const p = mixf(2.6, 1.3, broken)
  const dip = 0.3 * steep * (1 - 0.5 * broken)
  let shape = x < 1 - f ? (1 - x / (1 - f)) ** p : smoothstep(1 - f, 1, x) ** 1.5
  const t = (x - (1 - f)) / 0.07
  shape -= dip * Math.exp(-t * t)
  const mean = (1 - f) / (p + 1) + f * 0.43 - dip * 0.07 * 1.7725
  return shape - mean
}

export interface CoastFrame {
  origin: [number, number]
  normal: [number, number]
}

/** The camera sits at the world origin; place the shoreline relative to it. */
export function coastFrame(coast: CoastParams): CoastFrame {
  const az = (coast.seawardAzimuthDeg * Math.PI) / 180
  const normal: [number, number] = [Math.sin(az), -Math.cos(az)]
  return {
    origin: [normal[0] * coast.distanceToWater, normal[1] * coast.distanceToWater],
    normal
  }
}

/** How far the waterline is pushed seaward at along-shore coordinate `a`. */
function shoreOffset(coast: CoastParams, a: number): number {
  const [ox, oz] = coast.noiseOffset
  return (
    coast.curvature * a * a +
    coast.wobble * (vnoise(a / 220 + ox, 3.7 + oz) * 2 - 1) +
    coast.wobble * 0.3 * (vnoise(a / 55 + ox, 9.1 + oz) * 2 - 1)
  )
}

/** World (x, z) → [seaward distance from the waterline, along-shore]. */
export function worldToShore(coast: CoastParams, x: number, z: number): [number, number] {
  const { origin, normal } = coastFrame(coast)
  const dx = x - origin[0]
  const dz = z - origin[1]
  const a = dx * -normal[1] + dz * normal[0]
  const s = dx * normal[0] + dz * normal[1] - shoreOffset(coast, a)
  return [s, a]
}

/** [seaward distance, along-shore] → world (x, z). Exact inverse of worldToShore. */
export function shoreToWorld(coast: CoastParams, s: number, a: number): [number, number] {
  const { origin, normal } = coastFrame(coast)
  const raw = s + shoreOffset(coast, a)
  return [origin[0] - normal[1] * a + normal[0] * raw, origin[1] + normal[0] * a + normal[1] * raw]
}

/** Upward-facing surface normal of the terrain by finite differences. */
export function terrainNormal(coast: CoastParams, x: number, z: number, e = 0.5): [number, number, number] {
  const h = terrainHeight(coast, x, z)
  const nx = h - terrainHeight(coast, x + e, z)
  const nz = h - terrainHeight(coast, x, z + e)
  const l = Math.hypot(nx, e, nz)
  return [nx / l, e / l, nz / l]
}

export function terrainHeight(coast: CoastParams, x: number, z: number): number {
  switch (coast.type) {
    case 'open-sea':
      return -200
    case 'beach':
    case 'rock-shore':
    case 'tidal-flat':
      return beachHeight(coast, x, z)
  }
}

/** Storm ridges (mirrors ridgeHeight in TERRAIN_GLSL). */
export function ridgeHeight(coast: CoastParams, u: number, a: number): number {
  const [ox, oz] = coast.noiseOffset
  let h = 0
  coast.ridges.forEach((r, i) => {
    const crest = r.distance + 1.5 * (vnoise(a / 40 + i * 7.3 + ox, 11.3 + oz) * 2 - 1)
    const k = (u - crest) / r.width
    h += r.height * (0.7 + 0.6 * vnoise(a / 70 + i * 3.1 + ox, 13.7 + oz)) * Math.exp(-k * k)
  })
  return h
}

function beachHeight(coast: CoastParams, x: number, z: number): number {
  const [ox, oz] = coast.noiseOffset
  const [s, a] = worldToShore(coast, x, z)

  const u = -s
  const qx = x + ox
  const qz = z + oz
  let sea = -s * coast.nearshoreSlope
  sea = -coast.seabedDepth * (1 - Math.exp(Math.min(sea / coast.seabedDepth, 10)))
  sea += coast.sandbarHeight * Math.exp(-(((s - coast.sandbarDistance) / 22) ** 2))

  const beach =
    u > 0 ? coast.beachSlope * coast.beachWidth * (1 - Math.exp(-u / coast.beachWidth)) : u * coast.beachSlope
  const duneMask = smoothstep(coast.beachWidth, coast.beachWidth + coast.duneWidth, u)
  const dunes = coast.duneHeight * duneMask * (0.45 + 0.55 * fbm(qx / 40, qz / 40))
  const hillStart = coast.beachWidth + coast.duneWidth
  const hills =
    coast.hillHeight *
    smoothstep(hillStart, hillStart + 500, u) *
    (0.25 + 0.75 * fbm(qx / 450, qz / 450)) *
    smoothstep(-0.2, 1, fbm(qx / 1400 + 7, qz / 1400 + 7))
  const bumps = 0.35 * (fbm(qx / 7, qz / 7) - 0.5) * smoothstep(0, coast.beachWidth, u)
  const land = beach + dunes + hills + bumps + ridgeHeight(coast, u, a)

  const t = smoothstep(-1, 1, u)
  return sea + (land - sea) * t
}

/** Uniform values for TERRAIN_GLSL. */
export function terrainUniforms(coast: CoastParams): Record<string, { value: unknown }> {
  const { origin, normal } = coastFrame(coast)
  return {
    shoreOrigin: { value: new Vector2(...origin) },
    shoreNormal: { value: new Vector2(...normal) },
    shoreCurvature: { value: coast.curvature },
    shoreWobble: { value: coast.wobble },
    beachSlope: { value: coast.beachSlope },
    nearshoreSlope: { value: coast.nearshoreSlope },
    seabedDepth: { value: coast.seabedDepth },
    beachWidth: { value: coast.beachWidth },
    duneHeight: { value: coast.duneHeight },
    duneWidth: { value: coast.duneWidth },
    hillHeight: { value: coast.hillHeight },
    sandbarDistance: { value: coast.sandbarDistance },
    sandbarHeight: { value: coast.sandbarHeight },
    noiseOffset: { value: new Vector2(...coast.noiseOffset) },
    ridges: { value: [0, 1, 2].map(i => (coast.ridges[i] != null ? new Vector3(coast.ridges[i].distance, coast.ridges[i].height, coast.ridges[i].width) : new Vector3())) },
    ridgeCount: { value: Math.min(3, coast.ridges.length) },
    coastKind: { value: COAST_KINDS.indexOf(coast.type) }
  }
}

/** Uniform values for STONE_GLSL; stoneMaterial 0 (no stones) on sand. */
export function stoneUniforms(coast: CoastParams): Record<string, { value: unknown }> {
  const stony = hasBeach(coast) && isStony(coast.material)
  const palette = coast.stoneColors.slice(0, 6)
  return {
    stoneMaterial: { value: stony ? BEACH_MATERIALS.indexOf(coast.material) : 0 },
    stoneSize: { value: Math.max(coast.stoneSize, 0.01) },
    stoneColors: { value: [0, 1, 2, 3, 4, 5].map(i => new Color(...(palette[i] ?? palette[0]))) },
    stoneColorCount: { value: palette.length },
    stoneMean: { value: new Color(...stoneMean(palette)) },
    stoneHighTide: { value: beachLines(coast).highTide },
    // Set from the props (createStones) once they are placed.
    stoneMeshRadius: { value: new Vector3() }
  }
}

// --- Terrain mesh ---------------------------------------------------------------

const vertexShader = /* glsl */ `
${TERRAIN_GLSL}
uniform float earthRadius;
varying vec3 vWorld;

void main() {
  vec2 p = position.xz;
  float r = length(p);
  float h = terrainHeight(p);
  float drop = 0.9 * (r * r) / (2.0 * earthRadius);
  vWorld = vec3(p.x, h - drop, p.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`

const fragmentShader = /* glsl */ `
#define PI 3.14159265359
${TERRAIN_GLSL}
${STONE_GLSL}
${SHADOW_GLSL}
uniform vec3 sunDirection;
uniform vec3 sunIrradiance;
uniform vec3 skyIrradiance;
uniform samplerCube envMap;
uniform vec3 sandAlbedo;
uniform float runup;
uniform vec3 groundCover;
uniform float groundCoverAmount;
uniform float pixelAngle;
varying vec3 vWorld;

void main() {
  vec2 p = vWorld.xz;
  vec2 sa = shoreCoords(p);
  float h = terrainHeightAt(p, sa);
  vec2 q = p + noiseOffset;

  // Normal from finite differences, at a step matched to the pixel size.
  // Ground size of a pixel, from distance and the camera's per-pixel angle
  // (stretched at grazing angles). Screen-space derivatives can be NaN on
  // distant silhouette edges, which turned the normal into NaN and bloom into
  // white specks, so they are not used here.
  vec3 toCamera = cameraPosition - vWorld;
  float grazing = max(abs(normalize(toCamera).y), 0.05);
  float footprint = clamp(length(toCamera) * pixelAngle / grazing, 0.001, 200.0);
  float e = max(0.03, footprint);
  float hx = terrainHeight(p + vec2(e, 0.0));
  float hz = terrainHeight(p + vec2(0.0, e));
  vec3 N = normalize(vec3(h - hx, e, h - hz));

  // Stones: how much of the pixel is stone (0 on sand), its albedo, and a
  // dome normal per stone while the stones are bigger than a pixel; further
  // off they fade to the palette mean, darkened by the gaps between them.
  float stoneW = 0.0;
  vec3 stoneAlbedo = stoneMean;
  float u = -sa.x;
  if (stoneMaterial > 0 && u > -1.5) {
    float zone = smoothstep(-1.5, -0.5, u);
    float cover = stoneCover(u, sa.y);
    bool mixedBeach = stoneMaterial == 1;
    // Cells cover pixels down to ~0.6 stone sizes, then average out.
    float detail = 1.0 - smoothstep(0.2, 0.9, footprint / (stoneSize * 0.6));
    // Further off, sorting into patches and bands keeps a stony mottle
    // after single stones go below a pixel: two octaves, each fading out
    // once it too is smaller than a pixel.
    vec2 g = vec2(u, sa.y) / stoneSize + noiseOffset;
    float w4 = 1.0 - smoothstep(0.3, 1.0, footprint / (stoneSize * 4.0));
    float w16 = 1.0 - smoothstep(0.3, 1.0, footprint / (stoneSize * 16.0));
    float mottle = 1.0 + 0.5 * w4 * (vnoise(g / 4.0) - 0.5) + 0.4 * w16 * (vnoise(g / 16.0 + 7.0) - 0.5);
    vec3 far = stoneMean * 0.8 * mottle;
    float nearW = 1.0;
    vec3 near = far;
    if (detail > 0.0) {
      StoneHit st = stoneCell(u, sa.y);
      float present = st.presence < cover ? 1.0 : 0.0;
      // Rounded stones, not paving: each fills an oval inside its cell, with
      // dark gaps along the borders and at the corners.
      float fill = 0.85 + 0.35 * st.shape;
      float body = present * smoothstep(0.03, 0.12, st.border) * (1.0 - smoothstep(0.42 * fill, 0.62 * fill, st.centre));
      vec3 mottled = st.albedo * mottle * (0.85 + 0.3 * vnoise(vec2(u, sa.y) / st.size * 3.0 + 3.1));
      near = mixedBeach ? mottled : mix(stoneMean * 0.35 * mottle, mottled, body);
      nearW = mixedBeach ? body : 1.0;
      // Dome: the surface tilts away from each stone's centre, flatter on
      // shingle (pebbles lie flat), rounder on cobbles.
      float dome = stoneMaterial == 2 ? 1.2 : stoneMaterial == 3 ? 1.8 : 1.5;
      vec2 t = vec2(-shoreNormal.y, shoreNormal.x);
      vec2 tilt = -shoreNormal * st.offset.x + t * st.offset.y;
      // Steepest at the rim, like a half-buried ellipsoid.
      float rim = 1.0 + 2.0 * smoothstep(0.25 * fill, 0.62 * fill, st.centre);
      // Where a mesh stone sits on the cell, it brings its own shape; the
      // shader keeps only the colour and dark gaps under and between them.
      float meshR = st.level == 0 ? stoneMeshRadius.x : st.level == 1 ? stoneMeshRadius.y : stoneMeshRadius.z;
      float meshed = step(0.001, meshR) * (1.0 - smoothstep(0.8 * meshR, meshR, length(vWorld.xz - cameraPosition.xz)));
      N = normalize(N + vec3(tilt.x, 0.0, tilt.y) * dome * rim * body * detail * (1.0 - meshed));
    }
    stoneW = zone * mix(mixedBeach ? cover : 1.0, nearW, detail);
    stoneAlbedo = mix(far, near, detail);
  }

  // Wind ripples on dry sand: fine ridges perpendicular to an oblique wind.
  float rippleFade = (1.0 - smoothstep(0.01, 0.06, footprint)) * (1.0 - stoneW);
  vec2 rippleDir = normalize(vec2(0.8, 0.6));
  float warp = vnoise(q * 0.9) * 6.0 + vnoise(q * 3.1) * 1.5;
  float ripple = sin(dot(q, rippleDir) * 28.0 + warp);
  N = normalize(N + vec3(rippleDir.x, 0.0, rippleDir.y) * ripple * 0.05 * rippleFade);

  // Albedo variation: patches, darker lines of shell/organic debris.
  float patches = fbm(q / 3.0);
  vec3 albedo = sandAlbedo * (0.82 + 0.3 * patches);
  albedo = mix(albedo, stoneAlbedo * (0.9 + 0.2 * patches), stoneW);
  float wrack = 1.0 - smoothstep(0.0, 0.08, abs(h - runup * 1.25 - 0.1 * (vnoise(vec2(sa.y / 6.0, 2.0)) - 0.5)));
  albedo *= 1.0 - 0.35 * wrack * smoothstep(0.4, 0.7, vnoise(vec2(sa.y / 2.0, 5.0)));

  // Vegetation behind the beach: patchy ground cover thickening inland, thin
  // on steep slopes and dune crests.
  float inland = -sa.x;
  float coverStart = beachWidth * 0.75 + duneWidth * 0.3;
  float cover = smoothstep(coverStart, coverStart + duneWidth + 30.0, inland);
  cover *= smoothstep(0.25, 0.65, fbm(q / 25.0) * 0.6 + fbm(q / 4.0) * 0.4 + cover * 0.25);
  cover *= smoothstep(0.75, 0.9, N.y) * groundCoverAmount;
  vec3 coverAlbedo = groundCover * (0.6 + 0.8 * fbm(q / 9.0 + 4.0));
  albedo = mix(albedo, coverAlbedo, cover);

  // Wet sand below the run-up line: darker and glossy.
  float wetLine = runup * (0.85 + 0.3 * vnoise(vec2(sa.y / 25.0, 7.0)));
  float wet = 1.0 - smoothstep(wetLine * 0.7, wetLine, h);
  // Wet stones darken a little more than sand.
  albedo *= mix(1.0, mix(0.55, 0.5, stoneW), wet);

  vec3 L = sunDirection;
  vec3 V = normalize(cameraPosition - vWorld);
  float shadow = lightReaching(vWorld);
  float NoL = max(dot(N, L), 0.0) * shadow;
  // Soft wrap lighting stands in for the missing ambient occlusion/shadowing.
  vec3 diffuse = albedo / PI * (sunIrradiance * NoL + skyIrradiance * (0.6 + 0.4 * N.y));
  vec3 color = diffuse;

  if (wet > 0.0) {
    // A film of water: mirror-like reflection of the sky and the sun.
    // On stones the film follows each stone, so each gets its own glint.
    vec3 Nw = normalize(mix(N, vec3(0.0, 1.0, 0.0), mix(0.7, 0.15, stoneW)));
    float NoV = max(dot(Nw, V), 1e-3);
    float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
    vec3 R = reflect(-V, Nw);
    R.y = abs(R.y);
    vec3 reflected = textureLod(envMap, R, 2.0).rgb;
    vec3 H = normalize(L + V);
    float NoH = max(dot(Nw, H), 0.0);
    // Widen the highlight where a pixel covers a lot of sand, so thin distant
    // wet strips shimmer softly instead of sparkling.
    float alpha = clamp(0.08 + footprint * 0.4, 0.08, 0.6);
    float a2 = alpha * alpha;
    float d = NoH * NoH * (a2 - 1.0) + 1.0;
    float NoLw = max(dot(Nw, L), 0.0) * shadow;
    float k = alpha * 0.5;
    float G = NoLw / (NoLw * (1.0 - k) + k) * NoV / (NoV * (1.0 - k) + k);
    float spec = a2 / (PI * d * d) * F * G / (4.0 * NoV);
    color += wet * (reflected * F + sunIrradiance * min(spec, 0.6));

    // Lacy foam left by the last wave at the edge of the swash.
    float edge = 1.0 - smoothstep(0.0, 0.08, abs(h - wetLine * 0.55 - 0.03 * (vnoise(q * 0.4) - 0.5)));
    edge *= 0.35 + 0.65 * fbm(vec2(sa.y / 9.0, 3.3) + noiseOffset);
    float foam = foamLace(vec2(sa.y, sa.x * 1.8) + noiseOffset, edge * 0.8, footprint) *
      (1.0 - smoothstep(0.3, 1.5, footprint));
    color = mix(color, vec3(0.85) / PI * (sunIrradiance * NoL + skyIrradiance), foam);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export function createTerrain(params: SceneParams): Mesh<BufferGeometry, ShaderMaterial> {
  const { coast } = params
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...terrainUniforms(coast),
      earthRadius: { value: EARTH_RADIUS },
      sunDirection: { value: new Vector3(...params.sunDirection) },
      sunIrradiance: { value: new Color() },
      skyIrradiance: { value: new Color() },
      envMap: { value: null as Texture | null },
      sandAlbedo: { value: new Color(...coast.sand.albedo) },
      ...stoneUniforms(coast),
      runup: { value: coast.runup },
      groundCover: { value: new Color(...params.biome.groundCover) },
      groundCoverAmount: { value: params.biome.groundCoverAmount },
      pixelAngle: { value: 0.001 },
      ...shadowUniforms()
    }
  })
  const mesh = new Mesh(createPolarGrid({ rings: 600, segments: 1024, outerRadius: 120_000 }), material)
  mesh.frustumCulled = false
  mesh.visible = hasLand(coast)
  return mesh
}
