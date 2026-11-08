# Reflections that follow the waves

**Status: planned (2026-11-08), nothing built.** Research and sources:
[../REFLECTION.md](../REFLECTION.md) (§ numbers below refer to it). How the reflection works
today: [../arch/OCEAN.md](../arch/OCEAN.md) "Reflections". Estimates are marked; everything else
was measured or read in the code.

## Goal

The sea mirrors land, islands, mountains, rocks, boats and people the way real water does.
Distance alone never removes a reflection. What decides is how rough the water is where the
reflected ray leaves it, compared with how tall the object looks, plus the haze along the way:

- a glassy morning: sharp, full images of every island and mountain, hazed like the things
  themselves;
- a windy day (2003-03-11, 14.9 m/s): only a soft, slightly darker column under each island;
- in between: vertical streaks, sharp where an object meets the water (contact hardening).

## Where we stand (read in the code, 2026-11-08)

| Piece | Today | Problem |
|---|---|---|
| Mirror render | `reflection.ts`: the scene from a camera mirrored in y = 0, half res, depth texture; drawn once per image (not per frame) | fine |
| Far objects | `userData.distant` (islands > 5 km `islands.ts:349`, all landforms `landforms.ts:329`, two cloud events) is left out (`scene.ts` ~930) | stands in for missing haze (§2) |
| Wave shift | `uv = base + N.xz · 0.04 · k` (`ocean.ts` ~549) | ~130× too small for a 63 mm lens and blind to the lens (§5.1) |
| Blur | `textureLod(planarMap, log2(α·300·k))`, α from unresolved waves only | the drawn waves never blur it: a 15 m/s sea keeps a crisp image (§5.2) |
| Shape | one isotropic lookup | round smudges, not vertical streaks (§1.3) |
| Haze | none on the mirror path | far images too dark and sharp |
| Wet sand, pools | `terrain.ts` ~1367: env map only | no rocks or cliffs in rock pools or the swash film |
| Sky reflection | `reflect(-V, N)` into the env cube, lod from α | already physical: the planar part should match it |

Cost measured 2026-11-08 (`bench.mjs`, 4 days with mountains): drawing the far objects in the
mirror is 0% (2.1/2.3/2.0/2.6 s before and after).

## Scope

- 41.6% of test days have a far object (a landform or an island past 5 km): phase 1.
- Phase 2 changes every day with a mirror image (any land or prop); count it in phase 0.
- Wind over the test days: 0–2.5 m/s 20.5%, 2.5–5 24.7%, 5–7.5 23.7%, 7.5–10 12.4%,
  ≥ 10 m/s 18.6% (`params.mjs --stats`). So about a fifth of days should keep a near-mirror,
  and about a fifth should lose most mirror images of small objects.
- Views: shoreline, along-beach, framed, overlook and open sea; all coasts. Night: lamps
  (`lampSprites`, mirrored as point lights) and the moon's glitter stay as they are.
- Live mode: everything here is decided per sea pixel from world positions and slopes, with no
  rule that reads the camera distance. That's the right way round for a moving viewer.

## Phase 0: numbers first

1. **Reference photos (2–3 each)**, to state what to match before any render: islands on a
   glassy sea; islands or a headland on a windy sea from a beach (the soft column);
   streaks (a lit pier or boat on a rippled harbour). Without them the look is an estimate:
   say so.
2. **Total slope variance vs Cox–Munk.** The FFT cascades draw part of the slope and `variance`
   carries the rest. Add a debug output (`params.debug.probe` line or a false-colour view,
   tools/DEBUG.md) of σ² = resolved (over the pixel) + unresolved, at 50 m, 500 m and 3 km, for
   wind 1, 5, 10, 15 m/s (`wind` spec field). Target: §1.2 (0.008, 0.029, 0.054, 0.080), with
   calm days below the fit (it overstates them). If the spectrum is far off, that is a waves
   issue, not a reflection one: raise it before going on.
3. **Scene file** `scenes/reflection.json`, base `timeOfDay: "daylight"`, `weather: "clear"`,
   `eclipse: null`:
   - `windy-islands`: 2003-03-11 as it is (and `sunAzimuthDeg: 160` front-lit);
   - `calm-islands`: the same, `wind: 1`, `swellHeight: 0.2`;
   - `mid-islands`: `wind: 5`;
   - `mountain-calm` / `mountain-windy`: a `landform: "range"` day at wind 1 and 12;
   - `cliff-near`: a rock-shore cliff top, wind 5 (near objects: contact hardening must stay);
   - `boats`: ships near and far, wind 3;
   - `cloudy-islands`: `windy-islands` under broken cloud (the haze path differs: CLAUDE.md
     says to check haze features on a clear and a cloudy sky).
4. **Day count:** `params.mjs --stats` for days with a mirror image at all, for the changelog.

## Phase 1: haze on the mirror path, no distance cutoff

The reflected light travels object → water (t, from `planarDepth`) → eye (D). The sea pixel
already gets the haze over D from the main pass; the mirror image needs the haze over t
(§2).

- In the ocean shader: `T = exp(−β·t)`, `reflectedObject = mix(horizonSky, planar, T)`, β and
  the far colour the same as the frame's own haze uses for objects: the sea haze (`seaHaze.ts`,
  Koschmieder 3.912 / V, colour of the sky behind) when the clouds pass runs, else the
  Bruneton air's own (`SKY_EXTINCTION`). The "sky behind" is the env cube along the reflected
  ray at the horizon. Premultiplied: haze the colour, keep the coverage.
