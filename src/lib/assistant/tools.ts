// What the assistant can do from the phone. The names and argument shapes are the
// web app's (assistantTools.ts), so a thread started on either side reads the
// same; the list is the subset this app can really run. Calendar writes go
// through the `google-calendar-write` function — the phone never holds a Google
// token — which can create, change and delete an event but does not send guest
// invitations or add a Meet link, so those arguments are not offered.
//
// Every tool returns a plain object for the model, or throws: a throw is
// recorded as a failed tool call and the model is told what went wrong.

import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useCalendarStore } from '../../store/calendarStore';
import { supabase } from '../supabase';
import {
  listGoogleEvents, createGoogleEvent, deleteGoogleEvent, writeGoogleEvent, mainCalendar,
  type GoogleSyncEvent, type GoogleAccountRef,
} from '../googleCalendar';
import { isActionable, isOpenTask } from '../tasks';
import type { DbHabit, DbQuadrant, DbTask } from '../../types/database';

type Schema = { type: 'object'; properties: Record<string, unknown>; required: string[] };
export interface ToolDef { name: string; description: string; input_schema: Schema }

const QUADRANT = { type: 'string', enum: ['do', 'schedule', 'delegate', 'eliminate'] };

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    name: 'list_calendar_events',
    description: 'Get calendar events for a date range, across all the person\'s connected Google calendars.',
    input_schema: { type: 'object', properties: {
      date_from: { type: 'string', description: 'Start date YYYY-MM-DD' },
      date_to: { type: 'string', description: 'End date YYYY-MM-DD' },
    }, required: ['date_from', 'date_to'] },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new calendar event on the person\'s main calendar. It cannot invite guests or add a Meet link from the phone.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string', description: 'Event title' },
      start_datetime: { type: 'string', description: 'ISO 8601 datetime in the person\'s own time zone, e.g. 2025-05-10T14:00:00' },
      end_datetime: { type: 'string', description: 'ISO 8601 datetime, e.g. 2025-05-10T15:00:00' },
      description: { type: 'string', description: 'Event description (optional)' },
      location: { type: 'string', description: 'Location (optional)' },
    }, required: ['title', 'start_datetime', 'end_datetime'] },
  },
  {
    name: 'update_calendar_event',
    description: 'Change or move a calendar event: its title, start/end time, description or location. Get the event_id from list_calendar_events. Giving only a new start keeps the event\'s length. An event that has other guests cannot be changed from the phone.',
    input_schema: { type: 'object', properties: {
      event_id: { type: 'string', description: 'The id from list_calendar_events, exactly as given (it may end ::calendar).' },
      title: { type: 'string' },
      start_datetime: { type: 'string', description: 'ISO 8601 e.g. 2025-05-10T14:00:00' },
      end_datetime: { type: 'string', description: 'ISO 8601 (optional; the length is kept if omitted)' },
      description: { type: 'string' },
      location: { type: 'string' },
    }, required: ['event_id'] },
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete (cancel) a calendar event by its ID. An event that has other guests cannot be deleted from the phone.',
    input_schema: { type: 'object', properties: {
      event_id: { type: 'string', description: 'The id from list_calendar_events, exactly as given (it may end ::calendar).' },
    }, required: ['event_id'] },
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status or quadrant.',
    input_schema: { type: 'object', properties: {
      status: { type: 'string', enum: ['open', 'done', 'all'], description: 'Default: open' },
      quadrant: QUADRANT,
    }, required: [] },
  },
  {
    name: 'create_task',
    description: 'Create a new task on the board.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' },
      quadrant: QUADRANT,
      due_date: { type: 'string', description: 'YYYY-MM-DD (optional)' },
      urgent: { type: 'boolean', description: 'Mark as urgent (optional)' },
    }, required: ['title'] },
  },
  {
    name: 'update_task',
    description: 'Update task properties (title, quadrant, due date, urgency, status).',
    input_schema: { type: 'object', properties: {
      task_id: { type: 'string', description: 'Task ID from list_tasks' },
      title: { type: 'string' },
      quadrant: QUADRANT,
      due_date: { type: 'string', description: 'YYYY-MM-DD' },
      urgent: { type: 'boolean' },
      status: { type: 'string', enum: ['open', 'done'] },
    }, required: ['task_id'] },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as done.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'list_habits',
    description: 'List all habits with today\'s completion status and current streak.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_habit',
    description: 'Create a new habit. A yes/no habit is "boolean"; a counted one is "quantity" with a goal and a unit (8 glasses).',
    input_schema: { type: 'object', properties: {
      name: { type: 'string' },
      emoji: { type: 'string', description: 'One emoji (optional)' },
      frequency: { type: 'string', enum: ['daily', 'weekdays', 'weekly'], description: 'Default daily' },
      type: { type: 'string', enum: ['boolean', 'quantity'], description: 'Default boolean' },
      goal: { type: 'number', description: 'Target per day, for a quantity habit' },
      unit: { type: 'string', description: 'e.g. glasses, minutes' },
    }, required: ['name'] },
  },
  {
    name: 'update_habit',
    description: 'Change a habit — rename it, change its emoji, frequency, goal or unit, or pause it (active: false) or bring it back (active: true). Name the habit by its name.',
    input_schema: { type: 'object', properties: {
      habit: { type: 'string', description: 'The habit\'s name (or part of it)' },
      name: { type: 'string' }, emoji: { type: 'string' },
      frequency: { type: 'string', enum: ['daily', 'weekdays', 'weekly'] },
      goal: { type: 'number' }, unit: { type: 'string' }, active: { type: 'boolean' },
    }, required: ['habit'] },
  },
  {
    name: 'delete_habit',
    description: 'Remove a habit from the list. Its history is kept. The app asks the user to approve first. Prefer update_habit with active: false to pause one.',
    input_schema: { type: 'object', properties: { habit: { type: 'string' } }, required: ['habit'] },
  },
  {
    name: 'log_habit_completion',
    description: 'Mark a habit as completed for a given date.',
    input_schema: { type: 'object', properties: {
      habit_id: { type: 'string', description: 'Habit ID from list_habits' },
      date: { type: 'string', description: 'YYYY-MM-DD (omit for today)' },
      value: { type: 'number', description: 'Quantity value for measurable habits' },
    }, required: ['habit_id'] },
  },
  {
    name: 'get_productivity_summary',
    description: 'Get a snapshot of today\'s productivity: tasks due/done today, habits completed, and upcoming events.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Q_TO_DB: Record<string, DbQuadrant> = {
  do: 'urgent_important', schedule: 'important_not_urgent', delegate: 'urgent_not_important', eliminate: 'neither',
};
const Q_FROM_DB: Record<string, string> = {
  urgent_important: 'do', important_not_urgent: 'schedule', urgent_not_important: 'delegate', neither: 'eliminate',
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));
const todayKey = () => new Date().toLocaleDateString('en-CA');

