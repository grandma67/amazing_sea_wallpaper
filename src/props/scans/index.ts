import type { BufferGeometry } from 'three'

import { scanGeometry, type Scan } from './scan'

// Every baked scan by id (scripts/asset.mjs bake; scripts/asset-bakes.json).
// Each is a dynamic import: on the page a chunk fetched only by a day that
// draws it (a scan is ~0.5 MB). Load before building the props that use it.

const LOADERS: Record<string, () => Promise<{ default: Scan }>> = {
  ph_flower_ursinia: () => import('./ph_flower_ursinia')
}

export const SCAN_IDS: readonly string[] = Object.keys(LOADERS)

const loaded = new Map<string, Scan>()

/** Load a scan (once). */
export async function loadScan(id: string): Promise<Scan> {
  const hit = loaded.get(id)
  if (hit != null) return hit
  const load = LOADERS[id]
  if (load == null) throw new Error(`no baked scan ${id}`)
  const scan = (await load()).default
  loaded.set(id, scan)
  return scan
}

/** A loaded scan, or undefined until `loadScan` has finished. */
export function scanIfLoaded(id: string): Scan | undefined {
  return loaded.get(id)
}

/** A scan's variant by id, loading it first: for scripts/mesh.mjs and tests. */
export async function scanVariant(id: string, variant: number, lod = 0): Promise<BufferGeometry> {
  return scanGeometry(await loadScan(id), variant, lod)
}
