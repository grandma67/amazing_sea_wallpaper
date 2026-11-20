# Sky, clouds, light

How the sky code works. What is drawn where and how often: [CLOUDS.md](../CLOUDS.md). Pitfalls:
[lessons/LIGHT.md](../lessons/LIGHT.md) "Light and exposure", [lessons/SKY.md](../lessons/SKY.md).

- **The real sun** (`celestial.ts`, PLAN_BIOMES 12): `solarDeclinationDeg(date)`, `sunLimits(lat,
  date)` (noon 90° − |φ − δ|, midnight |φ + δ| − 90°) and `sunAzimuthDeg` (compass bearing for an
  elevation, morning or evening). From `REAL_SUN_LATITUDE` (63°) the time-of-day weights and the
  elevation follow them (`timeWeights`, `sunRange` in `params.ts`); midnight-sun days face the
  real bearing; polar-night days lose solar eclipses. Titles: "Polar night", "Polar night
  twilight", "Midnight sun". Renders: `scenes/sun.json`.
- `scene.ts`: atmosphere, env cube, post. `exposure.ts` meters a 32² sky cube (auto exposure).
- **The frame's own meter** (`frameMeter.ts`, SHADOWS.md phase 6): after the frames are averaged and
  before bloom, `FrameMeterPass` reads the exposed frame's median luminance (160×90 blocks) and
  lifts it to a floor if it's under it (`frameBoostRule`): nights under broken or overcast cloud to
  0.03 (~×8 on a typical one, up to 6 stops), storm nights too (0.187: metered with the flash's
  light off, then drawn again with it at the power for the boosted shutter, `setFlashScale`; the
  rain's floor follows the boost, `setRainBoost`); sun-up days without a storm to 0.10 (≤ 1.5 stops,
  ~1 day in 60: beaches in deep shade). Open nights (stars and glitter carry them though their median
  is as low), blue hour and storms by day are left alone. `debug.frameMedian`, `frameBoost`;
  `debug.exposure` is the total (pin it: `--keep-exposure`, then no boost). Off: `passes.frameMeter`.
- **The long exposure** (phase 6 step 2): `shutterSeconds` is what a photographer at f/2.8, ISO 1600
  would use (0.061 / L for mid-grey, scaled to the frame's final level): ~30–130 s on cloudy nights.
  Only where the boost applies at night (stars hidden; with stars a photographer keeps under the
  500 rule): the first frame is metered, then if `longExposureLook` (0 under 0.5 s, 1 past 30 s) is
  above 0 the still and the accumulation restart with the sea averaged over the shutter (normals
  flattened ×0.85, roughness ≥ 0.3, foam lace to a haze) and the clouds moved on along the wind
  (~2× the surface wind, estimate) frame by frame (`cloudDrift`): soft streaks over the averaged
  frames. +5% render time on those nights (one extra frame). `debug.shutterSeconds`,
  `debug.longExposure`. Off: `passes.longExposure`.
- **Props and ground under the same night sky** (`passes.nightSkylight`): the env cube holds airglow,
  the Milky Way, the aurora and the moon's (enlarged) disc as well as the clear sky, so props got
  1.35–3× the ground's sky light at night (palms bright green on a dark beach once opened up). At
  night the cube is dimmed to the ground's `skyIrradiance` (`scene.environmentIntensity`), a starlit
  night tops props up to it (the ambient light), the aurora's own ambient is dropped (it's in both),
  and moonlit cloud nights get the cloud skylight ratio, as days do.
