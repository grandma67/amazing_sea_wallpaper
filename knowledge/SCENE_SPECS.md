# Scene specs

Force what's needed in JSON instead of hunting dates; the rest comes from the date.
`src/sceneSpec.ts` validates it. Browser: `?scene=<JSON>`; scripts: `--scene <JSON or file>`.
Querying params (`params.mjs`) and rendering: [TOOLS.md](TOOLS.md), [tools/](tools/PARAMS.md).

```json
{ "name": "arctic-driftwood", "date": "2024-02-12", "timeOfDay": "golden-hour",
  "biome": "nordic", "ocean": "arctic", "composition": "along-beach", "storm": null, "fog": null,
  "props": { "debris": { "driftwood": 1, "rootWads": true }, "shoreLife": null } }
```

- Output is `<name>.jpg` (or `<date>.jpg`) plus `<name>.json` (params, spec).
- Omitted fields come from the date (`date` also sets the moon phase and month). Forcing one field
  keeps the rest: `{"date": D, "timeOfDay": "night"}` is day D's place, coast and lens at night.
  `seed` gives another scene on the same date.
- Shared fields: `{"base": {…}, "scenes": [{"name": "a", …}]}`; each scene is deep-merged over the
  base (snapshot, diff, params, profile). A spec's own `date` is used when no date is given.
- Optional features: `null`/`false` removes, `true` ensures, a kind (`"rock"`, `"bank"`, `"orca"`)
  forces that kind.
- Anything else: `params`, a deep patch over the finished `SceneParams`
  (`{"params": {"coast": {"distanceToWater": 6}}}`). Applied last, so the title and derived values
  don't follow it. `params.debug` holds render-only switches and false-colour views (tools/DEBUG.md); it is checked field by field.
