# Sky, clouds, light

How the sky code works. What is drawn where and how often: [CLOUDS.md](../CLOUDS.md). Pitfalls:
LESSONS.md "Light and exposure", "takram sky, clouds, post", "Storms and sky objects".

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
  max(moonlight, 0.06)^0.5 (starlit 0.5, lit by a dim overhead light standing in for starlight
  and airglow), stars boosted as the night darkens (not in the reflection cube); moon disc at
  constant surface brightness, earthshine on crescents, umbra with copper glow (`moon.ts`); lunar
  eclipses dim the moonlight. `eclipse.ts`: the moon covers the sun; in totality the sky darkens
  to a horizon glow with corona and stars, no direct sun, sky light ×~0.01, no aerial-perspective
  inscatter, dim environment on props. Simplification: the scene has no real location, so
  off-path days show the eclipse as if on the path (partials at a random 30–85%).
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
- **Fog** (`fog.ts`): screen-space exponential-height fog from depth (closed-form optical depth,
  forward-scattering glow), before exposure. `pickFog` chooses it by climate on ~5% of days:
  *advection fog* (warm moist air over cold water: California and Chile in summer, Namib and
  Atacama nearly all year, North Sea, Newfoundland, Arctic in spring/summer; light wind, likeliest
  at dawn), *fog bank* offshore, *sea smoke* (very cold air over warmer water, polar winters, calm
  and clear). Inside fog the sun dims and the sea calms.
- **Light reaching sea and sand** (`shadow.ts lightReaching`): direct sun/moon (glitter, body,
  floor) = min(props' shadow map ±320 m, land shadow map to the horizon (`renderLandShadow`)) ×
  cloud transmittance from takram's cascaded cloud shadow map (exp(−(maxOpticalDepth + tail)),
  primed by `primeCloudShadow` because the sea is drawn once at frame 0). `weather.sunVisibility`
  stays as the overall dimming.
