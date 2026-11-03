# Architecture

A daily, date-seeded, photorealistic 4K sea-and-beach wallpaper, rendered **in the browser with
three.js** and hosted on GitHub Pages. Same date → same scene everywhere; any date can be
re-rendered, so the archive is free.

How each area works (read the one you touch):

| Doc | Covers |
|---|---|
| [arch/SKY.md](arch/SKY.md) | atmosphere, clouds, storms, moon and eclipses, coastal weather, haze, fog, light reaching sea and sand |
| [arch/OCEAN.md](arch/OCEAN.md) | spectrum, surf, calm water (shelter), rocks in the sea |
| [arch/COAST.md](arch/COAST.md) | **coordinates and heights**, coast kinds, rocky shores, sand, beach material, beach state, tides, reefs, bars/rips/cusps, stones |
| [arch/PROPS.md](arch/PROPS.md) | plants, mangroves, islands, lighthouse, debris, shore life, wildlife, pinnipeds, storms and animals, ships and their lights |

What appears where and how often: [COASTS.md](COASTS.md), [CLOUDS.md](CLOUDS.md),
[ANIMALS.md](ANIMALS.md). Pitfalls: [LESSONS.md](LESSONS.md). Tools: [TOOLS.md](TOOLS.md),
[SCENE_SPECS.md](SCENE_SPECS.md). Sources: [REFERENCES.md](REFERENCES.md). Versions:
[changelog.md](../changelog.md).

## Stack

Vite + TypeScript, three.js `WebGLRenderer`, `@takram/three-atmosphere` (Bruneton sky, aerial
perspective, stars), `@takram/three-clouds` (volumetric clouds, shadows, light shafts), pmndrs
`postprocessing` (required by takram; AgX, bloom), `astronomy-engine` (moon, eclipses),
Playwright (headless snapshots), Vitest.

## Decisions

- **Web-only rendering** (2026-10-13): static Pages site, each visitor's browser renders the day.
  Seed → params is exactly deterministic; pixels may differ slightly across GPUs. A still can
  afford seconds. Rejected: Blender/Cycles headless (render step outside the browser), AI image
  generation (paid, less control).
- **Procedural props, no downloaded models:** zero asset weight, per-date variety.
- **Stills averaged over many frames** (64 by default) so stochastic clouds converge.
- **Overlap CPU and GPU at startup** (2026-10-15): `precomputeAtmosphere()` (`scene.ts`) issues
  takram's passes at once (its generator yields between them) so props build while the GPU
  computes the sky.
- **Clouds at full resolution on beaches** (2026-10-15): half-res clouds and light shafts upsampled
  across trees and ridges gave glowing rims; depth-aware upsampling can't recover twigs thinner
  than a texel. Cloudy 4K beach ~5 → ~9 s.
- **One draw: the place, before the sky** (2026-10-23, PLAN_BIOMES 1a): each day draws a real
  stretch of coast (`places.ts`) as the first main-stream draw; biome, ocean, climate and latitude
  follow, so the sky can depend on the place. Weights: √ of each region's coastline length, split
  among its places by length (raw length would make ~70% of days Arctic and nordic). Reshuffled
  every date once, deliberately.
- **Old dates may change on purpose, never by accident** (2026-10-23): a feature may change the
  days it is about (say which in the changelog), but every feature draws on its own stream and
  specs draw, then force, so nothing cascades into unrelated draws.
- **Tides lower the land** (2026-10-24, PLAN_BIOMES 5): sea level 0 stays everywhere; terrain and
  everything on it sit `tide.level` lower (arch/COAST.md).
