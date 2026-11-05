import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/lib/historyRefresh.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {orderListSignature,followHistory}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('history follows fills and partial closes, not each quote or response order',()=>{
 const a={id:1,orderStatus:'OPEN',lotSize:'.02',pnl:0,orderDetails:{entryPrice:4000}}, b={id:2,orderStatus:'PENDING',lotSize:'.01'};
 const signature=orderListSignature({openOrders:[a],pendingOrders:[b],balance:1000});
 assert.equal(signature,orderListSignature({pendingOrders:[b],openOrders:[{...a,pnl:10}],balance:998}));
 assert.notEqual(signature,orderListSignature({openOrders:[{...a,lotSize:'.01'}],pendingOrders:[b]}));
 assert.notEqual(signature,orderListSignature({openOrders:[],pendingOrders:[b]}));
 assert.notEqual(signature,orderListSignature({openOrders:[a,{...b,orderStatus:'OPEN'}]}));
});
test('history refreshes immediately then at bounded delays; cleanup cancels every timer',()=>{
 let reads=0; const timers=new Map(); let seq=0;
 const stop=followHistory(()=>reads++,(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},id=>timers.delete(id));
 assert.equal(reads,1); assert.deepEqual([...timers.values()].map(t=>t.ms),[2500,6000,12000]);
 timers.get(1).fn(); assert.equal(reads,2);
 stop(); assert.equal(timers.size,0);
});
