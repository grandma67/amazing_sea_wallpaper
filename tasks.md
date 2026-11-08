# Tasks

Open problems and investigations, with steps to solve them (collected 2026-11-08 after 0.135, from
ARCHITECTURE.md "Known issues" and the finished plans). Sizes are estimates. **Decision** = changes
many days or the look: ask before building. Each fix follows CLAUDE.md: numbers before renders,
a switch that gives back the old image exactly (`diff.mjs --ref HEAD --off PATCH --off-here`), real
days in the first round, ≤ 3 render rounds, docs and changelog.

Status: `[ ]` open, `[~]` started, `[x]` done.

---

## A. Cheap checks first (one render or less each)

### A1. [ ] Pale smear on the big island, 2024-05-16
Seen in REFLECTION phase 0 (right edge of the big island, `clear-islands`), there before the
reflection work. Never checked.
1. Render `clear-islands` from `scenes/reflection.json` at 1080p (`snapshot.mjs --w 1920 --h 1080`)
   and look closer with `diff.mjs --a DIR --b DIR --zoom-at X,Y` on the island's right edge
   (positions from `params.mjs --scene … --project islands --above 20`).
2. Switch suspects off one at a time on that spec: `passes.aerial`, `passes.clouds`,
   `passes.reflection`, `props.islands` spray (`props.surf`?), `passes.skyFill`. One `diff.mjs --off`
   per pass; the one that removes it names the cause.
3. Probe the smear and the rock beside it (`{world}` points) to see if it's added light or alpha.
4. Fix in that pass; record in Known issues (measured), or close as intended.
**Size:** ½ session.

### A2. [ ] Sparkly dots in the air over the sea, 2026-02-13
1. `node scripts/snapshot.mjs --w 1920 --h 1080 2026-02-13`; read the frame, then
   `diff.mjs --zoom-at` on a cluster (compare with `--frames 1` vs 16: do they average out?).
2. `params.mjs --each 'p => JSON.stringify({w: p.weather, storm: p.storm, fog: p.fog, rain: p.storm?.rain, spray: …})' 2026-02-13`
   for what's in the air that day.
3. Switch candidates off one by one (`passes.clouds`, `passes.bloom`, storm/rain spec fields, spray
   props, `passes.stars` if dusk). The pass whose switch removes them is the cause.
4. Fix; add the date to a scene file as a regression spec.
**Size:** ½ session.

### A3. [ ] Sailboat drawn as a bare, steeply tilted mast, 2026-05-01
1. `params.mjs --project ships --rows 5 2026-05-01`: which kind, where, how far.
2. `scripts/mesh.mjs` on that ship kind at real size (sails present? which seed?).
3. Check the roll/heel (`ships.ts` roll resonance, wind heel) for that day's wind and the boat's
   size: a steep tilt points at heel × roll overflow, missing sails at a sail-state choice.
4. Fix, add a `meshes.test.ts`/`ships` test (heel bounded, sails present when sailing).
**Size:** ½ session.

### A4. [ ] Calm sea just under the horizon: 0.62–0.77 of F × sky within 1°
Measured with `horizon.mjs` (2003-03-11 broken, calm); ~1 at 2°. Cause suspected: the swell's
tilt, or the probe box mixing pixels at the horizon line.
1. Rerun `horizon.mjs` with `swellHeight: 0.01` and with `"probeHalf": 0` (edit the script's
   probeHalf or pass a spec patch): if the ratio goes to ~1 without swell, it's physical (facets
   toward darker sky): close as intended. If only `probeHalf: 0` fixes it, it's the measurement.
2. If neither: check the sea's `lod` at grazing (`log2(alpha·164)` with the 0.02 floor → lod ~1.7,
   blurring the steep horizon gradient) with `cubeProbe` at lod 1.7 vs 0.
3. Record the finding in Known issues as measured.
**Size:** ½ session.

### A5. [ ] Cube 1.3× the frame's sky at +4° under broken cloud
Measured (`cubeProbe`), 2003-03-11 broken; equal at ≤ 1°. Cause suspected: the cube's clouds at
`medium` quality and fewer frames (`renderCloudyEnvironment`, `envFrames`).
1. Temporarily set the cube's `qualityPreset` to `high` and `envFrames` = the main frame's; rerun
   `horizon.mjs`: if cube/sky → 1, it's quality.
