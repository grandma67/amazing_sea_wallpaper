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
  type BufferGeometry,
  type Texture
} from 'three'

import { createPolarGrid } from './grid'
import { SHADOW_GLSL, shadowUniforms } from './shadow'
import { TERRAIN_GLSL, terrainUniforms } from './terrain'
import { EARTH_RADIUS, type SceneParams } from './params'
import { CASCADE_SIZE, type OceanSurface } from './spectrum'

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

float surfHeight(vec2 sa, float depth, float resolution) {
  if (surfAmplitude <= 0.0 || hasCoast < 0.5) return 0.0;
  // Surf lives where the waves feel the bottom, near the shore; out deeper
  // the open-sea spectrum takes over.
  float zone = (1.0 - smoothstep(0.35 * surfWavelength, 0.6 * surfWavelength, depth)) *
    (1.0 - smoothstep(150.0, 350.0, sa.x));
  float sets = surfSets(sa);
  vec2 wave = surfWave(depth, sets);
  float x = fract(surfCycle(sa) - 0.25);
  return wave.x * zone * surfProfile(x, surfSteepness(depth, sets), wave.y, 2.5 * resolution / surfWavelength);
}
`

const vertexShader = /* glsl */ `
${TERRAIN_GLSL}
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
  vec3 d =
    (displacement(a0, grid, cascadeSize.x, spacing) +
    displacement(a1, grid, cascadeSize.y, spacing)) * shallowDamping(depth) +
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
uniform vec3 sunDirection;
uniform vec3 sunIrradiance;
uniform vec3 skyIrradiance;
uniform vec3 deepColor;
uniform vec3 scatterColor;
uniform float whitecaps;
uniform float waveHeight;
uniform float rain;

