# Lessons and gotchas

Things that bit us, by topic. Read the sections for what you're touching. Workflow: CLAUDE.md;
tool gotchas: TOOLS.md.

## Debugging approach

- Before investigating a look, grep ARCHITECTURE.md "Known issues" for the symptom ("dark",
  "zig-zag", "flat blue"): phase 9 spent two renders proving near-black land on broken-cloud days
  was older than the phase, while an entry for the same symptom already existed.
- Probe a creator, a placement rule or a height helper with `params.mjs` (`p.ctx`, `src.X`,
  `props.X`) on a spec or real days, not with throwaway test files; read the view cone on the
  `profile.mjs` map before blaming shading for a band or ridge across the frame.

- "Not showing" is usually placement, light or size: check `--props`, backlight and pixel size
  before debugging shaders. Small things at real scale vanish (10 cm crab: ~70 px at 5 m at 4K, a
  speck at 20 m).
- Placed but invisible: print the physics with a temporary `console.warn('DBG …')` at 640×360,
  1 frame, before tuning looks (ship spray: water rose only ±0.1 m on the hull, so no splash could
  trigger).
- Shader debugging: force a visible output (`coverage = 1.0` over a region), move it step by step;
  for terrain and sea first try the false-colour views (`params.debug.terrainView`, `oceanView`).
- Find a cause by switching passes off one at a time (the sunset tree glow had four causes):
  `params.debug.passes` with `diff.mjs --off`, no code edits.
- Before an edit-render-revert loop, look for a switch: `params.debug` (tools/DEBUG.md), a spec field
  or a `params` patch. Never restore a file with `git checkout` mid-work: it drops every
  uncommitted change in it.
- Suspect float precision when a pattern depends on one direction only; isolate by changing one
  offset at a time (`params` patches of `weather.shapeOffset`, `weatherOffset`, `latitudeDeg`;
  `"clouds": [one genus]`).
- After fixing a shared layer (cloud type, exposure, fog), re-check conclusions made while it was
  broken: scud made every storm flat grey, and "calvus = capillatus from below" was wrongly blamed
  on physics.
