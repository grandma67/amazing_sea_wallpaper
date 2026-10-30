# Architecture

A daily, date-seeded, photorealistic 4K sea-and-beach wallpaper, rendered **in the browser with
three.js** and hosted on GitHub Pages. Same date → same scene everywhere; any date can be
re-rendered, so the archive is free.

How each area works (read the one you touch):

| Doc | Covers |
|---|---|
| [arch/SKY.md](arch/SKY.md) | atmosphere, clouds, storms, moon and eclipses, coastal weather, haze, fog, light reaching sea and sand |
| [arch/OCEAN.md](arch/OCEAN.md) | spectrum, surf, calm water (shelter), rocks in the sea |
| [arch/COAST.md](arch/COAST.md) | **coordinates and heights**, coast kinds, sand, beach material, beach state, tides, reefs, bars/rips/cusps, stones |
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
  1. Eclipse (`'eclipse'`), moon phase; `'moon-sky'` stream made.
  2. Place (main, first draw; one float even when a spec restricts it) → ocean, monsoon, ice and
     latitude (`'ocean'`), climate (`'climate'`), biome with `plantsFor` (no draw).
  3. Time of day, evening (main).
  4. Weather kind and coverage (`'weather'`, `generateWeather`); eclipse fix-up; marine layer
     (`'marine-layer'`, deck on `'marine-layer-deck'`); dust (`'dust'`); rainbow day
     (`'rainbow'`).
  5. Heading, sun elevation and azimuth (main; eclipse and rainbow override), moon direction
     (main, `'moon-framing'`), day moon and night sky (`'moon-sky'`).
  6. Camera height, focal length (main, `keep`), wind speed and heading (main, `keep`).
  7. Storm (`'storm'`, `'storm-weather'`: overrides weather and wind); water (`'water'`); wind
     × basin, marine-layer wind cap; formations (`'formations'`, `'cloud-species'`);
     waterspout (`'waterspout'`); arrangement; fog (`'fog'`: calms the wind).
  8. Swell (`'swell'`); tide (`'tide'`); coast (`generateCoast`: `'coast'`, `'sand-colour'`,
     `'beach-material'` (material, grain, stone size, beach state and shape), `'reef'`,
     `'hills'`, `'composition'`).
  9. Colony, pinnipeds, lighthouse, landform, islands (`pick*`, own streams); shelf cloud,
     lenticular; rainbow geometry; title.
  10. Moon scale, horizon, roll, time, choppiness (main, `keep`).
  11. After `params` exists (read it whole): noctilucent, nacreous, roll cloud, contrails,
      visibility (`'visibility'`, reads `weather.dust`).

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
  redirects to a random past day. Prev/next reload the whole page.
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
heading and coast orientation together).

## Known issues

Coast and surf:
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
- Tidepools are runnels and puddles on the terrace (shader patches), not pools among rocks.
- `place: "western-med"`, 2024-05-08, along-beach daylight front-lit: the whole beach renders dark
  blue (same at a6ac87a, before tides).
- Stony beaches: shingle reads as a flat mottled colour on most 1080p views (a 2–5 cm pebble is
  under a pixel past ~10 m at eye height; the nearest ground is often 20–40 m); `framed` stands
  15–60 m inland behind the plants, so it never has stones in the foreground. Iceland (volcanic
  biome) gets the volcanic default plants, including palms; its basalt cobbles render brown
  (palette mean pulled up by the red scoria entry and exposure).

Sky:
- Waterspouts: the fog rule never applies and they're far rarer than intended (1 in 3 years):
  [plans/WATERSPOUT_FOG.md](plans/WATERSPOUT_FOG.md).
- Backlit shelf cloud at sunset is a flat pink band (takram aerial perspective on the mesh;
  e.g. 2010-04-01).
- 2026-02-13: sparkly dots in the air over the sea.

Props:
- 2026-05-01: a sailboat drawn as a bare, steeply tilted mast.
- Elephant seals within ~25 m look like smooth boulders (beach herds keep 30 m off); hippos are
  stylised up close (barrel + boxy head).
- Physically subtle (not bugs): Posidonia wrack at normal distance, hatchlings (5 cm) beyond
  ~10 m, crawl tracks at grazing angles, wakes at the usual 300 m+, ship lights at dawn,
  noctilucent clouds, rock foam against a low sun.
