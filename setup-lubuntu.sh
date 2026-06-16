#!/bin/bash
#
# Encoding Machine — one-shot Lubuntu kiosk setup.
#
# Installs a browser, disables screen blanking/power saving, and configures
# the machine to boot straight into the Encoding Machine in fullscreen kiosk
# mode. Assumes this repo lives at /encoding-machine.
#
# Usage:   sudo bash /encoding-machine/setup-lubuntu.sh
# Re-run:  safe to run again; it overwrites its own config.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_DIR="/encoding-machine"
INDEX_URL="file://${REPO_DIR}/index.html"

# The user the kiosk autostarts for. Defaults to the user who invoked sudo,
# falls back to the first normal login user (UID 1000).
KIOSK_USER="${SUDO_USER:-$(id -un 1000 2>/dev/null || echo "")}"

if [[ -z "$KIOSK_USER" || "$KIOSK_USER" == "root" ]]; then
  echo "ERROR: could not determine a non-root kiosk user." >&2
  echo "Run as: sudo bash $REPO_DIR/setup-lubuntu.sh   (while logged in as that user)" >&2
  exit 1
fi
KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"

echo "==> Kiosk user:  $KIOSK_USER"
echo "==> Repo:        $REPO_DIR"
echo "==> Launch URL:  $INDEX_URL"

if [[ ! -f "${REPO_DIR}/index.html" ]]; then
  echo "ERROR: ${REPO_DIR}/index.html not found. Put the repo at ${REPO_DIR} first." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Install packages
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive

# Prefer an already-installed Google Chrome; otherwise fall back to Chromium.
if command -v google-chrome >/dev/null 2>&1; then
  BROWSER_BIN="google-chrome"
elif command -v google-chrome-stable >/dev/null 2>&1; then
  BROWSER_BIN="google-chrome-stable"
elif command -v chromium-browser >/dev/null 2>&1; then
  BROWSER_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER_BIN="chromium"
else
  echo "==> No Chrome/Chromium found; installing Chromium..."
  apt-get update -y
  if apt-get install -y chromium-browser; then
    BROWSER_BIN="chromium-browser"
  elif apt-get install -y chromium; then
    BROWSER_BIN="chromium"
  else
    echo "ERROR: could not install a browser." >&2
    exit 1
  fi
fi

# unclutter hides the mouse cursor; xdotool/x11-xserver-utils for power tweaks.
echo "==> Installing kiosk helpers (unclutter, x11 tools)..."
apt-get update -y || true
apt-get install -y unclutter x11-xserver-utils xdotool || true

echo "==> Browser: $BROWSER_BIN"

# ---------------------------------------------------------------------------
# 2. Kiosk launch script
# ---------------------------------------------------------------------------
LAUNCH_SCRIPT="${REPO_DIR}/launch-kiosk-lubuntu.sh"
echo "==> Writing $LAUNCH_SCRIPT"
cat > "$LAUNCH_SCRIPT" <<EOF
#!/bin/bash
# Launches the Encoding Machine in Chromium kiosk mode on Lubuntu/X11.
set -e

# Disable screen blanking, DPMS power saving, and screensaver.
xset s off || true
xset s noblank || true
xset -dpms || true

# Hide the mouse cursor when idle.
unclutter -idle 0.5 -root &

# Clean any previous crash/exit flags so Chromium starts fresh, no restore bubble.
PROFILE="\$HOME/.config/encoding-machine-kiosk"
mkdir -p "\$PROFILE/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "\$PROFILE/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/'   "\$PROFILE/Default/Preferences" 2>/dev/null || true

exec ${BROWSER_BIN} \\
  --kiosk \\
  --start-fullscreen \\
  --user-data-dir="\$PROFILE" \\
  --no-first-run \\
  --fast \\
  --fast-start \\
  --disable-infobars \\
  --disable-translate \\
  --disable-pinch \\
  --disable-session-crashed-bubble \\
  --disable-restore-session-state \\
  --disable-features=TranslateUI \\
  --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --allow-file-access-from-files \\
  --noerrdialogs \\
  --incognito \\
  "${INDEX_URL}"
EOF
chmod +x "$LAUNCH_SCRIPT"
chown "$KIOSK_USER":"$KIOSK_USER" "$LAUNCH_SCRIPT" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 3. Autostart on login (LXQt / openbox via XDG autostart)
# ---------------------------------------------------------------------------
AUTOSTART_DIR="${KIOSK_HOME}/.config/autostart"
echo "==> Adding XDG autostart entry in $AUTOSTART_DIR"
mkdir -p "$AUTOSTART_DIR"
cat > "${AUTOSTART_DIR}/encoding-machine.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Encoding Machine Kiosk
Exec=${LAUNCH_SCRIPT}
X-LXQt-Need-Tray=false
Terminal=false
EOF
chown -R "$KIOSK_USER":"$KIOSK_USER" "${KIOSK_HOME}/.config"

# ---------------------------------------------------------------------------
# 4. Enable passwordless auto-login (LightDM) so it boots into the kiosk
# ---------------------------------------------------------------------------
if [[ -d /etc/lightdm ]]; then
  echo "==> Configuring LightDM auto-login for $KIOSK_USER"
  mkdir -p /etc/lightdm/lightdm.conf.d
  cat > /etc/lightdm/lightdm.conf.d/50-encoding-machine-autologin.conf <<EOF
[Seat:*]
autologin-user=${KIOSK_USER}
autologin-user-timeout=0
EOF
else
  echo "==> LightDM not found; skipping auto-login (configure your display manager manually)."
fi

echo
echo "============================================================"
echo " Setup complete."
echo
echo "  Reboot to launch the kiosk:   sudo reboot"
echo "  Test without reboot:          ${LAUNCH_SCRIPT}"
echo "  Exit kiosk:                   Ctrl+Alt+F2 / Alt+F4"
echo "============================================================"
