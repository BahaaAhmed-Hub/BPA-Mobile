import { HOUR, MINUTE, unionMs, sumMs, peakConcurrency, dayBounds, dayOf, splitByDay, statsByDay, addDays } from '../src/lib/time/taskTime.ts'
import { checkSession, endFor, timeInputs, MAX_SESSION_MS, sessionFromRow, rowFromSession } from '../src/lib/time/taskSessions.ts'
import { fromZone } from '../src/lib/time/slots.ts'
import assert from 'node:assert'
const tz='Africa/Cairo'
const at=(day:string,h:number,m=0)=>{ const [y,mo,d]=day.split('-').map(Number); return fromZone(y,mo,d,h,m,0,tz) }
// touching is not overlapping
const touching=[{start:at('2026-11-02',9),end:at('2026-11-02',10)},{start:at('2026-11-02',10),end:at('2026-11-02',11)}]
assert.equal(unionMs(touching),2*HOUR); assert.equal(peakConcurrency(touching),1)
// three tasks run together for two hours: time worked 2h, task-hours 6h
const three=[0,1,2].map(()=>({start:at('2026-11-02',9),end:at('2026-11-02',11)}))
assert.equal(unionMs(three),2*HOUR); assert.equal(sumMs(three),6*HOUR); assert.equal(peakConcurrency(three),3)
const st=statsByDay(three,[],tz,at('2026-11-03',0))['2026-11-02']; console.log(Object.keys(st).join(',')); 
// Cairo changeover days are 23 and 25 hours (clocks forward 2026-04-24, back 2026-10-29)
const len=(d:string)=>{const b=dayBounds(d,tz);return (b.end-b.start)/HOUR}
assert.equal(len('2026-04-24'),23); assert.equal(len('2026-10-29'),25); assert.equal(len('2026-11-02'),24)
// 366 consecutive days tile with no gap
let d='2026-01-01'; for(let i=0;i<365;i++){ const n=addDays(d,1); assert.equal(dayBounds(d,tz).end, dayBounds(n,tz).start, d); d=n }
// a session across midnight is cut, each side on its own day
const cut=splitByDay({start:at('2026-11-02',23),end:at('2026-11-03',1)},tz); assert.equal(cut.length,2); assert.equal(cut[0].day,'2026-11-02'); assert.equal(cut[0].end-cut[0].start,HOUR)
assert.equal(dayOf(at('2026-11-02',23,59),tz),'2026-11-02')
// session rules
const base={ id:'s', taskId:'t', start:1000000, end:null as number|null, source:'timer' as const }
assert.equal(checkSession(base),null)
assert.ok(checkSession({...base,source:'manual' as any}))               // only a timer runs
assert.ok(checkSession({...base,end:base.start}))                       // ends after it starts
assert.ok(checkSession({...base,end:base.start+MAX_SESSION_MS+1}))      // at most a day
assert.equal(checkSession({...base,end:base.start+MAX_SESSION_MS}),null)
assert.ok(checkSession({...base,source:'slot' as any,end:base.start+HOUR}))   // a slot needs its event
assert.ok(checkSession({...base,source:'backfill-estimate' as any,end:base.start+HOUR}))   // an estimate needs a day
// a timer left running is cut at a day and flagged; a stop under a second is lengthened to one
assert.deepEqual(endFor(base, base.start+3*MAX_SESSION_MS),{end:base.start+MAX_SESSION_MS,review:true})
assert.deepEqual(endFor(base, base.start+500),{end:base.start+1000,review:false})
// estimates are floating, never time on the clock
const est={ id:'e', taskId:'t', start:0, end:2*HOUR, source:'backfill-estimate' as const, day:'2026-10-01' }
const ti=timeInputs([est,{...base,end:base.start+HOUR}]); assert.equal(ti.floating.length,1); assert.equal(ti.running.length,1)
// the row mapping round-trips, and an emptied field clears
const row=rowFromSession({...base,end:base.start+HOUR,note:'x'},'u'); assert.equal(sessionFromRow(row as any).note,'x'); assert.equal(rowFromSession({...base},'u').event_id,null)
console.log('ok')