- Then drop `...props.children.filter(o => o.userData.distant === true)` from `hide`.
  Keep `distant` where something else reads it (`props/index.ts:108` water islands); check
  the two cloud events (`cloudEvents.ts`): they are clouds, mirrored by the env cube, so keep
  them hidden under a flag of their own (`userData.skyLike`) rather than `distant`.
- Switch: `passes.reflectionHaze` (off = today's image, cutoff included: check with
  `diff.mjs --ref HEAD --off-here`, "identical").
- **Done when:** on `calm-islands` the far island's image at its waterline matches the island's
  own colour there × Fresnel within a few % (`probe` on both); the volcano on 2003-03-11 leaves
  no dark wedge; `diff.mjs` vs the switch off shows the far island's image on all far-object
  specs and nothing invisible.

## Phase 2: project the reflected ray (the wave shift and the drawn waves' blur)

Instead of nudging the lookup by `N.xz · 0.04`, follow the ray the sea already computes for the
sky, `R = reflect(−V, N)`:

1. `t` from `planarDepth` at the unshifted point (as today, for k).
2. The hit estimate `H = P + R · t` (P the sea point), mirrored in y = 0 and projected with
   `planarMatrix` → uv.
3. Look up `planarMap` there.

What this gives, with no tuned constants *(my working, check in phase 0's numbers)*:
the 2β turn of the ray; contact hardening (small t → small move); the lens (the projection
handles it); and the vertical streaks, since R swings up and down far more than sideways at low
grazing (§1.3). The drawn waves then spread the image the way they already spread the sky
reflection, and the frames' averaging and the normals' mips smooth it.

- Unresolved waves: blur by their angle, converted to texels of the mirror target:
  `lod = log2(2·atan(α/√2)·t/(D+t) / φ · targetHeight)`, φ the vertical field of view. The
  same α already sets the env-cube lod, so sky and objects blur alike. Let the lod go above the
  6 used today when the spread asks for it (it is a box average of premultiplied colour: exactly
  the "mean of sky and object over the band" of §1.2).
- If R points down after the turn (masked facet), keep today's `R.y = abs(R.y)` rule, as the sky
  does.
- Switch: `passes.reflectionRay` (off = phase 1's image).
- Risks: the hit estimate uses one depth for the whole neighbourhood, so near edges (a boat's
  bow, a cliff's foot) a ray that should miss can land on the object; compare `cliff-near` and
  `boats` before and after with `--crop`. Sparkle where waves are smaller than a pixel: the
  normals there come from mips, so check the far sea at 4K.
- **Done when:** `windy-islands` shows a soft darker column under island 1, ~5% darker than the
  sea beside it at the waterline (`probeLine` down the column vs beside it; §0 estimate);
  `calm-islands` keeps a sharp image; `cliff-near` keeps its contact line; render time within
  +2% (`bench.mjs`).

## Phase 3: anisotropic blur for the unresolved waves (only if phase 2 needs it)

Phase 2 streaks the drawn waves. The unresolved ones still blur round (one `textureLod`). If
the far sea shows round smudges under islands at 1080p, add 3–5 taps along the screen's
vertical with the sideways blur × sin γ (§1.3). Arch/OCEAN.md's 10-31 note found it not worth
it then; decide from the phase 2 renders, not before.

## Phase 4: wet sand and rock pools mirror the scene

`terrain.ts` gloss reads only the env cube. Pools and the swash film are flat water at about
sea level, so the same mirror target works near y = 0 (exact for pools at the plane, close for
the swash film a few cm to ~1 m up *(estimate)*). Use the phase 2 lookup there with the film's
own roughness (`alpha` in terrain gloss). Wet rock stays a dull sheen.

- **Done when:** a rock-shore day with pools mirrors the nearby boulders and the cliff, and a
  beach day at low sun mirrors people and posts in the swash; `diff.mjs` with the switch off
  on both.

## Later (separate plans)

- **Calm in the lee of islands and headlands** (§1.4: 7–15× the obstacle's height downwind):
  a wind-shadow mask beside `shelter.ts`'s swell mask, damping the short cascade and the
  unresolved variance. With phases 1–2 done, mirror patches behind islands come for free.
- **Natural slicks**: glassy bands on light-wind days (surfactants; Cox–Munk's slick fit is
  about a third of the clean slope at 10 m/s).
- **Melt ponds on summer sea ice** (Malinka 2018): still water, sky-blue to turquoise, up to
  60% of multiyear ice; they'd read the mirror target too.
- **Whitecaps on windy days**: 2003-03-11 has none at 14.9 m/s; not a reflection matter.

## Tests

- `test/glsl` after every shader edit; then `--w 320 --h 180 --frames 1`.
- `propSwitches.test.ts` / `sceneSpec.test.ts` rows for the new switches; a unit test of the
  phase 2 lookup's maths in TS (a flat sea gives today's uv; a tilt β turns the hit by 2β; the
  lens drops out).
- Real days in the first render round: `snapshot.mjs --where 'p => p.landform || p.islands' --sample 8`.
- Before commit: `npm test`, `npx tsc --noEmit`, `params.mjs --ref HEAD` (should be 0 days:
  no choice changes), `bench.mjs` (≤ +2% per phase, 10% overall).

## Docs to update as phases land

arch/OCEAN.md "Reflections", ARCHITECTURE.md (known issues: the cutoff goes), LESSONS.md,
REFLECTION.md §5 (what the code does), changelog.md, tools/DEBUG.md (the slope-variance view).
