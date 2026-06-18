# Thermal Printing Fix — Runbook for Claude Code (run on the Lubuntu kiosk)

You are running **on the Lubuntu exhibition machine** with direct access to the
shell, CUPS, the printer, and the ability to print live. Your job: make the
Encoding Machine kiosk print a clean 80mm thermal receipt with **(1) no Chrome
header/footer text, (2) no large empty space at top or bottom, and (3) length
matching the actual content (no fixed 297mm pad)**. Work independently: diagnose,
apply fixes, print a test after each change, and iterate until all three goals
are met.

Do not ask the user to do steps you can do yourself. Print real test receipts
(`F12`/`Enter` from the app, or the test commands below) and inspect the output.

---

## 1. Environment & facts

- Repo: `/home/mooniak/encoding-machine` (static HTML/CSS/JS, no build step).
- Launcher: `launch-kiosk-lubuntu.sh` runs Google Chrome with `--kiosk`,
  `--kiosk-printing`, `--user-data-dir=$HOME/.config/encoding-machine-kiosk`,
  and `--allow-file-access-from-files`. It also git-pulls and wipes the Chrome
  cache on every start.
- Printer: Xprinter **XP-80-T**, 80mm thermal, 203 dpi (72mm / 576px printable).
- CUPS PPD: `/etc/cups/ppd/XP-80-T.ppd` → **the queue name is `XP-80-T`**
  (the PPD filename always equals the queue name). PPD reports
  `*VariablePaperSize: True` and `*cupsManualCopies: True`.
- App print path (current): `printReceipt()` in `main.js` builds a hidden
  `#print-receipt`, waits for logo SVGs to load, measures its height, injects
  `@media print { @page { size: 80mm <height>mm; margin: 0 } }`, then calls
  `window.print()`. `style.css` hides everything except `#print-receipt` in
  `@media print`.

### Establish ground truth first (run these, record output)

```bash
lpstat -e                       # exact queue names
lpstat -p -d                    # queues + system default (kiosk prints to DEFAULT)
ls /etc/cups/ppd/               # confirm XP-80-T.ppd
lpoptions -p XP-80-T -l         # tunable options (PageSize list, etc.)
lpoptions -p XP-80-T            # current settings
grep -iE "VariablePaperSize|Custom|MaxMedia|HWMargins|ImageableArea|cupsFilter" /etc/cups/ppd/XP-80-T.ppd
```

If the default printer is NOT `XP-80-T`, fix immediately (kiosk-printing always
targets the system default):

```bash
sudo lpadmin -d XP-80-T
lpstat -d
```

---

## 2. Decide the strategy

There are two paths. Try Path A (tune the browser→CUPS pipeline). If after a
genuine effort the header still prints or length still pads, switch to **Path B
(direct ESC/POS)**, which is the definitive fix and what we ultimately want.

The three symptoms have independent root causes — fix and verify them one at a
time, do not assume one change fixes all:

