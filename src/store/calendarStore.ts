import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { listGoogleEvents } from '../lib/googleCalendar';
import type { DbCalendarEvent } from '../types/database';

interface CalendarState {
  events: DbCalendarEvent[];
  loading: boolean;
  syncing: boolean;
  needsReconnect: string[];
  error: string | null;
  lastSyncedAt: string | null;

  loadRange:    (fromIsoDate: string, toIsoDate: string) => Promise<void>;
  syncFromGoogle: (fromIsoDate: string, toIsoDate: string) => Promise<void>;
  clearAll:     () => void;
}

function toDbEvent(g: import('../lib/googleCalendar').GoogleSyncEvent): DbCalendarEvent {
  const start = g.start.dateTime ?? (g.start.date ? `${g.start.date}T00:00:00Z` : new Date().toISOString());
  const end   = g.end.dateTime   ?? (g.end.date   ? `${g.end.date}T23:59:59Z`   : start);
  return {
    id: `google:${g.id}`,
    user_id: '',
    company_id: null,
    google_event_id: g.id,
    title: g.summary ?? '(no title)',
    start_time: start,
    end_time:   end,
    location: g.location ?? null,
    meeting_type: g.conferenceData?.entryPoints?.[0]?.entryPointType ?? null,
    prep_notes: g.description ?? null,
    is_synced: true,
  };
}

export const useCalendarStore = create<CalendarState>(set => ({
  events: [],
  loading: false,
  syncing: false,
  needsReconnect: [],
  error: null,
  lastSyncedAt: null,

  async loadRange(fromIsoDate, toIsoDate) {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', `${fromIsoDate}T00:00:00Z`)
      .lte('start_time', `${toIsoDate}T23:59:59Z`)
      .order('start_time', { ascending: true });
    if (error) { set({ error: error.message, loading: false }); return; }
    set({ events: (data ?? []) as DbCalendarEvent[], loading: false });
  },

  async syncFromGoogle(fromIsoDate, toIsoDate) {
    set({ syncing: true });
    const result = await listGoogleEvents(
      new Date(`${fromIsoDate}T00:00:00Z`),
      new Date(`${toIsoDate}T23:59:59Z`),
    );
    // Merge: Google events take precedence (most accurate), then any
    // Supabase rows that don't have a matching google_event_id.
    const googleIds = new Set(result.events.map(e => e.id));
    const supabaseOnly = (await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', `${fromIsoDate}T00:00:00Z`)
      .lte('start_time', `${toIsoDate}T23:59:59Z`)
    ).data ?? [];
    const filtered = (supabaseOnly as DbCalendarEvent[]).filter(
      e => !e.google_event_id || !googleIds.has(e.google_event_id),
    );
    const merged = [...result.events.map(toDbEvent), ...filtered]
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    set({
      events: merged,
      syncing: false,
      needsReconnect: result.needsReconnect,
      lastSyncedAt: new Date().toISOString(),
    });
  },

  clearAll() { set({ events: [], error: null, lastSyncedAt: null, needsReconnect: [] }); },
}));
