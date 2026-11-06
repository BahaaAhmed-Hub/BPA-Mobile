// Ported verbatim from the web app's supabase/functions/_shared/idealWeek.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Your Ideal Week, for the planner — and for more than one device ─────────
//
// Two jobs, both pure (no Deno, no store, no clock unless handed one).
//
// **1. Rows that can be joined.** Ideal Week keeps three lists (blocks, goals,
// rules) and until now each lived on one device. To follow you they ride in
// `prefSync`'s shared bag, and a list edited on two devices has to be JOINED:
// a plain overwrite loses whichever side lost the race, and a join that only
// adds brings every deleted block back from the other device. So each row
// carries `at` (when it last changed) and a delete leaves a tombstone
// (`gone: true`) — the same shape `cal-outcome-links` uses. The later `at`
// wins per row; a tie goes to this device; a tombstone is kept for 90 days
// and then forgotten, because a device asleep for longer than that has
// bigger problems than one block.
//
// **2. Rows → planner inputs.** A hard block is time set aside for a KIND of
// work (a "Deep Work" block is for focus work), a soft one is the same with a
// shrug, an enabled "no meetings" rule is a window calls stay out of, and a
// weekly goal with fewer blocks than its target hours is work still to place.
// Category budgets, time preferences and yield rules are NOT applied, and the
// notes say so rather than implying they were.

import { fromZone, ymd } from '../time/slots'
import { addDays } from '../time/taskTime'
import { weekdayOf } from './weekPlan'
import type { Interval, Item, Load, Reserved } from './weekPlan'

// ─── Rows that can be joined ─────────────────────────────────────────────────

export interface Synced { id: string; at?: string; gone?: boolean }

export const TOMBSTONE_DAYS = 90
const DAY_MS = 86_400_000

/** A list as the shared bag holds it (JSON text) or as localStorage gives it: every well-formed row,
 *  tombstones included. Anything that is not a row with a string id is dropped, not trusted. */
export function parseRows<T extends Synced>(raw: unknown): T[] {
  let v: unknown = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { return [] } }
  if (!Array.isArray(v)) return []
  return v.filter((r): r is T => !!r && typeof r === 'object' && typeof (r as Synced).id === 'string' && (r as Synced).id !== '')
}

/** The rows that are not deleted. */
export const liveRows = <T extends Synced>(raw: unknown): T[] => parseRows<T>(raw).filter(r => !r.gone)

const atOf = (r: Synced): string => (typeof r.at === 'string' ? r.at : '')
const expired = (r: Synced, now: number): boolean => {
  if (!r.gone) return false
  const t = Date.parse(atOf(r))
  return Number.isFinite(t) && now - t > TOMBSTONE_DAYS * DAY_MS
}

/** Two copies of a list, one list. Per id the later `at` wins and a tie keeps `mine`; a tombstone wins
 *  like any other row. Order: `mine` as it is, then what only `theirs` had. When `theirs` adds nothing,
 *  the result is `mine` row for row — so a pull that learned nothing changes nothing. */
export function joinRows<T extends Synced>(mine: T[], theirs: T[], now: number = Date.now()): T[] {
  const byId = new Map<string, T>()
  for (const r of mine) byId.set(r.id, r)
  const added: T[] = []
  for (const t of theirs) {
    const m = byId.get(t.id)
    if (!m) { byId.set(t.id, t); added.push(t); continue }
    if (atOf(t) > atOf(m)) byId.set(t.id, t)
  }
  const out: T[] = []
  for (const r of mine) { const w = byId.get(r.id)!; if (!expired(w, now)) out.push(w) }
  for (const r of added) { const w = byId.get(r.id)!; if (!expired(w, now)) out.push(w) }
  return out
}

const same = (a: Synced, b: Synced): boolean => {
  const strip = ({ at: _a, gone: _g, ...rest }: Synced & Record<string, unknown>) => JSON.stringify(rest, Object.keys(rest).sort())
  return strip(a as Synced & Record<string, unknown>) === strip(b as Synced & Record<string, unknown>)
}

/** What to store when the screen hands over the list it wants. A row that is new or different is stamped
 *  `now`; one that is the same keeps its `at`; a row that has gone is turned into a tombstone (so the other
 *  device learns of the delete); old tombstones are forgotten. Returns the list to write. */
export function stampRows<T extends Synced>(prev: T[], next: T[], now: number = Date.now()): T[] {
  const stamp = new Date(now).toISOString()
  const before = new Map(prev.map(r => [r.id, r] as const))
  const live: T[] = []
  const kept = new Set<string>()
  for (const n of next) {
    if (!n || typeof n.id !== 'string' || n.id === '' || kept.has(n.id)) continue
    kept.add(n.id)
    const { gone: _g, ...rest } = n as T & { gone?: boolean }
    const p = before.get(n.id)
    // unchanged and still alive → the stored row exactly (so the text does not move)
    live.push(p && !p.gone && same(p, rest as T) ? p : { ...(rest as T), at: stamp })
  }
  const tombs: T[] = []
  for (const p of prev) {
    if (kept.has(p.id)) continue
    if (p.gone) { if (!expired(p, now)) tombs.push(p); continue }
    tombs.push({ id: p.id, gone: true, at: stamp } as T)
  }
  // The same live rows in the same order as before: leave every row — tombstones too — where it was,
  // or handing a list back unchanged would move the stored text and send a push for nothing.
  const prevLive = prev.filter(p => !p.gone)
  if (live.length === prevLive.length && live.every((r, i) => r.id === prevLive[i].id)) {
    const liveById = new Map(live.map(r => [r.id, r] as const))
    return prev.flatMap(p => (p.gone ? (expired(p, now) ? [] : [p]) : [liveById.get(p.id) as T]))
  }
  return [...live, ...tombs]
}

