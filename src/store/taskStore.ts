import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbTask, DbQuadrant, DbTaskStatus } from '../types/database';

interface TaskState {
  tasks: DbTask[];
  loading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  addTask: (input: Partial<DbTask> & { title: string }) => Promise<void>;
  updateTask: (id: string, patch: Partial<DbTask>) => Promise<void>;
  moveToQuadrant: (id: string, q: DbQuadrant) => Promise<void>;
  setStatus: (id: string, s: DbTaskStatus) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  clearAll: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  async loadFromDB() {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { set({ error: error.message, loading: false }); return; }
    set({ tasks: (data ?? []) as DbTask[], loading: false });
  },

  async addTask(input) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description ?? null,
        quadrant: input.quadrant ?? null,
        effort_minutes: input.effort_minutes ?? null,
        due_date: input.due_date ?? null,
        status: input.status ?? 'todo',
      })
      .select()
      .single();
    if (error || !data) return;
    set({ tasks: [data as DbTask, ...get().tasks] });
  },

  async updateTask(id, patch) {
    set({ tasks: get().tasks.map(t => t.id === id ? { ...t, ...patch } : t) });
    await supabase.from('tasks').update(patch).eq('id', id);
  },

  async moveToQuadrant(id, q) {
    await get().updateTask(id, { quadrant: q });
  },

  async setStatus(id, s) {
    const patch: Partial<DbTask> = { status: s };
    if (s === 'done') patch.completed_at = new Date().toISOString();
    if (s === 'todo' || s === 'in_progress') patch.completed_at = null;
    await get().updateTask(id, patch);
  },

  async removeTask(id) {
    set({ tasks: get().tasks.filter(t => t.id !== id) });
    await supabase.from('tasks').delete().eq('id', id);
  },

  clearAll() { set({ tasks: [], error: null }); },
}));
