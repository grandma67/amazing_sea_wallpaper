# Amazing Sea Wallpaper — Android / iOS app plan

Goal: the same date-seeded wallpaper as the site, as an installable phone app that works
offline and, unlike the site, can **put the day's sea on the home/lock screen by itself**.
The renderer stays the web code (three.js + takram + workers); the app is a thin native
shell around it plus a few native pieces that a browser can't do.

Status: plan only (2026-10-22). Nothing built yet.

## Decision: Capacitor shell around the existing build

- **Capacitor 7** (Ionic): `dist/` is copied into the app and served from
  `capacitor://localhost` (iOS, WKWebView) / `https://localhost` (Android, Chromium
  WebView). No server, works offline, one codebase. Native features via small plugins
  (Swift / Kotlin) where needed.
- Why it fits: the build is already a static, relative-base (`base: './'`) site with all
  assets self-hosted in `public/assets` (~3.8 MB, `dist/` ~6 MB); module workers and
  OffscreenCanvas WebGL 2 work in both WebViews on current OS versions.
- Rejected:
  - **Native rewrite** (Metal / Filament / Vulkan): would mean re-implementing takram's
    Bruneton atmosphere and volumetric clouds, every GLSL patch (`eclipse.ts`,
    `contrails.ts`, `cloudArrangement.ts` …) and keeping two renderers identical. Months of
    work for the same image.
  - **React Native + WebView / Expo**: same WebView underneath, more layers, nothing gained
    (no React in the project).
  - **Tauri 2 mobile**: viable, but younger mobile tooling and fewer ready plugins
    (photos, wallpaper, background tasks) than Capacitor.
  - **PWA only**: no wallpaper-setting API on either platform, iOS evicts storage, no App
    Intents. Keep the site working as a PWA anyway (cheap: manifest + service worker).

## Platform limits that shape the design

| | Android | iOS |
|---|---|---|
| Set wallpaper from app | Yes: `WallpaperManager.setBitmap(…, FLAG_SYSTEM \| FLAG_LOCK)` | **No public API.** Only the user's Shortcuts automation ("Set Wallpaper" action) |
| Daily job in background | `WorkManager` periodic job (≥ 15 min, inexact) | App Intent run by a Shortcuts personal automation (e.g. "every day at 06:00") |
| GPU in background | WebView in a service is fragile; avoid | Not allowed (GPU work is killed in background) |
| WebGL 2 | Chromium WebView, GPU varies (Adreno, Mali, PowerVR) | WKWebView on Apple GPUs, iOS 17+ for OffscreenCanvas WebGL in workers |
| Memory | 2–4 GB devices common; WebView renderer process can be killed | WebContent process killed around ~1–1.5 GB on older phones |

Consequence: **background wallpaper updates never render on the device in the background.**
They use an image that is already rendered: one the app rendered while open (cached), or the
pre-rendered `latest-portrait.jpg` the Pages workflow already publishes daily.

## Phases

### 0. Feasibility on real phones (no app code) — do first

Open the live Pages site on 2–3 iPhones (an old one, e.g. iPhone 11 / A13, and a current
one) and 3–4 Androids (low-end Mali, mid Adreno, Pixel, Samsung). For each, record:

