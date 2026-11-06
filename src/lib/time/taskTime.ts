// Ported verbatim from the web app's supabase/functions/_shared/taskTime.ts at BPA@c54edac.
// The web shares this one file between the app and its bots so they cannot judge time differently;
// the phone does the same. Change it on the web first, then re-copy — do not edit here.
// ─── Time worked, task-hours, and what the overlap is worth ──────────────────
//
// Two numbers that are not the same number, and the whole point of this file is
// to keep them apart:
//
//   TIME WORKED  — the clock time you were working. Three tasks run together
//                  for two hours is two hours. The union of the spans.
//   TASK-HOURS   — every task's time added up. The same afternoon is six.
//                  The sum of the spans.
//   GAIN         — the difference: what running things together bought.
//
// "I worked 8 hours, and 15 task-hours came out of them" is a sentence that is
// true only if both are computed from the same intervals. So they are, here.
//
// A few rules that were each easy to get wrong:
//
// - **A day is the reader's local day**, and it is 23 or 25 hours twice a year.
//   Day edges come from `fromZone` (the zone's own offset on THAT day), never
//   from `+ 86 400 000`. A session across midnight is split, so each side lands
//   on its own day. The zone is a parameter, because a test has to be able to
//   run in Cairo and in Los Angeles without touching the machine's clock.
// - **Touching is not overlapping.** 09:00–10:00 then 10:00–11:00 is two hours
//   worked, not a collision.
// - **A running session ends "now"**, and the caller says what now is. Nothing
//   in here reads the clock, so the same input is the same answer.
// - **Some time has a length and no position** (an estimate made for a task
//   that was finished long ago: 90 minutes, on that day, at no particular
//   hour). It counts in task-hours — it was effort — but it cannot be placed on
//   the clock, so it is not in time worked and says nothing about overlap.
//
// Nothing here touches Deno, a network or a database, so `scripts/task-time-
// maths.mjs` runs this file itself rather than a copy. The app re-exports it
// from `src/lib/taskTime.ts`; the assistant and the bots import it directly.

import { fromZone, zoneOffset } from './slots'

/** A stretch of the clock. Epoch ms, `end > start`. */
export interface Span { start: number; end: number }

/** A session as stored: a span whose end may not have happened yet. */
export interface Running { start: number; end: number | null }

/** Effort with a length and a day but no hour — see the header. */
export interface Floating { day: string; ms: number }

export interface DayStats {
  /** Union of the placed spans: the clock time spent working. */
  worked: number
  /** Sum of the placed spans, overlaps counted every time. */
  placed: number
  /** Effort with no position on the clock. */
  floating: number
  /** `placed + floating` — every task's time added up. */
  taskHours: number
  /** `placed − worked`: what doing things together bought. Never negative. */
  gain: number
  /** The most placed spans running at the same moment. */
  peak: number
  /** How many placed spans (a session across midnight is one in each day). */
  spans: number
}

export const MINUTE = 60_000
export const HOUR = 3_600_000

export const minutesOf = (ms: number): number => Math.round(ms / MINUTE)

// ─── Intervals ───────────────────────────────────────────────────────────────

/** Resolve running sessions against `now` and drop anything with no length. */
export function settle(list: Running[], now: number): Span[] {
  const out: Span[] = []
  for (const s of list) {
    if (!Number.isFinite(s.start)) continue
    const end = s.end == null ? now : s.end
    if (!Number.isFinite(end) || end <= s.start) continue
    out.push({ start: s.start, end })
  }
  return out
}

/** Sorted, and merged wherever one begins no later than the last one ended. */
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = spans.filter(s => s.end > s.start).map(s => ({ ...s })).sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Span[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else out.push(s)
  }
  return out
}

/** Clock time covered: overlaps counted once. */
export const unionMs = (spans: Span[]): number => mergeSpans(spans).reduce((n, s) => n + (s.end - s.start), 0)

/** Time added up: overlaps counted every time. */
export const sumMs = (spans: Span[]): number => spans.reduce((n, s) => n + Math.max(0, s.end - s.start), 0)

/** Do two spans share any of the clock? Ending where the other begins does not. */
export const spansOverlap = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end

