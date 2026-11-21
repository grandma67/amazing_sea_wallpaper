# Lessons: Light and colour

Exposure, light and colours taken from photos. Other topics: [LESSONS.md](../LESSONS.md).

## Light and exposure

- Auto exposure re-normalises: scaling the whole scene does nothing; change `exposure` (e.g.
  `nightScale`) or relative brightness.
- **Check the instrument before calibrating on it (meter, 0.231, tasks.md D11):** `meterScene`
  had turned every direction straight up since the first commit (`unproject` gives a world point;
  it subtracted the face camera's *local* position), so it read the whole cube's average.
  `STARLIT_ZENITH` and a test table were measured with its `skyZenith`, and stars, airglow and town
  light stood 2.1× too bright for the starlit sky. A 3× gap between two meters of one sky (meter vs
  cube) sat in KNOWN_ISSUES as "only a stat". Before measuring a constant with a debug stat,
  compare the stat with an independent probe once (`cubeProbe` vs `skyZenith`).
- **Re-tune by keeping a class's median (meter, 0.231):** a fix that moves every frame's exposure
  ±1–3 EV keeps each time of day's median (`scripts/measure/ev.mjs` over ~72 real days spread by
  time of day, switch on vs off), so years of by-eye tuning of the class stay and only the
  per-day spread changes.
