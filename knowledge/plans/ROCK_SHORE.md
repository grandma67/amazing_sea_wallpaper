# Plan: rocky shores (PLAN_BIOMES 8)

About a third of the world's coast is rock without a beach, and about half is backed by a cliff
(Coastal Wiki, "Rocky shore morphology": 140,000 km of rocky coast between 56°S and 60°N, 36.5%
of the coastline). Until now every land day was a beach. This phase makes ~38% of land days
(≈ 25% of all days) a rocky shore: a wave-cut platform, a boulder shore or a cliff top.

Status 2026-10-31: planned. Summary and link in PLAN_BIOMES.md.

## Real shapes (research)

- **Shore platforms** (Sunamura 1992 types, via Coastal Wiki):
  - Type A, sloping: 1–5° (0.017–0.087), on macro- and meso-tidal coasts, running below low water
    (Bristol Channel, Brittany; South Wales ~200 m wide).
  - Type B, sub-horizontal: near level, at about high-tide to mid-tide level, ending seaward at
    low water in a **low-tide cliff** (a scarp) on micro-tidal coasts (Kaikoura, Mediterranean,
    Australia).
  - Width: a few metres to hundreds of metres; tidal range is the best single predictor of
    gradient. Platforms narrow and steepen under higher cliffs.
  - Surface: ledges along bedding (strata dipping at the rock's dip, outcropping as parallel steps
    along the strike), gullies (surge channels) along joints cutting the seaward edge, pools in
    hollows. Granite (Peggy's Cove) is rounded whalebacks cut by joints, basalt columns and flows
    (Iceland) are blocky steps.
- **Boulder shores:** a steep (~1:3–1:5) apron of 0.5–2 m boulders below cliffs or till, running
  into the sea (Newfoundland, Norway, Scotland, Big Sur coves).
- **Cliff tops:** cliffs 15–80 m high, often plunging into the sea or with a narrow platform or
  boulder apron at the foot; much rocky coast is only seen from above.

## Kinds and shares

Place field `coast` (choose-one, `places.ts`): weights of `beach` / `rock-shore` (`tidal-flat`
in phase 9), region defaults, place overrides; drawn on stream `'coast-kind'` on land days only
(open sea stays the `'coast'` stream's 35%). Target: ~38% of land days rocky.

| Places | rock-shore share of land days |
|---|---|
| Norway, Greenland, Svalbard, BC, SE Alaska, Gulf of Alaska, Patagonian fjords, Tierra del Fuego, Newfoundland, Nova Scotia, Maine, Scotland, Ireland, Cornwall-Wales, Brittany, Iceland, Iceland-Faroe, Faroes, California, Central Chile, Kamchatka, South Georgia | 55% |
| other nordic and volcanic places (Arctic Canada, Arctic Russia, Japan, Canaries, Azores, Hawaii, NZ…) | 45% |
| Mediterranean Sea, Portugal-Morocco, Cape, Pacific Northwest, Fundy, Bristol Channel | 40% |
| other mediterranean-biome places | 30% |
| desert | 20% |
| tropical | 15% |
| barrier and sand coasts: Florida-Carolinas, Wadden, PEI, Morecambe Bay, Mont-Saint-Michel, Alaska north, Baltic | 10% |

Kind (`coast.rock.kind`, stream `'rock-shore'`): `platform` 45%, `boulder` 22%, `cliff` 33%
(cliff = the overlook composition). Spec: `coast: "rock-shore"`, `rockShore: "platform" |
"boulder" | "cliff"` (implies a rock shore).

## Geometry (land frame; written before code)

`coast.rock` (`rockShore.ts`, no imports from `terrain.ts`/`tides.ts`):
`{ kind, platformWidth W, top, edge, scarp, scarpSlope, backHeight, backWidth, relief, bedding,
dipDeg, jointSpacing, jointAngle, gully, boulder }`. Heights are above mean sea; the terrain
subtracts `tide.level` as everywhere (decision 6).

- **s = 0 is the back of the platform** (the foot of the back face), at height `top`. On a
  boulder shore s = 0 is where the boulder ramp crosses `top`.
- **Platform** 0 ≤ s ≤ W(a): straight from `top` to `edge`.
  - Type B (spring range < 2 m): `top` = spring high water + 0.2–0.6 m, `edge` = top − W × 0.005,
    W 25–120 m.
  - Type A (≥ 2 m): `top` = spring high water + 0.3 m, slope 1–4° (steeper for bigger range),
    `edge` = top − W × slope, down to about spring low water; W from the slope, 30–200 m.
  - W(a) wanders ±25% (noise in `a`, 40 m) and is cut back in gullies: the ragged edge.
- **Scarp** (low-tide cliff) W ≤ s: from `edge` down at `scarpSlope` (0.6–1.2; boulder 0.25)
  by `scarp` (2–6 m), then the seabed at `nearshoreSlope` (0.03–0.06) toward `seabedDepth`.
- **Back face** −backWidth ≤ s ≤ 0: rises `backHeight` over `backWidth`.
  - platform: a low cliff 2–12 m, backWidth = height / (1.5–3);
  - boulder: the ramp itself, slope 0.2–0.35, 2–6 m up; the ramp continues seaward as the
    "scarp" at the same slope (W = 0);
  - cliff: 15–70 m, backWidth = height / (2–5), narrow platform (W 0–25 m, 40% none: plunging).
- **Land behind:** plateau at `top + backHeight` with the beach profile's hills (from
  backWidth + 20 m) and bumps; vegetation starts there (`beachWidth` = backWidth + 4,
  `duneWidth` 10–25, `duneHeight` 0 so plant readers keep working).
- **Relief** (added to the bare profile, masked to the rock band −backWidth − 10 ≤ s ≤ W + 40,
  0 on the plateau and the deep seabed):
  - bedding ledges: `terrace(fbm(q / 18) × relief + dipPlane)` where `dipPlane = dot(q,
    strike⊥) × tan(dip)`; terrace quantises to `bedding` (0.25–0.7 m) steps with a short riser
    (smoothstep over the top 15% of each step); `relief` 0.6–2 m;
  - gullies: two joint sets (main ~shore-normal ± 25°, second ~60° from it, half as deep), V/U
    section of width 1–3 m, `gully` 0.4–1.5 m deep, deepest toward the edge;
  - sharpness: 0.25 m of ridged noise (8 m);
  - boulder: Voronoi domes, cell `boulder` 0.8–2.2 m, height ~0.6 × cell, over the ramp.
  Cost: ~2 fbm + 2 vnoise + one 3×3 cell search (boulders only) per height, 3 heights per pixel.
- **Readers** (arch/COAST.md "A new seabed or shore profile"):
  1. `TERRAIN_GLSL` `rockHeightAt` + TS `rockHeight`, `terrainHeightAt` branch on `COAST_ROCK_SHORE`;
  2. `waterlineAt`: rock days use `rockWaterline` (inverts the bare piecewise profile);
  3. surf reach: unchanged (the scarp is within 150 m);
  4. seabed colour: rock colour under water (`seabedAlbedo`); terrain shader shades rock;
  5. no shelter, no reef; run-up as drawn;
  6. `waterSpot` and sea rocks work off depth (unchanged);
  7. tests: beach-state, reef, shelter, mangrove tests filter rock days;
  8. `profile.mjs` prints the rock numbers (W, top, edge, scarp, back) drawn vs reached.
- Rock days drop the beach's terrace (width 0), bars, rips, cusps, ridges, reef and shelter;
  material stays `sand` (unused) and no stones on the beach.
- `distanceToWater` = camera's u as before (negative when the camera stands on the platform).

## Mesh and shading

- **Same terrain mesh, relief in the height function.** A separate heightfield would need its
  own TS mirror for the camera, props, ocean depth and waterline anyway; one function keeps one
  truth. The polar grid's spacing (radial 2.2% of r, 6 mrad around) is ~0.2 m at 10 m and ~1 m
  at 50 m; the fragment shader already lights every pixel from the exact height (finite
  differences at the pixel footprint), so ledges read from per-pixel normals and geometry only
  carries silhouettes. If ledge silhouettes zig-zag in the 0–60 m band, rock days get a denser
  grid (rings 600 → 900, ~+50% terrain vertices; bench it).
- **Rock shading** in the terrain fragment shader (rock days): rock colour (biome palette, a
  `rockAlbedo` uniform) × strata banding × mottle; risers and gully walls darker; bands by
  height above today's sea, as on rocks.ts `rockMaterial`: wet and glossy below the run-up, the
  dark weed and barnacle band below the spring high water, a black lichen band above it
  (Verrucaria, splash zone), orange/grey lichen and the biome's ground cover on the plateau;
  pools: water in hollows of the relief between today's sea and the spring high water (flat,
  glossy); stones (the phase-2 stone texture, cobble size) on gully floors.
