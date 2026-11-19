# Tools

Reason from numbers (no-render tools) before rendering. Each script's header lists every option
(`params.mjs --help` prints it). `SP` = scratchpad. Spec format and fields:
[SCENE_SPECS.md](SCENE_SPECS.md).

| Question | Tool | Guide |
|---|---|---|
| How often, which days, what a spec gives, real dates | `params.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| Which days did my change touch; did shares move | `params.mjs --ref HEAD` | [tools/PARAMS.md](tools/PARAMS.md) |
| Which days give what (one line per day, from an expression) | `params.mjs --where … --each 'p => …'` | [tools/PARAMS.md](tools/PARAMS.md) |
| Expected share for a test target (no sampling) | `params.mjs --expect` (`--weight` for a subset of days) | [tools/PARAMS.md](tools/PARAMS.md) |
| Which fields exist, their values or range (before writing `--where`) | `params.mjs --schema PREFIX` | [tools/PARAMS.md](tools/PARAMS.md) |
| How many of a prop are in frame, per sub-kind, on real days (before rendering) | `params.mjs --count KIND [--by]` | [tools/PARAMS.md](tools/PARAMS.md) |
| How near is the ground; how many px is a thing | `params.mjs` `p.view` | [tools/PARAMS.md](tools/PARAMS.md) |
| What a creator or helper does on real days | `params.mjs` `p.ctx`, `src.X`, `props.X` | [tools/PARAMS.md](tools/PARAMS.md) |
| Where a prop lands, what's beside the camera, where it ends (no render) | `params.mjs --project KIND` | [tools/PARAMS.md](tools/PARAMS.md) |
| A prop against the shore and water at each tide (no render) | `profile.mjs --props KIND` | [tools/PARAMS.md](tools/PARAMS.md) |
| Render real days that have a feature, spread across places, coasts and light | `snapshot.mjs --where --sample` | [tools/RENDER.md](tools/RENDER.md) |
| Does it hold on other seeds | `snapshot.mjs --seeds N` | [tools/RENDER.md](tools/RENDER.md) |
| A mesh's look in its own material, at real size, at low sun | `mesh.mjs --material --scale --sun` | [tools/RENDER.md](tools/RENDER.md) |
| Coast shape, depths, break line, view cone, flooding | `profile.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| Prop choices and placement in tests | `propsOf`, `view`, `expectDryCameras` (`test/days.ts`) | [tools/PARAMS.md](tools/PARAMS.md) |
| Animal shares table for ANIMALS.md | `animals.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| See a render; where props landed; prop build time | `snapshot.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Did a feature show up; was it already broken | `diff.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Will a value overflow a half-float target (∞ on CI's SwiftShader, silently clamped on the Mac)? | `snapshot.mjs` with `params.debug.nanTrace`: `sat` per pass, sky cube and shadow channel; `debug.shadowDump` for an intermediate | [tools/DEBUG.md](tools/DEBUG.md) |
| Why did the published picture of a day look wrong (white, black, odd light); what CI rendered it from | `ciDay.mjs DATE` (the day's runs, commit, warnings, archived render numbers, then the day rendered as CI: SwiftShader, that commit, `nanTrace`) | [tools/RENDER.md](tools/RENDER.md) "Broken frames" |
| Does a new off switch give back the old image exactly | `diff.mjs --ref HEAD --off PATCH --off-here` (expect "identical"); when HEAD already has the feature (a later phase), `--off-both` | [tools/RENDER.md](tools/RENDER.md) |
| Render time vs a commit (10% rule); same image | `bench.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A new mesh alone | `mesh.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A mesh before and after a change, one command | `mesh.mjs --ref HEAD` (`NAME.compare.jpg`); a head close-up: `--focus head` | [tools/RENDER.md](tools/RENDER.md) |
| Small parts of a big mesh at real size (cones, fruit, catkins on a 17 m tree) | `mesh.mjs --focus top` (the top 30%) or `--focus box:X0,Y0,Z0,X1,Y1,Z1`; a tree with a fruit row on it: `'props/fruitPreview#fruitTree($rng, KIND, DATE?, PLACE?, CLIMATE?, LAT?)'` | [tools/RENDER.md](tools/RENDER.md) |
| Triangles a prop draws (× its instances), before building more on it | `params.mjs --count KIND` (no render), `snapshot.mjs --props` | [tools/PARAMS.md](tools/PARAMS.md) |
| Many renders in one image; zoom into one | `contact-sheet.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A number over a folder of renders (median, quartiles by group; or counts) | `summary.mjs DIR 'j => j.debug.X' --by 'j => …'` | [tools/RENDER.md](tools/RENDER.md) |
| Which pass, term or grid causes a look | `params.debug` switches and views | [tools/DEBUG.md](tools/DEBUG.md) |
| How bright or what colour is X in the render (raw, cd/m², mag/″², final RGB) | `params.debug.probe` | [tools/DEBUG.md](tools/DEBUG.md) |
| An object and its mirror image on the sea, by world point (not a guessed pixel) | `params.mjs --project KIND --above M` → probe `{world}` / `{mirror}` | [tools/PARAMS.md](tools/PARAMS.md), [tools/DEBUG.md](tools/DEBUG.md) |
| Does the sea reflect the sky it should near the horizon (calm water ≈ F × sky; is the cube right) | `horizon.mjs --scene --az` | [tools/RENDER.md](tools/RENDER.md) |
| What the water reflects: the sky cube in a direction, vs the frame's sky there | `params.debug.cubeProbe` (+ `probe` at the same az/el) | [tools/DEBUG.md](tools/DEBUG.md) |
| How the frame hazes objects (T, haze colour, which weighting) before matching it | `haze.mjs --scene --points` | [tools/RENDER.md](tools/RENDER.md) |
| Did a feature show up on real days (not specs) | `diff.mjs --where --sample --off` | [tools/RENDER.md](tools/RENDER.md) |
| Where the shore's water films are (pools, runnels, swash, damp sand) and how near the camera | `params.mjs` `p.pools` (no render: nearest pool, m and image point) → `snapshot.mjs --water` (the render's count) → `terrainView: 'water'` (see) | [tools/DEBUG.md](tools/DEBUG.md) |
| How much of real frames a wet-surface change touches (damp sand, swash, seepage, wet rock), before judging it by eye | `snapshot.mjs --where … --sample 8 --water` with the feature on and off (`--off` patch): `debug.water.share` per kind | [tools/RENDER.md](tools/RENDER.md) |
| A day's tide over time (when high water was, rising or falling, how fast) | `params.mjs` `src.tides.tideCurve(p.coast.tide, p.place.id, hours)`; `p.coast.tide.flow` | [tools/PARAMS.md](tools/PARAMS.md) |
| Does the CPU terrain (camera height, props, `p.view`, `p.pools`) match the drawn terrain | `parity.mjs` (after any height or film term edit) | [tools/RENDER.md](tools/RENDER.md) |
| A terrain shader term's value (h, shore coords, masks, rock profile) at a pixel or world point | `params.debug.terrainProbe` (not a temporary shader edit) | [tools/DEBUG.md](tools/DEBUG.md) |
| Bands or grain along a line of pixels, and from what | `params.debug.probeLine` (render) vs `params.mjs --line` (CPU mirrors) | [tools/DEBUG.md](tools/DEBUG.md), [tools/PARAMS.md](tools/PARAMS.md) |
| Where an edge is along a probe line (a lip, a ridge), how sharp in px, the levels each side; mean brightness over ranges ("face vs deck") | `edges.mjs FILE.json --mean A:B,C:D` | [tools/RENDER.md](tools/RENDER.md) |
| Rows or columns of a photo (no probe there): mean RGB, relative brightness | `rows.mjs IMAGE --rows …` | [tools/RENDER.md](tools/RENDER.md) |
| Which detail of the shelf cloud or the Morning Glory causes a look; where the shelf's lip should show (CPU) | `params.debug.shelf: {tiers: false, …}`, `params.debug.roll: {lumps: false, …}`; `src.shelfCloud.lipElevationAhead(p)` (`params.mjs --rendered`) | [tools/DEBUG.md](tools/DEBUG.md), [arch/SKY.md](arch/SKY.md) |
| A new cloud shape in the volumetric clouds | `src/cloudShapes.ts` (patch, noise, layer, switches) and its checklist | [arch/SKY.md](arch/SKY.md) "A new cloud shape" |
| Where a sky direction lands in the frame (is it in frame, which pixel) | `src.skyFrame` (`project`, `pixelOf`, `inSky`) in `params.mjs` or code | [tools/PARAMS.md](tools/PARAMS.md) |
| Does changing days in the page leak (GPU, heap, workers) | `restart.mjs` (`npm run check:restart`) | [LEAKS.md](LEAKS.md) |
| A real colour or size: albedo of a petal, bark, moss; a scan's size (CC0/CC-BY, no server) | `asset.mjs grid` (pick the region) → `asset.mjs measure SOURCE --region --hue --anchor`; `asset.mjs replay` re-measures everything recorded | "Real colours" below |
| Is a prop **visible** on a day (not behind props or terrain), which spec dates show it best; how hazed far land is | `params.mjs --find KIND` | tools/PARAMS.md "Which days show it" |
| Each plant today: kind, distance from shore, height, species, salt; on/off on the same day | `params.mjs` `p.plants`, `p.withProps(patch, f)`, `--every K` for a quick share | tools/PARAMS.md "Plants on real days" |
| Can module A import B without a cycle (B half-loaded)? | `python3 -I scripts/importReach.py src/A.ts src/B.ts`: the value-import chain from A to B, or "does not reach" | below, "Gotchas" |
| How much turf, bare land, sea a camera sees, by distance | `src.groundSeen.groundSeen(p.ctx)` in a `params.mjs` expression | tools/PARAMS.md |
| Photos of a species with a licence we can ship (PD, CC0, CC BY) | `asset.mjs search QUERY…` (numbered contact sheet; waits out Commons' rate limit) | `asset.mjs` header |
| Reference photos when the name also means other things (a keyword search fills with noise) | `asset.mjs search --wiki ARTICLE…` (the article's own photos; `--all` for share-alike ones, fine to look at, not to ship) | `asset.mjs` header |
| An animal skin from a photo (atlas layer) | `asset.mjs search` → `asset.mjs fetch commons:File:… --id ID` → `asset.mjs grid ID --px` (pixel labels) → recipe in `src/props/skins.json` → `asset.mjs patch ID` (outline on the photo beside the baked tile) → `npm run skins` (sets up its Python; warns when a layer clips; `contrast: "auto"`) → `mesh.mjs --material 'props/skins#skinPreviewMaterial()'` | `scripts/skinBake.py` header; [arch/PROPS.md](arch/PROPS.md) "Animal skins" |
| A scanned model as a prop mesh (vertex colours, levels of detail) | `asset.mjs bake ID` → `src/props/scans/ID.ts`; `mesh.mjs 'props/scans/index#scanVariant(…)'` | "Real colours" below; [plans/NATURE_PLAN.md](plans/NATURE_PLAN.md) §11 |

## Tests

`npm test` is the typecheck (~0.4 s) and Vitest: logic, no GPU and no browser, ~4 s. Helpers: `test/days.ts`, `test/mesh.ts`
([tools/PARAMS.md](tools/PARAMS.md)). `npm run test:times` prints the slowest files and tests.

| To check | Add a row or test in |
|---|---|
| A small mesh: real size, budget, deterministic, finite | `test/meshes.test.ts` (`expectMesh`, 3 seeds) |
| An animal (or any mesh built from parts) in one piece, no open tube end you can see | `test/meshLint.test.ts` (`looseParts`, `openHoles` from `test/meshLint.ts`): add every new animal and pose |
| "When this, then that" on every real day | `test/realDays.test.ts` (fails if the rule never applies) |
| Forcing a field keeps the rest of the day | `test/sceneSpec.test.ts` |
| A prop's off switch | `test/propSwitches.test.ts` |
| A new scene the prop tree should build (finite, tagged, freed, shaded) | `test/props.test.ts` `SCENES` |
| Noise and the shortcuts that skip it | `test/noise.test.ts`, `test/terrain.test.ts` (no step in the ground) |
| A rule of one feature: chances, rates, shapes | `test/<feature>.test.ts` |

**Desktop-wallpaper scripts** (`crons/`): `crons/test/run.sh` (bash, not Vitest; ~1 min) runs
`crons/test/cases-*.sh` against the scripts with a fixture site (`server.py`, a free port, a
request log), a fake clock and per-case `HOME`, and stubs that log every desktop and scheduler
call to `<folder>/stubs.log`. Options: `--only REGEX`, `--bash /bin/bash` (3.2), `--downloader
curl|wget`, `--pwsh`; `UPDATE_GOLDEN=1` rewrites `crons/test/golden/` (read the diff). Linux cases
fake `/proc`, `pgrep` and `loginctl` under `AMAZING_SEA_WALLPAPER_ROOT`. Hooks the scripts read
(off unless set): `AMAZING_SEA_WALLPAPER_HOME`, `_TODAY`, `_NOW_EPOCH`, `_STUBS=1`, `_OS`,
`_ROOT`, `_DOWNLOADER` (`none` = neither), `_RANDOM`, `_STUB_MISSING`, `_STUB_NOSESSION`.
`shellcheck --shell=bash crons/*.sh crons/test/*.sh` and PSScriptAnalyzer (`pwsh`) must be clean.
Tools, installed once at the start of any `crons/` work (not one per phase): `brew install
shellcheck wget coreutils powershell` (PowerShell is a formula now; the cask is gone), then
`pwsh -c 'Set-PSRepository PSGallery -InstallationPolicy Trusted; Install-Module
PSScriptAnalyzer -Scope CurrentUser'`. GNU `date`/`stat` (the Linux branches) on this Mac: put
symlinks named `date` and `stat` to `gdate`/`gstat` in a folder first on `PATH` for one run.
Linux distros and Windows can't run here: push a branch (ask first) and read `crons.yml`'s jobs.

Shaders are read, not compiled: `test/glsl.test.ts` checks every `/* glsl */` for reserved names, brackets and
`#include`s. What still takes a render: other GLSL errors, how anything looks, GPU memory (`check:restart`).

Keeping it fast:
- **Workers take whole files, so the longest file sets the wall time.** Past ~5 s, split it (`props`, `propSwitches`).
- **One `expect` per list, not per item:** `expectEvery`, or `if (…) expect.fail(…)` in a loop. `expect` per vertex took
  7.7 of the 7.9 s of the tree tests.
- **Build once:** a test file's rules on one scene share the build (`test/props.test.ts` `build`).
- **Samples spread over the years** (`i % N === 0`), not the first N days: fewer days see more seasons, and first-N
  samples hid real cases (below). A day's props cost ~160 ms (20–200 ms a creator), `measureFrame` ~25 ms, `generateParams` 0.1 ms. Threads or forks: the same.
- `isolate: false` (`vite.config.ts`): modules load once per worker, so a test mustn't change a module's state or the
  shared `allParams()`. Check with `npx vitest run --sequence.shuffle.files`.

Speed work on `src/`: hash its output before and after (every prop mesh, the framing, terrain heights against
`HEAD` in a worktree), then `bench.mjs --ref HEAD` for pixels; then inject bugs into the new code (LESSONS.md
"A speed change is proved by fingerprints").

Coverage: `npm i --no-save @vitest/coverage-v8@5` (then `git checkout package-lock.json`), and `npx vitest run --exclude
test/glsl.test.ts --coverage --coverage.reportOnFailure --coverage.include='src/**'`. The GLSL test's raw imports count
each source file as fully covered, so leave it out.

## Shared conventions

- **Specs** (`--scene`, all scripts): a JSON file or inline JSON; one spec, a list, or
  `{ "base": {…}, "scenes": [{ "name": …, … }] }` (each scene merged deeply over the base:
  objects merge, the rest replaces). Shared code: `scripts/lib.mjs`.
- **Dates**: `YYYY-MM-DD` or `FROM..TO` (snapshot also `today`). The test days are 1095 days
  from 2024-01-01 (`test/days.ts` `DAYS`).
- **`--ref REF`** (params, snapshot, diff, bench) checks the commit out into a temporary worktree
  under `/private/tmp/claude-*` sharing `node_modules`, removed afterwards: compare without
  stashing. If the script dies first (Ctrl+C, `kill -9`, a closed terminal),
  `worktreeReaper.mjs`, a detached watcher, stops its server and removes it within a second. Ports: bench 5175, snapshot/diff 5177 (`refServer.mjs`); params needs no server.
  Spec fields the ref doesn't know are dropped and named.
- **Options are checked:** every script throws on an option it doesn't know (`--match` on
  snapshot used to be ignored and the whole spec file rendered) and on a leftover argument
  (`contact-sheet.mjs DIR` used to sheet `out/` and overwrite `out/contact-sheet.jpg`: it's
  `--dir DIR`). Dates must be `YYYY-MM-DD`; dates beside `--scene` or `--where` are an error.
  A new script calls `rejectUnknown()` (and `rejectPositional()` if it takes none) after its
  last `option`/`flag` (`lib.mjs`).
- Long outputs put the summary last (bench's table, params' "… N more not shown").
- **Browser messages**: every script that opens a page uses `watchPage(page)` (`lib.mjs`): page
  errors, console errors and warnings, and GL messages grouped per render (`48× [.WebGL-0x…]
  GL_…`). snapshot (so diff and bench) turns GL messages into ⚠ warnings, mesh prints them,
  restart fails on them. A new script that opens a page uses it too.

## Real colours from photos and scans (`asset.mjs`)

- **Brightness:** a photo's is the camera's (LESSONS.md "Colours from photos"). Take hue from
  photos; brightness from a calibrated scan (Poly Haven, ambientCG), or `--anchor` a known material
  **next to the target, in the same light**. Petals with no anchor:
  the brightest unclipped cluster ×0.8 (`--petal`), ±30%.
- **Region:** `asset.mjs grid ID` writes the image with a labelled 10% grid; read `--region` off it,
  don't guess from a contact sheet. `--hue H0,H1[,S]` keeps only the target's pixels (flowers, not
  the sunlit leaves and glints a cluster mixes in); check two regions agree.
- **Record:** every measure goes into `scripts/asset-measures.json` (committed); `assets-src/` isn't.
  `asset.mjs replay [ID]` measures them all again. Commons rate-limits after ~5 quick requests (the
  script retries).
- **Bake a scanned model** (NATURE_PLAN phase 11): `asset.mjs fetch polyhaven:ID` (glTF and its
  `.bin`), then `asset.mjs bake ph_ID [--lods 5000:0.003,1500:0.012] [--texel 2]` →
  `src/props/scans/ph_ID.ts` (each glTF node a variant, levels of detail finest first; recorded in
  `scripts/asset-bakes.json`, which `replay` rebakes byte for byte). Register it in
  `src/props/scans/index.ts`; preview with `mesh.mjs --material 'props/vegetation#plantMaterial()'
  'props/scans/index#scanVariant("ph_ID", 0, 0)'`. Each level stops at its triangles or its error
  (a share of the plant's size), whichever comes first: thin stalks need an error below their width.

Anchors (linear albedo; Rec. 709 luminance is what `--anchor` matches):

| Anchor | Albedo | Note |
|---|---|---|
| White copy paper behind a specimen | 0.8, 0.8, 0.8 | the best found (eucalyptus leaf, phase 1); check it isn't clipped |
| Photographer's grey card | 0.18 | if a photo has one |
| The plant's own green foliage | the trees' leaf `[0.05, 0.10, 0.03]` (`props/trees.ts`) | a consistency anchor: matches the scene, not a lab value |
| Green turf, near | ground cover `[0.08, 0.13, 0.05]` (`biome.ts`) | not dry or straw grass, not far turf |
| Sand, granite | the scene's `golden` `[0.46, 0.36, 0.23]`, `grey` `[0.26, 0.24, 0.22]` (`biome.ts`) | consistency anchors |
| **Don't:** turf or rock ≥ ~300 m off (hazed pale), dry moorland grass, sky, wet or specular surfaces | | phase 1's heath anchors failed on the first two |

## Dev server

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background, if not running
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill            # stop it when done
```

Needed by snapshot, diff, bench, mesh and restart (not params, profile, animals, summary); each
says `dev server not reachable at …` in one line if it isn't up (`requireServer`, `lib.mjs`). Start it
as a background task, not with `&` in a subshell: that one dies with the shell, mid-session. It
answers in 1–2 s: cap a wait loop at ~10 s and treat longer as a fault. The first render after a start can take
minutes (dep optimisation).

## Gotchas

- **A bad published picture is a SwiftShader bug until shown otherwise:** CI has no GPU and renders
  on x86 SwiftShader, which keeps NaN where Apple GPUs hide it (`min(NaN, x)`, w ≈ 0). A Mac render
  of the day says nothing; and CI renders the **pushed** commit, not your HEAD. Start with
  `node scripts/ciDay.mjs DATE` (tools/RENDER.md "Broken frames"). 2026-11-17 lost a Mac render
  and a wrong theory from a params diff before this.

- **Probing a render you saw in a diff:** `snapshot.mjs` defaults to 4K, `diff.mjs` to 1080p, so the
  same spec frames differently; pass `--w 1920 --h 1080`. `NAME.diff.jpg`'s top panels are cropped
  to the changed box: never read positions from it (it happened again in REFLECTION phase 5, a
  session after this line was written). `diff.mjs` now saves `NAME.crop.jpg` (the box at full
  size) every time, and `--zoom-at X,Y` takes full-frame pixels; or probe by world point
  (`{world}`/`{mirror}` from `params.mjs --project`). Check `covered by` there: a world point
  behind a palm frond reads the frond (it gave a "far island" its colour in REFLECTION phase 4).
  Three probe renders were lost to these before the tools existed.
- **`--off` patches are spec fields:** debug switches go under `params`:
  `--off '{"params":{"debug":{"passes":{"X":false}}}}'` (the spec check now says so).

- The browser's DevTools console shows more than Playwright's `console` event: the render
  worker's WebGL warnings and every GPU-process message (`[.WebGL-0x…] GL_INVALID_…`) come only
  through a CDP session with `Log.enable` (`watchPage` does this). A user-visible console message
  that a script can't reproduce: first check the script can see that kind of message (a known
  example of it), before changing render conditions.
- Timing races (GPU work still queued at cleanup) may need a heavy last frame to show: the
  glGetProgramiv warnings (0.81) showed at 4K with the page's default frames, not at 1080p ×
  16 frames. Try `--w 3840 --h 2160` without `--frames` before calling one gone.

- Changing `vite.config.ts` restarts the dev server and can leave pages at `504 Outdated Optimize
  Dep` (the render hangs until `--budget`; in a browser the page stays blank, which looks like a
  scene bug: check the console first). Seen again 2026-10-31 on a 5174 server (cause not traced). Fix: `npx vite --port 5176 --force` and pass
  `--url http://localhost:5176/` (snapshot, bench).
- `reading 'hasFeature'` = two three.js copies. After the first `mesh.mjs` on a fresh server
  (deps re-optimised): restart with `npx vite --force`. When two vite servers share
  `node_modules/.vite` (a worktree symlinking `node_modules`): stop 5174,
  `rm -rf node_modules/.vite`, start again. `refServer.mjs` gives its worktree its own `cacheDir`.
- macOS has no `timeout`; don't wrap commands in one (snapshot has `--budget`).
- **A background render's output goes to its file raw:** `run_in_background` with `… 2>&1 | grep
  … | tail` writes nothing until the run ends (`tail` holds it all), so a monitor watching the file
  sees an empty file and a dead-looking run (0.206 lost a monitor and a wake-up). Run the command
  bare, then `grep` the finished output file.
- **WebFetch 403s:** core.ac.uk (`/works/…`) and the unibo journal index (`acnpsearch…unibo.it`)
  refuse it. Take the abstract from the search result, or look for the paper on the publisher's,
  ResearchGate's or a university repository's page; say "abstract only" where you cite it.
- **`snapshot.mjs` takes dates or `--scene`/`--where`, not both**: dates beside `--scene` fail
  ("dates are ignored"). Put real dates in the spec file (`{"name":"d","date":"…"}`).
- **The probe's raw value is clamped:** the grade clamps exposed values at 40, so `raw` tops out
  at 40 ÷ exposure (~8 on a storm day). A probe reading the same number everywhere has hit it:
  pin a lower `debug.exposure`.
- **Identical numbers after a shader edit aren't a cache:** there is no render cache under
  automation (`renderCache.ts`). Check whether the term you moved even runs (its `#ifdef`, e.g.
  takram's `POWDER`) before suspecting the server; `curl localhost:5174/src/X.ts | grep` shows what
  the page loads.
- **Tests that hold values measured on a render** break when a day's frame moves (a tide, camera
  or composition change): `test/waterFilms.test.ts` (nearest pool: GPU 15.2 m on the Mont-Saint-Michel
  spec, 12.3 m on 2024-06-13; re-measure with `snapshot.mjs --water DATE` and its `nearest pool`
  line) and `test/stars.test.ts` (sky brightness by `debug.skyZenith`, forced time: unaffected by the
  coast). Re-measure, don't widen the bounds; say so in the test's comment.
- **Import cycles:** `params.ts` already loads `terrain.ts` (through the surf props); a module that
  `params.ts` loads must not import a value from `params.ts`. Constants that both need live in their
  own module (`earth.ts`). Check before adding an import: `scripts/importReach.py`.
- **Killing the dev server** (`lsof … | xargs kill`) also stops a `run_in_background` vite task; the
  next render says "dev server not reachable": start it again before the next render.
- **Sampling a reference photo's colours** without PIL: `sips -s format bmp in.jpg --out x.bmp`, then
  read the BMP in node (header: offset at 10, width 18, height 22, bpp 28; rows bottom-up, BGR).
- Each `params.mjs` call costs a few seconds (it builds the modules): a shell loop over seeds or
  places timed out. Ask once over a date range with `--list --where 'p => …'` or `--stats`.
- **PDFs:** `pdftotext -layout FILE out.txt` (poppler, `brew install poppler`, installed 2026-11-06), then grep. WebFetch can't read a PDF, but it saves the bytes and says where: run `pdftotext` on that. Numbers in figures aren't in the text: use the paper's prose and tables, and say so.
- **Reference photos:** `asset.mjs search QUERY` (table above). Plain web search returns captions,
  not pictures. Python's `urllib` fails here on certificates (`CERTIFICATE_VERIFY_FAILED`): use the
  script or curl (Commons' API: `curl -G https://commons.wikimedia.org/w/api.php -d action=query -d
  format=json -d generator=search -d gsrnamespace=6 --data-urlencode gsrsearch=… -d prop=imageinfo
  -d iiprop=url\|mime -d iiurlwidth=900`). Save them in their own scratchpad folder and `Read` the
  JPEG; record each file's page in the plan. Commons rate-limits (429) after ~5 quick requests; the
  script retries.
- **zsh, not bash:** an unquoted `$VAR` isn't split into words, so `F="a b"; sed … $F` and
  `M="node x.mjs"; $M args` pass one argument and often fail quietly (five colour measurements
  silently didn't run, 0.151). Use a shell function (`m() { node x.mjs "$@"; }`), a `for` over
  literal words, or `${=VAR}`. An unmatched glob is an error (`--include=*`: quote it), and a bare
  `======` is too (`echo '---'`). `LINES` and `COLUMNS` are the terminal's: assigning JSON to `LINES`
  fails ("bad output format specification"); keep line specs in a file (`--line "$(cat
  $SP/lines.json)"`).
- **Patching with a heredoc:** in `<<'EOF'` nothing is unescaped, so `\`` stays a backslash and backtick in the file. In `<<EOF` it's the reverse: `$` and backticks run. Use `<<'EOF'` and write backticks plain.
- Vitest hides `console.log` from passing tests: `--silent=false`, or `process.stderr.write(…)` in
  a throwaway probe test (deleted afterwards). Better: probe with `params.mjs` (`p.ctx`, `src.X`).
- `sips --cropOffset` silently returns the whole image here; system Python has no PIL (`.venv-skins/bin/python` has, after `npm run skins`): crop with
  `contact-sheet.mjs --region`.
- **BSD tools, not GNU:** `grep -P` doesn't exist (use `grep -E`, or `awk -F'\t' '$1==name'` for a
  tab-separated field), `sed -i` needs `''`, and `sed`'s `0,/re/` address is GNU only (it applies
  nowhere, silently). Edit with Python asserting one match, or the Edit tool.
- **JS `toFixed` keeps the sign of zero:** `(-2e-16).toFixed(6)` is `"-0.000000"`, so keys built
  from it split equal points (a blob's seam). Use `Math.round(x * 1e6) || 0`.
- **Scripted edits:** Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table) and loose regexes hit params: prefer the Edit tool, or assert exactly one match. With
  asserts, a replacement that adds text a later pattern searches for makes that later assert fail
  (and nothing is written): order the edits.
