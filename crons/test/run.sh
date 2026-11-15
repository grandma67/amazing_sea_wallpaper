#!/usr/bin/env bash
# Test runner for crons/amazing-sea-wallpaper.sh (plan: knowledge/plans/CRON.md, phase 1).
#
#   crons/test/run.sh [--bash PATH] [--script PATH] [--only REGEX] [CASE_FILE...]
#
# Each case file (default: crons/test/cases-*.sh) may set SCRIPT_UNDER_TEST (relative to crons/)
# and defines functions named case_<name>. Each case gets a fresh fixture site, folder, request
# log and stub log; it builds them with the site_*/state_* helpers below, calls run_script, then
# checks with the expect_* helpers. The script under test runs with the test hooks:
#   AMAZING_SEA_WALLPAPER_HOME        the folder (a temp dir per case)
#   AMAZING_SEA_WALLPAPER_TODAY       the UTC date (YYYY-MM-DD)
#   AMAZING_SEA_WALLPAPER_NOW_EPOCH   the clock (seconds, UTC)
#   AMAZING_SEA_WALLPAPER_STUBS=1     setters and schedulers append their command line to
#                                     <home>/stubs.log instead of acting
# and `--url <fixture site>/`. Nothing here touches the real desktop, crontab or LaunchAgents.
#
# Written for bash 3.2 (macOS /bin/bash) as well as bash 5.

set -u

HERE=$(cd "$(dirname "$0")" && pwd)
CRONS=$(dirname "$HERE")
BASH_UNDER_TEST=${BASH_UNDER_TEST:-}
SCRIPT_OVERRIDE=
ONLY=
CASE_FILES=()

while [ $# -gt 0 ]; do
  case $1 in
    --bash) BASH_UNDER_TEST=$2; shift 2 ;;
    --script) SCRIPT_OVERRIDE=$2; shift 2 ;;
    --only) ONLY=$2; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) CASE_FILES+=("$1"); shift ;;
  esac
done
if [ -z "$BASH_UNDER_TEST" ]; then
  if [ -x /bin/bash ]; then BASH_UNDER_TEST=/bin/bash; else BASH_UNDER_TEST=$(command -v bash); fi
fi
if [ ${#CASE_FILES[@]} -eq 0 ]; then
  for f in "$HERE"/cases-*.sh; do CASE_FILES+=("$f"); done
fi
command -v python3 >/dev/null || { echo "run.sh: python3 is needed for the fixture site" >&2; exit 4; }
command -v curl >/dev/null || { echo "run.sh: curl is needed by the runner" >&2; exit 4; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/asw-test.XXXXXX")
SITE=$WORK/site
REQUESTS=$WORK/requests.log
SERVER_PID=
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

mkdir -p "$SITE"
: > "$REQUESTS"
python3 -I "$HERE/server.py" "$SITE" "$WORK/port" "$REQUESTS" 2> "$WORK/server.err" &
SERVER_PID=$!
i=0
while [ ! -s "$WORK/port" ]; do
  i=$((i + 1))
  if [ $i -gt 100 ] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "run.sh: fixture server didn't start:" >&2; cat "$WORK/server.err" >&2; exit 4
  fi
  sleep 0.1
done
SITE_URL="http://127.0.0.1:$(cat "$WORK/port")/"

# ---------- clock ----------

# utc_epoch "YYYY-MM-DD HH:MM" → seconds (python: BSD and GNU date differ)
utc_epoch() {
  python3 -I -c 'import sys,calendar,time; print(calendar.timegm(time.strptime(sys.argv[1], "%Y-%m-%d %H:%M")))' "$1"
}
# day_offset DATE N → DATE + N days
day_offset() {
  python3 -I -c 'import sys,datetime; print(datetime.date.fromisoformat(sys.argv[1]) + datetime.timedelta(days=int(sys.argv[2])))' "$1" "$2"
}
# clock "YYYY-MM-DD HH:MM" (UTC): sets TODAY, YESTERDAY, NOW_EPOCH for the case
clock() {
  TODAY=${1%% *}
  NOW_EPOCH=$(utc_epoch "$1")
  # shellcheck disable=SC2034  # read by the cases
  YESTERDAY=$(day_offset "$TODAY" -1)
}

# ---------- fixture site ----------

# image_bytes KIND → stdout. valid: a real JPEG padded with a comment segment to ~60 KB (passes
# the > 50 KB check); truncated: its first 30 KB; html: a captive-portal page; small: the bare
# 884-byte JPEG.
image_bytes() {
  case $1 in
    valid)
      printf '\377\330\377\376\352\142'
      head -c 60000 /dev/zero
      tail -c +3 "$HERE/tiny.jpg" ;;
    truncated) image_bytes valid | head -c 30000 ;;
    html) printf '<!doctype html><html><body>Sign in to the Wi-Fi</body></html>\n' ;;
    small) cat "$HERE/tiny.jpg" ;;
    *) echo "image_bytes: unknown kind $1" >&2; return 1 ;;
  esac
}

