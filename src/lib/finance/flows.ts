// Income and spending, in the base currency, filed under the right month and
// category. Ported from how the web's Financials screen (ReflectionScreen) does it.
//
//  - Only `income` and `expense` entries are flows. A transfer, a borrowing and a
//    repayment move money between accounts or against a debt, and are neither
//    earned nor spent — counting them is how a loan reads as income.
//  - Each entry is converted at the rate it was added at (`txIn`); one in a
//    currency with no rate is left out and named, never added at face value.
//  - The month an entry is filed under depends on a choice the person makes on the
//    web: by the day it is DUE (its own date, whether or not it has been paid) or
//    by the day it was PAID (an unpaid entry has no place yet).

import type { DbFinanceTransaction as Tx, DbFinanceCategory as Cat } from '../../types/financeTypes';
import { baseCurrency } from './fx';
import { txIn, txConvert } from './txRates';
import { isUnpaid, paidAtSupported } from './balances';

export type Basis = 'due' | 'paid';
let basis: Basis = 'due';

/** Pure: the stored `finance-financials-basis` / `finance-count-on` strings in. The first one set wins, as on the web. */
export function parseBasis(financials: string | null | undefined, countOn: string | null | undefined): Basis {
  const clean = (v: string | null | undefined) => (v == null ? null : v.trim().replace(/^"|"$/g, ''));
  const v = clean(financials) ?? clean(countOn);
  return v === 'paid' ? 'paid' : 'due';
}
export function setBasis(b: Basis): void { basis = b; }
export function getBasis(): Basis { return basis; }

/** The date a figure is filed under, or null when this basis cannot place it: an entry with no payment date has not
 *  been paid, and money that has not moved does not belong in a table of money that has. Where the database cannot
 *  hold a payment date at all, nothing loses its place. */
export function filedOn(tx: Pick<Tx, 'date' | 'paid_at'>, b: Basis = basis): string | null {
  if (b === 'paid' && paidAtSupported()) return tx.paid_at ?? null;
  return tx.date;
}
export const filedIn = (tx: Pick<Tx, 'date' | 'paid_at'>, prefix: string, b: Basis = basis): boolean => {
  const d = filedOn(tx, b);
  return !!d && d.startsWith(prefix);
};

const kindOf = (tx: Pick<Tx, 'tx_type'>): 'income' | 'expense' | null =>
  tx.tx_type === 'income' ? 'income' : tx.tx_type === 'expense' ? 'expense' : null;

export interface Flows { income: number; expense: number; net: number; unrated: string[] }

/** What came in and went out in a period (`prefix` is `2026` or `2026-10`), in the base currency. */
export function totalsFor(txs: Tx[], prefix: string, b: Basis = basis): Flows {
  const base = baseCurrency();
  let income = 0, expense = 0;
  const unrated = new Set<string>();
  for (const tx of txs) {
    const kind = kindOf(tx);
    if (!kind || !filedIn(tx, prefix, b)) continue;
    const v = txIn(tx, base);
    if (v === null) { unrated.add((tx.currency || base).toUpperCase()); continue; }
    if (kind === 'income') income += v; else expense += v;
  }
  return { income, expense, net: income - expense, unrated: [...unrated] };
}

/** Per day (`YYYY-MM-DD`) for a month: what came in and went out. */
export function byDay(txs: Tx[], prefix: string, b: Basis = basis): Record<string, { income: number; expense: number }> {
  const base = baseCurrency();
  const out: Record<string, { income: number; expense: number }> = {};
  for (const tx of txs) {
    const kind = kindOf(tx);
    const day = filedOn(tx, b);
    if (!kind || !day || !day.startsWith(prefix)) continue;
    const v = txIn(tx, base);
    if (v === null) continue;
    (out[day] ??= { income: 0, expense: 0 })[kind] += v;
  }
  return out;
}

export interface CategoryTotal { cat: Cat | null; total: number }

/** A period's income or spending by category. A sub-category's money is its parent's too: "Groceries · Fruit" is
 *  money out of Groceries, so the parent's line covers everything filed beneath it. Largest first. */
export function byCategory(txs: Tx[], categories: Cat[], prefix: string, kind: 'income' | 'expense', b: Basis = basis): CategoryTotal[] {
  const base = baseCurrency();
  const acc = new Map<string, CategoryTotal>();
  for (const tx of txs) {
    if (kindOf(tx) !== kind || !filedIn(tx, prefix, b)) continue;
    const v = txIn(tx, base);
    if (v === null) continue;
    const own = categories.find(c => c.id === tx.category_id) ?? null;
    const root = own?.parent_id ? (categories.find(c => c.id === own.parent_id) ?? own) : own;
    const key = root?.id ?? 'uncategorized';
    const row = acc.get(key) ?? { cat: root, total: 0 };
    row.total += v;
    acc.set(key, row);
  }
  return [...acc.values()].sort((a, b2) => b2.total - a.total);
}

/** What an envelope has had spent from it in a month, in the envelope's own currency. An envelope is a record of
 *  money that has LEFT, so only paid expenses count, in the month they were paid — a bill due on the 28th and paid on
 *  the 3rd belongs to the month it was paid in. Where there is no rate the entry is left out. */
export function spentIn(txs: Tx[], month: string, categoryId: string | null, currency: string): number {
  let sum = 0;
  for (const tx of txs) {
    if (tx.tx_type !== 'expense' || isUnpaid(tx)) continue;
    if (!(tx.paid_at ?? tx.date).startsWith(month)) continue;
    if ((tx.category_id ?? null) !== categoryId) continue;
    sum += txConvert(tx, Math.abs(tx.amount), currency) ?? 0;
  }
  return sum;
}
