# Plan: tidal flats and salt marsh (PLAN_BIOMES 9)

Where the tide is big and the waves small, the shore is kilometres of bare sand and mud that the
sea leaves twice a day, with a salt marsh at the back (the Wadden Sea, Fundy's Minas Basin,
Morecambe Bay, the bay of Mont-Saint-Michel, Korea's west coast). Until now these places had
beaches only.

## Real shapes (research)

- **Where:** tidal flats form where the relative tide range (mean spring range / yearly mean
  significant wave height) is above ~15 (Coastal Wiki "Tidal flat", after Mangor 2004): meso-
  and macro-tidal bays and coasts behind barriers.
- **Profile:** km wide and nearly level; bigger tides make steeper flats while the width
  changes little (a model study and a 2025 survey of 2,538 Chinese flat transects, both seen
  only as search summaries: leads, not read). We take 1:2000–1:300, steeper with the range,
  width 0.8–5 km.
- **Creeks:** channels drain the flat seaward and branch landward; the widest and longest are
  on the lower flat, the most numerous on the mid–upper flat and in a well-vegetated marsh
  (LiDAR study of Chinese flats, search summary). Main creeks tens of metres wide and a metre or
  two deep low on the flat, narrowing landward; small ones 1–4 m wide and decimetres deep.
- **Salt marsh** (Wadden Sea Quality Status Report): the upper part of the intertidal, from well
  below mean high water up to the highest water mark; low marsh floods 50–200 days a year, mid
  marsh up to 50, high marsh only on the highest tides. Its seaward edge is smooth where it
  grows and a low cliff where it erodes.
- **Look:** a mirror-wet flat under the sky, sand ripples near the camera, a darker, glossier
  mud band near the marsh, creeks full of water winding out to a far, thin line of sea; the
  marsh a dense low sward (grasses, *Salicornia*, sea aster, sea lavender) that is green in
  summer, purple-flecked in July–August (sea lavender), with *Salicornia* and *Suaeda* red in
  autumn (Panjin's "red beach" on the Bohai/Yellow Sea), and straw-brown in winter.

## Kinds and shares

Place field `coast` gains `tidal-flat` (`places.ts` FLAT): wadden-north-sea 0.5,
morecambe-bay 0.5, mont-saint-michel 0.5, yellow-sea 0.45, fundy 0.25; the rock shares stay, the
beach is the rest. These five places are 1.94% of days, so the TASKS target of "~3% of days"
can't be met with them: flats are their land days (65%) × the flat weight × the tide below mid
(~50%) ≈ 0.3% of days. That is real (flats are rare on the wallpaper's sandy and rocky world);
more places (Severn, Gulf of Khambhat, Argentine gulfs) would raise it later.

- `generateCoast`: tide is drawn before the coast kind (it already is). A drawn `tidal-flat`
  with the tide **at or above mid** (level ≥ 0) becomes a **beach with a salt marsh** behind
  (dunes off, a narrow sand strip, the marsh where dunes would be). So: flats ≈ marsh beaches ≈
  0.3% of days each.
- Specs: `coast: "tidal-flat"` (a flat at whatever tide the day has; add `tide` to choose),
  `saltMarsh: true` (a marsh behind any beach; implies a beach), `saltMarsh: null` (none).

## Geometry (land frame; written before code)

`coast.flat` (`tidalFlat.ts`, no imports from `terrain.ts`/`tides.ts`), drawn on
`'tidal-flat'`: `{ width W, top, low, slope, channelSpacing, channelWidth, channelDepth, creekSpacing,
meander, mud }`; `coast.marsh` (both flat and marsh-beach days) `{ start, width, height, edge }`.
Heights above mean sea; the terrain subtracts `tide.level` as everywhere.

- **s = 0 is the marsh edge's foot**, at `top` = mean high water (0.42 × spring range).
- **Flat** 0 ≤ s ≤ W: straight from `top` to `low` = spring low water − 0.3 m
  (−0.5 × spring range − 0.3); W = (top − low) / slope, slope = (0.0005 + 0.0002 × range) ×
  (0.7–1.3), W clamped 800–5000 m.
- **Beyond W:** subtidal channel bed at `nearshoreSlope` 0.002–0.006 toward −seabedDepth
  (exp approach, as the rock's seabed).
- **Marsh** −width ≤ s < 0 (`marsh.width` 80–400 m): a cliff of `edge` 0.2–0.8 m at s = 0
  (at least ROCK_MIN_FACE × r wide, against zig-zags), then a near-level platform from spring high
  water − 0.1 at the edge to spring high water + 0.15 at the back. Behind: land at the marsh's
  height, the beach profile's hills from `width + 30`, ground cover; plants (`beachWidth` =
  marsh width + 5, `duneHeight` 0).
- **Creeks** (in the height, GLSL `flatHeightAt`, TS `flatSurface`): two sets running seaward,
  meandering (`a + meander × (vnoise(s / λ, a / spacing) × 2 − 1)`): main channels every
  `channelSpacing` 250–700 m, width 3 → `channelWidth` (15–45 m) and depth 0.4 → `channelDepth`
  (0.8–2 m) from the marsh to W, U-shaped; small creeks every `creekSpacing` 50–120 m, 1.5–4 m
  wide, 0.15–0.35 m deep, from inside the marsh to 0.6 W. Mild relief (fbm 0.05 m) on the flat.
  Widened with distance like rock faces.
- **Waterline** `flatWaterline` inverts the bare profile (marsh, linear flat, exp seabed).
- **Readers** (arch/COAST.md "A new seabed or shore profile"): 1. TERRAIN_GLSL `flatHeightAt` +
  TS mirror, terrainHeightAt branch on `COAST_TIDAL_FLAT`; 2. `coast.waterline` from
  `flatWaterline`; 3. no surf zone (`hasSurfZone` false already); 4. seabed colour: the mud
  (`seabedAlbedo`), terrain shading below; 5. no shelter, reef, bars, rips, cusps, ridges,
  terrace; run-up 0.1–0.2 m (the waves die over the shallows); 6. `waterSpot` works off depth;
  7. tests filtering beach-only assumptions; 8. `profile.mjs` prints the flat (W, top, low,
  creeks, marsh) drawn vs reached, map extent out to the waterline.
- `distanceToWater` = camera's u as before (negative when the camera stands on the flat).

## Shading

- Flat: `flatMud` uniform (place mud colour; `FLAT_MUD` in places.ts: grey-brown, Fundy
  red-brown) near the marsh, grading to the sand colour seaward over the upper third; all of it
  below today's high water is wet (glossy, mirror-flat in puddles and creeks); creek floors above
  today's water hold water (pools); sand ripples (the wind-ripple normal, ~10 cm, crests along
  the shore) near the camera.
- Marsh: `marshColor` (month table, `marshFor`) with patchy *Salicornia* red in autumn and sea
  lavender in July–August; tufts as props within ~40 m.
- Marsh-beach days: the beach shading, the marsh colour behind `marsh.start`.

## Compositions

| Day | Compositions | Camera |
|---|---|---|
| flat | shoreline 4, along-beach 3, framed 3 | shoreline: on the flat 15–150 m out from the marsh edge, looking out; along: on the marsh edge looking along it; framed: in the marsh 5–30 m behind the edge |
| marsh beach | as beaches, no overlook | framed stands in the marsh |

## Props

| Prop | Tidal flat | Marsh beach |
|---|---|---|
| salt-marsh tufts (new, `props.saltMarsh`) | in the marsh | in the marsh |
| rocks, stones, shells, shore life, beach animals, debris, turtles, mangroves | none (`hasBeach` false; rocks off on flats) | as beaches (rocks off) |
| vegetation | behind the marsh | behind the marsh |
| birds, colonies, ships, islands, lighthouse | as elsewhere | as elsewhere |

Later: seals on sandbanks (phase 14), waders (14), sea dikes behind Wadden marshes.

## Steps (one commit each)

1. This plan.
2. Geometry: `tidalFlat.ts`, terrain GLSL/TS, `generateCoast` flat branch, camera, spec
   `coast: "tidal-flat"`, `profile.mjs`; tests (mirror, waterline inverse, camera on the flat).
3. Shading: mud, wet gloss, creek water, ripples, marsh colour; renders.
4. The draw: `coast` weights with `tidal-flat`, tide gate, salt marsh on beach days, spec
   `saltMarsh`; shares tested; COASTS.md.
5. Props: salt-marsh tufts; rocks off.
6. Renders (Wadden low tide golden hour, Fundy red mud, Wadden high tide along-beach), bench,
   docs, changelog.

## Sources

[Coastal Wiki: Tidal flat](https://www.coastalwiki.org/wiki/Tidal_flat) (RTR > 15, after Mangor
2004); [Wadden Sea QSR: salt marshes](https://qsr.waddensea-worldheritage.org/node/87/pdf) (marsh
extent from below MHW to the highest water; flooding frequency by zone, via search summary of
the QSR and a Dutch study). Leads only (search summaries): Nature Communications 2025 (flat
width and slope vs tide and sediment, China), LiDAR creek study (creek size by zone).
