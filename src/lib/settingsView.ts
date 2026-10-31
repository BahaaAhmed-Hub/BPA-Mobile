// What the Settings screens draw, from the `users` row the web app writes.
// Pure: a field the web never saved is absent here, so the screen shows nothing
// for it rather than a default that looks like a choice.

export interface ScheduleView {
  timezone: string | null;
  workWeek: string | null;
  focus: string | null;
  earliestMeeting: string | null;
  endOfDay: string | null;
  bufferMins: number | null;
  physicalBufferMins: number | null;
  protectFocus: boolean | null;
  autoDeclineEarly: boolean | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The web stores the work week as day names or 0..6 numbers depending on its age. */
export function workWeekText(v: unknown): string | null {
  if (typeof v === 'string') return str(v);
  if (!Array.isArray(v) || !v.length) return null;
  const names = v.map(d => (typeof d === 'number' ? DAYS[(d + 6) % 7] : typeof d === 'string' ? d.slice(0, 3) : null));
  return names.every(Boolean) ? names.join(' · ') : null;
}

export function scheduleView(rules: unknown): ScheduleView {
  const r = (rules && typeof rules === 'object' ? rules : {}) as Record<string, unknown>;
  const fs = str(r.focus_start), fe = str(r.focus_end);
  return {
    timezone: str(r.timezone),
    workWeek: workWeekText(r.work_week),
    focus: fs && fe ? `${fs}–${fe}` : null,
    earliestMeeting: str(r.earliest_meeting),
    endOfDay: str(r.end_of_day),
    bufferMins: num(r.buffer_mins),
    physicalBufferMins: num(r.physical_buffer),
    protectFocus: bool(r.protect_focus),
    autoDeclineEarly: bool(r.auto_decline_early),
  };
}

export const yesNo = (v: boolean | null): string | null => (v === null ? null : v ? 'On' : 'Off');
export const minutes = (v: number | null): string | null => (v === null ? null : v === 0 ? 'None' : `${v} min`);
