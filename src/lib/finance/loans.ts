// Paying a lender back. On the web a loan is an account below zero and a repayment is a
// transfer into it from somewhere you hold the money — never an expense, which would leave the
// debt where it was. This builds that one entry and refuses what the ledger cannot hold
// correctly. Same currency only: a repayment across currencies needs a stamped rate on the
// entry, and filing it without one would leave one end out of its balance.

import type { DbFinanceAccount as Account } from '../../types/financeTypes';
import { SETTLED_BELOW, groupOf, isLoan, isUnpaid } from './balances';
import { txConvert } from './txRates';
import type { DbFinanceTransaction as Tx } from '../../types/financeTypes';

export interface Repayment {
  account_id: string;
  to_account_id: string;
  category_id: null;
  amount: number;
  currency: string;
  tx_type: 'transfer';
  payee: string;
  date: string;
  note: null;
}

export type RepayCheck = { ok: true; tx: Repayment } | { ok: false; reason: string };

/** Accounts a repayment can be paid from: cash you hold, in the loan's own currency. */
export function payFromOptions(accounts: Account[], loan: Account): Account[] {
  return accounts.filter(a => a.id !== loan.id && groupOf(a) === 'payment' && (a.currency || '').toUpperCase() === (loan.currency || '').toUpperCase());
}

/** `owed` is the positive amount still owed, in the loan's currency. */
export function repayment(
  from: Account | undefined, loan: Account, owed: number, amount: number, date: string,
): RepayCheck {
  if (!from) return { ok: false, reason: 'Choose where to pay from.' };
  if (groupOf(from) !== 'payment') return { ok: false, reason: 'Pay from a current account or wallet.' };
  if ((from.currency || '').toUpperCase() !== (loan.currency || '').toUpperCase()) {
    return { ok: false, reason: `Pay from a ${loan.currency} account. Repaying across currencies is done on the web.` };
  }
  if (!isFinite(amount) || amount <= 0) return { ok: false, reason: 'Enter an amount above zero.' };
  if (owed < SETTLED_BELOW) return { ok: false, reason: 'Nothing is owed on this loan.' };
  // Paying more than is owed would turn the lender into a debtor to you.
  if (amount > owed + SETTLED_BELOW) return { ok: false, reason: 'That is more than is owed.' };
  return {
    ok: true,
    tx: {
      account_id: from.id, to_account_id: loan.id, category_id: null,
      amount: Math.round(amount * 100) / 100, currency: loan.currency, tx_type: 'transfer',
      payee: `Repayment to ${loan.name}`, date, note: null,
    },
  };
}

// ─── The unspent pot ─────────────────────────────────────────────────────────
// Ported from the web's loans.ts. Borrowed money is two facts at once: a debt (only ever lowered by paying back) and
// cash that may not have been moved yet. Spending that cash must not add debt: it was counted when it was borrowed.
//
//   kept  a borrowing with no landing account: debt up, pot up.
//   draw  a transfer out of the pot into an account or card: pot down, the debt untouched.
//
// A borrowing straight into an account is both in one step, so the pot does not move. The pot starts at what the lender
// was opened as owing: money owed with nothing recorded as landing anywhere is, by definition, unspent.

export const DRAW_TAG = 'draw';
export const KEPT_TAG = 'kept';

type Ends = Pick<Tx, 'tx_type' | 'account_id' | 'to_account_id' | 'tags'>;
type Acct = Pick<Account, 'id' | 'account_type'>;
const acct = (accounts: Acct[], id?: string | null) => accounts.find(a => a.id === id);

/** Spending the pot: out of a lender, into somewhere, debt unchanged. */
export function isDraw(tx: Ends, accounts: Acct[]): boolean {
  if (tx.tx_type !== 'transfer' || !tx.to_account_id || !tx.tags?.includes(DRAW_TAG)) return false;
  const to = acct(accounts, tx.to_account_id);
  return isLoan(acct(accounts, tx.account_id)) && !!to && !isLoan(to);
}

