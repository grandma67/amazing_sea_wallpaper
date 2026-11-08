# Reflections: when water and ice mirror, and how to draw it

Research for mirror images in the sea, wet sand, pools and ice (2026-11-08). How the
reflection works today: [arch/OCEAN.md](arch/OCEAN.md) "Reflections". The plan this doc
leads to: [plans/REFLECTION.md](plans/REFLECTION.md) (§6 is the short version).

Sourced numbers have a source in the last section. Lines marked *(general)* are textbook
knowledge or my own working that I didn't re-read in a source: check them before you turn them
into a table or a test.

## 0. Why this doc: 2003-03-11

Two karst islands, 2.9 km (115 m high) and 7.35 km (260 m high), on a 14.9 m/s wind. The near
one has a dark, crisp mirror image; the far one has none, because `islands.ts` marks islands
past 5 km `distant` and `scene.ts` leaves `distant` objects out of the reflection pass. That
pass doesn't apply aerial perspective, so their images came out too dark (tried 2026-11-08: the
37 km volcano, invisible in the haze, put a dark wedge on the sea).

Real water has no distance cutoff. What it has is roughness: a wind-blown sea spreads each
reflected ray over a band of directions, and an object much smaller than that band leaves only a
faint darkening. On a 14.9 m/s sea that band is about ±23° (§1.2). Both islands are about 2°
tall, so **neither** should show a recognizable image: the near island's crisp one is the
bigger error. Photos of islands on windy water show no image at all, not even a visible
darkening (§1.5). Distance matters only because far things are small and low in the sky, and the
same haze that hides the object also hides its reflection.

## 1. The sea

### 1.1 How much a flat water surface reflects (Fresnel)

Water's index is ~1.34 in the visible. At normal incidence it reflects ~2.1% (Mobley). The rest
of this table is the Fresnel equations for unpolarized light *(my working)*:

| Ray's angle above the water | 90° | 60° | 30° | 20° | 10° | 5° | 3° | 1° |
|---|---|---|---|---|---|---|---|---|
| Reflected | 2.1% | 2.2% | 6.1% | 13.5% | 35% | 59% | 72% | 90% |

From a beach, everything we see in the sea is at grazing angles: a 6 m eye sees the water
100 m out at 3.4° and 1 km out at 0.34°. So by Fresnel alone the far sea is nearly a perfect
mirror. That's why the far sea is the colour of the sky above the horizon, and why the
waves' slopes, not the Fresnel factor, decide whether objects show up in it. The shader's Schlick
form (`ocean.ts` `fresnel`: 0.02 + 0.98(1 − cos)⁵) matches this to a few percent.

### 1.2 Wave slopes spread the mirror image

Cox and Munk (1954) measured sea slopes from photos of sun glitter. On clean water, the mean
square slope grows linearly with the wind U (at 12.5 m):

- σ² = 0.003 + 5.12·10⁻³ U (upwind 3.16·10⁻³ U, crosswind 0.003 + 1.92·10⁻³ U)
- under an oil slick: crosswind 0.003 + 0.00084 U, upwind 0.005 + 0.00078 U, about a third of
  the clean slope at 10 m/s.

A facet tilted by β turns the reflected ray by 2β in the plane of incidence *(general)*. So the
spread of reflected directions, one standard deviation in elevation, is about 2·atan(σ/√2):

| Wind | σ² (clean) | slope σ | per axis | reflected rays, ±1σ (elevation) |
|---|---|---|---|---|
| 1 m/s | 0.008 | 5° | 3.6° | ±7° |
| 2 m/s | 0.013 | 7° | 4.7° | ±9° |
| 5 m/s | 0.029 | 10° | 6.8° | ±14° |
| 10 m/s | 0.054 | 13° | 9.3° | ±19° |
| 15 m/s | 0.080 | 16° | 11.3° | ±23° |
| 5 m/s, slick | 0.016 | 7° | 5.1° | ±10° |
| 10 m/s, slick | 0.024 | 9° | 6.3° | ±13° |

