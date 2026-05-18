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
