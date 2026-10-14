# Graph Report - amazing_sea_wallpaper  (2026-10-14)

## Corpus Check
- 16 files · ~81,634 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 511 nodes · 1241 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.85)
- Token cost: 14,000 input · 6,000 output

## Community Hubs (Navigation)
- Biomes, Terrain & Birds
- Biome & Cloud Config Tables
- Camera, Composition & FFT
- Plan, Pages & Design Decisions
- Mesh Builder & Ships
- Trees & Vegetation
- Daily Deploy & Snapshots
- Clouds, Exposure & Reflection
- App Entry & Date Navigation
- Marine Life
- TypeScript Config
- Package Manifest
- Cloud Assets & Still Render
- Runtime Dependencies
- Accumulate Pass
- Still Scene Pass
- Dev Dependencies
- NPM Scripts
- Cloud Weather Texture
- Sea Sunset Favicon
- Turbulence Noise Texture

## God Nodes (most connected - your core abstractions)
1. `three` - 33 edges
2. `MeshBuilder` - 25 edges
3. `Random` - 24 edges
4. `PropContext` - 21 edges
5. `SceneParams` - 19 edges
6. `RGB` - 19 edges
7. `generateParams()` - 17 edges
8. `createShips()` - 16 edges
9. `hull()` - 15 edges
10. `catamaran()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Random day redirect script` --conceptually_related_to--> `Date-seeded deterministic SceneParams`  [INFERRED]
  random/index.html → PLAN.md
- `Random day redirect script` --shares_data_with--> `URL parameters (?date, ?w, ?h, ?portrait, ?frames)`  [INFERRED]
  random/index.html → README.md
- `Look` --references--> `RGB`  [EXTRACTED]
  src/props/marine.ts → src/biome.ts
- `HullSpec` --references--> `RGB`  [EXTRACTED]
  src/props/ships.ts → src/biome.ts
- `Foliage` --references--> `RGB`  [EXTRACTED]
  src/props/trees.ts → src/biome.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Daily headless snapshot pipeline** — _github_workflows_pages_daily_cron, _github_workflows_pages_render_today_s_wallpaper, scripts_snapshot, _github_workflows_pages_swiftshader, _github_workflows_pages_latest_jpg [EXTRACTED 1.00]
- **Sunset seascape composition** — public_favicon_sky_gradient, public_favicon_sun, public_favicon_wave_layers [EXTRACTED 1.00]
- **Still-image accumulation and performance pipeline** — plan_frame_accumulation, plan_still_scene_pass, plan_env_cube_shader_reuse, plan_spectrum_worker, plan_sky_denoise [EXTRACTED 1.00]
- **Date navigation flow (URL date, future clamp, random day)** — readme_url_parameters, plan_future_date_clamp, plan_random_route, index_info_footer, random_index_random_redirect [INFERRED 0.85]
- **Shore surf and spray system** — plan_surf_cycle, plan_wave_break_whitewater, plan_crest_rock_spray, plan_rainbow [EXTRACTED 1.00]

## Communities (21 total, 3 thin omitted)

### Community 0 - "Biomes, Terrain & Birds"
Cohesion: 0.07
Nodes (60): three, Biome, RGB, WATER, LandformParams, BILL, BLACK, createBirds() (+52 more)

### Community 1 - "Biome & Cloud Config Tables"
Cohesion: 0.06
Nodes (52): BIOMES, SAND_STYLES, SandStyle, WaterStyle, CLOUD_GENERA, CloudGenus, CloudGenusSpec, Etage (+44 more)

### Community 2 - "Camera, Composition & FFT"
Cohesion: 0.07
Nodes (46): createCamera(), SceneCamera, acceptable(), FrameCoverage, generateSceneParams(), measureFrame(), cache, ifft1d() (+38 more)

### Community 3 - "Plan, Pages & Design Decisions"
Cohesion: 0.06
Nodes (40): index.html page, Download button, Info footer (title, prev/today/next, Download), src/main.ts module entry, Random button link (./random/), Splash screen (animated SVG waves, boat, sun), #wallpaper canvas, Wallpaper page (index.html) (+32 more)

