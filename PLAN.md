# Amazing Sea Wallpaper — Plan

A daily, date-seeded, realistic 4K (3840×2160) wallpaper of sea and beach scenes, rendered
**in the browser with three.js** and hosted on GitHub Pages. Each day varies camera angle,
time of day, sun/moon position, weather, vegetation, rocks, birds and ships.

## Status

| Milestone | State |
|---|---|
| 1. Skeleton: Vite + three.js app, date seed, ocean + sky + camera | ✅ Done (2026-10-13) |
| 2. Realism core: FFT ocean, water shading, beach terrain, shoreline foam | ✅ Done (2026-10-14) |
| 3. Biomes & assets: rocks, vegetation, birds, ships | ✅ Done (2026-10-14) |
| 4. Variation: time of day, weather, night/moon, composition validator | ✅ Done (2026-10-14) |
| 5. 4K export + GitHub Pages deploy (+ optional CI snapshot) | 🟨 Ready — needs push + Pages enabled |
| 6. Polish: contact sheet of ~50 dates, tune weights | ✅ Done (2026-10-14) |
| 7. Wishlist from `TODO.md` (see below) | 🟨 In progress |

Legend: ⬜ not started · 🟨 in progress · ✅ done

## Milestone 7: wishlist (from TODO.md)

Order chosen for value vs. effort; each item is committed separately.

| # | Item | State |
|---|---|---|
| 7.1 | Ships: more models, random colours, rust/weathering, better quality | ✅ |
| 7.2 | Algae and moss on stones (random, in suitable biomes) | ✅ |
| 7.3 | Trees: more variety, less repetition; bark and leaf meshes | ✅ |
| 7.4 | Wind: plants bend with the day's wind; sea state follows | ✅ |
| 7.5 | Cloud formations: research cloud types; per-type layer configs | ✅ |
| 7.6 | Storms: research; dark clouds, strong waves, rain, lightning as a random event | ✅ |
| 7.7 | Five earth's oceans: research their differences; per-ocean water, waves, ice | ✅ |
| 7.8 | Marine animals: dolphins, swordfish, whales | ✅ |
| 7.9 | Migratory birds (research: ducks, flamingos, geese…) | ✅ |
| 7.10 | Bird-nesting islands (research) | ✅ |
| 7.11 | Mobile mode: an interesting vertical (portrait) view for phones | ✅ |
| 7.12 | Rainbow - in rain or sea splash | ⬜ |
| 7.13 | Wave break on shore, splashes on rocks | ⬜ |
| 7.14 | Reasearch and add shore seen mountains, volcano alive and dormant | ⬜ |
| 7.15 | Reasearch online how rain drops affects sea and add it to your simulation | ⬜ |

7.1 notes: `ships.ts` rewritten — lofted hull (36×14) with flare, waterline paint stripe,
antifouling below the waterline, rust patches + streaks scaled by vessel age; sails as
cambered grids with panel seams; superstructures with window bands. Types: sloop,
catamaran, motor yacht, trawler (outriggers, A-frame), dhow (lateen rig; tropical/desert),
container ship, tanker.

7.3 notes: `src/props/trees.ts` — recursive limb skeleton (`growTree`) with species bark
(furrowed / birch / pine plates) and leaf meshes at twig tips (`leaves`, crown-depth shading);
needle `spray` cards for spruce and cypress. Species: palm, pandanus, stone pine, olive, cypress,
broadleaf, spruce, birch, acacia, shrubs. 4–6 variants per kind + per-instance proportions.
Leaf area had to be ~10× the first attempt before distant crowns stopped looking bare.
Dense Mediterranean 4K: ~5 s (was ~3.5 s). Palms and dune grass unchanged.

7.4 notes: `src/props/wind.ts` bends vegetation in the vertex shader (world wind direction
mapped into each instance's frame, quadratic with height, per-species `bend.flex`, drag ∝ speed²,
gust patches) and the same patch on `customDepthMaterial` so shadows bend too. Wind speed is
scaled by the weather (clear 0.85× … overcast 1.3×); "windy" in beach titles from 10 m/s. The
ocean spectrum, whitecaps and surf already followed `windSpeed`.