function dateTimeOrThrow(v: unknown, field: string): string {
  const s = str(v);
  if (!s || !Number.isFinite(new Date(s).getTime())) throw new Error(`${field} is not a date and time (use ISO 8601, e.g. 2025-05-10T14:00:00).`);
  return s;
}

async function ensureTasks() {
  const s = useTaskStore.getState();
  if (s.tasks.length === 0) await s.loadFromDB();
  return useTaskStore.getState();
}
async function ensureHabits() {
  const s = useHabitStore.getState();
  if (s.habits.length === 0) await s.loadFromDB();
  return useHabitStore.getState();
}

function taskOut(t: DbTask) {
  return {
    id: t.id, title: t.title, quadrant: Q_FROM_DB[t.quadrant ?? ''] ?? null,
    status: t.completed || t.status === 'done' ? 'done' : t.status === 'deferred' ? 'cancelled' : 'open',
    due_date: t.due_date ?? null, urgent: t.urgent === true,
  };
}

function findTask(id: unknown): DbTask {
  const t = useTaskStore.getState().tasks.find(x => x.id === str(id));
  if (!t) throw new Error('No task with that id. Call list_tasks and use an id from it.');
  return t;
}

function findHabitByName(name: unknown): DbHabit {
  const q = (str(name) ?? '').toLowerCase();
  if (!q) throw new Error('Say which habit, by its name.');
  const all = useHabitStore.getState().habits;
  const clean = (h: DbHabit) => h.name.toLowerCase();
  const exact = all.filter(h => clean(h) === q || (h.name.replace(/^\p{Emoji}\s*/u, '').toLowerCase() === q));
  const hits = exact.length ? exact : all.filter(h => clean(h).includes(q));
  if (hits.length === 0) throw new Error(`No habit matches "${str(name)}". Call list_habits to see them.`);
  if (hits.length > 1) throw new Error(`More than one habit matches "${str(name)}": ${hits.map(h => h.name).join(', ')}. Ask which one.`);
  return hits[0];
}

