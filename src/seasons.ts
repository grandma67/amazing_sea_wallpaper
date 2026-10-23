// Seasons by hemisphere. Seasonal tables (flowers in bloom, fog season, cloud
// summer, sea smoke…) are written in northern-hemisphere months; south of the
// equator the same season comes six months later, so they read the day's
// month through these helpers. Tables of real local months for one region
// (turtle nesting per place, waterspouts, the Morning Glory) don't.

import { inMonths } from './places'

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

/** A day at a place: its date and signed latitude (negative south). */
export interface Day {
  date: string
  latitudeDeg: number
}

/** The northern-hemisphere month (1–12) with the day's season: the calendar
 * month north of the equator, six months on south of it (July → January). */
export function seasonMonth(day: Day): number {
  const month = Number(day.date.slice(5, 7))
  return day.latitudeDeg < 0 ? ((month + 5) % 12) + 1 : month
}

/** Meteorological season: December–February is winter in the north and
 * summer in the south. */
export function season(day: Day): Season {
  const m = seasonMonth(day)
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'
}

/** Is the day within `from`–`to` (northern-hemisphere months, inclusive,
 * may wrap the year), counted in its own hemisphere? */
export function monthInSeason(day: Day, from: number, to: number): boolean {
  return inMonths(seasonMonth(day), [from, to])
}
