# shellcheck shell=bash disable=SC2034  # CASE_* are read by run.sh
# The daily run (CRON.md §4.3) on macOS with stubs (phase 2). The default clock is
# 2026-11-14 06:30 UTC, TZ=UTC, random draws 0.

RETRY_PLIST=userhome/Library/LaunchAgents/amazing-sea-wallpaper-retry.plist

case_today_dated_is_set() {
  site_dated pc "$TODAY" valid "Dawn · rocky shore"
  site_latest "$YESTERDAY" valid
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_state date "$TODAY"
  expect_state title "Dawn · rocky shore"
  expect_state set_at "$NOW_EPOCH"
  expect_requested "^GET /daily/pc/$TODAY\.jpg\$"
  expect_requested "^GET /daily/pc/$TODAY\.json\$"
  expect_not_requested 'latest'
  expect_requests 2
  expect_stub "^osascript set $CASE_HOME/wallpapers/$TODAY\.jpg\$" 1
  expect_no_stub 'retry'
  expect_file "wallpapers/$TODAY.jpg"
  [ "$(state_get sha256)" = "$(shasum -a 256 "$CASE_HOME/wallpapers/$TODAY.jpg" | cut -d' ' -f1)" ] || fail "sha256 doesn't match the file"
}

case_dated_404_yesterday_set_schedules_one_retry() {
  site_latest "$YESTERDAY" valid
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_state date "$YESTERDAY"
  expect_requests 1
  expect_no_stub '^osascript set'
  expect_stub "bootstrap gui/[0-9]+ .*amazing-sea-wallpaper-retry\.plist\$" 1
  expect_state retry_day "$TODAY"
  # 06:30 UTC + 3 h = 09:30, later than 08:00 UTC
  expect_state retry_at "$(utc_epoch "$TODAY 09:30")"
  expect_contains "$RETRY_PLIST" '<string>--retry</string>'
  expect_contains "$RETRY_PLIST" '<key>Hour</key>'
  [ "$(grep -A1 '<key>Hour</key>' "$CASE_DIR/$RETRY_PLIST" | tail -n 1 | tr -dc 0-9)" = 9 ] || fail "retry hour"
  [ "$(grep -A1 '<key>Minute</key>' "$CASE_DIR/$RETRY_PLIST" | tail -n 1 | tr -dc 0-9)" = 30 ] || fail "retry minute"
  expect_lacks "$RETRY_PLIST" RunAtLoad
}

case_second_run_same_day_makes_no_second_retry() {
  state "date=$YESTERDAY" "retry_day=$TODAY" "retry_at=$(utc_epoch "$TODAY 09:30")"
  run_script --login
  expect_exit 0
  expect_requests 1
  expect_no_stub bootstrap
}

case_retry_floor_is_0800_utc() {
  # UTC+3: 07:30 local is 04:30 UTC; now + 3 h = 07:30 UTC is before the 08:00 UTC floor
  clock "2026-11-14 04:30"
  CASE_TZ=Europe/Moscow
  state "date=$YESTERDAY"
  run_script
  expect_state retry_at "$(utc_epoch "$TODAY 08:00")"
  [ "$(grep -A1 '<key>Hour</key>' "$CASE_DIR/$RETRY_PLIST" | tail -n 1 | tr -dc 0-9)" = 11 ] || fail "retry hour isn't 11 local"
}

case_retry_random_spread() {
  CASE_RANDOM=1500
  state "date=$YESTERDAY"
  run_script
  expect_state retry_at "$(($(utc_epoch "$TODAY 09:30") + 1500))"
}

case_dated_404_older_state_catches_up() {
  site_latest "$YESTERDAY" valid "Dusk · cliff top"
  state "date=2026-11-10"
  run_script
  expect_exit 0
  expect_state date "$YESTERDAY"
  expect_state title "Dusk · cliff top"
  expect_requested '^GET /latest\.json$'
  expect_requested "^GET /latest\.jpg\?d=$YESTERDAY\$"
  expect_stub "^osascript set .*/$YESTERDAY\.jpg\$" 1
  expect_stub 'bootstrap .*-retry\.plist$' 1
}

case_new_install_catches_up() {
  site_latest "$YESTERDAY" valid
  run_script
  expect_exit 0
  expect_state date "$YESTERDAY"
  expect_stub 'bootstrap .*-retry\.plist$' 1
}

