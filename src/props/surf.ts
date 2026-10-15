import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type PerspectiveCamera
} from 'three'

import type { CoastParams } from '../params'
import { shoreToWorld, surfCycle, surfSets, surfWave, worldToShore } from '../terrain'
import type { PropContext } from './context'

// White water where waves break: spray thrown up along the breaking crests of
// the surf and burst against rocks at the waterline.
//
// Spilling breakers crumble from the top into a turbulent crown of foam and
// mist; plunging ones throw a lip and burst. Against rocks the wave's
// momentum goes up: a fountain of spray several times the wave's height,
// falling back landward. Droplets are drawn as point sprites with per-frame
// screen-door transparency (no blending, so they composite correctly with
// the volumetric clouds; the frame average makes them soft), lit
// like the scene, glowing when backlit by the sun, and showing a spray bow —
// a little rainbow at 42° from the antisolar point — when the sun is behind.

const sprayShader = {
  vertexShader: /* glsl */ `
    attribute float size;
    attribute float opacity;
    uniform float pixelsPerRadian;
    varying float vOpacity;
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec4 view = viewMatrix * world;
      vWorld = world.xyz;
      // Sub-pixel droplets keep a 1.5 px footprint but fade out instead.
      float px = size / -view.z * pixelsPerRadian;
      vOpacity = opacity * min(1.0, px / 1.5);
      gl_PointSize = max(px, 1.5);
      gl_Position = projectionMatrix * view;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 sunDirection;
    uniform vec3 sunIrradiance;
    uniform vec3 skyIrradiance;
    uniform vec3 albedo;
    uniform float bowStrength;
    uniform float frame;
    varying float vOpacity;
    varying vec3 vWorld;
    vec3 bow(float t) {
      vec3 c;
      c.r = smoothstep(0.35, 0.75, t) + 0.35 * (1.0 - smoothstep(0.0, 0.18, t));
      c.g = exp(-pow((t - 0.5) / 0.22, 2.0));
      c.b = 1.0 - smoothstep(0.1, 0.45, t);
      return c * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.88, 1.0, t));
    }
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      // Soft-edged, so overlapping droplets merge into one mass.
      float edge = max(1.0 - dot(p, p), 0.0);
      float alpha = vOpacity * edge * edge;
      // Screen-door transparency, re-seeded every frame: averaging the
      // frames (accumulate.ts) turns it into soft, translucent spray.
      vec2 q = gl_FragCoord.xy + vec2(frame * 7.13, frame * 3.71);
      float noise = fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453);
      if (noise > alpha) discard;
      vec3 V = normalize(vWorld - cameraPosition);
      float sunUp = step(0.0, sunDirection.y);
      // Water droplets: bright white in sky and sun light, glowing when
      // the sun shines through them.
      float forward = pow(max(dot(V, sunDirection), 0.0), 6.0);
      vec3 color = albedo * (skyIrradiance + sunIrradiance * max(sunDirection.y, 0.0) * 0.8) / 3.14159;
      color += sunIrradiance * forward * 0.25 * sunUp;
      // Spray bow.
      float theta = degrees(acos(clamp(dot(V, -sunDirection), -1.0, 1.0)));
      color += bow((theta - 40.4) / 2.3) * sunIrradiance * 0.06 * sunUp * bowStrength;
      gl_FragColor = vec4(color, 1.0);
    }`
}

/** A rock standing out of the sea: where it cuts the water and how high
 * it stands above it. */
export interface WaterRock {
  x: number
  z: number
  /** Radius at the waterline (m). */
  radius: number
  /** Height of its top above still water (m). */
  top: number
  /** Water depth at its foot (m). */
  depth: number
}

/** Rocks cutting the sea surface, from the rock meshes (boulders in the
 * shallows, sea stacks offshore). Rock geometry is roughly a unit sphere. */
export function waterRocks(ctx: PropContext, rocks: InstancedMesh[]): WaterRock[] {
  const out: WaterRock[] = []
  const m = new Matrix4()
  const p = new Vector3()
  const q = new Quaternion()
  const s = new Vector3()
  for (const mesh of rocks) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      m.decompose(p, q, s)
      const depth = -ctx.ground(p.x, p.z)
      const top = p.y + s.y * 0.85
      if (depth <= 0.05 || top <= 0.05 || p.y - s.y > 0) continue
      const level = Math.min(0.95, Math.abs(p.y / s.y))
      const radius = Math.max(s.x, s.z) * 0.9 * Math.sqrt(1 - level * level)
      if (radius < 0.15) continue
      out.push({ x: p.x, z: p.z, radius, top, depth })
    }
  }
  return out
}

