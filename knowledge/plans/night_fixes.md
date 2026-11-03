# Night fixes: aurora (NIGHT_SKY phase 6)

Written 2026-11-04 from the example renders after the night-colour change (changelog 0.89).
What the aurora does today: [NIGHT_SKY.md](NIGHT_SKY.md) phase 6 (on the branch). Research:
[STARS.md](../STARS.md) §8.

## Where things are

- Code: branch **`night-sky-aurora-wip`** (rebased on `main` after 0.89; one WIP commit).
  `src/aurora.ts` (choice, geomagnetic latitude, Kp, GLSL), `src/params.ts` (step 5: drawn after
  the night's moon; step 11: dropped by fog, storm or overcast), `src/scene.ts` (patch both skies
  before the night glow, metering without the aurora, +1.5 EV, ground light).
- Not done on the branch: `test/aurora.test.ts`, docs (changelog, SKY.md, STARS.md, SCENE_SPECS,
  ARCHITECTURE draw order), `scripts/animals.mjs`-style share table for the doc.
- Example specs (save as `scenes/aurora.json` on the branch and use them for every check):

  ```json
  { "base": { "timeOfDay": "night", "weather": "clear", "eclipse": null, "fog": null, "storm": null, "aurora": true },
    "scenes": [
      { "name": "1-tromso-quiet", "date": "2026-01-20", "place": "norway-north", "nightSky": "starlit" },
      { "name": "2-tromso-calm-sea", "date": "2026-01-20", "place": "norway-north", "nightSky": "starlit", "aurora": "strong", "swellHeight": 0.3, "wind": 1 },
      { "name": "3-iceland-moonlit", "date": "2026-02-01", "place": "iceland", "nightSky": "moonlit" },
      { "name": "4-scotland-storm", "date": "2026-02-18", "place": "scotland", "nightSky": "starlit", "aurora": "strong" },
      { "name": "5-maine-big-storm", "date": "2026-03-20", "place": "maine", "nightSky": "starlit", "aurora": "strong" }
    ] }
  ```

  Current state of each: 1 a faint green haze over the whole sky, no arcs; 2 a recognisable
  display (green and red arcs, rays) with diagonal streaks and too much pink; 3 nothing (right:
  the full moon hides a quiet display); 4 a red band with rays (right for a low-latitude storm),
  streaky; 5 the display overhead out of frame, the ground lit teal.

## How to work (read first)

- **Numbers before renders.** Write a TypeScript mirror of the shader's ray march in
  `aurora.ts` (same layers, footprint, profiles, colours; the project's rule, LESSONS.md
  "Debugging approach"), test it, and print the brightness of rays at the frame's elevations
  (2–30°) and a few azimuths against the local sky. A throwaway JS port of it found the side-on
  arc and band-width problems in one run; renders alone took 8 rounds.
- **Measure renders with the probe** (`params.debug.probe`, tools/DEBUG.md): an arc and the sky
  beside it (`{az, el}`), raw cd/m² and final RGB. Where the display stands in the frame:
  `src.skyFrame` (`project`, `pixelOf`).
- Render with `snapshot.mjs --w 1920 --h 1080 --frames 16 --scene scenes/aurora.json`; after a
  GLSL edit, `--w 320 --h 180 --frames 1` first (`patch` is a reserved word; LESSONS.md
  "Shaders"). Judge colours by the probe's final RGB, not the thumbnail.
- Prove each fix with `diff.mjs --scene scenes/aurora.json --ref HEAD` and a crop
  (`contact-sheet.mjs --match '^NAME$' --region …`). At most ~3 render rounds per fix; past that,
  go back to the JS port.
- Keep every change physical (kR, profiles, transmittance) and say so in the code comment; no
  per-scene fudge factors.

## Fix 1: diagonal streaks in the rays (examples 2, 4)

**Cause.** The march samples 28 fixed layers (92–320 km). Each layer reads the footprint at its
own horizontal point. Low in the sky, neighbouring layers' points are `spacing = dh / tan(el)`
apart along the ray (8 km / tan 10° ≈ 46 km), while the rays' noise
(`auNoise(y / (1.5 + fi))`) repeats every 1.5–4.5 km along the arc. Each layer picks an unrelated
ray value, and stacking them makes regular diagonal stripes (aliasing). The sheet itself is
already widened by `spacing` (`width = max(ARC_KM, 0.7 * spacing)`); the rays are not.

