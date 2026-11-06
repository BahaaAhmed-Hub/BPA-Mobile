// Ported verbatim from the web app's supabase/functions/_shared/weekPlan.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Plan a week: what goes where, out of the time that is actually free ─────
//
// Inputs are plain data and so is the answer. No Deno, no store, no network, no
// clock (`now` is handed in) — the app, the in-app assistant, the Telegram bot
// and Siri all call this one function, so they cannot plan different weeks, and
// `scripts/week-plan.mjs` runs this very file.
//
// The engine **proposes and never writes**. Where a thing goes is decided here,
// deterministically, by rules that can say "no room"; a model is only ever used
// upstream to turn words into `Item`s. A planner that cannot refuse is one that
// fills a Tuesday with eleven hours of "deep work" and calls it a plan.
//
// What it will not do, on purpose:
// - **Double book.** It books only free time. The overlap rules (`overlapRules`)
//   say a call may share an hour with a background task; a *planner* choosing
//   to stack things is a different act from a person choosing to, and every
//   doubt resolves to exclusive.
// - **Plan on a day the person did not list, or outside their working day.**
// - **Pass a due date.** A due date is a ceiling, not a preference. A thing that
//   cannot fit before it is returned in `unplaced` with the reason, not pushed
//   past it.
// - **Re-propose what already has a block.** The caller leaves such items out
//   (their blocks arrive as busy time), so a second run changes nothing.
//
// Weekdays are Monday = 0 … Sunday = 6, the platform's own convention
// (`idealWeekStore`). Minutes-of-day are wall-clock minutes in `rules.tz`; busy
// time is instants. Each day's window is converted at the offset in force that
// day (`fromZone`), so 09:00 stays 09:00 across a clock change.

import { fromZone, zoneOffset, ymd } from '../time/slots'
import { addDays } from '../time/taskTime'
import type { Load } from '../time/overlapRules'

export type { Load }

const MIN = 60_000
const DAY_MS = 86_400_000
const GRID = 15 // minutes: every block starts and is as long as a multiple of this

export interface Interval { start: number; end: number }

/** Something already on the calendar (or a rule that acts like it). */
export interface Busy extends Interval {
  /** What it asks of you; decides the travel / meeting buffer around it. */
  load: Load
  /** Its name, when known — only used to say WHAT a moved block overlaps. */
  title?: string
}

export interface Rules {
  tz: string
  /** Weekdays the person plans on, Monday = 0. */
  days: number[]
  /** The working day, minutes after midnight. */
  dayStartMin: number
  dayEndMin: number
  /** No call or meeting before this. */
  earliestMeetingMin: number
  /** Gap kept around a call (`present`) and around something in person (`away`). */
  bufferMins: number
  physicalBufferMins: number
  /** Keep the focus window for focus work, and keep other things out of it. */
  protectFocus: boolean
  focusStartMin: number
  focusEndMin: number
  /** Ceilings per day, in minutes. */
  maxPlannedMinsPerDay: number
  maxFocusMinsPerDay: number
}

export const DEFAULT_RULES: Rules = {
  tz: 'UTC',
  days: [0, 1, 2, 3, 4, 5, 6],
  dayStartMin: 9 * 60,
  dayEndMin: 17 * 60,
  earliestMeetingMin: 10 * 60,
  bufferMins: 30,
  physicalBufferMins: 60,
  protectFocus: true,
  focusStartMin: 9 * 60,
  focusEndMin: 11 * 60,
  maxPlannedMinsPerDay: 6 * 60,
  maxFocusMinsPerDay: 4 * 60,
}

export type ItemKind = 'task' | 'activity' | 'milestone'