Caveats: the fit was used only from 7 to 13.3 m/s in one satellite study, and warmer water is
rougher than it predicts at the same wind. Below ~1–2 m/s it can't be right: its 0.003
intercept still gives slopes of 3°, but a still sea is a true mirror (§1.4).

**When an object's image survives:** compare its angular height θ with the spread *(my working)*:

- θ ≫ spread: a recognizable image, smeared at the edges (a cliff next to you, any coast on a
  glassy morning).
- θ ≈ spread: a soft column of the object's colour under it.
- θ ≪ spread: no image, only the average of sky and object over the band: a slight darkening
  (a dark object) or lightening (a snowy one) under it, weaker the smaller θ is.

Objects on 2003-03-11: island 1 is 2.3° tall, island 2 2.0°, the volcano 2.8°. With ±23° of
spread, each covers about a tenth of the band, so each leaves a faint darkening at most.

### 1.3 Streaks: why reflections stretch vertically

The tilt toward or away from the eye turns the reflected ray up or down by 2β. A sideways tilt
turns it sideways by only about 2β·sin γ, where γ is the grazing angle *(general)*. At 1–3° of
grazing (most of a beach view) the image smears ~20–60× more vertically than sideways: each
light becomes a vertical column ("light pillar", van Wieringen 1947, after Minnaert), and each
island a vertical smear, not a blurred blob. `arch/OCEAN.md` already notes this (≈ 1/sin γ).

Near the horizon, the facets we see are mostly tilted toward us: the waves' backs are hidden
behind crests (shadowing and masking). So far water mirrors sky higher up than the mean
surface would, and low objects on the horizon drop out of the mirror sooner. Radar work puts the
limit where shadowing breaks the usual sea-surface models at ~15° grazing (West 1997). I found no
optical number for this *(general; worth a source before building on it)*.

### 1.4 When the sea is a mirror

- **No wind at all.** Waves can't grow under a wind slower than the slowest water wave:
  ~23 cm/s (λ ≈ 1.7 cm), or ~30 cm/s and 2 cm in another source. Beaufort 0 is "sea like a
  mirror" (< 1 knot). Photographers' rule of thumb: good reflections up to ~3 mph (1.3 m/s) and
  rarely above 6 mph (2.7 m/s) unless sheltered (forum advice, anecdotal).
- **Swell without wind.** Swell is long and gentle (slopes of a few degrees), so a calm day with
  swell still mirrors, with slow wobbles instead of blur *(general)*.
- **Slicks.** Surfactants from plankton, bacteria and seaweed gather in bands at low wind and
  damp the cm–mm waves by more than ten times. The result is glassy streaks and patches on an
  otherwise rippled sea, visible to the eye and to radar.
- **Wind shadow.** In the lee of an island or headland the water is calm for roughly 7–15× the
  obstacle's height downwind (a sailing source), and a large island's shadow can reach 10–20 miles.
  There's a glassy band along the upwind shore of a lake. So the sea's reflectivity varies
  across the view: a mirror near a sheltering island, rough beyond it. That's what a real photo
  shows and what ours should.
