// Ported verbatim from the web app's supabase/functions/_shared/weekPlanRules.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Your rules, as the week planner reads them ──────────────────────────────
//
// One mapping from what Settings stores to the `Rules` the engine takes, so the
// app, the in-app assistant, Telegram and Siri plan inside the same working day.
// Pure — no Deno, no store — and the app's `src/lib/weekPlanRules.ts` is a thin
// caller of this file.
//
// What Settings → Schedule and Profile hold, and what each becomes:
//   Work days (Profile)      → the days planned on        ("Mon".."Sun")
//   Focus window             → the focus window; its start is the day's start
//   Earliest meeting         → no call or meeting before this
//   End of day               → the day's end (family time after it is never touched)
//   Meeting / physical buffer→ the gap kept around a call / something in person
//   Protect focus            → keep the focus window for focus work
//
// Settings has no "start of day"; the focus window opens it. That is a reading,
// and the notes say so when a value had to be replaced, rather than planning
// quietly inside hours nobody chose.

import { DEFAULT_RULES } from './weekPlan'
import type { Rules } from './weekPlan'
import { addDays, dayOf } from '../time/taskTime'
import { ymd } from '../time/slots'

/** The settings fields the planner reads, in the app's own (camelCase) shape. */
export interface ScheduleLike {
  workWeek?: string[]
  focusStart?: string
  focusEnd?: string
  earliestMeeting?: string
  endOfDay?: string
  bufferMins?: number
  physicalBufferMins?: number
  protectFocus?: boolean
}

/** What `dbSync` stores in `users.schedule_rules`, read into the same shape. A bot reads the row and
 *  calls this; the app already holds the camelCase form. Anything missing stays missing. */
export function scheduleFromRules(raw: unknown): ScheduleLike {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    workWeek: Array.isArray(r.work_week) ? r.work_week.filter((x): x is string => typeof x === 'string') : undefined,
    focusStart: str(r.focus_start),
    focusEnd: str(r.focus_end),
    earliestMeeting: str(r.earliest_meeting),
    endOfDay: str(r.end_of_day),
    bufferMins: num(r.buffer_mins),
    physicalBufferMins: num(r.physical_buffer),
    protectFocus: typeof r.protect_focus === 'boolean' ? r.protect_focus : undefined,
  }
}

/** The app's defaults for the fields above (`DEFAULTS` in settings/model.ts) — what a person who
 *  never opened Settings has. A test fails if the two drift apart. */
export const SCHEDULE_DEFAULTS: Required<ScheduleLike> = {
  workWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  focusStart: '09:00', focusEnd: '11:00', earliestMeeting: '10:00', endOfDay: '17:00',
  bufferMins: 30, physicalBufferMins: 60, protectFocus: true,
}

const NAMES: Record<string, number> = {
  mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
}

/** "09:30" → 570. Anything else → null. 24:00 is allowed as an end. */
export function parseClock(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(v)
  if (!m) return null
  const h = +m[1], mi = +m[2]
  if (mi > 59 || h > 24 || (h === 24 && mi !== 0)) return null
  return h * 60 + mi
}

const clampMins = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(180, Math.max(0, Math.round(v))) : fallback

export interface RulesFrom { rules: Rules; notes: string[] }

/** Settings → the engine's rules, with a sentence for every value that had to be replaced. */
export function rulesFrom(s: ScheduleLike, tz: string): RulesFrom {
  const notes: string[] = []
  const D = SCHEDULE_DEFAULTS

  const days = s.workWeek === undefined
    ? D.workWeek.map(n => NAMES[n.toLowerCase()])
    : [...new Set(s.workWeek.map(n => NAMES[String(n).trim().toLowerCase()]).filter((n): n is number => n !== undefined))].sort((a, b) => a - b)
  if (s.workWeek !== undefined && s.workWeek.length && !days.length) notes.push(`Work days ("${s.workWeek.join(', ')}") were not days of the week, so no day is planned on.`)

  let start = parseClock(s.focusStart ?? D.focusStart)
  let end = parseClock(s.endOfDay ?? D.endOfDay)
  if (start === null) { notes.push(`The focus start "${s.focusStart}" is not a time; using ${D.focusStart}.`); start = parseClock(D.focusStart)! }
  if (end === null) { notes.push(`The end of day "${s.endOfDay}" is not a time; using ${D.endOfDay}.`); end = parseClock(D.endOfDay)! }
  if (end <= start) {
    notes.push(`The end of day (${s.endOfDay}) is not after the day starts (${s.focusStart}); using ${D.focusStart}–${D.endOfDay}.`)
    start = parseClock(D.focusStart)!; end = parseClock(D.endOfDay)!
  }

  let fEnd = parseClock(s.focusEnd ?? D.focusEnd)
  if (fEnd === null) { notes.push(`The focus end "${s.focusEnd}" is not a time; using ${D.focusEnd}.`); fEnd = parseClock(D.focusEnd)! }
  fEnd = Math.min(Math.max(fEnd, start), end)

  let early = parseClock(s.earliestMeeting ?? D.earliestMeeting)
  if (early === null) { notes.push(`The earliest meeting "${s.earliestMeeting}" is not a time; using ${D.earliestMeeting}.`); early = parseClock(D.earliestMeeting)! }
  early = Math.min(Math.max(early, start), end)

  const window = end - start
  const maxPlanned = Math.min(DEFAULT_RULES.maxPlannedMinsPerDay, Math.floor(window / 15) * 15)
  return {
    notes,
    rules: {
      tz,
      days,
      dayStartMin: start,
      dayEndMin: end,
      earliestMeetingMin: early,
      bufferMins: clampMins(s.bufferMins, D.bufferMins),
      physicalBufferMins: clampMins(s.physicalBufferMins, D.physicalBufferMins),
      protectFocus: s.protectFocus ?? D.protectFocus,
      focusStartMin: start,
      focusEndMin: fEnd,
      maxPlannedMinsPerDay: maxPlanned,
      maxFocusMinsPerDay: Math.min(DEFAULT_RULES.maxFocusMinsPerDay, maxPlanned),
    },
  }
}

// ─── Which week ──────────────────────────────────────────────────────────────

/** The calendar's week-start setting (`professor-week-start`: 0 = Sunday … 6 = Saturday). It is stored as
 *  text in a shared-prefs bag, so a string is as good as a number; anything else is Sunday, the app's default. */
export function parseWeekStart(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0
}

/** The first day (YYYY-MM-DD) of the week that holds `date`, for a week that starts on `weekStart` (Sunday = 0). */
export function weekContaining(date: string, weekStart: number): string {
  const [y, m, d] = ymd(date)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // Sunday = 0
  return addDays(date, -((dow - weekStart + 7) % 7))
}

/** The week to plan: this one, or the next. `now` is an instant; "today" is the day it is in `tz`. */
export function weekToPlan(which: 'this' | 'next', now: number, tz: string, weekStart: number): string {
  const first = weekContaining(dayOf(now, tz), weekStart)
  return which === 'next' ? addDays(first, 7) : first
}
