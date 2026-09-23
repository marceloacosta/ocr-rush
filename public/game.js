import {CONTRACTS,VERSION,normalize,simulate} from './model.js';
import {money} from './pricing.js';
export const PROGRESS_KEY=`ocr-rush-progress-v${VERSION}`;
export const LEVELS=[
 {name:'Control the cost of occasional uploads',learn:'Learn when shutting down idle GPUs saves money, and when their startup time makes a delivery late.'},
 {name:'Prepare for a large invoice upload',learn:'Learn how scheduled capacity and concurrent processing affect the queue when many documents arrive together.'},
 {name:'Recover from a worker failure',learn:'Learn why storing a file, retrying a job and preventing a duplicate result require different changes.'},
 {name:'Find the stage that limits throughput',learn:'Learn to distinguish slow page preparation from slow inference before paying for more GPUs.'},
 {name:'Handle files that cannot be processed',learn:'Learn when to stop retrying and retain a failed document for someone to inspect.'},
 {name:'Complete a 10,000-document import',learn:'Learn why requested workers can remain pending and how to balance both processing stages at a larger scale.'}
];
export function readProgress(raw){
 try{
  const data=JSON.parse(raw);if(data?.version!==VERSION||!Array.isArray(data.best)||data.best.length!==CONTRACTS.length)return null;
  const best=data.best.map((config,i)=>{if(!config||typeof config!=='object'||Array.isArray(config))return null;const r=simulate(normalize(config),i);return r.passed?r:null;});
  const stage=Number.isInteger(data.stage)&&data.stage>=0&&data.stage<CONTRACTS.length?data.stage:0;
  return {best,stage,config:normalize(data.config)};
 }catch{return null;}
}
export function writeProgress(best,stage,config){return JSON.stringify({version:VERSION,best:best.map(r=>r?.passed?r.config:null),stage,config:normalize(config)});}
export function challengeURL(base,result){
 const url=new URL(base);url.search='';url.hash='';url.searchParams.set('contract',result.contract);
 if(result.passed){url.searchParams.set('v',String(VERSION));url.searchParams.set('design',JSON.stringify(normalize(result.config)));}
 return url.href;
}
export function readChallenge(base){
 const url=new URL(base),raw=url.searchParams.get('design');if(!raw)return {result:null,error:null};
 if(url.searchParams.get('v')!==String(VERSION))return {result:null,error:'This challenge uses a different version of the simulation. You can still play the level, but its previous cost is not comparable.'};
 try{
  if(raw.length>600)throw Error('oversized');const parsed=JSON.parse(raw),stage=CONTRACTS.findIndex(c=>c.id===url.searchParams.get('contract'));
  if(stage<0||!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('invalid');
  const config=normalize(parsed);
  if(Object.keys(config).some(k=>parsed[k]!==config[k])||Object.keys(parsed).length!==Object.keys(config).length)throw Error('invalid');
  const result=simulate(config,stage);if(!result.passed)throw Error('not a passing design');
  return {result,stage,error:null};
 }catch{return {result:null,error:'This shared design could not be reproduced. You can still play the level from its starting configuration.'};}
}
export const localPreview=base=>['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
export function compareChallenge(result,target){
 if(!target||result.contract!==target.contract)return null;
 if(!result.passed)return 'Meet this level’s delivery, recovery and budget requirements before comparing cost with the shared design.';
 const diff=Math.round(target.cost*100)-Math.round(result.cost*100);
 return diff>0?`You completed the same level for ${money(diff/100)} less than the shared design.`:diff===0?'You matched the shared design’s displayed cost while meeting the same requirements.':`You completed the level. The shared design costs ${money(-diff/100)} less at the displayed precision.`;
}
export function shareText(result,best){const index=CONTRACTS.findIndex(c=>c.id===result.contract),count=best.filter(Boolean).length;return result.passed?`I completed level ${index+1} of OCR Rush, the AWS architecture game: ${result.onTime.toLocaleString('en-US')}/${result.target.toLocaleString('en-US')} valid PDFs on time for ${money(result.cost)} estimated USD. ${count}/6 levels completed. Can you meet the same requirements for less? Costs and throughput are simulated.`:`I tried level ${index+1} of OCR Rush, the AWS architecture game. ${result.onTime.toLocaleString('en-US')}/${result.target.toLocaleString('en-US')} valid PDFs arrived on time for ${money(result.cost)} estimated USD. What would you change? Costs and throughput are simulated.`;}
