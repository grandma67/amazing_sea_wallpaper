# Lessons: Tools, params and tests

Scripts, randomness, params, tests and the page. Other topics: [LESSONS.md](../LESSONS.md).

## Scripts and tools

- **`params.mjs --ref` compares params, not prop code (0.210):** an expression calling `props.X`
  (or `src.X`) runs this tree's module on the ref's params, so "92 built at the ref, 92 now" hid
  15 days the ref's `createLighthouse` failed on. To test old prop code, run the new test in a
  throwaway `git worktree add DIR HEAD` (link `node_modules`), then `git worktree remove`.

- **Before the first render of a session, check the dev server** (`lsof -tiTCP:5174
  -sTCP:LISTEN`): `diff.mjs --ref` renders REF first and only then fails on this tree's missing
  server, a lost round (trunk moss, 0.148).
- **Don't edit `src/` while a render runs against the dev server:** Vite reloads the page mid-run,
  so the render fails or renders half-old code (2026-11-19: a `diff.mjs` run failed with
  "clampShadowToHalf is not defined" while code moved between files, and a 20-minute SwiftShader
  batch had to be restarted). Edit docs and `scripts/` meanwhile (node loads a script once), or
  render the state you want with `--ref` (its own worktree and server).
- **Read a buffer's values, not only its NaN count:** "only channel r is NaN" took eight renders
  to become "r holds metres in a half float". `nanTrace` reports each reading's largest finite
  magnitude and the texels at the half-float ceiling (`sat`) since 0.205; dump an intermediate
  into the shadow map with `debug.shadowDump` (tools/DEBUG.md), which reads it raw.
- **A mesh's "nearest" and box are its bounding box** (`snapshot --props`, `--project`'s box): the
  ice foot read 2946 m away while it ran past the camera at 6 m, and a range "1/1 in frame" was out of
  view (lomas, 0.154). Use `--project`'s rows (its points) and `--find` (visible vertices, haze
  contrast).
- **Counting what a frame shows needs `--rendered`** (or `--project`, `--count`, `--find`, which
  imply it): without it you get the first framing attempt, and the page re-rolls 30% of land days.
  A straight cut in the ice foot was blamed on culling and survived a fix, because the other camera
  was used (snow, 0.111); leaf litter's real days went from 13 to 14 leaf days and 78 to 69 colour
  days. **But test dates come from the tests' camera:** `test/days.ts` builds attempt 0, so dates
  picked with `--rendered` had no fireflies under the tests' camera: pick a test's dates without
  `--rendered` (0.153).
- A leak check proves nothing about days it doesn't visit: its default dates are June. Pass `--date`
  to cover days that have the feature (`params.mjs --list --where`).
- **A launchd job that boots itself out is stopped there** (wallpaper script 1.0.2): `bootout`
  means "stop the service", so the re-run died silently at its first line for days. A silent
  scheduled job: compare the folder's and files' mtimes with the log before guessing, and test
  launchd behaviour with a throwaway LaunchAgent (scripts under `~/Documents` can't run from one:
  "Operation not permitted"; copy them to the scratchpad). A bash TERM trap with a foreground
  child that waits on the job itself deadlocks into SIGKILL: run such children `& wait $!`
  (plans/CRON.md §2.4).
- Cleanup in `finally` or a signal handler doesn't survive every stop: Ctrl+C skips `finally` unless
  a handler exits, `kill -9` runs nothing, and a handler waits for a synchronous loop. For anything
  that must not be left behind, use a detached watcher that polls the owner's pid
  (`scripts/worktreeReaper.mjs`), and test it by stopping the script.
- `child.kill()` on `npx vite` signals npx only; start the server `detached` and kill the group
  (`process.kill(-pid)`).
- **Shell scripts** (CRON): BSD `date -j -f FORMAT` fills fields the format lacks from now (parsing
  `'%Y-%m-%d %H:%M'` kept the current seconds, so 08:00 UTC came out 54 s late): always parse
  seconds. `{ a; [ -n "$x" ] && b; } > tmp && mv tmp f` doesn't move when `$x` is empty (the
  group's status is the last test's): use `if` inside a redirected group. Windows PowerShell 5.1
  reads a BOM-less UTF-8 `.ps1` as ANSI: keep scripts ASCII (CI checks), and don't name a function
  after a built-in (`Write-Log` is one on 6.1+).

## Randomness, params and tests

- **Assert only the rows a test is about (0.169 review):** tests that pinned the full list of rows
  in flower at a place broke three times as rows were added. Filter to the rows under test
  (`only(day, BUSH_ROWS)` in `test/bloom.test.ts`) or check membership.
- **Test targets from a measured probe, not a guess:** a "> 50% of trees grey" target failed at
  42%. Float32 attributes don't equal decimal literals (0.3 → 0.30000001): round before comparing.
