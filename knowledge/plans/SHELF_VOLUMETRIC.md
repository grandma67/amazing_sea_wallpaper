# Shelf cloud in the volumetric clouds

**Status: done (phases 0–6, 0.173–0.179, 2026-11-14).** Phase 7 (the roll cloud) and "Later" are open. Replaces the shelf cloud's mesh
(`props/cloudEvents.ts` `shelfGeometry`, last tuned in 0.172) with cloud drawn by takram's
volumetric clouds, through a shader patch like `stormCells.ts`. Then the Morning Glory roll cloud
can follow (phase 7).

## Read first

Before phase 0, open (not grep):
- `src/stormCells.ts`: the patch this plan copies (the two hook points, the guard, the uv → metres
  matrix);
- `src/clouds.ts` `createClouds`: the layer list, the patch calls, and the reflection cube's build
  (line ~285);
- takram's `node_modules/@takram/three-clouds/src/shaders/clouds.glsl`: `sampleWeather` and
  `sampleMedia`, and the march loop in `clouds.frag` (~line 480);
- `src/props/cloudEvents.ts` as of commit `c8d65df`: the 0.172 mesh, whose shape numbers this
  plan reuses, and which phase 6 deletes;
- `src/skyEvents.ts` `shelfCloudFor`, and `params.ts` where it's called (~line 1998);
- LESSONS.md "takram sky, clouds, post" and "Storms and sky objects"; arch/SKY.md; TOOLS.md
  "Gotchas"; tools/DEBUG.md "The pixel probe" and "Lines of pixels".

## Why

A mesh can't look like cloud here. 0.172 got its brightness and hue right by measurement, but
after three render rounds it still reads as a smooth band:
- its edges are hard where the deck's are soft;
- it's lit like a solid object (it needed a hand-cut sky light, `SHELF_SKY_OPEN`);
- at sunset it turns into a flat pink band (2010-04-01, ARCHITECTURE "Known issues");
- on telephoto days it shows straight bands from edge to edge (2005-01-28, 2006-06-26).

In 0.27 the shelf became a mesh because the clouds had no way to put a shape in one place. Each
layer is a flat shell with one base and thickness, filled by a 2D weather map. `stormCells.ts`
(0.34) has since shown the way: patch takram's `sampleWeather` and set density by position.

## What the research says (what to match)

