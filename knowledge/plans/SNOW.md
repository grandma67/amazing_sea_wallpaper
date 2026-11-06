# Snow plan

Lying snow on the land, and an ice foot at the high-water line, on the days that have them
(SEASONS_PLAN phase 9, PLAN_BIOMES 13). Numbers and sources: [SEASONS.md](../SEASONS.md) §4.1.

## Status

| Step | What | Status |
|---|---|---|
| 1 | `src/snow.ts`: the day's snow by climate, place and date; `snow` spec field; off with `props.phenology: false` | |
| 2 | Terrain shader: snow by height above the tide, slope and world noise | |
| 3 | `props/snowCap.ts`: caps on rocks, stones, plants, driftwood, tufts; frozen spray | |
| 4 | Far land: mountains and islands white to the shore; grass, flowers and leaves buried | |
| 5 | `props/iceFoot.ts`: the strip at the spring high water, ice cakes | |
| 6 | Tests, renders, bench, docs | |

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