// ── Calendar ──────────────────────────────────────────────────────────────────

interface EventMeta { calendarId: string; account: GoogleAccountRef; guests: number; title: string; start?: string; end?: string; tz?: string }
const eventIndex = new Map<string, EventMeta>();

const refOf = (id: string, calendarId: string) => `${id}::${calendarId}`;
function splitRef(ref: unknown): { eventId: string; calendarId?: string } {
  const s = str(ref) ?? '';
  const i = s.lastIndexOf('::');
  return i > 0 ? { eventId: s.slice(0, i), calendarId: s.slice(i + 2) } : { eventId: s };
}

function remember(e: GoogleSyncEvent) {
  eventIndex.set(e.id, {
    calendarId: e.calendarId,
    account: { email: e.accountEmail, id: e.accountId },
    guests: (e.attendees ?? []).filter(a => !a.self && a.email !== e.organizer?.email).length,
    title: e.summary ?? '(no title)',
    start: e.start.dateTime ?? e.start.date,
    end: e.end.dateTime ?? e.end.date,
    tz: e.start.timeZone,
  });
}

async function findEvent(ref: unknown): Promise<{ eventId: string; meta: EventMeta }> {
  const { eventId } = splitRef(ref);
  if (!eventId) throw new Error('event_id is missing. Call list_calendar_events and use an id from it.');
  if (!eventIndex.has(eventId)) {
    // This conversation may have been carried on after the app restarted: look wide.
    const from = new Date(Date.now() - 30 * 86400_000);
    const to = new Date(Date.now() + 120 * 86400_000);
    (await listGoogleEvents(from, to)).events.forEach(remember);
  }
  const meta = eventIndex.get(eventId);
  if (!meta) throw new Error('That event was not found on any connected calendar. Call list_calendar_events and use an id from it.');
  return { eventId, meta };
}

const mainCalendarOrThrow = mainCalendar;

function refuseWithGuests(meta: EventMeta, what: 'change' | 'delete') {
  if (meta.guests > 0) {
    throw new Error(`"${meta.title}" has ${meta.guests} other guest${meta.guests === 1 ? '' : 's'}, and a ${what} tells them. That has to be done in the web app. Tell the user so; nothing was changed.`);
  }
}

