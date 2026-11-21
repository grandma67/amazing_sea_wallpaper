# Lessons: Process and debugging

How to work and how to debug: read this one on every task. Other topics: [LESSONS.md](../LESSONS.md).

## Process

- **Read TOOLS.md "Gotchas" and SCENE_SPECS.md "Writing specs" before the first fetch or spec, not
  after (salt, 0.199):** both already had the answer (`pdftotext` on the bytes WebFetch saves; a
  front-lit base) and skipping them cost failed fetches and a backlit render round. A count of real
  days that builds props: `--every K` first, the full run once at the end.

- **Write lessons as rules, and share the machinery (Morning Glory, 0.180, 2 look rounds + 2
  bench runs):** it repeated two of the shelf's mistakes days after they were written down (a thin
  edge, a smooth slab; no early exit, +45%): the lessons were about the shelf's numbers, not the
  kind of work, and the roll was built by copying the shelf's patch. Now a shared base
  (`cloudShapes.ts`), a checklist (arch/SKY.md "A new cloud shape") and switches for every shape.
  Put repeated machinery in one module before the second copy.
- **Ask what a feature *is* before tuning it (shelf cloud, 0.172–0.177, ~12 render batches):**
  three rounds improved a mesh before asking why a cloud was a mesh at all. Other slips there: a
  plan rule written before its distribution was counted (the lip from the nearest rain clamped 86%
  of shelves: one `params.mjs --stats` shows it); an artifact chased by guessing twice before
  switching details off one by one (it was the scud): **switch terms off one at a time before the
  second guess**; a commit made with a failing test (chain `npm test && git commit`); per-sample
  noise added without early exits (renders went to 11 s).
- **Process, not knowledge, costs rounds (sea ice, 0.114–0.116, ~14 render batches against ~9):**
  required docs grepped rather than read, a nearby mesh reused against the photos just viewed, real
  days rendered only after several rounds on specs, a guess at a cause instead of finding every term
  behind it, the scope raised after building rather than when the day count showed it. The tools
  that were missing now exist (`snapshot --where --sample`, `--seeds`, `mesh --material --scale
  --sun`, `pdftotext`) and the checklist is in CLAUDE.md.
- **Check the known issues first:** phase 9 spent two renders proving near-black land on
  broken-cloud days was older than the phase, while an entry for the same symptom existed.
- **A hung run is a fault, not a slow one (0.142 review):** a 1080p render is 2–3 s, yet a ref
  render waited 10 minutes behind a foreground timeout, then took turns to diagnose because the
  output had been grepped down to "rror" lines and the server's output went to `ignore`. Keep a
  failing run's whole output; give every long-lived child a log; check the thing you wait on is
  still alive.
- **A CI-only render failure is traced on the runner, not guessed at (0.195):** a fix for a guessed
  cause (the GPU watchdog) cost a run; identical numbers on two runs meant deterministic, which a
  timing cause can't be. Get the failing frame and its numbers off the runner (debug values,
  `failed-render`, `nanTrace`), then reproduce the mechanism locally (a NaN patch blacked the Mac's
  frame too). Read the published files, not only the run log: the half-black phone frame passed the
  blank test. Copy outputs into the published folder only after every render passed. Before
  changing `pages.yml`, read `crons.yml`: it greps `pages.yml`'s text; its live-site check is a
  separate job that warns on a 404.
- **A threshold on our own output is measured on its extremes first (0.194):** the scripts' "real
  picture > 50 KB" was an estimate from one 290 KB image; real polar and foggy nights are 39–46 KB
  at 1080p. File size can't tell blank from dark (a black 1080p JPEG is 13 KB from the browser, 34
  KB from `sips`): test pixels (luma range, `snapshot.mjs --fail-blank`). Render the
  darkest/brightest real days (`--where … --sample`) before fixing a number.
- **Test a system change on a real machine with a way back first (CRON phase 3):** the install
  path already held the user's own experiments, so the live test listed the folder before,
  uninstalled without `--yes`, and removed only the files it had added.
- **Ask the schema, don't guess field names (NATURE_PLAN phase 2):** `coast.rockShore` (it's
  `coast.rock`) and `timeOfDay === "morning"` (no such value) each kept 0 days without an error and
  cost a full run. `params.mjs --schema PREFIX`.
- **A count you'll need twice is a tool:** the same "trees placed, in flower, nearest" expression
  was written four times in NATURE phases 3–4; it's `params.mjs --count` now. When a slip repeats,
  change the tool so it can't happen (`diff.mjs` saves the full-size crop and takes `--zoom-at` in
  frame pixels after positions were read off cropped panels twice).
- **Read a script's usage before building around it (0.169 review):** `diff.mjs --off-both`
  existed and was in TOOLS.md, yet a session hand-built spec files to switch a feature off on both
  sides.