# site_json PATH DATE TITLE: the real latest.json layout (one key per line, 2-space indent)
site_json() {
  mkdir -p "$(dirname "$SITE/$1")"
  printf '{\n  "date": "%s",\n  "seed": "amazing-sea:%s",\n  "title": "%s",\n  "timeOfDay": "midday"\n}\n' \
    "$2" "$2" "$3" > "$SITE/$1"
}
# site_image PATH KIND [CONTENT_TYPE]
site_image() {
  mkdir -p "$(dirname "$SITE/$1")"
  image_bytes "$2" > "$SITE/$1"
  if [ $# -ge 3 ]; then
    printf '%s\n' "$3" > "$SITE/$1.ctype"
  elif [ "$2" = html ]; then
    printf 'text/html\n' > "$SITE/$1.ctype"
  fi
}
# site_dated pc|phone DATE KIND [TITLE]: daily/<pc|phone>/<date>.jpg and .json
site_dated() {
  site_image "daily/$1/$2.jpg" "$3"
  site_json "daily/$1/$2.json" "$2" "${4:-Title $2}"
}
# site_latest DATE KIND [TITLE]: latest.json/.jpg and the portrait pair
site_latest() {
  site_json latest.json "$1" "${3:-Title $1}"
  site_image latest.jpg "$2"
  site_json latest-portrait.json "$1" "${3:-Title $1}"
  site_image latest-portrait.jpg "$2"
}
# site_file PATH CONTENT: any other file (an upgrade's script, …)
site_file() {
  mkdir -p "$(dirname "$SITE/$1")"
  printf '%s' "$2" > "$SITE/$1"
}

# ---------- the folder ----------

# state KEY=VALUE…: writes the state file
state() {
  : > "$CASE_HOME/state"
  for kv in "$@"; do printf '%s\n' "$kv" >> "$CASE_HOME/state"; done
}
# config KEY=VALUE…: writes the config file
config() {
  : > "$CASE_HOME/config"
  for kv in "$@"; do printf '%s\n' "$kv" >> "$CASE_HOME/config"; done
}
# hold_lock [AGE_S [PID]]: a lock taken AGE_S ago (default 0) by PID (default: a live one, ours)
hold_lock() {
  mkdir -p "$CASE_HOME/lock"
  printf '%s\n' "${2:-$$}" > "$CASE_HOME/lock/pid"
  if [ "${1:-0}" -gt 0 ]; then
    touch -t "$(python3 -I -c 'import sys,time; print(time.strftime("%Y%m%d%H%M.%S", time.localtime(time.time()-int(sys.argv[1]))))' "$1")" "$CASE_HOME/lock"
  fi
}
# state_get KEY → value from the state file (empty when absent)
state_get() {
  [ -f "$CASE_HOME/state" ] || return 0
  grep "^$1=" "$CASE_HOME/state" | head -n 1 | cut -d= -f2-
}

# ---------- running ----------

# run_script ARGS…: runs the script under test with the hooks; sets EXIT and OUT (its output file)
run_script() {
  OUT=$CASE_DIR/out.log
  env AMAZING_SEA_WALLPAPER_HOME="$CASE_HOME" \
      AMAZING_SEA_WALLPAPER_TODAY="$TODAY" \
      AMAZING_SEA_WALLPAPER_NOW_EPOCH="$NOW_EPOCH" \
      AMAZING_SEA_WALLPAPER_STUBS=1 \
      ${CASE_ENV:+$CASE_ENV} \
      "$BASH_UNDER_TEST" "$SCRIPT" --url "$SITE_URL" "$@" > "$OUT" 2>&1
  EXIT=$?
  RUNS=$((RUNS + 1))
}

# ---------- checks ----------

fail() { FAILS="$FAILS
    - $*"; }

expect_exit() { [ "$EXIT" = "$1" ] || fail "exit $EXIT, expected $1"; }
expect_state() {
  local got; got=$(state_get "$1")
  [ "$got" = "$2" ] || fail "state $1='$got', expected '$2'"
}
expect_no_state() { [ ! -s "$CASE_HOME/state" ] || fail "state written: $(tr '\n' ' ' < "$CASE_HOME/state")"; }
# expect_requested REGEX / expect_not_requested REGEX: the fixture site's request log ("GET /path")
expect_requested() { grep -Eq "$1" "$REQUESTS" || fail "no request matching /$1/ (got: $(tr '\n' ' ' < "$REQUESTS"))"; }
expect_not_requested() { ! grep -Eq "$1" "$REQUESTS" || fail "unexpected request /$1/: $(grep -E "$1" "$REQUESTS" | tr '\n' ' ')"; }
expect_requests() {
  local n; n=$(wc -l < "$REQUESTS" | tr -d ' ')
  [ "$n" = "$1" ] || fail "$n requests, expected $1 (got: $(tr '\n' ' ' < "$REQUESTS"))"
}
# expect_stub REGEX [COUNT] / expect_no_stub REGEX: <home>/stubs.log
expect_stub() {
  local n=0
  [ -f "$CASE_HOME/stubs.log" ] && n=$(grep -Ec "$1" "$CASE_HOME/stubs.log")
  if [ $# -ge 2 ]; then
    [ "$n" = "$2" ] || fail "stub /$1/ $n times, expected $2"
  else
    [ "$n" -gt 0 ] || fail "no stub call matching /$1/"
  fi
}
expect_no_stub() { expect_stub "$1" 0; }
expect_file() { [ -e "$CASE_HOME/$1" ] || fail "missing $1"; }
expect_no_file() { [ ! -e "$CASE_HOME/$1" ] || fail "unexpected $1"; }
expect_output() { grep -Eq "$1" "$OUT" || fail "output lacks /$1/"; }

# ---------- cases ----------

PASS=0
FAILED=0
FAILED_NAMES=
RUNS=0
CASE_N=0
for file in "${CASE_FILES[@]}"; do
  SCRIPT_UNDER_TEST=amazing-sea-wallpaper.sh
  for f in $(declare -F | awk '{print $3}' | grep '^case_'); do unset -f "$f"; done
  # shellcheck source=/dev/null
  . "$file"
  if [ -n "$SCRIPT_OVERRIDE" ]; then SCRIPT=$SCRIPT_OVERRIDE; else SCRIPT=$CRONS/$SCRIPT_UNDER_TEST; fi
  if [ ! -f "$SCRIPT" ]; then
    echo "SKIP $(basename "$file"): no $SCRIPT"
    continue
  fi
  group=$(basename "$file" .sh); group=${group#cases-}
  for name in $(declare -F | awk '{print $3}' | grep '^case_'); do
    short=${name#case_}
    if [ -n "$ONLY" ] && ! printf '%s\n' "$short" | grep -Eq "$ONLY"; then continue; fi
    CASE_N=$((CASE_N + 1))
    CASE_DIR=$WORK/case$CASE_N
    CASE_HOME=$CASE_DIR/home
    mkdir -p "$CASE_HOME"
    rm -rf "$SITE"; mkdir -p "$SITE"
    : > "$REQUESTS"
    FAILS=
    CASE_ENV=
    EXIT=
    OUT=$CASE_DIR/out.log; : > "$OUT"
    clock "2026-11-14 06:30"
    "$name"
    if [ -z "$FAILS" ]; then
      PASS=$((PASS + 1)); echo "ok   $group/$short"
    else
      FAILED=$((FAILED + 1)); FAILED_NAMES="$FAILED_NAMES $short"
      echo "FAIL $group/$short$FAILS"
      if [ -s "$OUT" ]; then echo "    output:"; sed 's/^/      /' "$OUT" | tail -n 20; fi
    fi
  done
done

echo
# shellcheck disable=SC2016  # $BASH_VERSION of the bash under test
echo "$PASS passed, $FAILED failed ($("$BASH_UNDER_TEST" -c 'echo "bash $BASH_VERSION"'), $RUNS runs)"
[ "$FAILED" -eq 0 ]
