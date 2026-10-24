// Coastal weather that belongs to a place and a season (PLAN_BIOMES 3,
// CLOUDS.md "Coastal weather"):
// - marine layer: a stratus or stratocumulus deck a few hundred metres up,
//   trapped under the subsidence inversion over a cold upwelling current.
//   California's "May gray, June gloom" mornings; Peru and Chile's
//   camanchaca and garúa in the southern winter and spring. It forms at
//   night and burns back to the coast by late morning, so it's a morning sky;
// - harmattan: the dry northeasterly that carries Saharan dust to the Gulf
//   of Guinea from December to February (seaHaze.ts draws the haze).

import { inMonths, type Months } from './places'
import type { TimeOfDay } from './params'
import type { Random } from './random'
import { forced } from './sceneSpec'

/** Chance of a marine-layer morning by place, in local months. */
export const MARINE_LAYER: Record<string, readonly (readonly [Months, number])[]> = {
  california: [
    [[5, 7], 0.45],
    [[8, 10], 0.15]
  ],
  // Weaker than California's: the deck sits on the coastal cliffs.
  'atacama-peru': [
    [[6, 9], 0.3],
    [[10, 10], 0.15]
  ]
}

/** Golden hour to late morning: the deck burns off by midday. */
export const MARINE_LAYER_TIMES: readonly TimeOfDay[] = ['golden-hour', 'sun-on-horizon', 'daylight']

export interface CoastalDay {
  place: string
  /** Calendar month (1–12), local. */
  month: number
  timeOfDay: TimeOfDay
  evening: boolean
}

export function marineLayerChance(day: CoastalDay): number {
  if (day.evening || !MARINE_LAYER_TIMES.includes(day.timeOfDay)) return 0
  return MARINE_LAYER[day.place]?.find(([months]) => inMonths(day.month, months))?.[1] ?? 0
}

/** Is it a marine-layer morning? One draw on `rng`, then forced. */
export function marineLayerFor(day: CoastalDay, rng: Random, force?: boolean | null): boolean {
  return forced(force, rng.chance(marineLayerChance(day)))
}
