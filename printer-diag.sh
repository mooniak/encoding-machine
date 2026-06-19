#!/usr/bin/env bash
# printer-diag.sh — Diagnose and optionally fix the Akurugraphy thermal printer setup.
#
# Usage:
#   ./printer-diag.sh           # diagnose only (no changes)
#   ./printer-diag.sh --fix     # diagnose + auto-fix what can be fixed without sudo
#   ./printer-diag.sh --fix --test-print  # also send a test print after fixing
#
# What it checks:
#   1. USB device detected (lsusb)
#   2. /dev/usb/lp* device node exists and is writable
#   3. Current user is in the 'lp' group
#   4. print-service.py device path matches the actual /dev/usb/lpN
#   5. print-service.py is running and /health responds
#   6. CUPS queue has no stuck jobs
#   7. CUPS device URI matches the actual device
#
# Auto-fixable (--fix, no sudo needed):
#   - Update PRINTER_DEV in print-service.py to match the real device
#   - Cancel all stuck CUPS jobs
#   - Restart print-service.py
#
# Requires sudo (done interactively if --fix is passed):
#   - sudo lpadmin -p XP-80-T -v parallel:/dev/usb/lpN  (CUPS URI)
#   - sudo usermod -aG lp <user>                         (group membership)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_SCRIPT="$REPO_DIR/print-service.py"
SERVICE_PORT=9099
CUPS_QUEUE="XP-80-T"
XPRINTER_NAME="Printer Port"  # matched in lsusb; XP-80-T shows as "USB Printer Port"

FIX=false
TEST_PRINT=false
for arg in "$@"; do
    case "$arg" in
        --fix)        FIX=true ;;
        --test-print) TEST_PRINT=true ;;
    esac
done

# ── Colour helpers ────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'
    BLU='\033[0;34m'; BLD='\033[1m'; RST='\033[0m'
else
    RED=''; GRN=''; YLW=''; BLU=''; BLD=''; RST=''
fi

ok()   { echo -e "  ${GRN}✔${RST}  $*"; }
warn() { echo -e "  ${YLW}⚠${RST}  $*"; }
fail() { echo -e "  ${RED}✘${RST}  $*"; }
info() { echo -e "  ${BLU}·${RST}  $*"; }
hdr()  { echo -e "\n${BLD}$*${RST}"; }

ISSUES=0
issue() { ISSUES=$((ISSUES + 1)); fail "$*"; }

# ── 1. USB device ─────────────────────────────────────────────────────────────
hdr "1. USB hardware"
if command -v lsusb &>/dev/null; then
    USB_LINE=$(lsusb 2>/dev/null | grep -i "$XPRINTER_NAME" || true)
    if [ -n "$USB_LINE" ]; then
        ok "Thermal printer detected: $USB_LINE"
    else
        issue "No USB printer found in lsusb output. Is the printer on and USB cable connected?"
        lsusb 2>/dev/null | head -20 | sed 's/^/         /'
    fi
else
    warn "lsusb not available; skipping USB check"
fi

# ── 2. /dev/usb/lpN device node ───────────────────────────────────────────────
hdr "2. Printer device node"
REAL_DEVS=()
while IFS= read -r d; do REAL_DEVS+=("$d"); done < <(ls /dev/usb/lp* 2>/dev/null || true)

