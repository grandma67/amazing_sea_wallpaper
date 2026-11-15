# Lessons and gotchas

Things that bit us, by topic: read the sections for what you're touching. Workflow rules:
CLAUDE.md; tool usage and shell gotchas: TOOLS.md "Gotchas"; open bugs: KNOWN_ISSUES.md. Write a
new lesson as a rule for the next thing of its kind, not as the story of this one.

## Process

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
  estimate; FMI has November to late May), geometry (below: the aurora handoff) and look targets
  against the plan's own physics ("a vertical smear at 5 m/s" contradicted ±14° of spread over a 2°
  island).
- **Check a known issue's own repro before closing it:** a date alone can land on another time of
  day (Mont-Saint-Michel's date rendered at night and proved nothing): force what it names.
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

## Scripts and tools

- **Before the first render of a session, check the dev server** (`lsof -tiTCP:5174
  -sTCP:LISTEN`): `diff.mjs --ref` renders REF first and only then fails on this tree's missing
  server, a lost round (trunk moss, 0.148).
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
  files failing to load. Put shared helpers in a module with no imports (`reef.ts`).

## Colours from photos

- **A photo's brightness is the camera's, not the surface's** (NATURE phase 1): auto-exposure puts a
  moor at ~0.23 linear where heath albedo is ~0.05–0.1. Hue from photos; brightness from a calibrated
  scan or an anchor beside the target (TOOLS.md "Real colours"). A far anchor fails (turf 1 km off is
  hazed pale; moorland "grass" is often straw); white paper behind a specimen is the best found.
- **A colour anchor must be the anchor's material (0.169 review):** sea buckthorn's leaves are
  silver-grey, so anchoring its berries on "the plant's green leaf" halved them; use `--petal`
  there. Measured, three of six estimated colours were well off: haws twice too bright, broom
  orange where it's lemon, blackthorn's white too neutral.
- **"The brightest cluster" of a whole photo mixes in highlights** (wattle: blue 0.17 from sunlit
  leaves and sky glints; the flower balls alone 0.09): measure a region of the target only, and
  check two regions agree.
- **A photo's shadows are sky-coloured (skins, 0.157):** a per-channel ratio of a crocodile's
  shadowed scales came out blue. Take brightness only from a photo and leave hue to measured
  colours.
- **A far colour averaged from several is often the ground's own (bloom years, 0.155):** orange and
  white daisies plus their leaves made a salmon as pale as Namaqualand's soil; real fields are sheets
  of one colour. Choose a colour per patch, then soften (speckle, soft edges): solid sheets read as
  snow.
- **A "darker" band needs a luminance drop, not channel ratios (fairy rings, 0.149):** a ring
  `[0.04, 0.115, 0.02]` on cover `[0.08, 0.13, 0.05]` keeps 0.79 of the luminance and halves red and
  blue: after AgX and saturation it drew a bright-green thread. ~0.7 luminance reads darker. A band
  0.3 m wide is a pixel at 20 m from a tall eye: count where it lands (`params.mjs --each`) and zoom
  on the nearest (`diff.mjs --zoom-at`).
- **Check a reused colour against the measures (trunk lichen, 0.148):** the rocks' `LICHEN`
  (0.45–0.55) is ~2.5× the calibrated crust; on a near trunk it read as whitewash. Keep the biome's
  hue at the measured brightness.
- **A mean-preserving speck:** to show detail up close that averages to the far colour, vary the
  share by a noise symmetric about 0.5 (`s + close · 2 min(s, 1 − s) · (smoothstep(0.3, 0.7, n) −
  0.5)`): no clamp, so the mean stays `s` at every distance (heath flowers, `terrain.ts`).
- Accent colours sprinkled per instance (every third tuft purple) look fake; real ones grow in
  patches. Drive props' accents from the same noise the terrain paints them with.

## Seasons and plants

- A month table needs the hemisphere, not the ocean: `ocean === 'southern'` only flipped the
  Southern Ocean, so Chile, SW Australia and the Cape bloomed in July. Read months through
  `seasons.ts` (`monthInSeason`); keep calendar months only for data already local (turtle nesting
  per place). Tests that pin "a northern beach" pin a northern `place`. A plan's months for one row
  over both hemispheres are a bug (gorse "Apr–May" listed New Zealand too).
- The `southern` hemisphere shift is half a year: 2 July south is day 365, 3 July day 1
  (`seasonDay`).
- The real sun at 76–80° (Svalbard) never gets above −6° in December: a "blue-hour glow at noon"
  exists only nearer the Arctic Circle (Tromsø's 69–71°). Check `sunLimits` before writing a spec
  for a polar look. Below 63° the time of day is a free category.
- **Seasonal looks on a procedural mesh are decided after the builder's draws**, by `hash()` of the
  piece's position (skip a leaf, recolour it), never by skipping or adding draws, so the same tree
  just loses its leaves (`test/phenology.test.ts` checks the next draw is the same).
- **A share of a few instanced variants can't be a hash** (blossom, 0.140): bushes are 5 meshes, so a
  hashed 0.4 crown share flowers none of them on 0.6⁵ ≈ 8% of days, and spreading it over variants
  can't hold a share under 1/variants (flamboyant 0.03). Decide per instance by world position and
  build the look as a twin of the variant, replaying its recorded draws (`Random.from`, 0.141).
- **A mixed kind needs a stable identity before its seasons (0.169):** one `bush` stands for many
  shrubs; flowers and fruit picked by separate hashes would put April's blackthorn blossom and
  October's sloes on different bushes. Give each crown a species once (one position hash), hang
  every seasonal look on it, and append new shares after the old rows' so their crowns don't move.
- **A seasonal leaf change must scale with its strength (0.169):** blackthorn's bare-twig flowering
  thinned the leaves whenever it flowered at all, so late May's 10% tail drew a near-bare bush.
- **Measure "near the shore" from where the thing can be:** pōhutukawa's 60 m from s = 0 caught
  almost no tree, because broadleaves start 35–110 m inland. Count the instances that pass a
  placement rule (`props.vegetation.createVegetation(p.ctx)`) before rendering it.
- **A rock-shore camera looks away from the land (heath, 0.144):** every rock composition faces the
  sea, so ground cover behind the shore is behind the camera or a thin strip: forced Scottish and
  Cornish specs changed 0–0.3% of the frame. Near ground-cover looks on rock days show on the far
  cliff tops. Render the spec before promising a near look; count `diff.mjs` changes, not days.
- **"Measured from today's line" and "doesn't move with today's sea" can't both hold (spray belt,
  0.147):** fix the base (spring high water + a typical run-up) and test over forced tide ×
  composition × swell. World heights move with the tide: compare in the land's frame.
- **A rock-shore height rule needs a distance when it moves inland (trunk lichen, 0.148):** a tree
  at belt height 150 m inland isn't in the spray; a flat reach of 40–160 m still greyed every framed
  hero (within 40 m of the shore). Count in-frame trees by outcome (`--count --by`) first, and scale
  the reach with the exposure the rule already has.
- **A smooth height band makes a sock (trunk moss, 0.148):** moss faded over height alone, with
  patches coarser than the trunk, filled the foot solid with a level top. Push the edge with noise
  (±30% of the height) and use patches smaller than the girth.
- **One patch threshold doesn't fit two surfaces (moss, 0.146):** the boulders' mask edge, reused on
  the rock-shore terrain, carpeted a crest. Give each surface its own edge; look at a crop, not a %.
- **Check what the params can say before writing a weather rule:** "wet on rain and drizzle days"
  had no field to read; overcast stands in, said in the code.
- **A tall tree as a framing hero shows only its trunk (eucalyptus, 0.145):** framed shots put 2–4
  heroes 9–30 m off at the frame's edges; a 15–25 m gum's crown is above the frame. Check a new kind's
  height against the hero distance before it can lead the hero order.
- **A crown that reads up close can vanish far off:** leaf cards go sub-pixel, so a sparse crown
  becomes a pale stick at 150 m. Preview `mesh.mjs --eye 150` too, and add branch tips rather than
  only cards per tip.
- **Check where a kind stands on real days before choosing what to draw on it (0.168):** a stone
  pine's nearest in-frame instance is within 30 m on 14% of its days and past 300 m on 58% (arch/PROPS.md
  "Where each plant kind stands"), so its 12 cm cones show on few days. `--find` reports only the
  nearest *unoccluded* one, `--count` only the overall minimum: use `scripts/plant-near.js`.
