import { gatherWeekData, planWeekFor, parseStatuses, type Deps } from '../src/lib/weekplan/gather'
import { taskLikeOfRow, slotsOfRow, quadrantOf, isMine } from '../src/lib/weekplan/rows'
import { planFromData } from '../src/lib/weekplan/weekPlanData'
import { fromZone } from '../src/lib/time/slots'
import { addDays } from '../src/lib/time/taskTime'
import assert from 'node:assert'

const tz = 'Africa/Cairo'
const at = (day: string, h: number) => { const [y, m, d] = day.split('-').map(Number); return fromZone(y, m, d, h, 0, 0, tz) }
const NOW = at('2026-11-06', 12), WEEK = '2026-11-08', MON = addDays(WEEK, 1)
const row = (id: string, o: any = {}) => ({ id, title: 'Task ' + id, quadrant: 'important_not_urgent', status: 'todo', completed: false, effort_minutes: 60, priority: 'P1', task_type: 'do', ...o })
const iso = (ms: number) => new Date(ms).toISOString()
const wall = (calendarId: string, extra: any = {}) => ({ id: 'ev-' + calendarId, summary: 'All day meeting', calendarId, accountEmail: 'me@x.com', start: { dateTime: iso(at(MON, 0)) }, end: { dateTime: iso(at(MON, 23) + 3_540_000) }, ...extra })

interface World { tasks?: any[]; calls?: { tasks: number; cols: string[] }; failTasks?: string; failColumns?: RegExp[]; shared?: Record<string, string>; scheduleRules?: any; calendars?: any[]; calFail?: string | null; events?: any[]; evFail?: string[]; signedOut?: boolean }
function deps(w: World = {}): Deps & { calls: { tasks: number; cols: string[] } } {
  const calls = { tasks: 0, cols: [] as string[] }
  return {
    calls,
    deviceZone: () => tz,
    user: async () => w.signedOut ? null : { id: 'u1', scheduleRules: { timezone: 'America/New_York', work_week: ['Mon', 'Tue', 'Wed', 'Thu', 'Sun'], shared_prefs: w.shared ?? {}, ...(w.scheduleRules ?? {}) } },
    rows: async (table, cols) => {
      if (table === 'tasks') {
        calls.tasks++; calls.cols.push(cols)
        if (w.failTasks) return { data: null, error: w.failTasks }
        const missing = (w.failColumns ?? []).find(re => re.test(cols))
        if (missing) return { data: null, error: `column tasks.${missing.source.replace(/\\b/g, '')} does not exist` }
        return { data: w.tasks ?? [row('a'), row('b')], error: null }
      }
      return { data: [], error: null }
    },
    calendars: async () => ({ calendars: w.calendars ?? [{ id: 'me@x.com', primary: true, accessRole: 'owner', accountEmail: 'me@x.com' }], failed: w.calFail ?? null }),
    events: async () => ({ events: w.events ?? [], failed: w.evFail ?? [] }),
  }
}
const plan = async (w: World) => { const r: any = await planWeekFor(deps(w), 'next', { now: NOW }); return r }

