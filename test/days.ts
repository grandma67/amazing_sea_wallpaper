import { shiftDate } from '../src/dates'
import { generateParams, type SceneParams } from '../src/params'

/** Every day of three years: enough for the rare events to show up. */
export const DAYS: string[] = Array.from({ length: 3 * 365 }, (_, i) => shiftDate('2024-01-01', i))

let cache: SceneParams[] | null = null
export function allParams(): SceneParams[] {
  cache ??= DAYS.map(d => generateParams(d))
  return cache
}

export function share(list: SceneParams[], test: (p: SceneParams) => boolean): number {
  return list.filter(test).length / list.length
}
