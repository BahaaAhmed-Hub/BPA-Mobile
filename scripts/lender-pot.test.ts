import { liveBalances } from '../src/lib/finance/balances.ts'
import { setFinancePrefs } from '../src/lib/finance/fx.ts'
import { unspentBorrowed, borrowedHeld, isDraw, isKept, isBorrowing } from '../src/lib/finance/loans.ts'
import assert from 'node:assert'
setFinancePrefs({ base:'EGP', rates:{ USD:50 } })
const acc=(o:any)=>({ id:'a', name:'A', bank:'', account_type:'payment', currency:'EGP', balance:0, ...o })
const tx=(o:any)=>({ id:Math.random().toString(), account_id:null, to_account_id:null, category_id:null, amount:0, currency:'EGP', tx_type:'transfer', payee:'', date:'2026-11-01', paid_at:'2026-11-01', tags:[], ...o })
const lender=acc({ id:'L', name:'Baba', account_type:'loan', balance:-150000 })   // owes 150,000, opened as owing it
const cash=acc({ id:'C', name:'CIB', balance:0 })
const card=acc({ id:'K', name:'Visa', account_type:'credit_card', balance:0 })
const all=[lender,cash,card] as any
const bal=(txs:any[],id:string)=>liveBalances(all,txs).balances.get(id)
// 1. The control: an UNTAGGED transfer out of the lender is new borrowing. 173,000 out of a lender owing 150,000 reads -323,000.
const untagged=tx({ account_id:'L', to_account_id:'C', amount:173000 })
assert.equal(bal([untagged],'L'), -323000); assert.equal(bal([untagged],'C'), 173000)
assert.equal(isBorrowing(untagged, all), true); assert.equal(isDraw(untagged, all), false)
// 2. The same transfer tagged draw: spending the pot. The debt stays at 150,000; the cash still lands.
const draw=tx({ account_id:'L', to_account_id:'C', amount:100000, tags:['draw'] })
assert.equal(bal([draw],'L'), -150000); assert.equal(bal([draw],'C'), 100000)
assert.equal(isDraw(draw, all), true); assert.equal(isBorrowing(draw, all), false)
// 3. The pot: opened owing 150,000, 100,000 drawn leaves 50,000 unspent
assert.equal(unspentBorrowed({ id:'L', currency:'EGP', balance:-150000 }, [draw] as any), 50000)
// kept borrowing raises both the debt and the pot
const kept=tx({ account_id:'L', to_account_id:null, amount:20000, tags:['kept'] })
assert.equal(bal([kept],'L'), -170000); assert.equal(isKept(kept, all), true); assert.equal(isBorrowing(kept, all), true)
assert.equal(unspentBorrowed({ id:'L', currency:'EGP', balance:-150000 }, [kept] as any), 170000)
// a draw bigger than the pot never goes below zero
const big=tx({ account_id:'L', to_account_id:'C', amount:999999, tags:['draw'] })
assert.equal(unspentBorrowed({ id:'L', currency:'EGP', balance:-150000 }, [big] as any), 0)
// an unpaid draw is not counted
assert.equal(unspentBorrowed({ id:'L', currency:'EGP', balance:-150000 }, [{ ...draw, paid_at:null }] as any), 150000)
// a draw onto a card lands there too
const toCard=tx({ account_id:'L', to_account_id:'K', amount:30000, tags:['draw'] }); assert.equal(isDraw(toCard, all), true); assert.equal(bal([toCard],'K'), 30000)
// a draw between two lenders is not a draw
const L2=acc({ id:'L2', account_type:'loan', balance:-10 }); assert.equal(isDraw(tx({ account_id:'L', to_account_id:'L2', tags:['draw'] }), [lender, L2] as any), false)
// 4. Borrowed-held: CIB holds 100,000 drawn, lender still owes 150,000 -> CIB says 100,000 is borrowed
let balances=liveBalances(all,[draw]).balances
let held=borrowedHeld(all,[draw] as any,balances); assert.equal(held.get('C')![0].amount, 100000); assert.equal(held.get('C')![0].lender.name,'Baba')
// ...paying 75,000 back shrinks it in proportion (owed 75,000 of 100,000 landed => 75,000), still capped by what CIB holds
const pay=tx({ account_id:'C', to_account_id:'L', amount:75000 })
balances=liveBalances(all,[draw,pay]).balances; assert.equal(balances.get('L'), -75000); assert.equal(balances.get('C'), 25000)
held=borrowedHeld(all,[draw,pay] as any,balances); assert.equal(held.get('C')![0].amount, 25000)   // capped at what the account holds
// an account spent to nothing holds none
const spent=tx({ account_id:'C', tx_type:'expense', amount:100000 })
balances=liveBalances(all,[draw,spent]).balances; assert.equal(borrowedHeld(all,[draw,spent] as any,balances).has('C'), false)
// a settled lender is not named
const settled=acc({ id:'L', name:'Baba', account_type:'loan', balance:0 }); assert.equal(borrowedHeld([settled,cash] as any,[draw] as any,new Map([['L',0],['C',100000]])).size, 0)
// cross-currency: a USD lender drawn into an EGP account at the stamped rate
const usd=acc({ id:'U', name:'Ahmed', account_type:'loan', currency:'USD', balance:-1000 })
const dU=tx({ account_id:'U', to_account_id:'C', amount:400, currency:'USD', tags:['draw','fx:USD/EGP=48'] })
const b2=liveBalances([usd,cash] as any,[dU] as any).balances; assert.equal(b2.get('U'), -1000); assert.equal(b2.get('C'), 19200)
assert.equal(unspentBorrowed({ id:'U', currency:'USD', balance:-1000 }, [dU] as any), 600)
console.log('ok')
