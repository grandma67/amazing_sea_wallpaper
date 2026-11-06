# Sea ice plan

A frozen sea on the days that have one (SEASONS_PLAN phase 10, then every freezing coast). Numbers and sources:
[SEASONS.md](../SEASONS.md) §4.2.

## Status

| Step | What | Status |
|---|---|---|
| 1 | `src/seaIce.ts`: the day's ice by place, latitude and date; `seaIce` spec field; waves calmed | done (0.114) |
| 2 | `props/seaIce.ts`: the sheet, a floating mesh with its look in the shader | done (0.114) |
| 3 | Rubble: real blocks along the shore, on ridges and at the edge | done (0.114) |
| 4 | Nothing afloat: ships, marine life, animals in the water; the meter | done (0.114) |
| 5 | Tests, renders, bench, docs | done (0.114) |

## What this settles

- **Not Jan–Apr north of 60°, as SEASONS_PLAN said.** FMI: first ice before 15 November and last after
  15 May on the northern coast, and in normal winters ice also on the Sea of Bothnia, the Gulf of Finland, the
  Archipelago Sea and part of the northern Baltic Proper. So five zones by latitude, each with its own season
  and chance. The research wins over the plan.
- **How often:** the `baltic` place has 12 of the 1095 test days and 1–3 of them have ice, so a still frame
  rarely shows this. So the table is keyed by place, and 0.115 added the other freezing coasts (below): 95 days.
- **A mesh, not a branch in the ocean shader.** A sheet floating at a freeboard above y = 0 hides the sea, so
  surf, foam and reflections need no edits and non-ice days pay nothing. It takes light, shade and shadows the
  way props do, haze from the aerial pass, and curves with the sea.
- **Waves:** on an ice day, wind for the waves is at most 1.5 m/s and there's no swell, so crests stay under the
  freeboard. Surf and spray then switch themselves off. This also calms open water past the edge (Known limits).
- **The sheet's depth:** 0.18 m above the sea is below depth resolution past ~1 km, so it uses a polygon offset.
- **Moving viewer:** what the ice is comes from world position and the distance from the shore (hashes and noise);
  only how far blocks are drawn reads the camera. The sheet's grid is a wedge round the camera, as the terrain's is.
- **One state, not kinds:** `thin` (freeze-up), `melt` (break-up), `snow`, `cover`, `edge`, `rubble`, `lead`, all
  from the date on the stream `'sea-ice'`. Freeze-up is grey and thin; break-up is wet, with pools and a strip of
  open water along the shore (melt starts there).
- **Land days and open sea:** fast ice from the shore to `edge`, drift past it. Open-sea days are all drift.

## Done when (1080p, 16 frames; front-lit, then backlit)

- Against the photos below: a white plain to a sharp horizon, broken by rubble bands and thin dark cracks.
- Shoreline: a rubble belt along the shore. Drift: plates, leads of dark water. Break-up: wet, grey, open water at the shore.
- `diff.mjs --off '{"seaIce":null}'` shows it on each. A day without ice is pixel-identical. `check:restart` clean.

## Photos to match

Wikimedia Commons, viewed 2026-11-06:

