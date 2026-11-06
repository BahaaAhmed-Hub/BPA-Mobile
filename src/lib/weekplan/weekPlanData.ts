// Ported verbatim from the web app's supabase/functions/_shared/weekPlanData.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── One pipeline, from "what is on the person's plate" to "what is proposed" ─
//
// Every door that plans a week — the calendar's Plan week button, the in-app assistant, Telegram, Siri — reads its
// own world (stores, or database rows and a calendar hub) into ONE plain `WeekData`, and calls `planFromData`. The
// reading differs by necessity; everything that DECIDES is here, so the four cannot plan different weeks from the
// same facts. `scripts/week-plan-doors.mjs` holds them to it.
//
// Also here: the words (`describePlan`), the fingerprint that ties a "yes" to the exact plan it was given for
// (`planHash`), and the check that a commit asks only for what the engine really proposed (`pickCommit`).

import { planWeek } from './weekPlan'
import type { Busy, Item, PlanInput, PlanResult, Proposal } from './weekPlan'
import { rulesFrom, weekToPlan } from './weekPlanRules'
import type { ScheduleLike } from './weekPlanRules'
import { itemsFromTasks, WHY_TEXT } from './weekPlanItems'
import type { MilestoneLike, ProjectLike, SkipWhy, Skipped, TaskLike } from './weekPlanItems'
import { idealForWeek } from './idealWeek'
import type { IdealBlockRow, IdealGoalRow, IdealRuleRow } from './idealWeek'
import { prayerBusy } from './weekPlanPrayer'
import type { PrayerPrefs } from './weekPlanPrayer'
import { busyOf } from './weekPlanBusy'
import type { EventTask, PlanEvent } from './weekPlanBusy'
import { addDays } from '../time/taskTime'

export type PlanWhich = 'this' | 'next'

export interface WeekData {
  now: number
  /** The zone the week is planned in — the wall clock the working day is read on. */
  tz: string
  /** 0 = Sunday … 6 = Saturday (the calendar's own setting). */
  weekStart: number
  schedule: ScheduleLike
  prayer: PrayerPrefs
  ideal: { blocks: IdealBlockRow[]; goals: IdealGoalRow[]; rules: IdealRuleRow[] }
  tasks: TaskLike[]
  /** Event id → the task it was made for (its load decides the travel / meeting buffer around it). */
  taskOfEvent: Record<string, EventTask>
  milestones: MilestoneLike[]
  projects: ProjectLike[]
  /** Every event read from the calendars, a day either side of the week. */
  events: PlanEvent[]
  /** Calendars that could not be READ. Any at all refuses the plan: an unread calendar looks exactly like an empty one. */
  failures: string[]
  /** The app's own marks on events ("cancelled"). The bots cannot read them (they are browser storage) — a stated gap. */
  statuses: Record<string, string>
  /** False when no Google calendar is connected at all. */
  calendarConnected: boolean
  /** Task ids the person asked to have planned although the planner would have left them out ("Plan anyway"). */
  force?: string[]
  /** The same by title, for a door that only knows names (the assistant, Telegram, Siri): matched exactly, ignoring case. */
  forceTitles?: string[]
  /** Extra things to place (a door's own: something the person typed). */
  extraItems?: Item[]
  /** Sentences about what that door could not read ("Activity 2 has no title…"), said above the plan. */
  extraNotes?: string[]
}

export interface Outcome {
  which: PlanWhich
  weekOf: string
  tz: string
  input: PlanInput
  result: PlanResult
  /** Sentences about anything replaced, left out or not applied — said above the plan. */
  notes: string[]
  skipped: Skipped[]
  skippedCounts: Record<SkipWhy, number>
  basis: { events: number; tasks: number; reservedBlocks: number; days: number }
  problem: string | null
}

const NO_SKIPS: Record<SkipWhy, number> = { 'has-block': 0, 'not-placed': 0, 'not-yours': 0, 'project-off': 0, later: 0, 'too-many': 0 }

