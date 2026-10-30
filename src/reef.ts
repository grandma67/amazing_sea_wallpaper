import type { Random } from './random'
import type { Shelter } from './shelter'

// Reef-fronted tropical beaches (PLAN_BIOMES 7). Most island beaches in the
// tropics sit behind a fringing reef: the waves break on its crest 100–500 m
// out and lose 70–90% of their height there, and a calm lagoon 1–3 m deep
// lies between it and the sand (Kench & Brander 2006; Gourlay 1996). The reef
// flat behind the crest has grown up to about the lowest tides, so spring low
// water lays it bare. Passes cut it every kilometre or so. On ~30% of these
// beaches beachrock (sand cemented in the intertidal) crops out as grey
// ledges along the waterline.
//
// The place's `reef` chance decides (places.ts); everything is drawn on the
// 'reef' stream. The reef sets the shelter mask (shelter.ts) and its profile
// replaces the shoreface in terrain.ts.

export interface Reef {
  /** Crest's distance seaward of the shoreface's start (m; terrain.ts seaDistance). */
  distance: number
  /** Reef flat behind the crest (m). */
  flatWidth: number
  /** Lagoon floor below mean sea (m). */
  lagoonDepth: number
  /** The crest's top below mean sea (m): about the spring low water. */
  crestDepth: number
  /** Passes through the reef: spacing along the shore and width (m). */
  passSpacing: number
  passWidth: number
  /** Share of the swell the reef stops (shelter.ts strength). */
  strength: number
  /** Beachrock ledges along the waterline (props/beachrock.ts). */
  beachrock: boolean
}

/** The lagoon's back slope up to the reef flat (m), shoreward of the flat. */
export const REEF_RAMP = 15
/** Fore-reef slope below the crest (the drop-off, ~30°). */
export const REEF_DROP = 0.6
/** Share of reef beaches with beachrock (Vousdoukas et al. 2007: common on
 * tropical and subtropical micro-tidal beaches). */
const BEACHROCK = 0.3

/** What a scene spec can force. */
export interface ReefSpec {
  /** true: a reef on any beach; null or false: none. */
  reef?: boolean | null
  /** true: beachrock (and so a reef); null or false: none. */
  beachrock?: boolean | null
}

/** The day's reef, or null: every draw made first on `rng` (stream 'reef'),
 * then the place's chance or the spec decides. `springRange`: the tide the
 * beach is built for (tides.ts); the lagoon is 1–3 m deep at low water and
 * the crest stands at about the spring low water. */
export function reefFor(chance: number, beach: boolean, springRange: number, rng: Random, spec: ReefSpec = {}): Reef | null {
  const present = rng.chance(chance)
  const distance = rng.range(100, 500)
  const flat = rng.range(0.2, 0.45)
  const lagoon = rng.range(1, 3)
  const passSpacing = rng.range(500, 2000)
  const passWidth = rng.range(30, 80)
  const strength = rng.range(0.7, 0.9)
  const beachrock = rng.chance(BEACHROCK)
  const wanted = spec.beachrock === true || (spec.reef !== undefined ? spec.reef === true : present)
  if (!beach || !wanted) return null
  const lowWater = springRange / 2
  return {
    distance,
    flatWidth: Math.min(150, Math.max(30, flat * distance)),
    lagoonDepth: lagoon + lowWater,
    crestDepth: Math.max(0.3, 0.8 * lowWater),
    passSpacing,
    passWidth,
    strength,
    beachrock: spec.beachrock !== undefined ? spec.beachrock === true : beachrock
  }
}

/** The slope from the beach down to the lagoon floor: the beach's, or
 * steeper, so the floor is reached (95%) before the back-reef ramp.
 * `terrace.height`: the shoreface starts that far below mean sea. */
export function lagoonSlope(coast: { reef: Reef | null; terrace: { height: number }; beachSlope: number }): number {
  const reef = coast.reef!
  const lagoon = Math.max(0.1, reef.lagoonDepth - coast.terrace.height)
  return Math.max(coast.beachSlope, (3 * lagoon) / Math.max(20, reef.distance - reef.flatWidth - REEF_RAMP - 8))
}

/** The reef's shelter: calm shoreward of the crest, fading in over the reef
 * flat (the waves break and spend themselves there), not a swell
 * wavelength. `start`: where the shoreface starts (the terrace's width). */
export function reefShelter(reef: Reef, start: number): Shelter {
  return { strength: reef.strength, line: start + reef.distance, basins: [], blur: reef.flatWidth + REEF_RAMP }
}
