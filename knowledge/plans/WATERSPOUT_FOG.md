# Waterspouts: fog check and frequency

Two open bugs in `src/props/waterspout.ts` / `src/params.ts` (found 2026-10-16, still open
2026-10-31).

## 1. A waterspout can appear inside fog

`params.ts` (~line 1495) calls `waterspoutFor({ …, fog: false }, Random.derive(seed,
'waterspout'), spec.waterspout)`. `waterspoutFor` rules spouts out in fog (`suits = daylight &&
!day.fog && …`), but fog is picked later (`pickFog`), so the hard-coded `false` means the rule
never applies.

Why it matters:
- **Physics:** sea fog is warm moist air over *colder* water (stable, light wind under a lid);
  a fair-weather spout needs *warm* water (~26–30 °C in the Keys), unstable air, building
  congestus. Arctic sea smoke is over polar water, where spouts don't occur.
- **Picture:** fog from the camera (`fog.start === 0`) has 200–700 m visibility, so a spout
  2–8 km out is hidden (transmission ~e⁻⁴⁰ at 4 km) while the title still says "waterspout" and
  the sky is forced to towering cumulus; an offshore bank cuts the funnel part-way.

How often: real days 0 in three years; forced `{"waterspout": true}` gets fog on 53 of 1,095
days (5%).

```sh
node scripts/params.mjs --scene '{"waterspout":true}' --list --where 'p => p.fog != null' --fields fog.kind,fog.start,fog.visibility
```

Fix:
- Choose the waterspout *after* `pickFog` and pass `fog != null` (own streams, so no other day
  changes). `pickFog` reads `weather.kind` only, not formations, so adding congestus after it is
  safe; check that still holds.
- When a spec forces a waterspout and leaves fog to the date (`spec.fog === undefined`), drop the
  fog, as forced rainbows and eclipses do (`(rainbowDay || eclipse != null) && spec.fog ===
  undefined ? null : pickFog(…)`).
- Test: no waterspout with `fog.start === 0` over `allParams()`; `scenes({ waterspout: true, … })`
  never has fog unless the spec sets it.

## 2. Waterspouts are far rarer than intended

```sh
node scripts/params.mjs --list --where 'p => p.waterspout != null' --fields title 2024-01-01..2026-12-31
```

- **One in three years** (2026-09-27, Mediterranean), 0.09% of days. changelog 0.25 and CLOUDS.md
  said "~0.5%".
- 128 days meet all conditions (tropical or Mediterranean coast, day, scattered or broken, wind
  < 8 m/s); in-season chances 2–6% (`waterspoutChance`) give ~1% of them a spout. The original
  brief asked for both "~1% of eligible days" and "a few per year": too few eligible days for
  both.
- `test/waterspout.test.ts` only checks "> 0 and < 2% of days", so it didn't catch this.

Decide, then fix:
- **Option A (recommended): a few per year.** Raise peak-month chances to ~5–8% (Keys/Caribbean
  August, Mediterranean September), realistic for the hotspots; aim 2–5 a year.
- **Option B: keep ~1% of eligible days** (one every 2–3 years) and say so in the docs.
- Either way: make the test check the intended rate over `allParams()`, update changelog/CLOUDS.md.
- Render check: `node scripts/diff.mjs --scene <spec> --off '{"waterspout":null}'` on a front-lit
  Mediterranean September spec.

Season data (in `waterspout.ts`, sources in REFERENCES.md): Keys May–Oct, peak Aug; Balearics 65%
in autumn, Sep peak; Aegean Sep–Oct; Croatian Adriatic summer and autumn.
