// Ported verbatim from the web app's supabase/functions/_shared/weekPlanItems.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── Which of your tasks the week planner takes on ───────────────────────────
//
// Pure: plain task / milestone / project fields in, the engine's `Item`s out, with the reason for every task
// left out. The app reads its stores into these shapes, the bots read database rows into the same ones, so the
// planner is asked about the same tasks whichever door the question comes through.
//
// The rules, in the order they are applied:
//   finished              → never (not even counted as "left out")
//   already has a block   → left out: its block is on the calendar, and counts as busy time there
//   not placed yet        → left out: still in the brain dump, nothing has been decided about it
//   delegate / eliminate  → left out: not yours to schedule
//   project paused / done / archived → left out
//   due further than a week past the planned one → left out ("later")
//   the rest              → planned, soonest ceiling first, highest priority first (the engine orders them)
//
// **Plan anyway** (`o.force`, task ids): a person looked at the list of what was left out and said "this one too".
// That overrides every reason EXCEPT the two that would be wrong rather than merely unwanted — a finished task, and one
// that already has a block (planning it again would put it on the calendar twice). A forced task is never cut by the
// 25-task limit, and nothing about the task itself changes: no quadrant is written, no date moved.
//
// A date is a CEILING: the task's own due date, or its milestone's if that comes first. A task already overdue has
// no ceiling left to respect — it is late, so it is planned as at least P1 and says so — rather than being
// refused for being past due, which is the one thing a weekly planner is for.

import { loadOf } from '../time/overlapRules'
import { inferTaskType } from './taskTypes'
import { addDays } from '../time/taskTime'
import type { Item } from './weekPlan'

export interface TaskLike {
  id: string
  title: string
  /** Minutes. */
  duration?: number | null
  priority?: string | null
  dueDate?: string | null
  quadrant?: string | null
  taskType?: string | null
  load?: string | null
  completed?: boolean
  status?: string | null
  /** Already has a block on the calendar. */
  hasEvent: boolean
  projectId?: string | null
  milestoneId?: string | null
}
export interface MilestoneLike { id: string; dueDate?: string | null; done?: boolean }
export interface ProjectLike { id: string; status?: string | null; archived?: boolean }

export type SkipWhy = 'has-block' | 'not-placed' | 'not-yours' | 'project-off' | 'later' | 'too-many'
export interface Skipped { id: string; title: string; why: SkipWhy }

export interface TaskItems {
  items: Item[]
  skipped: Skipped[]
  /** How many were left out for each reason. */
  counts: Record<SkipWhy, number>
  /** Tasks that were already finished — not reported, but the count is true. */
  finished: number
}

export const MAX_ITEMS = 25
const DEFAULT_MINS = 60
const DEFAULT_FOCUS_MINS = 90

const PRIORITY: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
export const WHY_TEXT: Record<SkipWhy, string> = {
  'has-block': 'already on the calendar',
  'not-placed': 'still in the brain dump',
  'not-yours': 'delegated or marked eliminate',
  'project-off': 'its project is paused, done or archived',
  later: 'due after next week',
  'too-many': 'beyond the 25 the planner takes at once',
}

const earlier = (a?: string | null, b?: string | null): string | undefined =>
  a && b ? (a < b ? a : b) : (a || b || undefined)

export function itemsFromTasks(
  tasks: TaskLike[],
  o: { weekOf: string; milestones?: MilestoneLike[]; projects?: ProjectLike[]; force?: string[] },
): TaskItems {
  const ms = new Map((o.milestones ?? []).map(m => [m.id, m] as const))
  const pj = new Map((o.projects ?? []).map(p => [p.id, p] as const))
  const horizon = addDays(o.weekOf, 13)
  const force = new Set(o.force ?? [])
  const skipped: Skipped[] = []
  const counts: Record<SkipWhy, number> = { 'has-block': 0, 'not-placed': 0, 'not-yours': 0, 'project-off': 0, later: 0, 'too-many': 0 }
  const skip = (t: TaskLike, why: SkipWhy) => { counts[why]++; skipped.push({ id: t.id, title: t.title, why }) }
  let finished = 0
  const items: Item[] = []

  for (const t of tasks) {
    if (t.completed || t.status === 'done' || t.status === 'cancelled') { finished++; continue }
    if (t.hasEvent) { skip(t, 'has-block'); continue }
    const forced = force.has(t.id)
    if (!forced && (t.quadrant == null || t.quadrant === '')) { skip(t, 'not-placed'); continue }
    if (!forced && (t.quadrant === 'delegate' || t.quadrant === 'eliminate')) { skip(t, 'not-yours'); continue }
    const project = t.projectId ? pj.get(t.projectId) : undefined
    if (!forced && project && (project.archived || project.status === 'paused' || project.status === 'done')) { skip(t, 'project-off'); continue }

    const milestone = t.milestoneId ? ms.get(t.milestoneId) : undefined
    const due = earlier(t.dueDate, milestone && !milestone.done ? milestone.dueDate : undefined)
    if (!forced && due && due > horizon) { skip(t, 'later'); continue }

    const overdue = !!due && due < o.weekOf
    const type = t.taskType ?? inferTaskType(t.title)
    const load = loadOf({ taskType: type, override: t.load })
    const rank = PRIORITY[t.priority ?? 'P2'] ?? 2
    const dur = typeof t.duration === 'number' && Number.isFinite(t.duration) && t.duration > 0 ? Math.min(480, t.duration) : 0
    items.push({
      key: `task:${t.id}`, kind: 'task', refId: t.id, title: t.title,
      mins: dur || (load === 'focus' ? DEFAULT_FOCUS_MINS : DEFAULT_MINS),
      load,
      due: overdue ? undefined : due,
      priority: overdue ? Math.min(rank, 1) : rank,
      note: overdue ? `overdue since ${due}` : undefined,
      projectId: t.projectId ?? undefined, milestoneId: t.milestoneId ?? undefined,
      ...(forced ? { note: overdue ? `overdue since ${due}` : 'you asked for this one' } : {}),
    })
  }

  // Too many to be a plan: keep the ones that matter most (priority, then the nearer ceiling) and say so.
  if (items.length > MAX_ITEMS) {
    // A task the person asked for by name is never the one dropped.
    const isForced = (i: Item) => !!i.refId && force.has(i.refId)
    const order = [...items].sort((a, b) => Number(isForced(b)) - Number(isForced(a)) || (a.priority ?? 2) - (b.priority ?? 2) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.key.localeCompare(b.key))
    const keep = new Set(order.slice(0, MAX_ITEMS).map(i => i.key))
    const dropped = items.filter(i => !keep.has(i.key))
    for (const d of dropped) { counts['too-many']++; skipped.push({ id: d.refId ?? d.key, title: d.title, why: 'too-many' }) }
    return { items: items.filter(i => keep.has(i.key)), skipped, counts, finished }
  }
  return { items, skipped, counts, finished }
}
