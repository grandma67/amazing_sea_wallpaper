# Graph Report - amazing_sea_wallpaper  (2026-10-14)

## Corpus Check
- 39 files · ~56,608 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .bin 4, (none) 1, .css 1)

## Summary
- 358 nodes · 826 edges · 19 communities (12 shown, 7 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.85)
- Token cost: 104,676 input · 0 output

## Community Hubs (Navigation)
- Render Pipeline & Passes
- Procedural Mesh & Ships
- Plan, Docs & Deploy
- Biomes & Scene Params
- NPM Dependencies
- Snapshot Scripts
- Prop Context & Birds
- App Entry & Routing
- FFT Ocean Spectrum
- TypeScript Config
- Cloud Weather Texture
- Favicon Artwork
- Turbulence Texture
- Splash Screen
- Biomes & Props Concepts
- Wallpaper Canvas
- Auto Exposure
- Planar Reflection

## God Nodes (most connected - your core abstractions)
1. `MeshBuilder` - 25 edges
2. `three` - 21 edges
3. `Random` - 19 edges
4. `renderScene()` - 19 edges
5. `generateParams()` - 17 edges
6. `createShips()` - 17 edges
7. `createRocks()` - 15 edges
8. `hull()` - 15 edges
9. `createVegetation()` - 15 edges
10. `catamaran()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Render today's wallpaper step (SwiftShader snapshot)` --implements--> `Optional CI snapshot via SwiftShader`  [INFERRED]
  .github/workflows/pages.yml → PLAN.md
- `Deploy to GitHub Pages workflow` --conceptually_related_to--> `Decision: web-only rendering (three.js)`  [INFERRED]
  .github/workflows/pages.yml → PLAN.md
- `Amazing Sea Wallpaper README` --references--> `/latest.jpg daily snapshot`  [EXTRACTED]
  README.md → .github/workflows/pages.yml
- `Amazing Sea Wallpaper README` --references--> `Deploy to GitHub Pages workflow`  [EXTRACTED]
  README.md → .github/workflows/pages.yml
- `Render today's wallpaper step (SwiftShader snapshot)` --calls--> `scripts/snapshot.mjs headless renderer`  [EXTRACTED]
  .github/workflows/pages.yml → PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sky & image pipeline (takram atmosphere + clouds + pmndrs post + accumulation)** — plan_takram_three_atmosphere, plan_takram_three_clouds, plan_pmndrs_postprocessing, plan_frame_accumulation, plan_agx_tone_mapping [EXTRACTED 1.00]
- **Daily latest.jpg snapshot flow** — _github_workflows_pages_daily_cron, _github_workflows_pages_render_todays_wallpaper, plan_snapshot_script, _github_workflows_pages_latest_jpg [EXTRACTED 1.00]
- **Deterministic date-seeded scene generation** — plan_date_seed, plan_cyrb128_sfc32_prng, plan_sceneparams, plan_composition_validator, plan_biomes [INFERRED 0.85]
- **Sunset seascape composition** — public_favicon_sky_gradient, public_favicon_sun, public_favicon_wave_layers [EXTRACTED 1.00]

## Communities (19 total, 7 thin omitted)

### Community 0 - "Render Pipeline & Passes"
Cohesion: 0.08
Nodes (46): postprocessing, three, AccumulatePass, createCamera(), SceneCamera, asset(), CloudAssets, createClouds() (+38 more)

### Community 1 - "Procedural Mesh & Ships"
Cohesion: 0.13
Nodes (44): gull(), MeshBuilder, fbm3(), hash3(), noise3(), ANTIFOULING, box(), cabin() (+36 more)

### Community 2 - "Plan, Docs & Deploy"
Cohesion: 0.05
Nodes (45): build job, Daily cron 00:05 UTC, deploy job, Deploy to GitHub Pages workflow, /latest.jpg daily snapshot, Render today's wallpaper step (SwiftShader snapshot), #info footer (title, prev/today/next, Download), AgX tone mapping (+37 more)

### Community 3 - "Biomes & Scene Params"
Cohesion: 0.12
Nodes (26): Biome, BIOMES, SAND_STYLES, SandStyle, VegetationKind, WATER, WaterStyle, CoastParams (+18 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, astronomy-engine, postprocessing, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial, three, devDependencies (+20 more)

### Community 5 - "Snapshot Scripts"
Cohesion: 0.08
Nodes (19): playwright, args, cols, dir, files, htmlFile, out, width (+11 more)

### Community 6 - "Prop Context & Birds"
Cohesion: 0.14
Nodes (18): RGB, BILL, BLACK, createBirds(), GREY, WHITE, PropContext, createProps() (+10 more)

### Community 7 - "App Entry & Routing"
Cohesion: 0.12
Nodes (18): canvas, frames, height, hideSplash(), linkFor(), localDateString(), params, query (+10 more)

### Community 8 - "FFT Ocean Spectrum"
Cohesion: 0.21
Nodes (14): cache, ifft1d(), ifft2d(), tables(), angleDiff(), Cascade, CASCADE_SIZE, jonswap() (+6 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+5 more)

### Community 10 - "Cloud Weather Texture"
Cohesion: 0.67
Nodes (3): Local Weather Texture, RGB-Packed Noise Channels, Tileable Cellular/Worley-style Noise

### Community 11 - "Favicon Artwork"
Cohesion: 0.50
Nodes (4): Sea Sunset Favicon, Sky Gradient (dusk blue to peach), Setting Sun Circle, Layered Ocean Waves

## Knowledge Gaps
- **30 isolated node(s):** `@types/three`, `typescript`, `Daily cron 00:05 UTC`, `Blender/Cycles headless (rejected)`, `AI image generation (rejected)` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 138 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Render Pipeline & Passes` to `FFT Ocean Spectrum`, `Procedural Mesh & Ships`, `NPM Dependencies`, `Prop Context & Birds`?**
  _High betweenness centrality (0.308) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `generateParams()` (e.g. with `.chance()` and `.normal()`) actually correct?**
  _`generateParams()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/three`, `typescript`, `Daily cron 00:05 UTC` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Render Pipeline & Passes` be split into smaller, more focused modules?**
  _Cohesion score 0.0764423076923077 - nodes in this community are weakly interconnected._
- **Why does `playwright` connect `Snapshot Scripts` to `NPM Dependencies`?**
  _High betweenness centrality (0.295) - this node is a cross-community bridge._
- **Should `Procedural Mesh & Ships` be split into smaller, more focused modules?**
  _Cohesion score 0.1326709526592636 - nodes in this community are weakly interconnected._
- **Why does `Amazing Sea Wallpaper README` connect `Plan, Docs & Deploy` to `Snapshot Scripts`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._