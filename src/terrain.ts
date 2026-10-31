import {
  Color,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type BufferGeometry,
  type Texture
} from 'three'

import { BEACH_MATERIALS, beachLines, isStony, stoneMean } from './beach'
import { fbm, smoothstep, vnoise } from './cellNoise'
import { COAST_KINDS, hasBeach, hasLand } from './coastKind'
import { createPolarGrid } from './grid'
import { EARTH_RADIUS, type CoastParams, type SceneParams } from './params'
import { lagoonSlope, REEF_DROP, REEF_RAMP } from './reef'
import { LICHEN, ROCK_MIN_FACE, rockSurface, type RockShore } from './rockShore'
import { SHADOW_GLSL, shadowUniforms } from './shadow'
import { highWater, tideMarks } from './tides'

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
// Submerged bars (beachState.ts Bar): crest distance seaward, height,
// half-width; inner first.
uniform vec3 bars[3];
uniform int barCount;
// Rip channels through the inner bar: spacing along the shore (0: none) and
// how far the bar swings toward the shore between them (× its distance).
uniform vec2 rips;
// Beach cusps: spacing (0: none), horn-to-bay relief, and how far up the
// beach the swash reaches (m inland).
uniform vec3 cusps;
uniform vec2 noiseOffset;
// Storm ridges on stony beaches (beach.ts Ridge): crest distance inland,
// height, half-width; ridgeCount 0 on sand.
uniform vec3 ridges[3];
uniform int ridgeCount;
// Index into COAST_KINDS (coastKind.ts); one profile branch runs per day.
uniform int coastKind;
// Tides (tides.ts): the land sits tideLevel lower; a low-tide terrace from
// +terrace.x at s = 0 (the foot of the high-tide beach) down to −terrace.x at
// s = terrace.y; a berm as high as the spring high water (highWater) over the
// beach; today's water at s ≈ waterline.
uniform float tideLevel;
uniform vec2 terrace;
uniform float highWater;
uniform float waterline;
// Fringing reef (reef.ts): crest distance seaward of the shoreface's start
// (0: none), reef flat width, lagoon floor and crest depth below the
// shoreface's start; passes: spacing and width along the shore, and the
// slope down to the lagoon floor.
uniform vec4 reef;
uniform vec3 reefPass;
// Rocky shore (rockShore.ts): platform width, its back and edge heights
// above mean sea, the scarp's drop; back face height and width, scarp slope,
// boulder size (0: none); ledge relief, bedding step, dip (tan), strike
// (rad); joint spacing, angle (rad), gully depth.
uniform vec4 rockShape;
uniform vec4 rockBack;
uniform vec4 rockBeds;
uniform vec3 rockJoints;
#define REEF_RAMP ${REEF_RAMP.toFixed(1)}
#define REEF_DROP ${REEF_DROP.toFixed(2)}
#define ROCK_MIN_FACE ${ROCK_MIN_FACE.toFixed(3)}
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

// Distance seaward of low water's foot of the terrace: where the shoreface,
// its bars and rip channels begin.
float seaDistance(float s) {
  return s - clamp(s, 0.0, terrace.y);
}

// The terrace's height above the profile around it: +terrace.x on the land,
// sloping down across it to −terrace.x on the sea side.
float terraceStep(float s) {
  if (terrace.y <= 0.0) return 0.0;
  return terrace.x * (1.0 - 2.0 * clamp(s / terrace.y, 0.0, 1.0));
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

// How much deeper than the bare profile a rip channel is, × the bar's height.
#define RIP_SCOUR 0.8

// 1 in a rip channel, 0 on the bar: one channel every rips.x m along the
// shore, wandering a little.
float ripGap(float a) {
  if (rips.x <= 0.0) return 0.0;
  float w = a / rips.x + 0.6 * vnoise(vec2(a / (2.0 * rips.x), 21.7) + noiseOffset);
  return smoothstep(0.55, 0.97, cos(6.2831853 * w));
}

// Bars across the shoreface. The inner bar of a rip state swings toward the
// shore between the channels (welded transverse bars, crescents) and is cut
// through at each channel, which the current scours deeper than the trough
// from near the shore out past the bar.
float barHeight(float s, float a) {
  float h = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= barCount) break;
    vec3 b = bars[i];
    float d = b.x;
    float open = 1.0;
    if (i == 0 && rips.x > 0.0) {
      float w = a / rips.x + 0.6 * vnoise(vec2(a / (2.0 * rips.x), 21.7) + noiseOffset);
      d *= 1.0 + rips.y * cos(6.2831853 * w);
      float gap = ripGap(a);
      open = 1.0 - gap;
      h -= RIP_SCOUR * b.y * gap * smoothstep(0.0, 0.3 * d, s) * (1.0 - smoothstep(d, 1.5 * d, s));
    }
    float k = (s - d) / b.z;
    h += b.y * open * exp(-k * k);
  }
  return h;
}

// Rip current water (ocean.ts): the channel from the shore out past the
// inner bar, 0..1.
float ripWater(vec2 sa) {
  if (rips.x <= 0.0 || barCount == 0) return 0.0;
  float reach = bars[0].x * (1.0 + rips.y);
  float s = seaDistance(sa.x);
  return ripGap(sa.y) * smoothstep(-2.0, 5.0, s) * (1.0 - smoothstep(reach, 1.6 * reach, s));
}