export function planFromData(d: WeekData, which: PlanWhich): Outcome {
  const weekOf = weekToPlan(which, d.now, d.tz, d.weekStart)
  const { rules, notes } = rulesFrom(d.schedule, d.tz)
  const none = (problem: string): Outcome => ({
    which, weekOf, tz: d.tz, notes, problem, skipped: [], skippedCounts: { ...NO_SKIPS },
    input: { weekOf, now: d.now, rules, busy: [], items: [] },
    result: { problem, proposals: [], unplaced: [], perDay: {}, plannedMins: 0 },
    basis: { events: 0, tasks: 0, reservedBlocks: 0, days: rules.days.length },
  })
  if (!rules.days.length) return none('No day is switched on in Settings → Profile → Work days, so there is nothing to plan on.')

  // A diary that could not be read is not an empty one: the gap is exactly where the meeting it could not see is sitting.
  if (d.failures.length) {
    const why = [...new Set(d.failures)].slice(0, 3).join('; ')
    return none(`I could not read your calendar (${why}), so I did not plan over time that might not be free.`)
  }

  const busy: Busy[] = []
  for (const ev of d.events) {
    const b = busyOf(ev, d.taskOfEvent[ev.id], id => d.statuses[id])
    if (b) busy.push(b)
  }
  if (!d.calendarConnected && !d.events.length) notes.push('No Google calendar is connected, so this plan only avoids your Ideal Week and prayer times.')

  const ideal = idealForWeek({ weekOf, tz: d.tz, blocks: d.ideal.blocks, goals: d.ideal.goals, rules: d.ideal.rules })
  notes.push(...ideal.notes, ...(d.extraNotes ?? []))
  // "in the evening" against a 09–17 day cannot be had inside the day, and the plan stays inside the day — say so.
  for (const it of d.extraItems ?? []) {
    const p = it.preferred
    if (p && (p.endMin <= rules.dayStartMin || p.startMin >= rules.dayEndMin)) {
      notes.push(`"${it.title}" asked for ${hhmm(p.startMin)}–${hhmm(p.endMin)}, which is outside your working hours (${hhmm(rules.dayStartMin)}–${hhmm(rules.dayEndMin)}), so it was placed inside them.`)
    }
  }
  const prayer = prayerBusy(weekOf, d.tz, d.prayer)
  if (prayer.note) notes.push(prayer.note)

  const force = [...(d.force ?? [])]
  for (const raw of d.forceTitles ?? []) {
    const want = String(raw).trim().toLowerCase()
    const hit = want ? d.tasks.find(t => !t.completed && t.status !== 'done' && t.status !== 'cancelled' && t.title.trim().toLowerCase() === want) : undefined
    if (hit) force.push(hit.id)
    else notes.push(`No open task is called “${String(raw).slice(0, 60)}”, so it was not added to the plan.`)
  }
  const picked = itemsFromTasks(d.tasks, { weekOf, milestones: d.milestones, projects: d.projects, force })
  const input: PlanInput = {
    weekOf, now: d.now, rules, busy: [...busy, ...prayer.busy], reserved: ideal.reserved, blackouts: ideal.blackouts,
    items: [...picked.items, ...ideal.goalItems, ...(d.extraItems ?? [])],
  }
  const result = planWeek(input)
  return {
    which, weekOf, tz: d.tz, input, result, notes, skipped: picked.skipped, skippedCounts: picked.counts, problem: result.problem,
    basis: { events: busy.length, tasks: picked.items.length, reservedBlocks: ideal.reserved.length, days: rules.days.length },
  }
}

// ─── Words ───────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
/** "Tue 10 Nov" — fixed English names, so a server and a browser say the same thing. */
export function dayWords(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`
}
const dur = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`)

/** The one line that names a block — what is shown to approve, and what a commit must echo back. */
export function blockLabel(p: Proposal): string {
  return `${dayWords(p.date)} ${hhmm(p.startMin)}–${hhmm(p.startMin + p.mins)} · ${p.title}${p.of > 1 ? ` (${p.part}/${p.of})` : ''}`
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[–—-]/g, '-').trim()

