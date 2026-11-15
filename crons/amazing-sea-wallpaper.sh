#!/usr/bin/env bash
# amazing-sea-wallpaper version: 1.0.0
#
# Sets the day's Amazing Sea Wallpaper (https://grandma67.github.io/amazing_sea_wallpaper/) as
# the desktop background every morning, on Linux (GNOME, Pantheon, Budgie, Cinnamon, KDE Plasma,
# COSMIC) and macOS. Plan and reasons: knowledge/plans/CRON.md in the repository.
#
#   amazing-sea-wallpaper.sh --install [--portrait] [--hour H] [--url U] [--scheduler cron|systemd]
#   amazing-sea-wallpaper.sh --now | --dry-run | --status | --upgrade | --uninstall [--yes]
#   amazing-sea-wallpaper.sh            the daily run (what the schedule starts)
#   amazing-sea-wallpaper.sh --login    the login run (cron backend's autostart entry)
#   amazing-sea-wallpaper.sh --retry    the one re-run of the day
#
# Exit codes: 0 done or nothing to do; 1 network, HTTP or bad image; 2 unknown desktop;
# 3 no GUI session; 4 missing tool, blocked, or no scheduler.
#
# Everything it owns lives in one folder: ~/.local/share/amazing-sea-wallpaper (Linux) or
# ~/Library/Application Support/amazing-sea-wallpaper (macOS). It never uses sudo.
#
# Written for bash 3.2 (macOS /bin/bash). Test hooks (crons/test/run.sh), off unless set:
#   AMAZING_SEA_WALLPAPER_HOME, _TODAY, _NOW_EPOCH, _STUBS=1, _OS=macos|linux, _ROOT,
#   _DOWNLOADER=curl|wget, _RANDOM, _STUB_MISSING, _STUB_NOSESSION.

VERSION="1.0.0"
NAME=amazing-sea-wallpaper
DEFAULT_URL="https://grandma67.github.io/amazing_sea_wallpaper/"
UPGRADE_URL="https://raw.githubusercontent.com/grandma67/amazing_sea_wallpaper/main/crons/amazing-sea-wallpaper.sh"
UA="$NAME/$VERSION"
PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH
umask 022

STUBS=${AMAZING_SEA_WALLPAPER_STUBS:-}
ROOT=${AMAZING_SEA_WALLPAPER_ROOT:-}
MY_UID=$(id -u)

# ---------- small helpers ----------

say() { printf '%s\n' "$*"; }
log() {
  local line
  line="$(date '+%Y-%m-%dT%H:%M:%S') $MODE: $*"
  printf '%s\n' "$line"
  if [ -t 1 ] && [ -d "$DIR" ]; then printf '%s\n' "$line" >> "$LOG" 2>/dev/null; fi
}
die() { local code=$1; shift; log "error: $*"; exit "$code"; }
has() {
  if [ -n "$STUBS" ]; then
    case " ${AMAZING_SEA_WALLPAPER_STUB_MISSING:-} " in *" $1 "*) return 1 ;; esac
    return 0
  fi
  command -v "$1" >/dev/null 2>&1
}
rand() { if [ -n "${AMAZING_SEA_WALLPAPER_RANDOM:-}" ]; then local r=$AMAZING_SEA_WALLPAPER_RANDOM; [ "$r" -ge "$1" ] && r=$(($1 - 1)); echo "$r"; else echo $((RANDOM % $1)); fi; }
nap() { if [ -n "$STUBS" ]; then stub_log "sleep $1"; else sleep "$1"; fi; }

is_gnu_date() { date --version >/dev/null 2>&1; }
now_epoch() { if [ -n "${AMAZING_SEA_WALLPAPER_NOW_EPOCH:-}" ]; then echo "$AMAZING_SEA_WALLPAPER_NOW_EPOCH"; else date +%s; fi; }
utc_today() { if [ -n "${AMAZING_SEA_WALLPAPER_TODAY:-}" ]; then echo "$AMAZING_SEA_WALLPAPER_TODAY"; else date -u +%F; fi; }
# utc_epoch "YYYY-MM-DD HH:MM" → seconds
# (BSD date -j keeps the current seconds for fields the format lacks: always pass :SS)
utc_epoch() { if is_gnu_date; then date -u -d "$1:00" +%s; else date -j -u -f '%Y-%m-%d %H:%M:%S' "$1:00" +%s; fi; }
# epoch_fmt EPOCH FORMAT [-u]: local time, or UTC with -u
epoch_fmt() {
  if is_gnu_date; then date ${3:+-u} -d "@$1" "+$2"; else date ${3:+-u} -r "$1" "+$2"; fi
}
epoch_to_local_hm() { epoch_fmt "$1" '%H %M'; }
utc_day_offset() { epoch_fmt $(($(utc_epoch "$1 12:00") + $2 * 86400)) '%F' -u; }
mtime() { if stat -c %Y "$1" >/dev/null 2>&1; then stat -c %Y "$1"; else stat -f %m "$1"; fi; }
filesize() { wc -c < "$1" | tr -d ' '; }
sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
is_date() { printf '%s\n' "$1" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; }
# ver_gt A B: A newer than B (x.y.z, numeric)
ver_gt() {
  local a1 a2 a3 b1 b2 b3
  IFS=. read -r a1 a2 a3 <<EOF
$1
EOF
  IFS=. read -r b1 b2 b3 <<EOF
$2
EOF
  [ "${a1:-0}" -gt "${b1:-0}" ] && return 0; [ "${a1:-0}" -lt "${b1:-0}" ] && return 1
  [ "${a2:-0}" -gt "${b2:-0}" ] && return 0; [ "${a2:-0}" -lt "${b2:-0}" ] && return 1
  [ "${a3:-0}" -gt "${b3:-0}" ]
}
xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
# file_uri PATH → file:///… with everything but [A-Za-z0-9/._~-] percent-encoded (byte-wise)
file_uri() {
  local LC_ALL=C s=$1 out='' c i
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    case $c in
      [a-zA-Z0-9/._~-]) out="$out$c" ;;
      *) out="$out$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf 'file://%s' "$out"
}

# key=value files (config, state): first match wins
kv_get() { [ -f "$1" ] || return 0; grep "^$2=" "$1" 2>/dev/null | head -n 1 | cut -d= -f2-; }
# kv_set FILE KEY VALUE: rewrite by temp + mv
kv_set() {
  local f=$1 tmp="$1.tmp.$$"
  { [ -f "$f" ] && grep -v "^$2=" "$f"; printf '%s=%s\n' "$2" "$3"; } > "$tmp"
  mv "$tmp" "$f"
}
kv_del() {
  local f=$1 tmp="$1.tmp.$$"
  [ -f "$f" ] || return 0
  grep -v "^$2=" "$f" > "$tmp"
  mv "$tmp" "$f"
}

# ---------- OS and folder ----------

