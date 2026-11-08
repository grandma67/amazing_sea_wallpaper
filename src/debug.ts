// Render-only switches and views for debugging (SceneParams.debug), set by a
// scene spec's `params` patch: {"params": {"debug": {"terrainView": "slope"}}}.
// The generator never reads them, so no draw and no other param changes.
// How to use them: knowledge/tools/DEBUG.md. No imports:
// params.ts and sceneSpec.ts both use it.

/** A probe: a point as fractions of the image (x right, y down), a sky
 * direction: azimuth from the view (deg, + right) and elevation (deg), a
 * world point (m; `params.mjs --project` prints a prop's), or where the sea
 * mirrors a world point (its image in the plane y = 0: the point at −y). */
export type ProbeAt =
  | [number, number]
  | { az: number; el: number }
  | { world: [number, number, number] }
  | { mirror: [number, number, number] }

/** Render-only debugging (SceneParams.debug). */
export interface DebugParams {
  /** Terrain grid density × (rings and segments): 2 halves the spacing, so
   * a feature that changes with it is grid aliasing. */
  terrainGrid?: number
  /** false: no props at all (markers still drawn). */
  props?: boolean
  /** Coloured posts at points: 'camera-ground', 'edge-rocks', 'water-rocks',
   * or 'props:KIND' (each placed piece of a prop kind). */
  markers?: string[]
  /** Passes to switch off (false), to find which one causes an effect. */
  passes?: Partial<Record<DebugPass, boolean>>
  /** Fixed exposure instead of the one metered from the sky and weather
   * (diff.mjs --keep-exposure). */
  exposure?: number
  /** Force the cloud shade everywhere, 0 (no direct light) to 1 (none): at 0
   * anything still sunlit doesn't read the shade (knowledge/tools/DEBUG.md). */
  cloudShade?: number
  /** Everything that reads the land and cloud shade shows it, in grey: black in
   * full shade, ~0.25 in sun. */
  shadeView?: boolean
  /** False colour on the terrain: 'slope' (grey by steepness, red where the
   * height bends within ~2 grid cells: aliasing), 'relief' (each relief term
   * in its own channel), 'lines' (today's water, run-up, high waters, beach
   * lines), 'shore' (s and a every 10 m). */
  terrainView?: TerrainView
  /** False colour on the sea: 'shelter', 'breaking', 'depth' (1 m bands),
   * 'foam' (coverage). */
  oceanView?: OceanView
  /** Read the render at these points (fractions of the image, x right, y
   * down), sky directions ({az: from the view, deg; el: deg}), world points
   * ({world: [x, y, z]}) or their mirror images ({mirror: [x, y, z]}): raw
   * radiance, cd/m², mag/arcsec², exposed and final colour, in
   * `debug.probe` (probe.ts). */
  probe?: ProbeAt[]
  /** Half size of each probe's box (px): 0 a single pixel, default 2 (5×5). */
  probeHalf?: number
  /** Read a line of sky pixels ({az, el, step}: az from the view, one of
   * az/el a [from, to] range, deg): cd/m² and final colour per pixel and
   * `lineStats` (bands vs grain, stars left out), in `debug.probeLine`.
   * Same line format as the CPU mirrors (skyMirror.ts, params.mjs --line). */
  probeLine?: ProbeLine | ProbeLine[]
}

export interface ProbeLine {
  az: number | [number, number]
  el: number | [number, number]
  step?: number
}

export const DEBUG_PASSES = ['clouds', 'aerial', 'skyFill', 'bloom', 'reflection', 'shadows', 'cloudLight', 'cloudShade', 'skyOcclusion', 'softShadows', 'beamShadow', 'beamSweep', 'frameMeter', 'nightSkylight', 'longExposure', 'stars', 'glow', 'meteors', 'aurora', 'auroraClouds', 'shortWaves', 'reflectionRay', 'reflectionStreaks', 'reflectionHaze', 'seaHaze', 'wetMirror'] as const
export type DebugPass = (typeof DEBUG_PASSES)[number]
export const TERRAIN_VIEWS = ['none', 'slope', 'relief', 'lines', 'shore'] as const
export type TerrainView = (typeof TERRAIN_VIEWS)[number]
export const OCEAN_VIEWS = ['none', 'shelter', 'breaking', 'depth', 'foam'] as const
export type OceanView = (typeof OCEAN_VIEWS)[number]
export const DEBUG_MARKERS = ['camera-ground', 'edge-rocks', 'water-rocks'] as const
