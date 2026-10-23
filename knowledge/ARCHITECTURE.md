# Architecture

A daily, date-seeded, photorealistic 4K sea-and-beach wallpaper, rendered **in the browser
with three.js** and hosted on GitHub Pages. Same date → same scene everywhere; any date can be
re-rendered, so the archive is free. Versions: [changelog.md](../changelog.md). Pitfalls:
[LESSONS.md](LESSONS.md). Sources: [REFERENCES.md](REFERENCES.md).

## Stack

Vite + TypeScript, three.js `WebGLRenderer`, `@takram/three-atmosphere` (Bruneton sky, aerial
perspective, stars), `@takram/three-clouds` (volumetric clouds, shadows, light shafts), pmndrs
`postprocessing` (required by takram; AgX, bloom), `astronomy-engine` (moon, eclipses),
Playwright (headless snapshots), Vitest.

## Decisions

- **Web-only rendering** (2026-10-13): static Pages site, each visitor's browser renders the day.
  Seed → params is exactly deterministic; pixels may differ slightly across GPUs. A still can
  afford seconds per image. Rejected: Blender/Cycles headless (needs a render step outside the
  browser), AI image generation (paid, less control).
- **Procedural props, no downloaded models:** zero asset weight, per-date variety.
- **Stills averaged over many frames** (64 by default) so stochastic clouds converge.
- **Overlap CPU and GPU at startup** (2026-10-15): `precomputeAtmosphere()` (`scene.ts`) issues
  takram's passes at once (its generator yields between them) so props build while the GPU
  computes the sky.
- **Clouds at full resolution on beaches** (2026-10-15): half-res clouds and light shafts
  upsampled across trees and ridges gave glowing rims; depth-aware upsampling can't recover
  twigs thinner than a texel. Cloudy 4K beach ~5 → ~9 s.
- **One draw: the place, before the sky** (2026-10-23, PLAN_BIOMES 1a): each day draws a real
  stretch of coast (`places.ts`), the first main-stream draw; biome, ocean, climate and latitude
  follow from it, so the sky can depend on the place. Weights are √ of each region's coastline
  length, split among its places by length (raw length would make ~70% of days Arctic and
  nordic). Replaced biome × ocean drawn apart with latitude from the ocean basin. Reshuffled
  every date once, deliberately.
- **Cheaper rendering must not change the image.** Rejected for speed: shipping precomputed
  atmosphere LUTs (10–48 MB, slightly different sky), caching sky textures between visits
  (~48 MB of float 3D textures), dropping the higher-order scattering texture (sky and aerial
  perspective use it), one shared clouds effect for all env-cube faces (fragile), fewer frames
  or lower cloud resolution (cloud shadow map hasn't converged by 32 frames).

## How it works

### Params and randomness

- `random.ts`: cyrb128 + sfc32; `Random.derive(seed, name)` gives independent streams, so a new
  feature doesn't shift other draws. `params.ts`: date → `SceneParams` (time of day, sun/moon,
  weather, storm, rainbow, ocean, biome, landform, colony, camera, wind, title).
- **Places** (`places.ts`, data from REGIONS.md §1): ~90 places in regions. Constants (`biome`,
  `region`, signed `latitude`, `km`), choose-one weights (`ocean`, `climate`) and choose-many
  pools (`animals`, `plants`); defaults merge biome → region → place. Draw order in
  `buildParams`: `pickPlace` (main stream, one float even when a spec restricts it), then
  `pickOcean` from the place's weights on `'ocean'` (monsoon, ice as before), climate on
  `'climate'`, latitude on `'ocean'`; then eclipse, time of day and the rest of the sky.
  `params.place` = `{ id, region, climate, hemisphere }`; `params.biome` and
  `params.sea.ocean` stay for every reader. Specs: `place` (place or region id); `biome`,
  `ocean`, `climate` restrict the draw to places that have them and force the choice;
  `placesFor()` throws on a combination no place has. `latitudeDeg` is signed now (south
  negative): readers that meant "distance from the equator" use `Math.abs`.
