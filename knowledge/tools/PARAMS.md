# No-render tools: params, profile, tests

Index and shared conventions: [TOOLS.md](../TOOLS.md).

## `scripts/params.mjs`: ask the generator

All test days in ~1.5 s. Use it for frequencies, which days, what a spec gives, real dates
(eclipses) and "is it there at all?". Pick 4–8 dates covering the cases (each biome, near/far,
day/night) when not running all days.

```sh
node scripts/params.mjs --stats 'p => p.weather.formations'                  # counts (each array element)
node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
node scripts/params.mjs --scene '{"storm":"squall"}' --stats 'p => p.weather.formations'   # spec on every day
node scripts/params.mjs --scene scenes/stony.json --fields title,place.id    # each scene of a file
node scripts/params.mjs --stats 'p => p.props.wildlife?.crocodile ?? null'   # prop choices
```

Besides `SceneParams`, expressions see:
- `p.props`: what the props choose (`props/choices.ts`), on the render's own streams. Placement
  can still miss the frame.
- `p.placeData`: the day's resolved place (`places.ts` `Place`: weight, tide, reef, material and
  sand chances, pools).
- `p.view`, `p.ctx`, `src.X`, `props.X`: below.

### Where props land, no render: `--project`

Builds the props on the params the page renders (implies `--rendered`; ~1 s a day) and prints, per kind, what
`snapshot --props` does, then the `--rows` nearest points in frame: distance, shore `s` and `a`, height, height
above the ground, pixel. Use it **before a first render** of a new prop, and for "where does this end" or "what's
beside the camera". Kinds: `props/index.ts`, comma-separated, or `all`.

```sh
node scripts/params.mjs --scene scenes/snow.json --project ice-foot,rocks --rows 6
#   ice-foot: 1/1 in frame, nearest 2946 m, box [0,492,1730,510]     ← box centre of one long mesh
#       dist       s       a       y  above   px
#        6.4    -4.6     6.4     0.4     0.0   1259,776              ← its real nearest point
```

Points are a mesh's vertices or an instance's origin, so a big instanced piece is measured at its origin.

### Which camera: `--rendered`

`generateParams` is attempt 0; the page renders `generateSceneParams`, which re-rolls a bad framing. Measured over
the 1095 test days (2026-11-06): a re-roll happens on **214 days, 30% of the 715 land days (19.5% of all)**, and changes
**only `coast` and `camera.heightM`**; heading, lens, place, weather, snow and prop choices stay. The composition moves,
mostly toward `shoreline`:

| Land days | Attempt 0 | Rendered |
|---|---|---|
| `shoreline` | 28.1% | 37.5% |
| `along-beach` | 28.8% | 24.8% |
| `overlook` | 28.0% | 24.5% |
| `framed` | 15.1% | 13.3% |

So: **anything about the coast, the composition or how near the ground is needs `--rendered`** (slow: minutes over all
days, so narrow it with `--where` or dates). Choices, frequencies and sky framing don't. Without it, expressions reading
`p.ctx` or `p.view` end with `⚠ framing` when any of the first 40 days checked differ. `test/days.ts` (`allParams`,
`scene`, `view`) and `animals.mjs` use attempt 0 too.

### Expected shares, no sampling: `--expect`

`--expect 'pl => …'` weighs every place by its share of days: numbers are averaged, anything else
counted; null leaves a place out. Use it for a test's `expectShare` target instead of a probe test.

```sh
node scripts/params.mjs --expect 'pl => pl.biome === "tropical" ? pl.reef : null'   # 0.46
node scripts/params.mjs --stats 'p => p.coast.reef != null' --where 'p => p.placeData.reef > 0.5'
```

### What the camera sees: `p.view`

Eye height above the ground, lens, pixel angle at 1080p, nearest ground in frame, ground at the
bottom centre (`frameView` in `composition.ts`). A thing of size S at distance d is
S / (d × pixelMrad / 1000) px wide. On the beach days the page renders, the nearest ground is under
7 m on 35% of along-beach and 40% of framed days; on shorelines under 7 m on 26%, 7–40 m on 48%, past
40 m on 26%; on overlooks past 40 m on 96%. `--rendered`
uses the params the page renders (`generateSceneParams` may re-roll a bad framing; slower). Use it
for counts of what's in frame, and before calling a real day "invisible".

```sh
node scripts/params.mjs --rendered --scene '{"place":"nova-scotia","composition":"shoreline"}' --fields view 2025-07-10
node scripts/params.mjs --stats 'p => p.coast.composition + " " + Math.min(40, Math.round(p.view.nearest / 5) * 5)' --where 'p => p.coast.type === "beach"'
```