OS=${AMAZING_SEA_WALLPAPER_OS:-}
if [ -z "$OS" ]; then
  case $(uname -s) in
    Darwin) OS=macos ;;
    Linux) OS=linux ;;
    *) say "$NAME: $(uname -s) isn't supported (Linux and macOS; Windows has amazing-sea-wallpaper.ps1)"; exit 4 ;;
  esac
fi
if [ -n "${AMAZING_SEA_WALLPAPER_HOME:-}" ]; then
  DIR=$AMAZING_SEA_WALLPAPER_HOME
elif [ "$OS" = macos ]; then
  DIR="$HOME/Library/Application Support/$NAME"
else
  DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$NAME"
fi
COPY="$DIR/$NAME.sh"
CONFIG="$DIR/config"
STATE="$DIR/state"
LOG="$DIR/$NAME.log"
WALL="$DIR/wallpapers"
LOCK="$DIR/lock"
LINK="$HOME/.local/bin/$NAME"
AGENTS="$HOME/Library/LaunchAgents"
PLIST="$AGENTS/$NAME.plist"
RETRY_PLIST="$AGENTS/$NAME-retry.plist"
SYSTEMD_USER="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/$NAME.desktop"

stub_log() { mkdir -p "$DIR"; printf '%s\n' "$*" >> "$DIR/stubs.log"; }

# ---------- stubbed system commands ----------
# Every command that changes the desktop or a schedule, or reads the user's real schedule, goes
# through sys. With AMAZING_SEA_WALLPAPER_STUBS=1 it logs the call to <folder>/stubs.log and
# emulates the answer from files in <folder>/stub/, so tests never touch the machine.
sys() {
  if [ -z "$STUBS" ]; then "$@"; return; fi
  local S="$DIR/stub"
  mkdir -p "$S"
  case "$1 ${2:-}" in
    "crontab -l"|"fcrontab -l") [ -f "$S/crontab" ] && cat "$S/crontab" || return 1 ;;
    "crontab -"|"fcrontab -") cat > "$S/crontab"; stub_log "$1 -" ;;
    "gsettings get") grep "^$3 $4 " "$S/gsettings" 2>/dev/null | tail -n 1 | cut -d' ' -f3- ;;
    "gsettings list-keys")
      if [ -f "$S/gsettings-keys" ]; then cat "$S/gsettings-keys"; else printf 'picture-uri\npicture-uri-dark\npicture-options\n'; fi ;;
    "gsettings set") stub_log "$*"; printf '%s %s %s\n' "$3" "$4" "$5" >> "$S/gsettings" ;;
    "osascript get") cat "$S/macos-wallpaper" 2>/dev/null ;;
    "osascript set") stub_log "osascript set $3"; printf '%s\n' "$3" > "$S/macos-wallpaper" ;;
    "launchctl print-disabled") cat "$S/launchctl-disabled" 2>/dev/null; return 0 ;;
    "launchctl print") stub_log "$*"; return 0 ;;
    "systemctl --user")
      case ${3:-} in
        show-environment) [ ! -f "$S/no-systemd" ] ;;
        is-active|is-enabled) stub_log "$*"; return 0 ;;
        *) stub_log "$*" ;;
      esac ;;
    *) stub_log "$*" ;;
  esac
}

# ---------- mac session and setter ----------

# shellcheck disable=SC2016  # JXA's $ is ObjC, not a shell expansion
JXA_SET='function run(argv) {
  ObjC.import("AppKit");
  var url = $.NSURL.fileURLWithPath(argv[0]);
  var ws = $.NSWorkspace.sharedWorkspace, screens = $.NSScreen.screens, bad = 0;
  for (var i = 0; i < screens.count; i++) {
    var err = $();
    if (!ws.setDesktopImageURLForScreenOptionsError(url, screens.objectAtIndex(i), $({}), err)) bad++;
  }
  return screens.count + " " + bad;
}'
# shellcheck disable=SC2016
JXA_GET='function run() {
  ObjC.import("AppKit");
  var ws = $.NSWorkspace.sharedWorkspace, screens = $.NSScreen.screens, out = [];
  for (var i = 0; i < screens.count; i++) {
    var u = ws.desktopImageURLForScreen(screens.objectAtIndex(i));
    out.push(u.isNil() ? "" : u.path.js);
  }
  return out.join("\n");
}'

osascript_cmd() {
  # osascript_cmd set PATH | get
  if [ -n "$STUBS" ]; then sys osascript "$@"; return; fi
  if [ "$1" = set ]; then /usr/bin/osascript -l JavaScript -e "$JXA_SET" "$2"
  else /usr/bin/osascript -l JavaScript -e "$JXA_GET"; fi
}

macos_session() {
  if [ -n "$STUBS" ]; then [ -z "${AMAZING_SEA_WALLPAPER_STUB_NOSESSION:-}" ]; return; fi
  [ "$(stat -f%Su /dev/console 2>/dev/null)" = "$(id -un)" ] && launchctl print "gui/$MY_UID" >/dev/null 2>&1
}

set_macos() {
  local path=$1 out n bad i got
  out=$(osascript_cmd set "$path" 2>&1) || { log "osascript failed: $out"; return 1; }
  if [ -z "$STUBS" ]; then
    n=${out%% *}; bad=${out##* }
    [ "$bad" = 0 ] || { log "the picture was refused on $bad of $n displays"; return 1; }
  fi
  # the change is asynchronous: poll the readback up to 10 s (CRON.md §2.4)
  for i in 1 2 3 4 5 6 7 8 9 10; do
    got=$(osascript_cmd get 2>/dev/null)
    if [ -n "$got" ] && ! printf '%s\n' "$got" | grep -vqxF "$path"; then return 0; fi
    [ "$i" = 10 ] || nap 1
  done
  log "the desktop still shows another picture after 10 s: $(printf '%s' "$got" | tr '\n' ' ')"
  return 1
}

# ---------- Linux session and desktop (CRON.md §4.4) ----------

# rows: tokens|comm|desktop
DESKTOPS='gnome ubuntu zorin pop unity|gnome-shell|gnome
pantheon|gala|pantheon
budgie|budgie-daemon|budgie
x-cinnamon cinnamon|cinnamon|cinnamon
kde|plasmashell|kde
cosmic|cosmic-bg|cosmic'

# desktop_for "XDG_CURRENT_DESKTOP" → gnome|pantheon|… or empty. First token in table order wins.
desktop_for() {
  local tokens tok row
  tokens=$(printf '%s' "$1" | tr ':' ' ' | tr '[:upper:]' '[:lower:]')
  for tok in $tokens; do
    while IFS='|' read -r row _ desk; do
      case " $row " in *" $tok "*) echo "$desk"; return 0 ;; esac
    done <<EOF
$DESKTOPS
EOF
  done
  return 1
}

environ_get() { tr '\0' '\n' < "$1" 2>/dev/null | grep "^$2=" | head -n 1 | cut -d= -f2-; }

