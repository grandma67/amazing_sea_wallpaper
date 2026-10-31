# Scene specs

Force what's needed in JSON instead of hunting dates; the rest comes from the date.
`src/sceneSpec.ts` validates it. Browser: `?scene=<JSON>`; scripts: `--scene <JSON or file>`.
Querying params (`params.mjs`) and rendering: [TOOLS.md](TOOLS.md).

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
  don't follow it. `params.debug` holds render-only switches and false-colour views (TOOLS.md
  "Debug switches and views"); it is checked field by field.
- Unknown fields and bad values throw, naming the field.
- Forced features are still placed normally (a crab needs sand near the camera in frame; a boat is
  skipped if there's no sea spot).

## Fields

Allowed values are in `sceneSpec.ts`.

- **Time and light:** `timeOfDay`, `evening`, `sunElevationDeg`, `sunAzimuthDeg` (0 = ahead),
  `moonPhaseDeg`, `dayMoon`, `nightSky`, `eclipse`.
- **Place:** `place` (a place or region id from `places.ts`, e.g. `"scotland"`,
  `"atlantic-canada"`); `biome`, `ocean`, `climate` (restrict the place draw to places that have
  them and force the choice; a combination no place has throws); `monsoon`, `ice`.
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
  `nacreous`, `rainbow`, `fog`, `marineLayer` (true: overcast stratus/Sc deck on any place; null:
  none), `dust` (`"harmattan"` or true: ochre dust haze, 2–10 km, any place; null: none), `wind`,
  `visibilityKm`.
- **Features:** `lighthouse`, `landform`, `islands`, `colony`, `colonySite`, `pinnipeds`,
  `haulOut`.
- **Camera:** `camera.{heightM,focalLengthMm,horizonFraction,rollDeg}`. `horizonFraction` = how far
  **down** the horizon sits: 0.3 is mostly sea, 0.7 mostly sky.
- **Props:** `props.{marine,birds,migratory,ships,rocks,seaStacks,stones,beachrock,rockEdge,vegetation,debris,shoreLife,mangroves,wildlife}`.
  Off for `diff.mjs`: `false` (booleans and kinds), `[]` (`vegetation`), `null` (`debris`,
  `shoreLife`, `wildlife`).

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
  real days range from ~5 m to 40 m+ (TOOLS.md "What the camera sees"). For near-camera features
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
  - 2024-03-21: nordic boulder shore at golden hour, seals; 2024-03-25: mediterranean boulder
    shore at midday; 2024-03-23: sea cliffs at sunset; 2024-03-08: rock platform, morning
    (`scenes/rock.json` for forced kinds: Peggy's Cove, Big Sur, Iceland storm).
- Spec files for each finished feature: `scenes/` (`examples`, `stony`, `tables`, `beach-states`,
  `tides`, `shelter`, `reef`, `rock`); `debug.json` shows the debug views.
