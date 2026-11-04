// Animals through the year (knowledge/SEASONS.md §3, plans/SEASONS_PLAN.md
// phase 4): who is at the colony, which whales have migrated, which seals
// are hauled out, who sleeps the winter in a burrow. Months and days are the
// day's own season (seasons.ts), so a southern colony fills in our winter.

import type { Climate } from './biome'
import type { ColonyKind, PinnipedKind } from './params'
import { monthInSeason, seasonDay, seasonMonth, type Day } from './seasons'

/** A day at a place with its climate. */
export interface SeasonDay extends Day {
  place: { id: string; climate: Climate }
}

/** Days of the year the birds are at their colony (northern-hemisphere days;
 * null: all year). Puffins and guillemots from late March to mid August;
 * gannets from late February to the end of October (Bass Rock; Australasian
 * and Cape gannets the same in their season). */
export const COLONY_DAYS: Record<ColonyKind, readonly [number, number] | null> = {
  puffin: [85, 227],
  gannet: [50, 304],
  tropical: null,
  penguin: null
}

/** Are the colony's birds there today? Out of season the rock stays white
 * with guano, but nothing circles it. */
export function colonyInSeason(kind: ColonyKind, day: Day): boolean {
  const days = COLONY_DAYS[kind]
  if (days == null) return true
  const d = seasonDay(day)
  return d >= days[0] && d <= days[1]
}

/** Humpbacks feed at high latitudes in summer and autumn and breed in the
 * tropics in winter (IWC): the chance they're here, as a weight factor.
 * Mediterranean-climate coasts (California, Chile, the Cape, SW Australia)
 * are on the migration route; the Arabian Sea's humpbacks stay all year. */
export function humpbackSeason(day: SeasonDay): number {
  if (day.place.id === 'oman-yemen') return 1
  const m = seasonMonth(day)
  const climate = day.place.climate
  const stray = 0.1
  if (climate === 'polar' || climate === 'boreal' || climate === 'temperate') return m >= 5 && m <= 11 ? 1 : stray
  if (climate === 'mediterranean') return monthInSeason(day, 3, 5) || monthInSeason(day, 9, 12) ? 1 : 0.5
  return m === 12 || m <= 4 ? 1 : stray
}

/** The share of drawn haul-outs that happen today (≤ 1): harbour seals spend
 * winter mostly at sea (most ashore pupping and moulting, June–August);
 * southern elephant seals are at sea in the austral winter. */
export function haulOutSeason(kind: PinnipedKind, day: Day): number {
  const m = seasonMonth(day)
  if (kind === 'seal') return m === 12 || m <= 2 ? 0.5 : m >= 6 && m <= 8 ? 1 : 0.8
  // Northern elephant seals (California) are ashore all year.
  if (kind === 'elephant-seal' && day.latitudeDeg < 0) return m >= 11 || m <= 2 ? 0.1 : 1
  return 1
}

/** Ghost crabs out of their burrows (0–1). Tropical and desert coasts all
 * year; elsewhere they shut themselves in from late autumn to spring (the
 * Carolinas October–April, out above ~15 °C). Burrows: closed ones are hard
 * to see, so fewer show in winter. */
export function ghostCrabSeason(day: SeasonDay): { out: number; burrows: number } {
  const climate = day.place.climate
  if (climate === 'tropical' || climate === 'arid') return { out: 1, burrows: 1 }
  const m = seasonMonth(day)
  if (m === 12 || m <= 2) return { out: 0, burrows: 0.3 }
  if (m === 11 || m === 3 || m === 4) return { out: 0.5, burrows: 0.7 }
  return { out: 1, burrows: 1 }
}

/** Shore crabs move to deeper water for the winter. */
export function shoreCrabsOut(day: Day): boolean {
  const m = seasonMonth(day)
  return !(m === 12 || m <= 2)
}

/** Spiny-tailed lizards brumate from November to February. */
export function lizardAwake(species: string, day: Day): boolean {
  if (species !== 'spiny-tailed') return true
  const m = seasonMonth(day)
  return !(m >= 11 || m <= 2)
}

/** Geese and sea ducks by climate and month (SEASONS.md §3.5): passage in
 * spring and autumn, breeding flocks in the Arctic summer, wintering flocks
 * on temperate and warm coasts, none where they've left. */
export function waterfowlSeason(day: SeasonDay): { goose: number; duck: number } {
  const m = seasonMonth(day)
  const between = (a: number, b: number): boolean => monthInSeason(day, a, b)
  switch (day.place.climate) {
    case 'polar': {
      const v = m === 5 || m === 9 ? 1 : between(6, 8) ? 0.6 : 0
      return { goose: v, duck: v }
    }
    case 'boreal': {
      const passage = between(4, 5) || between(9, 10)
      return { goose: passage ? 1 : between(6, 8) ? 0.3 : 0, duck: passage ? 1 : 0.5 }
    }
    case 'temperate': {
      const v = between(3, 5) || between(9, 11) ? 1 : between(12, 2) ? 0.6 : 0.15
      return { goose: v, duck: v }
    }
    default: {
      // Mediterranean and subtropical coasts: where they winter.
      const v = between(11, 2) ? 0.6 : m === 3 || m === 4 || m === 10 ? 0.8 : 0
      return { goose: v, duck: v }
    }
  }
}

/** Gulls: most leave the high Arctic for the winter (a few ivory and
 * glaucous gulls stay). */
export function gullSeason(day: SeasonDay): number {
  return day.place.climate === 'polar' && monthInSeason(day, 11, 3) ? 1 / 3 : 1
}
