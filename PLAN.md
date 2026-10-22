# Amazing Sea Wallpaper — Plan

A daily, date-seeded, photorealistic 4K sea-and-beach wallpaper, rendered **in the browser
with three.js** and hosted on GitHub Pages. The date is the seed: same day, same scene,
everywhere; any date can be re-rendered on demand, so the archive is free.

Version history: [changelog.md](changelog.md).

## Decisions

- **Web-only rendering** (2026-10-13). Static Pages site; each visitor's browser renders the
  day. Seed → params is exactly deterministic; pixels may differ slightly across GPUs. A still
  can afford seconds per image (accumulation, expensive shaders). Rejected: Blender/Cycles
  headless (needs an out-of-browser render step), AI image generation (paid, less control).
- **Procedural props, no downloaded models** — zero asset weight, per-date variety.
- **Stills are averaged over many frames** (64 by default) so stochastic clouds converge.
- **Overlap CPU and GPU at startup** (2026-10-15). takram's generator yields to the event
  loop between passes (for interactive apps); `precomputeAtmosphere()` in `scene.ts` issues
  them all at once, so the props are built while the GPU computes the sky. Not done: caching
  the sky textures between visits (~48 MB of float 3D textures to read back and store),
  dropping the higher-order scattering texture (the sky and aerial perspective use it).
- **Rejected for speed:** shipping precomputed atmosphere LUTs (10–48 MB, slightly different
  sky); one shared clouds effect for all env-cube faces (fragile); fewer frames / lower cloud
  resolution (changes the image).
- **Clouds at full resolution on beaches** (2026-10-15), not capped at ~1080p: half-res
  clouds and light shafts upsampled across tree and ridge silhouettes gave glowing rims, and
  joint (depth-aware) upsampling can't recover twigs thinner than a texel. Cloudy 4K beach
  ~5 → ~9 s. Fewer frames was rejected: the cloud shadow map hasn't converged by 32.

## Stack

Vite + TypeScript, three.js `WebGLRenderer`, `@takram/three-atmosphere` (Bruneton sky, aerial
perspective, stars), `@takram/three-clouds` (volumetric clouds, shadows, light shafts),
pmndrs `postprocessing` (required by takram; AgX, bloom), `astronomy-engine` (moon phase),
Playwright (headless snapshots).

## How it works

- `random.ts` cyrb128 + sfc32; `Random.derive()` gives independent streams, so adding a
  feature doesn't shift other draws. `params.ts`: date → `SceneParams` (time of day, sun/moon,
  weather, storm, rainbow, ocean, biome, landform, colony, camera, wind, title).
- **Ocean:** `spectrum.ts` (on `spectrumWorker.ts`) synthesises JONSWAP + swell on 3 cascades
  with `fft.ts`; `ocean.ts` shades it: whitecaps, glitter, refracted surf in sets, shallows,
  caustics, foam, rain rings; `grid.ts` polar grid to 120 km. Direct sun/moon on sea and sand
  (glitter, body, floor; `shadow.ts lightReaching`) = min(props' shadow map ±320 m, land
  shadow map to the horizon) × cloud transmittance from takram's cascaded cloud shadow map
  (exp(−(maxOpticalDepth + tail)), primed by `primeCloudShadow` since the sea is drawn once
  at frame 0). `weather.sunVisibility` stays as the overall dimming of the light.
- **Surf:** `ocean.ts` SURF_GLSL, mirrored in `terrain.ts` (`surfWave`, `surfBreakDepth`,
  `surfProfile`, tested). Offshore height 1.3 × `surfAmplitude` × sets, shoaling ×(L/2d)^¼
  below depth L/2, breaking where it reaches γ·d with γ = 0.72 + 5.6 × nearshore slope,
  H = γ·d inside. The profile over a cycle averages zero (crest ≈ 0.7 H, trough ≈ −0.3 H);
  its face narrows from 0.3 to 0.12 of the wavelength toward breaking and to 0.06 broken,
  but never below 2.5 grid cells (vertex) or pixels (fragment). Waves re-form over the
  trough behind a sandbar. The roller foam and the crest spray (`props/surf.ts`) follow
  the steepness.