- Must-be-in-frame features (moon, eclipse): compute from `camera.headingDeg`, `focalLengthMm`
  (36×24 mm sensor) and `horizonFraction`; don't render to find out.
- Sky features: compare height and distance with the day's layers (`--fields
  weather.formations`, altitudes in `cloudTypes.ts`) first; inside the storm deck (Cb base 600 m)
  or scud (300–550 m) means hidden.

### Props and helpers on real days: `p.ctx`, `src.X`, `props.X`

`p.ctx` is the props' `PropContext` at 1080p (render camera and frustum, `ground`, `visible`,
`inFrame`, `distance`, `rng`; no wave field, so `seaLevel` is 0), built on first use. Expressions
naming `src.X` or `props.X` get `src/X.ts` and `src/props/X.ts` (all but the browser-only ones:
main, workers, assets, clouds, meshPreview, scene; with `--ref` both sides see this tree's).
Use these instead of throwaway test files to probe a creator, a placement rule or a height
helper. Creators build meshes (ms each): use a spec or a few dates.

```sh
node scripts/params.mjs --scene '{"place":"fundy","coast":"tidal-flat","tide":"high"}' --stats 'p => p.ctx.ground(0, 0) > p.coast.runup'
node scripts/params.mjs --scene '{"saltMarsh":true,"composition":"framed"}' --stats 'p => props.saltMarsh.createSaltMarsh(p.ctx).reduce((n, m) => n + m.count, 0) > 300' 2025-07-01..2025-07-20
node scripts/params.mjs --scene '{"coast":"tidal-flat"}' --stats 'p => src.terrain.worldToShore(p.coast, 0, 0).map(Math.round)' 2025-07-10
```

### Sky directions in the frame: `src.skyFrame`

`skyFrame.ts` projects world directions exactly as the render camera does (lens, yaw, pitch,
roll; the horizon's dip if given), with no WebGL: `project(p, dir)` → NDC (±1 at the edges),
`pixelOf(p, dir, w, h)`, `inSky(p, dir, margin, minElDeg)`, `unproject(p, nx, ny)`,
`dirFromAzEl`, `azEl`. Use it for anything placed in the sky (and in code, from `params.ts`):

```sh
# Is the galactic centre in frame tonight, and where?
node scripts/params.mjs --scene S --stats 'p => { const d = src.skyClock.apply(src.skyClock.skyRotation(p).matrix, src.meteors.radec(266.4, -28.9)); return src.skyFrame.pixelOf(p, d, 1920, 1080)?.map(Math.round) ?? "out" }'
```

Checking only the azimuth missed the vertical field: three "core in frame" nights had it 20°
above the top edge.

### Sky shaders on the CPU: `--line`

Sky features with a TypeScript mirror (`aurora.ts` `auroraRay`, `nightGlow.ts` `nightGlowS10`)
can be read along a line of pixels without rendering, in cd/m²: the same line format and stats
as the render's `params.debug.probeLine` (tools/DEBUG.md), so the two compare directly.

```sh
node scripts/params.mjs --scene scenes/aurora.json --line '[{"az":-25,"el":[4,30]},{"az":[-40,40],"el":12,"step":0.1}]'
# 2026-02-18  az -25 el [4,30]: no bands, ±0.41% ripple; mean 1.05e-3, 6.59e-4–2.09e-3; grain 0.0%
#     ▂▃▃▄▆▇█████▇▆▆▅▄▄▃▃▃▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```

- `--sky aurora,glow` picks the sources (default both, summed; the glow includes the Milky Way
  from `test/milkyWayMap.mjs`). `--jitters N` averages the aurora over N layer offsets (default 8,
  what the per-pixel offset gives; `grain` is the spread between them); `--jitters 1` is one
  pixel's view, to compare with a render line pixel for pixel.
- Term by term: `src.nightGlow.airglowPattern(p.nightGlow, dir)` (crests, patches, edge-on,
  mottle), `src.aurora.auroraRay(a, azFromPole, el, jitter)` (RGB before the air),
  `src.skyMirror.airTransmittance(el)` (takram's RGB transmittance), and `src.skyMirror`
  `mirrorLine`/`lineStats` for your own function along a line.
- Validated against renders (2026-11-04): airglow means within 1–2% and the same shape along
  lines; aurora columns and rows within 1–3% (peaks 2.09 vs 2.10e-3 cd/m², the same 3.9° folds).
  Not mirrored: the moonlit and twilight sky (Bruneton), clouds, stars.

### Which days did a change touch: `--ref`

`--ref HEAD` generates every test day with that commit and with this tree and counts the days
that differ per top-level param (fields added since are listed, not counted). Use it for the
changelog's "N of 1095 days change" and to catch cascades (a new draw on the wrong stream shows as
`camera` or `ocean` changing on every day).

