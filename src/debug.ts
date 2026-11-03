// Render-only switches and views for debugging (SceneParams.debug), set by a
// scene spec's `params` patch: {"params": {"debug": {"terrainView": "slope"}}}.
// The generator never reads them, so no draw and no other param changes.
// How to use them: knowledge/tools/DEBUG.md. No imports:
// params.ts and sceneSpec.ts both use it.

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
  /** False colour on the terrain: 'slope' (grey by steepness, red where the
   * height bends within ~2 grid cells: aliasing), 'relief' (each relief term
   * in its own channel), 'lines' (today's water, run-up, high waters, beach
   * lines), 'shore' (s and a every 10 m). */
  terrainView?: TerrainView
  /** False colour on the sea: 'shelter', 'breaking', 'depth' (1 m bands),
   * 'foam' (coverage). */
  oceanView?: OceanView
}

export const DEBUG_PASSES = ['clouds', 'aerial', 'skyFill', 'bloom', 'reflection', 'shadows', 'stars', 'glow', 'meteors'] as const
export type DebugPass = (typeof DEBUG_PASSES)[number]
export const TERRAIN_VIEWS = ['none', 'slope', 'relief', 'lines', 'shore'] as const
export type TerrainView = (typeof TERRAIN_VIEWS)[number]
export const OCEAN_VIEWS = ['none', 'shelter', 'breaking', 'depth', 'foam'] as const
export type OceanView = (typeof OCEAN_VIEWS)[number]
export const DEBUG_MARKERS = ['camera-ground', 'edge-rocks', 'water-rocks'] as const
