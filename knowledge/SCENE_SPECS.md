# Scene specs and the params generator

## Scene specs (JSON) instead of hunting dates

`src/sceneSpec.ts` forces what's needed; the rest comes from the date. Browser: `?scene=<JSON>`;
scripts: `--scene <JSON or file>`.

```json
{ "name": "arctic-driftwood", "date": "2024-02-12", "timeOfDay": "golden-hour",
  "biome": "nordic", "ocean": "arctic", "composition": "along-beach", "storm": null, "fog": null,
  "camera": { "heightM": 1.6 },
  "props": { "debris": { "driftwood": 1, "rootWads": true }, "shoreLife": null } }
```

- Output is `<name>.jpg` (or `<date>.jpg`) plus `<name>.json` (params, spec).
- Omitted fields come from the date (`date` also sets the moon phase and month). Forcing one field
  keeps the rest: `{"date": D, "timeOfDay": "night"}` is day D's biome, coast and lens at night.
  `seed` gives another scene on the same date.
- Fields (allowed values in `sceneSpec.ts`):
  - time and light: `timeOfDay`, `evening`, `sunElevationDeg`, `sunAzimuthDeg` (0 = ahead),
    `moonPhaseDeg`, `dayMoon`, `nightSky`, `eclipse`;
  - place: `place` (a place or region id from `src/places.ts`, e.g. `"scotland"`,
    `"atlantic-canada"`), `biome`, `ocean`, `climate` (these three restrict the place draw
    to places that have them and force the choice; a combination no place has throws),
    `monsoon`, `ice`, `coast`, `composition`, `sand`, `beachMaterial` (`sand`, `mixed`,
    `shingle`, `cobble`; a stony one implies a beach, on any place);
  - sky: `weather`, `clouds` (genera/species, ≤ 4 layers, e.g.
    `["cumulus-humilis","cumulus-fractus"]`), `cloudArrangement`, `storm`, `shelfCloud`,
    `waterspout`, `rollCloud`, `lenticular`, `contrails` (true or a count), `noctilucent`,
    `nacreous`, `rainbow`, `fog`, `wind`, `visibilityKm`;
  - features: `lighthouse`, `landform`, `islands`, `colony`, `colonySite`, `pinnipeds`, `haulOut`;
  - camera: `camera.{heightM,focalLengthMm,horizonFraction,rollDeg}`;
  - props: `props.{marine,birds,migratory,ships,rocks,seaStacks,vegetation,debris,shoreLife,mangroves,wildlife}`.
- `camera.horizonFraction` = how far **down** the horizon sits: 0.3 is mostly sea, 0.7 mostly sky.
- Shared fields: `{"base": {…}, "scenes": [{"name": "a", …}]}`; each scene is deep-merged over the
  base (snapshot.mjs, diff.mjs).
- Optional features: `null`/`false` removes, `true` ensures, a kind (`"rock"`, `"bank"`, `"orca"`)
  forces that kind.
- Anything else: `params`, a deep patch over the finished `SceneParams`
  (`{"params": {"coast": {"distanceToWater": 6}}}`). It's applied last, so the title and derived
  values don't follow it.
- Unknown fields and bad values throw, naming the field.
- Forced features are still placed normally (a crab needs sand near the camera in frame; a boat is
  skipped if there's no sea spot).
- Light it to see it: front-lit first (`"sunAzimuthDeg": 160`, `"timeOfDay": "daylight"`), then
  backlit for looks.

### Adding a spec field

Every new random feature gets one. Always make the draw, then apply the force via
`or(drawn, force)`, `forced()` or `forcedKind()`, so unforced specs stay byte-identical
(`test/sceneSpec.test.ts`). Props read `ctx.params.overrides`. Add the field to the list above.

## Fixed dates

- Eclipses:
  - 2024-04-08, 2026-08-12: total solar;
  - 2024-10-02, 2026-02-17: annular;
  - 2025-03-29: partial solar;
  - 2025-03-14, 2025-09-07, 2026-03-03: blood moon;
  - 2026-08-28: partial lunar.
- Looks (re-found 2026-10-23 after places, PLAN_BIOMES 1a, reshuffled every date):
  - 2024-01-03: Arctic beach (arctic-canada), driftwood, kelp, icebergs, midday;
  - 2024-11-23: nordic beach (nova-scotia), kelp, moon by day;
  - 2024-09-05: Mediterranean beach (north-africa-levant), seagrass, shells;
  - 2024-02-26: tropical golden hour (indonesia);
  - 2024-09-06: Mediterranean waterspout season (western-med, open sea);
  - 2024-04-24: storm + shelf cloud (norway-west).
- For a look, prefer a spec (`place`, `biome`, `timeOfDay`…) over a date: dates change
  whenever the main stream does.

## Ask the generator, don't render: `scripts/params.mjs`

Params are cheap (3 years in ~1.5 s). Use the script for frequencies, which days, what a spec
gives, real dates (eclipses) and "is it there at all?". Use specs for looks.

```sh
node scripts/params.mjs --stats 'p => p.weather.formations'                 # counts over 3 years
node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-06
node scripts/params.mjs --scene '{"storm":"squall"}' --stats 'p => p.weather.formations'   # spec on every day
node scripts/params.mjs --stats 'p => p.props.wildlife?.crocodile ?? null'    # prop choices
```

- `p.props` = what the props choose (`src/props/choices.ts`: gulls, marine, migratory, wildlife,
  shoreLife, debris, mangroves), on the same streams as the render.
- `--where`/`--stats` take a JS function of `SceneParams`; `--stats` counts array elements.
- Dates are `YYYY-MM-DD` or `FROM..TO`; with none it uses the test days (`test/days.ts`). Pick 4–8
  dates covering the cases (each biome, near/far, day/night).
- Must-be-in-frame features (moon, eclipse): compute from `camera.headingDeg`, `focalLengthMm`
  (36×24 mm sensor) and `horizonFraction`; don't render to find out.
- Sky features: before the first render, compare height and distance with that day's cloud layers
  (`--fields weather.formations`, altitudes in `cloudTypes.ts`). Inside the storm deck (Cb base
  600 m) or scud (300–550 m) means hidden.
