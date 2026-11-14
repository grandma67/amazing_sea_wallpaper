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

## Daily desktop wallpaper

> **Status: planned.** The scripts in `crons/` aren't written yet; this is how they will work
> (plan: `knowledge/plans/CRON.md`).

A small script sets your desktop background to the day's `latest.jpg` every morning. It runs once
at 07:xx local time. The minute is picked at random when you install, so not everyone fetches at
once. If the site hasn't published today's image yet (the daily render usually lands between 01:00
and 08:00 UTC), it checks once more about 3 hours later. It also runs when you log in, if the
morning run was missed. Nothing to install: it uses bash and curl, or PowerShell on Windows.

**Ubuntu (GNOME; KDE and XFCE best effort) and macOS**

```sh
git clone https://github.com/grandma67/amazing_sea_wallpaper.git
cd amazing_sea_wallpaper
./crons/install.sh              # add --portrait for an upright screen, --hour 8 for a later run
```

Without cloning, download the installer, read it, then run it:

```sh
curl -fsSL https://raw.githubusercontent.com/grandma67/amazing_sea_wallpaper/main/crons/install.sh -o install.sh
less install.sh && bash install.sh
```

Ubuntu uses your user crontab plus a login autostart entry. macOS uses a LaunchAgent, which
catches up after sleep. On macOS the first run asks to let the terminal control
"System Events": allow it, or the wallpaper can't be set.

**Windows 10 / 11 (PowerShell)**

```powershell
git clone https://github.com/grandma67/amazing_sea_wallpaper.git
cd amazing_sea_wallpaper
Unblock-File .\crons\*.ps1
powershell -ExecutionPolicy Bypass -File .\crons\install.ps1      # -Portrait, -Hour 8
```

This registers a Task Scheduler task, *AmazingSeaWallpaper*, that runs daily and at logon, plus a
one-off retry task when needed. It doesn't change your execution policy.

**Day to day**

| | Linux / macOS | Windows |
|---|---|---|
| Set today's now | `~/.local/share/amazing-sea-wallpaper/sea-wallpaper.sh --now` (macOS: `~/Library/Application Support/AmazingSeaWallpaper/`) | `& "$env:LOCALAPPDATA\AmazingSeaWallpaper\sea-wallpaper.ps1" -Now` |
| Status, last image, log | `./crons/install.sh --status` | `.\crons\install.ps1 -Status` |
| Remove | `./crons/install.sh --uninstall` | `.\crons\install.ps1 -Uninstall` |

The installer copies the script out of the clone, so you can delete the clone afterwards. The
last 7 images are kept in that folder. Images are 1920×1080 (portrait 1290×2796), and bigger
screens scale them up. The image follows the UTC date, so east of UTC the desktop can show the
site's previous day until the morning's render is published. For a fork, set `--url
https://<you>.github.io/<repo>/`.

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
- Animal skins (`public/assets/skins.png`, baked by `scripts/skinBake.py`): patterns
  derived from photos on Wikimedia Commons; each photo, author and licence is listed in
  `src/props/skins.json`. CC BY photos:
  - "Nile Crocodile basking (13869043013).jpg" by Steve Slater (CC BY 2.0, [source](https://commons.wikimedia.org/wiki/File:Nile_Crocodile_basking_(13869043013).jpg))
  - "Amblyrhynchus cristatus 125217466.jpg" by juan_carlos_caicedo_hdz (CC BY 4.0, [source](https://commons.wikimedia.org/wiki/File:Amblyrhynchus_cristatus_125217466.jpg))
  - "Varanus salvator (Asian water monitor).jpg" by Tan Pek Nan (CC BY 4.0, [source](https://commons.wikimedia.org/wiki/File:Varanus_salvator_(Asian_water_monitor).jpg))
  - "Chelonia mydas (AM LH858-7).jpg" by Australian Museum (CC BY 4.0, [source](https://commons.wikimedia.org/wiki/File:Chelonia_mydas_(AM_LH858-7).jpg))
  - "Chelonia mydas (AM LH645-5).jpg" by Australian Museum (CC BY 4.0, [source](https://commons.wikimedia.org/wiki/File:Chelonia_mydas_(AM_LH645-5).jpg))
  - "Shiny skin.jpg" by Emran Kassim (CC BY 2.0, [source](https://commons.wikimedia.org/wiki/File:Shiny_skin.jpg))
  - "Atlantic Ghost Crab - Ocypode quadrata, Assateague Island National Seashore, Berlin, Maryland (23992149308).jpg" by Judy Gallagher (CC BY 2.0, [source](https://commons.wikimedia.org/wiki/File:Atlantic_Ghost_Crab_-_Ocypode_quadrata,_Assateague_Island_National_Seashore,_Berlin,_Maryland_(23992149308).jpg))
  - "Asterias rubens 02 Espen Rekdal.jpg" by Espen Rekdal / Espen Rekdal Photography (CC BY 4.0, [source](https://commons.wikimedia.org/wiki/File:Asterias_rubens_02_Espen_Rekdal.jpg))
