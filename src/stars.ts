import { StarsMaterial, type StarsMaterialParameters } from '@takram/three-atmosphere'
import { AdditiveBlending, Uniform } from 'three'

import { PSF } from './starLight'

// Photometric stars (NIGHT_SKY phase 2) on takram's StarsMaterial: each star
// carries its real light (`starScale × 10^(−0.4 m)`, starLight.ts) spread
// over the lens's point spread, divided by the pixel's solid angle, dimmed
// by the air's transmittance and added to the sky already drawn. Additive, so
// whatever the sky shader shows (eclipse darkening, later airglow and the
// Milky Way) stays under the stars.

const f = (x: number): string => x.toFixed(4)

const VERTEX = /* glsl */ `
precision highp float;
precision highp sampler3D;

#define saturate(x) clamp(x, 0.0, 1.0)

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 matrixWorld;
uniform vec3 cameraPosition;
uniform float cameraFar;
uniform mat4 worldToECEFMatrix;
uniform vec3 altitudeCorrection;
uniform vec2 magnitudeRange;
uniform float starScale;
uniform float pixelHeight;
uniform float psfScale;

layout(location = 0) in vec3 position;
layout(location = 1) in float magnitude;
layout(location = 2) in vec3 color;

out vec3 vCameraPosition;
out vec3 vRayDirection;
out vec3 vEllipsoidCenter;
out vec3 vColor;
out float vSize;

void main() {
  float m = mix(magnitudeRange.x, magnitudeRange.y, magnitude);
  vec3 worldDirection = normalize(matrixWorld * vec4(position, 1.0)).xyz;
  vec3 cameraPositionECEF = (worldToECEFMatrix * vec4(cameraPosition, 1.0)).xyz;
  vCameraPosition = (cameraPositionECEF + altitudeCorrection) * METER_TO_LENGTH_UNIT;
  vRayDirection = (worldToECEFMatrix * vec4(worldDirection, 0.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + worldDirection * cameraFar, 1.0);

  // A pixel's solid angle: (2 / (P11 · height))² on the axis, × cos³ off it.
  vec3 viewDirection = normalize(mat3(viewMatrix) * worldDirection);
  float cosTheta = max(-viewDirection.z, 0.05);
  float pixelAngle = 2.0 / (projectionMatrix[1][1] * pixelHeight);
  float pixelSr = pixelAngle * pixelAngle * cosTheta * cosTheta * cosTheta;
  // The catalogue's colour at unit luminance: V magnitudes are luminance.
  vec3 tint = color / max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  vColor = tint * starScale * pow(10.0, -0.4 * m) / pixelSr;
  vSize = (m < ${f(PSF.haloMag)} ? ${f(PSF.haloSize)} : ${f(PSF.coreSize)}) * psfScale;
  gl_PointSize = vSize;
}
`

const PSF_GLSL = /* glsl */ `
uniform float psfScale;
in float vSize;

// Mirrors psfWeight in starLight.ts.
float starPsf() {
  vec2 d = (gl_PointCoord - 0.5) * vSize;
  float r2 = dot(d, d);
  float core = ${f(PSF.coreSigma)} * psfScale;
  float wide = ${f(PSF.haloSigma)} * psfScale;
  float h = vSize > ${f(PSF.coreSize + 0.5)} * psfScale ? ${f(PSF.haloShare)} : 0.0;
  return (1.0 - h) * exp(-r2 / (2.0 * core * core)) / (6.2831853 * core * core) +
    h * exp(-r2 / (2.0 * wide * wide)) / (6.2831853 * wide * wide);
}
`

/** Stars for a camera whose image is `pixelHeight` pixels tall: the scene
 * camera (the point spread scales with the image) or a cube-map face. */
export function createStarsMaterial(
  textures: StarsMaterialParameters,
  starScale: number,
  pixelHeight: number,
  psfScale: number
): StarsMaterial {
  const material = new StarsMaterial({ ...textures })
  material.vertexShader = VERTEX
  const before = 'radiance += transmittance * vColor;\n  outputColor = vec4(radiance, 1.0);'
  if (!material.fragmentShader.includes(before) || !material.fragmentShader.includes('in vec3 vColor;'))
    throw new Error('stars.ts: takram stars.frag changed; update the patch')
  material.fragmentShader = material.fragmentShader
    .replace('in vec3 vColor;', `in vec3 vColor;\n${PSF_GLSL}`)
    .replace(before, 'outputColor = vec4(transmittance * vColor * starPsf(), 1.0);')
  material.uniforms.starScale = new Uniform(starScale)
  material.uniforms.pixelHeight = new Uniform(pixelHeight)
  material.uniforms.psfScale = new Uniform(psfScale)
  material.blending = AdditiveBlending
  material.depthWrite = false
  return material
}
