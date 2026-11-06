import { todayNumbers, lastDays, taskTime, sittingsOf } from '../src/lib/time/summary'
import { fromZone } from '../src/lib/time/slots'
import { HOUR } from '../src/lib/time/taskTime'
import assert from 'node:assert'
const tz = 'Africa/Cairo'
const at = (d: string, h: number, m = 0) => { const [y, mo, dd] = d.split('-').map(Number); return fromZone(y, mo, dd, h, m, 0, tz) }
const S = (id: string, taskId: string, start: number, end: number | null, extra: any = {}) => ({ id, taskId, start, end, source: end === null ? 'timer' : 'manual', ...extra } as any)
const now = at('2026-11-06', 18)
// three tasks at once for two hours this morning: 2 h worked, 6 task-hours, gain 4 h
const three = ['a', 'b', 'c'].map((t, i) => S('s' + i, t, at('2026-11-06', 9), at('2026-11-06', 11)))
let n = todayNumbers(three, tz, now); assert.equal(n.worked, 2 * HOUR); assert.equal(n.taskHours, 6 * HOUR); assert.equal(n.gain, 4 * HOUR); assert.equal(n.running, 0)
// yesterday does not count towards today
assert.equal(todayNumbers([S('y', 'a', at('2026-11-05', 9), at('2026-11-05', 11))], tz, now).worked, 0)
// a running timer counts up to now, and is counted as running
n = todayNumbers([S('r', 'a', at('2026-11-06', 17), null)], tz, now); assert.equal(n.worked, HOUR); assert.equal(n.running, 1)
// a sitting across midnight is cut: only the part after midnight is today's
n = todayNumbers([S('m', 'a', at('2026-11-05', 23), at('2026-11-06', 1))], tz, now); assert.equal(n.worked, HOUR)
// an estimate for finished work is task-hours but never time worked
n = todayNumbers([S('e', 'a', 0, 2 * HOUR, { source: 'backfill-estimate', day: '2026-11-06' })], tz, now); assert.equal(n.worked, 0); assert.equal(n.taskHours, 2 * HOUR)
// nothing at all
n = todayNumbers([], tz, now); assert.deepEqual(n, { worked: 0, taskHours: 0, gain: 0, running: 0 })
// a week's headline adds days; the day outside the window is left out
const week = [S('d1', 'a', at('2026-11-06', 9), at('2026-11-06', 10)), S('d2', 'a', at('2026-11-02', 9), at('2026-11-02', 12)), S('old', 'a', at('2026-10-20', 9), at('2026-10-20', 12))]
assert.equal(lastDays(week, tz, now, 7).worked, 4 * HOUR)
// a task's time: stopped sittings added, the running timer left out, the assumed part named, another task's time not counted
const mine = [S('1', 't', at('2026-11-06', 9), at('2026-11-06', 10)), S('2', 't', at('2026-11-06', 17), null), S('3', 'x', at('2026-11-06', 9), at('2026-11-06', 12)), S('4', 't', 0, HOUR, { source: 'backfill-estimate', day: '2026-10-01' })]
assert.deepEqual(taskTime(mine, 't'), { totalMs: 2 * HOUR, assumedMs: HOUR, sittings: 2 })
assert.deepEqual(taskTime(mine, 'nope'), { totalMs: 0, assumedMs: 0, sittings: 0 })
// overlapping sittings on one task are added, as the web's card adds them
assert.equal(taskTime([S('p', 't', at('2026-11-06', 9), at('2026-11-06', 11)), S('q', 't', at('2026-11-06', 10), at('2026-11-06', 12))], 't').totalMs, 4 * HOUR)
assert.deepEqual(sittingsOf(mine, 't', 2).map(s => s.id), ['2', '1'])
console.log('ok')
