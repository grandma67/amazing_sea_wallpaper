# Ocean and surf

How the water works. Heights and shore coordinates: [COAST.md](COAST.md) "Coordinates and
heights". Ships, wakes and ship lights: [PROPS.md](PROPS.md). Pitfalls: LESSONS.md "Sea and
surf".

- `spectrum.ts` (on `spectrumWorker.ts`): JONSWAP + swell on 3 cascades with `fft.ts`.
  `ocean.ts`: whitecaps, glitter, refracted surf in sets, shallows, caustics, foam, rain rings;
  `grid.ts`: polar grid to 120 km. `PropContext.seaLevel()` samples the FFT height on the CPU so
  things float on the actual waves.
- **Surf** (`ocean.ts` SURF_GLSL, mirrored and tested in `terrain.ts` `surfWave`,
  `surfBreakDepth`, `surfProfile`): offshore height 1.3 × `surfAmplitude` × sets; shoaling
  ×(L/2d)^¼ below depth L/2 (Green's law); breaks where it reaches γ·d, γ = 0.72 + 5.6 × slope
  (McCowan/Weggel), H = γ·d inside (bore). Profile averages zero over a cycle (crest ≈ 0.7 H,
  trough ≈ −0.3 H); face narrows 0.3 → 0.12 of the wavelength toward breaking, 0.06 broken, never
  below 2.5 grid cells or pixels. Waves re-form over the trough behind a sandbar. Roller foam and
  crest spray (`props/surf.ts`) follow the steepness. The surf zone (150–350 m, out past a reef's
  crest: `surfReach`) and shore foam (10–25 m) measure from `coast.waterline`.
- **Calm water** (`shelter.ts`, PLAN_BIOMES 6): `coast.shelter` (set only behind a reef; null
  otherwise) holds a `strength` (0..1), a reef/barrier `line` (an `s`: calm shoreward of it) and
  up to 4 `basins` (ellipses in shore coords), blurred over `blur` m (~1 swell wavelength, all on
  the calm side). `shelterAt` (TS) mirrors `shelter()` in `SHELTER_GLSL`. Per cascade
  (`cascadeShelter`): the longest × (1 − m), the middle × (1 − m (1 − chop)), the shortest
  untouched; `chop = chopFactor(fetch, wind, longest)` is fetch-limited JONSWAP (Hs ∝ √F up to
  the fetch whose peak reaches the middle cascade's longest wave, `cascadeSize[1] / 6`); fetch is
  the lagoon width behind a line or a basin's mean diameter. Both ocean shaders apply it next to
  `shallowDamping`, so slopes, Jacobian foam and whitecaps follow; `PropContext.seaLevel()` too.
  Surf: `surfIncoming` = sets × (1 − m) (TS: `surfWave(…, shelter)`), so waves past a reef re-form
  at 1 − strength; spray, `waveOnRock` (surf and open-sea crest) and shore foam (× 1 − 0.7 m)
  follow. Test with `params.coast.shelter` (`scenes/shelter.json`).
- **Short waves** (`spectrum.ts` `shortWaveVariance`, `rippleSlopeScale`, ocean.ts "Ripples";
  plans/REFLECTION.md phase 1, 0.130): the cascades stop at ~8.5 cm waves and their slope
  saturates near 0.018 (JONSWAP's tail), 6–25% of Cox–Munk on windy days, so glitter, sky
  reflection and mirror images ignored the wind. `synthesizeOcean` returns the drawn
  `slopeVariance` (and per cascade); the tail = ramp(1→3 m/s) × max(0, Cox–Munk(U) − drawn −
  0.0006) is drawn as two **ripple layers**: the finest cascade's B and C textures again at
  1/6.37 and 1/3.91 of its size, turned 0.83 and 2.27 rad, slopes scaled so the two carry the
  tail (each 1/√2), weighted `shortDamp · gust · (1 − 0.6 rain)` and slicked like the shortest
  cascade. Near the camera they add slope (glints, ripple texture); far off their mips add GGX
  variance. Slopes only, not the Jacobian (no foam). Computed per day from the day's own drawn
  variance, so an undeveloped sea's missing slope is made up by ripples (they follow the wind,
  not fetch); wave heights unchanged. **Light air:** the wind sea fades in from 0.6 to 1.6 m/s
  (`windWaveOnset`, Kahma & Donelan 1988's onset u* ≈ 2–5 cm/s; 0.131), and so does the
  0.0006 capillary floor (`windWaves`): JONSWAP's short waves don't shrink with the wind, so a
  0.5 m/s sea still spread reflections ±3–4°. Same switch. A flat variance term was tried first: a uniform grey sheet
  and a hazy glitter near the camera (LESSONS.md). Off: `passes.shortWaves`. 0% render time.
- **Rip water:** `ripWater(sa)` (COAST.md "Bars, rips, cusps") makes the water over a channel
  rougher (+GGX variance) with half the breaking foam.
- **Reefs:** `reefCover` gives the seabed `coralAlbedo` under water; white water over the crest;
  `surfReach` extends surf zone and spray out to it (COAST.md "Reefs").
- **Rocks in the sea:** `props/surf.ts` `waterRocks()` lists rocks cutting the surface;
  `waveOnRock()` compares the crest there (0.7 × surf height, or half the open sea's Hs) with the
  rock top → `breaks`. `ocean.ts setOceanRocks()` (nearest 48, `rockData`): collar foam, a lee
  trail, and for breaking rocks white water surging after each crest (cycle 0.2–0.85); spray
  bursts only when a crest is at a breaking rock (cycle 0.2–0.38). On rocky shores
  `edgeRocks()` adds the shore itself: every 6 m along the shore in view, where a steep face
  (≥ 0.35 rise over 5 m) meets today's water, a 3 m "rock" at the face, so the scarp, a cliff's
  foot or a boulder apron gets the same bursts, collars and lee trails. The surf breaks on the
  scarp by depth already.
- **Islands and big rocks** (`setOceanIslands`, `MAX_ISLANDS` = 4 nearest, apart from the 48 rocks;
  PROPS.md "Big rocks in the sea"): `islandData` (x, z, crest Hc, breaks) and `islandOutline`
  (32 radii each, 4 per vec4, linearly interpolated by angle: e = distance − R(θ), fine for the
  star-shaped outlines). Sized by the waves, not the radius: collar `exp(−(e/(0.8 + 1.5 Hc))²)`,
  ragged; seaward apron `3 Hc + 2` m when breaking (constant 0.5 surge: offshore crests come
  irregularly); lee trail `min(2.5 R, 20 Hc + 10)` m. Each band fades with its own width over the
  pixel footprint (not R). Outside the surf-zone block, so open-sea days get it too. Calm sea
  (Hc ≈ 0.1): a ~1 m broken line; from far it's the face's wash band (`props/wash.ts`) that reads.
- **Reflections** (`reflection.ts`, ocean.ts "Land, rocks, trees and boats mirrored"): the scene
  rendered from a camera mirrored in y = 0 (oblique clip at the water) into a half-res target
  cleared to (0,0,0,0), with a depth texture. Blended **premultiplied** (`reflected · (1 − a) +
  rgb`: the mips hold a·colour). Blur and wave shift scale with **k = t / (D + t)**, t the reflected
  ray's length past the water (from the depth, unprojected with the oblique `planarProjInv`; not
  `perspectiveDepthToViewZ`): sharp where an object meets the water, the full roughness blur
  (`log2(α·300)` mips) far up its face and on far land; rays that hit nothing keep k = 1.
  **Since 0.131 (`passes.reflectionRay`, plans/REFLECTION.md phase 2)** the lookup follows the
  reflected ray instead: `uv = planarMatrix · (P + R·t)`, P the sea point at y = 0, R reflected
  about the wave's own normal (`waveNormal`, before the face-the-viewer fix, which tilts a flat
  sea up to ~3° within ~3° of grazing and aimed every ray ~6° over the land), t = the mirrored
  ray's length past the water (miss: 1e5, a direction). A flat sea lands on the sea point for
  any t; a tilt β turns the image by 2β·t/(D+t) as the mirror camera sees it, lens included
  (`test/reflection.test.ts` against `mirrorCamera`). Blur: R tilted up by 2·atan(α/√2), α the
  unfloored roughness (`mirrorAlpha`: no 0.02 floor for the sun's size), the lookup's move in
  target pixels × 3.5 → lod (up to 9). Calm water mirrors sharply (bands where incoming waves
  tilt the surface, wiggly streaks under thin things); past ~3 m/s 2–6°-tall islands leave
  nothing, as photos show. With it off, the old nudge below.
  **Streaks (0.132, `passes.reflectionStreaks`, phase 3):** the blur runs along the streak (the
  lookup's move when R tilts up, × 3.5) and only × sin γ (≥ 1 texel) across it: three
  `textureGrad` taps along the streak on a target with anisotropic filtering
  (`texture.anisotropy` = the GPU's max, 16 in headless Chrome), up to ~48:1. The square mip blur
  had smeared a 50 px island ~250 px sideways and lost it; now light air (1.5–3.5 m/s) keeps a
  soft column under tall objects with pines as vertical streaks, and a storm's lightning a
  vertical glow. +1% render time. Explicit-lod lookups ignore the anisotropy (switch off is exact).
  The old blur is isotropic (one `textureLod`). Real reflections on a wavy sea streak vertically
  (≈ 1/sin(grazing) taller than wide), but anisotropic streaking was tried on paper and skipped
  (10-31): renders of `scenes/islands-water.json` (colony calm/rough, karst islands, iceberg) already
  read as vertical columns under each object, and `textureGrad` alone only blurs more both ways
  without anisotropic filtering, so it would need 3–5 vertical taps per sea pixel for slightly
  crisper column sides. (Superseded: with the 0.130 roughness the square blur lost whole
  reflections; the fix was turning anisotropic filtering on, above.)
  **Haze (0.133, `passes.reflectionHaze`, phase 4):** far land is mirrored (no 5 km cutoff; only
  `userData.skyLike` shelf and roll clouds are hidden, the cube mirrors clouds) and the image is
  hazed over its object → water leg (the main pass hazes water → eye): `T = exp(−(air +
  seaHaze·thin)·hazeT)`, `hazeT` from the mirror depth where the ray lands, `thin` takram's 1 km
  scale height averaged over the rise R.y·t, uniforms from `seaHaze.ts` `reflectionExtinction`.
  It fades toward `skyReflected` (the cube along R): land lost in haze leaves the sky reflection.
  The sea haze's inscatter is weighted (1 − T)², matching takram (it mixes an opacity-scaled
  colour by the opacity again); the air's (1 − T). Off: the `distant` cutoff, as 0.132.
- **Ships in the ocean shader:** `setOceanShips` (8 nearest) cuts the hull out of the sea and adds
  the Kelvin wake, foam and slick (PROPS.md "Ships").
- **A frozen sea:** the ocean shader doesn't know. A floating sheet covers it (PROPS.md "Sea ice") and it runs calm below,
  showing through leads and past the ice's edge.
