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

import { shoreToWorld, surfCycle, surfSets, worldToShore } from '../terrain'
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
      float alpha = vOpacity * (1.0 - dot(p, p));
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
  const breakDepth = 1.4 * amplitude + 0.4

  // --- Breaking crests ---------------------------------------------------
  const [, camA] = worldToShore(coast, ctx.camera.position.x, ctx.camera.position.z)
  const step = 1.2
  for (let a = camA - 700; a < camA + 700; a += step) {
    // Crests sit where the surf cycle reaches 0.75: solve along s.
    for (let k = 0; k < 12; k++) {
      const s0 = (k + 0.75 - surfCycle(coast, 0, a)) * coast.surfWavelength
      // The cycle's along-shore noise doesn't depend on s, so this is exact.
      const s = s0 + rng.range(-0.6, 0.6)
      if (s < 0 || s > 260) continue
      const [x, z] = shoreToWorld(coast, s, a)
      const depth = -ctx.ground(x, z)
      // Breaking happens over a band of depths: too deep and the wave is
      // still a swell, too shallow and it's spent foam.
      if (depth < 0.15 || depth > breakDepth * 1.5) continue
      const sets = surfSets(coast, s, a)
      if (sets < 0.3) continue
      const distance = ctx.distance(x, z)
      if (distance > 900 || !ctx.visible(x, 1, z, 5)) continue
      const shoal = 1 + 1.3 * (1 - Math.min(1, Math.max(0, (depth - 1) / 5)))
      const height = amplitude * shoal * sets * 1.1
      // A crown of whitewater along the crest; fewer, bigger clumps far away.
      const n = Math.round((3 + height * 6 * windy) * Math.min(1, 120 / distance + 0.3))
      for (let i = 0; i < n; i++) {
        const along = a + rng.range(-step / 2, step / 2)
        const behind = s + rng.range(-0.4, 2.2) * height
        const [px, pz] = shoreToWorld(coast, behind, along)
        const y = height * (0.5 + 0.8 * rng.float() ** 1.5)
        const size = rng.range(0.3, 0.8) * (0.6 + height * 0.4) * Math.max(1, distance / 120)
        spray.add(new Vector3(px, y, pz), size, rng.range(0.6, 1))
      }
      // Wind-blown mist off the top.
      for (let i = 0; i < Math.round(2 * windy); i++) {
        const [px, pz] = shoreToWorld(coast, s + rng.range(0, 4) * height, a + rng.range(-step, step))
        const size = rng.range(0.6, 1.6) * Math.max(1, distance / 150)
        spray.add(new Vector3(px, height * rng.range(0.8, 1.8), pz), size, rng.range(0.15, 0.35))
      }
    }
  }

  // --- Splashes on rocks at the waterline ------------------------------------
  const m = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const rotation = new Quaternion()
  const q = new Vector3()
  for (const mesh of rocks) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      m.decompose(position, rotation, scale)
      const size = Math.max(scale.x, scale.z)
      // Boulders take the waves; sea stacks offshore are too far to splash.
      if (size < 0.9 || size > 8) continue
      const ground = ctx.ground(position.x, position.z)
      // Rocks standing in the shallows take the waves.
      if (ground > 0 || ground < -2.5) continue
      if (!rng.chance(0.55) || !ctx.visible(position.x, position.y + scale.y, position.z, size * 3)) continue
      const [s, a] = worldToShore(coast, position.x, position.z)
      // Seaward face, and "up and over" toward land.
      const [fx, fz] = shoreToWorld(coast, s + size * 0.8, a)
      const face = new Vector3(fx, 0, fz)
      const [lx, lz] = shoreToWorld(coast, s - 1, a)
      const landward = new Vector3(lx - position.x, 0, lz - position.z).normalize()
      const plume = Math.min(10, (scale.y * 1.2 + amplitude * 1.8) * rng.range(0.7, 1.4) * windy)
      const count = Math.round(250 + plume * 160)
      for (let k = 0; k < count; k++) {
        // A fan of droplets thrown up and landward, densest low and central.
        const t = rng.float()
        const spread = size * (0.6 + 1.4 * t)
        q.set(rng.normal(0, spread), 0, rng.normal(0, spread))
        const y = plume * Math.sqrt(t) * rng.range(0.4, 1.1)
        const p = face.clone().add(q).addScaledVector(landward, t * size * 1.2).setY(y + Math.max(0, ground))
        const big = rng.chance(0.12)
        spray.add(p, big ? rng.range(0.4, 1.0) : rng.range(0.04, 0.2), big ? rng.range(0.2, 0.45) : rng.range(0.6, 1))
      }
      // Foam boiling around its foot.
      for (let k = 0; k < 120; k++) {
        const r = size * rng.range(0.9, 2.2)
        const ang = rng.range(0, Math.PI * 2)
        spray.add(position.clone().add(new Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r)).setY(rng.range(0, 0.35)), rng.range(0.15, 0.45), 0.9)
      }
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
