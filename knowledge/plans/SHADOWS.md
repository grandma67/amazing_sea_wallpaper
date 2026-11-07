# Shadows and dark frames

**Status: phases 0–5 done (0.109, 0.123, 0.124–0.127), phase 6 open.** Left from phase 2: terrain in the land map
(cliffs beyond ~470 m ahead cast nothing). Decided 2026-11-06: dark nights at ~×8; the
long-exposure look turns on by itself when the shutter is long. Done before this plan: shade reaches the sea's
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

Direct light in one line: `sun × min(near map, land map) × cloud map`. The sea, terrain and every lit
prop now read the land and cloud maps (`propShade.ts`). Near shadows depend on each object's
`receiveShadow`, and casting on its `castShadow`. Counts from `debug.shadowCoverage` over
`scenes/shadows.json` (objects, not instances); 2026-11-06:

| Kind | Lit, all shaded | Casts | Receives near shadows | Gap for phase 2 |
|---|---|---|---|---|
| Sea, terrain | own shaders | terrain: near map (0.123) | yes | terrain not in the land map |
| Vegetation | 196 | 196 (0.123) | 196 | |
| Shore life (flowers, crabs...) | 97 | 97 | 97 | |
| Debris | 60 | 60 | 60 | |
| Rocks, stones, beachrock | 40 | 40 | 40 | |
| Boats, ships | 22 | 22 | 22 | |
| Ice | 8 | 8 | 8 | |
| Mangroves | 3 | 3 | 3 | |
| Lighthouse | 3 | 2 | 2 | |
| Wildlife (8 forced scenes) | 2–5 per scene | all | all | |
| Birds, migratory birds | 42 | 42 | 42 (0.123) | |
| Marine animals | 10 | 10 | 10 (0.123) | |
| Seals | 6 | 6 | 6 (0.123) | |
| Colony | 4 | 4 (0.123) | 4 | |
| Islands | 5 | both maps (0.123) | 5 | |
| Mountains | 3 | both maps (0.123) | 3 | |
| Salt marsh, leaf litter | 8 + 4 | no: smaller than a texel | yes | |
| Surf, whale and ship spray | own shader, per droplet | no | no | |
| Lamps, lava, lightning | unlit | no | not needed | |
| Shelf and roll clouds | left out: they are clouds | no | no | |

## Phases

Order: each phase is judged better after the one before. Cost is checked with `bench.mjs`; adding
over ~10% needs a reason.

### 0. Prove coverage first: done