7.5 notes: `src/cloudTypes.ts` — the ten WMO genera (+ towering cumulus) in three étages,
each a takram layer (altitude, thickness, density profile, erosion, coverage exponent). The
weather kind picks one genus per étage; cool coasts lean stratiform (marine stratocumulus,
stratus), tropical ones cumulus. Cirrocumulus skies use 3× smaller cells. Overcast was navy
because the exposure meter only sees the clear sky: heavy cloud now adds up to +1.1 EV (faded
out at low sun), a warmer white balance and less saturation.

7.6 notes: `generateStorm()` in params.ts — 7% of non-night days (~5% overall): weather kind
`storm`, cumulonimbus (base 600 m, 9.5 km tall) ± altostratus, wind 14–22 m/s (the FFT sea and
plants follow), 1–4 rain shafts, lightning in 75% of storms, rain on the lens in 40%.
`props/storm.ts` builds bolts (midpoint-displaced, forked, camera-facing ribbons, ~250× sky
luminance so bloom glows); `stormEffects.ts` draws rain shafts (screen space + depth test), the
flash on the cloud base and lens rain. Lesson: transparent meshes (or dithered ones) don't
composite with takram's clouds/aerial perspective — they see the depth buffer only.

7.7 notes: `src/oceans.ts` — research summary in the header. Biome → ocean weights (2026:
Atlantic 143 days, Pacific 121, Indian 64, Arctic 20, Southern 17). Per ocean: latitude, wind
and swell multipliers (Southern 1.35× wind, 1.7× swell; Pacific 1.35× swell wavelength; Indian
monsoon Jun–Sep), polar water. `props/ice.ts`: pack-ice floes (instanced slabs, sized with
distance, in noise fields with open leads; damp the sea to 40% wind), glacier bergs (noisy
sphere + fracture planes, blue fresh faces), tabular bergs (banded slabs, 2.5–18 km). Polar
coasts keep only grass, shrubs and (Arctic) birch. Title shows the ocean.

7.8 notes: `props/marine.ts` — 35% of non-storm days; species weighted by ocean (orcas only on
cool coasts). Lofted spine bodies (radius profiles), countershading, orca eye patch/saddle,
humpback barnacles and long white flippers, fish tail vertical vs. cetacean flukes horizontal.
Poses: dolphin leap/roll, orca surfacing, humpback flukes/breach/blow, swordfish leap; spray
crowns. Turned roughly side-on to the camera — head-on animals read as blobs. Gotcha:
`MeshBuilder.tube` along −x has angle 0 pointing *up*.

7.9 notes: `props/migratory.ts` — geese (V skeins / slanting lines, 50–250 m away, 15–70 m up)
and eider-like sea ducks (wavering strings 1–4 m over the waves) on cool coasts, 4× likelier in
Mar–May and Sep–Nov; flamingos on warm non-polar coasts — wading flocks (standing, feeding,
one-legged poses) in 2–55 cm of water, or flying lines. Lesson: pick flock positions by a view
ray that reaches the chosen altitude; fixed NDC heights land underwater when the camera
pitches down.

7.10 notes: `SceneParams.colony` (15% of days) + `props/colony.ts`: gannetry (guano baked into
vertex colours — thick on ledges, vertical streaks down the cliffs), puffin island (moss cap
via the rock material), tropical islet, penguin rookery (instanced penguins on slopes with
n.y > 0.75). 70–180 m wide, 300–1500 m offshore, footprint checked to be all water; 60–700
circling gulls/gannets. Gotcha: the stack geometry spans y ≈ −0.45…0.75 — sink by 0.1 h only.

7.11 notes: portrait = same scene, recomposed. `generateParams(date, attempt, aspect)`: the 36 mm
side maps to the image's long side (`camera.ts`), low-sun azimuth spread and night moon framing
scale with min(1, aspect) (one draw each, so nothing else shifts), storm placement uses the real
horizontal FOV, and `measureFrame` casts rays in the frame's shape. `main.ts`: portrait when
`(orientation: portrait)` or w < h; phones render at their screen shape (long side 2560, or
1920 on small screens). Touch screens keep the info bar visible, stacked. CI also publishes
`latest-portrait.jpg` (1290×2796). Vertical glitter paths make great phone wallpapers.

## Decision: web-only rendering (three.js)

**Final decision (2026-10-13): render entirely with web tech**, because it fits the GitHub
Pages deployment: the site is a static app, and each visitor's browser renders the day's scene.

Consequences:
- No image storage problem: Pages hosts only HTML/JS/assets. Any past date is re-rendered on
  demand (`?date=2026-10-13`), so the archive is free.