1. [Oulu 1 light in the ice, March 2017](https://commons.wikimedia.org/wiki/File:2017-03-22_Leuchtfeuer_Oulu_1_im_Eis.jpg):
   a white plain, bands of rubble, thin dark cracks, a glint low down, a sharp bright horizon under a darker sky.
2. [Pack ice off Kemi](https://commons.wikimedia.org/wiki/File:Gulf_of_Bothnia_Kemi_Pack_Ice.jpg): snowy plates tens of
   metres across, rafted dark edges, grey-green pools, under grey light.
3. [The pack's edge, broken by the Sampo](https://commons.wikimedia.org/wiki/File:Gulf_of_Bothnia_pack_ice_edge_broken_by_Sampo.jpg):
   a snowy top over a grey-blue edge some tens of cm thick, dark water and brash in front, cracks behind.
4. [Palmer Ort, Rügen, February 2026](https://commons.wikimedia.org/wiki/File:Landschaftsschutzgebiet_S%C3%BCdwest-R%C3%BCgen-Zudar_lub_2026-02-07_img14_Palmer_Ort.jpg):
   a shore pile of clear flat slabs, tilted and stacked, about 2 m high.
5. [Ice off the coast in winter (January 2021)](https://commons.wikimedia.org/wiki/File:Ice_off_the_coast_in_winter.jpg): rounded snowy cakes in a
   belt along the shore, smooth flat ice beyond with a few pools of open water.

## How it came out (0.114)

- **Days:** 1 of 1095 (2024-01-22, 65.9°N, moonlit, drift); 2 of the `baltic` place's 12 days have a chance
  above 0. `--ref`: that one day only (title, coast, ocean, props). So in a still frame this is about one day
  in three years. Built anyway, as asked and per LIVE_MODE.md; see "Every freezing coast" below.
- **Cost:** render time 0% on that day against the commit before (`bench.mjs --runs 2`), built in ~30 ms;
  2024-07-14 and 2024-09-05 identical to the pixel. `check:restart --date 2024-01-19 --steps 6` spans the ice
  day: no GPU resources left.
- **`diff.mjs --off '{"seaIce":null}'` on all 8 specs of `scenes/sea-ice.json`:** none invisible, 31–51% of the frame.
- **Changed from the plan:**
  - Blocks were first a low-poly cake from the ice foot, up to 4.5 m: they read as boulders. Now thin slabs of about
    30 triangles, so thousands fit, with some rounded lumps near the camera.
  - The snow's lower line drops on ice days and the run-up is near nothing (`ICE_RUNUP`, `ICE_SNOW_DROP`). Otherwise
    a rock platform stood bare and dark beside the ice, reading as open water.
  - On a rock shore the sheet goes 400 m inland, under the rock, so its pools freeze.
  - The meter sees a bright sea on ice days (`ICE_REFLECTANCE`), as a camera would. Its 0.6 is an estimate.
- **Seen in renders** (1080p, 16 frames): fast ice from the shore, front-lit and backlit; typical day; a cliff's
  overlook; drift on open sea; break-up; freeze-up; rock platform overcast; real day 2024-01-22.

## Known limits

- **Rubble from close by:** at a distance it matches the Rügen and Gulf of Finland photos. Within about 15 m the
  slabs are clean, plain and blocky, and the lumps too smooth. Real slabs are cloudy, chipped and layered.
- **Open water past the edge is too calm:** the wave cap holds for the whole sea, so on a day whose fast ice ends
  near the shore (south Baltic, freeze-up) the water beyond is glassy. Masking waves by the edge needs a change in
  the ocean shader, which the mesh approach avoided.
- **Ice edges are flat:** a lead's side is a tint, not a wall (the Sampo photo's thick edge isn't there), which shows
  only near a lead with a low camera.
- **Freeze-up:** an estimate from words. No photo was compared, and there are no pancake cakes.
- **Numbers:** the season dates between FMI's few fixed points, the chances south of 63° and every `edge` and
  `cover` range are estimates (SEASONS.md §4.2).
- **Nothing lives on it:** ringed and grey seals on the ice, and an icebreaker's channel, aren't drawn (ships are
  simply off). Skerry seals stay on their rocks.
- **Not rendered:** tidal flat and salt marsh under ice; an overlook of a real ridge field; the TS and GLSL rubble
  fields are written to match, and blocks land on the bands in renders, but no test compares them.

## Every freezing coast (0.115)

Decided after the Baltic: realism first, so every coast that freezes gets it. The Baltic alone was 1 of 1095 days, while
polar coasts showed waves in front of an ice foot through the winter.

- **Days:** 95 of 1095 (8.7%): arctic-canada 51, arctic-russia 12, greenland 11, russian-far-east 9, alaska-north 3, cook-inlet 2,
  south-shetland 2, svalbard 2, baltic, pei and newfoundland 1 each. 30 are open sea, as drift. `--ref` against 0.114: 95 days, with ocean and
  coast on 94, props on 35, sea smoke gone on 5.
- **Open on purpose:** north Norway, Iceland, the Gulf of Alaska, south-east Alaska, Kerguelen, South Georgia. In Greenland's south-west and
  on the Kola coast, the table's chance is lower, since latitude can't separate them from what freezes nearby.
- **Bergs stay,** frozen in. Arctic pack on the same day gives way to the sheet; on a day with no sea ice the old pack (`sea.ice`) still drifts.
- **Other things that needed water:** sea smoke and waterspouts go unless forced; the title says "frozen sea" or, under 60% cover, "ice-strewn sea";
  what rests on the sea (a gull) rests on the ice (`ctx.seaLevel`), and seal heads go.
- **Cost:** −6% to +5% on four days that are newly frozen (`bench.mjs --runs 2`), a day without ice identical. `check:restart --date 2024-02-27 --steps 5` clean.
- **Rendered, real days:** Arctic Canada (twilight, dawn, low sun, starlit, June break-up), Greenland (sunrise, thunderstorm), PEI, Newfoundland's break-up,
  the Pacific boulder shore 2024-04-07.
- **Not rendered:** the southern hemisphere (tested for dates only), Svalbard, Alaska, Cook Inlet, midday polar fast ice.
- **Weakest sourcing:** Antarctic-side rows (South Shetlands, South Sandwich) and Cook Inlet found no usable source and are estimates; Canada's dates rest
  on one statement plus Alaska's, as its climatology paper couldn't be read. SEASONS.md §4.2 says which row rests on what.
- **Ice foot on an open sea:** the foot's draw is separate, so 32 foot days have no sea ice (Greenland and Svalbard mostly). Those are within the table's
  chances, but a foot usually means shore ice; linking them is open.
- **Also not done:** Bohai and Yellow Sea bays, the far north's multi-year ice, and Hudson Bay's own later dates against its northern part beyond the zones.
- **At very low sun** the fine cracks read a little like dried mud.
