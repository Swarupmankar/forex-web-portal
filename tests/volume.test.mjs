import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const transpile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {volumeSpec,validateVolume,stepVolume,needsReview,PRACTICE_VOLUME}=await import('data:text/javascript;base64,'+Buffer.from(transpile('../src/lib/volume.ts')).toString('base64'));
test('practice uses fixed limits; connected uses instrument limits with safe defaults',()=>{
 assert.deepEqual(volumeSpec(true,{minLots:1,maxLots:5,lotStep:1}),PRACTICE_VOLUME);
 assert.deepEqual(volumeSpec(false,{minLots:0.1,maxLots:20,lotStep:0.1}),{min:0.1,max:20,step:0.1});
 assert.deepEqual(volumeSpec(false,undefined),{min:0.01,max:100,step:0.01});
 assert.deepEqual(volumeSpec(false,{minLots:0,maxLots:-1,lotStep:NaN}),{min:0.01,max:100,step:0.01});
 assert.deepEqual(volumeSpec(false,{lotStep:0.1}),{min:0.1,max:100,step:0.1});
 // Metadata can narrow but never exceed what the order proxy accepts (100 lots, 0.01 steps).
 assert.deepEqual(volumeSpec(false,{minLots:0.001,maxLots:500,lotStep:0.001}),{min:0.01,max:100,step:0.01});
});
test('validation enforces range and step for each account type',()=>{
 const spec=volumeSpec(false,{minLots:0.1,maxLots:20,lotStep:0.1});
 assert.equal(validateVolume(0.3,spec),null);
 assert.equal(validateVolume(20,spec),null);
 assert.match(validateVolume(0.05,spec),/0.1–20 lots, in steps of 0.1/);
 assert.match(validateVolume(0.25,spec),/steps of 0.1/);
 assert.match(validateVolume(21,spec),/0.1–20/);
 assert.match(validateVolume(NaN,spec),/greater than zero/);
 assert.equal(validateVolume(0.07,PRACTICE_VOLUME),null);
 assert.match(validateVolume(100.01,PRACTICE_VOLUME),/0.01–100/);
});
test('stepping snaps to the grid and stays inside limits',()=>{
 const spec={min:0.1,max:1,step:0.1};
 assert.equal(stepVolume(0.3,spec,1),0.4);
 assert.equal(stepVolume(0.34,spec,1),0.4);
 assert.equal(stepVolume(0.1,spec,-1),0.1);
 assert.equal(stepVolume(1,spec,1),1);
 assert.equal(stepVolume(NaN,spec,1),0.2);
 assert.equal(stepVolume(0.07,PRACTICE_VOLUME,1),0.08);
 // Off-grid values move to the next valid step, not two steps.
 assert.equal(stepVolume(0.05,spec,1),0.1);
 assert.equal(stepVolume(0.35,spec,-1),0.3);
 assert.equal(stepVolume(0.3,spec,-1),0.2);
});
test('large orders always get a review',()=>{
 assert.equal(needsReview(9.99),false);
 assert.equal(needsReview(10),true);
});
