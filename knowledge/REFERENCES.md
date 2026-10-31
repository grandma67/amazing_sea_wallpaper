# References

Sources behind built features. Research for planned work lives with its plan: coasts in
[COASTS.md](COASTS.md), regions/grain/tides/bioluminescence in [REGIONS.md](REGIONS.md), clouds
(WMO atlas) in [CLOUDS.md](CLOUDS.md), biomes in [plans/PLAN_BIOMES.md](plans/PLAN_BIOMES.md).

## Rendering

- takram three-geospatial — https://github.com/takram-design-engineering/three-geospatial
- jbouny/fft-ocean — https://github.com/jbouny/fft-ocean
- Ocean Rendering with FFT for Real-Time Applications — https://dspace.zcu.cz/items/a04534b1-2a3b-4457-96ca-0bc326a2b72b/full
- Cloud noise: handmade.network "Fast High-Quality Cloudscape through Noise and Reprojection"

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

## Shore and animals

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