- **Gusts (cat's paws).** Dark, rippled patches move over a calm sea; between them the mirror
  is back *(general)*.
- **Rain** roughens the surface into rings and kills the mirror image; foam and whitecaps cover
  it *(general)*.

### 1.5 What photos show (viewed 2026-11-08)

Six Wikimedia Commons photos, listed with links in [plans/REFLECTION.md](plans/REFLECTION.md)
"Reference photos":

- **Glassy bay (Ibiza):** a far headland's image is as pale and hazy as the headland; masts
  become thin wiggly vertical lines, longer than the masts' sharp part.
- **Still harbour (Stade):** a near-perfect mirror; lamps slightly drawn out downward.
- **Windy lake (Wakatipu) and a fresh breeze off rocks (geograph):** no image of the island,
  headland or 2 km mountains at all. The water is a deep, dark blue, darker than the sky at the
  horizon, flecked with whitecaps: tilted facets mirror higher, bluer sky, and Fresnel is lower
  on them.
- **Harbour at night (Sydney):** lights drawn into vertical columns ~3–6× longer than wide
  (a long exposure, so smoother than an instant).
- **Thin new sea ice (Kungshamn):** a soft, blurred image of a snowy island in the ice.

So the darkening §1.2 allows for a small object on a windy sea (~5%, my estimate) is below what
a photo shows. Treat "no visible image" as the target.

### 1.6 Whitecaps

Monahan & O'Muircheartaigh 1980 (robust fit, U at 10 m): W = 3.84·10⁻⁶ U^3.41, a fraction of
the surface: 1% at 10 m/s (their worked value), ~3.8% at 14.9 m/s *(my arithmetic)*. Wave age,
wave height and water temperature also matter. Beaufort 6: whitecaps everywhere; 7: foam blown
in streaks.

## 2. Haze and distance

The light from a far island to the eye by way of the sea goes island → water point (length t)
→ eye (length D). It passes through the same air as the direct view, so it is hazed by about
as much: a hazed island has an equally hazed reflection *(general)*. The reflection pass must
apply aerial perspective over t, and the sea pixel then gets its own haze over D, as it already
does. With that, there's no reason for a distance cutoff. Far objects drop out of the mirror
naturally: they are small (§1.2), close to the horizon (§1.3), and faded by the haze.

## 3. Other surfaces

| Surface | Reflects | What it looks like | In code today |
|---|---|---|---|
| Swash film, wet sand with a film | Fresnel at the water–air surface (Lekner & Dorf 1988) | a sky-coloured sheen, a mirror where the film is unbroken, darker sand beneath | `terrain.ts` gloss: env map only (sky), no land or props |
| Damp sand, no film | darker, light trapped in the film between grains (Ångström) | dark, dull; bright spots where water pools | rougher gloss |
| Rock pools, ponded water | still water: a true mirror | sharp images of rocks and sky | `pools` in terrain gloss: env map only |
| Wet rock | rough film | a dull sheen, not a mirror | gloss × 0.4 |
| Melt ponds on sea ice | Fresnel at the pond surface plus light bounced off the ice beneath (a Lambertian bottom; Malinka et al. 2018) | small still ponds: sky-blue to turquoise, mirror the sky; up to 60% of multiyear ice in summer | not drawn |
| Bare and glacier ice | strong forward (specular) peak at low sun, stronger on blue ice than on snow (Perovich 1994, Antarctic study 1994) | glare toward the sun; wet ice is darker overall (reflectance below 0.2) | ice sheet roughness 1 (matte); iceberg wet faces 0.28+ |
| Nilas (new thin ice) | **matte**, not glossy (MANICE) | dark nilas very dark, light nilas greyer | sheet roughness |
| Grease ice | damps waves but looks **matt**, little reflection | an oily, flat-looking sea | — |

Melting ice is glossy where a meltwater film or pond lies still on it. I found no measurement
of a meltwater film's specular reflectance on ice; the expectation that it behaves like a
water film over a bright bottom is my own *(general)*.

## 4. How it's drawn on GPUs

- **Planar reflection** (ours, `reflection.ts`): render the scene again from a camera
  mirrored in the water plane, clipped at the surface (an oblique near plane). Exact for a flat
  mirror. Waves are faked by moving the lookup by the normal and blurring with mip levels.
  Cheap for one plane; on 2026-11-08 adding the far islands and mountains cost 0% (bench, 4 days).
- **Contact hardening:** blur grows with t / (D + t), sharp where an object touches the water
  (ours: `k`, and a commercial SSPR plugin does the same).
- **Screen-space reflections:** only reflect what is in the frame; poor at grazing angles
  and on rough surfaces. Cliffs and trees above the frame's top edge, and anything behind the
  camera, would drop out of the mirror, so this doesn't fit our close views.
- **Filtering the roughness, not the geometry** (Bruneton, Neyret & Holzschuch 2010): the sea
  is one hierarchy: geometry near, normals in between, a BRDF (slope distribution) far, so
  waves too small to draw still widen reflections and glitter, with no visible jumps. Their sky
  reflection is filtered over an ellipse set by the slope distribution. LEAN mapping (Olano &
  Baker) keeps the first two moments of slope in mipmaps for this; Ubisoft uses it on their
  ocean. Ours already does this for the sky and the sun (mipmapped slope moments → `alpha`).
- **Anisotropy:** a Beckmann/GGX lobe made elliptical by the view gives vertical streaks; a
  mip lookup can't, so streaks need a few taps along the vertical *(general)*.

## 5. What the code does today (2026-11-08)

`ocean.ts` lines ~527–552, `scene.ts` ~920–939:

1. **Wave shift is far too small.** `uv = base + N.xz * 0.04 * k` moves the lookup by 0.04 of
   the screen per unit of slope. A real tilt β turns the ray 2β radians; across a mirror
   camera with vertical field of view φ that's Δuv ≈ 2β·k/φ *(my working)*. With a 63 mm lens
   (φ ≈ 0.38 rad) that's ~5.3 per unit slope, about 130× more, and it should depend on the lens.
2. **The blur counts only the unresolved waves.** `alpha` is the slope variance of waves too
   small to draw (plus capillaries, rain, rips). Near the camera the drawn waves carry most of
   the slope, and they only shift the lookup (item 1), so a 15 m/s sea still holds a crisp
   island. The spread that matters is the full Cox–Munk one: drawn and unresolved together.
3. **Isotropic blur** (one `textureLod`): round smudges where the physics gives vertical streaks
   (§1.3). Skipped on 10-31 as not worth the taps; the fix for items 1–2 makes it matter more.
4. **The 5 km cutoff** (`userData.distant`, `islands.ts`, `landforms.ts`) stands in for the
   missing haze (§2).
5. **Wet sand and pools** reflect only the sky (env map). Pools and the swash film should also
   mirror rocks, cliffs and people (`planarMap` is already rendered; terrain could read it).
6. **Fixed in 0.130 (ripple layers, arch/OCEAN.md "Short waves"). Was: the waves were too smooth for any of this to follow the wind** (measured 2026-11-08,
   plans/REFLECTION.md phase 0): drawn + unresolved slope variance is 6–25% of Cox–Munk on
   2003-03-11 (0.005 vs 0.080 at 15 m/s). The spectrum stops at ~8 cm waves, JONSWAP's tail
   saturates near 0.018, and `seaDevelopment` scales the short waves too. Real seas get most of
   their slope from 1 mm–10 cm waves that follow the wind.
7. **Local calm**: `shelter.ts` (fetch-limited calm), `slick` (ship wakes) and `gust` (fbm)
   already change the waves. Once the reflection follows the full slope spread, they'll give
   mirror patches in the lee and glassy wake streaks for free.

## 6. Next steps (a sketch for a plan)

1. Haze the reflection over t: apply the aerial-perspective transmittance and inscatter for
   the island → water path in the ocean shader (the depth texture gives t). Then drop
   `distant` from the reflection's `hide` list (keep it for the sky-only cloud events, if they
   need it).