1. **Header/footer band** (title / `file://` URL / date) → Chrome print headers.
2. **Top/bottom empty space** → either the header band (same as #1) OR the
   printer's fixed PageSize pad OR hardware pre-feed to the cutter.
3. **Fixed 297mm length** → CUPS PageSize / pdftopdf scaling.

---

## 3. Path A — fix the browser + CUPS pipeline

### 3a. Kill the Chrome header/footer (symptom #1)

The most common silent failure: the `print_header_footer: false` preference was
written to the wrong profile. The launcher uses
`--user-data-dir=$HOME/.config/encoding-machine-kiosk`, so it must be in THAT
profile, not `~/.config/google-chrome`.

```bash
grep -o 'print_header_footer[^,]*' ~/.config/encoding-machine-kiosk/Default/Preferences || echo "NOT SET in kiosk profile"
```

Bulletproof, profile-independent method — use a managed policy (preferred):

```bash
sudo mkdir -p /etc/opt/chrome/policies/managed /etc/chromium/policies/managed
echo '{ "PrintingEnabled": true, "PrintHeaderFooter": false }' \
  | sudo tee /etc/opt/chrome/policies/managed/kiosk.json /etc/chromium/policies/managed/kiosk.json
```

Fully quit Chrome (`pkill -x chrome; pkill -x chromium`), relaunch via the
launcher, open `chrome://policy` and confirm `PrintHeaderFooter = false` is
active. If the policy key is unsupported on the installed Chrome version, fall
back to writing `"print_header_footer": false` into the **kiosk** profile's
`Default/Preferences` (valid JSON, while Chrome is closed), and re-enforce it on
each launch.

Also confirm the running launcher actually contains `--kiosk-printing` (a stale
cached copy is possible):

```bash
grep -n "kiosk-printing" ~/encoding-machine/launch-kiosk-lubuntu.sh
ps aux | grep -- '--kiosk-printing' | grep -v grep
```

### 3b. Enable true variable length (symptoms #2/#3)

`*VariablePaperSize: True` means the driver can do continuous length, but a fixed
`PageSize` default keeps it in fixed mode. Put the queue in custom mode:

```bash
sudo lpadmin -p XP-80-T -o PageSize=Custom.80x150mm
lpoptions -p XP-80-T | tr ' ' '\n' | grep -i pagesize
```

Stop pdftopdf from scaling the custom-sized PDF up to the old preset:

```bash
lpoptions -p XP-80-T -o print-scaling=none
# or per-job: lp -o print-scaling=none ...
```

Verify the app's dynamic `@page` height actually reaches CUPS as a custom media
size. Print from the app (F12), then inspect the spooled job:

```bash
# Watch the job as it prints
tail -f /var/log/cups/error_log &
# print from the app, then look for the media/PageSize the job requested
grep -iE "media|PageSize|custom" /var/log/cups/error_log | tail -20
```

If Chrome is NOT sending the measured height (it sends the default media
instead), the kiosk-printing path may ignore `@page size`. In that case prefer
Path B, or print via `lp` from a localhost helper that sets
`-o PageSize=Custom.80x<height>mm` explicitly.

### 3c. Hardware pre-feed / top gap

If a small (3–5mm) top or bottom gap remains after 3a/3b, it is the printer
advancing paper to the cutter sensor — not software. Check the ESC/POS filter:

```bash
sudo sed -n '1,60p' /usr/lib/cups/filter/pdftoescpos
```

Look for a feed constant (e.g. `FEED_LINES_AFTER`) and reduce it (5 → 2). Do not
remove all feed or the cut may slice the last line. Re-test.

---

## 4. Path B — direct ESC/POS (definitive fix)

Use this if Path A still prints a header or pads length. It bypasses
`window.print()`, Chrome's print pipeline, and CUPS PageSize entirely, so no
header can exist and length is exact.

### 4a. Identify the device

```bash
lsusb                                   # note Xprinter vendor:product (e.g. 0483:5743 / 0416:5011)
ls -l /dev/usb/lp0 /dev/usb/lp* 2>/dev/null
groups                                  # ensure the kiosk user is in 'lp'/'dialout'; add if not
sudo usermod -aG lp mooniak             # then re-login/reboot for group to apply
```

### 4b. Install the library

```bash
pip3 install python-escpos pillow flask --break-system-packages
```

### 4c. Local print service

Create `print-service.py` in the repo. It listens on `127.0.0.1:9099`, accepts a
PNG (data URL) of the receipt, and prints it with a cut.

```python
#!/usr/bin/env python3
import base64, io
from flask import Flask, request
from PIL import Image
from escpos.printer import Usb, File

# Pick ONE connection. USB (use ids from lsusb):
#   p = Usb(0x0416, 0x5011)
# Or device file (often simplest/most robust):
#   p = File("/dev/usb/lp0")
def get_printer():
    try:
        return File("/dev/usb/lp0")
    except Exception:
        return Usb(0x0416, 0x5011)   # <-- replace with your lsusb ids

app = Flask(__name__)

@app.post("/print")
def do_print():
    data = request.json["png"].split(",", 1)[1]
    img = Image.open(io.BytesIO(base64.b64decode(data))).convert("L")
    # 576 px = 72 mm @ 203 dpi. Resize width to 576, keep aspect.
    w = 576
    img = img.resize((w, int(img.height * w / img.width)))
    p = get_printer()
    p.image(img)
    p.cut()
    return "ok"

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=9099)
```

Test it standalone before touching the app:

```bash
python3 print-service.py &
# create a tiny test png and POST it, or print directly:
python3 -c "from escpos.printer import File; p=File('/dev/usb/lp0'); p.text('TEST\n'); p.cut()"
```

### 4d. Wire the app to it

Bundle `html2canvas` locally (offline): download
`html2canvas.min.js` into the repo and add `<script src="./html2canvas.min.js"></script>`
to `index.html`. Change `printReceipt()` in `main.js` to render the receipt to a
576px-wide canvas and POST it, instead of `window.print()`:

```js
async function printReceipt() {
    if (!buildReceipt()) return;
    const imgs = [...receiptEl.querySelectorAll("img")];
    await Promise.all(imgs.map(i => i.complete && i.naturalWidth ? 0 :
        new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 1500); })));
    const canvas = await html2canvas(receiptEl, { backgroundColor: "#fff", scale: 1 });
    const png = canvas.toDataURL("image/png");
    try {
        await fetch("http://127.0.0.1:9099/print", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ png })
        });
    } catch (e) {
        window.print();   // fallback to browser path if service is down
    }
    setTimeout(() => input.focus(), 100);
}
```

Make `#print-receipt` measurable by html2canvas: it is already laid out
off-screen (`position:absolute; left:-10000px`), which html2canvas can capture.
Keep its width at 80mm/576px equivalent.

### 4e. Autostart the service

Add an autostart entry (XDG) or a line in the launcher so the service runs at
boot:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/print-service.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Receipt Print Service
Exec=python3 /home/mooniak/encoding-machine/print-service.py
Terminal=false
EOF
```

---

## 5. Test protocol (run after every change)

1. Hard-restart Chrome via the launcher (do not trust a running instance; cache
   and stale flags have caused false negatives before).
2. Type a short word and a long word; print each with `F12` and `Enter`.
3. Inspect the physical receipt for: header/URL/date band (must be gone), top
   gap, bottom gap, total length vs content.
4. For the browser path, also check `/var/log/cups/error_log` for the requested
   media size and any "scaling"/"unsupported media" warnings.
5. Confirm logos render (not blank) — if blank, the SVG load race or a missing
   file (`Akurugraphy_logo-print.svg`, `mooniak-logo-print.svg`) is the cause.

---

## 6. Troubleshooting matrix

- **Header/URL/date still prints** → wrong profile for the preference; use the
  managed policy (3a); confirm in `chrome://policy`; confirm `--kiosk-printing`
  is on the running process; if all else fails, go to Path B.
- **Still feeds ~297mm** → queue not in custom mode (re-run 3b), or
  `print-scaling` not `none`, or Chrome not sending custom media → Path B or
  `lp -o PageSize=Custom.80x<height>mm` from a helper.
- **Small constant top/bottom gap (3–5mm)** → hardware pre-feed; tune
  `pdftoescpos` feed constant (3c). Often acceptable; don't over-invest.
- **Receipt blank / partial** → logo SVG race (await image load), or font not
  loaded (Abhaya Libre embedded; Noto Sinhala/Tamil installed system-wide).
- **Logos blank** → file missing after git pull (confirm
  `ls /home/mooniak/encoding-machine/*.svg`), or SVG viewBox whitespace (use the
  `-print.svg` cropped variants).
- **Cached old code** → launcher already wipes cache; also hard-reload with `F5`;
  verify file mtimes after `git pull`.
- **Service unreachable (Path B)** → check `curl 127.0.0.1:9099/print`, the
  autostart entry, and that the kiosk user is in group `lp` with access to
  `/dev/usb/lp0`.
- **Permission denied on /dev/usb/lp0** → `sudo usermod -aG lp mooniak`, reboot.

---

## 7. Definition of done

- Print a short and a long receipt; both have **no** header/footer text, **no**
  top gap beyond unavoidable hardware pre-feed, and length within a few mm of the
  actual content (no fixed pad).
- Logos and all three subtitle scripts render.
- The chosen mechanism survives a reboot (autostart / policy / queue defaults
  persist).
- Commit all changes with a clear message. If Path B was used, commit
  `print-service.py`, `html2canvas.min.js`, the autostart entry, and the
  `main.js` change.
