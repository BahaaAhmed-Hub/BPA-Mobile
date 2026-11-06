// task_sessions on the server. Only talks to the table; what to keep, drop or retry is the store's business.
// Ported in shape from the web's src/lib/taskSessionsDb.ts: a failed read is `null` (keep what you have, never an
// empty list), `'missing'` means the migration has not run, and a stop only lands on a timer the server still has running.
import { supabase } from '../supabase';
import { rowFromSession, sessionFromRow, type SessionRow, type TaskSession } from './taskSessions';

export type DbResult = { ok: true } | { ok: false; code?: string; message: string };

/** The table is not there (the web's 20260048 migration has not run on this project). */
export const isMissingTable = (code?: string): boolean => code === '42P01' || code === 'PGRST205';
/** A second running timer on one task: the unique index refused it. */
export const isAlreadyRunning = (code?: string): boolean => code === '23505';

/** How far back the phone reads: enough for a week's and a month's totals, small enough for a cellular read. */
export const LOOKBACK_DAYS = 62;

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The recent window plus anything still running, oldest first. */
export async function loadRecentSessions(now = Date.now()): Promise<TaskSession[] | null | 'missing'> {
  const since = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
  const PAGE = 1000;
  const rows: SessionRow[] = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase.from('task_sessions').select('*')
      .or(`started_at.gte.${since},ended_at.is.null`)
      .order('started_at', { ascending: true }).order('id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return isMissingTable(error.code) ? 'missing' : null;
    rows.push(...((data ?? []) as SessionRow[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows.map(sessionFromRow);
}

/** Insert one session and get back the row the server made (it chooses the id). */
export async function insertSession(s: Omit<TaskSession, 'id'>): Promise<{ ok: true; session: TaskSession } | { ok: false; code?: string; message: string }> {
  const userId = await uid();
  if (!userId) return { ok: false, message: 'You are signed out.' };
  const { id: _omit, ...row } = rowFromSession({ ...s, id: 'new' }, userId);
  const { data, error } = await supabase.from('task_sessions').insert(row).select('*').single();
  if (error || !data) return { ok: false, code: error?.code, message: error?.message ?? 'No row came back.' };
  return { ok: true, session: sessionFromRow(data as SessionRow) };
}

/** Stop a timer only if the server still has it running. The first stop wins: with two devices pressing Stop, the second
 *  must not stretch the first one's end to its own, later, moment. `stopped: false` means somebody got there first. */
export async function stopSession(s: TaskSession): Promise<{ ok: true; stopped: boolean } | { ok: false; code?: string; message: string }> {
  if (s.end === null) return { ok: true, stopped: false };
  const { data, error } = await supabase.from('task_sessions')
    .update({ ended_at: new Date(s.end).toISOString(), review: !!s.review })
    .eq('id', s.id).is('ended_at', null).select('id');
  if (error) return { ok: false, code: error.code, message: error.message };
  return { ok: true, stopped: (data ?? []).length > 0 };
}

export async function deleteSession(id: string): Promise<DbResult> {
  const { error } = await supabase.from('task_sessions').delete().eq('id', id);
  return error ? { ok: false, code: error.code, message: error.message } : { ok: true };
}
