# shellcheck shell=bash disable=SC2034  # CASE_* are read by run.sh
# macOS install, re-run scheduling, upgrade, uninstall (phase 3), with stubs.

PLIST=userhome/Library/LaunchAgents/amazing-sea-wallpaper.plist
COPY_REL=home/amazing-sea-wallpaper.sh

plist_int() { grep -A1 "<key>$2</key>" "$CASE_DIR/$1" | tail -n 1 | tr -dc 0-9; }

case_install_fresh() {
  site_dated pc "$TODAY" valid "Dawn"
  run_script --install
  expect_exit 0
  cmp -s "$SCRIPT" "$CASE_DIR/$COPY_REL" || fail "the copy differs from the script"
  [ -x "$CASE_DIR/$COPY_REL" ] || fail "the copy isn't executable"
  expect_state date "$TODAY"
  expect_contains home/config '^minute=0$'
  expect_contains home/config '^hour=7$'
  expect_contains home/config '^portrait=0$'
  expect_contains home/config '^scheduler=launchd$'
  expect_contains home/config "^url=$SITE_URL\$"
  expect_golden "$PLIST" macos.plist
  expect_stub "^launchctl bootstrap gui/[0-9]+ .*/Library/LaunchAgents/amazing-sea-wallpaper\.plist\$" 1
  [ "$(readlink "$USER_HOME/.local/bin/amazing-sea-wallpaper")" = "$CASE_HOME/amazing-sea-wallpaper.sh" ] || fail "command link"
  expect_output 'daily at 07:00 local'
  expect_stub '^osascript set' 1
}

case_install_options() {
  site_dated phone "$TODAY" valid
  CASE_RANDOM=33
  run_script --install --hour 6 --portrait
  expect_exit 0
  expect_contains home/config '^portrait=1$'
  [ "$(plist_int "$PLIST" Hour)" = 6 ] || fail "plist hour"
  [ "$(plist_int "$PLIST" Minute)" = 33 ] || fail "plist minute"
  expect_requested "/daily/phone/$TODAY\.jpg"
}

case_install_bad_hour() {
  run_script --install --hour 24
  expect_exit 4
  expect_no_file "../$PLIST"
}

case_reinstall_keeps_minute() {
  site_dated pc "$TODAY" valid
  config minute=42 hour=8
  CASE_RANDOM=5
  run_script --install
  expect_contains home/config '^minute=42$'
  expect_contains home/config '^hour=8$'
  [ "$(plist_int "$PLIST" Minute)" = 42 ] || fail "plist minute"
}

case_install_not_out_yet_schedules_retry() {
  site_latest "$YESTERDAY" valid
  run_script --install
  expect_exit 0
  # --now sets the newest and never schedules a re-run; the daily/login runs do that
  expect_state date "$YESTERDAY"
  expect_no_stub 'retry'
}

case_install_no_session() {
  CASE_ENV=AMAZING_SEA_WALLPAPER_STUB_NOSESSION=1
  run_script --install
  expect_exit 3
  expect_no_file "../$PLIST"
}

case_retry_plist_lifecycle() {
  site_latest "$YESTERDAY" valid
  run_script --install
  run_script
  expect_stub 'bootstrap .*-retry\.plist$' 1
  expect_golden userhome/Library/LaunchAgents/amazing-sea-wallpaper-retry.plist macos-retry.plist
  run_script
  expect_stub 'bootstrap .*-retry\.plist$' 1
  run_script --retry
  # one bootout before the bootstrap (agent_load), one by --retry
  expect_stub 'bootout .*-retry\.plist$' 2
  [ ! -e "$USER_HOME/Library/LaunchAgents/amazing-sea-wallpaper-retry.plist" ] || fail "retry plist kept"
  expect_stub 'bootstrap .*-retry\.plist$' 1
}

