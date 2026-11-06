// Hermes (React Native's JS engine) has no `Intl.Segmenter`, which the shared day-marks rules use to decide that a ZWJ
// family, a flag, a keycap or a skin-toned hand is ONE emoji. Without it they fall back to code points and every one of
// those is refused ("hello 🇪🇬 there" would even keep half a flag). This installs the part of Segmenter they use,
// grapheme granularity, only where the engine lacks it, so the shared file runs unmodified.
//
// It splits the cases that matter for emoji: a flag is two regional indicators; a keycap is a base + optional VS16 + U+20E3;
// an emoji is a pictograph with an optional VS16 or skin tone, joined to more of the same by ZWJ; anything else is one code
// point with whatever combining marks follow it. It is not a full UAX #29 implementation (Hangul and Indic clusters are
// not handled), and does not need to be: it only has to say what is exactly one emoji.

const TONE = '[\\u{1F3FB}-\\u{1F3FF}]';
const PICT = `\\p{Extended_Pictographic}(?:\\uFE0F|${TONE})?`;
const CLUSTER = new RegExp(
  [
    '[\\u{1F1E6}-\\u{1F1FF}]{2}',                      // a flag: two regional indicators
    '[0-9#*]\\uFE0F?\\u20E3',                           // a keycap
    `${PICT}(?:\\u200D${PICT})*`,                       // an emoji, and any it is joined to
    '\\r\\n',                                           // CRLF is one
    '[\\u{1F1E6}-\\u{1F1FF}]',                          // a lone regional indicator
    '[\\s\\S][\\u0300-\\u036F\\u200D\\uFE0E\\uFE0F]*',  // anything else: one code point and its combining marks
  ].join('|'), 'uy',
);

export function graphemesOf(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    CLUSTER.lastIndex = i;
    const m = CLUSTER.exec(s);
    if (!m || m.index !== i || !m[0]) { out.push(s[i]); i += 1; continue; }   // never loops: always advances
    out.push(m[0]);
    i += m[0].length;
  }
  return out;
}

class ShimSegmenter {
  segment(s: string): Iterable<{ segment: string; index: number }> {
    let index = 0;
    return graphemesOf(s).map(g => { const r = { segment: g, index }; index += g.length; return r; });
  }
}

export function installSegmenter(): boolean {
  const intl = Intl as unknown as { Segmenter?: unknown };
  if (typeof intl.Segmenter === 'function') return false;
  intl.Segmenter = ShimSegmenter;
  return true;
}

installSegmenter();