- **Rocks in the sea:** `props/surf.ts` `waterRocks()` lists rocks cutting the surface
  (waterline radius, top, depth); `waveOnRock()` compares the crest there (0.7 × surf
  height, or half the open sea's significant height) with the rock's top: higher rock →
  `breaks`. `props/index.ts` hands them to `ocean.ts` `setOceanRocks()` (nearest 48 as
  `rockData`): collar foam, a lee trail shoreward, and for breaking rocks an apron of white
  water that surges after each crest (surf cycle 0.2–0.85). Spray bursts in `createSurf`
  only when a crest is at the rock (cycle 0.2–0.38) and it breaks.
- **Land:** `terrain.ts` shared GLSL/TS height function (coast, dunes, hills, sandbar), sand
  shading and surf profile (`surfCycle`, mirrored in `props/surf.ts`). `biome.ts` /
  `oceans.ts` pick palettes, plants, sea state and ice.
- **Sky:** `scene.ts` atmosphere + env cube + post; `clouds.ts` / `cloudTypes.ts` (WMO genera
  and species, each with its `genus`; `pickFormations` draws one per étage, `pickSpecies` on
  its own stream refines them and adds fractus, scud and duplicatus layers, ≤ 4 in all;
  `layerChannels` gives a second layer of an étage the weather map's spare channel, `a`,
  a fine Perlin noise, so it doesn't mirror the first; storms: `stormFormations`;
  `cloudArrangement.ts` patches the weather-map lookup with a 2×2 transform solved in the
  cube-sphere uv round the scene, so streets and bands follow `weather.arrangement.headingDeg`;
  `stabiliseCubeSphereUv` rewrites takram's u in a cancellation-free form); `exposure.ts` meters a 32² sky cube; `moon.ts`; `stormEffects.ts` rain shafts,
  lightning flash, lens rain, rainbows.
- **Props** (`src/props/`): rocks, trees/vegetation (+ `wind.ts` bending), birds, migratory
  flocks, ships, marine life, ice, colonies, pinnipeds, landforms, storm bolts, surf/rock
  spray, shore debris (`debris.ts`: `debrisFor()` picks driftwood/wrack/coconuts by biome
  and ocean; wrack on the high-tide line at ~1.1× run-up height, logs on the storm line
  above ~2.2× and up to the back of the beach), shore life (`shoreLife.ts`: `shoreLifeFor()`
  picks crabs by biome and time of day, shells by coast, flowers in bloom by month;
  everything at real size, so crabs and shells only show near the camera); built with `builder.ts` (`MeshBuilder`). `PropContext.seaLevel()` samples the FFT
  wave height on the CPU so things float on the actual waves.
- **Mangroves:** `props/mangroves.ts` `mangroveFor()` (own stream) picks a stand by biome,
  ocean and shelter (`SHELTERED_SURF`); `createMangroves()` finds a stretch of waterline in
  frame (else partly visible), runs the stand along the shore away from the camera and
  places trees where the ground is within ±0.9 m of sea level, thinning seaward.
  `rhizophora()` / `avicennia()` in `trees.ts`. Shoreline views look straight out to sea and
  show no shore, so they never show a stand.
- **Wildlife:** `props/wildlife.ts` `wildlifeFor()` picks a region from biome, ocean and
  latitude (tropical Pacific: SE Asia or Central America; tropical Indian: SE Asia or East
  Africa; tropical Atlantic: Caribbean; warm volcanic Pacific: Galápagos or Hawaii;
  Mediterranean Sea; Arabia), then turtles by `nestingSpecies(region, month)` and the time
  of day, monkeys and lizards by day. `spot()` casts rays through the lower frame and
  marches them to the ground, so each group lands in view, near first; individuals scatter
  round it. Tracks are a world-space strip of churned sand following the ground.
- **Ships:** `props/ships.ts` builds hulls lofted per kind; `polarFleet()` replaces the
  leisure craft and shipping in Arctic and Southern Ocean waters. `seaSpot()` first aims at
  the lower half of the frame, then samples distance (log-uniform) and bearing within the
  view: far boats lie in a sliver of pixels under the horizon that screen sampling misses.
  `shipSpeed()` draws a speed by kind (`UNDERWAY`, own stream `ships/motion`);
  `floatOnWaves()` fits a plane to `seaLevel()` over the waterplane every ~2 m (heave,
  pitch, roll; it follows waves longer than the hull, averages shorter ones, as RAOs do).
  `wakeFor()` gives Kelvin height (0.1 × beam × Fr), wake foam (propellers; sail only when
  quick), foam lifetime (8 + 0.8 × beam s) and the hull collar (bow wave, sea against the
  freeboard). `ocean.ts setOceanShips` (8 nearest): discards the sea inside the hull
  (`hullHalfWidth` mirrors `hullShape`), adds the Kelvin field's slope (stationary phase:
  tan a = T/(1 + 2T²), k = g/(U cos th)², two branches; weighted by how well a hull of length
  L makes that wavelength, so fast boats' wakes narrow, Rabaud & Moisy), foam and a slick
  (less roughness and whitecaps). `hullSpray()`: bow slam (0.6 U in a sea), breaking crests on
  the weather side (`whitecapFraction`), crests climbing the hull (`pose.rel`), chine sheets.
- **Islands:** `params.ts` `pickIslands()` (own stream) picks kind by biome (`ISLANDS`) and
  per island an offset across the frame, distance, width and height (low ones 1–4 km, high
  ones 8–30 km). `props/islands.ts` moves each to open water in frame (12-point footprint
  over seabed, clear of others and the colony rock), builds a polar-grid heightfield with a
  noisy outline and a profile per kind (`islandHeight`), colours it by height, slope and
  noise, and instances palms (cays) or distant pines (skerries). Islands past 5 km are
  `distant` (left out of the planar reflection, like mountains).
- **Moon and eclipses:** `celestial.ts` has the phase law (Allen's magnitude fit),
  disc-overlap geometry and `eclipseOn(date)` (real eclipse peaks; penumbral lunar left
  out). `params.ts` sets `nightSky` (moonlit/starlit), `moonlight`, `eclipse`, `sunScale`
  (sun and moon drawn 3× on solar eclipse days) and frames eclipses (24–35 mm, more sky,
  sun or moon low ahead; clear or cirrus skies, total under clear). `scene.ts`: night
  exposure × max(moonlight, 0.06)^0.5 (starlit 0.5), stars boosted as the night darkens
  (not in the reflection cube); moon disc at constant surface brightness (÷ phase law),
  earthshine, umbra with a copper glow (`moon.ts`); lunar eclipses dim the scene's
  moonlight. `eclipse.ts` patches takram's sky shader so the moon covers the sun, and in
  totality darkens the sky to a horizon glow and adds the corona; no direct sun, sky
  light ×~0.01, no aerial-perspective inscatter, dim environment on props.
- **Sea haze:** `seaHaze.ts` `visibilityFor()` (own stream) draws how far one sees, log-uniform
  by biome (polar oceans 40–90 km, nordic 40–80, tropical 35–65, Mediterranean 35–70 and 25–50
  in summer, desert 12–35, dust episodes 8–20), less in strong wind (sea salt), under overcast
  and storms, more after showers. `applySeaHaze()` patches takram's clouds-pass haze: density
  3.912/V less the Bruneton air's own, no coverage switch-off, colour = the sky behind the ray
  (the sky just above the horizon for rays at or below it) × `hazeLight(weather)`. It covers
  sky, clouds and scene up to their depth, so far clouds, islands and the sea line fade into
  the horizon. Only on days with clouds (clear days have no clouds pass).
- **Fog:** `fog.ts` screen-space exponential-height fog from depth (closed-form optical
  depth, forward-scattering glow), before exposure; `params.ts` picks it by climate.
- **Lighthouse:** `params.ts` picks site, paint, height and light character by coast;
  `props/lighthouse.ts` builds tower, lantern and cottage on a rock mound or stack;
  `lighthouse.ts` draws the beams in screen space (closest approach of view ray and beam
  axis, haze + fog scattering, depth-occluded) and the flash glare, before exposure.
- **Scene specs:** `sceneSpec.ts` types and validates a JSON spec; `generateParams(date,
  attempt, aspect, spec)` applies it at each decision, still making every draw so the
  rest of the day is unchanged. Forcing the time of day changes how many main-stream
  draws the sky makes, so the later main-stream draws (biome, lens, wind, horizon…) are
  pinned to the unforced day's (`keep()`). Prop choices go to the props as
  `params.overrides`. A final `params` deep patch covers everything else.
- **Frame:** `camera.ts`, `composition.ts` (ray-grid coverage, re-roll bad framings),
  `reflection.ts` (planar reflection), `accumulate.ts` + `stillScene.ts` (render the scene
  once, redraw only clouds/spray per frame; a second sky-less render gives each pixel's
  geometry coverage, and `SkyFillEffect` blends the finished sky into silhouette pixels),
  `skyDenoise.ts` (smooths light-shaft grain once).
- **Page:** `main.ts` — portrait/landscape, device-aware size, prev/next/today/random,
  download (Today greyed out on today); `random/index.html` redirects to a random past day.
  A click/tap outside the bar toggles it (`data-ui` on `<html>`): phones start shown, PCs
  hidden with hover still revealing it; hidden on phones = no pointer events.
- **Render cache:** `public/sw.js` + `renderCache.ts` keep the 10 most recently viewed
  renders (JPEG 0.95, Cache Storage) keyed by build commit (`__BUILD_ID__`), date, size,
  frames, portrait and spec; a hit is drawn straight into the canvas (~60 ms vs seconds)
  and the render worker is stopped. The page reads/stores via `rendered/*.jpg` GET/PUT that
  only the worker answers. Off in dev and under `navigator.webdriver` (snapshots must render);
  `?cache=1|0` forces it. A first visit renders before the worker controls the page, then stores.
- **Tests:** `test/` (Vitest, `npm test`, also in CI before the build) covers the logic,
  not the rendering: PRNG, dates, FFT, `generateParams` invariants over three years of days
  (sun/moon geometry, fog, lighthouse, seals, storms, rainbows, ice by region and
  frequency), shore frame and terrain, beam directions, cloud genera, camera horizon,
  composition re-rolls, ocean spectrum and `seaLevel()`, wind, scene specs, shore debris by coast and
  driftwood meshes, moonlight phase law, eclipse dates and framing, night skies, the moon
  by day, shore life (crabs, shells, flowers in season) and its meshes.
- **CI:** `.github/workflows/pages.yml` deploys on push and daily at 00:05 UTC renders
  `/latest.jpg` (PC, 1920×1080) and `/latest-portrait.jpg` (phone, 1290×2796) with SwiftShader.

## Lessons and gotchas

- Screen-space derivatives explode on silhouettes → clamp footprints, or NaN normals become
  white bloom dashes (Metal fast-math also defeats `isnan`). Overflowing `exp()` gave NaN
  terrain far inland.
- postprocessing's `EffectComposer.setSize()` resizes the renderer — restore it after side
  composers.
- Transparent or dithered meshes don't composite with takram clouds/aerial perspective (they
  only see the depth buffer).
- Takram's temporal upscaling + along-ray-only jitter left spots and grain in averaged stills;
  Halton sub-pixel jitter + a final sky denoise fixed it (7.19).
- A mirror-sharp sun is ~1000× sky radiance: any sun under overcast shows a glitter path.
  So the glint must be shaded by the clouds actually drawn (their shadow map), not a stand-in
  noise: a congestus over a 2° sun still left a full glitter path (2026-09-27).
- takram's cloud shadow map is temporal: it needs ~8 updates to converge. Unprimed, the
  first of 16 accumulated frames saw clouds unshadowed, so low-sun cloud bases were lit too
  pink. `primeCloudShadow` runs the effect's update with the main march stubbed out.
- Screen-space effects (lightning flash) aren't in the env cube: the sea mirrors them only if
  the ocean shader adds them along `R` itself (radiance = graded value / exposure).
- Place flocks by a view ray reaching the target altitude, not fixed NDC heights.
- Benchmarks: run under `caffeinate -i`; GPU noise floor is ≤5/255 on a few pixels.
- Anything sitting at mean sea level (splashes, foam) is hidden by wave crests at grazing
  angles: place it on `seaLevel()` and lift it a little. Use the whole frame's NDC range
  when searching for sea points — a low horizon leaves no sea below NDC 0.
- Exponential fog with a large scale height and dense extinction fills the whole sky; a
  fog *bank* needs a scale height of only tens of metres.

- Lights of fixed power (lanterns, beams) are scaled per time of day against the metered
  sky, or they vanish at dusk and blind at night.
- Splash boat: CSS waves built from quadratic Béziers are parabolas, so a boat can ride one
  exactly with quad-ease heave keyframes and linear pitch, if its period matches the wave
  slide (middle wave: 7 s per 2 periods → 3.5 s).
- Tree geometry is built once into the still scene, so extra triangles cost little; still,
  every species is instanced hundreds of times — keep each under ~100k triangles (tested).
  Extra randomness inside `growTree`/`leaves` comes from `hash()`, not `rng`, so adding
  detail doesn't reshape every tree.
- Pre-existing: a sailboat drawn as a bare, steeply tilted mast (2026-05-01).
- Glow around trees at sunset had three causes, found by switching passes off one at a time:
  takram's cloud TAA smearing light shafts past silhouettes over the jittered frames (wide
  halo; its history is now off, our accumulation averages instead); half-res clouds
  upsampled across silhouettes (bright rims, also the pink ridge outlines at blue hour);
  MSAA edge pixels keeping part of the bare, cloudless sky mesh. Plus GGX glints on edge-on
  leaves against a low sun (direct specular is off for plants). A pass that reads the
  depth buffer composites per pixel; anything blended into a pixel (MSAA, bilinear) needs
  coverage handled explicitly.
- takram's sky draws the sun and moon independently (no occlusion) and keeps the moon's
  total light fixed, so a bigger disc is dimmer: scale `lunarRadianceScale` by
  `moonScale²`. Its shader string can be patched after construction (`eclipse.ts` throws
  if the patch stops matching).
- A night moon disc is thousands of times over white: earthshine and the eclipse umbra
  must be tiny fractions (2e-5 and 8e-4) or the dark side saturates too.
- `ctx.visible()` only says a sphere touches the frustum: a feature placed with it often
  ends up cut by the frame edge. Use `ctx.inFrame()` (NDC inside the central 75–85%) for
  something that should be seen whole. A rock dropped on a beach reads as a block; a
  mainland headland must run inland (long along the seaward axis).
- postprocessing's `readDepth()` isn't the raw depth inside takram's aerial perspective
  shader; use `readDepthValue(depthBuffer, uv)` there.

- From a 1.6 m eye the horizon is ~4.5 km away: a cay 2 m high is only a line of palms
  over a white strip, and a group of low skerries can read as one long shore. That's real;
  make them nearer rather than bigger.
- Sheer walls built on a polar grid read as drums (karst towers looked like canisters):
  make the wall's foot wander with angle and let vegetation and dark streaks cover it.

- A steep surf face narrower than the ocean grid's vertex spacing (r × 0.012) zig-zags
  along the crest, worst from overlooks: clamp the face width to the grid and pixel size.
- Waves breaking at H = 0.78 d put the break line much farther out on gentle beaches than
  the old fixed 1.4 A + 0.4 depth: the surf zone is wider and its waves smaller.

- Foam against the low sun is no brighter than the glare on the water, so collars round
  backlit rocks vanish: that's real. Check foam features in front-lit specs
  (`sunAzimuthDeg` ≈ 160), not into the sun.

- three sorts opaque meshes by **material id** (creation order) before depth, so creating
  meshes in a different order changes equal-depth pixels. Moving the props ahead of the
  ocean and terrain changed a few hundred pixels until those were created first again.
  Check speed work with a pixel diff against a baseline, not by eye: two runs of the same
  code on the same GPU are pixel-identical here.

- Placing near-camera things by sampling shore coordinates round the camera fails in
  along-beach views (the beach in view is ahead, not beside us). Cast rays through the
  frame and march them to the ground instead (`spot()` in `props/wildlife.ts`).
- A plain vertex-coloured sand mesh lights brighter than the terrain's sand shader: tint
  sand-coloured overlays (tracks) ~0.8× or they show as pale bands.

- Anything meant to show under a storm must sit below the volumetric base (Cb 600 m) and
  clear of the scud layer: the deck and the scud hide whatever is inside them.
- A mesh hanging from the volumetric clouds (a waterspout) can't know where the deck has
  gaps: give it its own soft cloud base (spray puffs), or it ends in clear sky.
- `Vector3.transformDirection` normalises: scale a direction after transforming it, not
  before (contrails all landed 1 km from the camera).
- takram's `GetSunAndSkyIrradiance` is for a surface (cosine factor, zero with the sun
  below its plane); for something floating in the air (a contrail) use
  `GetSunAndSkyScalarIrradiance` and a phase function.