- Physically faint is fine, but say so rather than boost (noctilucents need the sun 6–16° down;
  our blue hour stops at −7°; blue-hour contrails are dark lines in the earth's shadow).
- Speed work: compare with a pixel diff, not by eye; two runs of the same code on the same GPU are
  pixel-identical. Benchmark under `caffeinate -i`; GPU noise floor ≤ 5/255 on a few pixels.
- three sorts opaque meshes by **material id** (creation order) before depth: creating meshes in a
  different order changes equal-depth pixels.
- Plan numbers (radii, counts, budgets) are estimates until measured against `p.view` and a
  placement test: the stones plan assumed ground in view from ~5 m, but the nearest ground in frame
  is ~5 m (along-beach, framed), 20–40 m (many shorelines) or beyond (overlooks); one forced date
  showed 21 m and was taken for the rule at first, and `meshStones` placed nothing with the plan's
  15 m cap. Size near-camera things by pixels (`ctx.pixelAngle`).

## Randomness, params and tests

- Long outputs: put the summary last (`bench.mjs` timing table, `params.mjs` "… N more not
  shown") and save it to a file; a `| tail` that cuts the table off costs a full re-run.

- Tests that need a rare event on **real days** ("at least one waterspout in three years") break
  when the main stream changes (places, 1a, broke four). Check rules on real days, but get the
  event from a spec over every date (`scenes({ place: 'caribbean', … }, DAYS.length)`), and
  compare rates on forced, equal conditions.
- Removing a draw from the middle of an object literal (the old `sandbarDistance`) shifts every
  later field and the eye height: keep the draw (`skipDraw`) and check `params.mjs --ref HEAD`
  shows only the intended param changing.
- Rewriting `x *= a * b * c` as `x * a * b * c` changes the last bit (rounding order) and
  `params.mjs --ref` shows dozens of changed days. Keep the grouping when wrapping a value in
  `or()`.
- Keep other days identical when a choice depends on a new input (e.g. beach material): gate
  before the draw (`continue` before `rng.chance`) or change only the chance, not the number of
  draws.
- Tests that compare whole `coast` (or `params`) objects break whenever a field is added that
  follows the forced value; compare the fields the test is about.
- `params.mjs --ref` counts open-sea days for beach-shape changes (their coast carries a shape the
  terrain never draws): report beach days separately.
- Pack ice calms `params.ocean.windSpeed` (×0.4, for the waves) but not the wind the sky reads
  (lenticulars, fog): compare sky features with the wind before the ice factor.
- Module cycles: `tides.ts` importing `terrain.ts` (which imports `tides.ts`) left half the test
  files failing to load. Put shared helpers in a module with no imports (`reef.ts`).

## Seasons

- The real sun at 76–80° (Svalbard) never gets above −6° in December: the plan's "blue-hour
  glow at noon" exists only nearer the Arctic Circle (Tromsø's 69–71°). Check `sunLimits`
  before writing a render spec for a polar look. Below 63° the time of day is still a free
  category (the 35–70° midday also in mid-latitude winters).

- A month table needs the hemisphere, not the ocean: `ocean === 'southern'` only flipped the
  Southern Ocean, so Chile, SW Australia and the Cape bloomed in July. Read months through
  `seasons.ts` (`monthInSeason`); keep calendar months only for data already local (turtle nesting
  per place). Tests that pin "a northern beach" pin a northern `place`, since a biome/ocean spec
  can draw a southern place.

## Light and exposure

- Auto exposure re-normalises: scaling the whole scene does nothing; change `exposure` (e.g.
  `nightScale`) or relative brightness.
- Post-exposure units: sky ≈ 0.1–1; > 40 clamps white (GradeEffect). Effects added after exposure
  in fixed units look equally strong by day and dusk: physical sources need fixed scene radiance ×
  exposure. Fixed-power lights (lanterns, beams) scale per time of day against the metered sky, or
  they vanish at dusk and blind at night.
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
- Sand overlays: a plain vertex-coloured sand mesh lights brighter than the terrain's sand shader;
  tint sand-coloured overlays (tracks, stones) ~0.8×.
- Glow round trees against a low sun had four causes: cloud TAA smearing light shafts past
  silhouettes (history now off; our accumulation averages), half-res clouds upsampled across
  silhouettes (rims, pink ridge outlines at blue hour), MSAA edge pixels keeping some bare sky
  (`SkyFillEffect`), GGX glints on edge-on leaves (no direct specular on plants). A pass reading
  the depth buffer composites per pixel; anything blended into a pixel (MSAA, bilinear) needs
  coverage handled explicitly.
- A steep stony beach face tilts away from a sun behind the land: at golden hour it sits in shade
  while rocks on it are lit. Judge ground texture under `"weather":"clear"`; a heavy deck also
  leaves the beach flat blue (cloud shadow).

## Shaders (GLSL)

- Reserved words that read like names: `flat`, `smooth`, `half`, `input`, `output`, `filter`,
  `active`, `common`, `partition`, `fixed`, `long`, `short`. `smoothstep(e0, e1, x)` with e0 ≥ e1
  is undefined (works on one GPU, not another): write `1.0 - smoothstep(e1, e0, x)`. Both show
  only at render time.
- Never leave a `sampler2DShadow` uniform `null`: three.js r186's fallback (`emptyShadowTexture`)
  is never uploaded, so it binds a plain RGBA texture and the GPU silently drops the whole draw
  (console: "Mismatch between texture format and sampler type"). Start it on an allocated depth
  texture with `compareFunction` (`shadow.ts` `noShadowMap`). Headless snapshots don't echo GL
  errors from the worker; run with `?worker=0` and check `gl.getError()` after draws to find one.
- A render target cleared to (0,0,0,0) holds premultiplied colour in its mips: blending it with
  `mix(x, rgb, a)` weights the content by a² and leaves a bright fringe at every edge. Use
  `x · (1 − a) + rgb`.
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
  remap(mix(weather, 1, width), …)); ragged scraps need a narrow width + high `weatherExponent`. An
  étage's 2nd layer reads weather-map alpha (`layerChannels`). Under a closed deck you never see
  cloud tops.
- The cloud shadow map is temporal (~8 updates to converge): unprimed, the first of 16 frames saw
  clouds unshadowed and low-sun bases came out too pink (`primeCloudShadow`).
- Temporal upscaling + along-ray-only jitter left spots and grain in averaged stills: Halton
  sub-pixel jitter + one final sky denoise fixed it.
- Streaky clouds toward the vanishing point = float32 cancellation in the cube-sphere uv
  (`sqrt(a - sqrt(a² - 6mx²))` = 0 within ~1 km of our anchor's meridian), not wind or texture
  (`stabiliseCubeSphereUv`).
- Clouds on a round earth: a 700 m base sinks below a 2 m eye's horizon at ~95 km, tops show to
  ~140 km. With Bruneton air alone (~220 km visibility) 40–130 km of undersides stacked into a dark
  band on the sea; real sea air (20–60 km) fades them (`seaHaze.ts`). takram's own haze is
  coverage-gated and coloured by ground irradiance (grey at sunrise).
- takram's haze ray ends at the top of the highest cloud layer (`getHazeRayNearFar`): with no
  layers there's no haze at all. A clear dust day needs an empty layer (density 0) through the
  dust's height.
- Thick dust can't take its colour from the sky behind each ray (the sky stays blue overhead):
  colour it from the horizon sky in every direction, tinted, and give the sunlight it removes back
  as diffuse light, or sand under a dimmed sun and blue skylight goes purple.
- Haze lit by the clear-sky horizon glows under a storm deck: scale it by the light the clouds let
  through, with a floor (storm 0.06, overcast 0.3).
- Transparent or dithered meshes don't composite with clouds/aerial perspective (they only see the
  depth buffer).
- postprocessing: `EffectComposer.setSize()` resizes the renderer (restore after side composers);
  inside takram's aerial perspective shader `readDepth()` isn't raw depth, use
  `readDepthValue(depthBuffer, uv)`.

## Storms and sky objects

- Anything meant to show under a storm sits below the volumetric base (Cb 600 m) and clear of scud
  (300–550 m); the deck hides whatever is inside it. Check heights against the day's layers
  (`params.mjs --fields weather.formations`, altitudes in `cloudTypes.ts`) before rendering.
- Things that come out of a cloud (bolts, rain) are placed independently of the weather map: put
  the cloud there (`stormCells.ts`). Keep them ≤ ~9 km: a 600 m base 10+ km away sits < 3.5° up
  behind ~70% haze (Koschmieder at 30 km) and washes pale.
- A mesh hanging from the volumetric clouds (waterspout) can't see deck gaps: give it its own soft
  base (spray puffs).
- Camera-facing ribbons widened along one fixed vector vanish where a segment runs along it
  (lightning as dashes): widen across each segment (`dir × toCamera`).
- Exponential fog with large scale height fills the sky; a fog *bank* needs tens of metres.
- Exponential fog has no top: a camera 100 m over a 55 m-scale layer was still in 16% of the
  sea-level density and saw nothing at all (2016-08-09: island and mountains in the title,
  a pink blanket in the frame). Real sea fog stops at an inversion; give a layer a top and check
  the high eyes (open sea and overlooks draw 40–160 m) as well as the beach.
- Effects that depend on where the eye is (fog above or below it) belong in the render, where
  the camera's ground is known; `params.ts` can't call `terrainHeight` (import cycle).
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
- Surf-zone width follows `nearshoreSlope`, not `beachSlope`: a steep face over a gentle nearshore
  still breaks waves 40–50 m out. Steepen the nearshore too (stony beaches).
- A hull rides waves longer than itself: in Hs 3.5 m swell the water climbs a small boat only
  ±0.1 m. Spray comes from wind-sea crests it can't follow (slamming, breaking): model those
  statistically. Sample the sea every ~2 m under a hull (7 points under a 250 m ship aliased 12 m
  chop into a fake 0.5° pitch).
- Regular Kelvin waves read as a printed grating from above: cap steepness (0.05), weaken inside
  the wedge (strongest on the cusp lines), break up with noise.
- Near-camera boats need open water: on beach days no spot ≥ 3 m deep lies within ~150 m in frame;
  use `"coast": "open-sea"` to check wakes/spray up close.
- Calming water means more than lowering the displacement: slopes, Jacobian foam, whitecaps, the
  surf (incoming height, not the depth cap), spray, waves on rocks and the CPU `seaLevel()` each
  read the waves separately. Put the factor beside `shallowDamping` in both shaders and pass the
  same mask to every TS mirror (`shelterAt`), or the calm lagoon keeps spray and foam.
- Scaling the surf's deep-water height still shoals the re-formed wave by Green's law as the
  lagoon shallows: "≤ 0.3 × offshore" holds against the incoming wave at the same depth, not the
  deep-water height (at 1 m depth 0.2 × h0 shoals to ~0.4 × h0).
- Wind chop in a lagoon is fetch-limited: a 10 m/s wind over 300 m raises ~1.7 m waves, which live
  in the middle cascade (1–6.5 m), not the shortest (< 1 m). Scale the middle cascade by fetch.
- A reef's waves break on a ~2 m strip of its steep face in the surf model, so there's no white
  line from afar: the crest needs its own band of white water. The surf zone ends 150–350 m from
  the water; anything breaking further out (a reef 400 m off) needs `surfReach`.
- A planar reflection blurred evenly lets go of the waterline: past an object's foot the mirror
  target is transparent, so any blur fades the image right where it should touch. Real blur grows
  with the reflected ray's length t past the water (∝ t / (D + t)): read the mirror's depth and
  scale the mip and the wave shift by it.
- Foam on the sea plane is invisible at grazing distance: at 855 m from a 38 m eye a pixel on the
  water is ~0.5 m wide but ~11 m deep, so a 2 m collar is 0.2 px tall. Put the white water on the
  object's vertical face (wash band) and in spray; size sea foam by wave height, not object radius
  (a 60 m island's `0.35 r` collar was 20 m of white), and fade it by band width over footprint.
- `waveOnRock().breaks` compares the crest with the rock's top only: any cliff "breaks" a 5 cm
  swell. For islands also gate by the crest's own height (`islandWaves`).

## Coast and terrain

- A biome-keyed table is wrong for some of its places: the `mediterranean` preset is also
  Florida, Taiwan and Natal, `volcanic` is Hawaii and Kamchatka. Key what follows the weather
  (plants, clouds, fog, wrack, crabs, seals) by the day's `place.climate`, what follows the rock
  by the biome, and what a single place differs in by a place field (`mountains`). A contact sheet
  of one place per climate finds the leftovers (Florida's mountains and high islands, phase 11).
  Better, before building: read ARCHITECTURE.md "Biome, climate or place" and ask `params.mjs`
  about each table on the odd places (`--scene '{"place":"florida-carolinas"}' --stats 'p =>
  p.props.shoreLife?.flowers'` showed Mediterranean sea daffodils on 77% of Florida's autumn
  beaches).
- Plans carry physical claims ("Svalbard noon blue-hour glow"): check them with the code's own
  functions (`sunLimits`, `params.mjs`) before writing specs or tests from them.

- A regular row of identical teeth along a far cliff or scarp ("copy-paste" shore) was the
  terrain grid, not the rock: the full-circle grid's cells were 2.2% of r deep but 0.6% wide, so
  a steep face seen at a slant crossed one long cell per tooth. Square cells fixed it, paid for by
  covering only the view (the camera sees ~8–27% of the circle): same vertices, same speed. Probe
  with `terrainGrid: 2` and with each height term off (`dip`, `gully`, `relief`) before blaming
  the geology.
- Sharp relief in the height function zig-zags across the polar terrain grid wherever it is in
  silhouette: steep faces, stair risers, gully walls, ragged edges. Widen or fade each by the
  distance from the camera (it is at the origin, so the TS mirror can do the same) and by the
  bare slope; test a suspect by rendering once with a 2× grid (teeth halve = grid aliasing).
  Find the feature by its period: a saw every ~1 m on rock was beds dipping 20° (a new ledge
  every bedding / dip), not the ridged noise or the risers it was first blamed on.
- A camera placed at `distanceToWater` is not at s = −distanceToWater: the coast's wobble at
  a = 0 (up to ±25 m) shifts it, enough to put a cliff-top camera on the cliff face. Correct by
  the wobble (`wobbleAtCamera`) and check the ground there (`rockGround`) before rendering.
- Wet ground shaded like wet sand (a near-mirror film) turns a gently sloping intertidal rock
  platform white: wet rock is a dull sheen; only pools are mirrors.

- Tides move the water off s = 0: every "distance from the shore" in shaders and props (surf zone,
  shore foam, surf crests, pebbles between camera and water) must measure from `coast.waterline`,
  or a low tide 350 m out loses its surf and foam.
- Geometry shaped to be seen under water (rip channels, the terrace's seaward edge) shows at low
  tide as hard steps; soften walls and check the low-water render too.
- A relative tide range from the day's waves (RTR = range / Hb) makes almost every calm beach with
  a 1–2 m tide "tide-modified" (reflective 29% → 10%). The census classes by modal waves; keep
  micro-tidal beaches wave-dominated.
- A gap in a bar isn't a rip: with only the bar removed the channel is as shallow as the trough
  and waves still break across it. Scour the channel below the bare profile (rip channels are
  1–2 m deeper than the bar).
- Anything sized by the daily run-up vanishes on steep gravel (0.2–0.4 m run-up on a 0.3 face is
  ~1 m of beach): cusps need a band of ~⅓ of their spacing. Lines derived from daily run-up
  (`beachLines`) sit only metres apart on steep beaches; storm features belong at the storm run-up
  height, not a multiple of the daily one.
- Beach-state surveys file a multibar beach under its inner bar (Short 2006), so their shares and
  mean Ω per state (TBR 3.6 > RBB 3.1 > LBT 2.4) don't line up with a whole-profile state. Compare
  shares by beach length, not count: a view shows a stretch of coast.
- A lagoon curve at the beach slope (0.03) to a 3 m floor never gets there behind a reef 150 m
  out: the drawn depth must be reached (`lagoonSlope`). Compare drawn and reached numbers in
  `profile.mjs`.
- Steep-sided features (coral heads) make "no steps along s" tests fail: test the joins between
  profile pieces, not every metre.
- Pebbles go below a pixel within a few metres of a 1.6 m eye (grazing footprint), so cells alone
  leave a flat colour beyond ~5 m: keep coarser mottle octaves that fade out later. Voronoi cells
  filled edge to edge read as paving: draw an oval of jittered size inside each cell with thin
  gaps.
- Scanning cells in a circle round the camera costs mostly cells out of frame: walk coarse blocks
  with a tight frustum test, nearest first, and stop at the budget.

- A flat km wide and a few metres high: with a 80 mm lens a small creek beside the camera, crossing
  the view at ~47°, reads as a band or a ridge across the whole frame; its banks need to be gentle
  (0.18 m over 2 m, not 0.25 m over 1.2 m) and its water mirror-flat. Probe with
  `terrainView: "relief"` and the creek function on a grid before blaming the shading.
- A marsh drawn as a sward on a beach profile sits wherever the beach's land is: capping the
  beach width dropped it below the spring high water and flooded it. Put salt-marsh height in the
  profile (spring high water + a few decimetres), not in the beach's own parameters.
- Accent colours sprinkled per instance (every third tuft purple) look fake; real ones grow in
  patches. Drive the props' accents from the same noise the terrain paints them with.
- Tight lenses see the ground from 10–15 m: a framed camera 5–30 m into a marsh looked past it to
  the flat. Check `p.view.nearest` against where the feature starts.

## Placement

- Place by trying spots until enough is in view: sampling shore coords round the camera fails in
  along-beach views (the beach in view is ahead). Cast rays through the frame and march them to the
  ground (`spot()` in `props/wildlife.ts`). Flocks: by a view ray reaching the target altitude, not
  fixed NDC heights.
- `ctx.visible()` only says a sphere touches the frustum, so features end up cut by the frame edge:
  use `ctx.inFrame()` (NDC inside the central 75–85%) for things seen whole.
- Beach animals near the waterline vanish under the swash: keep ≥ 0.25 m above sea level
  (`place(..., wet)`). Tropical shelves put 1.2 m deep water only > 150 m out: "in the water" needs
  a shallow fallback (hippos lie down, storm seals 0.8 m).
- From a 1.6 m eye the horizon is ~4.5 km: a 2 m cay is a line of palms over a white strip, and low
  skerries can read as one shore. Make low features nearer, not bigger.
- A rock dropped on a beach reads as a block; a mainland headland must run inland (long along the
  seaward axis).
- Stony beaches move every line: `beachLines().stormLine` is the ridge crest, and a 1:4 face tilts
  long animals (seals) by ~14°: tilt them to `terrainNormal` or one end floats. A sea-facing
  shoreline view has no beach 30–300 m off in frame, so beach haul-outs fall back to a skerry:
  check them along-beach.

## Meshes

- Clamp before a fractional power: `(1 - t) ** 2.2` is NaN for t a hair above 1, and a path
  built as `start + (length * i) / n` can end there (the rock lighthouse's top shaft ring, 0.83).
  three then logs `computeBoundingSphere(): Computed radius is NaN`; find the mesh by hooking
  `console.error` in an init script (`?worker=0`): its second argument is the geometry (vertex
  count, first non-finite index → which ring or part).

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
- Sheer walls on a polar grid read as drums (karst towers as canisters): vary the wall's foot with
  angle, cover with vegetation and dark streaks.
- Instanced repeats (trees) < ~100k triangles each; in-mesh randomness from `hash()`/`noise3()`,
  not `rng`, so added detail doesn't reshape every instance.

## Page

- Freeing a still: everything but the context can go once the frame is in the canvas
  (`preserveDrawingBuffer` keeps it for Download). Dispose materials **before**
  `renderer.dispose()`, or their programs are never released. A module-level texture or quad keeps
  three's dispose listener and with it the old renderer alive: dispose it too. Heap differs by
  ~40 MB between days, so a leak check compares a revisited day with its first visit
  ([LEAKS.md](LEAKS.md)).
- Wait for the last frame on the GPU (`gpuIdle`) before disposing: Chrome still queries each
  program after the GPU runs the frame, and one deleted before then logs `GL_INVALID_VALUE:
  glGetProgramiv: Program object expected` (one per program, ~48; a 100 ms wait also hid it, one
  task did not). These are GPU-process messages: Playwright's `console` event misses them, a CDP
  session with `Log.enable` (`Log.entryAdded`) sees them, from the worker too (`watchPage` in
  `scripts/lib.mjs`; snapshot ⚠ `GL:`). It needs a heavy last frame to show (4K, default frames).
- Splash boat: CSS waves from quadratic Béziers are parabolas, so a boat rides one exactly with
  quad-ease heave keyframes and linear pitch at the wave's period (middle wave: 7 s per 2 periods →
  3.5 s).
