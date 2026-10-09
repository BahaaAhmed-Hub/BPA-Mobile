import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbHabit, DbHabitLog, DbHabitFrequency } from '../types/database';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTarget(name: string): number | null {
  const m = name.match(/\((\d+)\)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 1 ? n : null;
}

interface HabitState {
  habits: DbHabit[];
  logsByHabit: Record<string, DbHabitLog[]>;
  countToday: Record<string, number>;
  loading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  addHabit: (name: string, frequency: DbHabitFrequency) => Promise<void>;
  toggleToday: (habitId: string) => Promise<void>;
  toggleOn: (habitId: string, date: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  clearAll: () => void;

  isCompletedToday: (habitId: string) => boolean;
  isCompletedOn: (habitId: string, date: string) => boolean;
  incrementCount: (habitId: string, target: number) => Promise<void>;
  decrementCount: (habitId: string, target: number) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  logsByHabit: {},
  countToday: {},
  loading: false,
  error: null,

  async loadFromDB() {
    set({ loading: true, error: null });
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('is_active', true).order('name'),
      supabase
        .from('habit_logs')
        .select('*')
        .gte('date', new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10)),
    ]);
    if (habitsRes.error) { set({ error: habitsRes.error.message, loading: false }); return; }
    const habits = (habitsRes.data ?? []) as DbHabit[];
    const logs = (logsRes.data ?? []) as DbHabitLog[];
    const logsByHabit: Record<string, DbHabitLog[]> = {};
    for (const log of logs) {
      (logsByHabit[log.habit_id] ??= []).push(log);
    }

    // Restore countToday: for count habits completed today, seed count = target
    // so the stepper shows target/target instead of 0/target after restart.
    const today = todayIso();
    const countToday: Record<string, number> = {};
    for (const habit of habits) {
      const target = parseTarget(habit.name);
      if (target && (logsByHabit[habit.id] ?? []).some(l => l.date === today && l.completed)) {
        countToday[habit.id] = target;
      }
    }

    set({ habits, logsByHabit, countToday, loading: false });
  },

  async addHabit(name, frequency) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: user.id, name, frequency })
      .select()
      .single();
    if (error || !data) return;
    set({ habits: [...get().habits, data as DbHabit] });
  },

  async toggleOn(habitId, date) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = (get().logsByHabit[habitId] ?? []).find(l => l.date === date);
    const completed = !(existing?.completed ?? false);

    const next = { ...get().logsByHabit };
    if (existing) {
      next[habitId] = (next[habitId] ?? []).map(l => l.id === existing.id ? { ...l, completed } : l);
    } else {
      const optimistic: DbHabitLog = { id: `tmp_${Date.now()}`, habit_id: habitId, user_id: user.id, date, completed };
      next[habitId] = [optimistic, ...(next[habitId] ?? [])];
    }
    set({ logsByHabit: next });

    const { data, error } = await supabase
      .from('habit_logs')
      .upsert({ habit_id: habitId, user_id: user.id, date, completed }, { onConflict: 'habit_id,date' })
      .select()
      .single();
    if (error || !data) return;

    const after = { ...get().logsByHabit };
    after[habitId] = (after[habitId] ?? []).map(l => l.date === date ? (data as DbHabitLog) : l);
    set({ logsByHabit: after });
  },

  async toggleToday(habitId) {
    const today = todayIso();
    await get().toggleOn(habitId, today);
    // Sync countToday for count habits so TodayScreen/HabitDetailScreen toggles
    // don't leave the stepper stuck at 0/N when the habit was just marked done.
    const habit = get().habits.find(h => h.id === habitId);
    if (habit) {
      const target = parseTarget(habit.name);
      if (target) {
        const isDoneNow = get().isCompletedOn(habitId, today);
        set({ countToday: { ...get().countToday, [habitId]: isDoneNow ? target : 0 } });
      }
    }
  },

  async removeHabit(id) {
    set({ habits: get().habits.filter(h => h.id !== id) });
    await supabase.from('habits').update({ is_active: false }).eq('id', id);
  },

  clearAll() { set({ habits: [], logsByHabit: {}, countToday: {}, error: null }); },

  isCompletedToday(habitId) {
    return get().isCompletedOn(habitId, todayIso());
  },

  isCompletedOn(habitId, date) {
    return (get().logsByHabit[habitId] ?? []).some(l => l.date === date && l.completed);
  },

  async incrementCount(habitId, target) {
    const current = (get().countToday[habitId] ?? 0) + 1;
    set({ countToday: { ...get().countToday, [habitId]: current } });
    if (current >= target && !get().isCompletedOn(habitId, todayIso())) {
      await get().toggleOn(habitId, todayIso());
    }
  },

  async decrementCount(habitId, target) {
    const current = get().countToday[habitId] ?? 0;
    if (current === 0) return; // already at floor — never un-complete silently
    const next = current - 1;
    set({ countToday: { ...get().countToday, [habitId]: next } });
    if (next < target && get().isCompletedOn(habitId, todayIso())) {
      await get().toggleOn(habitId, todayIso());
    }
  },
}));
