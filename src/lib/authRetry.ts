// When the server says the token has expired, refresh the session once and send the same request again, once.
//
// supabase-js refreshes a token a little before it expires by its OWN clock. A device whose clock is behind the server's (a
// simulator on a Mac whose clock drifted, a phone with the time set by hand) believes a token has hours left that the server
// already rejects, so every read answers "JWT expired" and the app shows no data at all, with no error anywhere. A forced
// refresh fixes it at once. Only an expiry is retried: any other 401 (a row policy, a bad key) would only fail again.

const EXPIRED = /JWT expired|PGRST301/i;

export const isExpiredAnswer = (status: number, body: string): boolean => status === 401 && EXPIRED.test(body);

/** The same request with the user's token replaced. A request carrying no user token (the anonymous key) is left alone. */
export function withFreshToken(init: RequestInit | undefined, token: string): RequestInit | null {
  const headers = new Headers(init?.headers);
  const auth = headers.get('Authorization') ?? headers.get('authorization');
  if (!auth || !/^Bearer /i.test(auth)) return null;
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** `refresh` returns the new access token, or null when the session could not be refreshed. Calls that find the token expired at
 *  the same moment share one refresh, and a refresh that failed is not tried again for a while, so a signed-out app does not
 *  hammer the auth server. */
export function retryOnExpired(inner: Fetch, refresh: () => Promise<string | null>, now: () => number = Date.now, coolDownMs = 30_000): Fetch {
  let inFlight: Promise<string | null> | null = null;
  let failedAt = -Infinity;

  const freshToken = (): Promise<string | null> => {
    if (now() - failedAt < coolDownMs) return Promise.resolve(null);
    inFlight ??= refresh().catch(() => null).then(t => { if (!t) failedAt = now(); inFlight = null; return t; });
    return inFlight;
  };

  return async (input, init) => {
    const res = await inner(input, init);
    if (res.status !== 401) return res;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/\/auth\/v1\//.test(url)) return res;                 // never loop on the auth server itself
    let body = '';
    try { body = await res.clone().text(); } catch { return res; }
    if (!isExpiredAnswer(res.status, body)) return res;
    const token = await freshToken();
    const again = token ? withFreshToken(init, token) : null;
    return again ? inner(input, again) : res;                 // once: a second 401 is the answer
  };
}
