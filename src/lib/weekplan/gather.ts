// Reading what the week planner needs, from this phone's database rows and Google. It reads, plans and WRITES NOTHING: a
// proposal is a suggestion until a person presses Add. Everything that DECIDES is the ported engine (planFromData); this is
// the part that has to read the world, the way the server's bots read it.
//
// One rule it will not bend: a diary that could not be read is not an empty one. A calendar read that failed, or an account
// that needs reconnecting, is reported, and the engine refuses the whole plan: the gap is exactly where the meeting it could
// not see is sitting. (The phone's everyday calendar reader answers a failure as "no events", which is fine for drawing a day
// and wrong for planning over it, so this has its own.)
import { parseRows } from './idealWeek';
import type { IdealBlockRow, IdealGoalRow, IdealRuleRow } from './idealWeek';
import { parseWeekStart, scheduleFromRules, weekToPlan } from './weekPlanRules';
import { parsePrayerPrefs } from './weekPlanPrayer';
import { planFromData } from './weekPlanData';
import type { Outcome, PlanWhich, WeekData } from './weekPlanData';
import type { MilestoneLike, ProjectLike, TaskLike } from './weekPlanItems';
import type { EventTask, PlanEvent } from './weekPlanBusy';
import { isMine, slotsOfRow, taskLikeOfRow, taskTypeOf, type TaskRow } from './rows';
import { addDays, dayBounds } from '../time/taskTime';

export interface CalendarInfo { id: string; primary?: boolean; accessRole?: string; accountEmail: string }
export interface EventInfo extends PlanEvent { calendarId: string; accountEmail: string }

/** Everything the gatherer touches, so a test can hand it a world that is able to refuse. */
export interface Deps {
  /** Rows from a table, optionally narrowed; an error is reported as `error`, never as no rows. */
  rows: (table: string, cols: string, userId: string) => Promise<{ data: Record<string, unknown>[] | null; error: string | null }>;
  user: () => Promise<{ id: string; scheduleRules: Record<string, unknown> } | null>;
  calendars: () => Promise<{ calendars: CalendarInfo[]; failed: string | null }>;
  events: (timeMin: string, timeMax: string) => Promise<{ events: EventInfo[]; failed: string[] }>;
  deviceZone: () => string;
}

const BASE_COLS = 'id, title, quadrant, status, completed, completed_at, due_date, effort_minutes, priority, task_type, description, gcal_event_id, calendar_id, company_tag';
/** Columns an older project may not have: asked for, and dropped one at a time if the server says it has none. */
const OPTIONAL_COLS: [string, RegExp][] = [['load', /\bload\b/], ['slots', /\bslots\b/], ['project_id, milestone_id', /project_id|milestone_id/]];

async function readTasks(deps: Deps, userId: string): Promise<TaskRow[] | string> {
  const on = new Set(OPTIONAL_COLS.map(([c]) => c));
  for (let attempt = 0; attempt < OPTIONAL_COLS.length + 1; attempt++) {
    const r = await deps.rows('tasks', [BASE_COLS, ...on].join(', '), userId);
    if (!r.error) return (r.data ?? []) as unknown as TaskRow[];
    const drop = OPTIONAL_COLS.find(([c, re]) => on.has(c) && re.test(r.error!));
    if (!drop) return `Could not read the tasks: ${r.error}`;
    on.delete(drop[0]);
  }
  return 'Could not read the tasks.';
}

export async function gatherWeekData(deps: Deps, which: PlanWhich, now: number): Promise<{ data: WeekData } | { say: string }> {
  const user = await deps.user();
  if (!user) return { say: 'You are signed out, so I cannot plan a week.' };
  const shared = (user.scheduleRules.shared_prefs ?? {}) as Record<string, string | undefined>;

  // The week is planned on the phone's own clock, as the web does: the saved profile zone defaults to New York for anyone who
  // never chose, which would plan 09:00 New York on a Cairo calendar.
  const tz = deps.deviceZone();
  const weekStart = parseWeekStart(shared['professor-week-start']);
  const weekOf = weekToPlan(which, now, tz, weekStart);

  const tasksRaw = await readTasks(deps, user.id);
  if (typeof tasksRaw === 'string') return { say: tasksRaw };

  const named = async (table: string, cols: string) => { const r = await deps.rows(table, cols, user.id); return r.error ? [] : (r.data ?? []); };   // an older project without projects: no projects
  const milestones: MilestoneLike[] = (await named('project_milestones', 'id, due_date, done')).map(m => ({ id: String(m.id), dueDate: (m.due_date as string) ?? undefined, done: !!m.done }));
  const projects: ProjectLike[] = (await named('projects', 'id, status, archived')).map(p => ({ id: String(p.id), status: p.status as string, archived: !!p.archived }));

  const tasks: TaskLike[] = [];
  const taskOfEvent: Record<string, EventTask> = {};
  for (const r of tasksRaw) {
    tasks.push(taskLikeOfRow(r));
    for (const s of slotsOfRow(r)) taskOfEvent[s.eventId] = { taskType: taskTypeOf(r), title: r.title, load: r.load };
  }

  // The calendars: a day either side of the week, only the ones that are the person's own.
  const cals = await deps.calendars();
  const failures: string[] = [];
  if (cals.failed) failures.push(cals.failed);
  const mine = new Set(cals.calendars.map(c => c.accountEmail.toLowerCase()));
  const from = dayBounds(addDays(weekOf, -1), tz).start, to = dayBounds(addDays(weekOf, 8), tz).start;
  const read = await deps.events(new Date(from).toISOString(), new Date(to).toISOString());
  failures.push(...read.failed);
  const byCal = new Map(cals.calendars.map(c => [`${c.accountEmail.toLowerCase()}|${c.id}`, c]));
  const events: PlanEvent[] = read.events.filter(e => {
    const c = byCal.get(`${(e.accountEmail ?? '').toLowerCase()}|${e.calendarId}`);
    // An event whose calendar we cannot place is not assumed to be someone else's: it counts, as an unknown calendar is not free time.
    return !c || isMine({ id: c.id, primary: c.primary, accessRole: c.accessRole }, mine);
  });

  return {
    data: {
      now, tz, weekStart,
      schedule: scheduleFromRules(user.scheduleRules),
      prayer: parsePrayerPrefs(shared['professor-prayer']),
      ideal: {
        blocks: parseRows<IdealBlockRow>(shared['ideal-week-blocks']),
        goals: parseRows<IdealGoalRow>(shared['ideal-week-goals']),
        rules: parseRows<IdealRuleRow>(shared['ideal-week-rules']),
      },
      tasks, taskOfEvent, milestones, projects, events,
      failures,
      // The app's own "cancelled" marks on events are shared prefs here too.
      statuses: parseStatuses(shared['cal-event-statuses']),
      calendarConnected: cals.calendars.length > 0,
    },
  };
}

export function parseStatuses(raw: unknown): Record<string, string> {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, s]) => typeof s === 'string')) as Record<string, string>;
  } catch { return {}; }
}

export async function planWeekFor(deps: Deps, which: PlanWhich, o: { now?: number; items?: WeekData['extraItems']; notes?: string[]; force?: string[] } = {}): Promise<Outcome | { say: string }> {
  const got = await gatherWeekData(deps, which, o.now ?? Date.now());
  if ('say' in got) return got;
  got.data.extraItems = o.items; got.data.extraNotes = o.notes; got.data.force = o.force;
  return planFromData(got.data, which);
}