- **Clouds** (`clouds.ts`, `cloudTypes.ts`): WMO genera and species (each has its `genus`);
  `pickFormations` draws one per étage, `pickSpecies` (own stream) refines and adds fractus,
  scud and duplicatus, ≤ 4 layers; `layerChannels` gives an étage's second layer the weather
  map's spare channel `a` (fine Perlin) so it doesn't mirror the first; storms:
  `stormFormations`. `cloudArrangement.ts`: bands patch the weather-map lookup with a 2×2 transform in
  cube-sphere uv (stretched across `weather.arrangement.headingDeg`); streets keep the cells
  unstretched and multiply the main layer's (layer 0, `localWeather.x`) weather by a row mask
  across the wind (`streetFactor`, mirrored in `cloudStreet`: ×0.45 gap, ×1.55 row, spacing
  `STREET_ASPECT` 3 × the layer's top, ±15% wander; the rows don't drift, the cells drift along them);
  `stabiliseCubeSphereUv` rewrites takram's u in a cancellation-free form.
- **Storms:** `stormCells.ts` raises the Cb layer's weather to full (density ×3 in the core) in a
  cell (r ≈ 3.5 km + 10% of distance) over each bolt and rain curtain, in the clouds, shadow and
  env-cube passes. Cells are found from each sample's world position (captured where takram reads
  its uv, as `cloudShapes.ts` does), never through the weather map's uv: that put them kilometres
  off (0.215). Under and in a cell the sky light is ×`STORM_SKY_LIGHT` (0.25): takram lights a
  sample by its height in its own layer, not by the cloud above it, so a Cb base was as bright as
  the deck. `stormEffects.ts`: rain shafts, lens rain, rainbows (the flash's light is
  in the clouds: `lightning.ts`, below; the screen-space `FlashEffect` went in 0.186). Bolts strike
  3–9 km out, ribbons widened across each segment toward the camera, forks head down.
- **Where a flash starts** (`lightning.ts`, plans/CLOUD_ILLUMINATION.md phase 1): in the storm's
  main negative charge, at the −15 °C height (`CHARGE_HEIGHT_M`, climate × season: ~7 km tropical,
  5.5 km temperate summer, 2.4–3 km winter storms), 0.5–3 km sideways of where the bolt leaves the
  base (`params.storm.origins`, stream `'lightning'`, spec `lightning`). `lightningFor` gives the
  channel inside the cloud (sideways at the origin's height, then down to the exit, 1–3 branches),
  kept inside its storm cell's core (`boltCell`: the cell sits between strike and origin, widened by
  half the offset), and 6 light points along it (the exit carries 30%). The bolt mesh draws the
  in-cloud channel too; the clouds composite over it, so it shows only where the cloud is thin.
  The planar mirror has no volumetric clouds, so there the bolts are clipped at the Cb's base
  (`renderPlanarReflection` clip, 0.217).
