// Where a transfer lands, when the database row does not say. Ported from the web
// app's finance/transferTargets.ts.
//
// `to_account_id` arrived with a later migration. Until a row has one, a payment
// onto a card takes money out of the account it was paid from and puts it
// nowhere — the card stays as owed as before. The web remembers the destination
// per entry (`finance-transfer-targets`, a shared pref) and fills the gap; the
// server's own value wins wherever it has one.

import type { DbFinanceTransaction as Tx } from '../../types/financeTypes';

let targets: Record<string, string> = {};

/** Pure: the stored `finance-transfer-targets` string in, a clean map out. */
export function parseTargets(raw: string | null | undefined): Record<string, string> {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch { return {}; }
}

export function setTransferTargets(map: Record<string, string>): void { targets = { ...map }; }

/** The server's destination wins where it has one; this fills the gap. */
export function withLocalTargets(rows: Tx[]): Tx[] {
  return rows.map(t => t.to_account_id || !targets[t.id] ? t : { ...t, to_account_id: targets[t.id] });
}
