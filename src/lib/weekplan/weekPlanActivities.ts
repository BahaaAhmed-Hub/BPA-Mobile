// Ported verbatim from the web app's supabase/functions/_shared/weekPlanActivities.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Things to fit in that are not tasks: "gym 3×/week, study 2h daily" ──────
//
// Two doors into the same `Item`s. **Structured**: `itemsFromActivities` checks what a model hands `plan_week` (the
// assistant, Telegram and Siri all understand language already). **Typed**: `parseActivities` reads the Plan week
// panel's text box with plain rules — no AI key needed, and what it understood is shown back to be corrected, because a
// parser that guesses silently is worse than one that asks.
//
// What it will not do: invent. A clause with no title is "unread" and said so; nothing is defaulted that the person did
// not at least have the chance to see (the panel prints `activitySummary` for each).

import { inferTaskType } from './taskTypes'
import { loadOf } from '../time/overlapRules'
import type { Item } from './weekPlan'

export interface ActivityArg {
  title: string
  /** Minutes per session. Default 60. */
  minutes?: number
  /** Sessions this week, on different days. Default 1 (or one per named day). */
  times_per_week?: number
  /** Once on each day you plan on (or on each named day). */
  daily?: boolean
  /** Monday = 0 … Sunday = 6, or three-letter names. */
  days?: (number | string)[]
  time_of_day?: 'morning' | 'afternoon' | 'evening'
}

const DAY_NAMES: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
const WINDOWS = { morning: { startMin: 6 * 60, endMin: 12 * 60 }, afternoon: { startMin: 12 * 60, endMin: 17 * 60 }, evening: { startMin: 17 * 60, endMin: 21 * 60 } } as const
const dayIndex = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6) return v
  if (typeof v === 'string') { const k = DAY_NAMES[v.trim().toLowerCase().slice(0, 3)]; if (k !== undefined) return k }
  return null
}
const MAX_ACTIVITIES = 12

export interface ActivityItems { items: Item[]; problems: string[] }

/** Validate what a model (or the panel's parser) hands over, and make `Item`s of it. Anything out of range is refused with a sentence. */
export function itemsFromActivities(list: unknown): ActivityItems {
  const items: Item[] = [], problems: string[] = []
  if (list === undefined || list === null) return { items, problems }
  if (!Array.isArray(list)) return { items, problems: ['activities must be a list.'] }
  list.slice(0, MAX_ACTIVITIES).forEach((raw, i) => {
    const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const title = typeof a.title === 'string' ? a.title.trim().replace(/\s+/g, ' ') : ''
    if (!title || title.length > 60) { problems.push(`Activity ${i + 1} has ${title ? 'a title over 60 characters' : 'no title'}, so it was left out.`); return }
    let mins = 60
    if (a.minutes !== undefined) {
      if (typeof a.minutes !== 'number' || !Number.isFinite(a.minutes) || a.minutes < 5 || a.minutes > 480) { problems.push(`"${title}": minutes must be between 5 and 480, so it was left out.`); return }
      mins = Math.round(a.minutes)
    }
    let days: number[] | undefined
    if (a.days !== undefined) {
      const parsed = Array.isArray(a.days) ? a.days.map(dayIndex) : []
      if (!Array.isArray(a.days) || parsed.some(d => d === null) || !parsed.length) { problems.push(`"${title}": days must be names like Mon, Wed or numbers 0–6 (Monday = 0), so it was left out.`); return }
      days = [...new Set(parsed as number[])].sort((x, y) => x - y)
    }
    let times: number | undefined
    if (a.times_per_week !== undefined) {
      if (typeof a.times_per_week !== 'number' || !Number.isInteger(a.times_per_week) || a.times_per_week < 1 || a.times_per_week > 7) { problems.push(`"${title}": times_per_week must be a whole number from 1 to 7, so it was left out.`); return }
      times = a.times_per_week
    }
    const tod = a.time_of_day
    if (tod !== undefined && tod !== 'morning' && tod !== 'afternoon' && tod !== 'evening') { problems.push(`"${title}": time_of_day must be morning, afternoon or evening, so it was left out.`); return }
    const daily = a.daily === true
    items.push({
      key: `act:${i}`, kind: 'activity', title, mins, priority: 2,
      load: loadOf({ taskType: inferTaskType(title) }),
      ...(daily ? { daily: true } : { times: times ?? (days && !times ? days.length : 1) }),
      ...(days ? { days } : {}),
      ...(tod ? { preferred: { ...WINDOWS[tod] } } : {}),
    })
  })
  if (list.length > MAX_ACTIVITIES) problems.push(`Only the first ${MAX_ACTIVITIES} activities were taken.`)
  return { items, problems }
}

// ─── Reading what was typed ──────────────────────────────────────────────────

const COUNT: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, thrice: 3, three: 3, four: 4, five: 5, six: 6, seven: 7 }
// Exact day words only: "friends", "monitor", "wedding" and "sunrise" begin with one and are not one.
const NAME = '(?:mondays?|mon|tuesdays?|tues|tue|wednesdays?|weds|wed|thursdays?|thurs|thur|thu|fridays?|fri|saturdays?|sat|sundays?|sun)'
const ONLY_DAYS = new RegExp(`^(?:on\\s+|and\\s+|&\\s*)?(?:${NAME})(?:\\s*(?:,|and|&|/)?\\s*(?:${NAME}))*$`, 'i')
const EDGE = /^(?:\s|[,./&-]|\b(?:a|an|the|per|every|each|on|at|in|for|of|and|x|times?|week|wk|to)\b)+|(?:\s|[,./&-]|\b(?:a|an|the|per|every|each|on|at|in|for|of|and|x|times?|week|wk|to)\b)+$/gi

