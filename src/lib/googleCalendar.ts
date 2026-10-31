// Thin wrapper over the existing google-calendar-sync Edge Function the web
// app deployed. Tokens never leave the server — we just ask for events in a
// window and get them back in Google's native JSON shape.

import { supabase } from './supabase';

export interface GoogleSyncEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string; self?: boolean }[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string; label?: string }[] };
  calendarId:       string;
  accountEmail:     string;
  accountId:        string;
  isPrimaryAccount: boolean;
}

export interface GoogleSyncCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
  accountEmail: string;
}

export interface GoogleSyncResult {
  events: GoogleSyncEvent[];
  needsReconnect: string[];
}

export async function listGoogleEvents(timeMin: Date, timeMax: Date): Promise<GoogleSyncResult> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: {
      action:   'list_events',
      time_min: timeMin.toISOString(),
      time_max: timeMax.toISOString(),
    },
  });
  if (error) {
    console.warn('[googleCalendar] list_events:', error.message);
    return { events: [], needsReconnect: [] };
  }
  const events = ((data?.events as GoogleSyncEvent[]) ?? []).filter(e => e.status !== 'cancelled');
  const needsReconnect = (data?.needsReconnect as string[]) ?? [];
  return { events, needsReconnect };
}

export async function listGoogleCalendars(): Promise<GoogleSyncCalendar[]> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'list_calendars' },
  });
  if (error) {
    console.warn('[googleCalendar] list_calendars:', error.message);
    return [];
  }
  return (data?.calendars as GoogleSyncCalendar[]) ?? [];
}

interface GoogleEventPatch {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime: string } | { date: string };
  end?: { dateTime: string } | { date: string };
}

export interface GoogleAccountRef { email?: string | null; id?: string | null }

/** The write function needs to know which connected Google account an event is on
 *  (`account_id`, or the address when the id does not resolve); without one it
 *  answers "Missing account_id" and nothing is written. */
const accountFields = (a?: GoogleAccountRef) => ({
  ...(a?.id ? { account_id: a.id } : {}),
  ...(a?.email ? { account_email: a.email } : {}),
});

async function callWrite(body: Record<string, unknown>): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const { data, error } = await supabase.functions.invoke('google-calendar-write', { body });
  if (error) {
    console.warn('[googleCalendar] write:', error.message);
    return { ok: false, error: error.message };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.error) return { ok: false, error: d.error === 'reconnect_required' ? 'That Google account needs reconnecting in the web app.' : String(d.error) };
  return { ok: true, data: d };
}

/** Write a partial update to a Google Calendar event via the existing Edge Function. */
export async function writeGoogleEvent(
  googleEventId: string,
  calendarId: string,
  patch: GoogleEventPatch,
  account?: GoogleAccountRef,
): Promise<{ ok: boolean; error?: string }> {
  const r = await callWrite({ action: 'update_event', event_id: googleEventId, calendar_id: calendarId, patch, ...accountFields(account) });
  return { ok: r.ok, error: r.error };
}

export interface NewGoogleEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

export async function createGoogleEvent(
  calendarId: string,
  event: NewGoogleEvent,
  account?: GoogleAccountRef,
): Promise<{ ok: boolean; id?: string; link?: string; error?: string }> {
  const r = await callWrite({ action: 'create_event', calendar_id: calendarId, event, ...accountFields(account) });
  const ev = r.data?.event as { id?: string; htmlLink?: string } | undefined;
  return { ok: r.ok && !!ev?.id, id: ev?.id, link: ev?.htmlLink, error: r.error ?? (ev?.id ? undefined : 'Google did not return the event') };
}

export async function deleteGoogleEvent(
  googleEventId: string,
  calendarId: string,
  account?: GoogleAccountRef,
): Promise<{ ok: boolean; error?: string }> {
  const r = await callWrite({ action: 'delete_event', event_id: googleEventId, calendar_id: calendarId, ...accountFields(account) });
  return { ok: r.ok, error: r.error };
}
