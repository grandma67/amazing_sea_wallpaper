import {
  BufferAttribute,
  Color,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry
} from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

import type { Biome, RGB } from '../biome'
import type { Random } from '../random'
import { shoreToWorld } from '../terrain'
import type { PropContext } from './context'
import { fbm3 } from './noise'

// Procedural rocks: a noisy sphere sliced by a few random planes, which gives
// the flat fractured faces of real boulders, with crevices darkened in the
// vertex colours. Placed in clusters along the waterline, scattered on the
// beach, and sometimes as towering sea stacks offshore.

const VARIANTS = 6
const STACK_VARIANTS = 2

/** Ridged noise in [0, 1]: sharp creases where fbm crosses its midpoint. */
function ridged(x: number, y: number, z: number, seed: number): number {
  return 1 - Math.abs(fbm3(x, y, z, seed) * 2 - 1)
}

function rockGeometry(rng: Random, stack: boolean): BufferGeometry {
  // PolyhedronGeometry subdivides each face (detail + 1)² times: ~19k faces.
  const geometry = mergeVertices(new IcosahedronGeometry(1, 30))
  const position = geometry.attributes.position as BufferAttribute
  const seed = rng.int(0, 1_000_000)

  // Fracture planes. Sea stacks get near-vertical cliff faces and a tilted
  // top; boulders get planes from any direction.
  const planes = Array.from({ length: stack ? rng.int(5, 9) : rng.int(4, 9) }, () => {
    const n = stack
      ? new Vector3(rng.normal(), rng.normal() * 0.15, rng.normal()).normalize()
      : new Vector3(rng.normal(), rng.normal() * 0.7, rng.normal()).normalize()
    return { n, d: stack ? rng.range(0.55, 0.85) : rng.range(0.4, 0.8) }
  })
  if (stack) planes.push({ n: new Vector3(rng.normal() * 0.3, 1, rng.normal() * 0.3).normalize(), d: rng.range(0.6, 0.85) })
  // Flat-ish bottom so rocks sit on the ground.
  planes.push({ n: new Vector3(0, -1, 0), d: rng.range(0.3, 0.6) })

  const v = new Vector3()
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const base = 0.8 + 0.4 * fbm3(v.x * 1.2, v.y * 1.2, v.z * 1.2, seed)
    const creases = 0.16 * (ridged(v.x * 3.5, v.y * 3.5, v.z * 3.5, seed + 11) - 0.6)
    const grain = 0.04 * (fbm3(v.x * 14, v.y * 14, v.z * 14, seed + 7) - 0.5)
    // Horizontal strata ledges on sea stacks.
    const strata = stack ? 0.035 * Math.sin(v.y * 22 + 3 * fbm3(v.x * 2, v.y * 2, v.z * 2, seed + 9)) : 0
    v.multiplyScalar(base + creases + grain + strata)
    for (const { n, d } of planes) {
      const over = v.dot(n) - d
      if (over > 0) v.addScaledVector(n, -over * 0.95)
    }
    position.setXYZ(i, v.x, v.y, v.z)

    // Crevices are darker; add mineral speckle and banding.
    const shade = 0.6 + 2.2 * creases + 0.25 * fbm3(v.x * 9, v.y * 9, v.z * 9, seed + 3)
    const band = 0.9 + 0.1 * Math.sin(v.y * 7 + fbm3(v.x * 2, v.y * 2, v.z * 2, seed + 5) * 6)
    const c = Math.max(0.25, Math.min(1.25, shade * band))
    colors[i * 3] = c
    colors[i * 3 + 1] = c
    colors[i * 3 + 2] = c
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Growth on the rocks: moss on top, lichen spots, algae in the splash zone. */
export interface RockGrowth {
  moss: number
  mossColor: RGB
  lichen: number
  lichenColor: RGB
  algae: number
  algaeColor: RGB
}

const GROWTH: Record<Biome['name'], { chance: number; growth: RockGrowth }> = {
  tropical: {
    chance: 0.7,
    growth: { moss: 0.3, mossColor: [0.06, 0.12, 0.03], lichen: 0.2, lichenColor: [0.45, 0.42, 0.35], algae: 0.9, algaeColor: [0.05, 0.1, 0.03] }
  },
  mediterranean: {
    chance: 0.75,
    growth: { moss: 0.15, mossColor: [0.1, 0.12, 0.05], lichen: 0.8, lichenColor: [0.55, 0.38, 0.08], algae: 0.7, algaeColor: [0.07, 0.09, 0.03] }
  },
  nordic: {
    chance: 0.9,
    growth: { moss: 0.9, mossColor: [0.07, 0.11, 0.03], lichen: 0.6, lichenColor: [0.5, 0.5, 0.42], algae: 1, algaeColor: [0.08, 0.07, 0.02] }
  },
  volcanic: {
    chance: 0.8,
    growth: { moss: 0.8, mossColor: [0.1, 0.16, 0.04], lichen: 0.3, lichenColor: [0.45, 0.45, 0.4], algae: 0.6, algaeColor: [0.05, 0.08, 0.03] }
  },
  desert: {
    chance: 0.2,
    growth: { moss: 0, mossColor: [0, 0, 0], lichen: 0.4, lichenColor: [0.5, 0.32, 0.1], algae: 0.5, algaeColor: [0.08, 0.08, 0.03] }
  }
}

function rockMaterial(color: RGB, runup: number, growth: RockGrowth | null): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: new Color(...color),
    vertexColors: true,
    roughness: 0.88,
    metalness: 0
  })
  const g = growth ?? { moss: 0, mossColor: [0, 0, 0], lichen: 0, lichenColor: [0, 0, 0], algae: 0, algaeColor: [0, 0, 0] }
  // Rocks are darker and glossier where waves wash over them, slick with
  // algae just above and below the water, and mossy and lichen-spotted on
  // top where it stays dry.
  material.onBeforeCompile = shader => {
    shader.uniforms.wetLine = { value: runup * 1.3 }
    shader.uniforms.moss = { value: g.moss }
    shader.uniforms.mossColor = { value: new Color(...g.mossColor) }
    shader.uniforms.lichen = { value: g.lichen }
    shader.uniforms.lichenColor = { value: new Color(...g.lichenColor) }
    shader.uniforms.algae = { value: g.algae }
    shader.uniforms.algaeColor = { value: new Color(...g.algaeColor) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockWorld;\nvarying vec3 vRockNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mat4 rockModel = modelMatrix;
        #ifdef USE_INSTANCING
          rockModel = modelMatrix * instanceMatrix;
        #endif
        vRockWorld = (rockModel * vec4(transformed, 1.0)).xyz;
        vRockNormal = normalize(mat3(rockModel) * objectNormal);`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRockWorld;
        varying vec3 vRockNormal;
        uniform float wetLine;
        uniform float moss;
        uniform vec3 mossColor;
        uniform float lichen;
        uniform vec3 lichenColor;
        uniform float algae;
        uniform vec3 algaeColor;
        float rockHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float rockNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(rockHash(i), rockHash(i + vec3(1, 0, 0)), f.x), mix(rockHash(i + vec3(0, 1, 0)), rockHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(rockHash(i + vec3(0, 0, 1)), rockHash(i + vec3(1, 0, 1)), f.x), mix(rockHash(i + vec3(0, 1, 1)), rockHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rockWet = 1.0 - smoothstep(wetLine * 0.6, wetLine, vRockWorld.y);
        diffuseColor.rgb *= mix(1.0, 0.5, rockWet);
        vec3 q = vRockWorld;
        float patches = rockNoise(q * 0.9) * 0.65 + rockNoise(q * 3.7) * 0.35;
        // Algae: a slick band around the water line.
        float algaeBand = (1.0 - smoothstep(wetLine * 0.7, wetLine * 1.4, q.y)) * smoothstep(0.25, 0.5, patches);
        diffuseColor.rgb = mix(diffuseColor.rgb, algaeColor * (0.7 + 0.6 * rockNoise(q * 9.0)), algae * algaeBand);
        // Moss on upward faces above the splash zone.
        float dry = smoothstep(wetLine * 1.3, wetLine * 2.2, q.y);
        float mossMask = smoothstep(0.35, 0.8, vRockNormal.y) * smoothstep(0.42, 0.62, patches) * dry;
        diffuseColor.rgb = mix(diffuseColor.rgb, mossColor * (0.6 + 0.8 * rockNoise(q * 11.0)), moss * mossMask);
        // Crusty lichen spots on dry stone.
        float spots = smoothstep(0.72, 0.78, rockNoise(q * 5.5)) * dry;
        diffuseColor.rgb = mix(diffuseColor.rgb, lichenColor, lichen * spots * 0.8);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.25, rockWet);`
      )
  }
  return material
}

