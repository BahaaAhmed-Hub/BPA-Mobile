// The write path against a stub server that is able to refuse: it can fail a read, return no row, touch no rows, and let
// "another device" write between our read and our write. Each case also asserts what was NOT written.
import { updateSharedPrefWith } from '../src/lib/sharedPrefsUpdate'
import { joinDayMarks } from '../src/lib/marks/dayNotes'
import { opAdd, opRemove, parseMarks } from '../src/lib/marks/dayMarksOps'
import assert from 'node:assert'

function server(initial: any, opts: { failRead?: boolean; noRow?: boolean; touchNone?: boolean; failWrite?: boolean; raceOnce?: () => any } = {}) {
  const st = { row: initial as any, updates: 0, reads: 0, raced: false }
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => {
        st.reads++
        if (opts.failRead) return { data: null, error: { message: 'boom' } }
        if (opts.noRow) return { data: null, error: null }
        return { data: { schedule_rules: JSON.parse(JSON.stringify(st.row)) }, error: null }
      } }) }),
      update: (patch: any) => ({ eq: () => ({ select: async () => {
        st.updates++
        if (opts.failWrite) return { data: null, error: { message: 'denied' } }
        if (opts.touchNone) return { data: [], error: null }
        st.row = patch.schedule_rules
        // another device writes over ours right after: our read-back then does not hold our value
        if (opts.raceOnce && !st.raced) { st.raced = true; st.row = opts.raceOnce() }
        return { data: [{ id: 'u1' }], error: null }
      } }) }),
    }),
  }
  return { st, client }
}

const KEY = 'cal-day-marks'
const day = '2026-11-06'
const mk = (id: string, text: string, at: string) => ({ id, date: day, emoji: '⭐', text, kind: 'highlight', created: at, at })
const rules = (marks: any, extra: any = {}) => ({ timezone: 'Africa/Cairo', connected: [{ e: 'x' }], shared_prefs: { 'professor-ai-config': 'KEEP', [KEY]: JSON.stringify(marks), ...extra } })
const T = (n: number) => new Date(Date.parse('2026-11-06T10:00:00Z') + n * 1000).toISOString()

;(async () => {
  // 1. happy path: the web already has a mark; the phone adds one. Both end up on the server, and nothing else is touched.
  const web = { w: mk('w', 'From the web', T(0)) }
  const phone: any = opAdd({}, { date: day, emoji: '✅', text: 'From the phone' }, 'p', T(10))
  let s = server(rules(web))
  let r = await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(phone.touched, parseMarks(cur))))
  assert.ok(r.ok); assert.equal(s.st.updates, 1)
  assert.deepEqual(Object.keys(parseMarks(s.st.row.shared_prefs[KEY])).sort(), ['p', 'w'])        // nothing lost
  assert.equal(s.st.row.shared_prefs['professor-ai-config'], 'KEEP'); assert.equal(s.st.row.timezone, 'Africa/Cairo'); assert.deepEqual(s.st.row.connected, [{ e: 'x' }])   // nothing else touched
  // 2. the key does not exist yet (a first mark ever): created from nothing, still nothing else touched
  s = server({ timezone: 'Africa/Cairo', shared_prefs: { 'professor-ai-config': 'KEEP' } })
  r = await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(phone.touched, parseMarks(cur))))
  assert.ok(r.ok); assert.deepEqual(Object.keys(parseMarks(s.st.row.shared_prefs[KEY])), ['p']); assert.equal(s.st.row.shared_prefs['professor-ai-config'], 'KEEP')
  // 3. no shared_prefs object at all
  s = server({ timezone: 'Africa/Cairo' }); r = await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(phone.touched, parseMarks(cur)))); assert.ok(r.ok); assert.equal(s.st.row.timezone, 'Africa/Cairo')
  // 4. a failed read writes NOTHING (a blind write is the destructive one)
  s = server(rules(web), { failRead: true }); r = await updateSharedPrefWith(s.client, KEY, () => '{"x":1}'); assert.equal(r.ok, false); assert.equal(s.st.updates, 0)
  // 5. no row: writes nothing
  s = server(rules(web), { noRow: true }); r = await updateSharedPrefWith(s.client, KEY, () => '{"x":1}'); assert.equal(r.ok, false); assert.equal(s.st.updates, 0)
  // 6. the server refuses the write: reported, and the stored value is unchanged
  s = server(rules(web), { failWrite: true }); r = await updateSharedPrefWith(s.client, KEY, () => '{"x":1}'); assert.equal(r.ok, false); assert.equal(s.st.row.shared_prefs[KEY], JSON.stringify(web))
  // 7. an update that matched no row is not a save
  s = server(rules(web), { touchNone: true }); r = await updateSharedPrefWith(s.client, KEY, () => '{"x":1}'); assert.equal(r.ok, false)
  // 8. nothing to change: nothing written
  s = server(rules(web)); r = await updateSharedPrefWith(s.client, KEY, cur => cur as string); assert.ok(r.ok); assert.equal(s.st.updates, 0)
  // 9. another device writes over ours between write and read-back: we go round again from a fresh read and join into THEIR copy.
  const theirs = { w: mk('w', 'From the web', T(0)), z: mk('z', 'Made on a third device', T(5)) }
  s = server(rules(web), { raceOnce: () => rules(theirs) })
  r = await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(phone.touched, parseMarks(cur))))
  assert.ok(r.ok); assert.equal(s.st.updates, 2)                                                   // wrote, was overwritten, wrote again
  assert.deepEqual(Object.keys(parseMarks(s.st.row.shared_prefs[KEY])).sort(), ['p', 'w', 'z'])      // the third device's mark survived
  // control: a plain overwrite with the phone's local map would have lost both web marks
  const overwrite = { p: phone.touched.p }; assert.equal('w' in overwrite, false)
  // 10. a removal on the phone beats the server's live copy, and a later edit made on the web (after our removal) beats the removal
  const rm: any = opRemove({ w: web.w }, 'w', T(20))
  s = server(rules(web)); await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(rm.touched, parseMarks(cur))))
  assert.equal(parseMarks(s.st.row.shared_prefs[KEY]).w.gone, true)
  const editedLater = { w: { ...web.w, text: 'edited later on the web', at: T(60) } }
  s = server(rules(editedLater)); await updateSharedPrefWith(s.client, KEY, cur => JSON.stringify(joinDayMarks(rm.touched, parseMarks(cur))))
  assert.equal(parseMarks(s.st.row.shared_prefs[KEY]).w.gone, undefined); assert.equal(parseMarks(s.st.row.shared_prefs[KEY]).w.text, 'edited later on the web')
  // 11. signed out: nothing read or written
  s = server(rules(web)); (s.client.auth as any).getSession = async () => ({ data: { session: null } })
  r = await updateSharedPrefWith(s.client, KEY, () => 'x'); assert.equal(r.ok, false); assert.equal(s.st.reads, 0); assert.equal(s.st.updates, 0)
  console.log('ok')
})()
