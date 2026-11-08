# Reflections that follow the waves

**Status: planned (2026-11-08), nothing built.** Research and sources:
[../REFLECTION.md](../REFLECTION.md) (§ numbers below refer to it). How the reflection works
today: [../arch/OCEAN.md](../arch/OCEAN.md) "Reflections". Estimates are marked; everything else
was measured, read in the code or seen in the reference photos below.

## Goal

The sea mirrors land, islands, mountains, rocks, boats and people the way real water does.
Distance alone never removes a reflection. What decides is how rough the water is where the
reflected ray leaves it, compared with how tall the object looks, plus the haze along the way:

- a glassy morning: full images of every island and mountain, hazed like the things themselves,
  with thin objects (masts) broken into wiggly vertical lines by the last ripples (photo A);
- a windy day (2003-03-11, 14.9 m/s): no recognizable image of a 2°-tall island; the sea is a
  dark, rough blue right up to the island's foot (photos C, D);
- in between: vertical streaks, sharp where an object meets the water (contact hardening).

## Reference photos (viewed 2026-11-08, Wikimedia Commons)

| | Photo | What it shows | Match |
|---|---|---|---|
| A | [Calm sea, San Antonio, Ibiza](https://commons.wikimedia.org/wiki/File:Calm_sea,_San_Antonio,_Ibiza,_panoramic.jpg) | glassy bay: hotels, boats and a far headland mirrored. The far headland's image is as pale and hazy as the headland; mast reflections are thin wiggly vertical lines, longer than the masts' sharp part | calm: haze on the image (phase 1), streaks (phase 2) |
| B | [Stade, Hansehafen](https://commons.wikimedia.org/wiki/File:Stade,_Hansehafen_--_2018_--_2961.jpg) | still harbour water at dusk: a near-perfect mirror of houses and lamps, lamps slightly drawn out downward | the glassy limit; contact line at the quay |
| C | [Lupins, whitecaps and Pigeon Island](https://commons.wikimedia.org/wiki/File:Lupins,_whitecaps_and_Pigeon_Island._-_panoramio.jpg) (Lake Wakatipu, NZ) | strong wind, whitecaps: **no** image of the island or the 2 km mountains; the water is deep blue, darker than the sky at the horizon, flecked white | windy: phase 2's target |
| D | [Rough seas around the island](https://commons.wikimedia.org/wiki/File:Rough_seas_around_the_island_-_geograph.org.uk_-_5790981.jpg) (geograph) | a fresh breeze off rocky points: no mirror image of the dark headland, only foam at its foot; the far sea is a flat dark blue | windy, rock shore |
| E | [Sydney, Darling Harbour at night](https://commons.wikimedia.org/wiki/File:Sydney_(AU),_Darling_Harbour_--_2019_--_3193-5.jpg) | lights drawn into long vertical columns, ~3–6× longer than wide; a building's image is a vertical smear in its colours (a long exposure: the columns are smoother than one instant would be) | streaks (phases 2–3), night lamps |
| F | [Vassholmen island, Kungshamn](https://commons.wikimedia.org/wiki/File:Vassholmen_island_outside_V%C3%A4jern_harbor,_Kungshamn_4.jpg) | a snowy island over thin new sea ice: a soft, blurred image of the island in the ice | ice that mirrors (later) |

What the photos add to the research: in C and D the darkening under the island that §1.2
allows (~5%, estimate) is **not visible at all**, and rough water reads darker and bluer than
calm water, because tilted facets reflect higher, bluer sky. So phase 2's windy target is "no
visible image", not "a faint column".

## Where we stand (read in the code, 2026-11-08)

| Piece | Today | Problem |
|---|---|---|
| Mirror render | `reflection.ts`: the scene from a camera mirrored in y = 0 into a half-res HalfFloat target with mipmaps (`LinearMipmapLinearFilter`) and a float depth texture; drawn once per image | fine |
| Far objects | `userData.distant` (islands > 5 km `islands.ts:349`, all landforms `landforms.ts:329`, two cloud events `cloudEvents.ts:99,161`) left out (`scene.ts` ~930) | stands in for missing haze (§2) |
| Wave shift | `uv = base + N.xz · 0.04 · k` (`ocean.ts` ~549) | ~130× too small for a 63 mm lens and blind to the lens (§5.1) |
| Blur | `textureLod(planarMap, log2(α·300·k))`, capped at lod 6, α from unresolved waves only | the drawn waves never blur it: a 15 m/s sea keeps a crisp image (§5.2) |
| Shape | one isotropic lookup | round smudges, not vertical streaks (§1.3) |
| Haze | none on the mirror path | far images too dark and sharp |
| Wet sand, pools | `terrain.ts` ~1367: env map only | no rocks or cliffs in rock pools or the swash film |
| Sky reflection | `reflect(-V, N)` into the env cube, lod from α | already physical: the planar part should match it |
| Sea drawing | once, in frame 0 (`StillScenePass`); only clouds converge over the frames | nothing averages a noisy lookup afterwards |

Cost measured 2026-11-08 (`bench.mjs`, 4 days with mountains): drawing the far objects in the
mirror is 0% (2.1/2.3/2.0/2.6 s before and after).

## How the frame hazes objects (what phase 1 must match)

Read in `seaHaze.ts`, `scene.ts` and takram's atmosphere (2026-11-08):

- **The air** (takram's aerial perspective, every day): Bruneton sea-level extinction,
  Rayleigh (5.80, 13.56, 33.1)·10⁻⁶ /m + Mie 4.44·10⁻⁶ /m = **(1.02, 1.80, 3.75)·10⁻⁵ /m**
  (R, G, B; `SKY_EXTINCTION` = 1.8·10⁻⁵ is the green one): ~220 km visibility.
- **The sea haze** (the clouds pass; only when it runs: any cloud, or dust): extinction
  `3.912 / V − SKY_EXTINCTION` on top (`hazeDensityScale`), V = `params.visibilityKm`
  (5–100 km, by biome, season, wind, weather; `visibilityFor`). Its colour: the sky radiance at
  +0.02 rad elevation in the ray's azimuth × `hazeLight(weather)` × `hazeTint(weather)`
  (`HORIZON_INSCATTER`). Clear days without dust have **no** sea haze.
- Days: of the 456 far-object days, 397 have the sea haze, 59 only the air.
- 2003-03-11: V = 32.0 km, so β ≈ 1.22·10⁻⁴ /m. Over the island → water path: island 1
  (2.9 km) keeps T ≈ 0.70, island 2 (7.35 km) T ≈ 0.41, the volcano (37 km) T ≈ 0.011 (gone,
  as in the sky).

## Scope

- 41.6% of test days have a far object (a landform or an island past 5 km): phase 1.
- Phase 2: every day with a mirror image: 65.3% shore days + 20.4% open-sea days with far land
  = at least **85.7%**, plus open-sea days with only ships or animals.
- Wind over the test days: 0–2.5 m/s 20.5%, 2.5–5 24.7%, 5–7.5 23.7%, 7.5–10 12.4%,
  ≥ 10 m/s 18.6% (`params.mjs --stats`). About a fifth of days should keep a near-mirror,
  about a fifth should lose the mirror images of small objects.
- Lenses: 20–40 mm on 69% of days, up to 90 mm (`camera.focalLengthMm`). Phase 2 must not
  depend on one.
- Views: shoreline, along-beach, framed, overlook and open sea; all coasts. Night: lamps
  (`lampSprites`, mirrored as point lights) and the moon's glitter stay as they are.
- Live mode: everything here is decided per sea pixel from world positions and slopes, with no
  rule that reads the camera distance. That's the right way round for a moving viewer.

## Phase 0: numbers first

1. **Total slope variance vs Cox–Munk.** The FFT cascades draw part of the slope and `variance`
   carries the rest. Add a debug output (`params.debug.probe` line or a false-colour view,
   tools/DEBUG.md) of σ² = resolved + unresolved, at 50 m, 500 m and 3 km. Resolved: the
   variance of the drawn slope over a patch (e.g. 32×32 sea pixels round the probe, or the
   slope textures' own mip moments at a coarse level); unresolved: `variance.x + variance.y`.
   For wind 1, 5, 10, 15 m/s (`wind` spec field). Target: §1.2 (0.008, 0.029, 0.054, 0.080),
   with calm days below the fit (it overstates them). If the spectrum is far off, that is a
   waves issue (glitter, sky reflection and foam too): raise it before going on.
2. **Scene file** `scenes/reflection.json`, base `timeOfDay: "daylight"`, `weather: "clear"`,
   `eclipse: null`:
   - `windy-islands`: 2003-03-11 as it is (and `sunAzimuthDeg: 160` front-lit);
   - `calm-islands`: the same, `wind: 1`, `swellHeight: 0.2`;
   - `mid-islands`: `wind: 5`;
   - `mountain-calm` / `mountain-windy`: a `landform: "range"` day at wind 1 and 12;
   - `cliff-near`: a rock-shore cliff top, wind 5 (contact hardening must stay);
   - `boats`: ships near and far, wind 3;
   - `harbour-night`: lamps on a boat or pier, wind 3 (photo E);
   - `cloudy-islands`: `windy-islands` under broken cloud, and `clear-islands` under a clear sky
     without dust: the two haze paths above.
   Pick the dates with `params.mjs --where … --sample` and write them into the file.
3. **Mirror the expected numbers in TS** before any render: for `calm-islands` and
   `windy-islands`, the haze T over t (above) and the slope spread vs each island's angular
   height (§1.2). These become the probe targets of phases 1–2.

## Phase 1: haze on the mirror path, no distance cutoff

The reflected light travels object → water (t, from `planarDepth`) → eye (D). The sea pixel
already gets the haze over D from the main pass; the mirror image needs the haze over t (§2).

- In the ocean shader, per colour:
  `T = exp(−(airExtinction + seaHaze)·t)`, `planar.rgb = planar.rgb·T + planar.a·haze·(1 − T)`
  (premultiplied: the coverage stays, the colour fades toward the haze), with
  `airExtinction` = (1.02, 1.80, 3.75)·10⁻⁵ /m, `seaHaze` = `hazeDensityScale` when the clouds
  pass runs, else 0, and `haze` = the env cube at +0.02 rad in the reflected ray's azimuth ×
  `hazeLight` × `hazeTint`. New uniforms: `reflectionHaze` (vec3 extinction) and
  `reflectionHazeTint` (vec3), set in `scene.ts` from the same functions the clouds pass uses.
- The air's own inscatter (takram) over t is small next to the sea haze on haze days; on clear
  days the env cube's horizon is a fair stand-in *(estimate)*. Check it against the island's
  own pixel (Done when).
- Then drop `...props.children.filter(o => o.userData.distant === true)` from `hide`.
  `distant` stays where something else reads it (`props/index.ts:108` water islands). The two
  cloud events are cloud-like and the env cube mirrors clouds: give them their own flag
  (`userData.skyLike`) and keep hiding those.
- Switch: `passes.reflectionHaze` (off = today's image, cutoff included: check with
  `diff.mjs --ref HEAD --off-here`, "identical").
- **Done when:** on `calm-islands` the far island's image at its waterline matches the island's
  own colour just above the waterline × Fresnel at that angle (§1.1) within ~5% (`probe` on
  both); on `clear-islands` the same; the volcano on 2003-03-11 leaves no dark wedge;
  `diff.mjs` vs the switch off shows the far islands' images on the far-object specs and
  nothing `⚠ invisible`.

## Phase 2: project the reflected ray (the wave shift and the drawn waves' blur)

Instead of nudging the lookup by `N.xz · 0.04`, follow the ray the sea already computes for the
sky, `R = reflect(−V, N)`:

1. `t` from `planarDepth` at the unshifted point (as today, for k).
2. The hit estimate `H = P + R · t` (P the sea point), mirrored in y = 0 and projected with
   `planarMatrix` → uv.
3. Look up `planarMap` there.

What this gives, with no tuned constants *(my working, checked in the unit test below)*:
the 2β turn of the ray; contact hardening (small t → small move); the lens (the projection
handles it); and the vertical streaks, since R swings up and down far more than sideways at low
grazing (§1.3). The drawn waves then break up the image the way they already break up the sky
reflection: a wobbly, broken mirror image near the camera, as in photo A. Nothing averages it
afterwards (the sea is drawn once), so where waves get near a pixel in size only the normals'
mips and α smooth it: the far sea at 4K is the place to look for sparkle.

- Unresolved waves: blur by their angle, converted to texels of the mirror target:
  `lod = log2(2·atan(α/√2)·t/(D+t) / φ · targetHeight)`, φ the vertical field of view. The
  same α already sets the env-cube lod, so sky and objects blur alike. Let the lod go above
  today's cap of 6 (the target is ~540 px tall at 1080p, so ~9 levels) when the spread asks for
  it: a box average of premultiplied colour is the "mean of sky and object over the band" of
  §1.2.
- Masked facets: if R points down after the turn, keep today's `R.y = abs(R.y)`, as the sky does.
- Switch: `passes.reflectionRay` (off = phase 1's image).
- Risks: the hit estimate uses one depth for the whole neighbourhood, so near edges (a boat's
  bow, a cliff's foot) a ray that should miss can land on the object; compare `cliff-near` and
  `boats` before and after with `--crop`.
- **Done when:**
  - `windy-islands`: no recognizable image of either island; the sea under them within ~3% of
    the sea beside them (`probeLine` down the column vs beside it; photos C, D);
  - `calm-islands`: a full image, its outline readable (photo A);
  - `mid-islands`: a vertical smear of the island's colour, longer than the island is tall;
  - `cliff-near`: the contact line stays sharp;
  - `harbour-night`: lamp columns 3–6× longer than wide (photo E; ours are point lights, so
    check they still match the mirrored hull);
  - render time within +2% (`bench.mjs`).

## Phase 3: anisotropic blur for the unresolved waves (only if phase 2 needs it)

Phase 2 streaks the drawn waves. The unresolved ones still blur round (one `textureLod`). If
the far sea shows round smudges under islands at 1080p, add 3–5 taps along the screen's
vertical with the sideways blur × sin γ (§1.3). Arch/OCEAN.md's 10-31 note found it not worth
it then; decide from the phase 2 renders, not before.

## Phase 4: wet sand and rock pools mirror the scene

`terrain.ts` gloss reads only the env cube. Pools and the swash film are flat water at about
sea level, so the same mirror target works near y = 0 (exact for pools at the plane; close for
the swash film, a few cm to ~1 m above it at the shore *(estimate)*). Use the phase 2 lookup
there with the film's own roughness (`alpha` in terrain gloss). Wet rock stays a dull sheen.

The terrain is itself drawn into the mirror target, so it must not read that target while
being drawn (a feedback loop: WebGL warns or reads garbage). Bind `planarMap` to the terrain
only after `renderPlanarReflection`, and give the mirror pass an "off" value (`planarOn = 0`).

- **Done when:** a rock-shore day with pools mirrors the nearby boulders and the cliff, and a
  beach day at low sun mirrors people and posts in the swash (photo B is the look of still
  water); `diff.mjs` with the switch off on both; no `GL:` warnings.

## Later (separate plans)

- **Calm in the lee of islands and headlands** (§1.4: 7–15× the obstacle's height downwind):
  a wind-shadow mask beside `shelter.ts`'s swell mask, damping the short cascade and the
  unresolved variance. With phases 1–2 done, mirror patches behind islands come for free.
- **Natural slicks**: glassy bands on light-wind days (surfactants; Cox–Munk's slick fit is
  about a third of the clean slope at 10 m/s).
- **Mirroring ice**: thin new ice and melt ponds (photo F; Malinka 2018: ponds up to 60% of
  multiyear ice in summer). Today the sea-ice sheet is matte (`seaIce.ts` roughness 1).
- **Whitecaps**: they exist (`ocean.ts` `whitecaps` = (U − 5)/6, `ships.ts`
  `whitecapFraction`), but on 2003-03-11 they don't read (backlit, a half-developed sea).
  Monahan & O'Muircheartaigh 1980 give W = 3.84·10⁻⁶ U^3.41: 1% at 10 m/s, ~3.8% at 14.9 m/s
  *(my arithmetic)*. Check against that; not a reflection matter.

## Tests

- `test/glsl` after every shader edit; then `--w 320 --h 180 --frames 1`.
- `propSwitches.test.ts` / `sceneSpec.test.ts` rows for the new switches.
- A unit test of the phase 2 lookup's maths in TS: a flat sea gives today's uv; a tilt β turns
  the hit by 2β; the result is the same in angle for a 20 mm and a 90 mm lens.
- A unit test of the phase 1 haze: T and the haze colour for 2003-03-11 (V = 32 km) match the
  numbers above; a clear day without dust uses only the air's extinction.
- Real days in the first render round: `snapshot.mjs --where 'p => p.landform || p.islands' --sample 8`.
- Before commit: `npm test`, `npx tsc --noEmit`, `params.mjs --ref HEAD` (should be 0 days:
  no choice changes), `bench.mjs` (≤ +2% per phase, 10% overall).

## Time (estimate)

| Phase | Work | Sessions |
|---|---|---|
| 0 | slope debug output, scene file, TS mirror of the targets | ~1 |
| 1 | haze uniforms and shader, off switch, 3 render rounds | ~1 |
| 2 | the ray lookup, lod, edges and sparkle | 1–2 |
| 3 | only if phase 2 shows round smudges | 0–½ |
| 4 | terrain binding order, 2 coasts | ~1 |

About 4–6 sessions. If phase 0 finds the waves' slopes far from Cox–Munk, fixing that comes
first and adds its own time.

## Docs to update as phases land

arch/OCEAN.md "Reflections", ARCHITECTURE.md (known issues: the cutoff goes), LESSONS.md,
REFLECTION.md §5 (what the code does), changelog.md, tools/DEBUG.md (the slope-variance view),
SCENE_SPECS.md if a spec field is added.