// ─── Rows → planner inputs ───────────────────────────────────────────────────

/** The fields of an Ideal Week block the planner reads. `day` is Monday = 0. */
export interface IdealBlockRow extends Synced {
  day: number; startHour: number; endHour: number; title: string; category: string
  blockType: 'hard' | 'soft'; goalId?: string
}
export interface IdealGoalRow extends Synced {
  title: string; category: string; targetHoursWeek: number
  horizon: 'weekly' | 'monthly' | 'longer'; enabled: boolean
}
export interface IdealRuleRow extends Synced {
  title: string; ruleType: 'no-meetings' | 'category-budget' | 'time-preference' | 'yield'; enabled: boolean
  config: { days?: number[]; startHour?: number; endHour?: number }
}

/** Which kinds of work a category of time is for. Health, Personal and Other are for no planned work:
 *  the gym is not the place for a report. */
export const LOADS_FOR_CATEGORY: Record<string, Load[]> = {
  Focus: ['focus'], Learning: ['focus'], Creative: ['focus'],
  Admin: ['light'],
  Client: ['present', 'away'], Team: ['present', 'away'],
}
export const loadsFor = (category: string): Load[] => LOADS_FOR_CATEGORY[category] ?? []

const hours = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export interface IdealForWeek {
  reserved: Reserved[]
  blackouts: Interval[]
  /** Weekly goals still short of their hours, as things to place. */
  goalItems: Item[]
  notes: string[]
}

/** The week's date → instants, at each day's own offset. */
function spanOn(date: string, startMin: number, endMin: number, tz: string): Interval | null {
  const [y, m, d] = ymd(date)
  const start = fromZone(y, m, d, 0, startMin, 0, tz), end = fromZone(y, m, d, 0, endMin, 0, tz)
  return end > start ? { start, end } : null
}

export function idealForWeek(a: {
  weekOf: string; tz: string; blocks: IdealBlockRow[]; goals: IdealGoalRow[]; rules: IdealRuleRow[]
}): IdealForWeek {
  const notes: string[] = []
  const dates = Array.from({ length: 7 }, (_, i) => addDays(a.weekOf, i))
  const reserved: Reserved[] = []
  const blackouts: Interval[] = []

  const blocks = a.blocks.filter(b => !b.gone)
  let skipped = 0
  for (const b of blocks) {
    if (!hours(b.startHour) || !hours(b.endHour) || !(b.endHour > b.startHour) || b.startHour < 0 || b.endHour > 24 || !Number.isInteger(b.day) || b.day < 0 || b.day > 6) { skipped++; continue }
    for (const date of dates) {
      if (weekdayOf(date) !== b.day) continue
      const span = spanOn(date, Math.round(b.startHour * 60), Math.round(b.endHour * 60), a.tz)
      if (span) reserved.push({ ...span, loads: loadsFor(b.category), title: b.title, soft: b.blockType === 'soft' })
    }
  }
  if (skipped) notes.push(`${skipped} Ideal Week block${skipped === 1 ? ' has' : 's have'} hours that make no sense and ${skipped === 1 ? 'was' : 'were'} left out.`)

  const unused: string[] = []
  for (const r of a.rules.filter(r => !r.gone && r.enabled)) {
    if (r.ruleType !== 'no-meetings') { unused.push(r.title); continue }
    const days = Array.isArray(r.config?.days) && r.config.days.length ? r.config.days : [0, 1, 2, 3, 4, 5, 6]
    const s = hours(r.config?.startHour) ? r.config.startHour! : 0
    const e = hours(r.config?.endHour) ? r.config.endHour! : 24
    if (!(e > s) || s < 0 || e > 24) { notes.push(`The rule "${r.title}" has hours that make no sense and was left out.`); continue }
    for (const date of dates) {
      if (!days.includes(weekdayOf(date))) continue
      const span = spanOn(date, Math.round(s * 60), Math.round(e * 60), a.tz)
      if (span) blackouts.push(span)
    }
  }
  if (unused.length) notes.push(`${unused.length} Ideal Week rule${unused.length === 1 ? '' : 's'} (${unused.slice(0, 3).join(', ')}${unused.length > 3 ? '…' : ''}) ${unused.length === 1 ? 'is' : 'are'} not applied by the planner yet: category budgets, time preferences and yield rules need categories on tasks.`)

  // a weekly goal's hours already given to it by blocks are not asked for twice
  const given = new Map<string, number>()
  for (const b of blocks) if (b.goalId && hours(b.startHour) && hours(b.endHour) && b.endHour > b.startHour) given.set(b.goalId, (given.get(b.goalId) ?? 0) + (b.endHour - b.startHour))
  const goalItems: Item[] = []
  for (const g of a.goals) {
    if (g.gone || !g.enabled || g.horizon !== 'weekly' || !hours(g.targetHoursWeek) || g.targetHoursWeek <= 0) continue
    const left = g.targetHoursWeek - (given.get(g.id) ?? 0)
    if (left < 0.25) continue
    goalItems.push({
      key: `goal:${g.id}`, kind: 'activity', refId: g.id, title: g.title,
      mins: Math.round(left * 60), load: loadsFor(g.category)[0] ?? 'light', chunkMins: 120,
    })
  }
  return { reserved, blackouts, goalItems, notes }
}