if [ ${#REAL_DEVS[@]} -eq 0 ]; then
    issue "No /dev/usb/lp* devices found. Printer may not be recognised by the kernel."
    ACTUAL_DEV=""
elif [ ${#REAL_DEVS[@]} -eq 1 ]; then
    ACTUAL_DEV="${REAL_DEVS[0]}"
    ok "Device: $ACTUAL_DEV"
else
    # Multiple devices — pick the most recently modified one (most likely current printer)
    ACTUAL_DEV=$(ls -t "${REAL_DEVS[@]}" | head -1)
    warn "Multiple lp devices found: ${REAL_DEVS[*]}"
    info "Using most-recent: $ACTUAL_DEV (verify this is the right one)"
fi

if [ -n "$ACTUAL_DEV" ]; then
    if [ -w "$ACTUAL_DEV" ]; then
        ok "$ACTUAL_DEV is writable by current user ($(whoami))"
    else
        issue "$ACTUAL_DEV is NOT writable by $(whoami)"
        info "Permissions: $(ls -l "$ACTUAL_DEV" 2>/dev/null)"
        if $FIX; then
            echo "  → Running: sudo usermod -aG lp $(whoami)"
            sudo usermod -aG lp "$(whoami)"
            warn "Group change requires re-login or reboot to take effect"
        else
            info "Fix: sudo usermod -aG lp $(whoami)  (then re-login)"
        fi
    fi
fi

# ── 3. Group membership ───────────────────────────────────────────────────────
hdr "3. Group membership"
if groups | grep -qw lp; then
    ok "$(whoami) is in group 'lp'"
else
    issue "$(whoami) is NOT in group 'lp' — will get permission denied on /dev/usb/lp*"
    if $FIX; then
        echo "  → Running: sudo usermod -aG lp $(whoami)"
        sudo usermod -aG lp "$(whoami)"
        warn "Group change requires re-login or reboot to take effect"
    else
        info "Fix: sudo usermod -aG lp $(whoami)  (then re-login)"
    fi
fi

# ── 4. print-service.py device path ──────────────────────────────────────────
hdr "4. print-service.py configuration"
if [ ! -f "$SERVICE_SCRIPT" ]; then
    issue "$SERVICE_SCRIPT not found"
    CONFIGURED_DEV=""
else
    CONFIGURED_DEV=$(grep -oP 'PRINTER_DEV\s*=\s*"\K[^"]+' "$SERVICE_SCRIPT" || true)
    info "Configured device: ${CONFIGURED_DEV:-<not found>}"
    info "Actual device:     ${ACTUAL_DEV:-<none detected>}"

    if [ -z "$CONFIGURED_DEV" ]; then
        issue "Could not read PRINTER_DEV from $SERVICE_SCRIPT"
    elif [ -z "$ACTUAL_DEV" ]; then
        warn "Cannot compare — no actual device detected"
    elif [ "$CONFIGURED_DEV" = "$ACTUAL_DEV" ]; then
        ok "PRINTER_DEV matches actual device ($ACTUAL_DEV)"
    else
        issue "Mismatch: service uses $CONFIGURED_DEV but printer is at $ACTUAL_DEV"
        if $FIX; then
            echo "  → Updating $SERVICE_SCRIPT: $CONFIGURED_DEV → $ACTUAL_DEV"
            sed -i "s|PRINTER_DEV = \"$CONFIGURED_DEV\"|PRINTER_DEV = \"$ACTUAL_DEV\"|" "$SERVICE_SCRIPT"
            ok "Updated PRINTER_DEV to $ACTUAL_DEV"
            CONFIGURED_DEV="$ACTUAL_DEV"
        else
            info "Fix (no sudo): edit $SERVICE_SCRIPT → PRINTER_DEV = \"$ACTUAL_DEV\""
        fi
    fi
fi

# ── 5. print-service.py process + health ─────────────────────────────────────
hdr "5. Print service process"
SVC_PID=$(pgrep -f "python3 .*print-service.py" 2>/dev/null || true)
if [ -n "$SVC_PID" ]; then
    ok "print-service.py running (PID $SVC_PID)"
else
    issue "print-service.py is NOT running"
    if $FIX; then
        echo "  → Starting $SERVICE_SCRIPT in background"
        nohup python3 "$SERVICE_SCRIPT" >> /tmp/print-service.log 2>&1 &
        sleep 2
        SVC_PID=$(pgrep -f "python3 .*print-service.py" 2>/dev/null || true)
        [ -n "$SVC_PID" ] && ok "Started (PID $SVC_PID)" || issue "Failed to start — check /tmp/print-service.log"
    else
        info "Fix: python3 $SERVICE_SCRIPT &"
    fi
fi

info "Checking /health endpoint on port $SERVICE_PORT …"
if curl -sf --max-time 3 "http://127.0.0.1:$SERVICE_PORT/health" &>/dev/null; then
    ok "/health responded OK"
else
    issue "/health did not respond on port $SERVICE_PORT"
    if $FIX && [ -z "$SVC_PID" ]; then
        info "(Already attempted restart above)"
    elif $FIX; then
        echo "  → Service PID exists but /health failed; restarting"
        kill "$SVC_PID" 2>/dev/null || true
        sleep 1
        nohup python3 "$SERVICE_SCRIPT" >> /tmp/print-service.log 2>&1 &
        sleep 2
        curl -sf --max-time 3 "http://127.0.0.1:$SERVICE_PORT/health" &>/dev/null \
            && ok "/health OK after restart" \
            || issue "Still not responding — check /tmp/print-service.log"
    fi
fi

# ── 6. CUPS queue ─────────────────────────────────────────────────────────────
hdr "6. CUPS queue ($CUPS_QUEUE)"
if command -v lpstat &>/dev/null; then
    QUEUE_STATUS=$(lpstat -p "$CUPS_QUEUE" 2>/dev/null || echo "queue not found")
    info "$QUEUE_STATUS"

    # -W not-completed shows only queued/held/processing jobs (not history)
    STUCK_JOBS=$(lpstat -W not-completed 2>/dev/null | grep "^$CUPS_QUEUE-" || true)
    JOB_COUNT=$(echo "$STUCK_JOBS" | grep -c . || true)
    if [ "$JOB_COUNT" -gt 0 ]; then
        issue "$JOB_COUNT active job(s) stuck in queue"
        echo "$STUCK_JOBS" | head -10 | sed 's/^/         /'
        [ "$JOB_COUNT" -gt 10 ] && info "  … and $((JOB_COUNT - 10)) more"
        if $FIX; then
            echo "  → Cancelling all jobs: cancel -a $CUPS_QUEUE"
            cancel -a "$CUPS_QUEUE" 2>/dev/null && ok "All jobs cancelled" || warn "cancel failed (may need sudo)"
        else
            info "Fix: cancel -a $CUPS_QUEUE"
        fi
    else
        ok "No stuck jobs in queue"
    fi
else
    warn "lpstat not available; skipping CUPS queue check"
fi

# ── 7. CUPS device URI ────────────────────────────────────────────────────────
hdr "7. CUPS device URI"
if command -v lpoptions &>/dev/null; then
    CUPS_DEV_URI=$(lpoptions -p "$CUPS_QUEUE" 2>/dev/null | grep -oP 'device-uri=\K\S+' || true)
    info "CUPS device URI: ${CUPS_DEV_URI:-<not found>}"

    if [ -n "$ACTUAL_DEV" ] && [ -n "$CUPS_DEV_URI" ]; then
        # Extract the device path from the URI (e.g. parallel:/dev/usb/lp1 → /dev/usb/lp1)
        CUPS_DEV_PATH="${CUPS_DEV_URI#*:}"
        if [ "$CUPS_DEV_PATH" = "$ACTUAL_DEV" ]; then
            ok "CUPS URI matches actual device ($ACTUAL_DEV)"
        else
            issue "CUPS URI points to $CUPS_DEV_PATH but actual device is $ACTUAL_DEV"
            FIXED_URI="${CUPS_DEV_URI%:*}:$ACTUAL_DEV"
            if $FIX; then
                echo "  → Running: sudo lpadmin -p $CUPS_QUEUE -v $FIXED_URI"
                sudo lpadmin -p "$CUPS_QUEUE" -v "$FIXED_URI" \
                    && ok "CUPS URI updated to $FIXED_URI" \
                    || warn "lpadmin failed — may need to run manually"
            else
                info "Fix (sudo): sudo lpadmin -p $CUPS_QUEUE -v $FIXED_URI"
            fi
        fi
    fi
else
    warn "lpoptions not available; skipping CUPS URI check"
fi

# ── 8. Optional test print ────────────────────────────────────────────────────
if $TEST_PRINT; then
    hdr "8. Test print"
    DEV_TO_TEST="${ACTUAL_DEV:-$CONFIGURED_DEV}"
    if [ -z "$DEV_TO_TEST" ]; then
        warn "No device to test print to"
    else
        info "Sending test text to $DEV_TO_TEST via python-escpos …"
        python3 - <<PYEOF 2>&1 && ok "Test print sent to $DEV_TO_TEST" || issue "Test print failed"
from escpos.printer import File
p = File("$DEV_TO_TEST")
p.text("DIAG TEST OK\n")
p.text("printer-diag.sh\n")
p.cut()
p.close()
PYEOF
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
hdr "Summary"
if [ "$ISSUES" -eq 0 ]; then
    echo -e "  ${GRN}${BLD}All checks passed.${RST} Path B printing should work."
else
    echo -e "  ${RED}${BLD}$ISSUES issue(s) found.${RST}"
    if ! $FIX; then
        echo -e "  Re-run with ${BLD}--fix${RST} to auto-fix what's possible without sudo."
    fi
fi
echo ""
