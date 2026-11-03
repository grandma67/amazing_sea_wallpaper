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

- `src/planets.ts`: Standish low-precision elements → ECI directions; magnitudes from distance and
  phase (Venus, Jupiter, Mars, Saturn; Mercury optional). Drawn as stars (phase 2 PSF) through
  the phase-1 rotation. Tests against a few known dates (e.g. greatest elongations).
- Venus/Jupiter glitter path on calm water: a second analytic glint in the ocean shader, like the
  sun's, only when the planet is up and brighter than ~−3.5. Check the cost (one more glitter
  term per sea pixel).
- Blue hour: frame Venus on some days (like the day moon, `'moon-framing'`), title "Venus".
- Spec field `planets: false`.

### 6. Aurora

- Research first (STARS.md §8 lists what's missing): rate of auroral nights by geomagnetic
  latitude, Kp distribution in a declining solar cycle.
- `place.geomagLat` for northern and southern places; `auroraFor(params, rng)` (stream
  `'aurora'`): Kp drawn per day, oval edge from Kp, display needs dark sky (sun < −10°), and
  clear or broken cloud.
- Render: sky-shader raymarch through a 100–300 km shell (16–32 steps, night pixels only):
  curtains as folded bands along the oval with vertical rays, green low, red high, rare purple
  fringe; overhead under the oval, a low arc poleward farther south. **In the env cube too**
  (reflections are the point). A green-tinted ambient light on the scene, strength from the
  display.
- Spec field `aurora: true | 'strong' | null`; title "Northern lights" / "Southern lights".

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

## Seen, not part of this plan

- Starlit render 2026-08-12: bright cell-like lace on the wet sand and the swash, brighter than
  anything else on the beach under a moonless sky.
- Moonlit render 2026-08-28: square soft bright blobs on the beach right of the swash.
