import { MeshDepthMaterial, Vector3, type Material, type WebGLProgramParametersWithUniforms } from 'three'

import type { SceneParams } from '../params'

// Plants bend with the day's wind. Done in the vertex shader so every instance
// bends toward the same world direction whatever its own rotation: a quadratic
// sweep with height (stiff base, flexible top), varied by patchy gusts.

/** Wind direction in world space (where it blows toward). */
export function windDirection(params: SceneParams): Vector3 {
  const az = (params.ocean.windHeadingDeg * Math.PI) / 180
  return new Vector3(Math.sin(az), 0, -Math.cos(az))
}

/** 0 in a calm, 1 in a strong breeze (~14 m/s); drag grows with speed². */
export function windStrength(params: SceneParams): number {
  const t = Math.min(1.3, Math.max(0, (params.ocean.windSpeed - 1.5) / 12.5))
  return t * t
}

export interface Bend {
  /** Nominal height of the geometry (m, before instance scale). */
  height: number
  /** Tip displacement as a fraction of the height at full strength. */
  flex: number
}

function patch(shader: WebGLProgramParametersWithUniforms, direction: Vector3, bend: Bend, strength: number): void {
  shader.uniforms.windDirection = { value: direction }
  shader.uniforms.windHeight = { value: bend.height }
  shader.uniforms.windBend = { value: bend.flex * strength }
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      /* glsl */ `#include <common>
uniform vec3 windDirection;
uniform float windHeight;
uniform float windBend;`
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  // World wind into this instance's frame: transpose(R S) = S Rᵀ, so the
  // rotation is undone and only the direction is kept.
  vec3 local = transpose(mat3(instanceMatrix)) * windDirection;
  local.y = 0.0;
  local /= max(length(local), 1e-4);
  // Gusts: broad patches of stronger and weaker wind over the land.
  vec2 at = instanceMatrix[3].xz;
  float gust = 0.7 + 0.3 * sin(dot(at, vec2(0.021, 0.013)) + 1.7)
    + 0.25 * sin(dot(at, vec2(-0.047, 0.061)) + 4.1);
  float h = max(transformed.y, 0.0) / windHeight;
  float sweep = windBend * gust * h * h * windHeight;
  transformed.xz += local.xz * sweep;
  // Bending sweeps the top down a little rather than stretching it.
  transformed.y -= 0.5 * sweep * sweep / max(windHeight * max(h, 0.2), 0.1);
}
#endif`
    )
}

/** A copy of `material` (and a matching shadow depth material) that bends. */
export function windMaterials(
  material: Material,
  params: SceneParams,
  bend: Bend
): { material: Material; depth: MeshDepthMaterial } {
  const direction = windDirection(params)
  const strength = windStrength(params)
  const bent = material.clone()
  bent.onBeforeCompile = shader => patch(shader, direction, bend, strength)
  // Same settings as three's own shadow depth material, plus the bend.
  const depth = new MeshDepthMaterial()
  depth.onBeforeCompile = shader => patch(shader, direction, bend, strength)
  return { material: bent, depth }
}
