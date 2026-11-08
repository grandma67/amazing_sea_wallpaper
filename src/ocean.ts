import {
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
  Vector4,
  type BufferGeometry,
  type Texture
} from 'three'

import { OCEAN_VIEWS } from './debug'
import { createPolarGrid } from './grid'
import { SHADOW_GLSL, shadowUniforms } from './shadow'
import { seabedAlbedo } from './beach'
import { middleCascadeLongest, SHELTER_GLSL, shelterUniforms } from './shelter'
import { TERRAIN_GLSL, terrainUniforms } from './terrain'
import { EARTH_RADIUS, type SceneParams } from './params'
import { CASCADE_SIZE, type OceanSurface, RIPPLE_LAYERS, rippleSlopeScale, windWaveOnset } from './spectrum'
import type { ShipWake } from './props/ships'

/** How many rocks the ocean shader foams round (the nearest). */
export const MAX_ROCKS = 48
/** How many islands and big rocks it foams round (the nearest), and the
 * points on each outline (props/surf.ts OUTLINE_POINTS). */
export const MAX_ISLANDS = 4
const ISLAND_POINTS = 32
/** How many boats the ocean shader cuts out and draws wakes for (the nearest). */
export const MAX_SHIPS = 8
/** Ship lamps the sea mirrors (props/shipLights.ts lampsForOcean). */
export const MAX_LAMPS = 12

// Ocean surface: a camera-centred polar grid displaced by three FFT cascades
// (see spectrum.ts). Normals come from the derivative textures per pixel, and
// the mipmapped slope moments give the slope variance of waves too small to
// see, which widens the sun's glitter path the way real distant water does.

const SURF_GLSL = /* glsl */ `
uniform float surfAmplitude;
uniform float surfWavelength;
uniform float surfPhase;

// Swell refracts to run parallel to the shore and steepens over shallows
// before breaking. Position in the wave cycle (0..1), growing seaward; crests
// sit at 0.25 (props/surf.ts mirrors this as surfCycle).
float surfCycle(vec2 sa) {
  float phase = 6.2831853 * sa.x / surfWavelength + surfPhase +
    2.5 * vnoise(vec2(sa.y / 90.0, 1.3) + noiseOffset);
  return fract(phase / 6.2831853);
}

// Waves arrive in sets: some stretches of a crest are big, others fade out.
float surfSets(vec2 sa) {
  return smoothstep(0.15, 0.7, vnoise(vec2(sa.y / 60.0 + sa.x / 90.0, 5.5) + noiseOffset));
}

// Shoaling and breaking (terrain.ts mirrors all of this as surfWave and
// surfProfile). A wave feels the bottom once the water is shallower than
// half its wavelength and grows as it slows (Green's law, H ~ d^-1/4). It
// breaks when its height reaches the breaker index times the depth (McCowan
// 0.78; steeper beaches hold higher waves, Weggel: 0.72 + 5.6 slope), and
// from there on the broken wave, a bore, stays depth-limited: H = index * d.
float breakerIndex() {
  return min(1.0, 0.72 + 5.6 * nearshoreSlope);
}

// x: height (m, trough to crest) at this depth; y: how broken, 0..1.
vec2 surfWave(float depth, float sets) {
  float h0 = 1.3 * surfAmplitude * sets;
  float halfL = 0.5 * surfWavelength;
  float shoaled = h0 * pow(halfL / clamp(depth, 0.05, halfL), 0.25);
  float cap = breakerIndex() * depth;
  float ratio = shoaled / max(cap, 1e-3);
  return vec2(min(shoaled, cap), smoothstep(0.85, 1.05, ratio));
}

// How close an unbroken wave is to breaking, 0..1.
float surfSteepness(float depth, float sets) {
  float h0 = 1.3 * surfAmplitude * sets;
  float halfL = 0.5 * surfWavelength;
  float shoaled = h0 * pow(halfL / clamp(depth, 0.05, halfL), 0.25);
  return clamp(shoaled / max(breakerIndex() * depth, 1e-3), 0.0, 1.0);
}

// Water level over one wave, in wave heights, averaging zero (the water a
// crest piles up comes from the trough). x = 0 at the crest, growing seaward
// down its long back to the trough, then up the steep front face of the
// wave behind it to 1. Shallow-water waves have peaked crests and long, flat
// troughs (cnoidal); the face steepens toward breaking, and the wave draws
// water down off the bottom in front of it. Broken, it's a bore: a near
// vertical front and a fuller back sloping down behind it.
// minFace: the narrowest face the grid or the pixels can show, as a
// fraction of the wavelength; a face narrower than that zig-zags.
float surfProfile(float x, float steep, float broken, float minFace) {
  float f = clamp(mix(mix(0.3, 0.12, steep), 0.06, broken), minFace, 0.4);
  float p = mix(2.6, 1.3, broken);
  float dip = 0.3 * steep * (1.0 - 0.5 * broken);
  float shape = x < 1.0 - f
    ? pow(1.0 - x / (1.0 - f), p)
    : pow(smoothstep(1.0 - f, 1.0, x), 1.5);
  // Drawdown at the foot of the face.
  float t = (x - (1.0 - f)) / 0.07;
  shape -= dip * exp(-t * t);
  float mean = (1.0 - f) / (p + 1.0) + f * 0.43 - dip * 0.07 * 1.7725;
  return shape - mean;
}

// The incoming wave's size: its set, less what a reef or barrier has taken
// (shelter.ts). Past a reef the broken waves re-form at 1 − shelter.
float surfIncoming(vec2 sa) {
  return surfSets(sa) * (1.0 - shelter(sa));
}

float surfHeight(vec2 sa, float depth, float resolution) {
  if (surfAmplitude <= 0.0 || !hasSurfZone()) return 0.0;
  // Surf lives where the waves feel the bottom, near the shore; out deeper
  // the open-sea spectrum takes over.
  float zone = (1.0 - smoothstep(0.35 * surfWavelength, 0.6 * surfWavelength, depth)) *
    (1.0 - smoothstep(surfReach(), surfReach() + 200.0, sa.x - waterline));
  float sets = surfIncoming(sa);
  vec2 wave = surfWave(depth, sets);
  float x = fract(surfCycle(sa) - 0.25);
  return wave.x * zone * surfProfile(x, surfSteepness(depth, sets), wave.y, 2.5 * resolution / surfWavelength);
}
`

