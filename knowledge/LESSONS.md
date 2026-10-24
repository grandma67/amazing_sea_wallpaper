# Lessons and gotchas

Things that bit us, by topic. Read the sections for what you're touching. Workflow is in CLAUDE.md,
tool gotchas in TOOLS.md.

## Debugging approach

- "Not showing" is usually placement, light or size: check `--props`, backlight and pixel size
  before debugging shaders. Small things at real scale vanish (10 cm crab: ~70 px at 5 m at 4K,
  a speck at 20 m).
- Placed but invisible: print the physics with a temporary `console.warn('DBG …')` at 640×360,
  1 frame, before tuning looks (ship spray: water rose only ±0.1 m on the hull, so no splash
  could trigger).
- Shader debugging: force a visible output (`coverage = 1.0` over a region), move it step by step.
- Find a cause by switching passes off one at a time (the sunset tree glow had four causes).
- Suspect float precision when a pattern depends on one direction only; isolate by changing one
  offset at a time (`params` patches of `weather.shapeOffset`, `weatherOffset`, `latitudeDeg`;
  `"clouds": [one genus]`).
- After fixing a shared layer (cloud type, exposure, fog), re-check conclusions made while it was
  broken: scud made every storm flat grey, and "calvus = capillatus from below" was wrongly
  blamed on physics.
- Physically faint is fine, but say so rather than boost (noctilucents need the sun 6–16° down;
  our blue hour stops at −7°; blue-hour contrails are dark lines in the earth's shadow).
- Speed work: compare with a pixel diff, not by eye; two runs of the same code on the same GPU
  are pixel-identical. Benchmark under `caffeinate -i`; GPU noise floor ≤ 5/255 on a few pixels.
- three sorts opaque meshes by **material id** (creation order) before depth: creating meshes in a
  different order changes equal-depth pixels.
- Tests that need a rare event on **real days** ("at least one waterspout in three years",
  "tropical streets more often than elsewhere" on a few dozen days) break when the main stream
  changes (places, 1a, broke four). Check the rules on real days, but get the event from a spec
  over every date (`scenes({ place: 'caribbean', … }, DAYS.length)`), and compare rates on
  forced, equal conditions.
- Pack ice calms `params.ocean.windSpeed` (×0.4, for the waves) but not the wind the sky reads
  (lenticulars, fog): compare sky features with the wind before the ice factor.

## Light and exposure

- Auto exposure re-normalises: scaling the whole scene does nothing; change `exposure` (e.g.
  `nightScale`) or relative brightness.
- Post-exposure units: sky ≈ 0.1–1; > 40 clamps white (GradeEffect). Effects added after exposure
  in fixed units look equally strong by day and dusk: physical sources need fixed scene radiance
  × exposure. Fixed-power lights (lanterns, beams) scale per time of day against the metered sky,
  or they vanish at dusk and blind at night.
- Pale things (foam, spray, mist) vanish against a low sun ahead: foam is no brighter than the
  glare. Check front-lit (`sunAzimuthDeg` ≈ 160, daylight) first, then backlit.
- A low sun lights vertical flanks far more than flat sand: dark animals look pale beside the
  beach in side light. That's physics; check albedo numbers before darkening.
- A mirror-sharp sun is ~1000× sky radiance: any sun under overcast shows a glitter path, so the
  glint must be shaded by the clouds actually drawn (their shadow map), not stand-in noise.
- Props are lit by `scene.environment` too: in odd light (totality) dim `environmentIntensity`.
- Env cube is 256²: bright specks become texel blocks in wet-sand reflections. Don't boost things
  in `envScene`. Screen-space effects (lightning flash) aren't in it: the ocean shader must add
  them along `R` itself (radiance = graded value / exposure).
- A plain vertex-coloured sand mesh lights brighter than the terrain's sand shader: tint
  sand-coloured overlays (tracks) ~0.8×.
- Glow round trees against a low sun had four causes: cloud TAA smearing light shafts past
  silhouettes (history now off; our accumulation averages), half-res clouds upsampled across
  silhouettes (rims, pink ridge outlines at blue hour), MSAA edge pixels keeping some bare sky
  (`SkyFillEffect`), GGX glints on edge-on leaves (no direct specular on plants). A pass reading
  the depth buffer composites per pixel; anything blended into a pixel (MSAA, bilinear) needs
  coverage handled explicitly.
- Screen-space derivatives explode on silhouettes: clamp footprints, or NaN normals become white
  bloom dashes (Metal fast-math also defeats `isnan`). Overflowing `exp()` gave NaN terrain.

## takram sky, clouds, post

- Sky shader patches (`eclipse.ts`, `contrails.ts`, `noctilucent.ts`): functions before
  `vec3 getSkyRadiance(`, calls after `vec3 radiance = GetSkyRadiance(…);`; main sky only, never
  `envScene`'s; make the patch throw if it stops matching. Units km (`ATMOSPHERE.bottom_radius`),
  positions ECEF from earth's centre. Drawn under volumetric clouds and behind geometry for free.
  The clouds' weather-map lookup is patched the same way (`cloudArrangement.ts`).
- The sky draws sun and moon independently (no occlusion) and keeps the moon's total light fixed:
  scale `lunarRadianceScale` by `moonScale²` or a bigger disc is dimmer.
- A night moon disc is ~10⁴ (thousands × white): earthshine and the eclipse umbra must be tiny
  fractions (2e-5, 8e-4) or the dark side saturates.
- Floating things (contrail, high cloud): `GetSunAndSkyIrradiance` is for surfaces (cosine, zero
  below the plane); use `GetSunAndSkyScalarIrradiance` + a phase function.
- `coverageFilterWidth` near 1 turns a layer into a sheet over the sky (density =
  remap(mix(weather, 1, width), …)); ragged scraps need a narrow width + high `weatherExponent`.
  An étage's 2nd layer reads weather-map alpha (`layerChannels`). Under a closed deck you never
  see cloud tops.
- The cloud shadow map is temporal (~8 updates to converge): unprimed, the first of 16 frames saw
  clouds unshadowed and low-sun bases came out too pink (`primeCloudShadow`).
- Temporal upscaling + along-ray-only jitter left spots and grain in averaged stills: Halton
  sub-pixel jitter + one final sky denoise fixed it.
- Streaky clouds toward the vanishing point = float32 cancellation in the cube-sphere uv
  (`sqrt(a - sqrt(a² - 6mx²))` = 0 within ~1 km of our anchor's meridian), not wind or texture
  (`stabiliseCubeSphereUv`).
- Clouds on a round earth: a 700 m base sinks below a 2 m eye's horizon at ~95 km, tops show to
  ~140 km. With Bruneton air alone (~220 km visibility) 40–130 km of undersides stacked into a
  dark band on the sea; real sea air (20–60 km) fades them (`seaHaze.ts`). takram's own haze is
  coverage-gated and coloured by ground irradiance (grey at sunrise).
- Haze lit by the clear-sky horizon glows under a storm deck: scale it by the light the clouds let
  through, with a floor (storm 0.06, overcast 0.3).
- Transparent or dithered meshes don't composite with clouds/aerial perspective (they only see the
  depth buffer).
- postprocessing: `EffectComposer.setSize()` resizes the renderer (restore after side composers);
  inside takram's aerial perspective shader `readDepth()` isn't raw depth, use
  `readDepthValue(depthBuffer, uv)`.

## Storms and sky objects

- Anything meant to show under a storm sits below the volumetric base (Cb 600 m) and clear of
  scud (300–550 m); the deck hides whatever is inside it. Check heights against the day's layers
  (`params.mjs --fields weather.formations`, altitudes in `cloudTypes.ts`) before rendering.
- Things that come out of a cloud (bolts, rain) are placed independently of the weather map: put
  the cloud there (`stormCells.ts`). Keep them ≤ ~9 km: a 600 m base 10+ km away sits < 3.5° up
  behind ~70% haze (Koschmieder at 30 km) and washes pale.
- A mesh hanging from the volumetric clouds (waterspout) can't see deck gaps: give it its own
  soft base (spray puffs).
- Camera-facing ribbons widened along one fixed vector vanish where a segment runs along it
  (lightning as dashes): widen across each segment (`dir × toCamera`).
- Exponential fog with large scale height fills the sky; a fog *bank* needs tens of metres.
- `Vector3.transformDirection` normalises: scale after transforming (contrails all landed 1 km
  away).

## Sea and surf

- Anything at mean sea level (splashes, foam) hides behind crests at grazing angles: place it on
  `seaLevel()` and lift it a little. Search for sea points over the whole frame's NDC range (a low
  horizon leaves no sea below NDC 0).
