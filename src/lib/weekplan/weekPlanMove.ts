// Ported verbatim from the web app's supabase/functions/_shared/weekPlanMove.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Where may this proposed block go instead, and what should the person be told? ───────────────────────────────
//
// A person looking at a proposal can say "not Tuesday, Thursday at 15:00". The engine chose Tuesday for reasons; the
// person may have better ones — a meeting that can slide, a deadline that is softer than it looks, an hour that is
// theirs to double up. So a move is **never refused for a rule of the plan**; it is kept, and `blockWarnings` says, in
// one sentence each, which rules it breaks and what it sits on top of. Add is never blocked by a warning.
//
// What IS refused is what is not a placement at all: not a time, not on the quarter hour, a day outside the week being
// planned, or an hour that has already passed (a calendar write there would be history, not a plan).
//
// `scripts/week-plan-move.mjs` holds the engine and this together: every block the engine placed must come back with
// no warning (except the one it flagged itself, `inBuffer`) — a rule here the engine does not keep would warn about the
// engine's own answer.

import { fromZone, zoneOffset, ymd } from '../time/slots'
import { padBusy, weekdayOf } from './weekPlan'
import type { Busy, Interval, Proposal, Rules } from './weekPlan'
import type { Outcome } from './weekPlanData'
import { addDays } from '../time/taskTime'

const MIN = 60_000
const DAY_MS = 86_400_000
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

export type MoveResult = { ok: true; start: number; end: number; warnings: string[] } | { ok: false; why: string }

/** "10:00–10:30" of an interval, on the wall clock of `tz`. */
function wall(i: Interval, tz: string): string {
  const f = (t: number) => { const m = Math.round(((t + zoneOffset(t, tz)) % DAY_MS + DAY_MS) % DAY_MS / MIN); return hhmm(m) }
  return `${f(i.start)}–${f(i.end)}`
}
const named = (b: Busy, tz: string) => `${b.title ? `“${b.title}”` : 'something on your calendar'} ${wall(b, tz)}`

/**
 * Every rule of the plan that this block, where it is now, breaks — as sentences. Empty means the plan's rules all agree.
 * `others` is every block of the plan (this one included or not; it is skipped by id).
 */
export function blockWarnings(o: Outcome, p: Proposal, others: Proposal[]): string[] {
  const { rules, weekOf } = o.input
  const out: string[] = []
  const start = p.start, end = p.start + p.mins * MIN
  const block = { start, end }

  if (!rules.days.includes(weekdayOf(p.date))) out.push('That is not a day you plan on (Settings → Profile → Work days).')
  if (p.startMin < rules.dayStartMin || p.startMin + p.mins > rules.dayEndMin) out.push(`Outside your working day (${hhmm(rules.dayStartMin)}–${hhmm(rules.dayEndMin)}).`)
  if ((p.load === 'present' || p.load === 'away') && p.startMin < rules.earliestMeetingMin) out.push(`Calls and meetings are not planned before ${hhmm(rules.earliestMeetingMin)}.`)
  if (p.due && p.date > p.due) out.push(`It is due ${p.due}; this is after it.`)

  // What it sits on: the meeting itself first, then (only if it is clear of every meeting) the gap kept around one.
  const busy = o.input.busy.filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
  const on = busy.filter(b => overlaps(block, b))
  for (const b of on) out.push(`Overlaps ${named(b, o.tz)}.`)
  const padded = padBusy(busy, rules)
  const inGap = busy.filter((b, i) => !on.includes(b) && overlaps(block, padded[i]))
  for (const b of inGap) out.push(`Inside the ${b.load === 'away' ? 'travel' : 'buffer'} time around ${named(b, o.tz)}.`)

  for (const r of o.input.reserved ?? []) {
    if (!r.soft && !r.loads.includes(p.load) && overlaps(block, r)) out.push(`Time you set aside for something else (${r.title}, in your Ideal Week).`)
  }
  if (p.load === 'present' || p.load === 'away') {
    if ((o.input.blackouts ?? []).some(b => overlaps(block, b))) out.push('Your Ideal Week asks for no meetings then.')
  }
  for (const q of others) {
    if (q.id !== p.id && overlaps(block, q)) out.push(`Overlaps another block of this plan (${q.title}, ${hhmm(q.startMin)}–${hhmm(q.startMin + q.mins)}).`)
  }

  const onDay = others.filter(q => q.id !== p.id && q.date === p.date)
  if (onDay.reduce((n, q) => n + q.mins, 0) + p.mins > rules.maxPlannedMinsPerDay) out.push(`That day is over its limit (${Math.floor(rules.maxPlannedMinsPerDay / 60)} h of planned work).`)
  if (p.load === 'focus' && onDay.filter(q => q.load === 'focus').reduce((n, q) => n + q.mins, 0) + p.mins > rules.maxFocusMinsPerDay) out.push(`That day is over the focus work you allow (${Math.floor(rules.maxFocusMinsPerDay / 60)} h).`)
  void weekOf
  return out
}

export function checkMove(o: Outcome, p: Proposal, others: Proposal[], date: string, startMin: number): MoveResult {
  const { weekOf, now } = o.input
  const no = (why: string): MoveResult => ({ ok: false, why })
  if (!Number.isInteger(startMin) || startMin < 0 || startMin >= 24 * 60) return no('That is not a time.')
  if (startMin % 15) return no('Blocks start on the quarter hour.')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i))
  if (!days.includes(date)) return no('That day is not in the week being planned.')
  const [y, m, d] = ymd(date)
  const start = fromZone(y, m, d, 0, startMin, 0, o.tz), end = start + p.mins * MIN
  if (start < now) return no('That time has already passed.')
  // Where it would sit, as a proposal, so the warnings read the same whether the block is moved or merely drawn.
  const at: Proposal = { ...p, date, startMin, start, end }
  return { ok: true, start, end, warnings: blockWarnings(o, at, others) }
}

// ─── The gap around a meeting, as bands that can be drawn ────────────────────────────────────────────────────────

export interface BufferBand { date: string; startMin: number; endMin: number; kind: 'buffer' | 'travel'; title?: string }

/** The buffer / travel gap before and after each meeting, cut at midnight into per-day bands on the wall clock of `tz`. */
export function bufferBands(busy: Busy[], rules: Pick<Rules, 'bufferMins' | 'physicalBufferMins'>, tz: string): BufferBand[] {
  const out: BufferBand[] = []
  const add = (i: Interval, kind: BufferBand['kind'], title?: string) => {
    let t = i.start
    while (t < i.end) {
      const local = t + zoneOffset(t, tz)
      const dayStart = Math.floor(local / DAY_MS) * DAY_MS
      const date = new Date(dayStart).toISOString().slice(0, 10)
      const stop = Math.min(i.end, t + (dayStart + DAY_MS - local))
      const s = Math.round((local - dayStart) / MIN), e = Math.round((local - dayStart + (stop - t)) / MIN)
      if (e > s) out.push({ date, startMin: s, endMin: e, kind, title })
      t = stop
    }
  }
  for (const b of busy) {
    if (!Number.isFinite(b.start) || !Number.isFinite(b.end) || b.end <= b.start) continue
    const pad = (b.load === 'away' ? rules.physicalBufferMins : b.load === 'present' ? rules.bufferMins : 0) * MIN
    if (!pad) continue
    const kind = b.load === 'away' ? 'travel' : 'buffer'
    add({ start: b.start - pad, end: b.start }, kind, b.title)
    add({ start: b.end, end: b.end + pad }, kind, b.title)
  }
  return out
}
