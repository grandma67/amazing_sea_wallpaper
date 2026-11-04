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

/** The day of the year (1–365) with the day's season, in northern-hemisphere
 * days: the calendar day north of the equator, half a year on south of it
 * (1 July in Tasmania is 1 January's season). 29 February counts as 28. */
export function seasonDay(day: Day): number {
  const [y, m, d] = day.date.split('-').map(Number)
  const doy = Math.min(365, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1 - (m > 2 && isLeap(y) ? 1 : 0))
  return day.latitudeDeg < 0 ? ((doy - 1 + 182) % 365) + 1 : doy
}

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
