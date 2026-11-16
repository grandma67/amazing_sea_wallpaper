# References

Sources behind built features. Research for planned work lives with its plan: coasts in
[COASTS.md](COASTS.md), regions/grain/tides (ranges, ebb and flow)/bioluminescence in [REGIONS.md](REGIONS.md), clouds
(WMO atlas) in [CLOUDS.md](CLOUDS.md), biomes in [plans/PLAN_BIOMES.md](plans/PLAN_BIOMES.md),
blossom, fungi, fireflies, moss, seaweed and animal seasons in [NATURE.md](NATURE.md).

## Rendering

- takram three-geospatial — https://github.com/takram-design-engineering/three-geospatial
- jbouny/fft-ocean — https://github.com/jbouny/fft-ocean
- Ocean Rendering with FFT for Real-Time Applications — https://dspace.zcu.cz/items/a04534b1-2a3b-4457-96ca-0bc326a2b72b/full
- Cloud noise: handmade.network "Fast High-Quality Cloudscape through Noise and Reprojection"
- Reflections (Cox–Munk slopes, Fresnel, slicks, wet sand, melt ponds, Bruneton 2010, LEAN): [REFLECTION.md](REFLECTION.md) "Sources"

## Sea

- Breaking waves / shore foam: Wikipedia "Breaking wave"; 80.lv "Real-time shoreline simulation"
- Breaker index: McCowan (1894) H/d = 0.78; Weggel (1972) slope term; Goda (2010) "Reanalysis of
  regular and random breaking wave statistics"; J. Coastal Res. "Breaking Waves on a Macrotidal
  Barred Beach: A Test of McCowan's Criteria"
- Rain on the sea: Melsheimer et al.; Nystuen 1990
- Ship wakes: Kelvin (1887) wedge 19.47°; Rabaud & Moisy, PRL 2013 "Ship wakes: Kelvin or Mach
  angle?" (angle ~ 1/Fr past Fr ≈ 0.5); Darmon, Benzaquen & Raphaël 2014
