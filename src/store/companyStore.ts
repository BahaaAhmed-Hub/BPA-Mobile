import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbCompany } from '../types/database';

interface CompanyState {
  companies: DbCompany[];
  loading: boolean;
  loadFromDB: () => Promise<void>;
  clearAll: () => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  loading: false,
  async loadFromDB() {
    set({ loading: true });
    const { data } = await supabase.from('companies').select('*').eq('is_active', true).order('name');
    set({ companies: (data ?? []) as DbCompany[], loading: false });
  },
  clearAll() { set({ companies: [] }); },
}));
