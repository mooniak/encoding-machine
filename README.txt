AKURUGRAPHY — Exhibition Kiosk Setup
=====================================


PROJECT FILES
-------------
  index.html                  Main exhibition page
  AbhayaLibreNIGHTLYVF.ttf   Variable font (keep alongside index.html)
  opentype.min.js             Font parser — download once (see step 1)
  README.txt                  This file


STEP 1 — Download opentype.js (one-time, requires internet)
------------------------------------------------------------
Run this in the project folder:

  wget -O opentype.min.js https://cdn.jsdelivr.net/npm/opentype.js@latest/dist/opentype.min.js

After this the kiosk runs fully offline.


STEP 2 — Launch Chrome in kiosk mode
--------------------------------------
Replace /home/user/akurugraphy with your actual path:

  google-chrome --kiosk --no-first-run --disable-infobars \
    "file:///home/user/akurugraphy/index.html"

To exit kiosk mode: Alt+F4 or Ctrl+W


STEP 3 — Disable screen sleep
-------------------------------
Run before launching Chrome (or add to autostart script):

  xset s off
  xset -dpms
  xset s noblank


STEP 4 — Auto-start on boot (Lubuntu)
--------------------------------------
Create the file /etc/xdg/autostart/akurugraphy.desktop with this content:

  [Desktop Entry]
  Type=Application
  Name=Akurugraphy
  Exec=bash -c "xset s off; xset -dpms; xset s noblank; google-chrome --kiosk --no-first-run --disable-infobars 'file:///home/user/akurugraphy/index.html'"


WHAT THE EXHIBITION SHOWS
--------------------------
Three layers visualise the journey from typed text to rendered glyph:

  AREA 1  Input bar — type your name in any language (Sinhala, Tamil, English)
           Unicode codepoint sequence displayed below the input

  AREA 2  Unicode decomposition — one card per raw codepoint (pre-shaping)
           Shows: character preview, U+hex code, unshaped glyph name, binary

  CONNECTOR  Colour-coded SVG lines show how codepoints map to shaped glyphs
             (N codepoints can merge into M glyphs via GSUB substitution)

  AREA 3  Font rendering — one card per shaped glyph from Abhaya Libre
           Shows: bezier outline, control point handles, on-curve anchors


DEMO MODE
---------
On load the exhibition cycles through demo words automatically:
  Sinhala: ආදරය  ගෙදර  සිනහ
  Tamil:   அன்பு  கடல்  மலர்
  English: hello  light  smile

Each word is typed letter by letter, held for 25 seconds, then erased.
After 1 minute of no interaction the demo restarts automatically.
Pressing any key stops the demo and clears the input for visitor use.


FONT
----
Abhaya Libre NIGHTLY Variable Font
Embedded as base64 in index.html — no network request needed at runtime.
Source: https://github.com/mooniak/abhaya-libre-font
