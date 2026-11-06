// Run twice by scripts/README: once on plain Node (native Segmenter) and once with `--import ./scripts/hermes-like.mjs`,
// which removes Intl.Segmenter the way Hermes lacks it. The second run is the control: without the shim the web's own
// rules refuse flags and families; with it they accept them.
import { graphemesOf, installSegmenter } from '../src/lib/marks/segmenterShim'
import { isOneEmoji, firstEmoji } from '../src/lib/marks/dayNotes'
import { MARK_EMOJIS } from '../src/lib/marks/markEmojis'
import assert from 'node:assert'
const hermesLike = typeof (globalThis as any).__nativeSegmenter === 'function'
const native = hermesLike ? (globalThis as any).__nativeSegmenter : (Intl as any).Segmenter
const corpus = ['🚩', '🇪🇬', '🇪🇬🇺🇸', '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👍🏽', '1️⃣', '#️⃣', '✍️', '❤️', '🏳️‍🌈', '🚩🎉', 'abc', 'hello 🇪🇬 there', 'é', 'é', '', '🚩🚩', '👩🏽‍💻', 'ab\r\ncd', 'x🚩y🎉z', '🏖️🌧️', '1', '12', '*️⃣']
const nativeSplit = (s: string) => Array.from(new native(undefined, { granularity: 'grapheme' }).segment(s), (x: any) => x.segment)
// the shim agrees with the real Segmenter on every string, in either mode
for (const s of corpus) assert.deepEqual(graphemesOf(s), nativeSplit(s), JSON.stringify(s))
// it installs only where the engine lacks one
assert.equal(typeof (Intl as any).Segmenter, 'function')    // the shim was installed on import in hermes-like mode, native otherwise
// the shared rules, as the phone will run them
for (const e of ['🚩', '👨‍👩‍👧', '🇪🇬', '1️⃣', '👍🏽', '✍️', '❤️']) assert.equal(isOneEmoji(e), true, e)
for (const e of ['a', '🚩🚩', '', 'hi 🚩']) assert.equal(isOneEmoji(e), false, e)
assert.equal(firstEmoji('hello 🇪🇬 there'), '🇪🇬'); assert.equal(firstEmoji('🚩🎉'), '🚩'); assert.equal(firstEmoji('abc'), null)
for (const e of MARK_EMOJIS) assert.equal(isOneEmoji(e), true, 'preset ' + e)
// it never loops or throws on junk
for (const s of ['\uD800', '‍', '️', '🇪', 'a'.repeat(5000)]) assert.ok(Array.isArray(graphemesOf(s)))
console.log(hermesLike ? 'ok (hermes-like: no native Segmenter)' : 'ok (native Segmenter)')
