// Habits that are measured, not just ticked. Ported from the web app's habitSteps.ts and habitProgress.ts.
//
// A habit is yes/no (a tick) or "quantity": done by degrees, with a goal and a unit — 5 prayers, 2,000 ml of water.
// The day's amount is a `quantity` on that day's log; the habit is finished when it reaches the goal.

import type { DbHabit, DbHabitLog } from '../types/database';

type HabitShape = Pick<DbHabit, 'id' | 'name' | 'type' | 'goal' | 'unit'>;

/** The old way this app stored a target: "(5)" in the habit's name. Still read, for habits made that way. */
function targetFromName(name: string): number | null {
  const m = name.match(/\((\d+)\)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 1 ? n : null;
}

/** The goal of a counted habit, or null for a yes/no one. */
export function targetOf(h: Pick<DbHabit, 'name' | 'type' | 'goal'>): number | null {
  if (h.type === 'quantity' && h.goal && h.goal > 0) return h.goal;
  return targetFromName(h.name);
}

export const unitOf = (h: Pick<DbHabit, 'type' | 'unit'>): string => (h.type === 'quantity' ? (h.unit ?? '').trim() : '');

/** Pure: the stored `professor-habit-steps` string in. */
export function parseSteps(raw: string | null | undefined): Record<string, number> {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === 'number' && v > 0) out[k] = v;
    return out;
  } catch { return {}; }
}

/** What one tap adds. A habit that has never said takes a sensible guess from its own numbers rather than 1: a target
 *  of 2,000 in millilitres is not two thousand taps. */
export function stepFor(habit: Pick<DbHabit, 'id' | 'goal' | 'unit'>, steps: Record<string, number> = {}): number {
  const set = steps[habit.id];
  if (set && set > 0) return set;
  const goal = habit.goal ?? 0;
  const unit = (habit.unit ?? '').trim().toLowerCase();
  if (goal <= 20) return 1; // glasses, pages, sets
  if (/^(ml|millilit|mls)/.test(unit)) return goal >= 1000 ? 250 : 100;
  if (/^(g|gram|grams)$/.test(unit)) return 50;
  if (/(step|steps)/.test(unit)) return 1000;
  if (/(m|min|minute|minutes)$/.test(unit)) return goal >= 120 ? 15 : 5;
  // Anything else big: a tenth, rounded to something you would say out loud.
  const tenth = goal / 10;
  const nice = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
  return nice.reduce((best, n) => (Math.abs(n - tenth) < Math.abs(best - tenth) ? n : best), 1);
}

/** What has been logged for a habit on a day: the quantity if there is one; a plain finished day counts as the goal. */
export function amountOn(habit: HabitShape, logs: DbHabitLog[], date: string): number {
  const log = logs.find(l => l.date === date);
  if (!log) return 0;
  if (typeof log.quantity === 'number' && log.quantity >= 0) return log.quantity;
  const target = targetOf(habit);
  return log.completed !== false ? (target ?? 1) : 0;
}

/** Finished means the amount has reached the goal. Part-way is not finished (and does not extend a streak). */
export const isFinished = (habit: HabitShape, amount: number): boolean => {
  const t = targetOf(habit);
  return t === null ? amount > 0 : amount >= t;
};

/** 0..1: how much of the day's habit is done. 12 glasses is not 150% of a day. */
export function dayProgress(habit: HabitShape, amount: number): number {
  const t = targetOf(habit);
  if (t === null) return amount > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, amount / t));
}

/** Show a count the way you would say it: "2 / 5 Prayers", "500 / 2000 ml". */
export function countText(habit: HabitShape, amount: number): string {
  const t = targetOf(habit);
  const unit = unitOf(habit);
  return `${amount}/${t ?? 1}${unit ? ` ${unit}` : ''}`;
}
