# Graph Report - amazing_sea_wallpaper  (2026-10-15)

## Corpus Check
- 36 files · ~92,608 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 643 nodes · 1606 edges · 36 communities (31 shown, 5 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 179 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Biomes, Birds & Prop Types
- Camera, Composition & References
- Trees & Bark
- Mesh Builder & Ships
- Page, Splash & Dates
- FFT Ocean Spectrum
- Scene Params Generation
- Marine Life
- Storms & Rainbows
- Cloud Genera & Tests
- Landforms & Volcanoes
- Clouds, Exposure & Moon
- Fog & Lighthouse Beams
- Biome Tables
- Snapshot Script
- Contact Sheet & Tooling
- TypeScript Config
- Deploy Workflow & Plan
- Performance & Grain Fixes
- Milestone 7 Features
- Daily Latest Snapshot
- Package Manifest
- Cloud Assets
- Runtime Dependencies
- URL Options & Routes
- Accumulation & Denoise
- Params Test Fixtures
- Dev Dependencies
- NPM Scripts
- Accumulate Pass
- Still Scene Pass
- Cloud Weather Texture
- Sea Sunset Favicon
- Test TS Config
- Turbulence Noise Texture
- Tone Mapping & Bloom

## God Nodes (most connected - your core abstractions)
1. `MeshBuilder` - 41 edges
2. `three` - 39 edges
3. `generateParams()` - 30 edges
4. `Random` - 29 edges
5. `PropContext` - 26 edges
6. `SceneParams` - 20 edges
7. `RGB` - 18 edges
8. `createShips()` - 16 edges
9. `createMarineLife()` - 16 edges
10. `hull()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Procedural props (no downloaded models)` --rationale_for--> `MeshBuilder`  [INFERRED]
  PLAN.md → src/props/builder.ts
- `generateParams()` --implements--> `Seals, sea lions, fur seals by coast and ocean`  [INFERRED]
  src/params.ts → TODO.md
- `growTree()` --implements--> `Per-species leaf meshes and bark relief`  [INFERRED]
  src/props/trees.ts → TODO.md
- `Date as seed (deterministic daily scene)` --rationale_for--> `generateParams()`  [EXTRACTED]
  PLAN.md → src/params.ts
- `generateParams()` --implements--> `Lighthouse siting by coast (points, rocks, harbour mouths)`  [EXTRACTED]
  src/params.ts → TODO.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sunset seascape composition** — public_favicon_sky_gradient, public_favicon_sun, public_favicon_wave_layers [EXTRACTED 1.00]
- **Still-image accumulation and performance pipeline** — plan_frame_accumulation, plan_still_scene_pass, plan_env_cube_shader_reuse, plan_spectrum_worker, plan_sky_denoise [EXTRACTED 1.00]
- **Shore surf and spray system** — plan_surf_cycle, plan_wave_break_whitewater, plan_crest_rock_spray, plan_rainbow [EXTRACTED 1.00]
- **Date navigation flow (URL date, future clamp, random day)** — readme_url_parameters, plan_future_date_clamp, plan_random_route, index_info_footer, random_index_random_redirect [INFERRED 0.85]
- **Daily snapshot pipeline (CI render -> latest.jpg)** — _github_workflows_pages_render_todays_wallpaper, scripts_snapshot, plan_playwright, _github_workflows_pages_swiftshader_software_webgl, readme_latest_jpg [EXTRACTED 1.00]
- **FFT ocean pipeline (spectrum -> FFT -> shading -> seaLevel)** — src_spectrumworker, src_spectrum, src_fft, src_ocean, src_propcontext_sealevel [EXTRACTED 1.00]
- **Lighthouse beams scattered by haze and fog** — src_params_generateparams, src_props_lighthouse, src_lighthouse, src_fog, todo_fresnel_lens_beams [INFERRED 0.85]

## Communities (36 total, 5 thin omitted)

### Community 0 - "Biomes, Birds & Prop Types"
Cohesion: 0.06
Nodes (63): RGB, ColonyKind, PinnipedKind, BILL, BLACK, createBirds(), GREY, gull() (+55 more)

### Community 1 - "Camera, Composition & References"
Cohesion: 0.09
Nodes (41): Breaking waves / shore foam references, Rain on the sea (Melsheimer et al.; Nystuen 1990), three, createCamera(), SceneCamera, acceptable(), FrameCoverage, generateSceneParams() (+33 more)

### Community 2 - "Trees & Bark"
Cohesion: 0.11
Nodes (40): acacia(), Bark, barkDepth(), birch(), birchBark(), blade(), broadleaf(), bush() (+32 more)

### Community 3 - "Mesh Builder & Ships"
Cohesion: 0.16
Nodes (31): MeshBuilder, penguin(), box(), cottage(), createLighthouse(), tower(), pinniped(), swimmingHead() (+23 more)

### Community 4 - "Page, Splash & Dates"
Cohesion: 0.07
Nodes (35): index.html page, Download button, Info footer (title, prev/today/next, Download), Loading splash (sun, waves, boat), Splash boat SVG, #wallpaper canvas, setAssetBase(), localDateString() (+27 more)

### Community 5 - "FFT Ocean Spectrum"
Cohesion: 0.11
Nodes (21): jbouny/fft-ocean, JONSWAP + swell spectrum on 3 FFT cascades, Ocean Rendering with FFT for Real-Time Applications, cache, ifft1d(), ifft2d(), tables(), PropContext.seaLevel() (+13 more)

### Community 6 - "Scene Params Generation"
Cohesion: 0.12
Nodes (26): addFormations(), Composition, cross(), elevationOf(), fogSeason(), generateCoast(), generateParams(), generateStorm() (+18 more)

### Community 7 - "Marine Life"
Cohesion: 0.22
Nodes (18): Animal, blow(), BodyShape, createMarineLife(), crown(), dolphin(), exitSplash(), foam() (+10 more)

### Community 8 - "Storms & Rainbows"
Cohesion: 0.16
Nodes (15): Window, dirFromAzEl(), RainbowParams, SceneParams, StormParams, bolt(), boltTops(), createStorm() (+7 more)

### Community 9 - "Cloud Genera & Tests"
Cohesion: 0.15
Nodes (13): vitest, CLOUD_GENERA, CloudGenus, CloudGenusSpec, Etage, pickFormations(), Weights, cyrb128() (+5 more)

### Community 10 - "Landforms & Volcanoes"
Cohesion: 0.20
Nodes (15): LandformParams, coneHeight(), createLandforms(), curvatureDrop(), Frame, markDistant(), range(), ridged() (+7 more)

### Community 11 - "Clouds, Exposure & Moon"
Cohesion: 0.18
Nodes (12): createClouds(), renderCloudyEnvironment(), meterScene(), createMoon(), placeMoon(), createProps(), PlanarReflection, renderPlanarReflection() (+4 more)

### Community 12 - "Fog & Lighthouse Beams"
Cohesion: 0.18
Nodes (9): FogEffect, beamDirections(), LighthouseBeamEffect, FogParams, LighthouseParams, LanternInfo, Advection fog (warm moist air over cold water), Rotating Fresnel lens beams with chart light character (+1 more)

### Community 13 - "Biome Tables"
Cohesion: 0.14
Nodes (15): Biome, BIOMES, SAND_STYLES, SandStyle, VegetationKind, WATER, WaterStyle, IceParams (+7 more)

### Community 14 - "Snapshot Script"
Cohesion: 0.13
Nodes (12): Playwright headless snapshots, angle, args, baseUrl, channel, dates, frames, height (+4 more)

### Community 15 - "Contact Sheet & Tooling"
Cohesion: 0.13
Nodes (9): playwright, vite, args, cols, dir, files, htmlFile, out (+1 more)

### Community 16 - "TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+5 more)

### Community 17 - "Deploy Workflow & Plan"
Cohesion: 0.17
Nodes (11): GitHub Pages Deploy Workflow, build job, Daily cron 00:05 UTC, deploy job, Deploy to GitHub Pages workflow, Amazing Sea Wallpaper Plan, Bruneton atmospheric scattering, Fast High-Quality Cloudscape through Noise and Reprojection (+3 more)

### Community 18 - "Performance & Grain Fixes"
Cohesion: 0.19
Nodes (7): Auto exposure (sky luminance cube), Performance pass (2026-10-14), skyDenoise.ts edge-aware light-shaft denoise, @takram/three-atmosphere (Bruneton scattering), @takram/three-clouds volumetric clouds, Image pipeline: auto exposure, AgX tone mapping, bloom, takram three-geospatial (MIT)

### Community 19 - "Milestone 7 Features"
Cohesion: 0.26
Nodes (12): Cloud genera layers (cloudTypes.ts, 7.5), Crest and rock spray sprites (7.13), FFT ocean (Tessendorf JONSWAP + swell, 3 cascades, LEAN roughness), Five oceans per-ocean seas and polar ice (7.7), Mountains and volcanoes on horizon (7.14), Milestone 7 wishlist (TODO.md), NaN skyline speck fix (M6), Planar reflection pass (+4 more)

### Community 20 - "Daily Latest Snapshot"
Cohesion: 0.20
Nodes (7): /latest.jpg snapshot, /latest-portrait.jpg snapshot, Render today's wallpaper step, SwiftShader software WebGL, GitHub Pages workflow (pages.yml), Daily SwiftShader CI snapshot (latest.jpg), /latest.jpg and /latest-portrait.jpg

### Community 21 - "Package Manifest"
Cohesion: 0.18
Nodes (10): name, private, type, version, astronomy-engine, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial (+2 more)

### Community 22 - "Cloud Assets"
Cohesion: 0.36
Nodes (7): assetUrl(), base, CloudAssets, loadCloudAssets(), loadImageTexture(), repeat2D(), repeat3D()

### Community 23 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, astronomy-engine, postprocessing, @takram/three-atmosphere, @takram/three-clouds, @takram/three-geospatial, three

### Community 24 - "URL Options & Routes"
Cohesion: 0.33
Nodes (7): Composition validator (measureFrame ray grid, re-roll), Future dates render today (7.17), Portrait mode for phones (7.11), /random route (7.18), scripts/snapshot.mjs headless renderer, Random day redirect script, URL parameters (?date, ?w, ?h, ?portrait, ?frames)

### Community 26 - "Params Test Fixtures"
Cohesion: 0.38
Nodes (5): TimeOfDay, allParams(), DAYS, share(), SUN_ELEVATION

### Community 27 - "Dev Dependencies"
Cohesion: 0.33
Nodes (6): devDependencies, playwright, @types/three, typescript, vite, vitest

### Community 28 - "NPM Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, snapshot, test

### Community 31 - "Cloud Weather Texture"
Cohesion: 0.67
Nodes (3): Local Weather Texture, RGB-Packed Noise Channels, Tileable Cellular/Worley-style Noise

### Community 32 - "Sea Sunset Favicon"
Cohesion: 0.50
Nodes (4): Sea Sunset Favicon, Sky Gradient (dusk blue to peach), Setting Sun Circle, Layered Ocean Waves

### Community 33 - "Test TS Config"
Cohesion: 0.50
Nodes (3): ../tsconfig.json, extends, include

## Ambiguous Edges - Review These
- `Known issue: sailboat as bare tilted mast (2026-05-01)` → `Known issue: pink outlines on distant ridges at blue hour`  [AMBIGUOUS]
  PLAN.md · relation: conceptually_related_to

## Knowledge Gaps
- **35 isolated node(s):** `Sky Gradient (dusk blue to peach)`, `Setting Sun Circle`, `Layered Ocean Waves`, `Tileable Cellular/Worley-style Noise`, `Per-Channel RGB Noise Packing` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 206 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Camera, Composition & References` to `Biomes, Birds & Prop Types`, `Trees & Bark`, `Mesh Builder & Ships`, `FFT Ocean Spectrum`, `Marine Life`, `Storms & Rainbows`, `Landforms & Volcanoes`, `Clouds, Exposure & Moon`, `Fog & Lighthouse Beams`, `Package Manifest`, `Cloud Assets`, `Accumulation & Denoise`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `generateParams()` (e.g. with `random.ts` and `Seals, sea lions, fur seals by coast and ocean`) actually correct?**
  _`generateParams()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Sky Gradient (dusk blue to peach)`, `Setting Sun Circle`, `Layered Ocean Waves` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biomes, Birds & Prop Types` be split into smaller, more focused modules?**
  _Cohesion score 0.05647517039922103 - nodes in this community are weakly interconnected._
- **Why does `MeshBuilder` connect `Mesh Builder & Ships` to `Biomes, Birds & Prop Types`, `Trees & Bark`, `Marine Life`, `Storms & Rainbows`, `Landforms & Volcanoes`, `Daily Latest Snapshot`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `Camera, Composition & References` be split into smaller, more focused modules?**
  _Cohesion score 0.09142857142857143 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Known issue: sailboat as bare tilted mast (2026-05-01)` and `Known issue: pink outlines on distant ridges at blue hour`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._