- takram's `coverageFilterWidth` near 1 turns any layer into a sheet over the whole sky
  (density = remap(mix(weather, 1, width), …)): ragged scraps need a narrow width.
- From under a storm's deck calvus and capillatus look the same: the top only shows from
  afar.
- Clouds on a round earth were right all along: a 700 m base sinks below a 2 m eye's
  horizon at ~95 km and tops show to ~140 km. With the Bruneton air alone (~220 km
  visibility) the 40–130 km of cloud undersides stacked into one dark band sitting on the
  sea. Real sea air (20–60 km) fades them into the horizon. takram's own haze didn't help:
  coverage-gated and coloured by ground irradiance (grey at sunrise).
- A hull rides waves longer than itself, so in a big swell the water barely climbs a small
  boat (rel ±0.1 m in Hs 3.5 m); spray from the swell alone never shows. It comes from the
  wind-sea crests the hull can't follow (slamming, breaking crests): model those statistically.
- Sampling the sea under a 250 m ship at 7 points aliased 12 m chop into a fake 0.5° pitch;
  sample every ~2 m.
- Regular Kelvin waves read as a printed grating from above: cap their steepness (0.05),
  weaken them inside the wedge (strongest on the cusp lines) and break them up with noise.
- Streaky clouds running to the vanishing point were float32 cancellation in takram's
  cube-sphere uv (`sqrt(a - sqrt(a² - 6mx²))` = 0 within ~1 km of mx = 0, our anchor's
  meridian), not wind or texture: the weather map was read along one line. Suspect precision
  when a pattern depends only on one direction; isolate by changing one offset at a time
  (shape offset kept the streaks, so not the 3D noise).