- Ship motions: heave/pitch RAOs small below λ/L ≈ 1, near 1 above ~1.75 (IJAME monohull
  sea-keeping studies); whitecap cover W = 3.84e-6 U^3.41 (Monahan & O'Muircheartaigh 1980)
- Ship lights: COLREGs, Annex I intensities
- Arctic boats: Statistics Greenland fishing fleet (3,000–5,000 dinghies); Royal Greenland
  vessels (65–83 m prawn trawlers)

## Sky and atmosphere

- Visibility: Koschmieder (V = 3.912/σ); WMO scale (very good 20–50 km, excellent > 50 km); sea
  salt rises with wind (Korean coast extinction vs wind, R² 0.57); Mace Head sea salt peaks in
  winter maritime polar air; Saharan dust over the Mediterranean in spring and autumn (NASA Earth
  Observatory)
- Moon: Allen, *Astrophysical Quantities* (lunar phase magnitude); astronomy-engine
  `SearchLunarEclipse` / `SearchGlobalSolarEclipse`
- Waterspouts: NWS Key West (1,400+ events 2006–2024, peak Aug); Balearic climatology 1989–2020
  (65% in autumn, Sep peak); Sioutas, Aegean 1957–2012 (Sep–Oct); Croatian Adriatic 2001–2011
  (DHMZ)
- Noctilucent clouds: NASA, NERC MST radar facility, WMO Cloud Atlas (50–65°, late May–Aug, peak
  round the solstice)
- Morning Glory: Smith, LMU "The Morning Glory and related phenomena" (Burketown, late Sep–early
  Nov, from converging Cape York sea breezes)
- Sea fog depth and its lid (read as search summaries, 2026-10-31): East Greenland coastal fog
  ~100–400 m, later 75–250 m deep, often reaching the boundary-layer top (EGU 2017-9485, EGU
  2019-3951); Yellow Sea fog ~80–200 m, its top tied to the inversion's thickness (IFDA 2019-8);
  Taicang, China: a ~200 m surface inversion with fog 200 m deep at one station and 50 m at the
  next (Pure Appl. Geophys., s00024-022-03119-4); English Channel fog 50–100 m judged from cliffs,
  clear sky above. So advection fog is tens to a few hundred metres deep under an inversion lid
  (`fogLayer.ts`; the drawn 30–120 m, banks 18–50 m, sit in the range)
- Contrails: Irvine et al., EGU 2016 (most North Atlantic contrails last < 6 h, ~5% ≥ 24 h);
  Irvine, Hoskins & Shine, GRL 2012 (ice supersaturation by weather pattern)
- Night sky (NIGHT_SKY phases 1–3; full list in STARS.md "Sources"): NASA SVS Deep Star Maps
  2020 (Milky Way map); Masana et al. 2021 (integrated starlight and the night-sky budget at
  40° N); Leinert et al. 1998 Table 17 (zodiacal light); Wikipedia "Sky brightness" (S10, the
  dark-sky budget)
- Aurora (NIGHT_SKY phase 6; numbers in STARS.md §8): NOAA SWPC space weather scales (storm days
  per cycle, Kp vs the latitude reached); Chinese Journal of Geophysics 2017 vol. 60(1) 1–11,
  dayside arcs: I557.7/I630.0 rises from ~0.2 to ~9 as I557.7 rises 0.1–10 kR
  (html.rhhz.net/geophy_en/html/20170101.htm); IBC classes: RSRS Newsletter 1971 no. 119
  (dittonpark-archive.rl.ac.uk) and the WMO International Cloud Atlas "polar aurora,
  brightness" (cloudatlas.wmo.int); interleaved gradient noise: Jimenez, "Next generation
  post-processing in Call of Duty: Advanced Warfare" (SIGGRAPH 2014); integer hash: Jarzynski &
  Olano, "Hash Functions for GPU Rendering", JCGT 9(3) 2020 (PCG); storm red (0.93): Beletsky
  et al., mid-latitude aurora of 10–12 May 2024 over Irkutsk, I630/I557.7 up to 15–30, 630 nm
  > 25 kR (seminar.pgia.ru/archive/2024/1_02_Beletsky.pdf; read as a search summary); type-B
  red lower border, green quenching and N₂ 1PG: Hallinan et al. 1998 and Vallance Jones
  (earthref.org/ERR/21966, nature.com/articles/141200a0; search summaries only); storm season
  (0.95): Australian Space Weather Service, "Seasonal variation" (sws.bom.gov.au/Educational/3/1/5:
  Ap > 25 ~2× near the equinoxes, 1932–2014); takram three-atmosphere
  defaults for the mirrors' transmittance (Rayleigh, Mie, ozone)

## Shore and animals

- Cetacean eyes (0.166): a rough-toothed dolphin's eyeball ~26.5 × 24.5 mm, flattened
  (link.springer.com/article/10.1134/S1062359020060102); dolphin eyes on the sides of the head near
  the mouth's corners (seaworld.org bottlenose characteristics); an orca's about a cow's (seaworld.org
  killer whale characteristics), its white patch above and behind the eye (whaleopedia.org); a
  humpback's "grapefruit" or "softball" sized (uncw.edu 2025, smithsonianmag.com 2025). From search
  summaries; no measured humpback diameter found.
