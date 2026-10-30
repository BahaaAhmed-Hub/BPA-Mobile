import type { DbTask } from '../types/database';

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