- **Seasons** (`seasons.ts`): seasonal tables are written in northern-hemisphere months;
  `seasonMonth(day)` shifts the month by six south of the equator (sign of `latitudeDeg`, so
  Chile, the Cape, SW Australia and NZ count, not only the Southern Ocean), `season(day)` gives
  winter/spring/summer/autumn, `monthInSeason(day, from, to)` tests a range. Used by flowers
  (`FLOWERS`), fog season and sea smoke (`pickFog`), cloud summer (`addFormations`), Arctic/
  Antarctic nacreous winter, noctilucent season, Mediterranean summer haze and migratory passage.
  Not by tables of real local months for one region: turtle nesting per place (already local),
  waterspouts, the Morning Glory, polar ship seasons (by ocean), Arctic ice (north only).
- **Scene specs** (`sceneSpec.ts`): typed, validated JSON. `generateParams(date, attempt, aspect,
  spec)` applies it at each decision but still makes every draw. Forcing the time of day changes
  how many main-stream draws the sky makes, so later main-stream draws (lens, wind,
  horizon…) are pinned to the unforced day's (`keep()`). Prop choices reach props as
  `params.overrides`; a final `params` deep patch covers the rest.
- **Prop choices without rendering:** `props/choices.ts` `propChoices(params)` runs each
  creator's pure `xxxFor(params, rng)` (gulls, marine, migratory, wildlife, shore life, debris,
  mangroves) on its own stream, for `scripts/params.mjs` (`p.props`), `scripts/animals.mjs` and
  tests.
- Coast choice (place → biome, ocean → beach/open-sea → shape): [COASTS.md](COASTS.md). Sky choice:
  [CLOUDS.md](CLOUDS.md). Animals: [ANIMALS.md](ANIMALS.md).

### Sky, clouds, light

- `scene.ts`: atmosphere, env cube, post. `exposure.ts` meters a 32² sky cube (auto exposure).
- **Clouds** (`clouds.ts`, `cloudTypes.ts`): WMO genera and species (each has its `genus`);
  `pickFormations` draws one per étage, `pickSpecies` (own stream) refines and adds fractus,
  scud and duplicatus, ≤ 4 layers; `layerChannels` gives an étage's second layer the weather
  map's spare channel `a` (fine Perlin) so it doesn't mirror the first; storms:
  `stormFormations`. `cloudArrangement.ts` patches the weather-map lookup with a 2×2 transform in
  cube-sphere uv, so streets/bands follow `weather.arrangement.headingDeg`;
  `stabiliseCubeSphereUv` rewrites takram's u in a cancellation-free form.
- **Storms:** `stormCells.ts` raises the Cb layer's weather to full (density ×3 in the core) in
  a cell (r ≈ 3.5 km + 10% of distance) over each bolt and rain curtain, in the clouds, shadow
  and env-cube passes. `stormEffects.ts`: rain shafts, lightning flash (fixed scene radiance
  `FLASH_RADIANCE`: invisible by day, a glow by blue hour), lens rain, rainbows. Bolts strike
  3–9 km out, ribbons widened across each segment toward the camera, forks head down.
