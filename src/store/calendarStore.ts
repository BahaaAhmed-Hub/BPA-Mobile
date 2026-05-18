import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbCalendarEvent } from '../types/database';

interface CalendarState {
  events: DbCalendarEvent[];
  loading: boolean;
  error: string | null;

  loadRange: (fromIsoDate: string, toIsoDate: string) => Promise<void>;
  clearAll: () => void;
}

export const useCalendarStore = create<CalendarState>(set => ({
  events: [],
  loading: false,
  error: null,

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

  clearAll() { set({ events: [], error: null }); },
}));
