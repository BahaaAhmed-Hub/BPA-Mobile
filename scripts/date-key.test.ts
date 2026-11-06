import { dateKey } from '../src/lib/marks/dateKey'
import assert from 'node:assert'
// A column is drawn for a LOCAL midnight. In a zone ahead of UTC its UTC date is the day before (the control: the old way),
// in a zone behind UTC it is the same day; dateKey is right in both.
const monday = new Date(2026, 10, 2)                       // local midnight, Monday 2 November
assert.equal(dateKey(monday), '2026-11-02')
assert.equal(dateKey(new Date(2026, 10, 2, 23, 59, 59)), '2026-11-02'); assert.equal(dateKey(new Date(2026, 11, 31)), '2026-12-31'); assert.equal(dateKey(new Date(2027, 0, 1)), '2027-01-01')
assert.equal(dateKey(new Date(2026, 1, 28, 12)), '2026-02-28'); assert.equal(dateKey(new Date(2028, 1, 29)), '2028-02-29')
const old = monday.toISOString().slice(0, 10)              // what the Calendar screen's isoDate does
const offsetMin = -monday.getTimezoneOffset()
if (offsetMin > 0) assert.equal(old, '2026-11-01', 'control: ahead of UTC, the old way is the day before')
else assert.equal(old, '2026-11-02')
// walking a week day by day never repeats or skips a key, across a clock change (Cairo goes back on 2026-10-29, Auckland forward in September)
let d = new Date(2026, 9, 25); const seen = new Set<string>()
for (let i = 0; i < 20; i++) { const k = dateKey(d); assert.ok(!seen.has(k), 'repeat ' + k); seen.add(k); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) }
assert.equal(seen.size, 20)
console.log(`ok (offset ${offsetMin} min; old way gives ${old} for local Monday 2026-11-02)`)
