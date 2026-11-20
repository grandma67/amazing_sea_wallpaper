# Lessons: Props

Seasons and plants, placement, meshes. How it works: arch/PROPS.md. Other topics: [LESSONS.md](../LESSONS.md).

## Seasons and plants

- A month table needs the hemisphere, not the ocean: `ocean === 'southern'` only flipped the
  Southern Ocean, so Chile, SW Australia and the Cape bloomed in July. Read months through
  `seasons.ts` (`monthInSeason`); keep calendar months only for data already local (turtle nesting
  per place). Tests that pin "a northern beach" pin a northern `place`. A plan's months for one row
  over both hemispheres are a bug (gorse "Apr–May" listed New Zealand too).
- The `southern` hemisphere shift is half a year: 2 July south is day 365, 3 July day 1
  (`seasonDay`).
- The real sun at 76–80° (Svalbard) never gets above −6° in December: a "blue-hour glow at noon"
  exists only nearer the Arctic Circle (Tromsø's 69–71°). Check `sunLimits` before writing a spec
  for a polar look. Below 63° the time of day is a free category.
- **Seasonal looks on a procedural mesh are decided after the builder's draws**, by `hash()` of the
  piece's position (skip a leaf, recolour it), never by skipping or adding draws, so the same tree
  just loses its leaves (`test/phenology.test.ts` checks the next draw is the same).
- **A share of a few instanced variants can't be a hash** (blossom, 0.140): bushes are 5 meshes, so a
  hashed 0.4 crown share flowers none of them on 0.6⁵ ≈ 8% of days, and spreading it over variants
  can't hold a share under 1/variants (flamboyant 0.03). Decide per instance by world position and
  build the look as a twin of the variant, replaying its recorded draws (`Random.from`, 0.141).
- **A mixed kind needs a stable identity before its seasons (0.169):** one `bush` stands for many
  shrubs; flowers and fruit picked by separate hashes would put April's blackthorn blossom and
  October's sloes on different bushes. Give each crown a species once (one position hash), hang
  every seasonal look on it, and append new shares after the old rows' so their crowns don't move.
- **A seasonal leaf change must scale with its strength (0.169):** blackthorn's bare-twig flowering
  thinned the leaves whenever it flowered at all, so late May's 10% tail drew a near-bare bush.
- **Measure "near the shore" from where the thing can be:** pōhutukawa's 60 m from s = 0 caught
  almost no tree, because broadleaves start 35–110 m inland. Count the instances that pass a
  placement rule (`props.vegetation.createVegetation(p.ctx)`) before rendering it.
- **A rock-shore camera looks away from the land (heath, 0.144):** every rock composition faces the
  sea, so ground cover behind the shore is behind the camera or a thin strip: forced Scottish and
  Cornish specs changed 0–0.3% of the frame. Near ground-cover looks on rock days show on the far
  cliff tops. Render the spec before promising a near look; count `diff.mjs` changes, not days.
- **"Measured from today's line" and "doesn't move with today's sea" can't both hold (spray belt,
  0.147):** fix the base (spring high water + a typical run-up) and test over forced tide ×
  composition × swell. World heights move with the tide: compare in the land's frame.
- **A rock-shore height rule needs a distance when it moves inland (trunk lichen, 0.148):** a tree
  at belt height 150 m inland isn't in the spray; a flat reach of 40–160 m still greyed every framed
  hero (within 40 m of the shore). Count in-frame trees by outcome (`--count --by`) first, and scale
  the reach with the exposure the rule already has.
- **A smooth height band makes a sock (trunk moss, 0.148):** moss faded over height alone, with
  patches coarser than the trunk, filled the foot solid with a level top. Push the edge with noise
  (±30% of the height) and use patches smaller than the girth.
- **One patch threshold doesn't fit two surfaces (moss, 0.146):** the boulders' mask edge, reused on
  the rock-shore terrain, carpeted a crest. Give each surface its own edge; look at a crop, not a %.
