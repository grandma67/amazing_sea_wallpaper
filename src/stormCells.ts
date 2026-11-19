import { Uniform, Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { CLOUD_GENERA, type CloudGenus } from './cloudTypes'
import { boltCell } from './lightning'
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

/** A cell's centre on the ground (world x, z) and radius (m); `skyShade`:
 * the share of the sky light the cell takes from the cloud under and in it
 * (default 1 − STORM_SKY_LIGHT; 0 with passes.stormShade off). */
export interface StormCell {
  x: number
  z: number
  radius: number
  skyShade?: number
}

/** Sky light left under a storm cell, as a share of the deck round it
 * (estimate): two-stream diffuse transmittance T ≈ 1 / (1 + 0.75 τ (1 − g)),
 * g ≈ 0.85, gives ~0.3 for an altostratus or nimbostratus deck (τ 20–30) and
 * ~0.05 for a cumulonimbus (τ 100–200): a Cb base is ~0.15–0.3× the deck.
 * takram lights a sample by its height in its own layer, not by the cloud
 * above it, so without this the cell over a bolt was as bright as the deck
 * (2016-06-21: 1 000 vs 960–1 040 cd/m²) and the bolt hung from a uniform
 * grey ceiling (tasks.md D30). */
export const STORM_SKY_LIGHT = 0.25

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
    // Over each bolt, between its strike and where its flash started (lightning.ts).
    ...storm.bolts.map((b, i) => ({ cell: boltCell(b, storm.origins?.[i], camera), distance: b.distance })),
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

/** Where the weather texture has been read in takram's sampleWeather (shelfCloud.ts patches here too). */
export const SAMPLE_END = `    weatherExponents
  );
`
/** sampleWeather's return. */
export const RETURN = `
  return weather;
}`
/** Extra density in a cell's core: a storm holds several g/m³ of cloud
 * water, rain and graupel against ~0.3 g/m³ in fair cumulus, so its base is
 * far darker than the deck round it. */
const CORE_DENSITY = 2
const GLSL = /* glsl */ `
uniform vec4 stormCells[${MAX_STORM_CELLS}]; // world x, z (m), radius (m), sky shade
// The sample's ECEF position, set where takram reads its uv (CAPTURE): the
// cells are found in world metres from it, as the shelf finds its frame
// (cloudShapes.ts), not through the weather map's uv, which put them
// kilometres off the strikes (2016-06-21, tasks.md D30).
vec3 stormPosition = vec3(0.0);
vec2 stormWorldXZ(const vec3 ecef) {
  return (ecefToWorldMatrix * vec4(ecef - altitudeCorrection, 1.0)).xz;
}
// Full weather inside each cell, falling off over its outer half; the map's
// own value pushes the edge in and out so the cell isn't a disc.
float stormCellWeather(const vec2 xz, const float weather) {
  float cell = 0.0;
  for (int i = 0; i < ${MAX_STORM_CELLS}; i++) {
    vec4 c = stormCells[i];
    if (c.z <= 0.0) break;
    float d = length(xz - c.xy) / c.z;
    cell = max(cell, 1.0 - smoothstep(0.45, 1.0, d - 0.3 * (weather - 0.5)));
  }
  return cell;
}
// The share of the sky light the cells take at a point (their w: 0 with
// passes.stormShade off), over the same footprint, without the ragged edge.
float stormSkyShade(const vec2 xz) {
  float shade = 0.0;
  for (int i = 0; i < ${MAX_STORM_CELLS}; i++) {
    vec4 c = stormCells[i];
    if (c.z <= 0.0) break;
    float d = length(xz - c.xy) / c.z;
    shade = max(shade, c.w * (1.0 - smoothstep(0.45, 1.0, d)));
  }
  return shade;
}
`
/** Where every takram sampleWeather call gets its uv, with \`position\`
 * (ECEF) in scope (cloudShapes.ts CAPTURE; not imported: it imports this). */
const CAPTURE = 'vec2 uv = getGlobeUv(position);'
/** takram's marchClouds adds a sample's sky light here (cloudFace.ts,
 * lightning.ts and nightGlow.ts patch after it too). */
const SKY_LINE = 'radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;'

/** Patch the clouds' and their shadows' shaders so the Cb layer fills each
 * storm cell, found by the sample's world position. */
export function patchStormCells(clouds: CloudsEffect, cells: StormCell[], layer: number): void {
  if (cells.length === 0 || layer < 0 || layer > 3) return
  const values = Array.from({ length: MAX_STORM_CELLS }, (_, i) => {
    const cell = cells[i]
    if (cell == null) return new Vector4(0, 0, 0, 0)
    return new Vector4(cell.x, cell.z, cell.radius, cell.skyShade ?? 1 - STORM_SKY_LIGHT)
  })
  const channel = 'xyzw'[layer]
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(SAMPLE_END).length !== 2 || source.split(RETURN).length !== 2 || !source.includes(CAPTURE))
      throw new Error('patchStormCells: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replaceAll(CAPTURE, `${CAPTURE}\n    stormPosition = position;`)
      .replace('WeatherSample sampleWeather(', `${GLSL}\nWeatherSample sampleWeather(`)
      .replace(
        SAMPLE_END,
        `${SAMPLE_END}  float stormCell = stormCellWeather(stormWorldXZ(stormPosition), localWeather.${channel});
  localWeather.${channel} = max(localWeather.${channel}, stormCell);\n`
      )
      .replace(RETURN, `\n  weather.density.${channel} *= 1.0 + ${CORE_DENSITY.toFixed(1)} * stormCell;${RETURN}`)
    if (material === clouds.cloudsPass.currentMaterial) {
      if (material.fragmentShader.split(SKY_LINE).length !== 2) throw new Error('patchStormCells: the clouds shader has changed; update the patch')
      // Under and in a storm cell the deep cloud above takes most of the sky
      // light (STORM_SKY_LIGHT): its base is dark.
      material.fragmentShader = material.fragmentShader.replace(
        SKY_LINE,
        `${SKY_LINE}\n      radiance -= skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale * stormSkyShade(stormWorldXZ(position));`
      )
    }
    material.uniforms.stormCells = new Uniform(values)
    material.needsUpdate = true
  }
}
