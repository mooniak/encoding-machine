// Demo animation words — edit freely.
// Cycle: Sinhala → Tamil → Other (English / French / Dutch / Numeral / Punctuation)
// Sinhala: rakaransaya = consonant + ් (U+0DCA) + ZWJ (U+200D) + ර
//          yansaya     = consonant + ් (U+0DCA) + ZWJ (U+200D) + ය
// Tamil:   pulli       = consonant + ் (U+0BCD)
const DEMO_WORDS = [
    "ප්‍රේමය",        // S – love           rakaransaya
    "நட்சத்திரம்",     // T – star           pulli clusters
    "dream",           // E
    "été",             // F – summer         é acute ×2

    "ශ්‍රේෂ්ඨ",        // S – excellent      conjunct + al-lakuna
    "அற்புதம்",       // T – miracle        ற்ப pulli cluster
    "light",           // E
    "vrijheid",        // D – freedom        i+j digraph

    "ස්නේහය",         // S – affection      al-lakuna
    "சந்தோஷம்",      // T – happiness      nasal cluster
    "smile",           // E
    "2024",            // N – year           ASCII digits

    "ක්‍රමය",          // S – method         rakaransaya
    "திருக்குறள்",     // T – Thirukkural    double pulli
    "hello",           // E
    "it's",            // P – apostrophe     U+0027

    "ව්‍යාකරණය",      // S – grammar        yansaya
    "கிரீடம்",        // T – crown          compound vowel signs
    "river",           // E
    "liberté",         // F – liberty        é acute

    "ත්‍රිකෝණය",      // S – triangle       rakaransaya + long vowel
    "சுதந்திரம்",     // T – freedom        nasal cluster
    "wonder",          // E
    "naïef",           // D – naive          ï diaeresis

    "ද්‍රව්‍ය",         // S – matter         double conjunct
    "விண்மீன்",       // T – star           retroflex + alveolar pulli
    "night",           // E
    "42",              // N – the answer

    "ග්‍රාමය",         // S – village        rakaransaya
    "மின்னல்",        // T – lightning      two pulli clusters
    "memory",          // E
    "rock & roll",     // P – ampersand      U+0026

    "ක්‍රෝධය",         // S – anger          rakaransaya + long vowel
    "நட்பு",          // T – friendship     pulli cluster
    "silence",         // E
    "100%",            // N – percent        U+0025

    "ශ්‍රී ලංකා",      // S – Sri Lanka      rakaransaya + space
    "வண்ணம்",         // T – colour         geminate with pulli
    "breath",          // E
    "@mention",        // P – at sign        U+0040

    "ප්‍රශ්නය",        // S – question       rakaransaya + al-lakuna
    "திருவண்ணாமலை",   // T – Thiruvannamalai ண்ண geminate
    "1,234.56",        // N – formatted      comma + period
    "1+1=2",           // P – arithmetic     U+002B + U+003D

    "ස්ත්‍රිය",        // S – woman          double-stop conjunct
    "பாரம்பரியம்",    // T – tradition      anusvara cluster
    "π≈3.14",          // N – pi approx      U+03C0 + U+2248
    "A→B",             // P – arrow          U+2192
];
