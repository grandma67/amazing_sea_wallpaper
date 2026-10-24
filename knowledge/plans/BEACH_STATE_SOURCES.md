# Beach states: sourced shape table

Item 4 from the phase 4 retrospective (2026-10-24). **Done 2026-10-24** (changelog 0.56; table in
REGIONS.md §2). Still open: the share retune proposed in COASTS.md "Beach state" (asks first).
The original prompt is kept below.

```
Item 4 from the phase 4 retrospective: give the beach-state shape tables real sources.

Context
- PLAN_BIOMES phase 4 is done (commits 2ab9838, aa9d8e4). src/beachState.ts picks a
  Wright & Short state from Ω = Hb / (ws · T), then shapes the beach from tables.
- The physics inputs are sourced in knowledge/REGIONS.md §2: grain by sand colour,
  Soulsby fall velocity, Ω worked examples, face slope by grain, CEDD whole-profile slopes.
- These tables in src/beachState.ts were written from memory and have no source:
  - OMEGA_LIMITS: the splits between the intermediate states (1.5 / 2.5 / 3.5 / 4.5 / 5.5);
  - FACE_BY_STATE: face-slope factor per state;
  - NEARSHORE: nearshore slope range per state;
  - WIDTH: beach width per state;
  - BARS: bar count, distance and crest height per state;
  - rip spacing (150–400 m) and how far the bar swings toward the shore (amplitude);
  - CUSP_CHANCE per state;
  - the gravel face slopes in STONE_FACE.
- knowledge/COASTS.md "Beach state (phase 4)" says the shares are "not yet checked against
  a measured world share of states".

Goal
1. Research each item above. Sources to try: Wright & Short 1984 (Marine Geology), Short's
   Australian beach database and Short (1999/2006) "Beaches of the Australian coast" (state
   shares, Ω ranges, bar and rip dimensions), Masselink & Short 1993 (RTR, tide-modified
   states), Castelle et al. on rip spacing, Coco & Murray / Inman & Guza on cusps, Bascom
   1951 and Jennings & Shulmeister 2002 for gravel slopes. Use as many searches as needed,
   but stop at one good source per number. Where nothing is found, keep the value, mark it
   "≈ (assumed)" and say why.
2. Add a "Beach states: shape by state" table to REGIONS.md §2. One row per state: Ω range,
   face slope, nearshore slope, width, bar count, bar distance and depth, rip spacing,
   cusp chance and spacing, and a source for each cell (or ≈). Add a short "measured shares
   of states" note if a survey gives one (e.g. Australia by state), and add the sources
   to REGIONS.md "Sources".
3. Update the tables in src/beachState.ts to match, with a comment pointing to the new
   REGIONS.md table. Don't change the draws: same streams, same number of draws for every
   state.
4. Compare our shares (COASTS.md "Beach state") with the measured ones. If they're far
   off, say so and propose a change, but ask before tuning: retuning changes every beach
   day.

Checks (read CLAUDE.md, knowledge/TOOLS.md and knowledge/LESSONS.md "Sea and surf" first)
- Before rendering, run node scripts/profile.mjs --scene scenes/beach-states.json --out $SP/profile
  and read the maps: bars where the table says, rips cutting the white break line, cusps
  visible. To check a state on realistic waves, force swellHeight and swellPeriod instead
  of hunting dates.
- node scripts/params.mjs --stats 'p => p.coast.state' --where 'p => p.coast.type === "beach" && p.coast.material === "sand"'
  before and after; update the COASTS.md table.
- node scripts/params.mjs --ref HEAD: only `coast` may change, and only on beach days.
  Anything else (camera, ocean) is an accidental cascade.
- Only if shapes changed visibly: one render round of scenes/beach-states.json, then
  node scripts/diff.mjs --keep-camera for anything that should show up.
- npm test and npx tsc --noEmit. test/beachState.test.ts asserts some of these ranges
  (bars per state, cusp spacing 10–52 m, slope × width ≤ 5 m); update the asserts that
  encode the old numbers, and add one for any new rule.

Finish
- Docs: REGIONS.md (table and sources), COASTS.md (state shares and the comparison with
  the measured ones), REFERENCES.md, ARCHITECTURE.md beach-state paragraph if numbers
  changed, a changelog row naming how many days change (from --ref).
- One commit, e.g. "Beach states: sourced shape table (REGIONS.md §2)". Don't commit
  TASKS.md.
- Report which numbers changed, which stay ≈, and how our state shares compare with the
  measured world.
```