- Preview: `scripts/mesh.mjs` can't show the shader terrain; preview with renders of forced
  specs (`--w 960`), one per kind, and compare against Peggy's Cove, Big Sur and Iceland photos.

## Water

- The surf already breaks by local depth: at the scarp the depth drops from metres to the
  platform's, so waves break on the edge and bores wash across a submerged platform for free.
  Check with `profile.mjs` (break band at the scarp).
- **Edge spray:** `edgeRocks(ctx)` (props/surf.ts) returns points every ~6 m along the scarp in
  view where the edge stands out of today's water; they join `waterRocks` for the ocean's foam
  collars (nearest 48) and the rock-burst spray (`waveOnRock`).
- Tidepools: shader pools (above), no prop.

## Compositions

| Kind | Compositions | Camera |
|---|---|---|
| platform | shoreline 3, along-beach 3, framed 2 | shoreline/along: on the platform 5–40 m from today's water (or on the back cliff top if the tide covers it); framed: on the low cliff top 3–15 m behind its edge, plants round |
| boulder | shoreline 3, along-beach 3, framed 2 | on the ramp above the run-up, or on top |
| cliff | overlook | on the cliff top 4–25 m behind the edge, eye 1.5–2 m |

## Props

| Prop | Rock shore |
|---|---|
| rocks | boulder clusters at the back-face foot and on the platform (chance 0.9) |
| pinnipeds | rock haul-out on the platform edge (beach haul-outs become rock) |
| debris | driftwood and wrack jammed at the back of the platform and in gullies (no piles) |
| vegetation | behind the back face (beachWidth/duneWidth set from the rock) |
| colonies, birds, migratory, marine, ships, islands, landforms, lighthouse | as on beaches |
| shore life, turtles, beach animals, mangroves, stones, shells, flowers | none (hasBeach false) |
| marine iguanas | on the platform (Galápagos), the one beach animal that lives on rock |

## Steps (one commit each)

1. This plan.
2. Rock geometry: `rockShore.ts` (`rockShoreFor`, bare profile, waterline), terrain GLSL/TS,
   `generateCoast` rock branch, compositions, spec fields, `profile.mjs`; tests (mirror, no sand
   band, camera on rock, waterline inverse). Still never drawn on real days.
3. Shading: rock albedo, bands, pools, stones in gullies; renders per kind.
4. Water: edge spray and foam.
5. The draw: `coast` place field on `'coast-kind'`, shares measured and tested, COASTS.md.
6. Props: rocks, pinnipeds, debris, vegetation, iguanas; ANIMALS.md regenerated.
7. Renders (Peggy's Cove, Big Sur overlook, Iceland storm), bench, docs, changelog.

## Sources

[Coastal Wiki: Rocky shore morphology](https://www.coastalwiki.org/wiki/Rocky_shore_morphology)
(platform types, gradients 1–5°, widths from metres to hundreds of metres, elevations from low
tide to above high tide, about half of coasts cliff-backed, 36.5% rocky). Trenhaile's width and
gradient controls and Matsumoto et al. 2017 (tidal range predicts gradient) were seen only in
search summaries, not read: treat as leads.