- A pale, even colour under a tree reads as a stain, and a map's discs as neat ellipses from above:
  fainter, warped, in drifts; the leaves on top carry the look.
- **Small things near the ground: ask what covers them (mushrooms, 0.151):** 3 mushrooms "in frame"
  gave an identical diff: grass tufts and trunks stood in front of each from a 1.6 m eye
  (`--project fungi`'s `covered by`). A mushroom under a tree stood on bare shingle, because trees
  can grow on the backshore: tie under-tree props to the ground they need.
- **Faint point lights: work out the physics first (fireflies, 0.153):** 200 fireflies in a tree at
  300 m sum to ~+8 mag, fainter than the stars; extending the range bought nothing. Compute the
  magnitude at the distance (`fireflyMagnitude`), then decide the range. Glow-worms at 4 cm were all
  behind grass tufts (`covered by`).

## Snow, ice and big shapes

- A mountain's `height` isn't its peak: a range's envelope and ridges reach ~0.8 of it. Measure a
  mesh's real top before writing a target as a share of a parameter. A share of the height also
  scales the wrong way for a physical limit: snow comes down to an altitude, whatever the size.
- Lowering a colour boundary can show a flaw it hid: small noise that looked fine on a summit gave a
  ruler-straight snow edge across a slope.
- **A look from words is a guess (snow, 0.113):** described as a low bench with soft edges, the ice
  foot was 0.3–1.2 m and sloped; three photos showed ~2 m, a near-vertical undercut wall and
  fractured blocks. Look at pictures first.
- **A full frame doesn't check a subtle feature (snow, 0.112):** frozen spray looked fine in a contact
  sheet and was camouflage in a before/after crop. See it with its own switch off.
- **Wrapper patches keep the inner program key (snow, 0.111):** a wrapper's source is the same on
  every day, so a snowless plant could reuse a snowy day's program with its uniform unset (seen in
  the code, not a render). `shadeMaterial`, `addWash`, `snowCap`, `windMaterials` keep it.
- **Caps on tiny things read as crackle (snow, 0.111):** white tops and dark sides on thousands of mesh
  stones looked like cracked mud. Hide what real cover would bury and let the ground stand in.
- **Test what the camera sees at every tide (sea ice, 0.117):** the placement table found rubble
  0.2 m above the eye at 12 m, which no render round had pointed to. Skip such pieces when drawing
  rather than moving them, so the world stays fixed for a moving viewer.
- **Detail from world noise needs low contrast (sea ice, 0.116):** cloudy ice at ±24% over a short
  scale read as granite, evenly spaced frost layers as candy stripes. Start subtle, at the object's
  own scale, and read the near render.
- **Big level things shouldn't tilt (sea ice, 0.115):** floes 0.5–1° apart read as paving near a
  grazing sun. Grep for every tilt: the same effect was in two places.
- **Set a value where it's built (sea ice, 0.115):** overwriting `coast.runup` after `generateCoast`
  left the berm at the old high-tide line (`beach.test.ts` caught it).
- **Shared vertices round a slab's sides read as a drum (sea ice, 0.114):** a low-poly plate needs
  `toCreasedNormals`. A block 4.5 m across and as tall reads as a boulder; ice rubble is slabs as
  thick as the ice.

## Light and exposure

- Auto exposure re-normalises: scaling the whole scene does nothing; change `exposure` (e.g.
  `nightScale`) or relative brightness.
- Post-exposure units: sky ≈ 0.1–1; > 40 clamps white (GradeEffect). Effects added after exposure in
  fixed units look equally strong by day and dusk: physical sources need fixed scene radiance ×
  exposure. Fixed-power lights (lanterns, beams) scale per time of day against the metered sky, or
  they vanish at dusk and blind at night.
