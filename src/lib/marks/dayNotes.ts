// Ported verbatim from the web app's supabase/functions/_shared/dayNotes.ts at BPA@c6b42ed.
// The web shares this one file between the app and its bots so they make and read exactly the same mark;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Notes about a stretch of time, and the marks on a day — the rules ───────
// Pure: no store, no clock, no network. The app's own storage (`src/lib/periodNotes.ts`,
// `dayMarks.ts`) and both bots (`botKit.ts`) build, validate, order and join through THIS file, so
// a note made by voice is exactly the note made on the grid. What differs is only where the map lives:
// `localStorage` in the app, `users.schedule_rules.shared_prefs` for the bots.
//
// A period note is not an event; a day mark is an emoji, optional words and a day. Both are private
// maps with tombstones, joined across devices (`prefSync`): see the two sections below.

export const TOMBSTONE_DAYS = 90

// ═══ PERIOD NOTES ═══
// ─── A note about a stretch of time — which is not an event ─────────────────
//
// "10 to 12 was noisy, I could not focus." "Fasting until four." "Kids home
// from two." None of these is an appointment. An event takes your time, can
// have guests, clashes with another, is written to Google, and — through the
// booking page — marks the hour as busy to strangers. A note is information
// *about* time: it has none of those properties, so it must not be stored where
// they would be given to it. Notes are private and never leave the app.
//
// **Wall clock, not instants.** A note says "10:00–12:00 on the 14th" and means
// it in whatever zone you were standing in; the booking windows made the same
// choice. Times are `YYYY-MM-DDTHH:mm` strings, which sort as text. `end` is
// exclusive, so an all-day note on the 14th ends at `…15T00:00`.
//
// **A removal is a tombstone** (`gone`), because the map is joined across
// devices through `prefSync` (key `cal-period-notes`) and a join only adds: an
// entry missing here would come straight back from the other device. The later
// `at` wins. A tombstone is dropped only once it is old enough that no device
// can still be holding the live entry (`TOMBSTONE_DAYS`).

export type NoteTag = 'interrupted' | 'low-energy' | 'travel' | 'sick' | 'family' | 'focus' | 'other'

export const NOTE_TAGS: { id: NoteTag; label: string }[] = [
  { id: 'interrupted', label: 'Interrupted' },
  { id: 'low-energy',  label: 'Low energy' },
  { id: 'travel',      label: 'Travel' },
  { id: 'sick',        label: 'Unwell' },
  { id: 'family',      label: 'Family' },
  { id: 'focus',       label: 'Protected focus' },
  { id: 'other',       label: 'Other' },
]

export interface PeriodNote {
  id: string
  /** `YYYY-MM-DDTHH:mm`, local wall clock. */
  start: string
  /** Exclusive, same shape, strictly after `start`. */
  end: string
  text: string
  tag?: NoteTag
  /** ISO time of the last change to this entry; the later one wins a join. */
  at: string
  gone?: boolean
}

export const MAX_NOTE_LENGTH = 500

const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Is this a real local date-time in our format? (`2026-02-30` is not.) */
export function validStamp(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = STAMP.exec(s)
  if (!m) return false
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  if (h > 23 || mi > 59) return false
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

function pad(n: number): string { return String(n).padStart(2, '0') }

/** `YYYY-MM-DD` of the day after `ds`. Calendar arithmetic, not +24h. */
export function nextDay(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** Why this cannot be saved, or null. */
export function validateNote(n: { start: string; end: string; text: string; tag?: string }): string | null {
  if (!validStamp(n.start) || !validStamp(n.end)) return 'Pick a start and an end.'
  if (n.end <= n.start) return 'The end has to be after the start.'
  const text = (n.text ?? '').trim()
  if (!text) return 'Write what the note says.'
  if (text.length > MAX_NOTE_LENGTH) return `Keep it under ${MAX_NOTE_LENGTH} characters.`
  if (n.tag != null && !NOTE_TAGS.some(t => t.id === n.tag)) return 'That reason is not one of the choices.'
  return null
}

export interface NoteSegment {
  note: PeriodNote
  /** Minutes from midnight of the day asked about. */
  startMin: number
  endMin: number
  /** The note began on an earlier day / runs on into a later one. */
  continuesBefore: boolean
  continuesAfter: boolean
  /** Covers the whole day — draws as a day strip, not a band on the hours. */
  wholeDay: boolean
}

const minutesOf = (stamp: string) => Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16))

