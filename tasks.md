# Tasks

Open problems and investigations, with steps to solve them. Collected 2026-11-08 (after 0.135)
from the known issues (knowledge/KNOWN_ISSUES.md) and the finished plans (REFLECTION, WATER_VIEW);
updated 2026-11-19 (after 0.208) to match KNOWN_ISSUES.md: fixed tasks moved to "Done" at the end,
new issues added (section E, D27–D37).

## How to read a task

Each task has the same fields:

- **Problem:** what's wrong, in one or two sentences.
- **Known:** how it was found, **measured** (with what, on which date or spec) or **suspected**
  (inferred, not checked). Several entries are older than the code around them: **step 0 of every
  task is to confirm it still happens at HEAD** (render the date or spec named).
- **Research:** what has to be looked up before building: papers, numbers, reference photos
  (CLAUDE.md: 1–2 searches, cite only what you read; 2–3 reference photos for anything judged by
  eye). "None" means the code and our own tools answer it.
- **Steps:** in order. Numbers before renders; a switch that gives back the old image exactly
  (`diff.mjs --ref HEAD --off PATCH --off-here`); real days in the first render round; ≤ 3 render
  rounds; docs and changelog at the end.
- **Done when:** the check that closes it.
- **Size:** sessions, estimated. **Decision:** the fix changes many days or the look: ask before
  building (the measuring steps can run first).

Status: `[ ]` open, `[~]` started, `[x]` done.

## Summary

| ID | Task | Research | Decision | Size |
|---|---|---|---|---|
| A1 | ~~Pale smear on the island~~ (not reproduced: done) | | | |
| A2 | ~~Sparkly dots over the sea~~ (cloud noise at 1 frame: done) | | | |
| A3 | ~~Sailboat as a bare tilted mast~~ (not reproduced: done) | | | |
| A4 | Calm sea dark near the horizon: Fresnel floor + B1 haze (measured) | none | yes | ½ |
| A5 | Sky cube too bright higher up: no light shafts (measured) | none | yes (cost) | ½ |
| B1 | takram haze fades as (1 − T)² | photos | yes | 1 |
| B2 | Night frames' colour (sand blue, deck blue, sharp birds) | yes | yes | 1–2 |
| B4 | Beach-state shares vs Australia's census | done (COASTS.md) | yes | ½ |
| B5 | Run-up by beach state (Stockdon) | yes | yes | 1 |
| B6 | Waterspouts: inside fog, and far too rare | check WATERSPOUT_FOG.md | yes | ½ |
| C1 | Render a rock pool beside a boulder (tools built) | none | | ½ |
| C2 | Glitter width vs Cox–Munk | none (REFLECTION.md §1.2) | | ½ |
| C3 | Far mirror images slightly off-colour | none | | ½–1 |
| C4 | ~~Speckled lightning in wet sand~~ (0.214: done) | | | |
| C5 | ~~Far land mirrored about a flat plane~~ (invisible at 27–34 km: done) | | | |
| C6 | Lee calm, slicks, mirroring ice, whitecaps | yes, each | per feature | plan each |
| D1 | ~~Lighthouse title without a lighthouse~~ (0.210: done) | | | |
| D3 | Waves re-form behind sandbars | known (Dally 1985) | yes | 1 |
| D4 | Longshore bars without a trough | known (OzCoasts) | | ½ |
| D5 | Emerged rip channels look like shelves | photos | | ½ |
| D6 | Reef lagoon gets no swell through its pass | yes | | 1 |
| D7 | Reef crest foam is timed, not breaking | photos | | ½ |
| D8 | No terrain shadows past ~470 m | none | | 1 |
| D9 | Smaller rocky-shore issues (notches, boulder teeth, crest, bursts, speed, placement) | photos (crest) | | ½ each |
| D10 | ~~Brittany sand less red~~ (camera moved; fine: done) | | | |
| D11 | Exposure meter is a whole-cube average (measured) | none | yes | ½ |
| D12 | ~~2016-08-09 range invisible~~ (shows faintly: done) | | | |
| D13 | Shelf cloud: ~~straight lip~~ (0.223: done); backlit sunset band, front-lit tiers left | photos | | ½ |
| D14 | ~~Lunar eclipse sky ~10× too bright~~ (0.224: done) | | | |
| D16 | Aurora barely shows on clouds; arc-edge grain | photos | yes | ½–1 |
| D17 | Landforms chosen by biome, not place (volcanoes fixed 0.212; subtropical odds left) | yes | | TERRAIN_FORMS 4 |
| D18 | Snow lines: nordic summer too low (tropics fixed 0.211) | yes | yes | ¼ |
| D19 | Seasons gaps (wrack leaves, larch, tropical seasons, far woods) | yes | | 1 each |
| D20 | Snow and sea-ice limits (plans/SNOW.md, SEA_ICE.md) | see plan | | see plan |
| D21 | Generic meshes for four US Gulf species | photos | | ½ each |
| D22 | Tidal flats rare; Wadden dikes, marsh flooding and details | yes | | 1–2 |
| D23 | Missing animals: seals on sandbanks, waders | yes | | phase 14 |
| D24 | ~~Iceland: brown basalt~~ (0.218: done) | | | |
| D25 | Elephant seals and hippos up close | photos | | ½ each |
| D26 | Stony beaches read flat at 1080p | none | yes | ½ |
| D27 | Lighthouse leftovers: fog halo, ~~dull glazing~~ (0.221: done), beam width | photos | | ¼ |
| D28 | Town light only mildly warm at the night white balance | none | with B2 | ¼ |
| D29 | ~~`stormCells.ts` near latitude ±45°~~ (0.215: done) | | | |
| D30 | ~~Far bolts without cloud~~ (0.215: done) | | | |
| D31 | ~~Night storms: flat bands~~ (the shelf; 0.222–0.223: done); scud in front of a bolt unlit | none | yes | ½ |
| D32 | Forest from an overlook too sparse; flowering bush tint | photos | | ½ |
| D33 | Tide curves: far gauges, no M4, forced moon | yes | | ½–1 |
| D34 | Ebb and flow: one calibration point, no tidal currents, flats' old film | photos | | 1 |
| D35 | Icebergs and island wash | none | | ½ |
| D36 | Salt-pruning leftovers (gale browning, squat spruce, framed trees cut) | yes | | ½ each |
| D37 | ~~Spray squares, speckle, horizon seam~~ (0.225–0.229: done); mist-streak check left | | | ¼ |
| D39 | Night surf in blue 2×2 blocks on lighthouse nights (planar mirror vs cube) | none | | ½–1 |
| D40 | Scud in front of a bolt stays unlit (from D31) | none | yes | ½ |
| D41 | ~~Sea stacks' flecks~~ (0.230: done); pale top left (KNOWN_ISSUES) | | | |
| D38 | ~~Wet rock in zebra bands~~ (0.213: done) | | | |
| E1 | CI: half-float limits that could break SwiftShader again | none | | ¼ each |
| E2 | Scheduled render finishes late | none | | ½ |

## Problem or feature? (research 2026-11-19)

Each task checked against what a real coast or camera shows. **Bug**: no real counterpart;
**real gap**: the real world has it and we don't; **partly feature**: part of the symptom is what a
camera really records, so fix only the rest; **feature**: physically right, close or keep as a
choice; **unknown**: needs the task's own measuring step. "Re-measured" = run at HEAD today with
`params.mjs`; otherwise the KNOWN_ISSUES measurement stands.

