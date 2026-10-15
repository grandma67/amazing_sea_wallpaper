# Developing features — notes for Claude

How to add a scene feature (a prop, a sky effect, a lighting change) and check it
efficiently. Written after the debris, shore-life and moon/eclipse work, which took longer
than it should have. PLAN.md has the architecture and lessons; this is the workflow.

## 1. Before writing code

- **Read PLAN.md** ("How it works", "Lessons and gotchas") and the module closest to what you
  are adding: `props/rocks.ts` or `props/debris.ts` for instanced props, `props/vegetation.ts`
  for plants, `scene.ts` for lighting and post-processing.
- **Decide what "done" looks like**: which views it should show in (shoreline, along-beach,
  framed, overlook, open sea), at what distance, how often, and whether it should be
  readable at wallpaper size or realistic and subtle. If the task doesn't say and it
  matters, ask the user. Life-size crabs and shells, for example, only show within ~20 m.
- **Research briefly, then commit to a table.** One or two searches are enough. Encode the
  result as data: which biome/ocean/month/time of day gets what (see `FLOWERS` in
  `props/shoreLife.ts` and `debrisFor()` in `props/debris.ts`). The table is what gets
  tested.

## 2. Structure that keeps it testable and stable

- **Split choice from geometry.** A pure `xxxFor(params, rng)` decides what appears; mesh
  builders (`logGeometry(rng, …)`) build it at real size with the base on y = 0; a
  `createXxx(ctx)` places instances. The first two are unit-testable without WebGL.
- **New randomness gets its own stream:** `ctx.rng('my-feature')` in props, or
  `Random.derive(seed, 'my-feature')` in `params.ts`. Never add draws to the main `rng` in
  `generateParams`: that changes every other day's scene. Detail inside a mesh can use
  `hash()`/`noise3()` instead of the stream.
- **Shore coordinates:** `shoreToWorld(coast, s, a)`, with s < 0 on land, s = 0 at the
  waterline and `a` along the shore (camera at a ≈ 0, s = −distanceToWater).
  `beachLines(coast)` gives the high-tide line and the storm line.
- **Place by trying spots until enough land in view** (`ctx.visible`), not by sampling once
  around the camera: the visible beach is often far along the shore (see the driftwood
  piles loop).
- Every material: `vertexColors`, `DoubleSide` for thin parts, `castShadow`/`receiveShadow`,
  `frustumCulled = false` on instanced meshes. Plants: switch off direct specular (see
  `vegetation.ts`) or edge-on leaves glitter.

## 3. Pick test dates with a script, not by guessing

Computing params is cheap (three years of days in ~1 s); rendering is not. Write a
throwaway Vitest file that lists candidate days, then render only those:

```ts
// test/tmp/list.test.ts  (delete afterwards: rm -rf test/tmp)
import { it } from 'vitest'
import { allParams } from '../days'
it('list', () => {
  const lines = allParams()
    .filter(p => p.coast.type === 'beach' && ['shoreline', 'along-beach'].includes(p.coast.composition))
    .map(p => `${p.date} ${p.biome.name}/${p.sea.ocean}/${p.timeOfDay} ${p.title}`)
  require('node:fs').writeFileSync('/private/tmp/claude-501/list.txt', lines.join('\n'))
})
```

`npx vitest run test/tmp`. Console output is swallowed, hence the file. Pick 4–8 dates
covering the cases (each biome, a near view and a far one, day and night). For a feature
that must be in frame (the moon, an eclipse), compute whether it is in frame from
`camera.headingDeg`, `focalLengthMm` (36×24 mm sensor) and `horizonFraction`. Don't render
to find out.

Useful fixed dates: 2024-04-08 and 2026-08-12 (total solar eclipse), 2024-10-02 (annular),
2025-03-29 (partial solar), 2025-03-14 (blood moon), 2026-08-28 (partial lunar),
2024-02-12 (Arctic beach, driftwood), 2024-06-26 (nordic beach, kelp, daytime moon),
2024-07-12 (Mediterranean beach, seagrass, shells), 2024-03-08 (tropical shore at golden hour).

