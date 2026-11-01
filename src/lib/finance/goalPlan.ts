// Can a goal actually happen? Ported from the web's goalPlan.ts, the part that reads the ledger.
//
//   capacity  — what is spare now (cash, less what is dated ahead, a month's cushion and what the goals already
//               hold) and what a usual month leaves over.
//   schedule  — the money poured down the ranking: spare cash first, then each month's surplus, rank 1 filled
//               before rank 2. A goal that lands hands its share to the next, so each gets a month it lands in.
//
// What this does NOT do, and the web does: it assumes every month is a usual one. The web's screen also folds in
// dated outflows (a school-fee instalment), forecast rules and loan payment plans, and offers Share and Commit
// policies. So a month here can differ from the web's; the screen says so.

import type { DbFinanceAccount as Account, DbFinanceTransaction as Tx, DbFinanceGoal as GoalRow } from '../../types/financeTypes';
import { baseCurrency, toBase } from './fx';
import { txIn } from './txRates';
import { isRepayment, liveBalances, SETTLED_BELOW, paidAtSupported, todayISO } from './balances';

export const WINDOW_MONTHS = 6;
export const DEFAULT_BUFFER_MONTHS = 1;
const HORIZON = 120;
const SPENDABLE = ['payment', 'wallet'];
const CAN_OWE = [...SPENDABLE, 'credit_card', 'loan'];
export const DEBT_PREFIX = 'debt:';

export interface Goal { id: string; name: string; target: number; current: number; currency: string; rank: number | null; deadline: string | null }

export interface Capacity {
  held: number; spendable: number; free: number; buffer: number; earmarked: number; committed: number;
  monthlyIn: number; monthlyOut: number; surplus: number; months: number; currency: string;
}

const monthKey = (iso: string) => iso.slice(0, 7);
const paid = (tx: Tx) => !paidAtSupported() || !!tx.paid_at;
const whenPaid = (tx: Tx) => tx.paid_at ?? tx.date;

function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The last complete months before this one: a month you are three days into is not a month. */
function windowKeys(today: string, n = WINDOW_MONTHS): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** What a month usually looks like: each category's own median, added up. The median of a month's total swings with
 *  whichever lumpy month it lands on; a category that turns up in under half the months is a date, not a monthly cost. */
export function typicalMonth(transactions: Tx[], base: string, today = todayISO()): { monthlyIn: number; monthlyOut: number; live: string[] } {
  const keys = windowKeys(today);
  const inBy = new Map(keys.map(k => [k, 0]));
  const outBy = new Map(keys.map(k => [k, 0]));
  const cell = new Map<string, Map<string, number>>();
  const kindOf = new Map<string, 'income' | 'expense'>();
  for (const tx of transactions) {
    if (!paid(tx)) continue;
    const k = monthKey(whenPaid(tx));
    if (!inBy.has(k)) continue;
    const v = txIn(tx, base);
    if (v === null) continue;
    if (tx.tx_type === 'income') inBy.set(k, inBy.get(k)! + v);
    else if (tx.tx_type === 'expense') outBy.set(k, outBy.get(k)! + v);
    else continue;
    const id = `${tx.tx_type}:${tx.category_id ?? ''}`;
    kindOf.set(id, tx.tx_type as 'income' | 'expense');
    const row = cell.get(id) ?? new Map<string, number>();
    row.set(k, (row.get(k) ?? 0) + v);
    cell.set(id, row);
  }
  // A month with nothing in it is a month the ledger did not cover, not a month of earning nothing.
  const live = keys.filter(k => inBy.get(k)! > 0 || outBy.get(k)! > 0);
  let monthlyIn = 0, monthlyOut = 0;
  for (const [id, row] of cell) {
    const hits = live.filter(k => (row.get(k) ?? 0) > 0);
    if (hits.length * 2 > live.length) {
      const m = median(live.map(k => row.get(k) ?? 0));
      if (kindOf.get(id) === 'income') monthlyIn += m; else monthlyOut += m;
    }
  }
  return { monthlyIn, monthlyOut, live };
}

export function toGoal(g: GoalRow, base = baseCurrency()): Goal {
  return { id: g.id, name: g.name, target: g.target_amount, current: g.current_amount, currency: (g.currency || base).toUpperCase(), rank: g.rank ?? null, deadline: g.deadline ?? null };
}

export function capacityFrom(accounts: Account[], transactions: Tx[], goals: Goal[], bufferMonths = DEFAULT_BUFFER_MONTHS, today = todayISO()): Capacity {
  const base = baseCurrency();
  const { balances } = liveBalances(accounts, transactions);
  let held = 0;
  for (const a of accounts) {
    if (!SPENDABLE.includes(a.account_type)) continue;
    const v = toBase(balances.get(a.id) ?? a.balance, a.currency, base);
    if (v !== null && v > 0) held += v;
  }
  // What the goals hold is in those same accounts, so it is already spoken for.
  let earmarked = 0;
  for (const g of goals) { const v = toBase(g.current, g.currency, base); if (v !== null) earmarked += Math.max(0, v); }

  const { monthlyIn, monthlyOut, live } = typicalMonth(transactions, base, today);

  // Dated ahead and not paid is owed, whatever the account says. A repayment due this month is cash already spoken for.
  let committed = 0;
  for (const tx of transactions) {
    if (paid(tx) || tx.date <= today) continue;
    const v = txIn(tx, base);
    if (v === null) continue;
    const repays = tx.tx_type === 'transfer' && isRepayment(tx, accounts) && tx.date.slice(0, 7) === today.slice(0, 7);
    if (tx.tx_type === 'expense' || repays) committed += v;
    if (tx.tx_type === 'income') committed -= v;
  }

  const buffer = Math.max(0, monthlyOut * bufferMonths);
  const spendable = Math.max(0, held - Math.max(0, committed));
  const free = Math.max(0, spendable - buffer - earmarked);
  return { held, spendable, free, buffer, earmarked, committed, monthlyIn, monthlyOut, surplus: monthlyIn - monthlyOut, months: live.length, currency: base };
}

