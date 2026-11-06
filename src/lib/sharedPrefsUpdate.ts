// A read-modify-write of one key in the web's shared prefs, against any client that speaks the little of Supabase it needs.
// Kept apart from the real client so it can be tested against a stub server that is able to refuse.
//
// `fn` gets what the server holds right now and returns what to store, so a change made on another device between our read
// and our write is part of `fn`'s input and cannot be lost. Writes nothing when `fn` returns what is already there. Reads
// back to confirm, and goes round again if someone else wrote the row over ours. For a key that holds a map joined per
// entry, `fn` does the join.
import { mergeSharedPref, holds } from './sharedPrefsCore';

type Row = { schedule_rules: unknown } | null;
interface Client {
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  from: (table: 'users') => {
    select: (cols: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Row; error: { message: string } | null }> } };
    update: (patch: { schedule_rules: unknown }) => { eq: (c: string, v: string) => { select: (cols: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> } };
  };
}

export async function updateSharedPrefWith(client: unknown, key: string, fn: (current: string | null) => string): Promise<{ ok: true; value: string } | { ok: false }> {
  const c = client as Client;
  const { data: { session } } = await c.auth.getSession();
  if (!session) return { ok: false };
  const id = session.user.id;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: row, error: readErr } = await c.from('users').select('schedule_rules').eq('id', id).maybeSingle();
    if (readErr || !row) return { ok: false };   // a blind write is the destructive one
    const bag = ((row.schedule_rules as Record<string, unknown> | null)?.shared_prefs ?? {}) as Record<string, string>;
    const current = bag[key] ?? null;
    const next = fn(current);
    if (next === current) return { ok: true, value: next };

    const { data: touched, error } = await c.from('users').update({ schedule_rules: mergeSharedPref(row.schedule_rules, key, next) }).eq('id', id).select('id');
    if (error || !touched || touched.length === 0) return { ok: false };

    const { data: after } = await c.from('users').select('schedule_rules').eq('id', id).maybeSingle();
    if (holds(after?.schedule_rules, key, next)) return { ok: true, value: next };
  }
  return { ok: false };
}