# find_session_process: exports the session's variables from its /proc environ; echoes the desktop
find_session_process() {
  local row comm desk pid env v var
  while IFS='|' read -r row comm desk; do
    pid=$(pgrep -u "$MY_UID" -x "$comm" 2>/dev/null | head -n 1)
    [ -n "$pid" ] || continue
    env="$ROOT/proc/$pid/environ"
    [ -r "$env" ] || continue
    for var in XDG_CURRENT_DESKTOP DBUS_SESSION_BUS_ADDRESS DISPLAY WAYLAND_DISPLAY XDG_RUNTIME_DIR; do
      v=$(environ_get "$env" "$var")
      if [ -n "$v" ]; then eval "$var=\$v"; export "${var?}"; fi
    done
    [ -n "${XDG_CURRENT_DESKTOP:-}" ] || { XDG_CURRENT_DESKTOP=$desk; export XDG_CURRENT_DESKTOP; }
    echo "$desk"
    return 0
  done <<EOF
$DESKTOPS
EOF
  return 1
}

graphical_session() {
  local id t s
  if command -v loginctl >/dev/null 2>&1; then
    for id in $(loginctl list-sessions --no-legend 2>/dev/null | awk -v u="$MY_UID" '$2 == u {print $1}'); do
      t=$(loginctl show-session "$id" -p Type --value 2>/dev/null)
      case $t in x11|wayland) return 0 ;; esac
    done
    return 1
  fi
  for s in "$ROOT"/tmp/.X11-unix/X* "${XDG_RUNTIME_DIR:-$ROOT/run/user/$MY_UID}"/wayland-*; do
    [ -S "$s" ] && [ "$(stat -c %u "$s" 2>/dev/null || stat -f %u "$s" 2>/dev/null)" = "$MY_UID" ] && return 0
  done
  return 1
}

# any process of ours that knows the desktop's name (for the "isn't supported" message)
any_desktop_name() {
  local pid v
  for pid in $(pgrep -u "$MY_UID" 2>/dev/null); do
    v=$(environ_get "$ROOT/proc/$pid/environ" XDG_CURRENT_DESKTOP)
    [ -n "$v" ] && { echo "$v"; return 0; }
  done
  echo "${XDG_CURRENT_DESKTOP:-unknown}"
}

# detect_linux WAIT: sets DESKTOP or exits 2/3
detect_linux() {
  local wait=$1 tries=0 d
  DESKTOP=
  if [ -n "${XDG_CURRENT_DESKTOP:-}" ] && [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
    DESKTOP=$(desktop_for "$XDG_CURRENT_DESKTOP")
  else
    while :; do
      d=$(find_session_process) && break
      tries=$((tries + 1))
      [ "$wait" = 1 ] && [ $tries -le 12 ] || break
      nap 10
    done
    if [ -n "$d" ]; then
      # re-read in this shell (the $(…) above ran in a subshell)
      find_session_process >/dev/null
      DESKTOP=$(desktop_for "$XDG_CURRENT_DESKTOP")
    fi
  fi
  if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ] && [ -S "$ROOT/run/user/$MY_UID/bus" ]; then
    DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$MY_UID/bus"; export DBUS_SESSION_BUS_ADDRESS
  fi
  [ -n "${XDG_RUNTIME_DIR:-}" ] || { XDG_RUNTIME_DIR=/run/user/$MY_UID; export XDG_RUNTIME_DIR; }
  [ -n "$DESKTOP" ] && return 0
  if [ -n "${XDG_CURRENT_DESKTOP:-}" ] || graphical_session; then
    die 2 "desktop '$(any_desktop_name)' isn't supported (GNOME, Pantheon, Budgie, Cinnamon, KDE Plasma, COSMIC)"
  fi
  if [ "$MODE" = install ]; then die 3 "no desktop session found: run this from a terminal in your desktop session"; fi
  if [ "$wait" = 1 ]; then die 3 "no desktop session found after 120 s"; fi
  die 3 "no desktop session found"
}

# ---------- Linux setters ----------

distro_id() { kv_get "$ROOT/etc/os-release" ID | tr -d '"'; }
# install_hint PKG-per-family: "debian fedora suse arch solus gentoo" names
install_hint() {
  local id deb=$1 fed=$2 suse=$3 arch=$4 sol=$5 gen=$6 like
  id=$(distro_id); like=$(kv_get "$ROOT/etc/os-release" ID_LIKE | tr -d '"')
  case " $id $like " in
    *" debian "*|*" ubuntu "*) echo "sudo apt install $deb" ;;
    *" fedora "*|*" rhel "*) echo "sudo dnf install $fed" ;;
    *" suse "*|*opensuse*) echo "sudo zypper install $suse" ;;
    *" arch "*) echo "sudo pacman -S $arch" ;;
    *" solus "*) echo "sudo eopkg install $sol" ;;
    *" gentoo "*) echo "sudo emerge $gen" ;;
    *) echo "install $deb with your package manager" ;;
  esac
}
need_tool() {
  has "$1" && return 0
  if [ "$OS" = macos ]; then die 4 "$1 is missing"; fi
  die 4 "$1 is missing: $(install_hint "$2" "$3" "$4" "$5" "$6" "$7")"
}

gsettings_set_check() {
  local schema=$1 key=$2 value=$3
  sys gsettings set "$schema" "$key" "$value" || return 1
  [ "$(sys gsettings get "$schema" "$key")" = "$value" ] || { log "gsettings $schema $key reads back '$(sys gsettings get "$schema" "$key")'"; return 1; }
}

set_gnome_like() {
  local uri=$1 dark=$2 keys
  need_tool gsettings libglib2.0-bin glib2 glib2-tools glib2 glib2 dev-libs/glib
  keys=$(sys gsettings list-keys org.gnome.desktop.background)
  gsettings_set_check org.gnome.desktop.background picture-uri "'$uri'" || return 1
  if printf '%s\n' "$keys" | grep -qx picture-uri-dark; then
    if [ "$dark" = same ]; then gsettings_set_check org.gnome.desktop.background picture-uri-dark "'$uri'" || return 1
    else gsettings_set_check org.gnome.desktop.background picture-uri-dark "''" || return 1; fi
  fi
  gsettings_set_check org.gnome.desktop.background picture-options "'zoom'"
}

COSMIC_DEFAULT='(output: "all", source: Path("%s"), filter_by_theme: true, rotation_frequency: 3600, filter_method: Lanczos, scaling_mode: Zoom, sampling_method: Alphanumeric)'