### Community 4 - "Mesh Builder & Ships"
Cohesion: 0.16
Nodes (28): MeshBuilder, hash3(), noise3(), ANTIFOULING, box(), cabin(), catamaran(), containerShip() (+20 more)

### Community 5 - "Trees & Vegetation"
Cohesion: 0.13
Nodes (39): VegetationKind, acacia(), Bark, birch(), birchBark(), broadleaf(), bush(), conifer() (+31 more)

### Community 6 - "Daily Deploy & Snapshots"
Cohesion: 0.06
Nodes (28): GitHub Pages Deploy Workflow, build job, Daily cron 00:05 UTC, deploy job, /latest.jpg snapshot, /latest-portrait.jpg snapshot, Render today's wallpaper step, SwiftShader software WebGL (+20 more)

### Community 7 - "Clouds, Exposure & Reflection"
Cohesion: 0.15
Nodes (15): createClouds(), renderCloudyEnvironment(), meterScene(), createMoon(), placeMoon(), setGlowBrightness(), setSprayLighting(), PlanarReflection (+7 more)

### Community 8 - "App Entry & Date Navigation"
Cohesion: 0.11
Nodes (19): canvas, frames, height, hideSplash(), linkFor(), localDateString(), params, portraitQuery (+11 more)

### Community 9 - "Marine Life"
Cohesion: 0.26
Nodes (15): Animal, blow(), BodyShape, createMarineLife(), dolphin(), humpback(), Look, LOOKS (+7 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+5 more)

### Community 11 - "Package Manifest"
Cohesion: 0.18
Nodes (10): name, private, type, version, astronomy-engine, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial (+2 more)

### Community 12 - "Cloud Assets & Still Render"
Cohesion: 0.33
Nodes (6): postprocessing, asset(), CloudAssets, loadCloudAssets(), repeat2D(), repeat3D()

### Community 13 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, astronomy-engine, postprocessing, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial, three

### Community 16 - "Dev Dependencies"
Cohesion: 0.40
Nodes (5): devDependencies, playwright, @types/three, typescript, vite

### Community 17 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, snapshot

### Community 18 - "Cloud Weather Texture"
Cohesion: 0.67
Nodes (3): Local Weather Texture, RGB-Packed Noise Channels, Tileable Cellular/Worley-style Noise

### Community 19 - "Sea Sunset Favicon"
Cohesion: 0.50
Nodes (4): Sea Sunset Favicon, Sky Gradient (dusk blue to peach), Setting Sun Circle, Layered Ocean Waves

## Knowledge Gaps
- **18 isolated node(s):** `Sky Gradient (dusk blue to peach)`, `Setting Sun Circle`, `Layered Ocean Waves`, `@types/three`, `typescript` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 155 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Biomes, Terrain & Birds` to `Biome & Cloud Config Tables`, `Camera, Composition & FFT`, `Mesh Builder & Ships`, `Trees & Vegetation`, `Clouds, Exposure & Reflection`, `Marine Life`, `Package Manifest`, `Cloud Assets & Still Render`?**
  _High betweenness centrality (0.322) - this node is a cross-community bridge._
- **What connects `Sky Gradient (dusk blue to peach)`, `Setting Sun Circle`, `Layered Ocean Waves` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biomes, Terrain & Birds` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `playwright` connect `Daily Deploy & Snapshots` to `Package Manifest`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Should `Biome & Cloud Config Tables` be split into smaller, more focused modules?**
  _Cohesion score 0.057859703020993344 - nodes in this community are weakly interconnected._
- **Why does `Amazing Sea Wallpaper README` connect `Plan, Pages & Design Decisions` to `Daily Deploy & Snapshots`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `Camera, Composition & FFT` be split into smaller, more focused modules?**
  _Cohesion score 0.07207792207792207 - nodes in this community are weakly interconnected._