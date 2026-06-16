#!/bin/bash
#
# Encoding Machine — one-shot Lubuntu kiosk setup.
#
# Installs a browser, disables screen blanking/power saving, and configures
# the machine to boot straight into the Encoding Machine in fullscreen kiosk
# mode. Assumes this repo lives at /home/mooniak/encoding-machine.
#
# Usage:   sudo bash /home/mooniak/encoding-machine/setup-lubuntu.sh
# Re-run:  safe to run again; it overwrites its own config.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
# Repo dir = the folder this script lives in (no hardcoded path to get wrong).
REPO_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
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
apt-get install -y git unclutter x11-xserver-utils xdotool || true

echo "==> Browser: $BROWSER_BIN"

# Ensure opentype.min.js is present (index.html needs it; not committed to repo).
# Falls back to CDN at runtime, but bundling it keeps the kiosk working offline.
OTJS="${REPO_DIR}/opentype.min.js"
if [[ ! -s "$OTJS" ]]; then
  echo "==> opentype.min.js missing; downloading..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$OTJS" "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js" \
      || curl -fsSL -o "$OTJS" "https://unpkg.com/opentype.js@1.3.4/dist/opentype.min.js" || true
  fi
  if [[ ! -s "$OTJS" ]] && command -v wget >/dev/null 2>&1; then
    wget -qO "$OTJS" "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js" || true
  fi
  if [[ -s "$OTJS" ]]; then
    chown "$KIOSK_USER":"$KIOSK_USER" "$OTJS" 2>/dev/null || true
    echo "    saved $(wc -c < "$OTJS") bytes"
  else
    echo "    WARNING: download failed; index.html will load opentype.js from CDN at runtime (needs network)."
  fi
fi

# ---------------------------------------------------------------------------
# 2. Kiosk launch script
# ---------------------------------------------------------------------------
LAUNCH_SCRIPT="${REPO_DIR}/launch-kiosk-lubuntu.sh"
echo "==> Writing $LAUNCH_SCRIPT"
cat > "$LAUNCH_SCRIPT" <<EOF
#!/bin/bash
# Launches the Encoding Machine in Chromium kiosk mode on Lubuntu/X11.
set -e

# Pull latest commits before launching (best-effort; never blocks the kiosk).
update_repo() {
  cd "${REPO_DIR}" || return 0
  git config --global --add safe.directory "${REPO_DIR}" 2>/dev/null || true
  # Only pull if we have a network route and a tracking remote.
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    echo "Checking for updates..."
    git fetch --quiet 2>/dev/null || { echo "No network; skipping update."; return 0; }
    LOCAL=\$(git rev-parse @ 2>/dev/null)
    REMOTE=\$(git rev-parse '@{u}' 2>/dev/null)
    if [ "\$LOCAL" != "\$REMOTE" ]; then
      echo "New commits found; updating..."
      git reset --hard '@{u}' 2>/dev/null || git pull --ff-only 2>/dev/null || true
    else
      echo "Already up to date."
    fi
  fi
}
update_repo || true

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

# ---------------------------------------------------------------------------
# 5. Sinhala & Tamil keyboards (IBUS + m17n input methods + fonts)
# ---------------------------------------------------------------------------
echo "==> Installing Sinhala & Tamil input methods and fonts..."
apt-get install -y \
  ibus ibus-m17n m17n-db xbindkeys \
  fonts-lklug-sinhala fonts-noto-core fonts-sinhala fonts-tamil \
  || apt-get install -y ibus ibus-m17n m17n-db xbindkeys fonts-lklug-sinhala || true

# Make IBUS the system input-method framework for all GUI sessions.
if command -v im-config >/dev/null 2>&1; then
  im-config -n ibus || true
fi

# Autostart the IBUS daemon in the kiosk user's session.
cat > "${AUTOSTART_DIR}/ibus-daemon.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=IBus Daemon
Exec=ibus-daemon -drx
Terminal=false
EOF

# Preload the layouts: US English + Sinhala (wijesekara) + Tamil (tamil99).
# These are the standard m17n engines: m17n:si:wijesekara, m17n:ta:tamil99.
sudo -u "$KIOSK_USER" dbus-launch gsettings set org.freedesktop.ibus.general preload-engines \
  "['xkb:us::eng', 'm17n:si:wijesekara', 'm17n:ta:tamil99']" 2>/dev/null || true

# Bind Ctrl+1 / Ctrl+2 / Ctrl+3 to switch engine directly (via xbindkeys).
#   Ctrl+1 -> English (US)   Ctrl+2 -> Sinhala   Ctrl+3 -> Tamil
XBK="${KIOSK_HOME}/.xbindkeysrc"
echo "==> Writing $XBK (Ctrl+1/2/3 layout switch)"
cat > "$XBK" <<'EOF'
# Encoding Machine — keyboard switching
"ibus engine xkb:us::eng"
  control + 1

"ibus engine m17n:si:wijesekara"
  control + 2

"ibus engine m17n:ta:tamil99"
  control + 3
EOF
chown "$KIOSK_USER":"$KIOSK_USER" "$XBK" 2>/dev/null || true

# Autostart xbindkeys in the kiosk session.
cat > "${AUTOSTART_DIR}/xbindkeys.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=xbindkeys (keyboard switch)
Exec=xbindkeys
Terminal=false
EOF

# Export IM environment variables for the kiosk user (covers GTK/Qt/Chrome).
PROFILE_D="${KIOSK_HOME}/.profile"
if ! grep -q "GTK_IM_MODULE=ibus" "$PROFILE_D" 2>/dev/null; then
  cat >> "$PROFILE_D" <<'EOF'

# Sinhala/Tamil input via IBUS
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus
EOF
fi
chown "$KIOSK_USER":"$KIOSK_USER" "$PROFILE_D" 2>/dev/null || true
chown -R "$KIOSK_USER":"$KIOSK_USER" "${KIOSK_HOME}/.config"

echo
echo "============================================================"
echo " Setup complete."
echo
echo "  Reboot to launch the kiosk:   sudo reboot"
echo "  Test without reboot:          ${LAUNCH_SCRIPT}"
echo "  Exit kiosk:                   Ctrl+Alt+F2 / Alt+F4"
echo
echo "  Switch keyboard:  Ctrl+1 English   Ctrl+2 Sinhala   Ctrl+3 Tamil"
echo "  (Super+Space also cycles layouts.)"
echo "============================================================"