- Does it render at all (WebGL 2, float render targets, `OES_texture_float_linear` for
  takram's 3D LUTs — missing on many Mali GPUs)? Note any `[browser error]` from remote
  debugging (Safari Web Inspector / `chrome://inspect`).
- Time to image at the default portrait size and 64 frames, and with `?frames=24`.
- Peak memory, thermal throttling over 2–3 runs, crashes/context loss.
- Visual diff against a desktop render of the same `?date=&w=&h=` (`scripts/diff.mjs --a
  --b`) — GPU precision differences (mediump defaults, half floats) show here.

Outcome decides: minimum OS / GPU, default resolution and frames on phones, and whether a
fallback is needed (e.g. "download today's pre-rendered image" for devices that can't
render). If renders are > ~60 s or crash, do the "Phone render budget" work below before
phase 1.

### 1. App shell

- `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`;
  `npx cap init "Amazing Sea" com.<owner>.amazingsea --web-dir dist`; `npx cap add ios
  android`. Commit `ios/` and `android/` (generated native projects are source here).
- Scripts: `"app:build": "npm run build && cap sync"`, `"app:ios": "cap open ios"`,
  `"app:android": "cap open android"`.
- Build-time flag `import.meta.env.VITE_APP=1` (or `Capacitor.isNativePlatform()`) so the
  web build is unchanged.
- The `/random/` page: in the app, replace the redirect page with an in-app action
  (`random` input is a second HTML page in `vite.config.ts`; keep it for the web).
- Portrait lock on phones, landscape allowed on tablets; status bar overlay
  (`@capacitor/status-bar`), `viewport-fit=cover` is already set — add
  `env(safe-area-inset-*)` padding to the footer in `style.css`.
- Native splash = the existing splash colours (`#0b1e3a`), handing over to the HTML splash.
- Icon / launch images from `public/favicon.svg` (`@capacitor/assets`).

Done when: app installs on both platforms from Xcode / Android Studio, renders today offline
(airplane mode), prev / next / today work.

### 2. Platform glue (`src/platform.ts`)

One small module, web and native implementations behind the same functions, so `main.ts`
doesn't branch everywhere:

- `saveImage(blob, name)`: web = current `<a download>`; native = save to Photos / gallery
  (`@capacitor-community/media` or a 20-line plugin) + `@capacitor/share`. `<a download>`
  does nothing in a WebView.
- `navigate(date)`: in-app state change instead of reloading the page with `?date=` (keeps
  the WebView and its compiled shaders; currently each day is a full page load).
- Lifecycle (`@capacitor/app`): when backgrounded mid-render, iOS loses the WebGL context —
  abort and restart on resume rather than show a black canvas; keep a finished image as a
  JPEG so a lost context after rendering costs nothing.
- Haptics / native share sheet are optional polish.

### 3. Render cache

The web already keeps the last 10 renders in a service worker (`public/sw.js`,
`renderCache.ts`); WebView storage can be evicted, so the app keeps its own:
- After each render, store the JPEG in app storage (`@capacitor/filesystem`), keyed
  `date + width×height + renderer version` (version = app version; bump on any visual
  change so old images are re-rendered, mirroring "same day, same scene").
- On open: show the cached image instantly, no render. Keep the last ~30 days, prune older.
- This cache is also what the native wallpaper code reads (phase 4), so write it to a
  location both can reach: Android app files dir; iOS **App Group** container (needed for
  the App Intent / widget extensions).

### 4. Wallpaper on the home / lock screen

**Android** (Kotlin plugin `WallpaperPlugin`):
- `setWallpaper(path, which: home|lock|both)` → `WallpaperManager`, cropped to the screen
  (`getDesiredMinimumWidth/Height`), on a background thread.
- Settings screen: "Change wallpaper daily" toggle, home / lock / both.
- `WorkManager` daily job (unmetered optional, after local midnight + random delay): if the
  cache has today's image for this screen size, set it; otherwise download
  `latest-portrait.jpg` (see "Server images"), check its date in `latest.json`, set it; if
  neither, post a notification "Tap to paint today's sea", which opens the app, renders,
  and sets it.
- Optional later: a **live wallpaper** (`WallpaperService`) is out of scope — it would need
  a native GL renderer.

**iOS** (Swift, App Intents framework, iOS 17+):
- App Intent `GetTodaysSeaIntent` → returns an image file (from the App Group cache, else
  downloads the server image). Shown in Shortcuts as "Get Today's Sea".
- In-app guide (one screen, with an "Add to Shortcuts" link) to create a personal
  automation: *Time of Day 06:00 → Get Today's Sea → Set Wallpaper (lock + home, no
  perspective zoom)*. iOS can run this without asking since iOS 16.4 when "Run
  Immediately" is chosen.
- Optional: a WidgetKit widget showing the day's sea and title (reads the App Group cache).

### 5. Server images (small change to `.github/workflows/pages.yml`)