/** One goal per account in the red, ranked ahead of everything the person set: interest outruns any saving. */
export function debtGoals(accounts: Account[], transactions: Tx[]): Goal[] {
  const { balances } = liveBalances(accounts, transactions);
  const base = baseCurrency();
  const out: Goal[] = [];
  accounts.forEach((a, i) => {
    const bal = balances.get(a.id) ?? a.balance;
    if (bal >= 0 || -bal < SETTLED_BELOW || !CAN_OWE.includes(a.account_type) || toBase(bal, a.currency, base) === null) return;
    out.push({
      id: `${DEBT_PREFIX}${a.id}`, name: a.account_type === 'loan' ? `Repay ${a.name}` : `Clear ${a.name}`,
      target: Math.round(-bal * 100) / 100, current: 0, currency: (a.currency || base).toUpperCase(), rank: -1000 + i, deadline: null,
    });
  });
  return out;
}

export const isDebtGoal = (g: { id: string }): boolean => g.id.startsWith(DEBT_PREFIX);

export function byRank(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
}

export function monthsUntil(deadline: string, today = todayISO()): number {
  const [y, m, d] = deadline.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.max(1, (y - ty) * 12 + (m - tm) + (d >= td ? 0 : -1));
}

function addMonths(today: string, n: number): string {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface GoalPlan {
  goal: Goal;
  remaining: number;
  /** Taken from what is spare today. */
  lump: number;
  /** What next month puts in; zero for a goal still queued behind another. */
  monthly: number;
  /** Months until anything reaches it: 0 for one funded now, null for one nothing ever reaches. */
  startsIn: number | null;
  /** What it would need each month to land on its deadline. */
  required: number | null;
  /** The month it lands in ('YYYY-MM'), or null if nothing reaches it inside ten years. */
  eta: string | null;
  /** Whether the eta is on or before the deadline; null with no deadline. */
  onTime: boolean | null;
}

/** The plan run forward a month at a time, Ladder policy: rank 1 is filled before rank 2 sees anything, and a goal with
 *  a deadline takes what that deadline asks for rather than starving the one behind it. */
export function planGoals(goals: Goal[], capacity: Capacity, today = todayISO(), horizon = HORIZON): GoalPlan[] {
  const base = capacity.currency;
  const ordered = byRank(goals);
  const need = new Map<string, number>();
  for (const g of ordered) {
    const t = toBase(g.target, g.currency, base) ?? g.target;
    const c = toBase(g.current, g.currency, base) ?? g.current;
    need.set(g.id, Math.max(0, t - c));
  }
  const remaining0 = new Map(need);
  const lump = new Map<string, number>(), monthly = new Map<string, number>(), startsIn = new Map<string, number>(), landsIn = new Map<string, string>();

  const put = (g: Goal, amount: number, month: number) => {
    const left = need.get(g.id) ?? 0;
    const take = Math.min(left, amount);
    if (take <= 0) return 0;
    need.set(g.id, left - take);
    if (month === 0) lump.set(g.id, (lump.get(g.id) ?? 0) + take);
    if (month > 0 && !startsIn.has(g.id)) { startsIn.set(g.id, month); monthly.set(g.id, take); }
    else if (month > 0 && startsIn.get(g.id) === month) monthly.set(g.id, (monthly.get(g.id) ?? 0) + take);
    if ((need.get(g.id) ?? 0) <= 0.005 && !landsIn.has(g.id)) landsIn.set(g.id, addMonths(today, month));
    return take;
  };

  const divide = (amount: number, month: number) => {
    const hungry = ordered.filter(g => (need.get(g.id) ?? 0) > 0);
    let left = Math.max(0, amount);
    for (const g of hungry) {
      if (left <= 0) break;
      const owing = need.get(g.id) ?? 0;
      const months = g.deadline ? Math.max(1, monthsUntil(g.deadline, today) - month + 1) : 1;
      const wanted = g.deadline ? Math.min(owing, owing / months) : owing;
      left -= put(g, Math.min(left, wanted), month);
    }
    // Whatever a deadline left on the table still has to go somewhere.
    for (const g of hungry) { if (left <= 0) break; left -= put(g, left, month); }
  };

  for (const g of ordered) if ((need.get(g.id) ?? 0) <= 0) landsIn.set(g.id, monthKey(today));
  divide(Math.max(0, capacity.free), 0);

  const flat = Math.max(0, capacity.surplus);
  for (let m = 1; m <= horizon && flat > 0; m++) {
    if (ordered.every(g => (need.get(g.id) ?? 0) <= 0)) break;
    divide(flat, m);
  }

  return ordered.map(g => {
    const remaining = remaining0.get(g.id) ?? 0;
    const l = lump.get(g.id) ?? 0;
    const starts = startsIn.get(g.id) ?? null;
    const left = Math.max(0, remaining - l);
    const eta = landsIn.get(g.id) ?? null;
    return {
      goal: g, remaining, lump: l,
      monthly: starts === 1 ? (monthly.get(g.id) ?? 0) : 0,
      startsIn: left <= 0 ? 0 : starts,
      required: g.deadline ? left / monthsUntil(g.deadline, today) : null,
      eta,
      onTime: g.deadline == null ? null : eta !== null && eta <= monthKey(g.deadline),
    };
  });
}
