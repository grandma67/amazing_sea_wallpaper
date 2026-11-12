import { fbm, smoothstep } from './cellNoise'
import type { CoastParams } from './params'
import { HEATH_MASK_EDGE, HEATH_MASK_TERRAIN } from './phenology'
import { terrainNormal, worldToShore } from './terrain'

// A CPU mirror of the terrain shader's ground cover (terrain.ts, "Vegetation
// behind the beach"): where the turf is and how dense, and the heath mask on
// top of it. For props that stand on the turf (props/fungi.ts). Keep in step
// with the shader: test/groundCover.test.ts checks the terms it shares.

/** How dense the ground cover is at (x, z), 0..1 of the biome's amount (the
 * shader's `cover / groundCoverAmount`): none on the beach and dunes' front,
 * thickening inland, patchy, thin on slopes. */
export function groundCoverAt(coast: CoastParams, x: number, z: number): number {
  const [s] = worldToShore(coast, x, z)
  const inland = -s
  const rock = coast.rock != null
  const marsh = coast.marsh ?? { start: -1e5, width: 0 }
  const start = rock ? coast.rock!.backWidth + 1 : Math.max(coast.beachWidth * 0.75 + coast.duneWidth * 0.3, marsh.start + Math.max(marsh.width, 1) - 10)
  let cover = smoothstep(start, start + (rock ? 8 : coast.duneWidth + 30), inland)
  if (cover <= 0) return 0
  const [qx, qz] = [x + coast.noiseOffset[0], z + coast.noiseOffset[1]]
  cover *= smoothstep(0.25, 0.65, fbm(qx / 25, qz / 25) * 0.6 + fbm(qx / 4, qz / 4) * 0.4 + cover * 0.25)
  if (cover <= 0) return 0
  return cover * smoothstep(0.75, 0.9, terrainNormal(coast, x, z, 0.5)[1])
}

/** The heath mask's weight at (x, z) where a day has heath (terrain.ts). */
export function heathMaskAt(coast: CoastParams, x: number, z: number): number {
  const [qx, qz] = [x + coast.noiseOffset[0], z + coast.noiseOffset[1]]
  const m = fbm(qx / 40 + 113, qz / 40 + 113) * 0.65 + fbm(qx / 6 + 127, qz / 6 + 127) * 0.35
  return smoothstep(HEATH_MASK_TERRAIN - HEATH_MASK_EDGE, HEATH_MASK_TERRAIN + HEATH_MASK_EDGE, m)
}
