import { Matrix4, Uniform, Vector2, Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

// How the cloud cells are arranged (WMO varieties), by stretching takram's
// weather map round the scene:
// - radiatus (cloud streets): cumulus or stratocumulus in rows along the
//   wind, running to a vanishing point. Common in the trades and in cold air
//   over warm sea.
// - undulatus (wave bands): ripples across the wind in altocumulus,
//   cirrocumulus and stratocumulus, the "mackerel sky".
// The weather map is sampled at a point on a cube-sphere (getGlobeUv), so a
// direction on the ground is some direction in the map's uv; the patch
// replaces the map's uv by an affine transform of it that squeezes it along
// (streets) or across (bands) the wind, centred on the scene.

export type CloudArrangement = 'streets' | 'bands'

/** takram's getCubeSphereUv, on the CPU. */
export function cubeSphereUv(position: Vector3): Vector2 {
  const n = position.clone().normalize()
  const f = new Vector3(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))
  const max = Math.max(f.x, f.y, f.z)
  const c = n.clone().divideScalar(max)
  let m: [number, number]
  if (f.y > f.x && f.y > f.z) m = c.y > 0 ? [-n.x, n.z] : [n.x, n.z]
  else if (f.x > f.y && f.x > f.z) m = c.x > 0 ? [n.y, n.z] : [-n.y, n.z]
  else m = c.z > 0 ? [n.x, n.y] : [n.x, -n.y]
  const [mx2, my2] = [m[0] * m[0], m[1] * m[1]]
  const q = -2 * mx2 + 2 * my2 - 3
  const ux = Math.sqrt(Math.max(0, 1.5 + mx2 - my2 - 0.5 * Math.sqrt(Math.max(0, -24 * mx2 + q * q)))) * (m[0] > 0 ? 1 : -1)
  const uy = Math.sqrt(6 / (3 - ux * ux)) * m[1]
  return new Vector2(ux * 0.5 + 0.5, uy * 0.5 + 0.5)
}

/** How much the cells stretch: along the wind for streets (and a bit
 * narrower across), across it for bands (and more cells along the band). */
export const STRETCH: Record<CloudArrangement, { along: number; across: number }> = {
  streets: { along: 1 / 3, across: 1.6 },
  bands: { along: 1.6, across: 1 / 3 }
}

/**
 * The 2×2 matrix (column-major) that, applied to the weather map's
 * coordinate round the scene, scales a step along `windWorld` by `along` and
 * one across it by `across`. Solved in the map's own (not quite orthogonal)
 * axes, so the stretch follows the wind exactly.
 */
export function arrangementMatrix(
  worldToECEF: Matrix4,
  windWorld: Vector3,
  repeat: Vector2,
  stretch: { along: number; across: number }
): { matrix: Vector4; origin: Vector2 } {
  const origin = new Vector3().applyMatrix4(worldToECEF)
  const toMap = (direction: Vector3): Vector2 => {
    const step = 1000
    const p = origin.clone().add(direction.clone().transformDirection(worldToECEF).multiplyScalar(step))
    return cubeSphereUv(p).sub(cubeSphereUv(origin)).multiply(repeat).divideScalar(step)
  }
  const across = new Vector3(0, 1, 0).cross(windWorld).normalize()
  const d = toMap(windWorld.clone().setY(0).normalize())
  const c = toMap(across)
  // A·[d c] = [d·along c·across]  →  A = [d·along c·across]·[d c]⁻¹
  const det = d.x * c.y - c.x * d.y
  const inv = [c.y / det, -d.y / det, -c.x / det, d.x / det] // column-major [a b; c d]⁻¹
  const t = [d.x * stretch.along, d.y * stretch.along, c.x * stretch.across, c.y * stretch.across]
  const mul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3]
  ]
  const m = mul(t, inv)
  return { matrix: new Vector4(m[0], m[1], m[2], m[3]), origin: cubeSphereUv(origin).multiply(repeat) }
}

const SAMPLE = 'uv * localWeatherRepeat + localWeatherOffset,'
const PATCHED = `arrangeWeather(uv * localWeatherRepeat) + localWeatherOffset,`
const GLSL = /* glsl */ `
uniform vec4 weatherArrangement;
uniform vec2 weatherArrangementOrigin;
vec2 arrangeWeather(const vec2 t) {
  return weatherArrangementOrigin + mat2(weatherArrangement.xy, weatherArrangement.zw) * (t - weatherArrangementOrigin);
}
`

/** Patch the clouds' and their shadows' shaders to sample the weather map
 * arranged into streets or bands. */
export function arrangeClouds(
  clouds: CloudsEffect,
  worldToECEF: Matrix4,
  windWorld: Vector3,
  arrangement: CloudArrangement
): void {
  const { matrix, origin } = arrangementMatrix(worldToECEF, windWorld, clouds.localWeatherRepeat, STRETCH[arrangement])
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (!source.includes(SAMPLE)) throw new Error('arrangeClouds: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replace('WeatherSample sampleWeather(', `${GLSL}\nWeatherSample sampleWeather(`)
      .replace(SAMPLE, PATCHED)
    material.uniforms.weatherArrangement = new Uniform(matrix)
    material.uniforms.weatherArrangementOrigin = new Uniform(origin)
    material.needsUpdate = true
  }
}
