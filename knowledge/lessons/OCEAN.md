# Lessons: Sea and surf

Waves, foam, surf. How it works: arch/OCEAN.md. Other topics: [LESSONS.md](../LESSONS.md).

## Sea and surf

- Roughness a pixel can resolve must be drawn, not blurred: the missing short-wave slope added as GGX
  variance everywhere turned a 15 m/s sea into a flat grey sheet and 3 m/s glitter into a haze. Add
  it as a layer of slopes whose mips become variance (the cascades' LEAN trick). One shrunk copy of a
  cascade tiles visibly (1.7 m ≈ 25 px at 50 m): use two at incommensurate sizes and angles.
- JONSWAP's short waves keep their level at any wind (α is constant): a 0.5 m/s sea is not glassy
  until the wind sea fades in with an onset (`windWaveOnset`).
- Before tuning anything that follows the wind (glitter width, reflections), measure the slope
  variance the spectrum draws (`synthesizeOcean().slopeVariance`) against Cox–Munk.
- `textureGrad` only gives an elongated footprint if the texture has `anisotropy` > 1 (render
  targets default to 1); explicit-lod lookups ignore it. A square mip blur sized for the vertical
  spread dilutes narrow objects sideways to nothing.
- Calm water at grazing should be ~0.9 × the sky at the mirrored angle: probe the sky at +x° and the
  sea at −x° on a calm open sea (`horizon.mjs`) before blaming a texture. It matched the sky at +4°
  (a shading normal fix had aimed the ray 5.7° high), and the suspected "dark cube" read the same as
  the frame once probed directly (`cubeProbe`): a wrong diagnosis sat in the known issues for a phase.
- Normals "fixed" for shading are not the surface: `N + V·(0.05 − N·V)` tilts a flat sea ~3° toward
  the viewer at grazing. Anything geometric (the mirror lookup) uses the wave's own normal; it hid a
  2.3°-tall island's whole reflection.
- A cube's mips mix above and below the horizon: anything reading it blurred near grazing averages
  in the ground. Fold the lower half up for water (`foldedSkyCube`).
- A planar reflection blurred evenly lets go of the waterline: past an object's foot the mirror
  target is transparent. Real blur grows with the reflected ray's length t past the water (∝ t / (D +
  t)): read the mirror's depth and scale the mip and wave shift by it.
- A water film above the mirror plane (pools, swash) can see its own ground in the mirror target:
  compare the depth's t with the film's own (`tSelf`) and drop the image where they match.
- Fade a mirrored object's haze toward the sky that same ray reflects, not a sampled "horizon"
  colour, or a hidden 37 km volcano leaves a pale sheet on the water.
- Anything at mean sea level (splashes, foam) hides behind crests at grazing angles: place it on
  `seaLevel()` and lift it a little. Search for sea points over the whole frame's NDC range (a low
  horizon leaves no sea below NDC 0).
- Steep features narrower than the ocean grid (spacing r × 0.012) zig-zag, worst from overlooks:
  clamp widths to grid and pixel size (`surfProfile`'s `minFace`).
- Breaking at H = 0.78 d puts the break line far out on gentle beaches: wide surf zone, smaller waves.
  Surf-zone width follows `nearshoreSlope`, not `beachSlope`: steepen the nearshore too (stony
  beaches).
- A hull rides waves longer than itself: in Hs 3.5 m swell the water climbs a small boat only ±0.1 m.
  Spray comes from wind-sea crests it can't follow: model those statistically. Sample the sea every
  ~2 m under a hull (7 points under a 250 m ship aliased 12 m chop into a fake 0.5° pitch).
- Regular Kelvin waves read as a printed grating from above: cap steepness (0.05), weaken inside the
  wedge, break up with noise.
- Near-camera boats need open water: on beach days no spot ≥ 3 m deep lies within ~150 m in frame;
  use `"coast": "open-sea"` to check wakes/spray up close.
- Calming water means more than lowering the displacement: slopes, Jacobian foam, whitecaps, the surf
  (incoming height, not the depth cap), spray, waves on rocks and CPU `seaLevel()` each read the waves
  separately. Put the factor beside `shallowDamping` in both shaders and pass the same mask to every
  TS mirror (`shelterAt`).
- Scaling the surf's deep-water height still shoals the re-formed wave by Green's law: "≤ 0.3 ×
  offshore" holds against the incoming wave at the same depth (at 1 m, 0.2 × h0 shoals to ~0.4 × h0).
- Wind chop in a lagoon is fetch-limited: 10 m/s over 300 m raises ~1.7 m waves, in the middle
  cascade (1–6.5 m), not the shortest. Scale the middle cascade by fetch.
- A reef's waves break on a ~2 m strip of its steep face, so there's no white line from afar: the
  crest needs its own band of white water. The surf zone ends 150–350 m out; anything breaking
  further (a reef 400 m off) needs `surfReach`.
- Foam on the sea plane is invisible at grazing distance (at 855 m from a 38 m eye a pixel is ~0.5 m
  wide but ~11 m deep: a 2 m collar is 0.2 px tall). Put white water on the object's vertical face
  (wash band) and in spray; size sea foam by wave height, not object radius, and fade it by band width
  over footprint.
- `waveOnRock().breaks` compares the crest with the rock's top only: any cliff "breaks" a 5 cm swell.
  For islands also gate by the crest's own height (`islandWaves`).