// Beach cusps: horns of coarser sediment pointing seaward with scooped bays
// between them, along the upper swash zone.
float cuspHeight(float u, float a) {
  if (cusps.x <= 0.0) return 0.0;
  float w = a / cusps.x + 0.35 * vnoise(vec2(a / (3.0 * cusps.x), 23.1) + noiseOffset);
  float c = 0.5 + 0.5 * cos(6.2831853 * w);
  float horn = c * c - 0.35;
  float reach = cusps.z;
  float band = smoothstep(-0.4 * reach, 0.0, u) * (1.0 - smoothstep(0.7 * reach, 1.3 * reach, u));
  return cusps.y * horn * band * (0.7 + 0.6 * vnoise(vec2(a / 90.0, 25.3) + noiseOffset));
}

// 1 in a pass through the reef, 0 on the reef: one every reefPass.x m,
// wandering a little.
float reefGap(float a) {
  float w = a / reefPass.x + 0.4 * vnoise(vec2(a / (1.5 * reefPass.x), 33.1) + noiseOffset);
  float d = abs(fract(w + 0.5) - 0.5) * reefPass.x;
  return 1.0 - smoothstep(0.5 * reefPass.y, reefPass.y, d);
}

// The reef crest's distance at a, wandering ±8 m.
float reefCrest(float a) {
  return reef.x + 8.0 * (vnoise(vec2(a / 150.0, 31.3) + noiseOffset) * 2.0 - 1.0);
}

// Coral heads (bommies) scattered over the lagoon floor, 0..1.
float coralHeads(vec2 q) {
  return smoothstep(0.62, 0.76, fbm(q / 14.0 + 41.0));
}

// The seabed of a reef-fronted beach: the beach face down to the lagoon
// floor (with coral heads), up a ramp to the reef flat, the crest, then the
// drop-off to the deep. In a pass the lagoon floor runs on to the drop-off.
float reefHeight(float sSea, float a, vec2 q) {
  float r = reefCrest(a);
  float w = reef.y;
  float lagoonDepth = reef.z;
  float gap = reefGap(a);
  float lagoon = -lagoonDepth * (1.0 - exp(min(-sSea * reefPass.z / lagoonDepth, 10.0)));
  if (sSea <= r) {
    float heads = coralHeads(q) * smoothstep(10.0, 40.0, sSea) * (1.0 - smoothstep(r - w - 40.0, r - w - REEF_RAMP, sSea));
    lagoon += 0.6 * lagoonDepth * heads;
    float t = smoothstep(r - w - REEF_RAMP, r - w, sSea) * (1.0 - gap);
    // The flat dips a little toward the lagoon; the crest is highest.
    float back = 1.0 - smoothstep(r - w, r, sSea);
    float reefFlat = -reef.w - 0.25 * back - 0.15 * (vnoise(q / 6.0) - 0.5) * (1.0 - smoothstep(r - 10.0, r, sSea));
    return mix(lagoon, reefFlat, t);
  }
  float top = mix(reef.w, lagoonDepth * (1.0 - exp(-r * reefPass.z / lagoonDepth)), gap);
  return -top - seabedDepth * (1.0 - exp(-(sSea - r) * REEF_DROP / seabedDepth));
}

// Coral's colour (linear albedo): brown live coral and turf algae, greener
// in patches (coral reflects ~5–15% in the visible, sand 30–50%).
vec3 coralAlbedo(vec2 q) {
  vec3 c = mix(vec3(0.16, 0.12, 0.07), vec3(0.09, 0.12, 0.06), smoothstep(0.4, 0.7, fbm(q / 9.0 + 17.0)));
  return c * (0.6 + 0.8 * vnoise(q / 1.5));
}

// How much of the seabed here is coral rather than sand, 0..1: the reef
// flat and drop-off, and coral heads in the lagoon.
float reefCover(vec2 sa, vec2 q) {
  if (reef.x <= 0.0) return 0.0;
  float sSea = seaDistance(sa.x);
  float r = reefCrest(sa.y);
  float onReef = smoothstep(r - reef.y - REEF_RAMP, r - reef.y, sSea) * (1.0 - reefGap(sa.y));
  float heads = coralHeads(q) * smoothstep(10.0, 40.0, sSea) * (1.0 - smoothstep(r - reef.y - 40.0, r - reef.y - REEF_RAMP, sSea));
  return max(onReef * (0.75 + 0.25 * vnoise(q / 4.0)), smoothstep(0.0, 0.6, heads));
}

// How far seaward of today's water the surf zone reaches before fading
// (m): out to a reef's crest.
float surfReach() {
  return reef.x > 0.0 ? max(150.0, terrace.y + reef.x - waterline + 60.0) : 150.0;
}