function readClause(raw: string): ActivityArg | null {
  let t = ` ${raw.replace(/[×✕]/g, 'x')} `
  const take = (re: RegExp): RegExpExecArray | null => { const m = re.exec(t); if (m) t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length); return m }
  let minutes: number | undefined, times: number | undefined, daily = false
  let days: number[] | undefined, tod: ActivityArg['time_of_day']

  // how long (before "how often", so "2h" is never read as twice)
  let m: RegExpExecArray | null
  if ((m = take(/\b(\d+)\s*h\s*(\d{1,2})\b/i))) minutes = +m[1] * 60 + +m[2]
  else if ((m = take(/\b(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?)\b/i))) minutes = Math.round(parseFloat(m[1].replace(',', '.')) * 60)
  else if ((m = take(/\b(\d+)\s*(?:m|mins?|minutes?)\b/i))) minutes = +m[1]
  else if (take(/\bhalf[ -]?(?:an? )?hour\b/i)) minutes = 30
  else if (take(/\bquarter(?: of)?(?: an?)? hour\b/i)) minutes = 15
  else if (take(/\ban? hour\b/i)) minutes = 60

  // how often
  if ((m = take(/\b(every|each)\s+(morning|afternoon|evening)\b/i))) { daily = true; tod = m[2].toLowerCase() as NonNullable<ActivityArg['time_of_day']> }
  if (take(/\b(?:daily|every ?day|each day|everyday)\b/i)) daily = true
  if (take(/\b(?:every|each) weekday\b/i)) { daily = true; days = [0, 1, 2, 3, 4] }
  if ((m = take(/\b(\d+|once|twice|thrice|one|two|three|four|five|six|seven)\s*(?:x|times?)\b(?:\s*(?:a|per|every|\/)?\s*(?:week|wk)\b)?/i))) times = /^\d+$/.test(m[1]) ? +m[1] : COUNT[m[1].toLowerCase()]
  else if ((m = take(/\b(once|twice|thrice)\b(?:\s*(?:a|per|every)\s*(?:week|wk)\b)?/i))) times = COUNT[m[1].toLowerCase()]
  take(/\b(?:weekly|a week|per week|each week|every week)\b/i)
  if (take(/\bweekdays?\b/i)) { days = [0, 1, 2, 3, 4]; if (times === undefined) daily = true }
  if (take(/\bweekends?\b/i)) { days = [5, 6]; if (times === undefined) daily = true }

  // which days, and which part of the day
  const named: number[] = []
  const dayRe = new RegExp(`\\b(${NAME})\\b`, 'gi')
  t = t.replace(dayRe, (_, d: string) => { named.push(DAY_NAMES[d.toLowerCase().slice(0, 3)]); return ' ' })
  if (named.length) { days = [...new Set(named)].sort((a, b) => a - b) }
  if (!tod && (m = take(/\b(?:in the |every |each )?(mornings?|afternoons?|evenings?)\b/i))) tod = m[1].toLowerCase().replace(/s$/, '') as NonNullable<ActivityArg['time_of_day']>

  const title = t.replace(EDGE, '').replace(/\s+/g, ' ').trim()
  if (!title) return null
  const out: ActivityArg = { title: title[0].toUpperCase() + title.slice(1) }
  if (minutes !== undefined) out.minutes = minutes
  if (daily) out.daily = true
  else if (times !== undefined) out.times_per_week = times
  if (days) out.days = days
  if (tod) out.time_of_day = tod
  return out
}

/** "gym 3x/week, study 2h daily, call mom on sundays" → activities, and the clauses that could not be read. */
export function parseActivities(text: string): { activities: ActivityArg[]; unread: string[] } {
  const parts = String(text ?? '').split(/[\n;,]+|\s\+\s/).map(s => s.trim()).filter(Boolean)
  // "gym on mon, wed and fri": the comma split off clauses that are only days — they belong to the one before.
  const clauses: string[] = []
  for (const p of parts) {
    if (clauses.length && ONLY_DAYS.test(p)) clauses[clauses.length - 1] += ` ${p}`
    else clauses.push(p)
  }
  const activities: ActivityArg[] = [], unread: string[] = []
  for (const c of clauses) { const a = readClause(c); if (a) activities.push(a); else unread.push(c) }
  return { activities, unread }
}

const dur = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`)
/** What was understood, in a line the person can check: "Gym · 1 h · 3× a week · mornings". */
export function activitySummary(a: ActivityArg): string {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const days = a.days?.map(dayIndex).filter((d): d is number => d !== null).map(d => names[d])
  const often = a.daily ? (days ? `daily (${days.join(' ')})` : 'daily') : a.times_per_week ? `${a.times_per_week}× a week${days ? ` (${days.join(' ')})` : ''}` : days ? `on ${days.join(' ')}` : 'once'
  return [a.title, dur(a.minutes ?? 60), often, a.time_of_day ? `${a.time_of_day}s` : ''].filter(Boolean).join(' · ')
}