/** A short fingerprint of exactly these blocks at exactly these times. */
export function planHash(ps: Proposal[]): string {
  let h = 0x811c9dc5
  for (const c of ps.map(p => `${p.id}|${p.start}|${p.end}`).join(';')) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

/** What a model (or a person) is told. Plain text, the same from every door. */
export function describePlan(o: Outcome): string {
  const head = `Plan for the week of ${dayWords(o.weekOf)} (${o.which} week), times in ${o.tz}.`
  if (o.problem) return `${head}\n${o.problem}`
  const rules = o.input.rules
  const lines: string[] = [
    head,
    `Planning on ${rules.days.map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(' ')}, ${hhmm(rules.dayStartMin)}–${hhmm(rules.dayEndMin)}. `
    + `${o.basis.events} calendar event${o.basis.events === 1 ? '' : 's'}, ${o.basis.tasks} task${o.basis.tasks === 1 ? '' : 's'} considered.`,
    ...o.notes,
  ]
  const ps = o.result.proposals
  if (!ps.length) lines.push(o.result.unplaced.length ? 'Nothing fit.' : 'Nothing to plan: no task is waiting for time that week.')
  else {
    lines.push(`${ps.length} block${ps.length === 1 ? '' : 's'} proposed (${dur(o.result.plannedMins)}). NOTHING is on the calendar yet.`)
    // Each line starts with the block's label — the one string a commit must echo back — then why, then its id.
    let day = ''
    for (const p of ps) {
      if (p.date !== day) { if (day) lines.push(''); day = p.date }
      lines.push(`${blockLabel(p)} — ${p.reason}  [id ${p.id}]`)
    }
  }
  if (o.result.unplaced.length) {
    lines.push('\nDid not fit:')
    for (const u of o.result.unplaced) lines.push(`  ${u.title}${u.placed > 0 ? ` (${dur(u.left)} left)` : ''} — ${u.because}`)
  }
  const left = (Object.entries(o.skippedCounts) as [SkipWhy, number][]).filter(([, n]) => n > 0).map(([w, n]) => `${n} ${WHY_TEXT[w]}`)
  if (left.length) lines.push(`\nLeft out: ${left.join(' · ')}.`)
  // Name them: a count cannot be acted on, and "which ones?" is the first thing anybody asks.
  for (const why of Object.keys(WHY_TEXT) as SkipWhy[]) {
    const names = o.skipped.filter(s => s.why === why).map(s => s.title)
    if (names.length) lines.push(`  ${WHY_TEXT[why]}: ${names.slice(0, 8).map(n => `“${n}”`).join(', ')}${names.length > 8 ? ` and ${names.length - 8} more` : ''}`)
  }
  if (ps.length) lines.push(`\nplan_hash: ${planHash(ps)}`)
  return lines.join('\n')
}

// ─── A "yes" is for exactly one plan ─────────────────────────────────────────

export interface CommitArgs { week?: unknown; plan_hash?: unknown; ids?: unknown; blocks?: unknown }

/** The blocks a commit may write — or the sentence that says why none may. A commit re-plans from the world as it is
 *  NOW and accepts only a fingerprint it recognises, only ids the engine proposed, and only a list of block labels that
 *  matches those blocks word for word: what the person was shown is what is written, or nothing is. */
export function pickCommit(o: Outcome, a: CommitArgs): { ok: true; blocks: Proposal[] } | { ok: false; say: string } {
  if (o.problem) return { ok: false, say: `NOT DONE. ${o.problem}` }
  const ps = o.result.proposals
  if (!ps.length) return { ok: false, say: 'NOT DONE. There is nothing proposed for that week.' }
  if (typeof a.plan_hash !== 'string' || a.plan_hash !== planHash(ps)) {
    return { ok: false, say: 'NOT DONE. The week has changed since that plan was made (or the plan_hash was not the one given). Nothing was written. Call plan_week again and show the user the new plan.' }
  }
  let chosen = ps
  if (a.ids !== undefined) {
    if (!Array.isArray(a.ids) || !a.ids.every(i => typeof i === 'string')) return { ok: false, say: 'NOT DONE. ids must be a list of the [id …] values from the plan.' }
    const want = new Set(a.ids as string[])
    const unknown = [...want].filter(i => !ps.some(p => p.id === i))
    if (unknown.length) return { ok: false, say: `NOT DONE. These ids are not in the plan: ${unknown.join(', ')}. Nothing was written.` }
    chosen = ps.filter(p => want.has(p.id))
    if (!chosen.length) return { ok: false, say: 'NOT DONE. No block was chosen.' }
  }
  const echoed = Array.isArray(a.blocks) ? (a.blocks as unknown[]).map(b => norm(String(b))) : null
  const labels = chosen.map(p => norm(blockLabel(p)))
  if (!echoed || echoed.length !== labels.length || echoed.some((e, i) => e !== labels[i])) {
    return { ok: false, say: `NOT DONE. blocks must list, in order, the label of each block being added, exactly as: ${chosen.map(blockLabel).join(' | ')}. Nothing was written.` }
  }
  return { ok: true, blocks: chosen }
}

/** Which week "this" or "next" asks for; anything else is "next", which is what planning ahead means. */
export const whichOf = (v: unknown): PlanWhich => (v === 'this' ? 'this' : 'next')

export { addDays }