set_cosmic() {
  local path=$1 cfg="${XDG_CONFIG_HOME:-$HOME/.config}/cosmic" sys_dir="$ROOT/usr/share/cosmic" c src f tmp esc
  case $path in *'"'*|*\\*) log "path has a quote or backslash: $path"; return 1 ;; esac
  esc=$(printf '%s' "$path" | sed -e 's/[&|]/\\&/g')
  for c in com.system76.CosmicBackground com.system76.CosmicBackground.Dark com.system76.CosmicBackground.Light; do
    if [ "$c" != com.system76.CosmicBackground ] && [ ! -d "$cfg/$c" ]; then continue; fi
    mkdir -p "$cfg/$c/v1"
    f="$cfg/$c/v1/all"
    src=
    if [ -f "$f" ]; then src=$f
    elif [ -f "$sys_dir/$c/v1/all" ]; then src="$sys_dir/$c/v1/all"
    elif [ -f "$sys_dir/com.system76.CosmicBackground/v1/all" ]; then src="$sys_dir/com.system76.CosmicBackground/v1/all"; fi
    tmp="$f.tmp.$$"
    if [ -n "$src" ] && grep -q 'source: *Path("[^"]*")' "$src"; then
      sed "s|source: *Path(\"[^\"]*\")|source: Path(\"$esc\")|" "$src" > "$tmp"
    else
      # shellcheck disable=SC2059
      printf "$COSMIC_DEFAULT\n" "$path" > "$tmp"
    fi
    if [ -n "$STUBS" ]; then stub_log "cosmic $c/v1/all"; fi
    mv "$tmp" "$f" || return 1
    grep -qF "Path(\"$path\")" "$f" || { log "COSMIC $c doesn't read back"; return 1; }
    if [ "$c" = com.system76.CosmicBackground ]; then
      printf 'true\n' > "$cfg/$c/v1/same-on-all.tmp.$$" && mv "$cfg/$c/v1/same-on-all.tmp.$$" "$cfg/$c/v1/same-on-all"
    fi
  done
}

set_linux() {
  local path=$1 uri
  uri=$(file_uri "$path")
  case $DESKTOP in
    gnome|budgie) set_gnome_like "$uri" same ;;
    pantheon) set_gnome_like "$uri" empty ;;
    cinnamon)
      need_tool gsettings libglib2.0-bin glib2 glib2-tools glib2 glib2 dev-libs/glib
      gsettings_set_check org.cinnamon.desktop.background picture-uri "'$uri'" &&
        gsettings_set_check org.cinnamon.desktop.background picture-options "'zoom'" ;;
    kde)
      need_tool plasma-apply-wallpaperimage plasma-workspace plasma-workspace plasma6-workspace plasma-workspace plasma-workspace kde-plasma/plasma-workspace
      sys plasma-apply-wallpaperimage --fill-mode preserveAspectCrop "$path" >/dev/null ;;
    cosmic) set_cosmic "$path" ;;
    *) return 1 ;;
  esac
}

# ---------- session, setter dispatch ----------

check_session() {
  # check_session WAIT
  if [ "$OS" = macos ]; then
    local tries=0
    until macos_session; do
      tries=$((tries + 1))
      [ "$1" = 1 ] && [ $tries -le 12 ] || die 3 "no logged-in desktop session (the console user isn't $(id -un))"
      nap 10
    done
    DESKTOP=macos
  else
    detect_linux "$1"
  fi
}
set_wallpaper() { if [ "$OS" = macos ]; then set_macos "$1"; else set_linux "$1"; fi; }
setter_name() {
  case $DESKTOP in
    macos) echo "NSWorkspace (every display)" ;;
    gnome|budgie) echo "gsettings org.gnome.desktop.background" ;;
    pantheon) echo "gsettings org.gnome.desktop.background (dark key cleared)" ;;
    cinnamon) echo "gsettings org.cinnamon.desktop.background" ;;
    kde) echo "plasma-apply-wallpaperimage" ;;
    cosmic) echo "cosmic-bg config (~/.config/cosmic)" ;;
  esac
}

# ---------- downloads ----------

downloader() {
  if [ -n "${AMAZING_SEA_WALLPAPER_DOWNLOADER:-}" ]; then echo "$AMAZING_SEA_WALLPAPER_DOWNLOADER"
  elif command -v curl >/dev/null 2>&1; then echo curl
  elif command -v wget >/dev/null 2>&1; then echo wget
  elif command -v wget2 >/dev/null 2>&1; then echo wget2
  else return 1; fi
}

# fetch URL OUT: sets HTTP (status, 000 when no answer) and CTYPE; returns 0 when it got an answer
fetch() {
  local url=$1 out=$2 res hdr proxy
  proxy=$(kv_get "$CONFIG" proxy)
  HTTP=000; CTYPE=
  rm -f "$out"
  case $DL in
    curl)
      res=$(curl -sS -L --retry 2 --max-time 60 -A "$UA" ${proxy:+-x "$proxy"} -o "$out" -w '%{http_code} %{content_type}' "$url" 2>/dev/null)
      HTTP=${res%% *}; CTYPE=${res#* } ;;
    wget|wget2)
      hdr="$out.hdr"
      "$DL" -q -S -O "$out" --tries=3 --timeout=60 -U "$UA" \
        ${proxy:+-e use_proxy=yes -e "https_proxy=$proxy" -e "http_proxy=$proxy"} "$url" 2> "$hdr"
      HTTP=$(grep -Eo 'HTTP/[0-9.]+ [0-9]{3}' "$hdr" | tail -n 1 | awk '{print $2}')
      CTYPE=$(grep -i '^ *content-type:' "$hdr" | tail -n 1 | sed 's/^ *[Cc]ontent-[Tt]ype: *//' | tr -d '\r')
      rm -f "$hdr"
      [ -n "$HTTP" ] || HTTP=000 ;;
  esac
  CTYPE=${CTYPE%%;*}
  [ "$HTTP" != 000 ]
}

# check_image FILE: the last fetch was a real JPEG (HTTP 200, image/jpeg, FF D8, > 50 KB)
check_image() {
  local magic size
  [ "$HTTP" = 200 ] || { WHY="HTTP $HTTP"; return 1; }
  [ "$CTYPE" = image/jpeg ] || { WHY="Content-Type $CTYPE"; return 1; }
  magic=$(head -c 2 "$1" | od -An -tx1 | tr -d ' \n')
  [ "$magic" = ffd8 ] || { WHY="not a JPEG (starts $magic)"; return 1; }
  size=$(filesize "$1")
  [ "$size" -gt 51200 ] || { WHY="only $size bytes"; return 1; }
}

json_field() {
  # json_field FILE date|title: the first match (the files have one key per line)
  if [ "$2" = date ]; then
    grep -o '"date": *"[0-9-]*"' "$1" 2>/dev/null | head -n 1 | sed 's/.*"\([0-9-]*\)"$/\1/'
  else
    grep -o '"title": *"[^"]*"' "$1" 2>/dev/null | head -n 1 | sed -e 's/^"title": *"//' -e 's/"$//'
  fi
}

# ---------- lock ----------

