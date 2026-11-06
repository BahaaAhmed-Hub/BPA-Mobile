// The database rows the planner reads, as the engine sees them. Ported from the web's weekPlanKit.ts at BPA@c6b42ed (the file
// the server's bots plan with, which reads database rows exactly as the phone does): the task row mapping, the slot reading
// and the rule for which calendars are the person's own. Pure: no client, no network.
import { TASK_TYPES } from './taskTypes';
import type { TaskLike } from './weekPlanItems';

const QUADRANT: Record<string, string> = { urgent_important: 'do', important_not_urgent: 'schedule', urgent_not_important: 'delegate', neither: 'eliminate' };
/** The app's own reading of the column: only the four database words place a task. Anything else (`dump`, a word a bot once
 *  wrote, null) is the brain dump, so it is here too: every door must agree about which tasks have been decided about. */
export const quadrantOf = (q: unknown): string | null => (typeof q === 'string' ? (QUADRANT[q] ?? null) : null);
/** An unknown status word is "open". */
const STATUS: Record<string, string> = { todo: 'open', in_progress: 'in_progress', done: 'done', deferred: 'cancelled' };

export interface Slot { eventId: string; n: number; date?: string; time?: string; mins?: number }

export interface TaskRow {
  id: string; title: string; quadrant?: string | null; status?: string | null; completed?: boolean | null; completed_at?: string | null;
  due_date?: string | null; effort_minutes?: number | null; priority?: string | null; task_type?: string | null; description?: string | null;
  gcal_event_id?: string | null; calendar_id?: string | null; company_tag?: string | null;
  slots?: Slot[] | null;
  load?: string | null; project_id?: string | null; milestone_id?: string | null;
}

/** A task's blocks, in order. The first block of an older task is just `gcal_event_id`. */
export const slotsOfRow = (r: Pick<TaskRow, 'slots' | 'gcal_event_id'>): Slot[] =>
  Array.isArray(r.slots) && r.slots.length ? [...r.slots].sort((a, b) => a.n - b.n) : r.gcal_event_id ? [{ eventId: r.gcal_event_id, n: 1 }] : [];

export const taskTypeOf = (r: TaskRow): string | undefined =>
  r.task_type ? r.task_type : (typeof r.description === 'string' && (TASK_TYPES as readonly string[]).includes(r.description) ? r.description : undefined);

/** A task row as the planner sees it. */
export function taskLikeOfRow(r: TaskRow): TaskLike {
  return {
    id: r.id, title: r.title, duration: r.effort_minutes ?? undefined, priority: r.priority ?? undefined, dueDate: r.due_date ?? undefined,
    quadrant: quadrantOf(r.quadrant), taskType: taskTypeOf(r), load: r.load || undefined,
    completed: r.completed ?? r.completed_at != null, status: STATUS[r.status ?? ''] ?? 'open',
    hasEvent: slotsOfRow(r).length > 0, projectId: r.project_id ?? undefined, milestoneId: r.milestone_id ?? undefined,
  };
}

/** The app's rule for "this calendar is mine": the primary one; a person's own address (one of their connected accounts); or
 *  one they own. A shared or subscribed calendar (a holiday list, a colleague's) is not busy time of theirs. */
export function isMine(cal: { id: string; primary?: boolean; accessRole?: string }, mine: Set<string>): boolean {
  if (cal.primary) return true;
  const id = (cal.id ?? '').toLowerCase();
  if (id.includes('@') && !id.endsWith('@group.calendar.google.com')) return mine.has(id);
  return cal.accessRole === 'owner';
}

// ── iCloud events, as the planner reads them ────────────────────────────────

/** What the `icloud-caldav` function sends for an event. */
export interface IcloudWireEvent {
  id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean;
  location?: string; status?: 'confirmed' | 'tentative' | 'cancelled'; busy?: boolean;
}

/** An iCloud event as a calendar event the planner understands. A cancelled one is not time anyone is using; one marked free
 *  is transparent; an all-day one is a date, not a block of time. The id carries the account and calendar so it cannot equal a
 *  Google id (the same prefix the web's calendar uses). */
export function icloudEventToPlan(accountId: string, e: IcloudWireEvent): { id: string; status?: string; summary: string; transparency?: string; location?: string;
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } } {
  return {
    id: `ic:${accountId}:${e.calendarId}:${e.id}`,
    ...(e.status === 'cancelled' ? { status: 'cancelled' } : {}),
    summary: e.title,
    ...(e.busy === false ? { transparency: 'transparent' } : {}),
    ...(e.location ? { location: e.location } : {}),
    start: e.allDay ? { date: e.start } : { dateTime: e.start },
    end: e.allDay ? { date: e.end } : { dateTime: e.end },
  };
}
