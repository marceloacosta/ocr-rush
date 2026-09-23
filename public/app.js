import {PROGRESS_KEY,LEVELS,readProgress,writeProgress,challengeURL,readChallenge,localPreview,compareChallenge,shareText} from './game.js';
import {drawCard,cardBlob} from './cards.js';
import {CONTRACTS,DEFAULT,normalize,designKey,simulate,explain,capacity,PROFILE,usesS3,deliveryName,FRAME_SECONDS} from './model.js';
import {AWS_MISSIONS,awsDesign,awsTakeaway,architectureContext} from './aws.js';
import {money,duration,clockTime} from './pricing.js';
import {modelAssumptions,costDetails,latencyDetails} from './research.js';
import {showNewsletterInvite} from './newsletter.js?v=inline-signup-1';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let saved=null,canSave=true;try{saved=readProgress(localStorage.getItem(PROGRESS_KEY));}catch{canSave=false;}
const incomingChallenge=readChallenge(location.href);
let stage=saved?.stage||0,config=saved?.config||{...DEFAULT},passed=saved?.best||CONTRACTS.map(()=>null),runs=passed.map(r=>r?[r]:[]),active=null,minute=0,running=false,paused=false,timer=null,drag=null,suppress=false,selectedWorker=false;
function persist(){try{localStorage.setItem(PROGRESS_KEY,writeProgress(passed,stage,config));}catch{canSave=false;}}
function renderProgress(){
 const count=passed.filter(Boolean).length;
 $('view-completion').hidden=count!==CONTRACTS.length;$('view-completion').disabled=running;
 $('level-position').textContent=`LEVEL ${stage+1} OF ${CONTRACTS.length}`;$('progress-summary').textContent=`${count} of ${CONTRACTS.length} levels completed`;$('level-progress').value=count;
 $('progress-detail').textContent=passed[stage]?`Your best completed design for this level costs ${money(passed[stage].cost)} USD. Replay it to improve that result.`:'Complete this level by meeting its delivery, cost and recovery requirements.';
 $('save-status').textContent=canSave?'Progress is saved in this browser. No account is needed.':'Progress is available for this visit. Browser storage is unavailable.';
 $('start').innerHTML=`${saved||count?'Continue playing':'Play the free game'} <span>→</span>`;
 $('welcome-progress').textContent=count?`${count} of 6 levels completed in this browser. Continue where you left off.`:'Free to play. No AWS account, download or cloud charges.';
 $('level-cards').innerHTML=LEVELS.map((l,i)=>`<article class="level-card ${passed[i]?'completed':''}"><span class="level-number">${passed[i]?'✓ Completed':'Level '+(i+1)}</span><h3>${esc(l.name)}</h3><p>${esc(l.learn)}</p></article>`).join('');
 const challenge=incomingChallenge.result,notice=challenge?`<h2>A shared challenge for level ${incomingChallenge.stage+1}</h2><p>This design meets all the level’s requirements for <strong>${money(challenge.cost)} USD</strong>. Play the same workload and try to complete it for less. The target is recalculated from the shared configuration using this simulation.</p>`:incomingChallenge.error?`<p>${esc(incomingChallenge.error)}</p>`:'';
 $('welcome-challenge').hidden=!notice;$('welcome-challenge').innerHTML=notice;
 $('challenge-target').hidden=!notice||(challenge&&stage!==incomingChallenge.stage);$('challenge-target').innerHTML=notice;
}

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const powerNames={warm:'Keep capacity ready',demand:'Queue activation',scheduled:'Scheduled upload'};
let selectedService='ec2';
function awsExplanation(context){return `<h3>${esc(context.title)}</h3><p>${esc(context.body)}</p><a href="${esc(context.url)}" target="_blank" rel="noopener">${esc(context.link)} ↗</a>`;}
function renderAWS(){
 $('aws-mission').textContent=AWS_MISSIONS[stage];
 $('aws-capacity').textContent=`${config.workers} GPU worker${config.workers===1?'':'s'} · ${powerNames[config.power]}`;
 $('aws-delivery-name').textContent=config.queue==='sqs'?'Amazon S3 + SQS':usesS3(config)?'Amazon S3 + Redis':'Redis storage and queue';
 $('aws-delivery-state').textContent=config.queue==='sqs'?'Retry unacknowledged jobs after visibility expiry':usesS3(config)?'Files in S3; job references in Redis':'Documents, job state and results in Redis';
 $('aws-delivery-actions').hidden=selectedService!=='delivery';
 $('open-delivery-controls').disabled=running;
 $('open-delivery-controls').textContent=running?'Queue changes available after this shift':'Change queue & recovery →';
 $('queue-round-note').textContent=stage===2?'This scenario introduces storage and recovery variations. First compare Redis with S3 storage alone, then add SQS to recover interrupted jobs.':stage===4?'Compare a recorded Redis error with SQS retry and dead-letter handling. The invalid files need to remain available for inspection.':'The starting implementation uses Redis. Scenario 3 introduces S3 storage and SQS job recovery as separate changes.';
 $('architecture-context').innerHTML=architectureContext(config);
 document.querySelectorAll('[data-service]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.service===selectedService)));
 $('aws-detail').innerHTML=awsExplanation(awsDesign(selectedService,config));
}
document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{selectedService=b.dataset.service;renderAWS();});
$('open-delivery-controls').onclick=()=>{
 if(running)return;
 $('recovery-controls').open=true;
 $('recovery-controls').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
 document.querySelector(`[data-queue="${config.queue}"]`).focus({preventScroll:true});
};
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
let modalTrigger=null;
function modal(title,content){modalTrigger=document.activeElement;$('dialog-body').innerHTML=`<p class="kicker">BEHIND THE FACTORY</p><h2 id="dialog-title">${title}</h2>${content}`;$('dialog').showModal();}
$('close-dialog').onclick=()=>$('dialog').close();$('dialog').addEventListener('close',()=>modalTrigger?.focus?.({preventScroll:true}));
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
function current(){return CONTRACTS[stage];}
function configName(c){return `${c.workers} L40S · ${c.layout} T4 · ${powerNames[c.power]} · ${c.batch} streams/GPU · capacity ${c.quota}`;}
function renderControls(){
 renderProgress();
 $('contracts').innerHTML=CONTRACTS.map((c,i)=>`<button data-contract="${i}" class="${stage===i?'active ':''}${passed[i]?'done':''}" ${running?'disabled':''} ${stage===i?'aria-current="step"':''} aria-label="Level ${i+1}: ${c.short}${passed[i]?', completed':''}"><b>${passed[i]?'✓':i+1}</b><span>${c.short}</span></button>`).join('');
 $('contract-label').textContent=current().label.replace('SCENARIO','LEVEL');$('contract-name').textContent=current().name;$('contract-brief').textContent=current().brief;$('note-number').textContent=String(stage+1).padStart(2,'0');const total=current().arrivals.length,bad=current().bad?.length||0;
 $('contract-goal').innerHTML=`<p>Deliver the extracted contents of <b>${(total-bad).toLocaleString('en-US')} ${bad?'valid ':''}PDFs</b>, containing ${((total-bad)*current().pages).toLocaleString('en-US')} pages, within <b>${duration(current().deadline)} of each upload</b>.</p><p>The estimated cost of this hour must stay within <b>${money(current().budget)} USD</b>.${stage===2?' Each PDF must produce one result, including after a retry or repeated submission.':''}${bad?` Retain the ${bad} invalid files in the separate error queue for inspection.`:''}${stage===5?' All documents must also finish before the hour ends.':''}</p>`;
 $('workload-facts').textContent=`${total} PDFs × ${current().pages} page${current().pages===1?'':'s'} = ${(total*current().pages).toLocaleString('en-US')} pages · 1-hour observation window`;
 $('deadline-reason').textContent=current().reason;
 $('cpu-note').textContent=`This workload assumes ${current().layoutRate} pages per second for each layout node. Your ${config.layout} selected node${config.layout===1?'':'s'} can prepare up to ${config.layout*current().layoutRate} pages per second in total, shared across the documents being processed.`;
 $('cpu-controls').open=stage===3||$('cpu-controls').open;$('quota-controls').open=[1,5].includes(stage)||$('quota-controls').open;
 $('dlq-toggle').checked=config.dlq;$('dlq-toggle').disabled=running||config.queue!=='sqs';
 $('worker-count').textContent=`${config.workers} / 8 bays filled`;$('worker-card').disabled=running||config.workers===8;$('remove-worker').disabled=running||config.workers===1;
 for(const key of ['power','batch','queue','layout','quota'])document.querySelectorAll(`[data-${key}]`).forEach(b=>{b.setAttribute('aria-pressed',String(String(config[key])===b.dataset[key]));b.disabled=running;});
 $('recovery-toggle').checked=config.recovery;$('recovery-toggle').disabled=running||!usesS3(config);$('reset').disabled=running;
 $('batch-note').textContent=config.batch===1?'One stream: at most 40 output tokens/s per node. Unused GPU throughput cannot help a serial worker.':'Up to 16 streams share at most 360 output tokens/s per node, with a 40 tokens/s limit per stream. More concurrency never creates unlimited throughput.';
 $('profile-summary').textContent=`Each PDF has ${current().pages} page${current().pages===1?'':'s'}, with an estimated ${current().tokens} output tokens per page. Each inference node can generate up to 360 tokens/s in total, with at most 40 tokens/s per document stream. These are planning assumptions, not measured AWS throughput.`;
 $('factory-state').textContent=running?(paused?'SHIFT PAUSED':'SHIFT IN PROGRESS'):'DESIGN MODE';
 $('run').disabled=running;$('run').innerHTML=`${runs[stage].length?'Replay this workload':'Run this workload'} <span>▶</span>`;$('pause').hidden=!running;$('pause').textContent=paused?'Resume':'Pause';
 $('run-note').textContent=runs[stage].length?'The next run uses the same uploads and failures so you can compare the change.':'Run this configuration, then change one setting and compare the results.';
 renderAWS();
}
function paper(x,y,color='#fff',id='',rotate=0){return `<g transform="translate(${x} ${y}) rotate(${rotate})"><path d="M0 0h20l8 8v32H0Z" fill="${color}" stroke="#a1b7d0" stroke-width="1.5"/><path d="M20 0v8h8M5 16h17M5 22h14M5 28h10" stroke="#9bb8d9" fill="none" stroke-width="1.5"/>${id?`<text x="14" y="36" text-anchor="middle" font-size="7" fill="#5278a4">${id}</text>`:''}</g>`;}
function machine(x,y,w,h,color,content,cls=''){return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M0 0 19-15 ${w+19}-15 ${w} 0Z" fill="#e4edf8" stroke="#b4c9df"/><path d="M${w} 0 ${w+19}-15v${h}L${w} ${h}Z" fill="#aac3df" stroke="#9fb9d8"/><rect width="${w}" height="${h}" rx="8" fill="white" stroke="#a7bfdc" stroke-width="1.5"/><rect x="0" y="${h-8}" width="${w}" height="8" rx="3" fill="#dce8f6"/><rect x="9" y="12" width="5" height="${h-30}" rx="2" fill="${color}"/>${content}</g>`;}
function renderFactory(frame){
 const cap=capacity(config,current()),idleNodes=(count,tier)=>Array.from({length:count},(_,id)=>({id,state:tier==='inference'&&id>=cap.nodes?'pending':config.power==='warm'?'idle':'sleep',tasks:[],remaining:0}));
 const f=frame||{time:0,cost:0,onTime:0,done:0,queue:0,prepQueue:0,duplicates:0,lost:0,quarantined:0,workers:idleNodes(config.workers,'inference'),layouts:idleNodes(config.layout,'layout')};
 $('on-time').innerHTML=`${f.onTime} <small>/ ${current().arrivals.length-(current().bad?.length||0)} valid PDFs</small>`;
 $('spend').innerHTML=`${money(f.cost)} <small>/ ${money(current().budget)}</small>`;$('spend').classList.toggle('over',f.cost>current().budget);
 $('waiting').innerHTML=`${f.queue+f.prepQueue} <small>PDFs in queues</small>`;$('clock').innerHTML=`${clockTime(f.time)} <small>/ 60:00</small>`;$('scrubber').value=f.time/FRAME_SECONDS;
 $('prep-wait').textContent=`${f.prepQueue.toLocaleString('en-US')} PDFs`;$('ocr-wait').textContent=`${f.queue.toLocaleString('en-US')} PDFs`;$('throughput').textContent=`${(cap.system*60).toFixed(0)} pages/min${cap.pending?` · ${cap.pending} pending`:''}`;
 let svg=`<defs><pattern id="floor" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ccdaeb"/></pattern></defs><rect x="15" y="25" width="970" height="390" rx="28" fill="url(#floor)"/><rect x="${usesS3(config)?(config.queue==='sqs'?337:165):40}" y="76" width="${usesS3(config)?(config.queue==='sqs'?490:662):940}" height="330" rx="18" fill="#edf4ff" fill-opacity=".65" stroke="#91b3df" stroke-dasharray="7 5"/><text x="352" y="61" font-size="16" font-weight="600" fill="#0053b4">Amazon EKS · two GPU pools</text>`;
 const line=d=>`<path class="belt" d="${d}" fill="none" stroke="#9bb7d8" stroke-width="3"/>`;
 svg+=line('M105 225H194M277 225H360M449 225H519M789 225H867');
 svg+=paper(60,204,'white','PDF',-6)+paper(68,198,'white','PDF',4);
 svg+=`<text x="85" y="281" text-anchor="middle" font-size="15" fill="#284a70">${usesS3(config)?'Amazon S3':'Upload API'}</text><text x="85" y="302" text-anchor="middle" font-size="12" fill="#587797">${usesS3(config)?'Input PDFs':'Receive PDFs'}</text>`;
 svg+=machine(185,187,105,79,'#cb9b45',`<text x="57" y="31" text-anchor="middle" font-size="19" fill="#775323">${f.prepQueue}</text><text x="57" y="53" text-anchor="middle" font-size="12" fill="#775323">waiting</text>`);
 svg+=`<text x="238" y="302" text-anchor="middle" font-size="15" fill="#284a70">${config.queue==='sqs'?'Amazon SQS':'Redis'}</text><text x="238" y="322" text-anchor="middle" font-size="11" fill="#587797">${usesS3(config)?'Job references':'Documents + jobs'}</text>`;
 svg+=machine(357,177,97,103,'#9b83bb',`<text x="53" y="29" text-anchor="middle" font-size="16" fill="#715493">${config.layout} × T4</text><text x="53" y="50" text-anchor="middle" font-size="12" fill="#715493">LAYOUT</text><text x="53" y="74" text-anchor="middle" font-size="10" fill="#715493">${f.layouts.filter(n=>n.state==='busy').length} busy · ${f.layouts.filter(n=>n.state==='boot').length} boot</text>`);
 svg+=`<text x="407" y="313" text-anchor="middle" font-size="12" fill="#587797">g4dn.4xlarge</text><text x="407" y="337" text-anchor="middle" font-size="11" fill="#587797">${f.queue} prepared</text><text x="670" y="100" text-anchor="middle" font-size="12" fill="#587797">L40S inference · g6e.4xlarge</text>`;
 for(let i=0;i<8;i++){
  const x=520+(i%2)*144,y=119+Math.floor(i/2)*65,w=f.workers[i];
  if(!w){svg+=`<g data-bay="${i}" tabindex="${running?'-1':'0'}" role="button" aria-label="Add GPU worker in bay ${i+1}" aria-disabled="${running}"><rect class="bay-outline" x="${x}" y="${y}" width="129" height="54" rx="8" fill="#f0f5fc" stroke="#adc3dc" stroke-dasharray="5 4"/><text x="${x+65}" y="${y+32}" text-anchor="middle" font-size="13" fill="#688bb3">+ add worker</text></g>`;continue;}
  const color={busy:'#0053b4',boot:'#c46a20',sleep:'#7f90a6',pending:'#a65838',idle:'#397f68'}[w.state],label=w.state==='busy'?`${w.tasks.length} streams`:w.state==='boot'?`startup ${w.remaining}s`:w.state==='pending'?'pending capacity':w.state==='sleep'?'sleeping':'ready · billed';
  svg+=`<g><rect x="${x}" y="${y}" width="129" height="54" rx="8" fill="white" stroke="${color}"/><circle cx="${x+12}" cy="${y+16}" r="3" fill="${color}"/><text x="${x+23}" y="${y+20}" font-size="13" font-weight="600" fill="${color}">L40S ${i+1}</text><text x="${x+12}" y="${y+41}" font-size="11" fill="${color}">${label}</text></g>`;
 }
 svg+=machine(866,187,91,79,'#4a9b7c',`<text x="48" y="33" text-anchor="middle" font-size="19" fill="#397e64">${f.done}</text><text x="48" y="54" text-anchor="middle" font-size="11" fill="#397e64">DELIVERED</text>`);
 svg+=`<text x="915" y="302" text-anchor="middle" font-size="15" fill="#284a70">${usesS3(config)?'S3 results':'Redis results'}</text><text x="915" y="324" text-anchor="middle" font-size="10" fill="#587797">${config.recovery?'One result per job':'Retrieved through API'}</text>`;
 if(config.dlq&&config.queue==='sqs')svg+=`<text x="236" y="370" text-anchor="middle" font-size="12" fill="#936220">DLQ · ${f.quarantined} isolated PDFs</text>`;
 if(f.lost)svg+=`<text x="236" y="394" text-anchor="middle" font-size="12" fill="#b15435">${f.lost} jobs without recovery</text>`;
 $('factory').innerHTML=svg;$('factory').classList.toggle('running',running&&!paused);
}
function clearPreview(){active=null;minute=0;$('scrubber').disabled=true;renderFactory();$('ticker').classList.remove('danger');$('ticker').innerHTML='<span>↻</span><p>The configuration has changed. Run the same workload again to compare delivery time and cost.</p>';if(!$('results').hidden){$('results').classList.add('stale');$('verdict').textContent='DESIGN CHANGED · REPLAY TO CHECK';$('next').disabled=true;}$('graduation').hidden=true;}
function change(key,value){if(running)return;config=normalize({...config,[key]:value});selectedService=['queue','recovery','dlq'].includes(key)?'delivery':['batch','layout'].includes(key)?'eks':'ec2';persist();renderControls();clearPreview();}
function addWorker(){if(running||config.workers>=8)return;change('workers',config.workers+1);selectedWorker=false;renderFactory();toast(`Worker ${config.workers} installed. Run the workload to compare its effect.`);}
function selectContract(i){if(running)return;stage=i;selectedService=i===2||i===4?'delivery':'ec2';const previous=runs[i].at(-1);if(previous)config={...previous.config};$('recovery-controls').open=i===2||i===4;$('results').hidden=true;$('graduation').hidden=true;active=null;minute=0;$('scrubber').disabled=true;renderControls();renderFactory();$('ticker').classList.remove('danger');$('ticker').innerHTML=`<span>${current().icon||'→'}</span><p>${esc(current().tip)}</p>`;persist();$('contract-name').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function enterGame(){$('welcome').hidden=true;$('game').hidden=false;renderControls();renderFactory();$('contract-name').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
$('start').onclick=enterGame;

$('dismiss-practice').onclick=()=>$('practice').hidden=true;
$('worker-card').onclick=()=>{if(!suppress)addWorker();};$('remove-worker').onclick=()=>change('workers',config.workers-1);$('reset').onclick=()=>{if(running)return;config={...DEFAULT};persist();renderControls();clearPreview();};
$('recovery-toggle').onchange=e=>change('recovery',e.target.checked);
$('dlq-toggle').onchange=e=>change('dlq',e.target.checked);
document.addEventListener('click',e=>{if(suppress)return;const contract=e.target.closest('[data-contract]');if(contract){selectContract(Number(contract.dataset.contract));return;}for(const key of ['power','batch','queue','layout','quota']){const b=e.target.closest(`[data-${key}]`);if(b){change(key,['batch','layout','quota'].includes(key)?Number(b.dataset[key]):b.dataset[key]);return;}}if(e.target.closest('[data-bay]'))addWorker();});
$('factory').addEventListener('keydown',e=>{if(e.target.closest('[data-bay]')&&['Enter',' '].includes(e.key)){e.preventDefault();addWorker();}});
$('worker-card').addEventListener('pointerdown',e=>{if(running||config.workers>=8||e.button!==0)return;drag={x:e.clientX,y:e.clientY,moved:false};});
document.addEventListener('pointermove',e=>{if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;drag.moved=true;e.preventDefault();$('ghost').hidden=false;$('ghost').style.left=e.clientX+'px';$('ghost').style.top=e.clientY+'px';document.querySelectorAll('.bay-outline').forEach(el=>el.classList.add('bay-highlight'));if(e.clientY>innerHeight-45)window.scrollBy(0,14);else if(e.clientY<45)window.scrollBy(0,-14);},{passive:false});
function cancelDrag(){drag=null;$('ghost').hidden=true;document.querySelectorAll('.bay-outline').forEach(el=>el.classList.remove('bay-highlight'));}
document.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;cancelDrag();if(moved){suppress=true;setTimeout(()=>suppress=false,0);if(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-bay]'))addWorker();else toast('Drop onto an empty GPU bay, or click the worker card to add it.');}});
document.addEventListener('pointercancel',cancelDrag);window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelDrag();});
function paintMinute(){const frame=active.trace[minute];renderFactory(frame);$('scrubber').value=minute;const candidates=active.events.filter(e=>e.time<=frame.time);const important=frame.events.find(e=>['fault','lost','duplicate','safe','retry','quarantine','error'].includes(e.kind));const event=important||frame.events.at(-1)||candidates.at(-1);if(event){$('ticker').classList.toggle('danger',['fault','lost'].includes(event.kind));$('ticker').innerHTML=`<span>${['fault','lost'].includes(event.kind)?'!':event.kind==='safe'?'✓':'→'}</span><p><strong>${clockTime(event.time)}</strong> · ${esc(event.text)}</p>`;}}
function advance(){if(!running||paused)return;minute++;paintMinute();if(minute>=active.trace.length-1){finishRun();return;}timer=setTimeout(advance,reduced?4:33);}
function startRun(){if(running)return;cancelDrag();active=simulate(config,stage);minute=0;running=true;paused=false;$('results').hidden=true;$('graduation').hidden=true;$('practice').hidden=true;$('scrubber').disabled=true;renderControls();paintMinute();document.querySelector('.factory-panel').scrollIntoView({behavior:'instant',block:'start'});timer=setTimeout(advance,reduced?4:33);}
function finishRun(){running=false;paused=false;clearTimeout(timer);const previous=runs[stage].at(-1);runs[stage].push(active);if(active.passed&&(!passed[stage]||active.cost<passed[stage].cost))passed[stage]=active;persist();renderControls();renderFactory(active.trace.at(-1));$('factory-state').textContent='SHIFT COMPLETE';$('scrubber').disabled=false;showResults(previous);}
$('run').onclick=startRun;$('pause').onclick=()=>{paused=!paused;if(paused)clearTimeout(timer);else timer=setTimeout(advance,reduced?4:33);renderControls();renderFactory(active.trace[minute]);};
$('scrubber').oninput=e=>{if(!active||running)return;minute=Number(e.target.value);paintMinute();$('factory-state').textContent='REPLAY · SCRUB TO EXPLORE';};
function showResults(previous){
 if(active.passed)showNewsletterInvite();
 const r=active;$('results').hidden=false;$('results').classList.remove('stale');$('results').classList.toggle('success',r.passed);$('verdict').textContent=r.passed?'LEVEL '+(stage+1)+' COMPLETED':'LEVEL '+(stage+1)+' · REQUIREMENTS NOT YET MET';$('result-title').textContent=r.passed?'This configuration meets the requirements.':r.lost?'Some interrupted jobs were not recovered.':r.duplicates?'A repeated job published another result.':current().bad&&r.quarantined<current().bad.length?'The invalid files need separate handling.':r.cost>current().budget?(r.done===r.total?'All files finished, but the cost exceeded the budget.':'The run exceeded the budget and left work incomplete.'):'Some documents missed the delivery target.';$('stamp').textContent=r.passed?'COMPLETE':'REVIEW RESULTS';
 $('level-reward').hidden=!r.passed;$('level-reward').innerHTML=r.passed?`<h3>Level ${stage+1} complete. ${passed.filter(Boolean).length} of 6 completed.</h3><p>${esc(LEVELS[stage].learn)} Your best completed design for this level costs ${money(passed[stage].cost)} USD.</p>${compareChallenge(r,incomingChallenge.result)?`<p class="challenge-comparison">${esc(compareChallenge(r,incomingChallenge.result))}</p>`:''}`:'';
 $('share').textContent=r.passed?'Share a level challenge':'Share this attempt';
 $('result-checks').innerHTML=[[r.onTime===r.target,`${r.onTime}/${r.target} valid PDFs on time`],[r.cost<=current().budget,`${money(r.cost)} / ${money(current().budget)} USD`],[r.lost===0&&r.unfinished===0&&r.failed===0,`${r.lost+r.unfinished+r.failed} without a result or isolation`],[r.duplicates===0,`${r.duplicates} duplicate results`],...(current().bad?[[r.quarantined===current().bad.length,`${r.quarantined}/${current().bad.length} broken PDFs isolated`]]:[])].map(([pass,text])=>`<span class="${pass?'pass':''}">${pass?'✓':'×'} ${text}</span>`).join('');
 $('lessons').innerHTML=explain(r,previous).map(t=>`<p>${esc(t)}</p>`).join('')+`<div class="aws-takeaway"><span class="kicker">WHAT THIS MEANS ON AWS</span>${awsExplanation(awsTakeaway(r))}</div>`;$('comparison').hidden=!previous;
 if(previous){$('comparison').innerHTML=`<table><thead><tr><th>Same workload</th><th>Previous design</th><th>This design</th></tr></thead><tbody><tr><td>Configuration</td><td>${esc(configName(previous.config))}<br>${deliveryName(previous.config)}${previous.config.recovery?' · idempotent':''}${previous.config.dlq&&previous.config.queue==='sqs'?' · DLQ after 2 failures':''}</td><td>${esc(configName(r.config))}<br>${deliveryName(r.config)}${r.config.recovery?' · idempotent':''}${r.config.dlq&&r.config.queue==='sqs'?' · DLQ after 2 failures':''}</td></tr><tr><td>On time</td><td>${previous.onTime}/${previous.target}</td><td class="${r.onTime>previous.onTime?'good':''}">${r.onTime}/${r.target}</td></tr><tr><td>Spending</td><td>${money(previous.cost)} USD</td><td class="${r.cost<previous.cost?'good':''}">${money(r.cost)} USD</td></tr><tr><td>P95 completion time</td><td>${duration(previous.p95)}</td><td>${duration(r.p95)}</td></tr><tr><td>Duplicate results</td><td>${previous.duplicates}</td><td>${r.duplicates}</td></tr></tbody></table>`;}
 $('latency-breakdown').innerHTML=latencyDetails(r);$('cost-breakdown').innerHTML=costDetails(r);
 $('event-log').innerHTML=r.events.map(e=>`<li><strong>${clockTime(e.time)}</strong> ${esc(e.text)}</li>`).join('');$('next').disabled=!r.passed;$('next').textContent=stage<CONTRACTS.length-1?'Play level '+(stage+2)+' →':'View completion card →';$('results').scrollIntoView({behavior:'instant',block:'nearest'});$('result-title').focus({preventScroll:true});
}
$('redesign').onclick=()=>{document.querySelector('.controls').scrollIntoView({behavior:'instant',block:'start'});$('worker-card').focus({preventScroll:true});};
$('next').onclick=()=>{if(!active?.passed||designKey(config)!==designKey(active.config))return;if(stage<CONTRACTS.length-1){selectContract(stage+1);return;}if(passed.every(Boolean)){$('graduation').hidden=false;$('graduation').scrollIntoView({behavior:'instant',block:'center'});}else{toast('Complete the remaining levels to earn the completion card.');selectContract(passed.findIndex(x=>!x));}};
$('tip').onclick=()=>modal('How to approach this scenario.',`<p>${esc(current().tip)}</p>`);
$('source-button').onclick=()=>modal('About OCR Rush.',`<p>OCR Rush is a free game for exploring AWS architecture decisions across six document-processing workloads. Start with an application on EKS, Redis storage and queues, and separate GPU pools for page preparation and text extraction.</p><p>Change capacity, storage or recovery settings, then replay the same arrivals and failures to compare delivery time and estimated cost. Completing a level means meeting its workload requirements; you can share that result and challenge someone to improve it.</p><p>The game does not create AWS resources or process real uploads. Processing speeds are simulation inputs, and prices are pinned reference estimates. Results are not an AWS benchmark.</p>`);
$('architecture').onclick=()=>modal('How this configuration processes a document.',`${architectureContext(config)}<h3>Selected document path</h3><pre>${usesS3(config)?'Upload API → S3 files → '+(config.queue==='sqs'?'SQS':'Redis job references'):'Upload API → Redis documents and task list'}
    → T4 layout → L40S / vLLM
    → ${usesS3(config)?'S3 result':'Redis result'} → API retrieval</pre><h3>The services supporting this path</h3><p>Amazon EKS runs the API, Redis and processing workers on Amazon EC2 CPU and GPU nodes. Amazon ECR stores their container images, Amazon EFS shares model weights, and Amazon EBS provides the nodes’ disks.</p><p>The nodes run inside an Amazon VPC. A NAT gateway provides outbound access for private nodes, and IAM roles control AWS permissions. The cost estimate includes the persistent platform and GPU disks; network traffic and storage performance are not simulated.</p><p>The deployment also has a separate access layer: Amazon API Gateway forwards requests through a VPC Link and an internal Network Load Balancer to the Rust API, while Amazon Cognito authenticates callers. Authentication and API Gateway usage charges are outside this game’s simulation.</p><p>S3 file storage and SQS job handling are options you can add when changing the starting Redis design.</p><h3>How workers scale</h3><p>The original KEDA configuration scales layout from Redis queue length and inference from vLLM waiting-request metrics. It keeps a minimum worker available during weekday business hours. The queue-activated option here adds an external wake-up signal for inference and assumes a node autoscaler or equivalent controller removes unused EC2 nodes.</p><p>Document-level request sharing is a simulation control. The reference worker collects up to four documents over 100 ms and dispatches region requests through its SDK. The simulation does not reproduce that scheduler, memory usage, or extraction quality.</p>`);
function assumptions(){modal('How time, capacity and cost are calculated.',modelAssumptions());}
$('assumptions').onclick=assumptions;$('cost-info').onclick=()=>modal('Where the USD estimate comes from.',(active?costDetails(active):'')+modelAssumptions(true));
async function downloadCard(campaign=false,result=runs[stage].at(-1)||passed[stage]){
 if(!result)return;await document.fonts.ready;const blob=await cardBlob({result,best:passed,campaign});if(!blob)return;
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=campaign?'ocr-rush-six-levels.png':'ocr-rush-level-'+(CONTRACTS.findIndex(c=>c.id===result.contract)+1)+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function openShare(campaign=false){
 const result=runs[stage].at(-1)||passed[stage];if(!result||(campaign&&!passed.every(Boolean)))return;
 const text=campaign?`I completed all six levels of OCR Rush, the AWS architecture game. My best designs cost ${money(passed.reduce((sum,r)=>sum+(r?.cost||0),0))} estimated USD across six one-hour workloads. Can you complete all six? Costs and throughput are simulated.`:shareText(result,passed);
 const root=new URL(location.href);root.search='';root.hash='';const url=campaign?root.href:challengeURL(location.href,result),isLocal=localPreview(location.href),caption=isLocal?text:text+'\n'+url;
 const explanation=isLocal?'This is a local preview. Download the image or copy its caption to share your result. A playable challenge link needs a public deployment.':campaign?'The link opens the game so someone else can try to complete all six levels.':result.passed?'The challenge link opens the same level and reproduces this configuration’s result. The recipient can try to meet every requirement at a lower cost.':'The link opens this level so someone else can try their own configuration.';
 modal(campaign?'Share your six-level completion.':result.passed?'Challenge someone on this level.':'Share this attempt.',`<canvas id="share-preview" class="share-preview" role="img" aria-label="Your OCR Rush result card"></canvas><p>${explanation}</p><label class="share-label" for="share-caption">Caption${isLocal?'':' and playable link'}</label><textarea id="share-caption" readonly>${esc(caption)}</textarea><div class="share-actions"><button id="share-download" class="primary">Download image ↓</button><button id="share-copy" class="secondary">${isLocal?'Copy caption':'Copy challenge link and caption'}</button>${!isLocal&&navigator.share?'<button id="share-native" class="secondary">Share…</button>':''}</div><p id="share-status" role="status"></p>`);
 const canvas=$('share-preview');drawCard(canvas,{result,best:passed,campaign});document.fonts.ready.then(()=>{if(canvas.isConnected)drawCard(canvas,{result,best:passed,campaign});});
 $('share-download').onclick=()=>downloadCard(campaign,result);
 $('share-copy').onclick=async()=>{try{await navigator.clipboard.writeText(caption);$('share-status').textContent='Copied. You can paste it into your post or message.';}catch{$('share-caption').focus();$('share-caption').select();$('share-status').textContent='Select and copy the caption above. Clipboard access is unavailable.';}};
 if($('share-native'))$('share-native').onclick=async()=>{try{await navigator.share({title:'OCR Rush · AWS architecture game',text,url});$('share-status').textContent='The share action completed.';}catch(e){if(e.name!=='AbortError')$('share-status').textContent='Sharing was unavailable. You can copy the link or download the image instead.';}};
}
$('share').onclick=()=>openShare();$('save').onclick=()=>downloadCard(true);$('share-campaign').onclick=()=>openShare(true);$('view-completion').onclick=()=>openShare(true);
const shared=new URLSearchParams(location.search).get('contract');if(CONTRACTS.some(c=>c.id===shared)){stage=CONTRACTS.findIndex(c=>c.id===shared);config=passed[stage]?.config||{...DEFAULT};}
renderControls();renderFactory();
