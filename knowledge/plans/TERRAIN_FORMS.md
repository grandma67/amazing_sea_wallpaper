# Terrain forms plan: the land behind the shore as it really is

The land behind our beaches is one generic shape everywhere: dunes, then rolling hills of
15–45 m (or 1.5 × the dune height) rising over ~500 m (`coast.hillHeight`, `params.ts` 'hills'
stream; `terrain.ts` `hills` and the rock and tidal-flat profiles' copies). Far mountains come
only as a `landform` (`pickLandform`: a range, strato or shield 12–70 km off, by biome chance).
Real coasts differ a lot in what rises behind them, and some have a signature form a photo
always shows. This plan makes the backland follow the place, measured from real elevation data,
and takes over PLAN_BIOMES phase 10 (barrier lagoon, spit, fjord), which was "later, own plan".

Started 2026-11-12 from NATURE_PLAN 5b: Peru's lomas grow at 200–1000 m on the coastal hills,
which our terrain doesn't draw.

## Status

| Phase | What | Days touched | Estimate | Status |
|---|---|---|---|---|
| 0 | Measure real backland relief per place from open elevation tiles (`scripts/relief.mjs`) → `knowledge/RELIEF.md` | none (data) | 3–4 h | planned |
| 1 | A `RELIEF` place table (kind, height, distance from the shore, face slope) replacing the generic hill draw where a place has a row | the rows' places | 1.5–2 h | planned |
| 2 | Coastal escarpment (Atacama–Peru first) in the height function, GLSL and TS mirror | `atacama-peru` land days: **10** in the test set (18 days in all incl. open sea) | 4–6 h | planned |
| 3 | Other backland kinds phase 0 finds mismatched (e.g. Namib dune sea, cliffed plateaus, coastal plains) | per kind | 3–5 h each | after phase 0 |
| 4 | Landform chance and kinds per place (the ARCHITECTURE.md "Biome, climate or place" leftover: volcanoes on Greenland and Norway, subtropical places on Mediterranean odds) | every day with mountains in view | 2–3 h | planned |
| 5 | PLAN_BIOMES phase 10 forms: barrier lagoon, spit, fjord mouth (design in PLAN_BIOMES.md §10, moved here) | ~10% of a few places' days | 8–15 h | later, after 1–4 |

**Order:** 0 → 1 → 2 → 4 → 3 → 5. Each phase is its own commit; phases 1, 2 and 4 change
params, so `params.mjs --ref HEAD` counts the days for each changelog row.

## Where we stand (measured 2026-11-12)

- **What the camera sees of the land:** the frame's far edge from the seaward azimuth
  (`camera.headingDeg − coast.seawardAzimuthDeg` + half the horizontal field of view), land days:

  | Composition | Seaward only (edge < 80°) | Along-shore at the edge (80–120°) | Inland in frame (> 120°) |
  |---|---|---|---|
  | `overlook` | 169 | 31 | 0 |
  | `shoreline` | 122 | 79 | 0 |
  | `framed` | 105 | 3 | 0 |
  | `along-beach` | 6 | 189 | 11 |
  | all 715 | 56% | 42% | 1.5% |

  So backland shows **along the shore** (the land side of an along-beach or shoreline frame,
  where a wall rises beside the beach) and **across the water** where the coast curves
  (`coast.curvature`: the far side of a bay is land at large `s`), almost never straight
  inland. A tall form a few km back reads in both; that's what decides "done" below.
- **Atacama–Peru today:** `hillHeight` 15–45 m; a `range` landform (900–2600 m at 12–45 km) on
  17% of its land days (`--scene '{"place":"atacama-peru"}'`); none of its 10 test-set land days
  has one.
- **The real Atacama coast:** the **Coastal Cliff of northern Chile** runs more than 1000 km along
  the Atacama Desert, the western edge of the Coastal Range, from a retreated fault scarp
  (Wikipedia); between Arica (18.5°S) and Taltal (25.4°S) its edge is ~700 m high (Paskoff), up to
  ~2000 m locally (Mortimer); summits behind it ~1500 m. Coastal benches lie at its foot in places.
  The foot's distance from the shore (the coastal plain where Iquique and Antofagasta stand) is
  *est.* 0.5–5 km: phase 0 measures it. Peru's coast has the lomas hills (~200–1000 m), with wider
  plains in places *(est.: phase 0)*.
- **Weather already there:** `weather.marineLayer` (`coastalWeather.ts`). On this coast the
  stratocumulus deck (*camanchaca*) sits against the cliff at ~300–1000 m *(est., well known; the
  lomas live in it)*: an escarpment gives the marine layer something to meet. Check how
  `marineLayer` draws its base before phase 2's renders.

## 0. Measure the real relief (`scripts/relief.mjs`, `knowledge/RELIEF.md`)

Numbers before shapes: for each place, sample real coasts and measure what rises behind them.

- **Elevation data:** AWS Terrain Tiles (Mapzen), public bucket, no key:
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, Web Mercator,
  height = (R × 256 + G + B / 256) − 32768 m (FME docs). Sources mix SRTM, GMTED, ETOPO1 and
  national DEMs (~30 m on land at z 12–13 *(check)*). **Attribution required** (Mapzen's terrain
  attribution list): record in REFERENCES.md; only derived numbers are committed, never tiles.
- **Coast points:** Natural Earth 10 m coastline (public domain), clipped to each place's
  latitude range and ocean, ~40 points per place, spaced along the line, fetched into a git-ignored
  `relief-src/` (same rule as NATURE_PLAN phase 0's `assets-src/`).
- **Per point:** the land normal from the coastline's direction; heights along it at 0.1, 0.25,
  0.5, 1, 2, 3, 5, 10, 20 km inland. Derived: max height within 2, 5 and 10 km; distance to the
  100, 300 and 600 m contours; the steepest 500 m of the profile (face slope); a kind:
  `plain` (< 30 m within 5 km), `rolling` (today's shape fits: < 120 m within 5 km, gentle),
  `escarpment` (rises > 300 m over < 2 km, foot within 10 km), `dune-sea` (from a sand mask:
  *open: no free global mask found yet; Namib checked by hand*), `cliffed` (> 50 m within 0.3 km:
  a cliff-top coast).
- **Per place:** the share of points of each kind and the median and quartiles of each number.
  Output `knowledge/RELIEF.md` (a table by place) and `src/reliefData.ts` (the numbers phase 1
  reads), with the script's command line in the doc so it can be rerun.
- **Check the method on known coasts first:** Iquique (escarpment ~600–800 m within ~2 km
  *(est.)*), the Wadden coast (plain), the Cliffs of Moher (cliffed), Big Sur (escarpment,
  steep), the Namib at Sandwich Harbour (dunes to the sea), Norway's fjords (high and steep).
  If any reads wrong, fix the method before the table.
- **Done when:** `RELIEF.md` has every land place, the six checks read right, and the places
  whose real kind differs from today's `rolling` are listed by days touched (`params.mjs
  --stats 'p => p.place.id'` on land days): that list orders phase 3.

## 1. `RELIEF` place table

- **Key:** a place field (geology of one stretch of coast, ARCHITECTURE.md "Biome, climate or
  place": one place's difference → a place field); add the row to that list.
- **Shape:** `relief?: { kind: ReliefKind, height: [lo, hi], footKm: [lo, hi], faceSlope:
  [lo, hi], share: number }` from `reliefData.ts`: on a day in that place, `share` (phase 0's
  share of that kind) chooses it; otherwise today's draw.
- **Randomness:** a new stream `Random.derive(seed, 'relief')`. **The 'hills' stream keeps its
  draw unchanged** (always drawn, then overridden), so places without a row, and days that don't
  pick the new kind, give exactly today's params.
- **Spec field:** `relief: ReliefKind | null` (null: today's hills); forced kind ignores the
  place's share but keeps its numbers (a place without a row gets the kind's median from
  `RELIEF.md`).
- **Tests:** the table over every place (no sampling); unforced places with no row unchanged
  (`params.mjs --ref HEAD` 0 days outside the rows' places); spec field in `sceneSpec.test.ts`.

## 2. Coastal escarpment

**Geometry (write down before code: COAST.md "Coordinates and heights", "A new seabed or shore
profile"):**

- In shore coordinates, a wall at `u = foot` (m inland of s = 0): height `H` (phase 1 row; for
  `atacama-peru` *est.* 500–1000 m, ~2 km foot), rising over `H / faceSlope` (a face of 25–40°
  *est.*), with gullies (the existing `fbm` at ~300 m) and a ragged foot along `a` (±20%). The
  plain in front keeps today's beach, dunes and low bumps (the hill term scaled down: real
  benches are flat). Above the edge, a high plateau with today's hill noise at ~0.3 × H.
- **Where it applies:** `terrainHeightAt` for `beach`, `rock-shore` (after `rockBack`) and
  `tidal-flat` profiles: one shared `escarpment(u, a)` term in GLSL and TS, added where `hills`
  is today (three places in `terrain.ts`, plus `beachHeight`).
- **Camera must stay on the plain:** every composition's camera `u` (`distanceToWater`, the
  framed and overlook placements, the "stepped inland" retries) must be < `foot − 200 m`;
  `overlook` stands "high on the hillside above the bay": on an escarpment day it stands on the
  plain's own bumps, never on the face *(decide by renders: a real overlook here would be on
  the cliff top 700 m up, which is a different composition; out of scope)*.
- **Forced extremes** (each tide stage × composition, `expectDryCameras`):

  | Case | Camera | Dry land | Wall |
  |---|---|---|---|
  | low, mid, high, spring tide × shoreline, along-beach, framed, overlook, platform, boulder, cliff top | on the plain, dry | unchanged in front of the foot | same `u`, whatever the tide (land height, not water) |
  | narrowest foot (lo) × widest beach and dunes | foot clamped to ≥ beach + dunes + 300 m | – | moves back |
  | storm swell | – | run-up and wet band unchanged | – |

- **Readers to update** (COAST.md list, the ones that apply to a land-side term): TS mirror
  `beachHeight`; `scripts/parity.mjs` (all coast kinds); `profile.mjs` (extend the map to show
  the wall; print foot and H); the terrain caster disc reaches 2 km (`createTerrainCaster`): a
  wall at 2–5 km won't cast into the near shadow map: **check at a low morning sun** (the sun
  rises behind the wall on a west-facing coast; real beaches lie in its shade after sunrise) and
  extend the caster or add the wall to it if it matters; snow line (`snowLook`, never on this
  coast); vegetation and plant placement on the face (bare: desert); haze on the wall at 2–10 km
  (`seaHaze.ts`: measure on a render with `haze.mjs` first, CLAUDE.md "Matching what an existing
  pass draws").
- **Colour:** the face is bare rock and scree: the biome's rock colours with the desert's ground
  colour; lomas tint (NATURE_PLAN 5b) by height in the season.
- **Grid:** the polar grid reaches 120 km with cells ~0.3–0.6% of r: at 3 km that's ~10–20 m,
  enough for a 700 m face. Check the silhouette for stair-steps with `--w 320` first.
- **Counts first:** land days in `atacama-peru` (10 in the test set) and how many show the wall in
  frame: cast rays through the TS height (`p.view` / a new `src.reliefInFrame(p)` probe in
  `params.mjs`) before rendering.
- **Done when:** an along-beach Atacama day shows the wall rising beside the beach; a curved
  bay shows it across the water; a shoreline day looking out to sea shows nothing new; the camera
  is never on the face; render time ~0% (`bench.mjs`); `diff.mjs --off '{"relief":null}'`.
- **Tests:** `test/relief.test.ts`: the term finite and mirrored (GLSL vs TS via parity); the
  forced-extremes table; the foot clamp; `expectDryCameras`; `npx vitest run test/glsl`.

## 3. Other backland kinds (from phase 0's list)

Candidates *(est., to confirm in phase 0)*: the **Namib dune sea** reaching the sea south of
Walvis Bay (dunes 100–300 m; a `dune-sea` kind: today's dune term scaled up and widened, no
hills behind); **cliffed plateaus** on beach days (the Great Australian Bight's Bunda Cliffs,
the Twelve Apostles, Dover: a beach under a cliff, as the rock shore's cliff top but seen from
the sand); **coastal plains** (flat places already opt out of mountains; `FLAT_LAND` in
`places.ts` may become phase 0's `plain` share). Each gets its geometry written down, a
forced-extremes table and the readers list as phase 2, in its own commit.

## 4. Landform chance and kinds per place

The ARCHITECTURE.md leftover: `pickLandform` keys chance and volcano share by biome, so
Greenland and Norway get volcanoes and subtropical places the Mediterranean's odds. Key it by
place from phase 0's numbers (max height within 20–50 km and real volcanoes in view: Smithsonian
GVP list *(to read)*), keep the stream's draw order, and update the ARCHITECTURE.md row. An
escarpment place's `range` moves behind the wall (it's the high Andes, 50–150 km off): the far
range's distance by place too.

## 5. Barrier lagoon, spit, fjord mouth (PLAN_BIOMES §10)

Design as written in PLAN_BIOMES.md §10 (separate heightfield meshes like `islands.ts`, the
shelter mask, `lagoonFrom` for the surf and swash code; spec `landform: "fjord"`, `lagoon`,
`spit`). Phase 0's coastline sampling also measures how often each occurs per place (lagoon
behind a barrier: water within 2 km inland of the beach; fjord: walls on both sides), replacing
§10's *est.* shares. Move §10's text here when this phase starts and leave a pointer in
PLAN_BIOMES.

## Decisions

- **Realism first, measured:** relief comes from real elevation data per place, not chosen by
  look. Shares and heights *(est.)* above are placeholders until phase 0.
- **Unforced days elsewhere unchanged:** new streams only; existing draws stay in order.
- **Ready for the move-around mode:** the wall is part of the height function in world shore
  coordinates, the same for any camera position on the plain.

## Still open

- `dune-sea` detection: no global sand mask found yet (phase 0 checks the Namib by hand).
- An escarpment-top `overlook` (the real view from the cliff top, 700 m up) is a new composition:
  out of scope until phase 2's renders say it's needed.

## Sources

- Coastal Cliff of northern Chile: https://en.wikipedia.org/wiki/Coastal_Cliff_of_northern_Chile (read);
  Paskoff, marine cliff of northern Chile: https://www.andeangeology.cl/index.php/revista1/article/download/V7n3-a01/pdf ;
  Mortimer, drainage of the Atacama: https://www.andeangeology.cl/index.php/revista1/article/download/V40n1-a04/pdf
- Terrain tiles: https://registry.opendata.aws/terrain-tiles , https://www.mapzen.com/blog/terrain-tiles-v1.1/ ,
  https://docs.safe.com/fme/html/FME-Form-Documentation/FME-ReadersWriters/terraintilesaws/terraintilesaws.htm
- Lomas: NATURE.md §1.3 and §8.
