import { shiftDate } from '../src/dates'
import { generateParams, type SceneParams } from '../src/params'
import type { SceneSpec } from '../src/sceneSpec'

/** Every day of three years: enough for the rare events to show up. */
export const DAYS: string[] = Array.from({ length: 3 * 365 }, (_, i) => shiftDate('2024-01-01', i))

let cache: SceneParams[] | null = null
/** The real days, for how often things happen and where. */
export function allParams(): SceneParams[] {
  cache ??= DAYS.map(d => generateParams(d))
  return cache
}

export function share(list: SceneParams[], test: (p: SceneParams) => boolean): number {
  return list.filter(test).length / list.length
}

/** A scene described by a spec (sceneSpec.ts), on `date` or the spec's own. */
export function scene(spec: SceneSpec, date = DAYS[0]): SceneParams {
  return generateParams(date, 0, 16 / 9, spec)
}

/** The same spec on `count` days spread over the three years, for checking
 * a case on many scenes without searching for days that have it. */
export function scenes(spec: SceneSpec, count = 30): SceneParams[] {
  return Array.from({ length: count }, (_, i) => scene(spec, DAYS[Math.floor((i * DAYS.length) / count)]))
}
