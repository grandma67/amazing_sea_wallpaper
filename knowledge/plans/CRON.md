# Daily desktop wallpaper: `amazing-sea-wallpaper` scripts (plan)

Goal: a script that runs every morning, fetches the wallpaper the Pages site already renders
(`latest.jpg`) and sets it as the desktop background. Each machine runs at its own random minute,
so users don't all hit the site at once.
- Linux and macOS share one bash script; Windows has a PowerShell one. Both live in `crons/`.
- Scope: each OS's **default edition**:
  - Ubuntu (GNOME), Debian (GNOME), Linux Mint (Cinnamon), Zorin OS (GNOME), elementary OS
    (Pantheon), Pop!_OS (COSMIC), Fedora Workstation (GNOME), openSUSE (KDE Plasma or GNOME),
    Solus (Budgie).
  - Arch and Gentoo have no default desktop: they're supported when they run one of those
    desktops.
  - macOS, and Windows 10/11 (activated).

Status: plan (2026-11-14). Nothing built. The README section is marked "planned" until phase 7.
Testing: on this Mac (macOS 27.0.1, bash 3.2.57) during the build; Linux and Windows later.
Until a distro is tried, it ships labelled untested.

## 1. Naming and where things live

Everything is named after the project, **`amazing-sea-wallpaper`**. Everything the script owns
sits in **one folder** of that name, in the OS's usual place for per-user application data.

