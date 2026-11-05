import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/lib/instrumentArtwork.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {artworkLegs,artworkPath,CURRENCY_FLAGS,CRYPTO_CODES,OBJECT_ARTWORK}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('forex and broker suffixes use both currency legs; crypto and objects retain their own artwork',()=>{
 for(const symbol of ['USDCHF','USDCAD','AUDNZD','NZDJPY']) assert.deepEqual(artworkLegs(symbol+'.raw'),{base:symbol.slice(0,3),quote:symbol.slice(3)});
 assert.deepEqual(artworkLegs('SOL/USD'),{base:'SOL',quote:'USD'});
 assert.deepEqual(artworkLegs('XAUUSDm'),{base:'XAU',quote:'USD'});
 assert.deepEqual(artworkLegs('NAS100.pro'),{base:'NDX',quote:undefined});
 assert.deepEqual(artworkLegs('UKOIL'),{base:'BRN',quote:undefined});
});
test('broker metadata overrides symbol guesses and unknown bases retain a text fallback',()=>{
 assert.deepEqual(artworkLegs('XAUUSD',{base:'XAG',quote:'EUR'}),{base:'XAG',quote:'EUR'});
 assert.deepEqual(artworkLegs('BTCUSD',{base:'CUSTOM'}),{base:'CUSTOM',quote:undefined});
 assert.equal(artworkPath('CUSTOM'),undefined);
});
test('every advertised artwork resolves to a local asset, including retained licences',()=>{
 for(const code of [...Object.keys(CURRENCY_FLAGS),...CRYPTO_CODES,...Object.keys(OBJECT_ARTWORK)]) {
  const path=artworkPath(code); assert.ok(path,code);
  const bytes=readFileSync(new URL('../public'+path,import.meta.url)); assert.ok(bytes.length>100,code);
  if(path.endsWith('.svg')) assert.match(bytes.toString(),/<svg[^>]*(viewBox|width)=/);
  else assert.equal(bytes.subarray(1,4).toString(),'PNG');
 }
 for(const folder of ['crypto','flags']) assert.ok(existsSync(new URL('../public/instruments/app/'+folder+'/LICENSE.txt',import.meta.url)));
});
