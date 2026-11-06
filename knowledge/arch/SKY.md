# Sky, clouds, light

How the sky code works. What is drawn where and how often: [CLOUDS.md](../CLOUDS.md). Pitfalls:
LESSONS.md "Light and exposure", "takram sky, clouds, post", "Storms and sky objects".

- **The real sun** (`celestial.ts`, PLAN_BIOMES 12): `solarDeclinationDeg(date)`, `sunLimits(lat,
  date)` (noon 90° − |φ − δ|, midnight |φ + δ| − 90°) and `sunAzimuthDeg` (compass bearing for an
  elevation, morning or evening). From `REAL_SUN_LATITUDE` (63°) the time-of-day weights and the
  elevation follow them (`timeWeights`, `sunRange` in `params.ts`); midnight-sun days face the
  real bearing; polar-night days lose solar eclipses. Titles: "Polar night", "Polar night
  twilight", "Midnight sun". Renders: `scenes/sun.json`.
- `scene.ts`: atmosphere, env cube, post. `exposure.ts` meters a 32² sky cube (auto exposure).
- **Clouds** (`clouds.ts`, `cloudTypes.ts`): WMO genera and species (each has its `genus`);
  `pickFormations` draws one per étage, `pickSpecies` (own stream) refines and adds fractus,
  scud and duplicatus, ≤ 4 layers; `layerChannels` gives an étage's second layer the weather
  map's spare channel `a` (fine Perlin) so it doesn't mirror the first; storms:
  `stormFormations`. `cloudArrangement.ts` patches the weather-map lookup with a 2×2 transform in
  cube-sphere uv, so streets/bands follow `weather.arrangement.headingDeg`;
  `stabiliseCubeSphereUv` rewrites takram's u in a cancellation-free form.
- **Storms:** `stormCells.ts` raises the Cb layer's weather to full (density ×3 in the core) in a
  cell (r ≈ 3.5 km + 10% of distance) over each bolt and rain curtain, in the clouds, shadow and
  env-cube passes. `stormEffects.ts`: rain shafts, lightning flash (fixed scene radiance
  `FLASH_RADIANCE`: invisible by day, a glow by blue hour), lens rain, rainbows. Bolts strike
  3–9 km out, ribbons widened across each segment toward the camera, forks head down.