- **Sky-shader features** (patched into takram's sky: functions before `getSkyRadiance(`):
  `eclipse.ts`, `contrails.ts`, `noctilucent.ts`.
- **Moon and eclipses:** `celestial.ts`: phase law (Allen's magnitude fit: half moon ~1/10 of
  full), disc-overlap geometry, `eclipseOn(date)` (real peaks; penumbral lunar left out).
  `params.ts` sets `nightSky` (moonlit/starlit; moon down 20% of nights or new → starlit),
  `moonlight`, `eclipse`, `sunScale` (sun and moon 3× on solar eclipse days), and frames
  eclipses (24–35 mm, more sky, sun/moon low ahead; clear or cirrus, total under clear). The
  moon by day is framed with the sun on ~35% of days with the moon > 15% lit. `scene.ts`: night
  exposure × max(moonlight, 0.06)^0.5 (starlit 0.5, lit by a dim overhead light standing in for
  starlight and airglow), stars boosted as the night darkens (not in the reflection cube); moon
  disc at constant surface brightness, earthshine on crescents, umbra with copper glow
  (`moon.ts`); lunar eclipses dim the moonlight. `eclipse.ts`: the moon covers the sun; in
  totality the sky darkens to a horizon glow with corona and stars, no direct sun, sky light
  ×~0.01, no aerial-perspective inscatter, dim environment on props. Simplification: the scene
  has no real location, so off-path days show the eclipse as if on the path (partials at a
  random 30–85%).
- **Sea haze** (`seaHaze.ts`): `visibilityFor()` (own stream) draws visibility log-uniform by
  biome (polar 40–90 km, nordic 40–80, tropical 35–65, Mediterranean 35–70 and 25–50 in summer,
  desert 12–35, dust episodes 8–20); less in strong wind (sea salt), overcast and storms, more
  after showers. `applySeaHaze()` patches takram's clouds-pass haze: density 3.912/V minus the
  Bruneton air's own, no coverage switch-off, colour = the sky behind the ray (just above the
  horizon for rays at or below it) × `hazeLight(weather)`. Covers sky, clouds and scene, so far
  clouds and islands fade into the horizon. Only on days with clouds (clear days have no clouds
  pass).
- **Fog** (`fog.ts`): screen-space exponential-height fog from depth (closed-form optical depth,
  forward-scattering glow), before exposure. `params.ts` picks it by climate on ~5% of days:
  *advection fog* (warm moist air over cold water: California and Chile in summer, Namib and
  Atacama nearly all year, North Sea, Newfoundland, Arctic in spring/summer; light wind, likeliest
  at dawn), *fog bank* offshore, *sea smoke* (very cold air over warmer water, polar winters,
  calm and clear). Inside fog the sun dims and the sea calms.
- **Light reaching sea and sand** (`shadow.ts lightReaching`): direct sun/moon (glitter, body,
  floor) = min(props' shadow map ±320 m, land shadow map to the horizon (`renderLandShadow`))
  × cloud transmittance from takram's cascaded cloud shadow map (exp(−(maxOpticalDepth + tail)),
  primed by `primeCloudShadow` because the sea is drawn once at frame 0). `weather.sunVisibility`
  stays as the overall dimming.

### Ocean and surf

- `spectrum.ts` (on `spectrumWorker.ts`): JONSWAP + swell on 3 cascades with `fft.ts`.
  `ocean.ts`: whitecaps, glitter, refracted surf in sets, shallows, caustics, foam, rain rings;
  `grid.ts`: polar grid to 120 km. `PropContext.seaLevel()` samples the FFT height on the CPU so
  things float on the actual waves.