- **Calm water is one shelter mask** (PLAN_BIOMES 6) shared by reefs and, later, lagoons and fjords.
- **Biome is a constant of the place, climate a choice of it** (PLAN_BIOMES 11): no new biomes.
- **Cheaper rendering must not change the image.** Rejected for speed: shipping precomputed
  atmosphere LUTs (10–48 MB, slightly different sky), caching sky textures between visits
  (~48 MB of float 3D textures), dropping the higher-order scattering texture (sky and aerial
  perspective use it), one shared clouds effect for all env-cube faces (fragile), fewer frames or
  lower cloud resolution (the cloud shadow map hasn't converged by 32 frames).

## Params and randomness

- `random.ts`: cyrb128 + sfc32; `Random.derive(seed, name)` gives independent streams, so a new
  feature doesn't shift other draws. `params.ts`: date → `SceneParams` (time of day, sun/moon,
  weather, storm, rainbow, place, ocean, biome, coast, landform, colony, camera, wind, title).
- **Places** (`places.ts`; data and weights: REGIONS.md §1): ~90 places in regions. Constants
  (`biome`, `region`, signed `latitude`, `km`, `tide`, `reef`), choose-one weights (`ocean`,
  `climate`, `sand`, `material`) and choose-many pools (`animals`, `plants`); defaults merge
  biome → region → place. `params.place` = `{ id, region, climate, hemisphere }`; `params.biome`
  and `params.sea.ocean` stay for every reader. `latitudeDeg` is signed (south negative): code
  that means "distance from the equator" uses `Math.abs`. Specs: `place` (place or region id);
  `biome`, `ocean`, `climate` restrict the draw to places that have them and force the choice;
  `placesFor()` throws on a combination no place has.