- The seed → scene parameters mapping is exactly deterministic. Pixels may differ very slightly
  between GPUs/browsers; acceptable.
- Because we produce a still, not a game, we can spend seconds per image: supersampling,
  accumulated soft shadows, expensive shaders.

Rejected alternatives (kept for reference): Blender/Cycles headless (photoreal, but needs a
render step outside the browser); AI image generation (needs paid API/GPU, less control).

## Tech stack

| Concern | Choice |
|---|---|
| Build | Vite + TypeScript |
| Renderer | three.js `WebGLRenderer` (WebGPU/TSL later if useful) |
| Sky & atmosphere | `@takram/three-atmosphere` — Bruneton precomputed atmospheric scattering: Sky, SunLight, Stars, AerialPerspective (haze). Fallback: three.js `Sky` (Preetham) |
| Clouds | `@takram/three-clouds` — volumetric clouds, cloud shadows, light shafts, haze |
| Ocean | Custom GPU FFT ocean (Tessendorf, Phillips/JONSWAP spectrum) rendered to displacement + normal textures; references: jbouny/fft-ocean, three.js OceanShaders, `webgl-fft-ocean` |
| Post-processing | `postprocessing` (pmndrs) EffectComposer (required by takram): AgX tone mapping, bloom, god rays, depth of field, grain, vignette |
| Assets | glTF models + CC0 textures: Poly Haven, Quaternius, Kenney |
| Seeded RNG | Hash date string (cyrb128 / SHA-256) → sfc32 / mulberry32 |
| Optional later | `three-gpu-pathtracer` (WebGL path tracing) for an experimental "photoreal" mode |

Notes: takram packages are Beta; they need the pmndrs `EffectComposer`, not the one from
three.js examples. The path tracer needs static CPU-side geometry, so the ocean would have
to be baked to a mesh for that mode.

## Current implementation (after M6)

How to run:
- `npm run dev` → open the printed URL. `?date=YYYY-MM-DD` picks a day; `?w=1920&h=1080`
  overrides the default 3840×2160.
- `node scripts/snapshot.mjs --url <dev-url> [--w 1920 --h 1080] DATE | today | FROM..TO`
  renders days in headless Chrome to `out/DATE.jpg` + `out/DATE.json` (`DEBUG=1` prints
  exposure/lighting values).
- `node scripts/contact-sheet.mjs [--dir out] [--cols 4]` → `out/contact-sheet.jpg` grid for
  reviewing many dates at once.

Source map:
- `src/random.ts` — cyrb128 hash + sfc32 PRNG; `Random.derive()` for independent streams.
- `src/params.ts` — date → `SceneParams` (time of day, sun/moon directions, camera, wind,
  water style, title). Moon phase is real (astronomy-engine); the moon is placed at the
  physically correct angular distance from the sun so its lit side is consistent.
- `src/fft.ts` — iterative radix-2 2D inverse FFT (CPU, Float64).
- `src/spectrum.ts` — Tessendorf synthesis: JONSWAP wind sea (Mitsuyasu spreading) + narrow
  swell peak, normalised to target significant heights, on 3 cascades (256², patch sizes
  ≈ L, L/6.37, L/37 so tiles never align). Eight fields packed into four complex IFFTs →
  half-float textures A (displacement, ∂Dx/∂z), B (slopes, ∂Dx/∂x, ∂Dz/∂z), C (slope
  moments, mipmapped for LEAN-style sub-pixel roughness). ~0.3 s on the CPU.
- `src/grid.ts` — camera-centred polar grid (geometric ring spacing to 120 km).
- `src/ocean.ts` — FFT displacement + normals, Jacobian whitecaps, sky reflection, sun glitter,
  backlit crests, large "gust" patches of rougher/calmer water, Earth curvature. Near shore:
  swell damped by depth, refracted surf crest lines parallel to the shore (in sets), see-through
  shallows (per-channel absorption, sand floor, caustics), whitewater/streak/shoreline foam.
- `src/terrain.ts` — shared GLSL + TypeScript-mirrored height function (integer hash noise so
  CPU and GPU agree): wobbly curved shoreline, beach slope levelling into dunes and inland hills,
  sea floor with optional submerged sandbar. Sand shading: albedo patches, wrack line, wind
  ripples, glossy wet band below the run-up line, swash foam. Voronoi "foam with holes" lace.