interface RockInstance {
  /** 0..VARIANTS-1 boulders, VARIANTS.. sea stacks. */
  variant: number
  position: Vector3
  scale: Vector3
  rotation: Euler
}

export function createRocks(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const { coast, biome } = params
  if (coast.type !== 'beach') return []
  const rng = ctx.rng('rocks')
  const hasRocks = rng.chance(biome.rockChance)
  const hasStacks = rng.chance(biome.seaStackChance)
  if (!hasRocks && !hasStacks) return []

  const instances: RockInstance[] = []
  const camera = ctx.camera.position

  const place = (
    s: number,
    a: number,
    size: number,
    aspect: Vector3,
    sink: number,
    stack = false
  ): void => {
    const [x, z] = shoreToWorld(coast, s, a)
    const ground = ctx.ground(x, z)
    const scale = aspect.clone().multiplyScalar(size)
    const y = ground - scale.y * sink
    if (!ctx.visible(x, y + scale.y, z, Math.max(scale.x, scale.y, scale.z) * 1.2)) return
    // Keep the camera's own spot clear.
    if (Math.hypot(x - camera.x, z - camera.z) < Math.max(scale.x, scale.z) * 1.3 + 2) return
    instances.push({
      variant: stack ? VARIANTS + rng.int(0, STACK_VARIANTS - 1) : rng.int(0, VARIANTS - 1),
      position: new Vector3(x, y, z),
      scale,
      rotation: new Euler(rng.normal(0, 0.12), rng.range(0, Math.PI * 2), rng.normal(0, 0.12))
    })
  }

  const [camS, camA] = [-coast.distanceToWater, 0]
  if (hasRocks) {
    // Clusters along the waterline, from the surf zone up the beach.
    const clusters = rng.int(3, 9)
    for (let c = 0; c < clusters; c++) {
      const ca = camA + rng.normal(0, 260)
      const cs = rng.range(-coast.beachWidth * 0.5, 25)
      const count = rng.int(4, 22)
      const spread = rng.range(4, 18)
      for (let i = 0; i < count; i++) {
        // Power law: many small stones, a few big boulders.
        const size = 0.25 + 3.2 * rng.float() ** 3.2 * (i === 0 ? 1.6 : 1)
        const aspect = new Vector3(rng.range(0.8, 1.4), rng.range(0.5, 0.9), rng.range(0.8, 1.4))
        place(cs + rng.normal(0, spread * 0.5), ca + rng.normal(0, spread), size, aspect, 0.3)
      }
    }
    // Scattered pebbles and stones on the beach near the camera.
    for (let i = 0; i < 120; i++) {
      const size = 0.08 + 0.5 * rng.float() ** 4
      const aspect = new Vector3(rng.range(0.8, 1.3), rng.range(0.4, 0.8), rng.range(0.8, 1.3))
      place(camS + rng.range(-25, coast.distanceToWater + 6), camA + rng.normal(0, 45), size, aspect, 0.35)
    }
  }

  if (hasStacks) {
    // Sea stacks: tall rock towers rising from the sea. Try positions until a
    // few land in view.
    let placed = 0
    const target = rng.int(1, 4)
    for (let tries = 0; tries < 60 && placed < target; tries++) {
      const s = rng.range(60, 520)
      const a = camA + rng.normal(0, 500)
      const size = rng.range(7, 22)
      const aspect = new Vector3(rng.range(0.9, 1.5), rng.range(1.1, 2.0), rng.range(0.9, 1.5))
      const before = instances.length
      place(s, a, size, aspect, 0.25, true)
      if (instances.length > before) {
        placed++
        // Smaller companions around the stack.
        for (let k = 0; k < rng.int(1, 5); k++) {
          place(
            s + rng.normal(0, size * 1.2),
            a + rng.normal(0, size * 1.5),
            size * rng.range(0.2, 0.6),
            new Vector3(rng.range(0.8, 1.3), rng.range(0.7, 1.6), rng.range(0.8, 1.3)),
            0.3
          )
        }
      }
    }
  }

  if (instances.length === 0) return []

  const color = rng.pick(biome.rockColors)
  const growthSpec = GROWTH[biome.name]
  const material = rockMaterial(color, coast.runup, rng.chance(growthSpec.chance) ? growthSpec.growth : null)
  const meshes: InstancedMesh[] = []
  const m = new Matrix4()
  const q = new Quaternion()
  for (let variant = 0; variant < VARIANTS + STACK_VARIANTS; variant++) {
    const mine = instances.filter(r => r.variant === variant)
    if (mine.length === 0) continue
    const mesh = new InstancedMesh(rockGeometry(rng, variant >= VARIANTS), material, mine.length)
    mine.forEach((r, i) => {
      q.setFromEuler(r.rotation)
      mesh.setMatrixAt(i, m.compose(r.position, q, r.scale))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    meshes.push(mesh)
  }
  return meshes
}
