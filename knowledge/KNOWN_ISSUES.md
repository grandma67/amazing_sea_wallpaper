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
  along-beach, daylight, `weather: "broken"`, sun 160°) meters 0.108 and isn't lifted. (Its "less
  red" sand was closed 2026-11-21: the camera moved in 0.200–0.202; at HEAD the dry sand in cloud
  shadow reads raw 0.0142, 0.0143, 0.0163 against ~0.012 predicted, and 0.090, 0.060, 0.040 with
  `passes.cloudShade` off; the old probe was on wet sand.)
- **Exposure re-tuned by class medians** (0.231, D11): the meter reads the sky in frame now; the
  per-time-of-day corrections (`scene.ts` `meterAimBias`) hold each class's median exposure over
  72 + 12 real days, so a class's typical brightness was tuned on the old whole-cube meter and only
  the spread is new (dusk facing the glow up to ~1.7 EV darker than before, facing away up to
  ~2.7 brighter). Not yet compared with photos per class.
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
- **Lighthouses** (found 2026-11-07; the lit glazing is glass since 0.221): every lighthouse day builds one since 0.210 (15 of 92 found
  no site when the horizon sat above the frame's middle). Since 0.196 the
  lamp is 10⁶ cd (the whiteouts of `2025-08-21`, `2024-11-30`, the veil of `2015-02-22` are gone).
  Left, judged by eye on renders, not measured: the forced rock light in night fog
  (`{"date":"2025-07-10","timeOfDay":"night","lighthouse":"rock","fog":"advection"}`) keeps a large
  forward-scattered halo (real round a bright lamp in fog, its size unchecked against a photo); the
  divergence stays 2.2° (e-fold half-width; Sabik's LED beacon is 1.5° full width at 5%, classic lenses wider).
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
- **Shelf cloud** (volumetric since 0.174): on far real days (2024-06-21, 2024-04-24, 2024-07-01,
  2024-12-12, 2025-02-12) it reads as a dark strip on the horizon with a ruler-straight top.
  Measured on 2024-06-21 (`edges.mjs`, shelf on and off): the strip is the storm's rain region, as
  dark with the shelf off; its top is the lip (1.2 px sharp, 4 px from the CPU's prediction); the
  face is 1.09× the deck. Since 0.223 the lip is tattered (fringes ≤ 57 m deep, 12–80 m wide);
  on a far shelf (~15 km, 2024-06-21) the fringed top of the strip may read as a distant treeline
  (judged fine by eye, no far-arcus photo to compare). A backlit sunset shelf may still read as a flat pink band (2010-04-01; not re-checked
  since the volumetric shelf).
- **Night storms** (0.189; re-measured 2026-11-20): the flat bands of 2026-08-20 and 2026-03-27
  are the **shelf cloud**, not the Cb's base (`shelfCloud: false` removes them; `cloudFace` puts the
  face at a constant ~6.3 km, 340–560 m up: the shelf's face, below the 600 m base). Since 0.222 the
  flash lights it (`passes.flashShelf`); the lip is tattered since 0.223; left: the town dome's brown strip under it. Also: **scud in front of a
  bolt stays unlit** (2026-08-20, left bolt 6.3 km: the rays over its exit meet scud at ~380 m,
  5.4–5.8 km out, below the base, which the flash's face rule skips), so that bolt lights no
  visible cloud; measured with `cloudFace` probes.
- **Aurora** (`aurora.ts`): on quiet starlit nights its light on clouds barely shows: the clouds
  pass's stand-in sun (`scene.ts` `starlight`, nearly overhead, a sun's strength in the night's
  units) outweighs the display's physical light on cloud tops (fix the stand-in, diffuse
  ~0.002 lux; touches every cloudy starlit night). The airglow's wave crests (`nightGlow.ts` bands)
  show more on aurora nights (+1.5 EV, a wider, higher frame) as faint slanted stripes low in the
  sky: the airglow's, not the aurora's (`passes.aurora: false` keeps them; the mirror predicts
  them: `params.mjs --line --sky glow`). The 5 km N₂⁺ fringe (a single-layer feature in the march)
  leaves ~3% grain at the arcs' lower edge on Kp ≥ 5 nights.
- **The sea near the horizon** (measured with `horizon.mjs`, 2003-03-11 broken, calm sea; causes
  measured 2026-11-21): sea / (F × sky) is 0.62–0.77 within 1° of the horizon (1.0 expected on
  calm water) and ~1 at 2°. Not the swell (0.01 m: same) nor the probe box (`--half 0`: same).
  Two causes: (1) **Fresnel at the face-the-viewer normal**: `ocean.ts` takes `F = fresnel(NoV)`
  after lifting N so NoV ≥ ~0.05, so F ≈ 0.78 within ~3° of grazing (0.92–0.97 there); with F from
  the sky ray's own normal (`skyNormal`, tried and reverted) 0.3° reads 0.76 instead of 0.62, and
  with `passes.seaHaze` off the sea matches the cube (3.69 vs 3.95 × sky; the rest is the lod-1.7
  blur). (2) **The (1 − T)² sea haze** (above) takes the rest: raw 0.135 → hazed 0.109 at 0.3°.
  Fixing (1) brightens every sea within ~3° of the horizon ~20%: a decision.
- **The sky cube's clouds are too bright higher up** (measured 2026-11-21): cube / frame sky at
  +4° is 1.32 (broken) and 1.35 (overcast), 1.76 at +8° overcast; 1.0 at ≤ 1°. Cause: the cube's
  `medium` preset has no `lightShafts` (takram's cloud-shadowed inscatter), and the shafts need
  the main frame's frame count to converge: shafts + full frames give 1.08 / 1.21 (+4° / +8°),
  `high` + full frames 1.05 / 1.09; shafts alone 1.25, full frames alone 1.33,
  `accurateSunSkyLight` + 3 ground steps 1.31, turbulence + 1e-5 densities 1.36 (each tried and
  reverted). `high` + full frames costs +40–61% on cloudy days (`bench.mjs`) and darkens the sea
  (2024-04-24: 33% of pixels, mean Δ 30): too dear as is; a cheaper shafts-only cube is open.

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
  broadleaf is as sparse.

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
  wash band carries the rough-sea look. All islands of a day share one wash-band material. How
  near bergs come (`params.mjs --find ice`, 2026-11-21): 5 real days within ~120 m (2025-09-01
  46 m, 2025-05-22 75 m, 2024-11-11 97 m, 2024-03-31 106 m, 2026-08-22 116 m), 64–75 px.
- **Tidepools** are runnels and puddles on the terrace (shader patches), not pools among rocks. A
  rock pool within ~15 m beside a boulder hasn't been rendered yet (plans/WATER_VIEW.md).
- **Stony beaches:** shingle reads as a flat mottled colour on most 1080p views (a 2–5 cm pebble is
  under a pixel past ~10 m at eye height; the nearest ground is often 20–40 m); `framed` stands
  15–60 m inland behind the plants, so it never has stones in the foreground.

## Rocky shores (PLAN_BIOMES 8)

- Near bed risers on a platform seen along the shore (10–40 m) can show a row of small dark notches
  (grid aliasing: a 2× grid halves them). The far scarp and cliff saws were fixed by the view-wedge
  grid (0.76).
- (0.227) The teeth and saw along near boulders' feet are fixed: a boulder's side met the ground
  vertically (a sphere's rim); its foot now comes down over ≥ `ROCK_MIN_FACE` × distance.
  Measured: `terrainProbe` along a row showed neighbours at the same height alternating ny 0.98 /
  0.25 (the true height's normal on a triangle the grid drew on the side); 0.226's triangle-normal
  shading hid that but left dark specks and striped platform risers, and is gone.
- A cliff's rounded crest near the camera is smooth and bare: in low light it reads as sand.
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

- **Sea stacks' top** (`stacks-shoreline`, 2025-07-10 Brittany, 657 m): the stack's top reads as a
  pale see-through triangle against the land behind (seen 2026-11-21; not traced).
- **Night surf in blue 2×2 blocks on lighthouse nights** (2026-12-08; found 2026-11-20, was filed as
  spray, D37): `passes.reflection` off removes them, `softSpray` and the spray don't touch them, and
  `lighthouse: null` takes the planar mirror away with them. On rough surf facets the water flips,
  texel by texel of the half-size mirror, between the mirror's sky (brown-orange there) and the sky
  cube's (blue, the starlit stand-in). Why the mirror's night sky is brown and the cube's blue is
  not traced (both sky materials get the night glow, `scene.ts`): next, `{mirror}` probes and
  `debug.cubeProbe` at the same direction.

- **Salt (0.199), left over:** (1) no gale browning on the seaward side of crowns (needs a weather
  history: "a gale in the last weeks"); (2) a pruned tree is its mesh scaled shorter and wider, so a
  pruned spruce is a squat cone, not a flat-topped, flagged one. (Framed shots' hero trees cut to
  stumps: fixed in 0.220, tender trees don't stand in the spray.) Found by
  `diff.mjs --off '{"props":{"saltShear":false}}'` on real days. Tree salt tolerances are mostly
  estimates (`treeSaltTolerance`): holm oak, stone pine, Sitka and Norway spruce, birch, olive,
  cypress, umbrella thorn, gums, southern beech.
- Elephant seals within ~25 m look like smooth boulders (beach herds keep 30 m off); hippos are
  stylised up close (barrel + boxy head).