/**
 * What the waves do at a rock: `crest`, the height (m) the passing wave
 * crests reach above still water there (surf where the waves feel the
 * bottom, plus the open sea's waves), and `breaks`, 0..1, whether they break
 * on it. A rock standing higher than the crests stops the wave, which bursts
 * against its face; one the crests top washes over and is merely awash.
 * Either way the rock cuts the surface, so there's always some foam round
 * it and in its lee.
 */
export function waveOnRock(coast: CoastParams, rock: Pick<WaterRock, 'top' | 'depth'>, seaHeight: number, sets = 1): { crest: number; breaks: number } {
  // A crest stands about 0.7 of a shallow-water wave's height above still
  // water; open-sea crests about half the significant height.
  const surf = coast.surfAmplitude > 0 && rock.depth < 0.6 * coast.surfWavelength ? 0.7 * surfWave(coast, rock.depth, sets).height : 0
  const crest = Math.max(surf, 0.5 * seaHeight)
  const breaks = crest < 0.05 ? 0 : smoothstep(0.8, 1.2, rock.top / crest)
  return { crest, breaks }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Point-sprite droplets or puffs; also used for volcanic plumes. */
export class SprayBuilder {
  readonly positions: number[] = []
  readonly sizes: number[] = []
  readonly opacities: number[] = []

  add(p: Vector3, size: number, opacity: number): void {
    this.positions.push(p.x, p.y, p.z)
    this.sizes.push(size)
    this.opacities.push(opacity)
  }

  /** `albedo`: how white the droplets are; `bow`: whether they're water
   * drops that make a spray bow. */
  build(albedo = new Color(0.85, 0.85, 0.85), bow = true): Points | null {
    if (this.sizes.length === 0) return null
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geometry.setAttribute('size', new BufferAttribute(new Float32Array(this.sizes), 1))
    geometry.setAttribute('opacity', new BufferAttribute(new Float32Array(this.opacities), 1))
    const points = new Points(
      geometry,
      new ShaderMaterial({
        ...sprayShader,
        uniforms: {
          pixelsPerRadian: { value: 1000 },
          sunDirection: { value: new Vector3(0, 1, 0) },
          sunIrradiance: { value: new Color() },
          skyIrradiance: { value: new Color() },
          albedo: { value: albedo },
          bowStrength: { value: bow ? 1 : 0 },
          frame: { value: 0 }
        }
      })
    )
    points.onBeforeRender = () => (points.material as ShaderMaterial).uniforms.frame.value++
    points.frustumCulled = false
    points.userData.spray = true
    return points
  }
}

export function createSurf(ctx: PropContext, rocks: InstancedMesh[]): Points[] {
  const { params } = ctx
  const { coast } = params
  if (coast.type !== 'beach' || coast.surfAmplitude < 0.15) return []
  const rng = ctx.rng('surf')
  const spray = new SprayBuilder()
  const amplitude = coast.surfAmplitude
  // Wind tears more spray off the crests.
  const windy = Math.min(1.5, 0.6 + params.ocean.windSpeed / 12)

  // --- Breaking crests ---------------------------------------------------
  const [, camA] = worldToShore(coast, ctx.camera.position.x, ctx.camera.position.z)
  const step = 1.2
  for (let a = camA - 700; a < camA + 700; a += step) {
    // Crests sit where the surf cycle reaches 0.25: solve along s.
    for (let k = 0; k < 12; k++) {
      const s0 = (k + 0.25 - surfCycle(coast, 0, a)) * coast.surfWavelength
      // The cycle's along-shore noise doesn't depend on s, so this is exact.
      const s = s0 + rng.range(-0.6, 0.6)
      if (s < 0 || s > 260) continue
      const [x, z] = shoreToWorld(coast, s, a)
      const depth = -ctx.ground(x, z)
      // Only where the wave is breaking (surfWave): deeper it's still a
      // swell, and right at the edge it's spent foam.
      if (depth < 0.15) continue
      const sets = surfSets(coast, s, a)
      if (sets < 0.3) continue
      const wave = surfWave(coast, depth, sets)
      if (wave.steepness < 0.9) continue
      const distance = ctx.distance(x, z)
      if (distance > 900 || !ctx.visible(x, 1, z, 5)) continue
      // The crest stands about 0.7 of the wave height above still water.
      const height = wave.height * 0.75
      // The roller: a soft, low veil of whitewater hugging the crest and its
      // front face, made of overlapping translucent puffs so it reads as one
      // mass rather than separate drops. Puffs keep their size at a
      // distance and fade instead, so far crests don't turn into dots.
      const fade = Math.min(1, 140 / distance)
      const n = Math.round(4 + height * 5 * windy)
      for (let i = 0; i < n; i++) {
        const along = a + rng.range(-step / 2, step / 2)
        // Front face (shoreward, negative) to just behind the crest.
        const across = s + rng.range(-1.2, 0.5) * height
        const [px, pz] = shoreToWorld(coast, across, along)
        const y = height * (0.25 + 0.75 * rng.float() ** 2)
        const size = rng.range(0.5, 1.1) * (0.5 + height * 0.5)
        spray.add(new Vector3(px, y, pz), size, rng.range(0.25, 0.5) * fade)
      }
      // Wind-blown mist streaming back off the top.
      for (let i = 0; i < Math.round(2 * windy); i++) {
        const [px, pz] = shoreToWorld(coast, s + rng.range(0, 3) * height, a + rng.range(-step, step))
        const size = rng.range(1, 2.2) * (0.5 + height * 0.5)
        spray.add(new Vector3(px, height * rng.range(0.7, 1.4), pz), size, rng.range(0.08, 0.18) * fade)
      }
    }
  }

  // --- Waves breaking on rocks ----------------------------------------------
  // A wave lower than the rock bursts against its seaward face when a crest
  // is there now; one higher washes over it. Sea stacks offshore take the
  // open sea's waves.
  const q = new Vector3()
  for (const rock of waterRocks(ctx, rocks)) {
    const size = rock.radius
    if (!ctx.visible(rock.x, rock.top, rock.z, size * 3)) continue
    const [s, a] = worldToShore(coast, rock.x, rock.z)
    const sets = surfSets(coast, s, a)
    const wave = waveOnRock(coast, rock, ctx.waveHeight, sets)
    // In the surf a crest is at the rock when the cycle is near its crest
    // (0.25); offshore the waves are irregular: a fair chance.
    const cycle = surfCycle(coast, s, a)
    const inSurf = rock.depth < 0.6 * coast.surfWavelength && amplitude > 0.05
    const hitting = inSurf ? Math.abs(cycle - 0.29) < 0.09 : rng.chance(0.35)
    const ground = -rock.depth
    // Seaward face, and "up and over" toward land.
    const [fx, fz] = shoreToWorld(coast, s + size * 0.8, a)
    const face = new Vector3(fx, 0, fz)
    const [lx, lz] = shoreToWorld(coast, s - 1, a)
    const landward = new Vector3(lx - rock.x, 0, lz - rock.z).normalize()
    const plume = hitting && wave.breaks > 0.3 ? Math.min(8 + size * 0.3, (wave.crest * 2.2 + size * 0.15) * wave.breaks * rng.range(0.6, 1.2) * windy) : 0
    // A burst of white water thrown up and landward: a dense core of
    // small droplets low and central, thinning out with height, inside a
    // faint veil of mist. Droplets are a few centimetres; anything bigger
    // reads as floating discs.
    const count = Math.round(Math.min(2500, plume * 220 * Math.max(1, size / 3)))
    for (let k = 0; k < count; k++) {
      const t = rng.float()
      const spread = size * (0.4 + 1.1 * t)
      q.set(rng.normal(0, spread), 0, rng.normal(0, spread))
      const y = plume * Math.sqrt(t) * rng.range(0.4, 1.1)
      const p = face.clone().add(q).addScaledVector(landward, t * size * 1.2).setY(y + Math.max(0, ground))
      spray.add(p, rng.range(0.03, 0.12) * Math.max(1, size / 4), rng.range(0.5, 1) * (1 - 0.6 * t))
    }
    for (let k = 0; k < Math.round(plume * 25); k++) {
      const t = rng.float()
      const spread = size * (0.6 + 1.6 * t)
      q.set(rng.normal(0, spread), 0, rng.normal(0, spread))
      const p = face.clone().add(q).addScaledVector(landward, t * size * 1.5)
      p.setY(plume * t * rng.range(0.3, 0.9) + Math.max(0, ground))
      spray.add(p, rng.range(0.8, 2) * (0.5 + plume * 0.15), rng.range(0.04, 0.1))
    }
  }
  const points = spray.build()
  return points == null ? [] : [points]
}

/** Light the spray once the sun and sky irradiance are known. */
export function setSprayLighting(
  root: Object3D,
  camera: PerspectiveCamera,
  height: number,
  sunDirection: Vector3,
  sunIrradiance: Color,
  skyIrradiance: Color
): void {
  const pixelsPerRadian = height / 2 / Math.tan((camera.fov * Math.PI) / 360)
  root.traverse(o => {
    if (o.userData.spray !== true) return
    const u = ((o as Points).material as ShaderMaterial).uniforms
    u.pixelsPerRadian.value = pixelsPerRadian
    ;(u.sunDirection.value as Vector3).copy(sunDirection)
    ;(u.sunIrradiance.value as Color).copy(sunIrradiance)
    ;(u.skyIrradiance.value as Color).copy(skyIrradiance)
  })
}
