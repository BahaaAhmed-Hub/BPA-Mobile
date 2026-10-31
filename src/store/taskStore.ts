import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbTask, DbQuadrant, DbTaskStatus } from '../types/database';
import { notify } from './feedbackStore';
import { placementForNew, quadrantAfterEdit } from '../lib/tasks';

interface TaskState {
  tasks: DbTask[];
  loading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  addTask: (input: Partial<DbTask> & { title: string }) => Promise<DbTask | null>;
  updateTask: (id: string, patch: Partial<DbTask>) => Promise<void>;
  moveToQuadrant: (id: string, q: DbQuadrant) => Promise<void>;
  setStatus: (id: string, s: DbTaskStatus) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  clearAll: () => void;
}

// Ids with a write still in flight. A reload that lands meanwhile would replace
// the row with what the server held before the write, undoing the edit on
// screen — the same fault the web app guards with markLocalWrite.
const inFlight = new Map<string, number>();
export const taskWritesInFlight = () => inFlight.size;
const begin = (id: string) => inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
const finish = (id: string) => {
  const n = (inFlight.get(id) ?? 1) - 1;
  if (n <= 0) inFlight.delete(id); else inFlight.set(id, n);
};

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
    const local = new Map(get().tasks.map(t => [t.id, t]));
    // Rows being written keep the local copy; rows being deleted stay gone.
    const merged = ((data ?? []) as DbTask[])
      .filter(t => !(inFlight.has(t.id) && !local.has(t.id)))
      .map(t => (inFlight.has(t.id) ? local.get(t.id) ?? t : t));
    set({ tasks: merged, loading: false });
  },

  async addTask(input) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description ?? null,
        // A task made on purpose is placed, not left in the brain dump: no date means Do, a date means Schedule.
        quadrant: input.quadrant ?? placementForNew(input.due_date),
        effort_minutes: input.effort_minutes ?? null,
        due_date: input.due_date ?? null,
        status: input.status ?? 'todo',
        completed: input.status === 'done',
      })
      .select()
      .single();
    if (error || !data) {
      set({ error: error?.message ?? 'Could not save the task' });
      notify('error', "Couldn't add that task. Check your connection and try again.");
      return null;
    }
    set({ tasks: [data as DbTask, ...get().tasks] });
    return data as DbTask;
  },

  async updateTask(id, patch) {
    // The web app keeps a `completed` boolean beside `status`, and reads it
    // first — a status change that leaves it false shows as open over there.
    const before = get().tasks.find(t => t.id === id);
    if (!before) return;
    // The first date a task is given moves it out of the brain dump or Do into Schedule.
    const moved = quadrantAfterEdit(before, patch);
    const base: Partial<DbTask> = moved ? { ...patch, quadrant: moved } : patch;
    const full: Partial<DbTask> = base.status !== undefined
      ? { ...base, completed: base.status === 'done' }
      : base;
    set({ tasks: get().tasks.map(t => t.id === id ? { ...t, ...full } : t) });
    begin(id);
    const { error } = await supabase.from('tasks').update(full).eq('id', id);
    finish(id);
    if (!error) return;
    // Put back only the fields this write changed, so a newer edit to another
    // field of the same row is not thrown away with it.
    const undo: Record<string, unknown> = {};
    for (const k of Object.keys(full)) undo[k] = (before as unknown as Record<string, unknown>)[k];
    set({
      tasks: get().tasks.map(t => t.id === id ? { ...t, ...undo } : t),
      error: error.message,
    });
    notify('error', "Couldn't save that change, so it was undone.");
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
    const before = get().tasks;
    const row = before.find(t => t.id === id);
    set({ tasks: before.filter(t => t.id !== id) });
    begin(id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    finish(id);
    if (!error) return;
    notify('error', "Couldn't delete that task, so it's back.");
    if (row && !get().tasks.some(t => t.id === id)) {
      set({ tasks: [row, ...get().tasks], error: error.message });
    } else {
      set({ error: error.message });
    }
  },

  clearAll() { set({ tasks: [], error: null }); },
}));
