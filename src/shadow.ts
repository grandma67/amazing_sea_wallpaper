import { Matrix4, Vector2, Vector3, type DirectionalLight, type Texture } from 'three'

import type { WeatherParams } from './params'

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

// Patchy shade from clouds: follow the sun ray up to the cloud base and test
// a coverage noise there. Not the exact clouds in view, but the dappled light
// of a broken-cloud day. (Needs fbm from TERRAIN_GLSL.)
uniform vec3 cloudShadowSun;
uniform float cloudShadowCoverage;
uniform float cloudShadowStrength;
uniform vec2 cloudShadowOffset;

float cloudShadow(vec3 world) {
  if (cloudShadowStrength <= 0.0) return 1.0;
  vec3 L = cloudShadowSun;
  vec2 p = world.xz + L.xz / max(L.y, 0.12) * (1200.0 - world.y);
  float clouds = fbm(p / 1800.0 + cloudShadowOffset) * 0.75 + fbm(p / 450.0 + cloudShadowOffset * 3.0) * 0.25;
  float threshold = 1.0 - cloudShadowCoverage;
  float density = smoothstep(threshold - 0.08, threshold + 0.12, clouds);
  return 1.0 - density * cloudShadowStrength;
}
`

export function shadowUniforms(): Record<string, { value: unknown }> {
  return {
    cloudShadowSun: { value: new Vector3(0, 1, 0) },
    cloudShadowCoverage: { value: 0 },
    cloudShadowStrength: { value: 0 },
    cloudShadowOffset: { value: new Vector2() },
    sunShadowMap: { value: null as Texture | null },
    sunShadowMatrix: { value: new Matrix4() },
    sunShadowTexel: { value: new Vector2(1, 1) },
    sunShadowOn: { value: 0 }
  }
}

const CLOUD_SHADOW_STRENGTH: Record<WeatherParams['kind'], number> = {
  clear: 0,
  cirrus: 0.2,
  few: 0.8,
  scattered: 0.85,
  broken: 0.9,
  overcast: 0,
  storm: 0.9
}

export function bindCloudShadow(
  uniforms: Record<string, { value: unknown }>,
  weather: WeatherParams,
  sunDirection: Vector3
): void {
  ;(uniforms.cloudShadowSun.value as Vector3).copy(sunDirection)
  uniforms.cloudShadowCoverage.value = weather.coverage
  uniforms.cloudShadowStrength.value = sunDirection.y > 0 ? CLOUD_SHADOW_STRENGTH[weather.kind] : 0
  ;(uniforms.cloudShadowOffset.value as Vector2).set(weather.weatherOffset[0] * 97, weather.weatherOffset[1] * 97)
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
