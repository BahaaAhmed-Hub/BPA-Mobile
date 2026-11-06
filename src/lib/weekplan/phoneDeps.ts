// The phone's real reading of the world for the week planner: Supabase rows and the google-calendar-sync function. A failed
// read is reported as a failure, never as nothing there (see gather.ts).
import { supabase } from '../supabase';
import type { CalendarInfo, Deps, EventInfo } from './gather';

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
    const r = await invoke<{ events?: EventInfo[]; needsReconnect?: string[] }>({ action: 'list_events', time_min: timeMin, time_max: timeMax });
    if (r.error) return { events: [], failed: [`Google Calendar could not be read (${r.error})`] };
    return { events: r.data?.events ?? [], failed: (r.data?.needsReconnect ?? []).map(a => `${a} needs reconnecting`) };
  },
};
