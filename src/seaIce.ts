// Sea ice on a coast that freezes (SEASONS.md §4.2, plans/SEA_ICE.md): the day's
// choice by place, latitude and date, and what the ice is at a world position.
// The shader's mirror of these fields is in props/seaIce.ts. Pure, no three.js.

import { fbm, smoothstep, vnoise } from './cellNoise'
import { band } from './phenology'
import { Random } from './random'
import { seasonDay, type Day } from './seasons'

export interface SeaIceParams {
  /** How far fast ice reaches from today's water (m); drift ice past it. */
  edge: number
  /** Share of the sea past the edge that's ice (0–1). */
  cover: number
  /** Snow on the ice (0–1). */
  snow: number
  /** Break-up (0–1): wet, pools, then open water. */
  melt: number
  /** Freeze-up (0–1): thin, grey, no snow yet. */
  thin: number
  /** How much is ridged or piled up (0–1). */
  rubble: number
  /** A strip of open water along the shore (m), in the break-up. */
  lead: number
  /** Added to world position in every noise, so each day's ice differs (m). */
  origin: [number, number]
}

/** What a spec may force: true a typical day for the date, a mid-winter one out
 * of season; 'fast' or 'drift' that kind to the camera; the two shoulders. */
export type SeaIceForce = boolean | null | 'fast' | 'drift' | 'forming' | 'melting'

/** Where ice floats (m above the sea): ~10% of 0.4–0.7 m of ice, and snow. */
export const ICE_FREEBOARD = 0.18
/** The wind the waves see on an ice day at most (m/s): Hs ≈ 0.21 U²/g ≈ 0.05 m,
 * so crests stay under the freeboard. */
export const ICE_WAVE_WIND = 1.5
/** The run-up on an ice day (m): none to speak of. */
export const ICE_RUNUP = 0.03
/** How far below the usual line snow lies on an ice day (m): to the ice, as
 * no sea reaches it (terrain.ts fades snow in over 0.45 m above the line). */
export const ICE_SNOW_DROP = 0.45

/** A stretch of a freezing sea, from latitude `from` to the next row's:
 * first ice to established (`a`, `b`), break-up to last ice (`c`, `e`; days of
 * the year), the chance per day at its peak, fast ice's reach and drift's cover. */
export interface IceZone {
  from: number
  a: number
  b: number
  c: number
  e: number
  chance: number
  edge: readonly [number, number]
  cover: readonly [number, number]
}

const SEASONAL = (from: number, a: number, b: number, c: number, e: number, chance: number, edge: readonly [number, number], cover: readonly [number, number]): IceZone => ({ from, a, b, c, e, chance, edge, cover })

/** By place, poleward first; days are northern-equivalent, so the south's are six
 * months on (SEASONS.md §4.2, which says what's measured and what's an estimate).
 * Open coasts stay out: north Norway, Iceland, the Kola coast's warm current. */
