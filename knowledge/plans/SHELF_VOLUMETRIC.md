# Shelf cloud in the volumetric clouds

**Status: planned (2026-11-14), nothing built.** Replaces the shelf cloud's mesh
(`props/cloudEvents.ts` `shelfGeometry`, last tuned in 0.172) with cloud drawn by takram's
volumetric clouds, through a shader patch like `stormCells.ts`. Then the Morning Glory roll cloud
can follow (phase 7).

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
| uv → metres is linear enough over ±40 km | `stormCells.ts` uses one 2×2 matrix from 1 km steps, for cells ≤ 9 km away | **not checked past 9 km; phase 1 tests it.** `worldToECEF` is pure math (`scene.ts:227`: `Ellipsoid.WGS84.getNorthUpEastFrame` at the day's latitude, longitude 0), so a unit test can build it without WebGL |
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
- **Placement fixed in `params.ts`:** the lip stands 2–8 km ahead of the storm's rain (an
  estimate built on the one measured case, 8 km). Bolts and curtains within ±45° of the shelf's
  direction are moved back behind the lip; their distances keep their own draws, offset. This
  changes the storm on up to 112 days. The shelf's chance (40% of storms) is drawn before any
  of this, so it doesn't change.
- **Off switch while building:** `params.debug.passes.shelfVolume: false` draws the 0.172 mesh
  instead. Phase 6 deletes the mesh; after that `shelfCloud: false` is the before/after switch.

## Phases

Each phase is one commit. Real days for every render round: **2016-06-21** (backlit, 5.8 km),
**2005-01-28** (telephoto, midday), **2005-09-07** (golden hour, Arctic), **2006-06-26** (wide,
bolts), **2010-04-01** (sun on the horizon: the pink band). Add a front-lit spec on 2016-06-21
(`"sunAzimuthDeg": 120`). Phase 0 changes where the shelf stands, so phases 3–5 use the dates as
they are after it. After phase 0, run `snapshot.mjs … --props shelf-cloud` on the five dates; if a
shelf has left the frame, replace that date with another from
`params.mjs --where 'p => p.storm?.shelf != null' --each …` of the same kind (time of day, lens),
and update this list.

### 0. The rain behind the lip (params only, ~1 h)
- `params.ts` (after `shelfCloudFor`): set the lip distance from the nearest curtain or bolt within
  ±45°, minus a lead of 2–8 km (own stream `'shelf-lead'`), clamped to 3–8 km. Then push nearer
  curtains and bolts in that sector to at least lip + 1 km. Every shelf day has one in the sector
  today. If a forced spec makes a day without one, keep the drawn distance.
- Tests (`test/skyEvents.test.ts`): over `allParams()`, no shelf day has rain or a bolt within ±45°
  nearer than its lip; the share of storms with a shelf is unchanged (`expectShare`).
- `params.mjs --ref HEAD --changed 'p => p.place.id'` for the changelog (expect ≤ 112 days,
  `storm` fields only; anything else changing is a bug).
- **Done when:** the tests pass, and a 1080p render of the five days shows bolts behind the
  shelf (the mesh still draws it).

### 1. The shelf's density, in TS (~2 h)
- New `src/shelfCloud.ts`:
  - `shelfFrame(shelf, camera)`: origin, along-front and toward-storm axes, in world x/z.
  - `shelfDensity(frame, shelf, x, z, heightM)`: the cross-section in Design, with value noise
    built on `skyMirror.ts` `hashCell`, so the GLSL can match it (`hashGlsl`, prefix `shelf`).
    Keep every constant in one TS object and write it into the GLSL string, so the two sides
    can't drift apart.
  - `localMetresFromUv`: moved out of `stormCells.ts` and shared.
- Tests:
  - density 0 in front of the lip, below the lip and above the Cb base + 300 m;
  - ≥ 0.9 inside the face just behind the lip;
  - the lip within ±15% of `lipHeightM` all along the front;
  - every tier step backs away from the camera;
  - **the uv → metres error at 10, 20 and 40 km from the shelf's origin, < 50 m at 40 km**. If
    it isn't, build the matrix around the point on the front nearest the camera, which is where
    accuracy matters.
- **Done when:** the tests pass. This includes a printed cross-section table (height × back
  distance) whose numbers match the photos: lip lowest and in front, face receding, underside
  rising.

### 2. The shader patch, a plain wedge (~2–3 h)
- `createClouds` appends the shelf's layer (Design) to the layer list before `new CloudLayers(…)`.
- `patchShelfCloud(clouds, worldToECEF, frame, shelf, index, cbIndex)`, called in `createClouds`
  after `patchStormCells`; `index` is `formations.length`, `cbIndex` is `stormLayer(formations)`:
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

### 3. Gate: sharp enough, cheap enough (numbers, ~1 h)
- **Cost:** `bench.mjs --ref HEAD` on the five days and the default storm date: **≤ +10%**
  render time on shelf days, 0% elsewhere.
- **Lip:** `params.debug.probeLine` vertically through the lip on 2016-06-21 and 2005-01-28. The
  luminance step from under the lip to the face should take ≤ ~6 px at 1080p. Measure the mesh
  the same way, to compare.
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
- **Done when:** the three numbers are written into this plan and are within target.

### 4. The look: tiers, striations, scud (~2–3 h, ≤ 3 render rounds)
- Add to `shelfDensity`, TS and GLSL together. GLSL can't run in a unit test, so check that the
  two sides agree on a render: predict the lip's pixel row at the frame's centre from the TS (the
  lip point at the camera's azimuth, projected with the frame's camera), and compare it with the
  phase 3 `probeLine` step. They should agree within 3 px. Add:
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

### 5. Reflections, shadows and real days (~1 h)
- The water's sky cube now holds the shelf. On a calm shelf day the sea should mirror it, where
  0.172's mesh was left out of the mirror. Check it with `snapshot.mjs --where 'p => p.storm?.shelf
  != null' --sample 8` (real days, not the five above), `--seeds 3` on one of them (the noise
  reads the seed).
- Its shadow: the cloud shadow map now carries it. Check it doesn't darken the beach in front of
  the lip; it shouldn't, because the sun is behind the storm on backlit days.
- **Done when:** the 8-day contact sheet has no ⚠ warnings and nothing looks wrong (bands, holes,
  a shelf without a deck over it, rain in front of the lip).

### 6. Remove the mesh, finish (~1 h)
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

## Estimate

About 10–13 h for phases 0–6. Phase 3 is the go/no-go point, after ~5–6 h.
