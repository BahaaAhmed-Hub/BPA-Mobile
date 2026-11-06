// The phone's real reading of the world for the week planner: Supabase rows and the google-calendar-sync function. A failed
// read is reported as a failure, never as nothing there (see gather.ts).
import { supabase } from '../supabase';
import type { CalendarInfo, Deps, EventInfo } from './gather';
import { icloudEventToPlan, type IcloudWireEvent } from './rows';

const PAGE = 1000;

async function invoke<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body });
  return error ? { data: null, error: error.message } : { data: data as T, error: null };
}

export const phoneDeps: Deps = {
  deviceZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

  async user() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase.from('users').select('schedule_rules').eq('id', session.user.id).maybeSingle();
    // No row is a failed read: planning with every setting missing would plan a week nobody asked for.
    if (error || !data) return null;
    return { id: session.user.id, scheduleRules: ((data as { schedule_rules?: Record<string, unknown> }).schedule_rules ?? {}) };
  },

  async rows(table, cols, userId) {
    const out: Record<string, unknown>[] = [];
    for (let from = 0; from < 20 * PAGE; from += PAGE) {
      const r = await supabase.from(table).select(cols).eq('user_id', userId).order('id').range(from, from + PAGE - 1);
      if (r.error) return { data: null, error: r.error.message };
      const got = (r.data ?? []) as unknown as Record<string, unknown>[];
      out.push(...got);
      if (got.length < PAGE) break;
    }
    return { data: out, error: null };
  },

  async calendars() {
    const r = await invoke<{ calendars?: CalendarInfo[] }>({ action: 'list_calendars' });
    if (r.error) return { calendars: [], failed: `the calendar list could not be read (${r.error})` };
    return { calendars: r.data?.calendars ?? [], failed: null };
  },

  async events(timeMin, timeMax) {
    const failed: string[] = [];
    const events: EventInfo[] = [];

    const g = await invoke<{ events?: EventInfo[]; needsReconnect?: string[] }>({ action: 'list_events', time_min: timeMin, time_max: timeMax });
    if (g.error) failed.push(`Google Calendar could not be read (${g.error})`);
    else { events.push(...(g.data?.events ?? [])); failed.push(...(g.data?.needsReconnect ?? []).map(a => `${a} needs reconnecting`)); }

    // iCloud calendars are the person's own busy time too, and come through their own function. A project that has none of this
    // (no table) simply has no iCloud account; any other failure is a calendar that could not be read.
    const accts = await supabase.from('icloud_accounts').select('id, apple_id');
    if (accts.error) {
      if (accts.error.code !== '42P01' && accts.error.code !== 'PGRST205') failed.push(`iCloud accounts could not be listed (${accts.error.message})`);
    } else {
      for (const a of (accts.data ?? []) as { id: string; apple_id: string }[]) {
        const { data, error } = await supabase.functions.invoke('icloud-caldav', { body: { action: 'events', account_id: a.id, from: timeMin, to: timeMax } });
        const d = (data ?? {}) as { events?: IcloudWireEvent[]; errors?: { calendar_id: string; message: string }[]; error?: string; message?: string };
        if (error || typeof d.error === 'string') { failed.push(`iCloud (${a.apple_id}) could not be read: ${d.message ?? d.error ?? error?.message ?? 'unknown'}`); continue; }
        for (const e of d.errors ?? []) failed.push(`An iCloud calendar (${a.apple_id}) could not be read: ${e.message}`);
        for (const e of d.events ?? []) events.push({ ...icloudEventToPlan(a.id, e), calendarId: `icloud:${a.id}:${e.calendarId}`, accountEmail: a.apple_id });
      }
    }
    return { events, failed };
  },
};
