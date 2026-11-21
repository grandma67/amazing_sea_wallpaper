# Lessons: Sky

takram sky, clouds and post; night sky; storms and sky objects. How it works: arch/SKY.md. Other topics: [LESSONS.md](../LESSONS.md).

## takram sky, clouds, post

- Sky shader patches (`eclipse.ts`, `contrails.ts`, `noctilucent.ts`): functions before `vec3
  getSkyRadiance(`, calls after `vec3 radiance = GetSkyRadiance(…);`; main sky only, never
  `envScene`'s; make the patch throw if it stops matching. Units km (`ATMOSPHERE.bottom_radius`),
  positions ECEF. Drawn under volumetric clouds and behind geometry for free. The clouds'
  weather-map lookup is patched the same way (`cloudArrangement.ts`). Exception: the night glow is
  also patched into the env cube's sky: it is smooth (0.35°/texel and coarser), 256² faces hold it,
  and the sea must reflect it; sharp features (contrails, meteors, noctilucent detail) stay out.
- **A cloud is drawn by the volumetric clouds, not a mesh:** a mesh is lit by the whole sky dome, has
  hard edges, isn't hazed like the deck and doesn't hide what's behind it (the shelf mesh,
  0.27–0.172: a pale plank; under a storm deck it glowed at 2× the deck; running its top into the
  deck failed, the underside is too thin to cover it). A shape a flat layer can't hold goes into a
  `sampleWeather` patch (`stormCells.ts`, `shelfCloud.ts`; checklist arch/SKY.md "A new cloud
  shape"). A mesh only for what clouds can't hold.
- A CPU mirror of a cloud's density checks its **shape**, not its light: the shelf's outline was
  smooth on the CPU while the render showed humps (shading of a detail term). Find those by switching
  terms off (`params.debug.shelf`).
- Measure a cloud's brightness against what's around it: the shelf face passed at 1.4× the deck
  above, but against the sky below it read as sky. Probe above, on and below (`edges.mjs --mean`).
- **Stretching a noise map to arrange its features stretches every feature** (cloud streets made by
  squeezing the weather map 3× turned each cumulus into a brushed streak, 0.192). Arrange with a mask
  over the unstretched map, and keep the mask's mean at 1 or the sky empties.
- Streaky clouds toward the vanishing point = float32 cancellation in the cube-sphere uv
  (`sqrt(a - sqrt(a² - 6mx²))` = 0 within ~1 km of our anchor's meridian), not wind or texture
  (`stabiliseCubeSphereUv`).
- `coverageFilterWidth` near 1 turns a layer into a sheet (density = remap(mix(weather, 1, width),
  …)); ragged scraps need a narrow width + high `weatherExponent`. An étage's 2nd layer reads
  weather-map alpha (`layerChannels`). Under a closed deck you never see cloud tops.
- The cloud shadow map is temporal (~8 updates to converge): unprimed, the first of 16 frames saw
  clouds unshadowed and low-sun bases came out too pink (`primeCloudShadow`).
- Temporal upscaling + along-ray-only jitter left spots and grain in averaged stills: Halton
  sub-pixel jitter + one final sky denoise fixed it.
- Clouds on a round earth: a 700 m base sinks below a 2 m eye's horizon at ~95 km, tops show to ~140
  km. With Bruneton air alone (~220 km visibility) 40–130 km of undersides stacked into a dark band;
  real sea air (20–60 km) fades them (`seaHaze.ts`). takram's own haze is coverage-gated and coloured
  by ground irradiance (grey at sunrise).
- takram's haze ray ends at the top of the highest cloud layer (`getHazeRayNearFar`): no layers, no
  haze. A clear dust day needs an empty layer through the dust's height.
- Thick dust can't take its colour from the sky behind each ray (blue overhead): colour it from the
  horizon sky in every direction, tinted, and give the sunlight it removes back as diffuse light, or
  sand under a dimmed sun goes purple.
- Haze lit by the clear-sky horizon glows under a storm deck: scale it by the light the clouds let
  through, with a floor (storm 0.06, overcast 0.3).
- **A haze added beside takram's must match the frame, measured:** until 0.232 our sea-haze patch
  scaled the colour by the opacity and takram mixed it by the opacity again, so inscatter went as
  (1 − T)²; the mirror copied it (REFLECTION phase 4), and the darker mid-distance land stood as a
  known issue for weeks. Now Koschmieder's (1 − T) (`passes.hazeLinear`). When a measurement shows
  a renderer departing from the textbook, fix the renderer if the textbook is physics, rather than
  matching the error. Measure with `haze.mjs`; probe by world point and check `covered by` (a guessed
  pixel on a palm frond once "proved" the textbook weighting).
- Transparent or dithered meshes don't composite with clouds/aerial perspective (they only see the
  depth buffer).
- postprocessing: `EffectComposer.setSize()` resizes the renderer (restore after side composers);
  inside takram's aerial perspective shader `readDepth()` isn't raw depth, use
  `readDepthValue(depthBuffer, uv)`.

## Night sky

- **A sky-shader feature gets a TS mirror of its brightness** (as `psfWeight` mirrors the stars'
  shader): compute what a frame sees before the first render. The aurora took 8 render rounds; the
  mirror, written at round 6, found both problems (arcs seen side-on are ~0.3× their overhead
  column; the oval band was too narrow) in one run. With `auroraRay` as the real mirror, five fixes
  took 3 rounds.
- **Validate a mirror against the render** (the same line through `params.debug.probeLine` and
  `params.mjs --line`): the first check found the aurora mirror left-right mirrored and the noise
  hash differing on the GPU, and a "smooth" mirror that would have hidden real bands.
- A stripe or band in a sky feature: switch its pass off on the same frame before fixing its
  sampling. The aurora's last "bands" were the airglow's crests, shown by the +1.5 EV. Don't write
  throwaway band metrics (a high-pass counts an arc's edge as ripple; residuals of two smooth curves
  correlate at 0.99): use `lineStats`.
- A brightness quoted for a sky object is a column or a visual class, not what a frame sees: an arc
  seen across from far away gives about its overhead column (a 25 km sheet); low in the sky the air
  takes ~1.3 mag while the airglow is ~2.5× the zenith; a photographed display is the session's
  peak. Compare with the sky at the same elevation.
- Where things land in the sky: `skyFrame.ts`, never a hand-written projector (one had the pitch
  backwards and put meteors 10–20° too high, off the frame). If you must write one, test the horizon
  ahead lands at NDC y = 1 − 2 × horizonFraction. "Is it in frame?" needs the vertical field and the
  horizon's place, not only the azimuth: three "core in frame" nights had it 20° above the top.
- A plan's geometric claim can be backwards: the aurora handoff had rays converging on the pole's
  side; up a northern field line is equatorward, and projecting one with `skyFrame.project` showed
  the edges lean out. Project a test segment before writing a test from a plan's words.
- Bounding a best-of-N placement by physics (the moon to the ecliptic) can starve its framing search:
  count the window with `params.mjs --ref HEAD --stats` first (the night moon fell from 97% to 62% in
  4–18°). Free a choice the scene doesn't pin instead (the hour of night, on its own stream).
- Anything drawn in the sky goes in the sky's units: one render unit is ~75,700 lux, and the light at
  the sun's strength may stand for the moon or a stand-in (`starLight.ts` `renderPerLux`).
  Hand-tuned star intensities were 10⁴–10⁵× too bright and made glitter paths on the sea. takram's
  `StarsMaterial` writes sky + star (opaque), hiding any sky patch under each star: draw stars
  additively.
- **Night colour is a camera's, not an eye's:** night vision (85% of every dim pixel to blue-grey) hid
  every colour a photo shows. Use the night white balance (~4000 K, `whiteBalance.ts`) and give each
  source the colour a camera records in luminance terms: the 630 nm airglow line at 5–35% turned dark
  skies brown (it is a few %); the aurora's red, `redShare(I630/I557.7)`, is 3–8%, not 10–90% (pink
  arcs). Storm red (0.93) bit twice: a symmetric red profile (230 ± 55 km) laid far arcs' red tops over
  near arcs' green (rays at 10–15° cross 230 km far behind the arc), and a diffuse red in fixed kR
  turned weak arcs orange. Give the red its quenched steep underside, scale a diffuse term with the
  display's strength, and split each colour term at the arc's peak elevation on the mirror before
  rendering.