| ID | Verdict | Why |
|---|---|---|
| A1 | Bug (likely) | A semi-transparent smear on rock has no optical cause; untraced. |
| A2 | Unknown | Sunlit spray or snowflakes can sparkle; points hanging in clear air can't. Trace first. |
| A3 | Partly feature | A bare mast is real (moored, or motoring with sails furled); a steep lean at anchor isn't. |
| A4 | Feature (likely) | Any swell tilts facets toward higher sky, which is darker than the sky at the horizon, so calm-but-swelling water reads < F × sky there. Step 1 (swell 0.01) decides. |
| A5 | Bug | The cube and the frame draw the same sky; 1.3× is a quality difference. |
| B1 | Bug | Koschmieder (textbook): L = L₀T + L_haze(1 − T). (1 − T)² has no physical basis. |
| B2 | Partly feature | A cool night balance is the photographers' convention: with moonlight ~4000–4100 K, they set ~3000–4000 K to keep it looking like night; a 5500 K balance "looks dull" [1]. So some blue on sand is right. Our gains go further than a 4000 K balance would. The blue starlit deck (it should be lit by the airglow's green) and birds sharp in a 30 s exposure are bugs. |
| B4 | Real gap | Measured against the Australian census (COASTS.md). |
| B5 | Partly feature | Stockdon 2006: on dissipative beaches setup and swash depend only on H₀ and L₀, not slope [2]. On a 1:100 beach that is tens of metres of horizontal run-up, so a **wide wet band on flat beaches is real**. The gap is steep beaches, where slope matters. Compare with Stockdon before re-tuning; the flat beaches may already be right. |
| B6 | Bug (fog); real gap (rate) | Spouts form under cumulus lines, not in fog. Florida Keys estimates run 50–500 a year (~40 reported a wet season), peaking June and Aug–Sep [3]: a Keys-specific season is needed, not the Mediterranean's. |
| C1 | Unknown | A check, not a bug. |
| C2 | Unknown | A measurement. |
| C3 | Bug (small) | The mirror image should carry the island's colour × F plus the haze on its own path. |
| C4 | Bug | A reflected bolt is a soft vertical streak in photos. |
| C5 | Feature (accepted) | Real, but under a pixel at the distances seen; close after the check. |
| C6 | Real gaps | Lee calm and slicks are common in calm-day photos. Whitecaps: Monahan & O'Muircheartaigh 1980 is a robust-biweight fit, regionally variable (later fits use exponent 2.26) [4]; measure ours against the range, not one curve. |
| D1 | Bug | The title names what isn't drawn. |
| D3 | Real gap | Broken waves do re-form behind a bar, but decay toward a stable height of ~0.35–0.4 × depth (Dally et al. 1985), not full height [5]. |
| D4, D5 | Real gap | OzCoasts trough depths; emerged bar edges are rounded by the swash (photos to confirm D5). |
| D6 | Real gap | Swell enters lagoons through passes. Some lagoons are calm, so keep the shelter, add the gap. |
| D7 | Real gap (subtle) | Reef-crest breaking is wave by wave and stronger at low tide [6], not a timed band. |
| D8 | Real gap | Far cliffs cast shadows; kept out for render cost. |
| D9 | Mixed | Bugs: notches and boulder teeth (aliasing). Real gaps: crest, burst. Performance: speed. Unknown: placement. |
| D10, D11 | Unknown | Diagnostics first. |
| D12 | Feature (likely) | A 36 km range against a 3° sun in haze can vanish for real. The title naming it is the bug: let the title follow `haze.mjs` visibility. |
| D13 | Real gap (lip) | The WMO atlas: arcus "somewhat tattered edges"; the underside "often ragged" [7]. Sunset band: re-check first. |
| D14 | Real gap (if it still shows) | At totality the zenith darkens to the site's new-moon level (19.0 vs 19.3 mag/arcsec² measured at a suburban site), and far more stars show from dark sites [8]. |
| D16 | Partly feature | Aurora (≥ 100 km) lights cloud *tops*; from the ground we see bases, so clouds in aurora photos are mostly dark silhouettes, sometimes faintly green [9]. "Aurora barely shows on clouds" is right from below. The bug is the stand-in sun lighting the clouds instead. |
| D17 | Bug (re-measured) | 9 of 45 Norway and Greenland landform days are volcanoes (6 strato, 3 shield). Neither coast has one (Jan Mayen is not on our coasts). |
| D18 | Bug (re-measured) | 32 of 63 tropical landform days show snow below 3 km. Real tropical snow lines: Ecuador 4.8–5 km, New Guinea 4.6–4.7 km, Kilimanjaro 5.5–5.6 km [10]. |
| D19–D23, D25 | Real gaps | Each is a real thing we don't draw. |
| D24 | Bug | No palms grow outdoors in Iceland; its beaches are black basalt. (Not re-measured: plants need `--rendered`.) |
| D26 | Feature | A 2–5 cm pebble is under a pixel past ~10 m: a photo shows mottled colour too. Only the framing choice is open. |
| D27 | Partly feature | A large halo round a bright lamp in fog is real (droplet scattering, fogbows round bright lamps) [11]; check only its size. A lit lantern darker than the dusk sky is a bug (it's the brightest thing in dusk photos). Divergence: check. |
| D28 | Partly feature | Clouds over cities look orange or red in photos, from sodium light; LEDs shift the glow bluer [12]. Mild warmth is right for LED-heavy places, too mild for sodium-heavy ones. Decide with B2. |
| D29 | Unknown | Suspected, not seen. |
| D30 | Bug | A bolt leaves a cloud base; it can't hang in clear air. |
| D31 | Unknown | Needs night storm photos. Under town light a base shows its structure from below. |
| D32 | Feature (likely) for the stand; bug for the tint | NSW plots: tall eucalypt forest averages ~29% tree canopy cover, low sandstone forest ~21% [13]. Open crowns are realistic. Measure crown cover in frame before adding trees. The flowering twin's missing spring tint is a bug. |
| D33, D34 | Real limits | Accepted simplifications (far gauges, M4, one calibration point); low priority. |
| D35 | Real gap | Bergs in a rough sea have a wash band and foam like rocks. |
| D36 | Real gap; bug (3) | Exposed conifers are flagged: the windward side dies back and branches survive to leeward (Sitka spruce "sideways teardrops") [14], not a squat cone. Hero trees cut to 5 m in framed shots is a placement bug. |
| E1, E2 | Engineering | No look question. |

Sources:
1. Moonlight colour and night white balance: [National Parks at Night](https://www.nationalparksatnight.com/blog/2017/6/14/how-to-choose-the-right-white-balance-for-night-skies), [Photography Life](https://photographylife.com/photographing-landscapes-under-full-moon), [moonlight vs sunlight experiment](https://kartick.substack.com/p/did-you-know-that-moonlight-is-actually-16-12-09).
2. [Stockdon et al. 2006, USGS](https://pubs.usgs.gov/publication/70030520).
3. [NWS Key West waterspouts](https://www.weather.gov/key/Waterspouts), [AMS 2020, Devanas & Stefanova](https://ams.confex.com/ams/2020Annual/webprogram/Handout/Paper367552/AMS2020DevanasStefanova1185.pdf), [NWS Miami waterspout forecasting](https://www.weather.gov/mfl/waterspout_fcsting).
4. [Albert et al. 2016, ACP](https://acp.copernicus.org/articles/16/13725/2016/acp-16-13725-2016.pdf).
5. [Dally et al. 1985, JGR](https://data-ww3.ifremer.fr/BIB/Dally_etal_JGR1985.pdf), [Rakha & Kamphuis 1995](https://data-ww3.ifremer.fr/BIB/Rakha_Kamphuis_CE1995.pdf).
6. [Kench et al. 2009, Marine Geology](https://ftp.soest.hawaii.edu/coastal/Climate%20Articles/Kench%20et%20al%20Marine%20Geology%202009.pdf).
7. [WMO Cloud Atlas: arcus](https://cloudatlas.wmo.int/en/clouds-supplementary-features-arcus.html).
8. [Sky brightness at zenith during the January 2019 total lunar eclipse, JAAVSO](https://apps.aavso.org/jaavso/article/3471/), [HPWREN, March 2026 eclipse](https://www.hpwren.ucsd.edu/news/20260307/).
9. [APOD: aurora over clouds](https://science.nasa.gov/image-article/apod-2021-may-30-aurora-over-clouds/).
10. [Snow line (Wikipedia)](https://Www.wikipedia.org/wiki/Snowline).
11. [Atmospheric Optics: lamps and fogbows](https://www.atoptics.co.uk/blog/lamps-fogbows/).
12. [Kyba et al. 2012, MNRAS (red is the new black)](https://academic.oup.com/mnras/article/425/1/701/1003276), [phys.org summary](https://phys.org/news/2012-08-red-black.html).
13. [NSW south coast vegetation plots (Frankfurt repository)](https://publikationen.ub.uni-frankfurt.de/opus4/files/29319/_Cun113TozApp3_part_E.pdf).
14. [USDA ecological site: coastal Sitka spruce](https://edit.sc.egov.usda.gov/catalogs/esd/004A/F004AA402WA), [Krummholz (Wikipedia)](https://en.wikipedia.org/wiki/Krummholz).

---

## A. Cheap checks (one or two renders each)

### A1. [x] Pale smear on the big island, 2024-05-16
- **Closed 2026-11-20, not reproduced:** `clear-islands` at 1080p, 16 frames, `--zoom-at 1650,600`: the
  right edge is clean against the sky; only the wash band's warm line and the karst face's texture.
- **Problem:** a pale, semi-transparent smear on the right edge of the big island.
- **Known:** seen in passing in REFLECTION phase 0 (`clear-islands` in `scenes/reflection.json`),
  there before the reflection work. Not investigated.
- **Research:** none.
- **Steps:**
  1. Render `clear-islands` at 1080p (`snapshot.mjs --w 1920 --h 1080 --scene …`). Find the edge's
     pixels from `params.mjs --scene … --project islands --above 20`, and look closer with
     `diff.mjs --a DIR --b DIR --zoom-at X,Y`.
  2. Switch suspects off one at a time on that spec, one `diff.mjs --off` each: `passes.aerial`,
     `passes.clouds`, `passes.skyFill`, `passes.reflection`, the island's spray/wash props.
  3. Probe the smear and the rock beside it (`{world}` points): added light, or partial alpha?
  4. Fix in the pass that owns it, under a switch.
- **Done when:** the smear is gone in a `--zoom-at` crop, or explained and recorded as intended.
- **Size:** ½.

### A2. [x] Sparkly dots in the air over the sea, 2026-02-13
- **Closed 2026-11-20:** at `--frames 1` bright specks fringe the cloud gaps (the clouds' per-frame
  noise); 16 frames and 4K are clean. Regression spec: `golden-broken-cloud-edges` in
  `scenes/examples.json`.
- **2026-11-19:** a 1080p, 16-frame render of the date at HEAD (golden hour, sea cliffs, Southern
  Ocean) shows no dots in the air. Left: one look at `--frames 1` and 4K before closing.
- **Problem:** sparkling dots hang in the air over the sea.
- **Known:** seen once (KNOWN_ISSUES "Sky"). Not traced.
- **Research:** none.
- **Steps:**
  1. `snapshot.mjs --w 1920 --h 1080 2026-02-13`; zoom in on a cluster (`diff.mjs --zoom-at`).
     Render with `--frames 1` too: dots that change between 1 and 16 frames come from a
     stochastic pass.
  2. What's in the air that day: `params.mjs --each 'p => JSON.stringify({weather: p.weather.kind, storm: p.storm, fog: p.fog, rainbow: p.rainbow})' 2026-02-13`.
  3. Switch candidates off one by one (`passes.clouds`, `passes.bloom`, `storm`/`fog` spec fields,
     spray props, `passes.stars` if it's dusk); the switch that removes them names the cause.
- **Done when:** gone on that date, and the date added to a scene file as a regression spec.
- **Size:** ½.

### A3. [x] Sailboat drawn as a bare, steeply tilted mast, 2026-05-01
- **Closed 2026-11-19:** rendered at HEAD (1080p, 16 frames, `--crop ships`): both boats rigged
  and upright at 155 m. Heel is bounded (≤ 0.25 rad + the wave roll, `ships.ts`). The entry was
  older than the floating-hull work.
- **Problem:** a sailboat shows as a bare mast leaning steeply.
- **Known:** seen once (KNOWN_ISSUES "Props"). Not traced.
- **Research:** none.
- **Steps:**
  1. `params.mjs --project ships --rows 5 2026-05-01`: which kind, where, how far.
  2. `scripts/render/mesh.mjs` on that kind at real size: are the sails there?
  3. Read the heel and roll for that day's wind and the boat's size (`props/ships.ts`, roll
     resonance, wind heel): a steep tilt points at heel × roll overflowing; missing sails at a
     sail-state choice.
  4. Fix; a `test/ships.test.ts` row (heel bounded, sails present when under way).
- **Done when:** the boat is upright and rigged on that date; the test passes on all ship days.
- **Size:** ½.

### A4. [~] Calm sea slightly dark within 1° of the horizon
- **2026-11-21, causes measured** (`horizon.mjs`, `--az -10`): not the swell (0.01 m: same) nor the
  box (`--half 0`: same). (1) The Fresnel term uses the face-the-viewer normal (NoV ≥ ~0.05), so
  F ≈ 0.78 within ~3° of grazing: with F from `skyNormal` (tried, reverted) 0.3° reads 0.76, not
  0.62, and with `passes.seaHaze` off the sea matches the cube. (2) The rest is B1's (1 − T)² haze
  (raw 0.135 → 0.109 at 0.3°). **Decision:** fixing (1) brightens every sea near the horizon ~20%.
- **Problem:** calm water just under the horizon reads 0.62–0.77 of Fresnel × sky; ~1 at 2°.
- **Known:** measured with `horizon.mjs` (2003-03-11 broken, calm sea, 0.135). Cause suspected:
  the 0.2 m swell tilting facets toward higher, darker sky, or the probe box mixing pixels across
  the horizon line.
- **Research:** none.
- **Steps:**
  1. `horizon.mjs` with `"swellHeight": 0.01` in the spec, and with `--half 0` (single pixels).
     If the ratio reaches ~1 without swell, it's physical: close as intended. If only `--half 0`
     fixes it, it was the measurement.
  2. If neither: compare `cubeProbe` at lod 1.7 (the sea's lookup at its 0.02 roughness floor) with
     lod 0 at +0.3° to +1°: a blurred steep gradient also reads low.
- **Done when:** the cause is measured and recorded in KNOWN_ISSUES (or fixed).
- **Size:** ½.

### A5. [~] Sky cube 1.3× too bright at +4° under broken cloud
- **2026-11-21, cause measured:** the cube's `medium` preset has no `lightShafts`, and they need
  the main frame's frame count: cube/sky at +4° / +8° (overcast) 1.35 / 1.76 now; shafts + full
  frames 1.08 / 1.21; `high` + full frames 1.05 / 1.09; frames alone, shafts alone, sun-sky light,
  turbulence each ≥ 1.25 at +4°. `high` + full frames: +40–61% render time on cloudy days and a
  darker sea (2024-04-24 mean Δ 30). Open: a shafts-only cube at fewer frames, benched;
  **decision** (cost and look). Details: KNOWN_ISSUES "Sky".
- **Problem:** the cube the water reflects is 1.3× the frame's sky at +4° under broken cloud
  (equal at ≤ 1°).
- **Known:** measured with `cubeProbe` / `horizon.mjs` (2003-03-11 broken). Cause suspected: the
  cube's clouds drawn at `medium` quality with fewer frames (`renderCloudyEnvironment`,
  `envFrames` in `scene.ts`).
- **Research:** none.
- **Steps:**
  1. Temporarily give the cube `high` quality and the main frame's frame count; rerun `horizon.mjs`.
  2. If cube/sky → 1, it's quality: measure the cost (`bench.mjs`); if > 2%, try only more frames.
  3. Check an overcast day too before deciding.
- **Done when:** cube/sky within ~5% at +4° on broken and overcast, at ≤ +2% render time, or the
  gap recorded as accepted.
- **Size:** ½.

---

## B. Decisions to make (measure first, then ask)

### B1. [ ] takram's haze fades land as (1 − T)², not (1 − T)
- **Problem:** mid-distance land is darker than real haze would leave it; the sea's mirror images
  copy this (`ocean.ts` `reflectionHaze`).
- **Known:** measured with `haze.mjs` (2003-03-11, islands at 2.8 and 7.5 km: one haze colour only
  with (1 − T)²). The clouds pass mixes an inscatter already scaled by its opacity, by the opacity
  again.
- **Research:** 2–3 reference photos of hazy islands or headlands at known distances (2–30 km), to
  compare how far contrast falls with distance against both weightings.
- **Steps:**
  1. `haze.mjs` on 3–4 days (clear with dust, broken, overcast, a 30 km+ mountain): the colour
     difference between the two weightings at 3, 10 and 30 km.
  2. Compare with the photos. **Decide** (397 of 456 far-object days change).
  3. If yes: patch the clouds pass to mix by the opacity once (`seaHaze.ts` `applySeaHaze`,
     `HORIZON_INSCATTER`), switch `seaHazeLinear`, and change the mirror's haze to (1 − T) under
     the same switch.
- **Done when:** `haze.mjs` shows (1 − T) giving one haze colour; mirror images re-measured
  (world/mirror probes on `calm-islands`).
- **Size:** 1 after the decision. **Decision:** yes.

### B2. [ ] Night frames' colour
- **Problem:** the night white balance (`NIGHT_WHITE_BALANCE_K`, gains 0.67, 1.02, 1.77) turns
  moonlit white sand deep blue (exposed B/R 2.3); a starlit cloud deck is lit blue (the stand-in
  sun's Bruneton colour), not by the airglow's green; birds stay sharp in 30–130 s exposures.
- **Known:** measured in SHADOWS phase 6 (2026-11-07). Unchanged pending a decision.
- **Research:** moonlight's spectrum and colour temperature (~4100 K) against a camera balanced at
  ~4000 K; the airglow's colour on a cloud deck (OI 557.7 nm green); 2–3 reference photos of
  moonlit beaches and starlit cloud decks in long exposure.
- **Steps:**
  1. From the research, the white balance the night camera should use; probe the sand before and
     after.
  2. **Decide** (touches all nights). Then, each under its own switch:
     - white balance from the moon's spectrum (re-check D28's town-light warmth with it);
     - the starlit deck's light tinted by airglow (with D16's stand-in fix);
     - birds hidden or streaked past ~5 s of shutter (`frameMeter` knows the shutter).
- **Done when:** moonlit sand near-neutral by probe; the photos and renders compared side by side.
- **Size:** 1–2. **Decision:** yes.

### B4. [ ] Beach-state shares vs Australia's census
- **Problem:** transverse bar–rip is under-drawn, longshore and dissipative over-drawn.
- **Known:** measured against the census; a retune is proposed in COASTS.md "Beach state and tides".
- **Research:** done (COASTS.md).
- **Steps:**
  1. **Decide** (changes every beach day).
  2. Apply the proposed table; `params.mjs --ref HEAD --stats 'p => p.coast.state'`; update the
     `realDays.test.ts` shares; a contact sheet of the states.
- **Done when:** shares match the proposal within `expectShare`'s tolerance.
- **Size:** ½ after the decision. **Decision:** yes.

### B5. [ ] Run-up by beach state
- **Problem:** run-up ignores the beach's slope: on flat dissipative beaches the high-tide line lies
  ~35 m and the storm line up to ~120 m inland; on steep gravel ~1 m.
- **Known:** measured with `profile.mjs` (Namibia 2024-06-11).
- **Research:** Stockdon et al. 2006 (run-up ∝ slope·√(H0·L0) on steep beaches, ∝ √(H0·L0) on
  flat ones): the formula, its fit range, and measured run-ups on a dissipative and a reflective
  beach to check against.
- **Steps:**
  1. Encode run-up from `beachSlope`, swell height and period; unit-test it against the research's
     numbers. First compare today's lines with Stockdon on both beaches: on dissipative beaches
     run-up doesn't depend on slope, so the wide flat-beach band may already be right (see
     "Problem or feature?").
  2. **Decide** (re-tunes the wrack lines on every beach day).
  3. `profile.mjs` on Namibia 2024-06-11 and a gravel day before and after; update `beachLines` and
     the wrack and debris placement that reads it. The ebb-and-flow band (0.206, `tideFlowFor`)
     sits between the swash and the last high water: check it moves with the new lines.
- **Done when:** both test beaches' run-ups within the research's range; wrack lines placed from the
  new run-up.
- **Size:** 1. **Decision:** yes.

### B6. [~] Waterspouts: inside fog (fixed 0.209), and far too rare
- **Problem:** a waterspout can appear inside fog (it's chosen before `pickFog`; `params.ts` ~line
  1987 passes `fog: false`); spouts come about once in 3 years, not the documented ~0.5% of days.
  The Florida Keys get the Mediterranean's waterspout season (biome-keyed).
- **Known:** measured; plans/WATERSPOUT_FOG.md.
- **Research:** check the plan's numbers on waterspout climatology (frequency by region and month)
  are sourced; add a source if not.
- **Steps:**
  1. Choose the waterspout after `pickFog` (`params.ts`); drop the fog when a spec forces a spout; a
     test.
  2. **Decide** the rate: option A (2–5 a year, raise the peak-month chances; recommended in the
     plan) or B (keep, fix the docs).
  3. Key the season by place or climate, not biome (ARCHITECTURE.md "Biome, climate or place").
- **Done when:** a test checks the real rate over `allParams()` and no spout day has fog.
- **Size:** ½. **Decision:** yes (the rate).

---

## C. Reflection follow-ups (plans/REFLECTION.md)

### C1. [~] Render a rock pool beside a boulder
- **Problem:** REFLECTION phase 5's check ("a pool mirrors the nearby boulders and the cliff") was
  never rendered: every pool in `scenes/wet-mirror.json` is 50 m+ off.
- **Known:** measured (the specs' framing). The tools to find one are built (plans/WATER_VIEW.md
  steps 1–3, 2026-11-12): `terrainView: 'water'`, `debug.water` (pixels per film kind, nearest pool
  in m with its pixel count), `debug.terrainProbe`, `scripts/measure/parity.mjs`.
- **Research:** none (reference photo P, a rock pool at Urvaig, is in plans/REFLECTION.md).
- **Steps:**
  1. `snapshot.mjs --where 'p => p.coast.rock' --sample 30`, then `summary.mjs … 'j => j.debug.water.nearestPoolM'`
     (ignore one-pixel hits) to find a day with a pool within ~15 m beside a boulder.
  2. Add it to `scenes/wet-mirror.json`; render and compare with photo P.
- **Done when:** a near pool's mirror image of a boulder is rendered and judged; WATER_VIEW and
  REFLECTION closed.
- **Size:** ½.

### C2. [~] Sun glitter width on windy days vs Cox–Munk
- **2026-11-21, measured** (forced: open sea, clear, 10 m/s, sun 15° ahead, `probeLine` across
  the glitter at el −13 and −15, e⁻² of the peak over the background): wind across the view
  ±8.4° against Cox–Munk's upwind ±11.0° (−24%); wind along the view ±8.1° against crosswind
  ±9.2° (−12%). The width hardly follows the wind's direction: Cox–Munk's upwind/crosswind
  variance ratio (1.42) is missing (isotropic GGX roughness and/or spreading). Next: step 4,
  `rippleSlopeScale` and the roughness's anisotropy.
- **Problem:** phase 1 judged the glitter's width by eye; it was never measured.
- **Known:** not measured.
- **Research:** none (Cox–Munk σ² = 0.003 + 0.00512·U is in REFLECTION.md §1.2).
- **Steps:**
  1. Find a ~10 m/s day with the sun ~20° up in front (`params.mjs --where … --sample`).
  2. Predict the glitter's extent: ±2σ of slope around the sun's mirror point, as elevation below
     the horizon.
  3. `params.debug.probeLine` down the glitter's column; where it falls to ~e⁻² of the peak.
  4. Off by > 20%: trace the ripple layers' slope scale (`rippleSlopeScale`) on that day.
- **Done when:** measured width within ~20% of the prediction, or the gap's cause recorded.
- **Size:** ½.

### C3. [ ] Far mirror images slightly off-colour
- **2026-11-21, re-measured** (`calm-islands`, world/mirror probes at 2.8–3.0 and 7.2–7.5 km, per
  channel against green): R −9…−12%, B +12…+15% (bluer than 0.135's +5…+9%). With A4's Fresnel
  fix (tried, reverted) the images get ~17% brighter but the tint stays (R −9…−11%, B +10…+13%):
  not the water body's share; the haze target, as the task says. Do with B1 (same haze term).
- **Problem:** far islands' mirror images run red −14…−20% and blue +5…+9% against Fresnel × the
  island.
- **Known:** measured (world/mirror probes, `calm-islands`, 0.135). The image fades toward the sky
  the ray mirrors, which is bluer than takram's haze colour (clear sky at +0.02 rad × `hazeLight` ×
  `hazeTint`).
- **Research:** none.
- **Steps:**
  1. `haze.mjs` gives the frame's haze colour per point; compare with `cubeProbe` along the mirrored
     ray.
  2. Try fading toward the cube at +0.02 rad in the ray's azimuth (lod 0), × `hazeLight` only where
     the cube isn't drawn through the haze (clear days without dust). Re-measure both islands.
  3. Keep land lost in haze (the 37 km volcano, T ≈ 0.01) vanishing into the sea: no bright patch
     (phase 4's ovals).
- **Done when:** both islands within ~10% per channel; no patch under the volcano.
- **Size:** ½–1.

### C4. [x] Speckled lightning in wet sand
- **Fixed in 0.214:** the speckles were glints of the bolt on frozen waves (physical), drawn as
  2×2 blocks by the half-size mirror; the mirror is full size on bolt days (`passes.boltMirror`).
- **2026-11-20, measured:** at HEAD 2025-04-25's swash film shows no bolt (`passes.wetMirror` off
  changes only a faint strip at x 908–1914); the camera moved since (0.200–0.202). The speckle now
  shows on the **sea** under the left bolt: white 2×2 blocks in a column along the breaker band
  (gone with `passes.reflection` off). Tried and reverted: sizing `mirrorAlongRay`'s blur from
  the landed object's distance (`max(t, hazeT)`): the specks stayed (0.066% of the frame changed,
  none of it them); the reflection and wet-mirror spec sets changed ≤ 0.8%, contact lines intact.
  So the blur's depth is not the cause here. Leading explanation (not yet measured): the bolt is a
  ~3 px, ×250-bright line; the streak lookup blurs it vertically but only ×sin(grazing) sideways
  (~1 texel), and each pixel's wave normal moves the lookup sideways onto or off it: a column of
  glints, as on real water, but each glint is a whole texel of the **half-size** mirror target
  (`reflection.ts`), hence 2×2 blocks. Next step: probe one speck and its neighbours
  (`debug.probe`, `probeHalf: 0`); then try a sideways blur floor for very bright mirror texels or
  a wider bolt core in the mirror pass only.
- **Problem:** a lightning bolt mirrored in the swash film is speckled and blocky, not a soft streak.
- **Known:** measured (2025-04-25, storm on vs off). The film's blur is sized from the mirror depth
  at the unshifted point (trees tens of metres away), not the bolt kilometres away.
- **Research:** none.
- **Steps:**
  1. In `mirrorAlongRay`, size the blur from the depth where the ray lands (`hazeT`), or the larger
     of the two; under a switch.
  2. Check contact lines stay sharp (`near-objects-calm`, `swash-rocks`) with `--zoom-at`.
- **Done when:** a soft streak on 2025-04-25; contact lines unchanged.
- **Size:** ½. Storm days with a bolt in frame only: low priority.

### C5. [x] Far land mirrored about a flat plane
- **Closed 2026-11-20:** `mountain-calm` at ×4 (`--zoom-at 1200,384`): the range (27–34 km) meets
  the horizon with no gap or offset; accepted as invisible.
- **Problem:** the mirror is the plane y = 0, not the curved sea (82 m of drop at 34 km).
- **Known:** judged invisible at the distances seen so far.
- **Research:** none.
- **Steps:**
  1. Look for a gap or offset at the waterline of `mountain-calm` with `--zoom-at`. Only if one shows:
     mirror about the local sea height (`curvatureDrop` at the hit's distance) in the lookup.
- **Done when:** checked; fixed or closed.
- **Size:** ¼.

### C6. [ ] Reflection features from REFLECTION "Later" (each needs its own plan)
- **Calm in the lee of islands and headlands.** Research: the wind-shadow extent (REFLECTION.md
  §1.4: 7–15× the obstacle's height downwind) and how the short waves recover past it. Build: a
  wind-shadow mask beside `shelter.ts`, damping the short cascade and the ripple layers.
- **Natural slicks.** Research: how often surfactant slicks occur, their width and length, and the
  wind range they survive (Cox–Munk's slick fit is about a third of the clean slope at 10 m/s).
- **Mirroring ice.** Research: reflectance and roughness of new ice (nilas) and melt ponds (Malinka
  2018: ponds up to 60% of multiyear ice in summer); reference photo F. Today `seaIce.ts` is matte.
- **Whitecap coverage.** Research: none new (Monahan & O'Muircheartaigh 1980, W = 3.84·10⁻⁶·U^3.41:
  1% at 10 m/s). Measure ours (`ocean.ts` `whitecaps`, `ships.ts` `whitecapFraction`) and compare;
  whitecaps don't read on 2003-03-11.

---

## D. Bugs and gaps by area (from KNOWN_ISSUES.md)

### Lighthouses

#### D1. [x] Title says "lighthouse" but none is built
- **Fixed in 0.210:** the cause was the rock-site search (NDC y ≤ 0.05) under horizons above the
  frame's middle; 15 of 92 days. Test in `test/lighthouse.test.ts`.
- **Problem:** on 14 of 92 lighthouse days (9 open sea, 4 beach, 1 rock shore) `createLighthouse`
  finds no site and builds none (`2024-05-13`).
- **Known:** measured (2026-11-07).
- **Research:** none.
- **Steps:** make the title follow what was placed, or widen the site search; a `realDays.test.ts`
  rule "title says lighthouse ⇒ one is built".
- **Done when:** the rule passes on every day. **Size:** ½.

#### D27. [~] Lighthouse leftovers after the candela lamp (0.196)
- **0.221:** (2) done: the lit glazing is glass (standard material, sky reflection, the glow as
  `emissive`; `passes.lanternGlass`). Left: (1) the fog halo's size and (3) the divergence.
- **2026-11-20:** the glazing's 90 cd/m² is physical (2 000 lm stray over ~5.5 m²); a sunset sky is
  1 000–5 000 cd/m², so a lit lantern is dimmer than it then. The defect: the lit glazing is a
  `MeshBasicMaterial` glow with no sky reflection. Next: a standard material (props get
  `scene.environment`) with the glow as `emissive`; `setGlowBrightness` sets `.color` today.
- **Problem:** judged by eye, not measured: (1) the forced rock light in night fog
  (`{"date":"2025-07-10","timeOfDay":"night","lighthouse":"rock","fog":"advection"}`) keeps a large
  forward-scattered halo, its size unchecked; (2) at sunset the lit glazing (90 cd/m²,
  `LANTERN_SIDE_CD` an estimate) is darker than the sky behind it and shows as a dull band, with no
  sky reflection on the glass; (3) the beam divergence stays 2.2° (e-fold half-width; Sabik's LED
  beacon is 1.5° full width at 5%, classic lenses wider).
- **Known:** KNOWN_ISSUES "Light and frame" (2026-11-19).
- **Research:** 2–3 photos of a lighthouse in night fog and of a lantern at sunset; lantern glazing
  luminance; beam widths for classic Fresnel lenses vs LED beacons.
- **Steps:**
  1. Halo: measure its radius on the fog spec (`probeLine` across it), compare with the photos.
  2. Glazing: a sky reflection on the lantern glass (env cube, Fresnel); source `LANTERN_SIDE_CD`.
  3. Divergence: pick by light type (lens vs LED) if the research gives a clear split.
- **Done when:** each compared with a photo, fixed or recorded as right. **Size:** ½.

### Surf and reefs

#### D3. [ ] Waves re-form at full height behind sandbars
- **Problem:** surf is local-depth only, so broken waves re-form behind a bar.
- **Known:** by design (KNOWN_ISSUES). Real broken waves decay toward ~0.4 × depth (Dally et al. 1985).
- **Research:** known (Dally et al. 1985); check the decay length.
- **Steps:** decay the wave height after breaking, or extend the shelter mask to bars;
  `profile.mjs` before and after on a barred day.
- **Done when:** waves behind a bar stay below the decay curve. **Size:** 1. **Decision:** yes
  (every barred day).

#### D4. [ ] Longshore bars without a trough
- **Problem:** OzCoasts gives a 2–3 m trough behind the bar; our bare profile has ~1 m.
- **Known:** measured against OzCoasts.
- **Research:** known (OzCoasts).
- **Steps:** deepen the trough in the bare profile (`terrain.ts` heights and `beachHeight`, plus the
  readers in arch/COAST.md "A new seabed or shore profile"); `profile.mjs`, `parity.mjs` and
  `expectDryCameras`.
- **Done when:** trough 2–3 m on longshore-bar days. **Size:** ½.

#### D5. [ ] Emerged rip channels look like shelves at low tide
- **Problem:** at low tide the emerged inner bar and rip channels show as straight-edged shelves
  (`scenes/tides.json` brittany-low).
- **Known:** seen in renders; they were shaped to be seen underwater.
- **Research:** 2–3 reference photos of low-tide rip channels on a terraced beach.
- **Steps:** soften their edges above the water (height-dependent smoothing); diff brittany-low.
- **Done when:** compared with the photos. **Size:** ½.

#### D6. [ ] Reef lagoon gets no swell through its pass
- **Problem:** the reef's shelter is a straight line, so swell through a pass doesn't spread into
  the lagoon (the pass is only deeper, no white water).
- **Known:** by design (KNOWN_ISSUES).
- **Research:** how swell spreads through reef passes (diffraction, the lagoon's wave height a pass
  width in).
- **Steps:** a shelter gap at the pass, widening with distance into the lagoon; `profile.mjs`
  top-down map.
- **Done when:** lagoon waves behind a pass follow the research's spread. **Size:** 1.

#### D7. [ ] Reef crest foam is a timed band, not breaking waves
- **Problem:** the crest foam is timed with the surf cycle; against a low sun ahead it fades into
  the glare.
- **Known:** by design (KNOWN_ISSUES).
- **Research:** 2–3 reference photos of waves breaking on a reef crest, front-lit and backlit.
- **Steps:** drive the foam from the surf model's breaking (it breaks on a ~2 m strip of the steep
  face); check backlit.
- **Done when:** compared with the photos. **Size:** ½.

#### D35. [ ] Icebergs and island wash
- **2026-11-21, step 1:** `params.mjs --find ice`: bergs within ~120 m on 5 real days (2025-09-01
  46 m, 2025-05-22 75 m, 2024-11-11 97 m, 2024-03-31 106 m, 2026-08-22 116 m; 64–75 px). Step 2
  (tag `waterline`) is the build.
- **Problem:** icebergs get the contact reflection but no wash band or island foam (not
  `waterline`-tagged). Island spray bursts are few-centimetre droplets, faint specks at ~850 m (the
  wash band carries the rough-sea look). All islands of a day share one wash-band material.
- **Known:** KNOWN_ISSUES "Coast and surf" (by design).
- **Research:** none.
- **Steps:**
  1. `params.mjs --find iceberg` (or `--count`) for how near bergs come on real days.
  2. Tag bergs `waterline` so they get the wash band and foam; `diff.mjs` on a rough-sea berg day.
  3. Per-island wash material only if a day with two islands at different exposures shows a mismatch.
- **Done when:** a berg on a rough day has a wash band in a `--crop`. **Size:** ½.

### Rocky shores

#### D8. [ ] No terrain shadows past ~470 m
- **Problem:** cliffs and ledges beyond ~470 m ahead cast no shadow on the terrain: the land shadow
  map has props only (the near map has the terrain caster since SHADOWS).
- **Known:** by design (KNOWN_ISSUES "Rocky shores", plans/SHADOWS.md).
- **Research:** none.
- **Steps:** put the terrain caster in the land shadow map (or ray-march the height field toward
  the sun past the near map); `params.mjs --stats` for how many days have a cliff past 470 m in a
  low sun; bench it.
- **Done when:** a far cliff at low sun shades the land behind it; render time within budget.
  **Size:** 1.

#### D9. [~] Smaller rocky-shore issues
- **0.226:** boulder teeth fixed (the per-pixel normal on grid-crossed steps, not the grid's silhouette; `passes.terrainStepNormal`, boulder shores only). Riser notches not reproduced on a platform spec (2025-07-10 along-beach). Left: crest, bursts, speed, placement.
- **Problem / steps**, each its own small job (no research unless noted):
  - Small dark notches on near bed risers (grid aliasing; `terrainGrid: 2` halves them): denser
    rings near the camera only.
  - Boulder sides within ~5 m show a hair-like fringe of thin vertical teeth along their foot
    (2025-05-18, 1080p crop of the bottom half). Cause **suspected**: the heightfield grid sampling
    the steep step at the side's foot, like the riser notches; the 0.198 rock grain didn't change
    it. Check with `terrainGrid: 2` or `debug.terrainProbe` first.
  - A cliff's smooth crest reads as sand in low light. Research: 2–3 photos of cliff tops; then
    rock texture on the crest.
  - A platform at a cliff's foot gets no burst against the cliff behind (`edgeRocks` takes only the
    first face): look past the first face.
  - Boulder shores render up to ~20% slower (a 3×3 cell search per height sample; rocky days
    overall +8%): cache or narrow it; `bench.mjs`.
  - Colonies and point lighthouses use beach placement on rocky shores: check in renders
    (`params.mjs --project colony,lighthouse`).
- **Size:** ½ each.

### Light

#### D10. [x] Brittany sand less red than predicted
- **Closed 2026-11-21:** the camera moved since (0.200–0.202) and the old probe sat on wet sand. At
  HEAD the dry sand in cloud shadow reads raw 0.0142, 0.0143, 0.0163 (~0.012 predicted; skylight's
  blue), 0.090, 0.060, 0.040 with `passes.cloudShade` off. `cloudLight`, `skyOcclusion`,
  `shadows` off: unchanged or as expected.
- **Problem:** the sand reads (0.0069, 0.0076, 0.0112) raw against ~0.012 each predicted from
  albedo × skylight (`place: "brittany"`, 2025-07-10, along-beach, broken, sun 160°); it meters
  0.108 and isn't lifted by the frame meter.
- **Known:** measured; not traced.
- **Research:** none.
- **Steps:** probe the sand and its sky light (`debug.probe`, `skyIrradiance`, `cloudSkylight`);
  switch `passes.cloudLight`, `passes.skyOcclusion` off in turn to find the term that greys it.
- **Done when:** the cause measured; fixed or recorded. **Size:** ½.

#### D11. [~] Meter zenith 3× the cube's
- **2026-11-21, cause measured, bigger than the stat:** `meterScene` builds each texel's direction
  as `unproject(faceCamera).sub(faceCamera.position)`: a world point minus the face camera's local
  (0, 0, 0), so every direction is ≈ straight up. "Zenith" = the whole cube's average, and no texel
  is "in view", so the **exposure meter is a whole-cube average** (since the first commit). The
  cube is right (= the frame's sky at 20°). With `.sub(camera.position)` (tried, reverted): zenith
  0.0230 (cube 0.0227); exposure clear 60° +0.84 EV, 2024-07-12 +0.61, 2024-06-26 −0.98,
  2024-04-24 −0.09, 2024-02-12 −0.27. **Decision** (every day's exposure; the EV biases and the
  frame meter were tuned on the bug).
- **Problem:** `meterScene`'s zenith (`debug.skyZenith`) reads ~3× the env cube's zenith at the same
  sun (0.074 vs 0.023 at 60°).
- **Known:** measured; only a stat so far.
- **Research:** none.
- **Steps:** compare both with `cubeProbe` at el 90 and a frame `probe` straight up; decide which is
  right.
- **Done when:** the two agree or the difference is explained. **Size:** ½.

#### D28. [ ] Town light only mildly warm
- **Problem:** at the night white balance (4000 K) the light domes and the town-lit cloud bases
  (0.190) come out only mildly warm: sodium (~2100 K) stays orange, the LED share pulls them
  neutral.
- **Known:** KNOWN_ISSUES "Light and frame"; a consequence of the white balance, not of the town
  light.
- **Research:** none beyond B2's.
- **Steps:** decide with B2's white balance; then probe a Bortle 3–4 cloudy night's base colour
  against a photo of a town-lit overcast.
- **Done when:** re-judged after B2. **Size:** ¼.

### Sky

#### D12. [x] Mountain range invisible, 2016-08-09
- **Closed 2026-11-21:** the range shows, faintly: `diff.mjs --off '{"landform":null}'` changes
  2.7% of the frame (a darker band just above the horizon, mean Δ 18, max 93); `haze.mjs` gives T
  0.13–0.27 at 26–31 km (V 66 km), raw land 0.004 under 0.036 hazed: physical. Fog on or off:
  same frame.
- **Problem:** the title's range (36 km, 1.6 km high, in frame) can't be seen even with `fog: null`,
  against a 3° sun.
- **Known:** seen; not traced.
- **Research:** none.
- **Steps:** `haze.mjs` on a point of the range (`params.mjs --project landforms --above 200`): if the haze
  erases it (T ≈ 0), the title shouldn't name it; otherwise trace what hides it.
- **Done when:** the range shows, or the title follows visibility. **Size:** ½.

#### D13. [~] Shelf cloud: straight lip, backlit sunset band
- **0.223:** the lip is tattered (`shelfCloud.ts` `tatter`: narrow pointed fringes hanging from the
  underside, 35/15/7 m deep over 80/30/12 m; `params.debug.shelf.tatter`). Three look rounds: wider
  or two-sided bumps read as distant hills. Left: step 1 (the backlit sunset band) and step 3
  (front-lit tiers).
- **Problem:** the shelf is volumetric since 0.174. On far real days (2024-06-21, 2024-04-24,
  2024-07-01, 2024-12-12, 2025-02-12) it reads as a dark strip on the horizon with a ruler-straight
  top (the strip is the storm's rain; the top is the lip, which varies only over kilometres; the
  WMO's arcus has "more or less tattered edges"). Front-lit tiers barely show under a full deck. A
  backlit sunset shelf may still read as a flat pink band (2010-04-01; not re-checked since the
  volumetric shelf).
- **Known:** measured on 2024-06-21 (`edges.mjs`, shelf on and off); the sunset band suspected.
- **Research:** 2–3 photos of a distant arcus's lip; of shelf clouds at sunset, backlit.
- **Steps:** (plans/SHELF_VOLUMETRIC.md "Later")
  1. Re-render 2010-04-01; drop the sunset item if it's gone.
  2. A fine, multi-octave ragged lip (tens of metres, under ~500 m long) without the 1.2 km waves
     that read as hills; check with `edges.mjs` along the lip.
  3. Front-lit tiers: a gap in the deck over the lip on front-lit days.
- **Done when:** compared with the photos. **Size:** ½–1.

#### D14. [x] Lunar eclipse doesn't darken the drawn sky
- **Fixed in 0.224:** the night's render units take the eclipse's light (eclipsed moon + starlight and airglow), totality 20.7–21.3 mag/arcsec² on clear days; the eclipsed moon at its measured −1.4 mag (`LUNAR_TOTAL_LIGHT`). `passes.lunarEclipseSky`.
- **2026-11-20, measured:** 2025-03-14, night forced, probe at 15°: total eclipse 17.84
  mag/arcsec², eclipse off (full moon) 17.36, new moon 20.33: ~10× too bright in totality. Cause:
  the sky, clouds and haze are graded by `renderPerLux(nightSky, elongation)` (the phase), not by
  the eclipsed `params.moonlight`; only the ground light follows it. Fix: scale the moon-lit
  atmosphere by moonlight / phase (or the night's render units), under a switch; touches the 3
  total and 2 partial lunar-eclipse days in the test years.
- **Problem:** a lunar eclipse dims the moonlight (`scene.ts`), not the drawn sky, so stars may stay
  hidden.
- **Known:** written before the airglow (0.86); re-check before fixing.
- **Research:** verify first (none until it still shows).
- **Steps:** render a total lunar eclipse; probe the zenith (mag/arcsec², `debug.probe`) against
  STARS.md's values.
- **Done when:** fixed, or the entry removed from KNOWN_ISSUES. **Size:** ½.

#### D16. [ ] Aurora on clouds; grain at the arcs' edge
- **Problem:** on quiet starlit nights the aurora barely lights the clouds: the clouds pass's
  stand-in sun (`scene.ts` `starlight`, nearly overhead, a sun's strength in the night's units)
  outweighs the display's light on cloud tops. ~3% grain at the arcs' lower edge on Kp ≥ 5 nights
  (the 5 km N₂⁺ fringe). The airglow's wave crests show as faint slanted stripes on aurora nights
  (+1.5 EV, a wider frame): the airglow's, not the aurora's.
- **Known:** measured (KNOWN_ISSUES "Sky").
- **Research:** 2–3 photos of auroras lighting cloud tops or bases.
- **Steps:** replace the stand-in with a diffuse ~0.002 lux starlight (**decide**: touches every
  cloudy starlit night; do it with B2's airglow tint); for the grain, more march steps at the arcs'
  lower edge; check the airglow crests with `params.mjs --line --sky glow`.
- **Done when:** compared with the photos; grain under 1%. **Size:** ½–1. **Decision:** yes.

#### D29. [x] `stormCells.ts` near latitude ±45°
- **Fixed in 0.215:** cells no longer use the weather map's uv (world positions).
- **Problem:** it maps the weather map's uv to metres linearly; on a cube edge of the cube-sphere uv
  (at our longitude 0) that map breaks, as it did for the shelf (arch/SKY.md "takram's clouds, from
  the inside"). Cells are ≤ 9 km so it may not show.
- **Known:** suspected, not checked.
- **Research:** none.
- **Steps:** force a storm at a place near ±45° (`params.mjs --where` on latitude); render the cell
  with `debug.cloudFace`; if broken, use the shelf's fix (`cloudShapes.ts`).
- **Done when:** checked; fixed or closed. **Size:** ¼.

#### D30. [x] Far bolts without cloud, 2016-06-21
- **Fixed in 0.215:** the storm cells were kilometres off their strikes (uv placement vs takram's
  `altitudeCorrection`); now placed by world position, and their base darkened (`STORM_SKY_LIGHT`).
- **Problem:** with the bolt 5.7 km off and mountains behind, takram draws almost no Cb near its
  600 m base over the bolt, so the bolt's top hangs in front of the range and its flash has no face
  to light.
- **Known:** measured with `debug.cloudFace`: the ray to the base under the exit first meets cloud
  6.3 km out at 340 m (beyond the bolt). Cause not traced (the storm cell's fill at that distance,
  or takram's height shaping).
- **Research:** none.
- **Steps:** `params.mjs --project storm` for the cell's radius and fill at the bolt; probe the
  weather map's density there; fix the fill so a bolt always stands under ≥ 1 km of full cell.
- **Done when:** the bolt meets cloud at its top on 2016-06-21. **Size:** ½.

#### D31. [x] Night storms: flat Cb base, brown strip under it
- **0.222–0.223, the cause was the shelf cloud** (`shelfCloud: false` removes the bands; the
  "wall" below is its face, under the 600 m base), not the cell's side as measured below. The flash
  now lights the shelf (`passes.flashShelf`, 0.222) and its lip is tattered (D13, 0.223). Left, a
  new item: **scud in front of a bolt stays unlit** (2026-08-20, left bolt: scud at ~380 m,
  5.4–5.8 km out, hides it; the flash's face rule skips scud below the base). Lighting scud near a
  bolt changes storm days: a decision. The town dome's brown strip under the shelf stays (real).
- **2026-11-20, measured** (`cloudFace` probes, 2026-03-27, x 1343): still there after 0.215. y 300–360: the
  cell's base, 600 m at 5.6–6.7 km; y 375–465: a vertical wall at a constant 6.3 km, height 558 → 342 m
  (the cylindrical cell's side, edge-on, lit only from above at night); y 480–584: the far deck's base,
  12–55 km, lit brown by the towns. The hard edge is the cell's flat bottom. Fix: a ragged base and
  rain under the cell, maybe its night light; a look change: ask first.
- **Problem:** a night storm's Cb base reads as flat bands receding to the horizon (2026-08-20,
  2026-03-27): lit only from above by the moon or the stand-in, it has no detail, and the gap of air
  under it shows the town dome as a brown strip with a hard top edge.
- **Known:** seen by eye with `passes.clouds` off and on (0.189); cause in the clouds' night light,
  not measured further.
- **Research:** 2–3 long-exposure photos of a storm base at night (moonlit, town-lit).
- **Steps:** probe the base and the strip (`debug.probe`, `cloudFace`); check the town light
  (`passes.townLight`) and the dome's top edge against the deck's base height; likely with D16's
  stand-in fix.
- **Done when:** compared with the photos. **Size:** ½–1.

#### Not a task (watch): the sea near the horizon
A4 and A5 cover it.

### Content and places

#### D17. [~] Landforms chosen by biome, not place
- **0.212:** no volcanoes on 20 cool coasts without one in sight (`NO_VOLCANOES`; 18 days). Left:
  subtropical places on the Mediterranean's odds (TERRAIN_FORMS phase 4).
- **Problem:** nordic places without volcanoes (Greenland, Norway) draw one on ~6% of landform
  days; subtropical places get the Mediterranean's volcano odds; `ISLANDS` too.
- **Known:** measured (KNOWN_ISSUES "Places, seasons, snow"); re-measured 2026-11-19: 9 of 45
  Norway and Greenland landform days are volcanoes.
- **Steps:** plans/TERRAIN_FORMS.md phase 4 (per-place landform table after phase 0's relief data).
- **Size:** TERRAIN_FORMS phase 4 (2–3 h).

#### D18. [~] Snow lines
- **0.211:** tropical mountains bare (`TROPICAL_SNOW_LINE` 4.6 km; 32 days). Left: the nordic
  summer line (a decision: many days).
- **Problem:** tropical mountains get snow below 3 km (32 of 61 tropical landform days; real
  tropical snow starts far higher); the nordic 0.35–0.6 of the height is low for a temperate summer
  (west Norway ~630 m in late August is wrong).
- **Known:** measured.
- **Research:** snow line by latitude and month (tropics ~4.5–5 km all year; temperate seasonal
  lines; west Norway's summer line).
- **Steps:** key the drawn snow line by latitude and month, not biome (`pickLandform`); test it.
- **Done when:** the test's lines match the research. **Size:** ½. **Decision:** yes (SEASONS_PLAN's
  named next step; changes many days).

#### D19. [ ] Seasons gaps
- **Problem:** no leaves in the wrack; no larch (conifers stay green in autumn); tropical wet and dry
  seasons not modelled beyond the dry-grass and flamboyant windows; the distant woods' autumn tint
  (`canopyTint`) never checked in a render. More in plans/SEASONS_PLAN.md "Open problems".
- **Known:** KNOWN_ISSUES (SEASONS 0.98).
- **Research:** larch's range by place; tropical wet/dry phenology by climate (SEASONS.md has the
  approach); leaf litter in wrack by month.
- **Steps:** one small job each, following SEASONS.md's tables; render autumn landform days for
  `canopyTint`.
- **Done when:** each in a test and a render. **Size:** 1 each.

#### D20. [ ] Snow and sea-ice limits
- **Problem / steps:** plans/SNOW.md "Known limits" (smooth snowed mountains, plain white far boreal
  land, a foot's end beside a very close camera, no falling snow) and plans/SEA_ICE.md "Known
  limits".
- **Size:** see the plans.

#### D21. [ ] Generic meshes for four US Gulf species
- **Problem:** live oak, slash pine, cabbage palm and saw palmetto reuse the `broadleaf`,
  `stone-pine`, `palm` and `bush` meshes (coconut-like crowns, a generic oak).
- **Research:** 2–3 reference photos of each, with real sizes (TREES.md, BUSHES.md).
- **Steps:** a mesh each (`props/vegetation.ts`, or `asset.mjs bake` from a scan), `mesh.mjs` at real
  size, a `meshes.test.ts` row.
- **Size:** ½ each.

#### D32. [~] Forest from an overlook too sparse; flowering bush tint
- **0.219:** the flowering twin keeps the fresh tint (the tint half done). Left: the sparse forest (likely a feature).
- **Problem:** eucalypt forest seen from an overlook stands apart like a young open stand, where a
  NSW headland has a closed canopy (`scenes/eucalyptus.json` `nsw-overlook`, 0.145); tropical
  broadleaf is as sparse. A flowering bush twin skips the spring fresh-green tint (arch/PROPS.md).
- **Known:** the sparse forest **suspected**: the vegetation's shared count and clumping (`KINDS`),
  not the mesh (`mesh.mjs` at 150 m shows a full crown). The bush tint: by design of the twin.
- **Research:** 2–3 photos of coastal eucalypt and tropical forest from a headland.
- **Steps:**
  1. `params.mjs --count eucalyptus --scene nsw-overlook`: trees per hectare in frame vs a closed
     canopy's (crown width²).
  2. Raise the count or clumping per kind (`KINDS`), within the triangle budget (`--props`).
  3. Give the flowering twin the same spring tint as its base bush.
- **Done when:** `nsw-overlook` compared with the photos; budget kept. **Size:** ½.

#### D36. [~] Salt-pruning leftovers (0.199)
- **0.220:** (3) fixed differently than planned, on the user's point: tender trees don't stand in
  the spray at all (`treeSaltTolerance`); framed shots frame with what can grow there.
- **Problem:** (1) no gale browning on the seaward side of crowns (needs a weather history: "a gale
  in the last weeks"); (2) a pruned tree is its mesh scaled shorter and wider, so a pruned spruce is
  a squat cone, not a flat-topped, flagged one; (3) framed shots' hero trees can stand 1–2 m from
  high water (placed by height above `dry` only), so the wedge cuts them to ~5 m and the shot loses
  its framing (2025-05-30, Arctic Canada: four birches 14–18 m → ~5 m).
- **Known:** found by `diff.mjs --off '{"props":{"saltShear":false}}'` on real days.
- **Research:** (1) how long salt burn shows after a gale; (2) photos of wind-flagged spruce.
- **Steps:** (3) first: place framed hero trees by distance from high water too (or exempt them,
  if a real framing tree would stand there); `params.mjs --ref HEAD --count` for framed days
  changed. Then (2) a flagged crown for pruned conifers; (1) only with a weather history.
- **Size:** ½ each.

#### D22. [ ] Tidal flats rare; Wadden dikes, marsh flooding and details
- **Problem:** tidal flats are only ~0.3% of days. Wadden marshes have hills behind, not sea dikes,
  and get conifers and birch; Mont-Saint-Michel can draw skerries and conifer islands; the flooded
  flat in front of a marsh beach keeps the open sea's swell; driftwood heaps on marshes in treeless
  bays. A salt marsh never floods in a surge (capped 0.3 m below the marsh top, because there's no
  dike or higher ground for a camera; `test/surge.test.ts`).
- **Research:** new flat places (Severn, Gulf of Khambhat, Argentine gulfs, Gulf of Carpentaria):
  tidal range, sediment, marsh, what stands behind; what's behind Wadden marshes (dike heights).
- **Steps:** add the places (`places.ts`, TIDAL_FLAT.md); a dike backdrop for Wadden (then lift the
  surge cap so the marsh can flood in front of it); a place filter for islands and backdrop plants;
  shelter the flooded flat; no driftwood without trees upstream.
- **Size:** 1–2.

#### D23. [ ] Missing animals: seals on sandbanks, waders on flats
- **Research:** where and when (ANIMALS.md, SEASONS.md; PLAN_BIOMES phase 14, NATURE_PLAN phase 17).
- **Steps:** as phase 14 of PLAN_BIOMES.
- **Size:** part of phase 14.

#### D24. [x] Iceland: palms, brown basalt
- **Fixed in 0.218:** `ICELAND_STONES` (neutral basalt, no scoria).
- **2026-11-19:** no palms: Iceland's climate is boreal, whose pool is grass, bush and birch
  (`biome.ts`); measured on all its days (`params.mjs --rendered`: birch, bush, grass only). Left:
  the brown cobbles.
- **Problem:** Iceland (volcanic biome) gets the volcanic default plants, including palms; its
  basalt cobbles render brown (the palette mean pulled up by the red scoria entry, and exposure).
- **Research:** 2–3 photos of Icelandic black beaches.
- **Steps:** a place override for plants; Iceland's stone palette without scoria; probe the cobbles.
- **Size:** ½.

#### D25. [ ] Elephant seals and hippos up close
- **Problem:** elephant seals within ~25 m look like smooth boulders (herds keep 30 m off); hippos
  are stylised up close (barrel and boxy head). Both carry photo skins since 0.158–0.159; the shape
  is the issue.
- **Research:** reference photos with real sizes.
- **Steps:** more shape detail near the camera; `mesh.mjs --focus head` at real size;
  `test/meshLint.test.ts` rows.
- **Size:** ½ each.

#### D26. [ ] Stony beaches read flat at 1080p
- **Problem:** shingle reads as flat mottled colour on most 1080p views (a 2–5 cm pebble is under a
  pixel past ~10 m at eye height; the nearest ground is often 20–40 m); `framed` stands 15–60 m
  inland, so it never has stones in front.
- **Known:** measured (KNOWN_ISSUES).
- **Research:** none.
- **Steps:** **decide** whether a framing should stand on the shingle; if so, a composition rule
  and larger near-field stone meshes; `p.view` for how near the ground gets.
- **Size:** ½ to decide. **Decision:** yes (framing).

### Tides

#### D33. [ ] Tide curves: far gauges, no M4, forced moon
- **Problem:** places whose nearest TICON gauge is > 250 km off (Red Sea, Comoros, India, Arctic
  Canada, Yellow Sea, Andamans, …) have a typed shape with a hashed phase, not their real timing;
  the Yellow Sea especially deserves a real gauge (Incheon). No shallow-water constituents (M4): big
  estuary tides (Anchorage) are symmetric, ~7% off. A forced `moonPhaseDeg` or eclipse doesn't move
  the tide, and a forced sun elevation does (local solar time comes from the sun).
- **Known:** KNOWN_ISSUES "Coast and surf" (0.201), by design.
- **Research:** gauges (TICON or others with open constants) for the far places; M4 amplitudes for
  the big estuaries.
- **Steps:** add gauges to the table where one exists within ~250 km; add M4 where its amplitude is
  > 5% of M2; record the forced-moon behaviour in SCENE_SPECS.md (or follow the forced phase).
  `params.mjs --ref HEAD --changed 'p => p.place.id'` for the days that move.
- **Done when:** the far places listed in REGIONS.md §3.3 each have a gauge or a stated reason.
  **Size:** ½–1.

#### D34. [ ] Ebb and flow: one calibration point, no tidal currents
- **Problem:** the drain rate is calibrated on one point (fine sand, 2 m tide, Egmond); other grains
  follow Hazen's d², and the drying time (3 h) and the fringe (0.06 / d) are estimates. No reference
  photo was matched (judged on `scenes/tideFlow.json` and real days). Tidal currents (the water's
  own flow in channels and inlets) aren't drawn. Flats keep their old film.
- **Known:** KNOWN_ISSUES "Coast and surf" (0.206).
- **Research:** 2–3 photos of a seepage face on a coarse beach and of drying sand on the flood;
  measured seepage-face heights by grain.
- **Steps:** compare `scenes/tideFlow.json` with the photos (`snapshot.mjs --water`, `debug.water`
  shares); retune the estimates; give flats the ebb-and-flow film if the photos call for it.
  Tidal currents: their own plan.
- **Done when:** compared with the photos. **Size:** 1.

---

### Found while fixing (2026-11-19)

#### D39. [ ] Night surf in blue 2×2 blocks on lighthouse nights
- **Problem:** 2026-12-08 night: the surf breaks into blue 2×2 blocks against brown water.
- **Known (measured 2026-11-20):** `passes.reflection` off removes them; spray switches don't touch
  them; `lighthouse: null` removes them and the planar mirror with them. On rough surf facets the
  water flips texel by texel (half-size mirror) between the mirror's sky (brown-orange) and the sky
  cube's (blue, starlit stand-in). Both sky materials get the night glow, so the cause is not that.
- **Steps:** `{mirror}` probes and `debug.cubeProbe` at the same direction to see which sky is
  wrong; check what the mirror renders on lighthouse nights (beam haze? glow scale?); fix under a
  switch; `diff.mjs --off-here`.
- **Size:** ½–1.

#### D40. [ ] Scud in front of a bolt stays unlit
- **Problem/known:** 2026-08-20 left bolt (6.3 km): rays over its exit meet scud at ~380 m, 5.4–5.8
  km out, below the Cb base; the flash's face rule (lightning.ts) skips scud, so it stays dark and
  hides the lit base. Real scud near a flash is lit. **Decision:** changes storm days.
- **Size:** ½.

#### D41. [x] Sea stacks' dense white flecks
- **Fixed in 0.230:** the spots fade to their mean cover under a pixel (`passes.lichenFade`).
- **2026-11-21, cause measured:** the lichen spots (`props/rocks.ts`, a hard `smoothstep(0.72,
  0.78, …)` on ~0.2 m noise) aliasing at 657 m; spots off (tried, reverted) removes them (0.13% of
  the frame, only the stack). Fix: fade to mean cover under a pixel (`fwidth`); touches every
  rock: ask. Spec (rebuilt, now in `scenes/examples.json`): `stacks-shoreline`.
- **Problem:** `stacks-shoreline` spec: the stack's surface shows dense white single-pixel flecks
  (there with no spray). Not traced: the stack's skin or lichen grain. **Size:** ¼.

#### D37. [~] Spray drawn as dark square blocks
- **0.228–0.229:** all spray is a blended veil (scene pass over geometry with a 0.5 m soft-particle
  fade; `SpraySkyPass` after the clouds over sky); no screen door with `passes.softSpray`, no seam.
  Before/afters: scratchpad `show-d37/`. Left: (1) re-check the wind-blown mist (veil weight 0.3)
  on a far crest day against photos; (2) the `stacks-shoreline` spec (2025-07-10 Brittany, sea
  stacks, swell 4) zoomed after the commit was not shown to the user yet.
- **0.225:** squares and the dark low-sun shading fixed (`passes.softSpray`). Left: far spray reads as faint speckle (screen door); the 2026-12-08 night "blue blocks" are the planar mirror on lighthouse nights, not spray (KNOWN_ISSUES Props).
- **Problem:** dolphin and surf spray shows as hard 2–3 px squares, darker than the water
  (2026-05-01 blue hour round dolphins at ~150 m; 2026-12-08 night surf: blue blocky bands).
- **Known:** `SprayBuilder` (`props/surf.ts`): point sprites, `gl_PointSize = max(px, 1.5)`,
  screen-door alpha; colour = albedo × sky irradiance / π, plus the sun × `max(sunDirection.y, 0)`
  (a flat surface's term; a droplet cloud is lit by a low sun too). The water beside them mirrors a
  bright horizon at grazing, so darker spray may be partly physical at blue hour; the squares are
  not.
- **Research:** 2–3 photos of spray and splashes at dusk and at night, at ~100–300 m.
- **Steps:** probe a spray pixel and the water beside it (`debug.probe`); replace the sun term with a
  sphere's phase function; for sub-2 px droplets draw fewer, larger, fainter sprites (or a soft
  mist billboard per splash) so the mass reads as mist, not squares; `diff.mjs --off
  '{"props":{"marine":false}}'` and on surf days.
- **Size:** 1.

#### D38. [x] Wet rock in zebra bands
- **Fixed in 0.213:** bare wet rock reads the sky cube at its roughness lod (`passes.wetRockBlur`).
- **Problem:** wavy light and dark bands up a wet, sloping rock face (2026-05-01, platform edge
  25–35 m off, blue hour).
- **Known:** measured (KNOWN_ISSUES "Rocky shores"): the wet rock's sky reflection (`gloss` 0.7–1,
  brightness 0→144 with the normal); not the sea, the planar mirror, `wetMirror` or the edge
  spray. Suspected: the fixed `textureLod(envMap, R, 2.0)` for a rough surface.
- **Research:** 2–3 photos of wet basalt or sloping wet rock at dusk.
- **Steps:** read the cube at a lod from the surface's roughness (wet rock's alpha 0.35, the
  pools' near-mirror kept) under a switch; `diff.mjs --off` on 2026-05-01 and `--where 'p =>
  p.coast.rock' --sample 8`; `bench.mjs`.
- **Done when:** a soft sheen in a `--zoom-at 1250,960` crop of 2026-05-01; pools still mirror.
- **Size:** ½. Touches every wet rock (~280 rock-shore days): show the diff before committing.

## E. CI and the daily render

### E1. [ ] Half-float limits that could break SwiftShader again
- **Problem / steps**, each a watch item (nothing broken today):
  - takram's `CloudsPass` writes its front depth (sky pixels 400 km, horizon clouds 150–200 km)
    into a `HalfFloatType` target, which overflows to ∞ on SwiftShader. Harmless with
    `temporalAlpha = 1` and no temporal upscale; if either changes, clamp it as
    `cloudShadowPatch.ts` does the shadow map. A test that fails if those settings change would
    make it safe.
  - Residual NaN in the far shadow cascade on SwiftShader (2 270 texels on 2024-02-19 after 0.204),
    read as "no shadow" by the guarded read: pin its source with `nanTrace --angle swiftshader`.
  - Other shaders may hold the depth-a-hair-under-1 edge that blacked 2026-11-15: the frame meter
    zeroes NaN and warns (`frameNonFinite`); act on the first warning that names a day.
  - New bright sources: run `nanTrace` on the Mac and read `sat` (tools/DEBUG.md).
- **Known:** KNOWN_ISSUES "CI and the daily render" (read in the source and measured, 2026-11-19).
- **Size:** ¼ each.

### E2. [ ] The scheduled render finishes late
- **Problem:** the 00:05 UTC render finishes 01:10–07:43 UTC (10 days, Actions API), so in Europe
  the 07:xx desktop run often finds no picture yet and waits for its re-run (08:00 UTC or later).
  East of ~UTC+8 the desktop shows the local "yesterday" all day.
- **Known:** measured (plans/CRON.md §2.1, §7).
- **Research:** none.
- **Steps:** an odd-minute run the evening before (e.g. `'17 23 * * *'`, rendering tomorrow's UTC
  date) in `pages.yml` (agreed: a separate change); decide 4K with it. Ask to push a branch for CI.
- **Done when:** a week of runs published before 06:00 UTC. **Size:** ½.

---

## Done (removed from the list above)

- **B3. Beach cameras standing in the water:** fixed in 0.200 (wobble at the camera) and 0.202 (a
  beach camera steps inland until the drawn ground is 5 cm above the water; `realDays.test.ts`:
  every land camera above the water). KNOWN_ISSUES "Beach cameras in the water" is stale.
- **D2. Lighthouse beam power without candela:** 0.196 (`passes.beamCandela`, a 10⁶ cd lamp); the
  leftovers are D27.
- **D15. Light pollution doesn't light low clouds:** 0.190 (CLOUD_ILLUMINATION phase 7,
  `passes.townLight`); the colour leftover is D28.
- **D14 (part): starlit skies Rayleigh blue, thin crescent too dark:** no longer in KNOWN_ISSUES
  (airglow, 0.86); only the lunar eclipse is left.
- **C1 steps 1–2:** `terrainView: 'water'` and `debug.water`, built in WATER_VIEW (2026-11-12).
