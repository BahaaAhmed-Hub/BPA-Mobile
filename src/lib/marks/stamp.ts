// Ported from the web's src/lib/stamp.ts at BPA@c6b42ed.
// ─── One clock per device for things that are joined across devices ──────────
// Notes and marks are merged by "the later `at` wins", and a removal is a write
// like any other. If two writes from one device could share a millisecond — or a
// burst of writes could run ahead of `Date.now()` and a later write be stamped
// *before* them — the join would pick the wrong one and an edit or a removal would
// lose to the copy it was meant to replace. So every write from this device takes
// the next stamp, never one at or before the last: `Date.now()` when that is later,
// otherwise one millisecond past the previous.
let last = 0
export function monotonicNow(): string {
  const t = Math.max(Date.now(), last + 1)
  last = t
  return new Date(t).toISOString()
}