- Pale things (foam, spray, mist) vanish against a low sun ahead: check front-lit
  (`sunAzimuthDeg` ≈ 160, daylight) first, then backlit.
- A low sun lights vertical flanks far more than flat sand: dark animals look pale beside the beach
  in side light. That's physics; check albedo numbers before darkening.
- A mirror-sharp sun is ~1000× sky radiance: any sun under overcast shows a glitter path, so the
  glint must be shaded by the clouds actually drawn (their shadow map), not stand-in noise.
- Props are lit by `scene.environment` too: in odd light (totality) dim `environmentIntensity`.
- Env cube is 256²: bright specks become texel blocks in wet-sand reflections. Don't boost things in
  `envScene`. Screen-space effects aren't in it: the ocean shader adds them along `R` itself
  (radiance = graded value / exposure).
- Sand overlays: a plain vertex-coloured sand mesh lights brighter than the terrain's sand shader;
  tint sand-coloured overlays (tracks, stones) ~0.8×.
- Glow round trees against a low sun had four causes: cloud TAA smearing light shafts past
  silhouettes (history now off), half-res clouds upsampled across silhouettes (rims, pink ridge
  outlines), MSAA edge pixels keeping bare sky (`SkyFillEffect`), GGX glints on edge-on leaves (no
  direct specular on plants). A pass reading the depth buffer composites per pixel; anything blended
  into a pixel (MSAA, bilinear) needs coverage handled explicitly.
- A steep stony beach face tilts away from a sun behind the land: at golden hour it sits in shade
  while rocks on it are lit. Judge ground texture under `"weather":"clear"`; a heavy deck leaves the
  beach flat blue (cloud shadow).
- A shade term has to reach every use of the light: the sea's seabed and foam skipped the shadow, so
  shallows stayed turquoise beside a shaded beach. To see a shade's effect: render the raw map as the
  output colour (is it there?), then with only that term off (does it show?).
- No cloud shadow in frame isn't always a bug: a 12 m eye with a 45 mm lens has only 60–600 m of sea in
  most of its frame; under a 13° sun a 600 m base throws its shadow 2.6 km or more. Look from 450 m
  (`camera.heightM`, `horizonFraction`) before fixing.
- Light a cloud removes from the sun must come back as diffuse light, as fog and dust do, or shade
  turns navy and land under a deck goes black. Measure it from the sky as drawn.
- three's standard materials have no `.lights` (only ShaderMaterial does): test
  `isMeshStandardMaterial`, or a patch quietly reaches nothing. A patch's report needs a test on real
  material classes.
- Shader text is built when its module loads, and `shadow.ts` and `params.ts` import each other: a
  constant from `params.ts` in the template throws before the page renders, and snapshot waits out
  its budget. Pass it as a uniform. A render silent for over a minute: rerun with `--budget 30` and
  read `[page error]`.
- `passes.aerial: false` also removes the clouds (takram composites them there): a false-colour
  shade view with it off shows a mountain the deck really hides.
- Absent from a coverage report isn't covered: forced colonies, marsh and wildlife weren't placed in
  the first scenes. Check each kind's row exists.
- **Shadows:** a bias is a fraction of the shadow camera's depth range (0.0004 of 6490 m is 2.6 m, a
  gap at every tree's foot): convert it to metres. A caster drawn only where the camera looks casts
  only from there: the view-wedge terrain cast a narrow straight-edged wedge of shade from a cliff
  behind the camera, so casters need their own mesh over everything between receivers and light
  (force the light behind the caster, `sunAzimuthDeg` ≈ 175, low, to see it). A sharper map exposes
  what a coarse one hid: at 1 cm texels double-sided grass and fronds hatched (three's normal offset
  uses the unflipped normal) and two meshes of one surface striped a snowy beach: zoom on near grass,
  fronds and ground. takram lights the clouds from its cloud shadow map too (0 past
  `shadow.maxFar`): capping it near the horizon left far clouds pink; check the sky after changing a
  shared map.
- **A soft shadow from a comparison-only map:** it can't read blocker depth but holds one blocker per
  texel, so test each tap at a few depths toward the light (0.3, 1, 3, 9, 27 m) and filter each band
  over its own penumbra (`SOFT_SHADOW_GLSL`). A wide disc on a tilted receiver shades itself: offset
  each band by slope × radius. Keep every disc ≥ 1.5 texels.
- three's shadow pass tests the *main* camera's layers, so a layer can't hide a caster from the main
  render only; show it around the one shadow render. A `customDepthMaterial` needs a fragment output
  (`gl_FragColor`), or the draw is dropped ("missing fragment shader outputs").