- **A physically scaled light can vanish against a stand-in:** on starlit nights takram's clouds are
  lit by a stand-in sun overhead at a sun's strength, so the aurora's real ~3e-4 lux on cloud edges
  changed 0.06% of pixels. Check what else lights the receiver; fix the stand-in, don't boost the
  source.
- `new Texture(imageBitmap)` never uploads until `needsUpdate = true`: the Milky Way read black
  (`diff.mjs` ⚠ invisible even ×30). `loadImageTexture` callers set it.
- A point light in the sky at a photo's real pixel size is faint against bright twilight: check its
  peak against the sky there (not the zenith), with extinction and the lens's pixel, before calling
  the drawing broken. Diff a point with a `params` patch that only removes it (`{"params":{"planets":
  []}}`): switching the feature off in the spec also undid its framing.
- A noise-free render has no sky noise: a star 10% above the sky still "shows" in numbers. How many
  stars a moonlit frame shows is set by the exposure and the 8-bit display, not a threshold.
- The sky draws sun and moon independently and keeps the moon's total light fixed: scale
  `lunarRadianceScale` by `moonScale²` or a bigger disc is dimmer. A night moon disc is ~10⁴:
  earthshine and the eclipse umbra must be tiny fractions (2e-5, 8e-4).
- Floating things (contrail, high cloud): `GetSunAndSkyIrradiance` is for surfaces (cosine, zero
  below the plane); use `GetSunAndSkyScalarIrradiance` + a phase function.