const vertexShader = /* glsl */ `
${TERRAIN_GLSL}
${SHELTER_GLSL}
${SURF_GLSL}
uniform float waveHeight;
uniform sampler2D a0;
uniform sampler2D a1;
uniform sampler2D a2;
uniform vec3 cascadeSize;
uniform float earthRadius;

varying vec2 vGrid;
varying vec3 vWorld;
varying float vHeight;

// Open-ocean waves are damped as they reach shallow water.
float shallowDamping(float depth) {
  return mix(0.1, 1.0, smoothstep(0.0, 2.0 * waveHeight + 1.5, depth));
}

// Short chop survives in shallow water; only flattens right at the edge.
float shortDamping(float depth) {
  return mix(0.35, 1.0, smoothstep(0.0, 1.0, depth));
}

vec3 displacement(sampler2D tex, vec2 p, float size, float spacing) {
  float lod = max(0.0, log2(spacing / (size / ${CASCADE_SIZE}.0)));
  return textureLod(tex, p / size, lod).xyz;
}

void main() {
  // The grid is built around the origin, which is where the camera sits.
  vec2 grid = position.xz;
  float r = length(grid);
  float spacing = max(r * 0.012, 0.01);

  vec2 sa = shoreCoords(grid);
  float depth = max(-terrainHeightAt(grid, sa), 0.0);
  // Sheltered water keeps no swell and only the chop its fetch raises
  // (shelter.ts cascadeShelter).
  float sheltered = shelter(sa);
  float damping = shallowDamping(depth);
  vec3 d =
    displacement(a0, grid, cascadeSize.x, spacing) * damping * (1.0 - sheltered) +
    displacement(a1, grid, cascadeSize.y, spacing) * damping * (1.0 - sheltered * (1.0 - shelterChop)) +
    displacement(a2, grid, cascadeSize.z, spacing) * shortDamping(depth);
  d.y += surfHeight(sa, depth, spacing);

  // Earth curvature, so the sea meets the sky at the (dipped) horizon. Slightly
  // under-curved so the polygonal far edge stays above the sky's own horizon.
  float drop = 0.9 * (r * r) / (2.0 * earthRadius);
  vec3 world = vec3(grid.x + d.x, d.y - drop, grid.y + d.z);

  vGrid = grid;
  vWorld = world;
  vHeight = d.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const fragmentShader = /* glsl */ `
#define PI 3.14159265359
${TERRAIN_GLSL}
${SHADOW_GLSL}
${SHELTER_GLSL}
${SURF_GLSL}
uniform vec3 absorption;
uniform vec3 sandAlbedo;

uniform sampler2D a0;
uniform sampler2D a1;
uniform sampler2D a2;
uniform sampler2D b0;
uniform sampler2D b1;
uniform sampler2D b2;
uniform sampler2D c0;
uniform sampler2D c1;
uniform sampler2D c2;
uniform vec3 cascadeSize;

uniform samplerCube envMap;
uniform float envMaxLod;
uniform sampler2D planarMap;
uniform mat4 planarMatrix;
uniform float planarOn;
uniform float reflectionRay;
uniform float reflectionStreaks;
uniform float reflectionHaze;
uniform vec3 reflectionAir;
uniform float reflectionSeaHaze;
// Depth of the mirror image and the mirror camera's (oblique) inverse
// projection: how far each reflected ray travels (reflection.ts).
uniform sampler2D planarDepth;
uniform mat4 planarProjInv;
// Rocks cutting the surface (props/surf.ts waterRocks): x, z, waterline
// radius, and whether the waves break on them (waveOnRock), 0..1.
uniform vec4 rockData[${MAX_ROCKS}];
uniform int rockCount;
// Islands and big rocks (props/index.ts waterIslands): x, z, wave crest
// height and whether the waves break on them; waterline radii at angles
// k·2π/${ISLAND_POINTS} (atan(z, x)), 4 per vec4.
uniform vec4 islandData[${MAX_ISLANDS}];
uniform vec4 islandOutline[${(MAX_ISLANDS * ISLAND_POINTS) / 4}];
uniform int islandCount;

float islandRadius(int i, float angle) {
  float f = mod(angle / (2.0 * PI) * ${ISLAND_POINTS}.0 + ${ISLAND_POINTS}.0, ${ISLAND_POINTS}.0);
  int j0 = int(floor(f));
  int j1 = (j0 + 1) % ${ISLAND_POINTS};
  int base = i * ${ISLAND_POINTS / 4};
  float r0 = islandOutline[base + j0 / 4][j0 % 4];
  float r1 = islandOutline[base + j1 / 4][j1 % 4];
  return mix(r0, r1, fract(f));
}
// Boats (props/ships.ts ShipWake): x, z, bow direction; length, beam, speed,
// catamaran hull offset; Kelvin wave height, wake foam, foam lifetime (s),
// white water round the hull.
uniform vec4 shipPose[${MAX_SHIPS}];
uniform vec4 shipHull[${MAX_SHIPS}];
uniform vec4 shipWake[${MAX_SHIPS}];
uniform int shipCount;
uniform vec3 sunDirection;
uniform vec3 sunIrradiance;
// Lightning flashes lighting the cloud base (stormEffects.ts flashGlows):
// direction and angular radius, and their radiance.
uniform vec4 flashGlows[3];
uniform int flashCount;
uniform vec3 flashRadiance;
// Ships' lamps as point lights: world position, and intensity × colour in
// scene units (irradiance at 1 m).
uniform vec3 lampPositions[${MAX_LAMPS}];
uniform vec3 lampIntensities[${MAX_LAMPS}];
// 0 a short shutter … 1 past ~30 s (frameMeter.ts longExposureLook).
uniform float longExposure;
uniform int lampCount;
uniform vec3 skyIrradiance;
// Debug view (debug.ts): index in OCEAN_VIEWS, 0: none.
uniform int oceanView;
uniform vec3 deepColor;
uniform vec3 scatterColor;
uniform float whitecaps;
uniform float shortWaves;
uniform float windWaves;
uniform float waveHeight;
uniform float rain;

// Rain on the sea (sources: knowledge/REFERENCES.md): each drop throws up
// a crown and a Worthington jet, then sends out a capillary ring wave. Drops
// fall on a jittered grid with random ages; returns the ring slope (xy) and
// a splash mark (z) where a drop has just landed. Only resolved close up.
vec3 rainRings(vec2 p, float footprint) {
  vec3 result = vec3(0.0);
  float near = 1.0 - smoothstep(0.02, 0.3, footprint);
  if (rain <= 0.0 || near <= 0.0) return result;
  for (int layer = 0; layer < 2; layer++) {
    float cell = layer == 0 ? 0.5 : 0.31;
    vec2 q = p / cell + float(layer) * 17.3;
    ivec2 id = ivec2(floor(q));
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        ivec2 c = id + ivec2(i, j);
        float h1 = cellValue(c * 3 + 11);
        float h2 = cellValue(c * 7 + 5);
        float age = cellValue(c * 13 + 2);
        // Fewer drops in lighter rain.
        if (cellValue(c * 5 + 9) > rain) continue;
        vec2 center = (vec2(c) + vec2(h1, h2) - float(layer) * 17.3) * cell;
        vec2 d = p - center;
        float dist = length(d);
        float radius = age * cell * 1.1;
        float x = (dist - radius) / (cell * 0.07);
        // Derivative of a Gaussian ring, fading as it spreads.
        float wave = -2.0 * x * exp(-x * x) * (1.0 - age) * (1.0 - age);
        result.xy += d / max(dist, 1e-4) * wave * 0.22;
        result.z = max(result.z, (1.0 - smoothstep(cell * 0.015, cell * 0.04, dist)) * (1.0 - smoothstep(0.05, 0.15, age)));
      }
    }
  }
  return result * near;
}


varying vec2 vGrid;
varying vec3 vWorld;
varying float vHeight;

float shallowDamping(float depth) {
  return mix(0.1, 1.0, smoothstep(0.0, 2.0 * waveHeight + 1.5, depth));
}

