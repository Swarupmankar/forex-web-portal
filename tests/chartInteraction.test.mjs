import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/chartInteraction.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {chartDragCoordinate,chartPrice}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('drag displacement accounts for rendered scaling without a price jump',()=>{
 assert.equal(chartDragCoordinate(100,20,300,300),120);
 assert.equal(chartDragCoordinate(100,20,300,600),110);
 assert.equal(chartDragCoordinate(100,20,300,150),140);
 assert.equal(chartDragCoordinate(100,0,300,600),100);
});
test('drag stays inside the price pane and ignores unavailable geometry',()=>{
 assert.equal(chartDragCoordinate(100,-1000,300,300),1);
 assert.equal(chartDragCoordinate(100,1000,300,300),299);
 assert.equal(chartDragCoordinate(100,10,0,0),null);
 assert.equal(chartDragCoordinate(NaN,10,300,300),null);
});
test('draft prices reject incomplete or invalid inputs and round to instrument precision',()=>{
 for(const p of ['', ' ', '0', '-1', 'Infinity', 'NaN', 'abc']) assert.equal(chartPrice(p,5),null);
 assert.equal(chartPrice('1.1234567',5),1.12346);
 assert.equal(chartPrice('2670.345',2),2670.34);
 assert.equal(chartPrice('0.0000001',2),null);
});