**Do.**
1. Per layer, compute how far the sample moves along the arc between layers:
   `dy = abs(dot(rayDirection, east)) * dh / sinEl` (km). Fade the rays' contrast where it
   exceeds their period: `rays = mix(1.0 - 0.55 * 0.5, rays, clamp(period / dy, 0.0, 1.0))`
   (keep the mean, lose the detail that can't be sampled), with `period` the ray noise's scale.
2. Offset the layer heights by a per-pixel hash in [0, 1) × `dh` (one value per pixel, the same
   for every layer), so what aliasing is left becomes fine grain instead of stripes. Clear nights
   render 1 frame (no accumulation): check the grain at 1080p is below the stars' visibility.
3. If the rays still matter overhead (they should: corona and rays looking up), keep their full
   contrast where `dy` is small (high elevations, looking across the arc).

**Check.** JS port: brightness along a horizontal line of pixels at 10° shows no periodic
pattern with a period tied to the layer spacing. Render 2 and 4 at 1920×1080 and crop the arcs:
no diagonal stripes; vertical rays still visible where the arc is high. Render time within 10%
of `main` on aurora nights (`bench.mjs --scene scenes/aurora.json`).

## Fix 2: too much pink and red (examples 2, 4)

**Cause.** `red` and `fringe` are shares of the display's **luminance**, but they are drawn as
if they were shares of its light: `red = 0.1 + 0.05·Kp (+0.3 for low-latitude storm arcs)`, up
to 0.9; `fringe = 0.15–0.35` on Kp ≥ 5. The red 630 nm line has a small luminance weight
(~0.27 of 555 nm), and `AURORA_COLOURS.red` is luminance-normalised, so (1, 0.08, 0.12) becomes
R ≈ 3.6: a 30% luminance share already makes the arc red. Same mistake as the airglow's red line
(LESSONS.md, the night-colour bullet). Real displays are mostly green with red tops; the purple
N₂⁺ fringe is a thin lower edge on strong, fast-moving curtains.

**Do.**
1. Red share of luminance: ~0.03–0.08 for ordinary displays, rising with Kp; up to ~0.25–0.4
   only for equatorward arcs in strong storms (Kp ≥ 7 seen from below the oval: the red tops are
   what rises above the horizon there, and SAR arcs are red). Look up one source for green/red
   intensity ratios (e.g. typical 557.7 vs 630 nm kR in active aurora) and cite it in
   REFERENCES.md; mark anything else *(general)*.
2. Fringe: ~0.01–0.04 of luminance, only Kp ≥ 5, and only in the bottom few km (the profile
   already does that).
3. Keep the profiles (green ~110 km, red ~230 km): with the right shares the red shows only at
   the top of tall curtains, as in photos.

**Check.** Unit test over `scenes({ aurora: true, … })` and forced Kp 2, 5, 9: an overhead
column's RGB (from a TS mirror of the profile × colour sum) has G > R for every under-oval
display; R > G only for equatorward arcs at Kp ≥ 7. Renders 2 and 4: green arcs with red tops
(2), a red-topped arc low on the horizon (4). Sample pixels: arc body G/R > 1.5 in example 2.

## Fix 3: quiet nights are a flat green haze, not arcs (example 1)

**Cause.** From the JS port (Tromsø, Kp 2, 7.5 kR, observer 248 km inside the oval, facing the
pole): rays at 10–20° get 1.5–3× the dark zenith, almost all from the **diffuse** band. Its
path across the 888 km oval at a low angle is long, so even `DIFFUSE = 0.05` of the arc peak
adds up; the four arcs, seen side-on, give each ray only ε(h) × 25 km (~0.3 of their overhead
column). The `patchy` term (`smoothstep(0.25, 0.65, fbm)`) also removes about half of each
arc's length.

**Do.**
1. Diffuse aurora: cut to ~0.01–0.02 of the arc peak per km of path, or give it its own lower,
   thinner profile (it peaks lower and fainter than discrete arcs). Target: diffuse ≤ 0.5× the
   local sky in frame on a quiet night.
2. Quiet displays are arc-dominated: one or two bright, continuous arcs (not four patchy ones),
   3–10 kR column, `patchy` milder (`smoothstep(0.1, 0.5, …)`). Active displays (Kp ≥ 4): more
   arcs, folds, patchiness.
3. Put the brightest arc where a frame sees it: for an observer under the oval, an arc 150–400 km
   poleward (10–30° up) is the classic view. Today the arc positions are fixed fractions of the
   band from its equatorward edge; place the first arc relative to the observer instead, on its
   own stream draw (`'aurora'`, append the draw at the end so other values don't move).

**Check.** JS port on example 1: arc peak in frame ≥ 2× the surrounding sky, the sky between
arcs ≤ 1.5× the plain night sky. Render 1: a visible green arc over the sea, dark sky around it.

## Fix 4: ground light too strong under an overhead storm (example 5)

**Cause.** `auroraLux()` = column strength × 1000 × `RAYLEIGH_CD` × 0.15 sr (overhead) or
0.03 sr (arc). The column strength is the brightest arc's, looking straight up through it, not
the sky's average, so a Kp 9 night (143 kR) lights the ground at ~0.004 lux in green, more than
the whole starlit night (0.002 lux), from a display mostly out of frame. The teal comes from
that light plus the 4000 K balance.

**Do.**
1. Compute the illuminance from the sky as drawn: integrate the TS mirror of the shader over the
   upper hemisphere (a coarse grid, e.g. 24 azimuths × 8 elevations, cos-weighted) in
   `auroraLux(a)`. It runs once per render on the CPU: keep it under ~2 ms.
2. Sanity numbers to test against: IBC III (~100 kR) ≈ the light of moonlit cumulus; IBC IV
   (~1000 kR) ≈ full-moon light (~0.1–0.3 lux; general, check one source). A Kp 9 overhead
   display should light the ground no more than a quarter moon (~0.01 lux).
3. Framing for overhead storms: when the observer is near the equatorward edge of a big oval
   (example 5, Maine at Kp 9), the display's lower edge stands poleward 20–40° up. Turn toward the
   pole (as now), and check `horizonFraction`: the frame must reach that high, or the aurora is
   out of frame. If it isn't, prefer a "more sky" framing on aurora nights (own stream draw), as
   eclipses do (`erng.range(0.56, 0.66)`).

**Check.** Test: `auroraLux` for forced Kp 2, 5, 9 under the oval is within the IBC ranges
above, and grows with Kp. Render 5: the arc in frame, the ground only faintly green.

## Fix 5: the calm sea doesn't mirror the arcs (example 2)

**Cause: not known yet.** The aurora is patched into the reflection cube's sky too, so a glassy
sea should show the arcs. What shows is a pinkish smear. Candidates: (a) the cube's 256² faces
(~0.35°/texel) and the same layer march make the arcs blobby and red-weighted there (the red tops
are wide, the green bases thin); (b) the ocean's roughness mip level blurs the reflection even
at wind 1 m/s; (c) metering: the cube's aurora scale is zeroed during metering and restored, so
check it is really restored before the cube renders (`auroraA.w` after `meterScene`).

**Do.** Diagnose before changing anything:
1. Render example 2 with `params.debug` switches (tools/DEBUG.md): sea views and passes; render
   a flat mirror (`swellHeight: 0.05`, `wind: 0`). Does the smear follow the arcs' azimuth?
2. Read `auroraA.w` on the env sky material before and after the cube render (a temporary
   `console.warn('DBG …')`, removed after).
3. If (a): widen the arcs in the cube by its texel size (as `width` already does with layer
   spacing) so they keep their light and shape. If (b): compare with the moon's glitter path
   on a calm night (it reflects fine) and with the stars, which are drawn in the cube without
   the march.

**Check.** Render 2 with a near-flat sea: the green arcs mirrored under themselves, a little
blurred, same colour as above.

## Finishing (after all five)

- `test/aurora.test.ts`: Kp table (shares sum to 1; storm days scale with the cycle);
  `geomagnetic` against known points (Tromsø ~67°, northern Scotland ~57.5° after the Europe
  correction, Maine ~54°); the oval and reach (Kp 5 reaches ~53°, 7 ~49°, 9 ~45°); shares on
  clear dark winter nights by place (Tromsø 50–75%, Iceland 45–70%, northern Scotland 10–30%,
  Maine and the Wadden Sea ≤ 5%) via `scenes`; never by day, in twilight, under overcast, storm
  or fog unless forced; the spec field (`true`, `"strong"`, `null`); framing puts the display
  ahead; the colour test from fix 2 and the light test from fix 4; determinism.
- `params.mjs --ref HEAD`: count the changed days (the framing turns sun and moon on aurora
  nights; ~9% of nights carry an aurora).
- `bench.mjs` on `scenes/aurora.json` and the default dates: within 10% (the march is 28 layers ×
  4 arcs per sky pixel on aurora nights only).
- Docs: changelog row, NIGHT_SKY.md phase 6 "Done", arch/SKY.md, STARS.md §8 (numbers used:
  NOAA scales, kR conversion, shares), SCENE_SPECS.md (`aurora`), ARCHITECTURE.md draw order
  (steps 5 and 11) and the place-table row (`AURORA_SITES`), REFERENCES.md, LESSONS.md (side-on
  arcs vs the overhead column; luminance shares of coloured lines; metering without an
  out-of-frame light).
- Merge `night-sky-aurora-wip` into `main` as one commit ("Aurora (NIGHT_SKY phase 6)").
