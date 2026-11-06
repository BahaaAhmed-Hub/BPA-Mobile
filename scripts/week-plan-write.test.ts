// The write path against a world that is able to refuse: Google can refuse a create or a delete, the task can be gone,
// finished or unreadable, the calendar list can fail, the task update can fail. Each case asserts what was NOT written.
import { addProposalWith, removeWrittenWith, chooseCalendar, slotsAfterAdd, slotsAfterRemove, taskEventTitle, taskEventDescription, type WriteDeps, type WritableTask, type WriteCalendar } from '../src/lib/weekplan/write'
import { fromZone } from '../src/lib/time/slots'
import assert from 'node:assert'

const tz = 'Africa/Cairo'
const at = (day: string, h: number, m = 0) => { const [y, mo, d] = day.split('-').map(Number); return fromZone(y, mo, d, h, m, 0, tz) }
const prop = (o: any = {}): any => ({ id: 'a#1', itemKey: 'a', kind: 'task', refId: 't1', title: 'Draft deck', load: 'light', date: '2026-11-09', startMin: 9 * 60, mins: 60, start: at('2026-11-09', 9), end: at('2026-11-09', 10), part: 1, of: 1, reason: 'x', ...o })
const primary: WriteCalendar = { id: 'me@x.com', primary: true, accessRole: 'owner', accountEmail: 'me@x.com' }
const work: WriteCalendar = { id: 'work@x.com', accessRole: 'writer', accountEmail: 'me@x.com' }
const ro: WriteCalendar = { id: 'holidays', accessRole: 'reader', accountEmail: 'me@x.com' }
const task = (o: Partial<WritableTask> = {}): WritableTask => ({ id: 't1', title: 'Draft deck', description: 'Pitch for the fund', priority: 'P1', due_date: '2026-11-12', completed: false, status: 'todo', ...o })

interface W { rows?: Record<string, WritableTask | null>; readErr?: string; cals?: WriteCalendar[]; calFail?: string; companies?: any[]; createErr?: string; createNoId?: boolean; deleteErr?: boolean; updateErr?: string; companiesFail?: boolean }
function world(w: W = {}) {
  const st = { rows: { t1: task(), ...(w.rows ?? {}) } as Record<string, WritableTask | null>, created: [] as any[], deleted: [] as any[], updates: [] as any[], reads: 0 }
  const deps: WriteDeps = {
    tz,
    readTask: async id => { st.reads++; return w.readErr ? { row: null, error: w.readErr } : { row: st.rows[id] ?? null, error: null } },
    companies: async () => (w.companiesFail ? null : (w.companies ?? [])),
    calendars: async () => ({ calendars: w.cals ?? [primary, work, ro], failed: w.calFail ?? null }),
    createEvent: async (cal, body) => { if (w.createErr) return { error: w.createErr }; if (w.createNoId) return { id: '' }; const id = `ev${st.created.length + 1}`; st.created.push({ cal: cal.id, body, id }); return { id } },
    deleteEvent: async (calId, acct, id) => { st.deleted.push({ calId, acct, id }); return w.deleteErr ? { error: 'refused' } : { ok: true } },
    updateTask: async (id, patch) => { if (w.updateErr) return { error: w.updateErr }; st.updates.push({ id, patch }); const r = st.rows[id]; if (r) st.rows[id] = { ...r, ...patch }; return { error: null } },
  }
  return { st, deps }
}

