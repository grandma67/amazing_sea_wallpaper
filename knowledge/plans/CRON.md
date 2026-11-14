# Daily desktop wallpaper: one script per OS family (plan)

Goal: a script that runs every morning, fetches the wallpaper the Pages site already renders
(`latest.jpg`) and sets it as the desktop background. Each machine runs at its own random minute,
so users don't all hit the site at once.
- **Linux and macOS** share one bash script. Linux covers Ubuntu, Debian, Mint, Zorin,
  elementary OS, Pop!_OS, Fedora, openSUSE, Arch, Solus and Gentoo.
- **Windows** has a PowerShell one.
- Both live in `crons/`.

Status: plan (2026-11-14). Nothing built. The README section is marked "planned" until phase 7.
Testing: on this Mac (macOS 27.0.1, bash 3.2.57) during the build; Linux and Windows later.
Until a distro or desktop is tried, it ships labelled untested.

## 1. Facts this plan stands on (checked 2026-11-14)

### 1.1 The site

| Fact | How checked |
|---|---|
| `https://grandma67.github.io/amazing_sea_wallpaper/latest.jpg`: 1920×1080, ~290 KB. `latest-portrait.jpg`: 1290×2796. `latest.json` (12.7 KB) has exactly one `"date": "YYYY-MM-DD"` (the UTC day rendered) and one `"title"` (UTF-8, e.g. `·`), pretty-printed one key per line (`JSON.stringify(…, null, 2)` in `snapshot.mjs`) | `curl` + `grep -o` of the live file; `scripts/snapshot.mjs:223` |
| `cache-control: max-age=600`, `etag`, `last-modified`. A GET with `If-None-Match: <etag>` returns **304** | `curl` (304 seen) |
| The JSON and the JPEG are cached separately by the CDN. In the 10 minutes after a deploy, a fresh JSON can come with yesterday's cached JPEG | `max-age=600` per URL; follows from the headers |
| Only today's image is published (`dist/` is rebuilt each deploy). If the render step fails (`continue-on-error`), there is **no** `latest.jpg` that day (404) | `.github/workflows/pages.yml` |
| The CI is scheduled at 00:05 UTC but starts late. The last 10 scheduled runs finished between **01:10 and 07:43 UTC** (11-05…11-14: 02:09, 01:10, 02:18, 01:18, 02:00, 02:24, 07:31, 07:43, 06:51, 06:26) | GitHub API `actions/workflows/pages.yml/runs?event=schedule` |
| A push to `main` redeploys and re-renders the same day: the bytes and ETag change while `date` stays the same | `pages.yml` |
| The page's "today" is the **local** date; `latest.jpg` follows the **UTC** date | `src/main.ts:288` |
| `raw.githubusercontent.com` (for `--upgrade`) serves `cache-control: max-age=300` | `curl -I` |

### 1.2 Linux distributions

