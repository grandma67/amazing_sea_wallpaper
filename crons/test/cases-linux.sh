# shellcheck shell=bash disable=SC2034,SC2016  # CASE_* are read by run.sh; fakes are literal
# Linux: session and desktop detection (phase 4), setters (phase 5), scheduling and tools
# (phase 6). A fake tree stands in for /proc, /etc/os-release and /usr/share
# (AMAZING_SEA_WALLPAPER_ROOT), with fake pgrep and loginctl on PATH.

# linux_case [OS_ID]: Linux mode, a fake root, fake pgrep/loginctl, a distro
linux_case() {
  CASE_OS=linux
  LROOT=$CASE_DIR/root
  mkdir -p "$LROOT/proc" "$LROOT/etc" "$LROOT/run/user/$(id -u)"
  : > "$LROOT/pgrep.txt"
  printf 'ID=%s\nPRETTY_NAME="%s test"\n' "${1:-ubuntu}" "${1:-ubuntu}" > "$LROOT/etc/os-release"
  CASE_ENV="AMAZING_SEA_WALLPAPER_ROOT=$LROOT"
  # pgrep [-u UID] [-x NAME]: from root/pgrep.txt ("comm pid" lines). With root/appear-after N,
  # the first N name lookups find nothing (a session that starts late).
  fake_cmd pgrep 'R=$AMAZING_SEA_WALLPAPER_ROOT; name=
while [ $# -gt 0 ]; do case $1 in -x) name=$2; shift ;; -u) shift ;; esac; shift; done
if [ -n "$name" ] && [ -f "$R/appear-after" ]; then
  n=$(cat "$R/calls" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$R/calls"
  [ $n -le "$(cat "$R/appear-after")" ] && exit 1
fi
if [ -n "$name" ]; then awk -v n="$name" '"'"'$1 == n {print $2; f = 1} END {exit !f}'"'"' "$R/pgrep.txt"
else awk '"'"'{print $2}'"'"' "$R/pgrep.txt"; fi'
  # loginctl: sessions from root/session-type (x11, wayland, tty; absent = none)
  fake_cmd loginctl 'R=$AMAZING_SEA_WALLPAPER_ROOT
case $1 in
  list-sessions) [ -f "$R/session-type" ] && echo "2 $(id -u) user seat0 tty2" ;;
  show-session) cat "$R/session-type" ;;
esac; exit 0'
}

# session COMM PID XDG_CURRENT_DESKTOP: a session process with its environ
session() {
  mkdir -p "$LROOT/proc/$2"
  printf 'XDG_CURRENT_DESKTOP=%s\000DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus\000DISPLAY=:0\000XDG_RUNTIME_DIR=/run/user/1000\000' "$3" > "$LROOT/proc/$2/environ"
  printf '%s %s\n' "$1" "$2" >> "$LROOT/pgrep.txt"
}

WALLPAPER_URI() { printf "'file://%s/wallpapers/%s.jpg'" "$CASE_HOME" "$TODAY"; }

# ---------- phase 4: detection ----------

detect_row() {
  # detect_row COMM XDG EXPECTED_SETTER_REGEX
  linux_case
  site_dated pc "$TODAY" valid
  session "$1" 4242 "$2"
  run_script --now
  expect_exit 0
  expect_stub "$3"
  expect_state date "$TODAY"
}
case_detect_ubuntu_gnome() { detect_row gnome-shell ubuntu:GNOME 'org\.gnome\.desktop\.background picture-uri '; }
case_detect_zorin() { detect_row gnome-shell zorin:GNOME 'org\.gnome\.desktop\.background picture-uri '; }
case_detect_fedora_gnome() { detect_row gnome-shell GNOME 'org\.gnome\.desktop\.background picture-uri '; }
case_detect_pantheon() { detect_row gala Pantheon "picture-uri-dark ''"; }
case_detect_budgie() { detect_row budgie-daemon Budgie:GNOME 'org\.gnome\.desktop\.background picture-uri '; }
case_detect_cinnamon() { detect_row cinnamon X-Cinnamon 'org\.cinnamon\.desktop\.background picture-uri '; }
case_detect_kde() { detect_row plasmashell KDE '^plasma-apply-wallpaperimage '; }
case_detect_cosmic() { detect_row cosmic-bg COSMIC '^cosmic com\.system76\.CosmicBackground/v1/all$'; }

case_detect_interactive_env_wins() {
  linux_case
  site_dated pc "$TODAY" valid
  session plasmashell 4242 KDE
  CASE_ENV="$CASE_ENV XDG_CURRENT_DESKTOP=X-Cinnamon DBUS_SESSION_BUS_ADDRESS=unix:path=/x"
  run_script --now
  expect_stub 'org\.cinnamon'
  expect_no_stub plasma
}

