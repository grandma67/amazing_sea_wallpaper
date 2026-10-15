# Graph Report - amazing_sea_wallpaper  (2026-10-15)

## Corpus Check
- 91 files · ~125,221 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .bin 4, (none) 1, .css 1)

## Summary
- 794 nodes · 2593 edges · 38 communities (33 shown, 5 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 504 edges (avg confidence: 0.85)
- Token cost: 73,890 input · 0 output

## Community Hubs (Navigation)
- Procedural Mesh Builders
- Prop Colours and Creators
- Camera and Composition
- Cloud Genera and FFT
- CI and Snapshot Scripts
- Web App and Dates
- Scene Param Types
- Islands and Landforms
- Marine Animals
- Sky, Moon and Exposure
- Params Draws and Seasons
- Param Generation Pipeline
- Biomes, Sand and Water
- Runtime Dependencies
- Fog, Lighthouse, Accumulation
- Ocean Grid and Shadows
- TypeScript Config
- Cloud Assets
- Eclipse Astronomy
- Still Scene Pass
- Realism and Render Budget
- Lighting and Exposure Lessons
- Architecture Decisions
- Prop Placement Report
- Feature Check Workflow
- Date Seeds and Scene Specs
- Project Docs and TODO
- Shore Props Pattern
- Dev Dependencies
- npm Scripts
- Wave and Surf Physics
- Frame Accumulation Pass
- Weather Noise Texture
- Favicon
- Test TSConfig
- Turbulence Texture
- Loading Splash
- Fog and Lighthouse Docs

## God Nodes (most connected - your core abstractions)
1. `MeshBuilder` - 68 edges
2. `three` - 44 edges
3. `Random` - 43 edges
4. `fbm3()` - 35 edges
5. `renderScene()` - 34 edges
6. `buildParams()` - 33 edges
7. `SceneParams` - 31 edges
8. `PropContext` - 31 edges
9. `RGB` - 28 edges
10. `createMarineLife()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `DAYS` --calls--> `shiftDate()`  [EXTRACTED]
  test/days.ts → src/dates.ts
- `Random day redirect script` --shares_data_with--> `URL Parameters (?date, ?scene, ?frames, /random)`  [INFERRED]
  random/index.html → README.md
- `Window` --references--> `SceneParams`  [EXTRACTED]
  src/main.ts → src/params.ts
- `allParams()` --calls--> `generateParams()`  [EXTRACTED]
  test/days.ts → src/params.ts
- `scene()` --calls--> `generateParams()`  [EXTRACTED]
  test/days.ts → src/params.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Daily snapshot pipeline (CI render -> latest.jpg)** — _github_workflows_pages_render_todays_wallpaper, scripts_snapshot, _github_workflows_pages_swiftshader_software_webgl [EXTRACTED 1.00]
- **Sunset seascape composition** — public_favicon_sky_gradient, public_favicon_sun, public_favicon_wave_layers [EXTRACTED 1.00]
- **Feature Check Workflow (spec → render → props report → contact sheet)** — claude_scene_spec, claude_snapshot_script, claude_props_report, claude_backlit_warning, claude_contact_sheet, claude_three_render_rounds [EXTRACTED 1.00]
- **Sunset Glow Fix Measures** — plan_sunset_glow_fix, plan_clouds_full_res_beaches, plan_still_scene_skyfill, plan_frame_accumulation [EXTRACTED 1.00]
- **Physically Grounded Wave Model** — plan_surf_physics, plan_mccowan_breaker_index, plan_weggel_slope_term, plan_rocks_in_sea, plan_fft_ocean, todo_task_rule_vs_research [INFERRED 0.85]

## Communities (38 total, 5 thin omitted)

### Community 0 - "Procedural Mesh Builders"
Cohesion: 0.08
Nodes (98): gull(), MeshBuilder, penguin(), ballGeometry(), branchGeometry(), clumpGeometry(), logGeometry(), lyingPath() (+90 more)

### Community 1 - "Prop Colours and Creators"
Cohesion: 0.06
Nodes (68): RGB, PinnipedKind, BILL, BLACK, createBirds(), GREY, WHITE, ColonyStyle (+60 more)

### Community 2 - "Camera and Composition"
Cohesion: 0.06
Nodes (64): vitest, createCamera(), SceneCamera, acceptable(), FrameCoverage, generateSceneParams(), measureFrame(), CoastParams (+56 more)

### Community 3 - "Cloud Genera and FFT"
Cohesion: 0.06
Nodes (44): CLOUD_GENERA, CloudGenusSpec, Etage, pickFormations(), Weights, cache, ifft1d(), ifft2d() (+36 more)

### Community 4 - "CI and Snapshot Scripts"
Cohesion: 0.05
Nodes (32): build job (npm ci, test, build), deploy job (deploy-pages), Deploy to GitHub Pages workflow, Render today's wallpaper step, playwright, vite, snapshotWarnings(), args (+24 more)

### Community 5 - "Web App and Dates"
Cohesion: 0.08
Nodes (28): Info footer nav (prev/today/next/random/download), #wallpaper canvas, localDateString(), resolveDate(), shiftDate(), canvas, date, frames (+20 more)

### Community 6 - "Scene Param Types"
Cohesion: 0.10
Nodes (32): VegetationKind, EclipseType, ColonyKind, ColonySite, Composition, HaulOut, TimeOfDay, WeatherKind (+24 more)

### Community 7 - "Islands and Landforms"
Cohesion: 0.16
Nodes (26): IslandKind, LandformParams, createIslands(), islandGeometry(), islandHeight(), mix(), outline(), place() (+18 more)

### Community 8 - "Marine Animals"
Cohesion: 0.21
Nodes (18): Animal, blow(), BodyShape, createMarineLife(), crown(), dolphin(), exitSplash(), foam() (+10 more)

### Community 9 - "Sky, Moon and Exposure"
Cohesion: 0.17
Nodes (16): @takram/three-atmosphere, three, eclipseSky(), meterScene(), createMoon(), placeMoon(), setOceanRocks(), setGlowBrightness() (+8 more)

### Community 10 - "Params Draws and Seasons"
Cohesion: 0.10
Nodes (21): CloudGenus, BEACH_HAUL_OUT, ColonyParams, cross(), Draws, elevationOf(), fogSeason(), IslandParams (+13 more)

### Community 11 - "Param Generation Pipeline"
Cohesion: 0.33
Nodes (17): pickOcean(), addFormations(), buildParams(), forceIce(), generateCoast(), generateStorm(), generateWeather(), or() (+9 more)

### Community 12 - "Biomes, Sand and Water"
Cohesion: 0.15
Nodes (16): Biome, BIOMES, SAND_STYLES, SandStyle, WATER, WaterStyle, EclipseParams, IceParams (+8 more)

### Community 13 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, astronomy-engine, postprocessing, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial, three, name (+8 more)

### Community 14 - "Fog, Lighthouse, Accumulation"
Cohesion: 0.21
Nodes (7): postprocessing, FogEffect, beamDirections(), LighthouseBeamEffect, FogParams, LighthouseParams, LanternInfo

### Community 15 - "Ocean Grid and Shadows"
Cohesion: 0.24
Nodes (11): createPolarGrid(), cascadeTexture(), createOcean(), MAX_ROCKS, bindCloudShadow(), bindShadow(), CLOUD_SHADOW_STRENGTH, SHADOW_GLSL (+3 more)

### Community 16 - "TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+5 more)

### Community 17 - "Cloud Assets"
Cohesion: 0.26
Nodes (10): assetUrl(), base, setAssetBase(), CloudAssets, createClouds(), loadCloudAssets(), loadImageTexture(), renderCloudyEnvironment() (+2 more)

### Community 18 - "Eclipse Astronomy"
Cohesion: 0.40
Nodes (9): eclipseOfType(), eclipseOn(), lunarEclipse(), moonlight(), offsetFor(), overlap(), solarEclipse(), UMBRA_RATIO (+1 more)

### Community 20 - "Realism and Render Budget"
Cohesion: 0.22
Nodes (6): Backlit View Warning (checks.mjs), contact-sheet.mjs (before/after compare), Dev Server on Port 5174, snapshot.mjs Render Script, Rocks in the Sea (waterRocks, waveOnRock, nearest 48), Leaf Meshes per Species and Bark Relief

### Community 21 - "Lighting and Exposure Lessons"
Cohesion: 0.25
Nodes (6): Allen Lunar Phase Magnitude Law, astronomy-engine (moon phase, eclipses), Moon and Eclipses (celestial.ts, eclipse.ts), takram three-geospatial (atmosphere, clouds), Auto Exposure, AgX Tone Mapping, Bloom, Bruneton Atmospheric Scattering Sky

### Community 22 - "Architecture Decisions"
Cohesion: 0.25
Nodes (4): Frame Accumulation (64-frame Averaging), GitHub Pages CI with Daily latest.jpg, Still Scene + SkyFillEffect Silhouette Coverage, README: Amazing Sea Wallpaper

### Community 23 - "Prop Placement Report"
Cohesion: 0.32
Nodes (7): boxes, corner, geometryBox(), pieces(), PropReport, reportProps(), world

### Community 24 - "Feature Check Workflow"
Cohesion: 0.29
Nodes (5): Horizon ~4.5 km from 1.6 m Eye Height, --props Placement Report and --crop, Islands at Sea (pickIslands, props/islands.ts), Mainland Colonies (seabird cliffs, penguin rookeries), Seals, Sea Lions, Fur and Elephant Seals by Coast

### Community 25 - "Date Seeds and Scene Specs"
Cohesion: 0.47
Nodes (5): allParams() Date Listing via Throwaway Vitest, Scene Spec JSON (sceneSpec.ts), Date as Seed (date → SceneParams), Random day redirect script, URL Parameters (?date, ?scene, ?frames, /random)

### Community 26 - "Project Docs and TODO"
Cohesion: 0.33
Nodes (6): CLAUDE.md Developer Guide, PLAN.md Architecture Plan, Versions Table (0.1–0.17), Arctic Boats without Sails (open), Monkeys, Turtles, Lizards by Biome (open), TODO List (items 1–21)

### Community 27 - "Shore Props Pattern"
Cohesion: 0.40
Nodes (5): Shore Coordinates (shoreToWorld, beachLines), Shore Debris (debris.ts, debrisFor), Shore Life (shoreLife.ts, shoreLifeFor), Vitest Logic Tests (not rendering), Mangrove Trees (open)

### Community 28 - "Dev Dependencies"
Cohesion: 0.33
Nodes (6): devDependencies, playwright, @types/three, typescript, vite, vitest

### Community 29 - "npm Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, snapshot, test

### Community 30 - "Wave and Surf Physics"
Cohesion: 0.33
Nodes (6): FFT Ocean (JONSWAP + Swell, 3 Cascades), McCowan Breaker Index H/d = 0.78, PropContext.seaLevel() CPU Wave Sampling, Surf Physics (Shoaling, McCowan/Weggel Breaking), Weggel (1972) Slope Term, Splash Screen Boat Riding Parabolic Waves

### Community 32 - "Weather Noise Texture"
Cohesion: 0.67
Nodes (3): Local Weather Texture, RGB-Packed Noise Channels, Tileable Cellular/Worley-style Noise

### Community 33 - "Favicon"
Cohesion: 0.50
Nodes (4): Sea Sunset Favicon, Sky Gradient (dusk blue to peach), Setting Sun Circle, Layered Ocean Waves

### Community 34 - "Test TSConfig"
Cohesion: 0.50
Nodes (3): ../tsconfig.json, extends, include

## Knowledge Gaps
- **34 isolated node(s):** `@types/three`, `typescript`, `../tsconfig.json`, `Deploy to GitHub Pages workflow`, `deploy job (deploy-pages)` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 245 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Sky, Moon and Exposure` to `Procedural Mesh Builders`, `Prop Colours and Creators`, `Camera and Composition`, `Cloud Genera and FFT`, `Islands and Landforms`, `Marine Animals`, `Runtime Dependencies`, `Fog, Lighthouse, Accumulation`, `Ocean Grid and Shadows`, `Cloud Assets`, `Still Scene Pass`, `Prop Placement Report`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **What connects `@types/three`, `typescript`, `../tsconfig.json` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Procedural Mesh Builders` be split into smaller, more focused modules?**
  _Cohesion score 0.07661169415292354 - nodes in this community are weakly interconnected._
- **Why does `playwright` connect `CI and Snapshot Scripts` to `Runtime Dependencies`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `Prop Colours and Creators` be split into smaller, more focused modules?**
  _Cohesion score 0.06200411401704378 - nodes in this community are weakly interconnected._
- **Why does `Random` connect `Cloud Genera and FFT` to `Procedural Mesh Builders`, `Prop Colours and Creators`, `Camera and Composition`, `Islands and Landforms`, `Marine Animals`, `Params Draws and Seasons`, `Param Generation Pipeline`, `Biomes, Sand and Water`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `Camera and Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.0595679012345679 - nodes in this community are weakly interconnected._