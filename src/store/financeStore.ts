import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbFinanceAccount, DbFinanceCategory, DbFinanceTransaction, DbFinanceGoal, DbFinanceBudget, DbFinanceBill, TxType } from '../types/financeTypes';

interface FinanceState {
  accounts: DbFinanceAccount[];
  categories: DbFinanceCategory[];
  transactions: DbFinanceTransaction[];
  goals: DbFinanceGoal[];
  budgets: DbFinanceBudget[];
  bills: DbFinanceBill[];
  loading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  addTransaction: (tx: {
    account_id: string | null;
    to_account_id?: string | null;
    category_id: string | null;
    amount: number;
    currency: string;
    tx_type: TxType;
    payee: string;
    date: string;
    note?: string | null;
  }) => Promise<void>;
  clearAll: () => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  goals: [],
  budgets: [],
  bills: [],
  loading: false,
  error: null,

  async loadAll() {
    set({ loading: true, error: null });
    const [accts, cats, txs, goals, budgets, bills] = await Promise.all([
      supabase.from('finance_accounts').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('finance_categories').select('*').order('sort_order'),
      supabase.from('finance_transactions').select('*').order('date', { ascending: false }).limit(500),
      supabase.from('finance_goals').select('*').eq('is_active', true),
      supabase.from('finance_budgets').select('*').order('month', { ascending: false }).limit(24),
      supabase.from('finance_bills').select('*').eq('is_active', true).order('due_day'),
    ]);
    set({
      accounts:     (accts.data   ?? []) as DbFinanceAccount[],
      categories:   (cats.data    ?? []) as DbFinanceCategory[],
      transactions: (txs.data     ?? []) as DbFinanceTransaction[],
      goals:        (goals.data   ?? []) as DbFinanceGoal[],
      budgets:      (budgets.data ?? []) as DbFinanceBudget[],
      bills:        (bills.data   ?? []) as DbFinanceBill[],
      loading: false,
      error: accts.error?.message ?? cats.error?.message ?? txs.error?.message ?? null,
    });
  },

  async addTransaction(tx) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({ ...tx, to_account_id: tx.to_account_id ?? null, note: tx.note ?? null, tags: [], attachments: [], is_cleared: false, is_recurring: false })
      .select()
      .single();
    if (error || !data) return;
    set({ transactions: [data as DbFinanceTransaction, ...get().transactions] });
  },

  clearAll() { set({ accounts: [], categories: [], transactions: [], goals: [], budgets: [], bills: [], error: null }); },
}));