float beachHeightAt(vec2 p, vec2 sa) {
  float s = sa.x;
  float u = -s;
  vec2 q = p + noiseOffset;

  float sSea = seaDistance(s);
  float sea;
  if (reef.x > 0.0) {
    sea = reefHeight(sSea, sa.y, q);
  } else {
    sea = -sSea * nearshoreSlope;
    // Clamped: far inland this overflows to infinity, and mix(inf, land, 1)
    // below is inf * 0 = NaN (white specks along distant skylines).
    sea = -seabedDepth * (1.0 - exp(min(sea / seabedDepth, 10.0)));
    sea += barHeight(sSea, sa.y);
  }

  // Rises with the beach slope, levelling off at the back of the beach,
  // over a berm the high tides build.
  float beach = u > 0.0 ? beachSlope * beachWidth * (1.0 - exp(-u / beachWidth)) : u * beachSlope;
  beach += highWater * smoothstep(0.0, beachWidth, u);
  float duneMask = smoothstep(beachWidth, beachWidth + duneWidth, u);
  float dunes = duneHeight * duneMask * (0.45 + 0.55 * fbm(q / 40.0));
  // Rolling hills inland, rising over a few hundred metres behind the dunes.
  float hills = hillHeight * smoothstep(beachWidth + duneWidth, beachWidth + duneWidth + 500.0, u) *
    (0.25 + 0.75 * fbm(q / 450.0)) * smoothstep(-0.2, 1.0, fbm(q / 1400.0 + 7.0));
  float bumps = 0.35 * (fbm(q / 7.0) - 0.5) * smoothstep(0.0, beachWidth, u);
  float land = beach + dunes + hills + bumps + ridgeHeight(u, sa.y);

  return mix(sea, land, smoothstep(-1.0, 1.0, u)) + cuspHeight(u, sa.y) + terraceStep(s) - tideLevel;
}

// The bare rocky profile (rockShore.ts bareRock): plateau, back face,
// platform out to width (its ragged edge), scarp, seabed. Steep faces are
// at least 3% of the distance r wide, or they zig-zag across the grid.
float bareRock(float s, float width, float r) {
  float top = rockShape.y;
  float backWidth = max(rockBack.y, ROCK_MIN_FACE * r);
  if (s <= -backWidth) return top + rockBack.x;
  if (s < 0.0) {
    float t = -s / backWidth;
    return top + rockBack.x * t * t * (3.0 - 2.0 * t);
  }
  float slope = rockShape.x > 0.0 ? (rockShape.z - top) / rockShape.x : 0.0;
  if (s <= width) return top + slope * s;
  float edge = top + slope * width;
  float run = max(rockShape.w / rockBack.z, ROCK_MIN_FACE * r);
  float footS = width + run;
  if (s <= footS) return edge - (s - width) * rockShape.w / run;
  float foot = edge - rockShape.w;
  float range = max(1.0, seabedDepth + foot);
  return foot - range * (1.0 - exp(max(-(s - footS) * nearshoreSlope / range, -10.0)));
}

// Gullies (surge channels) along two joint sets, 0..1 (1 on a gully's
// floor); they come and go along their length.
float rockGully(vec2 sa, float r) {
  if (rockJoints.z <= 0.0) return 0.0;
  float g = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float angle = rockJoints.y + fi * 1.05;
    vec2 dir = vec2(cos(angle), sin(angle));
    float along = dot(sa, dir);
    float across = dot(sa, vec2(-dir.y, dir.x));
    float spacing = rockJoints.x * (1.0 + 0.7 * fi);
    float w = across / spacing + 0.5 * vnoise(vec2(along / 30.0 + fi * 5.3, 43.1) + noiseOffset);
    float d = abs(fract(w) - 0.5) * spacing;
    float half_ = 0.5 + 0.08 * spacing;
    float floor_ = 1.0 - smoothstep(0.35 * half_ * (1.0 - min(0.9, r / 150.0)), half_ * (1.0 + r / 150.0), d);
    floor_ *= smoothstep(0.35, 0.6, vnoise(vec2(along / 25.0 + fi * 3.7, 47.9) + noiseOffset));
    g = max(g, floor_ * (1.0 - 0.5 * fi));
  }
  return g;
}

// Rounded boulders, half buried: one per cell of size m (0..~0.8 size).
float boulderField(vec2 x, float size) {
  vec2 g = x / size;
  ivec2 c = ivec2(floor(g));
  vec2 f = fract(g);
  float h = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      uint n = hashCell(c + ivec2(i, j) + ivec2(907, 311));
      vec2 centre = vec2(i, j) + 0.25 + 0.5 * vec2(float(n & 0xffu), float((n >> 8) & 0xffu)) / 255.0;
      float r = 0.35 + 0.25 * float((n >> 16) & 0xffu) / 255.0;
      // Blocky, not balls: a lumpy outline, flattened tops of varied height.
      vec2 d = f - centre;
      float lump = 0.8 + 0.4 * vnoise(d * 3.0 + vec2(float(n >> 24), 7.0));
      float k = length(d) / (r * lump);
      float tall = 0.6 + 0.8 * float((n >> 24) & 0xfu) / 15.0;
      h = max(h, r * tall * min(1.0, 1.6 * sqrt(max(0.0, 1.0 - k * k))));
    }
  }
  return h * size;
}

