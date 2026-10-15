# Amazing Sea Wallpaper — Plan

A daily, date-seeded, photorealistic 4K sea-and-beach wallpaper, rendered **in the browser
with three.js** and hosted on GitHub Pages. The date is the seed: same day, same scene,
everywhere; any date can be re-rendered on demand, so the archive is free.

## Versions

Informal (no git tags); each is a milestone. Dates are 2026.

| Version | Date | Main changes |
|---|---|---|
| 0.1 (M1) | 10-13 | Vite + three.js skeleton; date → seed → `SceneParams`; Bruneton sky; real moon phase; auto exposure; 4K download; snapshot + contact-sheet scripts; loading splash |
| 0.2 (M2) | 10-14 | FFT ocean (3 cascades, LEAN roughness); procedural beaches, surf, see-through shallows, caustics, foam, wet sand |
| 0.3 (M3) | 10-14 | Biomes; sun shadows; procedural rocks, sea stacks, vegetation, gulls, boats; four camera compositions |
| 0.4 (M4) | 10-14 | Weather + volumetric clouds (also in reflections); frame accumulation; stars; twilight grading; composition validator |
| 0.5 (M5) | 10-14 | Device-aware resolution, `?frames=`; GitHub Pages workflow with daily `/latest.jpg` snapshot; README |
| 0.6 (M6) | 10-14 | NaN skyline-speck fix; blue-hour grade; planar reflections; cloud shadows; moonlit nights; plant framing rules |
| 0.7 (M7) | 10-14 | Wishlist 7.1–7.15: better ships, moss on rocks, branching trees, wind, cloud genera, storms + lightning, five oceans + polar ice, dolphins/whales, migratory birds, seabird islands, portrait mode, rainbows, surf spray, mountains + volcanoes, rain on the sea |
| 0.8 | 10-14 | Performance: still-scene accumulation, env-cube shader reuse, FFT on a worker — cloudy 4K 4.4 → 2.9 s, same image |
| 0.9 | 10-14 | Future dates show today; `/random`; cloud grain fix (no temporal upscaling, sub-pixel jitter, sky denoise); wave-break redesign (beach-facing breakers, roller whitewater, foam weave, soft spray) |
| 0.10 | 10-15 | Marine animals ride the real wave height and break the surface with white water (exit and contact splashes, blows); seals, sea lions, fur seals and elephant seals hauled out on skerries by region; sea fog, offshore fog banks and Arctic sea smoke by climate, season and time of day; lighthouses on points and rocks, lit at dusk, night and in fog, with beams scattered by haze and fog; splash boat rides the middle wave, gentler waves, higher sun; unit tests; leaf meshes per species (oval, ovate, lance, needle, pinnate leaflets) and bark relief with buttress roots; no glow or bright rims around trees and ridges against a low sun (clouds at full resolution on beaches, no cloud TAA history, silhouette sky fill, no sun glints on leaves) |
| 0.11 | 10-15 | Shore debris: driftwood logs (bleached or barked, checked along the grain, root wads) heaped on the storm line and sticks on the wrack line, by coast (Arctic and Pacific most, none on Southern Ocean shores); a wrack line of kelp, Posidonia seagrass banquettes and fibre balls, or sargassum; coconuts on palm coasts. Shore life: ghost crabs (most at dusk and night) with burrows and sand fans, shore and hermit crabs; shells by coast (cockle, clam, scallop, mussel, razor, sand dollar) and starfish; strandline and foredune flowers by biome and month (beach morning glory, sea bindweed, sea holly, sea daffodil, ice plant, thrift, sea rocket, oysterplant) |
| 0.12 | 10-15 | Moon and eclipses: nights lit by the real phase law (half moon ~1/10 of full), starlit nights with the moon down or new, earthshine on crescents; the moon by day in the frame with the sun; real eclipses on their dates (astronomy-engine): partial, annular and total solar (black moon, corona, dark sky with a 360° horizon glow, stars), partial and total lunar (copper umbra, dimmed moonlight) |
| 0.14 | 10-15 | Colonies on the mainland: seabird cliffs on a headland ridge running into the sea (gannets, puffins, boobies), penguin rookeries crowding the beach; seals and sea lions hauled out on the beach (elephant seals most often); `colonySite` and `haulOut` in scene specs |
| 0.15 | 10-15 | Islands at sea on ~30% of days, by coast: nordic skerries with pines, steep Mediterranean and desert islands, tropical palm cays, karst towers and high volcanic islands; heightfields with curvature drop, palms and pines instanced; `islands` in scene specs |
| 0.13 | 10-15 | Scene specs: a JSON description (`src/sceneSpec.ts`) forces any part of a scene (time of day, sun, moon, eclipse, biome, ocean, coast, weather, clouds, storm, fog, lighthouse, landform, colonies, seals, wind, camera, and the props' own choices) on top of a date; `?scene=` on the page, `--scene` in the snapshot script; unforced output unchanged |

## Decisions

- **Web-only rendering** (2026-10-13). Static Pages site; each visitor's browser renders the
  day. Seed → params is exactly deterministic; pixels may differ slightly across GPUs. A still
  can afford seconds per image (accumulation, expensive shaders). Rejected: Blender/Cycles
  headless (needs an out-of-browser render step), AI image generation (paid, less control).
- **Procedural props, no downloaded models** — zero asset weight, per-date variety.
- **Stills are averaged over many frames** (64 by default) so stochastic clouds converge.
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
  caustics, foam, rain rings; `grid.ts` polar grid to 120 km.
- **Land:** `terrain.ts` shared GLSL/TS height function (coast, dunes, hills, sandbar), sand
  shading and surf profile (`surfCycle`, mirrored in `props/surf.ts`). `biome.ts` /
  `oceans.ts` pick palettes, plants, sea state and ice.
- **Sky:** `scene.ts` atmosphere + env cube + post; `clouds.ts` / `cloudTypes.ts` (WMO genera
  per étage); `exposure.ts` meters a 32² sky cube; `moon.ts`; `stormEffects.ts` rain shafts,
  lightning flash, lens rain, rainbows.
- **Props** (`src/props/`): rocks, trees/vegetation (+ `wind.ts` bending), birds, migratory
  flocks, ships, marine life, ice, colonies, pinnipeds, landforms, storm bolts, surf/rock
  spray, shore debris (`debris.ts`: `debrisFor()` picks driftwood/wrack/coconuts by biome
  and ocean; wrack on the high-tide line at ~1.1× run-up height, logs on the storm line
  above ~2.2× and up to the back of the beach), shore life (`shoreLife.ts`: `shoreLifeFor()`
  picks crabs by biome and time of day, shells by coast, flowers in bloom by month;
  everything at real size, so crabs and shells only show near the camera); built with `builder.ts` (`MeshBuilder`). `PropContext.seaLevel()` samples the FFT
  wave height on the CPU so things float on the actual waves.
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
  download; `random/index.html` redirects to a random past day.
- **Tests:** `test/` (Vitest, `npm test`, also in CI before the build) covers the logic,
  not the rendering: PRNG, dates, FFT, `generateParams` invariants over three years of days
  (sun/moon geometry, fog, lighthouse, seals, storms, rainbows, ice by region and
  frequency), shore frame and terrain, beam directions, cloud genera, camera horizon,
  composition re-rolls, ocean spectrum and `seaLevel()`, wind, scene specs, shore debris by coast and
  driftwood meshes, moonlight phase law, eclipse dates and framing, night skies, the moon
  by day, shore life (crabs, shells, flowers in season) and its meshes.
- **CI:** `.github/workflows/pages.yml` deploys on push and daily at 00:05 UTC renders
  `/latest.jpg` and `/latest-portrait.jpg` with SwiftShader.

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

## Ideas (not planned)

Breaking-wave lips, boat wakes, per-pixel cloud shadows matching the clouds, ambient occlusion
under trees, a low-power mode for phones.

## References

- takram three-geospatial — https://github.com/takram-design-engineering/three-geospatial
- jbouny/fft-ocean — https://github.com/jbouny/fft-ocean
- Ocean Rendering with FFT for Real-Time Applications — https://dspace.zcu.cz/items/a04534b1-2a3b-4457-96ca-0bc326a2b72b/full
- Breaking waves / shore foam: Wikipedia "Breaking wave"; 80.lv "Real-time shoreline simulation"
- Cloud noise: handmade.network "Fast High-Quality Cloudscape through Noise and Reprojection"
- Rain on the sea: Melsheimer et al.; Nystuen 1990
- Driftwood: Hakai Magazine "Iceland's Sinking Driftwood Supply"; Eggertsson, Jökull 1993
  (Siberian origin, larch with roots); Wikipedia "Beach wrack"; Deidun et al. (Posidonia
  banquettes, Malta)
- Moon: Allen, *Astrophysical Quantities* (lunar phase magnitude); astronomy-engine
  `SearchLunarEclipse` / `SearchGlobalSolarEclipse`
- Shore life: Wikipedia "Ghost crab" / "Ocypode"; Strachan et al. 1999, Scientia Marina
  (Ocypode cursor, Cyprus, nocturnal); Cabo Verde burrow zonation (Afr. J. Mar. Sci. 2016);
  Rhins of Galloway beach flower guide and Wildlife Trusts (sea holly Jul–Sep, sea bindweed
  Jun–Aug, sea sandwort, sea rocket)
