import {PRICING as P,money,duration} from './pricing.js';
export const VERSION=4,SHIFT_SECONDS=3600,FRAME_SECONDS=10;
const STEP=.5;
// Planning inputs, not measured performance of the named AWS instance/model.
export const PROFILE={tokensPerSecond:360,streamTokensPerSecond:40,layoutBoot:90,inferenceBoot:240,cooldown:300,layoutConcurrency:8,prefetchPerLayout:256,visibility:120,heartbeat:30,scheduleStart:360,scheduleEnd:2100};
const arrivals=(count,start,span)=>Array.from({length:count},(_,i)=>start+Math.floor(i*span/count));
export const CONTRACTS=[
 {id:'quiet',name:'Reduce the cost of processing 60 receipts',short:'Receipt uploads',label:'SCENARIO 1: OCCASIONAL UPLOADS',brief:'An accounting team uploads three groups of 20 one-page receipts during the hour. They need the extracted data within five minutes of each upload. Start with the Redis-based application and one GPU for each processing stage. Run it once, then compare keeping the GPUs ready with shutting them down between uploads.',budget:3.8,deadline:300,pages:1,tokens:80,layoutRate:12,arrivals:[...arrivals(20,120,40),...arrivals(20,1200,40),...arrivals(20,2640,40)],reason:'The five-minute target is the accounting team’s requirement in this exercise. It includes waiting, startup and processing; it is not a measured AWS response time.',tip:'Keeping both GPUs ready meets the time target but exceeds the budget. The queue-activated variation shuts them down between uploads. It adds an external signal to wake inference, because vLLM cannot publish a wake-up metric while its server is stopped.'},
 {id:'rush',name:'Prepare capacity for 1,000 invoices arriving together',short:'Invoice upload',label:'SCENARIO 2: A SCHEDULED UPLOAD',brief:'A supplier sends 1,000 four-page invoices over two minutes, starting ten minutes into the run. The accounting system needs each result within eight minutes of its upload. You know when this upload will happen, so compare starting GPU nodes ahead of time with waiting until the invoices arrive. You can also increase the number of nodes that are allowed to launch.',budget:10,deadline:480,pages:4,tokens:200,layoutRate:12,arrivals:arrivals(1000,600,120),reason:'The eight-minute target represents the supplier’s reconciliation requirement for this exercise. More invoices create queue wait even when each invoice needs only seconds of processing.',tip:'Try four inference nodes with concurrent requests and scheduled startup. Raise the available-node limit from the starting limit of two nodes to four. Then compare with startup triggered by the first upload.'},
 {id:'recovery',name:'Recover invoice processing after a worker stops',short:'Worker failure',label:'SCENARIO 3: INTERRUPTED WORK',brief:'The same 1,000-invoice upload is interrupted when an inference worker stops at minute 13. At minute 35, the client resubmits an invoice that has already finished. Compare the original Redis job handling with two variations: storing files in S3, and adding SQS to retry interrupted jobs. The accounting system must receive each result once.',budget:11,deadline:720,pages:4,tokens:200,layoutRate:12,arrivals:arrivals(1000,600,120),fault:780,duplicateAt:2100,reason:'Allow twelve minutes from each original upload, including recovery. A retry does not restart the deadline. This scenario models a worker failure that the application cannot recover through its short request retries.',tip:'Moving files to S3 preserves them independently of Redis, but it does not recover removed queue entries. SQS adds job acknowledgements and retry after visibility expiry. Enable duplicate-result protection to handle the client’s repeated submission.'},
 {id:'large',name:'Find what slows down 200 scanned reports',short:'Scanned reports',label:'SCENARIO 4: SLOW PAGE PREPARATION',brief:'An archive team uploads 200 reports with 80 scanned pages each. Before text extraction can begin, the layout workers must render the pages and identify their text and table regions. These scans need more preparation than the invoices. Compare adding layout GPUs with adding inference GPUs, and use the two queue counts to see which stage is limiting delivery.',budget:20,deadline:2700,pages:80,tokens:200,layoutRate:2,arrivals:arrivals(200,600,120),reason:'Each report must finish within 45 minutes of upload so the archive team can use its extracted contents during this exercise. All 80 pages must finish before a report counts as delivered.',tip:'Keep four inference nodes with concurrent requests and scheduled startup. Compare one layout node with four. If files wait before layout while inference has little work, extra inference capacity will not solve the delay.'},
 {id:'poison',name:'Set aside two invalid PDFs while processing the rest',short:'Invalid PDFs',label:'SCENARIO 5: FILES THAT KEEP FAILING',brief:'A new upload contains 1,000 four-page PDFs, but two files fail every parsing attempt. The other 998 files must continue through the system. Compare how the original Redis worker records failures with how the SQS variation retries them. Configure a separate queue for repeated failures so the operations team can inspect those files later.',budget:10,deadline:600,pages:4,tokens:200,layoutRate:12,arrivals:arrivals(1000,600,120),bad:[4,15],reason:'The valid files have a ten-minute delivery target. The two invalid inputs must be retained in the separate error queue; recording an error or isolating a file does not count as successful extraction.',tip:'With SQS selected, enable the dead-letter queue after two failed attempts. Without that stopping rule, the same invalid files keep returning and using compute. Four scheduled inference nodes and one layout node are sufficient under this planning profile.'},
 {id:'scale',name:'Process 10,000 PDFs when GPU capacity is limited',short:'Bulk import',label:'SCENARIO 6: A LARGER IMPORT',brief:'A document migration uploads 10,000 four-page PDFs over twenty minutes. Every result must be available before the hour ends. Requesting more workers will not help if their nodes cannot launch. Compare four available inference nodes with eight, and check that layout can supply enough prepared pages to keep them working.',budget:34,deadline:3000,pages:4,tokens:200,layoutRate:12,arrivals:arrivals(10000,300,1200),reason:'This exercise requires every PDF within fifty minutes of its upload and the entire import within the hour. The eight-node option extends the original deployment; it assumes the node-group limits, regional quota and instance availability have been addressed.',tip:'Try eight requested inference nodes, concurrent requests and two layout nodes. First run with only four inference nodes available, then allow all eight to launch. Compare unfinished work, queue time and the total cost.'}
];
export const DEFAULT={workers:1,power:'warm',batch:16,queue:'redis',recovery:false,layout:1,dlq:false,quota:2};
export function normalize(c={}){const queue=['redis','s3redis','sqs'].includes(c.queue)?c.queue:'redis';return {workers:Number.isInteger(Number(c.workers))&&Number(c.workers)>=1&&Number(c.workers)<=8?Number(c.workers):1,power:['warm','demand','scheduled'].includes(c.power)?c.power:'warm',batch:Number(c.batch)===1?1:16,queue,recovery:queue!=='redis'&&c.recovery===true,layout:[1,2,4].includes(Number(c.layout))?Number(c.layout):1,dlq:queue==='sqs'&&c.dlq===true,quota:[2,4,8].includes(Number(c.quota))?Number(c.quota):2};}
export const usesS3=c=>c.queue!=='redis';
export const deliveryName=c=>c.queue==='sqs'?'S3 storage with an SQS queue':c.queue==='s3redis'?'S3 storage with a Redis queue':'Redis storage and queue';
export const designKey=c=>JSON.stringify(normalize(c));
export function capacity(input,contract=CONTRACTS[0]){const c=normalize(input),nodes=Math.min(c.workers,c.quota),tokens=nodes*Math.min(PROFILE.tokensPerSecond,c.batch*PROFILE.streamTokensPerSecond),layout=c.layout*contract.layoutRate;return {nodes,pending:c.workers-nodes,tokens,layout,inference:tokens/contract.tokens,system:Math.min(layout,tokens/contract.tokens)};}
export function simulate(input,contractIndex=0){
 const config=normalize(input),contract=CONTRACTS[contractIndex]||CONTRACTS[0],cap=capacity(config,contract);
 const timing=()=>({startup:0,queue:0,layout:0,inference:0,retry:0});
 const jobs=contract.arrivals.map((arrival,id)=>({id,logicalId:id,arrival,pages:contract.pages,deadline:arrival+contract.deadline,bad:contract.bad?.includes(id)||false,status:'incoming',since:arrival,finish:null,attempts:0,lease:0,timing:timing()}));
 const makeNodes=(count,tier)=>Array.from({length:count},(_,id)=>({id,tier,state:tier==='inference'&&id>=cap.nodes?'pending':config.power==='warm'?'idle':'sleep',ready:0,idleSince:0,tasks:[],sessionStart:config.power==='warm'&&(tier==='layout'||id<cap.nodes)?0:null}));
 const workers=makeNodes(config.workers,'inference'),layouts=makeNodes(config.layout,'layout'),nodes=[...layouts,...workers];
 const usage={gpuSeconds:cap.nodes*(config.power==='warm'?60:0),layoutSeconds:config.layout*(config.power==='warm'?60:0),busySeconds:0,bootSeconds:0,idleSeconds:0,layoutBusySeconds:0,layoutBootSeconds:0,layoutIdleSeconds:0,generatedTokens:0,sqsRequests:0,s3Puts:0,s3Gets:0,storageGBSeconds:0};
 const incoming=new Map();for(const j of jobs){if(!incoming.has(j.arrival))incoming.set(j.arrival,[]);incoming.get(j.arrival).push(j);}
 const unavailable={layout:[],inference:[]},closed={layout:config.power==='warm'?null:0,inference:config.power==='warm'?null:0};
 let failed=0,prepQueue=[],queue=[],duplicates=0,retries=0,peak=0,prepPeak=0,done=0,onTime=0,donePages=0,storedGB=0,quarantined=0,lost=0,arrivedSince=0,doneSince=0,leased=0,eventCursor=0,lastTokens=0;
 const trace=[],events=[],published=new Set(),pendingRetries=new Set(),held=new Set();
 const emit=(time,kind,text)=>events.push({time,kind,text});
 const request=(n=1)=>{if(config.queue==='sqs')usage.sqsRequests+=n;};
 const costs=t=>({gpu:usage.gpuSeconds*P.gpuHour/3600,layout:usage.layoutSeconds*P.layoutHour/3600,base:P.baseHour*t/3600,disks:(usage.gpuSeconds+usage.layoutSeconds)*P.gpuDiskHour/3600,sqs:usage.sqsRequests*P.sqsRequest,s3:usage.s3Puts*P.s3Put+usage.s3Gets*P.s3Get+usage.storageGBSeconds/3600/730*P.s3GBMonth});
 const total=t=>Object.values(costs(t)).reduce((a,b)=>a+b,0);
 function transition(j,status,t){
  const elapsed=t-j.since;
  if(j.status==='prepQueue'||j.status==='queued'){
   const tier=j.status==='prepQueue'?'layout':'inference';let startup=0;
   for(const [a,b] of unavailable[tier])startup+=Math.max(0,Math.min(t,b)-Math.max(j.since,a));
   if(closed[tier]!==null)startup+=Math.max(0,t-Math.max(j.since,closed[tier]));
   j.timing.startup+=startup;j.timing.queue+=elapsed-startup;
  }else if(j.status==='layout')j.timing.layout+=elapsed;else if(j.status==='working')j.timing.inference+=elapsed;else if(j.status==='retry')j.timing.retry+=elapsed;
  j.status=status;j.since=t;
 }
 function availability(t){for(const [tier,pool] of [['layout',layouts],['inference',workers]]){const ready=pool.some(n=>n.state==='idle'||n.state==='busy');if(ready&&closed[tier]!==null){unavailable[tier].push([closed[tier],t]);closed[tier]=null;}else if(!ready&&closed[tier]===null)closed[tier]=t;}}
 function release(j){if(held.delete(j))leased--;}
 function fail(j,t){release(j);if(config.queue==='sqs'){transition(j,'retry',t);j.retryAt=Math.max(t+STEP,j.lease);pendingRetries.add(j);retries++;}else{transition(j,j.bad?'failed':'stranded',t);if(typeof j.id==='number'){if(j.bad)failed++;else lost++;}}}
 function finish(j,t){
  release(j);if(j.bad){emit(t,'error',`PDF ${j.logicalId+1} cannot be parsed (attempt ${j.attempts}).`);fail(j,t);return;}
  transition(j,'done',t);if(usesS3(config))usage.s3Puts++;request();
  if(published.has(j.logicalId)){if(!config.recovery){duplicates++;emit(t,'duplicate','Another result published for the same PDF.');}return;}
  published.add(j.logicalId);j.finish=t;done++;doneSince++;donePages+=j.pages;if(t<=j.deadline)onTime++;if(usesS3(config))storedGB+=j.pages*.02/1024;
 }
 const boot=(n,t)=>{n.state='boot';n.ready=t+(n.tier==='layout'?PROFILE.layoutBoot:PROFILE.inferenceBoot);n.sessionStart=t;usage[n.tier==='layout'?'layoutSeconds':'gpuSeconds']+=60;emit(t,'boot',`${n.tier==='layout'?'T4 layout':'L40S inference'} node ${n.id+1} starting (${n.ready-t} s assumed).`);};
 emit(0,'info','One hour of traffic. Two GPU pools; token throughput is a planning assumption, not an AWS benchmark.');
 if(cap.pending)emit(0,'pending',`${cap.pending} inference node(s) pending: requested capacity exceeds the exercise limit of ${config.quota}.`);
 for(let t=0;t<=SHIFT_SECONDS;t+=STEP){
  if(t>0){
   usage.storageGBSeconds+=storedGB*STEP;
   for(const n of nodes){
    if(n.state==='pending'||n.state==='sleep')continue;
    if(t-n.sessionStart>60)usage[n.tier==='layout'?'layoutSeconds':'gpuSeconds']+=Math.ceil(t-n.sessionStart)-Math.ceil(t-STEP-n.sessionStart);
    const kind=n.state==='busy'?'Busy':n.state==='boot'?'Boot':'Idle';usage[n.tier==='layout'?`layout${kind}Seconds`:`${kind.toLowerCase()}Seconds`]+=STEP;
    if(n.state==='busy'){
     const rate=n.tier==='layout'?contract.layoutRate/n.tasks.length:Math.min(PROFILE.streamTokensPerSecond,PROFILE.tokensPerSecond/n.tasks.length);
     for(const j of n.tasks){const amount=Math.min(j.remaining,rate*STEP);j.remaining-=amount;if(n.tier==='inference')usage.generatedTokens+=amount;}
    }
   }
  }
  for(const n of nodes){
   if(n.state==='boot'&&t>=n.ready){n.state='idle';n.idleSince=t;emit(t,'ready',`${n.tier==='layout'?'T4 layout':'L40S inference'} node ${n.id+1} ready.`);}
   if(n.state==='busy'){
    const completed=n.tasks.filter(j=>j.remaining<1e-7);n.tasks=n.tasks.filter(j=>j.remaining>=1e-7);
    for(const j of completed){if(n.tier==='layout'){transition(j,'queued',t);queue.push(j);}else finish(j,t);}
    if(!n.tasks.length){n.state='idle';n.idleSince=t;}
   }
  }
  availability(t);
  for(const j of incoming.get(t)||[]){transition(j,'prepQueue',t);prepQueue.push(j);if(usesS3(config)){usage.s3Puts++;storedGB+=j.pages/1024;}request();arrivedSince++;}
  if(t===contract.fault){
   const w=workers.find(n=>n.tasks.length)||workers.find(n=>n.state!=='pending'),interrupted=[...w.tasks];w.tasks=[];
   if(w.sessionStart===null)boot(w,t);else{w.state='boot';w.ready=t+PROFILE.inferenceBoot;}
   emit(t,'fault',`Inference GPU ${w.id+1} failed with ${interrupted.length} PDFs in flight. Replacement startup: ${PROFILE.inferenceBoot} s.`);
   for(const j of interrupted)fail(j,t);availability(t);
  }
  if(t===contract.duplicateAt){
   request();emit(t,'duplicate','PDF 1 resubmitted with the same stable job ID.');
   if(config.recovery&&published.has(0)){usage.s3Gets++;request(2);emit(t,'safe','Existing output found; duplicate job skipped.');}
   else{const j={...jobs[0],id:'replay',arrival:t,since:t,status:'incoming',finish:null,attempts:0,timing:timing()};transition(j,'prepQueue',t);prepQueue.push(j);}
  }
  for(const j of pendingRetries){if(t>=j.retryAt){pendingRetries.delete(j);if(config.dlq&&j.bad&&j.attempts>=2){transition(j,'quarantined',t);quarantined++;request(2);emit(t,'quarantine',`PDF ${j.logicalId+1} isolated after two failed attempts.`);}else{transition(j,'prepQueue',t);prepQueue.push(j);emit(t,'retry',`PDF ${j.logicalId+1} is visible again after its lease expired.`);}}}
  const scheduled=t>=PROFILE.scheduleStart&&t<PROFILE.scheduleEnd,work=prepQueue.length+queue.length+leased;
  for(const n of nodes){
   if(n.state==='sleep'&&(config.power==='warm'||config.power==='scheduled'&&scheduled||config.power==='demand'&&work))boot(n,t);
  }
  function dispatch(pool,waiting,slots,status){
   while(waiting.length&&(status!=='layout'||leased<config.layout*PROFILE.prefetchPerLayout)){
    const n=pool.filter(n=>(n.state==='idle'||n.state==='busy')&&n.tasks.length<slots).sort((a,b)=>a.tasks.length-b.tasks.length)[0];if(!n)break;
    const j=waiting.shift();transition(j,status,t);n.tasks.push(j);n.state='busy';
    if(status==='layout'){j.attempts++;j.lease=t+PROFILE.visibility;held.add(j);leased++;request();if(usesS3(config))usage.s3Gets+=1+(config.recovery?1:0);j.remaining=j.pages;}
    else j.remaining=j.bad?400:j.pages*contract.tokens;
   }
  }
  dispatch(layouts,prepQueue,PROFILE.layoutConcurrency,'layout');dispatch(workers,queue,config.batch,'working');
  if(config.queue==='sqs'&&t%PROFILE.heartbeat===0){for(const j of held){j.lease=t+PROFILE.visibility;request();}}
  if(t<SHIFT_SECONDS&&t%20===0)request(config.layout);
  for(const n of nodes){if(n.state==='idle'&&config.power!=='warm'&&!(config.power==='scheduled'&&scheduled)&&!work&&t-n.idleSince>=PROFILE.cooldown){n.state='sleep';n.sessionStart=null;}}
  availability(t);peak=Math.max(peak,queue.length);prepPeak=Math.max(prepPeak,prepQueue.length);
  if(t%FRAME_SECONDS===0){
   if(arrivedSince)emit(t,'arrival',`${arrivedSince} PDFs arrived since the previous snapshot.`);
   if(doneSince)emit(t,'done',`${doneSince} PDFs delivered since the previous snapshot.`);
   arrivedSince=0;doneSince=0;
   const snap=n=>({id:n.id,state:n.state,tasks:n.tasks.map(j=>j.id),remaining:n.state==='boot'?n.ready-t:0});
   trace.push({time:t,cost:total(t),done,onTime,donePages,queue:queue.length,prepQueue:prepQueue.length,layout:layouts.reduce((sum,n)=>sum+n.tasks.length,0),duplicates,quarantined,lost,workers:workers.map(snap),layouts:layouts.map(snap),tokenRate:(usage.generatedTokens-lastTokens)/FRAME_SECONDS,events:events.slice(eventCursor)});lastTokens=usage.generatedTokens;eventCursor=events.length;
  }
 }
 const valid=jobs.filter(j=>!j.bad),delivered=valid.filter(j=>j.finish!==null),waits=delivered.map(j=>j.finish-j.arrival).sort((a,b)=>a-b),latency=timing();
 for(const j of delivered)for(const key of Object.keys(latency))latency[key]+=j.timing[key]/delivered.length;
 const unfinished=jobs.filter(j=>j.finish===null&&!['stranded','failed','quarantined'].includes(j.status)).length,cost=total(SHIFT_SECONDS);
 const passed=onTime===valid.length&&cost<=contract.budget&&duplicates===0&&lost===0&&failed===0&&quarantined===(contract.bad?.length||0)&&unfinished===0&&!prepQueue.length&&!queue.length&&!pendingRetries.size&&nodes.every(n=>!n.tasks.length);
 return {config,contract:contract.id,trace,events,jobs,cost,costs:costs(SHIFT_SECONDS),usage,capacity:cap,done,onTime,total:jobs.length,target:valid.length,pages:jobs.length*contract.pages,donePages,duplicates,lost,failed,unfinished,quarantined,peak,prepPeak,retries,bootSeconds:usage.bootSeconds,latency,mean:waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:null,p95:waits.length?waits[Math.ceil(waits.length*.95)-1]:null,lastFinish:delivered.length?Math.max(...delivered.map(j=>j.finish)):null,passed,score:Math.max(0,Math.min(100,Math.round(70*onTime/valid.length+20*Math.min(1,contract.budget/cost)+10*(duplicates===0&&lost===0&&unfinished===0?1:0))))};
}
export function explain(r,previous){
 const c=r.config,notes=[];
 if(r.lost)notes.push(`${r.lost} jobs stopped without a retry. Their entries had already been removed from the Redis queue; ${usesS3(c)?'the input files remain in S3':'their document data and processing state remain in Redis'}. Recovering them requires additional job-handling code or the SQS variation.`);
 if(r.failed)notes.push(`The Redis worker recorded ${r.failed} parsing failures. Those files were not automatically retried or moved to the separate error queue required by this scenario.`);
 if(r.duplicates)notes.push('The same job published another output. SQS retries need stable output IDs and conditional commits to prevent duplicates.');
 if(r.capacity.pending)notes.push(`${r.capacity.pending} requested inference nodes remained pending. Increase the available capacity in this exercise; in AWS, check regional vCPU quota and actual instance availability.`);
 if(r.contract==='large'&&c.layout<4)notes.push(`The layout queue peaked at ${r.prepPeak} PDFs. Scale the T4 layout pool before adding more L40S inference capacity.`);
 if(r.contract==='poison'&&r.quarantined!==2)notes.push('Two PDFs cannot succeed through retries. Use SQS and a dead-letter queue after two failed attempts.');
 if(r.onTime<r.target)notes.push(`${r.target-r.onTime} valid PDFs missed the target or remain unfinished. Compare queue wait and startup with processing time below. P95 includes delivered PDFs only.`);
 if(r.cost>CONTRACTS.find(x=>x.id===r.contract).budget)notes.push(`The modeled bill is ${money(r.cost)}. Both GPU pools charge for startup and idle time.`);
 if(r.passed)notes.push('This configuration meets this scenario’s delivery and cost requirements. The processing rates are planning assumptions; an AWS deployment would need measurements with the same document types.');
 if(previous&&previous.contract===r.contract)notes.push(`Same traffic: ${money(Math.abs(r.cost-previous.cost))} ${r.cost>previous.cost?'more':'less'}; ${r.onTime-previous.onTime>=0?'+':''}${r.onTime-previous.onTime} valid PDFs on time. Delivered-PDF P95: ${duration(r.p95)}, previously ${duration(previous.p95)}.`);
 return notes;
}
