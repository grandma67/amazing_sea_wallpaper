# Known issues

Symptoms and gaps, by area. Before debugging a look, grep here for the symptom ("dark",
"zig-zag", "flat blue"). Fix plans with steps: `tasks.md` (repo root). Leftovers of finished
plans are listed in each plan's own "Open" section.

Each entry says how its cause was found: **measured** (which probe, script or diff, on which
date or spec) or **suspected** (inferred, not checked). A suspected cause is a lead, not a fact:
REFLECTION phase 4 wrote "the cloudy cube's horizon is ~3× darker" from sea pixels, and phase 6
spent its first renders on it before `cubeProbe` showed the cube was right. When adding an entry,
say how the cause was found.

## CI and the daily render

- **Takram's clouds pass stores metres in half floats too** (read in the source 2026-11-19, not
  seen to break): `CloudsPass` writes its front depth (sky pixels: `cameraFar`, 400 km; horizon
  clouds 150–200 km) into a `HalfFloatType` depth-velocity target, which overflows to ∞ on
  SwiftShader. Harmless today because we run its resolve with `temporalAlpha = 1` and no temporal
  upscale, and every SwiftShader frame checked after 0.204 has a clean clouds stage; if either
  setting changes, clamp it as `cloudShadowPatch.ts` does the shadow map.
- **Fixed (0.205): the moon's disc overflowed the half-float frame at night** (measured with
  `nanTrace` `sat` on the Mac, 6 NaN pixels on SwiftShader): clamped in `moon.ts`. New bright
  sources: run `nanTrace` on the Mac and read `sat` (tools/DEBUG.md).
- **Residual NaN in the far shadow cascade on SwiftShader** (measured: 2 270 texels on
  2024-02-19 after 0.204): made after the shader's own output, read as "no shadow" by the guarded
  read. Harmless; source not pinned.
- **Our own shaders: no unguarded NaN found** (audit 2026-11-19 of 83 GLSL blocks: every `sqrt`,
  `inversesqrt`, `log`, `pow`, `acos`/`asin`, `atan`, `normalize` and division by a variable,
  ~360 sites; the risky ones already floor or clamp: `NoV ≥ 1e-3`, GGX roughness ≥ 0.02/0.08, the
  sky denoiser starts its weight at 1, mirror distances go through `mirrorRayLength`). Degenerate
  but unreached: a lighthouse view ray through the lantern (`sweptSegment` /d), the rainbow's
  `cross(antisolar, up)` with the sun overhead, `cross(z, up)` at a geographic pole.

- **Other shaders may hold the edge that blacked 2026-11-15** (fixed in 0.195, measured; story:
  tools/RENDER.md "Blank frames"): x86 SwiftShader turns a depth a hair under 1 into ∞, then NaN,
  where Apple GPUs stay finite. NaN reaching bloom is now zeroed by the frame meter and warned
  about (`frameNonFinite`, a `NaN pixels` annotation on CI): the warning names the day.
- **The scheduled render finishes late** (measured from the Actions API, plans/CRON.md §2.1):
  01:10–07:43 UTC over 10 days for a 00:05 UTC schedule, so in Europe the 07:xx desktop run often
  finds no picture yet and waits for its re-run (08:00 UTC or later).

## Light and frame

- **Dark land** ("beach renders dark blue", "land near-black", "marsh black"): partly fixed by
  skylight from clouds (`place: "western-med"`, 2024-05-08, along-beach is sand-coloured now),
  then by the frame's own meter (0.128, `frameMeter.ts`): a sun-up frame under 0.10 exposed opens
  up to 1.5 stops (`2024-11-05`, ×2.2). The Brittany case (`place: "brittany"`, 2025-07-10,
  along-beach, daylight, `weather: "broken"`, sun 160°) meters 0.108 and isn't lifted. That sand
  also reads less red than albedo × skylight predicts (raw 0.0069, 0.0076, 0.0112 against ~0.012
  each); not traced.
- **Meter zenith:** `meterScene`'s `zenith` (`debug.skyZenith`) reads ~3× the env cube's own zenith
  luminance at the same sun (0.074 vs 0.023 at 60°). Not traced; the cube's is the darker part of
  the sky, as it should be. Only a stat so far.