take_lock() {
  mkdir -p "$DIR" || die 4 "can't create $DIR"
  if mkdir "$LOCK" 2>/dev/null; then echo $$ > "$LOCK/pid"; trap 'rm -rf "$LOCK"' EXIT; return 0; fi
  local pid age
  pid=$(cat "$LOCK/pid" 2>/dev/null)
  age=$(($(date +%s) - $(mtime "$LOCK" 2>/dev/null || date +%s)))
  if [ $age -gt 600 ] || { [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; }; then
    rm -rf "$LOCK"
    mkdir "$LOCK" 2>/dev/null || return 1
    echo $$ > "$LOCK/pid"; trap 'rm -rf "$LOCK"' EXIT
    return 0
  fi
  return 1
}

trim_log() {
  # in place (cat >), not mv: cron and launchd keep the file open in append mode
  [ -f "$LOG" ] || return 0
  if [ "$(wc -l < "$LOG")" -gt 600 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp.$$" && cat "$LOG.tmp.$$" > "$LOG"; rm -f "$LOG.tmp.$$"
  fi
}

# ---------- scheduling (CRON.md §4.5) ----------

# cron_daemon → cron, fcron or nothing (a running daemon and its crontab command)
cron_daemon() {
  if [ -n "$STUBS" ]; then [ -f "$DIR/stub/cron-daemon" ] && cat "$DIR/stub/cron-daemon"; return 0; fi
  if has fcrontab && pgrep -x fcron >/dev/null 2>&1; then echo fcron
  elif has crontab && { pgrep -x cron >/dev/null 2>&1 || pgrep -x crond >/dev/null 2>&1; }; then echo cron; fi
}
# pick_backend FORCED: sets BACKEND to cron, fcron or systemd (CRON.md §3), or exits 4
pick_backend() {
  local forced=$1 d
  d=$(cron_daemon)
  if [ "$forced" = cron ]; then BACKEND=${d:-cron}; return 0; fi
  if [ "$forced" = systemd ]; then BACKEND=systemd; return 0; fi
  if [ -n "$d" ]; then BACKEND=$d; return 0; fi
  if has systemctl && sys systemctl --user show-environment >/dev/null 2>&1; then BACKEND=systemd; return 0; fi
  if [ "$(distro_id)" = gentoo ]; then
    die 4 "no cron daemon and no systemd user manager: sudo emerge sys-process/cronie && sudo rc-update add cronie default"
  fi
  die 4 "no cron daemon and no systemd user manager: $(install_hint cron cronie cronie cronie cronie sys-process/cronie), then start it"
}

crontab_cmd() { if [ "$BACKEND" = fcron ]; then echo fcrontab; else echo crontab; fi; }
# crontab_edit DROP_REGEX [NEW_LINE]: rewrites the user's crontab without our matching lines
crontab_edit() {
  local tab cur
  tab=$(crontab_cmd)
  cur=$(sys "$tab" -l 2>/dev/null | grep -Ev "$1")
  { [ -n "$cur" ] && printf '%s\n' "$cur"; [ -n "${2:-}" ] && printf '%s\n' "$2"; } | sys "$tab" -
}
q1() { printf "'%s'" "$1"; }
cron_safe() {
  case $1 in *"'"*|*%*) die 4 "the folder path can't contain ' or % for cron: $1 (use --scheduler systemd)" ;; esac
}

unit_escape() { printf '%s' "$1" | sed 's/%/%%/g'; }
write_units() {
  # write_units NAME ONCALENDAR ARGS RANDOMDELAY
  local n=$1 cal=$2 args=$3 rnd=$4 svc="$DIR/$1.service" tmr="$DIR/$1.timer"
  {
    printf '[Unit]\nDescription=Amazing Sea Wallpaper: today'"'"'s picture as the desktop background%s\n\n' "${args:+ (re-run)}"
    printf '[Service]\nType=oneshot\nExecStart=/usr/bin/env bash "%s"%s\n' "$(unit_escape "$COPY")" "${args:+ $args}"
    printf 'StandardOutput=append:%s\nStandardError=append:%s\n' "$(unit_escape "$LOG")" "$(unit_escape "$LOG")"
  } > "$svc.tmp" && mv "$svc.tmp" "$svc"
  {
    printf '[Unit]\nDescription=Amazing Sea Wallpaper%s\n\n' "${args:+ re-run}"
    printf '[Timer]\nOnCalendar=%s\nPersistent=true\n' "$cal"
    [ -n "$rnd" ] && printf 'RandomizedDelaySec=%s\n' "$rnd"
    printf '\n[Install]\nWantedBy=timers.target\n'
  } > "$tmr.tmp" && mv "$tmr.tmp" "$tmr"
}
systemd_enable() {
  local n=$1 u
  for u in "$n.service" "$n.timer"; do
    if [ ! -L "$SYSTEMD_USER/$u" ] || [ "$(readlink "$SYSTEMD_USER/$u")" != "$DIR/$u" ]; then
      rm -f "$SYSTEMD_USER/$u"
      sys systemctl --user link "$DIR/$u" >/dev/null 2>&1 || die 4 "systemctl --user link $DIR/$u failed"
    fi
  done
  sys systemctl --user daemon-reload
  sys systemctl --user enable "$n.timer" >/dev/null 2>&1
  sys systemctl --user restart "$n.timer" || die 4 "systemctl --user restart $n.timer failed"
}
systemd_remove() {
  local n=$1 u
  sys systemctl --user disable --now "$n.timer" >/dev/null 2>&1
  for u in "$n.service" "$n.timer"; do
    if [ -L "$SYSTEMD_USER/$u" ]; then rm -f "$SYSTEMD_USER/$u"; fi
  done
}

plist_write() {
  # plist_write FILE LABEL HOUR MINUTE RUNATLOAD EXTRA_ARG
  local f=$1 tmp="$1.tmp.$$"
  mkdir -p "$AGENTS"
  {
    printf '<?xml version="1.0" encoding="UTF-8"?>\n'
    printf '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
    printf '<plist version="1.0">\n<dict>\n'
    printf '  <key>Label</key>\n  <string>%s</string>\n' "$2"
    printf '  <key>ProgramArguments</key>\n  <array>\n    <string>/bin/bash</string>\n    <string>%s</string>\n' "$(xml_escape "$COPY")"
    [ -n "$6" ] && printf '    <string>%s</string>\n' "$6"
    printf '  </array>\n'
    printf '  <key>StartCalendarInterval</key>\n  <dict>\n    <key>Hour</key>\n    <integer>%d</integer>\n    <key>Minute</key>\n    <integer>%d</integer>\n  </dict>\n' "$((10#$3))" "$((10#$4))"
    [ "$5" = 1 ] && printf '  <key>RunAtLoad</key>\n  <true/>\n'
    printf '  <key>StandardOutPath</key>\n  <string>%s</string>\n' "$(xml_escape "$LOG")"
    printf '  <key>StandardErrorPath</key>\n  <string>%s</string>\n' "$(xml_escape "$LOG")"
    printf '</dict>\n</plist>\n'
  } > "$tmp" && mv "$tmp" "$f"
}
agent_load() { sys launchctl bootout "gui/$MY_UID" "$1" >/dev/null 2>&1; sys launchctl bootstrap "gui/$MY_UID" "$1" || die 4 "launchctl bootstrap $1 failed"; }
agent_unload() { [ -f "$1" ] || return 0; sys launchctl bootout "gui/$MY_UID" "$1" >/dev/null 2>&1; rm -f "$1"; }

schedule_daily() {
  local h=$1 m=$2
  case $BACKEND in
    launchd) plist_write "$PLIST" "$NAME" "$h" "$m" 1 ""; agent_load "$PLIST" ;;
    cron|fcron)
      cron_safe "$COPY"
      crontab_edit " # $NAME\$" "$((10#$m)) $((10#$h)) * * * /usr/bin/env bash $(q1 "$COPY") >> $(q1 "$LOG") 2>&1 # $NAME" ||
        die 4 "$(crontab_cmd) refused the entry (cron.allow / cron.deny?): try --scheduler systemd"
      mkdir -p "$(dirname "$AUTOSTART")"
      {
        printf '[Desktop Entry]\nType=Application\nName=Amazing Sea Wallpaper\n'
        printf 'Comment=Sets today'"'"'s Amazing Sea Wallpaper picture at login\n'
        printf 'Exec=/usr/bin/env bash "%s" --login\n' "$COPY"
        printf 'NoDisplay=true\nX-GNOME-Autostart-enabled=true\nX-GNOME-Autostart-Delay=30\n'
      } > "$AUTOSTART.tmp" && mv "$AUTOSTART.tmp" "$AUTOSTART" ;;
    systemd)
      write_units "$NAME" "*-*-* $h:$m:00" "" 300
      systemd_enable "$NAME" ;;
  esac
}

