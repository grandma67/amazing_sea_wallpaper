# Daily desktop wallpaper: one script per OS family (plan)

Goal: a script that runs every morning, fetches the wallpaper the Pages site already renders
(`latest.jpg`) and sets it as the desktop background. Each machine runs at its own random minute,
so users don't all hit the site at once. **Ubuntu** and **macOS** share one bash script, and
**Windows** has a PowerShell one. Both live in `crons/`.

Status: plan (2026-11-14). Nothing built. The README section is marked "planned" until phase 6.
Testing: on this Mac (macOS 27.0.1, bash 3.2.57) during the build; on Ubuntu and Windows later.
Until those machines are tried, their parts ship labelled untested.

## 1. Facts this plan stands on (checked 2026-11-14)

| Fact | How checked |
|---|---|
| `https://grandma67.github.io/amazing_sea_wallpaper/latest.jpg` is 1920×1080, ~290 KB; `latest-portrait.jpg` is 1290×2796; `latest.json` / `latest-portrait.json` carry `"date": "YYYY-MM-DD"` (the UTC day rendered) and `"title"` | `curl` of the live site; `.github/workflows/pages.yml` |
| Headers: `cache-control: max-age=600`, `etag`, `last-modified`. A conditional GET with `If-None-Match` returns 304 and no body | `curl -I` |
| Only today's image is published (Pages deploys the current `dist/` only), so the script can only ask for "latest", not a given date | `pages.yml` |
| The CI is scheduled at 00:05 UTC, but GitHub starts it late. The last 10 scheduled runs finished between **01:10 and 07:43 UTC** (11-05…11-14: 02:09, 01:10, 02:18, 01:18, 02:00, 02:24, 07:31, 07:43, 06:51, 06:26) | GitHub API `actions/workflows/pages.yml/runs?event=schedule` |
| A push to `main` redeploys and re-renders the same day. The image bytes and ETag change while `date` stays the same | `pages.yml` (render step on every build) |
| The page's "today" is the **local** date (`main.ts`); `latest.jpg` follows the **UTC** date | `src/main.ts:288` |
| macOS: `osascript -l JavaScript` with `ObjC.import("AppKit")` reaches `NSWorkspace` / `NSScreen` on macOS 27 (read of `desktopImageURLForScreen` OK). This needs no Apple Events permission | run on this Mac |
| macOS: setting the picture through "System Events" from a launchd job fails with −1743 "Not authorized to send Apple events", because the consent prompt can't show there | [Apple forum](https://discussions-jp-prz.apple.com/thread/255432048), [techearl](https://techearl.com/set-mac-wallpaper-command-line) |
| macOS ships bash 3.2, `curl`, `shasum`; BSD `date` (`date -r EPOCH`, not `-d @EPOCH`) | this Mac |
| Linux: cron runs with no desktop variables (`XDG_CURRENT_DESKTOP`, `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY`). The session's own processes carry them in `/proc/<pid>/environ` | [Manjaro howto](https://forum.manjaro.org/t/howto-check-a-user-session-type-wayland-x11-you-are-using-on-gnome-kde/87165), [KDE discuss](https://discuss.kde.org/t/check-if-kde-plasma-is-currently-running/10355) |
| Linux: Ubuntu's GNOME sets `XDG_CURRENT_DESKTOP=ubuntu:GNOME`. `XDG_SESSION_DESKTOP` is a single name and a list of desktop names isn't always set (GDM gap), so match on the `:`-separated tokens of `XDG_CURRENT_DESKTOP` | [GNOME bug 727546](https://bugzilla.gnome.org/show_bug.cgi?id=727546) |
| Ubuntu desktop may not have `curl` by default (sources disagree) | [golinuxcloud](https://www.golinuxcloud.com/install-curl-ubuntu/), [ubuntu-mate](https://ubuntu-mate.community/t/should-curl-be-included-in-ubuntu-by-default/30559) |
| Windows: `powershell -WindowStyle Hidden` still flashes a console (it hides after the console opens). `conhost.exe --headless` doesn't flash (Windows 10 1809+ / 11), but it's undocumented and some EDR rules flag it | [PowerShell #3028](https://www.github.com/PowerShell/PowerShell/issues/3028), [Sigma rule](https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_conhost_headless_powershell) |

To verify while building (not established yet):
- That `setDesktopImageURL` on macOS 27 sticks across logout and changes every display (a gist
  comment reports trouble on Sonoma: [DesktopImage sample](https://developer.apple.com/library/archive/samplecode/DesktopImage/Introduction/Intro.html)).
- That the Linux setters named in §3.4 behave on their desktops.

## 2. Decisions

- **One file per OS family holds both install and the daily run:** `crons/sea-wallpaper.sh`
  (Linux + macOS; `uname` picks the OS-specific parts) and `crons/sea-wallpaper.ps1` (Windows).
  With a single file, the user reads one thing before running it, and `--upgrade` replaces one
  thing. No separate installer.
- **Version in the script's metadata:** a header comment `# sea-wallpaper version: 1.0.0` and
  `VERSION="1.0.0"` beside it (`$Version` in the `.ps1`), which the script reads. It's sent in the
  User-Agent and shown by `--status`. Bump it on every change to the file.
- **No automatic updates.** The installed copy only changes on `--upgrade`, which fetches the
  file from `main` and replaces the copy if the version is newer. `--status` makes no network
  request.
- **Install from `main`** (raw.githubusercontent.com). No release tags: the scripts change rarely.
- **"Is it new?" = `latest.json`'s `date`.** Not a hash of the image: a redeploy changes the bytes
  of the same day. The ETag only lets an unchanged check return 304 with no body. The image's
  sha256 is stored for `--status` and the log.
- **One morning run, at most one re-run a day.** Schedule: daily at 07:M local (M random per
  machine, picked at install) and at login. If today's UTC image isn't out yet, one one-off re-run
  (§3.3). No polling.
- **Desktop inferred on every run; unknown means stop.** On Linux the script detects the running
  desktop each time, so a desktop switched later is picked up. A desktop not in the table (§3.4):
  install refuses, and a scheduled run exits with an error and its name in the log. It never
  guesses a setter. macOS and Windows have one desktop each, but the script still checks there is
  a logged-in GUI session.
- **Nothing extra to install**, except `curl` on Linux if it's missing: the script stops and
  says `sudo apt install curl`. bash 3.2-compatible: no associative arrays, `${x,,}`, `mapfile`
  or `sort -V`. JSON is read with `sed` on the `"date"` and `"title"` lines (no `jq`).
- **Scheduler per OS:**
  - Ubuntu: the user crontab (`M 7 * * *`, one line tagged `# amazing-sea-wallpaper`) plus an XDG
    autostart entry for the login run.
  - macOS: a LaunchAgent (`StartCalendarInterval` 07:M + `RunAtLoad`), not cron. Cron on macOS
    skips runs during sleep and is deprecated; launchd runs a missed slot on wake.
  - Windows: one Task Scheduler task with a daily trigger and a logon trigger.
- **The re-run is a one-off job that the script makes and removes itself:** a `systemd-run --user`
  transient timer (Ubuntu), a second LaunchAgent (macOS), a run-once task (Windows).
- **Rejected:**
  - Hourly runs until it's set: six schedule entries per machine, and up to six requests on a
    stale morning.
  - A single run with no retry: Europe would often get yesterday's image.
  - Rendering locally with headless Chromium: needs Node, Playwright and a GPU.
  - System Events on macOS: fails from launchd (−1743).
  - A VBScript wrapper to hide the Windows console: VBScript is being retired by Microsoft.
  - `feh` as a catch-all Linux fallback: it would guess.
  - A systemd user timer instead of cron: the request is cron.

## 3. Design

### 3.1 Files

```
crons/sea-wallpaper.sh    # Linux + macOS: install, daily run, re-run, status, upgrade, uninstall
crons/sea-wallpaper.ps1   # Windows: the same, PowerShell 5.1 (built into Windows 10/11)
crons/test/               # fixtures + test runner (phase 5)
```

Installed copy, state and images (the repo or download can be deleted afterwards):

| | Folder | Command |
|---|---|---|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/amazing-sea-wallpaper/` | symlink `~/.local/bin/sea-wallpaper` |
| macOS | `~/Library/Application Support/AmazingSeaWallpaper/` | symlink `~/.local/bin/sea-wallpaper`; install says to add `~/.local/bin` to `PATH` if it's missing |
| Windows | `%LOCALAPPDATA%\AmazingSeaWallpaper\` | full path printed by install |

The folder holds `sea-wallpaper.sh|ps1` (the copy that runs), `config` (`minute`, `hour`,
`portrait`, `url`), `state` (`date`, `etag`, `sha256`, `title`, `set_at`, `retry_day`),
`wallpapers/<date>.jpg` (the last 7 kept) and `log` (trimmed to 500 lines).

### 3.2 Commands

| Bash | PowerShell | Does |
|---|---|---|
| `--install [--portrait] [--hour H] [--url U]` | `-Install [-Portrait] [-Hour H] [-Url U]` | checks the session (§3.4), copies itself into the folder, writes `config` (random minute 0–59), registers the schedule, then runs once in the foreground (`--now`). Re-running it is safe: it replaces its own entries |
| *(no flag; used by the schedule)* | *(none)* | the daily run (§3.3), after a random 0–300 s sleep |
| `--retry` | `-Retry` | the one-off re-run: removes its own job, never schedules another |
| `--now` | `-Now` | no sleep, ignores the state: fetch and set the newest image |
| `--dry-run` | `-DryRun` | fetch and check, print what it would set or schedule; changes nothing |
| `--status` | `-Status` | version, desktop detected, schedule, last date/title/sha256, pending re-run, last 10 log lines. No network |
| `--upgrade` | `-Upgrade` | download the file from `main` to a temp file, check it (`bash -n`; PowerShell parser), compare `VERSION`. If newer: replace the copy, re-run `--install` with the saved config, print old → new. Otherwise print "up to date" |
| `--uninstall` | `-Uninstall` | remove the schedule, autostart entry, re-run job and command link; asks before deleting the folder (images) |

Exit codes: 0 done or nothing to do · 1 network or bad image · 2 unknown desktop · 3 no GUI
session (scheduled runs log it and exit; the login run catches up) · 4 missing tool (`curl`,
`crontab`, `systemd-run`).

### 3.3 The daily run

```
today_utc = date -u +%F
1. state.date == today_utc                         → exit 0, no network
2. detect the session and desktop (§3.4)           → exit 2 / 3 if unknown / none
3. GET latest.json (If-None-Match: state.etag)
4. json.date > state.date                          → download latest.jpg to a temp file; check
                                                     HTTP 200, image/jpeg, first bytes FF D8, > 50 KB;
                                                     move to wallpapers/<date>.jpg; set it; write state;
                                                     prune to 7; cancel a pending re-run
5. json.date < today_utc  and not --retry
   and state.retry_day != today (local)            → schedule the one re-run; retry_day = today
```

- After step 4, the image set is either new or unchanged, and step 5 still applies. A day missed
  entirely sets yesterday's image now **and** schedules the re-run for today's.
- **Re-run time** = the later of *now + 3 h* and *08:00 UTC*, plus a random 0–30 min.
  - 08:00 UTC is just after the latest finish seen (07:43). Without that floor, UTC+3…+7
    (07:00 local = 00:00–04:00 UTC) would retry before the render lands.
  - Who needs a re-run: everyone west of about UTC+7 whose morning run finds yesterday's image
    (Europe, Africa, the Middle East, South Asia; the Americas rarely, since 07:00 there is
    10:00–15:00 UTC).
  - From UTC+8 east, 07:00 local is before 00:00 UTC, and today's UTC image is already out, so
    it's set and there's no re-run. It's the site's local "yesterday", the known limit in §5.
- The margin is thin (10 runs measured). If the CI keeps finishing later, the 08:00 floor moves
  in a version bump; moving the CI earlier (§5) removes the need.
- Missed slots: launchd and Task Scheduler (`StartWhenAvailable`) run them on wake. Cron doesn't,
  so the login autostart covers it, and the re-run timer is `Persistent=true`.

### 3.4 Session, desktop and setters

**Linux: detecting the desktop** (the same code at install and in every scheduled run):
1. Find the user's graphical session process: `pgrep -u "$(id -u)" -x` for each name in the
   table, first match wins.
2. Read `XDG_CURRENT_DESKTOP`, `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY` and `WAYLAND_DISPLAY` from
   its `/proc/<pid>/environ` (`tr '\0' '\n'`) and export them. Interactive runs prefer their own
   environment when it's set. If DBUS is still unset, use `unix:path=/run/user/$UID/bus`.
3. Match the `:`-separated tokens of `XDG_CURRENT_DESKTOP`, case-insensitive, against the table.
4. No known process found: if `loginctl list-sessions` shows a graphical session for the user
   (`loginctl show-session ID -p Type --value` is `x11`/`wayland`), the desktop is unknown →
   exit 2, naming `XDG_SESSION_DESKTOP`/`Desktop=`. No graphical session at all → exit 3.

| Desktop (tokens) | Session process | Set with | Status |
|---|---|---|---|
| GNOME, ubuntu, Unity, pop, Budgie | `gnome-shell`, `budgie-panel` | `gsettings set org.gnome.desktop.background picture-uri file://…`, same for `picture-uri-dark` (GNOME 42+; skipped when the key is missing), `picture-options zoom` | phase 1, Ubuntu tested later |
| KDE (Plasma 5.24+, 6) | `plasmashell` | `plasma-apply-wallpaperimage <path>` | phase 4 |
| XFCE | `xfdesktop` | `xfconf-query -c xfce4-desktop -l` → every `…/last-image` set to the path; `…/image-style` 5 (zoom) | phase 4 |
| X-Cinnamon | `cinnamon` | `gsettings set org.cinnamon.desktop.background picture-uri file://…` | phase 4 |
| MATE | `mate-session` | `gsettings set org.mate.background picture-filename <path>` (a path, not a URI) | phase 4 |
| LXQt | `pcmanfm-qt` | `pcmanfm-qt --set-wallpaper=<path> --wallpaper-mode=zoom` | phase 4 |
| anything else (sway, i3, Hyprland…) | — | **none: exit 2** "desktop X isn't supported" | — |

The setter checks its tool exists (else exit 4) and that the call succeeded. GNOME: read the
value back with `gsettings get`.

**macOS:**
- Session check: the console user is us (`stat -f%Su /dev/console`) and the GUI domain exists
  (`launchctl print gui/$UID`).
- Set: `/usr/bin/osascript -l JavaScript` with `ObjC.import("AppKit")`, then for each
  `NSScreen.screens` call `NSWorkspace.sharedWorkspace.setDesktopImageURLForScreenOptionsError`
  with `NSURL.fileURLWithPath(path)` and `{}` options. Check the return value, then read it back
  with `desktopImageURLForScreen`. No Automation permission is needed. The file name changes
  daily (`<date>.jpg`), so macOS doesn't serve a cached picture.
- Fallback, only if phase 1 shows the NSWorkspace call doesn't stick on macOS 27: System Events,
  with the consent prompt raised by the foreground run during `--install`.

**Windows:**
- Session check: `explorer.exe` running in the current session.
- Set: `HKCU:\Control Panel\Desktop` `WallpaperStyle=10` (Fill) and `TileWallpaper=0`, then
  `SystemParametersInfo(0x14 SPI_SETDESKWALLPAPER, 0, path, 0x01|0x02)` via `Add-Type` P/Invoke.
  Check the return value, then read it back with `SPI_GETDESKWALLPAPER` (0x73).

### 3.5 Scheduling per OS

- **Ubuntu (cron):**
  - Install: `crontab -l 2>/dev/null | grep -v '# amazing-sea-wallpaper' ; echo "M H * * * <copy> >> <log> 2>&1 # amazing-sea-wallpaper"` piped to `crontab -`.
  - Login: `~/.config/autostart/amazing-sea-wallpaper.desktop` (`Exec=<copy>`,
    `X-GNOME-Autostart-Delay=30`).
  - Re-run: `systemd-run --user --unit=amazing-sea-wallpaper-retry --on-calendar='YYYY-MM-DD HH:MM:SS UTC' --timer-property=Persistent=true <copy> --retry`.
    A unit already present means one is pending. Cancel with
    `systemctl --user stop amazing-sea-wallpaper-retry.timer`.
  - Missing `crontab` or `systemd-run`: install exits 4.
- **macOS (launchd):**
  - `~/Library/LaunchAgents/io.github.amazing-sea-wallpaper.plist`: `ProgramArguments` = `/bin/bash <copy>`,
    `StartCalendarInterval {Hour H, Minute M}`, `RunAtLoad true`, stdout/stderr to the log.
  - Load: `launchctl bootout gui/$UID <plist>` (ignore errors), then `launchctl bootstrap gui/$UID <plist>`.
  - Re-run: `io.github.amazing-sea-wallpaper.retry.plist` with `StartCalendarInterval` at the
    re-run's local hour and minute (`date -r EPOCH +%H` / `%M`) and arguments `--retry`. The
    `--retry` run boots itself out and deletes the plist, so the daily repeat never happens.
- **Windows (Task Scheduler):**
  - Task `AmazingSeaWallpaper`: `New-ScheduledTaskTrigger -Daily -At H:M` with
    `-RandomDelay 00:05:00`, plus `-AtLogOn -User $env:USERNAME`. Settings:
    `-StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries`. Principal: the
    current user, `-LogonType Interactive` (the wallpaper is per session).
  - Action: `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<copy>"`.
    On builds before 17763, or with `-ShowWindow`, it uses `powershell.exe -WindowStyle Hidden` (a brief flash).
  - Re-run: task `AmazingSeaWallpaperRetry`, `-Once -At <local time>`, trigger
    `EndBoundary` = +6 h and `-DeleteExpiredTaskAfter 00:00:01` (deletion needs an end
    boundary). The `-Retry` run unregisters it.
  - `Invoke-WebRequest` throws on 304: catch it and read `StatusCode`.
  - The execution policy is never changed system-wide.

### 3.6 Spreading the load

Install picks the minute (0–59). Each scheduled run sleeps a random 0–300 s (Windows: the
trigger's `RandomDelay`), and the re-run adds 0–30 min. Per user per day: one `latest.json`
request (two on a stale morning, mostly 304s) and one image download. The User-Agent is
`amazing-sea-wallpaper/<version>`, with no user data. `curl --fail --retry 2 --max-time 60`.

## 4. Phases

Each phase ends with its checks passing, docs touched and one commit. The phases on this Mac are
done for real; Ubuntu and Windows are written in phases 3–4 and tested when those machines are
available (§4 "Later testing").

1. **Core of `sea-wallpaper.sh`, macOS first.** Version metadata, config/state files, the daily
   run (§3.3) with the image checks, `--now`, `--dry-run`, `--status`, the macOS session check and
   NSWorkspace setter, plus the Linux detection and GNOME setter (written, untested). A hidden
   test override `SEA_WALLPAPER_TODAY=YYYY-MM-DD` for `today_utc`.
   Done when, on this Mac:
   - `--dry-run` against the live site prints today's date and title.
   - `--now` changes every display, and the picture survives logout/login. Before testing,
     record the current picture (`/System/Library/CoreServices/DefaultDesktop.heic` today) and
     restore it afterwards.
   - A second run the same UTC day makes no request.
   - `shellcheck` passes (`brew install shellcheck`, dev only).
2. **Install, re-run, upgrade, uninstall, macOS.** LaunchAgent, the retry plist, `--retry`,
   `--upgrade`, `--uninstall`, `~/.local/bin` link. Done when, on this Mac:
   - `--install` shows 07:M in `--status` and `launchctl print gui/$UID/io.github.amazing-sea-wallpaper`.
   - With `--url` at a local fixture server holding yesterday's date, a run creates exactly one
     retry plist at the right local time. A second run creates none. The `--retry` run deletes it.
   - `--upgrade` against a fixture with a higher `VERSION` replaces the copy, and with the same
     version says "up to date".
   - `--uninstall` leaves no plist, link or retry job.
   - After a sleep through 07:M, launchd runs it on wake.
3. **Linux parts of the same script:** crontab line, autostart entry, `systemd-run` re-run, the
   full detection (§3.4 steps 1–4) with exits 2/3/4. On this Mac: `shellcheck`, and the detection
   logic as a function fed fixture `environ` files and process lists. Done when those pass.
4. **Other Linux desktops** (KDE, XFCE, Cinnamon, MATE, LXQt rows) and **`sea-wallpaper.ps1`**
   (§3.2 commands, §3.4–3.5 Windows). Done here when PSScriptAnalyzer (`pwsh` on this Mac) and
   the parser are clean, and the fetch/state logic passes `-DryRun` under `pwsh` against the
   fixtures.
5. **CI** (`.github/workflows/crons.yml`, on changes to `crons/`).
   - Fixtures in `crons/test/`: `latest.json` with yesterday's and today's dates, a valid and a
     truncated JPEG, an HTML error page, a 304 path, served by `python3 -m http.server`.
   - `crons/test/run.sh` drives the script with `--dry-run --url http://localhost:…` and
     `SEA_WALLPAPER_TODAY` through each case:
     - new date → set
     - same date with a new ETag → not set
     - stale → one re-run, re-run → none
     - bad image → exit 1, state unchanged
   - Jobs:
     - `ubuntu-latest`: shellcheck, `run.sh`, and detection with no desktop (exit 3).
     - `macos-latest`: `run.sh` under `/bin/bash` 3.2.
     - `windows-latest`: PSScriptAnalyzer and the `.ps1` cases.
6. **Docs:**
   - README section without "planned".
   - A `changelog.md` row.
   - ARCHITECTURE.md "Page, cache, CI": who reads `latest*.jpg`, when, and the CI's late finish
     as a known issue (measured from the Actions API).
   - TOOLS.md: `crons/test/run.sh`.

**Later testing (when the machines are available):**
- Ubuntu 24.04 GNOME, Wayland and X11: install, a scheduled run from cron, the re-run, the dark
  key, uninstall.
- Windows 11: install, no console flash, logon run, the retry task deleting itself, uninstall.
- Each other Linux desktop once (VM or live session). Rows not tried stay marked untested in the
  README.

## 5. Known limits and later

- **The image follows the UTC date:** east of about UTC+8 the desktop shows the site's local
  "yesterday" all day. Fixing it means rendering locally or a CI change.
- **Earlier CI** (agreed: later, separate from these scripts): GitHub delays the busy 00:05 UTC
  schedule. An odd-minute run the evening before (e.g. `'17 23 * * *'` rendering tomorrow's UTC
  date) would make the image ready before every morning and the re-run rare.
- **Resolution:** 1920×1080 only; 1440p and 4K screens scale it up. A 4K render adds SwiftShader
  time to the CI; decide with the item above.
- **Displays and Spaces:** GNOME and Windows set one picture for all displays. macOS sets each
  display (NSWorkspace sets the current Space only).
- **Lock screen:** out of scope.