- **Sea haze fades as (1 − T)²** (measured in REFLECTION phase 4, 2003-03-11 `calm-islands`,
  `haze.mjs`): takram mixes an inscatter already scaled by the opacity by the opacity again, so
  mid-distance land is darker than Koschmieder's haze would leave it. The mirror image matches it
  (`ocean.ts` `reflectionHaze`), so a fix must change both.
- **Night frames** (found in SHADOWS phase 6, 2026-11-07; unchanged pending a decision, they touch
  all nights): the night white balance (`NIGHT_WHITE_BALANCE_K`, gains 0.67, 1.02, 1.77) turns
  moonlit white sand (raw 0.068, 0.060, 0.058) deep blue (exposed B/R 2.3); at ~4000 K and
  moonlight's ~4100 K it should be near neutral. A starlit cloud deck is lit blue (raw B/R 2.4: the
  stand-in sun's Bruneton colour), not by the airglow's warm green. Birds stay sharp in a 30–130 s
  exposure. All three show once a cloudy night is opened up.
- **Lighthouses** (found 2026-11-07): every lighthouse day builds one since 0.210 (15 of 92 found
  no site when the horizon sat above the frame's middle). Since 0.196 the
  lamp is 10⁶ cd (the whiteouts of `2025-08-21`, `2024-11-30`, the veil of `2015-02-22` are gone).
  Left, judged by eye on renders, not measured: the forced rock light in night fog
  (`{"date":"2025-07-10","timeOfDay":"night","lighthouse":"rock","fog":"advection"}`) keeps a large
  forward-scattered halo (real round a bright lamp in fog, its size unchecked against a photo); at
  sunset the lit glazing (90 cd/m², `LANTERN_SIDE_CD` an estimate) is darker than the sky behind it
  and shows as a dull band, with no sky reflection on the glass; the divergence stays 2.2° (e-fold
  half-width; Sabik's LED beacon is 1.5° full width at 5%, classic lenses wider).
- **Light pollution** (`nightGlow.ts`): at the night white balance (4000 K) the domes and the
  town-lit cloud bases (0.190) come out only mildly warm (sodium ~2100 K stays orange; the LED
  share pulls them neutral).
- **Physically subtle (not bugs):** Posidonia wrack at normal distance, hatchlings (5 cm) beyond
  ~10 m, crawl tracks at grazing angles, wakes at the usual 300 m+, ship lights at dawn,
  noctilucent clouds, rock foam against a low sun.

## Sky

- **Waterspouts:** far rarer than intended (1 in 3 years; the fog rule works since 0.209):
  [plans/WATERSPOUT_FOG.md](plans/WATERSPOUT_FOG.md) §2, waiting on a decision. The Florida Keys get the Mediterranean's
  waterspout season (biome-keyed).
- **2016-08-09:** the title's mountain range (36 km, 1.6 km high, in frame) can't be seen even with
  `fog: null`: lost in haze against a 3° sun. Not traced.
- **2026-02-13:** sparkly dots in the air over the sea. Not traced.
- **Shelf cloud** (volumetric since 0.174): on far real days (2024-06-21, 2024-04-24, 2024-07-01,
  2024-12-12, 2025-02-12) it reads as a dark strip on the horizon with a ruler-straight top.
  Measured on 2024-06-21 (`edges.mjs`, shelf on and off): the strip is the storm's rain region, as
  dark with the shelf off; its top is the lip (1.2 px sharp, 4 px from the CPU's prediction); the
  face is 1.09× the deck. Left: the lip's straightness (the WMO's arcus has "more or less tattered
  edges"; ours varies only over kilometres): [plans/SHELF_VOLUMETRIC.md](plans/SHELF_VOLUMETRIC.md)
  "Later". A backlit sunset shelf may still read as a flat pink band (2010-04-01; not re-checked
  since the volumetric shelf).
- **`stormCells.ts` near latitude ±45°:** it maps the weather map's uv to metres linearly; on a cube
  edge of the cube-sphere uv (at our longitude 0) that map breaks, as it did for the shelf
  (arch/SKY.md "takram's clouds, from the inside"). Cells are ≤ 9 km so it may not show;
  suspected, not checked.
- **Far bolts without cloud** (found in CLOUD_ILLUMINATION phase 4, 2026-11-15): on 2016-06-21
  (bolt 5.7 km off, mountains behind) takram draws almost no Cb near its 600 m base over the bolt,
  so the bolt's top hangs in front of the range and its flash has no face to light. Measured with
  `debug.cloudFace`: the ray to the base under the exit first meets cloud 6.3 km out at 340 m
  (beyond the bolt), the one 900 m higher at 7.6 km. Cause not traced (the storm cell's fill at
  that distance, or takram's height shaping).
- **Night storms** (0.189): the Cb's base reads as flat bands receding to the horizon (2026-08-20,
  2026-03-27): lit only from above by the moon or the stand-in, it has no detail, and the gap of air
  under it shows the town dome as a brown strip with a hard top edge. Seen by eye with
  `passes.clouds` off and on; cause in the clouds' night light (not measured further).
- **Aurora** (`aurora.ts`): on quiet starlit nights its light on clouds barely shows: the clouds
  pass's stand-in sun (`scene.ts` `starlight`, nearly overhead, a sun's strength in the night's
  units) outweighs the display's physical light on cloud tops (fix the stand-in, diffuse
  ~0.002 lux; touches every cloudy starlit night). The airglow's wave crests (`nightGlow.ts` bands)
  show more on aurora nights (+1.5 EV, a wider, higher frame) as faint slanted stripes low in the
  sky: the airglow's, not the aurora's (`passes.aurora: false` keeps them; the mirror predicts
  them: `params.mjs --line --sky glow`). The 5 km N₂⁺ fringe (a single-layer feature in the march)
  leaves ~3% grain at the arcs' lower edge on Kp ≥ 5 nights.
- **Lunar eclipse:** it dims the moonlight (`scene.ts`), not the drawn sky, so stars may stay
  hidden; written before the airglow (0.86), re-check before fixing.
- **The sea near the horizon** (measured with `horizon.mjs`, 2003-03-11 broken, calm sea, 0.135):
  sea / (F × sky) is 0.62–0.77 within 1° of the horizon (1.0 expected on calm water; 0.30–0.36
  before REFLECTION phase 6) and ~1 at 2°. Cause **suspected**: the 0.2 m swell tilting facets
  toward higher, darker sky, or the probe box mixing pixels at the horizon line. Under broken
  cloud the cube is 1.3× the frame's sky at +4° (1.0 at ≤ 1°); **suspected**: the cube's clouds
  drawn at `medium` quality with fewer frames (`renderCloudyEnvironment`).

## Places, seasons, snow

- **Landforms and islands are chosen by biome** (`pickLandform`, `ISLANDS`): subtropical places get
  the Mediterranean's volcano odds; flat places (`mountains: false`) and, since 0.212, coasts with no
  volcano in sight (`volcanoes: false`, `NO_VOLCANOES`) opt out. Per-place table:
  plans/TERRAIN_FORMS.md phase 4. Other biome-keyed leftovers: ARCHITECTURE.md "Biome, climate or
  place".
- **Drawn snow lines** (`pickLandform`, biome-keyed): the nordic biome's 0.35–0.6 of the height is
  low for a temperate summer (west Norway ~630 m in late August). (Tropical mountains: bare since
  0.211, `TROPICAL_SNOW_LINE`.)
- **Seasons** (0.98): no leaves in the wrack; no larch (conifers stay green); tropical wet and dry
  seasons aren't modelled beyond the dry-grass and flamboyant windows. The distant woods' autumn
  tint (`canopyTint`) was tested in numbers, not checked in a render. More in
  plans/SEASONS_PLAN.md "Open problems".
- **Snow** (0.111): plans/SNOW.md "Known limits" (smooth snowed mountains, plain white far boreal
  land, a foot's end beside a very close camera, no falling snow). Sea ice: plans/SEA_ICE.md
  "Known limits".
- **Plants:** live oak, slash pine, cabbage palm and saw palmetto reuse the `broadleaf`,
  `stone-pine`, `palm` and `bush` meshes (coconut-like crowns, a generic oak). Eucalypt forest seen
  from an overlook stands apart like a young open stand, where a NSW headland has a closed canopy
  (`scenes/eucalyptus.json` `nsw-overlook`, 0.145); **suspected**: the vegetation's shared count
  and clumping (`KINDS`), not the mesh (`mesh.mjs` at 150 m shows a full crown); tropical
  broadleaf is as sparse. A flowering bush twin skips the spring fresh-green tint (arch/PROPS.md).

## Coast and surf

- **Surge (0.200):** a salt marsh never floods: the surge is capped 0.3 m below the marsh top,
  because the terrain has no sea dike or higher ground for a camera (found by `test/surge.test.ts`).
  Before 0.200, 10 of 433 beach days stood the camera in the water (wobble ignored); since 0.202 a
  beach camera steps inland until the drawn ground is 5 cm above it.
- **Tide curves (0.201):** places whose nearest TICON gauge is > 250 km off (Red Sea, Comoros,
  India, Arctic Canada, Yellow Sea, Andamans, …) have a typed shape with a hashed phase, not their
  real timing; the Yellow Sea especially deserves a real gauge (Incheon). A forced `moonPhaseDeg` or
  eclipse doesn't move the tide (it follows the date's real Moon). No shallow-water constituents
  (M4): big estuary tides (Anchorage) are symmetric, ~7% off. Local solar time comes from the
  sun's elevation, so a forced sun elevation moves the tide too.
- **Ebb and flow (0.206):** the drain rate is calibrated on one point (fine sand, 2 m tide, Egmond);
  other grains follow Hazen's d², the drying time (3 h) and the fringe (0.06 / d) are estimates. No
  reference photo was matched; the look was judged on `scenes/tideFlow.json` and real days. Tidal
  currents (the water's own flow in channels and inlets) are not drawn. Flats keep their old film.
- **Beach cameras in the water:** shoreline and along-beach cameras are placed at the drawn
  distance in s, but the coast's wobble at a = 0 (±25 m) shifts them (rocky shores and flats
  correct for it with `wobbleAtCamera`): 12 of 433 beach days (2.8%) stand in the water, most at
  low tide on a terrace (`params.mjs --rendered --stats 'p => p.ctx.ground(0, 0) < 0' --where 'p =>
  p.coast.type === "beach"'`; found by `expectDryCameras`). Fixing it reframes about half of all
  beach days: ask first.
- **Run-up ignores the beach state:** on flat dissipative beaches the high-tide line lies ~35 m and
  the storm line (`beachLines`, 2.2 × run-up, capped at 2.3 × width) up to ~120 m inland
  (`profile.mjs` on Namibia 2024-06-11), so the wet band is very wide and storm-line debris sits far
  back; on steep gravel it is ~1 m. A Stockdon-type run-up (∝ slope × √(H0 L0) on steep beaches,
  ∝ √(H0 L0) on flat ones) would fix both, at the cost of re-tuning the wrack lines.
- **Bars and rips:** at low tide on terraced rip beaches the emerged inner bar and rip channels
  show as straight-edged shelves (`scenes/tides.json` brittany-low): shaped to be seen underwater.
  Waves re-form at full height behind a bar (surf is local-depth only; real broken waves decay
  toward ~0.4 × depth, Dally et al. 1985; the shelter mask covers reefs, not bars, and doing it for
  bars changes every barred day). Longshore bars have no trough (OzCoasts: 2–3 m behind the bar;
  ours ~1 m; only rip channels are scoured).
- **Beach-state shares vs Australia's census:** transverse bar–rip under-drawn, longshore and
  dissipative over-drawn. A retune is proposed in COASTS.md "Beach state and tides" (ask first: it
  changes every beach day).
- **Reefs:** the shelter is a straight line: swell through a pass doesn't spread into the lagoon
  (the pass is only deeper, no white water; basins could stand in). Crest foam is a band timed
  with the surf cycle, not breaking waves (the surf model breaks them on a ~2 m strip of the steep
  face); against a low sun ahead it fades into the glare.
- **Islands and bergs:** icebergs get the contact reflection but no wash band or island foam (not
  `waterline`-tagged). Island spray bursts are few-centimetre droplets, faint specks at ~850 m; the
  wash band carries the rough-sea look. All islands of a day share one wash-band material.
- **Tidepools** are runnels and puddles on the terrace (shader patches), not pools among rocks. A
  rock pool within ~15 m beside a boulder hasn't been rendered yet (plans/WATER_VIEW.md).
- **Mirror images in water films** (0.134): a lightning bolt in the swash (2025-04-25) is speckled
  and blocky, not a soft streak: the blur is sized from the mirror depth at the film's unshifted
  point (trees tens of metres off), not the bolt kilometres away. Storm days with a bolt in frame
  only.
- **Stony beaches:** shingle reads as a flat mottled colour on most 1080p views (a 2–5 cm pebble is
  under a pixel past ~10 m at eye height; the nearest ground is often 20–40 m); `framed` stands
  15–60 m inland behind the plants, so it never has stones in the foreground. Iceland (volcanic
  biome) gets the volcanic default plants, including palms; its basalt cobbles render brown
  (palette mean pulled up by the red scoria entry and exposure).

## Rocky shores (PLAN_BIOMES 8)

- Near bed risers on a platform seen along the shore (10–40 m) can show a row of small dark notches
  (grid aliasing: a 2× grid halves them). The far scarp and cliff saws were fixed by the view-wedge
  grid (0.76).
- Boulder sides within ~5 m show a hair-like fringe of thin vertical teeth along their foot, where the
  side meets the ground or a lower boulder (2025-05-18, 1080p crop of the bottom half). Cause
  **suspected**, not measured: the heightfield grid sampling the steep step at the side's foot, like
  the riser notches above; the 0.198 rock grain didn't change it (the teeth are in the shape, not
  the colour). Check with a 2× grid or `debug.terrainProbe` first.