- `src/scene.ts` — takram atmosphere anchored on WGS84 (local Y-up frame via
  `getNorthUpEastFrame`), sky + env cube, sun/sky irradiance, aerial perspective, exposure,
  bloom, vignette, AgX tone mapping, saturation/contrast.
- `src/exposure.ts` — auto exposure: renders the sky into a 32² float cube and averages the
  luminance of directions inside the camera frustum (sea ≈ dim sky reflection).
- `src/moon.ts` — night only: phase-shaded moon disc. At night the atmosphere is lit *from
  the moon's direction* (moonlight = reflected sunlight) and then graded dark/blue.
- `src/main.ts` — page: renders once, date prev/next/today links, JPEG download.
- Splash screen (`index.html` + `src/style.css`): pure-CSS animated SVG waves, bobbing
  sailboat and glowing sun while rendering; fades out after ≥1.2 s. Animations use only
  `transform`/`opacity` so they keep running on the compositor while the GPU render blocks the
  main thread; disabled under `prefers-reduced-motion`.

M1 findings:
- 4K (3840×2160) renders in ~1.5 s on an M2 Max (Metal via ANGLE); 1080p ~1 s.
- Production bundle ~830 kB (211 kB gzip); takram precomputes its LUTs on the GPU, so no
  extra asset downloads yet.
- Bloom rang (pink arc) around the sun → highlights clamped before bloom.
- Horizon showed dark dashes (sky model's black "ground" peeking under the polygonal far
  edge) → ground albedo set and curvature reduced by 10%. Faint traces remain — revisit in M2.
- Known weaknesses for M2: near-field water looks slightly smeared/stretched and the
  wave pattern is a bit regular; no clouds (biggest realism gap, M4); night has no stars
  (M4); blue-hour scenes facing away from the sun are still a little bright/pink.

- `src/biome.ts` — tropical / mediterranean / nordic / volcanic / desert; each picks water,
  sand, rock colours, sea-stack odds, plant mix, foliage and ground-cover tint.
- `src/shadow.ts` — lets the custom terrain/ocean shaders sample the sun's PCF shadow map.
- `src/props/` — all procedural, seeded per date (no downloaded assets):
  - `context.ts` placement helpers (frustum test, ground height, derived RNG streams);
  - `builder.ts` tiny mesh builder (tubes, lumpy oriented blobs, quads, vertex colours);
  - `rocks.ts` fractured boulders (noisy sphere sliced by planes, ridged creases, wet
    darkening), waterline clusters, beach pebbles, stratified sea stacks;
  - `vegetation.ts` palms, stone pines, cypresses, spruce-like conifers, bushes, dune grass;
    zoned in shore coordinates with forest/clearing noise; hero plants for framed shots;
  - `birds.ts` gull flocks (3 poses; silhouettes against low sun);
  - `ships.ts` sailboats, fishing boats, distant container ships.
- Props use MeshStandardMaterial lit by a DirectionalLight carrying the same sun irradiance as
  the custom shaders + the sky cube as `scene.environment`, so all lighting shares one unit.
- `CoastParams.composition`: shoreline / along-beach / framed / overlook; `hillHeight` inland.

- `src/clouds.ts` — @takram/three-clouds volumetric clouds configured from `params.weather`
  (clear / cirrus / few / scattered / broken / overcast → coverage, per-layer density,
  seeded pattern, `sunVisibility`), plus `renderCloudyEnvironment()` which re-renders the
  reflection cube per face with clouds. Assets self-hosted in `public/assets/`
  (`local_weather.png`, `shape*.bin`, `turbulence.png`, `stbn.bin` (downloaded from takram's
  repo, MIT), `stars.bin`).
- `src/accumulate.ts` — `AccumulatePass`: running mean over frames in linear HDR before bloom;
  the still is rendered 64× so the stochastic clouds converge.
- Stars (Yale BSC via takram `StarsMaterial`) at night / late twilight, rotated to the date's
  sidereal orientation; excluded from exposure metering. Blue hour gets a cooler white balance.
- `src/camera.ts` — shared camera construction; `src/composition.ts` — ray-grid frame coverage
  (sky/sea/land) and re-roll of coast/composition (sub-seeded) for bad framings.

- `.github/workflows/pages.yml` — build + deploy to Pages on push to `main`; daily 00:05 UTC run
  also renders today's (UTC) wallpaper with headless Chromium + SwiftShader at 4K / 24 frames
  into `/latest.jpg`, `/latest.json`, `/daily/DATE.jpg` (allowed to fail without blocking).
  Only the current day's image is in each Pages artifact; the archive is "re-render any date".