## Storms and sky objects

- **A light inside a cloud** (CLOUD_ILLUMINATION phase 3; checklist arch/SKY.md "A light inside or
  under takram's clouds"): takram's clouds are optically thin over kilometres, a real Cb opaque in
  tens of metres. A light's term at every march sample averaged over km: an even faint lift. Take its
  value once where the ray first meets the storm's layer (its face, at or above the Cb base, so scud
  doesn't count) and carry it along the ray. Measure what the march passes on with a fixed face value
  (`debug.flash.constant`) before blaming the kernel: it was the haze's 0.49.
- Depths for a light under a cloud's face count from the drawn cloud's base, not where the bolt mesh
  starts (up to 200 m inside it): lights at "exit + 150 m" sat 340 m deep and lit a patch 4× too
  faint.
- The frame meter reads its last frame as well as the first: a boost meant to be metered without a
  light (lightning) has to be held (`FrameMeterPass.held`), or the frame comes out darker the
  brighter the flash.
- `new Vector4()` is (0, 0, 0, **1**): uniform-array padding gets w = 1. Pad with explicit zeros.
- A flash in a still is energy caught ÷ shutter against the ambient. With the camera metered to the
  ambient, glow ÷ ambient depends on how much of the flash the shutter holds: flat while it holds the
  whole flash, rising past the 30 s cap and below a stroke's length.
- Anything meant to show under a storm sits below the volumetric base (Cb 600 m) and clear of scud
  (300–550 m). Check heights against the day's layers (`--fields weather.formations`, `cloudTypes.ts`)
  before rendering.
- Things that come out of a cloud (bolts, rain) are placed independently of the weather map: put the
  cloud there (`stormCells.ts`). Keep them ≤ ~9 km: a 600 m base 10+ km away sits < 3.5° up behind
  ~70% haze and washes pale.
- A mesh hanging from the volumetric clouds (waterspout) can't see deck gaps: give it its own soft
  base (spray puffs).
- Camera-facing ribbons widened along one fixed vector vanish where a segment runs along it
  (lightning as dashes): widen across each segment (`dir × toCamera`).
- Exponential fog with a large scale height fills the sky; a fog *bank* needs tens of metres. And it
  has no top: a camera 100 m over a 55 m-scale layer was still in 16% of the sea-level density and
  saw a pink blanket (2016-08-09). Real sea fog stops at an inversion; give a layer a top and check
  the high eyes (open sea and overlooks, 40–160 m).
- Effects that depend on where the eye is (fog above or below it) belong in the render, where the
  camera's ground is known. (`params.ts` can call `terrainHeight` since 0.202; the cycle was one
  constant, `EARTH_RADIUS`, now in `earth.ts`.)
- A framing chosen for a sky object (a rainbow's turn from the sun, an aurora's wide lens) has to
  wait for, or undo on, whatever later cancels the object (storm, fog), or the day keeps a 14 mm storm
  shot facing away from the sun (2024-06-21 until 0.121). Decide the cancel first where its draw
  allows (`stormComes`).
- `Vector3.transformDirection` normalises: scale after transforming (contrails all landed 1 km away).
- **Name what's in a band before fixing it (D31, 0.222):** "flat Cb base, wall at a constant
  6.3 km" was the shelf cloud, below the 600 m base; the task's guess (the storm cell's side) would
  have cost a build on the wrong thing. One `diff --off '{"shelfCloud":false}'` showed it. On a
  storm day list the sky's parts first (`params.mjs --each 'p => p.storm'`: shelf, curtains, bolts),
  then switch each off.
- **Edge detail on a cloud: aspect, not just size (D13, 0.223, 3 rounds):** a far edge resolves
  only its largest octave, so smooth or wide bumps read as hills or a treeline (±15 m over 400 m;
  40 m over 250 m). Fringes hang one way, pointed (ridged noise), each about as deep as half its
  width. Check a far day (~15 km) in round 1, beside the near one.
