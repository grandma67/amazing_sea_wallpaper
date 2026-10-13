import {
  Color,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture
} from 'three'

import { createPolarGrid } from './grid'
import { EARTH_RADIUS, type CoastParams, type SceneParams } from './params'

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
uniform float sandbarDistance;
uniform float sandbarHeight;
uniform vec2 noiseOffset;
uniform float hasCoast;

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

// Foam holes: distance to the nearest random point (Voronoi F1), with a
// per-cell size jitter. Returns 1 for foam, 0 inside a hole.
float foamHoles(vec2 p, float radius) {
  ivec2 c = ivec2(floor(p));
  vec2 f = fract(p);
  float best = 8.0;
  float jitter = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      uint h = hashCell(c + ivec2(i, j));
      vec2 point = vec2(float(h & 0xffffu), float((h >> 16) & 0xffffu)) / 65535.0;
      vec2 o = vec2(float(i), float(j)) + point - f;
      float d = dot(o, o);
      if (d < best) {
        best = d;
        jitter = float((h >> 8) & 0xffu) / 255.0;
      }
    }
  }
  float r = radius * (0.7 + 0.6 * jitter);
  return smoothstep(r - 0.06, r + 0.03, sqrt(best));
}

// Sea foam: a white mass riddled with round holes. Coverage (0..1) sets how
// much foam there is; as it thins, the holes grow until only a lacy network of
// strands is left. Density varies locally so foam breaks into patches. When a
// pixel is too large to show the lace it fades to the average density.
float foamLace(vec2 p, float coverage, float footprint) {
  if (coverage <= 0.001) return 0.0;
  vec2 w = p + 0.9 * vec2(vnoise(p * 0.5), vnoise(p * 0.5 + 31.7)) - 0.45;
  float density = clamp(coverage * (0.4 + 1.2 * fbm(p * 0.3 + 13.0)), 0.0, 1.0);
  float radius = mix(0.6, 0.1, density);
  float net = foamHoles(w * 2.1, radius) *
    mix(1.0, foamHoles(w * 3.9 + 7.0, radius * 0.9), 0.75) *
    mix(1.0, foamHoles(w * 10.3 + 3.0, radius * 0.8), 0.5);
  net *= smoothstep(0.02, 0.2, density);
  float average = density * density * 0.85;
  float detail = 1.0 - smoothstep(0.02, 0.12, footprint * 3.9);
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

float terrainHeightAt(vec2 p, vec2 sa) {
  float s = sa.x;
  float u = -s;
  vec2 q = p + noiseOffset;

  float sea = -s * nearshoreSlope;
  sea = -seabedDepth * (1.0 - exp(sea / seabedDepth));
  sea += sandbarHeight * exp(-pow((s - sandbarDistance) / 22.0, 2.0));

  // Rises with the beach slope, levelling off at the back of the beach.
  float beach = u > 0.0 ? beachSlope * beachWidth * (1.0 - exp(-u / beachWidth)) : u * beachSlope;
  float duneMask = smoothstep(beachWidth, beachWidth + duneWidth, u);
  float dunes = duneHeight * duneMask * (0.45 + 0.55 * fbm(q / 40.0));
  float hills = duneHeight * 1.5 * smoothstep(beachWidth + duneWidth, beachWidth + duneWidth + 400.0, u) *
    fbm(q / 350.0);
  float bumps = 0.35 * (fbm(q / 7.0) - 0.5) * smoothstep(0.0, beachWidth, u);
  float land = beach + dunes + hills + bumps;

  float h = mix(sea, land, smoothstep(-1.0, 1.0, u));
  return mix(-200.0, h, hasCoast);
}

float terrainHeight(vec2 p) {
  return terrainHeightAt(p, shoreCoords(p));
}
`

// --- TypeScript mirror of the GLSL above (heights only) ----------------------

function hashCell(x: number, y: number): number {
  const px = (x + (1 << 20)) >>> 0
  const py = (y + (1 << 20)) >>> 0
  let n = (Math.imul(px, 1597334677) ^ Math.imul(py, 3812015801)) >>> 0
  n ^= n >>> 16
  n = Math.imul(n, 2246822519) >>> 0
  n ^= n >>> 13
  n = Math.imul(n, 3266489917) >>> 0
  n ^= n >>> 16
  return n >>> 0
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const v = (dx: number, dy: number): number => hashCell(ix + dx, iy + dy) / 4294967295
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * ux
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * ux
  return a + (b - a) * uy
}

function fbm(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  for (let i = 0; i < 4; i++) {
    sum += amp * vnoise(x, y)
    x = x * 2.03 + 17.1
    y = y * 2.03 + 9.3
    amp *= 0.5
  }
  return sum / 0.9375
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
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

export function terrainHeight(coast: CoastParams, x: number, z: number): number {
  if (coast.type !== 'beach') return -200
  const { origin, normal } = coastFrame(coast)
  const [ox, oz] = coast.noiseOffset
  const dx = x - origin[0]
  const dz = z - origin[1]
  const a = dx * -normal[1] + dz * normal[0]
  let s = dx * normal[0] + dz * normal[1]
  s -= coast.curvature * a * a
  s -= coast.wobble * (vnoise(a / 220 + ox, 3.7 + oz) * 2 - 1)
  s -= coast.wobble * 0.3 * (vnoise(a / 55 + ox, 9.1 + oz) * 2 - 1)

  const u = -s
  const qx = x + ox
  const qz = z + oz
  let sea = -s * coast.nearshoreSlope
  sea = -coast.seabedDepth * (1 - Math.exp(sea / coast.seabedDepth))
  sea += coast.sandbarHeight * Math.exp(-(((s - coast.sandbarDistance) / 22) ** 2))

  const beach =
    u > 0 ? coast.beachSlope * coast.beachWidth * (1 - Math.exp(-u / coast.beachWidth)) : u * coast.beachSlope
  const duneMask = smoothstep(coast.beachWidth, coast.beachWidth + coast.duneWidth, u)
  const dunes = coast.duneHeight * duneMask * (0.45 + 0.55 * fbm(qx / 40, qz / 40))
  const hillStart = coast.beachWidth + coast.duneWidth
  const hills =
    coast.duneHeight * 1.5 * smoothstep(hillStart, hillStart + 400, u) * fbm(qx / 350, qz / 350)
  const bumps = 0.35 * (fbm(qx / 7, qz / 7) - 0.5) * smoothstep(0, coast.beachWidth, u)
  const land = beach + dunes + hills + bumps

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
    sandbarDistance: { value: coast.sandbarDistance },
    sandbarHeight: { value: coast.sandbarHeight },
    noiseOffset: { value: new Vector2(...coast.noiseOffset) },
    hasCoast: { value: coast.type === 'beach' ? 1 : 0 }
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
uniform vec3 sunDirection;
uniform vec3 sunIrradiance;
uniform vec3 skyIrradiance;
uniform samplerCube envMap;
uniform vec3 sandAlbedo;
uniform float runup;
uniform vec3 groundCover;
uniform float groundCoverAmount;
varying vec3 vWorld;

void main() {
  vec2 p = vWorld.xz;
  vec2 sa = shoreCoords(p);
  float h = terrainHeightAt(p, sa);
  vec2 q = p + noiseOffset;

  // Normal from finite differences, at a step matched to the pixel size.
  // Derivatives blow up on silhouette edges; an unbounded footprint turns the
  // finite-difference normal into NaN, which bloom smears into white glows.
  float footprint = clamp(max(length(dFdx(p)), length(dFdy(p))), 0.0, 200.0);
  float e = max(0.03, footprint);
  float hx = terrainHeight(p + vec2(e, 0.0));
  float hz = terrainHeight(p + vec2(0.0, e));
  vec3 N = normalize(vec3(h - hx, e, h - hz));

  // Wind ripples on dry sand: fine ridges perpendicular to an oblique wind.
  float rippleFade = 1.0 - smoothstep(0.01, 0.06, footprint);
  vec2 rippleDir = normalize(vec2(0.8, 0.6));
  float warp = vnoise(q * 0.9) * 6.0 + vnoise(q * 3.1) * 1.5;
  float ripple = sin(dot(q, rippleDir) * 28.0 + warp);
  N = normalize(N + vec3(rippleDir.x, 0.0, rippleDir.y) * ripple * 0.05 * rippleFade);

  // Albedo variation: patches, darker lines of shell/organic debris.
  float patches = fbm(q / 3.0);
  vec3 albedo = sandAlbedo * (0.82 + 0.3 * patches);
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
  albedo *= mix(1.0, 0.55, wet);

  vec3 L = sunDirection;
  vec3 V = normalize(cameraPosition - vWorld);
  float NoL = max(dot(N, L), 0.0);
  // Soft wrap lighting stands in for the missing ambient occlusion/shadowing.
  vec3 diffuse = albedo / PI * (sunIrradiance * NoL + skyIrradiance * (0.6 + 0.4 * N.y));
  vec3 color = diffuse;

  if (wet > 0.0) {
    // A film of water: mirror-like reflection of the sky and the sun.
    vec3 Nw = normalize(mix(N, vec3(0.0, 1.0, 0.0), 0.7));
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
    float NoLw = max(dot(Nw, L), 0.0);
    float k = alpha * 0.5;
    float G = NoLw / (NoLw * (1.0 - k) + k) * NoV / (NoV * (1.0 - k) + k);
    float spec = a2 / (PI * d * d) * F * G / (4.0 * NoV);
    color += wet * (reflected * F + sunIrradiance * min(spec, 0.6));

    // Lacy foam left by the last wave at the edge of the swash.
    float edge = 1.0 - smoothstep(0.0, 0.08, abs(h - wetLine * 0.55 - 0.03 * (vnoise(q * 0.4) - 0.5)));
    edge *= 0.35 + 0.65 * fbm(vec2(sa.y / 9.0, 3.3) + noiseOffset);
    float foam = foamLace(q, edge * 0.8, footprint) * (1.0 - smoothstep(0.3, 1.5, footprint));
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
      runup: { value: coast.runup },
      groundCover: { value: new Color(...params.biome.groundCover) },
      groundCoverAmount: { value: params.biome.groundCoverAmount }
    }
  })
  const mesh = new Mesh(createPolarGrid({ rings: 600, segments: 1024, outerRadius: 120_000 }), material)
  mesh.frustumCulled = false
  mesh.visible = coast.type === 'beach'
  return mesh
}
