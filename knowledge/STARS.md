# Stars, shooting stars and the night sky

Research for the night view (2026-10-31). What we draw today and what to build next:
[plans/NIGHT_SKY.md](plans/NIGHT_SKY.md). Moon, eclipses, noctilucent and nacreous clouds are
already built ([arch/SKY.md](arch/SKY.md)). Glowing surf (bioluminescence):
[REGIONS.md](REGIONS.md), PLAN_BIOMES 13.

Sourced numbers have a source in the last section. Lines marked *(general)* are textbook
knowledge I didn't re-read in a source for this doc: check them before you turn them into a
table or a test.

The goal is still "a photo of a real coast", so this doc answers two questions: what an eye
would see, and what a camera on a tripod would record (~15–25 s at f/2–2.8, wide lens). A
wallpaper is a photo, so the camera answer usually wins.

## 1. How dark it gets

### Twilight

| Sun's centre | Stage | What shows |
|---|---|---|
| 0° to −6° | civil | the brightest planets and first-magnitude stars, barely, near the zenith toward the end |
| −6° to −12° | nautical | most bright stars; the sea horizon is lost for navigation by the end |
| −12° to −18° | astronomical | the sky looks dark; faint stars and the Milky Way come out |
| below −18° | night | 6th-magnitude stars (Ursa Minor) by the end of astronomical twilight |

In code: blue hour is −2.5° to −7°, night −16° to −30° (`params.ts` `night: [-30, -16]`).
Stars show from −4° in blue hour (`starryTwilight`). Zodiacal light, airglow and the Milky Way
need the sun below about −15° to −18° *(general)*.

### Sky brightness and what it does to stars

| Bortle | Naked-eye limit (NELM) | Zenith brightness (mag/arcsec²) | Notes |
|---|---|---|---|
| 1 | 7.6–8.0 | 21.7–22.0 | airglow plain to see, zodiacal light bright, gegenschein seen |
| 2 | 7.1–7.5 | 21.5–21.7 | airglow weak on the horizon |
| 3 | ~6.6–7.0 | ~21.3–21.5 | airglow swamped; some light domes on the horizon |
| 4 | 6.1–6.5 | 20.4–21.3 (sources disagree) | Milky Way lacks detail near the horizon |

- The SQM column was added to Bortle's scale later by others; Bortle used NELM only.
- A zenith reading can be 0.5 mag/arcsec² darker than one pointed low.
- Most of our coasts are wild (remote beaches, islands, the Arctic): Bortle 1–3. A Bortle 4+
  beach would have a light dome over the land behind it.
- **A photo pixel:** at 1080p with a 60° vertical field one pixel is ~200″ wide, ~4·10⁴ arcsec².
  A 22 mag/arcsec² sky then puts ~10.5 mag in a pixel, so a 6.5-mag star is ~4 mag (~40×)
  above it. Under a full moon (~18 mag/arcsec² *(general)*) the pixel is ~6.5 mag and that star
  vanishes. So **if stars and sky are in the same physical units, the moon and twilight hide
  faint stars by themselves**; no "number of stars" knob is needed.

### Light on the ground (illuminance)

| Source, clear sky | lux |
|---|---|
| full moon | 0.25 |
| quarter moon | 0.01 |
| starlight + airglow, no moon | 0.002 |
| starlight alone | 0.0002 |
| overcast, no moon | 0.0001 |

So **airglow, not the stars, lights a moonless night** (~10× starlight). It comes from the whole
sky, so the light is diffuse and casts no shadows. A quarter moon is only 5× a moonless night;
a crescent moon and the moonless background are about equal.

## 2. Stars

- **Catalogue:** takram ships the Yale Bright Star Catalogue 5 (9,096 stars, J2000 directions,
  magnitudes and black-body colours), roughly the naked-eye sky to magnitude ~6.5.
- **Counts by magnitude** *(general)*: ~3× more stars per magnitude fainter. A tripod photo of
  15–25 s at f/2.8 reaches about magnitude 8–9 in the corners of a clean sky (*(general)*,
  depends on the lens). That is ~40,000 stars to mag 8, against BSC's 9,000. That's why photos
  of a dark coast look "full of stars" while ours look sparse.