case_detect_unknown_desktop_exit_2() {
  linux_case
  site_dated pc "$TODAY" valid
  session xfce4-session 4242 XFCE
  echo x11 > "$LROOT/session-type"
  state "date=$YESTERDAY"
  run_script
  expect_exit 2
  expect_output "desktop 'XFCE' isn't supported"
  expect_requests 0
  expect_state date "$YESTERDAY"
}

case_detect_unknown_interactive_exit_2() {
  linux_case
  CASE_ENV="$CASE_ENV XDG_CURRENT_DESKTOP=Hyprland DBUS_SESSION_BUS_ADDRESS=unix:path=/x"
  run_script --install
  expect_exit 2
  expect_output "'Hyprland' isn't supported"
  expect_no_file config
}

case_detect_no_session_exit_3() {
  linux_case
  echo tty > "$LROOT/session-type"
  run_script --now
  expect_exit 3
  expect_requests 0
}

case_detect_no_session_install_message() {
  linux_case
  run_script --install
  expect_exit 3
  expect_output 'run this from a terminal in your desktop session'
}

case_detect_session_appears_after_30s() {
  linux_case
  site_dated pc "$TODAY" valid
  session gnome-shell 4242 GNOME
  # 3 rounds × 6 desktops without a match, then gnome-shell
  echo 18 > "$LROOT/appear-after"
  run_script
  expect_exit 0
  expect_stub '^sleep 10$' 3
  expect_state date "$TODAY"
}

case_detect_scheduled_waits_120s() {
  linux_case
  run_script
  expect_exit 3
  expect_stub '^sleep 10$' 12
}

# ---------- phase 5: setters ----------

case_set_gnome_calls() {
  linux_case
  site_dated pc "$TODAY" valid
  session gnome-shell 4242 ubuntu:GNOME
  run_script --now
  expect_stub "^gsettings set org\.gnome\.desktop\.background picture-uri $(WALLPAPER_URI)\$" 1
  expect_stub "^gsettings set org\.gnome\.desktop\.background picture-uri-dark $(WALLPAPER_URI)\$" 1
  expect_stub "^gsettings set org\.gnome\.desktop\.background picture-options 'zoom'\$" 1
}

case_set_gnome_without_dark_key() {
  linux_case
  site_dated pc "$TODAY" valid
  session gnome-shell 4242 GNOME
  mkdir -p "$CASE_HOME/stub"; printf 'picture-uri\npicture-options\n' > "$CASE_HOME/stub/gsettings-keys"
  run_script --now
  expect_exit 0
  expect_no_stub picture-uri-dark
}

case_set_pantheon_clears_dark() {
  linux_case
  site_dated pc "$TODAY" valid
  session gala 4242 Pantheon
  run_script --now
  expect_stub "picture-uri $(WALLPAPER_URI)\$" 1
  expect_stub "^gsettings set org\.gnome\.desktop\.background picture-uri-dark ''\$" 1
}

case_set_cinnamon_calls() {
  linux_case
  site_dated pc "$TODAY" valid
  session cinnamon 4242 X-Cinnamon
  run_script --now
  expect_stub "^gsettings set org\.cinnamon\.desktop\.background picture-uri $(WALLPAPER_URI)\$" 1
  expect_stub "^gsettings set org\.cinnamon\.desktop\.background picture-options 'zoom'\$" 1
  expect_no_stub org\.gnome
}

case_set_kde_calls() {
  linux_case
  site_dated pc "$TODAY" valid
  session plasmashell 4242 KDE
  run_script --now
  expect_stub "^plasma-apply-wallpaperimage --fill-mode preserveAspectCrop $CASE_HOME/wallpapers/$TODAY\.jpg\$" 1
}

case_set_missing_tool_hint() {
  linux_case fedora
  site_dated pc "$TODAY" valid
  session gnome-shell 4242 GNOME
  CASE_ENV="$CASE_ENV AMAZING_SEA_WALLPAPER_STUB_MISSING=gsettings"
  run_script --now
  expect_exit 4
  expect_output 'gsettings is missing: sudo dnf install glib2'
}

case_set_kde_missing_tool_hint_suse() {
  linux_case opensuse-tumbleweed
  printf 'ID="opensuse-tumbleweed"\nID_LIKE="opensuse suse"\n' > "$LROOT/etc/os-release"
  session plasmashell 4242 KDE
  CASE_ENV="$CASE_ENV AMAZING_SEA_WALLPAPER_STUB_MISSING=plasma-apply-wallpaperimage"
  run_script --install
  expect_exit 4
  expect_output 'sudo zypper install plasma6-workspace'
}

COSMIC_1110='(output: "all", source: Path("/usr/share/backgrounds/pop/kait-herzog-8242.jpg"), filter_by_theme: true, rotation_frequency: 300, filter_method: Lanczos, scaling_mode: Zoom, sampling_method: Alphanumeric)'

