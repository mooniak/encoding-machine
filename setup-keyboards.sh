#!/bin/bash
#
# Encoding Machine — Sinhala & Tamil keyboard setup (standalone).
#
# Installs IBUS + m17n input methods and fonts, preloads English/Sinhala/Tamil,
# and binds Ctrl+1 / Ctrl+2 / Ctrl+3 to switch between them.
#
# Usage:  sudo bash setup-keyboards.sh
# Re-run: safe; overwrites its own config.
#
set -euo pipefail

# Engine ids (override before running if `ibus list-engine` shows different names).
ENGINE_EN="${ENGINE_EN:-xkb:us::eng}"
ENGINE_SI="${ENGINE_SI:-m17n:si:wijesekara}"
ENGINE_TA="${ENGINE_TA:-m17n:ta:tamil99}"

# Target user (defaults to the sudo invoker, else UID 1000).
KIOSK_USER="${SUDO_USER:-$(id -un 1000 2>/dev/null || echo "")}"
if [[ -z "$KIOSK_USER" || "$KIOSK_USER" == "root" ]]; then
  echo "ERROR: could not determine a non-root user. Run with: sudo bash setup-keyboards.sh" >&2
  exit 1
fi
KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
AUTOSTART_DIR="${KIOSK_HOME}/.config/autostart"

echo "==> User:    $KIOSK_USER"
echo "==> Engines: $ENGINE_EN | $ENGINE_SI | $ENGINE_TA"

# ---------------------------------------------------------------------------
# 1. Packages
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
echo "==> Installing IBUS, m17n, fonts, xbindkeys..."
apt-get update -y || true
apt-get install -y \
  ibus ibus-m17n m17n-db xbindkeys \
  fonts-lklug-sinhala fonts-noto-core fonts-sinhala fonts-tamil \
  || apt-get install -y ibus ibus-m17n m17n-db xbindkeys fonts-lklug-sinhala || true

# Make IBUS the system input-method framework.
if command -v im-config >/dev/null 2>&1; then
  im-config -n ibus || true
fi

# ---------------------------------------------------------------------------
# 2. Verify the requested engines actually exist
# ---------------------------------------------------------------------------
if command -v ibus >/dev/null 2>&1; then
  AVAIL="$(ibus list-engine 2>/dev/null || true)"
  for e in "$ENGINE_SI" "$ENGINE_TA"; do
    if ! grep -q "$e" <<<"$AVAIL"; then
      echo "    WARNING: engine '$e' not found in 'ibus list-engine'."
      echo "    Available Sinhala/Tamil engines:"
      grep -iE 'm17n:(si|ta):' <<<"$AVAIL" | sed 's/^/      /' || echo "      (none)"
      echo "    Re-run with the correct id, e.g.: sudo ENGINE_SI=m17n:si:phonetic bash setup-keyboards.sh"
    fi
  done
fi

# ---------------------------------------------------------------------------
# 3. Autostart IBUS daemon + xbindkeys
# ---------------------------------------------------------------------------
mkdir -p "$AUTOSTART_DIR"
cat > "${AUTOSTART_DIR}/ibus-daemon.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=IBus Daemon
Exec=ibus-daemon -drx
Terminal=false
EOF

cat > "${AUTOSTART_DIR}/xbindkeys.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=xbindkeys (keyboard switch)
Exec=xbindkeys
Terminal=false
EOF

# ---------------------------------------------------------------------------
# 4. Preload engines + Ctrl+1/2/3 bindings + IM env
# ---------------------------------------------------------------------------
sudo -u "$KIOSK_USER" dbus-launch gsettings set org.freedesktop.ibus.general preload-engines \
  "['${ENGINE_EN}', '${ENGINE_SI}', '${ENGINE_TA}']" 2>/dev/null || true

XBK="${KIOSK_HOME}/.xbindkeysrc"
echo "==> Writing $XBK (Ctrl+1 English, Ctrl+2 Sinhala, Ctrl+3 Tamil)"
cat > "$XBK" <<EOF
# Encoding Machine — keyboard switching
"ibus engine ${ENGINE_EN}"
  control + 1

"ibus engine ${ENGINE_SI}"
  control + 2

"ibus engine ${ENGINE_TA}"
  control + 3
EOF

PROFILE_D="${KIOSK_HOME}/.profile"
if ! grep -q "GTK_IM_MODULE=ibus" "$PROFILE_D" 2>/dev/null; then
  cat >> "$PROFILE_D" <<'EOF'

# Sinhala/Tamil input via IBUS
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus
EOF
fi

chown "$KIOSK_USER":"$KIOSK_USER" "$XBK" "$PROFILE_D" 2>/dev/null || true
chown -R "$KIOSK_USER":"$KIOSK_USER" "${KIOSK_HOME}/.config" 2>/dev/null || true

# Apply now if a session is live (otherwise it takes effect on next login).
sudo -u "$KIOSK_USER" ibus restart 2>/dev/null || true
sudo -u "$KIOSK_USER" pkill -x xbindkeys 2>/dev/null || true
sudo -u "$KIOSK_USER" xbindkeys 2>/dev/null || true

echo
echo "============================================================"
echo " Keyboards configured."
echo "   Ctrl+1 English   Ctrl+2 Sinhala   Ctrl+3 Tamil"
echo "   (Super+Space also cycles.)"
echo " If a layout is missing, check: ibus list-engine | grep -iE 'si|ta'"
echo " Then re-run, e.g.: sudo ENGINE_SI=<id> bash setup-keyboards.sh"
echo " Log out/in (or reboot) if changes don't appear immediately."
echo "============================================================"