- Page: default resolution adapts to the device (4K desktop, 1920 on small screens, capped by
  GPU limits); `?frames=` trades grain for speed; favicon; README with usage and credits.

M6 (polish) changes:
- **Root cause of the recurring white skyline specks:** terrain height was NaN far inland —
  the sea-floor `exp()` overflowed to ∞ and `mix(∞, land, 1)` = ∞·0 = NaN. Clamped (GLSL + TS).
  Also: terrain footprint from distance × pixel angle (screen derivatives can be NaN on
  silhouettes); zero normals at procedural blob poles fixed.
- Blue hour reads as blue hour: cool white balance (0.6, 0.85, 1.25) + half-strength scotopic
  shift (the Bruneton twilight sky is strongly magenta).
- `src/reflection.ts` — planar reflection of land/props (mirrored camera + oblique clip plane,
  half-res, mipmapped) blended over the cloudy env reflection in the ocean shader.
- Patchy cloud shadows on sea and sand (`cloudShadow()` in shadow.ts), seeded by the weather.
- Nearby tall plants/bushes only at the frame sides; framed-shot hero trees 9–30 m away.
- Night: moon kept 4–18° high and the camera turned toward it → moon + glitter path.

Future ideas (not planned): cliffs/headlands, breaking-wave lips, boat wakes, foam/wet-sand
planar reflections, per-pixel cloud shadows matching the actual clouds (BSM), ambient
occlusion under trees, a lighter "low power" mode for phones.

M5 findings:
- SwiftShader (software WebGL) works with Playwright's Chromium headless shell. 4K / 24 frames
  ≈ 258 s on an M2 Max (12 cores) → expect roughly 15–20 min on a 4-vCPU GitHub runner.
  1080p / 64 frames was 444 s — the reflection cube's per-face clouds dominated, so its frame
  count now scales with `?frames`.
- To go live: push `main`, then *Settings → Pages → Source: GitHub Actions*.

M4 findings:
- takram clouds' TAA (variance clipping) leaves residual noise on a static camera — averaging
  frames ourselves fixes it. 4K with clouds ≈ 3–4 s on M2 Max (was ~1.5 s).
- postprocessing's `EffectComposer.setSize()` resizes the *renderer* — restore it after
  rendering side composers (the env cube), or everything comes out low-res.
- A mirror-sharp sun highlight is ~1000× the sky radiance: even 2% sun visibility under
  overcast showed a glitter path → overcast direct sun ≈ 0 and the sun disc is hidden.
- Backlog: per-pixel cloud shadows in the custom terrain/ocean shaders (currently a global
  `sunVisibility`); dusk still leans purple; residual fine cloud grain; validator ignores
  props (very close trees can block the view); night could use a visible moon more often.

M3 findings & deviations:
- **Deviation:** props are procedural instead of CC0 glTF downloads — zero asset weight,
  per-date variety, nothing external to host. Close-ups are somewhat stylised; at wallpaper
  scale they read well.
- A `sampler2DShadow` bound to a non-depth texture rejects the draw (sea/sand vanished when
  the sun was down) → always render a shadow map, even when the light carries no energy.
- three's `IcosahedronGeometry(1, n)` subdivides faces (n+1)² times — detail 5 is only 720
  faces; rocks use detail 30.