- **Colours:** blue-white (Rigel, Vega), yellow (Capella), orange-red (Arcturus, Antares,
  Betelgeuse). In photos the colour shows mostly in bright stars, which spread over a few pixels;
  faint stars look white. *(general)*
- **Extinction:** about 0.28 mag per airmass at sea level (Rayleigh 0.14, aerosol 0.12,
  ozone/water 0.02); 0.15–0.16 at the best mountain sites. Clear nights vary by ±50%. Airmass at
  30° elevation is 2, at 10° ~5.6, so stars near the sea horizon lose 1.5 mag and redden. Bruneton
  `GetSkyRadiance`'s transmittance already does this for us (takram applies it to the stars).
  Hazy days (`visibilityKm`) should dim them more.
- **Twinkling (scintillation)** is turbulence, strongest low in the sky; Sirius low down flashes
  colours. Planets twinkle less because they're small discs. **A still photo shows none of it**,
  so we skip it. (An animated wallpaper could use it later.)
- **Exposure and trails:** the "500 rule" says the longest exposure before stars trail is
  500 / focal length (full-frame), e.g. 14 mm → 36 s, 24 mm → 21 s, 50 mm → 10 s. Many
  photographers stay under 30 s. Our lenses (`camera.focalLengthMm`) give the exposure a real
  photo would use and keep stars as points; star-trail photos are stacked composites (see §8).

## 3. The Milky Way

- **Season:** the bright core (Sagittarius) is up in dark hours roughly March–October in the
  north, best June–August, and best after midnight early in the season. In the south it's
  February–October, best April–August, and it passes high overhead. At high northern latitudes
  the core barely rises (~15° up in Montana) and summer nights are too short.
- **Winter Milky Way** (Cassiopeia–Perseus–Auriga–Orion): fainter, but present on every dark
  night of the northern winter *(general)*.
- **Brightness** *(general)*: the brightest star clouds are ~20.5–21 mag/arcsec², only 1–3×
  the dark-sky background, so the Milky Way **disappears with a bright moon, in twilight, under
  light domes and through haze**. Dark dust lanes (the Great Rift, the Coalsack) are what make it
  look real; a smooth band looks fake.
- Photographers wait for the new-moon weeks.

## 4. Planets

| Planet | Magnitude | Notes |
|---|---|---|
| Venus | −4.9 to −3.8 | evening or morning "star", never more than ~47° from the sun *(general)*; always in twilight or soon after |
| Jupiter | −2.9 to −1.6 | can be up all night |
| Mars | −2.9 to +1.8 | bright only near opposition (every ~26 months *(general)*); orange |
| Saturn | ~+0.5 typical, −0.55 at best | pale yellow |
| Mercury | *(general)* −2 to +3 | only low in bright twilight, rarely seen |

- All of them sit near the **ecliptic**, so they line up with the sun, the moon and the
  zodiacal light.
- Venus over a calm sea leaves a faint glitter path, and Venus and Jupiter can be brighter than
  any star in a blue-hour photo *(general)*. That's the night feature most worth seeing at
  wallpaper size: blue hour is 11% of our days, night only 10%.
- Positions: low-precision orbital elements (JPL "Approximate positions of the planets", Standish)
  give arcminutes, which is plenty *(general)*.

## 5. Shooting stars (meteors)

### What one looks like

*(general, unless sourced)*
- A sand-sized meteoroid burns up at **~120–80 km**: fast ones (Perseids, Leonids ~60–70 km/s)
  start high, slow ones (Geminids ~35 km/s) lower. Most last **0.2–1 s** and run **5–30°**
  across the sky. A straight streak, thin at both ends, often brightest after the middle with a
  final flare. Fireballs last seconds (a reported bolide lasted 7.5 s).
- **Direction:** extended backwards, a shower meteor's path points to the **radiant**. Near the
  radiant the paths are short; ~90° away they're longest.
- **Colour:** fast meteors are blue-green or white (magnesium; oxygen's green line in the
  train), slow ones yellow-orange (sodium, iron). Reported colours: "light blue, green and
  white" (a bolide), "yellow".
