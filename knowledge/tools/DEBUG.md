# Debug switches and views: `params.debug`

Render-only switches (`src/debug.ts`), set through a spec's `params` patch
(`{"params":{"debug":{…}}}`), so every script takes them (`snapshot`, `diff --off`,
`params --fields debug`). The generator never reads them: no draw or other param changes
(`test/debug.test.ts`), and a misspelt field throws. `scenes/debug.json` shows each view on a
rock platform and a beach. Tools: [TOOLS.md](../TOOLS.md).

| Field | Does | Use it for |
|---|---|---|
| `terrainGrid: 2` | terrain grid cells × 2 denser each way (4× the vertices over the same view wedge; 0.25–4) | is it grid aliasing? `diff --off '{"params":{"debug":{"terrainGrid":2}}}'`: teeth that change are the grid's |
| `props: false` | no props (markers still drawn) | terrain and sea alone; with `clouds: []`, `weather: "clear"`, `islands`/`landform`/`lighthouse`/`colony`/`pinnipeds: null` a terrain-only render |
| `markers: [...]` | a post (~6 px wide, ≥ 1 m) at each point, a colour per source in list order (red, cyan, yellow, green, magenta, white) | where things stand: `camera-ground`, `edge-rocks`, `water-rocks`, `props:KIND` (each piece of a prop kind, e.g. `props:pinnipeds`) |
| `passes: {name: false}` | switches off `clouds`, `aerial` (aerial perspective), `skyFill`, `bloom`, `reflection` (planar), `shadows` (props cast none), `stars` (the star catalogue), `glow` (Milky Way, airglow, zodiacal light, light pollution) | which pass causes a glow, rim or dark band: one `diff --off` per pass |
| `exposure: N` | fixed exposure (the metered one is `debug.exposure` in each render's `.json`) | comparing renders whose sky or weather differs (`diff.mjs --keep-exposure` sets it) |
| `terrainView` | false colour on the terrain, lit by the scene's light: `slope` (grey by steepness, red where the height bends by 3–10 px within ~2 grid cells: aliasing candidates; less red with `terrainGrid: 2`), `relief` (rock: gullies red, boulders green, bed bands blue; beach: cusps red, bars green, storm ridges blue), `lines` (today's still water cyan, run-up orange, today's high water green, spring high water yellow, beach high-tide line magenta, storm line red), `shore` (s blue and a orange every 10 m, s = 0 white, `waterline` cyan) | which height term made a feature; whether lines sit where props and wet bands assume; the shore frame (wobble, curvature) round the camera |
| `oceanView` | false colour on the sea: `shelter` (blue → red), `breaking` (deep blue, steepening green, breaking red), `depth` (sand → blue over 15 m, a line every metre), `foam` (coverage, grey) | calm water, break lines, depth under the camera's view |

- **Bisect a height term without code:** patch it off in `params.coast` and diff, e.g.
  `diff --off '{"params":{"coast":{"rock":{"dip":0}}}}' --keep-camera` (also `gully`, `relief`,
  `boulder`; on beaches `bars: []`, `cusps: null`, `ridges: []`). The term whose diff shows the
  feature is its cause. Read the feature's period first (a saw every ~1 m on rock was the beds'
  bedding / dip).
- Check a patch landed before rendering: `params.mjs --scene S --fields debug,coast.rock`.
