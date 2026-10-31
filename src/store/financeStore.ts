import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { setFinancePrefs, parseRates, parseBase } from '../lib/finance/fx';
import { setPaidAtSupported } from '../lib/finance/balances';
import { parseTargets, setTransferTargets, withLocalTargets } from '../lib/finance/transferTargets';
import { parseBasis, setBasis } from '../lib/finance/flows';
import { parseRules, type BudgetRule } from '../lib/finance/budget';
import type { DbFinanceAccount, DbFinanceCategory, DbFinanceTransaction, DbFinanceGoal, DbFinanceBudget, DbFinanceBill, TxType } from '../types/financeTypes';

/** One calendar year of entries, which is the window the web works from: an account's stored balance is its position
 *  BEFORE that year, so a balance is only right if exactly this much is read. Read in pages, because the server
 *  answers at most 1,000 rows at a time and a year can hold more. */
async function fetchYearOfEntries(year: number): Promise<{ rows: DbFinanceTransaction[]; error: string | null }> {
  const rows: DbFinanceTransaction[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as DbFinanceTransaction[]));
    if ((data ?? []).length < PAGE) break;
  }
  return { rows, error: null };
}

/** The base currency and exchange rates the person set on the web (Settings → Finance), kept in their shared prefs.
 *  Without them a USD account could not be added to an EGP total, so the figures would be wrong or left out. */
async function loadFinancePrefs(): Promise<Record<string, BudgetRule>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  const { data } = await supabase
    .from('users')
    .select('rates:schedule_rules->shared_prefs->>finance-fx-rates, cur:schedule_rules->shared_prefs->>finance-currency, targets:schedule_rules->shared_prefs->>finance-transfer-targets, basis:schedule_rules->shared_prefs->>finance-financials-basis, countOn:schedule_rules->shared_prefs->>finance-count-on, rules:schedule_rules->shared_prefs->>finance-budget-rules')
    .eq('id', session.user.id)
    .maybeSingle();
  const row = data as unknown as { rates?: string | null; cur?: string | null; targets?: string | null; basis?: string | null; countOn?: string | null; rules?: string | null } | null;
  if (row) {
    setFinancePrefs({ base: parseBase(row.cur), rates: parseRates(row.rates) });
    setTransferTargets(parseTargets(row.targets));
    setBasis(parseBasis(row.basis, row.countOn));
  }
  return parseRules(row?.rules);
}

interface FinanceState {
  accounts: DbFinanceAccount[];
  categories: DbFinanceCategory[];
  transactions: DbFinanceTransaction[];
  goals: DbFinanceGoal[];
  budgets: DbFinanceBudget[];
  /** Every category's budget, as the web keeps them (a rule per category). */
  budgetRules: Record<string, BudgetRule>;
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
  budgetRules: {},
  bills: [],
  loading: false,
  error: null,

  async loadAll() {
    set({ loading: true, error: null });
    const [accts, cats, entries, goals, budgets, bills, budgetRules] = await Promise.all([
      supabase.from('finance_accounts').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('finance_categories').select('*').order('sort_order'),
      fetchYearOfEntries(new Date().getFullYear()),
      supabase.from('finance_goals').select('*').eq('is_active', true),
      supabase.from('finance_budgets').select('*').order('month', { ascending: false }).limit(24),
      supabase.from('finance_bills').select('*').eq('is_active', true).order('due_day'),
      loadFinancePrefs(),
    ]);
    // Where the database has no `paid_at` column nothing can be told apart as unpaid, and reading
    // "every entry is unpaid" would be a confident claim about data nobody has.
    setPaidAtSupported(entries.rows.length === 0 || 'paid_at' in entries.rows[0]);
    set({
      accounts:     (accts.data   ?? []) as DbFinanceAccount[],
      categories:   (cats.data    ?? []) as DbFinanceCategory[],
      transactions: withLocalTargets(entries.rows),
      goals:        [...((goals.data ?? []) as DbFinanceGoal[])].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)),
      budgets:      (budgets.data ?? []) as DbFinanceBudget[],
      budgetRules,
      bills:        (bills.data   ?? []) as DbFinanceBill[],
      loading: false,
      error: accts.error?.message ?? cats.error?.message ?? entries.error ?? null,
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

  clearAll() { set({ accounts: [], categories: [], transactions: [], goals: [], budgets: [], budgetRules: {}, bills: [], error: null }); },
}));