- **Plan numbers are estimates until measured** against `p.view` and a placement test: the stones
  plan assumed ground in view from ~5 m, but the nearest ground in frame is ~5 m (along-beach,
  framed), 20–40 m (many shorelines) or beyond (overlooks); one forced date showed 21 m and was
  taken for the rule, and `meshStones` placed nothing with the plan's 15 m cap. Size near-camera
  things by pixels (`ctx.pixelAngle`).
- **Check a plan's claims with the code before using them:** sample dates (SHADOWS.md's
  `2014-12-29` "moonlit, overcast, Greenland" isn't a test day; 2024-12-29 is a clear night in
  Scotland: re-derive the set with `params.mjs --list --where` and measure it; "open nights are
  fine" turned out as dark by median as cloudy ones), seasons (sea ice "Jan–Apr north of 60°" was an
  estimate; FMI has November to late May), geometry (SKY.md: the aurora handoff) and look targets
  against the plan's own physics ("a vertical smear at 5 m/s" contradicted ±14° of spread over a 2°
  island).
- **Check a known issue's own repro before closing it:** a date alone can land on another time of
  day (Mont-Saint-Michel's date rendered at night and proved nothing): force what it names.
- **A task's "Known:" is numbers plus a reading of them: re-measure the reading (D27/D31/D13,
  0.221–0.223, 2026-11-20):** D31's "measured" wall (`cloudFace`: 6.3 km, 340–560 m) was the shelf
  cloud, not the storm cell's side it named; the code read on that guess was wasted, and one
  `diff --off '{"shelfCloud":false}'` showed it. Step 0 confirms *what* is there, not only that it is:
  list the day's parts (`params.mjs --each 'p => p.storm'`), then switch each off. In the same session:
  - the first lantern round rendered lighthouses 550–870 m off (a few px; "⚠ invisible"):
    `params.mjs --find KIND` (nearest px, ranked days) before the first render of a prop's look;
  - a new term passed its own file's tests, then the spec check rejected it in a render
    (a hand-copied list in `sceneSpec.ts`; now shared, `shapeTerms.ts`): `npm test` in full, not
    one file, before the first render after adding a switch or term (`sceneSpec.test.ts` guards it);
  - full frames shown as before/after left the user asking what changed: show side-by-side crops of
    the feature (`diff.mjs --a --b --crop X,Y,W,H`), say which side is which and what to look at.
- **`diff.mjs --keep-camera` is for terrain changes only (D37, 2026-11-20):** on other days it
  stands the "before" camera at the "after" one's ground height and frames two unrelated views
  (53–67% "changed" on two beach days whose real change was ≤ 0.11%). A huge diff on a change
  that can't move the camera: re-run without it before reading the images. `diff.mjs` now warns
  when the two sides' cameras differ (position, heading or lens) and says which way to re-run.
- **Remove the feature before naming a speck (D37, 2026-11-20):** white specks on a sea stack were
  shown to the user as "spray dots above the horizon"; with the swell at 0.2 m (no spray) they were
  still there: the stack's own surface. One `--off` render first.
- **An unbound sampler can change a switched-off image (0.229):** a `sampler2D` uniform left null
  shifted the spray material's other textures (its cloud shade); `--off-both` caught it. Compile an
  optional texture read in with a `#define`, set only when the feature is on.
- **Show each before/after when it's done, not at the end (2026-11-20):** three fixes were
  finished and committed before the user saw one; they had to ask twice, and the left-over teeth
  and dots they'd have spotted at once came back late. Copying and renaming crops by hand made
  showing costly; `show.mjs` makes it one command.
- **The rule was written and still skipped (D37, D9, 2026-11-20):** "remove the feature before
  naming a speck" was already here; under time pressure the task's own guess was taken instead
  (D9's "grid aliasing" got two shading rounds and a regression before the real cause, the
  boulder's vertical rim). It is now a CLAUDE.md step: switch off what the task blames, say what
  the thing is, *then* fix.
- **Ask for the right technique before working around a symptom (D9, D37, 2026-11-20):** a shading
  trick (D9), a veil below the horizon only, then a depth-aware veil (D37): each a render round.
  Asking up front how renderers solve the look (soft particles; a pass after the clouds) would have
  skipped two.
- **Ask before extending scope (D14, D37, D9, 2026-11-20):** D14 found a second bug (the eclipsed
  moon too bright), D37 became three versions plus a new bug (the mirror), D9 a geometry change.
  Each was worth doing, but chained without asking. Stop and ask at each extension.
- **No tool for "where does this effect show?" (D37):** scene specs were hand-built three times (a
  close lighthouse, a burst above the horizon, cloud-shaded crests). `params.mjs --find KIND --rank
  above|height|px` now ranks days by the effect's on-screen box (sprites at their drawn size).
- **Cheap checks, nine at once (A4–D41, 2026-11-21, ~40 renders):** what cost time beyond the
  renders: a spec a task named (`stacks-shoreline`) was never saved, so it was rebuilt from notes:
  **a spec a task or known issue names goes into `scenes/` the session it's made**. Two cloud
  settings tried blind before reading the difference between takram's presets (it named light
  shafts at once): **diff the two configurations' settings before trying variants**. D10's probes
  guessed pixels and landed on wet sand: probe by world point or check the water view first. Kind
  names guessed (`iceberg`) gave a silent "nothing placed" (now an error), a `--find` over all days
  ran 10 minutes (now warned), and long waits blocked the session: start long runs in the
  background and work on something that doesn't touch `src/` meanwhile (the dev server serves
  edits live, so a `src/` edit mid-run changes the renders).