- **Check what the params can say before writing a weather rule:** "wet on rain and drizzle days"
  had no field to read; overcast stands in, said in the code.
- **A tall tree as a framing hero shows only its trunk (eucalyptus, 0.145):** framed shots put 2–4
  heroes 9–30 m off at the frame's edges; a 15–25 m gum's crown is above the frame. Check a new kind's
  height against the hero distance before it can lead the hero order.
- **A crown that reads up close can vanish far off:** leaf cards go sub-pixel, so a sparse crown
  becomes a pale stick at 150 m. Preview `mesh.mjs --eye 150` too, and add branch tips rather than
  only cards per tip.
- **Check where a kind stands on real days before choosing what to draw on it (0.168):** a stone
  pine's nearest in-frame instance is within 30 m on 14% of its days and past 300 m on 58% (arch/PROPS.md
  "Where each plant kind stands"), so its 12 cm cones show on few days. `--find` reports only the
  nearest *unoccluded* one, `--count` only the overall minimum: use `scripts/scene/plant-near.js`.
- **A position hash can't be recomputed from an instance matrix (salt, 0.199):** `instanceMatrix` is
  float32, and `sin(x · 12.9898 …) · 43758` turns the rounding into a different hash, so a probe
  that re-derived each bush's species from the mesh found "hawthorn" the code never placed (~8 calls
  debugging correct code). Read identity from `p.plants` / `plantInstances` (the code's positions,
  stored per instance); a new per-instance decision goes into `mesh.userData.plants` too.
- **"Where a kind starts" isn't where its plants stand (salt, 0.199):** measuring the shrub lee from
  `inland`'s minimum put it 0–20 m too far forward; plants also need dry ground, so the first line
  is the storm line on beaches (`saltFront`; arch/COAST.md "Who measures from the shore").
- A pale, even colour under a tree reads as a stain, and a map's discs as neat ellipses from above:
  fainter, warped, in drifts; the leaves on top carry the look.