// Short chop survives in shallow water; only flattens right at the edge.
float shortDamping(float depth) {
  return mix(0.35, 1.0, smoothstep(0.0, 1.0, depth));
}

// Bright network of light focused by the waves onto the sea floor.
float caustics(vec2 p) {
  float c1 = 1.0 - abs(vnoise(p * 0.9) * 2.0 - 1.0);
  float c2 = 1.0 - abs(vnoise(p * 1.37 + vec2(4.1, 7.3)) * 2.0 - 1.0);
  return pow(c1 * c2, 6.0) * 5.0 + 0.45;
}

// Half-width of a hull at t (0 stern, 1 bow) over half its beam; mirrors
// props/ships.ts hullShape. Negative off the ends.
float hullHalfWidth(float t) {
  if (t <= 0.0 || t >= 1.0) return -1.0;
  return t < 0.45 ? 0.8 + 0.2 * sin(t / 0.45 * 1.5707963) : max(0.015, 1.0 - pow((t - 0.45) / 0.55, 1.7));
}

float ggx(float NoH, float alpha) {
  float a2 = alpha * alpha;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float smithG1(float NoX, float alpha) {
  float a2 = alpha * alpha;
  return 2.0 * NoX / (NoX + sqrt(a2 + (1.0 - a2) * NoX * NoX));
}

float fresnel(float cosTheta) {
  return 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);
}

// Accumulates derivatives and unresolved slope variance from one cascade.
void cascade(
  sampler2D a, sampler2D b, sampler2D c, float size, float weight,
  inout vec4 derivatives, inout float dxz, inout vec2 variance
) {
  vec2 uv = vGrid / size;
  vec4 bs = texture(b, uv);
  vec4 cs = texture(c, uv);
  derivatives += bs * weight;
  dxz += texture(a, uv).w * weight;
  // Unresolved ripples are kept even where the swell is damped; perfectly
  // smooth distant shallows would otherwise alias into glints.
  variance += max(cs.xy - bs.xy * bs.xy, 0.0) * max(weight * weight, 0.6);
}

