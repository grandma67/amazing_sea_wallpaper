# shellcheck shell=bash disable=SC2034  # read by run.sh
# amazing-sea-wallpaper.ps1 (phase 7) under pwsh, with stubs: the run's fetch and state cases,
# -DryRun, install, uninstall, upgrade. Task Scheduler and SystemParametersInfo are stubbed.
SCRIPT_UNDER_TEST=amazing-sea-wallpaper.ps1

case_ps1_today_dated_is_set() {
  site_dated pc "$TODAY" valid "Dawn · rocky shore"
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_state date "$TODAY"
  expect_state title "Dawn · rocky shore"
  expect_requests 2
  expect_not_requested latest
  expect_stub "^set-wallpaper $CASE_HOME/wallpapers/$TODAY\.jpg\$" 1
  [ "$(state_get sha256)" = "$(shasum -a 256 "$CASE_HOME/wallpapers/$TODAY.jpg" | cut -d' ' -f1)" ] || fail sha256
}

case_ps1_dated_404_schedules_one_retry() {
  site_latest "$YESTERDAY" valid
  config scheduler=taskscheduler
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_requests 1
  expect_stub "^register-task amazing-sea-wallpaper-retry once $TODAY 09:30 until \+6h\$" 1
  expect_state retry_day "$TODAY"
  expect_state retry_at "$(utc_epoch "$TODAY 09:30")"
  run_script -Login
  expect_stub '^register-task amazing-sea-wallpaper-retry' 1
}

case_ps1_retry_floor() {
  clock "2026-11-14 04:30"
  CASE_TZ=Europe/Moscow
  config scheduler=taskscheduler
  state "date=$YESTERDAY"
  run_script
  expect_stub "^register-task amazing-sea-wallpaper-retry once $TODAY 11:00 " 1
}

case_ps1_catch_up() {
  site_latest "$YESTERDAY" valid "Dusk"
  config scheduler=taskscheduler
  state "date=2026-11-10"
  run_script
  expect_state date "$YESTERDAY"
  expect_state title Dusk
  expect_requested "^GET /latest\.jpg\?d=$YESTERDAY\$"
  expect_stub '^register-task amazing-sea-wallpaper-retry' 1
}

case_ps1_retry_never_schedules_another() {
  site_latest "$YESTERDAY" valid
  config scheduler=taskscheduler
  state "date=$YESTERDAY" "retry_day=$TODAY" "retry_at=$NOW_EPOCH"
  run_script -Retry
  expect_exit 0
  expect_stub '^unregister-task amazing-sea-wallpaper-retry$' 1
  expect_no_stub '^register-task'
  expect_state retry_at ''
}

case_ps1_render_failure_day() {
  config scheduler=taskscheduler
  state "date=2026-11-10" "title=old"
  run_script
  expect_exit 1
  expect_state date 2026-11-10
  expect_state title old
  expect_no_stub set-wallpaper
}

case_ps1_html_and_truncated() {
  site_dated pc "$TODAY" html
  state "date=$YESTERDAY"
  run_script
  expect_exit 1
  expect_output 'Content-Type text/html'
  site_dated pc "$TODAY" truncated
  rm -f "$SITE/daily/pc/$TODAY.jpg.ctype"
  run_script
  expect_exit 1
  expect_output 'only 30000 bytes'
  expect_state date "$YESTERDAY"
}

case_ps1_same_day_no_request() {
  site_dated pc "$TODAY" valid
  state "date=$TODAY"
  run_script
  expect_exit 0
  expect_requests 0
}

case_ps1_lock_held() {
  site_dated pc "$TODAY" valid
  hold_lock 0
  run_script
  expect_exit 0
  expect_requests 0
}

case_ps1_portrait() {
  site_dated phone "$TODAY" valid
  config portrait=1
  run_script
  expect_requested "^GET /daily/phone/$TODAY\.jpg\$"
  expect_state date "$TODAY"
}