The daily job already renders `latest.jpg` (1920×1080) and `latest-portrait.jpg`
(1290×2796) for **UTC** today. For the app:
- Publish `daily/<date>/portrait.jpg` and keep the last ~7 days, so a phone ahead of UTC
  (e.g. Asia, where local "today" starts before the job runs) can use yesterday's/tomorrow's
  file by date; `latest.json` already says which date and params it is.
- Add a tablet size (2048×2732) if tablets are supported.
- The image is centre-cropped on device for other phone aspect ratios (19.5:9 ± a little
  is fine; the portrait composition keeps the horizon and subject central).
- Note: the CI render uses SwiftShader and 24 frames, so it is slightly grainier than a
  device render; the device cache always wins when present.

### 6. Phone render budget (only if phase 0 says it's needed)

The project rule is that cheaper rendering must not change the image (ARCHITECTURE.md
"Decisions"). Options in that order:
1. Render on the device at the screen's real size (already: ≤ 1920 long side on small
   screens; ~1290×2796 on big phones) — check it's not the 4K path.
2. Keep frames at 64 but split the render across animation frames so the OS doesn't
   flag the WebView as hung, and show progress.
3. Cache the atmosphere LUTs on device after the first run (rejected on the web: ~48 MB of
   float 3D textures to read back and store — on a phone the trade-off
   is better: storage is cheap, startup GPU time and heat are not). Must give an identical
   image (`bench.mjs`-style pixel diff).
4. Only then a documented "low-power" mode (ARCHITECTURE.md "Ideas") with fewer frames, labelled as
   such, never used for the wallpaper the app sets.

### 7. Store release

- Accounts: Apple Developer ($99/yr), Google Play ($25 once).
- iOS review risk, guideline 4.2 (minimum functionality / "repackaged website"): the
  native pieces (offline rendering, save to Photos, Shortcuts intent, widget, daily
  automation) are what make it an app — ship phase 4 before submitting.
- Privacy: no tracking, no accounts; the only network call is the optional server image.
  Privacy manifest (`PrivacyInfo.xcprivacy`) for file timestamp / UserDefaults APIs.
  Photos add-only permission string (`NSPhotoLibraryAddUsageDescription`).
- Android: target the current API level, `SET_WALLPAPER` permission (normal, no prompt),
  `POST_NOTIFICATIONS` for the fallback notification.
- Screenshots: render them with `scripts/snapshot.mjs` at store sizes (6.9" iPhone
  1320×2868, 13" iPad, Android phone) using a few specs from `scenes/examples.json`.
- CI (later): GitHub Actions macOS runner + fastlane for TestFlight / Play internal track.
  Until then, archive from Xcode / Android Studio manually.

## Testing

- `npm test` stays the gate; add tests for `platform.ts` choices (cache key, which image
  to use for a given local date vs server date, crop rect) — pure functions, no WebGL.
- Determinism: a device render and a desktop render of the same date + size should match
  within GPU noise (`scripts/diff.mjs`); keep one reference per platform from phase 0.
- Manual device matrix each release: one old + one new iPhone, one low-end + one flagship
  Android; check first launch offline, background/resume during render, the daily job
  (Android: `adb shell cmd jobscheduler run`), the Shortcuts automation (iOS).

## Order of work and rough effort

| Phase | What | Effort |
|---|---|---|
| 0 | Device feasibility measurements | 0.5–1 day |
| 1 | Capacitor shell, offline, safe areas | 1 day |
| 2 | `platform.ts`: save/share, in-app navigation, lifecycle | 1–2 days |
| 3 | Render cache (+ App Group on iOS) | 1 day |
| 4 | Android wallpaper + WorkManager; iOS App Intent + Shortcuts guide | 3–4 days |
| 5 | Server images by date | 0.5 day |
| 6 | Phone render budget (if needed) | 1–5 days |
| 7 | Store assets, review, release | 2–3 days + review wait |

## Open questions

- Phones only, or tablets too (extra server size, landscape composition on iPad)?
- Minimum OS: iOS 17 / Android 10 (API 29) proposed — decided by phase 0 results.
- App name and bundle id (`com.<owner>.amazingsea`); free with no ads assumed.
- Should the app also offer the 4K landscape image (desktop wallpaper via share)?
