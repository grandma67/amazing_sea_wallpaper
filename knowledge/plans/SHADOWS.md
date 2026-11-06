# Shadows and dark frames

**Status: planned 2026-11-06, phases not started.** Done before this plan: shade reaches the sea's
seabed, foam and body (0.105), skylight from clouds (0.106), shadows start at the stem (0.107).
Sources: end of this file. Estimates are marked; everything else was measured or read in the code.

## Goal

Everything the sun or moon lights also goes into shade, and everything solid enough to block it
casts shade: on the ground, on other objects and on itself. A frame too dark to read gets the longer
exposure a photographer would use.

## How games do it

| Technique | What games do | What it means here |
|---|---|---|
| **One main light, cascades** | The sun gets cascaded shadow maps: slices of the view, each with its own map, resolution falling with distance (Microsoft, NVIDIA) | We have one 4096² map over 640 m, plus a coarse land map to the horizon. Add a fine near slice where the camera is close |
| **Other lights on a budget** | Lights are ranked (screen area, distance) under a fixed budget. A spot costs one shadow map, a point light six. The rest go without shadows (Armory, Unity HDRP, three.js forum) | We have one light at a time: the sun or the moon. No point or spot lights exist (`scene.ts` adds only ambient ones). See phase 5 |
| **Self-shadowing** | The same map serves casting and receiving; objects shade themselves. A bias stops false self-shading (acne), and too much bias detaches shadows (peter-panning) | Works on props. Our bias was in fractions of a huge depth range, which caused the gap at tree stems |
| **Bias in texels** | Depth bias + slope-scaled normal offset was the most robust in DigitalRune's tests, "only as large as necessary" | Replace the fixed fractions (phase 3) |
| **Tight depth range** | Narrowing the depth range improves precision and lowers the bias needed (Unity docs: shadow pancaking) | Ours is 6490 m for a 640 m map |
| **Contact shadows** | A short ray march through the depth buffer catches small details the map misses; longer rays get noisier (Unreal: keep them short) | Stones, grass feet, shells: smaller than a 0.16 m texel |
| **Ambient occlusion** | Darkens indirect light only, never direct (GTAO, Unity HDRP) | Ground under a canopy keeps full skylight today (ideas list). Bake it where possible |
| **Cloud shadows** | Cheap: a projected texture over the terrain. Volumetric: a shadow map of the clouds (takram's Beer shadow maps, "shadows cast on scene objects") | We already have the map; only the sea and terrain read it |

From memory, not read in this research: engines apply cloud shade as a factor on the sun inside
every lit material ("light function"). I found no source on how Horizon or Red Dead do it; the Nubis
talk's slides may say.

## Where we stand

Direct light in one line: `sun × min(near map, land map) × cloud map`. Only the sea and terrain
compute all of it (`SHADOW_GLSL` is read only by `ocean.ts`, `terrain.ts`). Rows for props come from
a grep and from the code, so phase 0 confirms them mesh by mesh.

| | Casts | Near shadows | Mountain shadows | Cloud shadows |
|---|---|---|---|---|
| Sea | not needed | yes | yes | yes |
| Land (terrain) | **no**, in no map | yes | yes | yes |
| Trees, bushes | yes | yes | **no** | **no** |
| Grass | **no** (`castShadow: false`) | yes | **no** | **no** |
| Flowers, shore life | yes (confirm) | yes | **no** | **no** |
| Rocks, stones, debris | yes | yes | **no** | **no** |
| Animals on land, seals, colonies | yes | yes | **no** | **no** |
| Marine animals, migratory birds | yes | **confirm** | **no** | **no** |
| Boats, ships, lighthouse | yes | yes | **no** | **no** |
| Ice | yes | yes | **no** | **no** |
| Islands | land map only | yes | **no** | **no** |
| Mountains (landforms) | land map only | **confirm** | **no** | **no** |
| Leaf litter, marsh | no: smaller than a texel | yes | **no** | **no** |
| Surf spray | no | own shader | **no** | **no** |
| Lamps, lava, lightning (unlit) | no | not needed | not needed | not needed |

## Phases

Order: each phase is judged better after the one before. Cost is checked with `bench.mjs`; adding
over ~10% needs a reason.

### 0. Prove coverage first

- Debug report `debug.shadowCoverage`: every lit material in the scene, by prop kind, and whether it
  reads the shared shade. Test: none missing, listed exceptions only.
- `passes.cloudShade: false` and a false-colour shade view in `params.debug` (the temporary one used
  while investigating, made permanent).
- `scenes/shadows.json`: one scene per row of the table. Render with shade forced to 0: anything
  still sunlit isn't covered. Also front-lit and backlit.

**Done:** the table above is filled in from the report instead of a grep.

### 1. Every lit object receives all three shades

All standard materials go through three.js's `lights_fragment_begin`, so this is one patch: multiply
`directLight.color` by the shared `land map × cloud map`, with one loop over the props.

- Chain to a material's own `onBeforeCompile` (13 places) and extend `customProgramCacheKey`, or
  programs get mixed up. `props/wash.ts` shows the way.
- Apply it regardless of `receiveShadow`: clouds shade everything.
- Sky light stays. Lit by the sky cube, shaded props keep their colour.
- Surf spray: read the shade once per particle in its own shader.
- Split the cloud part out of `SHADOW_GLSL`. Share uniform objects per render (everything is freed
  per day, LEAKS.md; run `npm run check:restart`).

**Done:** phase 0's forced shade darkens every row. Fixes bushes in sun on shaded ground, and
mountains get cloud patches. Cost, estimate: one texture read per prop pixel, small.

### 2. Everything solid casts

| Caster | How | Note |
|---|---|---|
| **Terrain** (cliffs, shelves, dunes) | Draw its mesh into the near and land maps | The largest gap. It can then shade itself, so it needs phase 3's bias first |
| **Grass** | Cast only within ~40 m (estimate) of the camera, reduced blades | 7000 per kind: test the cost. Grass ~1 m tall is a few texels |
| **Flowers, small life** | Confirm from phase 0; add where missing | |
| **Mountains, islands** | Also in the near map where inside it | So they shade props on themselves |
| Leaf litter, marsh, shells | Stay out: below a texel | Contact shadows cover them (phase 4) |

**Done:** a cliff shades the beach below it (a low sun behind it); each caster shows with
`diff.mjs --off`.

### 3. Sharper and steadier maps

- Bias in **texels** with slope-scaled normal offset, on our own samplers and props. Then terrain
  can enter the maps without acne.
- Tight near and far around what's in the map, not 10–6500 m.
- A second, fine near slice: the view's first ~40 m (estimate) at ~0.02 m per texel. Fit slices to
  what the camera sees.
- Cloud map: cap `shadow.maxFar` near the horizon instead of the 400 km camera limit (~120 m per
  texel now, by calculation). Trace the straight-edged wedge seen from 450 m (2026-11-03,
  `sunElevationDeg` 60, `camera.heightM` 450, `horizonFraction` 0.3, `focalLengthMm` 18).
- For live mode: snap maps to whole texels, or they shimmer as the camera moves.

**Done:** no acne in `scenes/shadows.json` close up; shadow edges of near grass and trunks are clean.

### 4. Small-scale shade

Only after the maps are right. Bake first, as this project prefers.

1. **Occlusion under trees and in rock joints:** darkens skylight only. Bake into vertex colours per
   instance; for the ground, a darkening under each near tree from its position.
2. **Contact shadows:** a short depth-buffer march toward the sun for near pixels. Costs per pixel,
   so only if stones and grass feet still float. `stillScene` draws the scene once, so it runs once.
3. **Softness by height** (a treetop's shadow softer than the trunk's): last, if at all.

### 5. Other lights

| Light | Shadow? | Why |
|---|---|---|
| Sun or moon | yes: all of the above | Only one lights the scene (`lightDirection`) |
| Sky, clouds, aurora, airglow, starlight | no: occlusion only | Light from everywhere casts no edge |
| Lamps on ships and shore | no | Small and far; their glitter is on the sea already (12 at most) |
| Lighthouse lantern | **at most one**, a spot map, if a near lighthouse shows it | Budget of 1, the games' pattern: rank, cap, the rest go without |
| Lightning | no | One flash, far off |

So no multi-light shadow system is needed. Revisit if a lit harbour or campfire is added, or for live
mode.

### 6. Dark frames: the long exposure

**The problem.** `2014-12-29` (moonlit, overcast, Greenland) renders nearly black. Exposure is metered
from the *clear* sky in the env cube, then lowered for night, and it doesn't see the deck. Sampled by
final luminance, median of 15 points per frame:

| Kind of night (1095 days) | Days | Sampled | Median brightness (of 255) |
|---|---|---|---|
| Broken or overcast | 22 | 11 incl. 2014-12-29 | **9 of 11 at 0–1**, others 9 and 41 |
| Moonlit, open sky | 56 | 5 | 15–95 |
| Starlit, open sky | 35 | 4 | 1, 32, 47, 58 |

The picture is there: `2014-12-29` at ×8 and ×32 shows sea ice, an island and what look like two
fins. At ×8 it's still clearly night; ×32 reads as dusk.

**Camera numbers.** A reflected-light meter (N²/t = L·S/12.5, from memory): at f/2.8, ISO 1600,
t ≈ 0.061 / L seconds, L in cd/m². So `2014-12-29` (6.0e-4) needs ~100 s, `2025-06-01` ~320 s,
`2025-11-13` ~1070 s. Comparable with the guide's 10–15 s at ISO 1600–2000 under a quarter moon on a
clear night, given a cloud deck in the way. Exposure tables disagree widely, so these are rough.

**Step 1: meter the frame (fixes visibility).**
- Read the median of the actual frame in linear light, before the grade. Exposure is a uniform on
  `GradeEffect`, so it can be set after this reading.
- Open up only if below a floor: `boost = clamp(floor / median, 1, max)`. Frames already bright enough
  don't change, so sunset moods and bright moonlit nights stay.

| | Floor (exposed) | Max boost | Effect |
|---|---|---|---|
| Night | ~0.05 (about the ×8 picture) | 6 stops | `2014-12-29` +3.3 stops; `2025-11-13` +5.2 |
| Day in shade | ~0.10 (to tune) | 1.5 stops | Also the Brittany beach (ARCHITECTURE.md "Dark land") |

- A bright moon or lamp in frame clips, as it does in a real long exposure. Keep the median, not the
  mean, so it doesn't pull the rest back down.
- Respect `params.debug.exposure` (`diff.mjs --keep-exposure`).

**Step 2: the look of the shutter time.** `shutterSeconds` comes from L as above, and is kept in
`debug`. The time is chosen as a photographer does:
- **Stars in frame:** stay under the 500 rule (500 / focal length: 11 s at 45 mm), raising ISO instead,
  so stars stay points and open nights look as they do now.
- **Stars hidden by cloud:** nothing to lose, so go long.

| Shutter | Water | Clouds | Sky |
|---|---|---|---|
| < 0.5 s | as now | as now | as now |
| 0.5–2 s | keeps its shape, details soften | as now | as now |
| 2–30 s | smoothing: raise roughness, less sparkle and fine foam | slight drift | stars still points if under the rule |
| > 30 s | glassy with a soft sheen; foam a haze | **streaks** along the wind, drawn in over the frames we already average | star trails if any show through |

All cheap: water changes a shader's numbers, clouds shift the weather offset per accumulated frame.
No extra frames (estimate).

**Check before tuning:**
- The grey band at the horizon shows strongly at ×32, and the overcast sky looks clear blue and smooth.
  Both need tracing first, or brightening exposes them.
- Night white balance has blue at ×1.77 (`2014-12-29`); check it's still right at this brightness.
- Lighthouse beams, aurora and bloom all scale with exposure.

**Done:** all 22 cloudy nights read in a contact sheet; open nights unchanged in `diff.mjs`; a test of
`boost` and `shutterSeconds`.

## For each phase

Specs over dates; `diff.mjs` proves it shows; a contact sheet of `scenes/shadows.json`; `npm test`,
`npx tsc --noEmit`; `params.mjs --ref HEAD` (expect 0 days, except a new spec field); update
changelog, `arch/SKY.md`, LESSONS.md. One commit per phase.

## Questions for later

1. **How bright should a dark night be?** ~×8 (still night, recommended) or ×32 (dusk-like).
2. **Long-exposure look:** on by itself whenever the shutter is long (recommended), or brightness only?
3. **Grass casting:** worth its cost? Decide from phase 2's numbers.

## Sources

Read: [DigitalRune, shadow acne and bias](https://digitalrune.github.io/DigitalRune-Documentation/html/3f4d959e-9c98-4a97-8d85-7a73c26145d7.htm);
[Unreal, contact shadows](https://dev.epicgames.com/documentation/en-us/unreal-engine/contact-shadows-in-unreal-engine);
[mkaz, moonlight exposures](https://mkaz.com/articles/exposures-for-moonlight-photography/);
`node_modules/@takram/three-clouds/README.md`.

Search summaries only, full pages not read:
[Microsoft, cascaded shadow maps](https://msdn.microsoft.com/fr-fr/library/ee416307.aspx);
[NVIDIA, cascaded shadow maps](https://developer.download.nvidia.com/SDK/10/opengl/src/cascaded_shadow_maps/doc/cascaded_shadow_maps.pdf);
[Unity, troubleshooting shadows](https://docs.unity.com/en-us/engine/6000.3/manual/lighting-overview/shadows/shadow-performance.md);
[Armory, shadow atlasing](https://www.github.com/armory3d/armory/wiki/Shadow-Map-Atlasing);
[Catlike Coding, point and spot shadows](https://catlikecoding.com/unity/tutorials/custom-srp/point-and-spot-shadows/);
[three.js forum, many shadows](https://discourse.threejs.org/t/large-number-of-shadows-webgpu/91223) (one developer's report);
[Activision, GTAO](https://research.activision.com/publications/archives/practical-real-time-strategies-for-accurate-indirect-occlusion);
[Unity HDRP, ambient occlusion](https://github.com/shenzhou05/SRP-Chinese-Translation/blob/master/Pages/HDRP/Ambient-Occlusion.md);
[Khronos forum, cheap cloud shadows](https://community.khronos.org/t/cheap-dynamic-cloud-shadows/13190);
[Guerrilla, Nubis](https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine);
[Live Science via inkl, night for day](https://www.inkl.com/news/night-for-day-astrophotography-guide-using-long-exposure-times-to-turn-night-to-day) (fetching the page failed);
[Photrio, moonlight EV](https://www.photrio.com/forum/threads/moony-16.49349/unread);
[Expert Photography, 500 rule](https://expertphotography.com/500-rule-night-sky-photography);
[SLR Lounge, long exposure](https://www.slrlounge.com/glossary/long-exposure/);
[Fstoppers, waves and shutter speed](https://fstoppers.com/landscapes/what-really-happens-waves-change-shutter-speed-900088).