- Whiskers (0.164): true seals' vibrissae are flattened and beaded (wavy), eared seals' smooth;
  15–350 a side by species (review, pmc.ncbi.nlm.nih.gov/articles/PMC3317988; oceanbites.org
  "What's up with whiskers"). Hippos have bristle-like muzzle whiskers (Current Biology 2021,
  pmc.ncbi.nlm.nih.gov/articles/PMC7930762); bottlenose dolphins lose their rostral vibrissae soon
  after birth; each humpback head tubercle carries one hair (baleinesendirect.org "Do whales have
  hair?"). From search summaries.
- Animal skins (0.157): photos on Wikimedia Commons, listed with author and licence in
  `src/props/skins.json` (public domain or CC BY; CC BY credited in README). Pixel scale from an
  assumed length of the animal in the photo (harbour seal 1.5 m, Nile crocodile 3.5 m), not measured.
  Delighting by dividing out low-frequency light follows photogrammetry practice (Unity's
  De-Lighting Tool, blog.unity.com "Experimental feature: De-Lighting tool"; from search summaries).
- Lighthouse lens rotation (0.129): US Lighthouse Society, "Lens rotation" (uslhs.org/resources/
  lighthouse-technology/lens-rotation): flashes per minute = lit panels × turns per minute; the
  Cuckolds, Fl(2) 6s, two panels lit, 10 rpm. St Augustine Lighthouse, "Clockwork mechanism"
  (staugustinelighthouse.org). From search summaries.
- Lighthouse intensity (0.196): Sabik Marine VRB-25 LED rotating beacon datasheet (almarin.es/docs/
  content/vrb25.pdf, read): white peak 410,000–2,080,000 cd by panels and tiers, horizontal and
  vertical divergence 1.5° at 5% of peak, range 27.5 NM by night. The World Lighthouse Hub,
  "Measurements" (pharology.eu, read): the brightest lights "a few millions of candle power",
  popular figures ~100,000. Britannica, "Lighthouse: intensity, visibility and character of lights"
  (search summary): thousands to millions of candelas; nominal range at 10 NM meteorological
  visibility.

- Savanna dry seasons (0.101; SEASONS.md has the links; from search summaries): Bureau of
  Meteorology and Greening Australia (northern savanna's rains and curing), Williams and Cook 2001
  (savanna fire regimes); Gahounsougbo et al. 2015 (Fortaleza and Recife rains, 1974–2008); rainfall
  tables (currentresults.com, weather2travel); West Africa, Central America, Mozambique and India
  mostly from general and travel sources.
- Sargassum season (0.100; SEASONS.md has the links; from search summaries): USF outlook 2023
  (peak about June–July); EGUsphere 2026 preprint and Plymouth Marine Laboratory 2025 (West
  Africa's peaks differ from the Caribbean's).
- Seasons (0.98, snow line 0.99, leaf litter 0.103; SEASONS.md has the links): Woodland Trust Nature's Calendar autumn analyses
  (UK oak first tint ~2 Oct, full tint ~4 Nov, bare ~1 Dec); the Swedish citizen-science
  autumn colour study (EGU 2014, 2017: birch and poplar turn later further north); phys.org 2021
  (Europe's yellow vs North America's red autumns); Popular Science on tundra autumn colour;
  NParks Singapore and World Agroforestry on the tropical almond's twice-yearly red leaf drop;
  Volaire & Norton (Annals of Botany 2006) and PMC2803600 on Mediterranean grass summer
  dormancy; Shetland, Isle of May and Scottish Seabird Centre (Bass Rock) colony dates; the IWC
  Whale Watching Handbook (humpback migration); NAMMCO harbour seal haul-out surveys; California
  State Parks, Año Nuevo (elephant seal seasons); Animal Diversity Web (*Ocypode quadrata*
  hibernating Oct–Apr); SF Zoo *Uromastyx* fact sheet (2–5 months' winter dormancy).

- Climates (PLAN_BIOMES 11): FNAI "Coastal Strand" (Florida: sea oats foredune, saw palmetto and
  cabbage palm strand, live oak maritime hammock; sea grape in the southeast); JNCC machair
  habitat account and Scottish Geology Trust guides (Hebridean shell sand, ~40–50% carbonate on
  the beach, up to ~80% in the machair; marram dune between); SEASAT and GEOSAT altimeter wave
  climatologies (significant wave height lowest in the doldrums, rising to the westerlies)

- Rocky shores: Coastal Wiki "Rocky shore morphology" (Sunamura platform types, gradients 1–5°,
  widths, rocky share 36.5%, about half the coast cliff-backed)

- Driftwood: Hakai Magazine "Iceland's Sinking Driftwood Supply"; Eggertsson, Jökull 1993
  (Siberian origin, larch with roots, Transpolar Drift); Wikipedia "Beach wrack"; Deidun et al.
  (Posidonia banquettes, Malta)
- Shore life: Wikipedia "Ghost crab" / "Ocypode"; Strachan et al. 1999, Scientia Marina (Ocypode
  cursor, Cyprus, nocturnal); Cabo Verde burrow zonation (Afr. J. Mar. Sci. 2016); Rhins of
  Galloway beach flower guide and Wildlife Trusts (sea holly Jul–Sep, sea bindweed Jun–Aug, sea
  sandwort, sea rocket)
- Mangroves: FAO "Mangroves of Asia" (Red Sea and Gulf: patchy, pure Avicennia at wadi mouths and
  sheltered lagoons); Frontiers in Marine Science 2025 review (Middle East Avicennia 2–4 m;
  freshwater, salinity, heat and shelter control it)
- Sea turtles: seaturtlesofindia.org (Andaman greens and hawksbills Apr–Sep, olive ridleys
  Nov–Mar); Volunteer World "Turtle seasons around the world" (Costa Rica, Galápagos, Greece);
  NC Wildlife (loggerheads May–Aug, ~60 days' incubation)
- Crocodiles and hippos: Loango NP (Gabon) "surfing hippos" (lagoons by day, beach and surf at
  dusk), leatherbacks and olive ridleys on Gabon's beaches; saltwater, American, Nile and West
  African crocodile ranges (bask at river mouths, gaping to cool)
- Animals in storms: The Condor 32(4) "Behavior of sea gulls during a hail storm" (resting on the
  water, heads tucked); Bay Nature "Where do birds go in the rain"; Solent Seal Code of Conduct
  (harbour seals go into the water in wind and rain)
- Vegetated shingle flora: EUNIS "Channel / Baltic Crambe maritima communities" (sea kale,
  sea pea on shingle); Sussex Wildlife Trust "Shingle flowers" (Rye Harbour: yellow horned
  poppy May–Oct, sea pea just above extreme high water); RHS and Wikipedia *Crambe maritima*
  (white flowers May–Jul); stony-beach research and sources in COASTS.md
- Seabird colonies on the mainland: Bempton Cliffs and Muriwai (gannets), Látrabjarg (puffins,
  guillemots), South Georgia (king penguins); haul-outs: Piedras Blancas (elephant seals), Cape
  Cross (Cape fur seals)
- Beach states: Wright & Short 1984 (Ω classes, cusps on reflective and terraced beaches);
  Wright, Short & Green 1985 (mean Ω per state); Short 2006 (Australian census of states, rip
  spacing by region, multibar beaches); OzCoasts wave-dominated beaches (bar distances, rips on
  terraces and longshore bars); Bosboom & Stive §7.3.2 (reflective and dissipative slopes);
  Jennings & Shulmeister 2002 (gravel slopes); Soulsby 1997 fall velocity (CIRP wiki); Komar & Gaynord 1975
  breaker height; Hong Kong CEDD "Typical natural beach slopes" and Bascom 1951 (slope by grain);
  edge-wave cusp spacing λ = g T² tanβ / π (Guza & Inman 1975); sources in REGIONS.md §2 and
  PLAN_BIOMES.md
- Tide curves and surge (0.200–0.201, REGIONS.md §3.2–3.3): TICON (Piccioni et al. 2019, CC-BY,
  GESLA-2 gauges), NOAA CO-OPS constants and predictions (checks), Schureman's equilibrium
  arguments, wind setup (Pugh & Woodworth), the 1953 North Sea surge as the shallow-shelf anchor.
- Tides, ebb and flow (research only, REGIONS.md §3.1): tide types (Bosboom & Stive; Davies &
  Clayton 1980), tropic and equatorial tides, the establishment of a port, wind-led Baltic and
  Mediterranean levels; links in REGIONS.md "Sources".
- Tides: ranges per region in REGIONS.md §3 (Aviso, Kjerfve 1981, US Harbors, Kartverket via
  Yachting Monthly, Wadden Sea World Heritage, Britannica, NASA Earth Observatory, Vegagerðin,
  OJMS 2015 Red Sea model); Masselink & Short 1993 (relative tide range, tide-modified and
  tide-dominated beaches); Short 2006 (shares and low-tide terrace widths); Incheon spring/neap
  ratio ≈ 1.46
- Calm water (`shelter.ts`): Hasselmann et al. 1973 (JONSWAP fetch-limited growth: g·Hs/U² =
  1.6e-3 (gF/U²)^½, U·fp/g = 3.5 (gF/U²)^−0.33); Dally, Dean & Dalrymple 1985 (broken waves decay
  toward a stable height ~0.4 × depth, behind bars: a known issue, not modelled)
- Reefs (`reef.ts`): Frontiers in Marine Science 2021 (fringing reef wave attenuation; the
  50–75% height loss in COASTS.md); reef zones (lagoon, back reef, flat, crest, fore reef), both
  linked in COASTS.md; the 10–30% re-formed height (strength 0.7–0.9) is the plan's (phase 6); Vousdoukas, Velegrakis & Plomaritis 2007 (beachrock:
  intertidal, micro-tidal warm coasts, seaward-dipping slabs in steps)
- Tidal flats and salt marsh (`tidalFlat.ts`, plans/TIDAL_FLAT.md): Coastal Wiki "Tidal flat"
  (flats where relative tide range > 15, after Mangor 2004); Wadden Sea Quality Status Report on
  salt marshes (marsh from below mean high water to the highest water, flooding frequency by
  zone, via search summary). Leads only, from search summaries: Nature Communications 2025 (flat
  width and slope vs sediment and tide range, 2,538 Chinese transects), a LiDAR study of creek
  size by zone on Chinese flats

- Blossom (0.140–0.141; `phenology.ts` `BLOOM`): rock rose (Kew POWO, first-nature), gorse (Woodland
  Trust, Dorset Nature, Lincolnshire Life; New Zealand: NZ Flora, APWT, Hawke's Bay RC), wattle,
  flamboyant (World Agroforestry DB, Indian Forester, NParks, a Caribbean table), pōhutukawa (RNZ, Te
  Papa, NZ Herald): links in NATURE.md "Sources". Colours measured from the photos and scans listed
  in plans/NATURE_PLAN.md §1 (`scripts/asset-measures.json`).
- Fairy rings (0.149; `fairyRings.ts`, `phenology.ts` `FAIRY_SEASON`): RHS, Utah State herbarium,
  Britannica (NATURE.md "Sources"); ring types and the subtropical season: UF/IFAS "Fairy rings"
  LH046 (https://edis.ifas.ufl.edu/lh046), K-State lawn problem solver
  (https://www.k-state.edu/turf/resources/lawn-problem-solver/problem-solver/off-color/dark/fairy-ring/index.html).
  No photo measured: the band's colour and width are estimates.
- Salt spray and the vegetation line (research only, NATURE.md §9): Malloch 1972 (Lizard sodium
  deposition by distance), Boyce 1954 (salt-spray community, crown shear), Fire Island NPS study,
  EUNIS sea cliffs, Vivrette 1980; links in NATURE.md "Sources"
- Mushrooms (0.151; `props/fungi.ts`): seasons and hosts NATURE.md §2 (Wild Food UK, UF/IFAS);
  false parasol on warm-climate lawns: Qld Fungi (https://qldfungi.org.au/garden-fungi-chlorophyllum-molybdites),
  Wikipedia "Chlorophyllum molybdites". Cap colours measured from Commons photos (public domain:
  `AD2009Sep13_Boletus_edulis_01.jpg`, `Amanita_muscaria_tyndrum.jpg`; CC BY-SA 3.0:
  `Lactarius-deliciosus-Finland.jpg`, `Agaricus_campestris_051011A.JPG`; CC BY 4.0:
  `Marasmius_oreades_14.jpg`), recorded in `scripts/asset-measures.json`.
- Baked scans (0.150; `src/props/scans/`): Poly Haven "Flower Ursinia"
  (https://polyhaven.com/a/flower_ursinia, CC0, Jenelle van Heerden, Rico Cilliers): geometry,
  alpha and albedo. Simplified with meshoptimizer (MIT, devDependency).

## Sea ice

Sources and photos: [SEASONS.md](SEASONS.md) §4.2, [plans/SEA_ICE.md](plans/SEA_ICE.md).

## Cloud illumination (plans/CLOUD_ILLUMINATION.md)

- Charge structure and CG initiation: [IEEE TechNav: lightning](https://technav.ieee.org/topic/lightning/); [NAP, The Earth's Electrical Environment](https://www.nap.edu/read/898/chapter/62); [Surv. Geophys. 2013 review](https://springerlink.bibliotecabuap.elogim.com/doi/10.1007/s10712-013-9230-6); [Edens, bolt-from-the-blue flashes](https://aem.eco/wp-content/uploads/2022/10/Edens-BFB.pdf).
- Winter lightning's low charge: [IEEJ 2018](https://www.jstage.jst.go.jp/article/ieejpes/138/5/138_310/_article), [URSI AP 2025](https://www.ursi.org/proceedings/procAP25/papers/0454.pdf), [AMS 2013](https://ams.confex.com/ams/93Annual/webprogram/Paper218027.html).
- Optical energy: [Guo & Krider (NTRS)](https://ntrs.nasa.gov/citations/19830068117); [Sandia 2023](https://www.sandia.gov/research/publications/details/lightning-radiometry-in-visible-and-infrared-bands-2023-09-01/); clouds spreading a flash: [NASA Earthdata](https://www.earthdata.nasa.gov/learn/data-in-action/properties-optical-lightning-flashes-clouds-illuminate), [CloudScat.jl, GMD 2020](https://gmd.copernicus.org/articles/13/5549/2020/).
- Night storms over the sea: [Holle, AMS 2013](https://ams.confex.com/ams/93Annual/webprogram/Manuscript/Paper215133/8.1%20Holle-Diurnal%20AMS%202013.pdf); [Virts, WWLLN](https://www.nssl.noaa.gov/users/mansell/icae2014/preprints/abstract_short/Virts_289.pdf).
- Clouds amplify light pollution: [Kyba et al. 2011, PLoS ONE](https://pmc.ncbi.nlm.nih.gov/articles/PMC3047560).
- Reference photo of a storm lit from inside at night: [ABC](https://live-production.wcms.abc-cdn.net.au/a4a718109bb53994c7fc0cc1ea720938?impolicy=wcms_crop_resize&cropH=1365&cropW=2048&xPos=0&yPos=0&width=862&height=575).

- Cloud-street spacing 2–4× the convective layer depth (Etling & Brown 1993, as summarised): [Wikipedia, Horizontal convective rolls](https://en.wikipedia.org/wiki/Horizontal_convective_rolls); roll wavelength ~3× in a model: [Chlond 1987](https://pure.mpg.de/pubman/item/item_2409691_2/component/file_3360539/chlond_1987.pdf) (search summary only).