- Unknown fields and bad values throw, naming the field.
- Forced features are still placed normally (a crab needs sand near the camera in frame; a boat is
  skipped if there's no sea spot).

## Fields

Allowed values are in `sceneSpec.ts`.

- **Time and light:** `timeOfDay`, `evening`, `sunElevationDeg`, `sunAzimuthDeg` (0 = ahead),
  `moonPhaseDeg`, `dayMoon`, `nightSky`, `eclipse`.
- **Place:** `place` (a place or region id from `places.ts`, e.g. `"scotland"`,
  `"atlantic-canada"`); `biome`, `ocean`, `climate` (restrict the place draw to places that have
  them and force the choice; a combination no place has throws; the climate also changes the
  land, sea, sky and animals: `scenes/climates.json` has one spec per new look); `monsoon`, `ice`.
- **Snow:** `snow` (`null` or `false` none, `true` a typical cover for the date, a number the cover, 0–1; `scenes/snow.json`). `props.phenology: false` removes drawn snow, not forced.
- **Sea ice:** `seaIce` (`null` or `false` none, `true` typical for the date or a mid-winter one out of season, `fast` or `drift` that kind to the camera, `forming` or `melting` those shoulders; `scenes/sea-ice.json`). `props.seaIce: false` removes the mesh and keeps the calm sea; `props.phenology: false` has none unless forced. A forced `wind` or `swellHeight` above the freeboard pokes through it.
- **Coast:** `coast` (`beach`, `open-sea`, `rock-shore`, `tidal-flat`: a flat at the day's tide, force `tide` too), `composition`; `rockShore` (`platform`,
  `boulder`, `cliff`: a rocky shore of that kind, implies one; on a rock shore `overlook` means a
  cliff and any other composition not a cliff); `swellHeight` (m offshore) and `swellPeriod` (s; wavelength
  capped at 320 m ≈ 14 s): open sea, surf and beach state follow, so force waves instead of hunting
  dates; `sand` (`white`, `golden`, `grey`, `black`, `pink`, `red`; any place); `beachMaterial`
  (`sand`, `mixed`, `shingle`, `cobble`; a stony one implies a beach, any place); `beachState`
  (`reflective`, `low-tide-terrace`, `transverse-bar-rip`, `rhythmic-bar`, `longshore-bar`,
  `dissipative`: slopes, bars, rips and cusps; grain and swell stay the day's); `saltMarsh` (true: a marsh behind any beach, implies a beach; false or null: none); `tide` (`low`,
  `mid`, `high`: the stage; the mean range is still drawn); `tidalRange` (m, today's low to high
  water; the beach is rebuilt for it if above springs); `reef` (true: a fringing reef on any beach,
  implies a beach; null: none); `beachrock` (true: ledges along the waterline, implies a reef;
  null: none).
- **Sky:** `weather`, `clouds` (genera/species, ≤ 4 layers, e.g.
  `["cumulus-humilis","cumulus-fractus"]`), `cloudArrangement`, `storm`, `shelfCloud`,
  `waterspout`, `rollCloud`, `lenticular`, `contrails` (true or a count), `noctilucent`,
  `nacreous`, `milkyWay`, `airglow`, `zodiacalLight` (false/null: off), `skyDarkness` (Bortle
  1–4 instead of the place's), `meteors` (true, a shower id like `"perseids"`, a count ≤ 3,
  null), `planets` (`false`/`null`: none; `"venus"`: frame Venus at blue hour when it's well
  placed), `aurora` (true: a display at night on a coast the oval can reach, Kp raised to reach
  it; `"strong"`: a big storm, Kp ≥ 6; false/null: none; a spec's aurora survives fog, storm and
  overcast, the drawn one doesn't; render set `scenes/aurora.json`), `rainbow`, `fog`, `marineLayer` (true: overcast stratus/Sc deck on any place; null:
  none), `dust` (`"harmattan"` or true: ochre dust haze, 2–10 km, any place; null: none), `wind`,
  `visibilityKm`.
- **Features:** `lighthouse`, `landform`, `islands`, `colony`, `colonySite`, `pinnipeds`,
  `haulOut`.
- **Camera:** `camera.{heightM,focalLengthMm,horizonFraction,rollDeg}`. `horizonFraction` = how far
  **down** the horizon sits: 0.3 is mostly sea, 0.7 mostly sky.
- **Props:** `props.{marine,birds,migratory,ships,rocks,seaStacks,stones,beachrock,rockEdge,saltMarsh,vegetation,phenology,leafLitter,bloom,heath,eucalyptus,moss,shoreWeed,debris,shoreLife,mangroves,wildlife}`.
  `bloom` (blossom, `phenology.ts` `BLOOM`): `true` every row that grows here in full flower, a list (`["gorse"]`, `["flamboyant"]`; kinds `rock-rose`, `gorse`, `wattle`, `flamboyant`, `pohutukawa`) those rows anywhere, `false` none (`scenes/bloom.json`; `look-flamboyant` forces it on a wood with many broadleaves, since tropical days place few).
  `shoreWeed: false` drops laver and sea lettuce from the rocky shore (the spray belt stays) (`scenes/shoreZone.json`).
  `moss: false` gives back moss as before phase 7 (the biome's amount, green; none on the rock-shore terrain) (`scenes/moss.json`).
  `eucalyptus: false` leaves the gums out after their draws, so the other plants don't move (`scenes/eucalyptus.json`; `look-california-grove` forces the kind, a small weight on real days).
  `heath` (heather on the ground cover, `phenology.ts` `heathFor`): `true` heath in today's colour wherever the day is, a stage (`flower`, `brown`, `green`) in that colour, `false` none (the switch; `phenology: false` turns it off too). Near only behind a rocky shore; far on landforms' and islands' green slopes (`scenes/heath.json`).
  Off for `diff.mjs`: `false` (booleans and kinds), `[]` (`vegetation`), `null` (`debris`,
  `shoreLife`, `wildlife`). `iceFoot`: `false` none, `true` on any snow day (needs `snow`). `leafLitter: false`: no fallen leaves or litter colour. `phenology: false` keeps plants and ground in their summer look
  (no autumn leaves, bare trees or dry grass, and the mountains' snow line as drawn; `phenology.ts`); the season itself comes from the
  date (`date` + `place`): Maine 2025-10-20 framed (red autumn), Cornwall 2025-01-12 framed
  (bare oaks), the Baltic 2025-09-22 framed with `climate: "boreal"` (yellow birch), the western
  Med 2025-08-10 framed (dry grass); snow line: Kamchatka 2024-01-04 shoreline (bare volcano
  whitened in winter), British Columbia 2025-01-02 overlook.

## Writing specs that show the feature

- **Light it to see it:** front-lit first (`"sunAzimuthDeg": 160`, `"timeOfDay": "daylight"`),
  then backlit. A spec file's `base` must force the time of day and weather (`"weather": "clear"`
  for textures): the date's own may be night or overcast. Add `"eclipse": null` when forcing time
  of day or sky (real eclipse days override). Base for ground and textures:
  ```json
  { "base": { "date": "2025-07-10", "eclipse": null, "storm": null, "fog": null,
              "timeOfDay": "daylight", "weather": "clear", "sunAzimuthDeg": 160 } }
  ```
- **Don't force `camera.heightM`** to get closer: each composition sets its own camera (a forced
  1.6 m put framed and overlook cameras inside the grass). Pick the composition and check how near
  the ground in frame is (`params.mjs --fields view`).
- **One forced date is one framing:** the 2025-07-10 shorelines see the ground from ~21 m, while
  real days range from ~5 m to 40 m+ (tools/PARAMS.md "What the camera sees"). For near-camera features
  pick dates whose `view.nearest` fits, or check the real-day spread with `--stats`.

## Adding a spec field

Every new random feature gets one. Always make the draw, then apply the force via
`or(drawn, force)`, `forced()` or `forcedKind()`, so unforced specs stay byte-identical
(`test/sceneSpec.test.ts`). Props read `ctx.params.overrides`. Add the field to the list above.

## Fixed dates

- Eclipses: 2024-04-08, 2026-08-12 total solar; 2024-10-02, 2026-02-17 annular; 2025-03-29
  partial solar; 2025-03-14, 2025-09-07, 2026-03-03 blood moon; 2026-08-28 partial lunar.
- Looks (re-found 2026-10-23 after places reshuffled every date; they change whenever the main
  stream does, so prefer a spec with `place`, `biome`, `timeOfDay`…):
  - 2024-01-03: Arctic beach (arctic-canada), driftwood, kelp, icebergs, midday;
  - 2024-11-23: nordic beach (nova-scotia), kelp, moon by day;
  - 2024-09-05: Mediterranean beach (north-africa-levant), seagrass, shells;
  - 2024-02-26: tropical golden hour (indonesia);
  - 2024-09-06: Mediterranean waterspout season (western-med, open sea);
  - 2024-04-24: storm + shelf cloud (norway-west).
  - 2024-03-21: nordic boulder shore at golden hour, seals; 2025-09-18: western-Med boulder
    shore at golden hour; 2024-03-23: sea cliffs at sunset; 2026-08-31: rock platform, morning
    (Patagonia)
    (`scenes/rock.json` for forced kinds: Peggy's Cove, Big Sur, Iceland storm).
  - Tidal flats (`scenes/tidal.json`): Wadden low tide golden hour (2025-07-10 shoreline), Fundy
    red mud (2025-08-12 framed), Wadden high tide marsh beach (2025-07-13 along-beach, eye 1.7 m),
    Yellow Sea red marsh (2025-09-25 framed). Real flat days are rare (~3 a year): force them.
  - Climates (`scenes/climates.json`): one spec per new look and composition (Florida, the Gold
    Coast, south Japan; Cornwall, the Hebrides' white shell sand, Maine, Oregon; Greenland
    tundra; Hawaii; Iceland).
  - The polar sun (`scenes/sun.json`): Tromsø polar-night twilight noon (2025-12-10,
    `norway-north` drew 70.7°), Svalbard polar night (2025-12-21), midnight sun on Svalbard and
    at Tromsø (2025-06-21, `sunElevationDeg` just above the day's minimum, `evening`). From 63°
    a forced `timeOfDay` the sun can't reach still wins (debugging), and so does
    `sunElevationDeg`: the heading of a midnight-sun day follows the forced elevation.
  - Real days (found 2026-11-04): PEI red sand beach 2025-01-30 (morning, temperate, skerries);
    Maldives reef: no unforced day since 0.139 (its 3 went to Sri Lanka when `atacama-peru` and
    `namibia` grew), so force `place: "maldives"` (`scenes/coasts.json`);
    California marine layer 2025-09-17 (the only one in the test years: June gloom days at
    `california` are rare, so force `marineLayer: true` on a June date).
  - Coasts, climates and weather together (`scenes/coasts.json`, for regression renders): PEI
    red, Maldives reef, rock platform, boulder shore and cliff top, Wadden tidal flat and salt
    marsh, temperate Hebrides, subtropical Florida, polar Greenland, California June gloom
    (2025-06-15), Scottish haar, harmattan dust, Svalbard polar night and midnight sun.
- Spec files for each finished feature: `scenes/` (`examples`, `stony`, `tables`, `beach-states`,
  `tides`, `shelter`, `reef`, `rock`, `tidal`, `climates`, `sun`, `coasts`, `reflection` (the sea's mirror
  images: calm and windy islands, mountains, near objects, boats, night), `wet-mirror` (pools, runnels, swash and
  flats), `islands-water`: reflections and
  white water at the colony stack, karst islands, skerries, an iceberg and a lighthouse rock, calm,
  rough and front-lit); `debug.json` shows the debug views.
