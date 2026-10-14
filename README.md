# Amazing Sea Wallpaper

A new photorealistic sea-and-beach wallpaper every day, rendered in the browser
with three.js. The date is the seed: everyone sees the same scene on the same
day, and any past or future day can be rendered again.

Every date decides the time of day, sun and moon (with the real moon phase),
weather and clouds (from cirrus to thunderstorms), which of the five oceans and
what kind of coast (tropical, mediterranean, nordic, volcanic, desert), the
camera, the sea state, sea ice, rocks, plants, boats, seabird islands, migrating
birds, dolphins and whales.

## Use it

- Open the site: it renders today's wallpaper at 4K (less on small devices).
  Hover the bottom edge for the title, previous/next day and **Download**.
- On a phone held upright it renders a portrait wallpaper at the screen's own
  shape: the same day's scene, recomposed for a tall frame.
- `?date=2026-06-21` renders a specific day (future days show today);
  `/random` jumps to a random past day; `?w=2560&h=1440` sets the size
  (taller than wide = portrait); `?portrait=1` / `?portrait=0` forces the
  orientation; `?frames=24` renders faster with slightly grainier clouds.
- `/latest.jpg` (4K) and `/latest-portrait.jpg` (1290×2796) are today's (UTC)
  wallpapers rendered by the daily GitHub Action, for wallpaper tools that
  can't run JavaScript.

## Develop

```sh
npm install
npm run dev            # http://localhost:5173/
npm run build          # type-check + production build into dist/
```

Render dates headlessly and review them side by side:

```sh
node scripts/snapshot.mjs --url http://localhost:5173/ --w 1920 --h 1080 2026-12-01..2026-12-07
node scripts/contact-sheet.mjs --dir out --cols 4
```

`PLAN.md` documents the design, how each part works, decisions and findings.

## How it works (short version)

- **Sky:** Bruneton precomputed atmospheric scattering
  ([@takram/three-atmosphere](https://github.com/takram-design-engineering/three-geospatial)),
  volumetric clouds ([@takram/three-clouds](https://github.com/takram-design-engineering/three-geospatial)),
  real star catalogue at night.
- **Ocean:** JONSWAP + swell spectrum synthesised with a 2D FFT on three
  cascades; LEAN-style roughness; refracted surf, see-through shallows, caustics
  and Voronoi foam near the shore.
- **Land and props:** procedural coastline, dunes and hills; procedural rocks,
  sea stacks, trees, grass, sea ice and icebergs, boats, birds, dolphins and
  whales — no downloaded models.
- **Image:** auto exposure, AgX tone mapping, bloom; the frame is rendered many
  times and averaged so the stochastic clouds converge.

## Deploy

`.github/workflows/pages.yml` builds the site and deploys it to GitHub Pages on
every push to `main`, and daily at 00:05 UTC with a fresh `latest.jpg`.
Enable it in the repository under *Settings → Pages → Source: GitHub Actions*.

## Credits

- Atmosphere, clouds, star data and the blue-noise texture in `public/assets/`
  come from [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)
  (MIT). Star data: Yale Bright Star Catalog.
- Moon phase: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
