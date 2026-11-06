// Pure half of writing one shared pref. `users.schedule_rules` belongs to the web
// too (connected accounts, AI key, profile, every shared pref), so a write has to
// change exactly one key and carry the rest through untouched.

export const SHARED_FIELD = 'shared_prefs';

/** `rules` with `key` set to `value` inside the shared bag, and everything else as it was. */
export function mergeSharedPref(rules: unknown, key: string, value: string): Record<string, unknown> {
  const prev = (rules && typeof rules === 'object' ? rules : {}) as Record<string, unknown>;
  const bag = (prev[SHARED_FIELD] && typeof prev[SHARED_FIELD] === 'object' ? prev[SHARED_FIELD] : {}) as Record<string, string>;
  return { ...prev, [SHARED_FIELD]: { ...bag, [key]: value } };
}

/** Whether the row as read back holds the value we meant to write. */
export function holds(rules: unknown, key: string, value: string): boolean {
  const bag = (rules as Record<string, unknown> | null)?.[SHARED_FIELD] as Record<string, string> | undefined;
  return bag?.[key] === value;
}