- **Long outputs: summary last, saved to a file** (`bench.mjs` table, `params.mjs` "… N more not
  shown"): a `| tail` that cuts the table off costs a full re-run.

## Debugging approach

- Probe a creator, a placement rule or a height helper with `params.mjs` (`p.ctx`, `src.X`,
  `props.X`) on a spec or real days, not with throwaway test files; read the view cone on the
  `profile.mjs` map before blaming shading for a band or ridge across the frame.
- **Brightness questions are numbers** ("why can't I see X?", "why is the sky brown?"): probe the
  pixel and the sky beside it (`params.debug.probe`) before rendering again. The NIGHT_SKY work
  rendered ×20 and ×30 boosts and sampled JPEGs by hand for answers one probe gives: a texture that
  never uploaded, a Venus physically lost in the twilight glow, a red line turning the sky brown.
  Sample real pixels before reasoning about a tint; turn sources off one at a time.
- **"Not showing" is usually placement, light or size:** check `--props`, backlight and pixel size
  before debugging shaders. Small things at real scale vanish (10 cm crab: ~70 px at 5 m at 4K, a
  speck at 20 m). Placed but invisible: print the physics with a temporary `console.warn('DBG …')`
  at 640×360, 1 frame, before tuning looks (ship spray: water rose only ±0.1 m on the hull, so no
  splash could trigger).
- **Find a cause by switching passes or terms off one at a time** (the sunset tree glow had four
  causes): `params.debug.passes` with `diff.mjs --off`, no code edits. Before an
  edit-render-revert loop, look for a switch (`params.debug`, a spec field, a `params` patch).
  Never restore a file with `git checkout` mid-work: it drops every uncommitted change in it.
  (Broken again on 2026-11-19: temporary experiment lines go in with Edit and come out with Edit.)
- **A bad picture only CI made: reproduce CI, then read the render's own numbers** (2026-11-17,
  white; tools/RENDER.md "Broken frames"). The first hour went on a Mac render (fine: Apple GPUs
  hide NaN), a theory from a params diff (camera in the water; the render's JSON said 56 m up),
  full-size SwiftShader renders (320×180 reproduces it in 90 s, but only at 24 frames, not 1), and
  shader patches on hunches. Start with `ciDay.mjs DATE`; when every lit object makes NaN at once,
  look at what they share (sky cube, shadow maps: `nanTrace` reads both); and read an
  intermediate buffer before patching the shader that writes it: patching `frontDepth` and the
  march's output cost two rounds the shadow-map reading would have skipped.
- Shader debugging: force a visible output (`coverage = 1.0` over a region), move it step by step;
  for terrain and sea first try the false-colour views (`terrainView`, `oceanView`).
- Suspect float precision when a pattern depends on one direction only; isolate by changing one
  offset at a time (`params` patches of `weather.shapeOffset`, `weatherOffset`, `latitudeDeg`;
  `"clouds": [one genus]`).
- After fixing a shared layer (cloud type, exposure, fog), re-check conclusions made while it was
  broken: scud made every storm flat grey, and "calvus = capillatus from below" was wrongly blamed
  on physics.
- Physically faint is fine, but say so rather than boost (noctilucents need the sun 6–16° down; our
  blue hour stops at −7°; blue-hour contrails are dark lines in the earth's shadow).
- Speed work: compare with a pixel diff, not by eye; two runs of the same code on the same GPU are
  pixel-identical. Benchmark under `caffeinate -i`; GPU noise floor ≤ 5/255 on a few pixels.
- three sorts opaque meshes by **material id** (creation order) before depth: creating meshes in a
  different order changes equal-depth pixels.
- A debug switch that turns a feature off must give back the exact old path, not a simpler one:
  check it against `snapshot.mjs --ref HEAD` (`diff.mjs --off-here`).
- Before blaming a too-bright result on convergence, measure it: 8 and 32 priming updates of the
  cloud map gave the same sunset, so the change was the finer map, not an unsettled one.
- **A diff's straight-edged patch on the ground** can be grass clumps in front of a slightly changed
  ground, not a seam: look at both (`diff.mjs --a --b --crop … --zoom 4`) and project the suspect's
  rectangle (`p.ctx`, `.project(camera)`) before changing a shader.