`debug.shadowCoverage` by prop kind (a snapshot ⚠ if a lit object isn't shaded), `passes.cloudShade`,
`params.debug.cloudShade` (force the shade) and `shadeView` (show it), `scenes/shadows.json`. With
`cloudShade: 0` and `shadeView`, anything not black doesn't read the shade: tools/DEBUG.md.

### 1. Every lit object receives land and cloud shade: done

`propShade.ts`: one patch of three's `lights_fragment_begin`, one loop over the props. Spray per
droplet. Render time +0–4% on 3 days. No lit object uncovered in 28 scene and 44 sweep renders.

### 2. Everything solid casts: done (0.123), but not terrain in the land map

What was built: the terrain casts through `createTerrainCaster` (a full disc of 256k vertices out to
2 km, shown only while the near map renders). It draws **back faces only**, so it didn't need phase
3's bias: a slope facing the sun never meets itself in the map. All grass casts (+8% on grass
scenes, ~2% overall, so the 40 m limit wasn't needed). Animals, colony birds, islands and mountains
cast and receive. Seen: a cliff 175° behind the camera at 6° shades the whole foreground ice
(`2024-04-10`); ledges shade a platform; islands throw long shadows on the water (`2024-10-07`); no
acne close up on grass or terrain. `test/props.test.ts` checks every solid lit object. Not done:
terrain in the **land map**, so cliffs and headlands beyond the near map cast nothing.

The plan as written:

| Caster | How | Note |
|---|---|---|
| **Birds, marine animals, seals, colony, islands, mountains** | Set `receiveShadow`; colony also casts | Near shadows on them. Test acne first |
| **Terrain** (cliffs, shelves, dunes) | Draw its mesh into the near and land maps | The largest gap. It can then shade itself, so it needs phase 3's bias first |
| **Grass** | Cast only within ~40 m (estimate) of the camera, reduced blades | 7000 per kind: test the cost. Grass ~1 m tall is a few texels |
| **Flowers, small life** | Confirm from phase 0; add where missing | |
| **Mountains, islands** | Also in the near map where inside it | So they shade props on themselves |
| Leaf litter, marsh, shells | Stay out: below a texel | Contact shadows cover them (phase 4) |

**Done:** a cliff shades the beach below it (a low sun behind it); each caster shows with
`diff.mjs --off`.

### 3. Sharper and steadier maps: done (0.124, 0.125), except snapping for live mode

What was built: the **fine slice** (arch/SKY.md): a second, shadow-only light fitted to the view's
first 40 m, 0.8–1.0 cm a texel; grass blades, fronds, branches and ice blocks cast crisp shadows.
**Offsets in metres** per map, and slope-scaled for props on the fine slice (normal offset off: it
hatched double-sided blades). **Depth range** left alone: the map's depth is 24-bit, 0.4 mm over 6490 m,
so precision was never the problem. **Cloud map:** 3 × 1024² split 0.9 instead of 3 × 512² split 0.6:
the first cascade covers ~13 km at ~25 m a texel instead of ~53 km at ~200 m. That was the straight-edged
wedge from 450 m (its edges were texels), and coarse texels spread each cloud's shade over a wide edge,
so low-sun scattered days were over-shaded: their beaches and sunset clouds now come out lit
(`2024-09-13`). `maxFar` stays at the 400 km far plane: takram lights the clouds from this map, and
capped it left far clouds pink. +6% on cloudy days. **Not done:** snapping to texels (live mode only).

The plan as written:

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

### 4. Small-scale shade: done (0.126)

What was built (arch/SKY.md): **skylight under crowns** (`props/skyOcclusion.ts`): each crown a disc
of leaves; its view factor × opacity (estimates, less for bare deciduous crowns) baked into a world
map near the camera; the terrain's skylight and ground props' indirect light read it, fading out
0.5–3 m above a prop's foot. Rock joints were already darkened in the rocks' vertex colours, crowns'
insides in the leaves' (trees.ts), stones' feet by stones.ts. **Contact shadows: not built**: at 1:1,
tufts, stones and ice blocks sit on their fine-slice shadows. **Softness by height: built**, on the
fine slice: each tap's blocker filtered by its height band over its own penumbra, since the comparison
map can't give blocker depth directly. Render time +1% (bench, default days and close-ups).

The plan as written (bake first, as this project prefers):

1. **Occlusion under trees and in rock joints:** darkens skylight only. Bake into vertex colours per
   instance; for the ground, a darkening under each near tree from its position.
2. **Contact shadows:** a short depth-buffer march toward the sun for near pixels. Costs per pixel,
   so only if stones and grass feet still float. `stillScene` draws the scene once, so it runs once.
3. **Softness by height** (a treetop's shadow softer than the trunk's): last, if at all.

### 5. Other lights: done (0.127)

Checked against the code: the only lights are the sun or moon (with the fine slice's shadow-only
light), and ambient lights for starlight and aurora. Ship lamps and bright planets light the sea's
glitter only (`ocean.ts` `lampPositions`, 12 at most); the lightning flash is a glow on the cloud
base; the lighthouse is screen-space beams and a glare. So no multi-light shadow system.

**Lighthouse:** no spot map. Its beams are horizontal, ±2.2°, aimed at the horizon, and the lantern
stands ≥ 120 m from the camera: they light nothing near it. What a shadow could change is a beam
running on through land: counted over 1095 days (`params.mjs --rendered`), 29 lit-lighthouse days,
land cuts a beam on 3, **in frame on 1** (`2026-05-13`, the beam crossing a forested headland). Built
instead (arch/PROPS.md): `beamLight` marches each beam on the CPU and gives its lit share along it
(land, the sea's surface, islands, earth's curve). That day's beams now thin out over the headland;
8 real lighthouse days change < 0.1% (the sea takes far beams' lower half, seen only far out).
Render time 0%. Off: `passes.beamShadow`; with it off, identical to the commit before
(`diff.mjs --off-here`). Found on the way (ARCHITECTURE.md "Known issues"): 14 of 92 lighthouse days
build no lighthouse but the title names one; a rock lighthouse in fog can white out the frame.

The plan as written:

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

- ~~**Grass casting:** worth its cost?~~ Yes: +8% on grass scenes, tufts sit on the sand (0.123).
- **Terrain in the land map:** a far headland's shade on the sea. Coarse texels (tens of metres) and the
  sand at the waterline; needs a lift like the props'.

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
[Fstoppers, waves and shutter speed](https://fstoppers.com/landscapes/what-really-happens-waves-change-shutter-speed-900088);
[Hemispherical photography: gap fraction, indirect site factor](https://www.wikipedia.org/wiki/Hemispherical_photography);
[Bae et al. 2024, sky view with canopy transmittance](https://ual.sg/publication/2024-bae-svf/2024-bae-svf.pdf) (phase 4.1: crowns let light through gaps, so opacity < 1).
