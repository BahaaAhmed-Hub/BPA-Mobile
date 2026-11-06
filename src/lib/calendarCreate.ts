// Making an event. The web writes straight to Google, so an event made here has to land there too: a row kept only
// on the phone never reaches the person's real calendar, and nobody else can see it.
import { createGoogleEvent, mainCalendar } from './googleCalendar';
import { buildGoogleEvent, type EventInput } from './calendarCreateCore';

export * from './calendarCreateCore';

export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export async function createCalendarEvent(i: EventInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const built = buildGoogleEvent(i, deviceTimeZone());
  if ('error' in built) return { ok: false, error: built.error };
  try {
    const cal = await mainCalendar();
    const r = await createGoogleEvent(cal.calendarId, built.event, cal.account);
    if (!r.ok || !r.id) return { ok: false, error: r.error ?? 'Google did not create the event.' };
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The event was not created.' };
  }
}