Sources read: [Wikipedia: Arcus cloud](https://en.wikipedia.org/wiki/Arcus_cloud);
[weather.com, Chicago shelf cloud 2016-09-21](https://weather.com/science/weather-explainers/news/chicago-shelf-cloud-thunderstorms-sep212016);
[The Weather Network: shelf clouds](https://www.theweathernetwork.com/en/news/weather/severe/shelf-clouds).
Known only from search summaries, not read in full: NWS spotter handouts ("can move well ahead
of the precipitation"; [Louisville: shelf vs wall cloud](https://www.weather.gov/lmk/shelfcloudversusawallcloud)),
and cold-pool depths from [a review of gust-front studies](https://rain.as.ntu.edu.tw/material/report_slides/20210511.pdf)
citing Goff 1976, *Mon. Wea. Rev.* 104, 1429–1440.

**Reference photos** (Wikimedia Commons, listed in CLOUDS.md "Shelf cloud"):
- **A**, "Shelf Cloud Piracicaba 29-01-2024.jpg": backlit, dark face, top lost in the deck;
- **B**, "Arcus clouds at yellow-white sunset.jpg": front-lit, billowy tiers;
- **C**, "Shelf cloud forming.jpg": a wide arc of striated layers.

- **Shape.** A low, horizontal, wedge-shaped arcus attached to the base of its cumulonimbus. It
  lies on the gust front, where the storm's cold outflow lifts the warm air ahead of it. It
  slopes down and away from the rain.
- **Texture.** The face and the cloud above it are smooth (laminar), often in stacked tiers with
  fine striations. The leading edge rises. The underside is turbulent and torn, with ragged scud
  hanging from it in strong gust fronts. Behind the lip comes the "whale's mouth": a dark,
  churning base, then the rain.
- **Where it stands.** It leads the storm ("can move well ahead of the precipitation", NWS);
  in the Chicago case the gust front was about 8 km (5 mi) ahead of the line. The rain follows
  minutes after the shelf passes.
- **Height.** No source gives a typical lip height. The cold pool is 0.1–4 km deep, typically
  0.5–2 km (gust-front review; Goff's own mean 360 m). So keep today's lip of 220–400 m under a
  600 m Cb base; it stays an estimate.
- **Light** (photos): with the sun behind the storm, the face is dark blue-grey, about as bright
  as the deck. Front-lit, it's bright and billowy, and changes along the front.

## Where the code stands (checked 2026-11-14)

| Claim | Checked with | Answer |
|---|---|---|
| takram's `sampleWeather` knows each sample's height | `node_modules/@takram/three-clouds/src/shaders/clouds.glsl` (v0.7.6) | `sampleWeather(uv, height, mipLevel)` returns `density` per layer; `stormCells.ts` already patches it in two places (`SAMPLE_END`, after the weather texture is read, and `RETURN`) |
| How a layer is addressed in the shader | `clouds.glsl`, `stormCells.ts` line 108 | `localWeather`, `weather.density`, `heightFraction` and `shadowLayerMask` are vec4s **indexed by layer** (`'xyzw'[layerIndex]`), not by the texture channel. The channel only picks which colour of the weather texture a layer reads |
| Density written into `localWeather` gets thinned | `sampleWeather` | yes: `localWeather` then goes through the coverage remap (`factor = 1 − coverage × heightScale`), so a value set there is cut on days with coverage < 1. A density meant as-is must be written to `weather.density` just before `return` |
| takram copes with an extra layer overlapping the Cb | `CloudLayers.ts` `packIntervalHeights` | yes: the gaps it skips are found by counting open layers, so overlapping layers merge into one span |
| A free weather channel on shelf days | `params.mjs --where 'p => p.storm?.shelf != null' --stats` formations | 197 shelf days (2005–2026), at most 3 layers (Cb r, cirrus-spissatus b, altostratus g; scud is removed on shelf days): **the texture channel `a` is always free, and so is a 4th layer** (`MAX_LAYERS` = 4). The shelf's layer index is `formations.length` (1, 2 or 3) |
| The shadow pass and the reflection cube get the patch too | `stormCells.ts` patches `cloudsPass` and `shadowPass`; `clouds.ts:285` builds the cube's clouds with the same `createClouds` | yes: one patch in `createClouds` covers the frame, the shadow map and the water's sky |
| The march resolves a lip a few tens of metres sharp | takram `qualityPresets.ts` defaults (preset `high`) | steps start at 50 m and grow ×1.01 a step (max 1000 m once mip > 1); at 4–8 km the mip is ~0, so steps are ~60–130 m along a ray. Vertically that's a few metres at 3–5° up. **Not proven; phase 3 measures it** |
| uv → metres is linear enough over ±40 km | phase 1 test: latitudes 0–78°, four azimuths, 10–40 km along the front | **no.** At latitude 45° (longitude 0, where every scene is anchored) the front crosses a cube edge of takram's cube-sphere uv, and the linear map put a point ~90° off as seen from the camera. **Use the sample's own position instead:** every `sampleWeather` call (`clouds.frag` 368 and 510, `shadow.frag` 88) comes right after `vec2 uv = getGlobeUv(position);`, and `ecefToWorldMatrix` and `altitudeCorrection` are declared (`parameters.glsl`) before `clouds.glsl`. So `world = ecefToWorldMatrix · (position − altitudeCorrection)` is exact. (`stormCells.ts` still uses the uv map; its cells are ≤ 9 km, but a cell near a cube edge would be distorted the same way. Not checked.) |
| Noise that matches in TS and GLSL | `skyMirror.ts` | `hashCell(seed, x, y)` and `hashGlsl(prefix)` give the same integer-cell hash on both sides. It's a hash, not noise: build value noise from it (smoothstep between cell hashes) on both sides |
| The clouds are hazed with distance | DEBUG.md: clouds are composited in the aerial-perspective pass | yes: the shelf gets the same haze and sunset colour as the deck (fixes the pink band) |
| Placement: the rain is behind the lip | `params.mjs … --stats`: the nearest curtain or bolt within ±45° of the shelf's azimuth vs `shelf.distanceM` | **wrong on 112 of 197 days (57%)**: a curtain or bolt in the shelf's direction is nearer than the lip, while it should be behind it. On the other 85, every curtain and bolt in the sector is behind the lip, and every day has at least one in the sector |
| Times of day on shelf days | `--stats 'p => p.timeOfDay'` | golden hour 62, daylight 50, midday 36, sun on horizon 29, blue hour 20 |
| Storm days in all | `--stats` | 528 of 8035 (6.6%); shelf on 197 (37% of storms) |

## Design

- **One more cloud layer, only on shelf days:** `createClouds` appends a layer after today's
  formations (index `formations.length`, texture channel `a`).
  Altitude 100 m, top at the Cb base + 300 m, so the shelf merges into the deck. Constant density
  profile (`constantTerm` 1), low `shapeAmount` (~0.3: smooth, laminar), `shapeDetailAmount` ~0.6
  (the torn underside comes from takram's own "whippy at the bottom" detail), `densityScale` like
  the Cb (0.3), shadow on. Nothing is added on other days, so their images stay identical.
- **Density by position** (`shelfDensity`, GLSL with a TS mirror): from the sample's uv to local
  metres, to (`across`, `back`), meaning along the front and toward the storm, plus the height.
  It returns 0–1 and is written to `weather.density[index]` just before `return`, so takram's
  coverage remap doesn't touch it. takram's shape noise (`shapeAmount`) and detail still break
  it up in `sampleMedia`. The cross-section:
  - the **lip** at `lipHeightM`, the front edge, scalloped along the front;
  - the **face** sloping back as it rises, set back in `tiers` steps that drift and fade along
    the front;
  - the **underside** rising from the lip into the storm over `depthM`;
  - **striations**: thin density bands following the lip.

  The edges are smoothsteps a few tens of metres wide. The bow and scallops follow the 0.172 mesh
  (`shelfGeometry` in commit `c8d65df`: a 1500 m bow over ±40 km).
- **The deck above it:** the shelf hangs from its storm. The same patch raises the Cb layer's
  `localWeather` to full over a band from the lip to `depthM` back (at `SAMPLE_END`, as
  `stormCells` does for its discs), so the shelf never meets a gap in the deck. The dark,
  churning base behind the lip (the whale's mouth) comes from that full Cb weather.
- **Placement fixed in `params.ts`** (as built in phase 0): the shelf keeps its drawn distance
  (3.5–8 km). Within ±45° of its direction, rain shafts move back to at least the lip + a lead of
  1.5–5 km (an estimate around the one measured case, 8 km), and bolts to at least the lip +
  500 m. Bolts come from the storm's line just behind the gust front, and a whole lead pushed
  the nearest bolt past 9 km on 43% of shelf days, where LESSONS says they wash out. The
  shelf's chance (40% of storms) is drawn before any of this, so it doesn't change.
- **Off switch while building:** `params.debug.passes.shelfVolume: false` draws the 0.172 mesh
  instead (add it to the `passes` row in tools/DEBUG.md while it exists). Phase 6 deletes the mesh;
  after that `shelfCloud: false` is the before/after switch.
- **Code layout:** `src/shelfCloud.ts` holds the frame, `shelfDensity` (TS), its GLSL string and
  `patchShelfCloud`. Choices stay in `skyEvents.ts` and `params.ts`.

## Phases

Each phase is one commit. Real days for every render round: **2016-06-21** (backlit, 5.8 km),
**2005-01-28** (telephoto, midday), **2005-09-07** (golden hour, Arctic), **2006-06-26** (wide,
bolts), **2010-04-01** (sun on the horizon: the pink band). Add a front-lit spec on 2016-06-21
(`"sunAzimuthDeg": 120`). Phase 0 changes where the shelf stands, so phases 3–5 use the dates as
they are after it. After phase 0, run `snapshot.mjs … --props shelf-cloud` on the five dates; if a
shelf has left the frame, replace that date with another from
`params.mjs --where 'p => p.storm?.shelf != null' --each …` of the same kind (time of day, lens),
and update this list.

### 0. The rain behind the lip (params only) ✅ 0.173
As built: `skyEvents.ts` `placeShelf` (stream `'shelf-lead'`), called after `shelfCloudFor`.
- **The plan's first rule failed by numbers.** Setting the lip from the nearest rain minus a
  2–8 km lead put 86% of lips on the 3 km clamp, because rain in the sector is mostly 3–7 km
  out. Pushing bolts back by the whole lead sent the nearest bolt past 9 km on 43% of shelf
  days. The rule above (Design) keeps both distributions.
- Results: 163 of 8035 days change (2005–2026), `storm` fields only. Bolts within 9 km in the
  sector: 138 of 197 shelf days, the same as before. Test: `test/skyEvents.test.ts` "stands the
  shelf ahead of the rain".
- Rendered on the five days: the shelf is still in frame on all of them. **Bolts still draw over
  the mesh** even though they stand behind it (2006-06-26); not traced. Check this again with
  the volumetric shelf in phase 2.

### 1. The shelf's density, in TS ✅
As built: `src/shelfCloud.ts` has `SHELF_SHAPE` (every constant, for the GLSL), `shelfFrame`,
`shelfDensity(frame, shelf, base, x, z, heightM)` and `valueNoise1` (value noise on
`skyMirror.ts` `hashCell`). Tests (`test/shelfCloud.test.ts`):
- the wedge is empty in front of the lip, below it, above the top, off its ends and past its
  back, and full just behind the lip;
- the lip is within ±15% of `lipHeightM` all along the front;
- the face stands farther back at each higher height. Tiers come in phase 4, and get their
  own test there.

The cross-section it prints (lip 293 m, base 600 m; columns 0 to 4000 m behind the lip): lowest
and in front at the lip, the face receding as it rises, the underside climbing into the storm,
the top merging into the deck at ~900 m.

The uv → metres test failed at a cube edge (see "Where the code stands"), so the patch reads the
sample's position instead and there's no uv helper.

### 2. The shader patch, a plain wedge ✅ 0.174
As built: `shelfCloud.ts` `shelfLayer`, `shelfGlsl`, `patchShelfCloud`; `clouds.ts` `createClouds`
and `renderCloudyEnvironment` take a `ShelfSky`; `scene.ts` builds it (frame from the main camera)
when `passes.shelfVolume` is on; the mesh draws only with it off. Checks: `test/glsl` passes,
1080p on the five days renders without shader errors, and both identity diffs say identical.
First look: the shelf reads as cloud in the deck's light (also at sunset, 2010-04-01), its top
melts into the deck, and bolts behind it now disappear into it (2005-09-07).

The steps as planned:
- `createClouds` appends the shelf's layer (Design) to the layer list before `new CloudLayers(…)`.
- `patchShelfCloud(clouds, worldToECEF, frame, shelf, index, cbIndex)`, called in `createClouds`
  after `patchStormCells`; `index` is `formations.length`, `cbIndex` is `stormLayer(formations)`:
  - after each `vec2 uv = getGlobeUv(position);` (two in `clouds.frag`, one in `shadow.frag`),
    stores `position` in a global `shelfPosition`; `sampleWeather` turns it into world x/z with
    takram's `ecefToWorldMatrix` and `altitudeCorrection` (see "Where the code stands"), and
    takes the height from its own `height` argument;
  - at `SAMPLE_END`, raises `localWeather[cbIndex]` to full over the band (as the cells do);
  - before `RETURN`, sets `weather.density[index] = shelfDensity(…)`, times
    `shadowLayerMask[index]` in the shadow pass (`#ifdef SHADOW`, as takram masks it);
  - patches both `cloudsPass` and `shadowPass`, like `patchStormCells`;
  - keeps the guard that throws if takram's shader text has changed. Both patches replace the
    same `RETURN` text and leave one copy of it, so the second still finds it; check that in a
    test.
- Phase 2 draws a **plain wedge**: lip, a face without tiers, underside. The look comes in
  phase 4, after the gate.
- Under `passes.shelfVolume` (default on). With it off, the mesh draws as in 0.172.
- Checks:
  - `npx vitest run test/glsl`;
  - a 320 × 180, 1-frame render;
  - `diff.mjs --scene '{"date":"2016-06-21"}' --ref HEAD --off '{"params":{"debug":{"passes":{"shelfVolume":false}}}}' --off-here`
    says **identical** (the switch off gives back the 0.172 mesh exactly);
  - `diff.mjs --scene '{"date":"2016-06-21","shelfCloud":false}' --ref HEAD` says **identical**
    (a storm without a shelf is untouched).
- **Done when:** the shelf shows as cloud on the five days (contact sheet), and both identity
  checks pass.

### 3. Gate: sharp enough, cheap enough ✅ 0.175
Results (1080p, 16 frames; probe `{"az": 0, "el": [3, 12], "step": 0.02}`; TS prediction by
marching `shelfDensity` along the view's centre line from `p.ctx.camera`, `params.mjs --rendered`):

| | Result | Target |
|---|---|---|
| Cost, the five days vs `f105fe3` (`bench.mjs --runs 3`) | +3% in all (−4% to +10% a day, noisy); days without a shelf are untouched (no layer, no patch; identity diff in phase 2) | ≤ +10% ✅ |
| Lip width, 10–90%, 2016-06-21 | 3 px (5.18° → 5.30°, 25.7 px/°); the mesh: 1 px | ≤ ~6 px ✅ |
| Lip elevation, render vs TS | 5.21° vs 5.36°: 4 px | ~3 px: just over, accepted |
| Face vs the deck above it, backlit (2016-06-21) | first 1.4× (1.39–1.48 vs 1.02–1.04 × 10³ cd/m²); **1.1× after 0.176** (1.08–1.20 vs 1.02) | within ±25% ✅ |
| Lip contrast, midday telephoto (2005-01-28) | first none (face ~1.93 vs ~1.9 × 10³ cd/m² below the lip); **after 0.176 the face is darker**, 1.5–1.65 vs 1.9 | ✅ |

**Found on the way:** takram doubles the density before its detail noise
(`sampleMedia`: `remapClamped(density * 2.0, …)`), so the edge shows where `shelfDensity` is
~0.25 (`SHELF_VISIBLE_DENSITY`), not 0.5. With 40/60 m edges that put the lip 0.7° (18 px)
below the TS's and 6 px soft; the edges are now 20/25 m. Predictions from the TS must use
`SHELF_VISIBLE_DENSITY`.

**Brightness (0.176):** takram's sky light on a sample is `skyIrradiance × (0.5 + 0.5 × the sample's height fraction in its layer)`. The Cb's base sits at ~0 of its 9.5 km; the shelf's face sat at 0.3–0.9 of its own ~900 m layer, so it got ~1.4× the sky light and read as a pale band, sky rather than cloud (a bolt seemed to fall from the sky; user, 2016-06-21). The patch now gives the shelf the Cb layer's height fraction: it's lit as the storm's base it belongs to.

The steps as planned:
- **Cost:** `bench.mjs --ref HEAD` on the five days, plus its default dates: **≤ +10%** render
  time on shelf days. The other dates must give an identical image (bench prints the pixel diff),
  with time within bench's noise.
- **Lip:** `params.debug.probeLine` `{"az": 0, "el": [0, 12], "step": 0.02}` (straight ahead, up
  through the lip) on 2016-06-21 and 2005-01-28. The luminance step from under the lip to the
  face should span ≤ ~6 px at 1080p; the probe's step is in degrees, so convert with the day's
  lens. Measure the mesh the same way (`passes.shelfVolume: false`), to compare.
- **Parity (TS vs GLSL):** the step's elevation should match the lip's elevation from the TS
  (`shelfDensity`'s lip at azimuth 0: `atan((lip − eye height − curvature drop) / distance)`)
  within ~3 px' worth of degrees. If not, the two sides differ: fix that before going on.
- **Brightness:** `params.debug.probe` points on the face and the deck above it. The face should be within ±25%
  of the deck above it, backlit; front-lit it should be brighter than the deck.
- **If the lip is too soft:** steepen the density edge (the smoothstep width) before anything
  else. Then add a lip-only density boost: more extinction gives an earlier, sharper hit. Don't
  change takram's step settings for the whole sky.
- **If the cost is over 10%:** in `shelfDensity`, return 0 below a small threshold (takram's
  `minDensity` is shared by the whole sky; don't touch it), so the march skips the near-empty
  smoothstep tails. Or cap the band at ±25 km.
- **Stop here and report** if neither fix gets both numbers within the targets. The decision
  (keep the mesh, accept softer or more expensive) is the user's.
- **Done when:** the four results (cost, lip width, parity, brightness) are written into this plan
  and are within target.

### 4. The look ✅ 0.177
As built (`SHELF_SHAPE`, TS and GLSL): the lip's height varies ±12% over ~5 km (±1.5% over
~1.2 km), the lip line wanders in 350 m and 80 m scallops; up to three **local** tiers (a 60 m
groove under a 40 m bulge) between 15% and 65% of the face, drifting and fading along the front;
±8 m striations every ~30 m following the lip. The GLSL skips samples where the density is
surely 0 (above the top, in front of the face, past the back): round 1 took 2.9–11 s a render
without that.

Results (1080p; five days and the front-lit spec): no band runs straight across on 2005-01-28;
the face is 0.98× the deck backlit (2016-06-21); the lip 3 px sharp, 3 px from the TS's
prediction; at sunset (2010-04-01) the same light as the deck. Cost +5% over 0.176 (bench, five
days), about +8% over the commit before the shelf. **Not met:** front-lit (photo B) the tiers
barely show. Under a full storm deck the sun reaches the face neither way (takram's shadow map),
so they have little light to shade; on the telephoto day they're soft bands.

**Three rounds, three lessons:**
- Steps that shift the whole face above them make the top edge jump where they fade: tiers must
  be local.
- 6% lip waves over 1.2 km read as a ridge of hills.
- Scud as thresholded value noise lowering the underside drew flat-topped humps along the
  front, identical through two tier changes. It was found by switching each detail off in turn
  (scud, striations, lip), and removed; takram's detail noise tears the underside. Switch
  details off one by one before the second guess.

The steps as planned:
- Add to `shelfDensity`, TS and GLSL together (the constants come from the one TS object). Re-run
  phase 3's parity probe after each change. Add:
  - tiers as steps in the face's set-back, which drift and fade along the front (as in the 0.172
    mesh, commit `c8d65df`: tier height ±0.11 of the face, strength noise at ~1.8 km);
  - striations as ±15% density bands ~30 m apart that follow the lip;
  - a rising, scalloped leading edge (the lip's height varying ±12% at ~1.2 km);
  - more `shapeDetail` on the underside, plus hanging scud tufts (density below the lip from
    thresholded noise, within ~1.5 km behind it).
- Tests: tiers and scud stay within the wedge's bounds (no density in front of the lip above
  ground).
- **Round 1:** the five days plus the front-lit spec. **Round 2:** fix everything seen. **Round
  3:** confirm. If a 4th seems needed, reason from probes and `diff.mjs` instead.
- **Done when:**
  - backlit, it reads like photo A: smooth dark face, sharpest at the lip, top lost in the deck;
  - front-lit, like photo B: tiers changing along the front;
  - at sunset (2010-04-01) it carries the same light as the deck, with no flat pink band;
  - on 2005-01-28 no band runs straight across the frame.

### 5. Reflections, shadows and real days ✅
8 real shelf days (`snapshot.mjs --where … --sample 8`, not the five): no ⚠, no holes or bands,
bolts behind the lip. On the far days (2024-06-21, 2024-04-24, 2024-07-01, 2024-12-12,
2025-02-12) the shelf read as a dark strip on the horizon with a straight top. Measured on
2024-06-21 with the shelf on and off (`edges.mjs`): the dark strip is the storm's rain region,
as dark without the shelf (580–640 cd/m²); its top is the lip (1.2 px sharp, 4.87° against the
CPU's 5.04°); the face 1.09× the deck. Physically right; only the lip's straightness is left
("Later"). The sea's mirror and the cloud shadow carry the shelf by construction (the cube's and
the shadow pass's clouds have the patch); not measured on their own.

The steps as planned:
- The water's sky cube now holds the shelf. On a calm shelf day the sea should mirror it, where
  0.172's mesh was left out of the mirror. Check it with `snapshot.mjs --where 'p => p.storm?.shelf
  != null' --sample 8` (real days, not the five above), `--seeds 3` on one of them (the noise
  reads the seed).
- Its shadow: the cloud shadow map now carries it. Check it doesn't darken the beach in front of
  the lip; it shouldn't, because the sun is behind the storm on backlit days.
- **Done when:** the 8-day contact sheet has no ⚠ warnings and nothing looks wrong (bands, holes,
  a shelf without a deck over it, rain in front of the lip).

### 6. Remove the mesh, finish ✅ 0.179
The mesh, its prop kind, `CLOUD_KINDS` entry, `passes.shelfVolume` and the mesh's test are gone;
`scenes/shelf.json` holds the five days, the front-lit spec, a far day and the lip probe.
`diff.mjs --scene scenes/shelf.json --ref HEAD`: identical on all 8; `params.mjs --ref HEAD`:
0 of 8035 days changed. Tools and knowledge from the work went in 0.178 (arch/SKY.md "takram's
clouds, from the inside", `edges.mjs`, `rows.mjs`, `params.debug.shelf`).

The steps as planned:
- Delete `shelfGeometry`, `createShelfCloud`, `SHELF_SKY_OPEN`, the `shelf-cloud` prop kind
  (`props/index.ts`) and its entry in `propShade.ts` `CLOUD_KINDS`, and the `passes.shelfVolume`
  switch. Remove the mesh's tests (`test/skyEvents.test.ts` "builds finite meshes", and any
  `shelf-cloud` row in `test/propSwitches.test.ts`). The `shelfCloud` spec field stays, with its
  row in `sceneSpec.test.ts`.
- Add `scenes/shelf.json`: the five days and the front-lit spec, for later checks.
- Docs: changelog row (days changed: `params.mjs --ref HEAD`), ARCHITECTURE (draw order line 9;
  replace both shelf known issues), arch/SKY.md (how the patch works, the free channel `a`),
  CLOUDS.md (shelf: volumetric), LESSONS.md (a cloud shape is a weather patch, not a mesh;
  measured gate numbers), TOOLS/DEBUG if a probe was added.
- `npm test`, `npx tsc --noEmit`, a final `bench.mjs --ref HEAD`.
- **Done when:** the mesh is gone, the tests pass, and `diff.mjs` with `shelfCloud: false` shows
  the shelf as the only difference on a shelf day.

### 7. Later: the Morning Glory roll cloud (own plan section first)
The same patch handles a detached tube: density from the distance to the tube's axis, flattened
underneath, on a free channel. It needs its own research (Burketown photos; tube 1–2 km thick, up
to 1000 km long) and its own gate. Do it only after phase 6 shows the shelf is better than the
mesh.

## Later
- **A tattered lip** (WMO: arcus has "more or less tattered edges"): on far days the lip reads
  ruler-straight. A fine, multi-octave ragged edge (tens of metres, under ~500 m long) without the
  1.2 km waves that read as hills (phase 4). Check with `edges.mjs` along the lip (`az` range).
- **Front-lit tiers:** under a full deck the sun reaches the face neither way, so tiers barely
  show front-lit. Real front-lit shelves (photo B) often stand ahead of the deck in sunlight:
  a gap in the deck over the lip on front-lit days would let it in.

## Estimate

About 10–13 h for phases 0–6. Phase 3 is the go/no-go point, after ~5–6 h.