- **Trains:** bright meteors can leave a glowing train lasting seconds; rare persistent trains
  last minutes (sunlit dust after a fireball) and come mostly from slower, dimmer meteors that
  end lower.

### How many: the rate

- **Showers:** ZHR is the rate one observer would see under a 6.5-mag sky with the radiant
  overhead. What you actually see:

  HR = ZHR × sin(h_radiant)^γ / r^(6.5 − Lm),  γ ≥ 1

  with **r** the population index (each magnitude fainter has r× more meteors, ~2–3) and **Lm**
  the limiting magnitude. Lm 5.5 with r = 2 halves the rate. A radiant at 30° halves it again.
  Below ~20° radiant height the formula breaks down. A bright moon (Lm ~4–5) costs ×3–10.
- **Sporadics** (no shower): ~5/h before dawn from mid-northern rural sites, under 1/h in the
  evening; at 25°S ~7–8/h at dawn and 1–3/h in the evening. Dawn has 2–3× the evening rate
  because the morning side of the Earth faces its orbital motion. More in the second half of the
  year from the north, and more when the ecliptic stands high.

### Showers (IMO working list)

Peak values for 2026 confirmed in the IMO calendar (sources below); others are long-standing IMO
values *(general)*. Peaks move about a day year to year; key the table by solar longitude, as the
IMO does.

| Shower | Active | Peak | ZHR | Radiant (RA, Dec) | v (km/s) | r | Notes |
|---|---|---|---|---|---|---|---|
| Quadrantids | Dec 28–Jan 12 | Jan 3–4 | 80–110 | 230°, +49° | 41 | 2.1 | northern only; peak ~6 h wide |
| Lyrids | Apr 14–30 | Apr 22 | 18 | 271°, +34° | 49 | 2.1 | |
| η-Aquariids | Apr 19–May 28 | May 5–6 | 50 | 338°, −1° | 66 | 2.4 | best in the south and tropics, before dawn |
| S. δ-Aquariids | Jul 12–Aug 23 | Jul 30 | 25 | 340°, −16° | 41 | 2.5 | south and tropics |
| α-Capricornids | Jul 3–Aug 15 | Jul 30 | 5 | 307°, −10° | 23 | 2.5 | slow, bright, fireballs |
| Perseids | Jul 17–Aug 24 | Aug 12–13 | 100 | 48°, +58° | 59 | 2.2 | northern; radiant 03h12m +58.1° (IMO 2026); new moon on Aug 12, 2026 |
| Orionids | Oct 2–Nov 7 | Oct 21 | 20 | 95°, +16° | 66 | 2.5 | both hemispheres, after midnight |
| Taurids (S and N) | Sep–Dec | Oct 10 / Nov 12 | 5 each | ~32°, +9° / 58°, +22° | 27–29 | 2.3 | slow, fireballs ("Halloween fireballs") |
| Leonids | Nov 6–30 | Nov 17 | 10–15 | 152°, +22° | 71 | 2.5 | storms in some years |
| Geminids | Dec 4–20 | Dec 13–14 | 150 | 112°, +33° | 35 | 2.6 | the strongest; up all night; slow and yellowish |
| Ursids | Dec 17–26 | Dec 22 | 10 | 217°, +76° | 33 | 3.0 | northern |

- Shapes: rates rise and fall over ~1–3 days around the peak (Quadrantids only hours). A
  Gaussian in solar longitude per shower is close enough *(general)*.
- Radiants drift ~1°/day east; for a still image the peak radiant is fine.

### How often a meteor is in a photo

A camera only records the bright ones: the meteor moves, so its light spreads along the streak
instead of piling up like a star's. A wide-angle tripod photo records meteors to about **mag
+2 to +3** *(general; check it against our own rendered star/meteor brightness)*.

Worked example, Perseid peak, dark sky, radiant at 50°: visual HR ≈ 100 × 0.77 ≈ 77/h. Brighter
than +2.5 with r = 2.2: × 2.2⁻⁴ ≈ 0.043 → 3.3/h. Our frame holds ~15% of the sky where meteors
appear (the sea fills the lower half) → **~0.5/h in frame**. One 20 s exposure: 0.3%.

