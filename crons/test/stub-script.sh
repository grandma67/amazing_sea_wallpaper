#!/usr/bin/env bash
# A stand-in for amazing-sea-wallpaper.sh that only exercises the test harness (cases/harness.sh):
# it honours the test hooks, fetches today's dated image from --url, checks it, writes the state
# and logs a stub "set" or "schedule retry". Not the real logic (CRON.md §4.3).
set -u
URL=
while [ $# -gt 0 ]; do
  case $1 in
    --url) URL=$2; shift 2 ;;
    *) shift ;;
  esac
done
HOME_DIR=${AMAZING_SEA_WALLPAPER_HOME:?}
TODAY=${AMAZING_SEA_WALLPAPER_TODAY:?}
: "${AMAZING_SEA_WALLPAPER_NOW_EPOCH:?}"
[ "${AMAZING_SEA_WALLPAPER_STUBS:-}" = 1 ] || { echo "stub script: hooks only" >&2; exit 4; }
stub() { printf '%s\n' "$*" >> "$HOME_DIR/stubs.log"; }

if [ -d "$HOME_DIR/lock" ]; then echo "locked"; exit 0; fi
if [ -f "$HOME_DIR/state" ] && grep -q "^date=$TODAY\$" "$HOME_DIR/state"; then echo "up to date"; exit 0; fi

mkdir -p "$HOME_DIR/wallpapers"
tmp=$HOME_DIR/wallpapers/.part
ctype=$(curl -s -o "$tmp" -w '%{http_code} %{content_type}' "${URL}daily/pc/$TODAY.jpg")
magic=$(head -c 2 "$tmp" | od -An -tx1 | tr -d ' \n')
size=$(wc -c < "$tmp" | tr -d ' ')
if [ "${ctype%% *}" = 200 ] && [ "${ctype#* }" = image/jpeg ] && [ "$magic" = ffd8 ] && [ "$size" -gt 51200 ]; then
  mv "$tmp" "$HOME_DIR/wallpapers/$TODAY.jpg"
  stub "set $HOME_DIR/wallpapers/$TODAY.jpg"
  printf 'date=%s\nset_at=%s\n' "$TODAY" "$AMAZING_SEA_WALLPAPER_NOW_EPOCH" > "$HOME_DIR/state"
  echo "set $TODAY"
  exit 0
fi
rm -f "$tmp"
stub "schedule retry"
echo "not set: $ctype, magic $magic, $size bytes"
exit 1
