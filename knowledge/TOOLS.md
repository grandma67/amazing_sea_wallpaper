# Tools

Reason from numbers (no-render tools) before rendering. Each script's header lists every option
(`params.mjs --help` prints it). `SP` = scratchpad. Spec format and fields:
[SCENE_SPECS.md](SCENE_SPECS.md).

| Question | Tool | Guide |
|---|---|---|
| How often, which days, what a spec gives, real dates | `params.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| Which days did my change touch; did shares move | `params.mjs --ref HEAD` | [tools/PARAMS.md](tools/PARAMS.md) |
| Expected share for a test target (no sampling) | `params.mjs --expect` | [tools/PARAMS.md](tools/PARAMS.md) |
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
| Render time vs a commit (10% rule); same image | `bench.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A new mesh alone | `mesh.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Many renders in one image; zoom into one | `contact-sheet.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Which pass, term or grid causes a look | `params.debug` switches and views | [tools/DEBUG.md](tools/DEBUG.md) |
| How bright or what colour is X in the render (raw, cd/m², mag/″², final RGB) | `params.debug.probe` | [tools/DEBUG.md](tools/DEBUG.md) |
| Bands or grain along a line of pixels, and from what | `params.debug.probeLine` (render) vs `params.mjs --line` (CPU mirrors) | [tools/DEBUG.md](tools/DEBUG.md), [tools/PARAMS.md](tools/PARAMS.md) |
| Where a sky direction lands in the frame (is it in frame, which pixel) | `src.skyFrame` (`project`, `pixelOf`, `inSky`) in `params.mjs` or code | [tools/PARAMS.md](tools/PARAMS.md) |
| Does changing days in the page leak (GPU, heap, workers) | `restart.mjs` (`npm run check:restart`) | [LEAKS.md](LEAKS.md) |

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
- Long outputs put the summary last (bench's table, params' "… N more not shown").
- **Browser messages**: every script that opens a page uses `watchPage(page)` (`lib.mjs`): page
  errors, console errors and warnings, and GL messages grouped per render (`48× [.WebGL-0x…]
  GL_…`). snapshot (so diff and bench) turns GL messages into ⚠ warnings, mesh prints them,
  restart fails on them. A new script that opens a page uses it too.

## Dev server

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background, if not running
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill            # stop it when done
```

Needed by snapshot, diff, bench and mesh (not params, profile, animals). It answers in 1–2 s: cap
a wait loop at ~10 s and treat longer as a fault. The first render after a start can take
minutes (dep optimisation).

## Gotchas

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
- **Reference photos:** Wikimedia Commons' API finds them with a thumbnail URL (`curl -G https://commons.wikimedia.org/w/api.php -d action=query -d format=json -d generator=search -d gsrnamespace=6 --data-urlencode gsrsearch=… -d prop=imageinfo -d iiprop=url\|mime -d iiurlwidth=900`). Save them in their own scratchpad folder and `Read` the JPEG. Plain web search returns captions, not pictures. Record each file's page in the plan.
- **zsh, not bash:** an unquoted `$VAR` isn't split into words, so `F="a b"; sed … $F` and `D="d1 d2"; cmd $D` pass one argument, and often fail quietly. Use a `for` over literal words, or `${=VAR}`. An unmatched glob is an error (`--include=*`: quote it), and a bare `======` is too (`echo '---'`).
- **Patching with a heredoc:** in `<<'EOF'` nothing is unescaped, so `\`` stays a backslash and backtick in the file. In `<<EOF` it's the reverse: `$` and backticks run. Use `<<'EOF'` and write backticks plain.
- Vitest hides `console.log` from passing tests: `--silent=false`, or `process.stderr.write(…)` in
  a throwaway probe test (deleted afterwards). Better: probe with `params.mjs` (`p.ctx`, `src.X`).
- `sips --cropOffset` silently returns the whole image here, and there's no PIL: crop with
  `contact-sheet.mjs --region`.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
