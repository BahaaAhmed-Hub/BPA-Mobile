// Paying a lender back. On the web a loan is an account below zero and a repayment is a
// transfer into it from somewhere you hold the money — never an expense, which would leave the
// debt where it was. This builds that one entry and refuses what the ledger cannot hold
// correctly. Same currency only: a repayment across currencies needs a stamped rate on the
// entry, and filing it without one would leave one end out of its balance.

import type { DbFinanceAccount as Account } from '../../types/financeTypes';
import { SETTLED_BELOW, groupOf } from './balances';

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