| Distro (current) | Default desktop(s) | `XDG_CURRENT_DESKTOP` | Cron by default | Also | Sources |
|---|---|---|---|---|---|
| Ubuntu 24.04 / 26.04 | GNOME | `ubuntu:GNOME` | yes (`cron`) | `curl` may be missing, `wget` present | [golinuxcloud](https://www.golinuxcloud.com/install-curl-ubuntu/) |
| Debian 13 | GNOME (tasksel default); KDE, XFCE, Cinnamon, MATE, LXQt offered | `GNOME` … | yes, with "standard system utilities" (on by default) | `/bin/sh` is dash; `curl` may be missing | [debian-user](https://lists.debian.org/debian-user/2025/09/msg00385.html) |
| Linux Mint 22 | Cinnamon; MATE, XFCE editions | `X-Cinnamon`, `MATE`, `XFCE` | yes (Ubuntu base) | — | — |
| Zorin OS 17/18 | Zorin desktop = GNOME; Lite = XFCE | `zorin:GNOME`, `XFCE` | yes (Ubuntu base) | — | — |
| elementary OS 8 | Pantheon (Gala), uses the GNOME background key | `Pantheon` | yes (Ubuntu base) | greeter copy of the wallpaper is separate | [elementaryart](https://lists.launchpad.net/elementaryart/msg00122.html), [wallpaper crate](https://docs.rs/crate/wallpaper/latest/source/src/linux/gnome.rs) |
| Pop!_OS 24.04 | **COSMIC** (own config, not gsettings); 22.04: GNOME | `COSMIC`; `pop:GNOME` | yes (Ubuntu base) | — | [cosmic-bg](https://github.com/pop-os/cosmic-bg), [CachyOS forum](https://discuss.cachyos.org/t/unable-to-automatically-change-desktop-using-variety-and-cosmic/25994) |
| Fedora 43/44 | GNOME (Workstation); KDE edition; XFCE, Cinnamon, MATE, LXQt, Budgie spins | `GNOME`, `KDE` … | **no** (cronie dropped from Workstation in F34) | `wget` is wget2; SELinux | [Fedora WS #183](https://pagure.io/fedora-workstation/issue/183), [Fedora KDE #485](https://pagure.io/fedora-kde/SIG/issue/485) |
| openSUSE Tumbleweed / Leap 16 | KDE Plasma or GNOME (installer choice) | `KDE`, `GNOME` | **no** (systemd timers by policy) | — | [opensuse-factory](https://lists.opensuse.org/archives/list/factory@lists.opensuse.org/thread/LK6DLRW7KNYHTQWDMLC2FTVOATZP5VO3/) |
| Arch | none (archinstall profiles) | any | **no** (cronie optional, not enabled after install) | `curl` always (pacman needs it) | [Arch wiki Cron](https://wiki.archLINUX.org/title/Cron), [FS#38255](https://bugs.archlinux.org/task/38255) |
| Solus 4.x | Budgie (10.10, Wayland); GNOME, KDE, XFCE editions | `Budgie:GNOME` | unverified | systemd | [Budgie 10.10 on Solus](https://aquilapl.github.io/Budgie-test-10.10/) |
| Gentoo | none | any | user's choice (cronie, fcron, dcron) | **OpenRC** default (no systemd user manager); `wget` in @system, `curl` maybe not; `loginctl` only with elogind | — |

Desktop-specific facts:
- **Budgie 10.10** (Wayland, labwc) draws the background with `swaybg`. `budgie-daemon` reads
  the GNOME background settings (GnomeBG) and maps the placement style to swaybg modes since
  10.10.1, so `org.gnome.desktop.background` still drives it.
  ([10.10 release](https://buddiesofbudgie.org/blog/budgie-10-10-released), [10.10.1](https://buddiesofbudgie.org/blog/budgie-10-10-1-released), [ubuntuhandbook](https://ubuntuhandbook.org/index.php/2026/01/budgie-desktop-switched-to-wayland/))
- **COSMIC:** config `com.system76.CosmicBackground` v1. Under `~/.config/cosmic/com.system76.CosmicBackground/v1/`,
  the key file `all` (the default entry) holds a RON struct
  `(output: "all", source: Path("…"), filter_by_theme: false, rotation_frequency: 300,
  filter_method: Lanczos, scaling_mode: Zoom, sampling_method: Alphanumeric)`. Per-display
  entries `output.<name>` are listed in `backgrounds`, and `same-on-all` is a bool. Editing `all`
  is the known workaround.
  ([cosmic-bg config/src/lib.rs](https://raw.githubusercontent.com/pop-os/cosmic-bg/master/config/src/lib.rs))
- **Cron runs jobs** with a bare environment (`PATH=/usr/bin:/bin`, no `DISPLAY`, `DBUS_SESSION_BUS_ADDRESS`
  or `XDG_CURRENT_DESKTOP`), through `/bin/sh`, and `%` in a crontab line means newline. The
  session's own processes carry the variables in `/proc/<pid>/environ`.
  ([Manjaro howto](https://forum.manjaro.org/t/howto-check-a-user-session-type-wayland-x11-you-are-using-on-gnome-kde/87165), [KDE discuss](https://discuss.kde.org/t/check-if-kde-plasma-is-currently-running/10355))
- **Session variables:** `XDG_SESSION_DESKTOP` is one name, and GDM doesn't always set desktop
  names, so match on the `:`-separated tokens of `XDG_CURRENT_DESKTOP`.
  ([GNOME bug 727546](https://bugzilla.gnome.org/show_bug.cgi?id=727546))
- **Process names:** `pgrep -x` matches the kernel's `comm`, which is cut at **15 characters**
  (`cinnamon-session` is 16). Use the short names in §3.4.
- **systemd user timers** with `Persistent=true` catch up a missed run at the next start of the
  user manager (login). User timers run only while the user manager runs.
  ([arch-general](https://mailman.archlinux.org/pipermail/arch-general/2014-May/036169.html))

### 1.3 macOS and Windows

- **macOS 27 on this Mac:** bash 3.2.57, `curl`, `shasum`, BSD `date` (`date -r EPOCH`,
  `date -j -f`), BSD `sed` (no `-i` without a suffix argument), `stat -f`.
  `osascript -l JavaScript` with `ObjC.import("AppKit")` reached `NSWorkspace`/`NSScreen`, and
  `desktopImageURLForScreen` read OK. This route needs no Apple Events permission. Checked by a
  run here.
- **macOS:** "System Events" from a launchd job fails with −1743 ("Not authorized to send Apple
  events"), because the consent prompt can't show there.
  ([Apple forum](https://discussions-jp-prz.apple.com/thread/255432048), [techearl](https://techearl.com/set-mac-wallpaper-command-line))
- **Windows:** `powershell -WindowStyle Hidden` still flashes a console. `conhost.exe --headless`
  doesn't (Windows 10 1809+ / 11), but it's undocumented and flagged by some EDR rules.
  ([PowerShell #3028](https://www.github.com/PowerShell/PowerShell/issues/3028), [Sigma rule](https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_conhost_headless_powershell))

### 1.4 To verify while building (not established yet)

- macOS 27: `setDesktopImageURL` sticks across logout and changes every display (a comment
  reports Sonoma trouble: [DesktopImage sample](https://developer.apple.com/library/archive/samplecode/DesktopImage/Introduction/Intro.html)).
- COSMIC: cosmic-bg picks up an atomic replace (temp + `mv`) of `all` live, without a restart.
- Budgie 10.10: a `gsettings` change reaches swaybg live.
- XFCE: `last-image` properties exist on a fresh profile (else they're created per monitor).
- KDE: `plasma-apply-wallpaperimage` on Plasma 5.27 (Debian 12) and 6.x.
- Windows: SPI works on an unactivated Windows (Settings blocks personalization there).
- Solus: whether cron is installed. The design doesn't depend on it.

## 2. Decisions

- **One file per OS family holds install and the daily run:** `crons/sea-wallpaper.sh`
  (Linux + macOS; `uname` picks the OS parts) and `crons/sea-wallpaper.ps1` (Windows). With a
  single file, the user reads one thing before running it, and `--upgrade` replaces one thing.
- **Version in the script's metadata:** a header comment `# sea-wallpaper version: 1.0.0` and
  `VERSION="1.0.0"` (`$Version` in the `.ps1`). It's sent in the User-Agent and shown by
  `--status`. Bump it on every change to the file.
- **No automatic updates.** Only `--upgrade` changes the installed copy: it fetches from `main`
  and replaces the copy if the version is newer. Install from `main`; no release tags.
- **"Is it new?" = `latest.json`'s `date`, not a hash.** A redeploy changes the bytes of the same
  day. The ETag makes an unchanged check a 304 with no body. The JPEG is fetched as
  `latest.jpg?d=<date>`, a cache-buster so the CDN can't hand back yesterday's cached image
  beside today's JSON. The sha256 is kept for `--status`.
- **One morning run, at most one re-run a day.** Daily at 07:M local (M random per machine,
  picked at install) and at login. If today's UTC image isn't out yet, or the fetch failed, one
  one-off re-run (§3.3). No polling.
- **Linux scheduler: cron where a cron daemon runs, otherwise a systemd user timer.** Cron as
  asked, but Arch, Fedora and openSUSE ship no cron, and installing one needs `sudo`, which the
  script never runs. Order:
  1. A `crontab` command **and** a running daemon (`pgrep -x 'cron|crond|fcron'`): cron. This
     covers Ubuntu, Debian, Mint, Zorin, elementary, Pop!_OS, and Gentoo with cronie, dcron or
     fcron.
  2. Else `systemctl --user` answers: a systemd user timer. This covers Fedora, openSUSE, Arch,
     and Solus if it has no cron.
  3. Else exit 4 with the distro's own install hint (Gentoo OpenRC without cron:
     `emerge sys-process/cronie && rc-update add cronie default`).

  `--scheduler cron|systemd` forces one. The re-run always uses the same backend as the daily
  run.
- **Desktop inferred on every run; unknown means stop.** On Linux the script detects the running
  desktop each time, so a desktop switched later is picked up. A desktop not in the table (§3.4):
  install refuses, and a scheduled run exits 2 with its name in the log. It never guesses a
  setter. macOS and Windows have one desktop each, but the script still checks there is a
  logged-in GUI session.
- **No packages installed; everything checked first.**
  - Linux needs bash, coreutils, `sed`, `grep`, `pgrep` (procps), `curl` **or** `wget`/wget2, and
    a scheduler.
  - `--install` checks each one. A missing tool → exit 4 with the install line for the distro
    (`/etc/os-release` `ID`/`ID_LIKE`: apt, dnf, zypper, pacman, eopkg, emerge).
  - JSON is read with `grep -o '"date": *"[0-9-]*"'` (first match, then a format check). No `jq`.
- **Written for bash 3.2** (macOS's floor; every Linux here has bash 5), run as
  `/usr/bin/env bash`, never `sh`:
  - Not used: associative arrays, `${x,,}`/`${x^^}`, `mapfile`/`readarray`, `local -n`, `|&`,
    `&>>`, `coproc`, `printf '%(…)T'`, `$EPOCHSECONDS`, `sort -V`, `sed -i`, `stat`, `readlink -f`,
    `flock`, `date -d`.
  - OS differences go through small helpers: `epoch_to_hm` (`date -d @E` / `date -r E`),
    `utc_epoch "YYYY-MM-DD HH:MM"` (GNU `-d` / BSD `-j -f`), `sha256` (`sha256sum` /
    `shasum -a 256`), `filesize` (`wc -c <`).
  - Files are rewritten by temp file + `mv`. The JPEG magic is read with `head -c 2 | od -An -tx1`.
- **Scheduler per OS:**
  - Linux: as above, plus an XDG autostart entry for the login run (cron backend only; the
    systemd timer's `Persistent=true` covers missed runs).
  - macOS: a LaunchAgent (`StartCalendarInterval` + `RunAtLoad`). launchd runs a missed slot on
    wake; cron on macOS is deprecated and skips sleep.
  - Windows: one Task Scheduler task with daily and logon triggers.
- **Rejected:**
  - Hourly runs until it's set: several schedule entries per machine, and up to six requests on
    a stale morning.
  - A single run with no retry: Europe would often get yesterday's image.
  - Rendering locally with headless Chromium: needs Node, Playwright and a GPU.
  - Installing cron with `sudo`: never needed, and it's the user's system.
  - System Events on macOS: −1743 from launchd.
  - A VBScript wrapper to hide the Windows console: VBScript is being retired.
  - `feh`/`swaybg` as a catch-all fallback: it would guess.
  - `at` for the re-run: not installed on most of these distros and disabled on macOS.

## 3. Design

### 3.1 Files

```
crons/sea-wallpaper.sh    # Linux + macOS: install, daily run, re-run, status, upgrade, uninstall
crons/sea-wallpaper.ps1   # Windows: the same; PowerShell 5.1 and 7
crons/test/               # fixtures, fake session trees, test runner (phase 6)
```

| | Folder | Command |
|---|---|---|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/amazing-sea-wallpaper/` | symlink `~/.local/bin/sea-wallpaper` (made with `mkdir -p`); install prints the full path too, since `~/.local/bin` isn't on `PATH` on every distro (Arch, or Debian before the folder exists at login) |
| macOS | `~/Library/Application Support/AmazingSeaWallpaper/` (a space in the path: every use quoted) | the same symlink |
| Windows | `%LOCALAPPDATA%\AmazingSeaWallpaper\` | full path printed by install |

The folder holds:
- `sea-wallpaper.sh|ps1`: the copy that runs.
- `config`: `minute`, `hour`, `portrait`, `url`, `scheduler`, and `proxy` (from `https_proxy`
  at install, since cron and launchd don't pass it).
- `state`: `date`, `etag`, `sha256`, `title`, `set_at`, `retry_day`.
- `wallpapers/<date>.jpg`: the last 7 kept.
- `log`: trimmed to 500 lines.
- `lock/`: `mkdir` is atomic on every OS, unlike `flock`. It holds the pid; a lock older than
  10 min or with a dead pid is taken over.

### 3.2 Commands

| Bash | PowerShell | Does |
|---|---|---|
| `--install [--portrait] [--hour H] [--url U] [--scheduler cron\|systemd]` | `-Install [-Portrait] [-Hour H] [-Url U]` | checks tools and session (§3.4), copies itself, writes `config` (random minute), removes any entries of the other Linux backend, registers the schedule, runs once in the foreground (`--now`). Safe to re-run |
| *(no flag: the schedule)* | *(none)* | the daily run (§3.3), after a random 0–300 s sleep |
| `--retry` | `-Retry` | the one-off re-run; removes its own job and never schedules another |
| `--now` | `-Now` | no sleep, ignores the state |
| `--dry-run` | `-DryRun` | fetch, check, print what it would set or schedule; changes nothing |
| `--status` | `-Status` | version, OS/distro, desktop detected, scheduler and next run, last date/title/sha256, pending re-run, last 10 log lines. No network |
| `--upgrade` | `-Upgrade` | download from `main` to a temp file, syntax-check it (`bash -n`; the PowerShell parser), compare `VERSION`. If newer: replace the copy and re-run `--install` with the saved config. Otherwise "up to date" |
| `--uninstall` | `-Uninstall` | remove the schedule (both Linux backends), autostart, re-run job and link; asks before deleting the folder |

Exit codes: 0 done or nothing to do · 1 network, HTTP or bad image · 2 unknown desktop · 3 no
GUI session · 4 missing tool, blocked by policy, or no scheduler.

### 3.3 The daily run

```
today_utc = date -u +%F
0. take the lock (else exit 0: another run is on it)
1. state.date == today_utc                         → exit 0, no network
2. detect the session and desktop (§3.4)           → exit 2 / 3
3. GET latest.json (If-None-Match: state.etag)
4. 200 and json.date > state.date                  → GET latest.jpg?d=<json.date>; check HTTP 200,
                                                     Content-Type image/jpeg, first bytes FF D8,
                                                     > 50 KB; move to wallpapers/<date>.jpg; set;
                                                     verify; write state; prune to 7; cancel a pending re-run
5. (json.date < today_utc or step 3/4 failed)
   and not --retry and state.retry_day != today    → schedule the one re-run; retry_day = today (local)
```

- A day missed entirely sets yesterday's image at step 4 **and** schedules the re-run at step 5.
- A failed fetch (404 on a render-failure day, captive-portal HTML, no network) leaves the
  desktop and state as they were.
- **Re-run time** = the later of *now + 3 h* and *08:00 UTC*, plus a random 0–30 min.
  - 08:00 UTC is just after the latest finish seen (07:43). Without the floor, UTC+3…+7
    (07:00 local = 00:00–04:00 UTC) would retry before the image lands.
  - Who re-runs: everyone west of about UTC+7 whose morning finds yesterday's image (Europe,
    Africa, the Middle East, South Asia; the Americas rarely, since 07:00 there is 10:00–15:00
    UTC).
  - From UTC+8 east, 07:00 local is before 00:00 UTC and today's UTC image is out, so no re-run;
    it's the site's local "yesterday" (§5).
  - The margin is thin (10 runs). If the CI keeps finishing later, the floor moves in a version
    bump.
- **No session yet** (exit 3 in a scheduled run): wait up to 120 s, checking every 10 s, before
  giving up. This covers the login race, where a systemd user timer or autostart fires before
  the desktop has exported its variables. Without a session it logs and exits; the next login
  runs it.
- Proxy: `curl -x`/`wget -e https_proxy=` from `config` when set.

### 3.4 Session, desktop and setters

**Linux: detecting the desktop** (the same function at install and in every run):
1. If the run's own `XDG_CURRENT_DESKTOP` and `DBUS_SESSION_BUS_ADDRESS` are set (an interactive
   install), use them.
2. Else find the user's session process: `pgrep -u "$(id -u)" -x <name>` for each name in the
   table (short `comm` names, ≤ 15 characters). Read `XDG_CURRENT_DESKTOP`,
   `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY`, `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR` from its
   `/proc/<pid>/environ` (`tr '\0' '\n'`) and export them. Fallback for DBUS:
   `unix:path=/run/user/$UID/bus` when that socket exists.
3. Match the `:`-separated tokens of `XDG_CURRENT_DESKTOP`, case-insensitive, against the table.
   The first token that matches wins (`zorin:GNOME` → GNOME).
4. Nothing matched:
   - The user has a graphical session (`loginctl show-session ID -p Type --value` is
     `x11`/`wayland`; without `loginctl`, as on OpenRC without elogind, a socket of theirs in
     `/tmp/.X11-unix/` or `$XDG_RUNTIME_DIR/wayland-*`): **exit 2**, "desktop `<name>` isn't
     supported". The name is the token, `XDG_SESSION_DESKTOP` or `Desktop=`.
   - No graphical session: **exit 3**. At install the message is "run this from a terminal in
     your desktop session" (e.g. not over SSH).

| Desktop (tokens) | Session process (`comm`) | Set with | Distros |
|---|---|---|---|
| GNOME, ubuntu, zorin, pop, Unity | `gnome-shell` | `gsettings set org.gnome.desktop.background picture-uri 'file://…'`; also `picture-uri-dark` (GNOME 42+; only when `gsettings writable` says the key exists); `picture-options 'zoom'`; read back with `gsettings get` | Ubuntu, Debian, Zorin, Pop 22.04, Fedora WS, openSUSE, Arch, Solus GNOME |
| Budgie | `budgie-daemon`, `budgie-panel` | the GNOME keys above (10.10: budgie-daemon feeds swaybg) | Solus, Fedora spin, Ubuntu Budgie |
| Pantheon | `gala` | the GNOME keys above | elementary OS |
| KDE | `plasmashell` | `plasma-apply-wallpaperimage <path>` (Plasma 5.27, 6.x) | openSUSE, Fedora KDE, Debian, Arch, Solus, Gentoo |
| X-Cinnamon | `cinnamon` | `gsettings set org.cinnamon.desktop.background picture-uri 'file://…'`, `picture-options 'zoom'` | Mint, Debian, Fedora spin |
| MATE | `mate-session` | `gsettings set org.mate.background picture-filename <path>` (a path, not a URI), `picture-options 'zoom'` | Mint MATE, Debian, Fedora spin |
| XFCE | `xfdesktop` | `xfconf-query -c xfce4-desktop -l`: set every `…/last-image` to the path and its `…/image-style` to 5 (zoom). None listed (fresh profile): create `/backdrop/screen0/monitor<name>/workspace0/last-image` for each monitor from `xfconf-query -c displays -l` or `xrandr --listmonitors` | Mint XFCE, Zorin Lite, Debian, Fedora spin |
| LXQt | `lxqt-session` | `pcmanfm-qt --set-wallpaper=<path> --wallpaper-mode=zoom` (talks to the running desktop) | Debian, Fedora spin |
| COSMIC | `cosmic-bg`, `cosmic-session` | write `~/.config/cosmic/com.system76.CosmicBackground/v1/all` (RON in §1.2, `source: Path("<path>")`, `scaling_mode: Zoom`, `rotation_frequency` kept) by temp + `mv`, and `same-on-all` = `true` | Pop!_OS 24.04 |
| anything else (sway, i3, Hyprland, niri, Deepin, Enlightenment…) | — | **none: exit 2** | — |

Each setter checks its tool exists (else exit 4) and that the call succeeded. GNOME-family,
Cinnamon and MATE read the value back. The file name changes daily (`<date>.jpg`), so no desktop
serves a cached picture of the same path.

**macOS:**
- Session check: the console user is us (`stat -f%Su /dev/console`, the only `stat` use, on
  macOS) and `launchctl print gui/$UID` succeeds.
- Set: `/usr/bin/osascript -l JavaScript` with `ObjC.import("AppKit")`. For each
  `NSScreen.screens` call `NSWorkspace.sharedWorkspace.setDesktopImageURLForScreenOptionsError`
  with `NSURL.fileURLWithPath(path)` and `{}`, then read it back with `desktopImageURLForScreen`.
  No Automation permission is needed.
- Fallback only if phase 1 shows it doesn't stick: System Events, with the consent prompt raised
  by the foreground run in `--install`.

**Windows:**
- Session check: `explorer.exe` running in the current session.
- Policy check: `HKCU`/`HKLM` `…\Policies\ActiveDesktop\NoChangingWallPaper` = 1 or a
  `…\Policies\System\Wallpaper` value → exit 4 "wallpaper is set by policy".
- Set: `HKCU:\Control Panel\Desktop` `WallpaperStyle=10` (Fill), `TileWallpaper=0`, then
  `SystemParametersInfoW` (`CharSet.Unicode`, for non-ASCII user names in the path)
  `(0x14, 0, path, 0x01|0x02)` via `Add-Type`. Read it back with `0x73`.
- Constrained Language Mode (AppLocker/WDAC) blocks `Add-Type`: check
  `$ExecutionContext.SessionState.LanguageMode` first → exit 4.

### 3.5 Scheduling per OS

**Linux, cron backend:**
- Install: `crontab -l 2>/dev/null` (exit 1 "no crontab" is fine), drop lines tagged
  `# amazing-sea-wallpaper`, append
  `M H * * * /usr/bin/env bash '<copy>' --cron >> '<log>' 2>&1 # amazing-sea-wallpaper`,
  and pipe to `crontab -` (fcron: `fcrontab -`).
- The line must not contain `%` (cron reads it as a newline).
- The script sets its own `PATH` (`/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`) because cron's
  is bare.
- If `crontab` is refused (`cron.allow`/`cron.deny`), fall back to systemd.
- Login: `~/.config/autostart/amazing-sea-wallpaper.desktop` (`Exec=/usr/bin/env bash '<copy>' --login`,
  `X-GNOME-Autostart-Delay=30`). All desktops in §3.4 run XDG autostart; COSMIC is to be
  verified (§1.4).
- Re-run: a one-off line `MM HH DD MO * … --retry # amazing-sea-wallpaper-retry`, removed by the
  `--retry` run. Every daily run also removes any retry line not for today, so a missed one can't
  fire a year later. Works without systemd (Gentoo OpenRC).

**Linux, systemd backend:**
- `~/.config/systemd/user/amazing-sea-wallpaper.service` (`Type=oneshot`,
  `ExecStart=/usr/bin/env bash '<copy>' --cron`) and `.timer`
  (`OnCalendar=*-*-* H:M:00`, `Persistent=true`, `RandomizedDelaySec=300`).
- `systemctl --user daemon-reload && systemctl --user enable --now amazing-sea-wallpaper.timer`.
- Re-run: `systemd-run --user --unit=amazing-sea-wallpaper-retry --on-calendar='YYYY-MM-DD HH:MM:SS UTC' --timer-property=Persistent=true /usr/bin/env bash '<copy>' --retry`.
  The unit already existing means one is pending. Cancel with
  `systemctl --user stop amazing-sea-wallpaper-retry.timer`.
- From cron or a timer, `systemctl --user` needs `XDG_RUNTIME_DIR=/run/user/$UID`; set it when
  it's missing.

**macOS (launchd):**
- `~/Library/LaunchAgents/io.github.amazing-sea-wallpaper.plist`: `ProgramArguments`
  `[/bin/bash, <copy>, --cron]` (an array, so the space in the path is safe),
  `StartCalendarInterval {Hour, Minute}`, `RunAtLoad`, stdout/stderr to the log.
- Load with `launchctl bootout gui/$UID <plist>` (errors ignored), then `launchctl bootstrap gui/$UID <plist>`.
- Ventura+ shows a "Background item added" notification. If the user turns it off in
  *Login Items*, launchd disables the job: `--status` reads `launchctl print-disabled gui/$UID`
  and says so.
- Re-run: `io.github.amazing-sea-wallpaper.retry.plist` at the local hour/minute of the re-run
  time. The `--retry` run boots it out and deletes it (else it would repeat daily).

**Windows (Task Scheduler):**
- Task `AmazingSeaWallpaper`: `-Daily -At H:M` with `-RandomDelay 00:05:00`, plus
  `-AtLogOn -User $env:USERNAME`.
- Settings: `-StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`.
  Principal: the current user, `-LogonType Interactive`.
- Action: `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<copy>"`.
  On builds before 17763, or with `-ShowWindow`: `powershell.exe -WindowStyle Hidden` (a brief
  flash).
- A machine or user execution policy set by Group Policy overrides `-ExecutionPolicy Bypass`:
  install reads `Get-ExecutionPolicy -List` and stops with a message.
- Re-run: `AmazingSeaWallpaperRetry` with `-Once -At <local>`, trigger `EndBoundary` = +6 h,
  `-DeleteExpiredTaskAfter 00:00:01` (deletion needs the end boundary). `-Retry` unregisters it.
- HTTP:
  - `[Net.ServicePointManager]::SecurityProtocol` += Tls12 (older Windows 10 .NET defaults).
  - `$ProgressPreference='SilentlyContinue'` (the progress bar slows downloads a lot).
  - `-UseBasicParsing`.
  - 304: PS 5.1 throws (catch it, read `Response.StatusCode`); PS 7 uses `-SkipHttpErrorCheck`.

### 3.6 Spreading the load

- The minute is random per machine (0–59). Each scheduled run sleeps a random 0–300 s
  (systemd: `RandomizedDelaySec`; Windows: `RandomDelay`), and the re-run adds 0–30 min.
- Per user per day: one `latest.json` request (often a 304) or two on a stale morning, plus one
  image.
- User-Agent `amazing-sea-wallpaper/<version>`, with no user data.
- `curl --fail --retry 2 --max-time 60`; `wget --tries=3 --timeout=60`.

## 4. What could break, and the answer

| Risk | Answer |
|---|---|
| Fresh JSON, yesterday's cached JPEG | `latest.jpg?d=<date>` (§2) |
| Render failed that day: 404 | Failed fetch → state kept, one re-run (§3.3 step 5) |
| Captive portal / proxy HTML instead of JPEG | Content-Type + `FF D8` + size checks |
| Daily run and login run at once | `mkdir` lock |
| Laptop asleep at 07:M | launchd / `StartWhenAvailable` / `Persistent=true` / cron + autostart |
| Timer fires before the desktop is up | wait up to 120 s for the session (§3.3) |
| No cron (Arch, Fedora, openSUSE) | systemd user timer (§2) |
| No cron and no systemd (Gentoo OpenRC) | exit 4 with the `emerge` line |
| `curl` missing (Debian, Ubuntu, Gentoo) | `wget`/wget2 fallback |
| `/bin/sh` is dash (Debian family) | always `/usr/bin/env bash`, never `sh` |
| `%` in a crontab line; bare cron `PATH` | no `%`; own `PATH` |
| `comm` cut at 15 characters | short process names (§3.4) |
| Unknown desktop or tiling WM | exit 2, never guess |
| User switches desktop later | detected on every run |
| Same picture path cached by the desktop | dated file names |
| Per-display COSMIC entries override `all` | `same-on-all = true` |
| `~/.local/bin` not on `PATH` | full path printed; the schedule uses full paths |
| Space in the macOS path | quoted everywhere; plist argument array |
| macOS job disabled in Login Items | `--status` reports it |
| Windows: console flash, EDR, policies, CLM, TLS, non-ASCII paths | §3.4–3.5 |
| `latest.json` format changes (minified, extra `"date"` keys) | first match + `YYYY-MM-DD` check; a CI test (phase 6) fails if `snapshot.mjs` output stops matching |
| Upgrade fetches a broken file | syntax check + version compare before replacing |
| Immutable distros (Silverblue, Aeon, Bazzite) | everything is under `$HOME` and user units, so it works unchanged |

## 5. Phases

Each phase ends with its checks passing, docs touched and one commit.

1. **Core of `sea-wallpaper.sh`, on this Mac.**
   - Scope: version metadata, the helpers (§2), config/state/lock, the daily run (§3.3) with the
     image checks and cache-buster, `--now`, `--dry-run`, `--status`, the macOS session check
     and NSWorkspace setter. Test overrides `SEA_WALLPAPER_TODAY` and `SEA_WALLPAPER_NOW_EPOCH`.
   - Done when:
     - `--dry-run` against the live site prints today's date and title.
     - `--now` changes every display, and the picture survives logout/login. Record the current
       picture first (`/System/Library/CoreServices/DefaultDesktop.heic` today) and restore it.
     - A second run the same UTC day makes no request.
     - `shellcheck --shell=bash` is clean.
     - `bash -n` passes under `/bin/bash` 3.2.
2. **macOS install, re-run, upgrade, uninstall.**
   - Scope: LaunchAgent, retry plist, `--retry`, `--upgrade`, `--uninstall`, the link.
   - Done when:
     - `--install` → `--status` and `launchctl print gui/$UID/io.github.amazing-sea-wallpaper`
       show 07:M.
     - A fixture server with yesterday's date → exactly one retry plist at the right local time.
       Running again makes none; `--retry` deletes it.
     - The 404 fixture leaves state unchanged and schedules one re-run.
     - `--upgrade` against a fixture with a higher `VERSION` replaces the copy; with the same
       version it says "up to date".
     - `--uninstall` leaves nothing behind.
     - After a sleep through 07:M, launchd runs it on wake.
3. **Linux detection and scheduling** (same file).
   - Scope: §3.4 steps 1–4, the cron and systemd backends with their re-runs, autostart, tool
     checks with distro hints, `curl`/`wget` paths.
   - Done here when the detection function passes fake trees (directories standing in for
     `/proc/<pid>/environ`, `pgrep` and `loginctl` stubs on `PATH`) for every row of §3.4, the
     unknown case (exit 2) and no session (exit 3). The generated crontab line, units and
     autostart file must match golden files. `shellcheck` stays clean.
4. **Linux setters:** every row of §3.4, with stubbed `gsettings`, `plasma-apply-wallpaperimage`,
   `xfconf-query` and `pcmanfm-qt` recording their arguments, and the COSMIC file written to a
   temp `HOME` and compared with a golden RON file.
5. **`sea-wallpaper.ps1`:** §3.2 commands, §3.4–3.5 Windows. Done here when PSScriptAnalyzer
   (`pwsh` on this Mac) and the parser are clean, and `-DryRun` passes the fetch/state fixtures
   under `pwsh`.
6. **CI** (`.github/workflows/crons.yml`, on changes to `crons/` or `scripts/snapshot.mjs`).
   - Fixtures in `crons/test/`, served by `python3 -m http.server` plus a tiny handler for 304:
     - `latest.json` with yesterday's and today's dates
     - a valid and a truncated JPEG
     - HTML served as the image
     - 404
   - `crons/test/run.sh` cases:
     - new → set
     - same date, new ETag → not set
     - stale → one re-run, re-run → none
     - 404 → state kept, one re-run
     - bad image → exit 1
     - lock held → exit 0
   - Jobs:
     - `ubuntu-latest`: shellcheck, `run.sh` under bash 5 with curl and again with only wget,
       the phase 3–4 stub tests, and a check that the format of today's real `latest.json`
       still matches the reader.
     - `macos-latest`: `run.sh` under `/bin/bash` 3.2.
     - `windows-latest`: PSScriptAnalyzer and the `.ps1` cases under 5.1 and 7.
7. **Docs:**
   - README section without "planned", listing the tested distros and desktops.
   - `changelog.md` row.
   - ARCHITECTURE.md "Page, cache, CI": who reads `latest*.jpg` and when, and the late CI finish
     as a known issue (measured from the Actions API).
   - TOOLS.md: `crons/test/run.sh`.

**Later testing (when machines or VMs are available)**, in order of users:
1. Ubuntu 24.04 GNOME (Wayland + X11)
2. Mint Cinnamon
3. Fedora Workstation (systemd backend, SELinux)
4. Pop!_OS 24.04 COSMIC
5. Windows 11
6. Debian 13 GNOME without curl
7. openSUSE KDE
8. Zorin, elementary OS
9. Arch KDE
10. Solus Budgie
11. Gentoo OpenRC + cronie

Each one: install, a scheduled run, the re-run, uninstall. The §1.4 checks are settled on the
way. Rows not tried stay "untested" in the README.

## 6. Known limits and later

- **The image follows the UTC date:** east of about UTC+8 the desktop shows the site's local
  "yesterday" all day.
- **Earlier CI** (agreed: later, separate from these scripts): an odd-minute run the evening
  before (e.g. `'17 23 * * *'`, rendering tomorrow's UTC date) would have the image ready before
  every morning, and the re-run would be rare.
- **Resolution:** 1920×1080 only; 1440p and 4K screens scale it up. A 4K render costs CI time;
  decide with the item above.
- **Displays and workspaces:** one picture on all displays. macOS sets each display's current
  Space only. XFCE sets workspace 0 unless the profile lists more.
- **Lock screen and login greeter:** out of scope (elementary's greeter, GDM, SDDM and LightDM
  keep their own).
- **Not supported:** tiling window managers without a desktop (sway, i3, Hyprland, niri), Deepin,
  Enlightenment, NixOS (paths and services work differently; untested), ChromeOS Linux.
