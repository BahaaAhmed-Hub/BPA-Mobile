// The expired-token retry, against a server that can refuse: it must retry an expired token once, and must NOT retry anything else.
import { retryOnExpired, isExpiredAnswer, withFreshToken } from '../src/lib/authRetry'
import assert from 'node:assert'

const expired = () => new Response(JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }), { status: 401 })
const denied = () => new Response(JSON.stringify({ code: '42501', message: 'row-level security' }), { status: 401 })
const ok = () => new Response(JSON.stringify({ fine: true }), { status: 200 })
const bearer = (init?: RequestInit) => new Headers(init?.headers).get('authorization')

function server(answer: (call: number, auth: string | null, url: string) => Response) {
  const calls: { url: string; auth: string | null }[] = []
  const fetchFn = async (input: any, init?: RequestInit) => { const url = typeof input === 'string' ? input : input.href ?? input.url; calls.push({ url, auth: bearer(init) }); return answer(calls.length, bearer(init), url) }
  return { calls, fetchFn }
}
const init = (token = 'OLD') => ({ method: 'GET', headers: { Authorization: `Bearer ${token}`, apikey: 'k' } })

;(async () => {
  // pure
  assert.equal(isExpiredAnswer(401, '{"message":"JWT expired"}'), true); assert.equal(isExpiredAnswer(401, '{"code":"PGRST301"}'), true)
  assert.equal(isExpiredAnswer(401, 'row-level security'), false); assert.equal(isExpiredAnswer(403, 'JWT expired'), false); assert.equal(isExpiredAnswer(200, 'JWT expired'), false)
  assert.equal(bearer(withFreshToken(init(), 'NEW')!), 'Bearer NEW'); assert.equal(new Headers(withFreshToken(init(), 'NEW')!.headers).get('apikey'), 'k')   // other headers kept
  assert.equal(withFreshToken({ headers: { apikey: 'k' } }, 'NEW'), null); assert.equal(withFreshToken(undefined, 'NEW'), null)                         // no user token: left alone

  // 1. expired: refresh once, send the same request again with the new token, and the caller gets the success
  let s = server((n, auth) => (auth === 'Bearer NEW' ? ok() : expired())); let refreshes = 0
  let f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return 'NEW' })
  let r = await f('https://api.x/rest/v1/users', init()); assert.equal(r.status, 200); assert.equal(refreshes, 1); assert.deepEqual(s.calls.map(c => c.auth), ['Bearer OLD', 'Bearer NEW'])
  // control: the same server WITHOUT the wrapper answers 401 (what the app saw: no data, no error)
  assert.equal((await s.fetchFn('https://api.x/rest/v1/users', init() as any)).status, 401)

  // 2. a 401 that is not an expiry is NOT retried and does not refresh (a policy would only fail again)
  s = server(() => denied()); refreshes = 0; f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return 'NEW' })
  r = await f('https://api.x/rest/v1/users', init()); assert.equal(r.status, 401); assert.equal(refreshes, 0); assert.equal(s.calls.length, 1)
  // 3. a 200 and a 500 are passed through untouched
  s = server(() => ok()); f = retryOnExpired(s.fetchFn as any, async () => 'NEW'); assert.equal((await f('https://api.x/a', init())).status, 200); assert.equal(s.calls.length, 1)
  s = server(() => new Response('boom', { status: 500 })); f = retryOnExpired(s.fetchFn as any, async () => 'NEW'); assert.equal((await f('https://api.x/a', init())).status, 500); assert.equal(s.calls.length, 1)
  // 4. never loops on the auth server itself
  s = server(() => expired()); refreshes = 0; f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return 'NEW' })
  r = await f('https://api.x/auth/v1/token?grant_type=refresh_token', init()); assert.equal(r.status, 401); assert.equal(refreshes, 0); assert.equal(s.calls.length, 1)
  // 5. only ONCE: a server that says expired even for the new token returns that answer, not a loop
  s = server(() => expired()); refreshes = 0; f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return 'NEW' })
  r = await f('https://api.x/rest/v1/users', init()); assert.equal(r.status, 401); assert.equal(s.calls.length, 2); assert.equal(refreshes, 1)
  // 6. the refresh itself fails (signed out): the original answer comes back, nothing is retried, and for a while it is not tried again
  let t = 1000; s = server(() => expired()); refreshes = 0; f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return null }, () => t, 30_000)
  r = await f('https://api.x/rest/v1/users', init()); assert.equal(r.status, 401); assert.equal(s.calls.length, 1); assert.equal(refreshes, 1)
  await f('https://api.x/rest/v1/users', init()); assert.equal(refreshes, 1, 'cooling down: no second refresh within 30 s')
  t += 31_000; await f('https://api.x/rest/v1/users', init()); assert.equal(refreshes, 2, 'tried again after the cool-down')
  // a refresh that throws is the same as one that failed
  f = retryOnExpired(server(() => expired()).fetchFn as any, async () => { throw new Error('network') }); assert.equal((await f('https://api.x/a', init())).status, 401)
  // 7. several requests that find the token expired at once share ONE refresh
  s = server((n, auth) => (auth === 'Bearer NEW' ? ok() : expired())); refreshes = 0
  f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; await new Promise(res => setTimeout(res, 20)); return 'NEW' })
  const all = await Promise.all([1, 2, 3, 4, 5].map(i => f(`https://api.x/rest/v1/t${i}`, init()))); assert.ok(all.every(x => x.status === 200)); assert.equal(refreshes, 1)
  // 8. a request with no user token (the anonymous key) cannot be given one: its answer stands
  s = server(() => expired()); refreshes = 0; f = retryOnExpired(s.fetchFn as any, async () => { refreshes++; return 'NEW' })
  r = await f('https://api.x/rest/v1/public', { headers: { apikey: 'k' } }); assert.equal(r.status, 401); assert.equal(s.calls.length, 1)
  console.log('ok')
})()
