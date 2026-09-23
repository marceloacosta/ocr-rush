import {CONTRACTS,deliveryName} from './model.js';
import {money} from './pricing.js';
const FONT='"Space Grotesk",system-ui,sans-serif';
function rounded(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function write(ctx,text,x,y,size,color='#18314e',weight=500,maxWidth){ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;if(maxWidth===undefined)ctx.fillText(text,x,y);else ctx.fillText(text,x,y,maxWidth);}
function wrap(ctx,text,x,y,maxWidth,size,lineHeight,color='#526d88',weight=500){ctx.font=`${weight} ${size}px ${FONT}`;const words=text.split(' ');let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){write(ctx,line,x,y,size,color,weight);line=word;y+=lineHeight;}else line=next;}if(line)write(ctx,line,x,y,size,color,weight);return y+lineHeight;}
export function drawCard(canvas,{result=null,best=[],campaign=false,preview=false}={}){
 canvas.width=1200;canvas.height=630;const ctx=canvas.getContext('2d');
 rounded(ctx,0,0,1200,630,0,'#eef3fc');rounded(ctx,25,25,1150,580,24,'#fff');
 write(ctx,'OCR RUSH',65,79,27,'#0053b4',700);write(ctx,'AN AWS ARCHITECTURE GAME',260,78,15,'#506b89',600);
 ctx.textAlign='right';write(ctx,'BUILD WITH AWS',1135,78,16,'#506b89',600);ctx.textAlign='left';
 const index=result?CONTRACTS.findIndex(c=>c.id===result.contract):0,count=best.filter(Boolean).length;
 const all=campaign&&count===CONTRACTS.length;
 const title=preview?'Can you complete all six levels?':all?'All six levels completed.':result.passed?`Level ${index+1} complete.`:`Level ${index+1}: requirements not met.`;
 write(ctx,title,65,154,43,'#18314e',700,1060);
 let detail=preview?'Keep documents on time and within budget. Change the AWS architecture, replay the workload, and challenge someone to improve your result.':all?'Receipts, invoice uploads, worker failures, scanned reports, invalid files and a 10,000-document import.':CONTRACTS[index].name;
 wrap(ctx,detail,65,198,1050,23,32);
 const cost=all?best.reduce((sum,r)=>sum+r.cost,0):result?.cost;
 rounded(ctx,65,276,1070,130,14,'#edf4ff');
 if(preview){write(ctx,'6 levels',90,328,38,'#0053b4',700);write(ctx,'Learn AWS scaling, queues and recovery',90,374,24);}
 else{write(ctx,all?'BEST DESIGNS ACROSS SIX ONE-HOUR WORKLOADS':'ESTIMATED COST FOR THIS ONE-HOUR WORKLOAD',90,307,13,'#526d88',600);write(ctx,`${money(cost)} USD`,90,361,43,'#0053b4',700);write(ctx,all?'All delivery and recovery requirements met':`${result.onTime.toLocaleString('en-US')} / ${result.target.toLocaleString('en-US')} valid PDFs on time`,475,357,24,'#18314e',600,630);}
 if(!preview&&!all){write(ctx,`${result.config.layout} T4 layout node${result.config.layout===1?'':'s'} · ${result.config.workers} L40S inference node${result.config.workers===1?'':'s'}`,65,449,20);write(ctx,deliveryName(result.config),65,479,18,'#526d88');}
 else write(ctx,preview?'Free to play. No AWS account or cloud charges.':'Replay any level to find a lower-cost configuration.',65,457,23);
 for(let i=0;i<6;i++){const done=!!best[i];rounded(ctx,65+i*62,510,48,42,9,done?'#0053b4':'#e9eff8');write(ctx,String(i+1),82+i*62,539,20,done?'#fff':'#61758e',600);}
 write(ctx,preview?'Choose a level and compare your designs.':`${count} of 6 levels completed in this browser`,465,538,20,'#526d88');
 write(ctx,'marcelops.com/ocr-rush · Simulated results with AWS reference prices.',65,583,15,'#637e9b');
 return canvas;
}
export function cardBlob(options){const canvas=drawCard(document.createElement('canvas'),options);return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}