export const SEA_ICE_PLACES: Readonly<Record<string, readonly IceZone[]>> = {
  baltic: [
    // Northern Bay of Bothnia: freezes every winter, last ice mid to late May.
    { from: 64.5, a: 315, b: 349, c: 115, e: 145, chance: 1, edge: [3000, 25000], cover: [0.9, 1] },
    // Southern Bay and the Quark: after the north, gone by about mid-May.
    { from: 63, a: 325, b: 355, c: 105, e: 130, chance: 1, edge: [2000, 15000], cover: [0.85, 1] },
    // Sea of Bothnia, Archipelago Sea, Gulf of Finland: normal winters, not mild ones.
    { from: 60, a: 340, b: 15, c: 90, e: 122, chance: 0.75, edge: [1000, 8000], cover: [0.5, 0.95] },
    // Northern Baltic Proper, Gulf of Riga: partly, gone by early April.
    { from: 57.5, a: 355, b: 32, c: 65, e: 95, chance: 0.35, edge: [300, 3000], cover: [0.2, 0.7] },
    // Central and southern Baltic: severe winters.
    { from: 0, a: 15, b: 32, c: 59, e: 80, chance: 0.06, edge: [100, 800], cover: [0, 0.3] }
  ],
  // Galley et al. 2012: the High Arctic usually fast by mid-November, the southern channels
  // from early November and by early January; break-up from 18 June, those channels
  // clear by mid-July, most of the rest by early August. Hudson Bay and Ungava aren't
  // in that study (est.).
  'arctic-canada': [
    SEASONAL(70, 274, 320, 169, 220, 1, [5000, 60000], [0.9, 1]),
    SEASONAL(62, 305, 5, 169, 197, 1, [3000, 40000], [0.8, 1]),
    SEASONAL(0, 315, 355, 135, 185, 1, [2000, 20000], [0.7, 1])
  ],
  // The north is fast; Disko Bay peaks in March and some winters barely freezes; the
  // south-west stays mostly open, with the East Greenland drift ice coming round.
  greenland: [
    SEASONAL(72, 290, 335, 150, 205, 1, [3000, 40000], [0.85, 1]),
    SEASONAL(66, 15, 50, 95, 135, 0.6, [500, 8000], [0.4, 0.9]),
    SEASONAL(0, 40, 70, 120, 160, 0.15, [100, 800], [0.2, 0.6])
  ],
  // Siberia's fast ice is wide; the White Sea freezes; the Kola coast doesn't,
  // and a day's latitude can't tell it from the White Sea, so the share is lower.
  'arctic-russia': [
    SEASONAL(70, 285, 330, 160, 205, 1, [10000, 80000], [0.9, 1]),
    SEASONAL(0, 315, 350, 110, 150, 0.6, [1000, 12000], [0.6, 1])
  ],
  // Fjord ice, shrinking: Isfjorden 22 days of fast ice since 2006, Hornsund 34, gone in June.
  svalbard: [SEASONAL(0, 345, 40, 105, 165, 0.55, [500, 6000], [0.3, 0.85])],
  // Break-up at communities averages 2 June; Beaufort onset ~6 June.
  'alaska-north': [SEASONAL(0, 295, 340, 150, 190, 1, [3000, 30000], [0.8, 1])],
  // Freezes from the north from November; the most at the start of March; gone by June.
  'russian-far-east': [
    SEASONAL(52, 325, 15, 90, 165, 1, [500, 8000], [0.7, 1]),
    SEASONAL(0, 15, 35, 75, 110, 0.8, [100, 1000], [0.5, 0.95])
  ],
  // The northern bays freeze; the open Pacific side and the islands don't.
  'kamchatka-kurils-aleutians': [SEASONAL(55, 340, 30, 90, 130, 0.2, [200, 2000], [0.2, 0.7])],
  'cook-inlet': [SEASONAL(0, 320, 350, 75, 110, 0.85, [100, 1000], [0.4, 0.85])],
  // The Gulf's first ice is in early December, mean cover ~5% at the start of January,
  // ice-free by early May. Labrador's lasts to mid-June.
  pei: [SEASONAL(0, 355, 30, 95, 122, 0.9, [500, 6000], [0.6, 1])],
  'nova-scotia': [SEASONAL(45.5, 20, 45, 90, 115, 0.35, [200, 2000], [0.3, 0.8])],
  newfoundland: [
    SEASONAL(49, 30, 60, 110, 150, 0.7, [500, 5000], [0.5, 0.95]),
    SEASONAL(0, 45, 70, 100, 125, 0.2, [100, 800], [0.2, 0.6])
  ],
  // Bays in winter some years, and the pack's edge further north.
  'south-shetland': [SEASONAL(0, 345, 25, 80, 115, 0.6, [200, 3000], [0.3, 0.8])],
  'south-sandwich': [SEASONAL(0, 20, 50, 85, 115, 0.35, [100, 500], [0.2, 0.6])]
}

/** The zone for this latitude here, if the place's sea freezes. */
export function iceZone(placeId: string, latitudeDeg: number): IceZone | undefined {
  return SEA_ICE_PLACES[placeId]?.find(z => Math.abs(latitudeDeg) >= z.from)
}