- Haze lit by the clear-sky horizon glows under a storm deck: scale it by the light the
  clouds let through, with a floor for the grey sky (storm 0.06, overcast 0.3).

## Ideas (not planned)

Breaking-wave lips, ship navigation lights (and their reflections), ambient occlusion
under trees, a low-power mode for phones.

## References

- Waterspouts: NWS Key West (1,400+ events 2006–2024, peak Aug); Balearic climatology
  1989–2020 (65% in autumn, Sep peak); Sioutas, Aegean 1957–2012 (Sep–Oct); Croatian
  Adriatic 2001–2011 (DHMZ)
- Noctilucent clouds: NASA, NERC MST radar facility, WMO Cloud Atlas (50–65°, late May–Aug,
  peak round the solstice)
- Morning Glory: Smith, LMU "The Morning Glory and related phenomena" (Burketown, late
  Sep–early Nov, from converging Cape York sea breezes)
- Contrails: Irvine et al., EGU 2016 (most North Atlantic contrails last < 6 h, ~5% ≥ 24 h);
  Irvine, Hoskins & Shine, GRL 2012 (ice supersaturation by weather pattern)

- takram three-geospatial — https://github.com/takram-design-engineering/three-geospatial
- jbouny/fft-ocean — https://github.com/jbouny/fft-ocean
- Ocean Rendering with FFT for Real-Time Applications — https://dspace.zcu.cz/items/a04534b1-2a3b-4457-96ca-0bc326a2b72b/full
- Breaking waves / shore foam: Wikipedia "Breaking wave"; 80.lv "Real-time shoreline simulation"
- Breaker index: McCowan (1894) H/d = 0.78; Weggel (1972) slope term; Goda (2010), "Reanalysis
  of regular and random breaking wave statistics" (the index varies with conditions);
  J. Coastal Res. "Breaking Waves on a Macrotidal Barred Beach: A Test of McCowan's Criteria"
