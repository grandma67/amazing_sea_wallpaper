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
- **The real sun only from 63°** (2026-11-03, PLAN_BIOMES 12): at |latitude| ≥ 63° the day's real
  elevation range (`sunLimits`) limits the time of day and the sun's height, and midnight-sun
  days turn the heading to the sun's real compass bearing. Below 63° the drawn sun stays as it
  was (a real compass sun on every day and real winter noon heights are in "Ideas": they change
  many days).
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
     (`'marine-layer'`, deck on `'marine-layer-deck'`); dust (`'dust'`); whether a storm
     comes (`stormComes`: the `'storm'` stream's first draw, as `generateStorm` takes it); rainbow
     day (`'rainbow'`; none on a stormy day, so no turn from the sun and no wide lens; a forced
     rainbow keeps random storms away).
  5. Heading, sun elevation (main, within `sunRange`: the day's real range from 63°) and
     azimuth (main; eclipse and rainbow override; on midnight-sun days the heading becomes the
     sun's real compass bearing − `relSunAz`), Venus framing at blue hour (`'planet-framing'`: the sun's
     bearing and depth; NIGHT_SKY phase 5), moon direction within 5° of the ecliptic
     (`skyClock.ts`; main, at night the sun depth from `'moon-hour'`, then `'moon-framing'`), day
     moon and night sky (`'moon-sky'`); aurora (`'aurora'`: Kp, display, arcs; a low display is
     framed by turning sun and moon about the vertical, NIGHT_SKY phase 6).
  6. Camera height, focal length drawn (main, `keep`; aurora nights 14–24 mm from
     `'aurora-framing'`, rainbow days 14–22 mm, eclipses 24–35 mm: drawn here, the lens itself
     chosen in 7 by `lensFor`), wind speed and heading (main, `keep`).
  7. Storm (`'storm'`, `'storm-weather'`: overrides weather and wind); water (`'water'`); wind
     × basin, marine-layer wind cap; formations (`'formations'`, `'cloud-species'`);
     waterspout (`'waterspout'`); arrangement; fog (`'fog'`: calms the wind); an unforced aurora
     dropped by fog, storm or overcast (the sky turned back, so the night keeps its own lens,
     horizon and sky); then the lens (`lensFor`).
  8. Swell (`'swell'`); tide (`'tide'`); coast (`generateCoast`: `'coast'`, `'coast-kind'`,
     `'rock-shore'` and `'rock-camera'` on rock days, `'sand-colour'`,
     `'beach-material'` (material, grain, stone size, beach state and shape), `'reef'`,
     `'hills'`, `'composition'`).
  9. Colony, pinnipeds, lighthouse, landform, snow (`'snow'`, three draws always; brings the landform's line down), islands (`pick*`, own streams); shelf cloud,
     Sea ice (`'sea-ice'`, its draws always) comes earlier, just before the swell and the waves it calms.
     lenticular; rainbow geometry; title.
  10. Moon scale, horizon (aurora nights at least 0.6–0.68 from `'aurora-framing'`), roll, time,
      choppiness (main, `keep`).
  11. After `params` exists (read it whole): noctilucent, nacreous, roll cloud, contrails,
      visibility (`'visibility'`, reads `weather.dust`), night glow (`'night-glow'`, sun below
      the horizon only; reads the place's `bortle`), aurora (dropped in 7; adds
      "Northern/Southern lights" to the title), planets (no draw; sun down),
      meteors (`'meteors'`, night only; adds the shower's name to the title).

  Props decide later, at render, on `ctx.rng(kind)` (`props/choices.ts`).
- **Seasons** (`seasons.ts`): seasonal tables are written in northern-hemisphere months;
  `seasonMonth(day)` shifts the month by six south of the equator (sign of `latitudeDeg`),
  `season(day)` gives winter/spring/summer/autumn, `monthInSeason(day, from, to)` tests a range.
  Used by flowers (`FLOWERS`), fog season and sea smoke (`pickFog`), cloud summer
  (`addFormations`), polar nacreous winter, noctilucent season, Mediterranean summer haze and
  migratory passage. Not used by tables already in local months for one region: turtle nesting
  per place, waterspouts, the Morning Glory, polar ship seasons (by ocean), Arctic ice (north
  only). `seasonDay(day)` is the day of the year in the same terms (south + 182).
- **Plants and animals by season** (0.98; research SEASONS.md, plan plans/SEASONS_PLAN.md):
  `phenology.ts` `phenologyFor(params)` (no draws: date, climate, hemisphere) gives deciduous
  leaves `on`/`turned`/`fresh` and grass `dry` by climate (`LEAF_DAYS`, `DRY_DAYS`);
  `plantSeason(kind, phen)` feeds the tree and grass builders (`deciduousShare`,
  `autumnColors`, `AUTUMN_RED` places), `canopyTint` the distant woods (landforms, islands),
  `groundCoverTint` the terrain. Leaves turn and fall by `hash()` after the builder's draws, so
  trees keep their shape. `animalSeasons.ts`: colonies, humpbacks, seal haul-outs, crab and
  lizard dormancy, waterfowl, Arctic gulls (ANIMALS.md "Seasons"). `sargassumSeason` thins the
  sargassum wrack Oct–Mar by calendar month, except West Africa and northeast Brazil (0.100).
  `Place.drySeason` dries the grass on savanna coasts in their own calendar months, in the
  latitudes where that holds (0.101, 0.102). What
  phenology works out isn't in `SceneParams`, so `params.mjs --ref` doesn't count it.
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
| leaf colour and fall, grass dryness, deciduous share | `phenology.ts` | climate × hemisphere; `AUTUMN_RED` and the deciduous lenga by place | right |
| snow line by season | `phenology.ts` `SNOW_SEASON` | climate × hemisphere | right (the drawn line under it is the `pickLandform` leftover above) |
| fallen leaves by season | `phenology.ts` `LITTER_DAYS` | climate × hemisphere | right |
| lying snow, ice foot | `snow.ts` `SNOW_COVER`, `SNOW_PLACES`, `ICE_FOOT_PLACES` | climate × hemisphere, a place's own chance | right |
| sea ice | `seaIce.ts` `SEA_ICE_PLACES` | place × latitude, northern-equivalent day | right |
| colony birds, humpbacks, haul-outs, crab and lizard dormancy, waterfowl, gulls by season | `animalSeasons.ts` | climate × season (colonies, seals by kind) | right |
| beach flowers | `props/shoreLife.ts` `FLOWERS` | biome × ocean × month | **leftover**: Florida and Natal can bloom Mediterranean sea daffodil and horned poppy (should follow climate) |
| shells, starfish | `props/shoreLife.ts` `SHELLS` | biome × ocean | leftover (minor) |
| mangroves | `props/mangroves.ts` `CHANCE` | biome × ocean | **leftover**: Florida's and south Brazil's mangroves missing (subtropical) |
| waterspout season | `props/waterspout.ts` | biome | **leftover**: the Florida Keys (subtropical summer) get the Mediterranean's season |
| visibility, summer haze, dust season | `seaHaze.ts` | biome | leftover: humid subtropical summers get the Mediterranean's dry haze |
| rock growth, lichen colour | `props/rocks.ts` `GROWTH`, `rockShore.ts` `LICHEN` | biome | leftover (moisture follows climate) |
| landform vegetation tint | `props/landforms.ts` | biome (own table) | leftover: should read `biome.foliage` like islands |
| night-sky darkness (Bortle) | `places.ts` `BORTLE` | place (default 2) | right |
| aurora sites (geomagnetic latitude) | `aurora.ts` `AURORA_SITES` | place (a coast point; none = never) | right |
| lighthouse chance, contrail traffic, warm-water ships, orcas, Morning Glory, noctilucent | `params.ts`, `contrails.ts`, `props/ships.ts`, `props/marine.ts`, `skyEvents.ts`, `noctilucent.ts` | biome / ocean / latitude | right enough (geography, not weather) |

## Frame and post

- **Night colour** (`whiteBalance.ts`, `GradeEffect` in `scene.ts`): frames are a camera's. By
  day the render's white is daylight; blue hour has its cool balance (0.6, 0.85, 1.25); night
  frames are shot at 4000 K (`whiteBalanceGains`, Planckian locus → linear Rec. 709 gains,
  luminance kept: ≈ (0.67, 1.02, 1.77)). No night-vision grey: the moonlit sky is blue because
  the balance makes moonlight (sunlight) blue; the starlit sky teal-blue (airglow); the Milky Way,
  stars, lamps and aurora keep their colours. `debug.whiteBalance` reports it.

- **Post pipeline, in order** (`scene.ts`): scene (sky shader + its patches, stars, planets,
  moon, terrain, sea, props) → clouds + aerial perspective → sky fill → fog, lighthouse beams and
  **grade** (exposure × white balance, clamp 40) → rain → accumulate (cloudy days) → sky denoise
  → [probe] → bloom, vignette, AgX, saturation, contrast. Anything a feature adds goes through
  all of it: test colour and brightness with the probe (tools/DEBUG.md), not the shader output.
- **Exposure** is metered from the reflection cube's sky (`exposure.ts` `meterScene` over the
  env scene: 32² cube), not the frame. So everything patched into the env sky (night glow,
  aurora) moves the whole frame's exposure; stars and the aurora are hidden while metering (a
  photographer exposes for the scene, not for a display out of frame). Then × `nightScale`,
  `evBias` by time of day, eclipse and gloom terms; `params.debug.exposure` fixes it.
- `camera.ts` (pitch from `skyFrame.ts` `cameraPitch`, the same projection the choices use);
  `composition.ts` (ray-grid coverage, re-rolls bad framings; `frameView`: eye
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
  tables, meshes, specs, and with no GPU the whole prop tree (built, finite, shaded, freed) and a
  static read of the shaders. Which file for what: TOOLS.md "Tests".
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

- Snow (0.111): limits in plans/SNOW.md (a foot's end beside a very close camera, plain white far low
  land, no falling snow).
- Seasons (0.98): no leaves in the wrack; no larch (conifers stay green); tropical wet and dry seasons
  aren't modelled (only the tropical almond's red). The distant woods' autumn tint
  (`canopyTint` on landforms and islands) was tested in numbers, not checked in a render.
- Drawn snow lines (`pickLandform`, biome-keyed): tropical mountains can have snow below 3 km
  (32 of 61 tropical landform days; real tropical snow starts far higher), and the nordic biome's
  0.35–0.6 of the height is low for a temperate summer (west Norway ~630 m in late August).

- Light pollution (`nightGlow.ts`): low clouds aren't lit from below by the towns. At the
  night white balance (4000 K) the domes come out only mildly warm (sodium ~2100 K stays
  orange; the LED share pulls them neutral).
- Aurora (`aurora.ts`): clouds are lit by it (0.96), but on quiet starlit nights the glow barely
  shows: the clouds pass's stand-in sun (`scene.ts` `starlight`, nearly overhead, a sun's
  strength in the night's units) outweighs the display's physical light on cloud tops. The
  airglow's wave crests (`nightGlow.ts` bands) show more on aurora nights (+1.5 EV and a
  wider, higher frame) as faint slanted stripes low in the sky: they are the airglow's, not the
  aurora's (`passes.aurora: false` keeps them). Until 0.92 the airglow's sin() hash also made
  structure of its own at large cell coordinates; with the integer hash what shows is the
  crests as designed (the mirror predicts them: `params.mjs --line --sky glow`). A single-layer feature in the march (the 5 km
  N₂⁺ fringe) leaves ~3% grain at the arcs' lower edge on Kp ≥ 5 nights.

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
- **Dark land** (symptoms: "beach renders dark blue", "land near-black", "marsh black"): partly
  fixed by skylight from clouds (`place: "western-med"`, 2024-05-08, along-beach is sand-coloured
  now). Still dark and blue: `place: "brittany"`, 2025-07-10, along-beach, daylight, `weather:
  "broken"`, sun 160°: shaded sand exposes to ~0.03 with the sky at ~0.11. Likely cause, untested:
  exposure is metered from the clear sky, so it doesn't open up when the frame is in shade
  (plans/SHADOWS.md phase 6).
  That sand also reads less red than albedo × skylight predicts (raw 0.0069, 0.0076, 0.0112 against
  ~0.012 each); not traced.
- **Meter zenith:** `meterScene`'s `zenith` (`debug.skyZenith`) reads ~3× the env cube's own zenith
  luminance at the same sun (0.074 vs 0.023 at 60°). Not traced; the cube's is the darker part of
  the sky, as it should be. Only a stat so far.

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