/** Borrowed and left with the lender to be moved later. */
export function isKept(tx: Ends, accounts: Acct[]): boolean {
  return tx.tx_type === 'transfer' && !tx.to_account_id && !!tx.tags?.includes(KEPT_TAG) && isLoan(acct(accounts, tx.account_id));
}

/** Money borrowed: drawn from a loan into somewhere you can spend it, or kept with the lender. Spending the pot is not borrowing. */
export function isBorrowing(tx: Ends, accounts: Acct[]): boolean {
  if (isKept(tx, accounts)) return true;
  if (tx.tx_type !== 'transfer' || !tx.to_account_id || tx.tags?.includes(DRAW_TAG)) return false;
  const to = acct(accounts, tx.to_account_id);
  return isLoan(acct(accounts, tx.account_id)) && !!to && !isLoan(to);
}

/** Borrowed cash this lender still holds, in the lender's currency. Never below zero: what has been drawn is capped by
 *  what there was. Only paid entries count, as in every balance. */
export function unspentBorrowed(loan: Pick<Account, 'id' | 'currency' | 'balance'>, txs: Pick<Tx, 'tx_type' | 'account_id' | 'to_account_id' | 'tags' | 'amount' | 'currency' | 'paid_at'>[]): number {
  let pot = Math.max(0, -loan.balance);
  for (const t of txs) {
    if (t.tx_type !== 'transfer' || t.account_id !== loan.id || isUnpaid(t)) continue;
    const v = txConvert(t, Math.abs(t.amount), loan.currency) ?? 0;
    if (!t.to_account_id && t.tags?.includes(KEPT_TAG)) pot += v;
    else if (t.to_account_id && t.tags?.includes(DRAW_TAG)) pot -= v;
  }
  return Math.max(0, pot);
}

export interface BorrowedHeld { lender: { id: string; name: string; currency: string }; amount: number }

/** For each account that money from a lender reached (borrowed into it, or drawn from a lender's pot), how much of what it
 *  holds is still owed, in the account's own currency. What is owed is the lender's live debt, so paying back shrinks every
 *  account it lent into together, and a lender paid in full stops being named. It is also capped at what the account holds:
 *  an account spent down to nothing no longer holds borrowed money, whatever is still owed. */
export function borrowedHeld(
  accounts: Pick<Account, 'id' | 'name' | 'currency' | 'account_type'>[],
  txs: Pick<Tx, 'tx_type' | 'account_id' | 'to_account_id' | 'tags' | 'amount' | 'currency' | 'paid_at'>[],
  balances: Map<string, number>,
): Map<string, BorrowedHeld[]> {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const out = new Map<string, BorrowedHeld[]>();
  for (const lender of accounts.filter(a => isLoan(a))) {
    const owed = Math.max(0, -(balances.get(lender.id) ?? 0));
    if (owed < SETTLED_BELOW) continue;
    const landed = new Map<string, { own: number; inLoan: number }>();
    let total = 0;
    for (const t of txs) {
      if (t.account_id !== lender.id || !t.to_account_id || isUnpaid(t) || t.tx_type !== 'transfer') continue;
      const to = byId.get(t.to_account_id);
      if (!to || isLoan(to)) continue;
      const own = txConvert(t, Math.abs(t.amount), to.currency);
      const inLoan = txConvert(t, Math.abs(t.amount), lender.currency);
      if (own === null || inLoan === null) continue;
      const cur = landed.get(to.id) ?? { own: 0, inLoan: 0 };
      landed.set(to.id, { own: cur.own + own, inLoan: cur.inLoan + inLoan });
      total += inLoan;
    }
    if (total <= 0) continue;
    const ratio = Math.min(1, owed / total);
    for (const [id, v] of landed) {
      const held = Math.max(0, balances.get(id) ?? 0);
      const amount = Math.min(v.own * ratio, held);
      if (amount < SETTLED_BELOW) continue;
      out.set(id, [...(out.get(id) ?? []), { lender: { id: lender.id, name: lender.name, currency: lender.currency }, amount }]);
    }
  }
  return out;
}
