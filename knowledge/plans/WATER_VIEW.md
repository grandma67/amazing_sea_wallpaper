# Finding the shore's water films before rendering

**Status: step 1 done (2026-11-12); steps 2–3 planned.** From the REFLECTION phase 5–6
retrospective.

**Step 1 as built:** `debug.terrainView: 'water'` (`terrain.ts`, last branch of the views). Dry
ground near black (lit by a warm sun it reads dark brown), `exposed × (1 − hard)` green,
`wet × hard` grey, `wet × (1 − hard)` blue, `pools` cyan (terrace runnels, reef hollows, rock
pools, flat creeks and sheets); brightness 0.4–1 by `mirrorW = gloss × mirror × (1 − own)`, a
variable the reflection code now fills (only `mirror` when `passes.wetMirror`/reflection is off).
Rendered on all 8 `scenes/wet-mirror.json` scenes (1080p, 16 frames): the films sit where the
phase 5 renders put their reflections. View off: identical to HEAD on all 8 (`diff.mjs --ref
HEAD`). Test: every `TERRAIN_VIEWS` value parses (`test/debug.test.ts`).

## Why

Pools, runnels, the swash film and damp sand exist only in the terrain shader (`terrain.ts`:
`wet`, `pools`, `rockPools`, `exposed`, `gloss`). No TS mirror, no debug view and no
`params.mjs` query shows where they are, how big, or how near the camera. So REFLECTION phase 5
couldn't find a day with a rock pool beside a boulder near the camera: every pool in its specs
was 50 m+ off, and its done-when ("a pool mirrors the nearby boulders and the cliff") stayed
unchecked. The same gap hides any future film feature (puddle reflections, ice in pools, foam
left in runnels).

## Steps

1. **`terrainView: 'water'`** (render, false colour, `tools/DEBUG.md`): swash film (`wet`) blue,
   pools and runnels cyan, damp drained sand (`exposed`) green, wet rock grey; brightness = the
   mirror weight phase 5 uses (`mirror`, `1 − own`). Answers "where are the films in this frame?"
   at a glance. A row in `propSwitches`-style view tests (the view parses; off = identical).
2. **Counts in the render's JSON** (`debug.water`): pixels of each film kind in frame, and the
   nearest pool pixel's distance (m). Cheap: the shader writes the kinds into a tiny downsampled
   target in the same frame (as `ProbePass` reads boxes), or a second terrain draw with the view
   at 1/8 size. Then `summary.mjs DIR 'j => j.debug.water.nearestPoolM'` over a
   `snapshot.mjs --where 'p => p.coast.rock' --sample 30` folder finds near-pool days, and a
   spec can force one.
3. **Only if 2 is too slow to search with:** a TS mirror of the pool masks (`rockPools`, runnels,
   reef hollows; the noise is `cellNoise.ts`'s, already mirrored for heights) so `params.mjs`
   can ask "nearest pool to the camera" without rendering, as `p.view` does for the ground.

## Done when

- `terrainView: 'water'` on `scenes/wet-mirror.json` shows the pools, runnels, swash and flats
  where the phase 5 renders put their reflections.
- A rock-shore spec with a pool within ~15 m of the camera beside a boulder is found from the
  counts, added to `scenes/wet-mirror.json`, and REFLECTION phase 5's unchecked done-when is
  rendered and judged (photo P in plans/REFLECTION.md).
- Off = identical (`diff.mjs --ref HEAD --off-here`); render time +0% with the view off.

## Size (estimate)

Steps 1–2: about one session. Step 3: another, only if needed.
