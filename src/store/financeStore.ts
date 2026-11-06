import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { setFinancePrefs, parseRates, parseBase, withRate, currentRates } from '../lib/finance/fx';
import { writeSharedPref } from '../lib/sharedPrefs';
import { notify } from './feedbackStore';
import { setPaidAtSupported, paidAtSupported, todayISO } from '../lib/finance/balances';
import { parseTargets, setTransferTargets, withLocalTargets } from '../lib/finance/transferTargets';
import { parseBasis, setBasis } from '../lib/finance/flows';
import { parseRules, withAmountFrom, type BudgetRule } from '../lib/finance/budget';
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
  }) => Promise<boolean>;
  /** Set one exchange rate (what one unit is worth in the base currency). Resolves true once the server holds it. */
  saveRate: (currency: string, rate: number) => Promise<boolean>;
  /** Change a category's budget amount from a month onward. Resolves true once the server holds it. */
  saveBudgetAmount: (categoryId: string, monthKey: string, amount: number) => Promise<boolean>;
  clearAll: () => void;
}

/** One shared-pref write at a time: two saves racing would each read the old object and the second would undo the first. */
let prefWriteInFlight = false;

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
    // An entry with no payment date is money still owed, and is kept out of every balance. One made today or
    // earlier from the phone has been paid, so it is stamped; one dated ahead is left unpaid, as on the web.
    const paid = paidAtSupported() && tx.date <= todayISO() ? { paid_at: tx.date } : {};
    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({ ...tx, ...paid, to_account_id: tx.to_account_id ?? null, note: tx.note ?? null, tags: [], attachments: [], is_cleared: false, is_recurring: false })
      .select()
      .single();
    if (error || !data) { notify('error', "Couldn't save that entry. Nothing was changed."); return false; }
    set({ transactions: [data as DbFinanceTransaction, ...get().transactions] });
    return true;
  },

  async saveRate(currency, rate) {
    if (prefWriteInFlight) return false;
    const next = withRate(currentRates(), currency, rate);
    if (!next) { notify('error', 'Enter a rate above zero. The base currency is always 1.'); return false; }
    prefWriteInFlight = true;
    try {
      const r = await writeSharedPref('finance-fx-rates', JSON.stringify(next));
      if (r !== 'saved') { notify('error', "Couldn't save that rate. Nothing was changed."); return false; }
      setFinancePrefs({ rates: next });
      await get().loadAll();   // re-reads from the server, so what is drawn is what was stored
      return true;
    } finally { prefWriteInFlight = false; }
  },

  async saveBudgetAmount(categoryId, monthKey, amount) {
    if (prefWriteInFlight) return false;
    const next = withAmountFrom(get().budgetRules, categoryId, monthKey, amount);
    if (!next) { notify('error', 'Enter an amount above zero. One-off and instalment budgets are changed on the web.'); return false; }
    prefWriteInFlight = true;
    try {
      const r = await writeSharedPref('finance-budget-rules', JSON.stringify(next));
      if (r !== 'saved') { notify('error', "Couldn't save that budget. Nothing was changed."); return false; }
      await get().loadAll();
      return true;
    } finally { prefWriteInFlight = false; }
  },

  clearAll() { set({ accounts: [], categories: [], transactions: [], goals: [], budgets: [], budgetRules: {}, bills: [], error: null }); },
}));
