import { opAddNote, opUpdateNote, opRemoveNote, opRestoreNote, parseNotes, blankDraft, draftOf, stampsOf, hhmm } from '../src/lib/marks/periodNotesOps'
import { joinPeriodNotes, notesOnDay, segmentOnDay, validateNote, validStamp, nextDay, MAX_NOTE_LENGTH } from '../src/lib/marks/dayNotes'
import assert from 'node:assert'
const T = (n: number) => new Date(Date.parse('2026-11-06T10:00:00Z') + n * 1000).toISOString()
// --- making a note
let a: any = opAddNote({}, { start: '2026-11-06T10:00', end: '2026-11-06T12:00', text: '  Noisy, could not focus  ', tag: 'interrupted' }, 'a', T(0))
assert.ok(a.result.ok); assert.deepEqual(Object.keys(a.touched), ['a']); assert.equal(a.map.a.text, 'Noisy, could not focus')
for (const bad of [
  { start: '2026-11-06T12:00', end: '2026-11-06T10:00', text: 'x' }, { start: '2026-11-06T10:00', end: '2026-11-06T10:00', text: 'x' },   // end after start
  { start: '2026-11-06T10:00', end: '2026-11-06T11:00', text: '   ' }, { start: '2026-11-06T10:00', end: '2026-11-06T11:00', text: 'x'.repeat(MAX_NOTE_LENGTH + 1) },
  { start: '2026-02-30T10:00', end: '2026-03-01T11:00', text: 'x' }, { start: '2026-11-06T25:00', end: '2026-11-07T01:00', text: 'x' }, { start: '2026-11-06T10:00', end: '2026-11-06T11:00', text: 'x', tag: 'nope' as any },
]) { const r: any = opAddNote(a.map, bad, 'z'); assert.equal(r.result.ok, false); assert.deepEqual(r.touched, {}); assert.equal(r.map, a.map) }
assert.equal(validStamp('2026-11-06T10:00'), true); assert.equal(validStamp('2026-11-06 10:00'), false); assert.equal(nextDay('2026-12-31'), '2027-01-01')
// --- a note across midnight is cut at the day's edges; end is exclusive; a note ending at midnight is not on the next day
const night = a.map; const across: any = opAddNote(night, { start: '2026-11-06T22:00', end: '2026-11-07T02:00', text: 'Travelling' }, 'n', T(1))
let seg: any = segmentOnDay(across.map.n, '2026-11-06'); assert.equal(seg.startMin, 22 * 60); assert.equal(seg.endMin, 1440); assert.equal(seg.continuesAfter, true)
seg = segmentOnDay(across.map.n, '2026-11-07'); assert.equal(seg.startMin, 0); assert.equal(seg.endMin, 120); assert.equal(seg.continuesBefore, true)
const endsAtMidnight: any = opAddNote({}, { start: '2026-11-06T20:00', end: '2026-11-07T00:00', text: 'x' }, 'm', T(2)); assert.equal(segmentOnDay(endsAtMidnight.map.m, '2026-11-07'), null)
assert.deepEqual(notesOnDay(across.map, '2026-11-06').map(s => s.note.id), ['a', 'n'])      // earliest first
// --- update: the tag can be cleared with null, kept when absent; a bad edit changes nothing
let u: any = opUpdateNote(across.map, 'a', { text: 'Louder than usual' }, T(10)); assert.equal(u.map.a.text, 'Louder than usual'); assert.equal(u.map.a.tag, 'interrupted'); assert.equal(u.map.a.at, T(10))
u = opUpdateNote(u.map, 'a', { tag: null }, T(11)); assert.equal('tag' in u.map.a, false)
assert.equal(opUpdateNote(u.map, 'a', { end: '2026-11-06T09:00' }).result.ok, false); assert.equal(opUpdateNote(u.map, 'nope', { text: 'x' }).result.ok, false)
// --- remove is a tombstone; undo is the same note live again with a later stamp
const rm: any = opRemoveNote(u.map, 'a', T(20)); assert.equal(rm.map.a.gone, true); assert.equal(rm.result.id, 'a'); assert.deepEqual(notesOnDay(rm.map, '2026-11-06').map(s => s.note.id), ['n']); assert.equal(opRemoveNote(rm.map, 'a').result, null)
const back: any = opRestoreNote(rm.map, rm.result, T(21)); assert.equal(back.map.a.gone, undefined); assert.ok(back.map.a.at > rm.map.a.at)
// --- the join, as for marks: later wins, an exact tie goes to the removal, 90 days, nothing lost
const live: any = { a: { id: 'a', start: '2026-11-06T10:00', end: '2026-11-06T11:00', text: 'live', at: T(5) } }, gone: any = { a: { ...live.a, gone: true, at: T(5) } }
assert.equal(joinPeriodNotes(live, gone, 0).a.gone, true); assert.equal(joinPeriodNotes(gone, live, 0).a.gone, true)
const web = { w: { id: 'w', start: '2026-11-06T08:00', end: '2026-11-06T09:00', text: 'From the web', at: T(0) } }
const phone: any = opAddNote({}, { start: '2026-11-06T13:00', end: '2026-11-06T14:00', text: 'From the phone' }, 'p', T(9))
assert.deepEqual(Object.keys(joinPeriodNotes(phone.touched, web as any, Date.parse(T(100)))).sort(), ['p', 'w'])
assert.equal('w' in phone.map, false)      // control: the phone's whole local map would have lost the web's note
assert.deepEqual(parseNotes('nope'), {}); assert.deepEqual(parseNotes('[1]'), {}); assert.deepEqual(parseNotes(null), {})
// --- the form: a draft round-trips; all-day dims the times and ends at the next midnight (the last day is inclusive)
const d = blankDraft('2026-11-06', 14 * 60 + 15); assert.deepEqual(stampsOf(d), { start: '2026-11-06T14:15', end: '2026-11-06T15:15' })
for (const m of [0, 9 * 60, 23 * 60, 23 * 60 + 30, 23 * 60 + 50, 24 * 60, -5]) { const x = blankDraft('2026-11-06', m); assert.ok(stampsOf(x).end > stampsOf(x).start, 'start ' + m); assert.equal(validateNote({ ...stampsOf(x), text: 'ok' }), null) }   // any start gives a span that can be saved (the web's wraps to an end before the start after 23:45)
assert.equal(blankDraft('2026-11-06', 14 * 60).toTime, '15:00')
const allDay = { ...blankDraft('2026-12-30', 0), allDay: true, toDate: '2026-12-31' }; assert.deepEqual(stampsOf(allDay), { start: '2026-12-30T00:00', end: '2027-01-01T00:00' })
const stored: any = opAddNote({}, stampsOf(allDay) as any, 'ad', T(0)); assert.equal(opAddNote({}, { ...stampsOf(allDay), text: 'Away' }, 'ad', T(0)).result.ok, true)
const note = opAddNote({}, { ...stampsOf(allDay), text: 'Away' }, 'ad', T(0)).map.ad; const back2 = draftOf(note); assert.equal(back2.allDay, true); assert.equal(back2.toDate, '2026-12-31'); assert.deepEqual(stampsOf(back2), stampsOf(allDay))
assert.equal(hhmm(9 * 60 + 5), '09:05'); assert.equal(validateNote({ ...stampsOf(blankDraft('2026-11-06', 600)), text: 'ok' }), null)
console.log('ok')
