# Amazing Sea Wallpaper

A new photorealistic sea-and-beach wallpaper every day, rendered in the browser
with three.js. The date is the seed: everyone sees the same scene on the same
day, and any past day can be rendered again.

Each date picks the time of day, sun and real moon phase, weather (cirrus to
thunderstorms, rainbows), one of the five oceans and a coast (tropical,
mediterranean, nordic, volcanic, desert), the camera, sea state and surf, ice,
rocks, plants, boats, mountains and volcanoes, birds, dolphins and whales.

## Use it

- Open the site for today's wallpaper (4K on desktop, the screen's own shape on
  phones held upright). Hover the bottom edge for prev / today / next,
  **Random** and **Download**.
- `?date=2026-06-21` a specific day (future dates show today) · `/random` a
  random past day · `?w=2560&h=1440` size · `?portrait=1|0` orientation ·
  `?frames=24` faster, slightly grainier clouds.
- `/latest.jpg` (4K) and `/latest-portrait.jpg` (1290×2796): today's (UTC)
  wallpapers from the daily GitHub Action, for tools that can't run JavaScript.

## Develop

```sh
npm install
npm run dev            # http://localhost:5173/
npm run build          # type-check + production build into dist/
node scripts/snapshot.mjs --url http://localhost:5173/ 2026-12-01..2026-12-07
node scripts/contact-sheet.mjs --dir out --cols 4
```

`PLAN.md` has the status, versions, design decisions and lessons learned.

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
- Moon phase: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
