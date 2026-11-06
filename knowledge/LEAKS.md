# Day changes and leaks

← → Today Random (and Back/Forward) swap the day **in place** (`main.ts` `showDay`), without
loading the page again. Each day is a `View`: its own canvas and render worker. Everything a day
makes must be freed, in two stages:

1. **When the frame is in the canvas** (end of `renderScene`, `scene.ts`; after a fence wait for the
   last frame, see LESSONS.md "Page"): every geometry,
   material, texture and render target is disposed (`GpuResources` in `src/dispose.ts`: the scene
   and environment trees, composer, env cube, reflection and land-shadow targets, precomputed
   atmosphere, cloud textures), then a sweep (`trackUploads`) disposes whatever else three uploaded
   during the render (libraries' shared quads, three's shadow depth materials, PMREM), then
   `renderer.dispose()`. Only the WebGL context and its drawing buffer (the picture,
   `preserveDrawingBuffer`) stay, so Download still works. `debug.gpuAfterRender` must read
   `{ geometries: 0, textures: 0, programs: 0 }`; `debug.gpuSwept` names what only the sweep
   caught.
2. **When the next day starts** (`View.dispose()`, before the new render, so two days' memory is
   never held at once): the worker is terminated (its heap and context go with it), a main-thread
   render loses its context (`renderer.forceContextLoss()`), the canvas leaves the page. Page-wide
   listeners (bar toggle, Download, nav clicks, `popstate`) are added once, never per day.

## `npm run check:restart` (`scripts/restart.mjs`, ~1 min)

Run it after anything that adds to the scene, the page or a listener (dev server on 5174), with
`--date` on real days that have the addition: the default start is June, so a seasonal or rare
feature may not appear at all. It
clicks → several times, then ←, Back, Forward, Random, Today, once with the render on the page
(`?worker=0`, where heap and contexts are visible) and once on the worker. `ok` + `failures`
first; the header lists every check. In short: the day expected in the address bar, view and
title; one canvas; splash hidden, bar shown; nothing left on the GPU after each render; at most one
live context (main) or render worker (worker); every old view and canvas collected (WeakRefs);
a day seen again takes ≤ 2 MB more heap than on its first visit (heap varies ~40–80 MB by day, so
it compares the same day, not one day with the next); no GL message (page, worker or GPU process)
over all the day changes.

## When it fails

- **`left on the GPU`**: something made outside the scene graph and not disposed. Give it to `gpu`
  in `renderScene` or dispose it where it's made (the cloudy environment's copy quad leaked that
  way). The sweep usually hides it; a non-zero count means it was disposed in the wrong order.
- **Order matters:** sweep and dispose **before** `renderer.dispose()`. That call forgets which
  program each material uses, so materials disposed after it never release their programs.
- A render target: dispose the target, not its `.texture` (`GpuResources.addTexture` follows
  `texture.renderTarget`).
- Instanced meshes hold their own buffers: `mesh.dispose()` (`addTree` does).
- A module-level singleton (postprocessing's fullscreen triangle, `lampTexture`, cloud assets)
  keeps three's dispose listener, and through it the old renderer, until it's disposed: the sweep
  covers it; a new cache must be swept too.
- **`old days still alive`**: something holds a View, canvas or renderer. Find the path with a
  heap snapshot (CDP `HeapProfiler.takeHeapSnapshot`, then walk retainers from
  `WebGLRenderer` / `Detached HTMLCanvasElement`). Usual suspects: a listener on `window` or
  `document` added per day, a timer, an async callback that outlives the day (check the View's
  `disposed` flag in it).
- A main-thread render can't be stopped half way: a day changed during it finishes, then loses
  its context. The worker path is terminated at once.
