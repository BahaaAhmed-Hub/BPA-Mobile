import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { notify } from './feedbackStore';
import { purchasePatch } from '../lib/shopping';
import type { DbShoppingGroup, DbShoppingItem } from '../types/database';

interface ShoppingState {
  groups: DbShoppingGroup[];
  items: DbShoppingItem[];
  loading: boolean;
  unavailable: boolean;
  loadFromDB: () => Promise<void>;
  setBought: (id: string, bought: boolean) => Promise<void>;
  addItem: (input: { name: string; quantity?: number; group_id?: string | null }) => Promise<boolean>;
  clearAll: () => void;
}

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(e.message ?? ''));

// Ids with a write in flight: a reload that lands meanwhile must not put the old row back over the tick.
const inFlight = new Set<string>();
export const shoppingWritesInFlight = () => inFlight.size;

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  groups: [],
  items: [],
  loading: false,
  unavailable: false,

  async loadFromDB() {
    set({ loading: true });
    const [g, i] = await Promise.all([
      supabase.from('shopping_groups').select('*').order('sort_order', { ascending: true }),
      supabase.from('shopping_items').select('*').order('sort_order', { ascending: true }),
    ]);
    if (missing(g.error) || missing(i.error)) { set({ groups: [], items: [], unavailable: true, loading: false }); return; }
    if (g.error || i.error) { set({ loading: false }); return; }
    const local = new Map(get().items.map(x => [x.id, x]));
    const items = ((i.data ?? []) as DbShoppingItem[]).map(x => (inFlight.has(x.id) ? local.get(x.id) ?? x : x));
    set({ groups: (g.data ?? []) as DbShoppingGroup[], items, unavailable: false, loading: false });
  },

  async setBought(id, bought) {
    const before = get().items.find(x => x.id === id);
    if (!before) return;
    const patch = purchasePatch(bought);
    set({ items: get().items.map(x => (x.id === id ? { ...x, ...patch } : x)) });
    inFlight.add(id);
    const { error } = await supabase.from('shopping_items').update(patch).eq('id', id);
    inFlight.delete(id);
    if (!error) return;
    set({ items: get().items.map(x => (x.id === id ? before : x)) });
    notify('error', "Couldn't save that tick, so it was undone.");
  },

  async addItem({ name, quantity, group_id }) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ user_id: user.id, name: trimmed, quantity: quantity && quantity > 0 ? quantity : 1, group_id: group_id ?? null })
      .select()
      .single();
    if (error || !data) { notify('error', "Couldn't add that item. Check your connection and try again."); return false; }
    set({ items: [...get().items, data as DbShoppingItem] });
    return true;
  },

  clearAll() { set({ groups: [], items: [], unavailable: false }); },
}));
