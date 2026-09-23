import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,CONTRACTS,DEFAULT,normalize,capacity,PROFILE,SHIFT_SECONDS,FRAME_SECONDS} from '../public/model.js';
import {PRICING as P,money,smallMoney} from '../public/pricing.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const burst={...DEFAULT,workers:4,power:'scheduled',batch:16,quota:4};
const solutions=[{...DEFAULT,power:'demand'},burst,{...burst,queue:'sqs',recovery:true},{...burst,layout:4},{...burst,queue:'sqs',recovery:true,dlq:true},{...burst,workers:8,power:'demand',layout:2,quota:8}];
const results=solutions.map((c,i)=>simulate(c,i));
test('identical designs replay identical workloads, events and latency',()=>{assert.deepEqual(simulate(solutions[2],2),results[2]);});
test('all six contracts have a feasible design, including 10,000 PDFs',()=>{
 for(const r of results)assert.ok(r.passed,`${r.contract}: ${r.onTime}/${r.target}, $${r.cost}`);
 assert.equal(results[1].pages,4000);assert.equal(results[3].pages,16000);assert.equal(results[5].total,10000);assert.equal(results[5].donePages,40000);
});
test('warm receipts take seconds while startup and queueing account for the cold latency',()=>{
 const warm=simulate(DEFAULT,0),cold=results[0];assert.equal(warm.p95,2.5);assert.ok(cold.p95>240&&cold.p95<300);assert.ok(cold.cost<warm.cost);assert.ok(!warm.passed);assert.ok(cold.latency.startup>200);assert.ok(cold.latency.inference<5);
 assert.deepEqual(warm.jobs.map(j=>j.arrival),cold.jobs.map(j=>j.arrival));
});
test('billing meters both pools and disks, with persistent infrastructure when nodes sleep',()=>{
 const r=simulate(DEFAULT,0);near(r.costs.gpu,P.gpuHour);near(r.costs.layout,P.layoutHour);near(r.costs.base,P.baseHour);near(r.costs.disks,2*P.gpuDiskHour);assert.equal(r.costs.sqs,0);
 const q=simulate({...DEFAULT,queue:'sqs',recovery:true},0);near(q.costs.gpu,r.costs.gpu);near(q.costs.sqs,q.usage.sqsRequests*P.sqsRequest);near(q.costs.s3,q.usage.s3Puts*P.s3Put+q.usage.s3Gets*P.s3Get+q.usage.storageGBSeconds/3600/730*P.s3GBMonth);assert.ok(q.cost-r.cost<.01);near(results[0].costs.base,P.baseHour);
});
test('finite aggregate throughput bounds concurrent streams; serial work leaves capacity unused',()=>{
 const serial=simulate({...burst,batch:1},1),concurrent=results[1];assert.ok(serial.onTime<concurrent.onTime);assert.ok(!serial.passed);assert.equal(capacity(burst,CONTRACTS[1]).tokens,4*360);assert.equal(capacity({...burst,batch:1},CONTRACTS[1]).tokens,4*40);
 for(const r of results){assert.ok(r.usage.generatedTokens<=r.usage.busySeconds*PROFILE.tokensPerSecond+1e-6);assert.ok(r.trace.every(f=>f.tokenRate<=r.capacity.tokens+1e-6));}
 near(concurrent.usage.generatedTokens,4000*200);
});
test('layout capacity and inference capacity are independent bottlenecks',()=>{
 const blocked=simulate({...burst,workers:8,quota:8},3),scaled=results[3];assert.ok(blocked.unfinished>0);assert.ok(!blocked.passed);assert.ok(scaled.passed);assert.ok(scaled.prepPeak<blocked.prepPeak);
});
test('requests above available capacity stay pending and accrue no extra GPU or disk bill',()=>{
 const pending=simulate({...solutions[5],quota:4},5),four=simulate({...solutions[5],workers:4,quota:4},5),eight=results[5];assert.equal(pending.capacity.pending,4);assert.equal(pending.done,four.done);near(pending.cost,four.cost);assert.ok(pending.trace.every(f=>f.workers.slice(4).every(n=>n.state==='pending'&&n.tasks.length===0)));assert.ok(pending.unfinished>0);assert.ok(!pending.passed);assert.ok(eight.passed);
});
test('visibility expiry recovers interrupted work; idempotency separately protects publication',()=>{
 const volatile=simulate(burst,2),durable=simulate({...burst,queue:'sqs'},2),safe=results[2];assert.ok(volatile.lost>0);assert.equal(durable.lost,0);assert.ok(durable.duplicates>0);assert.equal(safe.duplicates,0);
 const retry=safe.events.find(e=>e.kind==='retry'&&e.text.includes('visible again'));assert.ok(retry.time>CONTRACTS[2].fault);assert.ok(retry.time<=CONTRACTS[2].fault+120);assert.ok(safe.events.some(e=>e.kind==='safe'));
 assert.ok(safe.jobs.some(j=>j.attempts>1&&j.timing.retry>0));assert.ok(safe.jobs.every(j=>j.deadline===j.arrival+CONTRACTS[2].deadline));near(safe.usage.s3Puts,2000);
});
test('a late-starting worker cannot avoid the recovery failure; storage alone never recovers interrupted jobs',()=>{
 for(let workers=1;workers<=8;workers++)for(const power of ['warm','demand','scheduled'])for(const batch of [1,16])for(const layout of [1,2,4]){
  const r=simulate({...DEFAULT,workers,power,batch,layout,quota:8,queue:'s3redis',recovery:true},2);
  assert.ok(r.lost>0,JSON.stringify(r.config));assert.equal(r.passed,false);
  const faults=r.events.filter(e=>e.kind==='fault');assert.equal(faults.length,1);assert.ok(faults[0].time>=CONTRACTS[2].fault);assert.doesNotMatch(faults[0].text,/with 0 PDFs/);
 }
 const cold=simulate({...DEFAULT,workers:8,power:'demand',quota:8,queue:'sqs',recovery:true},2);
 assert.equal(cold.lost,0);assert.ok(cold.retries>0);assert.ok(cold.events.find(e=>e.kind==='fault').time>CONTRACTS[2].fault);
});
test('DLQ keeps invalid files without counting them as valid outputs',()=>{
 const endless=simulate({...burst,queue:'sqs'},4),isolated=results[4];assert.equal(endless.unfinished,2);assert.equal(isolated.quarantined,2);assert.equal(isolated.done,998);assert.equal(isolated.donePages,3992);assert.ok(isolated.jobs.filter(j=>j.bad).every(j=>j.attempts===2&&j.finish===null&&j.status==='quarantined'));
 const lost=simulate({...burst,dlq:true},4);assert.equal(lost.quarantined,0);assert.equal(lost.failed,2);assert.ok(!lost.passed);
});
test('invalid PDFs fail during page preparation and never consume inference tokens',()=>{
 for(const queue of ['redis','s3redis','sqs']){
  const r=simulate({...burst,queue,dlq:true},4);
  assert.ok(r.jobs.filter(j=>j.bad).every(j=>j.timing.layout>0&&j.timing.inference===0));
  near(r.usage.generatedTokens,r.donePages*CONTRACTS[4].tokens);
  assert.ok(r.events.filter(e=>e.kind==='error').every(e=>e.text.includes('page preparation')));
 }
});
test('latency components conserve elapsed time and exclude unfinished documents',()=>{
 for(const r of [...results,simulate(DEFAULT,5)]){
  const delivered=r.jobs.filter(j=>j.finish!==null);assert.equal(delivered.length,r.done);
  for(const j of delivered){near(Object.values(j.timing).reduce((a,b)=>a+b,0),j.finish-j.arrival);assert.ok(Object.values(j.timing).every(s=>s>=0));}
  near(Object.values(r.latency).reduce((a,b)=>a+b,0),r.mean);const latencies=delivered.map(j=>j.finish-j.arrival).sort((a,b)=>a-b);assert.equal(r.p95,latencies[Math.ceil(latencies.length*.95)-1]);
 }
});
test('outcomes, pages and dollars balance across successful and failed designs',()=>{
 for(let stage=0;stage<CONTRACTS.length;stage++)for(const c of [DEFAULT,solutions[stage],{...solutions[stage],power:'demand',batch:1}]){
  const r=simulate(c,stage);assert.equal(r.done+r.lost+r.failed+r.unfinished+r.quarantined,r.total);assert.ok(r.onTime<=r.done&&r.done<=r.target);assert.ok(r.score>=0&&r.score<=100);near(r.cost,Object.values(r.costs).reduce((a,b)=>a+b,0));
  assert.ok(Number.isInteger(r.usage.gpuSeconds)&&Number.isInteger(r.usage.layoutSeconds));assert.equal(r.trace.length,SHIFT_SECONDS/FRAME_SECONDS+1);assert.ok(r.trace.every((f,i)=>i===0||f.cost>=r.trace[i-1].cost));assert.equal(r.donePages,r.jobs.filter(j=>j.finish!==null).reduce((sum,j)=>sum+j.pages,0));assert.ok(r.jobs.filter(j=>j.finish!==null).every(j=>j.finish>j.arrival));
 }
});
test('scheduled capacity cannot process work arriving after its window and shutdown',()=>{const r=simulate({...DEFAULT,power:'scheduled'},0);assert.ok(r.unfinished>0);assert.ok(!r.passed);assert.ok(r.jobs.filter(j=>j.arrival>=2640).every(j=>j.finish===null));});
test('unsupported configuration normalizes to bounded options',()=>{assert.deepEqual(normalize({workers:999,power:'<script>',batch:-1,queue:'oops',recovery:'true',layout:-2,dlq:'true',quota:999}),DEFAULT);});

