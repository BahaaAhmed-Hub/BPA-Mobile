import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { parseModules, type Modules } from '../lib/entitlements';

interface ModuleState {
  /** null until the server has answered (or when it has no answer): nothing is off until it says so. */
  modules: Modules | null;
  load: () => Promise<void>;
  clearAll: () => void;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: null,
  async load() {
    const { data, error } = await supabase.rpc('my_modules');
    // A failed read keeps what was known: a connection that drops must not switch a module off.
    if (error) return;
    const next = parseModules(data);
    if (next) set({ modules: next }); else if (!get().modules) set({ modules: null });
  },
  clearAll() { set({ modules: null }); },
}));