2. A physical spread: take the total slope variance (resolved over the pixel + unresolved),
   turn it into an angle (2·atan(σ/√2)), then into texels of the mirror target with the lens's
   φ, scaled by k. Use it for both the shift and the blur.
3. Streaks: 3–5 taps along the screen's vertical, sideways blur × sin γ.
4. Check against §1.2: on a 15 m/s day, the islands leave only a faint darkening; on a calm day
   (`swellHeight` small, wind < 2 m/s, `params.mjs --where`), a sharp image. Use `diff.mjs` with
   the reflection pass off, on a clear and a cloudy sky.
5. Later: pools and the swash film read `planarMap`; melt ponds on summer sea ice.

## Sources

- Cox & Munk 1954, *Measurement of the roughness of the sea surface from photographs of the
  sun's glitter*, JOSA 44: https://data-ww3.ifremer.fr/BIB/Cox_Munk_JOSA1954.pdf; the slope
  fits as quoted by Mobley, Ocean Optics Web Book "Cox-Munk sea surface slope statistics":
  https://oceanopticsbook.info/view/surfaces/cox-munk-sea-surface-slope-statistics; slick fits
  in Martin (DTIC ADA537951): https://apps.dtic.mil/sti/pdfs/ADA537951.pdf; validity range and
  later revisions: https://arxiv.org/pdf/2210.05456, Wu 1990
  https://data-ww3.ifremer.fr/BIB/Wu_RS1990.pdf
