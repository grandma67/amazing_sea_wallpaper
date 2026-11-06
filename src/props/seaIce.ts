import { BufferAttribute, Color, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector2, Vector3, type BufferGeometry, type Object3D } from 'three'
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

import { hashCell } from '../cellNoise'
import { createPolarGrid, squareGrid, viewWedge } from '../grid'
import type { RGB } from '../biome'
import type { CoastParams, SceneParams } from '../params'
import type { Random } from '../random'
import { ICE_FREEBOARD, iceRubble, type SeaIceParams } from '../seaIce'
import { hasLand, terrainHeight, worldToShore } from '../terrain'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { outline, slab } from './ice'
import { curvatureDrop } from './landforms'
import { fbm3 } from './noise'

// A frozen sea (plans/SEA_ICE.md, SEASONS.md §4.2): a sheet floating above the
// water, hiding it, so surf, foam and reflections need no edits. Its look is a
// function of world position and the distance from the shore; rubble is real
// blocks near the camera and the sheet's own colour past them.

/** The sheet's grid: flat, so few vertices do; only `off` needs them near the shore. */
const SHEET_VERTICES = 36_000
const SHEET_INNER = 1
const SHEET_OUTER = 120_000
const SHEET_MARGIN = 0.05
/** Offshore distance on a day with no shore: all drift. */
const NO_SHORE = 1e7

/** Pieces of rubble: flat slabs as thick as the ice (photos: Rügen, Kemi), and
 * near the camera rounded snowy lumps too (photo: Gulf of Finland). A piece per
 * cell at most; sizes across a slab (m). */
export const BLOCK_SETS = [
  { cell: 1.3, range: 130, size: [0.5, 1.9], budget: 3000, lumps: true },
  { cell: 5, range: 650, size: [1.2, 2.6], budget: 4000, lumps: false }
] as const
const SLAB_VARIANTS = 3
/** Slab thickness (m): the ice's own, 0.1–0.5 m. */
const SLAB_THICKNESS = [0.12, 0.5] as const
/** No block this near the camera, so none stands in it (m). */
const CAMERA_GAP = 4
/** Below this the mask has no blocks; the sheet's colour carries it. */
const MIN_RUBBLE = 0.2
/** A pile's top above the ice (m). Estimate: sail + keel is 5–15 m (Eriksson et al.
 * 2025, citing Leppäranta & Hakala 1992), and the keel is most of it. */
const PILE_HEIGHT = 2.2

/** Sea ice mesh today? */
export function seaIceFor(params: SceneParams): SeaIceParams | null {
  return params.overrides?.seaIce === false ? null : params.seaIce
}

/** The sheet's offshore distance at a point (m from today's water; land < 0). */
export function offshore(coast: CoastParams, x: number, z: number): number {
  return hasLand(coast) ? worldToShore(coast, x, z)[0] - coast.waterline : NO_SHORE
}

/** The flat sheet over the view: curved with the sea, carrying `off` per vertex. */
export function sheetGeometry(coast: CoastParams, wedge: { start: number; span: number }): BufferGeometry {
  const { rings, segments } = squareGrid(SHEET_VERTICES, wedge.span, SHEET_INNER, SHEET_OUTER)
  const geometry = createPolarGrid({ rings, segments, innerRadius: SHEET_INNER, outerRadius: SHEET_OUTER, start: wedge.start, span: wedge.span })
  const position = geometry.attributes.position as BufferAttribute
  const off = new Float32Array(position.count)
  const normal = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    position.setY(i, ICE_FREEBOARD - curvatureDrop(x, z))
    off[i] = offshore(coast, x, z)
    normal[i * 3 + 1] = 1
  }
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  geometry.setAttribute('aIceOff', new BufferAttribute(off, 1))
  geometry.boundingSphere = null
  return geometry
}