- **Brightening a frame exposes every light that was wrong but too dark to see:** opened ×8, cloudy
  nights showed palms bright green on black sand (props took 1.75–3× the ground's sky light: the env
  cube holds airglow, the Milky Way, the aurora and the moon's disc). Measure both lights
  (`debug.cubeSkylight` against `skyIrradiance`) in every case at once (starlit, moonlit, aurora,
  cloudy; ground, sea, props): fixed one by one, three causes took six renders.
- A look that changes geometry or the sea can't wait for the frame's meter (the sea is drawn once, on
  frame 0): meter frame 0, set the look, then restart the still and the accumulation.
- A point light with a few fixed rays (lighthouse beams) needs no shadow map: march each ray on the
  CPU against terrain and islands and pass a lit share along it. Count first: land cut a beam in frame
  on 1 day in 1095. A Gaussian beam keeps an upper tail, so an island a little above the lamp only
  dims it.
- **Anything that moves during the shutter is drawn as its time average:** a beam frozen on the
  camera for a 9 s exposure whited out the frame, where a real lens is on the camera ~2% of it
  (0.129). The shutter is known before the render (`shutterOf`); average the angle analytically on
  the CPU (erf) and bake it. A hard edge (a lamp's shade) sampled along a ray bands: give it its
  penumbra and jitter samples per pixel.

## Shaders (GLSL)

- Reserved words that read like names: `flat`, `smooth`, `half`, `input`, `output`, `filter`,
  `active`, `common`, `partition`, `fixed`, `long`, `short`. `smoothstep(e0, e1, x)` with e0 ≥ e1 is
  undefined (works on one GPU, not another): write `1.0 - smoothstep(e1, e0, x)`. Both show only at
  render time.
- **Take screen derivatives before adding a large offset (sea ice, 0.114):** `dFdx(world + origin)`
  at ±50 km drew radial streaks near the camera. Forced specs drew small origins; the real day showed
  it: render a real day when a seed feeds a shader.
- Never leave a `sampler2DShadow` uniform `null`: three r186's fallback is never uploaded, so it binds
  a plain RGBA texture and the GPU silently drops the draw ("Mismatch between texture format and
  sampler type"). Start it on an allocated depth texture (`shadow.ts` `noShadowMap`). Headless
  snapshots don't echo GL errors from the worker: `?worker=0` and `gl.getError()` after draws.
- A render target cleared to (0,0,0,0) holds premultiplied colour in its mips: `mix(x, rgb, a)`
  weights content by a² and leaves a bright fringe. Use `x · (1 − a) + rgb`.
- **A layered ray march (aurora: 28 layers) aliases into stripes** along whatever it point-samples
  between layers: fine noise along the ray (fade it to its mean past half its period), a sheet
  thinner than the step (widen it to the step and its own motion between samples), a profile thinner
  than the layers (average it over the layer: erf for a Gaussian). Then one layer offset per pixel
  turns what's left into grain. Check each in the TS mirror first. A `fract(sin(dot(gl_FragCoord…)))`
  hash loses precision at 1e5 in float32: use interleaved gradient noise.
- A shader with a CPU mirror hashes noise with integers (`skyMirror.ts` `hashGlsl`/`hashCell`, PCG):
  uint math is exact in WebGL2 and JS (`Math.imul`). Any float hash ends in the fract of a large
  product float32 rounds differently (airglow fbm 0.63 on the CPU, 0.22 on the GPU). Each patch
  prefixes its copy (`ng`, `au`): patches share one shader.
- Screen-space derivatives explode on silhouettes: clamp footprints, or NaN normals become white
  bloom dashes (Metal fast-math also defeats `isnan`). Overflowing `exp()` gave NaN terrain.
  `min(NaN, x)` is undefined: Apple GPUs give x, x86 SwiftShader keeps the NaN and bloom spreads it
  over the frame as black (CI 0.195). The frame meter zeroes NaN/±∞ by their bits (`frameNonFinite`).
- **Unprojecting a depth near 1 divides by w ≈ 0** (0.195): the Mac got huge finite distances, x86
  SwiftShader ∞, then NaN. Cap every distance read from a depth buffer with a comparison NaN also
  fails (`len < 1e5 ? … : 1e5`), not `min()`.
- A refactor of shader maths into a function can move single pixels at sharp edges (float order):
  diff against HEAD and zoom before calling it a logic change.
- To read one shader term on the GPU, don't test a constant expression (`ngHash(vec2(3.0, 1.0))`):
  the compiler folds it at higher precision (tools/DEBUG.md "Lines of pixels").

## takram sky, clouds, post

- Sky shader patches (`eclipse.ts`, `contrails.ts`, `noctilucent.ts`): functions before `vec3
  getSkyRadiance(`, calls after `vec3 radiance = GetSkyRadiance(…);`; main sky only, never
  `envScene`'s; make the patch throw if it stops matching. Units km (`ATMOSPHERE.bottom_radius`),
  positions ECEF. Drawn under volumetric clouds and behind geometry for free. The clouds'
  weather-map lookup is patched the same way (`cloudArrangement.ts`). Exception: the night glow is
  also patched into the env cube's sky: it is smooth (0.35°/texel and coarser), 256² faces hold it,
  and the sea must reflect it; sharp features (contrails, meteors, noctilucent detail) stay out.
- **A cloud is drawn by the volumetric clouds, not a mesh:** a mesh is lit by the whole sky dome, has
  hard edges, isn't hazed like the deck and doesn't hide what's behind it (the shelf mesh,
  0.27–0.172: a pale plank; under a storm deck it glowed at 2× the deck; running its top into the
  deck failed, the underside is too thin to cover it). A shape a flat layer can't hold goes into a
  `sampleWeather` patch (`stormCells.ts`, `shelfCloud.ts`; checklist arch/SKY.md "A new cloud
  shape"). A mesh only for what clouds can't hold.
- A CPU mirror of a cloud's density checks its **shape**, not its light: the shelf's outline was
  smooth on the CPU while the render showed humps (shading of a detail term). Find those by switching
  terms off (`params.debug.shelf`).
- Measure a cloud's brightness against what's around it: the shelf face passed at 1.4× the deck
  above, but against the sky below it read as sky. Probe above, on and below (`edges.mjs --mean`).
- **Stretching a noise map to arrange its features stretches every feature** (cloud streets made by
  squeezing the weather map 3× turned each cumulus into a brushed streak, 0.192). Arrange with a mask
  over the unstretched map, and keep the mask's mean at 1 or the sky empties.
- Streaky clouds toward the vanishing point = float32 cancellation in the cube-sphere uv
  (`sqrt(a - sqrt(a² - 6mx²))` = 0 within ~1 km of our anchor's meridian), not wind or texture
  (`stabiliseCubeSphereUv`).
- `coverageFilterWidth` near 1 turns a layer into a sheet (density = remap(mix(weather, 1, width),
  …)); ragged scraps need a narrow width + high `weatherExponent`. An étage's 2nd layer reads
  weather-map alpha (`layerChannels`). Under a closed deck you never see cloud tops.
- The cloud shadow map is temporal (~8 updates to converge): unprimed, the first of 16 frames saw
  clouds unshadowed and low-sun bases came out too pink (`primeCloudShadow`).
- Temporal upscaling + along-ray-only jitter left spots and grain in averaged stills: Halton
  sub-pixel jitter + one final sky denoise fixed it.
- Clouds on a round earth: a 700 m base sinks below a 2 m eye's horizon at ~95 km, tops show to ~140
  km. With Bruneton air alone (~220 km visibility) 40–130 km of undersides stacked into a dark band;
  real sea air (20–60 km) fades them (`seaHaze.ts`). takram's own haze is coverage-gated and coloured
  by ground irradiance (grey at sunrise).
- takram's haze ray ends at the top of the highest cloud layer (`getHazeRayNearFar`): no layers, no
  haze. A clear dust day needs an empty layer through the dust's height.
- Thick dust can't take its colour from the sky behind each ray (blue overhead): colour it from the
  horizon sky in every direction, tinted, and give the sunlight it removes back as diffuse light, or
  sand under a dimmed sun goes purple.
- Haze lit by the clear-sky horizon glows under a storm deck: scale it by the light the clouds let
  through, with a floor (storm 0.06, overcast 0.3).
- **A haze added beside takram's must match takram, not the textbook:** it mixes a colour already
  scaled by the opacity by the opacity again, so inscatter goes as (1 − T)². Measure with `haze.mjs`
  before trusting a formula; probe by world point and check `covered by` (a guessed pixel on a palm
  frond once "proved" the textbook weighting).
- Transparent or dithered meshes don't composite with clouds/aerial perspective (they only see the
  depth buffer).
- postprocessing: `EffectComposer.setSize()` resizes the renderer (restore after side composers);
  inside takram's aerial perspective shader `readDepth()` isn't raw depth, use
  `readDepthValue(depthBuffer, uv)`.

## Night sky

- **A sky-shader feature gets a TS mirror of its brightness** (as `psfWeight` mirrors the stars'
  shader): compute what a frame sees before the first render. The aurora took 8 render rounds; the
  mirror, written at round 6, found both problems (arcs seen side-on are ~0.3× their overhead
  column; the oval band was too narrow) in one run. With `auroraRay` as the real mirror, five fixes
  took 3 rounds.
- **Validate a mirror against the render** (the same line through `params.debug.probeLine` and
  `params.mjs --line`): the first check found the aurora mirror left-right mirrored and the noise
  hash differing on the GPU, and a "smooth" mirror that would have hidden real bands.
- A stripe or band in a sky feature: switch its pass off on the same frame before fixing its
  sampling. The aurora's last "bands" were the airglow's crests, shown by the +1.5 EV. Don't write
  throwaway band metrics (a high-pass counts an arc's edge as ripple; residuals of two smooth curves
  correlate at 0.99): use `lineStats`.
- A brightness quoted for a sky object is a column or a visual class, not what a frame sees: an arc
  seen across from far away gives about its overhead column (a 25 km sheet); low in the sky the air
  takes ~1.3 mag while the airglow is ~2.5× the zenith; a photographed display is the session's
  peak. Compare with the sky at the same elevation.
- Where things land in the sky: `skyFrame.ts`, never a hand-written projector (one had the pitch
  backwards and put meteors 10–20° too high, off the frame). If you must write one, test the horizon
  ahead lands at NDC y = 1 − 2 × horizonFraction. "Is it in frame?" needs the vertical field and the
  horizon's place, not only the azimuth: three "core in frame" nights had it 20° above the top.
- A plan's geometric claim can be backwards: the aurora handoff had rays converging on the pole's
  side; up a northern field line is equatorward, and projecting one with `skyFrame.project` showed
  the edges lean out. Project a test segment before writing a test from a plan's words.
- Bounding a best-of-N placement by physics (the moon to the ecliptic) can starve its framing search:
  count the window with `params.mjs --ref HEAD --stats` first (the night moon fell from 97% to 62% in
  4–18°). Free a choice the scene doesn't pin instead (the hour of night, on its own stream).
- Anything drawn in the sky goes in the sky's units: one render unit is ~75,700 lux, and the light at
  the sun's strength may stand for the moon or a stand-in (`starLight.ts` `renderPerLux`).
  Hand-tuned star intensities were 10⁴–10⁵× too bright and made glitter paths on the sea. takram's
  `StarsMaterial` writes sky + star (opaque), hiding any sky patch under each star: draw stars
  additively.
- **Night colour is a camera's, not an eye's:** night vision (85% of every dim pixel to blue-grey) hid
  every colour a photo shows. Use the night white balance (~4000 K, `whiteBalance.ts`) and give each
  source the colour a camera records in luminance terms: the 630 nm airglow line at 5–35% turned dark
  skies brown (it is a few %); the aurora's red, `redShare(I630/I557.7)`, is 3–8%, not 10–90% (pink
  arcs). Storm red (0.93) bit twice: a symmetric red profile (230 ± 55 km) laid far arcs' red tops over
  near arcs' green (rays at 10–15° cross 230 km far behind the arc), and a diffuse red in fixed kR
  turned weak arcs orange. Give the red its quenched steep underside, scale a diffuse term with the
  display's strength, and split each colour term at the arc's peak elevation on the mirror before
  rendering.
- **A physically scaled light can vanish against a stand-in:** on starlit nights takram's clouds are
  lit by a stand-in sun overhead at a sun's strength, so the aurora's real ~3e-4 lux on cloud edges
  changed 0.06% of pixels. Check what else lights the receiver; fix the stand-in, don't boost the
  source.
- `new Texture(imageBitmap)` never uploads until `needsUpdate = true`: the Milky Way read black
  (`diff.mjs` ⚠ invisible even ×30). `loadImageTexture` callers set it.
- A point light in the sky at a photo's real pixel size is faint against bright twilight: check its
  peak against the sky there (not the zenith), with extinction and the lens's pixel, before calling
  the drawing broken. Diff a point with a `params` patch that only removes it (`{"params":{"planets":
  []}}`): switching the feature off in the spec also undid its framing.
- A noise-free render has no sky noise: a star 10% above the sky still "shows" in numbers. How many
  stars a moonlit frame shows is set by the exposure and the 8-bit display, not a threshold.
- The sky draws sun and moon independently and keeps the moon's total light fixed: scale
  `lunarRadianceScale` by `moonScale²` or a bigger disc is dimmer. A night moon disc is ~10⁴:
  earthshine and the eclipse umbra must be tiny fractions (2e-5, 8e-4).
- Floating things (contrail, high cloud): `GetSunAndSkyIrradiance` is for surfaces (cosine, zero
  below the plane); use `GetSunAndSkyScalarIrradiance` + a phase function.

## Storms and sky objects

- **A light inside a cloud** (CLOUD_ILLUMINATION phase 3; checklist arch/SKY.md "A light inside or
  under takram's clouds"): takram's clouds are optically thin over kilometres, a real Cb opaque in
  tens of metres. A light's term at every march sample averaged over km: an even faint lift. Take its
  value once where the ray first meets the storm's layer (its face, at or above the Cb base, so scud
  doesn't count) and carry it along the ray. Measure what the march passes on with a fixed face value
  (`debug.flash.constant`) before blaming the kernel: it was the haze's 0.49.
- Depths for a light under a cloud's face count from the drawn cloud's base, not where the bolt mesh
  starts (up to 200 m inside it): lights at "exit + 150 m" sat 340 m deep and lit a patch 4× too
  faint.
- The frame meter reads its last frame as well as the first: a boost meant to be metered without a
  light (lightning) has to be held (`FrameMeterPass.held`), or the frame comes out darker the
  brighter the flash.
- `new Vector4()` is (0, 0, 0, **1**): uniform-array padding gets w = 1. Pad with explicit zeros.
- A flash in a still is energy caught ÷ shutter against the ambient. With the camera metered to the
  ambient, glow ÷ ambient depends on how much of the flash the shutter holds: flat while it holds the
  whole flash, rising past the 30 s cap and below a stroke's length.
- Anything meant to show under a storm sits below the volumetric base (Cb 600 m) and clear of scud
  (300–550 m). Check heights against the day's layers (`--fields weather.formations`, `cloudTypes.ts`)
  before rendering.
- Things that come out of a cloud (bolts, rain) are placed independently of the weather map: put the
  cloud there (`stormCells.ts`). Keep them ≤ ~9 km: a 600 m base 10+ km away sits < 3.5° up behind
  ~70% haze and washes pale.
- A mesh hanging from the volumetric clouds (waterspout) can't see deck gaps: give it its own soft
  base (spray puffs).
- Camera-facing ribbons widened along one fixed vector vanish where a segment runs along it
  (lightning as dashes): widen across each segment (`dir × toCamera`).
- Exponential fog with a large scale height fills the sky; a fog *bank* needs tens of metres. And it
  has no top: a camera 100 m over a 55 m-scale layer was still in 16% of the sea-level density and
  saw a pink blanket (2016-08-09). Real sea fog stops at an inversion; give a layer a top and check
  the high eyes (open sea and overlooks, 40–160 m).
- Effects that depend on where the eye is (fog above or below it) belong in the render, where the
  camera's ground is known; `params.ts` can't call `terrainHeight` (import cycle).
- A framing chosen for a sky object (a rainbow's turn from the sun, an aurora's wide lens) has to
  wait for, or undo on, whatever later cancels the object (storm, fog), or the day keeps a 14 mm storm
  shot facing away from the sun (2024-06-21 until 0.121). Decide the cancel first where its draw
  allows (`stormComes`).
- `Vector3.transformDirection` normalises: scale after transforming (contrails all landed 1 km away).

## Sea and surf

- Roughness a pixel can resolve must be drawn, not blurred: the missing short-wave slope added as GGX
  variance everywhere turned a 15 m/s sea into a flat grey sheet and 3 m/s glitter into a haze. Add
  it as a layer of slopes whose mips become variance (the cascades' LEAN trick). One shrunk copy of a
  cascade tiles visibly (1.7 m ≈ 25 px at 50 m): use two at incommensurate sizes and angles.
- JONSWAP's short waves keep their level at any wind (α is constant): a 0.5 m/s sea is not glassy
  until the wind sea fades in with an onset (`windWaveOnset`).
- Before tuning anything that follows the wind (glitter width, reflections), measure the slope
  variance the spectrum draws (`synthesizeOcean().slopeVariance`) against Cox–Munk.
- `textureGrad` only gives an elongated footprint if the texture has `anisotropy` > 1 (render
  targets default to 1); explicit-lod lookups ignore it. A square mip blur sized for the vertical
  spread dilutes narrow objects sideways to nothing.
- Calm water at grazing should be ~0.9 × the sky at the mirrored angle: probe the sky at +x° and the
  sea at −x° on a calm open sea (`horizon.mjs`) before blaming a texture. It matched the sky at +4°
  (a shading normal fix had aimed the ray 5.7° high), and the suspected "dark cube" read the same as
  the frame once probed directly (`cubeProbe`): a wrong diagnosis sat in the known issues for a phase.
- Normals "fixed" for shading are not the surface: `N + V·(0.05 − N·V)` tilts a flat sea ~3° toward
  the viewer at grazing. Anything geometric (the mirror lookup) uses the wave's own normal; it hid a
  2.3°-tall island's whole reflection.
- A cube's mips mix above and below the horizon: anything reading it blurred near grazing averages
  in the ground. Fold the lower half up for water (`foldedSkyCube`).
- A planar reflection blurred evenly lets go of the waterline: past an object's foot the mirror
  target is transparent. Real blur grows with the reflected ray's length t past the water (∝ t / (D +
  t)): read the mirror's depth and scale the mip and wave shift by it.
- A water film above the mirror plane (pools, swash) can see its own ground in the mirror target:
  compare the depth's t with the film's own (`tSelf`) and drop the image where they match.
- Fade a mirrored object's haze toward the sky that same ray reflects, not a sampled "horizon"
  colour, or a hidden 37 km volcano leaves a pale sheet on the water.
- Anything at mean sea level (splashes, foam) hides behind crests at grazing angles: place it on
  `seaLevel()` and lift it a little. Search for sea points over the whole frame's NDC range (a low
  horizon leaves no sea below NDC 0).
- Steep features narrower than the ocean grid (spacing r × 0.012) zig-zag, worst from overlooks:
  clamp widths to grid and pixel size (`surfProfile`'s `minFace`).
- Breaking at H = 0.78 d puts the break line far out on gentle beaches: wide surf zone, smaller waves.
  Surf-zone width follows `nearshoreSlope`, not `beachSlope`: steepen the nearshore too (stony
  beaches).
- A hull rides waves longer than itself: in Hs 3.5 m swell the water climbs a small boat only ±0.1 m.
  Spray comes from wind-sea crests it can't follow: model those statistically. Sample the sea every
  ~2 m under a hull (7 points under a 250 m ship aliased 12 m chop into a fake 0.5° pitch).
- Regular Kelvin waves read as a printed grating from above: cap steepness (0.05), weaken inside the
  wedge, break up with noise.
- Near-camera boats need open water: on beach days no spot ≥ 3 m deep lies within ~150 m in frame;
  use `"coast": "open-sea"` to check wakes/spray up close.
- Calming water means more than lowering the displacement: slopes, Jacobian foam, whitecaps, the surf
  (incoming height, not the depth cap), spray, waves on rocks and CPU `seaLevel()` each read the waves
  separately. Put the factor beside `shallowDamping` in both shaders and pass the same mask to every
  TS mirror (`shelterAt`).
- Scaling the surf's deep-water height still shoals the re-formed wave by Green's law: "≤ 0.3 ×
  offshore" holds against the incoming wave at the same depth (at 1 m, 0.2 × h0 shoals to ~0.4 × h0).
- Wind chop in a lagoon is fetch-limited: 10 m/s over 300 m raises ~1.7 m waves, in the middle
  cascade (1–6.5 m), not the shortest. Scale the middle cascade by fetch.
- A reef's waves break on a ~2 m strip of its steep face, so there's no white line from afar: the
  crest needs its own band of white water. The surf zone ends 150–350 m out; anything breaking
  further (a reef 400 m off) needs `surfReach`.
- Foam on the sea plane is invisible at grazing distance (at 855 m from a 38 m eye a pixel is ~0.5 m
  wide but ~11 m deep: a 2 m collar is 0.2 px tall). Put white water on the object's vertical face
  (wash band) and in spray; size sea foam by wave height, not object radius, and fade it by band width
  over footprint.
- `waveOnRock().breaks` compares the crest with the rock's top only: any cliff "breaks" a 5 cm swell.
  For islands also gate by the crest's own height (`islandWaves`).

## Coast and terrain

- **A CPU mirror can drift from its shader while every test passes** (they check it against itself):
  TS `bareRock` sloped the platform over the ragged width, GLSL over the nominal one, so the camera
  and props stood up to ~0.6 m off the drawn rock (0.137). Found only when a CPU pool search missed a
  pool the GPU saw. Now `scripts/parity.mjs` checks every coast kind (~45 s; after any height or film
  term edit) and `params.debug.terrainProbe` reads any term without a shader edit. Reading two
  versions side by side missed the one-word difference (`width` vs `rockShape.x`) the numbers showed
  at once: dump the terms. Compare a render with code of the same version: a TS height fix moves the
  page's camera.
- A biome-keyed table is wrong for some places (`mediterranean` is also Florida, Taiwan and Natal;
  `volcanic` is Hawaii and Kamchatka). Key what follows the weather by `place.climate`, the rock by
  the biome, a single place's difference by a place field. Before building, read ARCHITECTURE.md
  "Biome, climate or place" and ask `params.mjs` about the odd places (`--scene
  '{"place":"florida-carolinas"}' --stats 'p => p.props.shoreLife?.flowers'` showed Mediterranean
  sea daffodils on 77% of Florida's autumn beaches).
- A row of identical teeth along a far cliff ("copy-paste" shore) was the terrain grid: the
  full-circle grid's cells were 2.2% of r deep but 0.6% wide. Square cells over the view wedge fixed
  it at the same vertex count. Probe with `terrainGrid: 2` and with each height term off (`dip`,
  `gully`, `relief`) before blaming the geology.
- Sharp relief zig-zags across the polar grid wherever it's in silhouette (steep faces, risers, gully
  walls, ragged edges): widen or fade each by distance from the camera (at the origin, so the TS
  mirror can too) and by bare slope; teeth that halve with a 2× grid are aliasing. Find the feature by
  its period: a saw every ~1 m on rock was beds dipping 20° (bedding / dip).
- A camera placed at `distanceToWater` is not at s = −distanceToWater: the wobble at a = 0 (±25 m)
  can put a cliff-top camera on the face. Correct by `wobbleAtCamera` and check `rockGround`.
- Wet ground shaded like wet sand (a near-mirror film) turns a gently sloping intertidal platform
  white: wet rock is a dull sheen; only pools are mirrors.
- Tides move the water off s = 0: every "distance from the shore" in shaders and props must measure
  from `coast.waterline`, or a low tide 350 m out loses its surf and foam.
- Geometry shaped to be seen under water (rip channels, the terrace's seaward edge) shows at low tide
  as hard steps; soften walls and check the low-water render.
- A relative tide range from the day's waves (RTR = range / Hb) makes almost every calm beach with a
  1–2 m tide "tide-modified" (reflective 29% → 10%). The census classes by modal waves: keep
  micro-tidal beaches wave-dominated.
- A gap in a bar isn't a rip: with only the bar removed the channel is as shallow as the trough. Scour
  the channel below the bare profile (rip channels are 1–2 m deeper than the bar).
- Anything sized by the daily run-up vanishes on steep gravel (0.2–0.4 m run-up on a 0.3 face is ~1 m
  of beach): cusps need a band of ~⅓ of their spacing; storm features belong at the storm run-up
  height, not a multiple of the daily one.
- Beach-state surveys file a multibar beach under its inner bar (Short 2006), so their shares and
  mean Ω per state (TBR 3.6 > RBB 3.1 > LBT 2.4) don't line up with a whole-profile state. Compare
  shares by beach length, not count.
- A lagoon curve at the beach slope (0.03) to a 3 m floor never gets there behind a reef 150 m out:
  the drawn depth must be reached (`lagoonSlope`). Compare drawn and reached in `profile.mjs`.
- Steep-sided features (coral heads) make "no steps along s" tests fail: test the joins between
  profile pieces, not every metre.
- Pebbles go below a pixel within a few metres of a 1.6 m eye: keep coarser mottle octaves that fade
  out later. Voronoi cells filled edge to edge read as paving: draw an oval of jittered size inside
  each cell with thin gaps.
- Scanning cells in a circle round the camera costs mostly cells out of frame: walk coarse blocks
  with a tight frustum test, nearest first, and stop at the budget.
- A flat km wide and a few metres high: with an 80 mm lens a small creek beside the camera, crossing
  the view at ~47°, reads as a band across the whole frame; its banks need to be gentle (0.18 m over
  2 m) and its water mirror-flat. Probe with `terrainView: "relief"` before blaming the shading.
- A marsh drawn as a sward on a beach profile sits wherever the beach's land is: capping the beach
  width dropped it below the spring high water. Put salt-marsh height in the profile (spring high
  water + a few decimetres).
- Tight lenses see the ground from 10–15 m: a framed camera 5–30 m into a marsh looked past it. Check
  `p.view.nearest` against where the feature starts.
- A soft mask plus noise should fade the noise out at the mask's edge (`under + k * smoothstep(0,
  0.25, under) * noise`): a threshold on the sum turns on abruptly where the mask leaves 0 (a
  precaution; no render showed it).

## Placement

- Place by trying spots until enough is in view: sampling shore coords round the camera fails in
  along-beach views. Cast rays through the frame and march them to the ground (`spot()` in
  `props/wildlife.ts`). Flocks: by a view ray reaching the target altitude, not fixed NDC heights.
- `ctx.visible()` only says a sphere touches the frustum, so features end up cut by the frame edge:
  use `ctx.inFrame()` (NDC inside the central 75–85%) for things seen whole.
- Beach animals near the waterline vanish under the swash: keep ≥ 0.25 m above sea level
  (`place(..., wet)`). Tropical shelves put 1.2 m deep water only > 150 m out: "in the water" needs a
  shallow fallback (hippos lie down, storm seals 0.8 m).
- From a 1.6 m eye the horizon is ~4.5 km: a 2 m cay is a line of palms over a white strip, and low
  skerries can read as one shore. Make low features nearer, not bigger.
- A rock dropped on a beach reads as a block; a mainland headland must run inland.
- Stony beaches move every line: `beachLines().stormLine` is the ridge crest, and a 1:4 face tilts
  long animals by ~14°: tilt them to `terrainNormal`. A sea-facing shoreline view has no beach
  30–300 m off in frame, so beach haul-outs fall back to a skerry: check them along-beach.

## Meshes

- **Close-ups find what full views hide (0.164–0.165):** floating crab legs, a flipper in the air,
  open snouts, a crest above the back and a floating head all passed the mesh tests and every scene
  render. `test/meshLint.test.ts` checks parts and holes; add each new animal, look with `mesh.mjs
  --focus head`. Preview alone first: the front view caught open crocodile jaws beach renders hid.
- **Fruit at a twig tip is inside the leaves (0.168):** `leaves()` scatters cards round each tip, so
  fruit placed at `tip.p` was hidden. `fruits()` moves it out to the crown's surface and down.
- **A shape right in size can still read as something else (0.168):** a Canary date bunch as one
  lumpy egg looked like a giant orange cone. A bunch is a broom of strands.
- **A shared structure first when the scope may grow (skins, 0.157–0.158):** per-animal textures
  were rebuilt as one atlas when "all animals" came: design the shared form at the first "and the
  others?".
- **Glints and spray are light, not skin:** cap them (`highlights`) before judging a texture's
  contrast; a humpback's spray drops made dolphins look like granite.
- **Count triangles × instances before adding detail to crowds:** faces took penguins 400 → 1,072
  triangles (× 2,500 in a colony) before a trim to 672 (`params.mjs --count`).
- **Set first values from the researched sizes:** goggle eyes and needle bills cost a round each when
  the real sizes were known.
- **A missing vec4 attribute reads (0, 0, 0, 1) (skins):** a shared material patched for one animal
  draws the others. Put the weight in a component that defaults to 0.
- **Blend in log space when the result must stay positive (skins):** a contrast-keeping cross-fade of
  a dark-crevice texture went negative; the pattern multiplies, so tile its log.
- **Subdivide by edge, not by triangle, before cutting (baked scans, 0.150):** per-triangle grids left
  T-joins, so the alpha cut fell into hundreds of islands and the simplifier couldn't get under ~6.7k
  triangles without dropping flower heads. Split every edge longer than the texel at its midpoint;
  1.5k triangles held the plant. Simplify by **error** with a triangle cap (0.3% kept 3 mm stalks;
  1.2% dropped them).
- Clamp before a fractional power: `(1 - t) ** 2.2` is NaN for t a hair above 1, and `start + (length
  * i) / n` can end there (the rock lighthouse's top ring, 0.83). three logs `computeBoundingSphere():
  Computed radius is NaN`; find the mesh by hooking `console.error` in an init script (`?worker=0`):
  its second argument is the geometry.
- `MeshBuilder.tube` returns rings: close ends with `MeshBuilder.cap`. Its frame flips with path
  direction (toward −X cos(angle) points up, toward +X down): crocodiles came out with pale backs.
  Check with face-normal colour averages.
- Smooth blobs read as rocks: seaweed needs loose leaves and ribbons over a low mound
  (`MeshBuilder.ribbon`, `clumpGeometry`). Uniform tubes read as pipes: wood needs bulges, oval
  section, grain checks, splintered ends (`logGeometry`).
- Heads in water read as balls or posts from stacked ellipsoids, as "Nessie" if the neck shows and
  the skull is no wider than the neck. Seals (`swimmingHead`): one lofted tube, skull bulb wider than
  the neck, short tapered muzzle, waterline at the throat.
- Sheer walls on a polar grid read as drums (karst towers as canisters): vary the wall's foot with
  angle, cover with vegetation and dark streaks.
- Welding a fine icosphere (`mergeVertices`, detail 30: 40 ms) cost three times the shaping of a rock:
  shape a copy of a kept one (`props/sphere.ts` `unitSphere`), never the kept one.
- Instanced repeats (trees) < ~100k triangles each; in-mesh randomness from `hash()`/`noise3()`, not
  `rng`, so added detail doesn't reshape every instance.

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