# schedule_retry EPOCH
schedule_retry() {
  local e=$1 hm h m
  hm=$(epoch_to_local_hm "$e"); h=${hm% *}; m=${hm#* }
  case $BACKEND in
    launchd) plist_write "$RETRY_PLIST" "$NAME-retry" "$h" "$m" 0 --retry; agent_load "$RETRY_PLIST" ;;
    cron|fcron)
      cron_safe "$COPY"
      crontab_edit " # $NAME-retry\$" "$((10#$m)) $((10#$h)) $(epoch_fmt "$e" '%d %m' | awk '{print $1+0, $2+0}') * /usr/bin/env bash $(q1 "$COPY") --retry >> $(q1 "$LOG") 2>&1 # $NAME-retry" ;;
    systemd)
      write_units "$NAME-retry" "$(epoch_fmt "$e" '%Y-%m-%d %H:%M:%S' -u) UTC" --retry ""
      systemd_enable "$NAME-retry" ;;
  esac
  kv_set "$STATE" retry_at "$e"
}

cancel_retry() {
  case $BACKEND in
    launchd) agent_unload "$RETRY_PLIST" ;;
    cron|fcron) if sys "$(crontab_cmd)" -l 2>/dev/null | grep -q " # $NAME-retry\$"; then crontab_edit " # $NAME-retry\$"; fi ;;
    systemd) if [ -f "$DIR/$NAME-retry.timer" ]; then systemd_remove "$NAME-retry"; rm -f "$DIR/$NAME-retry.service" "$DIR/$NAME-retry.timer"; fi ;;
  esac
  kv_del "$STATE" retry_at
}

retry_epoch() {
  # the later of now + 3 h and 08:00 UTC today (UTC), plus 0–30 min (CRON.md §4.3)
  local now=$1 floor t
  floor=$(utc_epoch "$(utc_today) 08:00")
  t=$((now + 10800)); [ $t -lt "$floor" ] && t=$floor
  echo $((t + $(rand 1801)))
}

# ---------- the run (CRON.md §4.3) ----------

prune() {
  local keep=$1 f n=0
  for f in "$WALL"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].jpg; do [ -f "$f" ] && echo "$f"; done | sort -r |
    while read -r f; do
      n=$((n + 1))
      [ $n -le 7 ] && continue
      [ "$f" = "$keep" ] && continue
      rm -f "$f"
    done
}

do_run() {
  local today yesterday now last retry_day local_today got_date='' got_title='' status=0 kind part json latest_date retry_at e
  today=$(utc_today); now=$(now_epoch)
  local_today=$(epoch_fmt "$now" '%F')
  if [ "$MODE" != dry-run ]; then
    trim_log
    take_lock || { log "another run holds the lock"; exit 0; }
  fi
  BACKEND=$(kv_get "$CONFIG" scheduler)
  [ -n "$BACKEND" ] || { [ "$OS" = macos ] && BACKEND=launchd; }
  last=$(kv_get "$STATE" date)
  retry_day=$(kv_get "$STATE" retry_day)
  retry_at=$(kv_get "$STATE" retry_at)

  if [ "$MODE" = retry ]; then cancel_retry
  elif [ -n "$retry_at" ] && [ "$now" -gt $((retry_at + 21600)) ] && [ -n "$BACKEND" ]; then
    cancel_retry   # a missed re-run never fires later (e.g. a cron line a year on)
  fi

  # 1. today's already set
  if [ "$last" = "$today" ] && [ "$MODE" != now ] && [ "$MODE" != dry-run ]; then
    log "today's picture ($today) is already set"; exit 0
  fi

  # 2. session and desktop
  case $MODE in schedule|login|retry) check_session 1 ;; *) check_session 0 ;; esac

  DL=$(downloader) || die 4 "neither curl nor wget is installed: $(install_hint curl curl curl curl curl net-misc/curl)"
  if [ "$(kv_get "$CONFIG" portrait)" = 1 ]; then kind=phone; json=latest-portrait; else kind=pc; json=latest; fi
  if [ "$MODE" = dry-run ]; then part=$(mktemp -d "${TMPDIR:-/tmp}/$NAME.XXXXXX"); trap 'rm -rf "$part"' EXIT
  else mkdir -p "$WALL"; part="$WALL/.part-$$"; mkdir -p "$part"; trap 'rm -rf "$LOCK" "$part"' EXIT; fi

  # 3. today's dated image
  if fetch "${URL}daily/$kind/$today.jpg" "$part/img"; then
    if check_image "$part/img"; then
      got_date=$today
      fetch "${URL}daily/$kind/$today.json" "$part/json" && [ "$HTTP" = 200 ] && got_title=$(json_field "$part/json" title)
    elif [ "$HTTP" != 404 ]; then log "daily/$kind/$today.jpg: $WHY"; status=1
    fi
  else
    log "daily/$kind/$today.jpg: no answer from ${URL}"; status=1
  fi

  # 4. catch up from latest
  yesterday=$(utc_day_offset "$today" -1)
  if [ -z "$got_date" ] && [ $status = 0 ] && { [[ "$last" < "$yesterday" ]] || [ "$MODE" = retry ] || [ "$MODE" = now ] || [ "$MODE" = dry-run ]; }; then
    if fetch "${URL}$json.json" "$part/json" && [ "$HTTP" = 200 ]; then
      latest_date=$(json_field "$part/json" date)
      if ! is_date "$latest_date"; then log "$json.json has no date"; status=1
      elif [[ "$latest_date" > "$last" ]] || { [ "$MODE" = now ] || [ "$MODE" = dry-run ]; }; then
        if fetch "${URL}$json.jpg?d=$latest_date" "$part/img" && check_image "$part/img"; then
          got_date=$latest_date; got_title=$(json_field "$part/json" title)
        else log "$json.jpg: ${WHY:-no answer}"; status=1; fi
      fi
    else
      log "$json.json: HTTP $HTTP (nothing published?)"; status=1
    fi
  fi

  if [ "$MODE" = dry-run ]; then
    if [ -n "$got_date" ]; then
      say "would set $got_date \"$got_title\" ($(filesize "$part/img") bytes) with $(setter_name)"
    elif [ $status = 0 ]; then
      say "nothing to set: today's ($today) isn't out yet"
    else
      say "nothing to set: the download failed its check (above)"
    fi
    [ "$got_date" = "$today" ] || say "would schedule a re-run at $(epoch_fmt "$(retry_epoch "$now")" '%F %H:%M %Z')"
    exit $status
  fi

  # 6. set it
  if [ -n "$got_date" ]; then
    local file="$WALL/$got_date.jpg"
    mv "$part/img" "$file"
    if set_wallpaper "$file"; then
      { [ -f "$STATE" ] && grep -Ev '^(date|sha256|title|set_at)=' "$STATE"
        printf 'date=%s\nsha256=%s\ntitle=%s\nset_at=%s\n' "$got_date" "$(sha256 "$file")" "$got_title" "$now"; } > "$STATE.tmp.$$"
      mv "$STATE.tmp.$$" "$STATE"
      prune "$file"
      log "set $got_date: $got_title"
      [ "$got_date" = "$today" ] && [ -n "$BACKEND" ] && cancel_retry
    else
      log "setting the picture failed"; status=1
    fi
  fi

  # 5. one re-run when today's isn't set
  if [ "$got_date" != "$today" ] && [ "$MODE" != retry ] && [ "$MODE" != now ] && [ "$retry_day" != "$local_today" ]; then
    if [ -n "$BACKEND" ]; then
      e=$(retry_epoch "$now")
      schedule_retry "$e"
      kv_set "$STATE" retry_day "$local_today"
      log "today's picture isn't out yet: re-run at $(epoch_fmt "$e" '%H:%M')"
    else
      log "today's picture isn't out yet (not installed: no re-run)"
    fi
  elif [ "$got_date" != "$today" ]; then
    log "today's picture ($today) isn't out yet"
  fi
  exit $status
}