// Mirrors cellNoise.ts bit for bit, and iceDrift and iceRubble in seaIce.ts.
const FIELDS_GLSL = /* glsl */ `
uniform vec2 iceOrigin;
uniform float iceEdge;
uniform float iceCover;
uniform float iceSnow;
uniform float iceMelt;
uniform float iceThin;
uniform float iceRubble;
uniform float iceLead;
uniform float iceInland;
uniform vec2 iceWind;
varying vec3 vIceWorld;
varying float vIceOff;

uint iceHash(ivec2 c) {
  uvec2 p = uvec2(c + ivec2(1 << 20));
  uint n = p.x * 1597334677u ^ p.y * 3812015801u;
  n ^= n >> 16;
  n *= 2246822519u;
  n ^= n >> 13;
  n *= 3266489917u;
  n ^= n >> 16;
  return n;
}
float iceNoise(vec2 x) {
  ivec2 i = ivec2(floor(x));
  vec2 f = x - vec2(i);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = float(iceHash(i)) / 4294967295.0;
  float b = float(iceHash(i + ivec2(1, 0))) / 4294967295.0;
  float c = float(iceHash(i + ivec2(0, 1))) / 4294967295.0;
  float d = float(iceHash(i + ivec2(1, 1))) / 4294967295.0;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float iceFbm(vec2 x) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * iceNoise(x);
    x = x * 2.03 + vec2(17.1, 9.3);
    amp *= 0.5;
  }
  return sum / 0.9375;
}
float iceDrift(vec2 p, float off) {
  float edge = iceEdge * (0.6 + 0.8 * iceNoise(p / 500.0));
  return smoothstep(edge - 80.0, edge + 40.0, off);
}
float iceRubbleAt(vec2 p, float off, float drift) {
  float warp = iceFbm(p / 900.0);
  float n = iceFbm(p / 420.0 + vec2(3.0, -3.0) * warp);
  float width = 0.012 + 0.03 * iceNoise(p / 150.0);
  float line = (1.0 - smoothstep(width * 0.3, width, abs(n - 0.5))) * smoothstep(0.35, 0.6, iceNoise(p / 700.0));
  float ridge = line * (0.45 + 0.55 * drift);
  float beltNoise = iceNoise(p / 130.0);
  float belt = 4.0 + 46.0 * beltNoise * beltNoise;
  float shore = (1.0 - smoothstep(belt * 0.5, belt, off - iceLead)) * smoothstep(0.2, 0.45, iceNoise(p / 240.0));
  float barrier = drift > 0.0 && drift < 1.0 ? 1.0 - abs(2.0 * drift - 1.0) : 0.0;
  return max(max(ridge * iceRubble, shore * min(1.0, 0.4 + iceRubble)), 0.7 * barrier * iceRubble);
}
// Snow drifts lie along the wind: long that way, short across it.
vec2 iceDriftCoord(vec2 p, vec2 across) {
  return vec2(dot(p, iceWind) / 55.0, dot(p, across) / 16.0);
}
// Plates: x the distance to the nearest border (m, approximate), y a hash of
// that border (the same from both sides), z a hash of the plate.
vec3 icePlates(vec2 p, float size) {
  vec2 q = p / size;
  ivec2 c = ivec2(floor(q));
  vec2 f = q - vec2(c);
  float d1 = 1e9;
  float d2 = 1e9;
  uint h1 = 0u;
  uint h2 = 0u;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 o = ivec2(i, j);
      uint h = iceHash(c + o);
      vec2 r = vec2(o) + vec2(float(h & 1023u), float((h >> 10u) & 1023u)) / 1023.0 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; h2 = h1; d1 = d; h1 = h; }
      else if (d < d2) { d2 = d; h2 = h; }
    }
  }
  uint border = (h1 ^ h2) * 2654435761u;
  return vec3(0.5 * (sqrt(d2) - sqrt(d1)) * size, float(border >> 16u) / 65535.0, float(h1 >> 16u) / 65535.0);
}
`

const VERTEX_GLSL = /* glsl */ `
attribute float aIceOff;
varying vec3 vIceWorld;
varying float vIceOff;
`

