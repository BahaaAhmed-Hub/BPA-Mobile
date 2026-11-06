import { clock, span, runningTimers, elapsedMs, DISCARD_UNDER_MS, FORGOTTEN_AFTER_MS } from '../src/lib/time/timer.ts'
import assert from 'node:assert'
assert.equal(clock(0),'0:00'); assert.equal(clock(65_000),'1:05'); assert.equal(clock(3_909_000),'1:05:09'); assert.equal(clock(-5),'0:00')
assert.equal(span(10_000),'1 min'); assert.equal(span(25*60_000),'25 min'); assert.equal(span(65*60_000),'1 h 5 min'); assert.equal(span(120*60_000),'2 h')
const s=(id:string,start:number,end:number|null,source='timer')=>({id,taskId:'t'+id,start,end,source} as any)
assert.deepEqual(runningTimers([s('a',5,null),s('b',1,null),s('c',2,9),s('d',3,null,'manual')]).map(x=>x.id),['b','a'])
assert.equal(elapsedMs({start:100},50),0); assert.equal(DISCARD_UNDER_MS,30000); assert.equal(FORGOTTEN_AFTER_MS,12*3600000)
console.log('ok')
