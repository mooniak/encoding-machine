(async () => {
    // ── DOM refs ──────────────────────────────────────────────
    const input      = document.getElementById("textInput");
    const unicodeSeq = document.getElementById("unicode-seq");
    const cpRow      = document.getElementById("codepoints-row");
    const glyphsRow  = document.getElementById("glyphs-row");
    const connSVG    = document.getElementById("connector-svg");

    // ── Font (base64 embedded, works on file://) ──────────────
    function b64ToBuffer(b64) {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
    }
    const font = opentype.parse(b64ToBuffer(FONT_B64));

    // Unicode name lookup (populated by renderAll; shared with the print layout)
    let UNICODE_NAMES = {};

    // ── Fullscreen ────────────────────────────────────────────
    function enterFS() {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) req.call(el).catch(() => {});
        input.focus();
    }
    // Try immediately — works in Chrome kiosk mode, silently ignored elsewhere
    window.addEventListener("DOMContentLoaded", () => enterFS());
    // Fallback for normal browsers that require a gesture first
    document.addEventListener("click",   enterFS, { once: true });
    document.addEventListener("keydown", enterFS, { once: true });
    // Re-enter fullscreen if user exits (e.g. presses Esc)
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) enterFS();
    });
    document.addEventListener("webkitfullscreenchange", () => {
        if (!document.webkitFullscreenElement) enterFS();
    });

    // ── Always keep focus on input ────────────────────────────
    input.addEventListener("blur", () => setTimeout(() => input.focus(), 0));
    window.addEventListener("focus", () => input.focus());

    // ── Colour palette (one per shaped glyph) ─────────────────
    const PAL = ["#00ff41","#0088ff","#ff4488","#ffaa00","#aa44ff","#00ffcc","#ff6644"];

    // ── Merge Sinhala ra-prasaya / ya-prasaya sequences ───────
    function mergeSpecialClusters(clusters) {
        // virama (0DCA) + ZWJ (200D) + any Sinhala char — covers all ZWJ conjuncts
        const hasZWJConjunct = str => /්‍[඀-෿]/.test(str);

        let arr = [...clusters];
        let changed = true;
        while (changed) {
            changed = false;
            const out = [];
            let i = 0;
            while (i < arr.length) {
                if (hasZWJConjunct(arr[i])) {
                    out.push(arr[i++]);
                    continue;
                }
                let windowStr = arr[i];
                let windowEnd = i;
                let merged = false;
                while (windowEnd + 1 < arr.length && windowEnd < i + 4) {
                    windowEnd++;
                    windowStr += arr[windowEnd];
                    if (hasZWJConjunct(windowStr)) {
                        out.push(windowStr);
                        i = windowEnd + 1;
                        changed = true;
                        merged = true;
                        break;
                    }
                }
                if (!merged) { out.push(arr[i++]); }
            }
            arr = out;
        }

        // Absorb a trailing standalone al-lakuna into the preceding ZWJ-conjunct cluster.
        // e.g. segmenter may emit ["ක්‍ව", "්"] for ක්‍ව් — merge the lone ් back in.
        const final = [];
        for (let i = 0; i < arr.length; i++) {
            if (i > 0 && arr[i] === '්' && hasZWJConjunct(final[final.length - 1])) {
                final[final.length - 1] += arr[i];
            } else {
                final.push(arr[i]);
            }
        }
        return final;
    }

    // ── Render all three areas ─────────────────────────────────
    function renderAll() {
        cpRow.innerHTML = "";
        glyphsRow.innerHTML = "";
        connSVG.innerHTML = "";
        const text = input.value;
        if (!text) return;

        const chars = Array.from(text);

        // Split into grapheme clusters — each cluster = one shaped visual unit
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        let clusters = [...segmenter.segment(text)].map(s => s.segment);
        clusters = mergeSpecialClusters(clusters);

        // Build map: clusterIdx → [charIdx, ...] covering all codepoints in the cluster
        const map = clusters.map(() => []);
        let charPos = 0;
        clusters.forEach((cluster, ci) => {
            for (const _ of cluster) { map[ci].push(charPos++); }
        });

        // Per-char colour = colour of its cluster
        const charColour = new Array(chars.length).fill("#2a2a2a");
        map.forEach((src, ci) => src.forEach(charIdx => { charColour[charIdx] = PAL[ci % PAL.length]; }));

        UNICODE_NAMES = {
  32:'SPACE',
  33:'EXCLAMATION MARK',
  34:'QUOTATION MARK',
  35:'NUMBER SIGN',
  36:'DOLLAR SIGN',
  37:'PERCENT SIGN',
  38:'AMPERSAND',
  39:'APOSTROPHE',
  40:'LEFT PARENTHESIS',
  41:'RIGHT PARENTHESIS',
  42:'ASTERISK',
  43:'PLUS SIGN',
  44:'COMMA',
  45:'HYPHEN-MINUS',
  46:'FULL STOP',
  47:'SOLIDUS',
  48:'DIGIT ZERO',
  49:'DIGIT ONE',
  50:'DIGIT TWO',
  51:'DIGIT THREE',
  52:'DIGIT FOUR',
  53:'DIGIT FIVE',
  54:'DIGIT SIX',
  55:'DIGIT SEVEN',
  56:'DIGIT EIGHT',
  57:'DIGIT NINE',
  58:'COLON',
  59:'SEMICOLON',
  60:'LESS-THAN SIGN',
  61:'EQUALS SIGN',
  62:'GREATER-THAN SIGN',
  63:'QUESTION MARK',
  64:'COMMERCIAL AT',
  65:'LATIN CAPITAL LETTER A',
  66:'LATIN CAPITAL LETTER B',
  67:'LATIN CAPITAL LETTER C',
  68:'LATIN CAPITAL LETTER D',
  69:'LATIN CAPITAL LETTER E',
  70:'LATIN CAPITAL LETTER F',
  71:'LATIN CAPITAL LETTER G',
  72:'LATIN CAPITAL LETTER H',
  73:'LATIN CAPITAL LETTER I',
  74:'LATIN CAPITAL LETTER J',
  75:'LATIN CAPITAL LETTER K',
  76:'LATIN CAPITAL LETTER L',
  77:'LATIN CAPITAL LETTER M',
  78:'LATIN CAPITAL LETTER N',
  79:'LATIN CAPITAL LETTER O',
  80:'LATIN CAPITAL LETTER P',
  81:'LATIN CAPITAL LETTER Q',
  82:'LATIN CAPITAL LETTER R',
  83:'LATIN CAPITAL LETTER S',
  84:'LATIN CAPITAL LETTER T',
  85:'LATIN CAPITAL LETTER U',
  86:'LATIN CAPITAL LETTER V',
  87:'LATIN CAPITAL LETTER W',
  88:'LATIN CAPITAL LETTER X',
  89:'LATIN CAPITAL LETTER Y',
  90:'LATIN CAPITAL LETTER Z',
  91:'LEFT SQUARE BRACKET',
  92:'REVERSE SOLIDUS',
  93:'RIGHT SQUARE BRACKET',
  94:'CIRCUMFLEX ACCENT',
  95:'LOW LINE',
  96:'GRAVE ACCENT',
  97:'LATIN SMALL LETTER A',
  98:'LATIN SMALL LETTER B',
  99:'LATIN SMALL LETTER C',
  100:'LATIN SMALL LETTER D',
  101:'LATIN SMALL LETTER E',
  102:'LATIN SMALL LETTER F',
  103:'LATIN SMALL LETTER G',
  104:'LATIN SMALL LETTER H',
  105:'LATIN SMALL LETTER I',
  106:'LATIN SMALL LETTER J',
  107:'LATIN SMALL LETTER K',
  108:'LATIN SMALL LETTER L',
  109:'LATIN SMALL LETTER M',
  110:'LATIN SMALL LETTER N',
  111:'LATIN SMALL LETTER O',
  112:'LATIN SMALL LETTER P',
  113:'LATIN SMALL LETTER Q',
  114:'LATIN SMALL LETTER R',
  115:'LATIN SMALL LETTER S',
  116:'LATIN SMALL LETTER T',
  117:'LATIN SMALL LETTER U',
  118:'LATIN SMALL LETTER V',
  119:'LATIN SMALL LETTER W',
  120:'LATIN SMALL LETTER X',
  121:'LATIN SMALL LETTER Y',
  122:'LATIN SMALL LETTER Z',
  123:'LEFT CURLY BRACKET',
  124:'VERTICAL LINE',
  125:'RIGHT CURLY BRACKET',
  126:'TILDE',
  2946:'TAMIL SIGN ANUSVARA',
  2947:'TAMIL SIGN VISARGA',
  2949:'TAMIL LETTER A',
  2950:'TAMIL LETTER AA',
  2951:'TAMIL LETTER I',
  2952:'TAMIL LETTER II',
  2953:'TAMIL LETTER U',
  2954:'TAMIL LETTER UU',
  2958:'TAMIL LETTER E',
  2959:'TAMIL LETTER EE',
  2960:'TAMIL LETTER AI',
  2962:'TAMIL LETTER O',
  2963:'TAMIL LETTER OO',
  2964:'TAMIL LETTER AU',
  2965:'TAMIL LETTER KA',
  2969:'TAMIL LETTER NGA',
  2970:'TAMIL LETTER CA',
  2972:'TAMIL LETTER JA',
  2974:'TAMIL LETTER NYA',
  2975:'TAMIL LETTER TTA',
  2979:'TAMIL LETTER NNA',
  2980:'TAMIL LETTER TA',
  2984:'TAMIL LETTER NA',
  2985:'TAMIL LETTER NNNA',
  2986:'TAMIL LETTER PA',
  2990:'TAMIL LETTER MA',
  2991:'TAMIL LETTER YA',
  2992:'TAMIL LETTER RA',
  2993:'TAMIL LETTER RRA',
  2994:'TAMIL LETTER LA',
  2995:'TAMIL LETTER LLA',
  2996:'TAMIL LETTER LLLA',
  2997:'TAMIL LETTER VA',
  2998:'TAMIL LETTER SHA',
  2999:'TAMIL LETTER SSA',
  3000:'TAMIL LETTER SA',
  3001:'TAMIL LETTER HA',
  3006:'TAMIL VOWEL SIGN AA',
  3007:'TAMIL VOWEL SIGN I',
  3008:'TAMIL VOWEL SIGN II',
  3009:'TAMIL VOWEL SIGN U',
  3010:'TAMIL VOWEL SIGN UU',
  3014:'TAMIL VOWEL SIGN E',
  3015:'TAMIL VOWEL SIGN EE',
  3016:'TAMIL VOWEL SIGN AI',
  3018:'TAMIL VOWEL SIGN O',
  3019:'TAMIL VOWEL SIGN OO',
  3020:'TAMIL VOWEL SIGN AU',
  3021:'TAMIL SIGN VIRAMA',
  3024:'TAMIL OM',
  3031:'TAMIL AU LENGTH MARK',
  3046:'TAMIL DIGIT ZERO',
  3047:'TAMIL DIGIT ONE',
  3048:'TAMIL DIGIT TWO',
  3049:'TAMIL DIGIT THREE',
  3050:'TAMIL DIGIT FOUR',
  3051:'TAMIL DIGIT FIVE',
  3052:'TAMIL DIGIT SIX',
  3053:'TAMIL DIGIT SEVEN',
  3054:'TAMIL DIGIT EIGHT',
  3055:'TAMIL DIGIT NINE',
  3056:'TAMIL NUMBER TEN',
  3057:'TAMIL NUMBER ONE HUNDRED',
  3058:'TAMIL NUMBER ONE THOUSAND',
  3059:'TAMIL DAY SIGN',
  3060:'TAMIL MONTH SIGN',
  3061:'TAMIL YEAR SIGN',
  3062:'TAMIL DEBIT SIGN',
  3063:'TAMIL CREDIT SIGN',
  3064:'TAMIL AS ABOVE SIGN',
  3065:'TAMIL RUPEE SIGN',
  3066:'TAMIL NUMBER SIGN',
  3457:'SINHALA SIGN CANDRABINDU',
  3458:'SINHALA SIGN ANUSVARAYA',
  3459:'SINHALA SIGN VISARGAYA',
  3461:'SINHALA LETTER AYANNA',
  3462:'SINHALA LETTER AAYANNA',
  3463:'SINHALA LETTER AEYANNA',
  3464:'SINHALA LETTER AEEYANNA',
  3465:'SINHALA LETTER IYANNA',
  3466:'SINHALA LETTER IIYANNA',
  3467:'SINHALA LETTER UYANNA',
  3468:'SINHALA LETTER UUYANNA',
  3469:'SINHALA LETTER IRUYANNA',
  3470:'SINHALA LETTER IRUUYANNA',
  3471:'SINHALA LETTER ILUYANNA',
  3472:'SINHALA LETTER ILUUYANNA',
  3473:'SINHALA LETTER EYANNA',
  3474:'SINHALA LETTER EEYANNA',
  3475:'SINHALA LETTER AIYANNA',
  3476:'SINHALA LETTER OYANNA',
  3477:'SINHALA LETTER OOYANNA',
  3478:'SINHALA LETTER AUYANNA',
  3482:'SINHALA LETTER ALPAPRAANA KAYANNA',
  3483:'SINHALA LETTER MAHAAPRAANA KAYANNA',
  3484:'SINHALA LETTER ALPAPRAANA GAYANNA',
  3485:'SINHALA LETTER MAHAAPRAANA GAYANNA',
  3486:'SINHALA LETTER KANTAJA NAASIKYAYA',
  3487:'SINHALA LETTER SANYAKA GAYANNA',
  3488:'SINHALA LETTER ALPAPRAANA CAYANNA',
  3489:'SINHALA LETTER MAHAAPRAANA CAYANNA',
  3490:'SINHALA LETTER ALPAPRAANA JAYANNA',
  3491:'SINHALA LETTER MAHAAPRAANA JAYANNA',
  3492:'SINHALA LETTER TAALUJA NAASIKYAYA',
  3493:'SINHALA LETTER TAALUJA SANYOOGA NAAKSIKYAYA',
  3494:'SINHALA LETTER SANYAKA JAYANNA',
  3495:'SINHALA LETTER ALPAPRAANA TTAYANNA',
  3496:'SINHALA LETTER MAHAAPRAANA TTAYANNA',
  3497:'SINHALA LETTER ALPAPRAANA DDAYANNA',
  3498:'SINHALA LETTER MAHAAPRAANA DDAYANNA',
  3499:'SINHALA LETTER MUURDHAJA NAYANNA',
  3500:'SINHALA LETTER SANYAKA DDAYANNA',
  3501:'SINHALA LETTER ALPAPRAANA TAYANNA',
  3502:'SINHALA LETTER MAHAAPRAANA TAYANNA',
  3503:'SINHALA LETTER ALPAPRAANA DAYANNA',
  3504:'SINHALA LETTER MAHAAPRAANA DAYANNA',
  3505:'SINHALA LETTER DANTAJA NAYANNA',
  3507:'SINHALA LETTER SANYAKA DAYANNA',
  3508:'SINHALA LETTER ALPAPRAANA PAYANNA',
  3509:'SINHALA LETTER MAHAAPRAANA PAYANNA',
  3510:'SINHALA LETTER ALPAPRAANA BAYANNA',
  3511:'SINHALA LETTER MAHAAPRAANA BAYANNA',
  3512:'SINHALA LETTER MAYANNA',
  3513:'SINHALA LETTER AMBA BAYANNA',
  3514:'SINHALA LETTER YAYANNA',
  3515:'SINHALA LETTER RAYANNA',
  3517:'SINHALA LETTER DANTAJA LAYANNA',
  3520:'SINHALA LETTER VAYANNA',
  3521:'SINHALA LETTER TAALUJA SAYANNA',
  3522:'SINHALA LETTER MUURDHAJA SAYANNA',
  3523:'SINHALA LETTER DANTAJA SAYANNA',
  3524:'SINHALA LETTER HAYANNA',
  3525:'SINHALA LETTER MUURDHAJA LAYANNA',
  3526:'SINHALA LETTER FAYANNA',
  3530:'SINHALA SIGN AL-LAKUNA',
  3535:'SINHALA VOWEL SIGN AELA-PILLA',
  3536:'SINHALA VOWEL SIGN KETTI AEDA-PILLA',
  3537:'SINHALA VOWEL SIGN DIGA AEDA-PILLA',
  3538:'SINHALA VOWEL SIGN KETTI IS-PILLA',
  3539:'SINHALA VOWEL SIGN DIGA IS-PILLA',
  3540:'SINHALA VOWEL SIGN KETTI PAA-PILLA',
  3542:'SINHALA VOWEL SIGN DIGA PAA-PILLA',
  3544:'SINHALA VOWEL SIGN GAETTA-PILLA',
  3545:'SINHALA VOWEL SIGN KOMBUVA',
  3546:'SINHALA VOWEL SIGN DIGA KOMBUVA',
  3547:'SINHALA VOWEL SIGN KOMBU DEKA',
  3548:'SINHALA VOWEL SIGN KOMBUVA HAA AELA-PILLA',
  3549:'SINHALA VOWEL SIGN KOMBUVA HAA DIGA AELA-PILLA',
  3550:'SINHALA VOWEL SIGN KOMBUVA HAA GAYANUKITTA',
  3551:'SINHALA VOWEL SIGN GAYANUKITTA',
  3558:'SINHALA LITH DIGIT ZERO',
  3559:'SINHALA LITH DIGIT ONE',
  3560:'SINHALA LITH DIGIT TWO',
  3561:'SINHALA LITH DIGIT THREE',
  3562:'SINHALA LITH DIGIT FOUR',
  3563:'SINHALA LITH DIGIT FIVE',
  3564:'SINHALA LITH DIGIT SIX',
  3565:'SINHALA LITH DIGIT SEVEN',
  3566:'SINHALA LITH DIGIT EIGHT',
  3567:'SINHALA LITH DIGIT NINE',
  3570:'SINHALA VOWEL SIGN DIGA GAETTA-PILLA',
  3571:'SINHALA VOWEL SIGN DIGA GAYANUKITTA',
  3572:'SINHALA PUNCTUATION KUNDDALIYA',
  70113:'SINHALA ARCHAIC DIGIT ONE',
  70114:'SINHALA ARCHAIC DIGIT TWO',
  70115:'SINHALA ARCHAIC DIGIT THREE',
  70116:'SINHALA ARCHAIC DIGIT FOUR',
  70117:'SINHALA ARCHAIC DIGIT FIVE',
  70118:'SINHALA ARCHAIC DIGIT SIX',
  70119:'SINHALA ARCHAIC DIGIT SEVEN',
  70120:'SINHALA ARCHAIC DIGIT EIGHT',
  70121:'SINHALA ARCHAIC DIGIT NINE',
  70122:'SINHALA ARCHAIC NUMBER TEN',
  70123:'SINHALA ARCHAIC NUMBER TWENTY',
  70124:'SINHALA ARCHAIC NUMBER THIRTY',
  70125:'SINHALA ARCHAIC NUMBER FORTY',
  70126:'SINHALA ARCHAIC NUMBER FIFTY',
  70127:'SINHALA ARCHAIC NUMBER SIXTY',
  70128:'SINHALA ARCHAIC NUMBER SEVENTY',
  70129:'SINHALA ARCHAIC NUMBER EIGHTY',
  70130:'SINHALA ARCHAIC NUMBER NINETY',
  70131:'SINHALA ARCHAIC NUMBER ONE HUNDRED',
  70132:'SINHALA ARCHAIC NUMBER ONE THOUSAND'
};

        // ── Area 2: one card per codepoint ──
        const cpEls = [];
        const cpGlyphNames = [];
        chars.forEach((c, ci) => {
            const cp  = c.codePointAt(0);
            const hex = "U+" + cp.toString(16).toUpperCase().padStart(4,"0");
            const bin = cp.toString(2).padStart(16,"0").match(/.{4}/g).join(" ");
            const gIdx = font.charToGlyphIndex(c);
            const g    = font.glyphs.get(gIdx);
            const col  = charColour[ci];
            cpGlyphNames.push(gIdx === 0 ? hex : (g?.name || hex));

            const el = document.createElement("div");
            el.className = "cp-card";
            el.style.borderTopColor = col;
            el.innerHTML =
                `<span class="cp-char">${c}</span>` +
                `<div class="cp-info">` +
                    `<span class="cp-hex">${hex}</span>` +
                    `<span class="cp-name">${UNICODE_NAMES[cp] || hex}</span>` +
                    `<span class="cp-bin">${bin}</span>` +
                `</div>`;
            cpRow.appendChild(el);
            cpEls.push(el);
        });

        // ── Area 3: one card per grapheme cluster (post-GSUB shaped) ──
        const availW = glyphsRow.clientWidth  || (window.innerWidth  - 80);
        const availH = glyphsRow.clientHeight || (window.innerHeight - 350);
        const gwW = Math.floor((availW - 12 * clusters.length) / clusters.length);
        // Leave ~120px below canvas for glyph-name + glyph-sub + bezier-data + gaps
        const gwH = Math.max(60, availH - 120);
        const gw  = Math.max(80, Math.min(gwW, gwH, 220));
        document.documentElement.style.setProperty("--glyph-w", gw + "px");

        const glyphEls = [];
        const clusterShapedNames = [];
        clusters.forEach((cluster, ci) => {
            const col = PAL[ci % PAL.length];

            const card = document.createElement("div");
            card.className = "glyph-card";

            const wrap = document.createElement("div");
            wrap.className = "glyph-canvas-wrap";
            wrap.style.borderTopColor = col;

            const canvas = document.createElement("canvas");
            wrap.appendChild(canvas);
            card.appendChild(wrap);

            const shaped = shapeCluster(cluster);
            const _notdef = sg => sg.glyphId === 0;
            const _cpHex  = str => [...str].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join('+');
            // post-3.0 fonts store no glyph names; fall back to unicode → UNICODE_NAMES → hex
            const _glyphName = sg => {
                const g = font.glyphs.get(sg.glyphId);
                const n = g?.name;
                if (n && n !== '.notdef') return n;
                const u = g?.unicode;
                if (u) return UNICODE_NAMES[u] || ('U+' + u.toString(16).toUpperCase().padStart(4,'0'));
                return 'GID' + sg.glyphId;
            };
            const allNotdef = shaped.every(_notdef);
            const shapedLabel = allNotdef
                ? _cpHex(cluster)
                : shaped.map(sg => _notdef(sg) ? _cpHex(String.fromCodePoint(sg.glyphId)) : _glyphName(sg)).join('+');
            clusterShapedNames.push(shapedLabel);
            const meta = document.createElement("div");
            meta.style.maxWidth = gw + 'px';
            meta.innerHTML = allNotdef
                ? `<div class="glyph-name">${_cpHex(cluster)}</div><div class="glyph-sub">not in font</div>`
                : `<div class="glyph-name">${shapedLabel}</div><div class="glyph-sub">GID ${shaped.map(sg => sg.glyphId).join('+')}</div>`;
            card.appendChild(meta);

            // Bezier point data box
            let bCurX = 0;
            const bCmds = [];
            shaped.forEach(sg => {
                const bg = font.glyphs.get(sg.glyphId);
                if (!bg?.path) { bCurX += sg.xAdvance; return; }
                const dx = bCurX + sg.xOffset, dy = sg.yOffset;
                bg.path.commands.forEach(cmd => {
                    const ax = v => Math.round(dx + v), ay = v => Math.round(dy + v);
                    if      (cmd.type === "M") bCmds.push(`M${ax(cmd.x)} ${ay(cmd.y)}`);
                    else if (cmd.type === "L") bCmds.push(`L${ax(cmd.x)} ${ay(cmd.y)}`);
                    else if (cmd.type === "C") bCmds.push(`C${ax(cmd.x1)} ${ay(cmd.y1)} ${ax(cmd.x2)} ${ay(cmd.y2)} ${ax(cmd.x)} ${ay(cmd.y)}`);
                    else if (cmd.type === "Q") bCmds.push(`Q${ax(cmd.x1)} ${ay(cmd.y1)} ${ax(cmd.x)} ${ay(cmd.y)}`);
                    else if (cmd.type === "Z") bCmds.push("Z");
                });
                bCurX += sg.xAdvance;
            });
            const bezierEl = document.createElement("div");
            bezierEl.className = "bezier-data";
            bezierEl.style.maxWidth = gw + 'px';
            bezierEl.textContent = bCmds.join(" ") || "—";
            card.appendChild(bezierEl);

            glyphsRow.appendChild(card);
            glyphEls.push(card);

            const hasPath = shaped.some(sg => font.glyphs.get(sg.glyphId)?.path?.commands?.length > 0);
            if (hasPath) {
                drawClusterAnatomy(cluster, canvas, gw);
            }
        });

        // Draw SVG connector lines after layout settles
        setTimeout(() => drawConnector(cpEls, glyphEls, map, cpGlyphNames, clusterShapedNames), 60);
    }

    // ── SVG connector ─────────────────────────────────────────
    function drawConnector(cpEls, glyphEls, map, cpGlyphNames, clusterShapedNames) {
        connSVG.innerHTML = "";
        const svgRect = connSVG.getBoundingClientRect();
        if (!svgRect.width) return;
        const svgH = svgRect.height;

        const PILL_H = 18;
        const CONNECTOR_LEN = 15;

        map.forEach((srcIdxs, gi) => {
            const destEl = glyphEls[gi];
            if (!destEl) return;
            const destRect = destEl.getBoundingClientRect();
            const destX = destRect.left + destRect.width / 2 - svgRect.left;
            const destY = svgH - 1;
            const col = PAL[gi % PAL.length];

            if (srcIdxs.length === 1) {
                // single codepoint — simple S-curve
                const srcEl = cpEls[srcIdxs[0]];
                if (!srcEl) return;
                const srcRect = srcEl.getBoundingClientRect();
                const srcX = srcRect.left + srcRect.width / 2 - svgRect.left;
                const path = document.createElementNS("http://www.w3.org/2000/svg","path");
                path.setAttribute("d",
                    `M ${srcX} 1 C ${srcX} ${svgH * 0.6}, ${destX} ${svgH * 0.4}, ${destX} ${destY}`);
                path.setAttribute("stroke", col);
                path.setAttribute("stroke-width", "1.5");
                path.setAttribute("fill", "none");
                path.setAttribute("opacity", "0.75");
                connSVG.appendChild(path);

            } else {
                // compound cluster: lines + cp-name pills + compound pill + 15px stub
                const pillText = clusterShapedNames[gi] || '?';
                const pillW    = Math.max(50, pillText.length * 5.4 + 16);
                const pillBot  = destY - CONNECTOR_LEN;
                const pillTop  = pillBot - PILL_H;
                const pillCY   = pillTop + PILL_H / 2;
                const pillX    = destX - pillW / 2;

                const CP_PH  = 15;  // cp-name pill height
                const CP_GAP = 10;  // gap between cp-name pill bottom and compound pill top

                srcIdxs.forEach(ci => {
                    const srcEl = cpEls[ci];
                    if (!srcEl) return;
                    const srcRect = srcEl.getBoundingClientRect();
                    const srcX = srcRect.left + srcRect.width / 2 - svgRect.left;

                    // Bezier ending at pill top
                    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
                    path.setAttribute("d",
                        `M ${srcX} 1 C ${srcX} ${pillTop * 0.7}, ${destX} ${pillTop * 0.5}, ${destX} ${pillTop}`);
                    path.setAttribute("stroke", col);
                    path.setAttribute("stroke-width", "1.5");
                    path.setAttribute("fill", "none");
                    path.setAttribute("opacity", "0.75");
                    connSVG.appendChild(path);

                    // Cp-name pill: positioned 65% of the way from src to dest, above compound pill
                    const cpName  = cpGlyphNames[ci] || '?';
                    const cpPillW = Math.max(38, cpName.length * 5.4 + 14);
                    const cpPillCX = srcX + (destX - srcX) * 0.65;
                    const cpPillBot = pillTop - CP_GAP;
                    const cpPillTop = cpPillBot - CP_PH;
                    const cpPillX   = cpPillCX - cpPillW / 2;

                    const cpRect = document.createElementNS("http://www.w3.org/2000/svg","rect");
                    cpRect.setAttribute("x", cpPillX);
                    cpRect.setAttribute("y", cpPillTop);
                    cpRect.setAttribute("width", cpPillW);
                    cpRect.setAttribute("height", CP_PH);
                    cpRect.setAttribute("rx", CP_PH / 2);
                    cpRect.setAttribute("ry", CP_PH / 2);
                    cpRect.setAttribute("fill", "#111");
                    cpRect.setAttribute("stroke", col);
                    cpRect.setAttribute("stroke-width", "1");
                    connSVG.appendChild(cpRect);

                    const cpText = document.createElementNS("http://www.w3.org/2000/svg","text");
                    cpText.setAttribute("x", cpPillCX);
                    cpText.setAttribute("y", cpPillTop + CP_PH / 2 + 3);
                    cpText.setAttribute("text-anchor", "middle");
                    cpText.setAttribute("fill", col);
                    cpText.setAttribute("font-size", "9");
                    cpText.setAttribute("font-family", "Noto Sans Sinhala, Noto Sans Tamil, Courier New, monospace");
                    cpText.textContent = cpName;
                    connSVG.appendChild(cpText);
                });

                // Compound glyph pill background
                const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
                rect.setAttribute("x", pillX);
                rect.setAttribute("y", pillTop);
                rect.setAttribute("width", pillW);
                rect.setAttribute("height", PILL_H);
                rect.setAttribute("rx", PILL_H / 2);
                rect.setAttribute("ry", PILL_H / 2);
                rect.setAttribute("fill", "#111");
                rect.setAttribute("stroke", col);
                rect.setAttribute("stroke-width", "1");
                connSVG.appendChild(rect);

                // Compound glyph name
                const pillLabel = document.createElementNS("http://www.w3.org/2000/svg","text");
                pillLabel.setAttribute("x", destX);
                pillLabel.setAttribute("y", pillCY + 3);
                pillLabel.setAttribute("text-anchor", "middle");
                pillLabel.setAttribute("fill", col);
                pillLabel.setAttribute("font-size", "9");
                pillLabel.setAttribute("font-family", "Noto Sans Sinhala, Noto Sans Tamil, Courier New, monospace");
                pillLabel.textContent = pillText;
                connSVG.appendChild(pillLabel);

                // 15px stub from pill bottom to glyph card
                const stub = document.createElementNS("http://www.w3.org/2000/svg","line");
                stub.setAttribute("x1", destX); stub.setAttribute("y1", pillBot);
                stub.setAttribute("x2", destX); stub.setAttribute("y2", destY);
                stub.setAttribute("stroke", col);
                stub.setAttribute("stroke-width", "1.5");
                stub.setAttribute("opacity", "0.75");
                connSVG.appendChild(stub);
            }
        });
    }

    // ── Cluster bezier canvas (post-GSUB shaped glyphs, font-unit coordinates) ──
    function drawClusterAnatomy(text, canvas, size) {
        const ctx = canvas.getContext("2d");
        const h = canvas.height = size;
        const fs = h * 0.79;
        const sc = fs / font.unitsPerEm;

        const shaped = shapeCluster(text);
        if (!shaped.length) return;
        const totalAdv = shaped.reduce((s, sg) => s + sg.xAdvance, 0);
        const glyphPx = totalAdv * sc;
        const w = canvas.width = Math.max(h, Math.ceil(glyphPx + h * 0.24));
        const ox = (w - glyphPx) / 2;
        const oy = h / 2 + sc * (font.ascender + font.descender) / 2;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "#ebebeb";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
        ctx.setLineDash([]);

        // Build flat command list using HarfBuzz-shaped GIDs + GPOS positions (font units).
        let curX = 0;
        const cmds = [];
        shaped.forEach(sg => {
            const glyph = font.glyphs.get(sg.glyphId);
            if (!glyph?.path) { curX += sg.xAdvance; return; }
            const dx = curX + sg.xOffset;
            const dy = sg.yOffset;
            glyph.path.commands.forEach(cmd => {
                const tc = { type: cmd.type };
                if (cmd.x  !== undefined) tc.x  = dx + cmd.x;
                if (cmd.y  !== undefined) tc.y  = dy + cmd.y;
                if (cmd.x1 !== undefined) tc.x1 = dx + cmd.x1;
                if (cmd.y1 !== undefined) tc.y1 = dy + cmd.y1;
                if (cmd.x2 !== undefined) tc.x2 = dx + cmd.x2;
                if (cmd.y2 !== undefined) tc.y2 = dy + cmd.y2;
                cmds.push(tc);
            });
            curX += sg.xAdvance;
        });
        if (!cmds.length) return;

        // Handle lines (bezier tangent handles)
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(255,60,60,0.35)";
        let lx = 0, ly = 0;
        cmds.forEach(cmd => {
            const cx = ox + (cmd.x || 0) * sc, cy = oy - (cmd.y || 0) * sc;
            if (cmd.type === "C") {
                const c1x = ox + cmd.x1*sc, c1y = oy - cmd.y1*sc;
                const c2x = ox + cmd.x2*sc, c2y = oy - cmd.y2*sc;
                ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(c1x,c1y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(c2x,c2y); ctx.stroke();
            } else if (cmd.type === "Q") {
                const qx = ox + cmd.x1*sc, qy = oy - cmd.y1*sc;
                ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(qx,qy); ctx.lineTo(cx,cy); ctx.stroke();
            }
            if (cmd.type !== "Z") { lx = cx; ly = cy; }
        });

        // Outline (no fill)
        ctx.beginPath();
        cmds.forEach(cmd => {
            const x = ox + (cmd.x||0)*sc, y = oy - (cmd.y||0)*sc;
            if      (cmd.type === "M") ctx.moveTo(x, y);
            else if (cmd.type === "L") ctx.lineTo(x, y);
            else if (cmd.type === "C") ctx.bezierCurveTo(ox+cmd.x1*sc, oy-cmd.y1*sc, ox+cmd.x2*sc, oy-cmd.y2*sc, x, y);
            else if (cmd.type === "Q") ctx.quadraticCurveTo(ox+cmd.x1*sc, oy-cmd.y1*sc, x, y);
            else if (cmd.type === "Z") ctx.closePath();
        });
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Off-curve (control) points — red dots
        cmds.forEach(cmd => {
            const pts = cmd.type === "C" ? [[cmd.x1,cmd.y1],[cmd.x2,cmd.y2]]
                      : cmd.type === "Q" ? [[cmd.x1,cmd.y1]] : [];
            pts.forEach(([px,py]) => {
                ctx.fillStyle = "#ff3c3c";
                ctx.beginPath();
                ctx.arc(ox+px*sc, oy-py*sc, 2.5, 0, Math.PI*2);
                ctx.fill();
            });
        });

        // On-curve (anchor) points — blue squares
        cmds.forEach(cmd => {
            if (!["M","L","C","Q"].includes(cmd.type)) return;
            const x = ox+(cmd.x||0)*sc, y = oy-(cmd.y||0)*sc;
            ctx.fillStyle = "#0055ff";
            ctx.fillRect(x-2.5, y-2.5, 5, 5);
        });
    }

    // ── Glyph bezier canvas ───────────────────────────────────
    function drawAnatomy(glyph, canvas, size) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width  = size;
        const h = canvas.height = size;
        const fs = w * 0.79;
        const sc = fs / font.unitsPerEm;
        const ox = Math.max(4, (w - (glyph.advanceWidth || 0) * sc) / 2);
        const oy = h / 2 + sc * (font.ascender + font.descender) / 2;

        // Background
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);

        // Baseline
        ctx.strokeStyle = "#ebebeb";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
        ctx.setLineDash([]);

        // Handle lines (behind outline)
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(255,60,60,0.35)";
        let lx = 0, ly = 0;
        glyph.path.commands.forEach(cmd => {
            const cx = ox + (cmd.x || 0) * sc;
            const cy = oy - (cmd.y || 0) * sc;
            if (cmd.type === "C") {
                const c1x = ox + cmd.x1*sc, c1y = oy - cmd.y1*sc;
                const c2x = ox + cmd.x2*sc, c2y = oy - cmd.y2*sc;
                ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(c1x,c1y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(c2x,c2y); ctx.stroke();
            } else if (cmd.type === "Q") {
                const qx = ox + cmd.x1*sc, qy = oy - cmd.y1*sc;
                ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(qx,qy); ctx.lineTo(cx,cy); ctx.stroke();
            }
            if (cmd.type !== "Z") { lx = cx; ly = cy; }
        });

        // Outline (no fill)
        ctx.beginPath();
        glyph.path.commands.forEach(cmd => {
            const x = ox + (cmd.x||0)*sc, y = oy - (cmd.y||0)*sc;
            if      (cmd.type === "M") ctx.moveTo(x, y);
            else if (cmd.type === "L") ctx.lineTo(x, y);
            else if (cmd.type === "C") ctx.bezierCurveTo(ox+cmd.x1*sc, oy-cmd.y1*sc, ox+cmd.x2*sc, oy-cmd.y2*sc, x, y);
            else if (cmd.type === "Q") ctx.quadraticCurveTo(ox+cmd.x1*sc, oy-cmd.y1*sc, x, y);
            else if (cmd.type === "Z") ctx.closePath();
        });
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Off-curve (control) points — red dots
        glyph.path.commands.forEach(cmd => {
            const pts = cmd.type === "C" ? [[cmd.x1,cmd.y1],[cmd.x2,cmd.y2]]
                      : cmd.type === "Q" ? [[cmd.x1,cmd.y1]] : [];
            pts.forEach(([px,py]) => {
                ctx.fillStyle = "#ff3c3c";
                ctx.beginPath();
                ctx.arc(ox+px*sc, oy-py*sc, 2.5, 0, Math.PI*2);
                ctx.fill();
            });
        });

        // On-curve (anchor) points — blue squares
        glyph.path.commands.forEach(cmd => {
            if (!["M","L","C","Q"].includes(cmd.type)) return;
            const x = ox+(cmd.x||0)*sc, y = oy-(cmd.y||0)*sc;
            ctx.fillStyle = "#0055ff";
            ctx.fillRect(x-2.5, y-2.5, 5, 5);
        });
    }

    // ── Unicode seq display ───────────────────────────────────
    function updateUnicodeSeq(text) {
        unicodeSeq.textContent = text
            ? Array.from(text).map(c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")).join("  ")
            : "";
    }

    let demoToken  = null;
    let demoIdx    = Math.floor(Math.random() * DEMO_WORDS.length);
    let demoPaused = false;

    // ── Progress bar ──────────────────────────────────────────
    const _pb = document.getElementById("progress-bar");
    function pbStart(ms) {
        _pb.style.transition = "none";
        _pb.style.width = "0%";
        requestAnimationFrame(() => requestAnimationFrame(() => {
            _pb.style.transition = `width ${ms}ms linear`;
            _pb.style.width = "100%";
        }));
    }
    function pbStop() {
        _pb.style.transition = "none";
        _pb.style.width = "0%";
    }

    function stopDemo() {
        if (demoToken) { demoToken.cancelled = true; demoToken = null; }
        pbStop();
    }

    async function startDemo() {
        const token = { cancelled: false };
        demoToken = token;
        demoPaused = false;
        updateDemoHud();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        while (!token.cancelled) {
            const word  = DEMO_WORDS[demoIdx % DEMO_WORDS.length];
            const chars = Array.from(word);
            for (let i = 1; i <= chars.length; i++) {
                if (token.cancelled) return;
                input.value = chars.slice(0,i).join("");
                updateUnicodeSeq(input.value);
                renderAll();
                await sleep(120);
            }
            pbStart(25000);
            await sleep(25000);
            pbStop();
            if (token.cancelled) return;
            for (let i = chars.length - 1; i >= 0; i--) {
                if (token.cancelled) return;
                input.value = chars.slice(0,i).join("");
                updateUnicodeSeq(input.value);
                if (input.value) renderAll(); else clearAll();
                await sleep(70);
            }
            await sleep(500);
            demoIdx = (demoIdx + 1) % DEMO_WORDS.length;
        }
    }

    function demoJump(offset) {
        stopDemo();
        demoIdx = ((demoIdx + offset) % DEMO_WORDS.length + DEMO_WORDS.length) % DEMO_WORDS.length;
        clearAll();
        demoPaused = false;
        startDemo();
        resetIdle();
    }

    function demoTogglePause() {
        if (demoToken) {
            stopDemo();
            demoPaused = true;
        } else {
            demoPaused = false;
            startDemo();
            resetIdle();
        }
        updateDemoHud();
    }

    function demoPause() {
        if (demoToken) {
            stopDemo();
            demoPaused = true;
            updateDemoHud();
        }
    }

    function demoResume() {
        if (!demoToken) {
            demoPaused = false;
            startDemo();
            resetIdle();
            updateDemoHud();
        }
    }

    function updateDemoHud() {
        const el = document.getElementById("demo-status");
        if (el) el.textContent = demoPaused ? "▐▐" : "▶";
    }

    // ── Idle reset ────────────────────────────────────────────
    let idleTimer = null;
    function resetIdle(ms = 120000) {
        clearTimeout(idleTimer);
        pbStart(ms);
        idleTimer = setTimeout(() => { clearAll(); startDemo(); }, ms);
    }

    function clearAll() {
        pbStop();
        input.value = "";
        unicodeSeq.textContent = "";
        cpRow.innerHTML = "";
        glyphsRow.innerHTML = "";
        connSVG.innerHTML = "";
    }

    // ── Thermal receipt printing (80 mm strip) ────────────────
    const receiptEl = document.getElementById("print-receipt");

    const escHTML = s => s.replace(/[&<>"]/g, c =>
        ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

    function cpName(cp) {
        return UNICODE_NAMES[cp] || ("U+" + cp.toString(16).toUpperCase().padStart(4,"0"));
    }

    function buildReceipt() {
        const text = input.value.trim();
        if (!text) return false;
        const chars = Array.from(text);

        // Sequence of OpenType glyph names for the shaped text.
        function glyphNameSequence(str) {
            const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            let clusters = [...seg.segment(str)].map(s => s.segment);
            clusters = mergeSpecialClusters(clusters);
            const names = [];
            clusters.forEach(cl => {
                shapeCluster(cl).forEach(sg => {
                    if (sg.glyphId === 0) {
                        names.push("U+" + cl.codePointAt(0).toString(16).toUpperCase().padStart(4,"0"));
                        return;
                    }
                    const g = font.glyphs.get(sg.glyphId);
                    const n = g?.name;
                    if (n && n !== ".notdef") { names.push(n); return; }
                    const u = g?.unicode;
                    names.push(u ? (UNICODE_NAMES[u] || ("U+" + u.toString(16).toUpperCase().padStart(4,"0")))
                                 : ("GID" + sg.glyphId));
                });
            });
            return names;
        }
        const glyphNames = glyphNameSequence(text);

        // One block per codepoint: glyph, U+hex, binary, Unicode name.
        const rows = chars.map(c => {
            const cp  = c.codePointAt(0);
            const hex = "U+" + cp.toString(16).toUpperCase().padStart(4,"0");
            const bin = cp.toString(2).padStart(16,"0").match(/.{4}/g).join(" ");
            return (
                `<div class="r-cp">` +
                    `<div class="r-cp-char">${escHTML(c)}</div>` +
                    `<div class="r-cp-data">` +
                        `<div class="r-hex">${hex}</div>` +
                        `<div class="r-bin">${bin}</div>` +
                        `<div class="r-name">${escHTML(cpName(cp))}</div>` +
                    `</div>` +
                `</div>`
            );
        }).join("");

        const dateStr = new Date().toLocaleDateString(undefined,
            { year: "numeric", month: "long", day: "numeric" });

        const glyphSeq = glyphNames.map(n => escHTML(n)).join("  ›  ");

        receiptEl.innerHTML =
            `<img class="r-top-logo" src="Akurugraphy_logo.svg" alt="Akurugraphy">` +
            `<div class="r-sub">how machines see language</div>` +
            `<div class="r-sub">පරිගණකය බස දකින හැටි</div>` +
            `<div class="r-sub">கணினிக்கு எழுத்துக்கள் புலப்படும் விதம்</div>` +
            `<div class="r-rule"></div>` +
            `<div class="r-string">${escHTML(text)}</div>` +
            `<div class="r-label">GLYPH NAMES</div>` +
            `<div class="r-glyphseq">${glyphSeq}</div>` +
            `<div class="r-rule"></div>` +
            `<div class="r-label">UNICODE · ${chars.length} codepoint${chars.length>1?"s":""}</div>` +
            rows +
            `<div class="r-rule"></div>` +
            `<div class="r-foot">` +
                `<img class="r-logo" src="mooniak-logo-print.svg" alt="mooniak">` +
                `<div class="r-issued">Issued at the Akurugraphy exhibition on ${escHTML(dateStr)}</div>` +
                `<div class="r-more">mooniak.com for more</div>` +
            `</div>`;
        return true;
    }

    function printReceipt() {
        if (!buildReceipt()) return;
        window.print();
        setTimeout(() => input.focus(), 100);
    }

    // Enter (in the text field) prints the current word directly.
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); printReceipt(); }
    });
    // F12, or Ctrl+P / Cmd+P → print our receipt (no browser dialog in kiosk).
    document.addEventListener("keydown", e => {
        if (e.key === "F12") { e.preventDefault(); printReceipt(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
            e.preventDefault();
            printReceipt();
        }
    });

    // ── Global demo keyboard controls ─────────────────────────
    document.addEventListener("keydown", e => {
        if (e.target === input) return;  // input handles its own arrows below
        if (e.key === "ArrowRight") { e.preventDefault(); demoJump(1); return; }
        if (e.key === "ArrowLeft")  { e.preventDefault(); demoJump(-1); return; }
        if (e.key === "ArrowDown")  { e.preventDefault(); demoPause(); return; }
        if (e.key === "ArrowUp")    { e.preventDefault(); demoResume(); return; }
        if (e.key === "[")  { e.preventDefault(); demoJump(-1); }
        else if (e.key === "]")  { e.preventDefault(); demoJump(1); }
        else if (e.key === "\\") { e.preventDefault(); demoTogglePause(); }
    });

    // ── User input handlers ───────────────────────────────────
    input.addEventListener("keydown", e => {
        // Arrow keys: control demo, don't move textarea cursor
        if (e.key === "ArrowRight") { e.preventDefault(); demoJump(1); return; }
        if (e.key === "ArrowLeft")  { e.preventDefault(); demoJump(-1); return; }
        if (e.key === "ArrowDown")  { e.preventDefault(); demoPause(); return; }
        if (e.key === "ArrowUp")    { e.preventDefault(); demoResume(); return; }
        if (demoToken) { stopDemo(); }   // any other key: stop demo, keep text
    });
    const LS_KEY = "akurugraphy-input";
    input.addEventListener("input", () => {
        const filtered = [...input.value].filter(ch => {
            const cp = ch.codePointAt(0);
            return (cp >= 0x0020 && cp <= 0x007E) ||  // Basic Latin + ASCII punctuation
                   (cp >= 0x00C0 && cp <= 0x024F) ||  // Latin Extended (French, Dutch accents)
                   (cp >= 0x0370 && cp <= 0x03FF) ||  // Greek (π etc.)
                   (cp >= 0x0B80 && cp <= 0x0BFF) ||  // Tamil
                   (cp >= 0x0D80 && cp <= 0x0DFF) ||  // Sinhala
                   (cp >= 0x2100 && cp <= 0x21FF) ||  // Arrows and letterlike symbols (→)
                   (cp >= 0x2200 && cp <= 0x22FF) ||  // Math operators (≈)
                   cp === 0x200D;                       // ZWJ (Sinhala conjuncts)
        }).join("");
        if (filtered !== input.value) input.value = filtered;
        updateUnicodeSeq(input.value);
        if (input.value) {
            localStorage.setItem(LS_KEY, input.value);
            renderAll();
            resetIdle();
        } else {
            localStorage.removeItem(LS_KEY);
            clearAll();
            resetIdle(5000);   // empty — restart demo in 5 s
        }
    });

    // ── HarfBuzz init (dynamic — gracefully skipped on file://) ──────
    // index.mjs self-initialises via top-level await; just importing it is enough.
    let hbFont = null;
    let HBBuffer = null;
    let hbShape = null;

    try {
        // Prefer the locally bundled copy (works fully offline); fall back to CDN.
        let hb;
        try {
            hb = await import('./vendor/harfbuzzjs/index.mjs');
        } catch (_local) {
            hb = await import('https://cdn.jsdelivr.net/npm/harfbuzzjs@1.2.1/dist/index.mjs');
        }
        const { Blob: HBBlob, Face: HBFace, Font: HBFont,
                Buffer: _HBBuffer, shape: _hbShape } = hb;
        HBBuffer = _HBBuffer;
        hbShape  = _hbShape;
        hbFont = new HBFont(new HBFace(new HBBlob(b64ToBuffer(FONT_B64))));
    } catch(e) {
        console.warn('HarfBuzz unavailable, using opentype.js fallback:', e.message);
    }

    function shapeCluster(text) {
        if (hbFont && HBBuffer && hbShape) {
            const buf = new HBBuffer();
            buf.addText(text);
            buf.guessSegmentProperties();
            hbShape(hbFont, buf);
            const infos     = buf.getGlyphInfos();
            const positions = buf.getGlyphPositions();
            return infos.map((info, i) => ({
                glyphId:  info.codepoint,
                xAdvance: positions[i].xAdvance,
                yAdvance: positions[i].yAdvance,
                xOffset:  positions[i].xOffset,
                yOffset:  positions[i].yOffset,
            }));
        }
        // Fallback — opentype.js (file:// or no internet)
        return font.stringToGlyphs(text).map(g => ({
            glyphId:  g.index,
            xAdvance: g.advanceWidth || 0,
            yAdvance: 0,
            xOffset:  0,
            yOffset:  0,
        }));
    }

    // ── Boot ──────────────────────────────────────────────────
    const savedInput = localStorage.getItem(LS_KEY);
    if (savedInput) {
        input.value = savedInput;
        updateUnicodeSeq(savedInput);
        renderAll();
        resetIdle();
    } else {
        startDemo();
    }
})();
