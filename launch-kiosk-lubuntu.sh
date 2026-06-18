#!/bin/bash
# Launches the Encoding Machine in Chromium kiosk mode on Lubuntu/X11.
set -e

# Pull latest commits before launching (best-effort; never blocks the kiosk).
update_repo() {
  cd "/home/mooniak-/encoding-machine" || return 0
  git config --global --add safe.directory "/home/mooniak-/encoding-machine" 2>/dev/null || true
  # Only pull if we have a network route and a tracking remote.
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    echo "Checking for updates..."
    git fetch --quiet 2>/dev/null || { echo "No network; skipping update."; return 0; }
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse '@{u}' 2>/dev/null)
    if [ "$LOCAL" != "$REMOTE" ]; then
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
PROFILE="$HOME/.config/encoding-machine-kiosk"
mkdir -p "$PROFILE/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$PROFILE/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/'   "$PROFILE/Default/Preferences" 2>/dev/null || true

# Wipe Chrome's cache so updated files (after git pull) always load fresh.
rm -rf "$PROFILE/Default/Cache" "$PROFILE/Default/Code Cache" \
       "$PROFILE/Default/GPUCache" "$PROFILE/ShaderCache" 2>/dev/null || true

# Ensure print headers/footers are suppressed (kiosk-printing reads this preference).
python3 - <<'PYEOF'
import json, os, sys
path = os.path.expanduser('~/.config/encoding-machine-kiosk/Default/Preferences')
try:
    with open(path, 'r') as f:
        prefs = json.load(f)
    prefs.setdefault('printing', {})['print_header_footer'] = False
    with open(path, 'w') as f:
        json.dump(prefs, f, separators=(',', ':'))
except Exception:
    pass
PYEOF

# Start the print + static-file service (Path B: direct ESC/POS).
REPO="/home/mooniak-/encoding-machine"
pkill -f "$REPO/print-service.py" 2>/dev/null || true
sg lp -c "nohup python3 $REPO/print-service.py >> /tmp/print-service.log 2>&1 &"
# Wait up to 5 s for the service to be ready before Chrome opens.
for _i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:9099/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done

exec google-chrome \
  --disk-cache-size=1 \
  --aggressive-cache-discard \
  --kiosk \
  --kiosk-printing \
  --start-fullscreen \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-infobars \
  --disable-translate \
  --disable-pinch \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-features=TranslateUI \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --noerrdialogs \
  --incognito \
  "http://127.0.0.1:9099/"