export interface Item {
  /** Unique within one plan. */
  key: string
  kind: ItemKind
  /** The task / project / milestone this is for, when it is one. */
  refId?: string
  title: string
  /** Minutes to place in total (one session, for an activity). */
  mins: number
  /** The longest single block. Default: 2 h for focus work, otherwise `mins`. */
  chunkMins?: number
  load: Load
  /** Last day it may be worked on, inclusive, YYYY-MM-DD. A ceiling. */
  due?: string
  /** 0 = P0 … 3 = P3. Unset counts as 2. */
  priority?: number
  /** How many sessions this week (activities). Each is `mins` long, on a different day. */
  times?: number
  /** Once on each day it may go on — "daily" means every day you plan on, not seven, so a five-day week is five. */
  daily?: boolean
  /** Allowed weekdays (Monday = 0). Default: every planned day. */
  days?: number[]
  /** Where in the day it likes to be, minutes after midnight. */
  preferred?: { startMin: number; endMin: number }
  projectId?: string
  milestoneId?: string
  /** One short phrase said first in the reason ("overdue since 2 Nov"). */
  note?: string
}

/** Time the person set aside for a KIND of work (an Ideal Week block). Work whose load is in `loads` may
 *  use it — and is put there first; everything else keeps out of it. `soft` is kept out of while there is
 *  room elsewhere and used when there is not. A block no load matches (Health, Personal) is simply taken. */
export interface Reserved extends Interval {
  loads: Load[]
  title: string
  soft?: boolean
}

export interface PlanInput {
  /** The first day of the week, YYYY-MM-DD, in `rules.tz`. Seven days from here. */
  weekOf: string
  /** Nothing is proposed before this instant. */
  now: number
  rules: Rules
  /** Hard: calendars, hard Ideal Week blocks, prayer times. */
  busy: Busy[]
  /** Soft: avoided while there is room, used when there is not. */
  soft?: Interval[]
  /** Time set aside for a kind of work (Ideal Week). */
  reserved?: Reserved[]
  /** No call or meeting inside these ("no meetings Monday mornings"). Other work may use them. */
  blackouts?: Interval[]
  items: Item[]
}

export interface Proposal {
  /** `${itemKey}#${n}` — stable for the same input. */
  id: string
  itemKey: string
  kind: ItemKind
  refId?: string
  title: string
  load: Load
  date: string
  startMin: number
  mins: number
  start: number
  end: number
  /** Which block of how many, for an item split into several. */
  part: number
  of: number
  /** The last day it may be on, when it has one — a move must not go past it. */
  due?: string
  /** Why here — one short sentence the panel and the bots can say as it is. */
  reason: string
  /** True when the only room was the gap kept around a meeting (never the meeting itself). */
  inBuffer?: boolean
  projectId?: string
  milestoneId?: string
}

export type WhyNot = 'no-days' | 'past-due' | 'at-limit' | 'no-room'

export interface Unplaced {
  itemKey: string
  title: string
  /** Minutes asked for / placed / left. */
  mins: number
  placed: number
  left: number
  why: WhyNot
  /** A sentence, ready to show. */
  because: string
}

export interface PlanResult {
  problem: string | null
  proposals: Proposal[]
  unplaced: Unplaced[]
  /** Planned minutes per day, YYYY-MM-DD → minutes, only days that are planned on. */
  perDay: Record<string, number>
  plannedMins: number
}

// ─── Small things ────────────────────────────────────────────────────────────

const ceilGrid = (ms: number) => Math.ceil(ms / (GRID * MIN)) * (GRID * MIN)

/** Monday = 0 … Sunday = 6, for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = ymd(date)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

const validDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = ymd(s)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** `from` with every `cut` removed. Both lists are treated as unordered. */
function subtract(from: Interval[], cut: Interval[]): Interval[] {
  let out = from.filter(i => i.end > i.start).sort((a, b) => a.start - b.start)
  for (const c of cut) {
    if (c.end <= c.start) continue
    const next: Interval[] = []
    for (const i of out) {
      if (c.end <= i.start || c.start >= i.end) { next.push(i); continue }
      if (c.start > i.start) next.push({ start: i.start, end: c.start })
      if (c.end < i.end) next.push({ start: c.end, end: i.end })
    }
    out = next
  }
  return out
}

function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end)
  return end > start ? { start, end } : null
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayName = (date: string) => DAY_NAMES[weekdayOf(date)]

const isMeetingLoad = (l: Load) => l === 'present' || l === 'away'

/** Cuts a block into pieces no longer than `max`, in grid steps, none under one step. */
function pieces(mins: number, max: number): number[] {
  const total = Math.max(GRID, Math.ceil(mins / GRID) * GRID)
  const cap = Math.max(GRID, Math.floor(max / GRID) * GRID)
  const out: number[] = []
  let left = total
  while (left > 0) { const p = Math.min(cap, left); out.push(p); left -= p }
  return out
}

