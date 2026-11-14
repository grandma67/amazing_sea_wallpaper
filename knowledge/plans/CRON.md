# Daily desktop wallpaper: a scheduled script per OS (plan)

Goal: a small script that runs every morning, downloads the day's wallpaper the Pages site
already serves (`/latest.jpg`) and sets it as the desktop background. Each machine runs it at its
own time, so users don't all hit the site at the same minute. Supported: **Ubuntu** (bash + cron),
**macOS** (bash + launchd), **Windows** (PowerShell + Task Scheduler). Scripts live in `crons/`.

Status: plan only (2026-11-14). Nothing built yet. The README "Daily desktop wallpaper" section
describes the planned use and is marked as planned until phase 1 ships.

## What the site serves (checked 2026-11-14)

- `https://grandma67.github.io/amazing_sea_wallpaper/latest.jpg`: 1920×1080 JPEG (~290 KB),
  `latest-portrait.jpg` 1290×2796; `latest.json` / `latest-portrait.json` hold the params,
  including `"date": "YYYY-MM-DD"` (the **UTC** date the CI rendered) and `"title"`.
- Headers: `cache-control: max-age=600`, `etag`, `last-modified`, `access-control-allow-origin: *`.
  So conditional requests (`If-None-Match`) work, and a check that finds nothing new costs a
  304 and no body.
- **When it updates:** `pages.yml` is scheduled at 00:05 UTC, but GitHub starts scheduled runs
  late. The last 10 scheduled runs (API `actions/workflows/pages.yml/runs?event=schedule`) finished
  between **01:10 and 07:43 UTC**, and later every day for the last four (06:26, 06:51, 07:43,
  07:31). A European user at 07:00 local (05:00–06:00 UTC) often finds **yesterday's** image. So
  one morning fetch is not enough: the script must notice a stale image and check again later.
- Only today's image is published (Pages deploys the current `dist/` only; `daily/pc/<date>.jpg`
  holds just today's). The script can't ask for a given date, only for "latest".
- The page picks "today" by the **local** date (`main.ts`); `latest.jpg` follows the **UTC** date.
  East of UTC (Asia, Oceania) the desktop shows the site's yesterday until the CI run lands. That's
  fine for a wallpaper; the plan doesn't try to fix it (a fix would mean rendering locally).

## Decisions

- **One script per OS family, one installer each.** The script fetches and sets the wallpaper and
  can be run by hand. The installer copies it out of the repo into the user's data dir and
  registers the schedule, so the clone can be deleted afterwards.
  ```
  crons/
    sea-wallpaper.sh      # fetch + set, Linux and macOS (POSIX-ish bash 3.2: macOS ships 3.2)
    install.sh            # install / --uninstall / --status, Linux (cron) and macOS (launchd)
    sea-wallpaper.ps1     # fetch + set, Windows (PowerShell 5.1, built into Windows 10/11)
    install.ps1           # install / -Uninstall / -Status, Task Scheduler
  ```