So **a single random frame almost never shows a meteor**. Real meteor photos are the photographer's
pick from a few hundred frames: ~4 h at the Perseid peak gives ~2 meteors in frame
(P ≥ 1 ≈ 86%). An ordinary night (sporadics, ZHR ~10 at dawn, r ~3) gives ~0.02/h → ~8% over
4 h. This "best frame of the session" model is a physical way to get meteors that follow
showers, moon, clouds, radiant height and hour (decision in the plan).

## 6. Zodiacal light and gegenschein

- Sunlight scattered by interplanetary dust along the **ecliptic**: a tilted cone rising from
  where the sun set, brightest near the horizon.
- Visible where the ecliptic stands steep: **northern spring evenings (Feb–Apr) and autumn
  mornings (Sep–Nov)**; the other way round in the south; tropics nearly all year. Needs dark,
  moonless skies after astronomical twilight; moonlight and light pollution hide it.
- **Gegenschein:** a faint oval glow exactly opposite the sun; needs Bortle ≤ 3, no moon, great
  transparency; best around October (out of the Milky Way). Long exposures record it; most eyes
  need averted vision.
- Brightness *(general)*: the zodiacal cone near the horizon at ~30° from the sun is about as
  bright as the Milky Way.

## 7. Airglow

- The atmosphere glows by itself at night (chemistry left over from daytime sunlight). Main
  lines: **green O 557.7 nm** (strongest visible line, ~90–100 km), **red O 630 nm** (~250 km,
  F layer), plus OH bands (red / near infrared) and sodium 589 nm *(heights of the green layer and
  OH/Na: general)*.
- Too faint for colour by eye, but **photos show it**: green, and sometimes red, bands and ripples
  (gravity waves) 10–30° above the horizon on dark nights. Colour cameras put the two oxygen
  lines in separate G and R channels.
- **Brighter toward the horizon** (a thin shell seen edge-on, the van Rhijn effect) until
  extinction wins near the horizon *(general)*.
- Varies with the **solar cycle**: the red line rises and falls with it; the green line is less
  simple. At solar minimum airglow "dims significantly" (NOAA). 2026 is just past the cycle-25
  maximum *(general)*, so expect bright airglow.

## 8. Aurora

- Emission heights: **green 557.7 nm ~100–150 km** (peak ~109 km; 97–170 km), **red 630 nm
  ~200–300 km and above**. So curtains are green at the bottom and red at the top. A purple/blue
  lower fringe (N₂⁺ 427.8 nm) shows in strong displays *(general)*.
- **Where:** an oval around the **geomagnetic** pole (not the geographic pole; it is tilted
  toward Canada *(general)*), so Alaska and Hudson Bay see more than Norway at the same latitude.
  Under the oval (~65–70° geomagnetic *(general)*) it's overhead; equatorward it's a glow and
  arcs low in the poleward sky.
- **Kp (0–9):** higher Kp, bigger oval. Rough: 50–55° geomagnetic needs Kp 5–6; 40–45° needs
  Kp 7–8; Kp 7 reached 41°N. In storms the visible glow reaches ~7° beyond the modelled oval,
  and red-only arcs (SAR arcs) can show far equatorward. High Kp doesn't guarantee a display.
- Needs darkness (none in the midnight-sun months) and gaps in the cloud. Reflected in calm
  water, it is the classic Arctic coast photo.
- **Kp over a cycle** (NOAA space weather scales): days per 11-year cycle reaching G1 (Kp 5) 900,
  G2 360, G3 130, G4 60, G5 4 of ~4,018. A storm day holds its level for ~⅓ of its 3-hour
  intervals *(general)*; quiet sessions mostly Kp 1–2 *(general)*. Storms scale ×0.5–1.5 with
  the cycle (`aurora.ts` `kpFor`).