// Rain on the sea (research notes: PLAN.md 7.15): each drop throws up
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

  vec4 derivatives = vec4(0.0);
  float dxz = 0.0;
  vec2 variance = vec2(0.0);
  cascade(a0, b0, c0, cascadeSize.x, damping, derivatives, dxz, variance);
  // Wind gusts and slicks: large patches where the short waves are rougher or
  // calmer. Breaks up visible tiling and looks like real open water.
  float gust = mix(0.45, 1.5, fbm(vGrid / 700.0 + noiseOffset * 0.01));
  cascade(a1, b1, c1, cascadeSize.y, damping * mix(1.0, gust, 0.5), derivatives, dxz, variance);
  // Rain stirs a thin turbulent layer that damps the shortest gravity waves.
  cascade(a2, b2, c2, cascadeSize.z, shortDamp * gust * (1.0 - 0.6 * rain), derivatives, dxz, variance);

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
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  vec3 V = normalize(cameraPosition - vWorld);
  // Keep normals facing the viewer to avoid black fringes at grazing angles.
  N = normalize(N + V * max(0.0, -dot(N, V) + 0.05));
  float NoV = clamp(dot(N, V), 1e-4, 1.0);

  // Unresolved slope variance (plus capillary ripples finer than the last
  // cascade) → GGX roughness; floor for the sun's angular size.
  // Ring waves finer than a pixel roughen the surface: rain makes it matte.
  float alpha = clamp(sqrt(variance.x + variance.y + 0.0006 + rain * 0.006), 0.02, 0.7);

  // Sky reflection.
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float lod = clamp(log2(alpha * 164.0), 0.0, envMaxLod);
  vec3 reflected = textureLod(envMap, R, lod).rgb;
  // Land, rocks, trees and boats mirrored in the water (reflection.ts), over
  // the sky reflection, shifted by the waves and blurred by roughness.
  if (planarOn > 0.5) {
    vec4 projected = planarMatrix * vec4(vWorld.x, 0.0, vWorld.z, 1.0);
    vec2 uv = projected.xy / projected.w + N.xz * 0.04;
    vec4 planar = textureLod(planarMap, uv, clamp(log2(alpha * 300.0), 0.0, 6.0));
    reflected = mix(reflected, planar.rgb, clamp(planar.a, 0.0, 1.0));
  }
  float F = fresnel(NoV);

  // Sun glitter.
  float shadow = sunShadow(vWorld) * cloudShadow(vWorld);
  vec3 L = sunDirection;
  float NoL = dot(N, L);
  vec3 specular = vec3(0.0);
  if (NoL > 0.0) {
    vec3 H = normalize(L + V);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    float G = smithG1(NoV, alpha) * smithG1(NoL, alpha);
    specular = fresnel(VoH) * ggx(NoH, alpha) * G / (4.0 * NoV) * sunIrradiance * shadow;
  }

  // Light scattered out of the water body, plus extra transmission through
  // crests when looking toward the sun.
  vec3 ambient = skyIrradiance + sunIrradiance * max(L.y, 0.0) * mix(0.4, 1.0, shadow);
  vec3 body = deepColor * ambient / PI;
  float crest = clamp(vHeight / waveHeight + 0.5, 0.0, 1.0);
  float backlit = pow(max(dot(V, -L) * 0.5 + 0.5, 0.0), 6.0);
  body += scatterColor * sunIrradiance * backlit * crest * crest * 0.3 / PI;
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
  vec3 floorRadiance = sandAlbedo * 0.6 / PI *
    (sunIrradiance * max(L.y, 0.0) * caustic + skyIrradiance);
  vec3 refracted = floorRadiance * transmittance + body * (1.0 - transmittance);

  vec3 color = reflected * F + specular + refracted * (1.0 - F);

  // Foam: open-water whitecaps, broken surf, streaks drifting inside the surf
  // zone, and a band where the water meets the sand. Each term gives a
  // coverage; the lace texture turns coverage into bubbles.
  float coverage = whitecaps * (1.0 - smoothstep(-0.1, 0.45, jacobian)) *
    smoothstep(0.3, 0.7, fbm(q * 0.2));
  if (hasCoast > 0.5) {
    // White water where the waves have broken (surfWave), from the break
    // point to the shore; it starts as the crest begins to spill.
    float sets = surfSets(sa);
    float surfZone = smoothstep(0.85, 1.0, surfSteepness(depth, sets));
    // A spilling breaker: a turbulent roller of whitewater tumbling down the
    // steep front face, and a trail of foam left behind the crest that thins
    // out seaward. The roller is ragged along the crest where the wave
    // breaks at different moments.
    float w = surfCycle(sa);
    float roller = smoothstep(0.03, 0.15, w) * (1.0 - smoothstep(0.24, 0.3, w));
    float trail = smoothstep(0.2, 0.26, w) * (1.0 - smoothstep(0.26, 0.6, w));
    float ragged = 0.55 + 0.6 * fbm(vec2(sa.y / 14.0, sa.x / 5.0) + noiseOffset);
    float breaking = surfZone * sets;
    coverage = max(coverage, breaking * clamp(max(roller, 0.75 * trail) * ragged, 0.0, 1.0));
    // Residual foam is drawn out into streaks parallel to the shore.
    vec2 streak = vec2(sa.y * 0.035, sa.x * 0.22) + noiseOffset;
    float patches = smoothstep(0.5, 0.8, fbm(streak + vec2(0.0, w * 2.0)));
    coverage = max(coverage, surfZone * 0.55 * patches);
    // Thin features alias into sparkles far away; fade them with pixel size.
    float near = 1.0 - smoothstep(1.0, 5.0, footprint);
    // Only along the real shoreline, not over shallow sandbars offshore.
    float shore = (1.0 - smoothstep(0.0, 0.2, depth)) * (1.0 - smoothstep(10.0, 25.0, sa.x)) *
      smoothstep(0.2, 0.6, fbm(q * 0.3 + 5.0));
    coverage = max(coverage, shore * near * 0.8);
  }
  // The weave is stretched along the crests near the coast.
  vec2 laceCoords = hasCoast > 0.5 ? vec2(sa.y, sa.x * 1.8) + noiseOffset : q;
  float foam = foamLace(laceCoords, clamp(coverage, 0.0, 1.0), footprint);
  foam = max(foam, rainDrops.z * 0.9);
  // Foam is matte but wet: diffuse light plus a little sky sheen.
  vec3 foamColor = vec3(0.85) * (sunIrradiance * max(NoL, 0.0) + skyIrradiance) / PI +
    0.25 * textureLod(envMap, vec3(R.x, max(R.y, 0.05), R.z), envMaxLod - 2.0).rgb;
  color = mix(color, foamColor, clamp(foam, 0.0, 0.95));

  gl_FragColor = vec4(min(color, vec3(60000.0)), 1.0);
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
      surfAmplitude: { value: params.coast.surfAmplitude },
      surfWavelength: { value: params.coast.surfWavelength },
      surfPhase: { value: params.coast.surfPhase },
      absorption: { value: new Vector3(...ocean.water.absorption) },
      sandAlbedo: { value: new Color(...params.coast.sand.albedo) },
      ...shadowUniforms(),
      earthRadius: { value: EARTH_RADIUS },
      envMap: { value: null as Texture | null },
      planarMap: { value: null as Texture | null },
      planarMatrix: { value: new Matrix4() },
      planarOn: { value: 0 },
      envMaxLod: { value: 8 },
      sunDirection: { value: new Vector3(...params.sunDirection) },
      sunIrradiance: { value: new Color(0, 0, 0) },
      skyIrradiance: { value: new Color(0, 0, 0) },
      deepColor: { value: new Color(...ocean.water.deep) },
      scatterColor: { value: new Color(...ocean.water.scatter) },
      whitecaps: { value: Math.min(1, Math.max(0, (ocean.windSpeed - 5) / 6)) },
      waveHeight: { value: Math.max(0.05, surface.significantHeight) },
      rain: { value: params.storm?.rain ?? 0 }
    }
  })

  const mesh = new Mesh(createPolarGrid(), material)
  mesh.frustumCulled = false
  return mesh
}
