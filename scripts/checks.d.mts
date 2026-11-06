/** Warnings for one render (see checks.mjs). `params` is a snapshot's JSON, so loosely typed. */
export function snapshotWarnings(params: unknown, props?: readonly string[], gl?: readonly string[]): string[]
