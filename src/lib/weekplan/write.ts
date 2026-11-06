// Putting an accepted proposal on the calendar, and taking it back. Nothing here runs until a person presses Add.
//
// A task's block is made the way the web makes every extra block of a task: a real Google event, then a SLOT on the task that
// remembers what it was planned for (date, time, minutes), so the task knows it, the calendar shows it as the task's, and
// ticking it logs the time. It is a slot, never the task's due date: the due date is the task's deadline, and planning must
// not move it. An activity (a goal, something typed) has no task: it is a plain event on the main calendar. No guests, no Meet.
//
// The order is the safe one: the event first, then the task. If the task cannot be updated the event is removed again, because
// a block the task does not know about is one nobody can tidy. Undo is a real delete (Google has no undelete): if Google
// refuses, the block stays and says so. Ported from the web's weekPlanKit commit and its taskSlots / taskEvent modules.
import type { Proposal } from './weekPlan';
import { slotsOfRow, type Slot } from './rows';

export const TASK_EVENT_MARK = '📋';
const MARK_PREFIX = new RegExp(`^\\s*${TASK_EVENT_MARK}\\s*`, 'u');
const NOTE_HEADER = 'Scheduled from a task in The Professor';

/** The title as it goes to Google. Marking twice would stack the glyph, so a title already marked is left alone. */
export function taskEventTitle(title: string): string {
  const clean = title.trim();
  return MARK_PREFIX.test(clean) ? clean : `${TASK_EVENT_MARK} ${clean}`;
}
export const slotSuffix = (n: number): string => (n > 1 ? ` · ${n}` : '');
export const slotTitle = (title: string, n: number): string => `${title.trim()}${slotSuffix(n)}`;

/** The notes as they go to Google: what the task said, then where it came from and what it was for. */
export function taskEventDescription(t: { title: string; description?: string | null; priority?: string | null; due_date?: string | null }): string {
  const own = t.description?.trim();
  const facts = [`Task: ${t.title.trim()}`, t.priority ? `Priority: ${t.priority}` : null, t.due_date ? `Due: ${t.due_date}` : null].filter(Boolean).join('\n');
  return [own, `— ${NOTE_HEADER} —`, facts].filter(Boolean).join('\n\n');
}

export interface WritableTask {
  id: string; title: string; description?: string | null; priority?: string | null; due_date?: string | null;
  calendar_id?: string | null; company_id?: string | null; company_tag?: string | null;
  gcal_event_id?: string | null; slots?: Slot[] | null; completed?: boolean | null; status?: string | null;
}
export interface WriteCalendar { id: string; summary?: string; primary?: boolean; accessRole?: string; accountEmail: string }
export interface Company { id: string; name: string; calendar_id?: string | null; account_id?: string | null }

const writable = (c: WriteCalendar) => c.accessRole === 'owner' || c.accessRole === 'writer';

/** Which calendar a task's block goes on: the task's own, else its company's, else the main one. A name that matches nothing
 *  writable is an error, never a quiet fall-back to the default; a company bound to an account rather than a calendar is not
 *  guessed at. */
export function chooseCalendar(row: Pick<WritableTask, 'calendar_id' | 'company_id' | 'company_tag'> | undefined, companies: Company[], cals: WriteCalendar[]): { ok: true; cal: WriteCalendar } | { ok: false; error: string } {
  const ok = cals.filter(writable);
  const primary = ok.find(c => c.primary) ?? ok[0];
  const fallback = (): { ok: true; cal: WriteCalendar } | { ok: false; error: string } => primary ? { ok: true, cal: primary } : { ok: false, error: 'There is no calendar I can write to.' };
  if (!row) return fallback();
  if (row.calendar_id) {
    const own = ok.find(c => c.id === row.calendar_id);
    return own ? { ok: true, cal: own } : { ok: false, error: "That task's calendar is not one I can write to." };
  }
  const tag = (row.company_tag ?? '').toLowerCase();
  const co = row.company_id ? companies.find(c => c.id === row.company_id) : (tag && tag !== 'personal' ? companies.find(c => c.id.toLowerCase() === tag || c.name.toLowerCase() === tag) : undefined);
  if (co?.calendar_id) {
    const theirs = ok.find(c => c.id === co.calendar_id);
    return theirs ? { ok: true, cal: theirs } : { ok: false, error: `${co.name}'s calendar is not one I can write to.` };
  }
  if (co?.account_id) return { ok: false, error: `${co.name} is linked to an account rather than a calendar, so I can't choose where its blocks go from here. Add it from the calendar on the web.` };
  return fallback();
}

/** The slots a task has after one more block: the new one numbered next, and the mirror `gcal_event_id` always the first. */
export function slotsAfterAdd(row: Pick<WritableTask, 'slots' | 'gcal_event_id'>, eventId: string, p: { date: string; time: string; mins: number }): { slots: Slot[]; gcal_event_id: string; n: number } {
  const have = slotsOfRow(row);
  const n = Math.max(0, ...have.map(s => s.n)) + 1;
  const slots = [...have.filter(s => s.eventId !== eventId), { eventId, n, date: p.date, time: p.time, mins: p.mins }].sort((a, b) => a.n - b.n);
  return { slots, gcal_event_id: slots[0].eventId, n };
}

/** The same after a block is taken away: the others keep their numbers; if the first goes, the next is the mirror; none left, none stored.
 *  One plain slot with nothing planned is stored the old way, as just the event id. */
