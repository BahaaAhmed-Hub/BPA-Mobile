import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbMilestone, DbProject } from '../types/database';

interface ProjectState {
  projects: DbProject[];
  milestones: DbMilestone[];
  loading: boolean;
  /** The tables are not there (the web's projects migration has not been run on this database). */
  unavailable: boolean;
  error: string | null;
  loadFromDB: () => Promise<void>;
  clearAll: () => void;
}

/** Postgres / PostgREST saying the table is not there at all. */
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(e.message ?? ''));

export const useProjectStore = create<ProjectState>(set => ({
  projects: [],
  milestones: [],
  loading: false,
  unavailable: false,
  error: null,

  async loadFromDB() {
    set({ loading: true, error: null });
    const [p, m] = await Promise.all([
      supabase.from('projects').select('*').eq('archived', false).order('created_at', { ascending: true }),
      supabase.from('project_milestones').select('*').order('sort_order', { ascending: true }),
    ]);
    if (missing(p.error) || missing(m.error)) { set({ projects: [], milestones: [], unavailable: true, loading: false }); return; }
    if (p.error || m.error) { set({ error: (p.error ?? m.error)!.message, loading: false }); return; }
    set({ projects: (p.data ?? []) as DbProject[], milestones: (m.data ?? []) as DbMilestone[], unavailable: false, loading: false });
  },

  clearAll() { set({ projects: [], milestones: [], unavailable: false, error: null }); },
}));