/** The part of a note that falls on `ds`, or null. A note across midnight is
 *  cut at the day's edges, each side on its own day. */
export function segmentOnDay(note: PeriodNote, ds: string): NoteSegment | null {
  const dayStart = `${ds}T00:00`
  const dayEnd = `${nextDay(ds)}T00:00`
  if (note.end <= dayStart || note.start >= dayEnd) return null
  const continuesBefore = note.start < dayStart
  const continuesAfter = note.end > dayEnd
  const startMin = continuesBefore ? 0 : minutesOf(note.start)
  const endMin = continuesAfter || note.end === dayEnd ? 1440 : minutesOf(note.end)
  return { note, startMin, endMin, continuesBefore, continuesAfter, wholeDay: startMin === 0 && endMin === 1440 }
}

/** Live notes on a day, earliest first (ties: the one written first). */
export function notesOnDay(map: Record<string, PeriodNote>, ds: string): NoteSegment[] {
  const out: NoteSegment[] = []
  for (const n of Object.values(map)) {
    if (n.gone) continue
    const seg = segmentOnDay(n, ds)
    if (seg) out.push(seg)
  }
  return out.sort((a, b) => a.startMin - b.startMin || a.note.at.localeCompare(b.note.at) || a.note.id.localeCompare(b.note.id))
}

/** Joins two copies: per entry the later `at` wins; a tombstone old enough that
 *  nobody can still hold the live entry is dropped. */
export function joinPeriodNotes(
  a: Record<string, PeriodNote>, b: Record<string, PeriodNote>, now = Date.now(),
): Record<string, PeriodNote> {
  const out: Record<string, PeriodNote> = { ...b }
  for (const [k, v] of Object.entries(a)) {
    const other = out[k]
    // The later change wins. On an exact tie a removal wins: losing one means a
    // deleted entry returns, and nothing the person did can explain it.
    if (!other || v.at > other.at || (v.at === other.at && (v.gone || !other.gone))) out[k] = v
  }
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000
  for (const [k, v] of Object.entries(out)) {
    if (v.gone && Date.parse(v.at) < cutoff) delete out[k]
  }
  return out
}


// ═══ DAY MARKS ═══
// ─── The marks on a day: highlights, flags and achievements ─────────────────
//
// One small object covers all three, because what differs is where it came
// from, not what it is: an emoji, an optional line of words, and a day.
//   • **highlight** — you wrote it: "Closed the Teradix contract".
//   • **flag** — a highlight with no words: 🚩, ✈️, 🤒. The emoji is the point.
//   • **achievement** — the app noticed something true (a P0 finished, a habit
//     streak) and *you* kept it. It carries `source`, so the same fact is never
//     offered or kept twice for one day. The app proposes; it never writes one
//     on its own.
// A day may have any number of them. Marks are private and never leave the app.
//
// Stored as a map joined across devices through `prefSync` (key
// `cal-day-marks`). **A removal is a tombstone** (`gone`): a join only adds, so
// an entry missing here would come straight back from the other device. The
// later `at` wins.

export type MarkKind = 'highlight' | 'achievement'

export interface MarkSource {
  /** What kind of fact: 'task', 'habit', 'book'… */
  kind: string
  id: string
}

export interface DayMark {
  id: string
  /** `YYYY-MM-DD`, local. */
  date: string
  /** Exactly one emoji — a ZWJ family, a flag or a keycap counts as one. */
  emoji: string
  /** Optional; a flag is a mark with none. */
  text: string
  kind: MarkKind
  source?: MarkSource
  /** When it was first made — the order marks sit in on a day. */
  created: string
  /** ISO time of the last change; the later one wins a join. */
  at: string
  gone?: boolean
}

export const MAX_MARK_TEXT = 140
export const MAX_MARKS_PER_DAY = 50
export const DEFAULT_EMOJI = '⭐'

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣/u

function graphemes(s: string): string[] {
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(s), x => x.segment)
  } catch { return Array.from(s) }
}

/** Is this exactly one emoji? "a" no; "🚩" yes; "👨‍👩‍👧" yes; "🇪🇬" yes; "🚩🚩" no. */
export function isOneEmoji(s: unknown): s is string {
  if (typeof s !== 'string' || !s) return false
  const g = graphemes(s)
  return g.length === 1 && EMOJI.test(g[0])
}

/** The first emoji in whatever was typed or pasted — "hello 🎉 there" → "🎉", "abc" → null.
 *  What the editor's "any emoji" field keeps, so pasting a string never stores a string. */
