# Night sky: stars, shooting stars, Milky Way, planets, aurora

Plan (2026-10-31; decisions recorded 2026-11-01, see the end; phase 1 done 2026-11-03). Research and numbers: [STARS.md](../STARS.md). Current code:
[arch/SKY.md](../arch/SKY.md) "Moon and eclipses", `scene.ts` (stars block), `params.ts`
(`nightSky`, `moonlight`).

## Where we start

From renders of 2026-08-12 (Perseid peak, new moon) and 2026-08-28 (full moon), and from the code:

1. **The star sky isn't tied to the sun.** Stars are rotated for `date 00:00 UTC + ocean.time`
   at longitude 0; the sun's direction comes from time of day + heading. Blue-hour skies show the
   midnight sky, and the sun and moon aren't where they belong among the stars. Everything below
   that sits on the ecliptic or a radiant (planets, zodiacal light, meteors, Milky Way season)
   needs this fixed first.
2. **Stars are sparse and boosted by hand** (`4000 × nightScale^−1.2`, 1-pixel points, BSC to
   ~6.5). A real tripod photo of a dark coast reaches mag ~8–9 and shows the Milky Way.
3. **A moonless sky is a graded-down blue day sky** (Bruneton lit by a fake sun overhead). It
   should be airglow: dark, slightly green or neutral, brighter toward the horizon.
4. **Missing:** Milky Way, planets, meteors, airglow, zodiacal light, aurora.

Shares (test days): night 10.3% (starlit 3.2%), clear-ish nights 4.9%, blue hour 11.3%, nights at
|lat| ≥ 60° 3.5%. Blue hour is as common as night, so features that show in blue hour (Venus,
Jupiter, bright stars) reach more days.

Budget: night renders take ~1.3 s at 1080p (day ~2–3 s), so there's room. Every feature is a sky
term (per sky pixel, no geometry) or a few points.

## Phases (build order)

Each phase: own random stream, spec field, off switch, test file, `diff.mjs` proof, docs
(SKY.md, STARS.md §10, changelog, SCENE_SPECS, REFERENCES).

### 1. Sky clock: stars, sun and moon agree (foundation)

**Done 2026-11-03** (changelog 0.84, `test/skyClock.test.ts`). What differed from the plan:
the moon on the ecliptic left the night moon above the frame on 38% of moonlit nights (the
night's sun range stopped at −30°), so at night each moon candidate also draws a sun depth down
to the midnight sun's (`'moon-hour'`): 95% in the 4–18° window again. Clamped elevations: 9.6%
of days, kept (pole exact). Both sides of the sun allowed (a waxing moon may stand in the
morning sky): the scene's clock is free.

- `src/skyClock.ts`: `skyRotation(params)` → ECI→world matrix. Take the real sun direction for
  the date (`getSunDirectionECI`, takram) and find the hour angle that gives the scene's sun
  elevation at `latitudeDeg` (cos H = (sin h − sin φ sin δ)/(cos φ cos δ), morning/evening from
  `params.evening`), then turn about the vertical so the real sun azimuth lands on the scene's.
  The scene has no real longitude and its compass is free below 63° anyway, so this keeps every
  current sun and camera choice and only moves the stars.
- If the scene's elevation is impossible for that latitude and date (H has no solution), clamp
  and record how far off it was; count those days with `params.mjs` before deciding anything.
- Polar days already face the real bearing (PLAN_BIOMES 12): there the turn should come out ~0.
- **Moon:** today it's placed at the real elongation but at a random angle round the sun, so it can
  sit far off the ecliptic. Option: use the real moon (`getMoonDirectionECI`) in the same frame.
  It changes the moon on most days and fights the moon framing (`'moon-framing'`), so it's a
  question (below). Minimum: keep the angle but bound it to within 5° of the ecliptic.
- Tests: the sun's ECI direction, turned, equals `sunDirection` (< 0.5°) over `allParams()`;
  Polaris stays at elevation ≈ |latitude| in the north; deterministic. No other params change
  (`params.mjs --ref HEAD`).

### 2. Photometric stars and a real moonless sky

**Done 2026-11-03** (changelog 0.85, `test/stars.test.ts`, `starLight.ts`, `stars.ts`). What
differed: a noise-free render has no sky noise, so the contrast limit (10% of the sky in the
peak pixel) reaches past the catalogue (~6.5) on every night, even under a full moon (~9 at
1080p, 50° lens); what the exposure and the display show decides how many stars a moonlit frame
shows. The starlit sky is still the overhead stand-in's Bruneton sky (now calibrated to 21.6
mag/arcsec²); its airglow colour is phase 3. `stars8.bin` not built (wait for phase 3).
Renders: wide crescent nights show stars graded by size; a 15° telephoto starlit frame shows
~60 (the catalogue's whole share of that patch).

- Star radiance from magnitude in the sky's units (so contrast with the sky decides what shows,
  STARS.md §1); remove the `nightScale^−1.2` boost. Moon and twilight then hide faint stars on
  their own. Calibrate once: a Bortle-2 zenith (~21.6 mag/arcsec²) against a mag-0 star.
