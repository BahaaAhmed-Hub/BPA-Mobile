// An entry keeps the exchange rate of the day it was added. Ported from the web
// app's finance/txRates.ts.
//
// The rate rides on the entry as a tag — `fx:USD/EGP=48.5` — so changing today's
// rate does not re-price last July's rent. Balances are not flows: an account
// held in dollars is worth what a dollar costs now, and converts by `toBase`.

import { baseCurrency, convert, rateFor } from './fx';

type Rated = { currency?: string; tags?: string[] | null };

const TAG = /^fx:([A-Z]{3})\/([A-Z]{3})=([\d.]+)$/;

/** The rate stamped on an entry, when it was stamped in this currency against this base. */
export function frozenRate(tx: Rated, base = baseCurrency()): number | null {
  const cur = (tx.currency || base).toUpperCase();
  for (const t of tx.tags ?? []) {
    const m = TAG.exec(t);
    if (m && m[1] === cur && m[2] === base.toUpperCase()) return Number(m[3]);
  }
  return null;
}

/** An amount of this entry's, in `to` (the base by default). Null when it cannot be known. */
export function txConvert(tx: Rated, amount: number, to = baseCurrency()): number | null {
  const base = baseCurrency();
  // Already in the currency asked for: no rate needed. Going via the base anyway
  // made 500 USD on a USD account read 480 once the dollar moved.
  if ((tx.currency || base).toUpperCase() === to.toUpperCase()) return amount;
  const rate = frozenRate(tx, base);
  if (rate === null) return convert(amount, tx.currency, to);
  const inBase = amount * rate;
  if (to.toUpperCase() === base.toUpperCase()) return inBase;
  const target = rateFor(to, base);
  return target ? inBase / target : null;
}

/** The size of an entry, in `to`. The thing every total adds up. */
export const txIn = (tx: Rated & { amount: number }, to = baseCurrency()): number | null =>
  txConvert(tx, Math.abs(tx.amount), to);
