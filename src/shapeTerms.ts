import type { ROLL_SHAPE } from './rollCloud'
import type { SHELF_SHAPE } from './shelfCloud'

// The cloud shapes' detail terms (params.debug.shelf / .roll), each the
// constants it zeroes (cloudShapes.ts withTermsOff). In their own module so
// the spec check (sceneSpec.ts) and the debug types read the same table as
// the shapes: shelfCloud.ts and rollCloud.ts load params.ts, which loads
// sceneSpec.ts, so it can't import them (a copied list once rejected a new
// term, 0.223). Type imports only: no value cycle.

export const SHELF_TERMS = {
  bow: ['bowM'],
  wobble: ['wobbleM'],
  scallops: ['scallopM'],
  lipVary: ['lipVaryLarge', 'lipVarySmall'],
  tiers: ['tierGrooveM', 'tierBulgeM'],
  stria: ['striaM'],
  tatter: ['tatterM', 'tatter2M', 'tatter3M']
} as const satisfies Record<string, readonly (keyof typeof SHELF_SHAPE)[]>
export type ShelfTerm = keyof typeof SHELF_TERMS

export const ROLL_TERMS = {
  wander: ['wanderM'],
  rise: ['riseM'],
  lumps: ['lumpLarge', 'lumpSmall'],
  shrink: ['shrinkPerRoll']
} as const satisfies Record<string, readonly (keyof typeof ROLL_SHAPE)[]>
export type RollTerm = keyof typeof ROLL_TERMS
