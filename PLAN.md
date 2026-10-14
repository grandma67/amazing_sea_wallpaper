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
  flocks, ships, marine life, ice, colonies, landforms, storm bolts, surf/rock spray; built
  with `builder.ts` (`MeshBuilder`).
- **Frame:** `camera.ts`, `composition.ts` (ray-grid coverage, re-roll bad framings),
  `reflection.ts` (planar reflection), `accumulate.ts` + `stillScene.ts` (render the scene
  once, redraw only clouds/spray per frame), `skyDenoise.ts` (smooths light-shaft grain once).
- **Page:** `main.ts` — portrait/landscape, device-aware size, prev/next/today/random,
  download; `random/index.html` redirects to a random past day.
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