# ---------- install, uninstall, status, upgrade ----------

do_install() {
  local self minute hour=$OPT_HOUR backend
  [ "$MY_UID" != 0 ] || die 4 "run this as your own user, not root"
  self=$0
  grep -q '^VERSION="' "$self" 2>/dev/null || die 4 "save the script to a file first, then run: bash amazing-sea-wallpaper.sh --install"
  DL=$(downloader) || die 4 "neither curl nor wget is installed: $(install_hint curl curl curl curl curl net-misc/curl)"
  check_session 0
  case $DESKTOP in
    gnome|budgie|pantheon|cinnamon) need_tool gsettings libglib2.0-bin glib2 glib2-tools glib2 glib2 dev-libs/glib ;;
    kde) need_tool plasma-apply-wallpaperimage plasma-workspace plasma-workspace plasma6-workspace plasma-workspace plasma-workspace kde-plasma/plasma-workspace ;;
    macos) [ -n "$STUBS" ] || [ -x /usr/bin/osascript ] || die 4 "/usr/bin/osascript is missing" ;;
  esac
  mkdir -p "$DIR" "$WALL" || die 4 "can't create $DIR"
  if [ "$self" != "$COPY" ]; then
    if ! { cp "$self" "$COPY.tmp.$$" && chmod 755 "$COPY.tmp.$$" && mv "$COPY.tmp.$$" "$COPY"; }; then die 4 "can't copy to $COPY"; fi
  fi

  minute=$(kv_get "$CONFIG" minute)
  [ -n "$minute" ] || minute=$(rand 60)
  [ -n "$hour" ] || hour=$(kv_get "$CONFIG" hour)
  [ -n "$hour" ] || hour=7
  printf '%s\n' "$hour" | grep -Eq '^([01]?[0-9]|2[0-3])$' || die 4 "--hour takes 0-23"
  if [ "$OS" = macos ]; then backend=launchd
  else
    [ -n "$OPT_SCHEDULER" ] || OPT_SCHEDULER=$(kv_get "$CONFIG" scheduler_forced)
    pick_backend "$OPT_SCHEDULER"; backend=$BACKEND
  fi
  {
    printf 'minute=%s\nhour=%s\nportrait=%s\nurl=%s\nscheduler=%s\nproxy=%s\n' \
      "$minute" "$hour" "$OPT_PORTRAIT" "$URL" "$backend" "${https_proxy:-${HTTPS_PROXY:-}}"
    [ -n "$OPT_SCHEDULER" ] && printf 'scheduler_forced=%s\n' "$OPT_SCHEDULER"
  } > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

  # the other Linux backend's entries go
  if [ "$OS" = linux ]; then
    if [ "$backend" = systemd ]; then
      BACKEND=cron
      if sys crontab -l 2>/dev/null | grep -q " # $NAME\(-retry\)\{0,1\}\$"; then crontab_edit " # $NAME(-retry)?\$"; fi
      rm -f "$AUTOSTART"
    else
      systemd_remove "$NAME"; systemd_remove "$NAME-retry"
      rm -f "$DIR/$NAME.service" "$DIR/$NAME.timer" "$DIR/$NAME-retry.service" "$DIR/$NAME-retry.timer"
    fi
  fi
  BACKEND=$backend
  schedule_daily "$(printf '%02d' "$((10#$hour))")" "$(printf '%02d' "$((10#$minute))")"
  mkdir -p "$(dirname "$LINK")" && ln -sf "$COPY" "$LINK"

  say "installed $NAME $VERSION in $DIR"
  say "  daily at $(printf '%02d:%02d' "$((10#$hour))" "$((10#$minute))") local and at login ($backend), desktop: $DESKTOP"
  case ":$PATH:" in *":$HOME/.local/bin:"*) say "  command: $NAME --status" ;; *) say "  command: $COPY --status" ;; esac
  say "  setting today's picture now…"
  MODE=now
  do_run
}

do_uninstall() {
  local ans
  BACKEND=
  if [ "$OS" = macos ]; then
    agent_unload "$PLIST"; agent_unload "$RETRY_PLIST"
  else
    BACKEND=$(kv_get "$CONFIG" scheduler); [ -n "$BACKEND" ] || BACKEND=cron
    if [ "$BACKEND" = fcron ] || [ "$BACKEND" = cron ]; then :; else BACKEND=cron; fi
    if has "$(crontab_cmd)" && sys "$(crontab_cmd)" -l 2>/dev/null | grep -q " # $NAME\(-retry\)\{0,1\}\$"; then crontab_edit " # $NAME(-retry)?\$"; fi
    rm -f "$AUTOSTART"
    if has systemctl; then systemd_remove "$NAME"; systemd_remove "$NAME-retry"; fi
  fi
  if [ -L "$LINK" ]; then rm -f "$LINK"; fi
  say "removed the schedule, login entry and command link"
  if [ -d "$DIR" ]; then
    if [ "$OPT_YES" = 1 ]; then ans=y
    elif [ -t 0 ]; then printf 'Delete %s (saved pictures, log, config)? [y/N] ' "$DIR"; read -r ans
    else ans=n; fi
    case $ans in
      y|Y|yes) rm -rf "$DIR"; say "deleted $DIR" ;;
      *) say "kept $DIR" ;;
    esac
  fi
}

