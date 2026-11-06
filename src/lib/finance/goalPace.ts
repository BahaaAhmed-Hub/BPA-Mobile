// How a goal is going, from the three numbers it carries: what is saved, the
// target, and — if set — the deadline and the monthly amount put towards it.
// Plain arithmetic on the goal's own fields; it does not read the ledger, so it
// says nothing about whether the money is really there (the web's planner does).
// A figure that needs a field the goal does not have is left out, not guessed.

export interface PaceInput {
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  monthly_commit?: number | null;
}

export type Pace =
  | { state: 'reached' }
  | { state: 'open'; remaining: number }                                 // no deadline, no monthly amount
  | { state: 'overdue'; remaining: number }                              // deadline passed, still short
  | { state: 'needs'; remaining: number; perMonth: number; months: number }   // a deadline, no monthly amount set
  | { state: 'projected'; remaining: number; months: number; arrives: string; onTrack: boolean | null; perMonthNeeded: number | null };

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

function addMonths(from: Date, n: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + n, 1);
  return d;
}

/** `YYYY-MM` of the month the goal is reached if the monthly amount holds. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function goalPace(g: PaceInput, now = new Date()): Pace {
  const remaining = Math.max(0, g.target_amount - g.current_amount);
  if (g.target_amount > 0 && remaining === 0) return { state: 'reached' };
  if (!(g.target_amount > 0)) return { state: 'open', remaining: 0 };

  const dl = g.deadline ? new Date(`${g.deadline}T00:00:00`) : null;
  const dlOk = dl && Number.isFinite(dl.getTime()) ? dl : null;
  const commit = g.monthly_commit && g.monthly_commit > 0 ? g.monthly_commit : null;

  if (commit) {
    const months = Math.ceil(remaining / commit);
    const arrives = monthKey(addMonths(now, months));
    if (!dlOk) return { state: 'projected', remaining, months, arrives, onTrack: null, perMonthNeeded: null };
    const monthsLeft = Math.max(1, Math.ceil((dlOk.getTime() - now.getTime()) / MONTH_MS));
    const late = dlOk.getTime() < now.getTime();
    return {
      state: 'projected', remaining, months, arrives,
      onTrack: !late && months <= monthsLeft,
      perMonthNeeded: late ? null : Math.ceil(remaining / monthsLeft),
    };
  }

  if (!dlOk) return { state: 'open', remaining };
  if (dlOk.getTime() < now.getTime()) return { state: 'overdue', remaining };
  const months = Math.max(1, Math.ceil((dlOk.getTime() - now.getTime()) / MONTH_MS));
  return { state: 'needs', remaining, perMonth: Math.ceil(remaining / months), months };
}