case_retry_never_schedules_another() {
  site_latest "$YESTERDAY" valid
  state "date=$YESTERDAY" "retry_day=$TODAY" "retry_at=$NOW_EPOCH"
  mkdir -p "$USER_HOME/Library/LaunchAgents"; : > "$CASE_DIR/$RETRY_PLIST"
  run_script --retry
  expect_exit 0
  expect_no_stub bootstrap
  expect_stub 'bootout .*-retry\.plist$' 1
  expect_no_file "../$RETRY_PLIST"
  [ ! -e "$CASE_DIR/$RETRY_PLIST" ] || fail "retry plist kept"
  expect_state retry_at ''
  expect_requested '^GET /latest\.json$'
}

case_retry_gets_today_from_latest() {
  # the dated path gone: the re-run's latest check still gets today's picture
  site_latest "$TODAY" valid
  state "date=$YESTERDAY" "retry_day=$TODAY"
  run_script --retry
  expect_exit 0
  expect_state date "$TODAY"
}

case_render_failure_day() {
  state "date=2026-11-10" "title=old"
  run_script
  expect_exit 1
  expect_state date 2026-11-10
  expect_state title old
  expect_no_stub '^osascript set'
  expect_stub 'bootstrap .*-retry\.plist$' 1
}

case_bad_image_kept_state() {
  site_dated pc "$TODAY" truncated
  state "date=$YESTERDAY"
  run_script
  expect_exit 1
  expect_state date "$YESTERDAY"
  expect_no_stub '^osascript set'
  expect_output 'only 30000 bytes'
  expect_no_file "wallpapers/$TODAY.jpg"
}

case_html_portal_kept_state() {
  site_dated pc "$TODAY" html
  state "date=$YESTERDAY"
  run_script
  expect_exit 1
  expect_state date "$YESTERDAY"
  expect_output 'Content-Type text/html'
  expect_not_requested latest
}

case_same_day_second_run_no_request() {
  site_dated pc "$TODAY" valid
  state "date=$TODAY"
  run_script
  expect_exit 0
  expect_requests 0
  expect_no_stub .
}

case_lock_held() {
  site_dated pc "$TODAY" valid
  hold_lock 0
  run_script
  expect_exit 0
  expect_requests 0
  expect_output 'holds the lock'
}

case_stale_lock_is_taken() {
  site_dated pc "$TODAY" valid
  hold_lock 700
  run_script
  expect_exit 0
  expect_state date "$TODAY"
  expect_no_file lock
}

case_dead_pid_lock_is_taken() {
  site_dated pc "$TODAY" valid
  hold_lock 0 999999
  run_script
  expect_state date "$TODAY"
}

case_portrait() {
  site_dated phone "$TODAY" valid
  config portrait=1
  state "date=$YESTERDAY"
  run_script
  expect_state date "$TODAY"
  expect_requested "^GET /daily/phone/$TODAY\.jpg\$"
  expect_not_requested '/daily/pc/'
}

case_portrait_catch_up() {
  site_latest "$YESTERDAY" valid
  config portrait=1
  run_script
  expect_requested '^GET /latest-portrait\.json$'
  expect_requested "^GET /latest-portrait\.jpg\?d=$YESTERDAY\$"
}

case_title_missing_still_sets() {
  site_image "daily/pc/$TODAY.jpg" valid
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_state date "$TODAY"
  expect_state title ''
}

case_now_ignores_state() {
  site_dated pc "$TODAY" valid
  state "date=$TODAY"
  run_script --now
  expect_exit 0
  expect_stub '^osascript set' 1
}

case_now_falls_back_to_latest_and_no_retry() {
  site_latest "$YESTERDAY" valid
  state "date=$YESTERDAY"
  run_script --now
  expect_exit 0
  expect_stub "^osascript set .*/$YESTERDAY\.jpg\$" 1
  expect_no_stub bootstrap
}

case_dry_run_changes_nothing() {
  site_dated pc "$TODAY" valid "Noon · reef"
  run_script --dry-run
  expect_exit 0
  expect_output "would set $TODAY \"Noon · reef\" \(6[0-9]{4} bytes\)"
  expect_no_stub .
  expect_no_state
  expect_no_file wallpapers
  expect_no_file lock
}

case_dry_run_not_out_yet() {
  site_latest "$YESTERDAY" valid
  run_script --dry-run
  expect_output "would set $YESTERDAY"
  expect_output 'would schedule a re-run'
  expect_no_stub .
}