// A rocky shore (rockShore.ts): the bare profile with hills behind, and in
// the rock band ledges along dipping beds, sharp ridged roughness, gullies
// along the joints, or boulders.
float rockHeightAt(vec2 p, vec2 sa) {
  float s = sa.x;
  float u = -s;
  vec2 q = p + noiseOffset;
  float gully = rockGully(sa, length(p));
  // The platform's ragged edge wanders ±25% and is cut back in gullies.
  float width = rockShape.x > 0.0
    ? max(0.0, rockShape.x * (1.0 + 0.25 * (vnoise(vec2(sa.y / 40.0, 41.3) + noiseOffset) * 2.0 - 1.0)) - 8.0 * gully * (1.0 - smoothstep(50.0, 150.0, length(p))))
    : 0.0;
  float h = bareRock(s, width, length(p));
  float back = rockBack.y;
  h += hillHeight * smoothstep(back + 20.0, back + 520.0, u) * (0.25 + 0.75 * fbm(q / 450.0)) *
    smoothstep(-0.2, 1.0, fbm(q / 1400.0 + 7.0));
  h += 0.35 * (fbm(q / 7.0) - 0.5) * smoothstep(back, back + 10.0, u);
  float footS = width + max(rockShape.w / rockBack.z, ROCK_MIN_FACE * length(p));
  float band = smoothstep(rockBack.w > 0.0 ? -back - 2.0 : -back - 25.0, -back + 1.0, s) * (1.0 - smoothstep(footS + 20.0, footS + 50.0, s));
  if (band > 0.0) {
    // The camera is at the origin: detail finer than the terrain grid
    // (2.2% of the distance) softens with distance, or it zig-zags.
    float r = length(p);
    float n = rockBeds.x * 2.0 * (fbm(q / 18.0) - 0.5);
    // Ridged noise with a rounded crease (a knife edge zig-zags across
    // the grid in silhouette).
    float k1 = vnoise(q / 6.0) * 2.0 - 1.0;
    float k2 = vnoise(q / 2.3 + 5.0) * 2.0 - 1.0;
    float sharp = 0.22 * (1.0 - sqrt(k1 * k1 + 0.02)) + 0.08 * (1.0 - sqrt(k2 * k2 + 0.02)) * (1.0 - smoothstep(40.0, 120.0, r)) - 0.2;
    float rock;
    if (rockBack.w > 0.0) {
      rock = h + 0.3 * n + sharp + (boulderField(q, rockBack.w) - 0.35 * rockBack.w) * (1.0 - smoothstep(80.0, 250.0, r));
    } else {
      // Beds dipping across their strike, outcropping as flat ledges with
      // short risers.
      vec2 strike = vec2(cos(rockBeds.w), sin(rockBeds.w));
      float planes = dot(sa, vec2(-strike.y, strike.x)) * rockBeds.z;
      float layer = (h + n - planes) / rockBeds.y;
      // Risers widen with distance and on steep faces (scarp, cliff), so
      // each step spans a few grid cells.
      float steep = abs(bareRock(s + 0.5, width, r) - bareRock(s - 0.5, width, r));
      float riser = min(1.0, 0.3 + 0.008 * r + 0.05 * r * steep / rockBeds.y);
      rock = (floor(layer) + smoothstep(1.0 - riser, 1.0, fract(layer)) + 0.5 - 0.5 * riser + 0.01) * rockBeds.y + planes + sharp;
      rock -= rockJoints.z * gully * (0.4 + 0.6 * smoothstep(0.0, max(width, 20.0), s)) * (1.0 - smoothstep(150.0, 400.0, r));
    }
    h = mix(h, rock, band);
  }
  return h - tideLevel;
}

