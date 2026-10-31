// What an account actually holds. Ported from the web app's finance/balances.ts,
// with the loan rules from loans.ts and the "safe to spend" rung from goalPlan.ts.
//
// `account.balance` is where the account STARTED, not where it is. The live
// balance is that plus every entry filed against it that has been paid. One year
// of entries is loaded at a time, so `balance` is the position before that year.
// Sign: positive is held, negative is owed.

import type { DbFinanceAccount as Account, DbFinanceTransaction as Tx } from '../../types/financeTypes';
import { baseCurrency, toBase } from './fx';
import { txConvert, txIn } from './txRates';

// ── Paid or not ─────────────────────────────────────────────────────────────
// An entry with no payment date is money still owed, whatever its own date says.
// Where the database has no `paid_at` column at all, nothing is marked: reading
// "the whole ledger is unpaid" would be a confident claim about data nobody has.
let paidAtColumn = true;
export function setPaidAtSupported(yes: boolean): void { paidAtColumn = yes; }
export const isUnpaid = (tx: Pick<Tx, 'paid_at'>): boolean => paidAtColumn && !tx.paid_at;
export const paidAtSupported = (): boolean => paidAtColumn;

// ── Loans ───────────────────────────────────────────────────────────────────
export const isLoan = (a?: { account_type?: string } | null): boolean => a?.account_type === 'loan';
export const SETTLED_BELOW = 0.5;
export const isSettled = (balance: number): boolean => Math.abs(balance) < SETTLED_BELOW;

/** Money paid into a loan from somewhere you hold it. */
export function isRepayment(tx: Pick<Tx, 'tx_type' | 'account_id' | 'to_account_id'>, accounts: Pick<Account, 'id' | 'account_type'>[]): boolean {
  if (tx.tx_type !== 'transfer' || !tx.to_account_id) return false;
  const from = accounts.find(a => a.id === tx.account_id);
  const to = accounts.find(a => a.id === tx.to_account_id);
  return isLoan(to) && !!from && !isLoan(from);
}

// ── Live balances ───────────────────────────────────────────────────────────

/** Where the money went for one account, in that account's own currency. Null
 *  where there is no rate to convert by: the entry stays out rather than a wrong
 *  number being absorbed. */
export function deltaFor(account: Account, tx: Tx): number | null {
  const into = (amount: number) => txConvert(tx, amount, account.currency);

  if (tx.tx_type === 'transfer') {
    // Both ends on the same account is money that went nowhere.
    if (tx.account_id === account.id && tx.to_account_id === account.id) return 0;
    if (tx.account_id === account.id) {
      const v = into(Math.abs(tx.amount));
      return v === null ? null : -v;
    }
    if (tx.to_account_id === account.id) return into(Math.abs(tx.amount));
    return 0;
  }
  if (tx.account_id !== account.id) return 0;
  if (tx.tx_type === 'income') return into(Math.abs(tx.amount));
  if (tx.tx_type === 'expense') {
    const v = into(Math.abs(tx.amount));
    return v === null ? null : -v;
  }
  // Asset and liability entries are about what is owned or owed, not what is in the account.
  return 0;
}

export interface LiveBalances {
  balances: Map<string, number>;
  /** Currencies an account holds entries in that nothing could convert. */
  unconverted: Map<string, Set<string>>;
  /** Unpaid and due by now: money actually owed. */
  pending: Map<string, number>;
  /** Unpaid and dated later: a fact about the diary, not a debt. */
  ahead: Map<string, number>;
}

export function liveBalances(accounts: Account[], transactions: Tx[], asOf: string = todayISO()): LiveBalances {
  const balances = new Map(accounts.map(a => [a.id, a.balance]));
  const unconverted = new Map<string, Set<string>>();
  const pending = new Map<string, number>();
  const ahead = new Map<string, number>();
  const byId = new Map(accounts.map(a => [a.id, a]));

  const apply = (a: Account, tx: Tx) => {
    const d = deltaFor(a, tx);
    if (d === null) {
      const set = unconverted.get(a.id) ?? new Set<string>();
      set.add((tx.currency || '').toUpperCase());
      unconverted.set(a.id, set);
      return;
    }
    if (isUnpaid(tx)) {
      const into = tx.date <= asOf ? pending : ahead;
      into.set(a.id, (into.get(a.id) ?? 0) + d);
      return;
    }
    balances.set(a.id, balances.get(a.id)! + d);
  };

  for (const tx of transactions) {
    if (tx.tx_type === 'transfer') {
      const from = tx.account_id ? byId.get(tx.account_id) : undefined;
      const to = tx.to_account_id ? byId.get(tx.to_account_id) : undefined;
      if (from) apply(from, tx);
      if (to && to.id !== from?.id) apply(to, tx);
      continue;
    }
    const a = tx.account_id ? byId.get(tx.account_id) : undefined;
    if (a) apply(a, tx);
  }
  return { balances, unconverted, pending, ahead };
}

export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA');
}

// ── Which group an account belongs to on the Balances screen ────────────────
export type AccountGroup = 'payment' | 'cards' | 'assets' | 'loans';
export function groupOf(a: Pick<Account, 'account_type'>): AccountGroup {
  if (a.account_type === 'credit_card') return 'cards';
  if (a.account_type === 'loan') return 'loans';
  if (a.account_type === 'asset') return 'assets';
  return 'payment'; // payment and wallet
}

// ── The totals on the Balances screen ───────────────────────────────────────

export interface Position {
  base: string;
  held: number;
  owed: number;
  net: number;
  /** Cash only (payment and wallet) less what is dated ahead and unpaid. */
  spendable: number;
  /** Cash in current accounts and wallets. */
  cash: number;
  /** Assets that are not cash: not counted as spendable. */
  assets: number;
  /** Dated ahead and unpaid, net of income due. */
  committed: number;
  /** Currencies left out of every figure for want of a rate. */
  unrated: string[];
}

/** Net position and safe-to-spend, in the base currency. An account whose
 *  currency has no rate is left out, and `unrated` says which. */
export function positionFrom(accounts: Account[], transactions: Tx[], today: string = todayISO()): Position {
  const base = baseCurrency();
  const { balances } = liveBalances(accounts, transactions, today);
  let held = 0, owed = 0, cash = 0, assets = 0;
  const unrated = new Set<string>();
  for (const a of accounts) {
    const raw = balances.get(a.id) ?? a.balance;
    const v = toBase(raw, a.currency, base);
    if (v === null) { unrated.add((a.currency || '').toUpperCase()); continue; }
    if (v < 0) { owed += -v; continue; }
    held += v;
    const g = groupOf(a);
    if (g === 'payment') cash += v;
    else if (g === 'assets') assets += v;
  }
  // Dated ahead and not paid: owed, whatever the account balance says. A
  // repayment due this month is cash already spoken for; any other transfer moves
  // money between your own accounts and leaves nothing.
  let committed = 0;
  for (const tx of transactions) {
    if (!isUnpaid(tx) || tx.date <= today) continue;
    const v = txIn(tx, base);
    if (v === null) continue;
    const repays = isRepayment(tx, accounts) && tx.date.slice(0, 7) === today.slice(0, 7);
    if (tx.tx_type === 'expense' || repays) committed += v;
    if (tx.tx_type === 'income') committed -= v;
  }
  return {
    base, held, owed, net: held - owed, cash, assets, committed,
    spendable: Math.max(0, cash - Math.max(0, committed)),
    unrated: [...unrated],
  };
}