;(async () => {
  // --- rows → the engine's tasks
  assert.equal(quadrantOf('urgent_important'), 'do'); assert.equal(quadrantOf('important_not_urgent'), 'schedule'); assert.equal(quadrantOf('dump'), null); assert.equal(quadrantOf(null), null)
  let t: any = taskLikeOfRow(row('x', { status: 'deferred', effort_minutes: null, task_type: null, description: 'deepwork', due_date: '2026-11-10', load: 'focus', project_id: 'p1' }))
  assert.equal(t.status, 'cancelled'); assert.equal(t.duration, undefined); assert.equal(t.taskType, 'deepwork'); assert.equal(t.dueDate, '2026-11-10'); assert.equal(t.load, 'focus'); assert.equal(t.projectId, 'p1')
  assert.equal(taskLikeOfRow(row('y', { status: 'weird' })).status, 'open'); assert.equal(taskLikeOfRow(row('y', { completed: null, completed_at: '2026-11-01T00:00:00Z' })).completed, true)
  assert.equal(taskLikeOfRow(row('y', { completed: false, completed_at: '2026-11-01T00:00:00Z' })).completed, false)
  assert.equal(taskLikeOfRow(row('y')).hasEvent, false); assert.equal(taskLikeOfRow(row('y', { gcal_event_id: 'g1' })).hasEvent, true); assert.equal(taskLikeOfRow(row('y', { slots: [{ eventId: 's1', n: 1 }] })).hasEvent, true)
  assert.deepEqual(slotsOfRow({ slots: [{ eventId: 'b', n: 2 }, { eventId: 'a', n: 1 }], gcal_event_id: 'z' }).map(s => s.eventId), ['a', 'b']); assert.deepEqual(slotsOfRow({ gcal_event_id: 'g' }), [{ eventId: 'g', n: 1 }])
  // --- which calendars are mine
  const mine = new Set(['me@x.com'])
  assert.equal(isMine({ id: 'whatever', primary: true }, mine), true); assert.equal(isMine({ id: 'me@x.com' }, mine), true); assert.equal(isMine({ id: 'boss@x.com' }, mine), false)
  assert.equal(isMine({ id: 'en.egyptian#holiday@group.v.calendar.google.com', accessRole: 'reader' }, mine), false); assert.equal(isMine({ id: 'abc@group.calendar.google.com', accessRole: 'owner' }, mine), true)
  // --- a plan from the phone's world; planned on the DEVICE zone, not the profile's New York
  let o = await plan({}); assert.equal(o.problem, null); assert.equal(o.tz, tz); assert.ok(o.result.proposals.length >= 2); assert.equal(o.weekOf, WEEK)
  // --- tasks: the optional columns an older project lacks are dropped one at a time, and the plan still happens
  const d = deps({ failColumns: [/\bslots\b/, /\bload\b/] }); const got: any = await planWeekFor(d, 'next', { now: NOW })
  assert.equal(got.problem, null); assert.equal(d.calls.tasks, 3); assert.ok(!/slots/.test(d.calls.cols[2]) && !/load/.test(d.calls.cols[2]))
  // a read that fails for another reason is said, not planned around
  const bad: any = await planWeekFor(deps({ failTasks: 'connection reset' }), 'next', { now: NOW }); assert.ok(bad.say && /Could not read the tasks/.test(bad.say))
  // signed out
  assert.ok(((await planWeekFor(deps({ signedOut: true }), 'next', { now: NOW })) as any).say)
  // --- a diary that could not be read is not an empty one
  for (const [name, w] of [['calendar list failed', { calFail: 'list_calendars failed' }], ['events failed', { evFail: ['Work: token refused'] }]] as const) {
    o = await plan(w as any); assert.ok(o.problem && /could not read your calendar/.test(o.problem), name); assert.equal(o.result.proposals.length, 0, name)
  }
  // --- other people's calendars are not my busy time; my own are. (Control: the same event on my primary calendar blocks Monday.)
  const cals = [{ id: 'me@x.com', primary: true, accessRole: 'owner', accountEmail: 'me@x.com' }, { id: 'holidays@group.v.calendar.google.com', accessRole: 'reader', accountEmail: 'me@x.com' }]
  o = await plan({ calendars: cals, events: [wall('holidays@group.v.calendar.google.com')] }); assert.ok(o.result.proposals.some((p: any) => p.date === MON), 'a subscribed calendar does not block Monday')
  o = await plan({ calendars: cals, events: [wall('me@x.com')] }); assert.equal(o.result.proposals.some((p: any) => p.date === MON), false, 'my own calendar does')
  // an event whose calendar we cannot place counts (an unknown calendar is not free time)
  o = await plan({ calendars: cals, events: [wall('mystery-calendar')] }); assert.equal(o.result.proposals.some((p: any) => p.date === MON), false)
  // --- the app's own "cancelled" marks (a shared pref) free the time again
  o = await plan({ calendars: cals, events: [wall('me@x.com')], shared: { 'cal-event-statuses': JSON.stringify({ 'ev-me@x.com': 'cancelled' }) } }); assert.ok(o.result.proposals.some((p: any) => p.date === MON))
  assert.deepEqual(parseStatuses('nope'), {}); assert.deepEqual(parseStatuses('[1]'), {}); assert.deepEqual(parseStatuses(JSON.stringify({ a: 'cancelled', b: 3 })), { a: 'cancelled' })
  // --- the week start comes from the shared pref; no calendar connected at all is said in the notes
  o = await plan({ shared: { 'professor-week-start': '1' } }); assert.equal(o.weekOf, '2026-11-09')
  o = await plan({ calendars: [] }); assert.ok(o.notes.some((n: string) => /No Google calendar is connected/.test(n)))
  // --- a task that already has a block (a slot) is not planned again, and its event is known to be that task's
  const g: any = await gatherWeekData(deps({ tasks: [row('a', { slots: [{ eventId: 'e1', n: 1 }] }), row('b')] }), 'next', NOW)
  assert.equal(g.data.tasks.find((x: any) => x.id === 'a').hasEvent, true); assert.equal(g.data.taskOfEvent.e1.title, 'Task a')
  const out = planFromData(g.data, 'next'); assert.ok(!out.result.proposals.some((p: any) => p.refId === 'a')); assert.ok(out.skipped.some((s: any) => s.id === 'a' && s.why === 'has-block'))
  console.log('ok')
})()
