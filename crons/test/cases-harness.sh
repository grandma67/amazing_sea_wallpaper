# Self-tests of the runner (phase 1): the fixture site, the hooks, every expect_* helper.
# They run against test/stub-script.sh, not the real script.
# shellcheck shell=bash disable=SC2034  # read by run.sh
SCRIPT_UNDER_TEST=test/stub-script.sh

case_dated_valid_is_set() {
  site_dated pc "$TODAY" valid
  state "date=$YESTERDAY"
  run_script
  expect_exit 0
  expect_state date "$TODAY"
  expect_state set_at "$NOW_EPOCH"
  expect_requested "^GET /daily/pc/$TODAY\.jpg\$"
  expect_not_requested 'latest\.json'
  expect_requests 1
  expect_stub "^set .*/wallpapers/$TODAY\.jpg\$" 1
  expect_no_stub retry
  expect_file "wallpapers/$TODAY.jpg"
  expect_output "set $TODAY"
}

case_dated_missing_is_404() {
  site_latest "$YESTERDAY" valid
  state "date=$YESTERDAY"
  run_script
  expect_exit 1
  expect_state date "$YESTERDAY"
  expect_stub '^schedule retry$' 1
  expect_output '^not set: 404 '
}

case_html_served_as_image() {
  site_dated pc "$TODAY" html
  run_script
  expect_exit 1
  expect_no_state
  expect_output 'text/html'
}

case_truncated_image() {
  site_dated pc "$TODAY" truncated
  run_script
  expect_exit 1
  expect_output ', magic ffd8, 30000 bytes'
}

case_wrong_content_type() {
  site_image "daily/pc/$TODAY.jpg" valid application/octet-stream
  run_script
  expect_exit 1
  expect_output '200 application/octet-stream'
}

case_same_day_makes_no_request() {
  site_dated pc "$TODAY" valid
  state "date=$TODAY"
  run_script
  expect_exit 0
  expect_requests 0
  expect_no_stub .
}

case_lock_held() {
  site_dated pc "$TODAY" valid
  hold_lock 700
  run_script
  expect_exit 0
  expect_requests 0
  expect_output locked
}

case_clock_moves() {
  clock "2027-01-01 00:10"
  [ "$TODAY" = 2027-01-01 ] || fail "TODAY=$TODAY"
  [ "$YESTERDAY" = 2026-12-31 ] || fail "YESTERDAY=$YESTERDAY"
  [ "$NOW_EPOCH" = 1798762200 ] || fail "NOW_EPOCH=$NOW_EPOCH"
  site_dated pc 2027-01-01 valid
  run_script
  expect_state date 2027-01-01
}

case_fixture_files() {
  site_latest "$TODAY" valid "Dawn · rocky shore"
  local body
  body=$(curl -s "${SITE_URL}latest.json")
  printf '%s\n' "$body" | grep -q "^  \"date\": \"$TODAY\",\$" || fail "latest.json layout: $body"
  printf '%s\n' "$body" | grep -q '"title": "Dawn · rocky shore"' || fail "title not UTF-8 as given"
  local n; n=$(curl -s "${SITE_URL}latest.jpg" | wc -c | tr -d ' ')
  [ "$n" -gt 51200 ] || fail "valid image only $n bytes"
  [ "$(curl -s -o /dev/null -w '%{content_type}' "${SITE_URL}latest.jpg?d=$TODAY")" = image/jpeg ] || fail "query string breaks serving"
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}../etc/passwd")" = 404 ] || fail "path escape"
  [ "$(image_bytes valid | tail -c 2 | od -An -tx1 | tr -d ' \n')" = ffd9 ] || fail "valid image lacks EOI"
  if command -v sips >/dev/null; then
    image_bytes valid > "$CASE_DIR/v.jpg"
    sips -g pixelWidth "$CASE_DIR/v.jpg" 2>/dev/null | grep -q 'pixelWidth: 16' || fail "padded JPEG doesn't decode"
  fi
}
