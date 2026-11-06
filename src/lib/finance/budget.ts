// Budgets: what each category is allowed this month, and what has been spent from
// it. Ported from the web app's BudgetRuleModal (rules), budgetSteps (history) and
// BudgetScreen (envelopes).
//
// A budget on the web is a RULE per category, kept in the person's shared prefs
// (`finance-budget-rules`) — not rows in a table. A rule can repeat (an amount per
// week/month/quarter/year), fall once on a date, or be a custom set of dated
// instalments (school fees); it can start and end in given months, be in its own
// currency, and carry a history of changes ("steps") so a raise made in November
// does not rewrite July.

import type { DbFinanceCategory as Cat, DbFinanceTransaction as Tx } from '../../types/financeTypes';
import { baseCurrency, rateFor, toBase } from './fx';
import { txIn } from './txRates';
import { isUnpaid } from './balances';

export type Frequency = 'weekly' | 'monthly' | 'every_2_months' | 'quarterly' | 'yearly';
export type Schedule = 'repeat' | 'once' | 'custom';

/** How many months' worth of a month a frequency is. */
const PER: Record<Frequency, number> = { weekly: 52 / 12, monthly: 1, every_2_months: 1 / 2, quarterly: 1 / 3, yearly: 1 / 12 };

export interface BudgetLine { id?: string; date: string; amount: number; note?: string }
export interface RuleStep { from: string; amount?: number; currency?: string; frequency?: string; bucket?: string; lines?: unknown[] }

export interface BudgetRule {
  schedule?: Schedule;
  onDate?: string;
  lines?: BudgetLine[];
  linesRepeat?: boolean;
  amount: number;
  steps?: RuleStep[];
  frequency: Frequency;
  /** First month it applies to, 'YYYY-MM'. Absent means every month. */
  starts?: string;
  ends?: string;
  currency?: string;
}

/** Pure: the stored `finance-budget-rules` string in, the rules out. */
export function parseRules(raw: string | null | undefined): Record<string, BudgetRule> {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, BudgetRule>) : {};
  } catch { return {}; }
}

export const monthKeyOf = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The budget as it was IN a month: the base with every change up to and including that month laid over it. */
export function ruleAt(rule: BudgetRule | undefined, monthKey: string = monthKeyOf()): BudgetRule | undefined {
  if (!rule) return rule;
  let out = rule;
  for (const { from, ...change } of rule.steps ?? []) {
    if (from > monthKey) break;
    out = { ...out, ...change } as BudgetRule;
  }
  return out;
}

export const scheduleOf = (r?: Pick<BudgetRule, 'schedule'>): Schedule => r?.schedule ?? 'repeat';
export const isDated = (r?: Pick<BudgetRule, 'schedule'>): boolean => scheduleOf(r) === 'once' || scheduleOf(r) === 'custom';