- Cloud noise: handmade.network "Fast High-Quality Cloudscape through Noise and Reprojection"
- Rain on the sea: Melsheimer et al.; Nystuen 1990
- Visibility: Koschmieder (V = 3.912/σ); WMO visibility scale (very good 20–50 km, excellent > 50 km); sea salt rises with wind (Korean coast extinction vs wind, R² 0.57); Mace Head sea salt peaks in winter maritime polar air; Saharan dust over the Mediterranean in spring and autumn (NASA Earth Observatory)
- Sea turtles: seaturtlesofindia.org (Andaman greens and hawksbills Apr–Sep, olive ridleys
  Nov–Mar); Volunteer World "Turtle seasons around the world" (Costa Rica, Galápagos,
  Greece); NC Wildlife (loggerheads May–Aug, ~60 days' incubation)
- Mangroves: FAO "Mangroves of Asia" (Red Sea and Gulf: patchy, pure Avicennia at wadi
  mouths and sheltered lagoons); Frontiers in Marine Science 2025 review (Middle East
  Avicennia 2–4 m; freshwater, salinity, heat and shelter control it)
- Ship wakes: Kelvin (1887) wedge 19.47°; Rabaud & Moisy, PRL 2013 "Ship wakes: Kelvin or
  Mach angle?" (angle ~ 1/Fr past Fr ≈ 0.5); Darmon, Benzaquen & Raphaël 2014 (the wedge stays
  Kelvin, the angle of largest waves narrows as 1/Fr)
