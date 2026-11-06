# Snow plan

Lying snow on the land, and an ice foot at the high-water line, on the days that have them
(SEASONS_PLAN phase 9, PLAN_BIOMES 13). Numbers and sources: [SEASONS.md](../SEASONS.md) §4.1.

## Status

| Step | What | Status |
|---|---|---|
| 1 | `src/snow.ts`: the day's snow by climate, place and date; `snow` spec field; off with `props.phenology: false` | done (0.111) |
| 2 | Terrain shader: snow by height above the tide, slope and world noise | done (0.111) |
| 3 | `props/snowCap.ts`: caps on rocks, stones, plants, driftwood, tufts; frozen spray | done (0.111) |
| 4 | Far land: mountains and islands white to the shore; grass, flowers and leaves buried | done (0.111) |
| 5 | `props/iceFoot.ts`: the strip at the spring high water, ice cakes | done (0.111) |
| 6 | Tests, renders, bench, docs | done (0.111) |

## What this settles

The questions phase 9 left open:

- **Moving viewer:** no map. The snow on the ground and on every prop is a function of world
  position, height, slope and world-space noise, so nothing about it reads the camera. The ice foot
  is a function of the shore coordinate `a` (noise and hashes); only how many sections are drawn, how
  fine, and which are in view read the camera. `litterMap` isn't copied: it covers only what's in view.
- **The month or the weather?** The month, climate and place. Lying snow outlasts the day's weather:
  a clear, rainy or overcast sky can all sit over it, and days here are independent scenes, so there's
  no yesterday to melt it. The day's sky doesn't change the chance.
- **A number per day:** a chance by place and climate at the peak of winter, rising and falling with
  the season's `band` (table in SEASONS.md §4.1). Temperate is rare except where winters are
  continental (Maine, Prince Edward Island). Stream `'snow'`.
- **Lying or falling:** lying only. Falling snow would be a weather kind with its own look
  (CLOUDS.md), left for later. Grey shafts under a winter storm read as either.
- **With snow:** ground cover, litter colour and stones are covered in the shader; grass is hidden by
  hash in step with the cover, without changing the plants' draws; flowers go; leaves stay only under
  patchy snow. Deciduous trees are already bare and animals dormant (phases 2, 4). The mountains' line
  comes down to the shore, which closes SEASONS_PLAN open problem 7.
- **Exposure and white balance:** nothing to do by design: `exposure.ts` measures only sky and sea,
  as a photographer metering the sky would, so snow can't shift it. Snow's albedo (0.8, as on the
  mountains) must still stay out of the tone curve's clipping: check in renders, at midday front-lit.
- **Render time:** only snow days pay, with one branch elsewhere. Target ≤ ~10% (`bench.mjs`).

## Geometry (world heights, sea 0: `arch/COAST.md`)

