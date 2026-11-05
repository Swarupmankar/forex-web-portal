import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/watchlistView.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {watchlistCategory,enrichWatchlist,filterWatchlist}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const row=(symbol,category='All',isFavorite=false)=>({symbol,name:symbol,id:symbol,category,isFavorite});

test('watchlist filters classify mobile symbols when legacy metadata is absent or calls everything Forex',()=>{
  for(const [symbol,expected] of [['EURUSD.m','Forex'],['XAUUSD','Metals'],['SOLUSD','Crypto'],['XRPUSD','Crypto'],['US30','Indices'],['XTIUSD','Energies'],['NGCUSD','Energies']]){
    assert.equal(watchlistCategory(row(symbol)),expected);
    assert.equal(watchlistCategory(row(symbol,'Forex')),expected);
  }
  assert.equal(watchlistCategory(row('CUSTOM','Metals')),'Metals');
  assert.equal(watchlistCategory(row('CUSTOM')),'Other');
});
test('catalogue enrichment fills missing category without replacing saved IDs or favorites',()=>{
  const saved=[{...row('custom'),id:17,isFavorite:true}],catalogue=[{...row('CUSTOM','Crypto'),id:999,stockId:999}];
  const before=structuredClone(saved);
  const items=enrichWatchlist(saved,catalogue);
  assert.equal(items[0].category,'Crypto');assert.equal(items[0].id,17);
  assert.equal(items[0].isFavorite,true);assert.equal(items[0].stockId,999);
  assert.deepEqual(saved,before);assert.equal(filterWatchlist(items,'Crypto',true,'').length,1);
  const corrected=enrichWatchlist([row('CUSTOM','Forex')],catalogue);
  assert.equal(watchlistCategory(corrected[0]),'Crypto');
});
test('adding an item reveals it on the first page, without silently marking it favorite',()=>{
  const items=[...Array.from({length:60},(_,i)=>row('CUSTOM'+i)),row('SOLUSD')];
  const visible=filterWatchlist(items,'All',false,'','SOLUSD');
  assert.equal(visible[0].symbol,'SOLUSD');assert.equal(visible.length,61);
  assert.equal(filterWatchlist(items,'Crypto',false,'')[0].symbol,'SOLUSD');
  assert.equal(filterWatchlist(items,'All',true,'','SOLUSD').length,0);
  assert.equal(items.at(-1).symbol,'SOLUSD');
});
test('category and favorite filters compose with trimmed search, including unknown instruments',()=>{
  const items=[row('XAUUSD','All',true),row('EURUSD','Forex',true),row('SOLUSD'),row('Custom')];
  assert.deepEqual(filterWatchlist(items,'Metals',true,' USD ').map(r=>r.symbol),['XAUUSD']);
  assert.deepEqual(filterWatchlist(items,'Other',false,'').map(r=>r.symbol),['Custom']);
  assert.deepEqual(filterWatchlist(items,'Forex',false,'sol','SOLUSD'),[]);
  assert.equal(filterWatchlist(items,'All',false,'').length,4);
});