case_ps1_dry_run_changes_nothing() {
  site_dated pc "$TODAY" valid "Noon"
  run_script -DryRun
  expect_exit 0
  expect_output "would set $TODAY \"Noon\""
  expect_no_stub .
  expect_no_state
}

case_ps1_no_session() {
  CASE_ENV=AMAZING_SEA_WALLPAPER_STUB_NOSESSION=1
  run_script
  expect_exit 3
  expect_stub '^sleep 10$' 12
}

case_ps1_prune() {
  site_dated pc "$TODAY" valid
  mkdir -p "$CASE_HOME/wallpapers"
  for d in 01 02 03 04 05 06 07 08 09; do : > "$CASE_HOME/wallpapers/2026-11-$d.jpg"; done
  run_script
  n=0; for f in "$CASE_HOME"/wallpapers/*.jpg; do n=$((n + 1)); done
  [ "$n" = 7 ] || fail "$n kept"
}

case_ps1_install() {
  site_dated pc "$TODAY" valid
  CASE_RANDOM=12
  run_script -Install -Hour 6
  expect_exit 0
  cmp -s "$SCRIPT" "$CASE_HOME/amazing-sea-wallpaper.ps1" || fail "copy differs"
  expect_contains home/config '^minute=12$'
  expect_contains home/config '^hour=6$'
  expect_stub '^register-task amazing-sea-wallpaper daily 06:12 random 5m, at logon$' 1
  expect_state date "$TODAY"
  expect_no_stub retry
}

case_ps1_uninstall() {
  site_dated pc "$TODAY" valid
  run_script -Install
  : > "$CASE_HOME/stubs.log"
  run_script -Uninstall
  expect_output 'kept '
  expect_stub '^unregister-task amazing-sea-wallpaper$' 1
  expect_stub '^unregister-task amazing-sea-wallpaper-retry$' 1
  expect_stub '^remove-task-folder$' 1
  run_script -Uninstall -Yes
  [ ! -d "$CASE_HOME" ] || fail "folder left"
}

ps1_new_version() {
  mkdir -p "$SITE"
  sed "s/^\$Version = '1\.0\.0'/\$Version = '$1'/" "$SCRIPT" > "$SITE/new.ps1"
  [ -n "${2:-}" ] && printf 'function {\n' >> "$SITE/new.ps1"
}

case_ps1_upgrade() {
  site_dated pc "$TODAY" valid
  run_script -Install -Hour 6
  ps1_new_version 1.0.1
  : > "$CASE_HOME/stubs.log"
  run_script -Upgrade -From "${SITE_URL}new.ps1"
  expect_exit 0
  expect_output 'upgraded 1\.0\.0 -> 1\.0\.1'
  grep -q "^\$Version = '1.0.1'" "$CASE_HOME/amazing-sea-wallpaper.ps1" || fail "copy not replaced"
  expect_stub '^register-task amazing-sea-wallpaper daily 06:' 1
}

case_ps1_upgrade_same_and_broken() {
  site_dated pc "$TODAY" valid
  run_script -Install
  ps1_new_version 1.0.0
  run_script -Upgrade -From "${SITE_URL}new.ps1"
  expect_output 'up to date'
  ps1_new_version 1.2.0 broken
  run_script -Upgrade -From "${SITE_URL}new.ps1"
  expect_exit 1
  expect_output "doesn't parse"
  cmp -s "$SCRIPT" "$CASE_HOME/amazing-sea-wallpaper.ps1" || fail "copy changed"
}

case_ps1_status() {
  config minute=7 hour=7 portrait=0 url=https://example.invalid/ scheduler=taskscheduler
  state "date=$TODAY" "title=Dawn" "sha256=abc" "set_at=$NOW_EPOCH"
  run_script -Status
  expect_exit 0
  expect_requests 0
  expect_output 'daily at 07:07 local and at logon'
  expect_output "last set:  $TODAY \"Dawn\""
}
