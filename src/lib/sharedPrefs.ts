// Writes one key of the web's shared prefs. The same care the web's prefSync takes:
// read the whole object, change one key, write it back, then read it again —
// because an update against a row that is not there succeeds and changes nothing,
// and another writer landing between our read and our write erases the key.
import { supabase } from './supabase';
import { mergeSharedPref, holds } from './sharedPrefsCore';

export type WriteResult = 'saved' | 'failed';

export async function writeSharedPref(key: string, value: string): Promise<WriteResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 'failed';
  const id = session.user.id;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: row, error: readErr } = await supabase.from('users').select('schedule_rules').eq('id', id).maybeSingle();
    // A blind write is the destructive one: if the read failed, write nothing.
    if (readErr || !row) return 'failed';

    const next = mergeSharedPref(row.schedule_rules, key, value);
    const { data: touched, error } = await supabase.from('users').update({ schedule_rules: next }).eq('id', id).select('id');
    if (error || !touched || touched.length === 0) return 'failed';

    const { data: after } = await supabase.from('users').select('schedule_rules').eq('id', id).maybeSingle();
    if (holds(after?.schedule_rules, key, value)) return 'saved';
    // Something else wrote the row over ours — go round with a fresh read.
  }
  return 'failed';
}
