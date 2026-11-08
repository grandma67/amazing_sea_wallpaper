# Reflections that follow the waves

**Status: phases 0–3 done (2026-11-08; 0.130 ripple layers, 0.131 ray lookup + light-air onset, 0.132 streaks). Next: phase 4 (haze on the mirror image, no 5 km cutoff).** Research and sources:
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

**Order** (set by phase 0): 1. short-wave roughness, so the sea is as rough as real seas;
2. follow the reflected ray, so images spread by that roughness; 3. streaks; 4. haze on the
mirror image and no distance cutoff; 5. pools and wet sand. The cutoff goes last on purpose:
dropped before 1–3, every far island would get today's crisp image on windy days too (41.6% of
days have one).

## Reference photos (viewed 2026-11-08, Wikimedia Commons)

| | Photo | What it shows | Match |
|---|---|---|---|
| A | [Calm sea, San Antonio, Ibiza](https://commons.wikimedia.org/wiki/File:Calm_sea,_San_Antonio,_Ibiza,_panoramic.jpg) | glassy bay: hotels, boats and a far headland mirrored. The far headland's image is as pale and hazy as the headland; mast reflections are thin wiggly vertical lines, longer than the masts' sharp part | calm: haze on the image (phase 4), streaks (phases 2–3) |
| B | [Stade, Hansehafen](https://commons.wikimedia.org/wiki/File:Stade,_Hansehafen_--_2018_--_2961.jpg) | still harbour water at dusk: a near-perfect mirror of houses and lamps, lamps slightly drawn out downward | the glassy limit; contact line at the quay |
| C | [Lupins, whitecaps and Pigeon Island](https://commons.wikimedia.org/wiki/File:Lupins,_whitecaps_and_Pigeon_Island._-_panoramio.jpg) (Lake Wakatipu, NZ) | strong wind, whitecaps: **no** image of the island or the 2 km mountains; the water is deep blue, darker than the sky at the horizon, flecked white | windy: phases 1–2's target |
| D | [Rough seas around the island](https://commons.wikimedia.org/wiki/File:Rough_seas_around_the_island_-_geograph.org.uk_-_5790981.jpg) (geograph) | a fresh breeze off rocky points: no mirror image of the dark headland, only foam at its foot; the far sea is a flat dark blue | windy, rock shore |
| E | [Sydney, Darling Harbour at night](https://commons.wikimedia.org/wiki/File:Sydney_(AU),_Darling_Harbour_--_2019_--_3193-5.jpg) | lights drawn into long vertical columns, ~3–6× longer than wide; a building's image is a vertical smear in its colours (a long exposure: the columns are smoother than one instant would be) | streaks (phases 2–3), night lamps |
| F | [Vassholmen island, Kungshamn](https://commons.wikimedia.org/wiki/File:Vassholmen_island_outside_V%C3%A4jern_harbor,_Kungshamn_4.jpg) | a snowy island over thin new sea ice: a soft, blurred image of the island in the ice | ice that mirrors (later) |

What the photos add to the research: in C and D the darkening under the island that §1.2
allows (~5%, estimate) is **not visible at all**, and rough water reads darker and bluer than
calm water, because tilted facets reflect higher, bluer sky. So phases 1–2's windy target is "no
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

## How the frame hazes objects (what phase 4 must match)

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

- Phase 1: every day with wind > ~2 m/s, ~75% (sun glitter, sky reflection, mirror images).
- 41.6% of test days have a far object (a landform or an island past 5 km): phase 4.
- Phases 2–3: every day with a mirror image: 65.3% shore days + 20.4% open-sea days with far land
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

## Phase 0 (done 2026-11-08): what the numbers say

### Our waves are 4–16× too smooth

Slope variance of the drawn spectrum (`spectrum.ts` `synthesizeOcean`, the mean of the C
textures' (∂h/∂x)² + (∂h/∂z)² per cascade, summed; at weight 1, deep water) + the shader's
constant 0.0006, against Cox–Munk (§1.2). Measured with `params.mjs --each` on 2003-03-11's
ocean, wind forced:

| Wind | ours, this day (development 0.49) | ours, fully developed (1.0), no swell | Cox–Munk | ratio (this day / developed) |
|---|---|---|---|---|
| 1 m/s | 0.0020 | 0.0065 | 0.0081 | 0.25 / 0.80 |
| 2 m/s | 0.0027 | | 0.0132 | 0.21 |
| 5 m/s | 0.0037 | 0.0135 | 0.0286 | 0.13 / 0.47 |
| 10 m/s | 0.0051 | 0.0191 | 0.0542 | 0.09 / 0.35 |
| 15 m/s | 0.0049 | 0.0184 | 0.0798 | 0.06 / 0.23 |

Two causes, both in `spectrum.ts`:

1. **No short waves.** The finest cascade (10.9 m patch, 256 texels: 4.3 cm texels, shortest
   wave ~8.5 cm) stops where most of the sea's slope starts: the gravity-capillary waves of
   1 mm–10 cm, which follow the wind and set Cox–Munk's linear growth. JONSWAP's tail gives a
   slope variance that grows only with log k and saturates near 0.018 (the table's right
   column), whatever the wind. Elfouhaily et al. 1997 built their spectrum's short-wave part to
   match Cox–Munk for this reason.
2. **`seaDevelopment` scales the short waves too.** `windHeight · seaDevelopment` scales every
   cascade, so slope variance goes with development² (0.12–0.81; 0.35–0.9 drawn,
   `params.ts:611`). Short waves come to equilibrium with the local wind in seconds to minutes;
   fetch and duration limit only the long ones *(general)*.

So on 2003-03-11 the reflected rays spread ±4° (ours) instead of ±23° (Cox–Munk). That, more
than the lookup's maths, is why the mirror images ignore the wind. It also means the sun's
glitter path and the sky reflection are too narrow and sharp on windy days: a change here
moves the look of the whole sea, not just reflections (phase 1).

Below ~2 m/s Cox–Munk overstates (its 0.003 intercept; a still sea is a mirror), and we already
reach 0.002–0.006: leave light winds as they are.

### Baseline renders (`scenes/reflection.json`, 1080p, 16 frames)

12 scenes, all render clean (no ⚠ besides backlit). Wind is forced through
`params.ocean.windSpeed` (a patch over the finished params): the `wind` spec field re-draws
the day and moved the camera into the bushes. What they show today:

- **`clear-islands` (0.5 m/s) and `clear-islands-windy` (10 m/s), 2024-05-16:** identical
  dark-green reflections under the 2.6 and 3.3 km islands; the 6.4 km stack has none. The
  clearest picture of both problems in one frame.
- `calm-islands` / `mid-islands` / `windy-islands` (2003-03-11 at 0.5, 5, 14.9 m/s): the
  same dark blob under island 1 in all three; nothing under island 2.
- `mountain-calm` / `-windy` (2025-04-25): the range at 34 km is a pale band on the horizon
  (T = 0.71/0.55/0.28 on a clear day) and has no reflection.
- `near-objects` (2024-10-07, cliff overlook): skerries and a lighthouse in the water, for the
  contact line. `boats` / `harbour-night` (2024-03-22): a sloop, a motor boat and lamps.
- Seen in passing, not a reflection matter: on 2024-05-16 a pale, semi-transparent smear sits
  on the right edge of the big island (also before this work). Check it separately.

### Targets (TS, before any render)

From `params.mjs --each` with the extinctions above and Cox–Munk:

| Scene | Wind | spread ±1σ | Objects: angular height, T (R/G/B) over the path |
|---|---|---|---|
| windy-islands | 14.9 | 22.5° | 2.26° 0.72/0.70/0.66; 2.02° 0.43/0.41/0.35; volcano 2.77° 0.01 |
| calm-islands | 0.5 | ~2–4° (ours) | as above (V 37 km): 0.75/0.74/0.70; 0.49/0.46/0.40 |
| clear-islands | 0.5 | ~2–4° (ours) | 5.76° 0.97/0.95/0.91; 4.40° 0.97/0.94/0.88; 2.12° 0.94/0.89/0.79 |
| clear-islands-windy | 10 | 18.7° | same objects |
| mountain-calm / -windy | 0.5 / 12 | ~2–4° / 20.4° | 2.14° 0.71/0.55/0.28 |

Expected after phases 1–4: `clear-islands` and `calm-islands` show all islands mirrored, the
far ones paler; `clear-islands-windy` and `windy-islands` show none (photos C, D); the 5.8°
island on a 10 m/s sea (θ ≈ ⅓ of the spread) leaves at most a soft column.

## Phase 1 (done 2026-11-08, 0.130): short-wave roughness

**What was built** (differs from the plan below): the tail is not GGX variance but two ripple
layers (the finest cascade again at 1/6.37 and 1/3.91 of its size, turned), whose slopes carry
the tail near the camera and whose mips turn it into variance far off. Round 1 with plain
variance gave a flat grey sheet at 15 m/s and a hazy glitter at 3 m/s; one layer tiled visibly.
Results (`diff.mjs`, switch `passes.shortWaves`): 2024-02-26 (12.7 m/s) the karst island's crisp
dark mirror image became a faint soft darkening (photos C, D); a 21.8 m/s storm's lightning
reflection broke into streaks; 3.3 m/s days barely change; light-wind specs identical; the off
switch reproduces HEAD exactly; 0% render time; 0 days' choices changed. Glitter width was
judged by eye, not measured against Cox–Munk (left for phase 2's probe lines). The sea at 15 m/s
reads lower-contrast and greyer under a grey sky, as the wider averaging predicts.

Original plan:

Add the slope the spectrum can't draw, as unresolved variance, so that drawn + unresolved
follows Cox–Munk above ~2 m/s:

- **The tail, per day:** `synthesizeOcean` already loops over every texel; have it return the
  drawn slope variance (the C textures' mean, summed over cascades). Then
  `tail = ramp(U) · max(0, CoxMunk(U) − drawn)`, with `ramp` going from 0 at 1 m/s to 1 at
  3 m/s (below ~2 m/s Cox–Munk overstates and we already reach 0.002–0.006). On a fully
  developed sea that's ~0.015 at 5 m/s, ~0.035 at 10, ~0.061 at 15; on 2003-03-11
  (development 0.49) ~0.075 at 14.9 m/s. Into `alpha` in place of the constant 0.0006, split
  upwind/crosswind as Cox–Munk (3.16 : 1.92 per m/s), as a uniform per day.
- **Sea development:** computing the tail from the day's own drawn variance covers it: an
  undeveloped sea draws less slope and the tail makes up the rest, as the ripples (which don't
  wait for fetch) would. Wave heights (`significantHeight`) stay as they are, and nothing in
  `spectrum.ts`'s drawn waves changes, so foam, whitecaps and the surf stay too.
- Damping stays as it is: shelter, shallow water, rain (more roughness), slicks and gusts
  already scale `variance`; the tail gets the same factors (`shortDamp · gust`, `slick`).
- What it changes: the sun's glitter path widens and dims on windy days (Cox–Munk's own
  measurement, so the right direction), the sky reflection blurs toward a darker, bluer mean
  (photo C), foam is untouched. Every day with wind > ~2 m/s: ~75% of days. Today's
  mirror image blurs more (its lod reads α: ~4.4 → the cap of 6 at 15 m/s) but stays where it
  is, as dark as now: phase 2 makes it spread.
- Switch: `passes.shortWaves` (off = today's sea).
- **Done when:** the phase 0 table, re-measured with the tail, is within ~20% of Cox–Munk from
  3 to 15 m/s; the glitter path on a 10 m/s day at sun 20° is as wide as Cox–Munk predicts
  (§1.2: ±2σ of slope around the sun's mirror point, by `params.mjs --line` or a probe line);
  real days (`--where 'p => p.ocean.windSpeed > 8' --sample 8`) look like photos C and D, not
  like a sheet of grey metal; `bench.mjs` +0%.

## Phase 2 (done 2026-11-08, 0.131): project the reflected ray

**What was built and found:**
- The lookup as planned, with the blur measured by tilting R and seeing how far the lookup
  moves (no field-of-view uniform). `mirrorCamera` split out of `renderPlanarReflection`;
  `test/reflection.test.ts` checks flat → sea point, 2β·t/(D+t), and lens independence.
- Round 1 erased every reflection, calm ones too. Two causes: (1) at 0.5 m/s the sea still had
  σ² 0.0006–0.0015 (JONSWAP's short waves don't shrink with the wind) plus the 0.0006 floor:
  added a light-air onset (wind sea and floor fade in from 0.6 to 1.6 m/s, Kahma & Donelan 1988;
  under `passes.shortWaves`, 11% of days in the band); (2) the shader's face-the-viewer normal
  fix tilts a flat sea ~3° at grazing angles: the lookup now uses the wave's own normal.
- Results: `calm-islands` / `clear-islands` / `near-objects-calm` (new): sharp images, bands
  where incoming waves tilt the surface, pines as wiggly vertical streaks (photo A), contact
  lines sharp. All windy scenes and real days ≥ 5 m/s: no recognizable image (2024-02-26's
  remaining smudge gone; photos C, D). Both switches off = 8be43d9 exactly; 0% render time;
  0 days' choices changed.
- **A done-when was wrong:** "`mid-islands` (5 m/s): a vertical smear" contradicts §1.2 (±14° of
  spread over a 2.3° island): nothing is left, which is what the photos show. Streaks belong to
  calm-to-light air (< ~3 m/s) and to tall near objects.
- **For phase 3:** at 5 m/s and above most reflections are already gone, and below 2 m/s the
  drawn waves streak them. Round smudges would only show for tall objects in 2–4 m/s air:
  check `mid-islands` at 2.5 m/s and a cliff before building the taps.

Original plan:

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

- Unresolved waves (after phase 1, most of the slope on windy days): blur by their angle, converted to texels of the mirror target:
  `lod = log2(2·atan(α/√2)·t/(D+t) / φ · targetHeight)`, φ the vertical field of view. The
  same α already sets the env-cube lod, so sky and objects blur alike. Let the lod go above
  today's cap of 6 (the target is ~540 px tall at 1080p, so ~9 levels) when the spread asks for
  it: a box average of premultiplied colour is the "mean of sky and object over the band" of
  §1.2.
- Masked facets: if R points down after the turn, keep today's `R.y = abs(R.y)`, as the sky does.
- Switch: `passes.reflectionRay` (off = phase 1's image).
- Risks: the hit estimate uses one depth for the whole neighbourhood, so near edges (a boat's
  bow, a cliff's foot) a ray that should miss can land on the object; compare `near-objects` and
  `boats` before and after with `--crop`.
- **Done when:**
  - `windy-islands`: no recognizable image of island 1; the sea under it within ~3% of the
    sea beside it (`probeLine` down the column vs beside it; photos C, D);
  - `calm-islands`: a full image of island 1, its outline readable (photo A);
  - `clear-islands` vs `clear-islands-windy`: the 2.6 and 3.3 km islands mirrored at 0.5 m/s,
    not recognizable at 10 m/s (today both are identical); the 6.4 km stack waits for phase 4;
  - `mid-islands`: a vertical smear of the island's colour, longer than the island is tall;
  - `near-objects`: the lighthouse's and skerries' contact lines stay sharp;
  - `harbour-night`: lamp columns 3–6× longer than wide (photo E; ours are point lights, so
    check they still match the mirrored hull);
  - render time within +2% (`bench.mjs`).

## Phase 3 (done 2026-11-08, 0.132): vertical streaks

**What was found and built:** the check (light air, 1.5–3.5 m/s, tall objects) showed the
5.8° islands of `clear-islands` vanishing entirely at 1.5 m/s, where ±6.4° of spread should
leave ~25–45% of their tone. The square mip blur was ~250 px wide sideways over a ~50 px island.
Built: three `textureGrad` taps along the streak, ×sin γ across, with anisotropic filtering on
the mirror target (16× in headless Chrome). Results: `near-objects-calm` at 1.5 m/s keeps the
skerry as a dark soft band with the pines as vertical streaks, at 3.5 m/s a soft column at its
foot; 2024-02-26 (12.7 m/s) a faint column under the tall karst island; the storm of 2025-04-25
a vertical lightning glow. The `clear-islands` columns stay faint (sunlit islands close to the
sky's tone). Switch `passes.reflectionStreaks` = 0.131 exactly; +1% render time; 0 choices.

Original note:

Phase 2 streaks the drawn waves, but after phase 1 most of a windy sea's slope is in the
unresolved tail, which phase 2 blurs round (one `textureLod`). So mid-wind images (photo A's
masts, `mid-islands`) will likely be round smudges, not columns. Add 3–5 taps along the
screen's vertical, spaced by the vertical spread, with the sideways blur × sin γ (§1.3), and a
lower lod for the sideways part. Arch/OCEAN.md's 10-31 note found it not worth it with today's
small α; phase 1 changes that. Confirm on the phase 2 renders before building.

- Switch: `passes.reflectionStreaks` (off = phase 2's image).
- **Done when:** `mid-islands` and `harbour-night` show vertical columns 3–6× taller than
  wide (photo E), not round blurs; `bench.mjs` within +2%.

## Phase 4: haze on the mirror path, no distance cutoff

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
- Switch: `passes.reflectionHaze` (off = phase 3's image, cutoff included: check with
  `diff.mjs --ref HEAD --off-here`, "identical").
- **Done when:** on `calm-islands` the far island's image at its waterline matches the island's
  own colour just above the waterline × Fresnel at that angle (§1.1) within ~5% (`probe` on
  both); on `clear-islands` the same for the 6.4 km stack, and it's paler than the near ones;
  on `windy-islands`, `clear-islands-windy` and `mountain-windy` the far objects add nothing
  recognizable (phases 1–3 already spread them); the volcano on 2003-03-11 leaves no dark wedge;
  `diff.mjs` vs the switch off shows the far islands' images on the far-object specs and
  nothing `⚠ invisible`.

## Phase 5: wet sand and rock pools mirror the scene

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
  unresolved variance and phase 1's tail. With phases 1–4 done, mirror patches behind islands
  come for free.
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
- A unit test of the phase 4 haze: T and the haze colour for 2003-03-11 (V = 32 km) match the
  numbers above; a clear day without dust uses only the air's extinction.
- A unit test of phase 1: drawn (from `synthesizeOcean`) + tail is within 20% of Cox–Munk at
  3, 5, 10, 15 m/s for development 0.35 and 0.9; the tail is 0 at and below 1 m/s;
  `significantHeight` unchanged.
- Real days in the first render round: `snapshot.mjs --where 'p => p.landform || p.islands' --sample 8`.
- Before commit: `npm test`, `npx tsc --noEmit`, `params.mjs --ref HEAD` (should be 0 days:
  no choice changes), `bench.mjs` (≤ +2% per phase, 10% overall).

## Time (estimate)

| Phase | Work | Sessions |
|---|---|---|
| 0 | done: slope numbers, scene file, baseline renders, targets | 1 |
| 1 | short-wave tail per day, glitter and sky check on real windy days | ~1–1½ |
| 2 | the ray lookup, lod, edges and sparkle | 1–2 |
| 3 | vertical taps (likely needed) | ~½ |
| 4 | haze uniforms and shader, drop the cutoff, 3 render rounds | ~1 |
| 5 | terrain binding order, 2 coasts | ~1 |

About 5–6 more sessions. Each phase keeps its own switch, so any one can be judged (and
backed out) alone.

## Docs to update as phases land

arch/OCEAN.md "Reflections", ARCHITECTURE.md (known issues: the cutoff goes), LESSONS.md,
REFLECTION.md §5 (what the code does), changelog.md, tools/DEBUG.md (the slope-variance view),
SCENE_SPECS.md if a spec field is added.