- Polish backlog: cypress/stone-pine close-ups look toy-like; boats lack reflections and
  wakes (env-cube reflections can't show local objects → planar reflection pass?); dusk
  scenes can be over-purple; terrain under trees has no ambient occlusion; distant shoreline
  still occasionally sparkles.

M2 findings:
- 65% of dates are beaches now (camera on the sand at eye height, dune top, or drone);
  shoreline runs diagonally across the frame. Sand palettes: white/golden/grey/black.
- Gotchas fixed along the way: inland beach slope must level off (was a ramp into the sky);
  ocean must `discard` over land; GLSL `smoothstep` with reversed edges is undefined (Metal);
  **screen-space derivatives explode on silhouettes → clamp `footprint`, otherwise NaN normals
  become white bloom dashes** (Metal fast-math also defeats `isnan` checks).
- Remaining for later: distant land is bare and flat-looking (vegetation/rocks in M3), no
  shadows/AO on dunes, foam at grazing distances is approximate, dawn scenes still pinkish,
  breaking waves are foam bands, not curling lips.

## 1. Seed → scene parameters (deterministic)

- `seed = hash("YYYY-MM-DD")` → seeded PRNG. Same date = same scene everywhere.
- All randomness goes through one `params.ts` → a plain `SceneParams` object (also shown on
  the page and serializable to JSON for debugging).
- Seeded parameters:
  - **Biome / coast type:** tropical (palms, turquoise water), Mediterranean (cliffs, pines),
    Nordic (dark rocks, cold light), desert dunes, volcanic black sand.
  - **Time of day:** weighted toward golden hour and blue hour. Drives sun elevation/azimuth.
    Night scenes use moonlight + stars.
  - **Moon:** phase from the real date; position randomized; custom moon disc shaded by phase.
  - **Weather:** clear / scattered clouds / overcast / storm; fog/haze density; wind speed
    (drives ocean spectrum: wave height, choppiness, foam).
  - **Camera:** height (beach level, cliff top, drone), heading, focal length 24–85 mm,
    horizon on rule-of-thirds lines.
  - **Props (probabilistic):** rocks/boulders, vegetation density, bird flock, 0–3 ships
    (sailboat, fishing boat, distant freighter), lighthouse.
- **Composition validator:** reject and re-roll (derived sub-seed) when the camera faces a
  cliff, a ship sits dead center, the horizon is hidden, etc.

## 2. Scene construction

1. **Ocean:** GPU FFT simulation → displacement/normal/foam (Jacobian) textures; large grid
   with LOD or projected grid to the horizon. Water shader: Fresnel reflection of the sky,
   sun glint, subsurface/scatter color, depth-based absorption (turquoise shallows → dark
   deep), whitecaps from foam map.
2. **Beach terrain:** seeded heightfield (fBm noise + shaped beach slope / cliffs); sand, wet
   sand (darker, glossy near waterline), rock materials blended by height/slope.
3. **Shoreline:** foam band from water depth (scene depth vs. water surface) + animated-phase
   swash lines frozen at a seeded moment.
4. **Sky:** takram atmosphere driven by sun/moon direction; volumetric clouds per weather;
   stars at night.
5. **Scattering:** `InstancedMesh` placement of vegetation/rocks via slope + height masks with
   Poisson-disc sampling.
6. **Ships & birds:** glTF models; ships posed to sampled wave height/normal; birds as
   instanced flock with seeded wing poses.
7. **Post:** AgX tone mapping, bloom on sun glint, god rays, subtle DOF, grain, vignette.

## 3. Rendering a 4K still in the browser

- Render offscreen at 3840×2160 regardless of screen size; show a scaled preview.
- Quality through accumulation: N jittered frames (sub-pixel camera jitter) averaged → clean
  anti-aliasing and softer shadows.
- If the GPU's max render-target size or memory is too small (some mobiles): render in tiles
  and stitch, or fall back to a lower resolution.
- "Download 4K" button → `canvas.toBlob()` → PNG/JPEG named `sea-YYYY-MM-DD.jpg`.

## 4. Deployment (GitHub Pages)

- GitHub Actions: on push to `main` → `vite build` → `actions/deploy-pages`.
- The site always renders "today" (in the visitor's local date, or UTC — decide in M5).
- **Optional CI snapshot** (for a stable `/latest.jpg` URL usable by wallpaper tools that
  can't run JS): daily cron job runs Playwright/headless Chromium, renders the page, saves the
  JPEG, publishes it as a Release asset + `latest.jpg`. Caveat: CI runners have no GPU
  (SwiftShader software WebGL), so this is slow — acceptable for one frame, verify in M5.

## 5. Website

- `index.html`: today's wallpaper fullscreen, title + parameters (e.g. "Volcanic shore, blue
  hour, waxing crescent"), Download 4K button.
- Date picker / prev-next to browse any date (rendered on demand).
- Debug panel (lil-gui) in dev mode to override any parameter.

## 6. Milestone details

1. **Skeleton** — Vite + TS + three.js; date → seed → params; simple ocean (three.js `Water`)
   + takram sky + camera; renders and downloads at 4K.
2. **Realism core** — FFT ocean, water shader, beach terrain, shoreline foam. Makes or breaks it.
3. **Biomes & assets** — rocks, vegetation, birds, ships.
4. **Variation** — time of day, weather/clouds, night + moon; composition validator.
5. **Deploy** — Pages workflow; 4K export robustness (tiling/fallback); optional CI snapshot.
6. **Polish** — contact-sheet page rendering ~50 dates as thumbnails; tune weights; fix ugly
   combinations.

## Risks & fallbacks

- **Realism ceiling of real-time shading** → lean on accumulation, good atmosphere (takram),
  careful water shading, CC0 photo-scanned assets; experimental path-traced mode later.
- **Weak devices can't render 4K** → tile rendering or lower-res fallback.
- **Beta dependencies (takram)** → pin versions; Preetham `Sky` as fallback.
- **Asset download size** → compress glTF (Draco/Meshopt), KTX2 textures, lazy-load per biome.

## Log

- 2026-10-13: Researched approaches; initially leaned toward Blender + Cycles headless.
- 2026-10-13: Confirmed Blender is free/open source; reviewed library alternatives.
- 2026-10-13: **Final decision: web-only rendering with three.js** (fits GitHub Pages
  deployment). Plan rewritten around browser rendering; archive = re-render any date.
- 2026-10-13: **M1 done.** Vite + TS + three.js 0.186, takram atmosphere 0.19, postprocessing
  6.39. Gerstner-sum ocean (FFT deferred to M2), physical sky, real moon phase, auto exposure,
  night "lunar mode", 4K download, Playwright snapshot + contact-sheet scripts.
- 2026-10-13: Added animated loading splash (waves, boat, sun).
- 2026-10-14: Started using git (repo-local identity). Commits per logical step from now on.
- 2026-10-14: **M2 done.** FFT ocean (3 cascades, LEAN roughness), procedural beaches with surf,
  shallow-water optics, caustics, foam, wet sand. 4K still ~1.3 s on M2 Max.
- 2026-10-14: **M3 done.** Biomes, sun shadows, procedural rocks/sea stacks, vegetation, gulls,
  boats; four camera compositions. 4K ~1.5 s.
- 2026-10-14: Added milestone 7 from the user's TODO.md wishlist.
- 2026-10-14: 7.3 done — branching trees with bark and leaf meshes, five new species.
- 2026-10-14: 7.4 done — plants bend with the wind; wind follows the weather.
- 2026-10-14: 7.5 done — skies built from cloud genera; overcast reads grey.
- 2026-10-14: 7.6 done — storms with rain shafts and lightning.
- 2026-10-14: 7.7 done — five oceans with their own seas; polar ice.
- 2026-10-14: 7.8 done — dolphins, orcas, humpbacks, swordfish.
- 2026-10-14: 7.9 done — geese, sea ducks, flamingos.
- 2026-10-14: 7.10 done — seabird nesting islands.
- 2026-10-14: 7.11 done — portrait mode for phones.
- 2026-10-14: **M6 done.** NaN skyline fix, blue-hour grade, planar reflections, cloud shadows,
  framing rules for plants, moonlit nights. All milestones complete; M5 goes live once pushed
  and Pages is enabled.
- 2026-10-14: M5 prepared: Pages workflow with daily SwiftShader snapshot, device-aware
  resolution, README. Waiting on push + enabling Pages in the repo settings.
- 2026-10-14: **M4 done.** Weather + volumetric clouds (with cloudy reflections), frame
  accumulation, stars, twilight grading, composition validator. 4K ~3–4 s.

## References

- @takram/three-atmosphere — https://unpkg.com/@takram/three-atmosphere@0.13.2/README.md
- @takram/three-clouds — https://cdn.jsdelivr.net/npm/@takram/three-clouds@0.7.4/README.md
- takram three-geospatial docs — https://docsearch.algolia.com/mcp/docs/repo/takram-design-engineering/three-geospatial
- three-gpu-pathtracer — https://github.com/gkjohnson/three-gpu-pathtracer
- jbouny/fft-ocean — https://awesome.ecosyste.ms/projects/github.com%2Fjbouny%2Ffft-ocean
- three.js OceanShaders — https://app.unpkg.com/three.fbo-helper@1.1.1/files/demo/node_modules/three/examples/js/shaders/OceanShaders.js
- webgl-fft-ocean — https://npmjs.com/package/webgl-fft-ocean
- Ocean Rendering with FFT for Real-Time Applications — https://dspace.zcu.cz/items/a04534b1-2a3b-4457-96ca-0bc326a2b72b/full