- **Sky-shader features** (patched into takram's sky: functions before `getSkyRadiance(`):
  `eclipse.ts`, `contrails.ts`, `noctilucent.ts`.
- **Moon and eclipses:** `celestial.ts`: phase law (Allen's magnitude fit: half moon ~1/10 of
  full), disc-overlap geometry, `eclipseOn(date)` (real peaks; penumbral lunar left out).
  `params.ts` sets `nightSky` (moonlit/starlit; moon down 20% of nights or new → starlit),
  `moonlight`, `eclipse`, `sunScale` (sun and moon 3× on solar eclipse days), and frames eclipses
  (24–35 mm, more sky, sun/moon low ahead; clear or cirrus, total under clear). The moon by day is
  framed with the sun on ~35% of days with the moon > 15% lit. `scene.ts`: night exposure ×
  max(moonlight, 0.06)^0.5 (starlit 0.5: a stand-in sun overhead draws the sky only; the ground
  gets the night's 0.002 lux as diffuse sky light and props an ambient light, no direct light).
  **Stars** (`starLight.ts`, `stars.ts`, NIGHT_SKY phase 2) carry their real light whenever the
  sun is down: irradiance `starScale × 10^(−0.4 m)` in render units (one unit ≈ 75,700 lux; the
  light drawn at the sun's strength is the sun, the moon at its phase, or on starlit nights a
  stand-in whose zenith, `STARLIT_ZENITH`, is taken as 21.6 mag/arcsec²), × the air's
  transmittance, spread over a lens point spread (Gaussian core σ 0.6 px at 1080p, 4% halo for
  stars brighter than 2.5; `psfWeight` mirrors the GLSL), ÷ the pixel's solid angle (cos³ off
  axis), added to the sky (additive, so sky patches stay under them); the same in the
  reflection cube (per texel, no spread). Stars are turned by the
  sky clock (`skyClock.ts` `skyRotation`: the real sun for the date's J2000 direction is put on
  the scene's sun via the hour angle for its elevation at the latitude, then a turn about the
  vertical; impossible elevations clamp the hour angle, keeping the pole exact; the moon stays
  within 5° of the ecliptic, `eclipticOffset`, on either side of the sun); moon disc at
  constant surface brightness, earthshine on crescents, umbra with copper glow (`moon.ts`); lunar
  eclipses dim the moonlight. `eclipse.ts`: the moon covers the sun; in totality the sky darkens
  to a horizon glow with corona and stars, no direct sun, sky light ×~0.01, no aerial-perspective
  inscatter, dim environment on props. Simplification: the scene has no real location, so
  off-path days show the eclipse as if on the path (partials at a random 30–85%).
- **Night glow** (`nightGlow.ts`, NIGHT_SKY phase 3): `nightGlowFor` (stream `'night-glow'`,
  whenever the sun is down) draws the airglow (zenith S10 by the solar cycle × a nightly spread,
  red share, bands) and takes the place's Bortle class (`places.ts` `BORTLE`). `patchSkyNightGlow`
  patches the main sky **and the env-cube sky** (smooth terms; the sea reflects them), after the
  other patches so its line runs first: Milky Way (`milkyway.png`, galactic, log2 S10 over
  [−2, 12]; ECEF → world → ECI (sky clock) → galactic), zodiacal light (Leinert table resampled
  every 5°, a half-float texture; the real sun's ecliptic longitude via the sky clock), airglow
  (van Rhijn shells at 95 and 250 km, bands fading overhead), all × transmittance; + (1 − T) ×
  (airglow + 120) in-scatter; + light pollution (zenith by class, domes inland and ±75° along the
  coast). × `glowScale` (render units per S10 for the night's light, `renderPerLux`). Starlit
  nights: replaces the Bruneton stand-in (`glowReplace`); otherwise added. Ground rays keep the
  sky's own ground.
- **Meteors** (`meteors.ts`, NIGHT_SKY phase 4): `meteorsFor` (stream `'meteors'`, night only,
  after the night glow for its Bortle class) from `meteorRates` (showers by solar longitude and
  sporadics by local hour, × camera limit, × `frameShare`, × 4 h) and the weather's clear share;
  paths from `meteorPath` (through a point in the frame's sky, along the great circle away from
  the radiant, trimmed to the frame with `skyFrame.ts`, the render camera's own projection). `patchSkyMeteors`: main sky only, segment on the sphere in ECEF, Gaussian across
  (1.3 × the stars' core σ), `meteorProfile` along, × transmittance, in the stars' units
  (`starScale` × flux × duration / exposure ÷ length).
- **Planets** (`planets.ts`, NIGHT_SKY phase 5): `planetsIn` = astronomy-engine J2000 directions
  and magnitudes at noon UTC, turned by `skyRotation`; `params.planets` whenever the sun is
  down (spec `planets: false` none). Drawn by a second `createStarsMaterial` (main scene only,
  world-frame records from `planetStarData`, `magnitudeRange` −6…+4). Brighter than
  `GLITTER_MAGNITUDE` (−2.5) and up: an ocean lamp at 10⁷ m with intensity = irradiance ×
  `extinction` × r² (slots taken from the ships' 12). Venus framing in `params.ts` step 5
  (`'planet-framing'`, before the midnight-sun heading and the moon).
- **Aurora** (`aurora.ts`, NIGHT_SKY phase 6): `auroraFor` (stream `'aurora'`, step 5) takes the
  place's geomagnetic latitude (`AURORA_SITES`, dipole pole, −2.5° over Europe), a session Kp
  (`kpFor`: NOAA storm days × solar cycle × `stormSeason`, the equinox peak) and the oval (`ovalEdge` 67 − 2 Kp, `ovalWidth` 7 + 1.5
  Kp, low arcs `ARC_REACH` 4° beyond): under it `overhead`, beyond it `arc`. It returns up to four
  arcs as km poleward of the camera (the first where the frame looks, its base 8–18° up),
  strength (kR column of the brightest arc), red and type-B border luminance shares, the storm
  red glow (`redGlowKR`, uniform `auroraF.x` as a share of the strength), patchiness, folds
  and `frameTurnDeg` (sun and moon turned so the display stands ahead). Aurora nights shoot
  14–24 mm with more sky (`'aurora-framing'`). `patchSkyAurora` patches the main sky and the env
  cube (the sea mirrors it) before the night glow, so it adds to the night sky: 28 layers
  92–320 km, each sampling at its field line's foot (x + (h − 110)·cot dip, `auroraF.y`) the folded sheets (widened to the samples' step), rays (faded to
  their mean past half their period; red on its own 60 km sheet, the border on the brightest
  arc's soft sheet only), the diffuse glow inside the oval, the storm red glow
  (`redGlowShape`: 450–150 km equatorward of the oval to its poleward edge, fading poleward), with each emission
  profile averaged over the layer (erf); one layer offset per pixel (interleaved gradient
  noise); × transmittance, in kR × `auroraScale`. **`auroraRay` is the same march in
  TypeScript**: change both together; tests and `auroraLux` (the ground light, the march
  integrated over the sky, an ambient + sky irradiance) use it. Metered without it; +1.5 EV.
  `patchCloudsAurora` adds the display to takram's clouds pass as a second light (direction of
  the brightest arc, irradiance from `auroraCloudLight`, 3-step optical depth toward it,
  takram's multiple-scattering phase; pass `auroraClouds`).
- **CPU mirrors of sky shaders** (`skyMirror.ts`): `auroraRay` and `nightGlowS10` (with
  `airglowPattern`, term by term) compute what the shader draws toward a world direction, in the
  same frame (world +x north, +z east: takram's north-up-east anchor; the aurora's along-arc axis
  is `cross(up, pole)`, 90° left of the pole), with takram's RGB transmittance
  (`airTransmittance`: Rayleigh 8 km, Mie 1.2 km, ozone 10–40 km) and the shaders' own integer
  noise hash (`hashGlsl`/`hashCell`, PCG, bit for bit). `lineDirections`, `mirrorLine` and
  `lineStats` read them along lines; `params.debug.probeLine` reads the render on the same lines
  (tools/DEBUG.md). Change a shader and its mirror together, then compare one line of each.
- **Marine layer** (`coastalWeather.ts`, PLAN_BIOMES 3): `marineLayerFor` on stream
  `'marine-layer'` from `MARINE_LAYER` (place × local month) on morning golden hour, sunrise and
  daylight. After the eclipse fix-up the day turns overcast (coverage 0.75–0.82) with one stratus
  or stratocumulus layer (stream `'marine-layer-deck'`), wind ≤ 6 m/s, no storm, title "marine
  layer" (`weather.marineLayer`). A forced `weather`/`clouds`, or an eclipse, wins unless
  `spec.marineLayer` is true.
- **Harmattan** (`coastalWeather.ts` `dustFor`, stream `'dust'`; PLAN_BIOMES 3): West Africa
  Dec–Feb on half the days, `weather.dust = 'harmattan'`; no storm or rainbow. `visibilityFor`
  draws 2–10 km (floor 2 km instead of 5). The haze takes the sky's horizon colour in every
  direction (`hazeFromHorizon`) × ochre `hazeTint`. The sun is dimmed and reddened by
  `dustTransmittance` (Koschmieder extinction over a 1.2 km layer × airmass, blue ×1.3, red ×0.8)
  and `dustSkylight` gives 60% of what it lost back as tinted diffuse light. Clear dust days run
  the clouds pass for the haze, with one empty 4 km layer (takram ends haze rays at the highest
  layer's top): ~+1 s on those days.
- **Sea haze** (`seaHaze.ts`): `visibilityFor()` (own stream) draws visibility log-uniform by
  biome (polar 40–90 km, nordic 40–80, tropical 35–65, Mediterranean 35–70 and 25–50 in summer,
  desert 12–35, dust episodes 8–20); less in strong wind (sea salt), overcast and storms, more
  after showers. `applySeaHaze()` patches takram's clouds-pass haze: density 3.912/V minus the
  Bruneton air's own, no coverage switch-off, colour = the sky behind the ray (just above the
  horizon for rays at or below it) × `hazeLight(weather)`. Covers sky, clouds and scene, so far
  clouds and islands fade into the horizon. Only on days with clouds (clear days have no clouds
  pass) and clear dust days.
- **Fog** (`fog.ts`, layer shape in `fogLayer.ts`): screen-space fog from depth (closed-form
  optical depth per ray, `FOG_LAYER_GLSL` mirrored by `fogRayDepth`; forward-scattering glow),
  before exposure. **Advection fog has a lid** (an inversion): density σ up to `base`, then
  exp(−(y − base)/fade) above, with fade = max(2, 0.1 × height) and base + fade = `fog.height`, so
  a column still holds σ × height. Its top billows (±12% of the height, swells of ~400 m and
  billows of ~120 m, `billows`), and seen from above the slopes are shaded by the sun's cosine to
  the tilted top (`facing`, 0.25–2 × the flat top): a camera above the top (open-sea and
  overlook eyes at 40–160 m) sees a sea of fog with islands, mountains and a clear sky above it.
  Sea smoke keeps the exponential (base 0, fade = height). The lighthouse beams use the same
  profile. **The sun's dimming by the fog above the eye** (`fogSunTransmittance`) is applied in
  `renderScene` from the camera's real height (it scales `weather.sunVisibility` there, for the
  light, the sky's sun disc, the gloom grade and the clouds pass); `params.ts` no longer dims the
  sun for fog, as the eye's ground isn't known there (`terrainHeight` would be an import cycle). `pickFog` chooses it by climate on ~5% of days:
  *advection fog* (warm moist air over cold water: California and Chile in summer, Namib and
  Atacama nearly all year, North Sea, Newfoundland, Arctic in spring/summer; light wind, likeliest
  at dawn), *fog bank* offshore, *sea smoke* (very cold air over warmer water, polar winters, calm
  and clear). Inside fog the sun dims and the sea calms.
- **Light reaching sea and sand** (`shadow.ts lightReaching`): direct sun/moon (glitter, body, crest glow,
  floor, foam; `sunReaching` in `ocean.ts`) = min(props' shadow map ±320 m, land shadow map to the horizon (`renderLandShadow`)) ×
  cloud transmittance from takram's cascaded cloud shadow map (exp(−(maxOpticalDepth + tail)),
  primed by `primeCloudShadow` because the sea is drawn once at frame 0). `weather.sunVisibility`
  stays as the overall dimming.
