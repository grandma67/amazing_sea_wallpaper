import { Matrix4, Vector2, type DirectionalLight, type Texture } from 'three'

// Lets the custom terrain and ocean shaders receive the sun's shadow map,
// which three.js renders for the standard-material props (rocks, plants...).

export const SHADOW_GLSL = /* glsl */ `
uniform sampler2DShadow sunShadowMap;
uniform mat4 sunShadowMatrix;
uniform vec2 sunShadowTexel;
uniform float sunShadowOn;

float sunShadow(vec3 world) {
  if (sunShadowOn < 0.5) return 1.0;
  vec4 c = sunShadowMatrix * vec4(world, 1.0);
  c.xyz /= c.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      sum += texture(sunShadowMap, vec3(c.xy + vec2(float(i), float(j)) * sunShadowTexel * 1.2, c.z - 0.0004));
    }
  }
  return sum / 9.0;
}
`

export function shadowUniforms(): Record<string, { value: unknown }> {
  return {
    sunShadowMap: { value: null as Texture | null },
    sunShadowMatrix: { value: new Matrix4() },
    sunShadowTexel: { value: new Vector2(1, 1) },
    sunShadowOn: { value: 0 }
  }
}

/** Point the shader uniforms at the light's (already rendered) shadow map. */
export function bindShadow(
  uniforms: Record<string, { value: unknown }>,
  light: DirectionalLight
): void {
  const map = light.shadow.map
  if (map?.depthTexture == null) return
  uniforms.sunShadowMap.value = map.depthTexture
  ;(uniforms.sunShadowMatrix.value as Matrix4).copy(light.shadow.matrix)
  ;(uniforms.sunShadowTexel.value as Vector2).set(1 / map.width, 1 / map.height)
  uniforms.sunShadowOn.value = 1
}