- Post-exposure units: sky ≈ 0.1–1; > 40 clamps white (GradeEffect). Effects added after exposure in
  fixed units look equally strong by day and dusk: physical sources need fixed scene radiance ×
  exposure. A fixed-power light is set in candela and turned into render units by `renderPerLux`
  (lighthouse 0.196, ships' lamps, lightning), not as a multiple of the metered sky: per-time-of-day
  multiples (the old lighthouse `beamScale`) were ~10⁶× too bright at blue hour, and a flash on the
  camera, scaled ×5,700 by a storm's dusk exposure, whited out the frame (2025-08-21). A real light
  fades by day and at dusk on its own; its point on the camera goes through the lens PSF.
- Pale things (foam, spray, mist) vanish against a low sun ahead: check front-lit
  (`sunAzimuthDeg` ≈ 160, daylight) first, then backlit.
- A low sun lights vertical flanks far more than flat sand: dark animals look pale beside the beach
  in side light. That's physics; check albedo numbers before darkening.
- A mirror-sharp sun is ~1000× sky radiance: any sun under overcast shows a glitter path, so the
  glint must be shaded by the clouds actually drawn (their shadow map), not stand-in noise.
- Props are lit by `scene.environment` too: in odd light (totality) dim `environmentIntensity`.
- Env cube is 256²: bright specks become texel blocks in wet-sand reflections. Don't boost things in
  `envScene`. Screen-space effects aren't in it: the ocean shader adds them along `R` itself
  (radiance = graded value / exposure).
- Sand overlays: a plain vertex-coloured sand mesh lights brighter than the terrain's sand shader;
  tint sand-coloured overlays (tracks, stones) ~0.8×.
- Glow round trees against a low sun had four causes: cloud TAA smearing light shafts past
  silhouettes (history now off), half-res clouds upsampled across silhouettes (rims, pink ridge
  outlines), MSAA edge pixels keeping bare sky (`SkyFillEffect`), GGX glints on edge-on leaves (no
  direct specular on plants). A pass reading the depth buffer composites per pixel; anything blended
  into a pixel (MSAA, bilinear) needs coverage handled explicitly.
- A steep stony beach face tilts away from a sun behind the land: at golden hour it sits in shade
  while rocks on it are lit. Judge ground texture under `"weather":"clear"`; a heavy deck leaves the
  beach flat blue (cloud shadow).
- A shade term has to reach every use of the light: the sea's seabed and foam skipped the shadow, so
  shallows stayed turquoise beside a shaded beach. To see a shade's effect: render the raw map as the
  output colour (is it there?), then with only that term off (does it show?).
- No cloud shadow in frame isn't always a bug: a 12 m eye with a 45 mm lens has only 60–600 m of sea in
  most of its frame; under a 13° sun a 600 m base throws its shadow 2.6 km or more. Look from 450 m
  (`camera.heightM`, `horizonFraction`) before fixing.
- Light a cloud removes from the sun must come back as diffuse light, as fog and dust do, or shade
  turns navy and land under a deck goes black. Measure it from the sky as drawn.
- three's standard materials have no `.lights` (only ShaderMaterial does): test
  `isMeshStandardMaterial`, or a patch quietly reaches nothing. A patch's report needs a test on real
  material classes.
- Shader text is built when its module loads, and `shadow.ts` and `params.ts` import each other: a
  constant from `params.ts` in the template throws before the page renders, and snapshot waits out
  its budget. Pass it as a uniform. A render silent for over a minute: rerun with `--budget 30` and
  read `[page error]`.
- `passes.aerial: false` also removes the clouds (takram composites them there): a false-colour
  shade view with it off shows a mountain the deck really hides.
- Absent from a coverage report isn't covered: forced colonies, marsh and wildlife weren't placed in
  the first scenes. Check each kind's row exists.
- **Shadows:** a bias is a fraction of the shadow camera's depth range (0.0004 of 6490 m is 2.6 m, a
  gap at every tree's foot): convert it to metres. A caster drawn only where the camera looks casts
  only from there: the view-wedge terrain cast a narrow straight-edged wedge of shade from a cliff
  behind the camera, so casters need their own mesh over everything between receivers and light
  (force the light behind the caster, `sunAzimuthDeg` ≈ 175, low, to see it). A sharper map exposes
  what a coarse one hid: at 1 cm texels double-sided grass and fronds hatched (three's normal offset
  uses the unflipped normal) and two meshes of one surface striped a snowy beach: zoom on near grass,
  fronds and ground. takram lights the clouds from its cloud shadow map too (0 past
  `shadow.maxFar`): capping it near the horizon left far clouds pink; check the sky after changing a
  shared map.
- **A soft shadow from a comparison-only map:** it can't read blocker depth but holds one blocker per
  texel, so test each tap at a few depths toward the light (0.3, 1, 3, 9, 27 m) and filter each band
  over its own penumbra (`SOFT_SHADOW_GLSL`). A wide disc on a tilted receiver shades itself: offset
  each band by slope × radius. Keep every disc ≥ 1.5 texels.
- three's shadow pass tests the *main* camera's layers, so a layer can't hide a caster from the main
  render only; show it around the one shadow render. A `customDepthMaterial` needs a fragment output
  (`gl_FragColor`), or the draw is dropped ("missing fragment shader outputs").
- **Brightening a frame exposes every light that was wrong but too dark to see:** opened ×8, cloudy
  nights showed palms bright green on black sand (props took 1.75–3× the ground's sky light: the env
  cube holds airglow, the Milky Way, the aurora and the moon's disc). Measure both lights
  (`debug.cubeSkylight` against `skyIrradiance`) in every case at once (starlit, moonlit, aurora,
  cloudy; ground, sea, props): fixed one by one, three causes took six renders.
- A look that changes geometry or the sea can't wait for the frame's meter (the sea is drawn once, on
  frame 0): meter frame 0, set the look, then restart the still and the accumulation.
- A point light with a few fixed rays (lighthouse beams) needs no shadow map: march each ray on the
  CPU against terrain and islands and pass a lit share along it. Count first: land cut a beam in frame
  on 1 day in 1095. A Gaussian beam keeps an upper tail, so an island a little above the lamp only
  dims it.
- **Anything that moves during the shutter is drawn as its time average:** a beam frozen on the
  camera for a 9 s exposure whited out the frame, where a real lens is on the camera ~2% of it
  (0.129). The shutter is known before the render (`shutterOf`); average the angle analytically on
  the CPU (erf) and bake it. A hard edge (a lamp's shade) sampled along a ray bands: give it its
  penumbra and jitter samples per pixel.

## Colours from photos

- **A photo's brightness is the camera's, not the surface's** (NATURE phase 1): auto-exposure puts a
  moor at ~0.23 linear where heath albedo is ~0.05–0.1. Hue from photos; brightness from a calibrated
  scan or an anchor beside the target (TOOLS.md "Real colours"). A far anchor fails (turf 1 km off is
  hazed pale; moorland "grass" is often straw); white paper behind a specimen is the best found.
- **A colour anchor must be the anchor's material (0.169 review):** sea buckthorn's leaves are
  silver-grey, so anchoring its berries on "the plant's green leaf" halved them; use `--petal`
  there. Measured, three of six estimated colours were well off: haws twice too bright, broom
  orange where it's lemon, blackthorn's white too neutral.
- **"The brightest cluster" of a whole photo mixes in highlights** (wattle: blue 0.17 from sunlit
  leaves and sky glints; the flower balls alone 0.09): measure a region of the target only, and
  check two regions agree.
- **A photo's shadows are sky-coloured (skins, 0.157):** a per-channel ratio of a crocodile's
  shadowed scales came out blue. Take brightness only from a photo and leave hue to measured
  colours.
- **A far colour averaged from several is often the ground's own (bloom years, 0.155):** orange and
  white daisies plus their leaves made a salmon as pale as Namaqualand's soil; real fields are sheets
  of one colour. Choose a colour per patch, then soften (speckle, soft edges): solid sheets read as
  snow.
- **A "darker" band needs a luminance drop, not channel ratios (fairy rings, 0.149):** a ring
  `[0.04, 0.115, 0.02]` on cover `[0.08, 0.13, 0.05]` keeps 0.79 of the luminance and halves red and
  blue: after AgX and saturation it drew a bright-green thread. ~0.7 luminance reads darker. A band
  0.3 m wide is a pixel at 20 m from a tall eye: count where it lands (`params.mjs --each`) and zoom
  on the nearest (`diff.mjs --zoom-at`).
- **Check a reused colour against the measures (trunk lichen, 0.148):** the rocks' `LICHEN`
  (0.45–0.55) is ~2.5× the calibrated crust; on a near trunk it read as whitewash. Keep the biome's
  hue at the measured brightness.
- **A mean-preserving speck:** to show detail up close that averages to the far colour, vary the
  share by a noise symmetric about 0.5 (`s + close · 2 min(s, 1 − s) · (smoothstep(0.3, 0.7, n) −
  0.5)`): no clamp, so the mean stays `s` at every distance (heath flowers, `terrain.ts`).
- Accent colours sprinkled per instance (every third tuft purple) look fake; real ones grow in
  patches. Drive props' accents from the same noise the terrain paints them with.