- `--list` prints each changed day's leaf values before → after (first `--limit N`, default 20).
- ⚠ `--fields a.b` **narrows the comparison** to those fields (other changes aren't counted), it
  doesn't only choose what's printed: `--fields latitudeDeg` reports "0 changed".
- **Where:** `--changed 'p => …'` counts a value over the changed days (new params); `--where`
  keeps only days whose new params pass. One call each instead of listing dates and re-querying:
  ```sh
  node scripts/params.mjs --ref HEAD --changed 'p => Math.abs(p.latitudeDeg) >= 63'   # all true?
  node scripts/params.mjs --ref HEAD --changed 'p => p.place.climate'                  # which climates
  node scripts/params.mjs --ref HEAD --where 'p => Math.abs(p.latitudeDeg) < 63'       # expect 0 changed
  ```
- **Did the shares move:** `--ref HEAD --stats 'p => …' [--where …]` prints each value's share at
  the ref and now side by side, with the change in points (⚠ at ≥ 5). `--where` runs on each
  side's own params; a field the ref lacks reads as undefined there. Run it on every choice a
  change touches before rendering.

## `scripts/profile.mjs`: coast shape without rendering

~0.6 s/scene, TS mirror of the terrain shader, on the params the page renders. Use it for any
terrain or depth feature before a render, and compare every **drawn** number with the
**reached** one.

```sh
node scripts/profile.mjs --scene scenes/beach-states.json --out $SP/profile
node scripts/profile.mjs --scene '{"place":"namibia","coast":"beach","swellHeight":2.5,"swellPeriod":12}' 2024-06-11
```

Prints:
- state, grain, swell, slopes, width, dune, bars, rips, cusps, ridges, tide, run-up, beach lines,
  break depth; the camera's place, lens and nearest ground;
- **dry-land checks**: the share of land behind the beach (and of a marsh beach's marsh, or a
  flat's high marsh) below today's spring high water + run-up, `⚠ floods` over 10%;
- reef days: crest and lagoon depth drawn vs reached, flat, passes, shelter; rock shores: back
  face, platform, edge, scarp foot drawn vs reached (medians over 200 m), camera ground; tidal
  flats: flat, marsh and creeks drawn vs reached;
- how far the surf zone reaches (`surfReach`) and **where a full wave breaks along the camera's
  cut** (bands of s with their width: a 2 m strip on a steep face won't read as a white line from
  afar);
- heights along s at the camera, through the nearest rip channel and the nearest reef pass.

Writes `NAME.profile.png` (`--res` m/px, default 1; tidal flats ≥ 4 m/px, marsh to today's
water, ±1 km): sea at the top, a across, land brown→green by height, water light→dark blue by
depth, 0.5 m contours, black waterline, white where the day's waves break, red camera, 50 m grid,
and the **view cone** in yellow (the frame's edges on the ground and an arc at `view.nearest`).
It shows what crosses the frame and from how near: a creek or ridge 12 m beside the camera that a
long lens stretches across the picture shows here, not after a render.

### A prop against the shore: `profile.mjs --props`

`node scripts/profile.mjs --scene S --props ice-foot [--at A]` prints a cross-section through the prop at low, mid and
high tide: `s`, ground, water depth, the prop's top, and its height above the ground or water. Use it for anything
standing on the shore, to see before rendering if it hangs over the water or drowns at some tide. An instance's height
is its box, so a rounded rock reads a little taller than it is.

## Tests: props without a render (`test/days.ts`)

- `scene(spec)` validates the spec's JSON as the page does, so a wrong field fails instead of
  forcing nothing; `field: undefined` means not forced.
- `propsOf(p)`: the tests' `p.props` (`propChoices` on the render's `'props/<kind>'` streams,
  cached per params). Use it instead of deriving `Random.derive(p.seed, 'props/…')` by hand.
- `view(spec, height)` / `viewOf(params, height)`: a `PropContext` (camera, `pixelAngle`) without
  WebGL: test what a creator places, how far and how many pixels, over specs and real days.
- `expectDryCameras(spec, { count, compositions, above })` forces every tide stage × composition
  of a coast spec and checks the camera stands on finite ground above today's water (`above(p)`,
  e.g. the run-up). Run it for every new coast kind or shore profile: a profile built for one
  tide can drown the camera at another.
- Table checks over every place × climate × ocean (`test/climate.test.ts` "grows only what the
  climate allows") catch a wrong combination without sampling; add one when a table gains a key.

## `scripts/animals.mjs`

`node scripts/animals.mjs` prints the animal shares table (all days, per biome, per ocean;
choices, not what lands in frame): paste it into ANIMALS.md.