- Ship motions: heave/pitch RAOs small below λ/L ≈ 1, near 1 above ~1.75 (monohull
  sea-keeping studies, IJAME); whitecap cover W = 3.84e-6 U^3.41 (Monahan & O'Muircheartaigh 1980)
- Arctic boats: Statistics Greenland, fishing fleet (3,000–5,000 dinghies); Royal Greenland
  vessels (65–83 m prawn trawlers)
- Driftwood: Hakai Magazine "Iceland's Sinking Driftwood Supply"; Eggertsson, Jökull 1993
  (Siberian origin, larch with roots); Wikipedia "Beach wrack"; Deidun et al. (Posidonia
  banquettes, Malta)
- Moon: Allen, *Astrophysical Quantities* (lunar phase magnitude); astronomy-engine
  `SearchLunarEclipse` / `SearchGlobalSolarEclipse`
- Shore life: Wikipedia "Ghost crab" / "Ocypode"; Strachan et al. 1999, Scientia Marina
  (Ocypode cursor, Cyprus, nocturnal); Cabo Verde burrow zonation (Afr. J. Mar. Sci. 2016);
  Rhins of Galloway beach flower guide and Wildlife Trusts (sea holly Jul–Sep, sea bindweed
  Jun–Aug, sea sandwort, sea rocket)