cosmic_seed() {
  mkdir -p "$LROOT/usr/share/cosmic/com.system76.CosmicBackground/v1"
  printf '%s\n' "$COSMIC_1110" > "$LROOT/usr/share/cosmic/com.system76.CosmicBackground/v1/all"
}

case_set_cosmic_from_system_default() {
  linux_case pop
  cosmic_seed
  site_dated pc "$TODAY" valid
  session cosmic-bg 4242 COSMIC
  run_script --now
  expect_exit 0
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground/v1/all cosmic-all
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground/v1/same-on-all cosmic-same-on-all
  [ ! -e "$USER_HOME/.config/cosmic/com.system76.CosmicBackground.Dark" ] || fail "made .Dark"
}

case_set_cosmic_keeps_user_settings() {
  linux_case pop
  cosmic_seed
  site_dated pc "$TODAY" valid
  session cosmic-bg 4242 COSMIC
  mkdir -p "$USER_HOME/.config/cosmic/com.system76.CosmicBackground/v1"
  printf '(\n    output: "all",\n    source: Path("/home/u/Pictures/mine.png"),\n    filter_by_theme: false,\n    rotation_frequency: 900,\n    filter_method: Nearest,\n    scaling_mode: Fit((0.0, 0.0, 0.0)),\n    sampling_method: Random,\n)\n' \
    > "$USER_HOME/.config/cosmic/com.system76.CosmicBackground/v1/all"
  run_script --now
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground/v1/all cosmic-user-multiline
}

case_set_cosmic_dark_light() {
  linux_case pop
  cosmic_seed
  site_dated pc "$TODAY" valid
  session cosmic-bg 4242 COSMIC
  mkdir -p "$USER_HOME/.config/cosmic/com.system76.CosmicBackground.Dark/v1" "$USER_HOME/.config/cosmic/com.system76.CosmicBackground.Light"
  run_script --now
  expect_exit 0
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground.Dark/v1/all cosmic-all
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground.Light/v1/all cosmic-all
  expect_stub '^cosmic ' 3
}

case_set_cosmic_no_files_at_all() {
  linux_case pop
  site_dated pc "$TODAY" valid
  session cosmic-bg 4242 COSMIC
  run_script --now
  expect_exit 0
  expect_golden userhome/.config/cosmic/com.system76.CosmicBackground/v1/all cosmic-all-default
}

# ---------- phase 6: scheduling and tools ----------

cron_case() {
  linux_case "${1:-ubuntu}"
  session gnome-shell 4242 ubuntu:GNOME
  mkdir -p "$CASE_HOME/stub"
  echo cron > "$CASE_HOME/stub/cron-daemon"
  printf '# m h dom mon dow command\n0 1 * * * echo mine\n' > "$CASE_HOME/stub/crontab"
}

case_install_cron() {
  cron_case
  site_dated pc "$TODAY" valid
  CASE_RANDOM=17
  run_script --install
  expect_exit 0
  expect_contains home/config '^scheduler=cron$'
  expect_golden home/stub/crontab cron-install
  expect_golden userhome/.config/autostart/amazing-sea-wallpaper.desktop autostart.desktop
  expect_stub '^crontab -$' 1
  expect_no_stub 'systemctl --user (link|enable)'
  [ "$(readlink "$USER_HOME/.local/bin/amazing-sea-wallpaper")" = "$CASE_HOME/amazing-sea-wallpaper.sh" ] || fail "link"
}

case_reinstall_cron_one_line() {
  cron_case
  site_dated pc "$TODAY" valid
  run_script --install
  run_script --install --hour 6
  [ "$(grep -c '# amazing-sea-wallpaper$' "$CASE_HOME/stub/crontab")" = 1 ] || fail "$(cat "$CASE_HOME/stub/crontab")"
  expect_contains home/stub/crontab '^0 6 \* \* \* '
  expect_contains home/stub/crontab '^0 1 \* \* \* echo mine$'
}

case_cron_retry_line_and_retry_removes_it() {
  cron_case
  site_latest "$YESTERDAY" valid
  run_script --install
  run_script
  expect_golden home/stub/crontab cron-with-retry
  run_script --retry
  expect_lacks home/stub/crontab 'amazing-sea-wallpaper-retry'
  expect_contains home/stub/crontab '# amazing-sea-wallpaper$'
}

case_cron_login_logs_to_file() {
  cron_case
  site_dated pc "$TODAY" valid
  config scheduler=cron url="$SITE_URL"
  run_script --login
  expect_exit 0
  expect_contains home/amazing-sea-wallpaper.log "login: set $TODAY"
}