float terrainHeightAt(vec2 p, vec2 sa) {
  if (coastKind == COAST_OPEN_SEA) return -200.0;
  if (coastKind == COAST_ROCK_SHORE) return rockHeightAt(p, sa);
  // Tidal flats use the beach profile until they get their own (PLAN_BIOMES 9).
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
 * wave (surfSets), and a reef or barrier takes `shelter` of it (shelterAt;
 * ocean.ts surfIncoming). */
export function surfWave(coast: CoastParams, depth: number, sets = 1, shelter = 0): { height: number; steepness: number; broken: number } {
  const h0 = 1.3 * coast.surfAmplitude * sets * (1 - shelter)
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
    case 'rock-shore':
      return rockHeight(coast, x, z)
    case 'beach':
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

/** 1 in a rip channel, 0 on the bar (mirrors ripGap in TERRAIN_GLSL). */
export function ripGap(coast: CoastParams, a: number): number {
  if (coast.rips == null) return 0
  return smoothstep(0.55, 0.97, Math.cos(2 * Math.PI * ripWave(coast, a)))
}

function ripWave(coast: CoastParams, a: number): number {
  const [ox, oz] = coast.noiseOffset
  const spacing = coast.rips!.spacing
  return a / spacing + 0.6 * vnoise(a / (2 * spacing) + ox, 21.7 + oz)
}

/** A rip channel's depth below the bare profile, × the bar's height (RIP_SCOUR in GLSL). */
const RIP_SCOUR = 0.8

/** Bars across the shoreface (mirrors barHeight). */
export function barHeight(coast: CoastParams, s: number, a: number): number {
  let h = 0
  coast.bars.slice(0, 3).forEach((b, i) => {
    let d = b.distance
    let open = 1
    if (i === 0 && coast.rips != null) {
      d *= 1 + coast.rips.amplitude * Math.cos(2 * Math.PI * ripWave(coast, a))
      const gap = ripGap(coast, a)
      open = 1 - gap
      h -= RIP_SCOUR * b.height * gap * smoothstep(0, 0.3 * d, s) * (1 - smoothstep(d, 1.5 * d, s))
    }
    const k = (s - d) / b.width
    h += b.height * open * Math.exp(-k * k)
  })
  return h
}

/** How far up the beach the cusps reach (m inland): the swash zone, and
 * at least a third of their spacing (horns are about as long). */
export function cuspReach(coast: Pick<CoastParams, 'runup' | 'beachSlope' | 'cusps'>): number {
  return Math.max(coast.runup / coast.beachSlope, 0.35 * (coast.cusps?.spacing ?? 0))
}

/** Beach cusps (mirrors cuspHeight). */
export function cuspHeight(coast: CoastParams, u: number, a: number): number {
  if (coast.cusps == null) return 0
  const [ox, oz] = coast.noiseOffset
  const { spacing, relief } = coast.cusps
  const w = a / spacing + 0.35 * vnoise(a / (3 * spacing) + ox, 23.1 + oz)
  const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * w)
  const horn = c * c - 0.35
  const reach = cuspReach(coast)
  const band = smoothstep(-0.4 * reach, 0, u) * (1 - smoothstep(0.7 * reach, 1.3 * reach, u))
  return relief * horn * band * (0.7 + 0.6 * vnoise(a / 90 + ox, 25.3 + oz))
}

/** How far seaward of today's water the surf zone reaches before fading
 * (m): out to a reef's crest (mirrors surfReach). */
export function surfReach(coast: Pick<CoastParams, 'reef' | 'terrace' | 'waterline'>): number {
  return coast.reef != null ? Math.max(150, coast.terrace.width + coast.reef.distance - coast.waterline + 60) : 150
}

/** Reef values as the shader sees them (mirrors the reef uniforms): depths
 * below the shoreface's start, which sits terrace.height below mean sea. */
function reefFrame(coast: Pick<CoastParams, 'reef' | 'terrace' | 'beachSlope'>): { lagoon: number; crest: number; slope: number } {
  const reef = coast.reef!
  const lagoon = Math.max(0.1, reef.lagoonDepth - coast.terrace.height)
  return { lagoon, crest: Math.max(0.05, reef.crestDepth - coast.terrace.height), slope: lagoonSlope(coast) }
}

/** 1 in a pass through the reef, 0 on the reef (mirrors reefGap). */
export function reefGap(coast: CoastParams, a: number): number {
  if (coast.reef == null) return 0
  const [ox, oz] = coast.noiseOffset
  const { passSpacing, passWidth } = coast.reef
  const w = a / passSpacing + 0.4 * vnoise(a / (1.5 * passSpacing) + ox, 33.1 + oz)
  const d = Math.abs(w + 0.5 - Math.floor(w + 0.5) - 0.5) * passSpacing
  return 1 - smoothstep(0.5 * passWidth, passWidth, d)
}

/** The crest's distance seaward of the shoreface's start at `a` (mirrors reefCrest). */
export function reefCrest(coast: CoastParams, a: number): number {
  const [ox, oz] = coast.noiseOffset
  return coast.reef!.distance + 8 * (vnoise(a / 150 + ox, 31.3 + oz) * 2 - 1)
}

/** The seabed of a reef-fronted beach (mirrors reefHeight); qx, qz: world
 * coords plus the noise offset. */
export function reefHeight(coast: CoastParams, sSea: number, a: number, qx: number, qz: number): number {
  const reef = coast.reef!
  const { lagoon: lagoonDepth, crest, slope } = reefFrame(coast)
  const r = reefCrest(coast, a)
  const w = reef.flatWidth
  const gap = reefGap(coast, a)
  let lagoon = -lagoonDepth * (1 - Math.exp(Math.min((-sSea * slope) / lagoonDepth, 10)))
  if (sSea <= r) {
    const heads = smoothstep(0.62, 0.76, fbm(qx / 14 + 41, qz / 14 + 41)) * smoothstep(10, 40, sSea) * (1 - smoothstep(r - w - 40, r - w - REEF_RAMP, sSea))
    lagoon += 0.6 * lagoonDepth * heads
    const t = smoothstep(r - w - REEF_RAMP, r - w, sSea) * (1 - gap)
    const back = 1 - smoothstep(r - w, r, sSea)
    const flat = -crest - 0.25 * back - 0.15 * (vnoise(qx / 6, qz / 6) - 0.5) * (1 - smoothstep(r - 10, r, sSea))
    return lagoon + (flat - lagoon) * t
  }
  const top = crest + (lagoonDepth * (1 - Math.exp((-r * slope) / lagoonDepth)) - crest) * gap
  return -top - coast.seabedDepth * (1 - Math.exp((-(sSea - r) * REEF_DROP) / coast.seabedDepth))
}

function beachHeight(coast: CoastParams, x: number, z: number): number {
  const [ox, oz] = coast.noiseOffset
  const [s, a] = worldToShore(coast, x, z)

  const u = -s
  const qx = x + ox
  const qz = z + oz
  const sSea = seaDistance(coast, s)
  let sea: number
  if (coast.reef != null) {
    sea = reefHeight(coast, sSea, a, qx, qz)
  } else {
    sea = -sSea * coast.nearshoreSlope
    sea = -coast.seabedDepth * (1 - Math.exp(Math.min(sea / coast.seabedDepth, 10)))
    sea += barHeight(coast, sSea, a)
  }

  const beach =
    (u > 0 ? coast.beachSlope * coast.beachWidth * (1 - Math.exp(-u / coast.beachWidth)) : u * coast.beachSlope) +
    highWater(coast) * smoothstep(0, coast.beachWidth, u)
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
  return sea + (land - sea) * t + cuspHeight(coast, u, a) + terraceStep(coast, s) - coast.tide.level
}

/** A rocky shore's height (rockShore.ts rockSurface, mirrors rockHeightAt). */
function rockHeight(coast: CoastParams, x: number, z: number): number {
  const [s, a] = worldToShore(coast, x, z)
  return rockSurface(coast, s, a, x, z)
}

/** Seaward distance from the terrace's low-water edge (mirrors seaDistance). */
export function seaDistance(coast: Pick<CoastParams, 'terrace'>, s: number): number {
  return s - Math.min(Math.max(s, 0), coast.terrace.width)
}

/** The terrace's height above the profile around it (mirrors terraceStep). */
export function terraceStep(coast: Pick<CoastParams, 'terrace'>, s: number): number {
  const { height, width } = coast.terrace
  if (width <= 0) return 0
  return height * (1 - 2 * Math.min(Math.max(s / width, 0), 1))
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
    bars: { value: [0, 1, 2].map(i => (coast.bars[i] != null ? new Vector3(coast.bars[i].distance, coast.bars[i].height, coast.bars[i].width) : new Vector3())) },
    barCount: { value: Math.min(3, coast.bars.length) },
    rips: { value: new Vector2(coast.rips?.spacing ?? 0, coast.rips?.amplitude ?? 0) },
    cusps: { value: new Vector3(coast.cusps?.spacing ?? 0, coast.cusps?.relief ?? 0, cuspReach(coast)) },
    noiseOffset: { value: new Vector2(...coast.noiseOffset) },
    ridges: { value: [0, 1, 2].map(i => (coast.ridges[i] != null ? new Vector3(coast.ridges[i].distance, coast.ridges[i].height, coast.ridges[i].width) : new Vector3())) },
    ridgeCount: { value: Math.min(3, coast.ridges.length) },
    coastKind: { value: COAST_KINDS.indexOf(coast.type) },
    tideLevel: { value: coast.tide.level },
    terrace: { value: new Vector2(coast.terrace.height, coast.terrace.width) },
    highWater: { value: highWater(coast) },
    waterline: { value: coast.waterline },
    reef: {
      value: coast.reef != null ? new Vector4(coast.reef.distance, coast.reef.flatWidth, reefFrame(coast).lagoon, reefFrame(coast).crest) : new Vector4()
    },
    reefPass: { value: new Vector3(coast.reef?.passSpacing ?? 1000, coast.reef?.passWidth ?? 0, coast.reef != null ? lagoonSlope(coast) : 0) },
    ...rockUniforms(coast.rock)
  }
}