void main() {
  vec2 sa = shoreCoords(vGrid);
  float ground = terrainHeightAt(vGrid, sa);
  // On land the terrain mesh is drawn instead.
  if (ground > 0.3) discard;
  float depth = max(-ground, 0.0);
  float damping = shallowDamping(depth);
  float shortDamp = shortDamping(depth);
  // One factor for everything read from the cascades: slopes, the Jacobian
  // foam and whitecaps (as in the vertex shader).
  float sheltered = shelter(sa);

  vec4 derivatives = vec4(0.0);
  float dxz = 0.0;
  vec2 variance = vec2(0.0);
  cascade(a0, b0, c0, cascadeSize.x, damping * (1.0 - sheltered), derivatives, dxz, variance);
  // Wind gusts and slicks: large patches where the short waves are rougher or
  // calmer. Breaks up visible tiling and looks like real open water.
  float gust = mix(0.45, 1.5, fbm(vGrid / 700.0 + noiseOffset * 0.01));
  cascade(a1, b1, c1, cascadeSize.y, damping * (1.0 - sheltered * (1.0 - shelterChop)) * mix(1.0, gust, 0.5), derivatives, dxz, variance);
  // Rain stirs a thin turbulent layer that damps the shortest gravity waves.
  cascade(a2, b2, c2, cascadeSize.z, shortDamp * gust * (1.0 - 0.6 * rain), derivatives, dxz, variance);
  // Ripples (1 cm to ~30 cm) carry most of a windy sea's slope (Cox–Munk;
  // spectrum.ts shortWaveVariance): the finest cascade again, shrunk and
  // turned, its slopes scaled up. Drawn near the camera (glints), roughness
  // far off (its mips). Slopes only: they don't fold into foam.
  if (shortWaves > 0.0) {
    float w = shortWaves * shortDamp * gust * (1.0 - 0.6 * rain) * ${(1 / Math.sqrt(RIPPLE_LAYERS.length)).toFixed(6)};
${RIPPLE_LAYERS.map(({ shrink, turn }) => {
    const c = Math.cos(turn).toFixed(6), s = Math.sin(turn).toFixed(6), m = (-Math.sin(turn)).toFixed(6)
    return `    {
      vec2 uv = mat2(${c}, ${s}, ${m}, ${c}) * vGrid / (cascadeSize.z / ${shrink.toFixed(2)});
      vec4 bs = texture(b2, uv);
      vec4 cs = texture(c2, uv);
      // h(x) = h₂(s·R·x) / s: same slopes, turned back into the world frame.
      derivatives.xy += mat2(${c}, ${m}, ${s}, ${c}) * bs.xy * w;
      variance += vec2(max(cs.x + cs.y - dot(bs.xy, bs.xy), 0.0) * 0.5 * w * w);
    }`
  }).join('\n')}
  }

  // Surf slope by finite differences.
  float e = 0.15;
  float surfRes = clamp(max(length(dFdx(vGrid)), length(dFdy(vGrid))), 0.0, 200.0);
  float s0 = surfHeight(sa, depth, surfRes);
  vec2 sx = shoreCoords(vGrid + vec2(e, 0.0));
  vec2 sz = shoreCoords(vGrid + vec2(0.0, e));
  derivatives.x += (surfHeight(sx, depth, surfRes) - s0) / e;
  derivatives.y += (surfHeight(sz, depth, surfRes) - s0) / e;

  float jxx = max(1.0 + derivatives.z, 0.2);
  float jzz = max(1.0 + derivatives.w, 0.2);
  // Surface compression; < 0 means the wave has folded over (breaking crest).
  float jacobian = (1.0 + derivatives.z) * (1.0 + derivatives.w) - dxz * dxz;
  vec2 slope = derivatives.xy / vec2(jxx, jzz);
  vec3 rainDrops = rainRings(vGrid, clamp(max(length(dFdx(vGrid)), length(dFdy(vGrid))), 0.0, 200.0));
  slope += rainDrops.xy;

  // Boats. No sea inside a hull (crests would poke through the deck); a
  // Kelvin wake (both wave systems, from stationary phase: a point at angle
  // a off the track sees waves at angle th with tan a = tan th / (1 + 2 tan² th),
  // k = g / (U cos th)², so the wedge is 19.47°); a hull only makes waves
  // about its own size well, which narrows a fast boat's wake (Rabaud &
  // Moisy 2013); foam from the bow wave and the propeller wash, which fades
  // with the time since the stern passed, and a long smooth slick where the
  // turbulence has damped the ripples.
  float slick = 0.0;
  float wakeFoam = 0.0;
  for (int i = 0; i < ${MAX_SHIPS}; i++) {
    if (i >= shipCount) break;
    vec4 pose = shipPose[i];
    float L = shipHull[i].x;
    float B = shipHull[i].y;
    float U = shipHull[i].z;
    float spacing = shipHull[i].w;
    vec4 wake = shipWake[i];
    vec2 fwd = pose.zw;
    vec2 side = vec2(-fwd.y, fwd.x);
    // The displaced surface is what meets the hull.
    vec2 d = vWorld.xz - pose.xy;
    float along = dot(d, fwd);
    float across = dot(d, side);
    float x = 0.5 * L - along;
    float reach = max(30.0 * L + 500.0, U * wake.z * 12.0);
    if (x < -2.0 * B - 5.0 || x > reach || abs(across) > 0.36 * max(x, 0.0) + spacing + 3.0 * B + 10.0) continue;
    float t = along / L + 0.5;
    float hw = hullHalfWidth(t) * 0.5 * B;
    float ac = spacing > 0.0 ? abs(abs(across) - spacing) : abs(across);
    // Inside the waterline (a little in from the hull's widest).
    if (ac < hw * 0.88) discard;
    float outside = t >= 1.0 ? length(vec2(along - 0.5 * L, ac))
      : t <= 0.0 ? length(vec2(-0.5 * L - along, max(ac - 0.4 * B, 0.0)))
      : ac - hw * 0.92;
    float resolved = clamp(B / max(surfRes, 1e-3), 0.0, 1.0);
    float collar = exp(-pow(max(outside, 0.0) / (0.15 * B + 0.5), 2.0)) * mix(0.55, 1.0, smoothstep(0.5, 1.0, t));
    wakeFoam = max(wakeFoam, wake.w * collar * (0.5 + 0.8 * fbm(vec2(along, across) / (0.4 + 0.1 * B) + noiseOffset)) * resolved);
    if (U < 0.2) continue;
    // Turbulent wake behind the stern, spreading slowly.
    float behind = x - L;
    float s = max(behind, 0.0);
    float w = 0.4 * B + spacing + 0.06 * sqrt(s * B) + 0.002 * s;
    float core = exp(-pow(across / w, 2.0)) * smoothstep(-0.3 * B, 0.2 * B, behind);
    float age = s / U;
    float n = fbm(vec2(along / (2.0 + 0.15 * B), across / (0.7 + 0.08 * B)) + noiseOffset);
    float churn = 0.55 + 0.9 * n;
    // Ageing foam breaks up into patches, then streaks.
    float life = exp(-age / wake.z);
    wakeFoam = max(wakeFoam, wake.y * core * life * smoothstep(0.15, 0.6, n - 0.45 * (1.0 - life)) * 1.3 * resolved);
    slick = max(slick, exp(-pow(across / (1.6 * w), 2.0)) * smoothstep(0.0, B, behind) * exp(-age / (wake.z * 12.0)));
    if (x <= 0.0) continue;
    float Fr = U / sqrt(9.81 * L);
    float ta = abs(across) / x;
    // A fast boat's divergent waves break along the arms near it.
    float armAngle = min(0.3398, 0.17 / max(Fr, 0.01));
    float arm = exp(-pow((abs(across) - x * tan(armAngle)) / (0.15 * B + 0.03 * x), 2.0));
    wakeFoam = max(wakeFoam, wake.y * smoothstep(0.35, 0.7, Fr) * arm * exp(-x / (2.5 * L)) * churn * resolved);
    float disc = 1.0 - 8.0 * ta * ta;
    if (disc <= -0.05 || wake.x <= 0.0) continue;
    float sq = sqrt(max(disc, 0.0));
    float k0 = 9.81 / (U * U);
    // Amplitude: spreading from the hull, highest along the cusp lines and
    // lower inside the wedge, and a slow decay. Ragged, as the hull's
    // pitching and the sea make it.
    float amp = 0.5 * wake.x * sqrt(L / max(x, L)) * exp(-x / (30.0 * L + 500.0)) *
      min(2.2, pow(max(disc, 0.0) + 0.04, -0.25)) * (0.3 + 0.7 * exp(-6.0 * disc)) * smoothstep(-0.05, 0.0, disc) *
      (0.5 + 0.9 * fbm(vec2(along, across) / (2.0 + 0.5 * B) + noiseOffset + 3.0));
    float sgn = across < 0.0 ? -1.0 : 1.0;
    for (int b = 0; b < 2; b++) {
      // tan th: transverse waves (b = 0) and divergent ones.
      float T = b == 0 ? 2.0 * ta / (1.0 + sq) : (1.0 + sq) / (4.0 * max(ta, 1e-4));
      float sec = sqrt(1.0 + T * T);
      float k = k0 * sec * sec;
      float lambda = 6.2831853 / k;
      float excite = (1.0 - exp(-pow(1.2 * L / lambda, 2.0))) * exp(-pow(0.25 * B / lambda, 2.0));
      float visible = 1.0 - smoothstep(lambda / 6.0, lambda / 3.0, surfRes);
      float phase = k0 * (x + abs(across) * T) * sec;
      // Wake waves no steeper than a gentle swell.
      float g = -min(amp * k, 0.05) * excite * visible * damping * sin(phase);
      // Gradient along (cos th, sin th) in (behind the bow, out from the track).
      slope += g * (-fwd + side * sgn * T) / sec;
    }
  }
  variance *= 1.0 - 0.6 * slick;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  // A long exposure (frameMeter.ts longExposureLook) records the surface
  // averaged over the shutter: past ~30 s the waves cancel out and the sea
  // reads glassy, with a soft sheen instead of glints.
  N = normalize(mix(N, vec3(0.0, 1.0, 0.0), 0.85 * longExposure));

  vec3 V = normalize(cameraPosition - vWorld);
  // The wave's own normal, for the mirror image: the fix below tilts a flat
  // sea up to ~3° toward the viewer within ~3° of grazing (most of a beach
  // view's sea), which would aim every reflected ray ~6° over the land.
  vec3 waveNormal = N;
  // Keep normals facing the viewer to avoid black fringes at grazing angles.
  N = normalize(N + V * max(0.0, -dot(N, V) + 0.05));
  float NoV = clamp(dot(N, V), 1e-4, 1.0);

  // Unresolved slope variance (plus capillary ripples finer than the last
  // cascade) → GGX roughness; floor for the sun's angular size.
  // Ring waves finer than a pixel roughen the surface: rain makes it matte.
  // A rip current running out against the waves roughens the water over
  // its channel (and the channel is deeper, so darker, with fewer breakers).
  float rip = hasSurfZone() ? ripWater(sa) : 0.0;
  // The capillary floor waits for the wind too (spectrum.ts windWaveOnset).
  float roughness = sqrt(variance.x + variance.y + 0.0006 * windWaves + rain * 0.006 + rip * 0.012);
  float alpha = clamp(roughness, 0.02, 0.7);
  alpha = mix(alpha, max(alpha, 0.3), longExposure);
  // The mirror image needs no floor for the sun's size: glassy water is sharp.
  float mirrorAlpha = mix(min(roughness, 0.7), max(alpha, 0.3), longExposure);

  // Sky reflection.
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float lod = clamp(log2(alpha * 164.0), 0.0, envMaxLod);
  vec3 reflected = textureLod(envMap, R, lod).rgb;
  // What the mirror image's haze fades to (below): the sky this ray sees.
  vec3 skyReflected = reflected;
  // The flash on the cloud base is added after the clouds (a screen effect),
  // so it isn't in the environment map: mirror its glow here, the same soft
  // patch, wider than tall, round each bolt's top.
  for (int i = 0; i < 3; i++) {
    if (i >= flashCount) break;
    vec3 glowDir = flashGlows[i].xyz;
    float c = dot(R, glowDir);
    if (c <= 0.0) continue;
    vec3 right = normalize(cross(glowDir, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, glowDir);
    vec3 t = R / c;
    vec2 d = vec2(dot(t, right) * 0.6, dot(t, up) * 1.2) / flashGlows[i].w;
    reflected += flashRadiance * exp(-dot(d, d));
  }
  // Land, rocks, trees and boats mirrored in the water (reflection.ts), over
  // the sky reflection, shifted by the waves and blurred by roughness.
  // A wave's tilt turns the reflected ray, which drifts off by an amount that
  // grows with how far it travels past the water, t: seen from the mirror
  // camera (D + t away) that's an angle ∝ t / (D + t). So the image is sharp
  // where an object meets the water and blurs up its face (contact
  // hardening); far land and anything missing the mirror get the full blur.
  // The target is cleared to transparent black, so its mips hold
  // premultiplied colour: blend it as such.
  if (planarOn > 0.5) {
    vec4 projected = planarMatrix * vec4(vWorld.x, 0.0, vWorld.z, 1.0);
    vec2 base = projected.xy / projected.w;
    float hitDepth = textureLod(planarDepth, base, 0.0).r;
    float k = 1.0;
    if (hitDepth < 1.0) {
      vec4 view = planarProjInv * vec4(base * 2.0 - 1.0, hitDepth * 2.0 - 1.0, 1.0);
      float L = length(view.xyz / view.w);
      float D = length(vWorld - cameraPosition);
      k = clamp(1.0 - D / max(L, D), 0.0, 1.0);
    }
    vec4 planar;
    // How far the mirrored light crossed the air from what it left to the
    // water (for the haze below): at the unshifted point unless the ray says.
    float hazeT = 1e5;
    if (hitDepth < 1.0) {
      vec4 view = planarProjInv * vec4(base * 2.0 - 1.0, hitDepth * 2.0 - 1.0, 1.0);
      hazeT = max(length(view.xyz / view.w) - length(vWorld - cameraPosition), 0.0);
    }
    if (reflectionRay > 0.5) {
      // Follow the sea's own reflected ray R (the one the sky reflection
      // reads) for t, the length of the mirrored ray past the water, and
      // look up where it lands (plans/REFLECTION.md phase 2). The mirror
      // camera sees what's above the water itself, so the hit projects
      // straight in. A wave's tilt turns R by twice its slope; the image
      // moves by that angle × t / (D + t) as the mirror camera sees it:
      // contact hardening and the lens come out of the projection.
      vec3 P = vec3(vWorld.x, 0.0, vWorld.z);
      float D = length(vWorld - cameraPosition);
      float t = 1e5;
      if (hitDepth < 1.0) {
        vec4 view = planarProjInv * vec4(base * 2.0 - 1.0, hitDepth * 2.0 - 1.0, 1.0);
        t = max(length(view.xyz / view.w) - D, 0.0);
      }
      vec3 Rm = reflect(-V, waveNormal);
      Rm.y = abs(Rm.y);
      vec4 hit = planarMatrix * vec4(P + Rm * t, 1.0);
      vec2 uv = hit.xy / hit.w;
      // The object the ray lands on (a wave can turn it onto one the
      // unshifted point misses): its own distance sets the haze.
      float landDepth = textureLod(planarDepth, uv, 0.0).r;
      if (landDepth < 1.0) {
        vec4 view = planarProjInv * vec4(uv * 2.0 - 1.0, landDepth * 2.0 - 1.0, 1.0);
        hazeT = max(length(view.xyz / view.w) - D, 0.0);
      }
      // Waves finer than the pixel: their slopes (α, per axis α/√2) turn
      // the ray by ~2·atan(α/√2) more. Tilt R up by that, see how far the
      // lookup moves, and blur over it (a box ~3.5× the offset has the
      // same spread as a Gaussian of that σ).
      vec3 up = vec3(0.0, 1.0, 0.0) - Rm * Rm.y;
      float spread = 2.0 * atan(mirrorAlpha * 0.70710678);
      vec3 tilted = normalize(Rm + normalize(up + vec3(1e-6, 0.0, 0.0)) * tan(spread));
      vec4 hit2 = planarMatrix * vec4(P + tilted * t, 1.0);
      vec2 streak = hit2.xy / hit2.w - uv;
      float offsetPx = length(streak) * float(textureSize(planarMap, 0).y);
      if (reflectionStreaks > 0.5) {
        // Waves tilted sideways turn the ray only ~sin(grazing) as far as
        // tilts toward the eye (REFLECTION.md §1.3): blur along the streak,
        // ×sin γ across it (at least a texel), with anisotropic filtering
        // (up to 16 samples along) and three taps: up to ~48:1. A square
        // mip blur smeared a 50 px island over ~250 px sideways and lost it.
        vec2 along = streak * (3.5 / 3.0);
        vec2 texel = 1.0 / vec2(textureSize(planarMap, 0));
        vec2 side = vec2(-along.y, along.x);
        float sideLength = max(length(side) * 3.0 * max(V.y, 0.0), texel.y);
        side = side * sideLength / max(length(side), 1e-9);
        planar = (textureGrad(planarMap, uv - along, along, side) +
          textureGrad(planarMap, uv, along, side) +
          textureGrad(planarMap, uv + along, along, side)) / 3.0;
      } else {
        planar = textureLod(planarMap, uv, clamp(log2(3.5 * offsetPx + 1e-3), 0.0, 9.0));
      }
    } else {
      vec2 uv = base + N.xz * 0.04 * k;
      planar = textureLod(planarMap, uv, clamp(log2(alpha * 300.0 * k + 1e-3), 0.0, 6.0));
    }
    if (reflectionHaze > 0.5) {
      // The mirror image's light crossed the air twice: object → water
      // (hazeT) and water → eye. The main pass hazes the second leg with
      // the sea pixel; the first leg is hazed here (plans/REFLECTION.md
      // phase 4): the air's extinction per colour plus the sea haze, which
      // thins with height (takram's 1 km scale height, averaged over the
      // ray's rise R.y·t; seaHaze.ts reflectionTransmittance). It fades
      // toward the sky this ray mirrors: far land's image sits just under
      // the horizon, where that is the horizon sky in its azimuth (on haze
      // days the cube is drawn through the same haze), and land lost in
      // the haze leaves exactly the sky reflection, no patch. (The cube's
      // horizon at +1.4° and lod 2 was far paler than the sea's own sky
      // reflection: a 37 km volcano gone in the haze left a bright sheet.)
      // The sea haze fades its share by (1 − T)², as the main pass does
      // (takram mixes in a haze colour already scaled by its opacity, by
      // that opacity again: measured on 2003-03-11's islands at 2.9 and
      // 7.35 km, both solve to one haze colour only that way); with
      // (1 − T) the image came out brighter than its island.
      // Premultiplied: the coverage stays.
      float x = max(R.y * hazeT, 0.0) / 1000.0;
      float thin = x < 1e-3 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
      vec3 airT = exp(-reflectionAir * hazeT);
      float seaT = exp(-reflectionSeaHaze * thin * hazeT);
      vec3 fade = 1.0 - airT + (1.0 - seaT) * (1.0 - seaT);
      planar.rgb = planar.rgb * airT * seaT + clamp(planar.a, 0.0, 1.0) * skyReflected * min(fade, vec3(1.0));
    }
    reflected = reflected * (1.0 - clamp(planar.a, 0.0, 1.0)) + planar.rgb;
  }
  float F = fresnel(NoV);

  // Sun glitter.
  // The sun's light at this point: cloud and land shade take all of it from
  // everything it lights (glitter, water body, seabed, foam); skylight stays.
  float shadow = lightReaching(vWorld);
  vec3 sunReaching = sunIrradiance * shadow;
  vec3 L = sunDirection;
  float NoL = dot(N, L);
  vec3 specular = vec3(0.0);
  if (NoL > 0.0) {
    vec3 H = normalize(L + V);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    float G = smithG1(NoV, alpha) * smithG1(NoL, alpha);
    specular = fresnel(VoH) * ggx(NoH, alpha) * G / (4.0 * NoV) * sunReaching;
  }
  // Each lamp's glitter: the same microfacet reflection with its irradiance
  // I / r², a column of glints down toward us on a wavy sea.
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= lampCount) break;
    vec3 toLamp = lampPositions[i] - vWorld;
    float r2 = dot(toLamp, toLamp);
    vec3 Ll = toLamp * inversesqrt(r2);
    float NoLl = dot(N, Ll);
    if (NoLl <= 0.0) continue;
    vec3 H = normalize(Ll + V);
    float G = smithG1(NoV, alpha) * smithG1(NoLl, alpha);
    specular += fresnel(max(dot(V, H), 0.0)) * ggx(max(dot(N, H), 0.0), alpha) * G / (4.0 * NoV) * lampIntensities[i] / r2;
  }

  // Light scattered out of the water body, plus extra transmission through
  // crests when looking toward the sun.
  vec3 ambient = skyIrradiance + sunReaching * max(L.y, 0.0);
  vec3 body = deepColor * ambient / PI;
  float crest = clamp(vHeight / waveHeight + 0.5, 0.0, 1.0);
  float backlit = pow(max(dot(V, -L) * 0.5 + 0.5, 0.0), 6.0);
  body += scatterColor * sunReaching * backlit * crest * crest * 0.3 / PI;
  body += scatterColor * skyIrradiance * crest * 0.08 / PI;

  // Shallow water: the sea floor shows through, tinted by absorption along
  // the light's path down and the view ray back up.
  vec2 q = vGrid + noiseOffset;
  // Bounded: derivatives blow up on silhouette edges (see terrain.ts).
  float footprint = clamp(max(length(dFdx(vGrid)), length(dFdy(vGrid))), 0.0, 200.0);
  float cosView = sqrt(max(1.0 - (1.0 - NoV * NoV) / 1.78, 0.0));
  float cosSun = sqrt(max(1.0 - (1.0 - L.y * L.y) / 1.78, 0.0));
  float path = depth / max(cosView, 0.05) + depth / max(cosSun, 0.1);
  vec3 transmittance = exp(-absorption * path);
  float causticFade = (1.0 - smoothstep(0.3, 2.0, footprint)) * (1.0 - smoothstep(2.0, 12.0, depth));
  float caustic = mix(1.0, caustics(q + slope * depth * 2.0), causticFade);
  vec3 seabed = mix(sandAlbedo, coralAlbedo(q), reefCover(sa, q));
  vec3 floorRadiance = seabed * 0.6 / PI *
    (sunReaching * max(L.y, 0.0) * caustic + skyIrradiance);
  vec3 refracted = floorRadiance * transmittance + body * (1.0 - transmittance);

  vec3 color = reflected * F + specular + refracted * (1.0 - F);

  // Foam: open-water whitecaps, broken surf, streaks drifting inside the surf
  // zone, and a band where the water meets the sand. Each term gives a
  // coverage; the lace texture turns coverage into bubbles.
  float coverage = whitecaps * (1.0 - slick) * (1.0 - smoothstep(-0.1, 0.45, jacobian)) *
    smoothstep(0.3, 0.7, fbm(q * 0.2));
  float dbgSteep = 0.0;
  if (hasSurfZone()) {
    // White water where the waves have broken (surfWave), from the break
    // point to the shore; it starts as the crest begins to spill.
    float sets = surfIncoming(sa);
    dbgSteep = surfSteepness(depth, sets);
    float surfZone = smoothstep(0.85, 1.0, dbgSteep);
    // A spilling breaker: a turbulent roller of whitewater tumbling down the
    // steep front face, and a trail of foam left behind the crest that thins
    // out seaward. The roller is ragged along the crest where the wave
    // breaks at different moments.
    float w = surfCycle(sa);
    float roller = smoothstep(0.03, 0.15, w) * (1.0 - smoothstep(0.24, 0.3, w));
    float trail = smoothstep(0.2, 0.26, w) * (1.0 - smoothstep(0.26, 0.6, w));
    float ragged = 0.55 + 0.6 * fbm(vec2(sa.y / 14.0, sa.x / 5.0) + noiseOffset);
    float breaking = surfZone * sets * (1.0 - 0.5 * rip);
    coverage = max(coverage, breaking * clamp(max(roller, 0.75 * trail) * ragged, 0.0, 1.0));
    // Residual foam is drawn out into streaks parallel to the shore.
    vec2 streak = vec2(sa.y * 0.035, sa.x * 0.22) + noiseOffset;
    float patches = smoothstep(0.5, 0.8, fbm(streak + vec2(0.0, w * 2.0)));
    coverage = max(coverage, surfZone * 0.55 * patches * (1.0 - 0.6 * rip));
    // A reef's crest: each wave breaks on the edge and runs on over the flat
    // as a band of white water tens of metres wide (the surf model alone
    // breaks it on a strip of the steep face), quieter in the passes.
    if (reef.x > 0.0) {
      float x = seaDistance(sa.x) - reefCrest(sa.y);
      float band = smoothstep(-0.6 * reef.y, -0.1 * reef.y, x) * (1.0 - smoothstep(0.0, 12.0, x)) * (1.0 - reefGap(sa.y));
      float wash = band * smoothstep(0.1, 0.6, surfAmplitude) * (0.5 + 0.5 * surfSets(sa));
      coverage = max(coverage, wash * clamp(max(roller, 0.8 * trail) * ragged + 0.35 * patches, 0.0, 1.0));
    }
    // Thin features alias into sparkles far away; fade them with pixel size.
    float near = 1.0 - smoothstep(1.0, 5.0, footprint);
    // Only along the real shoreline, not over shallow sandbars offshore.
    // A sheltered shore gets only ripples lapping at it: a thin edge.
    float shore = (1.0 - smoothstep(0.0, 0.2, depth)) * (1.0 - smoothstep(10.0, 25.0, sa.x - waterline)) *
      smoothstep(0.2, 0.6, fbm(q * 0.3 + 5.0)) * (1.0 - 0.7 * sheltered);
    coverage = max(coverage, shore * near * 0.8);

    // Rocks tear the sea: a collar of foam where the water wraps round them
    // and a trail in their lee. A wave lower than the rock breaks on its
    // face: a surge of white water round its seaward side as each crest
    // arrives (the cycle at the rock just past its crest), fading until the
    // next. A wave that tops the rock pours over it: a longer lee trail.
    for (int i = 0; i < ${MAX_ROCKS}; i++) {
      if (i >= rockCount) break;
      vec4 rock = rockData[i];
      float r = rock.z;
      float d = length(vGrid - rock.xy);
      if (d > r * 6.0 + 10.0) continue;
      vec2 rsa = shoreCoords(rock.xy);
      float lee = rsa.x - sa.x;
      float across = abs(sa.y - rsa.y);
      // The waterline radius is an estimate: reach in under the rock a little.
      float collar = exp(-pow(max(d - 0.9 * r, 0.0) / (0.35 * r + 0.6), 2.0));
      float trail = smoothstep(-0.3 * r, 0.6 * r, lee) * exp(-max(lee, 0.0) / (2.5 * r + 2.0)) *
        (1.0 - smoothstep(r * 0.5, r * 1.2 + max(lee, 0.0) * 0.3, across));
      float cycle = surfCycle(rsa);
      bool inSurf = surfAmplitude > 0.05 && -terrainHeightAt(rock.xy, rsa) < 0.6 * surfWavelength;
      float surge = inSurf
        ? smoothstep(0.2, 0.28, cycle) * (1.0 - smoothstep(0.35, 0.85, cycle))
        : 0.5;
      float seaward = smoothstep(-r, 0.5 * r, sa.x - rsa.x);
      float apron = exp(-max(d - r, 0.0) / (1.2 * r + 1.5)) * mix(0.4, 1.0, seaward);
      float breaksOn = rock.w;
      float foamHere = max(collar * (0.8 + 0.2 * breaksOn * surge),
        max(trail * (0.45 + 0.35 * (1.0 - breaksOn)) * fbm(vec2(sa.y / 3.0, sa.x / 6.0) + noiseOffset) * 1.6,
          apron * breaksOn * surge));
      // Thin collars round far pebbles alias into sparkles.
      coverage = max(coverage, foamHere * clamp(r / max(footprint, 1e-3), 0.0, 1.0));
    }
  }
  // Islands and big rocks: the same collar, lee trail and surge as a rock,
  // round their outline and sized by the waves, not their size: white
  // water round a cliff is a band a few wave heights wide (a calm sea's
  // lapping, a metre; a big swell's surge, ten). Offshore the crests come
  // irregularly. Each band fades with its own width against the pixel's.
  for (int i = 0; i < ${MAX_ISLANDS}; i++) {
    if (i >= islandCount) break;
    vec4 island = islandData[i];
    vec2 dv = vGrid - island.xy;
    float hc = island.z;
    float breaksOn = island.w;
    float R = islandRadius(i, atan(dv.y, dv.x));
    float e = length(dv) - R;
    float leeLength = min(2.5 * R, 20.0 * hc + 10.0);
    if (e > leeLength + 20.0) continue;
    float out_ = max(e, 0.0);
    vec2 isa = shoreCoords(island.xy);
    float ragged = 0.45 + 0.8 * fbm(vGrid / 3.0 + noiseOffset + float(i) * 7.1);
    float collarWidth = 0.8 + 1.5 * hc;
    float collar = exp(-pow(out_ / collarWidth, 2.0)) * ragged;
    float apronWidth = 3.0 * hc + 2.0;
    float seaward = smoothstep(-0.3 * R, 0.3 * R, sa.x - isa.x);
    float apron = exp(-out_ / apronWidth) * seaward * breaksOn * 0.5 * ragged;
    float lee = isa.x - sa.x;
    float trail = smoothstep(0.0, 0.3 * R, lee) * exp(-out_ / leeLength) *
      (1.0 - smoothstep(R * 0.5, R * 0.9 + out_ * 0.3, abs(sa.y - isa.y))) *
      0.45 * fbm(vec2(sa.y / 3.0, sa.x / 6.0) + noiseOffset) * 1.6;
    float pixel = max(footprint, 1e-3);
    coverage = max(coverage, collar * (0.6 + 0.4 * breaksOn) * clamp(collarWidth / pixel, 0.0, 1.0));
    coverage = max(coverage, apron * clamp(apronWidth / pixel, 0.0, 1.0));
    coverage = max(coverage, trail * clamp(collarWidth / pixel, 0.0, 1.0));
  }
  coverage = max(coverage, wakeFoam);
  // The weave is stretched along the crests near the coast.
  vec2 laceCoords = hasLand() ? vec2(sa.y, sa.x * 1.8) + noiseOffset : q;
  float foam = foamLace(laceCoords, clamp(coverage, 0.0, 1.0), footprint);
  foam = max(foam, rainDrops.z * 0.9);
  // Over a long shutter the lace moves and blurs into a haze over where it was.
  foam = mix(foam, 0.5 * clamp(coverage, 0.0, 1.0), longExposure);
  // Foam is matte but wet: diffuse light plus a little sky sheen.
  vec3 foamColor = vec3(0.85) * (sunReaching * max(NoL, 0.0) + skyIrradiance) / PI +
    0.25 * textureLod(envMap, vec3(R.x, max(R.y, 0.05), R.z), envMaxLod - 2.0).rgb;
  color = mix(color, foamColor, clamp(foam, 0.0, 0.95));

  if (oceanView > 0) {
    // Shelter blue → red; breaking: deep blue, steepening green, breaking
    // red; depth: sand to blue over 15 m with a dark line every metre; foam
    // coverage grey.
    vec3 dbg;
    if (oceanView == 1) {
      dbg = mix(vec3(0.1, 0.2, 0.8), vec3(0.9, 0.2, 0.1), sheltered);
    } else if (oceanView == 2) {
      dbg = mix(vec3(0.1, 0.15, 0.5), mix(vec3(0.2, 0.8, 0.2), vec3(0.95, 0.1, 0.1), smoothstep(0.85, 1.0, dbgSteep)), smoothstep(0.3, 0.85, dbgSteep));
    } else if (oceanView == 3) {
      dbg = mix(vec3(0.9, 0.85, 0.5), vec3(0.05, 0.1, 0.5), smoothstep(0.0, 15.0, depth)) * (1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.06, fract(depth))));
    } else {
      dbg = vec3(0.05 + 0.85 * clamp(coverage, 0.0, 1.0));
    }
    color = dbg / PI * (0.5 * sunIrradiance + skyIrradiance);
  }

  gl_FragColor = vec4(min(color, vec3(60000.0)), 1.0);
  #ifdef SHADE_VIEW
  gl_FragColor = vec4(vec3(landShadow(vWorld) * cloudShadow(vWorld)) * 0.25, 1.0);
  #endif
}
`

function cascadeTexture(data: Uint16Array, maxAnisotropy: number): DataTexture {
  const texture = new DataTexture(data, CASCADE_SIZE, CASCADE_SIZE, RGBAFormat, HalfFloatType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = maxAnisotropy
  texture.needsUpdate = true
  return texture
}

/** Tell the ocean where rocks cut the surface (props/surf.ts waterRocks). */
export function setOceanRocks(ocean: Mesh<BufferGeometry, ShaderMaterial>, rocks: { x: number; z: number; radius: number; breaks: number }[], camera: Vector3): void {
  const nearest = [...rocks].sort((p, q) => Math.hypot(p.x - camera.x, p.z - camera.z) - Math.hypot(q.x - camera.x, q.z - camera.z)).slice(0, MAX_ROCKS)
  const u = ocean.material.uniforms
  nearest.forEach((r, i) => (u.rockData.value as Vector4[])[i].set(r.x, r.z, r.radius, r.breaks))
  u.rockCount.value = nearest.length
}

/** Tell the ocean where islands and big rocks stand (props/index.ts
 * waterIslands): the nearest MAX_ISLANDS, apart from the 48 rocks. */
export function setOceanIslands(
  ocean: Mesh<BufferGeometry, ShaderMaterial>,
  islands: { x: number; z: number; outline: number[]; crest: number; breaks: number }[],
  camera: Vector3
): void {
  const nearest = [...islands].sort((p, q) => Math.hypot(p.x - camera.x, p.z - camera.z) - Math.hypot(q.x - camera.x, q.z - camera.z)).slice(0, MAX_ISLANDS)
  const u = ocean.material.uniforms
  const outline = u.islandOutline.value as Vector4[]
  nearest.forEach((island, i) => {
    ;(u.islandData.value as Vector4[])[i].set(island.x, island.z, island.crest, island.breaks)
    for (let k = 0; k < ISLAND_POINTS; k++) outline[i * (ISLAND_POINTS / 4) + Math.floor(k / 4)].setComponent(k % 4, island.outline[k] ?? 0)
  })
  u.islandCount.value = nearest.length
}

/** Tell the ocean where boats are and what wakes they make (props/ships.ts ShipWake). */
export function setOceanShips(ocean: Mesh<BufferGeometry, ShaderMaterial>, ships: ShipWake[], camera: Vector3): void {
  const nearest = [...ships].sort((p, q) => Math.hypot(p.x - camera.x, p.z - camera.z) - Math.hypot(q.x - camera.x, q.z - camera.z)).slice(0, MAX_SHIPS)
  const u = ocean.material.uniforms
  nearest.forEach((s, i) => {
    ;(u.shipPose.value as Vector4[])[i].set(s.x, s.z, s.dirX, s.dirZ)
    ;(u.shipHull.value as Vector4[])[i].set(s.length, s.beam, s.speed, s.spacing)
    ;(u.shipWake.value as Vector4[])[i].set(s.height, s.foam, s.foamTime, s.collar)
  })
  u.shipCount.value = nearest.length
}

/** `surface` comes from synthesizeOcean(params.ocean). */
export function createOcean(
  params: SceneParams,
  surface: OceanSurface,
  maxAnisotropy: number
): Mesh<BufferGeometry, ShaderMaterial> {
  const { ocean } = params
  const [s0, s1, s2] = surface.cascades.map(c => ({
    size: c.size,
    a: cascadeTexture(c.a, maxAnisotropy),
    b: cascadeTexture(c.b, maxAnisotropy),
    c: cascadeTexture(c.c, maxAnisotropy)
  }))

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      a0: { value: s0.a },
      a1: { value: s1.a },
      a2: { value: s2.a },
      b0: { value: s0.b },
      b1: { value: s1.b },
      b2: { value: s2.b },
      c0: { value: s0.c },
      c1: { value: s1.c },
      c2: { value: s2.c },
      cascadeSize: { value: new Vector3(s0.size, s1.size, s2.size) },
      ...terrainUniforms(params.coast),
      ...shelterUniforms(params.coast, ocean.windSpeed, middleCascadeLongest(surface.cascades.map(c => c.size))),
      surfAmplitude: { value: params.coast.surfAmplitude },
      surfWavelength: { value: params.coast.surfWavelength },
      surfPhase: { value: params.coast.surfPhase },
      absorption: { value: new Vector3(...ocean.water.absorption) },
      sandAlbedo: { value: new Color(...seabedAlbedo(params.coast)) },
      ...shadowUniforms(),
      earthRadius: { value: EARTH_RADIUS },
      envMap: { value: null as Texture | null },
      planarMap: { value: null as Texture | null },
      planarMatrix: { value: new Matrix4() },
      planarOn: { value: 0 },
      // Follow the reflected ray into the mirror image (0: the old nudge).
      reflectionRay: { value: params.debug?.passes?.reflectionRay === false ? 0 : 1 },
      // Blur the mirror image along its streak, not round (0: one mip lookup).
      reflectionStreaks: { value: params.debug?.passes?.reflectionStreaks === false ? 0 : 1 },
      // Haze the mirror image over its path to the water (0: none, as in
      // 0.132); scene.ts sets the extinctions (seaHaze.ts reflectionExtinction).
      reflectionHaze: { value: params.debug?.passes?.reflectionHaze === false ? 0 : 1 },
      reflectionAir: { value: new Vector3() },
      reflectionSeaHaze: { value: 0 },
      planarDepth: { value: null as Texture | null },
      planarProjInv: { value: new Matrix4() },
      envMaxLod: { value: 8 },
      sunDirection: { value: new Vector3(...params.sunDirection) },
      sunIrradiance: { value: new Color(0, 0, 0) },
      flashGlows: { value: [0, 1, 2].map(() => new Vector4()) },
      flashCount: { value: 0 },
      lampPositions: { value: Array.from({ length: MAX_LAMPS }, () => new Vector3()) },
      lampIntensities: { value: Array.from({ length: MAX_LAMPS }, () => new Vector3()) },
      lampCount: { value: 0 },
      longExposure: { value: 0 },
      flashRadiance: { value: new Color(0, 0, 0) },
      skyIrradiance: { value: new Color(0, 0, 0) },
      deepColor: { value: new Color(...ocean.water.deep) },
      scatterColor: { value: new Color(...ocean.water.scatter) },
      whitecaps: { value: Math.min(1, Math.max(0, (ocean.windSpeed - 5) / 6)) },
      // Slope scale of the ripple layer (0: none).
      shortWaves: { value: params.debug?.passes?.shortWaves === false ? 0 : rippleSlopeScale(ocean.windSpeed, surface) },
      // Share of the wind sea a light wind raises (1: before 0.130).
      windWaves: { value: params.debug?.passes?.shortWaves === false ? 1 : windWaveOnset(ocean.windSpeed) },
      waveHeight: { value: Math.max(0.05, surface.significantHeight) },
      rain: { value: params.storm?.rain ?? 0 },
      rockData: { value: Array.from({ length: MAX_ROCKS }, () => new Vector4()) },
      oceanView: { value: Math.max(0, OCEAN_VIEWS.indexOf(params.debug?.oceanView ?? 'none')) },
      rockCount: { value: 0 },
      islandData: { value: Array.from({ length: MAX_ISLANDS }, () => new Vector4()) },
      islandOutline: { value: Array.from({ length: (MAX_ISLANDS * ISLAND_POINTS) / 4 }, () => new Vector4()) },
      islandCount: { value: 0 },
      shipPose: { value: Array.from({ length: MAX_SHIPS }, () => new Vector4()) },
      shipHull: { value: Array.from({ length: MAX_SHIPS }, () => new Vector4()) },
      shipWake: { value: Array.from({ length: MAX_SHIPS }, () => new Vector4()) },
      shipCount: { value: 0 }
    }
  })

  const mesh = new Mesh(createPolarGrid(), material)
  mesh.frustumCulled = false
  return mesh
}