new_version() {
  # new_version VERSION [BROKEN]: the script with another VERSION on the fixture site as new.sh
  mkdir -p "$SITE"
  sed "s/^VERSION=\"1\.0\.0\"/VERSION=\"$1\"/" "$SCRIPT" > "$SITE/new.sh"
  [ -n "${2:-}" ] && printf 'if then fi\n' >> "$SITE/new.sh"
}

case_upgrade_newer() {
  site_dated pc "$TODAY" valid
  run_script --install --hour 6
  new_version 1.0.1
  : > "$CASE_HOME/stubs.log"
  run_script --upgrade --from "${SITE_URL}new.sh"
  expect_exit 0
  expect_output 'upgraded 1\.0\.0 → 1\.0\.1'
  grep -q '^VERSION="1.0.1"' "$CASE_DIR/$COPY_REL" || fail "copy not replaced"
  expect_stub 'bootstrap .*/amazing-sea-wallpaper\.plist$' 1
  expect_contains home/config '^hour=6$'
  [ "$(plist_int "$PLIST" Hour)" = 6 ] || fail "the re-install lost --hour"
  expect_no_file ".upgrade.*"
}

case_upgrade_same_version() {
  site_dated pc "$TODAY" valid
  run_script --install
  new_version 1.0.0
  run_script --upgrade --from "${SITE_URL}new.sh"
  expect_exit 0
  expect_output 'up to date'
  cmp -s "$SCRIPT" "$CASE_DIR/$COPY_REL" || fail "copy changed"
}

case_upgrade_older_version() {
  site_dated pc "$TODAY" valid
  run_script --install
  new_version 0.9.9
  run_script --upgrade --from "${SITE_URL}new.sh"
  expect_output 'up to date'
}

case_upgrade_broken_download() {
  site_dated pc "$TODAY" valid
  run_script --install
  new_version 1.1.0 broken
  run_script --upgrade --from "${SITE_URL}new.sh"
  expect_exit 1
  expect_output "doesn't parse"
  cmp -s "$SCRIPT" "$CASE_DIR/$COPY_REL" || fail "copy changed"
  # shellcheck disable=SC2012
  [ -z "$(ls -a "$CASE_HOME" | grep '^\.upgrade')" ] || fail "temp file left"
}

case_upgrade_404() {
  site_dated pc "$TODAY" valid
  run_script --install
  run_script --upgrade --from "${SITE_URL}missing.sh"
  expect_exit 1
  expect_output 'HTTP 404'
}

case_upgrade_not_installed() {
  run_script --upgrade --from "${SITE_URL}new.sh"
  expect_exit 4
}

case_uninstall_removes_everything() {
  site_latest "$YESTERDAY" valid
  run_script --install
  run_script      # leaves a retry plist
  [ -e "$USER_HOME/Library/LaunchAgents/amazing-sea-wallpaper-retry.plist" ] || fail "setup: no retry plist"
  : > "$CASE_HOME/stubs.log"
  run_script --uninstall < /dev/null
  expect_stub 'bootout .*/amazing-sea-wallpaper\.plist$' 1
  expect_stub 'bootout .*/amazing-sea-wallpaper-retry\.plist$' 1
  run_script --uninstall --yes
  expect_exit 0
  [ -z "$(ls -A "$USER_HOME/Library/LaunchAgents")" ] || fail "LaunchAgents left: $(ls "$USER_HOME/Library/LaunchAgents")"
  [ ! -e "$USER_HOME/.local/bin/amazing-sea-wallpaper" ] && [ ! -L "$USER_HOME/.local/bin/amazing-sea-wallpaper" ] || fail "link left"
  [ ! -d "$CASE_HOME" ] || fail "folder left"
}

case_uninstall_keeps_folder_without_yes() {
  site_dated pc "$TODAY" valid
  run_script --install
  run_script --uninstall < /dev/null
  expect_output 'kept '
  expect_file state
}

case_status_after_install() {
  site_dated pc "$TODAY" valid "Dawn"
  CASE_RANDOM=9
  run_script --install
  run_script --status
  expect_output 'daily at 07:09 local and at login, via launchd'
  expect_output "last set:  $TODAY \"Dawn\""
}