- **Small things near the ground: ask what covers them (mushrooms, 0.151):** 3 mushrooms "in frame"
  gave an identical diff: grass tufts and trunks stood in front of each from a 1.6 m eye
  (`--project fungi`'s `covered by`). A mushroom under a tree stood on bare shingle, because trees
  can grow on the backshore: tie under-tree props to the ground they need.
- **Faint point lights: work out the physics first (fireflies, 0.153):** 200 fireflies in a tree at
  300 m sum to ~+8 mag, fainter than the stars; extending the range bought nothing. Compute the
  magnitude at the distance (`fireflyMagnitude`), then decide the range. Glow-worms at 4 cm were all
  behind grass tufts (`covered by`).

## Placement

- Place by trying spots until enough is in view: sampling shore coords round the camera fails in
  along-beach views. Cast rays through the frame and march them to the ground (`spot()` in
  `props/wildlife.ts`). Flocks: by a view ray reaching the target altitude, not fixed NDC heights.
- `ctx.visible()` only says a sphere touches the frustum, so features end up cut by the frame edge:
  use `ctx.inFrame()` (NDC inside the central 75–85%) for things seen whole.
- Beach animals near the waterline vanish under the swash: keep ≥ 0.25 m above sea level
  (`place(..., wet)`). Tropical shelves put 1.2 m deep water only > 150 m out: "in the water" needs a
  shallow fallback (hippos lie down, storm seals 0.8 m).
- From a 1.6 m eye the horizon is ~4.5 km: a 2 m cay is a line of palms over a white strip, and low
  skerries can read as one shore. Make low features nearer, not bigger.
- A rock dropped on a beach reads as a block; a mainland headland must run inland.
- Stony beaches move every line: `beachLines().stormLine` is the ridge crest, and a 1:4 face tilts
  long animals by ~14°: tilt them to `terrainNormal`. A sea-facing shoreline view has no beach
  30–300 m off in frame, so beach haul-outs fall back to a skerry: check them along-beach.

## Meshes

- **Close-ups find what full views hide (0.164–0.165):** floating crab legs, a flipper in the air,
  open snouts, a crest above the back and a floating head all passed the mesh tests and every scene
  render. `test/meshLint.test.ts` checks parts and holes; add each new animal, look with `mesh.mjs
  --focus head`. Preview alone first: the front view caught open crocodile jaws beach renders hid.
- **Fruit at a twig tip is inside the leaves (0.168):** `leaves()` scatters cards round each tip, so
  fruit placed at `tip.p` was hidden. `fruits()` moves it out to the crown's surface and down.
- **A shape right in size can still read as something else (0.168):** a Canary date bunch as one
  lumpy egg looked like a giant orange cone. A bunch is a broom of strands.
- **A shared structure first when the scope may grow (skins, 0.157–0.158):** per-animal textures
  were rebuilt as one atlas when "all animals" came: design the shared form at the first "and the
  others?".
- **Glints and spray are light, not skin:** cap them (`highlights`) before judging a texture's
  contrast; a humpback's spray drops made dolphins look like granite.
- **Count triangles × instances before adding detail to crowds:** faces took penguins 400 → 1,072
  triangles (× 2,500 in a colony) before a trim to 672 (`params.mjs --count`).
- **Set first values from the researched sizes:** goggle eyes and needle bills cost a round each when
  the real sizes were known.
- **A missing vec4 attribute reads (0, 0, 0, 1) (skins):** a shared material patched for one animal
  draws the others. Put the weight in a component that defaults to 0.
- **Blend in log space when the result must stay positive (skins):** a contrast-keeping cross-fade of
  a dark-crevice texture went negative; the pattern multiplies, so tile its log.
- **Subdivide by edge, not by triangle, before cutting (baked scans, 0.150):** per-triangle grids left
  T-joins, so the alpha cut fell into hundreds of islands and the simplifier couldn't get under ~6.7k
  triangles without dropping flower heads. Split every edge longer than the texel at its midpoint;
  1.5k triangles held the plant. Simplify by **error** with a triangle cap (0.3% kept 3 mm stalks;
  1.2% dropped them).
- Clamp before a fractional power: `(1 - t) ** 2.2` is NaN for t a hair above 1, and `start + (length
  * i) / n` can end there (the rock lighthouse's top ring, 0.83). three logs `computeBoundingSphere():
  Computed radius is NaN`; find the mesh by hooking `console.error` in an init script (`?worker=0`):
  its second argument is the geometry.
- `MeshBuilder.tube` returns rings: close ends with `MeshBuilder.cap`. Its frame flips with path
  direction (toward −X cos(angle) points up, toward +X down): crocodiles came out with pale backs.
  Check with face-normal colour averages.
- Smooth blobs read as rocks: seaweed needs loose leaves and ribbons over a low mound
  (`MeshBuilder.ribbon`, `clumpGeometry`). Uniform tubes read as pipes: wood needs bulges, oval
  section, grain checks, splintered ends (`logGeometry`).
- Heads in water read as balls or posts from stacked ellipsoids, as "Nessie" if the neck shows and
  the skull is no wider than the neck. Seals (`swimmingHead`): one lofted tube, skull bulb wider than
  the neck, short tapered muzzle, waterline at the throat.
- Sheer walls on a polar grid read as drums (karst towers as canisters): vary the wall's foot with
  angle, cover with vegetation and dark streaks.
- Welding a fine icosphere (`mergeVertices`, detail 30: 40 ms) cost three times the shaping of a rock:
  shape a copy of a kept one (`props/sphere.ts` `unitSphere`), never the kept one.
- Instanced repeats (trees) < ~100k triangles each; in-mesh randomness from `hash()`/`noise3()`, not
  `rng`, so added detail doesn't reshape every instance.