do_status() {
  local distro sched h m dis retry_at
  if [ "$OS" = macos ]; then distro="macOS $(sw_vers -productVersion 2>/dev/null)"
  else distro=$(kv_get "$ROOT/etc/os-release" PRETTY_NAME | tr -d '"'); fi
  say "$NAME $VERSION"
  say "  system:    ${distro:-$OS}"
  if [ "$OS" = linux ] && [ -z "${XDG_CURRENT_DESKTOP:-}" ]; then
    say "  desktop:   (run from your desktop session to detect)"
  elif [ "$OS" = linux ]; then
    say "  desktop:   ${XDG_CURRENT_DESKTOP} → $(desktop_for "$XDG_CURRENT_DESKTOP" || echo 'not supported')"
  else say "  desktop:   macOS"; fi
  if [ ! -f "$CONFIG" ]; then say "  not installed (run --install)"; return 0; fi
  sched=$(kv_get "$CONFIG" scheduler); h=$(kv_get "$CONFIG" hour); m=$(kv_get "$CONFIG" minute)
  say "  schedule:  daily at $(printf '%02d:%02d' "$((10#$h))" "$((10#$m))") local and at login, via $sched"
  if [ "$sched" = launchd ]; then
    dis=$(sys launchctl print-disabled "gui/$MY_UID" 2>/dev/null | grep -E "\"$NAME\" => (disabled|true)")
    [ -n "$dis" ] && say "  ⚠ switched off in System Settings › General › Login Items: turn $NAME back on"
  fi
  if [ "$(kv_get "$CONFIG" portrait)" = 1 ]; then h="portrait (phone)"; else h=landscape; fi
  say "  picture:   $h from $(kv_get "$CONFIG" url)"
  if [ -f "$STATE" ]; then
    say "  last set:  $(kv_get "$STATE" date) \"$(kv_get "$STATE" title)\" at $(epoch_fmt "$(kv_get "$STATE" set_at)" '%F %H:%M' 2>/dev/null)"
    say "  sha256:    $(kv_get "$STATE" sha256)"
    retry_at=$(kv_get "$STATE" retry_at)
    [ -n "$retry_at" ] && say "  re-run:    pending at $(epoch_fmt "$retry_at" '%F %H:%M')"
  fi
  if [ -f "$LOG" ]; then say "  log ($LOG):"; tail -n 10 "$LOG" | sed 's/^/    /'; fi
}

do_upgrade() {
  local src=${OPT_FROM:-$UPGRADE_URL} tmp new args
  [ -f "$COPY" ] || die 4 "not installed (run --install first)"
  DL=$(downloader) || die 4 "neither curl nor wget is installed"
  tmp="$DIR/.upgrade.$$"
  if ! fetch "$src" "$tmp" || [ "$HTTP" != 200 ]; then rm -f "$tmp"; die 1 "download failed: HTTP $HTTP from $src"; fi
  if ! bash -n "$tmp" 2>/dev/null; then rm -f "$tmp"; die 1 "the download doesn't parse as bash: kept $VERSION"; fi
  new=$(grep -m 1 '^VERSION="' "$tmp" | cut -d'"' -f2)
  printf '%s\n' "$new" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { rm -f "$tmp"; die 1 "the download has no VERSION: kept $VERSION"; }
  if ! ver_gt "$new" "$VERSION"; then rm -f "$tmp"; say "up to date ($VERSION; main has $new)"; return 0; fi
  chmod 755 "$tmp"
  mv "$tmp" "$COPY" || die 4 "can't replace $COPY"
  say "upgraded $VERSION → $new"
  args="--install --url $(kv_get "$CONFIG" url)"
  [ "$(kv_get "$CONFIG" portrait)" = 1 ] && args="$args --portrait"
  [ -n "$(kv_get "$CONFIG" hour)" ] && args="$args --hour $(kv_get "$CONFIG" hour)"
  [ -n "$(kv_get "$CONFIG" scheduler_forced)" ] && args="$args --scheduler $(kv_get "$CONFIG" scheduler_forced)"
  # shellcheck disable=SC2086
  exec bash "$COPY" $args
}

# ---------- main ----------

MODE=schedule
OPT_PORTRAIT=0
OPT_HOUR=
OPT_URL=
OPT_SCHEDULER=
OPT_YES=0
OPT_FROM=
while [ $# -gt 0 ]; do
  case $1 in
    --install) MODE=install ;;
    --uninstall) MODE=uninstall ;;
    --status) MODE=status ;;
    --upgrade) MODE=upgrade ;;
    --now) MODE=now ;;
    --dry-run) MODE=dry-run ;;
    --retry) MODE=retry ;;
    --login) MODE=login ;;
    --portrait) OPT_PORTRAIT=1 ;;
    --hour) OPT_HOUR=${2:-}; shift ;;
    --url) OPT_URL=${2:-}; shift ;;
    --scheduler) OPT_SCHEDULER=${2:-}; shift
      case $OPT_SCHEDULER in cron|systemd) ;; *) say "--scheduler takes cron or systemd"; exit 4 ;; esac ;;
    --from) OPT_FROM=${2:-}; shift ;;
    --yes) OPT_YES=1 ;;
    --version) say "$VERSION"; exit 0 ;;
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) say "unknown option: $1 (see --help)"; exit 4 ;;
  esac
  shift
done

URL=${OPT_URL:-$(kv_get "$CONFIG" url)}
URL=${URL:-$DEFAULT_URL}
case $URL in */) ;; *) URL="$URL/" ;; esac

case $MODE in
  install) do_install ;;
  uninstall) do_uninstall ;;
  status) do_status ;;
  upgrade) do_upgrade ;;
  login)
    if [ ! -t 1 ] && [ -d "$DIR" ]; then exec >> "$LOG" 2>&1; fi
    do_run ;;
  schedule)
    # systemd adds its own RandomizedDelaySec
    if [ -z "$STUBS" ] && [ -z "${INVOCATION_ID:-}" ]; then sleep "$(rand 301)"; fi
    do_run ;;
  *) do_run ;;
esac