/** Busy time with the gap its kind asks for: travel around something in person, a buffer around a call. */
export function padBusy(busy: Busy[], rules: Pick<Rules, 'bufferMins' | 'physicalBufferMins'>): Interval[] {
  return busy
    .filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .map(b => {
      const pad = (b.load === 'away' ? rules.physicalBufferMins : b.load === 'present' ? rules.bufferMins : 0) * MIN
      return { start: b.start - pad, end: b.end + pad }
    })
}

// ─── The plan ────────────────────────────────────────────────────────────────

interface DayWin { date: string; dow: number; window: Interval }

export function planWeek(input: PlanInput): PlanResult {
  const empty = (problem: string | null): PlanResult => ({ problem, proposals: [], unplaced: [], perDay: {}, plannedMins: 0 })
  const { rules, weekOf, now } = input

  if (!validDate(weekOf)) return empty(`"${String(weekOf)}" is not a date (use YYYY-MM-DD).`)
  if (!Number.isFinite(now)) return empty('The current time was not given.')
  try { new Intl.DateTimeFormat('en-US', { timeZone: rules.tz }) } catch { return empty(`"${rules.tz}" is not a time zone.`) }
  if (!(rules.dayEndMin > rules.dayStartMin)) return empty('The working day ends before it starts.')

  const planned = new Set(rules.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))

  // Each planned day's working window, at that day's own offset, and never before now.
  const notBefore = ceilGrid(now)
  const wins: DayWin[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekOf, i)
    const dow = weekdayOf(date)
    if (!planned.has(dow)) continue
    const [y, m, d] = ymd(date)
    const start = Math.max(fromZone(y, m, d, 0, rules.dayStartMin, 0, rules.tz), notBefore)
    const end = fromZone(y, m, d, 0, rules.dayEndMin, 0, rules.tz)
    if (end > start) wins.push({ date, dow, window: { start, end } })
  }

  const perDay: Record<string, number> = {}
  const focusPerDay: Record<string, number> = {}
  for (const w of wins) { perDay[w.date] = 0; focusPerDay[w.date] = 0 }

  // Hard time: what is on the calendar, with the buffer its kind asks for.
  const hard: Interval[] = padBusy(input.busy, rules)
  // The same busy time WITHOUT its buffer — what a block may use as a last resort, when nothing fits with the gap kept.
  const rawBusy: Interval[] = input.busy.filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start).map(b => ({ start: b.start, end: b.end }))
  const hasBuffer = hard.some((h, i) => h.start !== rawBusy[i]?.start || h.end !== rawBusy[i]?.end)
  const soft: Interval[] = (input.soft ?? []).filter(s => s.end > s.start)
  const reserved: Reserved[] = (input.reserved ?? []).filter(r => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
  const blackouts: Interval[] = (input.blackouts ?? []).filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
  const placedBlocks: Interval[] = []
  const onDayByItem: Record<string, Record<string, number>> = {}

  const proposals: Proposal[] = []
  const unplaced: Unplaced[] = []

  // The order things are placed in: priority, then the nearest ceiling, then the longest.
  const queue = input.items
    .filter(it => it && Number.isFinite(it.mins) && it.mins > 0)
    .flatMap(it => {
      const n = it.daily
        ? Math.max(1, wins.filter(w => !it.days || it.days.includes(w.dow)).length)
        : Math.max(1, Math.floor(it.times ?? 1))
      return Array.from({ length: n }, (_, k) => ({ it, session: k, sessions: n }))
    })
    .sort((a, b) =>
      (a.it.priority ?? 2) - (b.it.priority ?? 2)
      || (a.it.due ?? '9999-99-99').localeCompare(b.it.due ?? '9999-99-99')
      || b.it.mins - a.it.mins
      || a.it.key.localeCompare(b.it.key)
      || a.session - b.session)

  for (const { it, session, sessions } of queue) {
    const itemKey = sessions > 1 ? `${it.key}@${session + 1}` : it.key
    // What is out of bounds for THIS item: reserved time that is not for its kind of work, and — for a
    // call or meeting — the windows where meetings are not wanted.
    const own = reserved.filter(r => r.loads.includes(it.load))
    const itemOther: Interval[] = [
      ...reserved.filter(r => !r.soft && !r.loads.includes(it.load)),
      ...(isMeetingLoad(it.load) ? blackouts : []),
    ]
    const itemHard: Interval[] = [...hard, ...itemOther]
    const itemHardNoBuffer: Interval[] = [...rawBusy, ...itemOther]
    const itemSoft: Interval[] = [...soft, ...reserved.filter(r => r.soft && !r.loads.includes(it.load))]
    const allowed = it.days ? new Set(it.days) : null
    const cands = wins.filter(w => (!allowed || allowed.has(w.dow)) && (!it.due || w.date <= it.due))
    const isActivity = it.kind === 'activity'
    const urgent = (it.priority ?? 2) === 0
    // Unless told otherwise a block is the whole thing (rounded UP to the grid, like the total,
    // or 20 min would be cut into two of 15), and focus work is at most two hours at a time.
    const max = it.chunkMins ?? (it.load === 'focus' ? 120 : Math.ceil(it.mins / GRID) * GRID)
    const sizes = pieces(it.mins, max)
    // Minutes of THIS item on each day, across all its sessions: an activity three times a
    // week must not put two on one day just because the second session is placed separately.
    const onDay = (onDayByItem[it.key] ??= {})
    let placed = 0
    let why: WhyNot | null = null

    if (!cands.length) why = it.due && wins.length && it.due < wins[0].date ? 'past-due' : 'no-days'
    // Something urgent, or due within two days of the first day it could go, takes the
    // nearest day. Everything else spreads: the emptiest day first.
    const soonest = urgent || (!!it.due && cands.length > 0 && it.due <= addDays(cands[0].date, 2))

    for (const [idx, size] of sizes.entries()) {
      if (why === 'past-due' || why === 'no-days') break
      const len = size * MIN
      // Days in the order we would like them (and, for one thing split up, not the one it is already on).
      const order = [...cands]
        .filter(w => !(isActivity && (onDay[w.date] ?? 0) > 0))
        .sort((a, b) => soonest
          ? a.date.localeCompare(b.date)
          : (onDay[a.date] ?? 0) - (onDay[b.date] ?? 0) || perDay[a.date] - perDay[b.date] || a.date.localeCompare(b.date))

      let hit: { w: DayWin; at: number; how: string; inBuffer: boolean } | null = null
      let sawCap = false

      // Windows from most to least wanted. Each is tried avoiding soft time, then not.
      const passes: { name: string; pick: (w: DayWin) => Interval[] }[] = []
      const focusWin = (w: DayWin): Interval | null => {
        const [y, m, d] = ymd(w.date)
        return intersect(w.window, {
          start: fromZone(y, m, d, 0, rules.focusStartMin, 0, rules.tz),
          end: fromZone(y, m, d, 0, rules.focusEndMin, 0, rules.tz),
        })
      }
      const meetingFloor = (w: DayWin): Interval => {
        if (!isMeetingLoad(it.load)) return w.window
        const [y, m, d] = ymd(w.date)
        return intersect(w.window, { start: fromZone(y, m, d, 0, rules.earliestMeetingMin, 0, rules.tz), end: w.window.end }) ?? { start: 0, end: 0 }
      }
      if (own.length) {
        passes.push({
          name: 'in your Ideal Week block',
          pick: w => own.map(r => intersect(meetingFloor(w), r)).filter((x): x is Interval => x !== null),
        })
      }
      if (it.preferred) {
        const p = it.preferred
        passes.push({
          name: `around ${hhmm(p.startMin)}`,
          pick: w => {
            const [y, m, d] = ymd(w.date)
            const r = intersect(meetingFloor(w), { start: fromZone(y, m, d, 0, p.startMin, 0, rules.tz), end: fromZone(y, m, d, 0, p.endMin, 0, rules.tz) })
            return r ? [r] : []
          },
        })
      }
      if (rules.protectFocus && it.load === 'focus') {
        passes.push({ name: 'in your focus window', pick: w => { const f = focusWin(w); return f ? [f] : [] } })
      } else if (rules.protectFocus) {
        passes.push({
          name: 'outside your focus window',
          pick: w => {
            const f = focusWin(w)
            const base = meetingFloor(w)
            return f ? subtract([base], [f]) : [base]
          },
        })
      }
      passes.push({ name: '', pick: w => [meetingFloor(w)] })

      // First with the gap around every meeting kept. Only when nothing at all fits that way, a second try that may use
      // the gap (never the meeting): a buffer is a courtesy to yourself, and a block squeezed into one — flagged, so it
      // is said out loud — beats a task left off the week.
      search:
      for (const useBuffer of hasBuffer ? [false, true] : [false]) {
        const hardNow = useBuffer ? itemHardNoBuffer : itemHard
        for (const avoidSoft of [true, false]) {
          if (avoidSoft && !itemSoft.length) continue
          for (const pass of passes) {
            for (const w of order) {
              if (perDay[w.date] + size > rules.maxPlannedMinsPerDay) { sawCap = true; continue }
              if (it.load === 'focus' && focusPerDay[w.date] + size > rules.maxFocusMinsPerDay) { sawCap = true; continue }
              const free = subtract(pass.pick(w), [...hardNow, ...placedBlocks, ...(avoidSoft ? itemSoft : [])])
              for (const f of free) {
                const at = ceilGrid(f.start)
                if (at + len <= f.end) { hit = { w, at, how: pass.name, inBuffer: useBuffer }; break search }
              }
            }
          }
        }
      }

      if (!hit) { why = why ?? (sawCap ? 'at-limit' : 'no-room'); continue }

      const { w, at, how, inBuffer } = hit as { w: DayWin; at: number; how: string; inBuffer: boolean }
      // The wall-clock minute, read off the instant itself: a day's midnight may not exist.
      const startMin = Math.round(((at + zoneOffset(at, rules.tz)) % DAY_MS) / MIN)
      placedBlocks.push({ start: at, end: at + len })
      perDay[w.date] += size
      if (it.load === 'focus') focusPerDay[w.date] += size
      onDay[w.date] = (onDay[w.date] ?? 0) + size
      placed += size

      const bits: string[] = []
      if (it.due) bits.push(`${how ? how + ', ' : ''}before it is due ${dayName(it.due)}`.replace(/^, /, ''))
      else if (how) bits.push(how)
      if ((it.priority ?? 2) === 0) bits.push('it is P0, so it goes first')
      if (!bits.length) bits.push(`a free slot on ${dayName(w.date)}`)
      if (inBuffer) bits.push('squeezed into the gap around a meeting — there was no other room')
      if (it.note) bits.unshift(it.note)

      proposals.push({
        id: `${itemKey}#${idx + 1}`,
        itemKey, kind: it.kind, refId: it.refId, title: it.title, load: it.load,
        date: w.date, startMin, mins: size, start: at, end: at + len,
        part: idx + 1, of: sizes.length,
        due: it.due,
        reason: bits.join(' · '),
        ...(inBuffer ? { inBuffer: true } : {}),
        projectId: it.projectId, milestoneId: it.milestoneId,
      })
    }

    const total = sizes.reduce((a, b) => a + b, 0)
    if (placed < total) {
      const w: WhyNot = why ?? 'no-room'
      const left = total - placed
      const dueSay = it.due ? ` before ${dayName(it.due)} ${it.due}` : ''
      const because =
        w === 'past-due' ? `It was due ${it.due}, before this week starts, so nothing was planned.`
        : w === 'no-days' ? (wins.length ? `None of the days it is allowed on${dueSay} are days you plan on.` : 'No day this week is one you plan on, or it is all over.')
        : w === 'at-limit' ? `The days${dueSay} are already at their daily limit.`
        : `There is no free time for ${left} min${dueSay}.`
      unplaced.push({ itemKey, title: it.title, mins: total, placed, left, why: w, because })
    }
  }

  proposals.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  const plannedMins = proposals.reduce((n, p) => n + p.mins, 0)
  return { problem: null, proposals, unplaced, perDay, plannedMins }
}