;(async () => {
  // --- pure: titles, notes, slots
  assert.equal(taskEventTitle('Draft deck'), '📋 Draft deck'); assert.equal(taskEventTitle('📋 Draft deck'), '📋 Draft deck'); assert.equal(taskEventTitle('  📋  x '), '📋  x'.trim())
  const d = taskEventDescription({ title: 'Draft deck', description: 'Pitch', priority: 'P1', due_date: '2026-11-12' }); assert.ok(d.startsWith('Pitch') && d.includes('Scheduled from a task in The Professor') && d.includes('Priority: P1') && d.includes('Due: 2026-11-12'))
  assert.ok(!taskEventDescription({ title: 'x' }).includes('Priority'))
  const a1 = slotsAfterAdd({}, 'e1', { date: '2026-11-09', time: '09:00', mins: 60 }); assert.deepEqual(a1.slots, [{ eventId: 'e1', n: 1, date: '2026-11-09', time: '09:00', mins: 60 }]); assert.equal(a1.gcal_event_id, 'e1')
  const a2 = slotsAfterAdd({ slots: a1.slots, gcal_event_id: 'e1' }, 'e2', { date: '2026-11-10', time: '10:00', mins: 30 }); assert.equal(a2.n, 2); assert.equal(a2.gcal_event_id, 'e1'); assert.equal(a2.slots.length, 2)
  assert.equal(slotsAfterAdd({ slots: a2.slots, gcal_event_id: 'e1' }, 'e2', { date: 'd', time: 't', mins: 1 }).slots.filter(s => s.eventId === 'e2').length, 1)   // the same event twice is one slot
  assert.equal(slotsAfterAdd({ gcal_event_id: 'old' }, 'e2', { date: 'd', time: 't', mins: 1 }).slots[0].eventId, 'old')       // an older task's single event is slot 1
  assert.deepEqual(slotsAfterRemove({ slots: a2.slots, gcal_event_id: 'e1' }, 'e1'), { slots: [a2.slots[1]], gcal_event_id: 'e2' })  // the first goes: the next is the mirror, keeps its number
  assert.deepEqual(slotsAfterRemove({ slots: a1.slots, gcal_event_id: 'e1' }, 'e1'), { slots: null, gcal_event_id: null })
  assert.deepEqual(slotsAfterRemove({ gcal_event_id: 'old' }, 'x'), { slots: null, gcal_event_id: 'old' })                       // an event the task never had changes nothing
  // --- which calendar
  assert.equal((chooseCalendar(task(), [], [primary, work]) as any).cal.id, 'me@x.com')
  assert.equal((chooseCalendar(task({ calendar_id: 'work@x.com' }), [], [primary, work]) as any).cal.id, 'work@x.com')
  assert.match((chooseCalendar(task({ calendar_id: 'holidays' }), [], [primary, ro]) as any).error, /not one I can write to/)        // read-only: never a quiet fall-back
  assert.match((chooseCalendar(task({ calendar_id: 'icloud:a:b' }), [], [primary]) as any).error, /not one I can write to/)
  const co = [{ id: 'c1', name: 'Teradix', calendar_id: 'work@x.com' }, { id: 'c2', name: 'Alraya', account_id: 'acc' }, { id: 'c3', name: 'Gone', calendar_id: 'nope@x.com' }]
  assert.equal((chooseCalendar(task({ company_id: 'c1' }), co, [primary, work]) as any).cal.id, 'work@x.com'); assert.equal((chooseCalendar(task({ company_tag: 'teradix' }), co, [primary, work]) as any).cal.id, 'work@x.com')
  assert.match((chooseCalendar(task({ company_id: 'c2' }), co, [primary, work]) as any).error, /linked to an account rather than a calendar/)
  assert.match((chooseCalendar(task({ company_id: 'c3' }), co, [primary, work]) as any).error, /Gone's calendar is not one I can write to/)
  assert.equal((chooseCalendar(task({ company_tag: 'personal' }), co, [primary, work]) as any).cal.id, 'me@x.com')
  assert.match((chooseCalendar(task(), [], [ro]) as any).error, /no calendar I can write to/)
  // --- adding a task block: the event, then the task; the deadline is never touched
  let w = world(); let r: any = await addProposalWith(w.deps, prop())
  assert.ok(r.ok); assert.equal(w.st.created.length, 1); const b = w.st.created[0].body
  assert.equal(b.summary, '📋 Draft deck'); assert.equal(b.start.dateTime, new Date(at('2026-11-09', 9)).toISOString()); assert.equal(b.start.timeZone, tz); assert.equal(b.end.dateTime, new Date(at('2026-11-09', 10)).toISOString()); assert.ok(!('attendees' in b) && !('conferenceData' in b), 'nobody is invited, no Meet')
  assert.deepEqual(w.st.updates[0].patch, { slots: [{ eventId: 'ev1', n: 1, date: '2026-11-09', time: '09:00', mins: 60 }], gcal_event_id: 'ev1' })
  assert.deepEqual(Object.keys(w.st.updates[0].patch).sort(), ['gcal_event_id', 'slots']); assert.equal(w.st.rows.t1!.due_date, '2026-11-12')            // the deadline is not the block
  // a second block for the same task is number 2, and the title says so
  r = await addProposalWith(w.deps, prop({ id: 'a#2', date: '2026-11-10', start: at('2026-11-10', 13), end: at('2026-11-10', 14), startMin: 13 * 60 }))
  assert.ok(r.ok); assert.equal(w.st.created[1].body.summary, '📋 Draft deck · 2'); assert.equal(w.st.rows.t1!.slots!.length, 2); assert.equal(w.st.rows.t1!.gcal_event_id, 'ev1')
  // --- refusals write nothing
  const none = (x: ReturnType<typeof world>) => { assert.equal(x.st.created.length, 0, 'no event'); assert.equal(x.st.updates.length, 0, 'no task update') }
  for (const [name, wd, re] of [
    ['task gone', { rows: { t1: null } }, /gone/], ['task finished', { rows: { t1: task({ completed: true }) } }, /finished/], ['task done', { rows: { t1: task({ status: 'done' }) } }, /finished/],
    ['task unreadable', { readErr: 'timeout' }, /could not be read/], ['calendar list failed', { calFail: 'the calendar list could not be read' }, /calendar list/],
    ['no writable calendar', { cals: [ro] }, /no calendar I can write to/], ['task on a read-only calendar', { rows: { t1: task({ calendar_id: 'holidays' }) } }, /not one I can write to/],
  ] as const) { const x = world(wd as any); const out: any = await addProposalWith(x.deps, prop()); assert.equal(out.ok, false, name); assert.match(out.error, re as RegExp, name); none(x) }
  assert.equal(((await addProposalWith(world().deps, prop({ start: NaN, end: NaN }))) as any).ok, false)
  assert.equal(((await addProposalWith(world().deps, prop({ end: at('2026-11-09', 9) }))) as any).ok, false)          // an end that is not after the start
  // Google refuses the create, or answers with no event: the task is not touched
  let x = world({ createErr: 'Google answered 403' }); r = await addProposalWith(x.deps, prop()); assert.equal(r.ok, false); assert.equal(x.st.updates.length, 0)
  x = world({ createNoId: true }); r = await addProposalWith(x.deps, prop()); assert.equal(r.ok, false); assert.match(r.error, /not with an event/); assert.equal(x.st.updates.length, 0)
  // --- the task cannot be updated: the event is removed again (control: it would otherwise be orphaned); if THAT fails, say so
  x = world({ updateErr: 'permission denied' }); r = await addProposalWith(x.deps, prop()); assert.equal(r.ok, false); assert.match(r.error, /removed again/); assert.deepEqual(x.st.deleted.map(d => d.id), ['ev1'])
  x = world({ updateErr: 'permission denied', deleteErr: true }); r = await addProposalWith(x.deps, prop()); assert.equal(r.ok, false); assert.match(r.error, /may be on your calendar/)
  // --- an activity has no task: a plain event on the main calendar, and no task is read or changed
  x = world(); r = await addProposalWith(x.deps, prop({ kind: 'activity', refId: undefined, title: 'Gym' })); assert.ok(r.ok); assert.equal(x.st.created[0].cal, 'me@x.com'); assert.equal(x.st.created[0].body.summary, 'Gym'); assert.equal(x.st.created[0].body.description, 'Planned with Plan week.'); assert.equal(x.st.updates.length, 0); assert.equal(x.st.reads, 0)
  // companies unreadable while the task names one: nothing is written (control: a task with no company never needs them)
  x = world({ companiesFail: true, rows: { t1: task({ company_id: 'c1' }) } }); r = await addProposalWith(x.deps, prop()); assert.equal(r.ok, false); assert.match(r.error, /companies could not be read/); assert.equal(x.st.created.length, 0)
  x = world({ companiesFail: true }); r = await addProposalWith(x.deps, prop()); assert.ok(r.ok)
  // --- the task's own calendar is where its block goes
  x = world({ rows: { t1: task({ calendar_id: 'work@x.com' }) } }); r = await addProposalWith(x.deps, prop()); assert.ok(r.ok); assert.equal(x.st.created[0].cal, 'work@x.com'); assert.equal(r.written.calendarId, 'work@x.com')
  // --- Undo: the event is deleted first, then the task forgets it
  x = world(); const added: any = await addProposalWith(x.deps, prop()); const added2: any = await addProposalWith(x.deps, prop({ id: 'a#2', date: '2026-11-10', start: at('2026-11-10', 13), end: at('2026-11-10', 14), startMin: 13 * 60 }))
  let u: any = await removeWrittenWith(x.deps, added.written); assert.ok(u.ok); assert.deepEqual(x.st.deleted.map(d => d.id), ['ev1']); assert.equal(x.st.rows.t1!.slots!.length, 1); assert.equal(x.st.rows.t1!.gcal_event_id, 'ev2')
  u = await removeWrittenWith(x.deps, added2.written); assert.ok(u.ok); assert.equal(x.st.rows.t1!.slots, null); assert.equal(x.st.rows.t1!.gcal_event_id, null)
  // Google refuses the delete: the block stays, and so does the task's record of it (control: the task is not updated)
  x = world(); const keep: any = await addProposalWith(x.deps, prop()); const before = x.st.updates.length; x.deps.deleteEvent = async () => ({ error: 'refused' })
  u = await removeWrittenWith(x.deps, keep.written); assert.equal(u.ok, false); assert.match(u.error, /still on your calendar/); assert.equal(x.st.updates.length, before); assert.equal(x.st.rows.t1!.slots!.length, 1)
  // the task is already gone: removing the event is the whole job
  x = world(); const gone: any = await addProposalWith(x.deps, prop()); x.st.rows.t1 = null; u = await removeWrittenWith(x.deps, gone.written); assert.ok(u.ok)
  // an activity's block is removed with no task involved
  x = world(); const act: any = await addProposalWith(x.deps, prop({ kind: 'activity', refId: undefined, title: 'Gym' })); u = await removeWrittenWith(x.deps, act.written); assert.ok(u.ok); assert.equal(x.st.updates.length, 0)
  console.log('ok')
})()