- **Point spread:** bright stars 2–3 px with a soft core, faint ones 1 px, so brightness reads as
  size the way a lens shows it. Check it against bloom (`BloomEffect` already runs).
- **Fainter stars:** a `stars8.bin` in takram's format (direction, magnitude, colour) from
  Hipparcos to mag ~8 (~40k stars, ~400 KB; check licence and size first). Only if renders
  still look sparse after the Milky Way (phase 3) adds the unresolved glow.
- **Starlit sky:** replace the overhead fake sun with an airglow term (phase 3) for the sky; keep
  a dim, diffuse, shadowless light for the scene (0.002 lux is from the whole sky).
- Tests: the brightest stars come out in order as the sun sinks (Sirius/Vega by −6°); star count
  above sky noise falls with moonlight (a number from the shader's formula, not a render).

### 3. Milky Way, airglow, zodiacal light (`src/nightGlow.ts`, sky-shader patch)

**Done 2026-11-03** (changelog 0.86, `test/nightGlow.test.ts`). What differed: the map is NASA
SVS Deep Star Maps 2020 (galactic, linear EXR, a layer without the Hipparcos/Tycho stars), not
ESO's 8-bit panorama; the catalogue stars are masked out of the bright-star layer and the rest
blurred in. Calibrated on Masana et al. 2021 (Burns's "2,000 first-magnitude stars" came out 3×
too bright); the brightest clouds are ~3.6× a dark sky, a little above the 1–3× guess. Airglow
by the solar cycle (no per-place darkness: that's the Bortle class). Light domes also along the
coast (along-beach frames look along it). Not done: low clouds lit orange from below; the
domes' warm colour is lost to the scotopic grade (`GradeEffect`). `stars8.bin` still not built:
the map's 6.5–11.5 stars are glow at 0.35°/texel.

- **Milky Way:** an all-sky panorama in galactic coordinates (ESO/S. Brunier, CC BY 4.0; or
  Gaia; ~1024×512, ~0.35°/texel), turned galactic → ECI → world, scaled so the brightest star
  clouds are ~1–3× the dark-sky background. Real dust lanes are why it reads as real; a
  procedural band would look fake. Must not double the bright catalogue stars (use a star-removed
  map or blur them out).
- **Airglow:** zenith brightness by `place.skyDarkness` + solar cycle, brighter toward the
  horizon (van Rhijn), green 557.7 tint with faint bands (low-frequency noise, own stream);
  red 630 rare. Then extinction near the horizon via Bruneton transmittance.
- **Zodiacal light:** brightness by elongation from the sun and ecliptic latitude (Leinert et al.
  1998 table; research before coding), only when the sun is below ~−15°. Gegenschein: optional,
  very faint.
- **Light pollution:** `place.skyDarkness` (Bortle 1–4) per place, researched (most wild coasts
  1–3). Bortle ≥ 4: a warm dome low over the land, low clouds lit orange from below.
- Applies to the main sky and **the env cube** (the sea reflects the Milky Way and airglow; they
  are smooth, so the small cube is fine, unlike stars). This breaks the "patch the main sky
  only" rule in LESSONS.md on purpose: say so there.
- Spec fields: `milkyWay: false`, `airglow: false`, `zodiacalLight: true|false`. Diff on clear
  **and** cloudy skies (clear days skip the clouds pass).

### 4. Shooting stars (`src/meteors.ts`)

**Done 2026-11-03** (changelog 0.87, `test/meteors.test.ts`). What differed: our frames hold
less sky than the 15% assumed (median ~7% by solid angle), but they look low, where meteors are
denser per steradian; with that weighting a clear Perseid peak gives ~60–80% and an ordinary
dark night ~3% (plan: 85%, 5–10%). Real days: 0.3% (clear dark nights are rare). No trains.

- **Table:** STARS.md §5 showers keyed by solar longitude (peak, width, ZHR, radiant, speed, r),
  plus sporadics by hour (dawn 2–3× evening) and hemisphere.
- **Choice** `meteorsFor(params, rng)`, stream `'meteors'`: the "best frame of the session" model
  from STARS.md §5. Expected meteors in frame over a ~4 h session =
  Σ HR(ZHR, radiant height, r, Lm from moon and twilight) × r^−(6.5 − camera limit) × in-frame
  share × hours. P(at least one) = 1 − e^−N. Clouds: × clear fraction. Count: usually 1, rarely
  2 on a peak night. Gives ~85% on a clear Perseid peak, ~5–10% on an ordinary dark night.
- **Each meteor:** shower or sporadic by share; magnitude from the population law above the
  camera limit; a path on the great circle away from the radiant, start 100–120 km (fast) or
  ~95 km (slow), length 5–30°, must lie in frame (`ctx.inFrame` idea, in sky angles); colour by
  speed (fast blue-green/white, slow yellow); brightness profile rising, a late flare, tapered
  ends; total light = magnitude × duration spread over the exposure (500-rule exposure from the
  lens).
- **Render:** a sky-shader patch (like `contrails.ts`): distance from the segment in angle,
  ~1–2 px wide, × Bruneton transmittance. Drawn behind clouds for free. Not in the env cube
  (too thin). Optional faint train for mag ≤ −3.
- Spec field `meteors: true | <shower id> | count | null`; title "Perseids" when a shower meteor
  is in frame. Test the rates over `allParams()` (peak nights high, moonlit and cloudy nights low,
  never by day or bright twilight) and paths pointing back to the radiant.

### 5. Planets

**Done 2026-11-03** (changelog 0.88, `test/planets.test.ts`). What differed: astronomy-engine
already gives positions and magnitudes (no Standish code). The glint reuses the ocean's lamp
loop (a lamp at 10,000 km) instead of a second sun-glint term. Framing Venus also sinks the sun
to 5.5–7° down and needs a clear sky: a −4 Venus in bright twilight near the sun barely beats a
1080p pixel's sky. Real days: 2 titles in three years (blue hour × clear × Venus well placed).

- `src/planets.ts`: Standish low-precision elements → ECI directions; magnitudes from distance and
  phase (Venus, Jupiter, Mars, Saturn; Mercury optional). Drawn as stars (phase 2 PSF) through
  the phase-1 rotation. Tests against a few known dates (e.g. greatest elongations).
- Venus/Jupiter glitter path on calm water: a second analytic glint in the ocean shader, like the
  sun's, only when the planet is up and brighter than ~−3.5. Check the cost (one more glitter
  term per sea pixel).
- Blue hour: frame Venus on some days (like the day moon, `'moon-framing'`), title "Venus".
- Spec field `planets: false`.

### 6. Aurora

**Done 2026-11-04 (changelog 0.91, `src/aurora.ts`, `test/aurora.test.ts`).** Where and when:
geomagnetic latitude per place (dipole pole, `AURORA_SITES`, −2.5° over Europe for corrected
coordinates), session Kp from NOAA's storm-day counts (÷3 for a session) and long-term quiet
shares, oval from 67 − 2·Kp, widening as it grows (poleward edge ~74° quiet, ~70° at Kp 9), low
arcs to 4° beyond either edge. Shares on clear dark winter nights near maximum: Tromsø ~60%,
Iceland ~70%, north Scotland ~20%, Maine and the Wadden Sea ~4%; ~9% of real nights. Fog,
storms and overcast hide it.

How it looks (the five fixes that took it from a green wash to arcs; render specs in
`scenes/aurora.json`):

1. **Arcs where the frame looks.** Under the oval the brightest arc stands 250–450 km off (its
   110 km base 8–18° up), on its own draws; quiet displays 1–2 continuous arcs, active ones 3–4,
   broken and folded. Aurora nights shoot wide (14–24 mm) with the horizon 60–68% down (stream
   `'aurora-framing'`): the frame reaches ~35° up.
2. **Brightness from the photo, not the column.** A photographed display is the session's peak
   (substorm onset): quiet arcs ~10 kR (IBC II), storms 30–100 kR. Seen across from 300–500 km an
   arc gives about its overhead column; the sky there is ~2.5× the zenith and the air takes ~1.3
   mag, so a quiet arc is ~2–2.5× the sky beside it (mirror 2.5× on example 1; render probe ~2×
   beside it, ~3× above).
3. **A faint diffuse glow** (1.2% of the arc's column) on its own thin profile (112 ± 10 km): on
   the old shell-wide profile its long low paths outshone the arcs.
4. **Colours as luminance shares.** Red = 0.265·r / (1 + 0.265·r) with r = I630/I557.7: quiet
   ~0.1–0.18 (3–5% of the luminance), rising in storms (0.93): ~0.2 at Kp 5, ~0.5 at 7, ~1.2 at 9
   (~25%), ×2 for equatorward arcs at Kp ≥ 7 (type A, SAR). The red adds to the green (the green
   keeps its quiet-ratio luminance). Its sheet is 60 km wide and its profile has a steep
   underside (240 km, 35 below, 60 above). Storms add a **diffuse red glow** (0.8–3% of the
   column at Kp 5–9, 250 km, over the oval and ~3° equatorward) and a **type-B lower border**
   (magenta, 3–8%, brightest arc only, Kp ≥ 5 on a draw, always when forced 'strong').
6. **Rays along the field** (0.94): curtains follow dipole field lines (tan I = 2 tan λ, ~71–77°),
   sampled at each point's field-line foot (110 km): in a poleward frame rays lean toward the
   camera, stand taller and fan out toward the frame's edges.
5. **No stripes.** Rays fade to their mean once the layers' samples step more than half their
   period along the arc; sheets are widened to the step across them (folds' drift included);
   profiles are averaged over each layer (erf), not point-sampled; one layer offset per pixel
   (interleaved gradient noise). Grain ≤ ~3% s.d. at the arcs' lower edge.

Light on the ground: the march integrated over the sky (`auroraLux`, RGB), ~1.5–2.5e-4 lux quiet
to ~1e-3 at Kp 9 (under a starlit night's 0.002).

Current values (0.93, `params.mjs --scene scenes/aurora.json`; mirror through `nightSkyCd`, the
sky without the Milky Way):

| Example | Kp, kind | Column | Red / border (luminance) | Red glow | Ground | Arc ÷ sky | Lens, horizon |
|---|---|---|---|---|---|---|---|
| 1 Tromsø quiet | 2, overhead | 14 kR | 3.3% / 0 | 0 | 1.5e-4 lux | 2.5× | 22 mm, 0.66 |
| 2 Tromsø calm, strong | 6, overhead | 36 kR | 7.0% / 4.3% | 0.6 kR | 6.9e-4 | 5.6× | 22 mm, 0.66 |
| 3 Iceland, full moon | 1, overhead | 14 kR | 2.7% / 0 | 0 | 2.4e-4 | (moonlit sky hides it) | 15 mm, 0.61 |
| 4 Scotland, Kp 9 | 9, overhead | 47 kR | 25.9% / 8.0% | 1.1 kR | 1.2e-3 | 3.8× | 21 mm, 0.63 |
| 5 Maine, Kp 9 | 9, overhead | 115 kR | 22.4% / 8.0% | 2.1 kR | 2.9e-3 | 15.1× | 20 mm, 0.61 |

Colours on the mirror (RGB normalised to the brightest channel, before the sky): example 2 body
(0.69, 1, 0.2), 10° above it (1, 0.2, 0.1); example 5 body (0.74, 1, 0.22), red (1, 0.14–0.28)
from 10° above the arc to 60°; example 4's weaker arc reads yellow-green (1, 0.93) at its peak
(the red glow and farther arcs' tops behind it), green below, red above. Storm colours 0.93: what
bit and why in LESSONS.md "Sky". The sea mirrors the arcs through the env cube;
the blur on a "glassy" sea is the sea's own (Jupiter's reflection blurs the same).

Left: clouds aren't lit by the aurora (only the sky behind them is); the airglow's wave crests
show more on aurora nights (+1.5 EV, more sky; ARCHITECTURE.md known issues).

### Later or not at all

- **Bioluminescent surf:** already PLAN_BIOMES 13, best on moonless nights; do it after phase 2 so
  it's lit against the right sky.
- **Satellite trails:** real in 2026 twilight photos, but photographers remove them. Leave out
  unless asked.
- **Twinkling, star trails, stacked meteor composites:** not a single still photo; leave out.

## Decisions (2026-11-01, user: follow the recommendations)

1. **Meteor frequency:** the "best frame of the night" model (clear Perseid peak ~85%, ordinary
   dark night ~5–10%), not a single random exposure.
2. **Moon position** (phase 1): keep today's placement and moon framing, bounded to within 5° of
   the ecliptic; not the real moon for the date.
3. **Milky Way source:** a real all-sky panorama (e.g. ESO/S. Brunier, CC BY 4.0, credited on
   the page), not procedural.
4. **Order:** phases 1 → 2 → 3 → 4 → 5 → 6 as listed.
5. **Night colour** (2026-11-04, user: option C): night frames are a camera's at a night white
   balance (~4000 K, `whiteBalance.ts`), not an eye's night vision. The scotopic grade (85% of
   every dim pixel pushed to blue-grey; 50% at blue hour) is gone. Done in changelog 0.89; the
   aurora (phase 6) continues on top of it.

## Seen, not part of this plan

- Starlit render 2026-08-12: bright cell-like lace on the wet sand and the swash, brighter than
  anything else on the beach under a moonless sky.
- Moonlit render 2026-08-28: square soft bright blobs on the beach right of the swash.
