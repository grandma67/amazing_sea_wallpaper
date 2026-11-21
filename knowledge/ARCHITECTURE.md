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
[ANIMALS.md](ANIMALS.md). Pitfalls: [LESSONS.md](LESSONS.md) (index of `lessons/`). Bugs and gaps:
[KNOWN_ISSUES.md](KNOWN_ISSUES.md). Tools: [TOOLS.md](TOOLS.md),
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
  8. Sea ice (`'sea-ice'`, its draws always; before the swell and the waves it calms); swell
     (`'swell'`); tide (`'tide'`); coast (`generateCoast`: `'coast'`, `'coast-kind'`,
     `'rock-shore'` and `'rock-camera'` on rock days, `'sand-colour'`,
     `'beach-material'` (material, grain, stone size, beach state and shape), `'reef'`,
     `'hills'`, `'composition'`).
  9. Colony, pinnipeds, lighthouse, landform, snow (`'snow'`, three draws always; brings the
     landform's line down), islands (`pick*`, own streams); shelf cloud, lenticular; rainbow
     geometry; title.
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
  mangroves) on its own stream, for `scripts/scene/params.mjs` (`p.props`), `scripts/scene/animals.mjs` and
  tests.

### Biome, climate or place: what keys each table

The biome is a look preset shared by places that differ (`mediterranean` is also Florida, Taiwan
and Natal; `volcanic` is Hawaii and Kamchatka). Key a table by what it follows (lessons/COAST.md "Coast
and terrain"): **rock** → biome; **weather** (plants, clouds, fog, haze, wrack, animals) → the
day's `place.climate`; **one place's difference** → a place field (`places.ts`). Before a phase
that touches one of these, read this list; when adding a biome-keyed table, add it here. Find
them with `grep -rnE "Record<(Biome\['name'\]|BiomeName)|biome\.name|biome === '" src`.

| Table / check | File | Keyed by | Status |
|---|---|---|---|
| `rockColors`, `seaStackChance`, `STONE_COLORS`, `MATERIAL_CHANCES`, `ROCK_BY_BIOME`, coral grain | `biome.ts`, `beach.ts`, `places.ts`, `beachState.ts` | biome (rock), place overrides | right |
| sands, plants, ground cover, foliage, boulder chance | `biome.ts` `climateBiome` | biome × climate, place pools on top | phase 11 |
| cloud leanings, storm chance, big swell | `params.ts` `cloudLeaning`, `stormChance`, `BIG_SWELL` | climate | phase 11 |
| lightning's charge height (−15 °C level) | `lightning.ts` `CHARGE_HEIGHT_M` | climate × season (hemisphere-aware) | right |
| advection fog | `params.ts` `pickFog` | biome × ocean × `CLIMATE_FOG` | phase 11 (partly) |
| wrack, coconuts | `props/debris.ts` | biome, then climate on mediterranean and volcanic | phase 11 |
| ghost, hermit, shore crabs | `props/shoreLife.ts` | climate | phase 11 |
| seals, colonies, migratory birds | `params.ts` `pinnipedTable`, `pickColony`; `props/migratory.ts` | climate (seals: biome × ocean table under it) | phase 11 |
| landform chance, volcano chance, snow line | `params.ts` `pickLandform` | biome; flat places opt out (`mountains`), coasts with no volcano in sight too (`volcanoes`, 0.212) | **leftover**: subtropical places get the Mediterranean's odds (TERRAIN_FORMS phase 4: per place) |
| island kinds | `params.ts` `ISLANDS` | biome; flat places only low ones | **leftover**: phase 10 |
| leaf colour and fall, grass dryness, deciduous share | `phenology.ts` | climate × hemisphere; `AUTUMN_RED` and the deciduous lenga by place | right |
| snow line by season | `phenology.ts` `SNOW_SEASON`, `TROPICAL_SNOW_LINE` | climate × hemisphere; the tropics one line all year (0.211) | right (the drawn line under it is the `pickLandform` leftover above) |
| fallen leaves by season | `phenology.ts` `LITTER_DAYS` | climate × hemisphere | right |
| blossom (rock rose, gorse, wattle; flamboyant, pōhutukawa) | `phenology.ts` `BLOOM` | place × local calendar month (gorse: a northern and a southern row); flamboyant by the place's dry season (`onDryCoast`) | right |
| tree flowers (oak and holm-oak catkins, olive, umbrella thorn, gum blossom; red flowering gum) | `phenology.ts` `BLOOM` (`where`) | climate × northern-equivalent month, where the place's plant pool holds the tree (`poolHas`); holm oak: Mediterranean climate minus California, the Cape, Chile, SW Australia; gums and the red flowering gum by place, local months | right |
| shrub species on `bush` (sea buckthorn, blackthorn, lentisk, sea grape, naupaka, mānuka, willow…) and their flowers and fruit | `shrubs.ts` `SHRUBS`; `BLOOM` and `FRUIT` rows with `species` | place lists (willow: northern boreal and polar climate), local calendar months (willow: the climate's leaf days) | right |
| fruits, cones, catkins, propagules | `fruits.ts` `FRUIT` | plant kind × climate (palms: tropical coconut, subtropical dates, Florida's sabal) × northern-equivalent day; spruce crop by calendar year and place (`mastYear`, a hash) | right |
| bloom years (desert bloom, Namaqualand, Baja) | `bloomYears.ts` `bloomRegion`, `bloomYear`, `desertBloomFor` | place × ocean × latitude; one draw per region and calendar year; local calendar months | right |
| lomas (fog-hill green) | `phenology.ts` `LOMAS`, `lomasFor` | place (`atacama-peru`, 6–30°S) × local calendar day | right |
| salt on plants (canopy wedge, shrub lee), spray belt | `phenology.ts` `sprayExposure`, `saltCanopy`, `SHRUB_LEE`; `shrubs.ts` `SALT_TOLERANCE` | place (exposure lists; default by distance from s = 0), shrub species | right |
| fireflies and glow-worms | `props/fireflies.ts` `FIREFLY_REGIONS`, `firefliesFor`, `fireflyWeather` | place × local calendar month (peak ×1, else ×0.4); the evening, moon and weather by kind | right |
| mushrooms: season and kinds | `phenology.ts` `FUNGUS_SEASON`, `fungiSeason`; `props/fungi.ts` `FUNGI` | season by climate × hemisphere (subtropical by month, tropics by the place's dry season); kinds by climate and host plant | right |
| fairy rings' strength by season | `phenology.ts` `FAIRY_SEASON`, `fairyRingsFor` | climate × hemisphere (northern-equivalent days); the rings themselves by world cell hash (`fairyRings.ts`) | right |
| heath (heather's colour by month) | `phenology.ts` `HEATH_PLACES`, `heathFor` | place × local calendar month (every heath place is northern) | right |
| lying snow, ice foot | `snow.ts` `SNOW_COVER`, `SNOW_PLACES`, `ICE_FOOT_PLACES` | climate × hemisphere, a place's own chance | right |
| sea ice | `seaIce.ts` `SEA_ICE_PLACES` | place × latitude, northern-equivalent day | right |
| colony birds, humpbacks, haul-outs, crab and lizard dormancy, waterfowl, gulls by season | `animalSeasons.ts` | climate × season (colonies, seals by kind) | right |
| beach flowers | `props/shoreLife.ts` `FLOWERS` | biome × ocean × month | **leftover**: Florida and Natal can bloom Mediterranean sea daffodil and horned poppy (should follow climate) |
| shells, starfish | `props/shoreLife.ts` `SHELLS` | biome × ocean | leftover (minor) |
| mangroves | `props/mangroves.ts` `CHANCE` | biome × ocean | **leftover**: Florida's and south Brazil's mangroves missing (subtropical) |
| waterspout season | `props/waterspout.ts` | biome | **leftover**: the Florida Keys (subtropical summer) get the Mediterranean's season |
| visibility, summer haze, dust season | `seaHaze.ts` | biome | leftover: humid subtropical summers get the Mediterranean's dry haze |
| moss amount and wetness | `phenology.ts` `MOSS`, `MOSS_WET_PLACES`, `mossWetness` | climate × a wet-place factor; wetness by weather, drought (Mediterranean curve, savanna dry season) | right |
| spray belt; laver and sea lettuce | `phenology.ts` `sprayBelt`, `LAVER`, `shoreWeed` | place (sheltered and exposed lists, else the main climate's default); weed by place × local calendar month, latitude limits | right |
| trunk moss and spray lichen | `phenology.ts` `trunkGrowth`, `props/trunkMoss.ts` | amount by climate (`MOSS`); lichen by the place's belt and the tree's height and distance inland; colours by biome (moss green, lichen hue at the measured brightness) | right |
| rock growth chance, lichen, algae, moss green | `props/rocks.ts` `GROWTH`, `rockShore.ts` `LICHEN`, `MOSS_COLOR` | biome (the species follow the rock) | right (moss amount moved to climate, 0.146) |
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
  env scene: 32² cube), not the frame: the texels whose direction is in the camera's view (sky
  above the dipped horizon; the sea as 0.12 × the upper hemisphere's average). So everything
  patched into the env sky (night glow, aurora) moves the whole frame's exposure; stars and the
  aurora are hidden while metering (a photographer exposes for the scene, not for a display out of
  frame). Then × `nightScale`, `evBias` by time of day, `meterAimBias` (per time of day and
  moonlit/starlit, keeping each class's median from before 0.231, when a direction bug made the
  meter read the whole cube: tasks.md D11, `passes.meterAim`), eclipse and gloom terms;
  `params.debug.exposure` fixes it. `debug.skyZenith` is the mean of the texels within 3.6° of
  the zenith (= the cube's zenith probe since 0.231).
- `camera.ts` (pitch from `skyFrame.ts` `cameraPitch`, the same projection the choices use);
  `composition.ts` (ray-grid coverage, re-rolls bad framings; `frameView`: eye
  height, pixel angle and nearest ground in frame, for `params.mjs` `p.view`); `reflection.ts`
  (planar reflection).
- **Render targets and their ranges** (0.204). A `HalfFloatType` texel holds ≤ 65 504; past it
  Apple GPUs saturate the write and SwiftShader (CI) writes ∞, which filtering turns into NaN
  (lessons/SHADERS.md). Before writing a large value (metres, an unexposed bright source, a
  night-scaled lamp) into one of these, check its type and clamp; `nanTrace` counts texels at
  the ceiling (`sat`) on the Mac, where an overflow is otherwise invisible:

  | Target | Type | Holds | Range risk |
  |---|---|---|---|
  | composer frame buffers (`scene.ts`, `frameBufferType`) | half | raw radiance up to the grade (exposure, clamp 40) | night units: the moon's disc passed it (clamped in `moon.ts` since 0.205); a 0.205 sweep found nothing else (sun ≤ ~1 by day here, lamps, flashes, totality) |
  | sky cube `envTarget` (`scene.ts`, 256²) and folded cube (`reflection.ts`) | half | sky radiance incl. the sun disc, clouds | as the frame |
  | planar mirror (`reflection.ts`) | half | the mirrored scene's radiance | as the frame |
  | `stillScene.ts` cache and geometry | half | the averaged scene, geometry colour | as the frame |
  | takram cloud shadow map (`ShadowPass`) | half | front depth (m), extinction, optical depth | **overflowed** under a low sun; clamped since 0.204 (`cloudShadowPatch.ts`) |
  | takram clouds pass depth-velocity (`CloudsPass`) | half | front depth (m; sky: 400 km) | overflows every day; harmless while its resolve runs with `temporalAlpha = 1` (KNOWN_ISSUES.md) |
  | ocean, night glow, lighthouse window data textures | half | tables built in JS | values chosen in JS |
  | `traceMeshes`, `measureSkylight` scratch | float | readings | none |

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
  `scripts/render/mesh.mjs`.
- **Tests** (`test/`, Vitest, `npm test`, also in CI before the build): logic, not rendering —
  PRNG, dates, FFT, `generateParams` invariants over three years, terrain/surf mirrors, choice
  tables, meshes, specs, and with no GPU the whole prop tree (built, finite, shaded, freed) and a
  static read of the shaders. Which file for what: TOOLS.md "Tests".
- **CI** (`.github/workflows/pages.yml`): deploys on push and daily at 00:05 UTC renders
  `/latest.jpg` (1920×1080) and `/latest-portrait.jpg` (1290×2796) with SwiftShader (24 frames).
  A blank or broken frame (NaN sky light, clipped white: `checks.mjs` `brokenFrame`) fails the
  render and publishes neither size. The last 60 days' render JSON stays on the site
  (`daily/index.json`, older `daily/{pc,phone}/<date>.json`; `scripts/ci/dailyArchive.mjs`); only
  today's pictures are kept. A bad day: `scripts/ci/ciDay.mjs DATE` (tools/RENDER.md "Broken frames").
- **Desktop-wallpaper scripts** (`crons/`, plan `plans/CRON.md`): each installed machine asks
  for `daily/pc/<UTC date>.jpg` (or `daily/phone/…`) once at its own random 07:MM local and at
  login; a 404 means "not rendered yet" and gets one re-run at the later of +3 h and 08:00 UTC.
  `latest.json` + `latest.jpg?d=<date>` only to catch up (a missed day, a new install, the re-run).
  So `pages.yml` must keep writing `dist/daily/{pc,phone}/<date>.{jpg,json}`: `crons.yml` fails if
  it stops. A picture under 20 KB, not `image/jpeg`, or not starting `FF D8` is refused (real
  dark nights go down to 39 KB; blank frames are stopped in CI, below).
- **Link previews:** `index.html` and `random/index.html` carry Open Graph / Twitter tags with an
  absolute `og:image` (`https://grandma67.github.io/amazing_sea_wallpaper/og-image.jpg`, 1200×630,
  `public/og-image.jpg`, keep < 300 KB for WhatsApp). Crawlers don't run JS, so the tags must be
  static. Fixed image on purpose: `/latest.jpg` is near-black on night and polar days. A move to a
  custom domain must update these URLs.

## Ideas (not planned)

Breaking-wave lips, low-power mode for phones, wind-blown sand and
leaves, lamp reflections on wet sand, lit windows on cruise ships, ship roll resonance, wakes
rolling onto the beach as surf, turtle heads at sea, a real compass sun on every day (ties framing,
heading and coast orientation together; midnight-sun days already have it, PLAN_BIOMES 12), the
real sun's elevation range below 63° (mid-latitude winters still get a 35–70° "midday": at 50° the
December noon is 17° up; changes many winter days, ask first).

## Known issues

[KNOWN_ISSUES.md](KNOWN_ISSUES.md), by area; fix plans in `tasks.md`.
