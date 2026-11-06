# Live mode plan

**Status: an idea, not started and not designed.** A future mode where the viewer can move around
the scene instead of seeing one still frame. Recorded 2026-11-06 so that features built before then
don't close it off.

## What it means for work today

- **"Rare in frame" isn't enough to drop a feature.** A plan's visibility count says how often a
  still frame shows something. In live mode the viewer can walk up to it. Report the count and raise
  this before dropping anything because of it.
- **Tie things to the world, not the camera,** where it costs little: what a thing is and where it
  lies should come from its world position, and only the choice of what to draw now should read the
  camera. `props/leafLitter.ts` is the example: each leaf is a hash of its tree's position and its
  index, and thinning is a threshold on the leaf's own hash, so coming closer only adds leaves.

## What assumes one fixed camera today

Seen while building leaf litter; not a full survey.

- **Props are placed for the frame:** `ctx.visible` and `ctx.inFrame` tests, sampling concentrated
  near the camera, hero trees at the frame's edges (`props/vegetation.ts`).
- **The terrain is a polar grid in a wedge** set up from the camera (`terrain.ts` `createTerrain`).
- **Compositions** choose where the camera stands and what it looks at.
- **A day is one render:** 16 accumulated frames in ~2–3 s, after which everything on the GPU is
  freed (LEAKS.md).

## Open questions

- How far can the viewer move: a look around, a walk along the beach, or anywhere?
- On which devices, and at what frame rate? (The phone app, `APP.md`, hasn't measured real phones.)
- Does the scene stay frozen in time, or do waves, wind, birds and the sun move?
- Does it replace the still wallpaper, or sit beside it?