- **One morning run; if the image hasn't changed, one re-run a few hours later.** The schedule
  fires **once a day at 07:M local** and at login. Each run:
  1. If the state file already holds today's UTC date: exit, **no network** (a login run after
     the morning run already did its job).
  2. Else GET `latest.json` with the stored ETag (`If-None-Match`).
  3. **New:** its `date` is newer than the state's. Download `latest.jpg` to a temp file, check it
     (HTTP 200, `image/jpeg`, starts with `FF D8`, > 50 KB), move it to
     `<data>/wallpapers/<date>.jpg`, set it, write the state (`date`, ETag, sha256 of the image,
     title). Keep the last 7 images, delete older ones. Cancel a pending re-run, if any.
  4. **Same:** a 304, or the same `date`. The CI run hasn't landed yet. If today's UTC `date` is
     still to come and no re-run is pending, **schedule one re-run in 3 h** (a one-off job, below)
     and exit. If this run *is* the re-run, log "still yesterday's" and stop until tomorrow: one
     re-run a day, no polling.
  "Has it changed" is decided by `latest.json`'s `date`, not by a hash of the image. A push to
  `main` redeploys and re-renders the same day, which changes the image's bytes and the ETag
  without making a new day. The ETag only saves the body on a 304; the stored sha256 is just
  for the log and `--status`.
  Timing: with the CI's 01:10–07:43 UTC finish, a 07:M morning run already finds today's image
  west of about UTC+0 (the Americas: 07:00 is 11:00–15:00 UTC). In Europe and Africa (05:00–
  07:00 UTC) the image is often yesterday's, and the re-run at about 10:00 local (08:00–10:00
  UTC) comes after every finish seen so far. Further east, 07:00 local is before 00:00 UTC, so
  the morning run gets the newest image there is (the UTC day before), a new picture every
  morning (Tokyo 07:00 = 22:00 UTC: today's UTC date has already landed), so no re-run there.
- **The one-off re-run per OS** (made by the script, removed by the next run):
  - Linux: `systemd-run --user --on-active=3h --unit amazing-sea-wallpaper-retry …/sea-wallpaper.sh --retry`
    (systemd is in every Ubuntu; `at` isn't installed by default). Fallback when there is no
    user systemd: `nohup sh -c 'sleep 10800; …' &` (dies on logout; logged).
  - macOS: a second LaunchAgent `io.github.amazing-sea-wallpaper.retry.plist` with a single
    `StartCalendarInterval` at now + 3 h (hour and minute); the `--retry` run boots it out and
    deletes it. (`at` is disabled on macOS by default.)
  - Windows: `Register-ScheduledTask AmazingSeaWallpaperRetry` with a `-Once -At (Get-Date).AddHours(3)`
    trigger and `-DeleteExpiredTaskAfter 01:00:00`; the `-Retry` run unregisters it.
  A machine asleep at the re-run time: launchd and Task Scheduler (`StartWhenAvailable`) run it on
  wake; systemd's `--on-active` timer is monotonic and doesn't count suspended time, so it fires
  3 h of awake time later. Both are fine for a wallpaper.
- **Spreading the load ("not everyone at the same time"):** two layers.
  - **Install time:** the installer picks a random minute `M` (0–59) once and schedules `07:M`
    daily. Users are spread over the hour by machine, not all at :00.
  - **Run time:** each scheduled run first sleeps a random 0–300 s (Windows: the trigger's
    `RandomDelay`); the re-run adds its own 0–30 min to the 3 h, so re-runs don't bunch either.
  A user costs one JSON request a day (two on a stale morning) and one image download.
- **Scheduler per OS (and why not plain cron everywhere):**
  - **Ubuntu: user crontab** (`crontab -l | … | crontab -`), as asked. One tagged line
    (`# amazing-sea-wallpaper`) so install/uninstall finds it:
    `M 7 * * * $HOME/.local/share/amazing-sea-wallpaper/sea-wallpaper.sh --cron >> …/log 2>&1`.
    Cron misses a run while the laptop sleeps; the login run covers that.
    Login: an XDG autostart entry `~/.config/autostart/amazing-sea-wallpaper.desktop`.
  - **macOS: a launchd LaunchAgent**
    (`~/Library/LaunchAgents/io.github.amazing-sea-wallpaper.plist`, `StartCalendarInterval` at 07:M +
    `RunAtLoad`), not cron: cron on macOS is deprecated, skips runs during sleep and needs Full
    Disk Access for some paths; launchd runs a missed calendar slot on wake. Loaded with
    `launchctl bootstrap gui/$UID …`, removed with `launchctl bootout`.
  - **Windows: Task Scheduler** (`Register-ScheduledTask`): a daily trigger at 07:M,
    `-RandomDelay (New-TimeSpan -Minutes 5)`, plus an `AtLogOn` trigger;
    `StartWhenAvailable` (runs a missed slot when the PC wakes), `-DontStopIfGoingOnBatteries`,
    principal = the current user, `LogonType Interactive` (the wallpaper is per-session; a task
    "run whether logged on or not" can't set it).
- **Setting the wallpaper:**
  - **Ubuntu / GNOME** (the default desktop): `gsettings set org.gnome.desktop.background
    picture-uri file://…` **and** `picture-uri-dark` (22.04+ shows the dark key in dark mode),
    `picture-options zoom`. From cron there is no session bus: export
    `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus` when it's unset.
  - Other Linux desktops, detected at install from `XDG_CURRENT_DESKTOP` (cron doesn't have it)
    and stored in the config: KDE `plasma-apply-wallpaperimage`, XFCE `xfconf-query` on every
    `last-image` property, Cinnamon/MATE their `gsettings` schemas, otherwise `feh --bg-fill`
    when present; else exit with a message naming the desktop. Ubuntu GNOME is the tested one;
    the rest are best effort, tested by hand once each where possible.
  - **macOS:** `osascript -e 'tell application "System Events" to tell every desktop to set
    picture to POSIX file "<path>"'`. The **path must change each day** (macOS caches by path,
    so the same name won't refresh): hence `<date>.jpg`. The first run asks for Automation
    permission ("Terminal/bash wants to control System Events"); the installer runs the script
    once in the foreground so the prompt shows while the user is there. Known limit: only the
    current Space of each display changes (no public API for the others).
  - **Windows:** `SystemParametersInfo(SPI_SETDESKWALLPAPER = 0x14, 0, path,
    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE)` via `Add-Type` P/Invoke, after setting
    `HKCU:\Control Panel\Desktop` `WallpaperStyle = 10` (Fill), `TileWallpaper = 0`. Run hidden:
    the task runs `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File …`
    (no console flash on Windows 10 1809+ / 11).
- **Files per OS** (data dir holds the copied script, `config`, `state`, `wallpapers/`, `log`;
  log trimmed to 500 lines):
  - Linux: `${XDG_DATA_HOME:-~/.local/share}/amazing-sea-wallpaper/`
  - macOS: `~/Library/Application Support/AmazingSeaWallpaper/`
  - Windows: `%LOCALAPPDATA%\AmazingSeaWallpaper\`
- **Options** (installer flags written to `config`; the script reads them):
  `--portrait` (use `latest-portrait.jpg`, for upright screens), `--hour 7` (morning run hour),
  `--url` (base URL, for forks; default the Pages site), `--uninstall`, `--status` (schedule,
  last date set, title, last log lines). Script: `--now` (skip the sleep, ignore the state: a
  manual refresh), `--dry-run` (fetch and check, don't set), `--cron` (sleep + quiet output),
  `--retry` (the one-off re-run: never schedules another).
- **Tools only from the OS:** bash 3.2, `curl`, `date -u`; JSON read with `sed` on the one
  `"date"` and `"title"` lines (no `jq`, not installed by default on Ubuntu or macOS). Windows:
  PowerShell 5.1 (`Invoke-WebRequest -UseBasicParsing`, `ConvertFrom-Json`). Nothing to install.
- **Install** from a clone (`./crons/install.sh`, `.\crons\install.ps1`) or from one raw file
  (`curl -fsSL https://raw.githubusercontent.com/grandma67/amazing_sea_wallpaper/main/crons/install.sh -o install.sh`,
  read it, then `bash install.sh`). When run outside a clone, `install.sh` downloads
  `sea-wallpaper.sh` from the same raw base. The README says to read the script first and doesn't
  pipe it into a shell. Windows: `Unblock-File` on the downloaded files; `-ExecutionPolicy Bypass`
  only on the task's own command line, never a machine policy change.
- **Courtesy:** a `User-Agent: amazing-sea-wallpaper-cron/<version>` header (generic, no user
  data), `curl --retry 2 --max-time 60`, never more than one image download per UTC day.

Rejected:
- **Rendering locally** (headless Chromium + `snapshot.mjs`): any date, any resolution, the local
  date. But it needs Node, Playwright and a GPU, minutes of work per day, and breaks on laptops
  with no GPU. The site already renders once for everyone. Kept as a possible later `--render`.
- **One 07:00 run, nothing else:** since the CI often lands after 07:00 UTC, Europe would often
  get yesterday's image.
- **Hourly runs 07:00–12:00 until it's set:** works, but six scheduled entries per machine and up
  to six requests on a stale morning; the one-off re-run gets the same result with one.
- **systemd user timer on Linux** (`RandomizedDelaySec`, `Persistent=true` catches missed runs):
  technically better than cron, but the request is cron; noted as an alternative in the README.
- **Third-party setters** (`desktoppr`, `wallpaper` npm, `feh` as the default): no extra installs.

## Phases

1. **Script, Linux + macOS** (`crons/sea-wallpaper.sh`). The state/ETag/JPEG-check logic, the
   GNOME and macOS setters, `--now`, `--dry-run`, `--cron`. Done when: `--dry-run` passes on both
   OSes; `--now` changes the desktop on Ubuntu 24.04 GNOME (Wayland and X11) and macOS 15+; a
   second run in the same UTC day makes no request (the log says "already set").
2. **Installer, Linux + macOS** (`crons/install.sh`). Random minute, crontab line / LaunchAgent,
   autostart entry, the first foreground run (macOS permission prompt), `--status`, `--uninstall`
   (removes the schedule and autostart entry; asks before deleting the data dir). Done when:
   install → `--status` shows 07:M at a random minute; sleep through 07:M and wake →
   launchd runs it (macOS); with a fixture `latest.json` holding yesterday's date, the run
   schedules exactly one re-run, and the re-run schedules none; uninstall leaves no crontab line, plist or autostart entry.
3. **Windows** (`crons/sea-wallpaper.ps1`, `crons/install.ps1`). Same behaviour and flags
   (`-Now`, `-DryRun`, `-Portrait`, `-Uninstall`, `-Status`). Done when: on Windows 11 the task
   appears at 07:M, a stale fixture makes one
   `AmazingSeaWallpaperRetry` task that removes itself, running it changes the wallpaper with no console window,
   and it runs at the next logon.
4. **Other Linux desktops:** KDE, XFCE, Cinnamon, MATE, `feh` fallback; a clear message
   otherwise. Done when each is tried once in a VM or live session, or listed as untested.
5. **CI checks** (`.github/workflows/crons.yml`, on changes to `crons/`): `shellcheck` on both
   `.sh`, `bash -n` under bash 3.2 behaviour (`macos-latest` job running `--dry-run` against
   the live site), PSScriptAnalyzer + `-DryRun` on `windows-latest`, and an `ubuntu-latest` job
   that runs `sea-wallpaper.sh --dry-run` against a local `python3 -m http.server` serving a
   fixture `latest.json`/`latest.jpg` (stale date → one re-run scheduled, new date, same date
   with a new ETag → not set again, 304, broken JPEG, HTML error page).
6. **Docs:** README section (no longer "planned"), changelog row, ARCHITECTURE.md "Page, cache,
   CI" (who reads `latest*.jpg` and when), a known issue for the late CI runs.

## Open questions and later

- **Earlier CI runs:** GitHub delays schedules at busy times (00:00 UTC is the busiest). Moving
  `pages.yml` to an odd minute (e.g. `'17 23 * * *'` rendering *tomorrow's* UTC date) would make
  the image ready before any morning; that changes the CI, not these scripts. It would make the
  re-run rarely needed.
- **Resolution:** `latest.jpg` is 1920×1080; 1440p and 4K screens upscale it. A `latest-4k.jpg`
  in CI costs SwiftShader time (the PC render already takes tens of minutes); decide with the
  CI-timing change above.
- **Multi-monitor and Spaces:** Windows and GNOME set one image across all displays; macOS sets
  each display's current Space only.
- **Lock screen:** not in scope (Windows needs `PersonalizationCSP` / WinRT, GNOME has no
  separate lock image since 42, macOS derives it from the desktop).