/** The chance of sea ice on this day here (0–1). No draw. */
export function seaIceChance(placeId: string, day: Day): number {
  const zone = iceZone(placeId, day.latitudeDeg)
  return zone == null ? 0 : zone.chance * band(seasonDay(day), zone.a, zone.b, zone.c, zone.e)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** The zone for a forced day where the sea has none of its own. */
const FORCED_ZONE: IceZone = { from: 0, a: 340, b: 15, c: 90, e: 122, chance: 1, edge: [2000, 12000], cover: [0.8, 1] }

/**
 * The day's ice, on its own stream. `phenology: false` is the summer look, so
 * none unless forced.
 */
export function pickSeaIce(seed: string, placeId: string, day: Day, force?: SeaIceForce, phenology?: boolean): SeaIceParams | null {
  const rng = Random.derive(seed, 'sea-ice')
  const present = rng.float() < seaIceChance(placeId, day)
  const [r1, r2, r3, r4, r5] = [rng.float(), rng.float(), rng.float(), rng.float(), rng.float()]
  const origin: [number, number] = [rng.range(-8000, 8000), rng.range(-8000, 8000)]
  if (force === undefined ? !present || phenology === false : force === null || force === false) return null

  // A forced kind shows that kind, wherever on the place's latitudes the day fell.
  const zone = (typeof force === 'string' ? undefined : iceZone(placeId, day.latitudeDeg)) ?? FORCED_ZONE
  const x = seasonDay(day)
  const g = band(x, zone.a, zone.b, zone.c, zone.e)
  // Which shoulder of the season: rising from a to b, or falling from c to e.
  const after = (d: number, from: number): number => (((d - from) % 365) + 365) % 365
  const rising = after(x, zone.a) < after(zone.b, zone.a)
  // A forced day out of season is a mid-winter one.
  const inSeason = force === true && g === 0 ? 1 : g
  let thin = rising ? 1 - inSeason : 0
  let melt = rising ? 0 : 1 - inSeason
  if (force === 'forming') [thin, melt] = [0.75, 0]
  if (force === 'melting') [thin, melt] = [0, 0.7]
  if (force === 'fast' || force === 'drift') [thin, melt] = [0, 0]

  const baseEdge = zone.edge[0] * (zone.edge[1] / zone.edge[0]) ** r1
  const edge = force === 'fast' ? 200_000 : force === 'drift' ? 0 : baseEdge * (1 - 0.7 * thin) * (1 - 0.6 * melt)
  const cover = lerp(zone.cover[0], zone.cover[1], r2) * (1 - 0.4 * thin) * (1 - 0.5 * melt)
  return {
    edge,
    cover,
    snow: (0.65 + 0.35 * r3) * (1 - thin) ** 2 * (1 - melt) ** 2,
    melt,
    thin,
    rubble: (force === 'drift' ? 0.6 + 0.4 * r4 : 0.3 + 0.7 * r4) * (1 - 0.6 * thin),
    lead: melt > 0.25 ? 4 + 60 * melt * r5 : 0,
    origin
  }
}

/** Past the fast ice's wandering edge at this point: 0 fast, 1 drift. `off`: m
 * from today's water. Mirrors `iceDrift` in the sheet's shader. */
export function iceDrift(ice: SeaIceParams, x: number, z: number, off: number): number {
  const px = x + ice.origin[0]
  const pz = z + ice.origin[1]
  const edge = ice.edge * (0.6 + 0.8 * vnoise(px / 500, pz / 500))
  return smoothstep(edge - 80, edge + 40, off)
}

/** Ridges and piles at this point (0–1): lines across the ice that come and go,
 * a belt along the shore, and a barrier at the fast edge. Mirrors `iceRubbleAt`
 * in the sheet's shader. */
export function iceRubble(ice: SeaIceParams, x: number, z: number, off: number): number {
  const px = x + ice.origin[0]
  const pz = z + ice.origin[1]
  const warp = fbm(px / 900, pz / 900)
  const n = fbm(px / 420 + 3 * warp, pz / 420 - 3 * warp)
  const width = 0.012 + 0.03 * vnoise(px / 150, pz / 150)
  const line = (1 - smoothstep(width * 0.3, width, Math.abs(n - 0.5))) * smoothstep(0.35, 0.6, vnoise(px / 700, pz / 700))
  const drift = iceDrift(ice, x, z, off)
  const ridge = line * (0.45 + 0.55 * drift)
  // Piled by the autumn's waves and the ice's push: wider in stretches.
  const belt = 4 + 46 * vnoise(px / 130, pz / 130) ** 2
  const shore = (1 - smoothstep(belt * 0.5, belt, off - ice.lead)) * smoothstep(0.2, 0.45, vnoise(px / 240, pz / 240))
  const barrier = drift > 0 && drift < 1 ? 1 - Math.abs(2 * drift - 1) : 0
  return Math.max(ridge * ice.rubble, shore * Math.min(1, 0.4 + ice.rubble), 0.7 * barrier * ice.rubble)
}