// ─── The executor ─────────────────────────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // ── Calendar ─────────────────────────────────────────────────────────────
    case 'list_calendar_events': {
      const from = str(input.date_from); const to = str(input.date_to);
      if (!from || !to || !isDate(from) || !isDate(to)) throw new Error('date_from and date_to must be YYYY-MM-DD.');
      const { events, needsReconnect } = await listGoogleEvents(new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`));
      events.forEach(remember);
      const out = events
        .sort((a, b) => Date.parse(a.start.dateTime ?? a.start.date ?? '') - Date.parse(b.start.dateTime ?? b.start.date ?? ''))
        .slice(0, 60)
        .map(e => ({
          id: refOf(e.id, e.calendarId), title: e.summary ?? '(no title)',
          start: e.start.dateTime ?? e.start.date, end: e.end.dateTime ?? e.end.date,
          ...(e.location ? { location: e.location } : {}), calendar: e.accountEmail,
        }));
      return {
        events: out,
        ...(events.length > out.length ? { note: `Showing the first ${out.length} of ${events.length}.` } : {}),
        ...(needsReconnect.length ? { needs_reconnect: needsReconnect } : {}),
      };
    }

    case 'create_calendar_event': {
      const title = str(input.title);
      if (!title) throw new Error('title is required.');
      const start = dateTimeOrThrow(input.start_datetime, 'start_datetime');
      const end = dateTimeOrThrow(input.end_datetime, 'end_datetime');
      if (new Date(end).getTime() <= new Date(start).getTime()) throw new Error('The event must end after it starts.');
      const cal = await mainCalendarOrThrow();
      const tz = timeZone();
      const r = await createGoogleEvent(cal.calendarId, {
        summary: title, description: str(input.description), location: str(input.location),
        start: { dateTime: start, timeZone: tz }, end: { dateTime: end, timeZone: tz },
      }, cal.account);
      if (!r.ok || !r.id) throw new Error(r.error ?? 'The event was not created.');
      eventIndex.set(r.id, { calendarId: cal.calendarId, account: cal.account, guests: 0, title, start, end, tz });
      return { success: true, event_id: refOf(r.id, cal.calendarId), link: r.link, message: `Event "${title}" created on ${cal.name}.` };
    }

    case 'update_calendar_event': {
      const { eventId, meta } = await findEvent(input.event_id);
      refuseWithGuests(meta, 'change');
      const patch: Record<string, unknown> = {};
      const title = str(input.title);
      if (title) patch.summary = title;
      if (typeof input.description === 'string') patch.description = input.description;
      if (typeof input.location === 'string') patch.location = input.location;
      const tz = meta.tz ?? timeZone();
      if (str(input.start_datetime)) {
        const start = dateTimeOrThrow(input.start_datetime, 'start_datetime');
        let end = str(input.end_datetime);
        if (end) end = dateTimeOrThrow(end, 'end_datetime');
        else {
          // Moving only the start keeps the event's length.
          const length = meta.start && meta.end ? Date.parse(meta.end) - Date.parse(meta.start) : 3600_000;
          end = new Date(new Date(start).getTime() + (Number.isFinite(length) && length > 0 ? length : 3600_000)).toISOString();
          patch.end = { dateTime: end };
        }
        patch.start = { dateTime: start, timeZone: tz };
        if (!patch.end) patch.end = { dateTime: end, timeZone: tz };
      } else if (str(input.end_datetime)) {
        patch.end = { dateTime: dateTimeOrThrow(input.end_datetime, 'end_datetime'), timeZone: tz };
      }
      if (Object.keys(patch).length === 0) throw new Error('Nothing to change: give a title, time, description or location.');
      const r = await writeGoogleEvent(eventId, meta.calendarId, patch, meta.account);
      if (!r.ok) throw new Error(r.error ?? 'The event was not changed.');
      eventIndex.delete(eventId); // its times may have moved; look it up afresh next time
      return { success: true, message: `Event "${title ?? meta.title}" updated.` };
    }

    case 'delete_calendar_event': {
      const { eventId, meta } = await findEvent(input.event_id);
      refuseWithGuests(meta, 'delete');
      const r = await deleteGoogleEvent(eventId, meta.calendarId, meta.account);
      if (!r.ok) throw new Error(r.error ?? 'The event was not deleted.');
      eventIndex.delete(eventId);
      return { success: true, message: `Event "${meta.title}" deleted.` };
    }

    // ── Tasks ────────────────────────────────────────────────────────────────
    case 'list_tasks': {
      const { tasks } = await ensureTasks();
      const want = str(input.status) ?? 'open';
      const q = str(input.quadrant);
      const rows = tasks
        .filter(t => (want === 'all' ? t.title.trim() !== '' : want === 'done' ? !isOpenTask(t) && t.status !== 'deferred' : isActionable(t)))
        .filter(t => !q || Q_FROM_DB[t.quadrant ?? ''] === q)
        .map(taskOut);
      return { count: rows.length, tasks: rows.slice(0, 50), ...(rows.length > 50 ? { note: `Showing the first 50 of ${rows.length}.` } : {}) };
    }

    case 'create_task': {
      const title = str(input.title);
      if (!title) throw new Error('title is required.');
      const due = str(input.due_date);
      if (due && !isDate(due)) throw new Error('due_date must be YYYY-MM-DD.');
      const q = str(input.quadrant);
      if (q && !Q_TO_DB[q]) throw new Error('quadrant must be do, schedule, delegate or eliminate.');
      // The web's rule: no date means Do, a date means Schedule.
      const quadrant = Q_TO_DB[q ?? (due ? 'schedule' : 'do')];
      const created = await useTaskStore.getState().addTask({ title, quadrant, due_date: due ?? null });
      if (!created) throw new Error('The task could not be saved.');
      if (input.urgent === true) await useTaskStore.getState().updateTask(created.id, { urgent: true });
      return { success: true, task_id: created.id, message: `Task "${title}" created in ${Q_FROM_DB[quadrant]}${due ? ` for ${due}` : ''}.` };
    }

    case 'update_task': {
      await ensureTasks();
      const t = findTask(input.task_id);
      const patch: Partial<DbTask> = {};
      if (str(input.title)) patch.title = str(input.title)!;
      const q = str(input.quadrant);
      if (q) { if (!Q_TO_DB[q]) throw new Error('quadrant must be do, schedule, delegate or eliminate.'); patch.quadrant = Q_TO_DB[q]; }
      if (typeof input.urgent === 'boolean') patch.urgent = input.urgent;
      const due = str(input.due_date);
      if (due) {
        if (!isDate(due)) throw new Error('due_date must be YYYY-MM-DD.');
        patch.due_date = due;
        // The first date a task is given moves it from Do to Schedule, as on the web.
        if (!q && !t.due_date && (t.quadrant === null || t.quadrant === 'urgent_important')) patch.quadrant = 'important_not_urgent';
      }
      const status = str(input.status);
      if (status && status !== 'open' && status !== 'done') throw new Error('status must be open or done.');
      if (Object.keys(patch).length === 0 && !status) throw new Error('Nothing to change.');
      const store = useTaskStore.getState();
      if (Object.keys(patch).length) await store.updateTask(t.id, patch);
      if (status) await store.setStatus(t.id, status === 'done' ? 'done' : 'todo');
      // The store rolls a failed write back instead of throwing, so look at what is really there.
      const now = findTask(t.id);
      for (const [k, v] of Object.entries(patch)) {
        if ((now as unknown as Record<string, unknown>)[k] !== v) throw new Error('The change could not be saved, so nothing was changed.');
      }
      return { success: true, task: taskOut(now) };
    }

    case 'complete_task': {
      await ensureTasks();
      const t = findTask(input.task_id);
      await useTaskStore.getState().setStatus(t.id, 'done');
      if (findTask(t.id).status !== 'done') throw new Error('The task could not be saved as done.');
      return { success: true, message: `"${t.title}" marked done.` };
    }

    case 'delete_task': {
      await ensureTasks();
      const t = findTask(input.task_id);
      await useTaskStore.getState().removeTask(t.id);
      if (useTaskStore.getState().tasks.some(x => x.id === t.id)) throw new Error('The task could not be deleted.');
      return { success: true, message: `"${t.title}" deleted.` };
    }

    // ── Habits ───────────────────────────────────────────────────────────────
    case 'list_habits': {
      const s = await ensureHabits();
      return {
        habits: s.habits.map(h => ({
          id: h.id, name: h.name.replace(/^\p{Emoji}\s*/u, ''), emoji: h.emoji || h.name.match(/^\p{Emoji}/u)?.[0] || '',
          frequency: h.frequency, done_today: s.isCompletedToday(h.id), streak: h.current_streak,
          ...(h.type === 'quantity' && h.goal ? { goal: h.goal, unit: h.unit ?? '' } : {}),
        })),
      };
    }

    case 'create_habit': {
      await ensureHabits();
      const name = str(input.name);
      if (!name) throw new Error('name is required.');
      const freq = str(input.frequency) ?? 'daily';
      if (freq !== 'daily' && freq !== 'weekdays' && freq !== 'weekly') throw new Error('frequency must be daily, weekdays or weekly.');
      const type = str(input.type) === 'quantity' ? 'quantity' : 'boolean';
      const goal = typeof input.goal === 'number' && input.goal > 0 ? input.goal : undefined;
      if (type === 'quantity' && !goal) throw new Error('A quantity habit needs a goal (a number above zero).');
      const created = await useHabitStore.getState().addHabit(name, freq, {
        ...(str(input.emoji) ? { emoji: str(input.emoji) } : {}),
        ...(type === 'quantity' ? { type, goal, unit: str(input.unit) ?? '' } : {}),
      });
      if (!created) throw new Error('The habit could not be saved.');
      return { success: true, habit_id: created.id, message: `Habit "${name}" created (${freq}).` };
    }

    case 'update_habit': {
      await ensureHabits();
      const h = findHabitByName(input.habit);
      const patch: Record<string, unknown> = {};
      if (str(input.name)) patch.name = str(input.name);
      if (str(input.emoji)) patch.emoji = str(input.emoji);
      const f = str(input.frequency);
      if (f) { if (f !== 'daily' && f !== 'weekdays' && f !== 'weekly') throw new Error('frequency must be daily, weekdays or weekly.'); patch.frequency = f; }
      if (typeof input.goal === 'number' && input.goal > 0) patch.goal = input.goal;
      if (typeof input.unit === 'string') patch.unit = input.unit;
      if (typeof input.active === 'boolean') patch.is_active = input.active;
      if (Object.keys(patch).length === 0) throw new Error('Nothing to change.');
      const ok = await useHabitStore.getState().updateHabit(h.id, patch);
      if (!ok) throw new Error('The change could not be saved, so nothing was changed.');
      return { success: true, message: `Habit "${h.name}" updated.` };
    }

    case 'delete_habit': {
      await ensureHabits();
      const h = findHabitByName(input.habit);
      await useHabitStore.getState().removeHabit(h.id);
      return { success: true, message: `Habit "${h.name}" removed from your habits. Its history is kept.` };
    }

    case 'log_habit_completion': {
      const s = await ensureHabits();
      const h = s.habits.find(x => x.id === str(input.habit_id));
      if (!h) throw new Error('No habit with that id. Call list_habits and use an id from it.');
      const date = str(input.date) ?? todayKey();
      if (!isDate(date)) throw new Error('date must be YYYY-MM-DD.');
      if (s.isCompletedOn(h.id, date)) return { success: true, message: `"${h.name}" was already logged for ${date}.` };
      await s.toggleOn(h.id, date);
      if (!useHabitStore.getState().isCompletedOn(h.id, date)) throw new Error('The habit could not be logged.');
      if (typeof input.value === 'number') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('habit_logs').update({ quantity: input.value }).eq('habit_id', h.id).eq('date', date).eq('user_id', user.id);
      }
      return { success: true, message: `"${h.name}" logged for ${date}.` };
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    case 'get_productivity_summary': {
      const { tasks } = await ensureTasks();
      const hs = await ensureHabits();
      const today = todayKey();
      const now = new Date();
      const endOfDay = new Date(`${today}T23:59:59`);
      const { events } = await listGoogleEvents(now, endOfDay);
      return {
        date: today,
        tasks_open: tasks.filter(isActionable).length,
        tasks_due_today: tasks.filter(t => isActionable(t) && t.due_date === today).map(taskOut),
        tasks_done_today: tasks.filter(t => t.completed_at?.slice(0, 10) === today).length,
        habits_done_today: `${hs.habits.filter(h => hs.isCompletedToday(h.id)).length} of ${hs.habits.length}`,
        upcoming_events_today: events
          .sort((a, b) => Date.parse(a.start.dateTime ?? '') - Date.parse(b.start.dateTime ?? ''))
          .slice(0, 8)
          .map(e => ({ title: e.summary ?? '(no title)', start: e.start.dateTime ?? e.start.date })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Keeps the calendar tab honest after the assistant changed something on Google. */
export function refreshCalendarSoon() {
  const s = useCalendarStore.getState();
  const from = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  void s.syncFromGoogle(from, to);
}
