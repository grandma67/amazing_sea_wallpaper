import { Uniform, type Vector3 } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import type { EclipseParams } from './celestial'

// A solar eclipse in takram's sky shader. The sky draws the sun disc and the
// moon separately and never lets one cover the other; here the new moon
// blocks the sun. In totality the sky goes dark but for a low glow all round
// the horizon (light scattered in from beyond the moon's shadow, which is only
// ~100–250 km wide), and the corona shines round the black moon.

const ECLIPSE_GLSL = /* glsl */ `
uniform vec3 eclipseMoon;
uniform float eclipseMoonRadius;
uniform float eclipseTotal;

float eclipseUncovered(const vec3 ray, const float fragmentAngle) {
  float angle = acos(clamp(dot(ray, eclipseMoon), -1.0, 1.0));
  return smoothstep(eclipseMoonRadius - fragmentAngle, eclipseMoonRadius + fragmentAngle, angle);
}

vec3 eclipseSky(vec3 radiance, const vec3 cameraPosition, const vec3 ray) {
  if (eclipseTotal < 0.5) return radiance;
  float el = dot(ray, normalize(cameraPosition));
  float glow = exp(-max(el, 0.0) / 0.08);
  radiance *= mix(vec3(0.0012, 0.0013, 0.0016), vec3(0.06, 0.038, 0.02), glow);

  // The corona: falling off as ~r^-4 from the limb, with streamers.
  float angle = acos(clamp(dot(ray, eclipseMoon), -1.0, 1.0));
  float t = angle / eclipseMoonRadius;
  if (t > 1.0) {
    vec3 helper = abs(eclipseMoon.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 a = normalize(cross(eclipseMoon, helper));
    vec3 b = cross(eclipseMoon, a);
    float az = atan(dot(ray, b), dot(ray, a));
    float streamers = 0.55 + 0.45 * pow(abs(sin(az * 2.0 + 0.4)), 3.0) + 0.25 * sin(az * 7.0 + 1.1) * sin(az * 3.0);
    float reach = mix(1.0, streamers, smoothstep(1.05, 2.0, t));
    float corona = pow(t, -4.0) * reach + 0.6 * exp(-(t - 1.0) * 40.0);
    radiance += GetSolarRadiance() * 2.5e-6 * corona * vec3(1.0, 0.97, 0.93);
  }
  return radiance;
}
`

/** Patch a sky material so the moon at `moonECEF` (angular radius
 * `moonRadius`) eclipses the sun. */
export function eclipseSky(material: SkyMaterial, eclipse: EclipseParams, moonECEF: Vector3, moonRadius: number): void {
  Object.assign(material.uniforms, {
    eclipseMoon: new Uniform(moonECEF.clone()),
    eclipseMoonRadius: new Uniform(moonRadius),
    eclipseTotal: new Uniform(eclipse.type === 'solar-total' ? 1 : 0)
  })
  const source = material.fragmentShader
  const patched = source
    .replace('vec3 getSkyRadiance(', `${ECLIPSE_GLSL}\nvec3 getSkyRadiance(`)
    .replace('GetSolarRadiance() * antialias', 'GetSolarRadiance() * antialias * eclipseUncovered(rayDirection, fragmentAngle)')
    .replace(/#endif \/\/ PERSPECTIVE_CAMERA(\s*)return radiance;/, '#endif // PERSPECTIVE_CAMERA$1return eclipseSky(radiance, cameraPosition, rayDirection);')
  if (!patched.includes('eclipseUncovered(rayDirection') || !patched.includes('return eclipseSky(')) {
    throw new Error('eclipseSky: the sky shader has changed; update the patch')
  }
  material.fragmentShader = patched
  material.needsUpdate = true
}
