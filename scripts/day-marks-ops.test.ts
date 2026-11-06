import { opAdd, opUpdate, opRemove, opRestore, parseMarks } from '../src/lib/marks/dayMarksOps'
import { joinDayMarks, marksOnDay } from '../src/lib/marks/dayNotes'
import assert from 'node:assert'
const day = '2026-11-06'
// add: only the new entry is "touched"
let a: any = opAdd({}, { date: day, emoji: '🚩', text: 'Launch' }, 'a', '2026-11-06T10:00:00.000Z')
assert.ok(a.result.ok); assert.deepEqual(Object.keys(a.touched), ['a']); assert.equal(a.map.a.text, 'Launch')
// an invalid add touches nothing and leaves the map as it was
const bad: any = opAdd(a.map, { date: day, emoji: 'nope' }, 'b'); assert.equal(bad.result.ok, false); assert.deepEqual(bad.touched, {}); assert.equal(bad.map, a.map)
// an achievement is idempotent: the same fact again touches nothing
const src = { kind: 'task', id: 't1' }
const k1: any = opAdd(a.map, { date: day, emoji: '🏆', text: 'Finished: X', source: src }, 'k1', '2026-11-06T11:00:00.000Z'); assert.deepEqual(Object.keys(k1.touched), ['k1'])
const k2: any = opAdd(k1.map, { date: day, emoji: '🏆', text: 'Finished: X', source: src }, 'k2', '2026-11-06T11:00:05.000Z'); assert.deepEqual(k2.touched, {}); assert.equal(k2.result.mark.id, 'k1'); assert.equal(k2.map, k1.map)
// update: words and emoji change, created does not, `at` moves on; a bad edit changes nothing
const u: any = opUpdate(k1.map, 'a', { text: '  Launched  ' }, '2026-11-06T12:00:00.000Z')
assert.equal(u.map.a.text, 'Launched'); assert.equal(u.map.a.created, '2026-11-06T10:00:00.000Z'); assert.equal(u.map.a.at, '2026-11-06T12:00:00.000Z'); assert.deepEqual(Object.keys(u.touched), ['a'])
assert.equal(opUpdate(u.map, 'a', { emoji: 'abc' }).result.ok, false); assert.equal(opUpdate(u.map, 'missing', { text: 'x' }).result.ok, false)
// an achievement can be reworded and stays an achievement with its source
const re: any = opUpdate(k1.map, 'k1', { text: 'Shipped it' }); assert.equal(re.map.k1.kind, 'achievement'); assert.deepEqual(re.map.k1.source, src)
// remove is a tombstone (kept in the map, marked gone) and returns the mark for Undo; removing twice does nothing
const rm: any = opRemove(u.map, 'a', '2026-11-06T13:00:00.000Z'); assert.equal(rm.map.a.gone, true); assert.equal(rm.result.id, 'a'); assert.deepEqual(marksOnDay(rm.map, day).map((m: any) => m.id), ['k1'])
assert.equal(opRemove(rm.map, 'a').result, null)
// undo puts the same mark back, in its old place (order is `created`), with a later stamp than the removal
const back: any = opRestore(rm.map, rm.result, '2026-11-06T13:00:01.000Z'); assert.equal(back.map.a.gone, undefined); assert.ok(back.map.a.at > rm.map.a.at)
assert.deepEqual(marksOnDay(back.map, day).map((m: any) => m.id), ['a', 'k1'])
// THE POINT: the phone writes only what it touched, joined into what the server holds now.
// The web added a mark on another device after the phone last read.
const server: any = { ...a.map, w: { id: 'w', date: day, emoji: '🎉', text: 'From the web', kind: 'highlight', created: '2026-11-06T10:30:00.000Z', at: '2026-11-06T10:30:00.000Z' } }
const phone: any = opAdd(a.map, { date: day, emoji: '✅', text: 'From the phone' }, 'p', '2026-11-06T10:45:00.000Z')
const written = joinDayMarks(phone.touched, server, Date.parse('2026-11-06T11:00:00Z'))
assert.deepEqual(Object.keys(written).sort(), ['a', 'p', 'w'])                       // nothing lost
// control: writing the phone's whole local map over the server (what a plain overwrite does) loses the web's mark
assert.equal('w' in phone.map, false)
// and a removal on the phone beats the server's live copy of the same mark, in either order of arrival
const rmPhone: any = opRemove(a.map, 'a', '2026-11-06T14:00:00.000Z'); const j = joinDayMarks(rmPhone.touched, server, Date.parse('2026-11-06T15:00:00Z')); assert.equal(j.a.gone, true)
// a damaged stored value is an empty map, never a crash
assert.deepEqual(parseMarks('not json'), {}); assert.deepEqual(parseMarks('[1,2]'), {}); assert.deepEqual(parseMarks(null), {}); assert.deepEqual(parseMarks('{"x":{"id":"x"}}'), { x: { id: 'x' } })
console.log('ok')