- **The cloud lit from inside** (`lightning.ts` `patchCloudsFlash`, phase 3; `passes.flashLight`):
  - one camera rule for every hour: `ambientCd` (the luminance the exposure puts at mid-grey) →
    `flashShutter` (f/8, ISO 100–3200, ≤ 30 s) → `flashPower` (lm caught ÷ shutter);
  - 6 lights per bolt (`lightningFor`): 4 along the in-cloud channel, 2 low at 150 and 450 m above
    the Cb base (35% of the light: they set the patch round the exit);
  - in takram's `marchClouds` the kernel `flashGlowCd` (P·c/(4π² r²)·e^(−r/4 km), c = |Δy|/r ≥ 0.3)
    is taken once where the ray first meets cloud at or above the Cb base, carried along the ray,
    × the sample's scattering, after the powder term; in the frame and the env cube (the sea
    mirrors it);
  - measured on 2026-11-02 (bolt 3.2 km): +37% at the exit by day after 17 km visibility's haze
    (0.49 over 3.1 km); the mirror agrees within 10%;
  - **the land** (phase 5, `passes.flashGround`): half the light leaves through the base, a
    Lambertian lamp at each exit (`flashGroundLights`, I = P/2/π): a term in the terrain shader and a
    `PointLight` per bolt for the props, no shadows; the sea mirrors the cloud. Storm nights keep the
    boost metered with the flash off (`FrameMeterPass.held`), so the flash adds to the ambient
    exposure as in a photo; ~3× starlight on a beach 5 km from a bolt, invisible by day;
  - **the shelf is part of the face** (0.222, `passes.flashShelf`): on shelf days a sample that
    is mostly the shelf's layer (`media.weight` > 0.5) starts the face too, below the Cb base; scud
    still doesn't. Without it a night shelf in front of the flash stayed a dark flat band
    (2026-08-20, 2026-03-27);
  - `passes.flashLight: false`: no flash light (0.185 kept the old screen-space glow under it;
    removed in 0.186 with the ocean's own glow term).
- **The shelf cloud** (`shelfCloud.ts`, plans/SHELF_VOLUMETRIC.md; 0.174–0.177): drawn by takram's
  clouds, not a mesh. On shelf days `createClouds` appends one layer (index `formations.length`,
  a free texture channel; shelf days have at most 3 layers) whose density is `shelfDensity`: a
  wedge in a frame along the gust front (lip, receding face with local tiers and striations,
  rising underside, top 300 m into the Cb's base), at each sample's exact world position. The Cb
  is filled over it. The GLSL is written from `SHELF_SHAPE` with the TS mirror's steps;
  `params.debug.shelf: {tiers: false, …}` zeroes a term on both sides; `lipElevationAhead`
  predicts where the lip shows (`scripts/edges.mjs` reads it off a `probeLine`). Placement:
  `skyEvents.ts` `placeShelf` keeps rain and bolts in its direction behind the lip.
- **The Morning Glory** (`rollCloud.ts`, 0.180): the same way as the shelf, one more layer on roll
  days (at most two layers there) whose density is `rollDensity`: per roll an ellipse across the
  tube, base flattened, axis wandering, the radius lumped along and round it (the billows: takram's
  noise can't make them inside a saturated density), a sharp edge on the camera side and a soft
  one behind. Its own height fraction lights it (a standalone cloud, brighter on top). Clear days
  load the cloud assets when there's a roll. The GLSL skips samples beyond a tube's widest lump
  (+45% → +22% on roll days).
- **A new cloud shape in the volumetric clouds** (the shared base: `cloudShapes.ts`; the shelf and
  the Morning Glory are built on it). Check each before the first render; every item cost a round
  on one of them:
  1. **One layer, density set before `return`** (`patchCloudShape`, `setLayerDensity`), its
     position read at the uv capture (`<prefix>World()`), never through uv.
  2. **Soft edges ≥ ~0.12 of the radius** (or ≥ 20 m for a sharp lip, with the edge at density
     0.25, `VISIBLE_DENSITY`): takram doubles the density, so a thinner edge leaves its shape
     noise nothing to bite (shelf: straight bands; roll round 1: a smooth slab).
  3. **Detail moves the surface, not the density** (a radius or a face position): inside, the
     density is saturated. Small-scale waves of more than a few % of the size read as hills.
  4. **An early exit and its test from the start**: skip a sample's noise where the density is
     surely 0 (above the top, past the ends, beyond the widest lump); a CPU test that the density
     is 0 past the bound. Without it: shelf 11 s renders, roll +45%.
  5. **Whose height fraction lights it:** its own layer (a standalone cloud: brighter on top), or
     the deck it belongs to (the shelf: the Cb's, or it reads as sky).
  6. **Clear days skip the cloud pass:** load the cloud assets when the shape is there.
  7. **Terms and switches:** every detail term's amplitude in the constants object, listed in a
     `*_TERMS` table, switchable with `params.debug.<shape>` (`withTermsOff`): an artifact is found
     by switching terms off one by one, before a second guess.
  8. **Measure before looking:** `bench.mjs --ref HEAD` (10%), and `edges.mjs` on a `probeLine`
     against the CPU's prediction (parity, sharpness, brightness against what's above and below).
- **takram's clouds, from the inside** (`three-clouds` 0.7.6, `src/shaders/clouds.glsl`,
  `clouds.frag`; found building the shelf, each cost a round):
  - `localWeather`, `weather.density`, `heightFraction` and `shadowLayerMask` are vec4s indexed
    by **layer** (`'xyzw'[i]`); a layer's texture channel only picks the colour it reads.
  - `sampleWeather` remaps `localWeather` by `coverage` (`factor = 1 − coverage × heightScale`):
    a value set there is thinned on days under full cover. A density meant as is goes into
    `weather.density` just before `return` (as the shelf's); a "fill the deck here" goes into
    `localWeather` (as `stormCells`).
  - `sampleMedia` doubles the density before the detail noise (`remapClamped(density * 2.0, …)`):
    an edge shows where a soft density is ~0.25, not 0.5 (`SHELF_VISIBLE_DENSITY`).
  - Sky light on a sample is `skyIrradiance × (0.5 + 0.5 × heightFraction)` of **its own layer**:
    a thin layer sitting under a deep one is lit far brighter than that deck's base (the shelf
    took the Cb's height fraction to fix it, 0.176).
  - Every `sampleWeather` call follows `vec2 uv = getGlobeUv(position);` (`clouds.frag` ×2,
    `shadow.frag` ×1), with ECEF `position`; `ecefToWorldMatrix` and `altitudeCorrection` are
    declared before `clouds.glsl` (`parameters.glsl`). A patch can read the sample's world
    position exactly instead of inverting the uv.
  - The cube-sphere uv has seams on cube edges, and our scenes sit at longitude 0, so latitude
    ±45° lies on one: a linear uv → metres map across it went ~90° wrong (as seen from the camera).
- **A light inside or under takram's clouds** (lightning, town light; CLOUD_ILLUMINATION phases
  3 and 7, about 10 render rounds lost before these were known). Check each before the first
  render:
  1. **Positions:** the march's `position` is ECEF − `altitudeCorrection`: convert the sample to
     the world as `cloudShapes.ts` does (`ecefToWorldMatrix * (position − altitudeCorrection)`),
     pass lights in world coordinates.
  2. **takram's clouds are optically thin over kilometres** (a real Cb: tens of metres). A
     light's term added at every sample averages over km of depth: an even faint lift. Take its
     value once at the cloud's **face** (the first sample, or the first in the right layer) and
     carry it along the ray, × `media.scattering`.
  3. **Is there cloud where the light is?** `debug.cloudFace` (face height and distance per
     probe) before reading any glow: a far bolt can have no Cb over it.
  4. **Mirror first:** compute the face value with the TS mirror on the probed ray's own face
     point (`params.mjs --project storm` lists base points and per-10⁹-lm glow) before comparing
     a render with expectations.
  5. **What the march and haze pass on:** a fixed face value (`debug.flash.constant`) measures it
     (2026-11-02: ×0.45–0.62, the haze's 0.49 at 3 km): don't blame the kernel for the haze.
  6. **Which `#define`s run:** before moving a term past one (`POWDER`), check it's defined.
  7. **Depths from the drawn cloud's base**, not from where a mesh starts inside it.
  8. **The frame meter re-reads the last frame** (`FrameMeterPass`): a boost meant to exclude a
     light has to be held (`held`), or the last frame's reading, with the light in, wins.
  9. **`new Vector4()` pads with w = 1**: pad uniform arrays with explicit zeros.
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
- **Town light on cloud bases** (`nightGlow.ts` `patchCloudsTownLight`, CLOUD_ILLUMINATION phase 7;
  `passes.townLight`): on Bortle 3–4 nights a cloud's face (the first cloud a ray meets in takram's
  march, carried along it like the flash) is lit from below at 2.8 × the clear sky's artificial
  zenith (Kyba 2011, 32 km from Berlin), up to ×3.6 toward the dome (`townFace`), sodium/LED
  orange; in the frame and the reflection cube. Measured: an overcast Bortle 4 night's deck
  2.3× the artificial zenith overhead (target 2.8 before the haze's share).
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
- **The fine slice** (`shadow.ts fitFineShadow`, 4096²): a second directional light with no light of its
  own (black, intensity 0, added after the sun so three lists it second) whose shadow camera is fitted
  to the view's first 40 m, cut to 3 m below the ground (or the sea) and 30 m above it: 0.8–1.0 cm a
  texel against the near map's 15.6 cm. The sea and terrain read it in `sunShadow`, props in
  `propShade.ts` (light 0's shadow mixed with light 1's); both fade into the near map over the slice's
  outer 8%. Offsets are in metres per map (`shadowBias`, converted to each map's depth units): 0.13 m
  on the near map, ≥ 8 cm on the fine slice for the sea and terrain (the terrain casts through a coarser
  mesh than it draws, and they differ by cm over ripples), and for props 1.5 texels scaled by the slope
  to the sun (tan, up to 8) from the face as lit, with no normal offset (three's takes the unflipped
  normal on double-sided blades and fronds). Depth is 24-bit: 6490 m resolves to 0.4 mm, so the depth
  range didn't need narrowing. Render time +0–1%.
- **What casts in the near map** (±320 m, 4096²): every solid prop (birds, animals, colony, islands and
  mountains too, all receive as well), grass (+8% render time on grass scenes, ~2% overall), and the
  terrain through `createTerrainCaster` (back faces only: three flips the side, so a slope facing the
  sun never meets itself in the map). Not in it: the sea, marsh and leaf litter (below a texel), the
  sea-ice sheet (flat), spray and clouds. `test/props.test.ts` checks every solid lit object. The land
  map (to the horizon) still has props only: terrain beyond ~470 m ahead casts nothing.
- **The same shade on props** (`propShade.ts`): every lit standard material multiplies its directional
  light by land × cloud shade, in three's own light loop (`lights_fragment_begin`); near shadows stay
  three's. Spray takes it per droplet. Shelf and roll clouds are left out. Props are in the land map and
  it's coarse, so they read it three texels toward the light (`landShadowLift`). A point above the deck
  has less cloud over it: takram's `min(max + tail, meanExtinction × (toTop − front))`, so summits stay
  lit. `debug.shadowCoverage` reports by kind.
- **Skylight under tree crowns** (`props/skyOcclusion.ts`, SHADOWS.md phase 4.1): each plant but grass
  is a disc of leaves at a share of its height (`CROWN`, placed by its instance matrix, so a leaning
  palm's is over its fronds), stopping 50–85% of the skylight it covers (estimates; deciduous crowns
  down to 30% of that as the leaves fall). A level point loses opacity × the disc's view factor; crowns
  multiply. Baked for the crowns within 200 m and in view into a world R8 map (≥ 0.25 m a texel, open
  rim; 3–8 ms): the terrain scales its skylight and sky reflection by it, props their indirect diffuse
  and specular, fading out 0.5–3 m above each prop's foot (crowns keep their baked depth, trees.ts).
  Openness under groves 0.2–0.85. `debug.skyOpenLeast`; off: `passes.skyOcclusion: false`.
- **Soft shadows by blocker height** (`shadow.ts SOFT_SHADOW_GLSL`, phase 4.3): on the fine slice the
  sea, terrain and props filter each tap's blocker by its height band (0.3, 1, 3, 9, 27 m) over that
  band's penumbra (the sun's half-angle 0.00465 × height, ≥ 1.5 texels; 8–16 taps a band, rotated per
  pixel). Grass on sand stays sharp, a crown's gaps go round and soft (sunflecks). Props add their
  slope × the disc radius to the offset. Render time +1%. Off: `passes.softShadows: false`. Contact
  shadows (phase 4.2) weren't needed: tufts and stones sit on their fine-slice shadows.
- **Skylight from clouds** (`skylight.ts`): the sea and terrain take `skyIrradiance` from the clear
  atmosphere (`SkyLightProbe`). On daylight cloud days it is scaled per channel by the env cube's
  cosine-weighted light with its clouds over without (`debug.cloudSkylight`; typically red 1.3–2.7,
  blue about 1), so shade is lit by the clouds actually drawn and matches the props, which already
  see the cube. Not on clear days, at night, in totality or with dust (`dustSkylight` does that).
  Off with `passes.cloudLight: false`.
