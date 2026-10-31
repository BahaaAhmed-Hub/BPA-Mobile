import type { DbQuadrant, DbTask } from '../types/database';

/** Open means not finished and not dropped. The web app's `isOpenTask` counts a
 *  task as finished when either `completed` or `status === 'done'` says so, and
 *  a `deferred` (its "cancelled") one as dropped — reading `status` alone
 *  counts a task finished on the web as live work here. */
export function isOpenTask(t: Pick<DbTask, 'status' | 'completed'>): boolean {
  return !t.completed && t.status !== 'done' && t.status !== 'deferred';
}

/** The web creates a task the moment "New task" is pressed and opens its editor,
 *  so one that was never named is left behind with an empty title. It is a
 *  draft: nothing to lead with, nothing to tick off. */
export function hasTitle(t: Pick<DbTask, 'title'>): boolean {
  return (t.title ?? '').trim().length > 0;
}

/** What to put in front of someone as work to do. */
export function isActionable(t: Pick<DbTask, 'status' | 'completed' | 'title'>): boolean {
  return isOpenTask(t) && hasTitle(t);
}

/** Which company a task belongs to. The web writes `company_id: null` on every
 *  task and keeps the company in `company_tag` — a company's id, or its name —
 *  so matching on `company_id` alone finds nothing. Same rule as the web's
 *  `companyIdOfTask`: try both fields against both ids and names. */
export function taskCompanyId(
  t: Pick<DbTask, 'company_id' | 'company_tag'>,
  companies: { id: string; name: string }[],
): string | null {
  const tag = (t.company_tag ?? '').trim().toLowerCase();
  for (const c of companies) {
    if (t.company_id === c.id || t.company_tag === c.id) return c.id;
    if (tag && tag === c.name.trim().toLowerCase()) return c.id;
  }
  return null;
}

// ── Where a task goes ───────────────────────────────────────────────────────
// The web's two rules: a task made on purpose is not a capture, so it is placed
// — no date means Do, a date means Schedule — and the first date a task is ever
// given moves it from the brain dump or from Do to Schedule. Anything already in
// Delegate or Eliminate stays put, and so does a second date change or clearing it.

/** Where a new task with no quadrant of its own goes. */
export function placementForNew(dueDate: string | null | undefined): DbQuadrant {
  return dueDate ? 'important_not_urgent' : 'urgent_important';
}

/** The quadrant an edit moves a task to, or null when it should stay where it is. */
export function quadrantAfterEdit(
  before: Pick<DbTask, 'due_date' | 'quadrant'>,
  patch: Partial<Pick<DbTask, 'due_date' | 'quadrant'>>,
): DbQuadrant | null {
  if (patch.quadrant !== undefined) return null; // the person chose one
  if (!patch.due_date || before.due_date) return null; // only the FIRST date
  return before.quadrant === null || before.quadrant === 'urgent_important' ? 'important_not_urgent' : null;
}
