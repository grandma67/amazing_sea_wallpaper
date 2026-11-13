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
| Does a new off switch give back the old image exactly | `diff.mjs --ref HEAD --off PATCH --off-here` (expect "identical"); when HEAD already has the feature (a later phase), `--off-both` | [tools/RENDER.md](tools/RENDER.md) |
| Render time vs a commit (10% rule); same image | `bench.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A new mesh alone | `mesh.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A mesh before and after a change, one command | `mesh.mjs --ref HEAD` (`NAME.compare.jpg`); a head close-up: `--focus head` | [tools/RENDER.md](tools/RENDER.md) |
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
| Does the CPU terrain (camera height, props, `p.view`, `p.pools`) match the drawn terrain | `parity.mjs` (after any height or film term edit) | [tools/RENDER.md](tools/RENDER.md) |
| A terrain shader term's value (h, shore coords, masks, rock profile) at a pixel or world point | `params.debug.terrainProbe` (not a temporary shader edit) | [tools/DEBUG.md](tools/DEBUG.md) |
| Bands or grain along a line of pixels, and from what | `params.debug.probeLine` (render) vs `params.mjs --line` (CPU mirrors) | [tools/DEBUG.md](tools/DEBUG.md), [tools/PARAMS.md](tools/PARAMS.md) |
| Where a sky direction lands in the frame (is it in frame, which pixel) | `src.skyFrame` (`project`, `pixelOf`, `inSky`) in `params.mjs` or code | [tools/PARAMS.md](tools/PARAMS.md) |
| Does changing days in the page leak (GPU, heap, workers) | `restart.mjs` (`npm run check:restart`) | [LEAKS.md](LEAKS.md) |
| A real colour or size: albedo of a petal, bark, moss; a scan's size (CC0/CC-BY, no server) | `asset.mjs grid` (pick the region) → `asset.mjs measure SOURCE --region --hue --anchor`; `asset.mjs replay` re-measures everything recorded |
| Is a prop **visible** on a day (not behind props or terrain), which spec dates show it best; how hazed far land is | `params.mjs --find KIND` | tools/PARAMS.md "Which days show it" |
| How much turf, bare land, sea a camera sees, by distance | `src.groundSeen.groundSeen(p.ctx)` in a `params.mjs` expression | tools/PARAMS.md |
| Photos of a species with a licence we can ship (PD, CC0, CC BY) | `asset.mjs search QUERY…` (numbered contact sheet; waits out Commons' rate limit) | `asset.mjs` header |
| An animal skin from a photo (atlas layer) | `asset.mjs search` → `asset.mjs fetch commons:File:… --id ID` → `asset.mjs grid ID --px` (pixel labels) → recipe in `src/props/skins.json` → `asset.mjs patch ID` (outline on the photo beside the baked tile) → `npm run skins` (sets up its Python; warns when a layer clips; `contrast: "auto"`) → `mesh.mjs --material 'props/skins#skinPreviewMaterial()'` | `scripts/skinBake.py` header | [arch/PROPS.md](arch/PROPS.md) "Animal skins" |
| A scanned model as a prop mesh (vertex colours, levels of detail) | `asset.mjs bake ID` → `src/props/scans/ID.ts`; `mesh.mjs 'props/scans/index#scanVariant(…)'` | "Real colours" below; NATURE_PLAN.md §11 | header; "Real colours" below; [plans/NATURE_PLAN.md](plans/NATURE_PLAN.md) §1 |

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

- **Brightness:** a photo's is the camera's (auto-exposure put a moor at ~0.23 linear; heath is
  ~0.05–0.1). Take hue from photos; brightness from a calibrated scan (Poly Haven, ambientCG), or
  `--anchor` a known material **next to the target, in the same light**. Petals with no anchor:
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
- zsh: `LINES` and `COLUMNS` are the terminal's variables; assigning JSON to `LINES` fails with
  "bad output format specification". Keep line specs in a file (`--line "$(cat $SP/lines.json)"`).
- Each `params.mjs` call costs a few seconds (it builds the modules): a shell loop over seeds or
  places timed out. Ask once over a date range with `--list --where 'p => …'` or `--stats`.
- **PDFs:** `pdftotext -layout FILE out.txt` (poppler, `brew install poppler`, installed 2026-11-06), then grep. WebFetch can't read a PDF, but it saves the bytes and says where: run `pdftotext` on that. Numbers in figures aren't in the text: use the paper's prose and tables, and say so.
- **Reference photos:** `asset.mjs search QUERY` (licence-filtered, a numbered contact sheet). Python's `urllib` fails here on certificates (`CERTIFICATE_VERIFY_FAILED`): use the script or curl. Wikimedia Commons' API finds them with a thumbnail URL (`curl -G https://commons.wikimedia.org/w/api.php -d action=query -d format=json -d generator=search -d gsrnamespace=6 --data-urlencode gsrsearch=… -d prop=imageinfo -d iiprop=url\|mime -d iiurlwidth=900`). Save them in their own scratchpad folder and `Read` the JPEG. Plain web search returns captions, not pictures. Record each file's page in the plan. To measure one: `asset.mjs measure 'commons:File:NAME.jpg'` (licence and author recorded; it retries Commons' 429s, which come after ~5 quick requests).
- **zsh, not bash:** an unquoted `$VAR` isn't split into words, so `F="a b"; sed … $F` and `D="d1 d2"; cmd $D` pass one argument, and often fail quietly. Use a `for` over literal words, or `${=VAR}`. An unmatched glob is an error (`--include=*`: quote it), and a bare `======` is too (`echo '---'`).
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
- **Python edit scripts that assert one match:** a replacement that adds text a later pattern
  searches for makes that later assert fail (and nothing is written): order the edits, or use
  the Edit tool.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