- **Brightness** (IBC, visual classes: RSRS newsletter 1971, WMO cloud atlas): I ≈ Milky Way,
  II thin moonlit cirrus, III moonlit cumulus, IV full moonlight; in green-line terms ~1, 10,
  100, 1000 kR *(general)*. 1 R of 557.7 nm ≈ 1.93e-7 cd/m², so a dark zenith is ~0.9 kR of
  green-equivalent luminance. Seen across from 300–500 km an arc gives about its overhead column;
  low in the sky the airglow is ~2.5× the zenith and the air takes ~1.3 mag, so a 10 kR arc is
  ~2–2.5× the sky beside it (render probe and the sky mirror, 0.92).
- **Red vs green:** I630/I557.7 falls as the green brightens (dayside arcs: ~5 at 0.1 kR green,
  ~0.1 at 10 kR; Chinese J. Geophys. 2017). Night arcs ~0.1–0.3, so with V(630) ≈ 0.265 of
  V(557.7) red is only **3–5% of the luminance** on quiet nights: green curtains with red tops.
- **Storm red:** in great storms the ratio climbs: the May 2024 mid-latitude aurora over Irkutsk
  had I630/I557.7 up to 15 toward the northern horizon and 30 at the celestial pole, and the 630
  nm glow passed 25 kR in the main phase (Beletsky 2024). Photos of the May and October 2024
  storms at 50–57° are red and magenta above green arcs. We draw ~0.2 at Kp 5 to ~1.2 at Kp 9 on
  the arcs (~25% of the luminance), ×2 for equatorward (type A, SAR) arcs, plus a diffuse red
  glow over the oval and equatorward of it (~250 km; 0.8–3% of the arcs' column, ~1–3.5 kR of
  luminance at Kp 9, below the Irkutsk peak's ~6.6 kR so the arcs stay green). The 630 nm line
  is quenched by N₂ below ~200 km *(general)*: red tops stand clear of the green.
- **Type-B lower border:** fast, bright curtains reaching ~90 km have a red/magenta lower edge:
  the green line is quenched at low altitude and N₂ first-positive (red) with N₂⁺ (blue) shows
  (Hallinan et al. 1998; Vallance Jones; via search summaries, *general*). Seen 5–10° up the air
  takes the blue: it reads crimson.
- **Rays follow the magnetic field:** dipole dip tan I = 2 tan(magnetic latitude), ~77° at 65°,
  ~71° at 55° *(general)*. Up a field line is equatorward (northern hemisphere: B points down and
  poleward), so the magnetic zenith, where a corona converges, is ~13–19° on the equator's side
  of the zenith; looking poleward, rays converge toward the opposite point below the horizon and
  fan out upward.
- **Sunlit tops (not drawn):** curtains above the earth's shadow (~140 km at sun −12°, ~257 km
  at −16°, ~330 km at −18°) scatter N₂⁺ 427.8 nm sunlight: blue-violet ray tops. Our night is
  the sun 16–30° down, so at most the tops of tall storm rays near −16°; skipped.
- **Light on the ground:** a Kp 9 display as drawn gives ~1e-3 lux (integrated over the sky),
  under a starlit night's 0.002 and far under a quarter moon's 0.01.

## 9. Other night things

- **Moonlight:** built ([arch/SKY.md](arch/SKY.md)). A moonlit sky is sunlight scattered by
  air, so it really is blue in long photos; that part is right.
- **Satellites** *(general)*: in 2026 a 20 s exposure of a twilight sky often catches a
  satellite trail (Starlink and others) in the hours after dusk and before dawn. Real, but
  photographers usually remove them (decision in the plan).
- **Light pollution:** domes over towns behind the beach; clouds lit orange from below. Our
  coasts are mostly wild, and ship lights are built (`props/shipLights.ts`).
- **Bioluminescence:** see [REGIONS.md](REGIONS.md): Noctiluca blooms light breaking waves blue
  (Galveston, Singapore, Muscat; Arabian Sea in winter). Best on dark nights before moonrise or
  after moonset. Milky seas: mostly the NW Indian Ocean off Somalia.
- **Noctilucent and nacreous clouds:** built (`noctilucent.ts`).

## 10. What we draw today (2026-10-31)

Renders of `{"timeOfDay":"night"}` on 2026-08-12 (Perseid peak, new moon), starlit clear and
broken, and moonlit 2026-08-28:

- **Stars:** BSC5 via takram `StarsMaterial`, 1-pixel points, intensity `4000 × nightScale^−1.2`
  (an empirical boost), not in the sea reflection. Sparse next to a real dark-sky photo.
  **Fixed 2026-11-03** (phase 2, `starLight.ts`, `stars.ts`): real light from magnitude in the
  sky's units (one render unit ≈ 75,700 lux; the old boost was 10⁴–10⁵× too bright, so every
  catalogue star saturated, even at blue hour), a lens point spread (core σ 0.6 px + halo), and
  flux-correct stars in the reflection cube. Measured takram zenith (render units → cd/m² ×
  75,700): sun 0° 2.1e-3, −2° 7.4e-4, −4° 1.4e-4, −6° 1.4e-5 (~1 cd/m²), −8° 6.4e-7, −10° 7.5e-8
  (~19.3 mag/arcsec²), −12° 1.4e-8, −18° 2.0e-10 (darker than airglow below ~−13°: phase 3).
  The starlit stand-in sky's zenith is 0.065. Limiting magnitude with 10% contrast at 1080p and
  50° lens: civil end (−6°) ~3, −8° > 3, −10° past the catalogue.
- **The sky turns at the wrong time** (fixed 2026-11-03, sky clock, `skyClock.ts`): stars were
  rotated for `date 00:00 UTC + ocean.time` at longitude 0, not tied to the sun. Now the real
  sun for the date lands on the scene's sun; the moon stays within 5° of the ecliptic. 9.6% of
  days have a sun elevation the latitude can't reach that day (mostly high-latitude winter
  middays; 11 nights where the sun never sinks to −16°): the pole stays exact, the sun is off.
- **Starlit sky colour:** a Bruneton "day" sky lit by a fake sun overhead (`starlight =
  [0.2, 0.96, 0.2]`), graded down (since phase 2 only the sky: the ground gets 0.002 lux of
  diffuse light, no direct light). A real moonless sky is airglow (greenish/neutral, brighter
  toward the horizon), not a blue Rayleigh sky. Clouds under it read as dark silhouettes, which
  is right with no light domes.
- **Meteors** (built 2026-11-03, `meteors.ts`): frame share by solid angle × meteor density at
  each elevation (`meteorDensity`, ~(1/sin el)^0.6, nothing below ~5°): median ~0.1 of an
  observer's count. Camera limit +2.5 dark, −0.8 per magnitude of brighter sky (full moon
  ~−0.3: ×3–10 fewer). Shares: clear dark Perseid peak 0.6–0.8 by framing, ordinary dark night
  ~0.03, real days 0.3%.
- **Planets** (built 2026-11-03, `planets.ts`): visibility at blue hour is physical: with
  the sun 4° down, Venus at −3.9, 18–25° from the sun and 7–21° up peaks at ~1.1–2× the sky in
  a 1080p pixel of a 21 mm lens (extinction ~0.5, the glow round the sun ~5× the zenith), so
  framing waits for the sun 5.5–7° down. ~23% of twilight and night frames hold a planet
  brighter than mag 1 (Mercury often, low in twilight, mostly hidden by it).
- **Missing:** ~~Milky Way, airglow, zodiacal light, meteors, planets~~ (phases 3–5),
  aurora, faint stars below ~6.5 as points.
- **Night colour** (2026-11-04): a camera at ~4000 K, not night vision (ARCHITECTURE.md
  "Frame and post"). The airglow's camera colour: ~75% warm continuum (sodium, OH, O₂) + ~25%
  green line, the red line a few % of the luminance; raw dark-sky photos run ~R/G 0.85, B/G 0.6
  (general), teal-blue at 4000 K.