const SURFACE_GLSL = /* glsl */ `
  // World position, and metres per pixel for fading detail.
  vec2 iceP = vIceWorld.xz + iceOrigin;
  // Derivatives before the origin's added: at tens of km a float can't hold them.
  float iceFp = max(length(dFdx(vIceWorld.xz)), length(dFdy(vIceWorld.xz)));
  float iceOff = vIceOff;
  // Inland (a hollow behind the dunes stays dry; a rock shore's pools freeze),
  // and open water at the shore.
  if (iceOff < iceInland) discard;
  if (iceLead > 0.0 && iceOff < iceLead * (0.4 + 1.2 * iceNoise(iceP / 70.0))) discard;

  float iceDriftHere = iceDrift(iceP, iceOff);
  float iceRub = iceRubbleAt(iceP, iceOff, iceDriftHere);
  // Whole fields of open water past the edge.
  float iceField = iceFbm(iceP / 1500.0);
  float iceOpen = iceDriftHere * (1.0 - smoothstep(0.5 + (0.5 - iceCover) * 0.8 - 0.015, 0.5 + (0.5 - iceCover) * 0.8 + 0.015, iceField));
  if (iceCover < 0.98 && iceOpen > 0.5 && iceRub < 0.5) discard;

  // Plates: big ones crack the fast ice now and then; past the edge they part.
  float icePlate = mix(140.0, 30.0 + 150.0 * iceNoise(iceP / 900.0), iceDriftHere);
  vec2 iceWarp = vec2(iceNoise(iceP / 37.0), iceNoise(iceP / 37.0 + 11.0)) - 0.5;
  // Fine wander too, so a border isn't a ruled line near the camera.
  vec2 iceWander = iceFp < 1.0 ? vec2(iceNoise(iceP / 2.7), iceNoise(iceP / 2.7 + 23.0)) - 0.5 : vec2(0.0);
  vec3 iceBig = icePlates(iceP + 18.0 * iceWarp + 1.6 * iceWander, icePlate);
  // Few borders open (photo: Kemi); the rest are cracks at most.
  float iceGap = iceDriftHere * smoothstep(0.7, 0.85, iceBig.y) * icePlate * 0.1 * (1.0 - min(iceCover, 0.97) + 0.5 * iceMelt + 0.3 * iceThin);
  float iceLeadShare = 0.0;
  if (iceBig.x < iceGap && iceRub < 0.5) {
    // Brash in the lead, where it's near enough to tell.
    float brash = iceNoise(iceP / 0.9);
    if (iceFp > iceGap * 2.0) iceLeadShare = min(1.0, 2.0 * iceGap / iceFp);
    else if (brash < 0.68) discard;
  }

  // The surface: snow, drifted along the wind, over bare ice.
  vec2 iceAlong = vec2(iceWind.y, -iceWind.x);
  float iceDrifted = iceFbm(iceDriftCoord(iceP, iceAlong));
  float iceSnowHere = smoothstep(1.0 - iceSnow - 0.14, 1.0 - iceSnow + 0.14, iceDrifted);
  // New ice: dark nilas, with paler grey ice in patches.
  vec3 iceNew = mix(vec3(0.07, 0.1, 0.12), vec3(0.3, 0.37, 0.42), smoothstep(0.42, 0.6, iceFbm(iceP / 90.0)));
  vec3 iceBare = mix(vec3(0.33, 0.45, 0.53), iceNew, iceThin);
  iceBare = mix(iceBare, vec3(0.3, 0.36, 0.41), iceMelt * 0.7);
  vec3 iceColor = mix(iceBare, vec3(0.82, 0.84, 0.87), iceSnowHere);
  float iceRough = mix(mix(0.3, 0.14, iceThin), 0.85, iceSnowHere);
  // Slow variation of the snow, as it reads from afar.
  iceColor *= 0.93 + 0.1 * iceFbm(iceP / 240.0);

  // Pools in the break-up, greenish over the ice.
  float icePool = iceMelt * smoothstep(0.58, 0.64, iceFbm(iceP / 22.0));
  iceColor = mix(iceColor, vec3(0.13, 0.25, 0.27), icePool);
  iceRough = mix(iceRough, 0.07, icePool);

  // Height for the normal: drifts, a tilt per plate, ridges' lumps.
  float iceFade = 1.0 - smoothstep(1.0, 8.0, iceFp);
  vec2 iceSlope = vec2(0.0);
  if (iceFade > 0.0) {
    float e = max(0.5, iceFp);
    // Finer than the patches: three times their scale.
    float d0 = iceFbm(3.0 * iceDriftCoord(iceP, iceAlong));
    vec2 slope = vec2(iceFbm(3.0 * iceDriftCoord(iceP + vec2(e, 0.0), iceAlong)), iceFbm(3.0 * iceDriftCoord(iceP + vec2(0.0, e), iceAlong))) - d0;
    iceSlope += 0.08 * iceSnowHere * iceFade * slope / e;
  }
  float iceAngle = 6.2831853 * iceBig.z;
  // Floes lie level, at this size and the finer one below: near a grazing sun
  // even 1° shows each as a paving stone.
  iceSlope += 0.002 * vec2(cos(iceAngle), sin(iceAngle));

  // Fine plates, and small cracks, in ice that's been pushed about.
  if (iceFp < 2.5) {
    vec3 iceFine = icePlates(iceP + 3.0 * iceWarp, 9.0);
    float show = 1.0 - smoothstep(0.8, 2.5, iceFp);
    float crack = iceDriftHere * 0.7 + 0.12;
    float w = 0.03 + 0.07 * iceFine.y;
    float line = (1.0 - smoothstep(w, w + iceFp, iceFine.x)) * step(iceFine.y, crack) * show;
    iceColor = mix(iceColor, vec3(0.12, 0.17, 0.2), 0.75 * line);
    float a = 6.2831853 * iceFine.z;
    iceSlope += show * 0.004 * vec2(cos(a), sin(a));
    // A rafted lip, lit along the crack's side.
    iceSlope += show * 0.12 * (1.0 - smoothstep(w, w + 0.5, iceFine.x)) * step(iceFine.y, crack) * vec2(sin(a * 3.0), cos(a * 3.0));
  }

  // Rubble in the sheet: bright faces and blue shadow, a mean of them from afar.
  if (iceRub > 0.02) {
    float mean = 0.8;
    float speck = iceFp < 3.0 ? iceNoise(iceP / 1.3) : 0.5;
    float show = 1.0 - smoothstep(1.0, 3.0, iceFp);
    float lit = mix(mean, 0.55 + 0.75 * speck, show);
    vec3 faces = iceColor * lit * vec3(0.95 + 0.05 * lit, 0.97 + 0.03 * lit, 1.0);
    iceColor = mix(iceColor, faces, smoothstep(0.02, 0.5, iceRub));
    float a = 6.2831853 * iceNoise(iceP / 2.3);
    iceSlope += smoothstep(0.1, 0.5, iceRub) * show * 0.35 * vec2(cos(a), sin(a));
    iceRough = mix(iceRough, 0.7, smoothstep(0.1, 0.5, iceRub));
  }

  // Cracks: thin, dark and only some of the borders, frozen over; past the
  // edge a lip at each lead, and far leads as a share of dark in the pixel.
  float iceCrack = 0.02 + 0.05 * iceBig.y;
  float iceIs = step(iceBig.y, 0.35 + 0.1 * iceDriftHere);
  float iceLine = (1.0 - smoothstep(iceCrack, iceCrack + iceFp, iceBig.x)) * iceIs * min(1.0, (2.0 * iceCrack + 0.04) / max(iceFp, 0.01));
  iceColor = mix(iceColor, vec3(0.1, 0.15, 0.19), 0.8 * iceLine);
  iceColor = mix(iceColor, vec3(0.3, 0.42, 0.5), iceDriftHere * (1.0 - smoothstep(iceGap, iceGap + 0.3, iceBig.x)) * (1.0 - smoothstep(0.1, 0.4, iceFp)));
  iceColor = mix(iceColor, vec3(0.025, 0.04, 0.05), iceLeadShare);
`