/** Uniform values for the rocky shore (a harmless shape when there is none). */
function rockUniforms(rock: RockShore | null): Record<string, { value: unknown }> {
  const r = rock ?? { width: 0, top: 0, edge: 0, scarp: 1, backHeight: 1, backWidth: 1, scarpSlope: 1, boulder: 0, relief: 0, bedding: 1, dip: 0, strike: 0, jointSpacing: 10, jointAngle: 0, gully: 0 }
  return {
    rockShape: { value: new Vector4(r.width, r.top, r.edge, r.scarp) },
    rockBack: { value: new Vector4(r.backHeight, r.backWidth, r.scarpSlope, r.boulder) },
    rockBeds: { value: new Vector4(r.relief, r.bedding, r.dip, r.strike) },
    rockJoints: { value: new Vector3(r.jointSpacing, r.jointAngle, r.gully) }
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
// World heights of today's high water and the spring high water (tides.ts).
uniform float tideHigh;
uniform float tideSpring;
uniform vec3 groundCover;
uniform float groundCoverAmount;
uniform float pixelAngle;
// Rocky shores: the rock's colour and the lichens' (linear albedo).
uniform vec3 rockColor;
uniform vec3 lichenColor;
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

  // Coral: a reef flat the low tide has bared (under water the ocean
  // shader draws it).
  float coral = reefCover(sa, q);
  // A rocky shore (rockShore.ts): bare rock instead of sand.
  float rockW = coastKind == COAST_ROCK_SHORE ? 1.0 : 0.0;

  // Wind ripples on dry sand: fine ridges perpendicular to an oblique wind.
  float rippleFade = (1.0 - smoothstep(0.01, 0.06, footprint)) * (1.0 - stoneW) * (1.0 - coral) * (1.0 - rockW);
  vec2 rippleDir = normalize(vec2(0.8, 0.6));
  float warp = vnoise(q * 0.9) * 6.0 + vnoise(q * 3.1) * 1.5;
  float ripple = sin(dot(q, rippleDir) * 28.0 + warp);
  N = normalize(N + vec3(rippleDir.x, 0.0, rippleDir.y) * ripple * 0.05 * rippleFade);

  // Albedo variation: patches, darker lines of shell/organic debris.
  float patches = fbm(q / 3.0);
  vec3 albedo = sandAlbedo * (0.82 + 0.3 * patches);
  albedo = mix(albedo, stoneAlbedo * (0.9 + 0.2 * patches), stoneW);
  albedo = mix(albedo, coralAlbedo(q), coral);
  float wrack = 1.0 - smoothstep(0.0, 0.08, abs(h - tideSpring - runup * 1.25 - 0.1 * (vnoise(vec2(sa.y / 6.0, 2.0)) - 0.5)));
  albedo *= 1.0 - 0.35 * wrack * smoothstep(0.4, 0.7, vnoise(vec2(sa.y / 2.0, 5.0))) * (1.0 - rockW);
  float rockPools = 0.0;
  if (rockW > 0.0) {
    float fine = 1.0 - smoothstep(0.05, 0.4, footprint);
    vec3 rockC = rockColor * (0.72 + 0.5 * fbm(q / 2.5) + 0.25 * fine * (vnoise(q * 3.0) - 0.5));
    // Faces and risers darker and bare.
    float steep = smoothstep(0.35, 0.85, 1.0 - N.y);
    rockC *= mix(1.0, 0.72, steep);
    float patchy = fbm(q / 1.7 + 5.0);
    // Above the sea's reach, lichens: a black band in the splash zone
    // (Verrucaria), then the biome's grey, yellow or orange crusts.
    float above = h - tideSpring - runup;
    float splash = smoothstep(-0.2, 0.3, above) * (1.0 - smoothstep(1.2, 2.5, above));
    rockC = mix(rockC, vec3(0.03, 0.03, 0.035), 0.7 * splash * smoothstep(0.35, 0.55, patchy));
    float spots = smoothstep(0.62, 0.7, vnoise(q * 1.3 + 3.0) * 0.6 + patchy * 0.4) * smoothstep(1.5, 3.0, above) * (1.0 - steep);
    rockC = mix(rockC, lichenColor, 0.6 * spots);
    // Below the spring high water: weed, mussels and barnacles.
    float tideBand = 1.0 - smoothstep(tideSpring - 0.3, tideSpring + 0.1 * vnoise(q * 2.0), h);
    vec3 weed = mix(vec3(0.035, 0.035, 0.04), vec3(0.09, 0.075, 0.025) * (0.7 + 0.6 * vnoise(q * 4.0)), smoothstep(0.35, 0.55, patchy));
    rockC = mix(rockC, weed, 0.8 * tideBand);
    // Cobbles on the gully floors.
    float g = rockGully(sa, length(p));
    float cobbles = 1.0 - smoothstep(0.015, 0.05, footprint);
    if (g > 0.3 && cobbles > 0.0) {
      vec2 c = q / 0.18;
      float stones = smoothstep(0.05, 0.15, cellBorder(c));
      vec3 cobble = rockColor * (0.6 + 0.6 * cellValue(ivec2(floor(c))));
      rockC = mix(rockC, mix(rockColor * 0.2, cobble, stones), smoothstep(0.3, 0.7, g) * cobbles);
    }
    // Pools the falling tide leaves in hollows and gullies of the platform.
    float onPlatform = smoothstep(-1.0, 3.0, sa.x) * (1.0 - smoothstep(rockShape.x - 5.0, rockShape.x + 2.0, sa.x));
    float hollow = max(smoothstep(0.6, 0.85, g), 1.0 - smoothstep(0.3, 0.36, fbm(q / 18.0)));
    rockPools = onPlatform * hollow * (1.0 - smoothstep(tideSpring - 0.2, tideSpring + 0.1, h));
    albedo = rockC;
  }

  // Vegetation behind the beach: patchy ground cover thickening inland, thin
  // on steep slopes and dune crests.
  float inland = -sa.x;
  float coverStart = rockW > 0.0 ? rockBack.y + 1.0 : beachWidth * 0.75 + duneWidth * 0.3;
  float cover = smoothstep(coverStart, coverStart + (rockW > 0.0 ? 8.0 : duneWidth + 30.0), inland);
  cover *= smoothstep(0.25, 0.65, fbm(q / 25.0) * 0.6 + fbm(q / 4.0) * 0.4 + cover * 0.25);
  cover *= smoothstep(0.75, 0.9, N.y) * groundCoverAmount;
  vec3 coverAlbedo = groundCover * (0.6 + 0.8 * fbm(q / 9.0 + 4.0));
  albedo = mix(albedo, coverAlbedo, cover);

  // Wet sand below the run-up line: darker and glossy.
  float wetLine = runup * (0.85 + 0.3 * vnoise(vec2(sa.y / 25.0, 7.0)));
  float wet = 1.0 - smoothstep(wetLine * 0.7, wetLine, h);
  // Wet stones darken a little more than sand.
  float hard = max(stoneW, rockW);
  albedo *= mix(1.0, mix(0.55, 0.5, hard), wet);
  // Sand the falling tide has left since high water: still saturated near
  // the water, draining higher up; on a low-tide terrace water stays ponded
  // in runnels along the shore and in puddles.
  float highMark = tideHigh + runup;
  float exposed = (1.0 - smoothstep(0.8 * highMark, highMark, h)) * (1.0 - wet);
  float drained = clamp(h / max(highMark, 0.01), 0.0, 1.0);
  float pools = 0.0;
  if (terrace.y > 0.0) {
    float onTerrace = smoothstep(0.0, 8.0, sa.x) * (1.0 - smoothstep(terrace.y - 8.0, terrace.y, sa.x));
    // Runnels drawn out along the shore, warped so they wander and break up.
    vec2 warp = 1.5 * vec2(vnoise(q / 25.0 + 5.0), vnoise(q / 25.0 + 19.0));
    float runnels = fbm(vec2(sa.y / 30.0, sa.x / 12.0) + warp + noiseOffset + 3.0) + 0.3 * (fbm(q / 5.0 + 11.0) - 0.5);
    pools = onTerrace * exposed * smoothstep(0.6, 0.7, runnels);
  }
  // Water left standing in hollows of the bare reef flat.
  pools = max(pools, coral * exposed * smoothstep(0.58, 0.68, fbm(q / 5.0 + 23.0)));
  pools = max(pools, rockPools);
  albedo *= mix(1.0, 0.68, exposed * (1.0 - hard)) * mix(1.0, 0.6, pools);
  float gloss = max(max(wet, pools), exposed * (1.0 - hard) * (0.5 - 0.4 * drained));

  vec3 L = sunDirection;
  vec3 V = normalize(cameraPosition - vWorld);
  float shadow = lightReaching(vWorld);
  float NoL = max(dot(N, L), 0.0) * shadow;
  // Soft wrap lighting stands in for the missing ambient occlusion/shadowing.
  vec3 diffuse = albedo / PI * (sunIrradiance * NoL + skyIrradiance * (0.6 + 0.4 * N.y));
  vec3 color = diffuse;

  if (gloss > 0.0) {
    // A film of water: mirror-like reflection of the sky and the sun.
    // On stones the film follows each stone, so each gets its own glint;
    // ponded water lies flat.
    vec3 Nw = normalize(mix(N, vec3(0.0, 1.0, 0.0), max(mix(0.7, 0.15, hard), pools)));
    float NoV = max(dot(Nw, V), 1e-3);
    float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
    vec3 R = reflect(-V, Nw);
    R.y = abs(R.y);
    vec3 reflected = textureLod(envMap, R, 2.0).rgb;
    vec3 H = normalize(L + V);
    float NoH = max(dot(Nw, H), 0.0);
    // Widen the highlight where a pixel covers a lot of sand, so thin distant
    // wet strips shimmer softly instead of sparkling.
    // Damp sand is a rougher reflector than a film of water.
    // Wet rock is rough: a dull sheen, not a mirror (its pools are).
    float alpha = clamp(mix(0.25, mix(0.08, 0.35, rockW * (1.0 - pools)), max(wet, pools)) + footprint * 0.4, 0.08, 0.6);
    float a2 = alpha * alpha;
    float d = NoH * NoH * (a2 - 1.0) + 1.0;
    float NoLw = max(dot(Nw, L), 0.0) * shadow;
    float k = alpha * 0.5;
    float G = NoLw / (NoLw * (1.0 - k) + k) * NoV / (NoV * (1.0 - k) + k);
    float spec = a2 / (PI * d * d) * F * G / (4.0 * NoV);
    color += gloss * mix(1.0, 0.4, rockW * (1.0 - pools)) * (reflected * F + sunIrradiance * min(spec, 0.6));

    // Lacy foam left by the last wave at the edge of the swash.
    float edge = 1.0 - smoothstep(0.0, 0.08, abs(h - wetLine * 0.55 - 0.03 * (vnoise(q * 0.4) - 0.5)));
    edge *= (0.35 + 0.65 * fbm(vec2(sa.y / 9.0, 3.3) + noiseOffset)) * step(0.001, wet);
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
      tideHigh: { value: tideMarks(coast).high },
      tideSpring: { value: tideMarks(coast).spring },
      groundCover: { value: new Color(...params.biome.groundCover) },
      groundCoverAmount: { value: params.biome.groundCoverAmount },
      rockColor: { value: new Color(...(coast.rock?.color ?? [0.3, 0.3, 0.3])) },
      lichenColor: { value: new Color(...LICHEN[params.biome.name]) },
      pixelAngle: { value: 0.001 },
      ...shadowUniforms()
    }
  })
  const mesh = new Mesh(createPolarGrid({ rings: 600, segments: 1024, outerRadius: 120_000 }), material)
  mesh.frustumCulled = false
  mesh.visible = hasLand(coast)
  return mesh
}