## 4. Render

The dev server runs on **5174** (`strictPort`; 5173 is often another project). First check
it is this app, then start it in the background if needed:

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background
SP=<scratchpad>
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-02-12 2024-07-12 …
```

- 16 frames at 1080p is ~2–3 s a day and enough to judge geometry and lighting. Clouds stay
  grainy; that's expected. Use 2560×1440 when the feature is small.
- The very first render after starting Vite can take minutes (dependency optimisation).
- `DEBUG=1` prints each day's `debug` (exposure, scene luminance, irradiance, nightScale).
  It's also in the `DATE.json` next to each image.
- To see what a prop placed, add a temporary `console.warn('DBG …')` in it. The snapshot
  script echoes browser warnings. Remove it before committing.
- Stop the server when you're done (`lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`).

## 5. Look at the results cheaply

- **Contact sheet first:** `node scripts/contact-sheet.mjs --dir $SP/feat` makes one image of
  all the days. Read that instead of each frame: one image read instead of eight.
- **Crop for small things**, from the full-size render:
  `sips -c <height> <width> --cropOffset <y> <x> in.jpg --out crop.jpg` (note: height
  before width, y before x). Resize whole frames with `sips -Z 1200`.
- Keep the **same dates across rounds** so you compare like with like, and budget the
  rounds: decide what to check, render once, fix everything you saw, render again.
- When something looks wrong, **reason from the numbers before re-rendering.** Render units
  after exposure: sky ≈ 0.1–1; values above 40 clamp to white (GradeEffect). A night moon
  disc is ~10⁴, so anything on it (earthshine, eclipse shadow) must be a 10⁻⁴–10⁻³
  fraction or it saturates. Work out the factor from the JSON, then render.

## 6. Things that bit us

- **Auto exposure re-normalises everything.** Making the whole scene darker or brighter
  does nothing; change `exposure` (e.g. `nightScale`) or the relative brightness of parts.
- **takram's sky** draws the sun and moon independently, with no occlusion. Its shader string can
  be patched after construction (`eclipse.ts`; make the patch throw if it stops matching).
  A moon drawn bigger is dimmer unless `lunarRadianceScale` scales with `moonScale²`.
- **The env cube is 256²**: a star or a bright speck becomes a whole texel and shows as a
  block in wet-sand reflections. Don't boost things in `envScene`.
- **Props are lit by `scene.environment`** (the sky cube) as well as the sun light. In odd
  lighting (totality) they glow unless you dim `environmentIntensity`.
- **Small objects at real scale vanish:** check the frame sizes before tuning colours. A
  10 cm crab at 5 m is ~70 px at 4K; at 20 m it's a speck.
- **Smooth blobs read as rocks.** Seaweed and seagrass need texture: loose leaves and
  ribbons draped over a low mound (`MeshBuilder.ribbon`, `clumpGeometry`).
- **Uniform tubes read as pipes.** Wood needs bulges, an oval section, checks along the grain
  and splintered ends (`logGeometry`).
- `MeshBuilder.tube` returns its rings; close the ends with `MeshBuilder.cap`.

## 7. Tests and finishing

- Add a `test/<feature>.test.ts` covering:
  - the choice table over `allParams()`: only where it should, roughly as often as
    intended, the season respected;
  - the meshes: deterministic, finite positions and normals, base near y = 0, triangle
    budget;
  - for anything in `params.ts`, determinism and the title.
- `npm test` (typecheck + Vitest, ~6 s) and `npx tsc --noEmit` before committing.
- Update PLAN.md: versions table, "How it works", lessons, references. Update TODO.md
  status if it's in use; never commit TODO.md. Commit each feature separately with a
  descriptive message.
