// What kind of coast a day has, and what each kind implies. Callers ask these
// questions instead of comparing `coast.type` with one kind, so a new kind
// (rock shore, tidal flat) only has to answer them here. No runtime imports:
// params.ts and terrain.ts both use it.

import type { CoastParams } from './params'

export type CoastKind = CoastParams['type']

/** Index of each kind in the `coastKind` shader uniform (COAST_* in TERRAIN_GLSL). */
export const COAST_KINDS: readonly CoastKind[] = ['open-sea', 'beach', 'rock-shore', 'tidal-flat']

/** The camera stands on land and the terrain is drawn (every kind but open sea). */
export function hasLand(coast: Pick<CoastParams, 'type'>): boolean {
  return coast.type !== 'open-sea'
}

/** A sandy beach: high-tide and storm lines, wrack, shells, crabs, beach animals. */
export function hasBeach(coast: Pick<CoastParams, 'type'>): boolean {
  return coast.type === 'beach'
}

/** Waves break at the shore. Not on a tidal flat: the swell dies out over
 * kilometres of shallows before it reaches the water's edge. */
export function hasSurfZone(coast: Pick<CoastParams, 'type'>): boolean {
  return coast.type === 'beach' || coast.type === 'rock-shore'
}