- Steep features narrower than the ocean grid (spacing r × 0.012) zig-zag, worst from overlooks:
  clamp widths to grid and pixel size (`surfProfile`'s `minFace`).
- Breaking at H = 0.78 d puts the break line far out on gentle beaches: wide surf zone, smaller
  waves.
- A hull rides waves longer than itself: in Hs 3.5 m swell the water climbs a small boat only
  ±0.1 m. Spray comes from wind-sea crests it can't follow (slamming, breaking): model those
  statistically. Sample the sea every ~2 m under a hull (7 points under a 250 m ship aliased 12 m
  chop into a fake 0.5° pitch).
- Regular Kelvin waves read as a printed grating from above: cap steepness (0.05), weaken inside
  the wedge (strongest on the cusp lines), break up with noise.
- Near-camera boats need open water: on beach days no spot ≥ 3 m deep lies within ~150 m in frame;
  use `"coast": "open-sea"` to check wakes/spray up close.

- Surf-zone width follows `nearshoreSlope`, not `beachSlope`: a steep beach face over a gentle
  nearshore still breaks waves 40–50 m out. Steepen the nearshore too (stony beaches).
- Pebbles go below a pixel within a few metres of a 1.6 m eye (grazing footprint), so cells
  alone leave a flat colour beyond ~5 m on shingle: keep coarser mottle octaves (patches of
  sorted stones) that fade out later. Voronoi cells filled edge to edge read as paving: draw an
  oval of jittered size inside each cell with thin gaps.
- A steep stony beach face tilts away from a sun behind the land: at golden hour it sits in
  shade while rocks on it are lit. Judge stone texture under a clear daylight spec
  (`"weather":"clear"`); a heavy cloud deck also leaves the beach flat blue (cloud shadow).
- Near-camera props sized by "near" miss the frame: the plan assumed stones in view from ~5 m,
  and our cameras do stand ~2 m up (overlooks 15–45 m) with mostly < 40 mm lenses, but the nearest
  ground in frame ranges from ~5 m (along-beach, framed) to 20–40 m (many shorelines) and beyond
  (overlooks). One forced date showed 21 m and was taken for the rule at first.
  Size radii by pixels on screen (`ctx.pixelAngle`), read `p.view` (`params.mjs`) for the real
  distances, and count placements in a test (`view()` in `test/days.ts`) before rendering:
  `meshStones` placed nothing with the plan's 15 m cap on the test shorelines.
- Plan numbers (radii, counts, budgets) are estimates until measured: check them against
  `p.view` and a placement test before writing code that depends on them.
- Scanning cells in a circle round the camera costs mostly cells out of frame or below the frame
  edge: walk coarse blocks with a tight frustum test, nearest first, and stop at the budget.
- Lines derived from daily run-up (`beachLines`) sit only metres apart on steep beaches; storm
  features belong at the storm run-up height, not a multiple of the daily one.

## Seasons

- A month table needs the hemisphere, not the ocean: `ocean === 'southern'` only flipped the
  Southern Ocean, so Chile, SW Australia and the Cape bloomed in July. Read months through
  `seasons.ts` (`monthInSeason`); keep calendar months only for data that is already local
  (turtle nesting per place). Tests that pin "a northern beach" pin a northern `place`, since a
  biome/ocean spec can now draw a southern place.

## Placement

- Place by trying spots until enough is in view: sampling shore coords round the camera fails in
  along-beach views (the beach in view is ahead). Cast rays through the frame and march them to
  the ground (`spot()` in `props/wildlife.ts`). Flocks: by a view ray reaching the target
  altitude, not fixed NDC heights.
- `ctx.visible()` only says a sphere touches the frustum, so features end up cut by the frame
  edge: use `ctx.inFrame()` (NDC inside the central 75–85%) for things seen whole.
- Beach animals near the waterline vanish under the swash: keep ≥ 0.25 m above sea level
  (`place(..., wet)`). Tropical shelves put 1.2 m deep water only > 150 m out: "in the water"
  needs a shallow fallback (hippos lie down, storm seals 0.8 m). Animals in water:
  `ctx.waterSpot(rng, depth, maxDistance)`.
- From a 1.6 m eye the horizon is ~4.5 km: a 2 m cay is a line of palms over a white strip, and
  low skerries can read as one shore. Make low features nearer, not bigger.
- A rock dropped on a beach reads as a block; a mainland headland must run inland (long along
  the seaward axis).
- Stony beaches move every line: `beachLines().stormLine` is the ridge crest, and a 1:4 face
  tilts long animals (seals) by ~14°: tilt them to `terrainNormal` or one end floats. A
  sea-facing shoreline view has no beach 30–300 m off in frame, so beach haul-outs fall back to
  a skerry: check them along-beach.
- Keep sand days identical when a choice depends on beach material: gate before the draw
  (`continue` before `rng.chance`) or change only the chance, not the number of draws.

## Meshes

- Preview alone first (`scripts/mesh.mjs`): the front view caught open tube ends (crocodile jaws)
  that beach renders hid.
- `MeshBuilder.tube` returns rings: close ends with `MeshBuilder.cap`. Its frame flips with path
  direction (toward −X cos(angle) points up, toward +X down): crocodiles came out with pale backs.
  Check with face-normal colour averages.
- Smooth blobs read as rocks: seaweed/seagrass need loose leaves and ribbons over a low mound
  (`MeshBuilder.ribbon`, `clumpGeometry`). Uniform tubes read as pipes: wood needs bulges, oval
  section, grain checks, splintered ends (`logGeometry`).
- Heads in water read as balls/posts from stacked ellipsoids, as "Nessie" if the neck shows and
  the skull is no wider than the neck. Seals (`swimmingHead`): one lofted tube, skull bulb wider
  than the neck, short tapered muzzle, waterline at the throat; bottling tips about the skull.
- Sheer walls on a polar grid read as drums (karst towers as canisters): vary the wall's foot
  with angle, cover with vegetation and dark streaks.
- Instanced repeats (trees) < ~100k triangles each; in-mesh randomness from `hash()`/`noise3()`,
  not `rng`, so added detail doesn't reshape every instance.

## Page

- Splash boat: CSS waves from quadratic Béziers are parabolas, so a boat rides one exactly with
  quad-ease heave keyframes and linear pitch at the wave's period (middle wave: 7 s per 2
  periods → 3.5 s).
