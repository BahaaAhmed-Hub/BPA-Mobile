import { addMarkTo, joinDayMarks, marksOnDay, marksInRange, findBySource, validateMark, isOneEmoji, firstEmoji, MAX_MARKS_PER_DAY, DEFAULT_EMOJI, TOMBSTONE_DAYS } from '../src/lib/marks/dayNotes'
import { dayCandidates, runEndingOn, isMilestone, sourceKey } from '../src/lib/marks/dayCandidates'
import { monotonicNow } from '../src/lib/marks/stamp'
import assert from 'node:assert'
const iso = (ms: number) => new Date(ms).toISOString()
const T0 = Date.parse('2026-11-06T10:00:00Z')
// --- making a mark
const m: any = {}
let r: any = addMarkTo(m, { date: '2026-11-06', emoji: '🚩' }, 'a', iso(T0)); assert.ok(r.ok); assert.equal(r.mark.kind, 'highlight'); assert.equal(m.a.text, '')   // a flag: no words
r = addMarkTo(m, { date: '2026-11-06' }, 'b', iso(T0 + 1)); assert.equal(m.b.emoji, DEFAULT_EMOJI)
assert.equal(addMarkTo(m, { date: '2026-11-06', emoji: 'abc' }, 'x', iso(T0)).ok, false)                  // one emoji, never a word
assert.equal(addMarkTo(m, { date: '2026-02-30', emoji: '🚩' }, 'x', iso(T0)).ok, false)                    // a real day
assert.equal(addMarkTo(m, { date: '2026-11-06', emoji: '🚩', text: 'x'.repeat(141) }, 'x', iso(T0)).ok, false)
assert.equal(validateMark({ date: '2026-11-06', emoji: '🚩', text: 'x'.repeat(140) }), null)
// --- one emoji: a ZWJ family, a flag, a keycap and a skin tone each count as one; two do not
for (const e of ['🚩', '👨‍👩‍👧', '🇪🇬', '1️⃣', '👍🏽']) assert.equal(isOneEmoji(e), true, e)
for (const e of ['a', '🚩🚩', '', 'hi 🚩']) assert.equal(isOneEmoji(e), false, e)
assert.equal(firstEmoji('hello 🇪🇬 there'), '🇪🇬'); assert.equal(firstEmoji('🚩🎉'), '🚩'); assert.equal(firstEmoji('abc'), null)
// --- an achievement carries its source, and is idempotent
const am: any = {}
const a1: any = addMarkTo(am, { date: '2026-11-06', emoji: '🏆', text: 'Finished: X', source: { kind: 'task', id: 't1' } }, 'k1', iso(T0))
const a2: any = addMarkTo(am, { date: '2026-11-06', emoji: '🏆', text: 'Finished: X', source: { kind: 'task', id: 't1' } }, 'k2', iso(T0 + 5))
assert.equal(a1.mark.kind, 'achievement'); assert.equal(a2.mark.id, 'k1'); assert.equal(Object.keys(am).length, 1)
assert.ok(findBySource(am, '2026-11-06', { kind: 'task', id: 't1' })); assert.equal(findBySource(am, '2026-11-07', { kind: 'task', id: 't1' }), undefined)
// --- 50 a day
const full: any = {}; for (let i = 0; i < MAX_MARKS_PER_DAY; i++) assert.ok(addMarkTo(full, { date: '2026-11-06', emoji: '⭐' }, 'f' + i, iso(T0 + i)).ok)
assert.equal(addMarkTo(full, { date: '2026-11-06', emoji: '⭐' }, 'over', iso(T0 + 99)).ok, false)
// --- order is `created`, not `at`: an edit does not reshuffle the day
const o: any = {}; addMarkTo(o, { date: '2026-11-06', emoji: '⭐' }, 'first', iso(T0)); addMarkTo(o, { date: '2026-11-06', emoji: '🎉' }, 'second', iso(T0 + 10))
o.first = { ...o.first, at: iso(T0 + 1000) }
assert.deepEqual(marksOnDay(o, '2026-11-06').map(x => x.id), ['first', 'second'])
assert.equal(marksInRange(o, '2026-11-01', '2026-11-30').get('2026-11-06')!.length, 2)
// --- the join across devices: later `at` wins per entry
const dev1: any = { m: { id: 'm', date: '2026-11-06', emoji: '⭐', text: 'old', kind: 'highlight', created: iso(T0), at: iso(T0) } }
const dev2: any = { m: { ...dev1.m, text: 'new', at: iso(T0 + 5000) } }
assert.equal(joinDayMarks(dev1, dev2, T0).m.text, 'new'); assert.equal(joinDayMarks(dev2, dev1, T0).m.text, 'new')   // either order
// a removal is a tombstone; a later edit beats it, an earlier one does not
const gone: any = { m: { ...dev1.m, gone: true, at: iso(T0 + 9000) } }
assert.equal(joinDayMarks(dev2, gone, T0).m.gone, true)
assert.equal(joinDayMarks({ m: { ...dev1.m, text: 'later', at: iso(T0 + 20000) } }, gone, T0).m.gone, undefined)
// an exact tie: the removal wins, in both orders (a deleted mark must never return)
const tieLive: any = { m: { ...dev1.m, at: iso(T0 + 7000) } }, tieGone: any = { m: { ...dev1.m, gone: true, at: iso(T0 + 7000) } }
assert.equal(joinDayMarks(tieLive, tieGone, T0).m.gone, true); assert.equal(joinDayMarks(tieGone, tieLive, T0).m.gone, true)
// entries only one side has are kept; tombstones go only after 90 days
const both = joinDayMarks({ a: dev1.m }, { b: { ...dev1.m, id: 'b' } }, T0); assert.deepEqual(Object.keys(both).sort(), ['a', 'b'])
const old: any = { z: { ...dev1.m, id: 'z', gone: true, at: iso(T0 - 91 * 86_400_000) } }, fresh: any = { y: { ...dev1.m, id: 'y', gone: true, at: iso(T0 - 89 * 86_400_000) } }
assert.equal('z' in joinDayMarks(old, {}, T0), false); assert.equal('y' in joinDayMarks(fresh, {}, T0), true); assert.equal(TOMBSTONE_DAYS, 90)
// --- one clock per device: a burst is strictly ordered, and a removal after it is later than the mark it removes
const stamps = Array.from({ length: 50 }, () => monotonicNow()); for (let i = 1; i < stamps.length; i++) assert.ok(stamps[i] > stamps[i - 1])
// --- candidates
const day = '2026-11-06'
const facts = (o: any) => ({ date: day, tasks: [], habits: [], books: [], ...o })
const t = (id: string, priority: string | null, completedAt: string | null = day) => ({ id, title: 'T' + id, completedAt, priority })
let c = dayCandidates(facts({ tasks: [t('1', 'P0'), t('2', 'P1'), t('3', 'P2'), t('4', 'P0', '2026-11-05'), t('5', 'P0', null)] }))
assert.deepEqual(c.map(x => x.source.id), ['1', '2'])                       // P0 then P1; a P2, another day and an unfinished one are not offered
assert.equal(dayCandidates(facts({ tasks: [1, 2, 3, 4].map(i => t('c' + i, 'P2')) })).length, 0)           // four quiet tasks: nothing
assert.deepEqual(dayCandidates(facts({ tasks: [1, 2, 3, 4, 5].map(i => t('c' + i, 'P2')) })).map(x => x.text), ['Cleared 5 tasks'])
assert.equal(runEndingOn(['2026-11-04', '2026-11-05', '2026-11-06'], day), 3); assert.equal(runEndingOn(['2026-11-05'], day), 0)
const week = ['01', '02', '03', '04', '05', '06'].map(d => `2026-11-${d}`); const seven = ['2026-10-31', ...week]
assert.deepEqual(dayCandidates(facts({ habits: [{ id: 'h', name: 'Read', doneOn: seven }] })).map(x => x.source.id), ['h:7'])
assert.equal(dayCandidates(facts({ habits: [{ id: 'h', name: 'Read', doneOn: ['2026-10-30', ...seven] }] })).length, 0)   // 8 days: not a milestone
assert.equal(dayCandidates(facts({ habits: [{ id: 'h', name: 'Read', frequency: 'weekly', doneOn: seven }] })).length, 0) // weekly has gaps by design
assert.equal(dayCandidates(facts({ habits: [{ id: 'h', name: 'Read', active: false, doneOn: seven }] })).length, 0)
assert.deepEqual(dayCandidates(facts({ habits: [{ id: 'a', name: 'A', doneOn: [day] }, { id: 'b', name: 'B', doneOn: [day] }] })).map(x => x.emoji), ['🌟'])
assert.equal(dayCandidates(facts({ habits: [{ id: 'a', name: 'A', doneOn: [day] }] })).length, 0)        // one habit is not "every habit"
assert.deepEqual(dayCandidates(facts({ books: [{ id: 'b', title: 'Deep Work', finishedOn: day }, { id: 'c', title: 'Old', finishedOn: '2026-11-01' }] })).map(x => x.source.id), ['b'])
// a fact already kept or set aside is not offered again
assert.equal(dayCandidates(facts({ tasks: [t('1', 'P0')] }), new Set([sourceKey({ kind: 'task', id: '1' })])).length, 0)
assert.equal(isMilestone(100), true); assert.equal(isMilestone(8), false); assert.equal(isMilestone(500), true); assert.equal(isMilestone(450), false)
console.log('ok')
