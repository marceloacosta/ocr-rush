import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,DEFAULT,VERSION} from '../public/model.js';
import {readProgress,writeProgress,readChallenge,challengeURL,compareChallenge,localPreview,shareText} from '../public/game.js';
const success=simulate({...DEFAULT,power:'demand'},0),failure=simulate(DEFAULT,0),best=[success,null,null,null,null,null];
test('a shared configuration reproduces its target without trusting URL-provided scores',()=>{
 const url=challengeURL('https://game.example/path?unrelated=yes#old',success),parsed=new URL(url),challenge=readChallenge(url);
 assert.equal(parsed.searchParams.get('unrelated'),null);assert.equal(parsed.hash,'');assert.equal(challenge.stage,0);assert.equal(challenge.result.cost,success.cost);assert.equal(challenge.result.passed,true);
 parsed.searchParams.set('cost','0.001');assert.equal(readChallenge(parsed).result.cost,success.cost);
});
test('bad, oversized, incompatible and non-passing challenges never become targets',()=>{
 const url=new URL(challengeURL('https://game.example/',success));url.searchParams.set('v',String(VERSION-1));assert.ok(readChallenge(url).error);url.searchParams.set('v',String(VERSION));
 for(const value of ['<script>', 'null','[]','x'.repeat(601),JSON.stringify({...success.config,workers:999}),JSON.stringify(DEFAULT)]){url.searchParams.set('design',value);assert.equal(readChallenge(url).result,null);assert.ok(readChallenge(url).error);}
 assert.equal(new URL(challengeURL('https://game.example/',failure)).searchParams.get('design'),null);
});
test('progress stores configurations and recomputes completed levels on restore',()=>{
 const stored=writeProgress(best,0,success.config),restored=readProgress(stored);assert.equal(restored.best.filter(Boolean).length,1);assert.equal(restored.best[0].cost,success.cost);assert.deepEqual(restored.config,success.config);
 const forged=JSON.parse(stored);forged.best[1]=DEFAULT;forged.cost=0;assert.equal(readProgress(JSON.stringify(forged)).best[1],null);
 for(const bad of ['garbage','null','{}',JSON.stringify({...forged,version:VERSION+1}),JSON.stringify({...forged,best:[]})])assert.equal(readProgress(bad),null);
});
test('challenge comparisons require a passing result on the same workload and use displayed cents',()=>{
 assert.match(compareChallenge(failure,success),/Meet this level/);assert.match(compareChallenge(success,success),/matched/);assert.equal(compareChallenge({...success,contract:'rush'},success),null);assert.match(compareChallenge({...success,cost:success.cost-.01},success),/\$0.01 less/);
});
test('share text states actual completion and local links are distinguished from public links',()=>{
 assert.match(shareText(success,best),/level 1/);assert.match(shareText(success,best),/1\/6 levels completed/);assert.match(shareText(failure,best),/I tried/);
 assert.ok(localPreview('http://localhost:4174/'));assert.ok(localPreview('http://127.0.0.1:4174/'));assert.ok(localPreview('http://[::1]:4174/'));assert.equal(localPreview('https://game.example'),false);
});
