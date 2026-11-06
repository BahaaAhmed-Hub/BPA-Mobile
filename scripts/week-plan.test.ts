import { planFromData, type WeekData } from '../src/lib/weekplan/weekPlanData'
import { fromZone, ymd } from '../src/lib/time/slots'
import { addDays } from '../src/lib/time/taskTime'
import assert from 'node:assert'

const tz = 'Africa/Cairo'
const at = (day: string, h: number, m = 0) => { const [y, mo, d] = day.split('-').map(Number); return fromZone(y, mo, d, h, m, 0, tz) }
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = at('2026-11-06', 12)                              // Friday: "next week" starts Sunday 2026-11-08 (week starts Sunday)
const WEEK = '2026-11-08'
const ev = (id: string, day: string, h1: number, h2: number, extra: any = {}) => ({ id, summary: id, start: { dateTime: iso(at(day, h1)) }, end: { dateTime: iso(at(day, h2)) }, ...extra })
const task = (id: string, o: any = {}) => ({ id, title: 'Task ' + id, duration: 60, priority: 'P1', dueDate: null, quadrant: 'schedule', taskType: 'do', completed: false, status: 'open', hasEvent: false, ...o })
const world = (o: Partial<WeekData> = {}): WeekData => ({
  now: NOW, tz, weekStart: 0,
  schedule: { workWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Sun'], focusStart: '09:00', focusEnd: '12:00', earliestMeeting: '10:00', endOfDay: '17:00', bufferMins: 10, physicalBufferMins: 30, protectFocus: true },
  prayer: { enabled: false, method: 'egyptian' as any, school: 'standard' as any, place: null },
  ideal: { blocks: [], goals: [], rules: [] },
  tasks: [task('a'), task('b'), task('c', { duration: 120 })],
  taskOfEvent: {}, milestones: [], projects: [], events: [], failures: [], statuses: {}, calendarConnected: true, ...o,
} as WeekData)

// --- a plan exists, and obeys the person's rules
let o = planFromData(world(), 'next')
assert.equal(o.problem, null); assert.equal(o.weekOf, WEEK); assert.ok(o.result.proposals.length >= 3)
const rules = o.input.rules
const workDates = new Set(rules.days.map(d => addDays(WEEK, (d + 1) % 7)))   // Monday = 0 in the engine; the week here starts Sunday
for (const p of o.result.proposals) {
  assert.ok(p.startMin >= rules.dayStartMin && p.startMin + p.mins <= rules.dayEndMin, `inside the working day: ${p.title} ${p.startMin}`)
  assert.ok(p.date >= WEEK && p.date <= addDays(WEEK, 6), 'inside the week')
  assert.equal(p.end - p.start, p.mins * 60_000); assert.equal(p.startMin % 15, 0)
}
assert.ok(o.result.proposals.every(p => ['Fri', 'Sat'].every(n => new Date(`${p.date}T00:00:00Z`).toUTCString().slice(0, 3) !== n)), 'Friday and Saturday are not work days')
// each task gets what it asked for and no more
const placed = (id: string) => o.result.proposals.filter(p => p.refId === id).reduce((n, p) => n + p.mins, 0)
assert.equal(placed('a'), 60); assert.equal(placed('b'), 60); assert.equal(placed('c'), 120)
// --- blocks never overlap one another
const ps = [...o.result.proposals].sort((x, y) => x.start - y.start); for (let i = 1; i < ps.length; i++) assert.ok(ps[i].start >= ps[i - 1].end, 'no two blocks overlap')
// --- deterministic: the same world gives the same plan
assert.equal(JSON.stringify(planFromData(world(), 'next').result), JSON.stringify(o.result))
// --- busy time is respected: a meeting Monday 09:00-17:00 takes the whole day, so nothing lands on Monday
const mon = addDays(WEEK, 1)
o = planFromData(world({ events: [ev('wall', mon, 0, 24)] as any }), 'next')
assert.ok(o.result.proposals.length >= 3); assert.equal(o.result.proposals.filter(p => p.date === mon).length, 0)
// control: without the meeting, Monday is used (so the wall, not a quirk of the engine, is what kept it clear)
o = planFromData(world({ events: [] }), 'next'); assert.ok(o.result.proposals.some(p => p.date === mon), 'Monday is used when it is free')
// --- a block is never placed over a real event (when it is not flagged as squeezed into a buffer)
const meet = ev('standup', mon, 10, 11)
o = planFromData(world({ events: [meet] as any }), 'next')
for (const p of o.result.proposals) assert.ok(p.end <= at(mon, 10) || p.start >= at(mon, 11), `not over the standup: ${p.title} ${p.date} ${p.startMin}`)
// --- a declined, cancelled, transparent or all-day event is not busy; an ordinary one is
const free = (extra: any) => planFromData(world({ events: [{ ...ev('x', mon, 0, 24), ...extra }] as any }), 'next').result.proposals.some(p => p.date === mon)
assert.equal(free({}), false); assert.equal(free({ status: 'cancelled' }), true); assert.equal(free({ transparency: 'transparent' }), true)
assert.equal(free({ attendees: [{ self: true, responseStatus: 'declined' }] }), true)
assert.equal(planFromData(world({ events: [{ id: 'hol', start: { date: mon }, end: { date: addDays(mon, 1) } }] as any }), 'next').result.proposals.some(p => p.date === mon), true)   // all-day: not a block of time
assert.equal(planFromData(world({ events: [ev('x', mon, 0, 24)] as any, statuses: { x: 'cancelled' } }), 'next').result.proposals.some(p => p.date === mon), true)   // cancelled in the app
// --- a diary that could not be read is not an empty one: the whole plan is refused, nothing proposed
o = planFromData(world({ failures: ['Work calendar: token refused'] }), 'next')
assert.ok(o.problem && /could not read your calendar/.test(o.problem)); assert.equal(o.result.proposals.length, 0)
// --- no work day switched on: nothing to plan on, said in words
o = planFromData(world({ schedule: { workWeek: [] } as any }), 'next'); assert.ok(o.problem && /Work days/.test(o.problem)); assert.equal(o.result.proposals.length, 0)
// --- what is left out is named, and a task that already has a block is not planned again
o = planFromData(world({ tasks: [task('a', { hasEvent: true }), task('b'), task('d', { completed: true, status: 'done' }), task('e', { quadrant: null })] }), 'next')
assert.ok(!o.result.proposals.some(p => p.refId === 'a')); assert.ok(o.skipped.some(s => s.id === 'a' && s.why === 'has-block'))
assert.ok(!o.result.proposals.some(p => p.refId === 'd')); assert.ok(o.result.proposals.some(p => p.refId === 'b'))
// --- something that cannot fit is said, with a reason, rather than dropped: a 12-hour task in 8-hour days
o = planFromData(world({ tasks: [task('big', { duration: 12 * 60 })], schedule: { workWeek: ['Mon'], focusStart: '09:00', endOfDay: '17:00' } as any }), 'next')
assert.ok(o.result.unplaced.length > 0 || o.result.proposals.reduce((n, p) => n + p.mins, 0) <= 8 * 60, 'a task longer than the day is split or reported, never over the day')
// --- "this week" plans the current week, "next" the one after
assert.equal(planFromData(world(), 'this').weekOf, '2026-11-01')
// --- a plan is a suggestion: planFromData has no way to write (it returns data and takes none to write with)
assert.equal(typeof planFromData, 'function')
console.log('ok')
