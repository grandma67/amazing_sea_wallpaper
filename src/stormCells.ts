import { Matrix2, type Matrix4, Uniform, Vector2, Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { CLOUD_GENERA, type CloudGenus } from './cloudTypes'
import { cubeSphereUv } from './cloudArrangement'
import { dirFromAzEl, type StormParams } from './params'

// Storm cells: lightning and rain come out of a cumulonimbus, so the sky over
// each strike and rain shaft must hold one. A thunderstorm cell is ~5–10 km
// across (single-cell storms; multicells are clusters of them), its base
// 0.5–1.5 km up over the sea and its top near the tropopause; under ~10 km of
// cloud the base is dark, darkest over the rain core, where cloud-to-ground
// strikes come down (Rakov & Uman, Lightning, 2003; NOAA NSSL "Thunderstorm
// basics"). The day's weather map puts cloud wherever its noise does, so a bolt
// could hang from a gap or a thin scrap: the cells raise the Cb layer's
// weather to full inside them (clouds and their shadow), with ragged edges
// from the map itself.

export const MAX_STORM_CELLS = 8

/** A cell's centre on the ground (world x, z) and radius (m). */
export interface StormCell {
  x: number
  z: number
  radius: number
}

/** One cell over each strike (radius 3.5 km plus a bit with distance, so a
 * far bolt still sits well inside its cloud), and one over each rain shaft
 * (at least as wide as the shaft). Nearest first, capped at MAX_STORM_CELLS. */
export function stormCells(storm: StormParams | null, camera: Vector3): StormCell[] {
  if (storm == null) return []
  const at = (azimuthDeg: number, distance: number, radius: number): StormCell => {
    const [dx, , dz] = dirFromAzEl(azimuthDeg, 0)
    return { x: camera.x + dx * distance, z: camera.z + dz * distance, radius }
  }
  const cells = [
    ...storm.bolts.map(b => ({ cell: at(b.azimuthDeg, b.distance, 3500 + b.distance * 0.1), distance: b.distance })),
    ...storm.curtains.map(c => ({
      cell: at(c.azimuthDeg, c.distance, Math.max(3000, c.width * 1.2)),
      distance: c.distance
    }))
  ]
  return cells
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_STORM_CELLS)
    .map(c => c.cell)
}

/** Which cloud layer is the cumulonimbus, or -1. */
export function stormLayer(formations: CloudGenus[]): number {
  return formations.findIndex(f => CLOUD_GENERA[f].genus === 'cumulonimbus')
}

const SAMPLE_END = `    weatherExponents
  );
`
const RETURN = `
  return weather;
}`
/** Extra density in a cell's core: a storm holds several g/m³ of cloud
 * water, rain and graupel against ~0.3 g/m³ in fair cumulus, so its base is
 * far darker than the deck round it. */
const CORE_DENSITY = 2
const GLSL = /* glsl */ `
uniform vec4 stormCells[${MAX_STORM_CELLS}];
uniform mat2 stormUvToMetres;
// Full weather inside each cell, falling off over its outer half; the map's
// own value pushes the edge in and out so the cell isn't a disc.
float stormCellWeather(const vec2 uv, const float weather) {
  float cell = 0.0;
  for (int i = 0; i < ${MAX_STORM_CELLS}; i++) {
    vec4 c = stormCells[i];
    if (c.z <= 0.0) break;
    float d = length(stormUvToMetres * (uv - c.xy)) / c.z;
    cell = max(cell, 1.0 - smoothstep(0.45, 1.0, d - 0.3 * (weather - 0.5)));
  }
  return cell;
}
`

/** Patch the clouds' and their shadows' shaders so the Cb layer fills each
 * storm cell. Uv is the weather map's (before localWeatherRepeat), which
 * moves with localWeatherOffset only in the texture lookup, so the cells stay
 * put over the strikes. */
export function patchStormCells(
  clouds: CloudsEffect,
  worldToECEF: Matrix4,
  cells: StormCell[],
  layer: number
): void {
  if (cells.length === 0 || layer < 0 || layer > 3) return
  const uvAt = (x: number, z: number): Vector2 => cubeSphereUv(new Vector3(x, 0, z).applyMatrix4(worldToECEF))
  // Local metres per uv step from the uv of 1 km steps east (x) and north (−z)
  // of the first cell: the map's axes aren't quite orthogonal, so a full 2×2.
  const { x, z } = cells[0]
  const origin = uvAt(x, z)
  const east = uvAt(x + 1000, z).sub(origin).divideScalar(1000)
  const north = uvAt(x, z - 1000).sub(origin).divideScalar(1000)
  const det = east.x * north.y - north.x * east.y
  const uvToMetres = new Matrix2().set(north.y / det, -north.x / det, -east.y / det, east.x / det)
  const values = Array.from({ length: MAX_STORM_CELLS }, (_, i) => {
    const cell = cells[i]
    if (cell == null) return new Vector4(0, 0, 0, 0)
    const uv = uvAt(cell.x, cell.z)
    return new Vector4(uv.x, uv.y, cell.radius, 0)
  })
  const channel = 'xyzw'[layer]
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(SAMPLE_END).length !== 2 || source.split(RETURN).length !== 2)
      throw new Error('patchStormCells: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replace('WeatherSample sampleWeather(', `${GLSL}\nWeatherSample sampleWeather(`)
      .replace(
        SAMPLE_END,
        `${SAMPLE_END}  float stormCell = stormCellWeather(uv, localWeather.${channel});
  localWeather.${channel} = max(localWeather.${channel}, stormCell);\n`
      )
      .replace(RETURN, `\n  weather.density.${channel} *= 1.0 + ${CORE_DENSITY.toFixed(1)} * stormCell;${RETURN}`)
    material.uniforms.stormCells = new Uniform(values)
    material.uniforms.stormUvToMetres = new Uniform(uvToMetres)
    material.needsUpdate = true
  }
}
