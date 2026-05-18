import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbEmailAction, DbEmailClassification } from '../types/database';

interface State {
  actions: DbEmailAction[];
  loading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  setClassification: (id: string, c: DbEmailClassification | null) => Promise<void>;
  setStatus:         (id: string, s: string | null)                => Promise<void>;
  clearAll: () => void;
}

export const useEmailActionsStore = create<State>((set, get) => ({
  actions: [],
  loading: false,
  error: null,

  async loadFromDB() {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('email_actions')
      .select('*')
      .order('follow_up_date', { ascending: true, nullsFirst: false });
    if (error) { set({ error: error.message, loading: false }); return; }
    set({ actions: (data ?? []) as DbEmailAction[], loading: false });
  },

  async setClassification(id, c) {
    set({ actions: get().actions.map(a => a.id === id ? { ...a, classification: c } : a) });
    await supabase.from('email_actions').update({ classification: c }).eq('id', id);
  },

  async setStatus(id, s) {
    set({ actions: get().actions.map(a => a.id === id ? { ...a, status: s } : a) });
    await supabase.from('email_actions').update({ status: s }).eq('id', id);
  },

  clearAll() { set({ actions: [], error: null }); },
}));
