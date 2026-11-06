// What the phone does to a map of period notes: pure functions over a map it is handed, exactly as dayMarksOps does for
// marks. The rules (wall-clock stamps, end exclusive, an all-day note ends at the next midnight, a removal is a tombstone,
// every write takes the next stamp) are the shared dayNotes.ts, so a note made here is the note the web would make. Each op
// returns the entries it TOUCHED: only those are joined into the server's copy, so another device's notes are never lost.
import { addNoteTo, nextDay, validateNote, type NoteResult, type NoteTag, type PeriodNote } from './dayNotes';
import { monotonicNow } from './stamp';
import { newMarkId } from './dayMarksOps';

export type NoteMap = Record<string, PeriodNote>;
export interface NoteOp<R> { map: NoteMap; touched: NoteMap; result: R }

const clone = (m: NoteMap): NoteMap => ({ ...m });

export function opAddNote(map: NoteMap, input: { start: string; end: string; text: string; tag?: NoteTag }, id = newMarkId(), now = monotonicNow()): NoteOp<NoteResult> {
  const next = clone(map);
  const result = addNoteTo(next, input, id, now);
  return result.ok ? { map: next, touched: { [id]: result.note }, result } : { map, touched: {}, result };
}

/** Change a note. Clearing the tag is `tag: null`. */
export function opUpdateNote(map: NoteMap, id: string, patch: { start?: string; end?: string; text?: string; tag?: NoteTag | null }, now = monotonicNow()): NoteOp<NoteResult> {
  const prev = map[id];
  if (!prev || prev.gone) return { map, touched: {}, result: { ok: false, why: 'That note is no longer there.' } };
  const next = {
    start: patch.start ?? prev.start, end: patch.end ?? prev.end, text: patch.text ?? prev.text,
    tag: patch.tag === null ? undefined : (patch.tag ?? prev.tag),
  };
  const why = validateNote(next);
  if (why) return { map, touched: {}, result: { ok: false, why } };
  const note: PeriodNote = { id, start: next.start, end: next.end, text: next.text.trim(), ...(next.tag ? { tag: next.tag } : {}), at: now };
  return { map: { ...map, [id]: note }, touched: { [id]: note }, result: { ok: true, note } };
}

/** Take a note away (a tombstone). The removed note comes back so Undo can put it back. */
export function opRemoveNote(map: NoteMap, id: string, now = monotonicNow()): NoteOp<PeriodNote | null> {
  const prev = map[id];
  if (!prev || prev.gone) return { map, touched: {}, result: null };
  const gone: PeriodNote = { ...prev, gone: true, at: now };
  return { map: { ...map, [id]: gone }, touched: { [id]: gone }, result: prev };
}

/** Undo of a removal: the same note, live again, with a newer `at` so it beats its own tombstone on the other device. */
export function opRestoreNote(map: NoteMap, note: PeriodNote, now = monotonicNow()): NoteOp<PeriodNote> {
  const { gone: _gone, ...live } = note;
  const back: PeriodNote = { ...live, at: now };
  return { map: { ...map, [note.id]: back }, touched: { [note.id]: back }, result: back };
}

export function parseNotes(raw: string | null | undefined): NoteMap {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as NoteMap) : {};
  } catch { return {}; }
}

// ── the form, as the web's editor models it ─────────────────────────────────

export interface NoteDraft {
  id?: string;
  /** `YYYY-MM-DD` */ fromDate: string;
  /** `HH:mm` */ fromTime: string;
  /** The last day it covers, inclusive. */ toDate: string;
  toTime: string;
  allDay: boolean;
  text: string;
  tag?: NoteTag;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

/** A fresh draft on `date` from `startMin` for `lengthMin`, always a valid span on that day. (The web's version clamps the
 *  start to 23:45 and adds a quarter hour, which wraps to 00:00 on the same date for a late start: an end before the start.
 *  Here the end stops at 23:59 instead.) */
export function blankDraft(date: string, startMin: number, lengthMin = 60): NoteDraft {
  const s = Math.max(0, Math.min(23 * 60 + 30, startMin));
  const e = Math.min(23 * 60 + 59, s + lengthMin);
  return { fromDate: date, fromTime: hhmm(s), toDate: date, toTime: hhmm(e), allDay: false, text: '' };
}

/** An existing note as the form shows it. An all-day note's `end` is the next midnight, so the form's last day is the day before it. */
export function draftOf(note: PeriodNote): NoteDraft {
  const [fd, ft] = note.start.split('T'), [ed, et] = note.end.split('T');
  const allDay = ft === '00:00' && et === '00:00';
  const lastDay = (() => {
    if (!allDay) return ed;
    const [y, m, d] = ed.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 1);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  })();
  return { id: note.id, fromDate: fd, fromTime: ft, toDate: lastDay, toTime: et, allDay, text: note.text, tag: note.tag };
}

/** The stamps a draft stands for. */
export function stampsOf(d: NoteDraft): { start: string; end: string } {
  return d.allDay
    ? { start: `${d.fromDate}T00:00`, end: `${nextDay(d.toDate)}T00:00` }
    : { start: `${d.fromDate}T${d.fromTime}`, end: `${d.toDate}T${d.toTime}` };
}
