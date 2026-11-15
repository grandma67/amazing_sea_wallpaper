# Cloud illumination: lightning inside the cloud, storms at night, town light on cloud bases

**Status: done (phases 1–7, 0.183–0.190, 2026-11-15).**

Reported on `/?date=2016-06-21` and `/?date=2026-11-02`: the lightning doesn't light the cloud,
and nothing else lights the sky from below or inside either.

Reference photo **R**:
[ABC, night supercell with lightning](https://live-production.wcms.abc-cdn.net.au/a4a718109bb53994c7fc0cc1ea720938?impolicy=wcms_crop_resize&cropH=1365&cropW=2048&xPos=0&yPos=0&width=862&height=575).
What R shows:
- the cloud lit from inside, brightest high up and to one side of where the bolt leaves the
  base;
- faint branches inside the cloud;
- a town-lit orange underside on the right;
- the ground lit by the storm.

## Decisions (user, 2026-11-15; settled, don't reopen)

1. **A change is good if it makes the image more realistic.** Night storms come to real days
   (phase 6).
2. **Lightning by day lights the clouds:** a storm deck can make the day very dim.
3. **One rule for every hour.** The glow follows real light values, not the time of day.
   - One flash energy and one camera rule (`flashShutter`), set against the scene's real
     luminance.
   - Midday, twilight and night differ only through that luminance.
   - No fixed glow radiance, no per-hour factor, no `timeOfDay` anywhere in `lightning.ts`.
4. **Not built** (phase 0 measured, the research says it's right as it is):
   - the moon on clouds;
   - lighthouse beams on clouds;
   - moonlight bounced off the sea.

   Reasons under "What stays as it is".

## Research (sources read, in search summaries unless noted)

- [IEEE TechNav: lightning](https://technav.ieee.org/topic/lightning/)
- [NAP, The Earth's Electrical Environment, cloud charge chapter](https://www.nap.edu/read/898/chapter/62)
- [Springer review, Surv. Geophys. 2013](https://springerlink.bibliotecabuap.elogim.com/doi/10.1007/s10712-013-9230-6)
- [Edens, bolt-from-the-blue flashes](https://aem.eco/wp-content/uploads/2022/10/Edens-BFB.pdf)
- Winter lightning in Japan:
  [IEEJ 2018](https://www.jstage.jst.go.jp/article/ieejpes/138/5/138_310/_article),
  [URSI AP 2025](https://www.ursi.org/proceedings/procAP25/papers/0454.pdf),
  [AMS 2013, VHF sources in winter storms](https://ams.confex.com/ams/93Annual/webprogram/Paper218027.html)
- [Guo & Krider (NTRS)](https://ntrs.nasa.gov/citations/19830068117)
- [Sandia lightning radiometry 2023](https://www.sandia.gov/research/publications/details/lightning-radiometry-in-visible-and-infrared-bands-2023-09-01/)
- [NASA Earthdata: clouds spread a flash's light](https://www.earthdata.nasa.gov/learn/data-in-action/properties-optical-lightning-flashes-clouds-illuminate)
- [CloudScat.jl, GMD 2020](https://gmd.copernicus.org/articles/13/5549/2020/)
- [Holle, diurnal lightning, AMS 2013](https://ams.confex.com/ams/93Annual/webprogram/Manuscript/Paper215133/8.1%20Holle-Diurnal%20AMS%202013.pdf)
- [Virts, WWLLN diurnal cycle](https://www.nssl.noaa.gov/users/mansell/icae2014/preprints/abstract_short/Virts_289.pdf)
- [Kyba et al. 2011, PLoS ONE](https://pmc.ncbi.nlm.nih.gov/articles/PMC3047560)

### Where a flash starts

- **The charge stack:** main positive above, **main negative at −10 to −20 °C**, and a small
  lower positive pocket near the base. Graupel charges negatively below ~−15 °C.
- **A negative CG flash** (~90% of ground strikes) starts at the lower edge of the main negative
  region.
  - The stepped leader runs sideways for kilometres inside the cloud, branching, then leaves the
    base and steps to the ground.
  - The return stroke lights the whole path, inside the cloud too.
- **Offset from start to ground point:** bolts from the blue (leaving the cloud's side near 8 km)
  have 1–17 km, mean 6.5 km. For an ordinary CG we use **0.5–3 km** (estimate, kept inside the
  storm cell).
- **Winter storms charge low:** the −10 °C level is at 1–2.8 km in Japan's winter lightning, and
  storms barely produce lightning when it is below 1.8 km.

**−15 °C height table** (`CHARGE_HEIGHT_M`, km above the sea, keyed by `place.climate` ×
`season()`):
- It is the freezing level + 15 K / 6.5 K km⁻¹ ≈ freezing level + 2.3 km.
- Anchors: the tropical freezing level is ~4.8–5 km all year, and the Japan winter −10 °C level
  1–2.8 km. Other rows are interpolated (estimate).

| climate | summer | spring / autumn | winter |
|---|---|---|---|
| tropical | 7.0 | 7.0 | 6.8 |
| subtropical | 6.6 | 5.8 | 4.6 |
| arid | 6.5 | 5.5 | 4.2 |
| mediterranean | 6.0 | 5.0 | 3.6 |
| temperate | 5.5 | 4.5 | 3.0 |
| boreal | 5.0 | 3.8 | 2.6 |
| polar | 4.2 | 3.2 | 2.4 |

Storm days by climate and season are spread over all 28 cells (68 storm days; the most is
"temperate autumn" with 5), so every row is used.

### How much light

- **Peak power:** first return stroke 2.3 ± 1.8·10⁹ W at 0.4–1.1 µm (Guo & Krider 1982).
  Subsequent strokes are ~160 µs wide.
- **Energy per stroke:** ~20 kJ (Sandia, 0.34–1.1 µm) to ~4·10⁵ J (Guo & Krider's peak × width).
- **Luminous efficacy** of that band: **150 lm/W** (estimate: about half the band is visible, in
  the N II and Hα lines).
- **Constants:**
  - `STROKE_LM_S = 1e7` (luminous energy per stroke, geometric middle of the range);
  - `STROKES = 3.5`;
  - `FLASH_S = 0.3` (flash length).
- **Glow colour:** sampled from R, sRGB 192,163,167 against a neutral sky of 40,40,43, which is
  linear ≈ **(1, 0.70, 0.74)**, pink-lavender (Hα + N II). The bolt mesh stays (0.85, 0.9, 1).

### How a cloud spreads it

- Droplets scatter and hardly absorb, so the light diffuses: Cb extinction ~0.15 m⁻¹ per g/m³,
  g ≈ 0.85, transport mean free path 20–70 m.
- **Dipole diffusion:** a point source of power P at depth d under a thick cloud's surface shows
  a spot of radius ~d.
  - Luminance over it: **L₀ = P / (2π² d²)**.
  - Off to the side: L = P·d / (2π² r³), with r the distance to the source.
  - Half of P leaves through that face.
- Satellites see stationary pulses lighting a large share of the storm.

### What the camera keeps (decision 3)

- **Shutter t, from one photographer rule:**
  - metered on the scene's real luminance **without** the flash (lightning can't be metered;
    photographers expose for the ambient light and let the flash add);
  - f/8, ISO 100 rising to at most 3200 only once t would pass 30 s, t capped at 30 s.
- **Captured energy:** `Q = STROKE_LM_S × max(1, STROKES × min(1, t / FLASH_S))`.
- **Power in the image:** `P = Q / t`.
- So glow ÷ scene grows as the real scene darkens:
  - Q/(FLASH_S·L) while t < FLASH_S;
  - Q/(t·L) when t is longer, and still ∝ 1/L at the 30 s cap.
- **Dim storm day** (2016-06-21, 800 cd/m²): t ≈ 10 ms, P ≈ 10⁹ lm.
  - Channel 200 m inside the base: L₀ ≈ **1,300 cd/m², ~1.6× the frame**, a few hundred metres
    across.
  - 2 km inside: ~13 cd/m² (1.6%).
  - A 200 cd/m² storm: 6.5× and 6.5%.
- **Night** (t = 30 s, the whole flash caught): P ≈ 1.3·10⁶ lm.
  - 2 km inside: ~0.017 cd/m², **~80× a starlit sky** (2·10⁻⁴ cd/m²).
  - Near the base: ~0.4 cd/m².
  - The whole cloud glows, and near the channel it may clip to white, as in R.
- **On the ground:** P/(4π r²) at 5 km ≈ 0.004 lux, twice a starlit night's 0.002. The flash
  lights land and sea at night (phase 5).

### Night storms

- Over the sea, thunderstorms **peak around midnight to early morning (~01–06 local)**.
- Over land they peak mid-to-late afternoon; coasts get both (sea-breeze storms by day,
  land-breeze and warm-water storms at night).
- Sources disagree on how strong the oceanic peak is, so night uses the same chance as day:
  **×1**, `stormChance(climate, summer)` unchanged.
- Expected on real days: 113 night days × ~0.075 ≈ **8–9 night storms**.

### Town light on clouds

- Clouds amplify light pollution: overcast zenith **×10.1 inside Berlin, ×2.8 at 32 km**.
- The cloud base acts as a Lambertian reflector lit from below.
- Our Bortle 3–4 coasts are the "32 km" case, so the target is **overcast base ≈ 2.8 × the
  clear-sky artificial zenith** (`ARTIFICIAL[b].zenith` S10 × `s10Luminance()`), brighter toward
  the dome.
- Colour: R's lit shelf, linear **(1, 0.70, 0.40)**.
- Bortle 1–2 (zenith ≤ 8 S10): nothing.

### What stays as it is (and why)

- **Lighthouse beams on cloud bases:**
  - half-width 2.2° (`DIVERGENCE`): the top edge reaches a 300 m base only past ~7 km, a Cb's
    600 m base past ~15 km;
  - at ~10⁶ cd and 7 km: 0.02 lux; grazing at 2° → × 0.035;
  - L ≈ 0.7 × 0.02 × 0.035 / π ≈ 1.6·10⁻⁴ cd/m², before the sweep's few-% duty cycle;
  - that's ≤ 10% of a dark overcast base, far less averaged: invisible.
- **The moon:** it already lights clouds and the sky round it (above).
- **Moonlight bounced off the sea:** 2–6% of the light (Fresnel) from a small glade, unmeasurable
  on a cloud.

## Phase 1: where the flash is (geometry; no light yet)

1. **Create `src/lightning.ts`** with
   `lightningFor(params: SceneParams, camera: Vector3): Flash[]`, its own stream
   `Random.derive(params.seed, 'lightning')`. For each bolt in `params.storm.bolts`:
   1. `exit`:
      - x, z of the strike;
      - y = `cloudBase(formations, 'cumulonimbus')` + the first `range(0, 200)` draw of
        `new Random(`${seed}/bolt/${strike.seed}`)`, i.e. the point where `bolt()` starts its
        channel.
   2. `origin`:
      - height `CHARGE_HEIGHT_M[climate][season]` (table above; `season()` from `seasons.ts`,
        hemisphere-aware), clamped to [base + 300 m, base + Cb height − 1.5 km];
      - horizontal offset `range(0.5, 3)` km at a random azimuth;
      - clamped so it lies ≥ 1 km inside that bolt's storm cell (`stormCells`: radius
        3.5 km + 10% of distance).
   3. `inCloud`, a jagged path origin → exit, 3 levels of midpoint displacement (roughness
      0.22):
      - first 60% of its length near origin height (sideways);
      - then down to `exit`;
      - plus 1–3 branches of 0.5–1.5 km leaving the sideways part, heading sideways or down.
   4. `lights`: 6 points: 5 evenly along `inCloud` + `exit`. Each carries a share of the energy:
      - the lowest 300 m of the path (exit side) gets 30% (the return stroke is brightest low:
        estimate);
      - the rest is shared by length.
2. **The climate × season table** goes in `lightning.ts` as `CHARGE_HEIGHT_M`. Add it to
   ARCHITECTURE.md "Biome, climate or place" (weather → climate).
3. **Spec field `lightning`:** `{ offsetKm?: number; azimuthDeg?: number; originM?: number }`, in
   `sceneSpec.ts`, following SCENE_SPECS.md "Adding a spec field".
   - Forcing it changes only the flash geometry.
   - Unforced days draw the same.
4. **`props/storm.ts`:**
   - `createStorm` adds the in-cloud path and its branches as ribbons on the same mesh (width as
     the main channel, brightness 0.7, branches 0.4).
   - The part below `exit` is unchanged.
   - The volumetric clouds composite over the mesh by depth, so the in-cloud channel shows only
     where the cloud is thin, as in R.
5. **Tests**, `test/lightning.test.ts` plus a row in `sceneSpec.test.ts`:
   - on every real bolt day, and for every climate × season key with a forced storm (no
     sampling): origin inside the Cb layer and inside its cell; path continuous; last point =
     `exit`; deterministic over 3 seeds;
   - the forced `lightning` field moves the origin and nothing else.
6. **Check:** `node scripts/params.mjs --ref HEAD` shows no changed fields on unforced days
   (lightning is computed at render time, not stored in params). Then
   `params.mjs 2016-06-21 2026-11-02 --rendered --each 'p => src.lightning.lightningFor(p, p.ctx.camera.position).map(f => [f.origin.y, f.origin.distanceTo(f.exit)])'`:
   - origin heights from the table: 2016-06-21 is temperate summer (5.5 km); 2026-11-02 is
     tropical (7.0 km);
   - offsets 0.5–3 km.

   If `p.ctx` has no camera, use the camera position `scene.ts` gives `createStorm`, and say so
   here.
7. **Commit:** "Lightning starts in the cloud's charge region (CLOUD_ILLUMINATION phase 1)".

**As built (0.183):**
- The origins are drawn in `params.ts` (`storm.origins`, stream `'lightning'`, after
  `placeShelf`), so `--ref HEAD` shows a new field and 0 changed days.
- A storm cell is full only inside ~0.45 of its radius. So `boltCell` (shared by `stormCells`)
  centres each bolt's cell between strike and origin and widens it by half the offset.
  `lightningFor` keeps the whole channel within 0.38 of that radius.
- The in-cloud path is roughness 0.12, 4 levels: 0.22 let it wander 2 km out of the cell.
- Render of both dates: the in-cloud channel is hidden by the dense Cb, as expected. Phase 3 lights
  it.

## Phase 2: how bright (TS only)

1. **In `lightning.ts`:** `FLASH = { strokeLmS: 1e7, strokes: 3.5, flashS: 0.3, colour: [1, 0.70, 0.74] }`,
   each with its source or "estimate" in a comment.
2. **`flashShutter(ambientCd: number): number`**, f/8 with auto ISO:
   - `base = 0.061 × (8 / 2.8)² × 1600 / iso / ambientCd`;
   - iso = 100; if base > 30, raise iso up to 3200; t = min(base, 30);
   - no time-of-day input.
3. **`flashPower(t: number): number`:** `Q = strokeLmS × max(1, strokes × min(1, t / flashS))`;
   returns `Q / t` lm.
4. **`flashGlowCd(P, source, point)`** = `P × c / (2π² r²)`, with:
   - `r = max(|point − source|, 60)`;
   - `c = clamp(|Δy| / r, 0.3, 1)`: the dipole's d/r, full under the source, 0.3 on walls seen
     from the side (estimate).

   This TS mirror is what the shader must match.
5. **Units:** cd/m² → render units ÷ `cdPerUnit` (`1 / renderPerLux(params.nightSky, elongationDeg(params))`,
   as in `scene.ts`).
6. **Where the ambient comes from:** the luminance the exposure puts at mid-grey,
   `ambientCd = 0.18 × cdPerUnit / (exposure × wbLum)` in `scene.ts`. It equals
   `0.061 / shutterOf(1, 1)`; use either and assert they agree in a test. Feed it to
   `flashShutter`.
   - Write `ambientCd`, `flashShutter` and `flashPowerLm` to `debug`.
7. **Tests:**
   - `flashShutter`: 2016-06-21's 800 cd/m² → ~10 ms; 2·10⁻⁴ cd/m² → 30 s at ISO 3200.
   - Glow ÷ ambient at d = 200 m under the source, over ambient from 10⁴ down to 10⁻⁴ cd/m²:
     strictly growing, no step.
   - 800 cd/m² → 1.3–2× at 200 m.
   - Night (2·10⁻⁴, 30 s): ≥ 30× at 2 km.
   - Exitance from `flashGlowCd` over a plane at depth d, integrated numerically to 50 d,
     ≤ P/2 × 1.2.
   - Grep in the test: `lightning.ts` doesn't mention `timeOfDay`.
8. **Commit:** "Lightning's light from real energy and one camera rule (phase 2)".

**As built (0.184); corrects the numbers above:**
- **The kernel is halved:** `P·c / (4π² r²) × exp(−r / 4 km)`. The dipole lets all of P out
  through its one face; a cloud loses about half through its base. The fade (`GLOW_REACH_M`)
  stands for light leaking out of the faces, and keeps a wall's 0.3 floor from letting out more
  than P/2.
- **The stroke has a length** (`STROKE_S` 0.5 ms): a shutter shorter than that holds part of
  it.
- **Extra strokes:** the other strokes are caught in proportion to the shutter over the flash's
  0.3 s.
- **How the ratio behaves:** with the camera metered to the ambient, glow ÷ ambient depends on how
  much of the flash the shutter holds. It grows from bright to dark, flat while the shutter holds
  the whole flash (0.3–30 s), then ∝ 1/L past the 30 s cap. Never falls, no steps (tested).
- **Glow ÷ ambient at 200 m / 2 km deep:**

  | ambient (cd/m²) | 200 m deep | 2 km deep |
  |---|---|---|
  | 200 | 1.0× | 0.6% |
  | 20 to 1 | 2.7× | 1.7% |
  | 0.01 | 70× | 45% |
  | 2·10⁻⁴ (starlit) | 3,500× | 22× |

  So by day: a lit patch where the bolt leaves the base. The whole tower glows only at night.

## Phase 3: the cloud lit from inside (shader)

1. **`patchCloudsFlash(material, flashes, worldToECEF, renderPerCd)`** in `lightning.ts`, written
   like `patchCloudsAurora`:
   - **Guard:** throw if `radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;`
     or `vec4 marchClouds(` is missing.
   - **Uniforms:** `uniform vec4 flashLights[18]` (ECEF position xyz, power in render units w),
     `uniform int flashCount`, `uniform vec3 flashColour`, `uniform vec4 flashBounds[3]`
     (ECEF centre and radius per bolt for the early exit).
   - **After the sky line, before `radiance *= media.scattering`:**
     - for each bolt whose bound holds the sample (radius = 8 km);
     - for each of its 6 lights: `radiance += flashColour * w * c / (2π² r²)`, with r and c as
       in `flashGlowCd` (Δy is the height difference: `length(position) − length(light)`);
     - no optical-depth march: the light travels by diffusion, which the kernel stands for.
   - The 8 km bound skips every sample far from a bolt (< 1% of the glow there by day).
2. **Wire it in `createClouds`** (new optional argument, passed by `scene.ts` and by
   `renderCloudyEnvironment`), so the frame and the env cube both carry the glow. The sea mirrors
   the cube.
3. **Off switch `passes.flashLight`** (add to `DEBUG_PASSES`):
   - Off keeps today's path: `FlashEffect` and the ocean's `flashGlows`.
   - On: the patch, plus `FlashEffect` and the ocean term switched off.
   - Check `git diff` that every changed condition sits under the switch, then
     `diff.mjs --scene … --ref HEAD --off '{"passes":{"flashLight":false}}' --off-here` says
     "identical".
4. **Debug:** `params.debug.flash: { scale?: number; lights?: number[] }` (scale the power;
   keep only the listed light indices) to isolate a source.
5. **Checks, in order** (stop and find the cause at the first failure):
   1. `npx vitest run test/glsl`.
   2. Render `--w 320 --h 180 --frames 1` on 2016-06-21 (GLSL errors show only at render time).
   3. Probes (`params.debug.probe`, world points from the phase 1 `exit` and 1 km away, and a
      `probeLine` across the exit) on both dates, against `flashGlowCd` + the measured base:
      within ±30%.
   4. `node scripts/diff.mjs --scene <specs> --off '{"passes":{"flashLight":false}}' --w 960 --h 540 --frames 16`
      on both dates and two forced night specs (`{"date":…,"timeOfDay":"night","storm":"thunderstorm","eclipse":null}`):
      no `⚠ invisible`.
   5. `node scripts/bench.mjs --ref HEAD` on both dates: ≤ +10%.
   6. One render round at 1080p, 16 frames: both dates, the forced "same storm at four hours"
      set (decision 3), and `snapshot.mjs --where 'p => p.storm?.bolts?.length > 0' --sample 8`.
      Also front-lit (`"sunAzimuthDeg": 160` on one date). At most 3 rounds in all.
6. **Commit:** "Lightning lights the cloud from inside (phase 3)".

**As built (0.185); four findings changed the design, each measured:**
1. **Positions:** takram's march position is ECEF minus `altitudeCorrection`. The lights are
   passed in world coordinates, and the sample is converted as `cloudShapes.ts` does.
2. **Thin clouds:** takram's clouds are optically thin over kilometres, a real Cb within tens of
   metres. Adding the kernel at every sample gave an even, faint lift. The kernel is now taken
   once, where the ray first meets cloud at or above the Cb base (the face; scud below doesn't
   count), and carried along the ray, × scattering, after the powder term.
3. **What the march passes on:** `debug.flash.constant` 1000 cd/m² comes out ×0.45–0.62 on
   2026-11-02. That's the haze (17 km visibility: 0.49 over 3.1 km), not the march.
4. **Light depth:** the low lights are placed above the **Cb base**, not above the mesh's exit
   (which starts up to 200 m inside the cloud). At "exit + 150 m" they sat 340 m deep and the
   patch was 4× fainter.

**Measured (1080p):**
- 2026-11-02, the bolt at 3.2 km: +37% at the exit (el 10.5°) by day. The TS mirror gives the
  same face value within 10%.
- Starlit night: the base glows round both bolts, 33% of the frame changed.
- Blue hour: a visible lit patch over the near bolt.
- Day 2016-06-21: 0.06% of the frame changed (bolt at 5.7 km, haze).

**Checks:**
- Switch off = HEAD on 3 scenes (identical).
- `Vector4()` padding had w = 1 (fixed, tested).
- Bench vs 0.184: +3–4% on both dates and the starlit storm.

**Moonlit night 2016-06-21:** the frame is too dark to show it. That's phase 4's exposure.
7. **Cleanup commit:**
   - delete `FlashEffect`, `flashGlows`, `FLASH_RADIANCE` and the ocean's `flashGlows`
     uniforms and loop;
   - `passes.flashLight` now means "no flash light";
   - update `propSwitches.test.ts` if it lists passes.

## Phase 4: night storms, exposure (forced specs only)

1. **`frameBoostRule`:** a night with `weather.kind === "storm"` gets the broken/overcast rule
   (floor 0.03, ≤ 6 stops). The boost is metered on the ambient frame as today. The flash adds
   on top (decision 3: photographers expose for the ambient light).
2. **Once the boost is known after the first look,** `flashShutter` uses
   `ambientCd / boost` (the photographer opened up): update the flash uniforms before the
   accumulation restart that the long exposure already does.
   - If no restart happens on that day, the boost is 1 and nothing changes.
   - Add a restart when the boost > 1 and a flash is present, only if the long exposure doesn't
     already restart there.
3. **The long exposure's cloud drift:** the glow belongs to the instant of the flash.
   - Pass `cloudDrift`'s offset at the frame where the flash falls (the middle of the shutter)
     to the flash bounds and lights, or the glow smears with the cloud.
   - If the drift can't be split per light, leave the drift on and note it in arch/SKY.md
     "Storms".
4. **Several flashes in one shutter:** the bolts drawn *are* the flashes caught; add no hidden
   ones.
5. **Checks:**
   - forced night storms on both dates, with `"nightSky": "moonlit"` and `"starlit"`: the frame
     not black, the cloud lit as R;
   - `diff.mjs` with the rule off;
   - `bench.mjs`.
6. **Commit:** "Storm nights exposed for their ambient light; the flash adds (phase 4)".

**As built (0.187):**
- A night storm is always drawn twice: the first look has the flash off, then the frame restarts
  with the flash at `flashPower(flashShutter(ambientCd / boost))`.
  - The reflection cube keeps the first power: it is drawn before the look.
  - The glow doesn't drift with the long exposure's clouds; on the renders it reads fine.
- **The rain's floor:** `RainEffect` added a fixed 0.02 (exposed), so a ×10 lift made the streaks
  glare. Its floor is now 0.02 ÷ the boost (`setRainBoost`).
- **Renders, forced:**

  | night | boost | shutter | look |
  |---|---|---|---|
  | 2026-11-02 moonlit | ×10.7 | 35 s | the deck glows round both bolts, as R |
  | 2026-11-02 starlit | ×8.8 | 76 s | the deck glows round both bolts, as R |
  | 2016-06-21 moonlit | ×3.5 | — | no glow (see the next line) |

- **2016-06-21:** no glow, because takram draws almost no Cb near that bolt's base (ARCHITECTURE
  "Known issues").

## Phase 5: the flash lights land and sea

1. **In `createStorm`,** one `PointLight` per bolt at the middle of its visible channel:
   - power `P / (4π)` cd in render units;
   - decay 2, no shadow;
   - colour (0.85, 0.9, 1).
2. **One more `PointLight` per bolt** at `exit` minus 50 m:
   - the cloud's base glow: `0.5 × 0.7 × P / (4π)` cd (the half leaving through the base × the
     base's albedo);
   - colour = `FLASH.colour`.
3. **Ground shaders that ignore three's point lights** (the custom terrain and sand shaders):
   - add the same two terms as an irradiance `I cosθ / r²` there;
   - grep `scene.ts` for how the moon's direct light enters each custom material, and follow it.
4. **Off:** `passes.flashGround` (add to `DEBUG_PASSES`).
5. **Checks:**
   - a probe on the sand under a forced night storm: ≈ `P/(4π r²)` × the sand's albedo / π,
     ±30%;
   - by day, `diff.mjs` shows < 2% change (realistic: invisible);
   - `bench.mjs`.
6. **Commit:** "Lightning lights the land and sea (phase 5)".

**As built (0.188):**
- **One light per bolt** at its exit, I = (P/2)/π (`GROUND_SHARE`). The channel's own light below
  the base is a few % of the channel's length and is folded into it. It reaches the terrain
  (`flashGround` uniforms) and the props (`PointLight`).
- **No ocean term:** the sea gets its light from the reflection cube's lit cloud.
- **Found and fixed** (it also undid phase 4's metering): the frame meter re-reads the **last**
  frame, which has the flash in it, and that reading set the boost.
  - With the ground light on, the frame came out darker.
  - `FrameMeterPass.held` keeps the first look's boost (metered with the flash off).
- **Measured:**
  - forced starlit night storm 2026-11-02: boost ×10.7 with and without the ground light;
    the beach lit (27.9% of the frame brighter);
  - by day 0.14% (invisible).
- **Bench:** +0–4%.

## Phase 6: night storms on real days

1. **`stormComes` and `generateStorm`:** remove `timeOfDay !== 'night' &&` from the first draw.
   - It's the same stream and draw, so only night days that roll a storm change.
   - Fix the doc comment that called night storms impossible.
2. **Titles:** keep the moon phase in the title (the moon still rises; a broken storm sky shows
   it). `stormBarred` and the aurora rule stay as they are.
3. **Count:**
   - `node scripts/params.mjs --ref HEAD --stats 'p => p.storm != null && p.timeOfDay === "night"'`:
     expect 8–9;
   - `--list` the changed days; `--changed 'p => p.place.id'` for the changelog;
   - if far off, find the reason before going on.
4. **Tests:** a `realDays.test.ts` row, "storms come at night as by day": share over night days
   ≈ the mean chance 0.07–0.08 (`expectShare`).
5. **Render:** `snapshot.mjs --where 'p => p.storm != null && p.timeOfDay === "night"' --sample 8`.
6. **Commit:** "Thunderstorms at night (phase 6)".

**As built (0.189):**
- **Real days:** 2 of 113 test nights changed (2026-03-27 subtropical beach, 2026-08-20 Pacific
  open sea). Every test day forced to night gives 6.4%, so there is no bias; the real nights just
  rolled low (P ≈ 1%).
- **The rule's test** is the forced-night share (`expectShare` 0.07), not the real-night count.
  The realDays row "a storm: by day" is gone.
- **Renders:** the bolts and the glow show. The deck reads as flat bands (ARCHITECTURE "Known
  issues"): an old look, now visible at night.

## Phase 7: town light on cloud bases

1. **`patchCloudsTownLight(material, glow, worldToECEF, renderPerLux)`** in `nightGlow.ts`, the
   same pattern as `patchCloudsAurora`:
   - after the sky line:
     `townDepth = marchOpticalDepth(position, townDir, 3, mipLevel, jitter); radiance += townIrradiance * approximateMultipleScattering(townDepth, dot(townDir, rayDirection));`
   - `townDir` (toward the light source) points down 20° below the horizon at the dome's azimuth
     (`glow.dome.offsetDeg` from inland, as the dome uniform does). Estimate: a town tens of km
     off lights the base from low and to one side.
2. **Strength:**
   - start from `townIrradiance = TOWN_CLOUD_GAIN × ARTIFICIAL[b].zenith × s10Luminance() × π / 0.7`
     in render units, × colour (1, 0.70, 0.40);
   - only for Bortle ≥ 3, only when the sun is down.
3. **Calibrate once:**
   - use the existing spec field `skyDarkness` (1–4, forces the Bortle class);
   - render a forced overcast Bortle 4 night (`"weather": "overcast"`) and the same night
     `"clear"`;
   - probe the zenith base;
   - set `TOWN_CLOUD_GAIN` so overcast ≈ 2.8 × the clear artificial zenith;
   - write the probe numbers in this plan.
4. **Wire it in `createClouds`** like phase 3 (both passes). Off: `passes.townLight`.
5. **Remove the light-pollution line** from ARCHITECTURE.md "Known issues".
6. **Checks:**
   - `diff.mjs` on 3 real Bortle 3–4 cloudy nights
     (`snapshot.mjs --where 'p => p.timeOfDay === "night" && p.weather.kind !== "clear" && p.nightGlow?.bortle >= 3' --sample 6`);
   - `bench.mjs`.
7. **Commit:** "Towns light cloud bases from below (phase 7)".

**As built (0.190):**
- **The face approach, as phase 3:** the town light is added at the cloud's face, carried along
  the ray. There is no optical-depth march toward the town, for the same reason as phase 3
  (takram's clouds are thin).
- **Calibration:** the spec field `skyDarkness` 4, forced overcast vs `passes.townLight` off.
  - Deck overhead: 4.06·10⁻⁴ cd/m² with the town light, 0.98·10⁻⁴ without.
  - The clear artificial zenith is 1.75·10⁻⁴.
  - So the deck is 2.3× the artificial zenith (target 2.8, before the haze and the cloud's own
    transparency). No gain constant was needed.
- **Real nights** (29 cloudy Bortle 3–4 test nights): subtle warm undersides.
- **Bench:** +0–3%.