| | The one folder | Command |
|---|---|---|
| Linux | `${XDG_DATA_HOME:-$HOME/.local/share}/amazing-sea-wallpaper/` | symlink `~/.local/bin/amazing-sea-wallpaper` |
| macOS | `~/Library/Application Support/amazing-sea-wallpaper/` | symlink `~/.local/bin/amazing-sea-wallpaper` |
| Windows | `%LOCALAPPDATA%\amazing-sea-wallpaper\` | the full path, printed by install |

Inside it:
- `amazing-sea-wallpaper.sh|ps1`: the installed copy that runs.
- `config`: `minute`, `hour`, `portrait`, `url`, `scheduler`, `proxy`.
- `state`: `date`, `etag`, `sha256`, `title`, `set_at`, `retry_day`.
- `wallpapers/<date>.jpg`: the last 7 kept.
- `amazing-sea-wallpaper.log`: trimmed to 500 lines.
- `lock/`.
- On Linux, also the systemd unit files (linked, below).

The OS only reads its scheduler and login entries from its own folders, so these few small files
live outside the folder. Each one carries the project name, points into the folder, and is
removed by `--uninstall`:

| OS | Entry outside the folder | Name |
|---|---|---|
| Linux, cron | a line in the user's crontab (the cron spool) | tagged `# amazing-sea-wallpaper`; re-run `# amazing-sea-wallpaper-retry` |
| Linux, systemd | `~/.config/systemd/user/` symlinks, made by `systemctl --user link` to unit files kept in the folder | `amazing-sea-wallpaper.service` / `.timer`, `amazing-sea-wallpaper-retry.timer` |
| Linux, login | `~/.config/autostart/amazing-sea-wallpaper.desktop` (cron backend only) | — |
| macOS | `~/Library/LaunchAgents/amazing-sea-wallpaper.plist` (launchd only loads agents at login from there) | label `amazing-sea-wallpaper`; re-run `amazing-sea-wallpaper-retry` |
| Windows | Task Scheduler folder `\amazing-sea-wallpaper\` | tasks `amazing-sea-wallpaper`, `amazing-sea-wallpaper-retry` |
| Linux, macOS | the command link in `~/.local/bin/` | `amazing-sea-wallpaper` |

Script files in the repo: `crons/amazing-sea-wallpaper.sh` and `crons/amazing-sea-wallpaper.ps1`.
The User-Agent is `amazing-sea-wallpaper/<version>`.

## 2. Facts this plan stands on (checked 2026-11-14)

### 2.1 The site

| Fact | How checked |
|---|---|
| `latest.jpg`: 1920×1080, ~290 KB. `latest-portrait.jpg`: 1290×2796. `latest.json` (12.7 KB) has exactly one `"date": "YYYY-MM-DD"` (the UTC day rendered) and one `"title"` (UTF-8), one key per line | live `curl` + `grep -o`; `scripts/snapshot.mjs:223` |
| `cache-control: max-age=600`, `etag`; `If-None-Match` gives **304** | live `curl` (304 seen) |
| The CDN caches the JSON and the JPEG separately, so for up to 10 min after a deploy a fresh JSON can come with yesterday's JPEG | follows from per-URL `max-age` |
| Only today's image is published. If the render step fails (`continue-on-error`), there's no `latest.jpg` (404) that day | `.github/workflows/pages.yml` |
| The CI is scheduled at 00:05 UTC but starts late. The last 10 scheduled runs finished between **01:10 and 07:43 UTC** (11-05…11-14: 02:09, 01:10, 02:18, 01:18, 02:00, 02:24, 07:31, 07:43, 06:51, 06:26) | GitHub API `actions/workflows/pages.yml/runs?event=schedule` |
| A push to `main` re-renders the same day: the bytes and ETag change, the `date` doesn't | `pages.yml` |
| The page's "today" is the local date; `latest.jpg` follows the UTC date | `src/main.ts:288` |
| `raw.githubusercontent.com` (for `--upgrade`): `max-age=300` | `curl -I` |

### 2.2 Default editions

| OS (default edition) | Desktop, `XDG_CURRENT_DESKTOP` | Cron | `curl` / `wget` | How checked |
|---|---|---|---|---|
| Ubuntu 24.04 Desktop | GNOME, `ubuntu:GNOME` | **yes** (cron 3.0pl1, anacron) | **no curl**, wget 1.21 | official ISO manifest `ubuntu-24.04.3-desktop-amd64.manifest` |
| Debian 13.7 GNOME | GNOME 48, `GNOME` | **yes** (cron 3.0pl1, anacron) | curl 8.14, **no wget** | official live list `debian-live-13.7.0-amd64-gnome.iso.packages` |
| Linux Mint 22 Cinnamon | Cinnamon, `X-Cinnamon` | yes (Ubuntu 24.04 base) | wget at least (Ubuntu base) | base manifest above |
| Zorin OS 17/18 Core | Zorin = GNOME, `zorin:GNOME` | yes (Ubuntu base) | as Ubuntu | base manifest above |
| elementary OS 8 | Pantheon (Gala 8.x), `Pantheon` | yes (Ubuntu 24.04 base) | as Ubuntu | base manifest; settings source below |
| Pop!_OS 24.04 | COSMIC (epoch 1.11), `COSMIC` | yes (Ubuntu 24.04 base) | as Ubuntu | `cosmic-session` `data/start-cosmic` sets `XDG_CURRENT_DESKTOP=COSMIC` |
| Fedora 43/44 Workstation | GNOME, `GNOME` | **no** (cron dropped from Workstation in F34) | curl yes (dnf); wget is wget2 | [Fedora WS #183](https://pagure.io/fedora-workstation/issue/183), [Fedora KDE #485](https://pagure.io/fedora-kde/SIG/issue/485) |
| openSUSE Tumbleweed / Leap 16 | KDE Plasma or GNOME (installer choice; moving to the Agama installer in 2026) | **no** (systemd timers by policy) | curl yes | [opensuse-factory](https://lists.opensuse.org/archives/list/factory@lists.opensuse.org/thread/LK6DLRW7KNYHTQWDMLC2FTVOATZP5VO3/), [Phoronix](https://phoronix.com/news/openSUSE-Tumbleweed-Goes-Agama) |
| Solus 4.x Budgie | Budgie 10.10 (Wayland, labwc), `Budgie:GNOME` | not established; the design works either way | — | [Budgie on Solus](https://aquilapl.github.io/Budgie-test-10.10/) |
| Arch | none (archinstall profiles) | **no** (cronie optional and not enabled) | curl always (pacman) | [Arch wiki Cron](https://wiki.archLINUX.org/title/Cron), [FS#38255](https://bugs.archlinux.org/task/38255) |
| Gentoo | none | user's choice; **OpenRC** by default (no systemd user manager) | wget in @system | — |

### 2.3 How each default desktop sets its wallpaper (read in its own source)

- **GNOME** (Ubuntu, Debian, Zorin, Fedora, openSUSE): `org.gnome.desktop.background`
  `picture-uri`, plus `picture-uri-dark` (used in dark style, GNOME 42+), and `picture-options`.
- **Pantheon (elementary OS 8):** its Settings app (`elementary/settings-desktop`
  `src/Views/Wallpaper.vala:192–193`) writes `org.gnome.desktop.background picture-uri` and sets
  **`picture-uri-dark` to `""`**. It reads `picture-options`, with `zoom` when `none`.
- **Budgie 10.10 (Solus):** `budgie-daemon` (`src/daemon/background.vala`) reads
  `org.gnome.desktop.background` and reacts to its `changed` signal by restarting `swaybg` with
  the mode mapped from `picture-options`. So `gsettings` works live.
- **Cinnamon (Mint):** `org.cinnamon.desktop.background picture-uri`, `picture-options`.
- **KDE Plasma (openSUSE, Fedora KDE):** `plasma-apply-wallpaperimage <path>` sets every screen
  ([KDE discuss](https://discuss.kde.org/t/cli-command-changing-wallpaper-affects-all-screens-gui-only-one/30636)).
- **COSMIC (Pop!_OS 24.04),** from `pop-os/cosmic-bg` source:
  - The user file `~/.config/cosmic/com.system76.CosmicBackground/v1/all` overrides the system
    default `/usr/share/cosmic/com.system76.CosmicBackground/v1/all`. It's RON, e.g.
    `(output: "all", source: Path("…"), filter_by_theme: #true, rotation_frequency: 3600, filter_method: Lanczos, scaling_mode: Zoom, sampling_method: Alphanumeric)`.
  - `same-on-all` is a sibling key file.
  - `cosmic-bg` **watches the config and applies changes live** (`ConfigWatchSource` in
    `src/main.rs`).
  - On `master` since 2026-11-06 (after the epoch-1.11.0 tag of 2026-10-20), there are also
    per-mode copies `com.system76.CosmicBackground.Dark` / `.Light`, seeded once from the shared
    one. A future release will read those.
  - Autostart: `cosmic-session.target` wants `xdg-desktop-autostart.target`, so
    `~/.config/autostart` works.
- **Cron's environment:** cron runs jobs with a bare environment (`PATH=/usr/bin:/bin`, no
  `DISPLAY`, `DBUS_SESSION_BUS_ADDRESS` or `XDG_CURRENT_DESKTOP`) through `/bin/sh` (dash on the
  Debian family), and `%` in a crontab line is a newline. The session's processes carry the
  variables in `/proc/<pid>/environ`, and `pgrep -x` matches the kernel `comm`, cut at 15
  characters.
  ([Manjaro howto](https://forum.manjaro.org/t/howto-check-a-user-session-type-wayland-x11-you-are-using-on-gnome-kde/87165), [GNOME bug 727546](https://bugzilla.gnome.org/show_bug.cgi?id=727546))
- **systemd user timers:** `Persistent=true` catches up a missed run when the user manager next
  starts (login) ([arch-general](https://mailman.archlinux.org/pipermail/arch-general/2014-May/036169.html)).
  Transient units made by `systemd-run` live in `/run` and **are lost at logout or reboot**, so
  the re-run uses a real unit file.

### 2.4 macOS (tested on this Mac, 2026-11-14) and Windows

- **macOS 27.0.1:** bash 3.2.57, `curl`, `shasum`, BSD `date`/`sed`/`stat`.
- **Setting the picture, tested on this Mac:**
  - `osascript -l JavaScript` with `ObjC.import('AppKit')` and
    `NSWorkspace.sharedWorkspace.setDesktopImageURLForScreenOptionsError(url, screen, {}, err)`
    returned OK.
  - The change is **asynchronous**: an immediate `desktopImageURLForScreen` still returns the
    old picture, and the new one after ~4 s.
  - It's saved in `~/Library/Application Support/com.apple.wallpaper/Store/Index.plist` under the
    current Space as a `com.apple.wallpaper.choice.image` choice, so it's stored on disk, not
    just shown.
  - No Apple Events permission was asked. The original picture was restored afterwards.
- **macOS, not this route:** "System Events" from a launchd job fails with −1743 (no consent
  prompt there) ([Apple forum](https://discussions-jp-prz.apple.com/thread/255432048)).
- **launchd:** `man launchd.plist`: with `StartCalendarInterval`, "unlike cron which skips job
  invocations when the computer is asleep, launchd will start the job the next time the computer
  wakes up", with missed intervals coalesced into one. A powered-off Mac is covered by `RunAtLoad`
  at login.
- **Windows:** `powershell -WindowStyle Hidden` still flashes a console. `conhost.exe --headless`
  doesn't (Windows 10 1809+ / 11), but it's undocumented and flagged by some EDR rules
  ([PowerShell #3028](https://www.github.com/PowerShell/PowerShell/issues/3028), [Sigma rule](https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_conhost_headless_powershell)).

### 2.5 Still open (settled during the build, none changes the design)

- macOS: the picture survives logout/login (phase 1; the Store entry suggests yes).
- Solus: whether cron is present. Either backend works.
- openSUSE: which of KDE or GNOME the new installer preselects. Both are supported.

## 3. Decisions

- **One file per OS family holds install and the daily run:** `crons/amazing-sea-wallpaper.sh`
  (Linux + macOS; `uname` picks the OS parts) and `crons/amazing-sea-wallpaper.ps1`. The user
  reads one file before running it, and `--upgrade` replaces one file.
- **Version in the script's metadata:** a header comment
  `# amazing-sea-wallpaper version: 1.0.0` and `VERSION="1.0.0"` (`$Version` in the `.ps1`). It's
  sent in the User-Agent and shown by `--status`. Bump it on every change to the file.
- **No automatic updates.** Only `--upgrade` replaces the copy (from `main`, if the version is
  newer). Install from `main`; no tags.
- **"Is it new?" = `latest.json`'s `date`, not a hash.** The ETag gives a 304 when unchanged. The
  JPEG is fetched as `latest.jpg?d=<date>`, so the CDN can't pair today's JSON with yesterday's
  cached image. The sha256 is kept for `--status`.
- **One morning run, at most one re-run a day:** daily at 07:M local (M random per machine) and
  at login. If today's UTC image isn't out, or the fetch failed, one re-run (§4.3). No polling.
- **Linux scheduler: cron where a cron daemon runs, otherwise a systemd user timer.** The script
  never uses `sudo`. Order:
  1. A `crontab` command and a running daemon (`pgrep -x` `cron`, `crond` or `fcron`): **cron**.
     This covers Ubuntu, Debian, Mint, Zorin, elementary, Pop!_OS, and Gentoo with a cron.
  2. Else `systemctl --user` works: **systemd timer**. This covers Fedora, openSUSE, Arch, and
     Solus without cron.
  3. Else exit 4 with the distro's install line (Gentoo OpenRC:
     `emerge sys-process/cronie && rc-update add cronie default`).

  `--scheduler cron|systemd` forces one. The re-run uses the same backend.
- **Desktop inferred on every run; unknown means stop.** Install refuses and a scheduled run
  exits 2 for any desktop not in §4.4, naming it. It never guesses a setter. macOS and Windows
  still check for a logged-in GUI session.
- **Supported Linux desktops = the default editions' desktops:** GNOME (Ubuntu, Debian, Zorin,
  Fedora, openSUSE), Pantheon, Budgie, Cinnamon, KDE Plasma, COSMIC. XFCE, MATE and LXQt
  (non-default editions) wait for a later version and exit 2 until then.
- **Downloader: `curl`, else `wget`** (GNU wget or wget2). Ubuntu ships only wget and Debian only
  curl. Neither present → exit 4 with the install line.
- **Written for bash 3.2,** run as `/usr/bin/env bash`, never `sh`:
  - Not used: associative arrays, `${x,,}`, `mapfile`, `local -n`, `|&`, `&>>`,
    `printf '%(…)T'`, `$EPOCHSECONDS`, `sort -V`, `sed -i`, `readlink -f`, `flock`,
    `date -d` / `date -r` outside helpers.
  - Helpers: `epoch_to_local_hm`, `utc_epoch`, `sha256`, `filesize` (`wc -c <`).
  - Files are rewritten by temp + `mv`. The JPEG magic is read with `head -c 2 | od -An -tx1`.
  - JSON: `grep -o '"date": *"[0-9-]*"'`, the first match, then a format check. No `jq`.
- **macOS:** a LaunchAgent; the NSWorkspace setter, polling up to 10 s for the readback.
- **Windows:** Task Scheduler; `SystemParametersInfoW`.
- **Rejected:**
  - Hourly runs: several entries, up to six requests on a stale morning.
  - A single run with no retry: Europe would often get yesterday's image.
  - Rendering locally: needs Node, Playwright and a GPU.
  - Installing cron with `sudo`.
  - `systemd-run` transient timers for the re-run: lost at logout or reboot.
  - System Events on macOS: −1743 from launchd.
  - A VBScript wrapper on Windows: VBScript is being retired.
  - `feh`/`swaybg` as a catch-all: it would guess.
  - `at`: not installed on most of these and disabled on macOS.
  - Separate config/state/log folders per XDG: one folder, as decided.

## 4. Design

### 4.1 Files in the repo

```
crons/amazing-sea-wallpaper.sh    # Linux + macOS: install, run, re-run, status, upgrade, uninstall
crons/amazing-sea-wallpaper.ps1   # Windows: the same; PowerShell 5.1 and 7
crons/test/                       # fixtures, fake session trees, stubs, runner (phase 6)
```

### 4.2 Commands

| Bash | PowerShell | Does |
|---|---|---|
| `--install [--portrait] [--hour H] [--url U] [--scheduler cron\|systemd]` | `-Install [-Portrait] [-Hour H] [-Url U]` | checks tools and session (§4.4), copies itself into the folder, writes `config` (random minute; `proxy` from `https_proxy` now, since cron and launchd won't pass it), removes the other Linux backend's entries, registers the schedule (§4.5), runs once (`--now`). Safe to re-run |
| *(no flag: the schedule)* | *(none)* | the daily run (§4.3) after a random 0–300 s sleep |
| `--login` | `-Login` | the login run: no sleep, waits for the session (§4.3) |
| `--retry` | `-Retry` | the one re-run; removes its own job, never schedules another |
| `--now` | `-Now` | no sleep, ignores the state |
| `--dry-run` | `-DryRun` | fetch and check; prints what it would set or schedule; changes nothing |
| `--status` | `-Status` | version, OS/distro, desktop, scheduler and next run, last date/title/sha256, pending re-run, last 10 log lines. No network |
| `--upgrade` | `-Upgrade` | download from `main` to a temp file, syntax-check (`bash -n`; the PowerShell parser), compare `VERSION`; if newer, replace the copy and re-run `--install` with the saved config; else "up to date" |
| `--uninstall` | `-Uninstall` | remove every entry in §1's second table; asks before deleting the folder |

Exit codes: 0 done or nothing to do · 1 network, HTTP or bad image · 2 unknown desktop · 3 no GUI
session · 4 missing tool, blocked by policy, or no scheduler.

### 4.3 The run

```
today_utc = date -u +%F
0. take the lock (mkdir lock/; pid inside; stale if > 10 min or pid dead) — else exit 0
1. state.date == today_utc                         → exit 0, no network
2. detect the session and desktop (§4.4)           → exit 2 / 3
3. GET latest.json (If-None-Match: state.etag)
4. 200 and json.date > state.date                  → GET latest.jpg?d=<json.date>; check HTTP 200,
                                                     Content-Type image/jpeg, first bytes FF D8, > 50 KB;
                                                     move to wallpapers/<date>.jpg; set; verify;
                                                     write state; prune to 7; cancel a pending re-run
5. (json.date < today_utc or step 3/4 failed)
   and not --retry and state.retry_day != today    → schedule the one re-run; retry_day = today (local)
```

- A day missed entirely sets yesterday's image at step 4 and schedules the re-run at step 5.
- A failed fetch (a 404 render-failure day, captive-portal HTML, offline) leaves the desktop and
  state as they were.
- **Re-run time** = the later of *now + 3 h* and *08:00 UTC*, plus a random 0–30 min.
  - 08:00 UTC is just after the latest finish seen (07:43). Without that floor, UTC+3…+7
    (07:00 local = 00:00–04:00 UTC) would retry too early.
  - From UTC+8 east, 07:00 local is before 00:00 UTC, so today's UTC image is already out and
    there's no re-run (the site's local "yesterday", §6).
  - The margin is thin (10 runs). If the CI keeps finishing later, the floor moves in a version
    bump.
- **No session yet** (login race: autostart or a `Persistent` timer firing before the desktop
  exports its variables): scheduled and login runs wait up to 120 s, checking every 10 s, before
  exit 3.
- Proxy: `curl -x` / `wget -e https_proxy=` from `config` when set.
- Limits: `curl --fail --retry 2 --max-time 60`, `wget --tries=3 --timeout=60`.

### 4.4 Session, desktop and setters

**Linux detection** (the same function at install and in every run):
1. An interactive run with `XDG_CURRENT_DESKTOP` and `DBUS_SESSION_BUS_ADDRESS` set uses them.
2. Else find the session process: `pgrep -u "$(id -u)" -x <comm>` for each row below.
   - Read `XDG_CURRENT_DESKTOP`, `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY`, `WAYLAND_DISPLAY` and
     `XDG_RUNTIME_DIR` from its `/proc/<pid>/environ` (`tr '\0' '\n'`) and export them.
   - DBUS fallback: `unix:path=/run/user/$UID/bus` if that socket exists.
3. Match the `:`-separated tokens of `XDG_CURRENT_DESKTOP`, case-insensitive. The first token in
   the table wins (`zorin:GNOME` → `zorin` → GNOME).
4. Nothing matched:
   - The user has a graphical session (`loginctl show-session <id> -p Type --value` is `x11` or
     `wayland`; without `loginctl`, a socket of theirs in `/tmp/.X11-unix/` or
     `$XDG_RUNTIME_DIR/wayland-*`) → **exit 2** "desktop `<name>` isn't supported".
   - No graphical session → **exit 3**. At install: "run this from a terminal in your desktop
     session".

| Tokens | Session `comm` | Setter | Default on |
|---|---|---|---|
| `GNOME`, `ubuntu`, `zorin`, `pop`, `Unity` | `gnome-shell` | `gsettings set org.gnome.desktop.background picture-uri 'file://<path>'`; `picture-uri-dark` the same (when `gsettings range` lists the key); `picture-options 'zoom'`; read back with `gsettings get` | Ubuntu, Debian, Zorin, Fedora, openSUSE |
| `Pantheon` | `gala` | `picture-uri 'file://<path>'`, **`picture-uri-dark ''`** (as elementary's Settings does), `picture-options 'zoom'` | elementary OS |
| `Budgie` | `budgie-daemon` | the GNOME keys (the daemon restarts swaybg on change) | Solus |
| `X-Cinnamon` | `cinnamon` | `gsettings set org.cinnamon.desktop.background picture-uri 'file://<path>'`, `picture-options 'zoom'`; read back | Linux Mint |
| `KDE` | `plasmashell` | `plasma-apply-wallpaperimage --fill-mode preserveAspectCrop '<path>'` (every screen); exit status | openSUSE KDE, Fedora KDE |
| `COSMIC` | `cosmic-bg` | for `com.system76.CosmicBackground`, and for `.Dark` and `.Light` when their user folders exist: start from the user's `v1/all`, or copy the system one from `/usr/share/cosmic/…/v1/all`. Replace only the `source: Path("…")` line (keeps the installed version's format) and write by temp + `mv`. Write `v1/same-on-all` = `true`. Read back by grep | Pop!_OS 24.04 |
| anything else (XFCE, MATE, LXQt for now; sway, i3, Hyprland, niri…) | — | **none: exit 2** | — |

- The setter checks its tool exists (else exit 4) and that the call succeeded.
- The file name changes daily (`<date>.jpg`), so no desktop keeps a cached picture of the same
  path.
- `gsettings` needs the session DBUS from step 2. The `gsettings` and `plasma-apply-wallpaperimage`
  calls work on Wayland and X11 alike.

**macOS:**
- Session: the console user is us (`stat -f%Su /dev/console`) and `launchctl print gui/$UID`
  succeeds.
- Set: `/usr/bin/osascript -l JavaScript` with the NSWorkspace call for each `NSScreen.screens`.
  Then poll `desktopImageURLForScreen` every 1 s, up to 10 s, until it returns the new path (the
  change is asynchronous, §2.4); still old → exit 1.
- No permission prompt is involved.

**Windows** (activated Windows 10/11):
- Session: `explorer.exe` in the current session.
- Policy: `NoChangingWallPaper` = 1 or a `Policies\System\Wallpaper` value (HKCU/HKLM) → exit 4
  "wallpaper is set by policy".
- Constrained Language Mode (`$ExecutionContext.SessionState.LanguageMode`) → exit 4, since it
  blocks `Add-Type`.
- Set: `HKCU:\Control Panel\Desktop` `WallpaperStyle=10` (Fill) and `TileWallpaper=0`, then
  `SystemParametersInfoW` (`CharSet.Unicode`, so non-ASCII user names work)
  `(0x14, 0, path, 0x01|0x02)`. Read back with `0x73`.

### 4.5 Scheduling

**Linux, cron backend:**
- `crontab -l 2>/dev/null` (exit 1 = no crontab yet, fine). Drop the lines tagged
  `amazing-sea-wallpaper`, append
  `M H * * * /usr/bin/env bash '<folder>/amazing-sea-wallpaper.sh' >> '<folder>/amazing-sea-wallpaper.log' 2>&1 # amazing-sea-wallpaper`,
  and pipe to `crontab -` (fcron: `fcrontab -`).
- No `%` in the line. The script sets its own `PATH` (`/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`).
- A refused `crontab` (`cron.allow`/`cron.deny`) → the systemd backend.
- Login: `~/.config/autostart/amazing-sea-wallpaper.desktop`
  (`Exec=/usr/bin/env bash '<copy>' --login`, `X-GNOME-Autostart-Delay=30`). GNOME, Cinnamon, KDE,
  Budgie, Pantheon and COSMIC (`xdg-desktop-autostart.target`) all run XDG autostart.
- Re-run: a line `MM HH DD MO * … --retry # amazing-sea-wallpaper-retry`, removed by the
  `--retry` run. Every run drops retry lines not for today, so a missed one never fires a year
  later.

**Linux, systemd backend** (unit files kept in the folder, linked):
- `amazing-sea-wallpaper.service`: `Type=oneshot`,
  `ExecStart=/usr/bin/env bash '<copy>'`.
- `amazing-sea-wallpaper.timer`: `OnCalendar=*-*-* H:M:00`, `Persistent=true`,
  `RandomizedDelaySec=300`.
- `systemctl --user link <folder>/amazing-sea-wallpaper.{service,timer}`, then `daemon-reload`
  and `enable --now amazing-sea-wallpaper.timer`.
- Re-run:
  - `amazing-sea-wallpaper-retry.service` (`ExecStart=… --retry`) and `amazing-sea-wallpaper-retry.timer`
    with `OnCalendar=YYYY-MM-DD HH:MM:SS UTC` and `Persistent=true`, rewritten for each re-run.
  - A real file, not `systemd-run`, so it survives logout and reboot (§2.3).
  - The `--retry` run disables it.
- From cron, `systemctl --user` needs `XDG_RUNTIME_DIR=/run/user/$UID`; set it when missing.
- The login run comes from `Persistent=true`, so this backend has no autostart entry.

**macOS (launchd):**
- `~/Library/LaunchAgents/amazing-sea-wallpaper.plist`: `Label` `amazing-sea-wallpaper`,
  `ProgramArguments` `[/bin/bash, <copy>]` (an array, so the space in the path is safe),
  `StartCalendarInterval {Hour, Minute}`, `RunAtLoad true` (the login run), stdout/stderr to the
  log.
- Load with `launchctl bootout gui/$UID <plist>` (errors ignored), then
  `launchctl bootstrap gui/$UID <plist>`.
- Ventura+ shows "Background item added". If the user switches it off in Login Items, the job is
  disabled: `--status` reads `launchctl print-disabled gui/$UID`.
- Re-run: `amazing-sea-wallpaper-retry.plist` at the re-run's local hour/minute
  (`date -r EPOCH +%H` / `%M`) with `--retry`. The `--retry` run boots it out and deletes it,
  since `StartCalendarInterval` repeats daily.

**Windows (Task Scheduler, folder `\amazing-sea-wallpaper\`):**
- Task `amazing-sea-wallpaper`: `-Daily -At H:M -RandomDelay 00:05:00` plus
  `-AtLogOn -User $env:USERNAME`.
- Settings: `-StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`.
  Principal: the current user, `-LogonType Interactive`.
- Action: `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<copy>"`.
  Before build 17763, or with `-ShowWindow`: `powershell.exe -WindowStyle Hidden` (a brief
  flash).
- A Group Policy execution policy (`Get-ExecutionPolicy -List`, MachinePolicy/UserPolicy) beats
  `Bypass`: install stops with a message.
- Re-run: task `amazing-sea-wallpaper-retry`, `-Once -At <local>`, trigger `EndBoundary` +6 h,
  `-DeleteExpiredTaskAfter 00:00:01` (needs the end boundary). `-Retry` unregisters it.
- HTTP:
  - TLS 1.2 added to `[Net.ServicePointManager]::SecurityProtocol` (PS 5.1).
  - `$ProgressPreference='SilentlyContinue'`; `-UseBasicParsing`.
  - 304: PS 5.1 throws (catch, read `Response.StatusCode`); PS 7 uses `-SkipHttpErrorCheck`.

### 4.6 Spreading the load

- Random minute per machine.
- A random 0–300 s per scheduled run (systemd `RandomizedDelaySec`, Windows `RandomDelay`).
- The re-run adds 0–30 min.
- Per user per day: one `latest.json` request (mostly 304s) or two, plus one image.

## 5. What could break, and the answer

| Risk | Answer |
|---|---|
| Fresh JSON, yesterday's cached JPEG | `latest.jpg?d=<date>` |
| Render failed that day (404) | state kept, one re-run |
| Captive-portal HTML instead of a JPEG | Content-Type + `FF D8` + size |
| Daily and login runs at once | `mkdir` lock |
| Asleep at 07:M | launchd on wake, `StartWhenAvailable`, `Persistent=true`, cron + autostart |
| Powered off at 07:M | `RunAtLoad`, logon trigger, `Persistent=true`, autostart |
| Timer before the desktop is up | wait up to 120 s for the session |
| No cron (Fedora, openSUSE, Arch) | systemd user timer |
| No cron and no systemd (Gentoo OpenRC) | exit 4 with the `emerge` line |
| No curl (Ubuntu family) / no wget (Debian) | either one |
| `/bin/sh` is dash | always `/usr/bin/env bash` |
| `%` in cron; bare `PATH` | none used; own `PATH` |
| `comm` cut at 15 characters | names ≤ 15 (`gnome-shell`, `budgie-daemon`, `cosmic-bg`…) |
| Unknown desktop | exit 2, never guess |
| Desktop switched later | detected every run |
| Same-path picture cache | dated file names |
| COSMIC per-display entries; future per-mode files | `same-on-all = true`; `.Dark`/`.Light` written when present |
| COSMIC format differs by version | only the `source:` line is replaced |
| elementary dark key | `picture-uri-dark ''` as its own Settings |
| macOS async set | poll the readback up to 10 s |
| Space in the macOS path | quoted; plist argument array |
| macOS job switched off in Login Items | `--status` says so |
| `~/.local/bin` not on `PATH` (Arch; Debian before the folder exists) | full path printed; schedules use full paths |
| Windows console flash, EDR, policy, CLM, TLS, non-ASCII paths | §4.4–4.5 |
| `latest.json` format changes | first match + `YYYY-MM-DD` check; CI test on today's real file (phase 6) |
| Broken upgrade download | syntax check + version compare before replacing |
| Immutable distros (Silverblue, Aeon, Bazzite) | everything under `$HOME` and user units |

## 6. Phases

Each phase ends with its checks passing, docs touched and one commit.

1. **Core of `amazing-sea-wallpaper.sh`, on this Mac.**
   - Scope: version metadata, helpers, the folder, config/state/lock, the run (§4.3) with the
     image checks and cache-buster, `--now`, `--dry-run`, `--status`, the macOS session check
     and setter with polling. Test overrides `AMAZING_SEA_WALLPAPER_TODAY` and
     `AMAZING_SEA_WALLPAPER_NOW_EPOCH`.
   - Done when:
     - `--dry-run` against the live site prints today's date and title.
     - `--now` changes every display, and the picture survives logout/login. Record the current
       picture first and restore it (`DefaultDesktop.heic` today).
     - A second run the same UTC day makes no request.
     - `shellcheck --shell=bash` is clean; `/bin/bash -n` (3.2) passes.
2. **macOS install, re-run, upgrade, uninstall.**
   - Done when:
     - `--status` and `launchctl print gui/$UID/amazing-sea-wallpaper` show 07:M.
     - A fixture with yesterday's date → one `amazing-sea-wallpaper-retry.plist` at the right
       local time. Running again makes none; `--retry` deletes it.
     - A 404 fixture → state kept, one re-run.
     - `--upgrade` replaces the copy on a higher `VERSION` and says "up to date" on the same one.
     - `--uninstall` leaves nothing from §1 behind.
     - A sleep through 07:M → the run happens on wake.
3. **Linux detection and scheduling** (same file): §4.4 steps 1–4, both backends and their
   re-runs, autostart, tool checks with distro hints, curl and wget. Done here when the
   detection passes fake trees (`/proc` stand-ins, `pgrep`/`loginctl` stubs on `PATH`) for every
   row, plus unknown (exit 2) and none (exit 3). The crontab lines, unit files and autostart file
   must match golden files.
4. **Linux setters:** every row of §4.4. Stubs for `gsettings` and `plasma-apply-wallpaperimage`
   record their arguments. The COSMIC writer runs on a temp `HOME` seeded with the epoch-1.11.0
   `all` file and a `.Dark`/`.Light` tree, compared with golden files.
5. **`amazing-sea-wallpaper.ps1`:** §4.2 commands and the Windows parts of §4.4–4.5. Done here
   when PSScriptAnalyzer and the parser are clean under `pwsh`, and `-DryRun` passes the
   fixtures.
6. **CI** (`.github/workflows/crons.yml`, on changes to `crons/` or `scripts/snapshot.mjs`).
   - Fixtures (`python3 -m http.server` plus a 304 handler): yesterday's and today's JSON, a
     valid and a truncated JPEG, HTML as the image, 404.
   - `crons/test/run.sh` cases:
     - new → set
     - same date, new ETag → not set
     - stale → one re-run, re-run → none
     - 404 → state kept, one re-run
     - bad image → exit 1
     - lock held → exit 0
   - Jobs:
     - `ubuntu-latest`: shellcheck, `run.sh` under bash 5 once with only curl and once with only
       wget, the phase 3–4 stub tests, and a check that today's real `latest.json` still parses.
     - `macos-latest`: `run.sh` under `/bin/bash` 3.2.
     - `windows-latest`: PSScriptAnalyzer and the `.ps1` cases under 5.1 and 7.
7. **Docs:**
   - README section without "planned", listing the tested editions.
   - `changelog.md` row.
   - ARCHITECTURE.md "Page, cache, CI": who reads `latest*.jpg` and when, and the late CI as a
     known issue (measured from the Actions API).
   - TOOLS.md: `crons/test/run.sh`.

**Later testing on real machines or VMs**, by users:
1. Ubuntu 24.04 (Wayland + X11)
2. Mint Cinnamon
3. Fedora Workstation (systemd backend, SELinux)
4. Pop!_OS COSMIC
5. Windows 11
6. Debian 13 GNOME
7. openSUSE KDE
8. Zorin, elementary OS
9. Solus Budgie
10. Arch (GNOME or KDE)
11. Gentoo OpenRC + cronie

Each one: install, a scheduled run, the re-run, uninstall. Untried editions stay "untested" in
the README.

## 7. Known limits and later

- **The image follows the UTC date:** east of about UTC+8 the desktop shows the site's local
  "yesterday" all day.
- **Earlier CI** (agreed: later, separate): an odd-minute run the evening before (e.g.
  `'17 23 * * *'`, rendering tomorrow's UTC date) would make the re-run rare.
- **Resolution:** 1920×1080 only; decide on 4K with the CI change.
- **Displays and workspaces:** one picture on every display. macOS sets the current Space of each
  display.
- **Lock screen and login greeter:** out of scope.
- **Later versions:** XFCE, MATE and LXQt setters (Mint and Zorin Lite editions, Debian
  choices).
- **Not supported:** tiling window managers without a desktop, Deepin, NixOS.
