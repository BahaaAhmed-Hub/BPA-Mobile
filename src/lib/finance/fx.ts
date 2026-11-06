// Money in more than one currency. Ported from the web app's finance/fx.ts.
//
// A rate is what one unit of a currency is worth in the base currency (USD 48.5
// means a dollar buys 48.5 of the base). They are set by hand on the web, where
// the person keeps them under Settings → Finance, and ride in their shared prefs
// (`finance-fx-rates`, `finance-currency`). Where there is no rate nothing is
// guessed: the figure comes back null and the caller says so.

let base = 'EGP';
let rates: Record<string, number> = {};

export function baseCurrency(): string { return base; }

/** Pure: the stored `finance-fx-rates` string in, a clean map out. */
export function parseRates(raw: string | null | undefined): Record<string, number> {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && isFinite(v) && v > 0) out[k.toUpperCase()] = v;
    }
    return out;
  } catch { return {}; }
}

/** Pure: the stored `finance-currency` string in, a 3-letter code out. */
export function parseBase(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().replace(/^"|"$/g, '').toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : 'EGP';
}

export function setFinancePrefs(p: { base?: string; rates?: Record<string, number> }): void {
  if (p.base) base = p.base.toUpperCase();
  if (p.rates) rates = { ...p.rates };
}

/** What one unit of `cur` is worth in the base currency, or null when nobody has said. */
export function rateFor(cur: string | undefined, b = base): number | null {
  const c = (cur || b).toUpperCase();
  if (c === b.toUpperCase()) return 1;
  return rates[c] ?? null;
}

/** An amount in the base currency, or null when it cannot be known. */
export function toBase(amount: number, cur: string | undefined, b = base): number | null {
  const rate = rateFor(cur, b);
  return rate === null ? null : amount * rate;
}

/** From one currency into another, by way of the base. */
export function convert(amount: number, from: string | undefined, to: string | undefined): number | null {
  const f = (from || base).toUpperCase();
  const t = (to || base).toUpperCase();
  if (f === t) return amount;
  const rf = rateFor(f);
  const rt = rateFor(t);
  if (rf === null || rt === null || rt === 0) return null;
  return (amount * rf) / rt;
}

/** Currencies that show up in the data with no rate to convert them by. */
export function currenciesNeedingRates(rows: { currency?: string }[], b = base): string[] {
  const missing = new Set<string>();
  for (const row of rows) {
    const c = (row.currency || b).toUpperCase();
    if (rateFor(c, b) === null) missing.add(c);
  }
  return [...missing];
}

/** The rates with one currency's rate set. Null when it is the base (always 1) or not a positive number. */
export function withRate(current: Record<string, number>, cur: string, value: number, b = base): Record<string, number> | null {
  const c = cur.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c) || c === b.toUpperCase() || !isFinite(value) || value <= 0) return null;
  return { ...current, [c]: value };
}

export function currentRates(): Record<string, number> { return { ...rates }; }
