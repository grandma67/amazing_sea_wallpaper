# Lessons: Coast and terrain

Terrain, shore, snow, ice and big shapes. How it works: arch/COAST.md. Other topics: [LESSONS.md](../LESSONS.md).

## Coast and terrain

- **Sweep a calibrated model's inputs before wiring it in (ebb and flow, 0.206):** a fixed fall
  rate for the beach's exit point matched the one calibration point (fine sand) but gave medium
  sand no seepage face at all, a cliff the research doesn't show; a draining model (rate × head)
  grades smoothly. Print the model over the input's whole range (grain 0.15–1 mm, tide 1–8 m) in
  one `params.mjs --stats` before the shader reads it.
- **A forced stage must be a moment, not just a value (0.206):** `tide: 'high'` set the level and
  left the clock, so anything reading the tide's history (ebb and flow) saw a different tide; now
  `flowMoment` moves the clock to the stage. Forcing any time-varying field: force the time.

- **A camera's shore position includes the wobble (surge, 0.200):** a beach camera placed at
  s = −distanceToWater from a bare-profile waterline stood in the water on 10 of 433 beach days; its
  real s is −distanceToWater − `wobbleAtCamera` (3–25 m). Check the drawn ground
  (`terrainHeight(coast, 0, 0)`), not a profile; `realDays.test.ts` now holds every land camera
  above the water.
- **Before a tide model, check it against real predictions (0.201):** NOAA's API gives a station's
  constants (`harcon`) and its own hourly predictions; four constituents matched Pensacola to 5 cm,
  which settled the equilibrium arguments' signs in one run.

- **A CPU mirror can drift from its shader while every test passes** (they check it against itself):
  TS `bareRock` sloped the platform over the ragged width, GLSL over the nominal one, so the camera
  and props stood up to ~0.6 m off the drawn rock (0.137). Found only when a CPU pool search missed a
  pool the GPU saw. Now `scripts/parity.mjs` checks every coast kind (~45 s; after any height or film
  term edit) and `params.debug.terrainProbe` reads any term without a shader edit. Reading two
  versions side by side missed the one-word difference (`width` vs `rockShape.x`) the numbers showed
  at once: dump the terms. Compare a render with code of the same version: a TS height fix moves the
  page's camera.
- A biome-keyed table is wrong for some places (`mediterranean` is also Florida, Taiwan and Natal;
  `volcanic` is Hawaii and Kamchatka). Key what follows the weather by `place.climate`, the rock by
  the biome, a single place's difference by a place field. Before building, read ARCHITECTURE.md
  "Biome, climate or place" and ask `params.mjs` about the odd places (`--scene
  '{"place":"florida-carolinas"}' --stats 'p => p.props.shoreLife?.flowers'` showed Mediterranean
  sea daffodils on 77% of Florida's autumn beaches).
- A row of identical teeth along a far cliff ("copy-paste" shore) was the terrain grid: the
  full-circle grid's cells were 2.2% of r deep but 0.6% wide. Square cells over the view wedge fixed
  it at the same vertex count. Probe with `terrainGrid: 2` and with each height term off (`dip`,
  `gully`, `relief`) before blaming the geology.
- Sharp relief zig-zags across the polar grid wherever it's in silhouette (steep faces, risers, gully
  walls, ragged edges): widen or fade each by distance from the camera (at the origin, so the TS
  mirror can too) and by bare slope; teeth that halve with a 2× grid are aliasing. Find the feature by
  its period: a saw every ~1 m on rock was beds dipping 20° (bedding / dip).
- A camera placed at `distanceToWater` is not at s = −distanceToWater: the wobble at a = 0 (±25 m)
  can put a cliff-top camera on the face. Correct by `wobbleAtCamera` and check `rockGround`.
- Wet ground shaded like wet sand (a near-mirror film) turns a gently sloping intertidal platform
  white: wet rock is a dull sheen; only pools are mirrors.
- Tides move the water off s = 0: every "distance from the shore" in shaders and props must measure
  from `coast.waterline`, or a low tide 350 m out loses its surf and foam.