- Tests that need a rare event on **real days** ("at least one waterspout in three years") break
  when the main stream changes (places, 1a, broke four). Check rules on real days, but get the event
  from a spec over every date (`scenes({ place: 'caribbean', … }, DAYS.length)`), and compare rates
  on forced, equal conditions.
- Removing a draw from the middle of an object literal (the old `sandbarDistance`) shifts every
  later field and the eye height: keep the draw (`skipDraw`) and check `params.mjs --ref HEAD`.
- Rewriting `x *= a * b * c` as `x * a * b * c` changes the last bit and `params.mjs --ref` shows
  dozens of changed days. Keep the grouping when wrapping a value in `or()`.
- Keep other days identical when a choice depends on a new input: gate before the draw (`continue`
  before `rng.chance`) or change only the chance, not the number of draws. A choice that zeroes a
  count in a season still makes the draw (shore crabs in winter): a skipped draw moves every draw
  after it (shells).
- Tests that compare whole `coast` (or `params`) objects break whenever a field is added that
  follows the forced value; compare the fields the test is about.
- `params.mjs --ref` counts open-sea days for beach-shape changes (their coast carries a shape the
  terrain never draws): report beach days separately.
- `params.ocean.windSpeed` is the wind the waves feel (pack ice ×0.4, sea ice caps it); the air's is
  `params.ocean.airWindSpeed` (0.117): clouds, plants and their tests read that one.
- **Samples of the first N days hide cases.** Spread over the three years, they found specs missing
  `eclipse: null`, and 13 of 2096 forced days where a lens chosen for a rainbow or aurora stays after
  a storm or fog takes it away.
- **A loop over a filter passes on nothing:** the nacreous rule ran on no day for as long as it
  existed. `expectEvery` fails on an empty list.
- **Timing in a test is a flake** (`auroraLux < 50 ms` failed whenever the machine was busy): time
  with `bench.mjs`.
- **Coverage shows what ran, not what's checked.** Inject bugs instead: 18 put into `src/` were
  caught 8 times by the old suite and 16 by the new, and all 581 old tests passed with a wrong eclipse
  memo that only `params.mjs --ref` and a century-long comparison caught. Before cutting tests,
  compare both ways.
- **A memo of a search has to answer as the search does:** `SearchGlobalSolarEclipse` goes by the
  moon's phase; with a new moon just before midnight and the peak after, a search from that midnight
  misses the eclipse, so reuse stopped a day before the peak.
- **A speed change is proved by fingerprints, kept by tests (0.120):** hashes of every prop mesh on
  60 days, of `measureFrame` over three years and of 443k terrain heights against `HEAD` showed the
  shortcuts changed no bit; but 9 of 10 bugs injected into them then passed the whole suite (the
  noise had no tests: `test/noise.test.ts` now checks cells meet at every edge; rocks had no mesh
  row). After any rewrite of low-level code, inject a few bugs and add what catches them.
- **Skip noise only where its weight is exactly 0, and keep the sum's order:** `sea + (land - sea) *
  0` is `sea` to the bit, `(land - sea) + sea` is not. Out at sea (`t === 0`) a beach height drops 16
  noise lookups (`beachHeight`).
- Module cycles: `tides.ts` importing `terrain.ts` (which imports `tides.ts`) left half the test
  files failing to load. Put shared helpers in a module with no imports (`reef.ts`). A cycle can
  hang on one constant: `terrain.ts` imported only `EARTH_RADIUS` from `params.ts`, which cost the
  surge ten test rounds of guessing the ground from the bare profile (0.200). Look for what a
  cycle is made of (`scripts/importReach.py`) before working around it.

## Page

- Freeing a still: everything but the context can go once the frame is in the canvas
  (`preserveDrawingBuffer` keeps it for Download). Dispose materials **before** `renderer.dispose()`,
  or their programs are never released. A module-level texture or quad keeps three's dispose
  listener and the old renderer alive: dispose it too. Heap differs ~40 MB between days, so a leak
  check compares a revisited day with its first visit ([LEAKS.md](LEAKS.md)).
- Wait for the last frame on the GPU (`gpuIdle`) before disposing: Chrome still queries each program
  after the frame, and one deleted before then logs `GL_INVALID_VALUE: glGetProgramiv: Program object
  expected` (~48, one per program). These are GPU-process messages: only a CDP session with
  `Log.enable` sees them (`watchPage`), and only with a heavy last frame (4K, default frames).
- Splash boat: CSS waves from quadratic Béziers are parabolas, so a boat rides one exactly with
  quad-ease heave keyframes and linear pitch at the wave's period (middle wave: 7 s per 2 periods →
  3.5 s).