- **Night glow** (built 2026-11-03, `nightGlow.ts`): units S10 (1 S10 = a 10th-magnitude star
  per square degree = 27.78 mag/arcsec² ≈ 1.10 nW m⁻² sr⁻¹ in V). Dark zenith ≈ 220 S10 =
  airglow 145 (up to ~270 at solar maximum) + zodiacal 60 + scattered starlight 15 (Wikipedia);
  at 40° N averaged over a year: airglow 165, zodiacal 95, integrated starlight 75 nW m⁻² sr⁻¹
  (Masana et al. 2021, Table 4). Zodiacal light: Leinert et al. 1998 Table 17 (S10): ecliptic
  pole 77, 90° from the sun on the ecliptic 259, 30° 2,480, gegenschein 230 vs 179 at 150°.
  Milky Way: the SVS map scaled so the zenith at 40° N makes 68 S10 with the catalogue: Sgr
  star cloud ~1,050 S10 (20.2 mag/arcsec²), Scutum ~630, Cygnus ~170, poles 6–9. Two Masana
  pixels at l = 45° (57 and 99 S10, 0.15° wide, in the Aquila dust) come out ~2× in our 0.35°
  texels. The core is in frame on ~3% of Namibia's nights (it must be up, low and ahead: real
  photographers aim for it).
- Share of days (test days, `params.mjs`): night 10.3% (moonlit 7.1%, starlit 3.2%); clear,
  few or cirrus nights 4.9%; blue hour 11.3%; nights at |latitude| ≥ 60°: 3.5%.

## Sources

- NASA SVS, "Deep Star Maps 2020" (Milky Way background and Hipparcos/Tycho layers, galactic, plate carrée) — https://svs.gsfc.nasa.gov/4851
- Masana et al. (2021), "A multi-band map of the natural night sky brightness including Gaia and Hipparcos integrated starlight" — https://arxiv.org/abs/2101.01500 (Table 4 via the HTML version)
- Leinert et al. (1998), "The 1997 reference of diffuse night sky brightness", Table 17 (zodiacal light, S10), as transcribed in skyscapes — https://skyscapes.readthedocs.io/en/latest/_modules/skyscapes/background/leinert.html
- Wikipedia, "Sky brightness" (S10, the dark-sky budget) — https://en.wikipedia.org/wiki/Sky_brightness

