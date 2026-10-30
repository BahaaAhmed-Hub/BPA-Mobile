import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbHabit, DbHabitLog, DbHabitFrequency } from '../types/database';
import { notify } from './feedbackStore';

// Ticks still being written. A refresh that lands meanwhile would replace the
// logs with what the server held before the tick and un-tick it on screen.
let writesInFlight = 0;
export const habitWritesInFlight = () => writesInFlight;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(iso: string, by: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** The web app never stores a streak: it writes 0 to `current_streak` on every
 *  save and works the number out from the daily logs. Reading the column here
 *  showed 0 for every habit. Same rule as the web's `calcStreak`: consecutive
 *  completed days ending today. */
function streaksFrom(logs: DbHabitLog[]): { current: number; longest: number } {
  const done = new Set(logs.filter(l => l.completed !== false).map(l => l.date));
  let current = 0;
  for (let day = todayIso(); done.has(day); day = shiftDay(day, -1)) current++;
  let longest = 0;
  let run = 0;
  let prev = '';
  for (const day of [...done].sort()) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }
  return { current, longest };
}

/** Put the computed streaks on each habit, so every screen that reads
 *  `habit.current_streak` gets the real one. Logs only reach back 60 days, so
 *  "best" is the best the server remembers or the best seen here, whichever is more. */
function withStreaks(habits: DbHabit[], logsByHabit: Record<string, DbHabitLog[]>): DbHabit[] {
  return habits.map(h => {
    const { current, longest } = streaksFrom(logsByHabit[h.id] ?? []);
    return { ...h, current_streak: current, longest_streak: Math.max(h.longest_streak ?? 0, longest) };
  });
}

function parseTarget(name: string): number | null {
  const m = name.match(/\((\d+)\)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 1 ? n : null;
}

/** Columns the web app keeps on a habit beyond its name and frequency. */
export interface HabitExtra { emoji?: string; type?: 'boolean' | 'quantity'; goal?: number; unit?: string }
export type HabitPatch = Partial<HabitExtra> & { name?: string; frequency?: DbHabitFrequency; is_active?: boolean };

interface HabitState {
  habits: DbHabit[];
  logsByHabit: Record<string, DbHabitLog[]>;
  countToday: Record<string, number>;
  loading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  addHabit: (name: string, frequency: DbHabitFrequency, extra?: HabitExtra) => Promise<DbHabit | null>;
  updateHabit: (id: string, patch: HabitPatch) => Promise<boolean>;
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
    const rawHabits = (habitsRes.data ?? []) as DbHabit[];
    const logs = (logsRes.data ?? []) as DbHabitLog[];
    const logsByHabit: Record<string, DbHabitLog[]> = {};
    for (const log of logs) {
      (logsByHabit[log.habit_id] ??= []).push(log);
    }

    const habits = withStreaks(rawHabits, logsByHabit);

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

  async addHabit(name, frequency, extra) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: user.id, name, frequency, ...(extra ?? {}) })
      .select()
      .single();
    if (error || !data) {
      notify('error', "Couldn't add that habit. Check your connection and try again.");
      return null;
    }
    set({ habits: [...get().habits, data as DbHabit] });
    return data as DbHabit;
  },

  async updateHabit(id, patch) {
    const before = get().habits.find(h => h.id === id);
    if (!before) return false;
    set({ habits: get().habits.map(h => h.id === id ? { ...h, ...patch } : h) });
    const { error } = await supabase.from('habits').update(patch).eq('id', id);
    if (!error) return true;
    set({ habits: get().habits.map(h => h.id === id ? before : h) });
    notify('error', "Couldn't save that habit change, so it was undone.");
    return false;
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
    const before = get().logsByHabit[habitId] ?? [];
    set({ logsByHabit: next, habits: withStreaks(get().habits, next) });

    writesInFlight++;
    const { data, error } = await supabase
      .from('habit_logs')
      .upsert({ habit_id: habitId, user_id: user.id, date, completed }, { onConflict: 'habit_id,date' })
      .select()
      .single();
    writesInFlight--;
    if (error || !data) {
      // Put this habit's days back as they were, and say so.
      const reverted = { ...get().logsByHabit, [habitId]: before };
      set({ logsByHabit: reverted, habits: withStreaks(get().habits, reverted) });
      notify('error', "Couldn't save that tick, so it was undone.");
      return;
    }

    const after = { ...get().logsByHabit };
    after[habitId] = (after[habitId] ?? []).map(l => l.date === date ? (data as DbHabitLog) : l);
    set({ logsByHabit: after, habits: withStreaks(get().habits, after) });
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
