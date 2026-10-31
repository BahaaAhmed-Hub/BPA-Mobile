// Who sees the setup guide: a new signup, once. Same rule as the web's
// wizardGate.ts. Having no local flag is not evidence of a new account — it is
// also an established person on a new phone — so the account's own age decides,
// and `professor-wizard-done` (a shared pref) lets a second device see that the
// first one already closed it.

export const NEW_SIGNUP_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A clock a minute behind the server's must not make a new account look like it is from the future. */
const SKEW_MS = 60_000;

/** A missing or unreadable `created_at` is not new. */
export function isNewSignup(createdAt: string | undefined | null, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  const age = now - t;
  return age >= -SKEW_MS && age <= NEW_SIGNUP_DAYS * DAY_MS;
}

export interface GateInput {
  createdAt?: string | null;
  localDone: boolean;
  sharedDone: boolean;
  hasCompanies: boolean;
  hasHabits: boolean;
}
/** `open` — show it. `done` — already closed. `established` — not a new signup, so never. */
export type GateAnswer = 'open' | 'done' | 'established';

export function gateAnswer(i: GateInput, now = Date.now()): GateAnswer {
  if (i.localDone || i.sharedDone) return 'done';
  if (!isNewSignup(i.createdAt, now)) return 'established';
  // A new account that already has data came through an import or another device: the guide would ask for what is there.
  if (i.hasCompanies || i.hasHabits) return 'established';
  return 'open';
}
