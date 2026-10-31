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
| Coast shape, depths, break line, view cone, flooding | `profile.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| Prop choices and placement in tests | `propsOf`, `view`, `expectDryCameras` (`test/days.ts`) | [tools/PARAMS.md](tools/PARAMS.md) |
| Animal shares table for ANIMALS.md | `animals.mjs` | [tools/PARAMS.md](tools/PARAMS.md) |
| See a render; where props landed; prop build time | `snapshot.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Did a feature show up; was it already broken | `diff.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Render time vs a commit (10% rule); same image | `bench.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| A new mesh alone | `mesh.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Many renders in one image; zoom into one | `contact-sheet.mjs` | [tools/RENDER.md](tools/RENDER.md) |
| Which pass, term or grid causes a look | `params.debug` switches and views | [tools/DEBUG.md](tools/DEBUG.md) |
| Does changing days in the page leak (GPU, heap, workers) | `restart.mjs` (`npm run check:restart`) | [LEAKS.md](LEAKS.md) |

## Shared conventions

- **Specs** (`--scene`, all scripts): a JSON file or inline JSON; one spec, a list, or
  `{ "base": {…}, "scenes": [{ "name": …, … }] }` (each scene merged deeply over the base:
  objects merge, the rest replaces). Shared code: `scripts/lib.mjs`.
- **Dates**: `YYYY-MM-DD` or `FROM..TO` (snapshot also `today`). The test days are 1095 days
  from 2024-01-01 (`test/days.ts` `DAYS`).
- **`--ref REF`** (params, snapshot, diff, bench) checks the commit out into a temporary worktree
  under `/private/tmp/claude-*` sharing `node_modules`, removed afterwards: compare without
  stashing. Ports: bench 5175, snapshot/diff 5177 (`refServer.mjs`); params needs no server.
  Spec fields the ref doesn't know are dropped and named.
- Long outputs put the summary last (bench's table, params' "… N more not shown").

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

- Changing `vite.config.ts` restarts the dev server and can leave pages at `504 Outdated Optimize
  Dep` (the render hangs until `--budget`; in a browser the page stays blank, which looks like a
  scene bug: check the console first). Seen again 2026-10-31 on a 5174 server (cause not traced). Fix: `npx vite --port 5176 --force` and pass
  `--url http://localhost:5176/` (snapshot, bench).
- `reading 'hasFeature'` = two three.js copies. After the first `mesh.mjs` on a fresh server
  (deps re-optimised): restart with `npx vite --force`. When two vite servers share
  `node_modules/.vite` (a worktree symlinking `node_modules`): stop 5174,
  `rm -rf node_modules/.vite`, start again. `refServer.mjs` gives its worktree its own `cacheDir`.
- macOS has no `timeout`; don't wrap commands in one (snapshot has `--budget`).
- Vitest hides `console.log` from passing tests: `--silent=false`, or `process.stderr.write(…)` in
  a throwaway probe test (deleted afterwards). Better: probe with `params.mjs` (`p.ctx`, `src.X`).
- `sips --cropOffset` silently returns the whole image here, and there's no PIL: crop with
  `contact-sheet.mjs --region`.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
