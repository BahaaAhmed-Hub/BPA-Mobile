// Making an event. The web writes straight to Google, so an event made here has to land there too: a row kept only
// on the phone never reaches the person's real calendar, and nobody else can see it. This builds the Google event
// (pure, so it can be tested) and sends it through the same write function the assistant uses.
import type { NewGoogleEvent } from './googleCalendar';

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface EventInput {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  repeat?: Repeat;
}

const RULES: Record<Exclude<Repeat, 'none'>, string> = {
  daily: 'RRULE:FREQ=DAILY',
  weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'RRULE:FREQ=WEEKLY',
  monthly: 'RRULE:FREQ=MONTHLY',
};

/** Local calendar date as YYYY-MM-DD (not UTC, which can be the day before or after). */
const dateOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Null when the event cannot be made as asked, with the reason in words. */
export function buildGoogleEvent(i: EventInput, timeZone: string): { event: NewGoogleEvent } | { error: string } {
  const title = i.title.trim();
  if (!title) return { error: 'Give the event a title.' };
  if (!isFinite(i.start.getTime()) || !isFinite(i.end.getTime())) return { error: 'Check the date and times.' };

  const base = {
    summary: title,
    ...(i.location?.trim() ? { location: i.location.trim() } : {}),
    ...(i.notes?.trim() ? { description: i.notes.trim() } : {}),
    ...(i.repeat && i.repeat !== 'none' ? { recurrence: [RULES[i.repeat]] } : {}),
  };

  if (i.allDay) {
    // Google's all-day end is exclusive: a one-day event ends on the next date.
    const next = new Date(i.start.getFullYear(), i.start.getMonth(), i.start.getDate() + 1);
    return { event: { ...base, start: { date: dateOf(i.start) }, end: { date: dateOf(next) } } };
  }
  if (i.end.getTime() <= i.start.getTime()) return { error: 'The event must end after it starts.' };
  return { event: { ...base, start: { dateTime: i.start.toISOString(), timeZone }, end: { dateTime: i.end.toISOString(), timeZone } } };
}