- **Where snow starts:** `tideHigh + runup + 0.15` (today's reach), with a wandering edge. Below it the
  beach stays bare and wet; the line moves with the tide of the day, not the hour.
- **The ice foot's line:** the first height, walking inland from today's water, that reaches the
  **spring high water** (`tideMarks(coast).spring`). It's on the land, so it stays put through the tide:
  at low tide it stands above a bare beach; at high water the sea is at its face. Walking from the sea
  finds the shore's own contour rather than a hollow behind the dunes.
- **Its section** (per `a`, seaward is +s): feathered into the land's snow over 2–5 m; a top ~0.3–1.2 m
  above the contour, 2–6 m wide; a steep face with a small undercut, buried under the beach or the water.
  Low or absent in stretches (ice-foot forms vary over short distances; Point Lay and Svalbard).

| Tide × composition | Camera | Ice foot |
|---|---|---|
| High × shoreline, along-beach | above the sea, may stand on the line | gap within 4 m of the camera |
| Low × shoreline, along-beach | may stand on the bared beach seaward of the foot | seen behind or beside; gap within 4 m |
| Any × framed, overlook | on the land | below and ahead |
| Rock platform, boulder | on the rock | at the contour; follows gullies, smoothed along `a` |
| Cliff top | high above | at the scarp's foot |
| Tidal flat, salt marsh | land behind | a low rampart at the marsh's edge |

`test/snow.test.ts` checks the camera isn't inside or under it over these, via `expectDryCameras`' forced
tides.

## Done when (1080p, 16 frames; front-lit, then backlit)

- Polar shoreline and framed: white land to the tide line, bare wet beach below, rocks capped, ice foot.
- Boreal framed: conifers carrying snow, bare birches, dark forest showing through on far hills.
- Temperate patchy (Maine, or `"snow": 0.5`): patches with grass and rock between them.
- Stony beach: stones under snow above the line, wet below it. Rock platform: frozen spray.
- `diff.mjs --off '{"snow":null}'` shows it on each; `check:restart` still clean.

## How it came out (0.111)

- **Days:** 162 of 1095 have snow (14.8%): polar 118, boreal 39, temperate 5; 91 of them an ice foot.
  `--ref`: only the title (162), the mountains' line (65) and flowers and litter (26) change, so no
  other stream moved. Render time +0–4% on snow days, and a snowless day is pixel-identical (`bench.mjs`).
  `check:restart --date 2024-01-01 --steps 8` shows no leak; that span has snow days (2024-01-03, 2024-01-08). The bench and the leak check ran before the last two foot tweaks (the taper's length, no snow on wrack), which add no GPU resources.
- **Changed from the plan:**
  - Mesh stones above the line are hidden under the cover, not capped: caps on them read as a white
    crackle near the camera.
  - The foot narrows with its height: at full width it read as a slab laid on the sea. Its top has
    relief and its lip wobbles.
  - Wrack gets no snow: it came in on the last tides. Driftwood does. This came after the last render, so it's tested by type only.
- **Seen in renders** (`scenes/snow.json`, 1080p, 16 frames): polar framed and along-beach, boreal framed
  front-lit and backlit, temperate patchy, stony with snow to the line, rock platform at low and high tide,
  overlook, overcast; real days 2024-01-03, 2024-11-22, 2024-12-05, 2026-02-16.
- **Final `diff.mjs --off '{"snow":null}'`** on all 11 specs in the file (0.112): none invisible, from 2.4%
  of the frame (platform at low tide: the snow is far off) to 64.8% (boreal framed).
- **Frozen spray:** first called "reads well" from a full frame, unchecked. A before/after crop (`--crop`,
  with `props.iceFoot: false`) then showed a hard-edged camouflage over the whole boulder. Rewritten in 0.112 as
  a thin glassy sheath low on each face, and seen in the same crop: smooth, no patches. It's an estimate of the
  look (no reference photo), and on a low boulder the sheath reaches near its top.
- **Not rendered:** tidal flat and salt marsh (tested for the camera only), a cliff's foot, snow-capped
  salt-marsh tufts, polar night.

## The look against photos (0.113)

Built first from words, then compared with three photos (SEASONS.md §4.1). What changed: height 0.3–1.2 m → 0.5–2 m; a sloped
clean edge → a rolled top over a steep wall, undercut into dark hollows, stained low down and broken along the shore; bays tens of
metres long in its face; round cakes → fractured slabs and blocks up to ~3 m.

Compared by eye in a before/after crop (`foot-low-along` in the render, a 29 m view) and a cross-section (`profile.mjs --props`: top
~2.1 m above the ground, fixed through the tide, water at its base at high tide).

**Still not like the photos:**

- Close up the wall is smooth and lobed: real faces are broken and layered, and its sections are too coarse for that past ~20 m.
- No fast ice, slabs or brash in front of it: in all three photos broken sea ice lies against the foot. That belongs with sea ice
  (phase 10).
- All the photos are Antarctic or an 1880s Arctic plate, and none shows a foot on a sandy beach, so its look on sand, and all
  widths, are inferred. Boreal and temperate feet use the same shape, unchecked.

## Known limits

- **A foot beside a very close camera:** where the camera stands on the line itself (`2025-04-02`-style
  along-beach), the foot's end near it still looks a little cut. The strip must part round the camera;
  a moving viewer will need a better answer (the camera shouldn't decide where ice is).
- **The mountains under full snow: unsolved.** They read as smooth dunes when front-lit and far off. Letting
  rock show on steep faces and by noise barely helped (slopes on that mesh are shallow at that scale); it needs
  its own look at the mountain's relief and snow, not a threshold.
- **The far boreal forest:** terrain snow past the plants' range has no dark woods in it, so far low
  land is plain white. Landforms and islands do show their woods.
- **Falling snow:** not modelled. Polar-winter rain shafts have no snow form.
- **Sea ice in the bays:** the foot is the only shore ice. Fast ice is Baltic phase 10's job.
