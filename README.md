# Encoding Machine

**Part of the Akurugraphy exhibition by Mooniak**

An interactive kiosk that shows how a computer sees language — from a keystroke to a rendered glyph. Type any word in Sinhala, Tamil, or Latin (English, French, Dutch) and watch the machine break it down: Unicode codepoints, OpenType glyph IDs, shaped clusters, and the raw bezier geometry that draws each letter.

---

## What it does

Type something → the machine shows you three layers simultaneously:

1. **Unicode layer** — every character as its codepoint (U+0D9A, U+0020, …), binary value, and Unicode name
2. **Connector layer** — SVG lines tracing how codepoints map to glyphs after shaping (many-to-one for conjuncts)
3. **Glyph layer** — the actual drawn glyph with its baseline, advance width, OpenType glyph name, and the raw bezier path commands that define its outline

When idle, a demo animation cycles through words in Sinhala, Tamil, English, French, Dutch, and various numeral/punctuation forms — each chosen to show a different encoding feature.

---

## Scripts in the font

The machine uses **Abhaya Libre NIGHTLY** (variable font, `.ttf`), which contains Sinhala, Latin, and Tamil glyphs. Complex Sinhala conjuncts — rakaransaya (්‍ර), yansaya (්‍ය), al-lakuna stacks — are shaped using HarfBuzz (loaded from CDN) with OpenType.js as fallback.

| Script | Example complexity shown |
|--------|--------------------------|
| Sinhala | rakaransaya · yansaya · al-lakuna · double conjunct |
| Tamil | pulli clusters · geminate nasals · compound vowel signs |
| Latin | accented French (é â ç œ) · Dutch ij digraph + umlauts |
| Numerals | ASCII digits · percent · formatted numbers · π≈ |
| Punctuation | apostrophe · ampersand · at · arrow · equals |

---

## Controls

| Key | Action |
|-----|--------|
| Type anything | Render your own text; pauses the demo |
| `→` | Next demo word |
| `←` | Previous demo word |
| `↓` | Pause demo |
| `↑` | Resume demo |
| Clear the field | Demo restarts after 5 seconds |
| 2 minutes idle | Demo restarts automatically |

---

## Running it

### Open directly in a browser

Just open `index.html` in Chrome or Firefox. No server needed — everything runs locally. The font is embedded as base64 in `font-data.js` so it works on `file://` URLs without a web server.

Click or press any key once to enter fullscreen.

### Exhibition kiosk (recommended)

Double-click **`launch-kiosk.command`** in Finder. This launches Chrome in kiosk mode — fullscreen, no address bar, no tabs, cursor hidden. Requires Google Chrome to be installed in `/Applications`.

To exit kiosk mode: `Cmd+Q`.

> **First run on macOS:** Gatekeeper may block the `.command` file. Right-click → Open → Open to approve it once.

---

## File structure

```
encoding-machine/
├── index.html              HTML skeleton — loads all scripts
├── style.css               All layout and visual styles
├── main.js                 App logic — font parsing, rendering, demo loop
├── words.js                Demo word list — edit to change what cycles
├── font-data.js            Abhaya Libre font embedded as base64 (~800 KB)
├── AbhayaLibreNIGHTLYVF.ttf  Source font file (used by CSS @font-face)
├── launch-kiosk.command    macOS double-click launcher for Chrome kiosk
└── package.json            Project version manifest
```

### Editing the demo words

Open `words.js`. Words cycle **Sinhala → Tamil → Other** in groups of four. Add any word using standard Unicode — Sinhala conjuncts with ZWJ (`‍`), Tamil with pulli (`்`), accented Latin directly as UTF-8.

---

## Technical notes

- Runs entirely on `file://` — no build step, no server, no npm install required
- Font is parsed twice: once by CSS `@font-face` for display, once by OpenType.js for glyph data
- HarfBuzz GSUB shaping is loaded dynamically from CDN; falls back to OpenType.js `stringToGlyphs` if unavailable (e.g. offline)
- Post table format 3.0 (CFF fonts) stores no glyph names; the app falls back to a Unicode name lookup table
- `package.json` is a version manifest only — there are no dependencies and nothing to install

---

## Version

See `package.json`. Bump with:

```bash
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0
```

---

*Mooniak · [mooniak.com](https://mooniak.com)*