case_no_session_waits_then_exit_3() {
  CASE_ENV=AMAZING_SEA_WALLPAPER_STUB_NOSESSION=1
  state "date=$YESTERDAY"
  run_script
  expect_exit 3
  expect_stub '^sleep 10$' 12
  expect_requests 0
}

case_no_session_now_doesnt_wait() {
  CASE_ENV=AMAZING_SEA_WALLPAPER_STUB_NOSESSION=1
  run_script --now
  expect_exit 3
  expect_no_stub sleep
}

case_missed_retry_is_cancelled() {
  # a re-run from yesterday that never fired (asleep): dropped, so it doesn't fire later
  site_dated pc "$TODAY" valid
  state "date=$YESTERDAY" "retry_day=$YESTERDAY" "retry_at=$((NOW_EPOCH - 86400))"
  mkdir -p "$USER_HOME/Library/LaunchAgents"; : > "$CASE_DIR/$RETRY_PLIST"
  run_script
  expect_state retry_at ''
  [ ! -e "$CASE_DIR/$RETRY_PLIST" ] || fail "retry plist kept"
}

case_set_cancels_pending_retry() {
  site_dated pc "$TODAY" valid
  state "date=$YESTERDAY" "retry_day=$TODAY" "retry_at=$((NOW_EPOCH + 3600))"
  mkdir -p "$USER_HOME/Library/LaunchAgents"; : > "$CASE_DIR/$RETRY_PLIST"
  run_script --login
  expect_state date "$TODAY"
  expect_state retry_at ''
  [ ! -e "$CASE_DIR/$RETRY_PLIST" ] || fail "retry plist kept"
}

case_prune_keeps_seven_and_the_current() {
  site_dated pc "$TODAY" valid
  mkdir -p "$CASE_HOME/wallpapers"
  for d in 01 02 03 04 05 06 07 08 09; do : > "$CASE_HOME/wallpapers/2026-11-$d.jpg"; done
  : > "$CASE_HOME/wallpapers/notes.txt"
  state "date=2026-11-09"
  run_script
  n=0; for f in "$CASE_HOME"/wallpapers/*.jpg; do n=$((n + 1)); done
  [ "$n" = 7 ] || fail "$n pictures kept, expected 7"
  expect_file "wallpapers/$TODAY.jpg"
  expect_file wallpapers/notes.txt
  expect_no_file wallpapers/2026-11-03.jpg
  expect_file wallpapers/2026-11-04.jpg
}

case_prune_never_removes_the_set_file() {
  # catch-up to an older day than seven saved files: that file stays
  site_latest 2026-11-01 valid
  mkdir -p "$CASE_HOME/wallpapers"
  for d in 05 06 07 08 09 10 11 12; do : > "$CASE_HOME/wallpapers/2026-11-$d.jpg"; done
  state "date=2026-10-30"
  run_script
  expect_state date 2026-11-01
  expect_file wallpapers/2026-11-01.jpg
}

case_utc_east_uses_the_utc_date() {
  # Tokyo 07:30 on the 15th is 22:30 UTC on the 14th: today's UTC image is out
  clock "2026-11-14 22:30"
  CASE_TZ=Asia/Tokyo
  site_dated pc 2026-11-14 valid
  state "date=2026-11-13"
  run_script
  expect_state date 2026-11-14
  expect_no_stub bootstrap
}

case_latest_json_without_date() {
  site_file latest.json '{ "title": "x" }'
  state "date=2026-11-10"
  run_script
  expect_exit 1
  expect_output 'latest.json has no date'
}

case_status_offline() {
  config minute=7 hour=7 portrait=0 url=https://example.invalid/ scheduler=launchd
  state "date=$TODAY" "title=Dawn" "sha256=abc" "set_at=$NOW_EPOCH"
  printf 'line %s\n' 1 2 3 4 5 6 7 8 9 10 11 12 > "$CASE_HOME/amazing-sea-wallpaper.log"
  run_script --status
  expect_exit 0
  expect_requests 0
  expect_output '^amazing-sea-wallpaper 1\.0\.0$'
  expect_output 'daily at 07:07 local'
  expect_output "last set:  $TODAY \"Dawn\""
  expect_output '    line 12'
  expect_no_output '    line 2$'
}

case_status_login_items_off() {
  config minute=7 hour=7 scheduler=launchd
  mkdir -p "$CASE_HOME/stub"
  printf '\t"amazing-sea-wallpaper" => disabled\n' > "$CASE_HOME/stub/launchctl-disabled"
  run_script --status
  expect_output 'switched off in System Settings'
}