/** The sheet's material: a standard one with the ice's look at world position. */
export function sheetMaterial(ice: SeaIceParams, windHeadingDeg: number, inland = -30): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 })
  const wind = (windHeadingDeg * Math.PI) / 180
  const uniforms = {
    iceOrigin: { value: new Vector2(...ice.origin) },
    iceEdge: { value: ice.edge },
    iceCover: { value: ice.cover },
    iceSnow: { value: ice.snow },
    iceMelt: { value: ice.melt },
    iceThin: { value: ice.thin },
    iceRubble: { value: ice.rubble },
    iceLead: { value: ice.lead },
    iceInland: { value: inland },
    iceWind: { value: new Vector2(Math.sin(wind), Math.cos(wind)) }
  }
  material.customProgramCacheKey = () => 'sea-ice'
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_GLSL}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vIceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vIceOff = aIceOff;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FIELDS_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = iceColor;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = iceRough;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(normalize(vec3(-iceSlope.x, 1.0, -iceSlope.y)), 0.0)).xyz);`
      )
  }
  return material
}

/** A slab of radius ~1, top at y = 1 and base at y = 0, for a thickness set by its
 * y scale: angular, snowy or clear on top, blue-green at its broken sides. */
export function slabGeometry(rng: Random, snow: number): BufferGeometry {
  const b = new MeshBuilder()
  const top: RGB = [0.56 + 0.26 * snow, 0.7 + 0.14 * snow, 0.76 + 0.11 * snow]
  // Snow lies thinner to the rim, where the ice shows.
  const rim: RGB = [0.5 + 0.2 * snow, 0.62 + 0.13 * snow, 0.68 + 0.1 * snow]
  const topAt = (x: number, z: number): RGB => (x === 0 && z === 0 ? top : rim)
  slab(b, outline(rng, rng.int(5, 8), rng.range(1, 1.35), rng.range(0.12, 0.28)), 1, 0, topAt, (_x, y) => [0.38 + 0.18 * y, 0.5 + 0.17 * y, 0.56 + 0.15 * y])
  // Broken faces, each flat: shared normals round the sides read as a drum.
  const built = b.build()
  const creased = toCreasedNormals(built, 0.5)
  built.dispose()
  return creased
}

/** A rounded lump of snowy ice, about 1 across, base near y = 0. */
export function lumpGeometry(rng: Random): BufferGeometry {
  const geometry = mergeVertices(new IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'))
  const position = geometry.attributes.position as BufferAttribute
  const seed = rng.int(0, 100_000)
  const colors = new Float32Array(position.count * 3)
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    // Broad, low and uneven: drifted-over cakes, not pebbles.
    v.multiplyScalar(0.46 * (0.45 + 1.1 * fbm3(v.x * 2.1, v.y * 2.1, v.z * 2.1, seed)))
    v.y = Math.max(-0.08, v.y * 0.5 + 0.1)
    position.setXYZ(i, v.x, v.y, v.z)
    colors.set(v.y < 0.05 ? [0.5, 0.64, 0.7] : [0.82, 0.84, 0.87], i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** One piece of rubble, by a hash of its cell; null where there's none. */
export function iceBlock(ice: SeaIceParams, coast: CoastParams, set: (typeof BLOCK_SETS)[number], cx: number, cz: number): { x: number; z: number; y: number; size: number; h: (salt: number) => number; rubble: number } | null {
  const ix = cx + Math.floor(ice.origin[0] / set.cell)
  const iz = cz + Math.floor(ice.origin[1] / set.cell)
  const h = (salt: number): number => hashCell(ix ^ (salt * 7919), iz + salt) / 4294967296
  const x = (cx + h(1)) * set.cell
  const z = (cz + h(2)) * set.cell
  const off = offshore(coast, x, z)
  if (off < ice.lead - 8) return null
  const rubble = iceRubble(ice, x, z, off)
  if (rubble < MIN_RUBBLE || h(3) > rubble) return null
  const ground = hasLand(coast) ? terrainHeight(coast, x, z) : -1
  const size = set.size[0] + (set.size[1] - set.size[0]) * h(4) ** 2
  // A pile: most pieces low, fewer up to its top where the rubble is thickest.
  const up = PILE_HEIGHT * rubble * h(5) ** 2.2
  return { x, z, y: Math.max(ground, ICE_FREEBOARD) + up - 0.1, size, h, rubble }
}

export function createSeaIce(ctx: PropContext): Object3D[] {
  const ice = seaIceFor(ctx.params)
  if (ice == null) return []
  const { coast } = ctx.params
  const rng = ctx.rng('sea-ice')
  const sheet = new Mesh(sheetGeometry(coast, viewWedge(ctx.camera, SHEET_MARGIN)), sheetMaterial(ice, ctx.params.ocean.windHeadingDeg, coast.rock != null ? -400 : -30))
  sheet.receiveShadow = true
  sheet.frustumCulled = false
  const objects: Object3D[] = [sheet]

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 })
  const slabs = Array.from({ length: SLAB_VARIANTS }, () => slabGeometry(rng, ice.snow))
  const lump = lumpGeometry(rng)
  const cam = ctx.camera.position
  const axis = new Vector3()
  const yUp = new Vector3(0, 1, 0)
  /** Instanced meshes from what each geometry got. */
  const emit = (geometry: BufferGeometry, own: Matrix4[]): void => {
    if (own.length === 0) return
    const mesh = new InstancedMesh(geometry, material, own.length)
    own.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, new Color().setScalar(0.92 + 0.14 * (((i * 2654435761) >>> 0) % 4096) / 4096))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    objects.push(mesh)
  }
  const bySlab: Matrix4[][] = slabs.map(() => [])
  const lumps: Matrix4[] = []
  for (const set of BLOCK_SETS) {
    const placed: { m: Matrix4; distance: number; target: Matrix4[] }[] = []
    const reach = Math.ceil(set.range / set.cell)
    for (let cx = -reach; cx <= reach; cx++) {
      for (let cz = -reach; cz <= reach; cz++) {
        const x0 = (cx + 0.5) * set.cell
        const z0 = (cz + 0.5) * set.cell
        const distance = Math.hypot(x0 - cam.x, z0 - cam.z)
        // The coarser set only past the finer one: large pieces beside the eye read as stage props.
        if (set.lumps === false && distance < BLOCK_SETS[0].range) continue
        if (distance > set.range || !ctx.visible(x0, 0, z0, set.cell + set.size[1])) continue
        const block = iceBlock(ice, coast, set, cx, cz)
        if (block == null) continue
        const { h, size } = block
        if (Math.hypot(block.x - cam.x, block.z - cam.z) < CAMERA_GAP + size) continue
        const position = new Vector3(block.x, block.y, block.z)
        const spin = new Quaternion().setFromAxisAngle(yUp, h(10) * Math.PI * 2)
        if (set.lumps && ice.snow > 0.3 && h(6) < 0.15) {
          placed.push({ m: new Matrix4().compose(position, spin, new Vector3(size * 1.3, size * (0.7 + 0.5 * h(12)), size * (0.9 + 0.6 * h(13)))), distance, target: lumps })
          continue
        }
        // Slabs lie tilted on one another: steeper up the pile.
        const tilt = (0.1 + 0.8 * block.rubble * h(7)) * (0.5 + 0.5 * h(14))
        axis.set(h(8) - 0.5, 0, h(9) - 0.5).normalize()
        const q = new Quaternion().setFromAxisAngle(axis, tilt).multiply(spin)
        const thick = SLAB_THICKNESS[0] + (SLAB_THICKNESS[1] - SLAB_THICKNESS[0]) * h(11)
        placed.push({ m: new Matrix4().compose(position, q, new Vector3(size * 0.55, thick, size * 0.55 * (0.6 + 0.7 * h(13)))), distance, target: bySlab[Math.floor(h(15) * SLAB_VARIANTS)] })
      }
    }
    // Over budget, the nearest stay: they're the ones seen as pieces.
    placed.sort((a, b) => a.distance - b.distance)
    for (const p of placed.slice(0, set.budget)) p.target.push(p.m)
  }
  slabs.forEach((g, i) => (bySlab[i].length > 0 ? emit(g, bySlab[i]) : g.dispose()))
  if (lumps.length > 0) emit(lump, lumps)
  else lump.dispose()
  return objects
}
