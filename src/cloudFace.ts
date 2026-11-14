import type { ShaderMaterial } from 'three'

// params.debug.cloudFace: where each ray first meets cloud in takram's march
// (the cloud's face, what a light inside or under the cloud is evaluated at:
// lightning.ts, nightGlow.ts town light). The clouds' output is replaced by
// numbers a probe reads raw: R = the face's height (in 10 m), G = its
// distance from the camera (km), B = 100 where a ray met cloud (0: clear
// sky). Large on purpose: aerial perspective (which composites the clouds,
// so it can't be switched off) adds ~0.2 of haze. The exposure is pinned at
// 0.05 (scene.ts) so the grade's clamp (40 exposed) passes up to 800 raw. Found
// building CLOUD_ILLUMINATION: takram's clouds are optically thin over km,
// so "where the cloud is" by eye and the first sample can be far apart, and
// a bolt's base can have no cloud at all (2016-06-21).

const MARCH_START = '  float transmittanceSum = 0.0;\n'
const SKY_LINE = 'radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;'
const OUTPUT = '  outputColor = color;\n'

/** Replace the clouds' output with the face's height (10 m) and distance (km). */
export function patchCloudFace(material: ShaderMaterial): void {
  const source = material.fragmentShader
  if (source.split(MARCH_START).length !== 2 || source.split(SKY_LINE).length !== 2 || source.split(OUTPUT).length !== 2) {
    throw new Error('patchCloudFace: the clouds shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec4 marchClouds(', '// debug.cloudFace (cloudFace.ts)\nvec3 cloudFacePosition;\nfloat cloudFaceDistance;\nbool cloudFaceHit = false;\nvec4 marchClouds(')
    .replace(MARCH_START, `${MARCH_START}  cloudFaceHit = false;\n`)
    .replace(
      SKY_LINE,
      `${SKY_LINE}
      if (!cloudFaceHit) {
        cloudFacePosition = (ecefToWorldMatrix * vec4(position - altitudeCorrection, 1.0)).xyz;
        cloudFaceDistance = rayDistance + rayNearFar.x;
        cloudFaceHit = true;
      }`
    )
    .replace(OUTPUT, '  outputColor = cloudFaceHit ? vec4(cloudFacePosition.y / 10.0, cloudFaceDistance / 1000.0, 100.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);\n')
  material.needsUpdate = true
}