2. If it is: measure the cost (`bench.mjs`); if > 2%, try only more frames, or accept and record.
3. Check a second cloudy day (overcast) before deciding.
**Size:** ½ session.

---

## B. Decisions to make (ask before building)

### B1. [ ] Decision: takram's haze fades land as (1 − T)², not (1 − T)
Measured with `haze.mjs` (2003-03-11 islands at 2.8 and 7.5 km). Mid-distance land is darker than
real haze leaves it; the sea's mirror images copy it (`MIRROR_GLSL` `hazeMirror`).
1. Measure how much it matters: `haze.mjs` on 3–4 days (clear-dust, broken, overcast, a 30+ km
   mountain): the colour difference between the two weightings at 3, 10, 30 km.
2. Find reference photos of hazy islands at known distance (2–3) and compare the contrast.
3. **Decide** (397 of 456 far-object days change). If yes: patch the clouds pass (`seaHaze.ts`
   `applySeaHaze`, the `HORIZON_INSCATTER` replacement) to mix by opacity once, switch `seaHazeLinear`,
   and change `hazeMirror` to (1 − T) under the same switch. `haze.mjs` must then show (1 − T)
   giving one haze colour.
**Size:** 1 session after the decision.

### B2. [ ] Decision: night frames' colour
From SHADOWS phase 6: the night white balance (gains 0.67, 1.02, 1.77) turns moonlit white sand deep
blue (B/R 2.3, should be near neutral at ~4000 K vs moonlight ~4100 K); a starlit cloud deck is lit
blue (the stand-in sun's colour), not airglow green; birds stay sharp in 30–130 s exposures.
1. Reference photos: moonlit beach long exposures (2–3), a starlit cloud deck.
2. **Decide** (touches all nights). Then, each with its own switch:
   - white balance: compute gains from the moon's real spectrum vs a 4000 K camera; probe the sand;
   - cloud deck: tint the stand-in sun by airglow on starlit nights;
   - birds: hide or blur them past ~5 s of shutter (`frameMeter` shutter is known).
**Size:** 1–2 sessions.

### B3. [ ] Decision: beach cameras standing in the water (12 of 433 beach days)
The coast's wobble at a = 0 shifts shoreline/along-beach cameras (rock shores and flats correct it
with `wobbleAtCamera`). Fix reframes about half of all beach days.
1. **Decide.** If yes: apply `wobbleAtCamera` to beach placement in `generateCoast`, keep the drawn
   distance.
2. `expectDryCameras` over all beach days must pass; `params.mjs --ref HEAD --rendered --stats`
   for how many frames move.
**Size:** ½ session after the decision.

### B4. [ ] Decision: beach-state shares vs Australia's census
Transverse bar–rip under-drawn, longshore and dissipative over-drawn; a retune is proposed in
COASTS.md "Beach state and tides". Changes every beach day.
1. **Decide.** Then apply the proposed table, `params.mjs --ref HEAD --stats 'p => p.coast.state'`,
   `realDays.test.ts` shares, a contact sheet of the states.
**Size:** ½ session after the decision.

### B5. [ ] Decision: run-up by beach state (Stockdon)
Flat dissipative beaches get a ~35 m wet band and storm lines up to ~120 m inland; steep gravel ~1 m.
1. Research: Stockdon et al. 2006 (run-up ∝ slope·√(H0 L0) on steep beaches, ∝ √(H0 L0) on flat);
   encode as a function of `beachSlope`, swell height and period.
2. **Decide** (re-tunes wrack lines on every beach). Then `profile.mjs` on Namibia 2024-06-11 and a
   gravel day before/after; update `beachLines` and the debris/wrack placement.
**Size:** 1 session.

### B6. [ ] Decision: waterspouts (plans/WATERSPOUT_FOG.md)
A spout can appear inside fog (chosen before `pickFog`), and spouts are ~1 in 3 years, not the
documented ~0.5%.
1. Fog: choose the waterspout after `pickFog`; drop fog when a spec forces a spout; a test.
2. **Decide** the rate: option A (2–5 a year, raise peak-month chances, recommended) or B (keep,
   fix the docs). Test the real rate over `allParams()`.
**Size:** ½ session.

---

## C. Reflection follow-ups (plans/REFLECTION.md)

