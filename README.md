# Amazing Sea Wallpaper

A new photorealistic sea-and-beach wallpaper every day, rendered in the browser
with three.js. The date is the seed: everyone sees the same scene on the same
day, and any past day can be rendered again.

Each date picks a real stretch of coast (~90 places in five oceans), its biome
(tropical, mediterranean, nordic, volcanic, desert) and climate (temperate,
subtropical, boreal, polar…), and a shore: sand or stony beach, coral reef, rock
platform, boulder shore, sea cliffs, tidal flat or salt marsh, at the day's tide.
Then the time of day, the real sun (polar night and midnight sun) and moon
phase, the night sky and aurora, weather (cirrus to thunderstorms, rainbows,
sea fog, marine layer, harmattan dust), the camera, sea state and surf, ice,
rocks, plants, boats, mountains and volcanoes, birds, seals, dolphins and whales.

## Use it

- Open the site for today's wallpaper (4K on desktop, the screen's own shape on
  phones held upright). Hover the bottom edge for prev / today / next,
  **Random** and **Download**.
- `?date=2026-06-21` a specific day (future dates show today) · `/random` a
  random past day · `?w=2560&h=1440` size · `?portrait=1|0` orientation ·
  `?frames=24` faster, slightly grainier clouds.
- `/latest.jpg` (1920×1080) and `/latest-portrait.jpg` (1290×2796, with `/latest*.json` params): today's (UTC)
  wallpapers from the daily GitHub Action, for tools that can't run JavaScript.

## Develop

```sh
npm install
npm run dev            # http://localhost:5174/
npm run build          # type-check + production build into dist/
npm test               # unit tests of the scene logic (Vitest)
node scripts/snapshot.mjs --url http://localhost:5174/ 2026-12-01..2026-12-07
node scripts/snapshot.mjs --scene scenes/examples.json   # scenes described in JSON
node scripts/contact-sheet.mjs --dir out --cols 4
```

A scene spec (`src/sceneSpec.ts`, also `?scene=<JSON>` on the page) forces any part of
a scene — time of day, biome, weather, lighthouse, crabs… — on top of a date; `knowledge/SCENE_SPECS.md`
has the fields.

Versions are in `changelog.md`. Docs are in `knowledge/`: `ARCHITECTURE.md` (decisions, how
it works, with `arch/` per area), `LESSONS.md`, `TOOLS.md`, and what appears where (`ANIMALS.md`,
`CLOUDS.md`, `COASTS.md`).

## How it works

- **Sky:** Bruneton atmospheric scattering and volumetric clouds from
  [three-geospatial](https://github.com/takram-design-engineering/three-geospatial),
  real star catalogue at night.
- **Ocean:** JONSWAP + swell spectrum via 2D FFT on three cascades; refracted
  surf with breaking whitewater, see-through shallows, caustics, foam.
- **Land and props:** everything procedural — coastline, dunes, rocks, trees,
  ice, boats, birds, whales; no downloaded models.
- **Image:** auto exposure, AgX tone mapping, bloom; each frame is rendered many
  times and averaged so the clouds converge.

## Deploy

`.github/workflows/pages.yml` deploys to GitHub Pages on every push to `main`
and daily at 00:05 UTC with fresh `latest*.jpg`. Enable it under
*Settings → Pages → Source: GitHub Actions*.

## Credits

- Atmosphere, clouds, star data and blue-noise texture in `public/assets/`:
  [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)
  (MIT). Star data: Yale Bright Star Catalog.
- Milky Way (`public/assets/milkyway.png`, built by `scripts/milkyway.mjs`):
  [NASA/Goddard Space Flight Center Scientific Visualization Studio](https://svs.gsfc.nasa.gov/4851),
  Deep Star Maps 2020; Gaia DR2 data: ESA/Gaia/DPAC.
- Moon phase: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
