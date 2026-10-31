// Is the server struggling? Ported from the web app's serverStrain.ts.
//
// A database that is timing out is asked again, at full speed, by every refresh
// — which is how a slow minute becomes a slow half hour. This watches the
// answers coming back and says how long to leave it alone.
//
// A round of failures is one failure: a refresh is several reads, and if the
// server is down they all fail together. A failure counts only when the
// previous wait has run out, so the wait doubles once per attempt — 15s, 30s,
// 60s … five minutes — and any answer that is not a server fault resets it.
//
// Only calls to the database and auth count. An edge function failing is
// Google's or its own doing, and a 402/403 is a refusal, not strain.

const BASE_MS = 15_000;
const MAX_MS = 5 * 60_000;

let failures = 0;
let since = 0;

export function backoffLeft(now: number = Date.now()): number {
  if (!failures) return 0;
  const wait = Math.min(MAX_MS, BASE_MS * 2 ** (failures - 1));
  return Math.max(0, since + wait - now);
}

export function noteAnswer(fault: boolean, now: number = Date.now()): void {
  if (!fault) { failures = 0; return; }
  if (failures === 0 || backoffLeft(now) === 0) { failures++; since = now; }
}

/** Test hook: forget everything. */
export function resetStrain(): void { failures = 0; since = 0; }

const counts = (url: string) => url.includes('/rest/v1/') || url.includes('/auth/v1/');

/** `fetch` for the Supabase client: the same call, with its answer noted. */
export const strainAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const res = await fetch(input, init);
    if (counts(url)) noteAnswer(res.status >= 500 || res.status === 408 || res.status === 429);
    return res;
  } catch (e) {
    // A request the caller cancelled is not the server's doing.
    if (counts(url) && (e as { name?: string })?.name !== 'AbortError') noteAnswer(true);
    throw e;
  }
};