### C1. [ ] Find and render a rock pool beside a boulder (phase 5's unmet check)
Follow `knowledge/plans/WATER_VIEW.md`:
1. `terrainView: 'water'` (swash blue, pools cyan, damp sand green, brightness = mirror weight).
2. Counts in the render's JSON (`debug.water`: pixels per film kind, nearest pool in m).
3. `snapshot.mjs --where 'p => p.coast.rock' --sample 30` + `summary.mjs … nearestPoolM` → a near-pool
   day; add it to `scenes/wet-mirror.json`; judge against photo P (Urvaig rock pool).
**Size:** 1 session.

### C2. [ ] Sun glitter width on windy days vs Cox–Munk (phase 1, judged by eye only)
1. Pick a 10 m/s day with the sun ~20° up in front (`params.mjs --where … --sample`).
2. Predict the glitter's angular width: ±2σ of slope (Cox–Munk σ² = 0.003 + 0.00512·U) around the
   sun's mirror point, as elevation below the horizon.
3. `params.debug.probeLine` down the glitter column (az of the sun, el range); find where it falls
   to ~e⁻² of its peak; compare.
4. Off by > 20%: trace the ripple layers' slope scale (`rippleSlopeScale`) on that day.
**Size:** ½ session.

### C3. [ ] Far islands' mirror images slightly off-colour (red −14…−20%, blue +5…+9%)
Measured (world/mirror probes, `calm-islands`, 0.135). The image fades toward the sky the ray
mirrors, which is bluer than takram's haze colour (clear sky at +0.02 rad × `hazeLight` ×
`hazeTint`).
1. `haze.mjs` gives the frame's haze colour H per point; compare with `cubeProbe` at the mirrored
   ray's direction.
2. Try fading toward the cube at +0.02 rad in the ray's azimuth, sharp (lod 0), × `hazeLight` only on
   days the cube *isn't* drawn through the haze (clear, no dust). Re-measure both islands.
