/** Warnings for one render (see checks.mjs). `params` is a snapshot's JSON, so loosely typed. */
export function snapshotWarnings(params: unknown, props?: readonly string[], gl?: readonly string[]): string[]
/** Why a render must not be published, or [] (see checks.mjs). */
export function brokenFrame(params: unknown, luma?: { min?: number; max?: number; mean?: number; white?: number } | null): string[]
export const WHITE_SHARE: number
export const NON_FINITE_CELLS: number