export function firstEmoji(s: string): string | null {
  for (const g of graphemes(s)) if (isOneEmoji(g)) return g
  return null
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
export function validDay(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = DAY.exec(s)
  if (!m) return false
  const [y, mo, d] = m.slice(1).map(Number)
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

/** Why this cannot be saved, or null. A mark may have no words, never no emoji. */
export function validateMark(m: { date: string; emoji: string; text: string }): string | null {
  if (!validDay(m.date)) return 'Pick a day.'
  if (!isOneEmoji(m.emoji)) return 'Choose one emoji.'
  if ((m.text ?? '').trim().length > MAX_MARK_TEXT) return `Keep it under ${MAX_MARK_TEXT} characters.`
  return null
}

/** Live marks on a day, in the order they were made. */
export function marksOnDay(map: Record<string, DayMark>, ds: string): DayMark[] {
  return Object.values(map)
    .filter(m => !m.gone && m.date === ds)
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
}

/** Live marks from `from` to `to` (inclusive), grouped by day — one pass for a
 *  whole week or month rather than one filter per column. */
export function marksInRange(map: Record<string, DayMark>, from: string, to: string): Map<string, DayMark[]> {
  const out = new Map<string, DayMark[]>()
  for (const m of Object.values(map)) {
    if (m.gone || m.date < from || m.date > to) continue
    const list = out.get(m.date)
    if (list) list.push(m); else out.set(m.date, [m])
  }
  for (const list of out.values()) list.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
  return out
}

/** Is this fact already marked on this day? Keeps an achievement from being
 *  kept twice, and from being offered again once it is. */
export function findBySource(map: Record<string, DayMark>, date: string, source: MarkSource): DayMark | undefined {
  return Object.values(map).find(m => !m.gone && m.date === date && m.source?.kind === source.kind && m.source.id === source.id)
}

export function joinDayMarks(
  a: Record<string, DayMark>, b: Record<string, DayMark>, now = Date.now(),
): Record<string, DayMark> {
  const out: Record<string, DayMark> = { ...b }
  for (const [k, v] of Object.entries(a)) {
    const other = out[k]
    // The later change wins. On an exact tie a removal wins: losing one means a
    // deleted entry returns, and nothing the person did can explain it.
    if (!other || v.at > other.at || (v.at === other.at && (v.gone || !other.gone))) out[k] = v
  }
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000
  for (const [k, v] of Object.entries(out)) {
    if (v.gone && Date.parse(v.at) < cutoff) delete out[k]
  }
  return out
}


// ═══ BUILDING — one way to make a mark or a note, wherever the map lives ═════

export type MarkResult = { ok: true; mark: DayMark } | { ok: false; why: string }
export type NoteResult = { ok: true; note: PeriodNote } | { ok: false; why: string }

/** Add a mark to `map` (mutates it). With a `source` it is idempotent: the same fact on the same day returns
 *  the mark already there. `id` and `now` come in so this stays pure (and the app can use its monotonic clock). */
export function addMarkTo(map: Record<string, DayMark>, input: { date: string; emoji?: string; text?: string; source?: MarkSource }, id: string, now: string): MarkResult {
  const emoji = input.emoji || DEFAULT_EMOJI
  const text = (input.text ?? '').trim()
  const why = validateMark({ date: input.date, emoji, text })
  if (why) return { ok: false, why }
  if (input.source) {
    const have = findBySource(map, input.date, input.source)
    if (have) return { ok: true, mark: have }
  }
  if (marksOnDay(map, input.date).length >= MAX_MARKS_PER_DAY) return { ok: false, why: `That day already has ${MAX_MARKS_PER_DAY} marks.` }
  const mark: DayMark = {
    id, date: input.date, emoji, text, kind: input.source ? 'achievement' : 'highlight',
    ...(input.source ? { source: input.source } : {}), created: now, at: now,
  }
  map[id] = mark
  return { ok: true, mark }
}

export function addNoteTo(map: Record<string, PeriodNote>, input: { start: string; end: string; text: string; tag?: NoteTag }, id: string, now: string): NoteResult {
  const why = validateNote(input)
  if (why) return { ok: false, why }
  const note: PeriodNote = { id, start: input.start, end: input.end, text: input.text.trim(), ...(input.tag ? { tag: input.tag } : {}), at: now }
  map[id] = note
  return { ok: true, note }
}
