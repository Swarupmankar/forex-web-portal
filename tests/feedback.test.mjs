import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
async function moduleAt(path){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {readPracticeAccount}=await moduleAt('../src/lib/practicePersistence.ts');
test('saved practice account replaces stale tab state; malformed storage never destroys the fallback',()=>{
 const fallback={balance:10000,sequence:1,orders:[]};
 const newer={balance:10012,sequence:3,orders:[{id:'P2',symbol:'XAUUSD',orderType:'BUY',status:'CLOSED',openPrice:2674,lotSize:.01,margin:26.74,pnl:12}]};
 assert.deepEqual(readPracticeAccount(JSON.stringify({state:{account:newer,mode:'connected'}}),fallback),newer);
 for(const raw of [null,'not-json','{}',JSON.stringify({state:{account:{...newer,balance:'1000'}}})])assert.equal(readPracticeAccount(raw,fallback),fallback);
});
test('trade confirmation uses a short two-note sound; unsupported audio is harmless',async()=>{
 const {playTradeSound}=await moduleAt('../src/lib/tradeSound.ts');
 await playTradeSound('filled');
 const frequencies=[],stops=[];
 class Context {
  state='suspended';currentTime=1;destination={};
  async resume(){this.state='running';}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  createOscillator(){return {frequency:{setValueAtTime(v){frequencies.push(v);}},connect(){},disconnect(){},start(){},stop(v){stops.push(v);}};}
 }
 globalThis.window={AudioContext:Context};
 try{await playTradeSound('filled');assert.deepEqual(frequencies,[660,880]);assert.ok(stops.every(v=>v<1.3));}finally{delete globalThis.window;}
});