3. Keep the volcano case (T ≈ 0.01) vanishing into the sea: no bright patch (phase 4's ovals).
**Size:** ½–1 session.

### C4. [ ] Lightning in the swash film is speckled
Measured (2025-04-25, storm on/off). The film's blur is sized from the mirror depth at the unshifted
point (trees tens of m away), not the bolt km away.
1. In `mirrorAlongRay`, size the blur from `hazeT` (the depth where the ray lands) instead of `t`
   (the unshifted point's), or the larger of the two; under a switch.
2. Check it doesn't soften contact lines (`near-objects-calm`, `swash-rocks`) with `--zoom-at`.
**Size:** ½ session; storm days with a bolt in frame only, so low priority.

### C5. [ ] Far land mirrored about a flat plane, not the curved sea
82 m of curvature drop at 34 km: the mirror plane is y = 0. Judged invisible so far.
1. Only if a mountain-calm render shows a gap or misplacement at the waterline: mirror about the
   local sea height (`drop` at the hit's distance) in the lookup. Otherwise close.
**Size:** check ¼ session.

### C6. [ ] Features from REFLECTION "Later" (each needs its own plan)
- Calm in the lee of islands and headlands (§1.4: 7–15× the obstacle height downwind): a
  wind-shadow mask beside `shelter.ts`, damping short waves → mirror patches behind islands.
- Natural slicks: glassy surfactant bands on light-wind days.
- Mirroring ice: thin new ice and melt ponds (photo F; today the sea ice is matte).
- Whitecap coverage vs Monahan & O'Muircheartaigh 1980 (W = 3.84·10⁻⁶ U^3.41: 1% at 10 m/s).

---

## D. Bugs and gaps by area (from Known issues)

### D1. [ ] Lighthouses
- 14 of 92 lighthouse days say "lighthouse" but build none (`2024-05-13`). Steps: make the title read
  what `createLighthouse` placed (or widen the site search); a `realDays.test.ts` rule "title says
  lighthouse ⇒ one is built".
- Beam power has no candela: compute `beamScale` from a real lamp (10⁵–10⁶ cd) in the sky's units
  before tuning the glow (`2024-07-24`, `2015-02-22`, the fog spec in Known issues).
**Size:** ½ + ½ session.

### D2. [ ] Surf and bars
- Waves re-form at full height behind sandbars: decay broken waves toward ~0.4 × depth (Dally et al.
  1985), or extend the shelter mask to bars. **Decision** (every barred day).
- Longshore bars have no trough (OzCoasts: 2–3 m behind the bar, ours ~1 m): add a trough to the
  bare profile; `profile.mjs` before/after.
- Emerged rip channels at low tide look like straight shelves (`scenes/tides.json` brittany-low):
  soften their edges above the water.
- The reef's shelter is a straight line (no swell through a pass into the lagoon): basins or a
  shelter gap at the pass.
- Reef crest foam is a timed band, not breaking waves; it fades into a low sun's glare.
**Size:** ½–1 session each.

### D3. [ ] Rocky shores
- No cliff or ledge shadows on the terrain itself (lighting by normal only): add the terrain to the
  shadow pass's receivers or ray-march the height field toward the sun.
- Small dark notches on near bed risers (grid aliasing): `terrainGrid: 2` halves them; try
  denser rings near the camera only.
- A cliff's smooth crest reads as sand in low light: rock texture on the crest.
- A low platform at a cliff's foot gets no burst against the cliff behind (`edgeRocks` takes the
  first face only).
- Boulder shores render up to ~20% slower (3×3 cell search per height sample): cache or narrow it.
- Colonies and point lighthouses use beach placement on rocky shores: check in renders.
**Size:** ½–1 session each.

### D4. [ ] Light
- Brittany sand reads less red than albedo × skylight predicts (raw 0.0069, 0.0076, 0.0112 vs
  ~0.012 each; `place: "brittany"`, 2025-07-10, along-beach, broken): probe the sand and the sky
  light; trace which term greys it.
- Meter zenith reads ~3× the cube's zenith (0.074 vs 0.023 at sun 60°): compare with `cubeProbe` at
  el 90; decide which is right.
**Size:** ½ session each.

### D5. [ ] Sky
- 2016-08-09: the title's 36 km mountain range is invisible even with `fog: null` (3° sun): probe it
  with `haze.mjs`; if haze erases it, the title should not name it.
- Backlit sunset shelf cloud is a flat pink band (2010-04-01): takram's aerial perspective on the
  mesh; check the shelf's own lighting and the overlay.
- Night sky units (NIGHT_SKY phase 3): no airglow background, so thin-crescent skies are too dark;
  a lunar eclipse doesn't dim the drawn sky; starlit skies are Rayleigh blue.
- Light pollution: low clouds not lit from below by towns.
- Aurora: barely shows on clouds on quiet starlit nights (the stand-in sun outweighs it); ~3% grain
  at the arcs' lower edge on Kp ≥ 5.
**Size:** ½–1 session each.

### D6. [ ] Content and places
- Landforms and islands chosen by biome, not place (Norway draws a volcano on ~6% of landform days):
  a per-place landform table (PLAN_BIOMES phase 10).
- Drawn snow lines: tropical mountains get snow below 3 km (32 of 61 tropical landform days); nordic
  summer lines low. Key the snow line by latitude and month, not biome.
- Seasons: no leaves in the wrack, no larch, no tropical wet/dry seasons; the distant woods' autumn
  tint never checked in a render.
- Snow: limits in plans/SNOW.md (a foot's end beside a very close camera, plain white far low land, no
  falling snow).
- Live oak, slash pine, cabbage palm, saw palmetto reuse generic meshes.
- Tidal flats only ~0.3% of days: add Severn, Gulf of Khambhat, Argentine gulfs, Gulf of Carpentaria.
- Wadden marshes: sea dikes, not hills, behind; conifers and birch don't belong; MSM draws skerries.
- Flooded flat in front of a marsh beach keeps the open sea's swell (no shelter mask).
- Driftwood heaped on marsh in treeless bays.
- Seals on sandbanks, waders on flats (phase 14 animals).
- Iceland: volcanic biome gives it palms; its basalt cobbles render brown.
- Elephant seals within ~25 m look like boulders; hippos stylised up close.
**Size:** each its own small job; several need research first.

### D7. [ ] Stony beaches
Shingle reads as flat mottled colour at 1080p past ~10 m; `framed` never has stones in the
foreground. Consider a framing that stands on the shingle, or larger near-field stone meshes.
**Size:** ½ session to decide.
