# Debug switches and views: `params.debug`

Render-only switches (`src/debug.ts`), set through a spec's `params` patch
(`{"params":{"debug":{…}}}`), so every script takes them (`snapshot`, `diff --off`,
`params --fields debug`). The generator never reads them: no draw or other param changes
(`test/debug.test.ts`), and a misspelt field throws. `scenes/debug.json` shows each view on a
rock platform and a beach. Tools: [TOOLS.md](../TOOLS.md).

| Field | Does | Use it for |
|---|---|---|
| `terrainGrid: 2` | terrain grid cells × 2 denser each way (4× the vertices over the same view wedge; 0.25–4) | is it grid aliasing? `diff --off '{"params":{"debug":{"terrainGrid":2}}}'`: teeth that change are the grid's |
| `props: false` | no props (markers still drawn) | terrain and sea alone; with `clouds: []`, `weather: "clear"`, `islands`/`landform`/`lighthouse`/`colony`/`pinnipeds: null` a terrain-only render |
| `markers: [...]` | a post (~6 px wide, ≥ 1 m) at each point, a colour per source in list order (red, cyan, yellow, green, magenta, white) | where things stand: `camera-ground`, `edge-rocks`, `water-rocks`, `props:KIND` (each piece of a prop kind, e.g. `props:pinnipeds`) |
| `passes: {name: false}` | switches off `clouds`, `aerial` (aerial perspective), `skyFill`, `bloom`, `reflection` (planar), `shadows` (props cast none), `cloudLight` (sea and terrain keep the clear sky's skylight, without what the clouds scatter down), `cloudShade` (nothing reads the clouds' shadow map), `skyOcclusion` (no skylight lost under tree crowns), `softShadows` (the fine slice's hard filter, as before phase 4.3), `beamShadow` (lighthouse beams lit all the way, through land and sea), `beamSweep` (lighthouse beams frozen over the shutter, as before 0.129), `frameMeter` (the frame's own meter still reads, ×1), `longExposure` (no long-shutter look), `nightSkylight` (props keep the cube's full night light, as before 0.128), `stars` (the star catalogue), `glow` (Milky Way, airglow, zodiacal light, light pollution), `meteors`, `aurora`, `auroraClouds` (the display's light on the clouds), `shortWaves` (no ripple layers, no light-air onset: the sea as before 0.130), `reflectionRay` (the mirror image nudged by `N.xz · 0.04` as before 0.131), `reflectionStreaks` (one square mip lookup as in 0.131), `reflectionHaze` (no haze on the mirror image, far land left out as in 0.132), `seaHaze` (the frame's sea haze off, clouds and their light kept: an object's unhazed colour; `haze.mjs`), `wetMirror` (pools and wet sand reflect only the sky, as 0.133) | which pass causes a glow, rim or dark band: one `diff --off` per pass |
| `cloudShade: N` | forces the cloud shade everywhere, 0 (no direct light) to 1 (none) | with `shadeView`, proves coverage: at 0 anything not black doesn't read the shade (surf spray keeps its skylight). Works on clear days too |
| `shadeView: true` | everything that reads the land and cloud shade shows it, grey: black in shade, ~0.25 in sun. Use `passes.bloom: false`, `exposure: 1`. `passes.aerial: false` removes the haze over far land, **and the clouds with it** (they're composited there): a mountain the deck hides in the render shows bare, so it's a map of the shade, not the picture | where shade falls, peaks above a deck. `scenes/shadows.json` has one scene per kind of object |
| `exposure: N` | fixed exposure (the metered one is `debug.exposure` in each render's `.json`) | comparing renders whose sky or weather differs (`diff.mjs --keep-exposure` sets it) |
| `terrainView` | false colour on the terrain, lit by the scene's light: `slope` (grey by steepness, red where the height bends by 3–10 px within ~2 grid cells: aliasing candidates; less red with `terrainGrid: 2`), `relief` (rock: gullies red, boulders green, bed bands blue; beach: cusps red, bars green, storm ridges blue), `lines` (today's still water cyan, run-up orange, today's high water green, spring high water yellow, beach high-tide line magenta, storm line red), `shore` (s blue and a orange every 10 m, s = 0 white, `waterline` cyan) | which height term made a feature; whether lines sit where props and wet bands assume; the shore frame (wobble, curvature) round the camera |
| `probeLine: {az, el, step}` or a list | reads lines of single pixels (az from the view; one of az/el a `[from, to]` range): per pixel cd/m² and final RGB, and per line `lineStats`: bands (period, regularity), ripple, stars left out, a sparkline. Same format as `params.mjs --line` on the CPU mirrors | "stripes or grain? from what?": compare the render's line with the mirror's ("Lines of pixels" below) |
| `probe: [...]` | reads the render at points `[x, y]` (fractions of the image, y down) or sky directions `{az, el}` (degrees, az from the view, + right): **raw** radiance (render units, before exposure and white balance), its luminance in **cd/m²** and **mag/arcsec²**, **exposed** (after exposure and white balance, before bloom and tone mapping), **final** 8-bit; mean and peak of a 5×5 box (`probeHalf`: 0–20); `⚠ clipped` past the grade's clamp (40). `snapshot.mjs` prints one line per point; the `.json` has them under `debug.probe` (`src/probe.ts`) | "how bright is X against the sky behind it?" in numbers: a star or planet's peak vs the sky beside it, an aurora arc vs the sky between arcs, a colour's real RGB. Instead of reading JPEGs or boosting a term ×20 to find it |
| `oceanView` | false colour on the sea: `shelter` (blue → red), `breaking` (deep blue, steepening green, breaking red), `depth` (sand → blue over 15 m, a line every metre), `foam` (coverage, grey) | calm water, break lines, depth under the camera's view |

- **Bisect a height term without code:** patch it off in `params.coast` and diff, e.g.
  `diff --off '{"params":{"coast":{"rock":{"dip":0}}}}' --keep-camera` (also `gully`, `relief`,
  `boulder`; on beaches `bars: []`, `cusps: null`, `ridges: []`). The term whose diff shows the
  feature is its cause. Read the feature's period first (a saw every ~1 m on rock was the beds'
  bedding / dip).
- Check a patch landed before rendering: `params.mjs --scene S --fields debug,coast.rock`.

## The pixel probe: brightness in numbers

```sh
node scripts/snapshot.mjs --out $SP/p --w 1920 --h 1080 --frames 16 \
  --scene '{"date":"2024-02-12","params":{"debug":{"probe":[{"az":0,"el":12},{"az":2,"el":12},[0.5,0.1]],"probeHalf":0}}}'
#  probe az 0 el 12 px 960,301: raw … (peak …), 2.3e+1 cd/m², 9.24 mag/″²; exposed …; final 97,81,129 (peak …)
```

- World points: `{"world":[x,y,z]}` (m) goes through the render camera; `{"mirror":[x,y,z]}` is
  where the flat sea shows that point's reflection (the point at −y), for comparing an object
  with its mirror image (× Fresnel). Take the points from `params.mjs --project KIND --above M`
  (x, y, z and both pixels), and skip rows with a `covered by`: the probe reads whatever is in
  front. Out of frame: "out of frame". The render's JSON has `debug.cameraPosition`.
- Sky directions go through `skyFrame.ts` with the render's own aspect and the horizon's dip:
  the same pixel the render camera draws them at (`test/skyFrame.test.ts`). A planet, moon or
  radiant: get its direction with `params.mjs` (`src.skyFrame.azEl(dir)`), subtract the
  heading, probe it and a point a degree beside it.
- Units: raw is what the sky shader and the lights output (one render unit ≈ 75,700 cd/m² by
  day; at night the units of the moon or the starlit stand-in, `starLight.ts` `renderPerLux`);
  cd/m² and mag/arcsec² convert back. Checks: a daylight sky under broken cloud reads ~2,000–3,000
  cd/m²; a Bortle-2 night zenith ~21.6 mag/arcsec².
- Exposed values: ~0.1–0.2 is a mid sky; final 8-bit after AgX, saturation and contrast.
- A point (star, planet, meteor): set `probeHalf: 0` and probe its pixel; the peak is what shows.

## Lines of pixels: bands or grain? (`probeLine`)

A stripe, a band or a texture in the sky is a question about a *line* of pixels: does it repeat
(bands, with a period), or is it grain, stars, or the edge of something smooth?
`params.debug.probeLine` reads a line (or a list of up to 12) of single pixels and prints
`lineStats` (`skyMirror.ts`): the period and how regular it is, the ripple (RMS of the line minus
a 2° running median), stars left out, and the shape.

```sh
node scripts/snapshot.mjs --out $SP/l --w 1920 --h 1080 --frames 16 --scene '{"date":"2026-02-18", …,
  "params":{"debug":{"passes":{"aurora":false},"probeLine":[{"az":-25,"el":[6,30]},{"az":[-40,40],"el":12,"step":0.1}]}}}'
#  probe line az -25 el [6,30], 481 px: bands every 2.05° (corr 0.34), ±0.32%; mean 6.34e-4, …; 2 spikes (stars) left out
#    ▇████████████████▇▇▇█▇▇▆▆▆▅▅▅▅▅▅▅▅▄▄▄▄▄▃▃▃▃▃▃▃▂▂▂▂▂▁▁▁▁▁▁▁▁▁
```

- `az` is from the view (+ right), `el` above the horizon; one of them a `[from, to]` range,
  `step` deg (default 0.05, ~a pixel at 20 mm 1080p). The `.json` keeps every sample (az, el,
  pixel, cd/m², final RGB) under `debug.probeLine`.
- **The same line runs through the CPU mirrors** (`params.mjs --line`, tools/PARAMS.md): compare
  mean, shape and period number for number. When they disagree, the mirror is wrong or the
  shader isn't what you think; find which before tuning anything.
- To read one shader term along the line (the airglow's crests, patches, a noise value): render
  three times with a temporary `pattern = 0.0`, `1.0` and `<term>` in its place; per pixel
  `(v − v₀) / (v₁ − v₀)` is the term's value on the GPU. Never test a constant expression this way
  (`ngHash(vec2(3.0, 1.0))`): the compiler folds it at higher precision than the shader runs.
- Bands in a sky feature: switch its pass off on the same frame first (`passes.aurora: false`):
  the aurora's last "bands" were the airglow's.

