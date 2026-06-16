#!/bin/bash
# Double-click this file in Finder to launch the encoding machine in Chrome kiosk mode.
# Chrome kiosk: fullscreen, no address bar, no tabs, cursor hidden by app CSS.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FILE="file://${DIR}/index.html"

# Quit any existing Chrome instance that might block kiosk launch
osascript -e 'quit app "Google Chrome"' 2>/dev/null
sleep 1

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk \
  --start-fullscreen \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --allow-file-access-from-files \
  "${FILE}"
