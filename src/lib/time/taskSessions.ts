// Ported from the web app's src/lib/taskSessions.ts at BPA@c54edac (pure: the row shape and the rules a row must satisfy).
// ─── A session: one sitting of work on one task ──────────────────────────────
//
// Pure — the shape, the rules a row must satisfy, and the mapping to and from
// the table. `20260048_task_sessions.sql` states the same rules as constraints;
// they are restated here so a bad row is refused on the screen with a sentence,
// not by the server with a code (and `scripts/task-sessions.mjs` checks that the
// two agree on every boundary).
//
// Everything a person wants to know — a task's total, a day's time worked, its
// task-hours — is DERIVED from these (`taskTime.ts`). Nothing is stored on the
// task, so deleting a wrong session corrects every figure on every device.

import { HOUR } from './taskTime'
import type { Floating, Running } from './taskTime'

export type SessionSource = 'timer' | 'slot' | 'manual' | 'backfill-plan' | 'backfill-estimate'

export const SESSION_SOURCES: readonly SessionSource[] = ['timer', 'slot', 'manual', 'backfill-plan', 'backfill-estimate']

export interface TaskSession {
  id: string
  taskId: string
  /** Epoch ms. */
  start: number
  /** Epoch ms; `null` while a timer is running. */
  end: number | null
  source: SessionSource
  /** The calendar event a `slot` session was logged from. */
  eventId?: string
  /** What an `backfill-estimate` belongs to (`YYYY-MM-DD`): it has a length and a day, not an hour. */
  day?: string
  /** A person should look at this one — a timer that ran past a day and was cut. */
  review?: boolean
  note?: string
}

/** A session is at most a day. A timer left running for a week is a forgotten one. */
export const MAX_SESSION_MS = 24 * HOUR

/** Shorter than this and a stopped timer is a slip of the finger, not a session. */
export const MIN_SESSION_MS = 1000

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const isAssumed = (s: Pick<TaskSession, 'source'>): boolean =>
  s.source === 'backfill-plan' || s.source === 'backfill-estimate'

/** Why this row cannot be kept, as a sentence — or `null` if it can. */
export function checkSession(s: TaskSession): string | null {
  if (!s.id) return 'A session needs an id.'
  if (!s.taskId) return 'A session belongs to a task.'
  if (!Number.isFinite(s.start)) return 'A session needs a start.'
  if (!SESSION_SOURCES.includes(s.source)) return `“${String(s.source)}” is not a kind of session.`
  if (s.end === null) {
    if (s.source !== 'timer') return 'Only a timer can still be running.'
  } else {
    if (!Number.isFinite(s.end)) return 'A session needs an end.'
    if (s.end <= s.start) return 'A session has to end after it starts.'
    if (s.end - s.start > MAX_SESSION_MS) return 'A session is at most 24 hours — split it, or log the rest as another.'
  }
  if (s.source === 'slot' && !s.eventId) return 'A calendar slot session needs its event.'
  if (s.source === 'backfill-estimate' && (!s.day || !DAY_RE.test(s.day) || s.end === null)) return 'An estimate needs a day and a length.'
  return null
}

/** Where a stopped timer ends, and whether someone should check it. Never past a
 *  day (the table refuses it; the app cuts it and flags it instead of losing the
 *  stop), and never less than a second (the table needs a length). */
export function endFor(s: Pick<TaskSession, 'start' | 'review'>, at: number): { end: number; review: boolean } {
  const cap = s.start + MAX_SESSION_MS
  if (at > cap) return { end: cap, review: true }
  return { end: Math.max(at, s.start + MIN_SESSION_MS), review: !!s.review }
}

/** What `taskTime`'s sums take. An estimate has a length and a day and no hour,
 *  so it goes in as `Floating` and can never be mistaken for time on the clock. */
export function timeInputs(sessions: TaskSession[]): { running: Running[]; floating: Floating[] } {
  const running: Running[] = []
  const floating: Floating[] = []
  for (const s of sessions) {
    if (s.source === 'backfill-estimate' && s.day && s.end !== null) floating.push({ day: s.day, ms: s.end - s.start })
    else running.push({ start: s.start, end: s.end })
  }
  return { running, floating }
}

export const sessionsOfTask = (all: TaskSession[], taskId: string): TaskSession[] => all.filter(s => s.taskId === taskId)
export const runningOfTask = (all: TaskSession[], taskId: string): TaskSession | undefined =>
  all.find(s => s.taskId === taskId && s.end === null)

// ─── The table ───────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string
  user_id: string
  task_id: string
  started_at: string
  ended_at: string | null
  source: string
  event_id: string | null
  day: string | null
  review: boolean | null
  note: string | null
}

export function sessionFromRow(r: SessionRow): TaskSession {
  return {
    id: r.id,
    taskId: r.task_id,
    start: Date.parse(r.started_at),
    end: r.ended_at === null ? null : Date.parse(r.ended_at),
    source: r.source as SessionSource,
    ...(r.event_id ? { eventId: r.event_id } : {}),
    ...(r.day ? { day: r.day } : {}),
    ...(r.review ? { review: true } : {}),
    ...(r.note ? { note: r.note } : {}),
  }
}

// `?? null` on every optional: `undefined` is dropped on the way to JSON, so an
// upsert would never CLEAR a field the person emptied.
export function rowFromSession(s: TaskSession, userId: string): Omit<SessionRow, 'review' | 'note'> & { review: boolean; note: string } {
  return {
    id: s.id,
    user_id: userId,
    task_id: s.taskId,
    started_at: new Date(s.start).toISOString(),
    ended_at: s.end === null ? null : new Date(s.end).toISOString(),
    source: s.source,
    event_id: s.eventId ?? null,
    day: s.day ?? null,
    review: !!s.review,
    note: s.note ?? '',
  }
}

/** Do two copies of a session say the same thing? Through the row, so a missing
 *  `review` and a `false` one are the same, as the table sees them. */
export const sameSession = (a: TaskSession, b: TaskSession): boolean =>
  JSON.stringify(rowFromSession(a, '')) === JSON.stringify(rowFromSession(b, ''))