/** The most spans running at one moment. At a tie an end is processed before a
 *  start, so back-to-back is 1, not 2. */
export function peakConcurrency(spans: Span[]): number {
  const edges: Array<[number, number]> = []
  for (const s of spans) if (s.end > s.start) { edges.push([s.start, 1], [s.end, -1]) }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let now = 0, peak = 0
  for (const [, d] of edges) { now += d; if (now > peak) peak = now }
  return peak
}

// ─── Days ────────────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` plus `n` calendar days. Whole UTC days: no zone in it. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** `[start, end)` of a local day, at the offset in force on that day. */
export function dayBounds(day: string, tz: string): Span {
  const [y, m, d] = day.split('-').map(Number)
  const start = fromZone(y, m, d, 0, 0, 0, tz)
  const [ny, nm, nd] = addDays(day, 1).split('-').map(Number)
  return { start, end: fromZone(ny, nm, nd, 0, 0, 0, tz) }
}

/** Which local day an instant falls on — defined BY `dayBounds`, so the two
 *  cannot disagree about a day whose midnight does not exist (Cairo's clocks
 *  go forward at 00:00). */
export function dayOf(ms: number, tz: string): string {
  let day = new Date(ms + zoneOffset(ms, tz)).toISOString().slice(0, 10)
  for (let i = 0; i < 3; i++) {
    const b = dayBounds(day, tz)
    if (ms < b.start) day = addDays(day, -1)
    else if (ms >= b.end) day = addDays(day, 1)
    else break
  }
  return day
}

export interface DayPiece { day: string; start: number; end: number }

/** A span cut at each local midnight it crosses. */
export function splitByDay(span: Span, tz: string): DayPiece[] {
  const pieces: DayPiece[] = []
  let day = dayOf(span.start, tz)
  // A session of years is a mistake somewhere upstream, not a loop to run.
  for (let guard = 0; guard < 4000; guard++) {
    const b = dayBounds(day, tz)
    const start = Math.max(span.start, b.start)
    const end = Math.min(span.end, b.end)
    if (end > start) pieces.push({ day, start, end })
    if (span.end <= b.end) break
    day = addDays(day, 1)
  }
  return pieces
}

// ─── The numbers ─────────────────────────────────────────────────────────────

const empty = (): DayStats => ({ worked: 0, placed: 0, floating: 0, taskHours: 0, gain: 0, peak: 0, spans: 0 })

/** Per local day, for the days that have anything. */
export function statsByDay(sessions: Running[], floating: Floating[], tz: string, now: number): Record<string, DayStats> {
  const byDay = new Map<string, Span[]>()
  for (const s of settle(sessions, now)) {
    for (const p of splitByDay(s, tz)) {
      const list = byDay.get(p.day) ?? []
      list.push({ start: p.start, end: p.end })
      byDay.set(p.day, list)
    }
  }
  const out: Record<string, DayStats> = {}
  for (const [day, list] of byDay) {
    const worked = unionMs(list)
    const placed = sumMs(list)
    out[day] = { worked, placed, floating: 0, taskHours: placed, gain: placed - worked, peak: peakConcurrency(list), spans: list.length }
  }
  for (const f of floating) {
    if (!(f.ms > 0) || !Number.isFinite(f.ms)) continue
    const d = out[f.day] ?? (out[f.day] = empty())
    d.floating += f.ms
    d.taskHours += f.ms
  }
  return out
}

/** Several days added together. Days are disjoint, so the sum of the days'
 *  time worked IS the time worked over the range; `peak` is the busiest moment. */
export function sumStats(list: DayStats[]): DayStats {
  const t = empty()
  for (const d of list) {
    t.worked += d.worked; t.placed += d.placed; t.floating += d.floating
    t.taskHours += d.taskHours; t.gain += d.gain; t.spans += d.spans
    if (d.peak > t.peak) t.peak = d.peak
  }
  return t
}

/** Days `from`..`to` inclusive (both `YYYY-MM-DD`), out of `statsByDay`. */
export function rangeStats(byDay: Record<string, DayStats>, from: string, to: string): DayStats {
  return sumStats(Object.keys(byDay).filter(d => d >= from && d <= to).map(d => byDay[d]))
}
