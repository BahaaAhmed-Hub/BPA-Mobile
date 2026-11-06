// What the phone does to a map of day marks, as pure functions over a map it is handed. The web's src/lib/dayMarks.ts does
// the same against localStorage; the rules (one emoji, optional words, many per day, an achievement carrying its source,
// a removal is a tombstone, every write takes the next stamp) are the shared dayNotes.ts, so a mark made here is exactly
// the mark the web would have made. Each op returns the entries it TOUCHED: only those are joined into the server's copy,
// so another device's marks are never overwritten.
import './segmenterShim';
import { addMarkTo, findBySource, validateMark, type DayMark, type MarkResult, type MarkSource } from './dayNotes';
import { monotonicNow } from './stamp';

export type MarkMap = Record<string, DayMark>;
export interface Op<R> { map: MarkMap; touched: MarkMap; result: R }

export function newMarkId(): string {
  try { return globalThis.crypto.randomUUID(); } catch { return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }
}

const clone = (m: MarkMap): MarkMap => ({ ...m });

/** Add a mark. With a `source` it is idempotent: the same fact on the same day returns the mark already there, touching nothing. */
export function opAdd(map: MarkMap, input: { date: string; emoji?: string; text?: string; source?: MarkSource }, id = newMarkId(), now = monotonicNow()): Op<MarkResult> {
  const next = clone(map);
  const before = input.source ? findBySource(next, input.date, input.source) : undefined;
  const result = addMarkTo(next, input, id, now);
  const touched: MarkMap = result.ok && !before ? { [result.mark.id]: result.mark } : {};
  return { map: Object.keys(touched).length ? next : map, touched, result };
}

export function opUpdate(map: MarkMap, id: string, patch: { emoji?: string; text?: string; date?: string }, now = monotonicNow()): Op<MarkResult> {
  const prev = map[id];
  if (!prev || prev.gone) return { map, touched: {}, result: { ok: false, why: 'That mark is no longer there.' } };
  const next = { date: patch.date ?? prev.date, emoji: patch.emoji ?? prev.emoji, text: (patch.text ?? prev.text).trim() };
  const why = validateMark(next);
  if (why) return { map, touched: {}, result: { ok: false, why } };
  const mark: DayMark = { ...prev, ...next, at: now };
  return { map: { ...map, [id]: mark }, touched: { [id]: mark }, result: { ok: true, mark } };
}

/** Take a mark away (a tombstone). The removed mark comes back as the result, so Undo can put it back. */
export function opRemove(map: MarkMap, id: string, now = monotonicNow()): Op<DayMark | null> {
  const prev = map[id];
  if (!prev || prev.gone) return { map, touched: {}, result: null };
  const gone: DayMark = { ...prev, gone: true, at: now };
  return { map: { ...map, [id]: gone }, touched: { [id]: gone }, result: prev };
}

export function opRestore(map: MarkMap, mark: DayMark, now = monotonicNow()): Op<DayMark> {
  const { gone: _gone, ...live } = mark;
  const back: DayMark = { ...live, at: now };
  return { map: { ...map, [mark.id]: back }, touched: { [mark.id]: back }, result: back };
}

/** The stored value, as a map: a missing or damaged value is an empty one. */
export function parseMarks(raw: string | null | undefined): MarkMap {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as MarkMap) : {};
  } catch { return {}; }
}