- Geometry shaped to be seen under water (rip channels, the terrace's seaward edge) shows at low tide
  as hard steps; soften walls and check the low-water render.
- A relative tide range from the day's waves (RTR = range / Hb) makes almost every calm beach with a
  1–2 m tide "tide-modified" (reflective 29% → 10%). The census classes by modal waves: keep
  micro-tidal beaches wave-dominated.
- A gap in a bar isn't a rip: with only the bar removed the channel is as shallow as the trough. Scour
  the channel below the bare profile (rip channels are 1–2 m deeper than the bar).
- Anything sized by the daily run-up vanishes on steep gravel (0.2–0.4 m run-up on a 0.3 face is ~1 m
  of beach): cusps need a band of ~⅓ of their spacing; storm features belong at the storm run-up
  height, not a multiple of the daily one.
- Beach-state surveys file a multibar beach under its inner bar (Short 2006), so their shares and
  mean Ω per state (TBR 3.6 > RBB 3.1 > LBT 2.4) don't line up with a whole-profile state. Compare
  shares by beach length, not count.
- A lagoon curve at the beach slope (0.03) to a 3 m floor never gets there behind a reef 150 m out:
  the drawn depth must be reached (`lagoonSlope`). Compare drawn and reached in `profile.mjs`.
- Steep-sided features (coral heads) make "no steps along s" tests fail: test the joins between
  profile pieces, not every metre.
- Pebbles go below a pixel within a few metres of a 1.6 m eye: keep coarser mottle octaves that fade
  out later. Voronoi cells filled edge to edge read as paving: draw an oval of jittered size inside
  each cell with thin gaps.
- Scanning cells in a circle round the camera costs mostly cells out of frame: walk coarse blocks
  with a tight frustum test, nearest first, and stop at the budget.
- A flat km wide and a few metres high: with an 80 mm lens a small creek beside the camera, crossing
  the view at ~47°, reads as a band across the whole frame; its banks need to be gentle (0.18 m over
  2 m) and its water mirror-flat. Probe with `terrainView: "relief"` before blaming the shading.
- A marsh drawn as a sward on a beach profile sits wherever the beach's land is: capping the beach
  width dropped it below the spring high water. Put salt-marsh height in the profile (spring high
  water + a few decimetres).
- Tight lenses see the ground from 10–15 m: a framed camera 5–30 m into a marsh looked past it. Check
  `p.view.nearest` against where the feature starts.
- A soft mask plus noise should fade the noise out at the mask's edge (`under + k * smoothstep(0,
  0.25, under) * noise`): a threshold on the sum turns on abruptly where the mask leaves 0 (a
  precaution; no render showed it).

## Snow, ice and big shapes

- A mountain's `height` isn't its peak: a range's envelope and ridges reach ~0.8 of it. Measure a
  mesh's real top before writing a target as a share of a parameter. A share of the height also
  scales the wrong way for a physical limit: snow comes down to an altitude, whatever the size.
- Lowering a colour boundary can show a flaw it hid: small noise that looked fine on a summit gave a
  ruler-straight snow edge across a slope.
- **A look from words is a guess (snow, 0.113):** described as a low bench with soft edges, the ice
  foot was 0.3–1.2 m and sloped; three photos showed ~2 m, a near-vertical undercut wall and
  fractured blocks. Look at pictures first.
- **A full frame doesn't check a subtle feature (snow, 0.112):** frozen spray looked fine in a contact
  sheet and was camouflage in a before/after crop. See it with its own switch off.
- **Wrapper patches keep the inner program key (snow, 0.111):** a wrapper's source is the same on
  every day, so a snowless plant could reuse a snowy day's program with its uniform unset (seen in
  the code, not a render). `shadeMaterial`, `addWash`, `snowCap`, `windMaterials` keep it.
- **Caps on tiny things read as crackle (snow, 0.111):** white tops and dark sides on thousands of mesh
  stones looked like cracked mud. Hide what real cover would bury and let the ground stand in.
- **Test what the camera sees at every tide (sea ice, 0.117):** the placement table found rubble
  0.2 m above the eye at 12 m, which no render round had pointed to. Skip such pieces when drawing
  rather than moving them, so the world stays fixed for a moving viewer.
- **Detail from world noise needs low contrast (sea ice, 0.116):** cloudy ice at ±24% over a short
  scale read as granite, evenly spaced frost layers as candy stripes. Start subtle, at the object's
  own scale, and read the near render.
- **Big level things shouldn't tilt (sea ice, 0.115):** floes 0.5–1° apart read as paving near a
  grazing sun. Grep for every tilt: the same effect was in two places.
- **Set a value where it's built (sea ice, 0.115):** overwriting `coast.runup` after `generateCoast`
  left the berm at the old high-tide line (`beach.test.ts` caught it).
- **A pile is a surface, not a random height per piece (sea ice rubble, 0.197):** each piece raised by its own hash
  hung in the air beside empty cells, and the far set (2 m slabs on 5 m cells) never had pieces to rest on. Raise pieces
  only to a smooth pile surface, fill every cell there and stack the pieces under it; whatever floats must know where the
  shader opens water (mirror its discards in TS).
- **Shared vertices round a slab's sides read as a drum (sea ice, 0.114):** a low-poly plate needs
  `toCreasedNormals`. A block 4.5 m across and as tall reads as a boulder; ice rubble is slabs as
  thick as the ice.