- **Surf** (`ocean.ts` SURF_GLSL, mirrored and tested in `terrain.ts` `surfWave`,
  `surfBreakDepth`, `surfProfile`): offshore height 1.3 × `surfAmplitude` × sets; shoaling
  ×(L/2d)^¼ below depth L/2 (Green's law); breaks where it reaches γ·d, γ = 0.72 + 5.6 × slope
  (McCowan/Weggel), H = γ·d inside (bore). Profile averages zero over a cycle (crest ≈ 0.7 H,
  trough ≈ −0.3 H); face narrows 0.3 → 0.12 of the wavelength toward breaking, 0.06 broken, never
  below 2.5 grid cells or pixels. Waves re-form over the trough behind a sandbar. Roller foam and
  crest spray (`props/surf.ts`) follow the steepness.
- **Rocks in the sea:** `props/surf.ts` `waterRocks()` lists rocks cutting the surface; 
  `waveOnRock()` compares the crest there (0.7 × surf height, or half the open sea's Hs) with the
  rock top → `breaks`. `ocean.ts setOceanRocks()` (nearest 48, `rockData`): collar foam, a lee
  trail, and for breaking rocks white water surging after each crest (cycle 0.2–0.85); spray
  bursts only when a crest is at a breaking rock (cycle 0.2–0.38).

### Land and plants

- `terrain.ts`: shared GLSL/TS height function (coast, dunes, hills, sandbar), sand shading,
  surf profile (`surfCycle`, mirrored in `props/surf.ts`). `biome.ts`/`oceans.ts`: palettes,
  plants, sea state, ice.
- **Coast kinds** (`coastKind.ts`, re-exported by `terrain.ts`): `coast.type` is `open-sea`,
  `beach`, `rock-shore` or `tidal-flat` (the last two not drawn yet: PLAN_BIOMES 8, 9). Code asks
  `hasLand` (terrain drawn, camera on land, compositions, rocks, plants, lighthouse on a point),
  `hasBeach` (sand: debris, shore life, beach animals, mangroves, flamingos wading, "… sand beach"
  title) or `hasSurfZone` (waves break at the shore: surf height and foam, surf props), never
  `type === …`. The shader gets an `int coastKind` uniform (index in `COAST_KINDS`, `COAST_*`
  defines) and `terrainHeightAt` branches on it, so each day runs one profile; the TS
  `terrainHeight` switches the same way. Rock shores and tidal flats use the beach profile until
  their phases.
- **Beach material** (`beach.ts`, PLAN_BIOMES 2): `coast.material` is `sand`, `mixed`, `shingle`
  or `cobble`, drawn in `generateCoast` on stream `'beach-material'` from `materialChances(place,
  climate)` (place → region override, else `POLAR_MATERIAL` on polar days, else the biome's
  `MATERIAL_CHANCES`), then forced by `spec.beachMaterial`. Open sea is `'sand'`. Stony days
  replace slope, width, sandbar and dune (`stonyShape`, same stream) and get `coast.ridges`
  (crest distance, height, half-width); `coast.stoneColors` is the place's palette. Stony days
  also get a steep nearshore (narrow surf zone: `breakerIndex` and `surfBreakDepth` follow
  `nearshoreSlope`, no material term needed) and run-up × `STONY_RUNUP`. `ridgeHeight` adds
  Gaussian bumps across the shore in `beachHeightAt` (GLSL `vec3 ridges[3]` + `ridgeCount`, TS
  mirror `ridgeHeight` in `terrain.ts`, 0 on sand). `beachLines` (wrack and storm lines) lives
  here now; on stony days its storm line is the storm ridge crest. Shares: COASTS.md.
- **Stone texture** (`terrain.ts` `STONE_GLSL`, terrain fragment shader only; uniforms from
  `stoneUniforms`): Voronoi cells over shore coords (u inland, a along), cell size =
  `coast.stoneSize` × `STONE_LEVELS` (0.6/1/1.6). `stoneLevel` picks the size class per pixel
  (finer below high tide, coarsest on the storm ridge, dithered patches), then one 3×3 search;
  per cell: palette colour × brightness, presence (mixed beaches: `stoneCover`, sand below the
  high-tide line), fill. Stones are ovals inside their cells with a dome normal and dark gaps.
  `detail` fades cells out by pixel footprint (`footprint / (0.6 × stoneSize)`); two mottle
  octaves (4× and 16× stone size) carry a stony texture further. The TS mirror in `beach.ts`
  (`stoneAt`, `stoneGridCell`, `stoneCell`) uses the same hashes (`cellNoise.ts`), so mesh
  stones (2d) can sit on the shader's cells. `seabedAlbedo` gives `ocean.ts` the stone colour.
- **Trees** (`trees.ts`, `props/vegetation.ts`, `wind.ts` bending): per-species leaf meshes
  folded on the midrib (oval oak/almond, ovate birch, lance olive, needles stone pine, rounded
  shrubs, pinnate acacia); bark relief as geometry (28 sides, rings every 15 cm, fissures to
  5 cm, buttress roots). Built once into the still scene but instanced hundreds of times: < 100k
  triangles per species (tested). In-mesh randomness from `hash()`. Plants get no direct
  specular.
- **Mangroves** (`props/mangroves.ts`): `mangroveFor()` picks a stand by biome, ocean and shelter
  (`SHELTERED_SURF`, surf < 0.35 m); `createMangroves()` finds waterline in frame, runs the stand
  80–300 m along shore, trees where ground is within ±0.9 m of sea level, thinning seaward.
  `rhizophora()`/`avicennia()` in `trees.ts`. Shoreline views look straight out to sea and never
  show a stand.
- **Islands:** `params.ts` `pickIslands()` (own stream; ~30% of days) picks kind by biome
  (`ISLANDS`) and per island offset, distance, width, height (low 1–4 km, high 8–30 km).
  `props/islands.ts` moves each to open water in frame (12-point footprint over seabed, clear of
  others and the colony rock), builds a polar-grid heightfield with noisy outline and per-kind
  profile (`islandHeight`), colours by height/slope/noise, instances palms (cays) or distant pines
  (skerries). Past 5 km `distant` (left out of the planar reflection, like mountains).
- **Lighthouse:** `params.ts` picks site, paint, height and light character by coast (~9% of
  days; most on nordic, mediterranean, volcanic; rare in tropics, deserts, polar seas). Sites: a
  rocky point with keeper's cottage (beach days) or a stout flared tower on a rock at sea; the
  other is tried if one doesn't fit the frame. Paint: white, red cast iron (Scandinavia), red or
  black bands, bare granite on rocks; red, black or copper domes. Rotating Fresnel lens: ~2°
  beams grouped by chart character (`Fl(2) W 15s` = 2 beams per group), landward side screened on
  a point; lit sunset to sunrise and in fog. `props/lighthouse.ts` builds it; `lighthouse.ts`
  draws beams in screen space (closest approach of view ray and beam axis, haze + fog scattering,
  depth-occluded) and flash glare, before exposure.

### Props (`src/props/`, built with `builder.ts` `MeshBuilder`)

- Rocks, sea stacks, vegetation, birds, migratory flocks, ships, marine life, ice, colonies,
  pinnipeds, landforms, storm bolts, surf/rock spray, cloud events (`skyEvents.ts`,
  `props/cloudEvents.ts`), waterspout. All at real size.
- **Shore debris** (`debris.ts`, `debrisFor()` by biome and ocean): wrack (kelp, Posidonia mats
  and fibre balls, sargassum, sticks) on the high-tide line at ~1.1× run-up height, plus a fainter
  older line; logs on the storm line above ~2.2× and up to the back of the beach (`logGeometry`:
  bowed, oval, knots, checks, splintered end, root wads); coconuts on palm coasts.
- **Shore life** (`shoreLife.ts`, `shoreLifeFor()`): crabs by biome and time of day, shells by
  coast, flowers in bloom by month (`FLOWERS`). Real size: crabs and shells show only near the
  camera.
- **Wildlife** (`wildlife.ts`, `wildlifeFor()`): the place's `animals` pool (`places.ts`), then
  turtles (`nestingSpecies(animals, month, pick)`: in-season entries weighted), monkeys, lizards,
  crocodiles, hippos and basking turtles by the pool's chances. `inWater()` decides where the big ones are; `inSea()` places them by depth via
  `ctx.seaPoint`. `spot()` casts rays through the lower frame and marches them to the ground, so
  each group lands in view, near first; tracks are a world-space strip of churned sand.
- **Pinnipeds** (`pinnipeds.ts`): hauled out on rock or beach; `swimmingHead` for heads in water.
  **Colonies** (`colony.ts`): island or mainland headland/rookery.
- **Storms and animals:** `stormy(params)` (`props/context.ts`: storm or storm sky). Gulls rest on
  water or sand facing the wind (`restingGull`), colonies have no birds up, pinnipeds leave the
  haul-out (heads only, up to 100 m off), crabs, monkeys, lizards and basking turtles hide;
  migratory flocks and whales are off.
- **Ships** (`ships.ts`): hulls lofted per kind; `polarFleet()` replaces leisure craft in Arctic
  and Southern Ocean waters (dinghies, trawlers, expedition ships in season, icebreakers).
  `seaSpot()` aims at the lower half of the frame, then samples distance (log-uniform) and bearing
  in view. `shipSpeed()` by kind (`UNDERWAY`, stream `ships/motion`); `floatOnWaves()` fits a
  plane to `seaLevel()` every ~2 m over the waterplane (follows waves longer than the hull,
  averages shorter ones, as RAOs do). `wakeFor()`: Kelvin height 0.1 × beam × Fr, wake foam
  (propellers; sail only when quick), foam lifetime 8 + 0.8 × beam s, hull collar.
  `ocean.ts setOceanShips` (8 nearest): discards sea inside the hull (`hullHalfWidth` mirrors
  `hullShape`), adds the Kelvin field's slope (stationary phase: tan a = T/(1 + 2T²),
  k = g/(U cos θ)², two branches, weighted by how well a hull of length L makes that wavelength:
  fast boats' wakes narrow, Rabaud & Moisy), foam and a slick. `hullSpray()`: bow slam (0.6 U in
  a sea), breaking crests on the weather side (`whitecapFraction`), crests climbing the hull
  (`pose.rel`), chine sheets.
- **Ship lights** (`shipLights.ts`, sunset to sunrise): `shipLightsFor()` encodes COLREGs
  (masthead 225°, sidelights 112.5°, stern 135°, two mastheads from 50 m, sailing tricolour under
  20 m, anchor all-round, trawling green over white, deck/work lamps) at Annex I intensities
  (0.9–94 cd). Only lights whose sector faces the camera are added, as additive sprites ≥ 2.5 px
  with radiance × area = intensity, in scene units via metered luminance / `skyLuminance()`. The
  ocean mirrors the 12 brightest as GGX point lights (hidden from the planar mirror). The night
  grade is mesopic: pixels far above sky level keep their colour.

### Frame and post

- `camera.ts`; `composition.ts` (ray-grid coverage, re-rolls bad framings); `reflection.ts`
  (planar reflection).
- `accumulate.ts` + `stillScene.ts`: render the scene once, redraw only clouds/spray per frame
  (Halton sub-pixel jitter; takram's cloud TAA history off). A second sky-less render gives each
  pixel's geometry coverage and `SkyFillEffect` blends the finished sky into silhouette pixels.
  `skyDenoise.ts` smooths light-shaft grain once.

### Page, cache, CI

- `main.ts`: portrait/landscape, device-aware size, prev/next/today/random, download (Today
  greyed on today). A click/tap outside the bar toggles it (`data-ui` on `<html>`): phones start
  shown, PCs hidden (hover reveals); hidden on phones = no pointer events. `random/index.html`
  redirects to a random past day.
- **Render cache** (`public/sw.js`, `renderCache.ts`): the 10 most recently viewed renders (JPEG
  0.95, Cache Storage, LRU) keyed by build commit (`__BUILD_ID__`), date, size, frames, portrait,
  spec; a hit is drawn straight to the canvas (~60 ms) and the render worker stopped. Page reads
  and stores via `rendered/*.jpg` GET/PUT that only the worker answers. Off in dev and under
  `navigator.webdriver`; `?cache=1|0` forces. A first visit renders before the worker controls the
  page, then stores.
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
rolling onto the beach as surf, turtle heads at sea.

## Known issues

- Waterspouts: the fog rule never applies and they're far rarer than intended (1 in 3 years):
  [plans/WATERSPOUT_FOG.md](plans/WATERSPOUT_FOG.md).
- Backlit shelf cloud at sunset is a flat pink band (takram aerial perspective on the mesh;
  e.g. 2010-04-01).
- 2026-05-01: a sailboat drawn as a bare, steeply tilted mast.
- 2026-02-13: sparkly dots in the air over the sea.
- Elephant seals within ~25 m look like smooth boulders (beach herds keep 30 m off); hippos are
  stylised up close (barrel + boxy head).
- Physically subtle (not bugs): Posidonia wrack at normal distance, hatchlings (5 cm) beyond
  ~10 m, crawl tracks at grazing angles, wakes at the usual 300 m+, ship lights at dawn,
  noctilucent clouds, rock foam against a low sun.