case_systemd_when_no_cron() {
  linux_case fedora
  session gnome-shell 4242 GNOME
  site_dated pc "$TODAY" valid
  CASE_RANDOM=17
  run_script --install
  expect_exit 0
  expect_contains home/config '^scheduler=systemd$'
  expect_golden home/amazing-sea-wallpaper.service systemd.service
  expect_golden home/amazing-sea-wallpaper.timer systemd.timer
  expect_stub "^systemctl --user link $CASE_HOME/amazing-sea-wallpaper\.service\$" 1
  expect_stub "^systemctl --user link $CASE_HOME/amazing-sea-wallpaper\.timer\$" 1
  expect_stub '^systemctl --user enable amazing-sea-wallpaper\.timer$' 1
  expect_stub '^systemctl --user restart amazing-sea-wallpaper\.timer$' 1
  expect_no_file ../userhome/.config/autostart/amazing-sea-wallpaper.desktop
  expect_no_stub '^crontab -$'
}

case_systemd_retry_units() {
  linux_case arch
  session plasmashell 4242 KDE
  site_latest "$YESTERDAY" valid
  run_script --install
  run_script
  expect_golden home/amazing-sea-wallpaper-retry.service systemd-retry.service
  expect_golden home/amazing-sea-wallpaper-retry.timer systemd-retry.timer
  expect_stub '^systemctl --user restart amazing-sea-wallpaper-retry\.timer$' 1
  run_script --retry
  expect_stub '^systemctl --user disable --now amazing-sea-wallpaper-retry\.timer$' 1
  expect_no_file amazing-sea-wallpaper-retry.timer
  expect_stub '^systemctl --user restart amazing-sea-wallpaper-retry\.timer$' 1
}

case_forced_systemd_removes_cron_entries() {
  cron_case
  site_dated pc "$TODAY" valid
  run_script --install
  run_script --install --scheduler systemd
  expect_exit 0
  expect_lacks home/stub/crontab 'amazing-sea-wallpaper'
  expect_contains home/stub/crontab 'echo mine'
  expect_no_file ../userhome/.config/autostart/amazing-sea-wallpaper.desktop
  expect_contains home/config '^scheduler=systemd$'
  expect_contains home/config '^scheduler_forced=systemd$'
}

case_cron_after_systemd_removes_units() {
  linux_case fedora
  session gnome-shell 4242 GNOME
  site_dated pc "$TODAY" valid
  run_script --install
  echo cron > "$CASE_HOME/stub/cron-daemon"
  run_script --install --scheduler cron
  expect_contains home/config '^scheduler=cron$'
  expect_stub '^systemctl --user disable --now amazing-sea-wallpaper\.timer$' 1
  expect_no_file amazing-sea-wallpaper.timer
}

case_no_scheduler_exit_4() {
  linux_case debian
  session gnome-shell 4242 GNOME
  mkdir -p "$CASE_HOME/stub"; : > "$CASE_HOME/stub/no-systemd"
  run_script --install
  expect_exit 4
  expect_output 'sudo apt install cron'
}

case_no_scheduler_gentoo_openrc() {
  linux_case gentoo
  session plasmashell 4242 KDE
  mkdir -p "$CASE_HOME/stub"; : > "$CASE_HOME/stub/no-systemd"
  run_script --install
  expect_exit 4
  expect_output 'emerge sys-process/cronie && sudo rc-update add cronie default'
}

case_fcron() {
  cron_case gentoo
  echo fcron > "$CASE_HOME/stub/cron-daemon"
  site_dated pc "$TODAY" valid
  run_script --install
  expect_contains home/config '^scheduler=fcron$'
  expect_stub '^fcrontab -$' 1
}

case_uninstall_linux() {
  cron_case
  site_latest "$YESTERDAY" valid
  run_script --install
  run_script
  : > "$CASE_HOME/stubs.log"
  run_script --uninstall < /dev/null
  expect_exit 0
  expect_lacks home/stub/crontab 'amazing-sea-wallpaper'
  expect_contains home/stub/crontab 'echo mine'
  expect_no_file ../userhome/.config/autostart/amazing-sea-wallpaper.desktop
  expect_stub '^systemctl --user disable --now amazing-sea-wallpaper\.timer$' 1
  [ ! -L "$USER_HOME/.local/bin/amazing-sea-wallpaper" ] || fail "link left"
}

case_status_linux() {
  cron_case
  site_dated pc "$TODAY" valid
  run_script --install
  run_script --status
  expect_output 'system:    ubuntu test'
  expect_output 'via cron'
}

case_no_downloader() {
  linux_case
  session gnome-shell 4242 GNOME
  CASE_ENV="$CASE_ENV AMAZING_SEA_WALLPAPER_DOWNLOADER=none"
  run_script --now
  expect_exit 4
  expect_output 'neither curl nor wget is installed: sudo apt install curl'
}