- A cliff's rounded crest near the camera is smooth and bare: in low light it reads as sand.
- **Wet rock in zebra bands** (2026-05-01, the platform's edge 25–35 m off, blue hour): wavy light
  and dark bands up a wet, sloping rock face. Measured: they are the wet rock's sky reflection
  (`terrain.ts`, `gloss` 0.7–1 on `kind` 3 pixels, final 0→144 as `ny` swings 0.55–0.75; switching
  off `reflection`, `wetMirror`, `props.rockEdge` or recolouring the sea leaves them). Cause
  **suspected**: the reflection reads the env cube at a fixed `textureLod(envMap, R, 2.0)` while wet
  rock is rough (alpha 0.35), so its rippled normal sweeps a sharp mirror of the horizon glow.
- A low platform at a cliff's foot is topped by big waves, which then wash over it as foam: no burst
  against the cliff behind (`edgeRocks` takes only the first face at the water).
- Midday boulder shores render up to ~20% slower than the same day as a beach (a 3×3 cell search in
  every height sample; bench noisy); rocky days overall +8%.
- Seabird mainland colonies and point lighthouses use their beach placement on rocky shores (not
  checked in renders).
- No cliff or ledge shadows on the terrain beyond ~470 m ahead (the land shadow map has props only;
  the near map has the terrain caster).

## Tidal flats and salt marsh (PLAN_BIOMES 9)

- Only ~0.3% of days (the five places are 1.94% of days). More flat places (Severn, Gulf of
  Khambhat, Argentine gulfs, Gulf of Carpentaria) would raise it.
- Behind Wadden marshes stand sea dikes, not hills; the place's plants put conifers and birch behind
  (northern pool), and Mont-Saint-Michel can draw skerries and conifer islands.
- At high tide the flooded flat in front of a marsh beach keeps the open sea's swell displacement
  further out (only surf and run-up are damped; no shelter mask).
- Driftwood logs can be heaped on a marsh beach's marsh (debris storm line), even in treeless bays.
- Seals on sandbanks and waders on the flats (PLAN_BIOMES phase 14) are missing.

## Props

- **Spray as dark square blocks** (seen 2026-11-19 on 2026-05-01, blue hour, round two dolphins at
  ~150 m; on 2026-12-08, night, along the surf): `SprayBuilder` droplets are 1.5–3 px point sprites
  with screen-door alpha, lit only by the average sky (`skyIrradiance`, and the sun as
  `max(sunDirection.y, 0)`, a flat surface's term, not a droplet cloud's). Against water that
  mirrors a bright horizon at grazing they come out darker than the water, in hard squares.
  Whether darker spray is physical there is unchecked (needs photos); the squares are not.

- **Salt (0.199), left over:** (1) no gale browning on the seaward side of crowns (needs a weather
  history: "a gale in the last weeks"); (2) a pruned tree is its mesh scaled shorter and wider, so a
  pruned spruce is a squat cone, not a flat-topped, flagged one; (3) framed shots' hero trees can
  stand 1–2 m from high water (placed by height above `dry` only), so the wedge cuts them to ~5 m and
  the shot loses its framing (2025-05-30, Arctic Canada: four birches 14–18 m → ~5 m). Found by
  `diff.mjs --off '{"props":{"saltShear":false}}'` on real days.
- **2026-05-01:** a sailboat drawn as a bare, steeply tilted mast. Not traced.
- Elephant seals within ~25 m look like smooth boulders (beach herds keep 30 m off); hippos are
  stylised up close (barrel + boxy head).