- Mobley, Ocean Optics Web Book, "The level sea surface" (n ≈ 1.34, R ≈ 0.021 at normal
  incidence): https://oceanopticsbook.info/view/surfaces/the-level-sea-surface
- Minimum wave speed and "sea like a mirror": https://arxiv.org/pdf/2107.04581; Hong Kong
  Observatory Beaufort scale:
  https://www.hko.gov.hk/en/education/weather/wind-and-pressure/00112a-Beaufort_Land_Sea_Criterion.html;
  photographers' wind limits (anecdotal):
  https://www.talkphotography.co.uk/threads/maximum-wind-speed-for-decent-reflections-on-water.706786/
- Natural slicks damp gravity-capillary waves: https://os.copernicus.org/articles/15/725/2019/os-15-725-2019.pdf
- Wind shadow length: https://www.surfertoday.com/windsurfing/what-is-a-wind-shadow,
  https://www.riggingdoctor.com/life-aboard/2021/10/1/p82t3xd1l8qgfywafnagdn72bsu981
- Elongated reflections, light pillars (van Wieringen 1947, Minnaert): https://core.ac.uk/download/216940196.pdf
- Shadowing at low grazing angles (radar; West 1997 via OSTI): https://www.osti.gov/biblio/532451
- Wet sand (Ångström; Lekner & Dorf 1988): https://www.wgtn.ac.nz/scps/staff/pdf/darkerwhenwet.pdf;
  moisture and beach sand reflectance, PLOS ONE 2014: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4226492/
- Melt ponds: Malinka et al. 2018, The Cryosphere 12: https://tc.copernicus.org/articles/12/1921/2018/;
  Perovich 1994 (specular peak on bare ice at 60° zenith):
  https://astronomicaltelescopes.spiedigitallibrary.org/conference-proceedings-of-spie/1750/0000/Light-reflection-from-a-sea-ice-cover-during-the-onset/10.1117/12.140681.full
- Glacier ice specular, wet ice darker: https://dx.doi.org/10.3189/1994AoG20-1-1-5,
  https://meetingorganizer.copernicus.org/EGU2020/EGU2020-2335.html
- Nilas and grease ice are matt: MANICE ch. 1,
  https://www.canada.ca/en/environment-climate-change/services/weather-manuals-documentation/manice-manual-of-ice/chapter-1.html;
  https://www.antarctica.gov.au/about-antarctica/ice-and-atmosphere/sea-ice/development-of-sea-ice/
- Bruneton, Neyret & Holzschuch 2010, *Real-time Realistic Ocean Lighting using Seamless
  Transitions from Geometry to BRDF*: https://hal.archives-ouvertes.fr/inria-00443630v3
- LEAN mapping (Olano & Baker 2010): https://userpages.cs.umbc.edu/olano/papers/lean/;
  Ubisoft's ocean: https://www.ubisoft.com/en-us/studio/laforge/news/5WHMK3tLGMGsqhxmWls1Jw
- Whitecaps: Monahan & O'Muircheartaigh 1980 via https://pmc.ncbi.nlm.nih.gov/articles/PMC6209970
  and https://researchportal.hw.ac.uk/en/publications/marine-condensation-nucleus-generation-inferred-from-whitecap-sim/;
  Beaufort descriptions: https://www.weather.gov/media/pqr/beaufort/beaufort.pdf
- Reference photos: Wikimedia Commons, listed in plans/REFLECTION.md
- Planar vs screen-space reflections, contact hardening: https://manual.notch.one/0.9.23/en/topic/reflections-a-practical-guide,
  https://www.fab.com/listings/62177197-5a1b-429d-8670-9cad724e3901
