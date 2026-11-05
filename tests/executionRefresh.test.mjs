import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/executionRefresh.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createExecutionRefresh}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function clock() {
  let now=0,id=0;const timers=new Map();
  return {
    schedule(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},
    cancel(key){timers.delete(key);},
    advance(ms){now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}},
    count:()=>timers.size,
  };
}
test('accepted orders refresh immediately and catch asynchronously persisted rows before the normal five-second poll',async()=>{
  const time=clock();let stored=false,visible=false,reads=0;
  const refresh=createExecutionRefresh(async()=>{reads++;visible=stored;},()=>1,time);
  refresh();await flush();assert.equal(visible,false);
  stored=true;time.advance(600);await flush();assert.equal(visible,true);
  time.advance(600);await flush();assert.equal(reads,3);
  time.advance(100000);await flush();assert.equal(reads,3);
});
test('rapid submissions and socket events coalesce without overlapping reads; a late read gets one follow-up',async()=>{
  const time=clock();let reads=0,release;
  const refresh=createExecutionRefresh(()=>{reads++;return new Promise(resolve=>release=resolve);},()=>1,time);
  refresh();refresh();refresh();assert.equal(reads,1);assert.equal(time.count(),2);
  time.advance(1200);assert.equal(reads,1);
  release();await flush();assert.equal(reads,2);
  release();await flush();time.advance(10000);assert.equal(reads,2);
});
test('switching accounts cancels queued follow-ups and a new account does not wait for the old reader',async()=>{
  const time=clock();let generation=1,release;const reads=[];
  const refresh=createExecutionRefresh(g=>{reads.push(g);return g===1?new Promise(resolve=>release=resolve):Promise.resolve();},()=>generation,time);
  refresh();generation=2;refresh();await flush();assert.deepEqual(reads,[1,2]);
  release();await flush();time.advance(1200);await flush();assert.ok(reads.slice(1).every(g=>g===2));
  generation=3;const count=reads.length;time.advance(5000);await flush();assert.equal(reads.length,count);
});
test('read errors have bounded recovery, without retrying an execution',async()=>{
  const time=clock();let reads=0;
  const refresh=createExecutionRefresh(async()=>{reads++;throw new Error('offline');},()=>1,time);
  refresh();await flush();time.advance(600);await flush();time.advance(600);await flush();
  assert.equal(reads,3);assert.equal(time.count(),0);
});