- IMO, "The 2026 meteor shower calendar is here" — https://www.imo.net/the-2026-meteor-shower-calendar-is-here/ ; calendar PDF https://www.imo.net/files/meteor-shower/cal2026.pdf
- Sterngucker, "Meteor Shower Calendar 2026/2027" (IMO-based) — https://www.sterngucker.de/en/shooting-stars/meteor-shower-calendar/
- Star Walk, "Meteor showers March–June 2026" — https://starwalk.space/en/news/meteor-showers-in-march-june
- Wikipedia, "Zenithal hourly rate" — https://en.wikipedia.org/wiki/Zenithal_hourly_rate
- "The Perseid and Geminid meteor shower activity over Hungary in 2019–2023" (arXiv 2411.00183) — https://arxiv.org/pdf/2411.00183
- Global Meteor Network, flux — https://globalmeteornetwork.org/flux/
- IMO, sporadic rates outlook — https://www.imo.net/?p=18518 ; eMeteorNews, outlook 11–17 April 2026 — https://www.emeteornews.net/2026/04/10/meteor-activity-outlook-for-11-17-april-2026/
- Sky & Telescope, "Random meteors aren't random" — https://skyandtelescope.org/astronomy-blogs/explore-night-bob-king/random-meteors-arent-random02112015/
- NASA Fireball Network, event 20181220-013502 — https://fireballs.ndc.nasa.gov/skyfalls/events/20181220-013502
- AMS reports 247162, 331163 — https://www.amsmeteors.org/members/imo_view/report/247162 , https://www.amsmeteors.org/members/imo_view/report/331163
- Cordonnier et al. (2024), persistent train catalogue — https://arxiv.org/pdf/2407.18344v1
- Wikipedia, "Bortle scale" — https://en.wikipedia.org/wiki/Bortle_scale ; Telescope School, "The Bortle scale explained" — https://telescopeschool.com/bortle-scale-explained/
- Wikipedia, "Daylight" (illuminance table) — https://en.wikipedia.org/wiki/Daylight ; "Orders of magnitude (illuminance)" — https://en.wikipedia.org/wiki/Orders_of_magnitude_(illuminance)
- Asterism.org, "Atmospheric extinction and refraction" — https://asterism.org/resources/atmospheric-extinction-and-refraction/
- ING La Palma, Technical Note 31 (extinction) — https://www.ing.iac.es/astronomy/observing/manuals/ps/tech_notes/tn031.pdf
- Sky & Telescope, "Sirius-ly scintillating" — https://skyandtelescope.org/observing/sirius-ly-scintillating-holiday12222014/ ; Sky at Night, "Why do stars twinkle?" — https://www.skyatnightmagazine.com/space-science/why-do-stars-twinkle
- Hong Kong Observatory, "What is twilight" — https://www.hko.gov.hk/en/education/astronomy-and-time/astronomy/00408-what-is-twilight.html ; Geoscience Australia, astronomical definitions — https://www.ga.gov.au/geodesy/astro/definiti.jsp
- Sky & Telescope, "Measuring planet magnitudes" — https://skyandtelescope.org/observing/measuring-planet-magnitudes/ ; EarthSky, "Brightest objects in the solar system" — https://earthsky.org/space/what-are-the-brightest-objects-in-our-solar-system
- AstroBackyard, "Milky Way photography calendar" and "The 500 rule" — https://astrobackyard.com/milky-way-photography-calendar/ , https://astrobackyard.com/the-500-rule/ ; Skies & Scopes, "When to see the Milky Way" — https://skiesandscopes.com/when-to-see-the-milky-way-usa/ ; Distinctly Montana, "The return of the galactic core" — https://www.distinctlymontana.com/return-galactic-core-how-get-great-star-field-photographs-montana ; Space.com, Milky Way core in May — https://space.com/stargazing/this-is-your-best-chance-to-spot-the-milky-ways-core-in-may
- Sky & Telescope (R. Wright), "Astrophotography rule of 500" — https://skyandtelescope.org/astronomy-blogs/imaging-foundations-richard-wright/astrophotography-rule-of-500-how-long/
- Universe Today, "The September equinox: 'tis the season to spy the zodiacal light" — https://www.universetoday.com/articles/the-september-equinox-tis-the-season-to-spy-the-zodiacal-light ; Star Walk, "Zodiacal light 2026" — https://starwalk.space/en/news/march-2020-zodiacal-light ; Atmospheric Optics, "Gegenschein" — https://atoptics.co.uk/blog/gegenschein-counter-glow ; EarthSky, "Gegenschein" — https://earthsky.org/astronomy-essentials/definition-what-is-the-gegenschein/
- NOAA NGDC, "Airglow" — https://ngdc.noaa.gov/stp/aeronomy/airglow.html ; "Night airglow in RGB mode" (Solar-Terrestrial Physics, 2016) — https://doaj.org/article/5e229312bb1143cdad58e95ce91511ad ; "Variations of 557.7 nm and 630 nm emissions in the 23rd solar cycle" (SPIE) — https://proceedings.spiedigitallibrary.org/conference-proceedings-of-spie/6936/69361C/Variations-of-5577-nm-and-630-nm-atmospheric-emissions-in/10.1117/12.783531.full ; Dome C sky brightness review — https://arxiv.org/pdf/astro-ph/0511510
- Aurora: Optical Mechanics, "Auroras 2025 guide" — https://www.opticalmechanics.com/?p=6528 ; NSF PAR — https://par.nsf.gov/servlets/purl/10159556 ; Zverev, visual aurora boundary in storms — https://seminar.pgia.ru/archive/2009/1_storm\v_l_zverev__.pdf ; green-line emission heights — https://arxiv.org/pdf/1903.06806 ; UiT, auroral oval boundaries — https://munin.uit.no/handle/10037/19283
- Bioluminescence: Wikipedia, "Milky seas effect" — https://en.wikipedia.org/wiki/Sea_sparkle ; ABC13 Galveston — https://abc13.com/5956790/ ; NUS, Singapore record — https://lkcnhm.nus.edu.sg/wp-content/uploads/sites/10/2022/08/NIS-2022-0091.pdf
- takram three-atmosphere README (stars.bin = BSC5) — https://github.com/takram-design-engineering/three-geospatial
