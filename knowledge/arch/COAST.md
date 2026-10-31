# Coast: terrain, beaches, tides, reefs

How the land and the shore work. What appears where and how often: [COASTS.md](../COASTS.md);
research numbers: REGIONS.md §2–3. Pitfalls: LESSONS.md "Coast and terrain".

## Coordinates and heights (read before changing terrain, tides or the shore)

- **World:** camera at the origin (x, z), +Y up; azimuth 0 = −Z, clockwise from above. Height 0 is
  the sea surface at rest, always (tides lower the land, never raise the sea). The ocean is drawn
  where `terrainHeightAt` < 0.3 m; `seaLevel()` adds the waves.
- **Shore coordinates** (`worldToShore` / `shoreToWorld`, GLSL `shoreCoords`): `s` seaward, `a`
  along the shore; `u = −s` inland. **s = 0 is the land frame's origin, not the water:** the foot
  of the high-tide beach (= mean sea on micro-tidal beaches). Today's water is at `s =
  coast.waterline`; the shoreface, bars and rips start at the terrace's seaward edge
  (`seaDistance(s)`). The coast's curvature and wobble are in `s`, so a line of constant `s`
  follows the shore.
- **Camera:** stands on `max(terrainHeight(0, 0), 0)` + `camera.heightM`. `coast.distanceToWater`
  is the camera's `u` (distance to s = 0); the water is `distanceToWater + waterline` away.
  Shoreline and along-beach cameras are placed from the waterline; framed and overlook stand on
  the land.
- **Heights props compare against** (world heights, sea 0):
  - `coast.runup`: today's swash above the current sea (wet sand, wet rocks).
  - `tideMarks(coast).high` / `.spring`: today's and the spring high water. Things that must be
    dry (plants, flowers) sit above `spring + runup`; wrack lies there.
  - `beachLines(coast)`: wrack and storm lines as **distances inland of s = 0** (`u`), fixed on
    the land whatever the tide does.
- **Who measures from the shore** (update them when the water or s = 0 moves): ocean surf zone
  and shore foam from `waterline` (`ocean.ts`); surf crests and spray (`props/surf.ts`); rocks'
  pebbles and clusters (`rocks.ts`); shoreline/along-beach camera distances (`generateCoast`);
  stones' size grading and mixed cover (`stoneHighTide`); cusps (`cuspReach`, u from s = 0);
  ridges; debris, shore life, wildlife, pinnipeds, colonies (`beachLines`); vegetation and flowers
  (`tideMarks`); mangroves (mean sea = height + level); `profile.mjs`.
- **A new seabed or shore profile** (reef, rock platform, tidal flat: all three done) has readers beyond the
  height function (found one by one in phase 7):
  1. `TERRAIN_GLSL` and the TS `beachHeight` (and `test/terrain.test.ts`);
  2. `waterlineAt` (`tides.ts`): today's water is found on the bare profile, so a new shoreface
     must be invertible there;
  3. the surf zone's reach (`surfReach`: ocean `surfHeight`, spray in `props/surf.ts`) if waves
     break further than ~150 m out, and the break band (`profile.mjs` prints it);
  4. seabed colour under water (`ocean.ts` floor albedo) and the terrain shader where it dries;
  5. the shelter mask (`coast.shelter`), run-up and the beach state's breaker if waves lose height
     before the beach;
  6. props that ask for calm or deep water (mangroves, `waterSpot`, rocks in the sea, beach
     lines);
  7. tests that assume every beach has bars, rips or no shelter (`beachState`, `shelter`,
     `mangroves` tests): filter the new kind out there, test it in its own file;
  8. `profile.mjs` (map extent, the numbers it prints) so the shape can be checked unrendered.

  Keep shared helpers in a module that imports neither `terrain.ts` nor `tides.ts` (they import
  each other's dependents: a cycle broke half the test files).
- **Mirrors:** every height term lives in both `TERRAIN_GLSL` and the TS `beachHeight`
  (`terrain.ts`); `test/terrain.test.ts` and `test/tides.test.ts` check them.

## Terrain and coast kinds

- `terrain.ts`: shared GLSL/TS height function (coast, dunes, hills, bars), sand shading, surf
  profile (`surfCycle`, mirrored in `props/surf.ts`).
- **Terrain mesh** (`createTerrain(params, camera)`, `grid.ts`): a polar grid round the camera
  (0.25 m to 120 km, rings spaced geometrically) covering only the ground in view: `viewWedge`
  takes the azimuths of the frame's border rays (the camera stands at x = z = 0, so a ray's ground
  point has the ray's azimuth) plus 3° each side, and `squareGrid` spends the old full circle's
  614k vertices (600 × 1024) on that wedge with near-square cells (Δr / r = the angle between
  segments): 0.33% of r each way with an 87 mm lens, ~0.6% at 18 mm, against the full circle's
  2.2% × 0.6% slivers. The camera is fixed for the still and the terrain casts no shadow map and
  isn't in the env cube; the planar reflection mirrors only in height, so it sees the same
  azimuths. The vertex shader ignores the model matrix: the wedge's angles are baked into the
  positions. `biome.ts`/`oceans.ts`: palettes, plants,
  sea state, ice.
- **Coast kinds** (`coastKind.ts`, re-exported by `terrain.ts`): `coast.type` is `open-sea`,
  `beach`, `rock-shore` or `tidal-flat`. Code asks `hasLand` (terrain drawn, camera on land, compositions,
  rocks, plants, lighthouse on a point), `hasBeach` (sand: debris, shore life, beach animals,
  mangroves, flamingos wading, "… sand beach" title) or `hasSurfZone` (surf height and foam, surf
  props), never `type === …`. The shader gets an `int coastKind` uniform (index in `COAST_KINDS`,
  `COAST_*` defines) and `terrainHeightAt` branches on it, so each day runs one profile; the TS
  `terrainHeight` switches the same way.
- **Sand colour** (PLAN_BIOMES 3): `coast.sand` is one of `SAND_STYLES` (`biome.ts`: white,
  golden, grey, black, pink, red), drawn from the place's `sand` chances (`PLACE_SAND` in
  `places.ts`, else the biome's `sands`) on stream `'sand-colour'`, then forced by `spec.sand`.
  The coast stream keeps a placeholder draw where the colour used to be, so sandbars and eye
  height didn't move.

## Rocky shores (`rockShore.ts`, PLAN_BIOMES 8)

Plan and research: [plans/ROCK_SHORE.md](../plans/ROCK_SHORE.md); shares: COASTS.md "Rocky shores".

- **The draw:** land days choose `beach` or `rock-shore` from the place's `coast` weights on
  `'coast-kind'`; `rockShoreFor(springRange, rockColors, rng, force)` draws everything on
  `'rock-shore'` (kind, 14 floats, colour), then forces the kind (`spec.rockShore`; `overlook`
  means a cliff, another composition not one). The same stream then draws the nearshore slope
  (0.03–0.06). Rock days set `terrace` to none, drop bars, rips, cusps, ridges, reef and
  shelter, `beachWidth` = backWidth + 4 (plants start on top), `duneHeight` 0; `material`
  stays `sand` (unused).
- **Land frame:** s = 0 is the back of the platform (the back face's foot), at `top` above mean
  sea. Bare profile (`bareRock`, GLSL `bareRock`): plateau | back face (smoothstep: rounded
  crest and foot) | platform from `top` to `edge` over `width` (ragged: ±25% along `a`, cut back
  8 m where a gully meets it) | scarp down `scarp` | seabed at the nearshore slope toward
  −seabedDepth. `rockWaterline` inverts it for `coast.waterline`.
- **Relief** (`rockHeightAt` GLSL, `rockSurface` TS, in `rockShore.ts` so `params.ts` can use
  it without a cycle): in the rock band, the surface `h + n` (n: fbm relief at 18 m) is
  quantised to beds of `bedding` m that dip at `dip` across `strike`, with risers of 30% of a
  step; rounded ridged noise; gullies along two joint sets (`rockGully`); or, on boulder shores,
  Voronoi boulders (`boulderField`, lumpy, flat-topped, half buried). Hills and bumps behind.
- **No zig-zags:** the terrain is the polar view wedge (cells ~0.3–0.6% of r each way), so
  detail is softened by the distance r from the camera (at the origin, so the TS mirror does the
  same): steep faces are at least `ROCK_MIN_FACE` (3%) × r wide, risers widen with r and on
  steep bare slopes, gully walls widen and gullies, edge cut-backs, boulders and fine ridges fade
  out (40–400 m). Probed with a 2× grid: the remaining teeth halve, so they are grid aliasing.
- **Camera** (`rockCamera` in `params.ts`, stream `'rock-camera'`): shoreline at the drawn
  distance from today's water; along-shore 6–30 m from it; framed 3–15 m behind the back face's
  top; overlook (every cliff) 2–10 m behind the cliff's crest, eye 1.5–2.1 m, plants starting
  just behind. Distances are corrected for the wobble at a = 0 (`wobbleAtCamera`), the camera
  is moved off the back face, then stepped inland 3 m at a time until the ground
  (`rockGround`) is above the run-up.
- **Shading** (terrain fragment shader, `rockW`): the rock's colour mottled with grain and a
  patchy joint-crack network up close, darker on faces; weed, mussels and barnacles below the
  spring high water; black lichen in the splash zone; lichen crusts (`LICHEN` by biome) higher;
  cobbles on gully floors; pools in hollows and gullies between today's sea and the spring high
  water (mirror-flat); wet rock a dull sheen; ground cover from 1 m behind the top over 8 m.
  `seabedAlbedo` gives the ocean a weedy rock colour.

## Tidal flats and salt marsh (`tidalFlat.ts`, PLAN_BIOMES 9)

Plan and research: [plans/TIDAL_FLAT.md](../plans/TIDAL_FLAT.md); shares: COASTS.md "Tidal flats
and salt marsh".

- **The draw:** the place's `coast` weights include `tidal-flat` in five places (`FLAT`). The tide
  is drawn first: a flat with the level ≥ 0 (mid tide or above) becomes a `beach` with a salt
  marsh. `tidalFlatFor(springRange, place.mud, rng)` draws everything on `'tidal-flat'` (9 floats:
  flat, marsh, nearshore slope 0.002–0.006), then the run-up (0.08–0.2 m). Flat days set no
  terrace, bars, rips, cusps, ridges, reef or shelter; `beachWidth` = marsh width + 5,
  `duneHeight` 0; `hasSurfZone` is false, so no surf, foam or surf props.
- **Land frame:** s = 0 is the marsh edge's foot at `top` = 0.42 × spring range (mean high
  water). Bare profile (`bareFlat`, GLSL `bareFlat`): land | marsh from `height` (its edge,
  0.2–0.8 m above `top`, ≤ spring high water + 0.2) rising by a smoothstep to `back` (spring high
  water + 0.5, only surges reach it) over 80–400 m | the edge, a smoothstep over ≥ 0.6 m (3% of
  r far off) | the flat, straight to `low` = spring low water − 0.3 at s = width (0.8–5 km) |
  the subtidal bed (exp toward −seabedDepth). `flatWaterline` inverts it.
- **Creeks** (`flatCreeks`, in the height): main channels every 250–700 m, from 3 m × 0.4 m in the
  marsh to `channelWidth` × `channelDepth` (15–45 m × 0.8–2 m) at the flat's end; small creeks
  every 50–120 m, 4 m × 0.18 m, from inside the marsh to 0.6 W, coming and going. Both meander
  (noise in s over 220 m, varying across channels). Far off they widen to ≥ 2% of r and shallow
  by the same factor (same cross-section) against grid aliasing; the shader's water mask uses the
  unsoftened cut, so far channels still hold water.
- **Camera** (`flatCamera`, stream `'flat-camera'`): shoreline on the flat 15–150 m out (never
  within 40 m of today's water), along-beach on the marsh edge (2–8 m in), framed 15–60 m into the
  marsh (overlook becomes framed: no high ground); corrected by the wobble, then stepped inland
  until dry.
- **Shading** (`flatW`, `marshBand`, `marshW` in the terrain fragment shader): mud (`flatMud`)
  over the upper third grading to sand, darkest on creek beds; current ripples (crests along the
  shore, ~14 cm) near the camera, none on mud; below today's high water a wetter, glossier film
  than a beach's; creeks below today's high water + 0.3 hold mirror-flat water, shallow sheets in
  hollows on the flat. The marsh: mud soil, sparse clumps over its first ~8 m, then a closed
  sward in `marshColor` with `marshAccent` patches on the low marsh (`marshLook(seasonMonth)`),
  matte between clumps; ground cover starts behind it. `seabedAlbedo` is half mud, half sand.
- **Marsh beaches** (stream `'salt-marsh'`): `coast.marsh` = { start: beachWidth (capped 10–30 m),
  width 80–400 m, height = back = spring high water + 0.4 }; dunes off, `duneWidth` = the marsh
  (hills start behind it); `beachHeightAt` raises the land to `marsh.w` over the marsh (GLSL and
  TS); surf amplitude and run-up × 0.35. Plants start behind the marsh (`vegetation.ts`).
- Debug: `terrainView: "relief"` on a flat shows creeks red, mud green, marsh blue.

## Beach material and shape

- **Beach material** (`beach.ts`, PLAN_BIOMES 2): `coast.material` is `sand`, `mixed`, `shingle` or
  `cobble`, drawn in `generateCoast` on `'beach-material'` from `materialChances(place, climate)`
  (place → region override, else `POLAR_MATERIAL` on polar days, else the biome's
  `MATERIAL_CHANCES`), then forced by `spec.beachMaterial`. Open sea is `'sand'`. Stony days get a
  low bank and `coast.ridges` (`stonyShape`, same stream: crest distance, height, half-width; slopes
  and width come from the beach state); `coast.stoneColors` is the place's palette. Stony days
  also get a steep nearshore (narrow surf zone: `breakerIndex` and `surfBreakDepth` follow
  `nearshoreSlope`) and run-up × `STONY_RUNUP`. `ridgeHeight` adds Gaussian bumps across the
  shore in `beachHeightAt` (GLSL `vec3 ridges[3]` + `ridgeCount`, TS mirror in `terrain.ts`, 0 on
  sand). `beachLines` (wrack and storm lines) lives here; on stony days its storm line is the
  storm ridge crest.
- **Beach state** (`beachState.ts`, PLAN_BIOMES 4; Wright & Short 1984): after the material on the
  same stream: grain (`sedimentFor(sand, biome)`: `GRAIN` by sand colour, white = coral on
  tropical coasts; one float, geometric in the range), stone size (one float), then
  `beachStateFor(material, grain, Hb, T, sediment, rougher)`: Ω = Hb / (ws · T) with Soulsby
  `fallVelocity` (density and carbonate shape factor), Komar–Gaynord `breakerHeight` from the
  offshore swell (`ocean.swellHeight`, T from `swellWavelength`; not `surfWave`, which needs the
  slope), limits 1.5/2.6/3.3/4.0/5.5 (Wright, Short & Green 1985 means). Storm days and |lat| >
  25° winters move it one state flatter; shingle and cobble are reflective, mixed at most a
  terrace. `spec.beachState` forces it. `beachShape` (fixed draws for every state) sets face slope
  (sand by grain × state factor 1.55 reflective … 0.85 dissipative; gravel by stone size,
  0.08–0.24), nearshore slope and width by state (slope × width ≤ 5 m), `coast.bars` (layouts
  weighted by `share`, 0–3 bars, crest at a share of the bare depth), `coast.rips` (`RIPS`: every
  intermediate state; terrace 40–120 m and longshore 250–500 m with no swing, transverse and
  rhythmic 150–400 m with the inner bar swinging shoreward by 15–45% between channels) and
  `coast.cusps` (reflective 80%, terrace 60%, transverse 40%; spacing g T² tanβ / π, 12–45 m).
  Every number and its source: REGIONS.md §2 "Beach states: shape by state". The coast stream
  still makes the old slope/width/sandbar draws (`skipDraw`) so eye height stays.
- **Bars, rips, cusps in the terrain** (`TERRAIN_GLSL`, TS mirror `barHeight`, `ripGap`,
  `cuspHeight`): `vec3 bars[3]` + `barCount`; at a rip channel (`ripGap`, a wandering cosine
  every `rips.x` m) the inner bar is cut and the bed scoured 0.8 × bar height below the bare
  profile from the shore out past the bar (`RIP_SCOUR`), so waves break less there (the surf goes
  by local depth). `ripWater(sa)` tells the ocean where the channel is. Cusps add horns and bays
  over `cuspReach` (the swash zone, at least 0.35 × spacing; on steep gravel the daily run-up
  alone is ~1 m).

## Tides (`tides.ts`, PLAN_BIOMES 5)

- `place.tide` is a mean-range span (`TIDE` in `places.ts`, REGIONS.md §3; 1–2 m by default).
  `tideFor` draws the beach's mean in it and a semidiurnal phase on `'tide'`; today's range =
  mean × `springFactor(moonPhaseDeg)` (1.2 at springs ~1.5 days after new and full moon, 0.8 at
  neaps); level = range/2 × cos(phase). Specs force the stage (`tide`) and `tidalRange`.
  `coast.tide` keeps `springRange` (mean × 1.2, or today's if bigger), which the beach is built
  for:
  - above s = 0 a berm as high as the spring high water (`highWater`, ≤ 1 m) over its width;
  - above `MICRO_TIDE` (2 m) a low-tide terrace (`coast.terrace`: ±(range − 2)/2 around mean sea
    at ~1:65, flattened to stay ≤ 400 m) between s = 0 and the shoreface; `seaDistance(s)`
    measures the shoreface, bars and rips from its seaward edge;
  - `terrainHeightAt` = profile + `terraceStep(s)` − `tideLevel` (GLSL and TS mirror).
- `waterlineAt(coast, level)` finds today's water on the bare profile (`coast.waterline`).
  `beachLines` are measured from s = 0 at the spring high water, so they stay put as the tide
  moves.
- Low-tide look: the terrain shader draws the wrack line at the spring high water, damp drained
  sand below today's high water (glossier near the water) and ponded runnels on a terrace;
  `rockMaterial`'s `tideLine` gives rocks a dark weed and mussel band below the spring high water;
  mangroves keep to mean sea up to the spring high water.
- With a spring range ≥ 2 m the beach state is tide-modified by RTR = range / Hb (`tideModified`,
  Masselink & Short 1993: ≥ 3 reflective → terrace, bars → low-tide bar and rip; ≥ 10
  ultradissipative). Micro-tidal beaches stay wave-dominated (a calm day's RTR would class most of
  them as tide-modified, but the census classes by modal waves).

## Reefs (`reef.ts`, PLAN_BIOMES 7)

- `place.reef` is a chance (`REEF` in `places.ts`; 0 outside the tropics but Ningaloo and the Red
  Sea). `reefFor` draws everything on `'reef'` in `generateCoast` before the beach state, then the
  chance or `spec.reef` / `spec.beachrock` decides. `coast.reef`: crest `distance` (100–500 m,
  seaward of the shoreface's start), `flatWidth` (0.2–0.45 × distance, 30–150 m), `lagoonDepth`
  (1–3 m below spring low water, from mean sea), `crestDepth` (max(0.3, 0.8 × spring low water)),
  passes (`passSpacing` 0.5–2 km, `passWidth` 30–80 m), `strength` (0.7–0.9), `beachrock` (30%).
- The beach state uses the breaker of the swell × (1 − strength); bars and rips are dropped;
  run-up's surf part × (1 − strength); `coast.shelter = reefShelter()` (line at the crest, blur =
  flat + ramp).
- Terrain (`reefHeight`, GLSL and TS): beach face down to the lagoon floor (`lagoonSlope`: the
  beach slope, steeper if needed to reach 95% of the floor before the ramp) with coral heads
  (`coralHeads`, up to 0.6 × the depth, steep-sided), a 15 m ramp (`REEF_RAMP`) up to the flat,
  which dips 0.25 m toward the lagoon, the crest wandering ±8 m (`reefCrest`), then the drop-off
  (`REEF_DROP` 0.6) to −seabedDepth; in a pass (`reefGap`) the lagoon floor runs on to the
  drop-off. Uniforms `reef` (distance, flat, depths below the shoreface's start, i.e. minus
  `terrace.height`) and `reefPass` (spacing, width, lagoon slope). `reefCover` tells the ocean
  (seabed `coralAlbedo`) and the terrain (bare coral and puddles on a dried flat) where coral is.
- Beachrock (`props/beachrock.ts`): 2–4 outcrops ≤ 250 m away, 1–3 rows of slabs (1.5–5 × 1–2.5 m,
  15–35 cm thick, 21 triangles) from 0.3 m above to 0.3 m below mean sea, dipping seaward 5–12°,
  half buried, `rockMaterial` with the tide line.

## Stones

- **Stone texture** (`terrain.ts` `STONE_GLSL`, terrain fragment shader only; uniforms from
  `stoneUniforms`): Voronoi cells over shore coords (u inland, a along), cell size =
  `coast.stoneSize` × `STONE_LEVELS` (0.6/1/1.6). `stoneLevel` picks the size class per pixel
  (finer below high tide, coarsest on the storm ridge, dithered patches), then one 3×3 search; per
  cell: palette colour × brightness, presence (mixed beaches: `stoneCover`, sand below the
  high-tide line), fill. Stones are ovals inside their cells with a dome normal and dark gaps.
  `detail` fades cells out by pixel footprint (`footprint / (0.6 × stoneSize)`); two mottle
  octaves (4× and 16× stone size) carry a stony texture further. The TS mirror in `beach.ts`
  (`stoneAt`, `stoneGridCell`, `stoneCell`) uses the same hashes (`cellNoise.ts`), so mesh stones
  sit on the shader's cells. `seabedAlbedo` gives `ocean.ts` the stone colour.
- **Mesh stones** (`props/stones.ts`): `meshStones(ctx)` walks 1 m blocks of the beach in view,
  nearest first (blocks pruned by `stoneGrade` per size class), and returns each shader stone
  within `meshRadius(size, ctx.pixelAngle)` (≥ 10 px wide, ≤ 30 m) that the shader draws there
  (same level, present on mixed beaches), ≤ 8k. `createStones` puts an 80-triangle
  `stoneGeometry` on each (width ≈ the shader's oval, tilted to `terrainNormal`, 15–40% buried,
  sinking fully over the last 20% of the radius), 6 variants, instance colour = cell colour × 0.8,
  `rockMaterial` (wet and glossy below the run-up). Per-level radii go back to the terrain as
  `stoneMeshRadius` (`props.userData.stoneRadius`), where the dome normal is dropped. Most views
  see the ground from 5–40 m on (`frameView`), so at 1080p cobbles get meshes, pebbles mostly on
  along-beach and framed days.