export function slotsAfterRemove(row: Pick<WritableTask, 'slots' | 'gcal_event_id'>, eventId: string): { slots: Slot[] | null; gcal_event_id: string | null } {
  const left = slotsOfRow(row).filter(s => s.eventId !== eventId).sort((a, b) => a.n - b.n);
  if (!left.length) return { slots: null, gcal_event_id: null };
  const plain = left.length === 1 && left[0].n === 1 && !left[0].date && !left[0].time && !left[0].mins;
  return { slots: plain ? null : left, gcal_event_id: left[0].eventId };
}

export interface Written { eventId: string; taskId?: string; calendarId: string; accountEmail: string; title: string }
export type AddResult = { ok: true; written: Written } | { ok: false; error: string };

/** Everything the writing touches, so a test can hand it a world that is able to refuse. */
export interface WriteDeps {
  tz: string;
  readTask: (id: string) => Promise<{ row: WritableTask | null; error: string | null }>;
  /** `null` when they could not be read: a block must not go to the main calendar because a company's could not be looked up. */
  companies: () => Promise<Company[] | null>;
  calendars: () => Promise<{ calendars: WriteCalendar[]; failed: string | null }>;
  createEvent: (cal: WriteCalendar, body: Record<string, unknown>) => Promise<{ id: string } | { error: string }>;
  deleteEvent: (calendarId: string, accountEmail: string, eventId: string) => Promise<{ ok: true } | { error: string }>;
  updateTask: (id: string, patch: { slots: Slot[] | null; gcal_event_id: string | null }) => Promise<{ error: string | null }>;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const finished = (t: WritableTask) => !!t.completed || t.status === 'done' || t.status === 'deferred' || t.status === 'cancelled';

export async function addProposalWith(deps: WriteDeps, p: Proposal): Promise<AddResult> {
  const time = hhmm(p.startMin);
  const start = new Date(p.start), end = new Date(p.end);
  if (Number.isNaN(start.getTime()) || p.end <= p.start) return { ok: false, error: 'That is not a time.' };
  const isTask = p.kind === 'task' && !!p.refId;

  let row: WritableTask | undefined;
  if (isTask) {
    const r = await deps.readTask(p.refId!);
    if (r.error) return { ok: false, error: `The task could not be read (${r.error.slice(0, 60)}).` };
    if (!r.row) return { ok: false, error: 'That task is gone.' };
    if (finished(r.row)) return { ok: false, error: 'That task is finished.' };
    row = r.row;
  }

  const cals = await deps.calendars();
  if (cals.failed) return { ok: false, error: cals.failed };
  // Companies are only needed when the task names one; if they cannot be read, say so rather than fall back to the main calendar.
  const tag = (row?.company_tag ?? '').toLowerCase();
  let cos: Company[] = [];
  if (row && (row.company_id || (tag && tag !== 'personal'))) {
    const got = await deps.companies();
    if (!got) return { ok: false, error: "Your companies could not be read, so I can't choose which calendar this block belongs on." };
    cos = got;
  }
  const target = chooseCalendar(row, cos, cals.calendars);
  if (!target.ok) return target;
  const cal = target.cal;

  const n = row ? slotsAfterAdd(row, '', { date: p.date, time, mins: p.mins }).n : 1;
  const made = await deps.createEvent(cal, {
    summary: isTask ? taskEventTitle(slotTitle(p.title, n)) : p.title,
    description: isTask ? taskEventDescription(row!) : 'Planned with Plan week.',
    start: { dateTime: start.toISOString(), timeZone: deps.tz },
    end: { dateTime: end.toISOString(), timeZone: deps.tz },
  });
  // An answer that is not an event is not a block: remembering no id would orphan whatever it made.
  if ('error' in made) return { ok: false, error: made.error };
  if (!made.id) return { ok: false, error: 'Google answered, but not with an event.' };

  if (isTask) {
    // Read the task again: it may have moved on while Google was answering.
    const fresh = (await deps.readTask(p.refId!)).row ?? row!;
    const next = slotsAfterAdd(fresh, made.id, { date: p.date, time, mins: p.mins });
    const up = await deps.updateTask(p.refId!, { slots: next.slots, gcal_event_id: next.gcal_event_id });
    if (up.error) {
      const back = await deps.deleteEvent(cal.id, cal.accountEmail, made.id);   // a block the task does not know about is one nobody can tidy
      return { ok: false, error: 'error' in back
        ? `The task could not be updated (${up.error.slice(0, 80)}), and the event could not be removed again, so it may be on your calendar.`
        : `The task could not be updated (${up.error.slice(0, 80)}), so the event was removed again.` };
    }
    return { ok: true, written: { eventId: made.id, taskId: p.refId!, calendarId: cal.id, accountEmail: cal.accountEmail, title: row!.title } };
  }
  return { ok: true, written: { eventId: made.id, calendarId: cal.id, accountEmail: cal.accountEmail, title: p.title } };
}

/** Take a written block back: the event is deleted first, and only then does the task forget it. If Google refuses, nothing changes. */
export async function removeWrittenWith(deps: WriteDeps, w: Written): Promise<{ ok: true } | { ok: false; error: string }> {
  const gone = await deps.deleteEvent(w.calendarId, w.accountEmail, w.eventId);
  if ('error' in gone) return { ok: false, error: 'Google would not remove it, so it is still on your calendar.' };
  if (w.taskId) {
    const r = await deps.readTask(w.taskId);
    if (!r.row) return { ok: true };            // the task, and its events, are already gone
    const next = slotsAfterRemove(r.row, w.eventId);
    const up = await deps.updateTask(w.taskId, next);
    if (up.error) return { ok: false, error: `The event was removed, but the task could not be updated (${up.error.slice(0, 60)}).` };
  }
  return { ok: true };
}
