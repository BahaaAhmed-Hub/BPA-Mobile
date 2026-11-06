// A day laid out for planning: the time between meetings, and which open tasks would fit in it.
// Pure and read-only. A suggestion is a suggestion — nothing here books a slot or writes a calendar.
// Times are minutes since local midnight.

export interface PlanEvent { start_time: string; end_time: string; title: string }
export interface Gap { start: number; end: number; minutes: number }

export const MIN_GAP = 15;

export function hhmmToMinutes(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
}

export const clock = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** An event's span on `day` ('YYYY-MM-DD', local), clipped to that day; null if it does not touch it. */
export function spanOn(e: PlanEvent, day: string): { start: number; end: number } | null {
  const dayStart = new Date(`${day}T00:00:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const s = Date.parse(e.start_time), t = Date.parse(e.end_time);
  if (!isFinite(s) || !isFinite(t) || t <= dayStart || s >= dayEnd) return null;
  // An all-day event has no hours to plan around.
  if (t - s >= 24 * 60 * 60 * 1000 - 1000) return null;
  return { start: Math.round((Math.max(s, dayStart) - dayStart) / 60000), end: Math.round((Math.min(t, dayEnd) - dayStart) / 60000) };
}

/** The free stretches of the working day, not counting anything before `from` (so "now" can be passed in). */
export function freeGaps(events: PlanEvent[], day: string, dayStart: number, dayEnd: number, from = 0, min = MIN_GAP): Gap[] {
  const busy = events.map(e => spanOn(e, day)).filter((x): x is { start: number; end: number } => !!x).sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let cursor = Math.max(dayStart, from);
  for (const b of busy) {
    if (b.start > cursor) push(gaps, cursor, Math.min(b.start, dayEnd), min);
    cursor = Math.max(cursor, b.end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) push(gaps, cursor, dayEnd, min);
  return gaps;
}

function push(gaps: Gap[], start: number, end: number, min: number) {
  if (end - start >= min) gaps.push({ start, end, minutes: end - start });
}

export interface PlanTask { id: string; title: string; effort_minutes: number | null; quadrant: string | null; due_date: string | null }
export interface Suggestion { task: PlanTask; start: number; end: number }

const RANK: Record<string, number> = { urgent_important: 0, important_not_urgent: 1, urgent_not_important: 2, neither: 3 };

/** Most pressing first: what matters now, then what is due soonest. Tasks with no estimate are left out — a length would be a guess. */
export function suggest(tasks: PlanTask[], gaps: Gap[]): { placed: Suggestion[]; unplaced: PlanTask[]; unestimated: PlanTask[] } {
  const estimated = tasks.filter(t => t.effort_minutes && t.effort_minutes > 0);
  const unestimated = tasks.filter(t => !(t.effort_minutes && t.effort_minutes > 0));
  const ordered = [...estimated].sort((a, b) =>
    (RANK[a.quadrant ?? 'neither'] ?? 3) - (RANK[b.quadrant ?? 'neither'] ?? 3) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const free = gaps.map(g => ({ ...g }));
  const placed: Suggestion[] = [];
  const unplaced: PlanTask[] = [];
  for (const t of ordered) {
    const len = t.effort_minutes as number;
    const g = free.find(x => x.end - x.start >= len);
    if (!g) { unplaced.push(t); continue; }
    placed.push({ task: t, start: g.start, end: g.start + len });
    g.start += len;
  }
  placed.sort((a, b) => a.start - b.start);
  return { placed, unplaced, unestimated };
}