test('Redis is the starting document store; moving files to S3 adds storage but no automatic retry',()=>{
 const redis=simulate(burst,2),s3=simulate({...burst,queue:'s3redis'},2),sqs=simulate({...burst,queue:'sqs'},2);
 assert.equal(redis.usage.s3Puts,0);assert.equal(redis.usage.s3Gets,0);assert.equal(redis.usage.storageGBSeconds,0);assert.equal(redis.costs.s3,0);assert.equal(redis.costs.sqs,0);
 assert.ok(redis.jobs.some(j=>j.status==='stranded'));assert.equal(s3.lost,redis.lost);assert.equal(s3.done,redis.done);assert.ok(s3.costs.s3>0);assert.equal(s3.costs.sqs,0);assert.equal(sqs.lost,0);assert.ok(sqs.costs.sqs>0);
 assert.equal(normalize({...DEFAULT,recovery:true,dlq:true}).recovery,false);assert.equal(normalize({...DEFAULT,recovery:true,dlq:true}).dlq,false);
});
test('USD formatting distinguishes cents from thousands and preserves small nonzero charges',()=>{
 assert.equal(money(3.8),'$3.80');assert.equal(money(3800),'$3,800.00');assert.equal(money(0),'$0.00');assert.equal(smallMoney(.000003),'Less than $0.01');assert.equal(smallMoney(0),'$0.00');
});