- **Draw order in `buildParams`** (read this before adding a decision, then open only that part
  of `params.ts`). *main* = the main `rng` (its draws after the sky are pinned with `keep()`);
  `'x'` = `Random.derive(seed, 'x')`. A decision can only read what's above it.
  1. Eclipse drawn (`'eclipse'`); `'moon-sky'` stream made.
  2. Place (main, first draw; one float even when a spec restricts it) → ocean, monsoon, ice and
     latitude (`'ocean'`), climate (`'climate'`), biome = `placeBiome(place, climate)`
     (`climateBiome`: the climate's sands, plants and greens) with `plantsFor` (no draw).
     At |latitude| ≥ 63° the day's real sun (`sunLimits`, no draw): a solar eclipse is dropped
     in the polar night; then the eclipse type and moon phase.
  3. Time of day (main; one draw over `timeWeights(realSun)`: categories the sun can't reach
     get 0 from 63°), evening (main).
  4. Weather kind and coverage (`'weather'`, `generateWeather`); eclipse fix-up; marine layer
     (`'marine-layer'`, deck on `'marine-layer-deck'`); dust (`'dust'`); rainbow day
     (`'rainbow'`).
  5. Heading, sun elevation (main, within `sunRange`: the day's real range from 63°) and
     azimuth (main; eclipse and rainbow override; on midnight-sun days the heading becomes the
     sun's real compass bearing − `relSunAz`), Venus framing at blue hour (`'planet-framing'`: the sun's
     bearing and depth; NIGHT_SKY phase 5), moon direction within 5° of the ecliptic
     (`skyClock.ts`; main, at night the sun depth from `'moon-hour'`, then `'moon-framing'`), day
     moon and night sky (`'moon-sky'`).
  6. Camera height, focal length (main, `keep`), wind speed and heading (main, `keep`).
  7. Storm (`'storm'`, `'storm-weather'`: overrides weather and wind); water (`'water'`); wind
     × basin, marine-layer wind cap; formations (`'formations'`, `'cloud-species'`);
     waterspout (`'waterspout'`); arrangement; fog (`'fog'`: calms the wind).
  8. Swell (`'swell'`); tide (`'tide'`); coast (`generateCoast`: `'coast'`, `'coast-kind'`,
     `'rock-shore'` and `'rock-camera'` on rock days, `'sand-colour'`,
     `'beach-material'` (material, grain, stone size, beach state and shape), `'reef'`,
     `'hills'`, `'composition'`).
  9. Colony, pinnipeds, lighthouse, landform, islands (`pick*`, own streams); shelf cloud,
     lenticular; rainbow geometry; title.
  10. Moon scale, horizon, roll, time, choppiness (main, `keep`).
  11. After `params` exists (read it whole): noctilucent, nacreous, roll cloud, contrails,
      visibility (`'visibility'`, reads `weather.dust`), night glow (`'night-glow'`, sun below
      the horizon only; reads the place's `bortle`), planets (no draw; sun down), meteors
      (`'meteors'`, night only; adds the shower's name to the title).

  Props decide later, at render, on `ctx.rng(kind)` (`props/choices.ts`).
- **Seasons** (`seasons.ts`): seasonal tables are written in northern-hemisphere months;
  `seasonMonth(day)` shifts the month by six south of the equator (sign of `latitudeDeg`),
  `season(day)` gives winter/spring/summer/autumn, `monthInSeason(day, from, to)` tests a range.
  Used by flowers (`FLOWERS`), fog season and sea smoke (`pickFog`), cloud summer
  (`addFormations`), polar nacreous winter, noctilucent season, Mediterranean summer haze and
  migratory passage. Not used by tables already in local months for one region: turtle nesting
  per place, waterspouts, the Morning Glory, polar ship seasons (by ocean), Arctic ice (north
  only).
- **Scene specs** (`sceneSpec.ts`, SCENE_SPECS.md): typed, validated JSON.
  `generateParams(date, attempt, aspect, spec)` applies it at each decision but still makes
  every draw. Forcing the time of day changes how many main-stream draws the sky makes, so later
  main-stream draws (lens, wind, horizon…) are pinned to the unforced day's (`keep()`). Prop
  choices reach props as `params.overrides`; a final `params` deep patch covers the rest.
- **Prop choices without rendering:** `props/choices.ts` `propChoices(params)` runs each
  creator's pure `xxxFor(params, rng)` (gulls, marine, migratory, wildlife, shore life, debris,
  mangroves) on its own stream, for `scripts/params.mjs` (`p.props`), `scripts/animals.mjs` and
  tests.

### Biome, climate or place: what keys each table

The biome is a look preset shared by places that differ (`mediterranean` is also Florida, Taiwan
and Natal; `volcanic` is Hawaii and Kamchatka). Key a table by what it follows (LESSONS.md "Coast
and terrain"): **rock** → biome; **weather** (plants, clouds, fog, haze, wrack, animals) → the
day's `place.climate`; **one place's difference** → a place field (`places.ts`). Before a phase
that touches one of these, read this list; when adding a biome-keyed table, add it here. Find
them with `grep -rnE "Record<(Biome\['name'\]|BiomeName)|biome\.name|biome === '" src`.

| Table / check | File | Keyed by | Status |
|---|---|---|---|
| `rockColors`, `seaStackChance`, `STONE_COLORS`, `MATERIAL_CHANCES`, `ROCK_BY_BIOME`, coral grain | `biome.ts`, `beach.ts`, `places.ts`, `beachState.ts` | biome (rock), place overrides | right |
| sands, plants, ground cover, foliage, boulder chance | `biome.ts` `climateBiome` | biome × climate, place pools on top | phase 11 |
| cloud leanings, storm chance, big swell | `params.ts` `cloudLeaning`, `stormChance`, `BIG_SWELL` | climate | phase 11 |
| advection fog | `params.ts` `pickFog` | biome × ocean × `CLIMATE_FOG` | phase 11 (partly) |
| wrack, coconuts | `props/debris.ts` | biome, then climate on mediterranean and volcanic | phase 11 |
| ghost, hermit, shore crabs | `props/shoreLife.ts` | climate | phase 11 |
| seals, colonies, migratory birds | `params.ts` `pinnipedTable`, `pickColony`; `props/migratory.ts` | climate (seals: biome × ocean table under it) | phase 11 |
| landform chance, volcano chance, snow line | `params.ts` `pickLandform` | biome; flat places opt out (`mountains`) | **leftover**: volcanoes on Greenland and Norway, subtropical places get the Mediterranean's odds (phase 10: per place) |
| island kinds | `params.ts` `ISLANDS` | biome; flat places only low ones | **leftover**: phase 10 |
| beach flowers | `props/shoreLife.ts` `FLOWERS` | biome × ocean × month | **leftover**: Florida and Natal can bloom Mediterranean sea daffodil and horned poppy (should follow climate) |
| shells, starfish | `props/shoreLife.ts` `SHELLS` | biome × ocean | leftover (minor) |
| mangroves | `props/mangroves.ts` `CHANCE` | biome × ocean | **leftover**: Florida's and south Brazil's mangroves missing (subtropical) |
| waterspout season | `props/waterspout.ts` | biome | **leftover**: the Florida Keys (subtropical summer) get the Mediterranean's season |
| visibility, summer haze, dust season | `seaHaze.ts` | biome | leftover: humid subtropical summers get the Mediterranean's dry haze |
| rock growth, lichen colour | `props/rocks.ts` `GROWTH`, `rockShore.ts` `LICHEN` | biome | leftover (moisture follows climate) |
| landform vegetation tint | `props/landforms.ts` | biome (own table) | leftover: should read `biome.foliage` like islands |
| night-sky darkness (Bortle) | `places.ts` `BORTLE` | place (default 2) | right |
| lighthouse chance, contrail traffic, warm-water ships, orcas, Morning Glory, noctilucent | `params.ts`, `contrails.ts`, `props/ships.ts`, `props/marine.ts`, `skyEvents.ts`, `noctilucent.ts` | biome / ocean / latitude | right enough (geography, not weather) |

## Frame and post

- `camera.ts`; `composition.ts` (ray-grid coverage, re-rolls bad framings; `frameView`: eye
  height, pixel angle and nearest ground in frame, for `params.mjs` `p.view`); `reflection.ts`
  (planar reflection).
- `accumulate.ts` + `stillScene.ts`: render the scene once, redraw only clouds/spray per frame
  (Halton sub-pixel jitter; takram's cloud TAA history off). A second sky-less render gives each
  pixel's geometry coverage and `SkyFillEffect` blends the finished sky into silhouette pixels.
  `skyDenoise.ts` smooths light-shaft grain once.

## Page, cache, CI

- `main.ts`: portrait/landscape, device-aware size, prev/next/today/random, download (Today greyed
  on today). A click/tap outside the bar toggles it (`data-ui` on `<html>`): phones start shown,
  PCs hidden (hover reveals); hidden on phones = no pointer events. `random/index.html`
  redirects to a random past day (direct visits). ← → Today Random swap the day in place
  (`showDay`, `history.pushState`; Back/Forward via `popstate`): size, shape and `?worker`/`?frames`
  stay the first address's. Each day gets a new canvas and render worker; the old one is
  terminated first. `renderScene` frees every GPU resource once the frame is in the canvas
  (`src/dispose.ts`) and returns `dispose()` (context loss). Rules and check: [LEAKS.md](LEAKS.md).
- **Render cache** (`public/sw.js`, `renderCache.ts`): the 10 most recently viewed renders (JPEG
  0.95, Cache Storage, LRU) keyed by build commit (`__BUILD_ID__`), date, size, frames, portrait,
  spec; a hit is drawn straight to the canvas (~60 ms) and the render worker stopped. The page
  reads and stores via `rendered/*.jpg` GET/PUT that only the worker answers. Off in dev and under
  `navigator.webdriver`; `?cache=1|0` forces. A first visit renders before the worker controls
  the page, then stores.
- **Mesh preview:** `tools/mesh.html` + `src/meshPreview.ts` (dev only), screenshot by
  `scripts/mesh.mjs`.
- **Tests** (`test/`, Vitest, `npm test`, also in CI before the build): logic, not rendering —
  PRNG, dates, FFT, `generateParams` invariants over three years, terrain/surf mirrors, choice
  tables, meshes, specs.
- **CI** (`.github/workflows/pages.yml`): deploys on push and daily at 00:05 UTC renders
  `/latest.jpg` (1920×1080) and `/latest-portrait.jpg` (1290×2796) with SwiftShader (24 frames).

## Ideas (not planned)

Breaking-wave lips, ambient occlusion under trees, low-power mode for phones, wind-blown sand and
leaves, lamp reflections on wet sand, lit windows on cruise ships, ship roll resonance, wakes
rolling onto the beach as surf, turtle heads at sea, a real compass sun on every day (ties framing,
heading and coast orientation together; midnight-sun days already have it, PLAN_BIOMES 12), the
real sun's elevation range below 63° (mid-latitude winters still get a 35–70° "midday": at 50° the
December noon is 17° up; changes many winter days, ask first).

## Known issues

- Light pollution (`nightGlow.ts`): the domes' warm colour is lost to the scotopic grade
  (`GradeEffect` turns dim light blue), and low clouds aren't lit from below by the towns.

Places and climate:
- Landforms and islands are still chosen by biome (`pickLandform`, `ISLANDS`): nordic places
  without volcanoes (Greenland, Norway) draw one on ~6% of their landform days, and subtropical
  places have the Mediterranean's volcano odds; only flat places (`mountains: false`) opt out.
  A per-place landform table belongs to phase 10.
- Live oak, slash pine, cabbage palm and saw palmetto reuse the `broadleaf`, `stone-pine`, `palm`
  and `bush` meshes (coconut-like crowns, a generic oak).

Coast and surf:
- Beach shoreline and along-beach cameras are placed at the drawn distance from the water in s,
  but the coast's wobble at a = 0 (±25 m) shifts them (rocky shores and flats correct for it with
  `wobbleAtCamera`): 12 of 433 beach days (2.8%) stand in the water, most at low tide on a terrace
  (`params.mjs --rendered --stats 'p => p.ctx.ground(0, 0) < 0' --where 'p => p.coast.type ===
  "beach"'`; found by `expectDryCameras`). Fixing it reframes about half of all beach days: ask
  first.
- Run-up doesn't depend on the beach state: on flat dissipative beaches the high-tide line lies
  ~35 m and the storm line (`beachLines`, 2.2 × run-up, capped at 2.3 × width) up to ~120 m inland
  (`profile.mjs` on Namibia 2024-06-11), so the wet band is very wide and storm-line debris sits
  far back; on steep gravel it is ~1 m. A Stockdon-type run-up (∝ slope × √(H0 L0) on steep
  beaches, ∝ √(H0 L0) on flat ones) would fix both, at the cost of re-tuning the wrack lines.
- At low tide on terraced rip beaches the emerged inner bar and rip channels show as
  straight-edged shelves near the water (`scenes/tides.json` brittany-low): they were shaped to be
  seen underwater.
- Waves re-form at full height behind a sandbar (surf is local-depth only; real broken waves
  decay toward ~0.4 × depth, Dally et al. 1985). The shelter mask covers reefs, not bars; doing it
  for bars changes every barred day.
- Longshore bars have no trough: OzCoasts gives 2–3 m behind the bar, our bare profile ~1 m (only
  rip channels are scoured).
- Beach-state shares vs Australia's census: transverse bar–rip under-drawn, longshore and
  dissipative over-drawn. A retune is proposed in COASTS.md "Beach state and tides" (not done; ask first, it
  changes every beach day).
- The reef's shelter is a straight line: swell through a pass doesn't spread into the lagoon
  (the pass is only deeper, no white water). Basins could stand in.
- Reef crest foam is a band timed with the surf cycle, not breaking waves (the surf model breaks
  them on a ~2 m strip of the steep face); against a low sun ahead it fades into the glare.
- Icebergs get the contact reflection but no wash band or island foam (not `waterline`-tagged:
  ice has its own look). Island spray bursts are a few-centimetre droplets, so at ~850 m they're
  faint specks; the wash band carries the rough-sea look. A tagged prop's wash band shares its
  material: all islands of a day get the same band (same open-sea waves).
- Tidepools are runnels and puddles on the terrace (shader patches), not pools among rocks.
- Stony beaches: shingle reads as a flat mottled colour on most 1080p views (a 2–5 cm pebble is
  under a pixel past ~10 m at eye height; the nearest ground is often 20–40 m); `framed` stands
  15–60 m inland behind the plants, so it never has stones in the foreground. Iceland (volcanic
  biome) gets the volcanic default plants, including palms; its basalt cobbles render brown
  (palette mean pulled up by the red scoria entry and exposure).

Rocky shores (PLAN_BIOMES 8):
- Near bed risers on a platform seen along the shore (10–40 m) can show a row of small dark
  notches (grid aliasing: a 2× grid halves them; there before the view-wedge grid too, then fewer
  and bigger). The far scarp and cliff saws were fixed by the view-wedge grid (0.76).
- A cliff's rounded crest near the camera is smooth and bare: in low light it reads as sand.
- A low platform at a cliff's foot is topped by big waves, which then wash over it as foam: no
  burst against the cliff behind (`edgeRocks` takes only the first face at the water).
- Midday boulder shores render up to ~20% slower than the same day as a beach (a 3×3 cell search
  in every height sample; bench noisy); rocky days overall +8%.
- Seabird mainland colonies and point lighthouses use their beach placement on rocky shores
  (not checked in renders).
- No shadows from the cliff or ledges on the terrain itself (lighting by normal only).

Tidal flats and salt marsh (PLAN_BIOMES 9):
- Only ~0.3% of days (the five places are 1.94% of days). More flat places (Severn, Gulf of
  Khambhat, Argentine gulfs, Gulf of Carpentaria) would raise it.
- Behind Wadden marshes stand sea dikes, not hills; the place's plants put conifers and birch
  behind (northern pool), and Mont-Saint-Michel can draw skerries and conifer islands.
- At high tide the flooded flat in front of a marsh beach keeps the open sea's swell displacement
  further out (only surf and run-up are damped; no shelter mask).
- Driftwood logs can be heaped on a marsh beach's marsh (debris storm line), even in treeless bays.
- Seals on sandbanks and waders on the flats (phase 14) are missing.

Light:
- **Dark land** (symptoms: "beach renders dark blue", "land near-black", "marsh black"): on
  `weather: "broken"` days land is lit almost only by the sky (marsh, beach and sand alike;
  Mont-Saint-Michel 2025-07-10 along-beach, same at 0bf8187), and `place: "western-med"`,
  2024-05-08, along-beach daylight front-lit renders the whole beach dark blue (same at a6ac87a,
  before tides). Probably one cause (cloud shadow or sky irradiance on the terrain); not traced.

Sky:
- Waterspouts: the fog rule never applies and they're far rarer than intended (1 in 3 years):
  [plans/WATERSPOUT_FOG.md](plans/WATERSPOUT_FOG.md).
- 2016-08-09: the title's mountain range (36 km, 1.6 km high, in frame) can't be seen even with
  `fog: null`: lost in haze against a 3° sun. Not traced.
- Backlit shelf cloud at sunset is a flat pink band (takram aerial perspective on the mesh;
  e.g. 2010-04-01).
- 2026-02-13: sparkly dots in the air over the sea.
- Night sky units (NIGHT_SKY phase 2, until phase 3): the drawn sky has no natural background
  (airglow), so under a thin crescent the sky is darker than a real one and stars stand out too
  much, and twilight below ~−13° is darker than airglow; a lunar eclipse dims the moonlight but
  not the drawn sky, so its stars stay hidden. Starlit skies are still Rayleigh blue.

Props:
- 2026-05-01: a sailboat drawn as a bare, steeply tilted mast.
- Elephant seals within ~25 m look like smooth boulders (beach herds keep 30 m off); hippos are
  stylised up close (barrel + boxy head).
- Physically subtle (not bugs): Posidonia wrack at normal distance, hatchlings (5 cm) beyond
  ~10 m, crawl tracks at grazing angles, wakes at the usual 300 m+, ship lights at dawn,
  noctilucent clouds, rock foam against a low sun.