function linesOf(rule: Pick<BudgetRule, 'lines'>): BudgetLine[] {
  return (rule.lines ?? [])
    .filter(l => l && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Whether a budget applies to the month being looked at (it may start later, or have ended). */
export function activeIn(rule: Pick<BudgetRule, 'starts' | 'ends'> | undefined, monthKey: string): boolean {
  if (!rule) return false;
  if (rule.starts && monthKey < rule.starts) return false;
  if (rule.ends && monthKey > rule.ends) return false;
  return true;
}

/** What this envelope asks for in a month — the instalment that falls in it, not a twelfth of the year. A yearly
 *  budget of 12,000 is 1,000 a month. */
export function monthlyAmount(rule: BudgetRule | undefined, monthKey: string): number {
  if (!rule) return 0;
  const r = ruleAt(rule, monthKey) as BudgetRule;
  const kind = scheduleOf(r);
  if (kind === 'once') {
    if (!(r.amount > 0)) return 0;
    return r.onDate?.slice(0, 7) === monthKey ? r.amount : 0;
  }
  if (kind === 'custom') {
    return linesOf(r)
      // A repeating set comes round every year, so only the month matters.
      .filter(l => r.linesRepeat ? l.date.slice(5, 7) === monthKey.slice(5, 7) : l.date.slice(0, 7) === monthKey)
      .reduce((n, l) => n + l.amount, 0);
  }
  if (!r.amount) return 0;
  return r.amount * (PER[r.frequency] ?? 1);
}

/** An envelope holds what has come out of it, and an entry says so with its type matching the category's. A
 *  repayment is the exception: paying a lender back is a transfer, but it is filed under the loan's category. */
export const spendsEnvelope = (tx: Pick<Tx, 'tx_type' | 'category_id'>, wanted: 'income' | 'expense'): boolean =>
  tx.tx_type === wanted || (wanted === 'expense' && tx.tx_type === 'transfer' && !!tx.category_id);

export interface EnvelopePart {
  cat: Cat;
  planned: number;
  cur: string;
  budgeted: boolean;
  /** Spent under this part alone, in the envelope's currency. */
  actual: number;
}

export interface Envelope {
  cat: Cat;
  /** In the envelope's own currency. */
  planned: number;
  actual: number;
  cur: string;
  /** In the base currency, or null when there is no rate to get there. */
  actualBase: number | null;
  plannedBase: number | null;
  plannedFrom: 'own' | 'parts' | 'none';
  children: EnvelopePart[];
  /** Currencies left out of this envelope for want of a rate. */
  currencies: string[];
}

/** This month's envelopes: a category's own entries plus its children's ("Groceries · Fruit" is money out of
 *  Groceries). Only paid entries, in the month they were paid. */
export function buildEnvelopes(
  categories: Cat[], transactions: Tx[], rules: Record<string, BudgetRule>, monthKey: string, base: string = baseCurrency(),
): { spending: Envelope[]; earning: Envelope[] } {
  const parents = categories.filter(c => !c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const paid = transactions.filter(t => !isUnpaid(t));

  const build = (cat: Cat): Envelope => {
    const rule = rules[cat.id];
    const cur = ruleAt(rule, monthKey)?.currency ?? base;
    const rate = rateFor(cur, base);
    const kids = categories.filter(c => c.parent_id === cat.id);
    const ids = new Set([cat.id, ...kids.map(c => c.id)]);
    const wanted = cat.tx_type === 'income' ? 'income' : 'expense';

    let inBase = 0;
    const byChild = new Map<string, number>();
    const currencies = new Set<string>();
    for (const tx of paid) {
      if (!tx.category_id || !ids.has(tx.category_id)) continue;
      if (!spendsEnvelope(tx, wanted)) continue;
      if (!(tx.paid_at ?? tx.date).startsWith(monthKey)) continue;
      const v = txIn(tx, base);
      if (v === null) { currencies.add(tx.currency); continue; } // no rate — say so, never guess
      inBase += v;
      if (tx.category_id !== cat.id) byChild.set(tx.category_id, (byChild.get(tx.category_id) ?? 0) + v);
    }

    const own = activeIn(rule, monthKey) ? monthlyAmount(rule, monthKey) : 0;

    // A sub-category keeps its budget in its own currency; each is converted into what the envelope is kept in.
    const children: EnvelopePart[] = kids.map(child => {
      const r = rules[child.id];
      const childOwn = activeIn(r, monthKey) ? monthlyAmount(r, monthKey) : 0;
      const childCur = ruleAt(r, monthKey)?.currency ?? cur;
      const kidBase = childOwn === 0 ? 0 : toBase(childOwn, childCur, base);
      if (childOwn > 0 && (kidBase === null || rate === null)) currencies.add(childCur);
      return {
        cat: child, planned: childOwn, cur: childCur, budgeted: childOwn > 0,
        actual: rate === null ? 0 : (byChild.get(child.id) ?? 0) / rate,
        // kept for the parts total below
        ...({ inEnvelope: kidBase === null || rate === null ? null : kidBase / rate } as object),
      };
    });
    const fromParts = children.reduce((n, c) => n + ((c as unknown as { inEnvelope: number | null }).inEnvelope ?? 0), 0);
    const actual = rate === null ? 0 : inBase / rate;

    // Its own figure wins where there is one — otherwise the parts add up to it. Never both, or a split counts twice.
    const planned = own > 0 ? own : fromParts;
    const plannedFrom: Envelope['plannedFrom'] = own > 0 ? 'own' : fromParts > 0 ? 'parts' : 'none';
    return {
      cat, planned, actual, cur, plannedFrom, children,
      actualBase: rate === null ? null : inBase,
      plannedBase: rate === null ? null : planned * rate,
      currencies: [...currencies],
    };
  };

  const all = parents.map(build);
  return { spending: all.filter(e => e.cat.tx_type !== 'income'), earning: all.filter(e => e.cat.tx_type === 'income') };
}

/** Everything that can be converted is added up. What cannot is counted, so a total is never quietly short. */
export function sumEnvelopes(rows: Pick<Envelope, 'actualBase' | 'plannedBase'>[]): { actual: number; planned: number; aside: number } {
  return {
    actual: rows.reduce((s, r) => s + (r.actualBase ?? 0), 0),
    planned: rows.reduce((s, r) => s + (r.plannedBase ?? 0), 0),
    aside: rows.filter(r => r.actualBase === null).length,
  };
}

/** Whether this budget's amount can be changed from a phone: a plain amount per period. One-off and custom
 *  instalment budgets carry dated lines, which are edited on the web. */
export const canEditAmount = (rule: BudgetRule | undefined): boolean => !rule || scheduleOf(rule) === 'repeat';

/** The rules with a category's monthly amount changed from `monthKey` onward. History is kept the way the web keeps it:
 *  a step from that month, so a raise in November does not rewrite July. A category with no budget gets a monthly
 *  one starting that month. Returns null when the amount is not a positive number or the budget is not editable here. */
export function withAmountFrom(
  rules: Record<string, BudgetRule>, categoryId: string, monthKey: string, amount: number,
): Record<string, BudgetRule> | null {
  if (!isFinite(amount) || amount <= 0) return null;
  const rule = rules[categoryId];
  if (!canEditAmount(rule)) return null;
  if (!rule) return { ...rules, [categoryId]: { amount, frequency: 'monthly', starts: monthKey } };
  // The rule's amount is per its own period (a yearly 12,000), but the person is asked for a month: convert back.
  const freq = (ruleAt(rule, monthKey) as BudgetRule).frequency;
  const perPeriod = Math.round((amount / (PER[freq] ?? 1)) * 100) / 100;
  const steps = (rule.steps ?? []).filter(st => st.from !== monthKey);
  steps.push({ from: monthKey, amount: perPeriod });
  steps.sort((a, b) => a.from.localeCompare(b.from));
  return { ...rules, [categoryId]: { ...rule, steps } };
}
