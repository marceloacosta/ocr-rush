import {challengeURL,localPreview,shareText} from './game.js?v=review-2';
import {drawCard,cardBlob} from './cards.js?v=review-2';
import {CONTRACTS} from './model.js?v=review-2';
import {money} from './pricing.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filename=(result,campaign)=>campaign?'ocr-rush-six-levels.png':`ocr-rush-level-${CONTRACTS.findIndex(c=>c.id===result.contract)+1}.png`;
function saveBlob(blob,name){
 if(!blob)throw Error('Image unavailable');
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function downloadResultCard(options){
 await document.fonts.ready;
 saveBlob(await cardBlob(options),filename(options.result,options.campaign));
}
export function openResultShare({result,best,campaign=false,modal}){
 if(!result||(campaign&&!best.every(Boolean)))return;
 best=[...best];
 const level=CONTRACTS.findIndex(c=>c.id===result.contract)+1;
 const text=campaign?`I completed all six levels of OCR Rush, the AWS architecture game. My best designs cost ${money(best.reduce((sum,r)=>sum+r.cost,0))} estimated USD across six one-hour workloads. Can you complete all six? Costs and throughput are simulated.`:shareText(result,best);
 // Local authoring uses the existing public deployment, so shared links work
 // for recipients on another device too.
 const root=new URL(localPreview(location.href)?'https://www.marcelops.com/ocr-rush/':location.href);
 root.search='';root.hash='';
 const url=campaign?root.href:challengeURL(root.href,result),caption=text+'\n'+url;
 const explanation=campaign?'Share your completion card and invite someone to finish all six levels.':result.passed?`This design completed level ${level} for ${money(result.cost)} USD. The link opens the same configuration so someone can replay it or try to complete the level for less.`:`This attempt cost ${money(result.cost)} USD and did not meet all the requirements. The link opens the exact configuration so someone can replay it and suggest a change.`;
 modal(campaign?'Share your six-level completion':`Share your level ${level} result`,`<p>${explanation}</p><label class="share-label" for="share-link">${campaign?'Game link':'Link to this run'}</label><input id="share-link" class="share-link" type="url" readonly value="${esc(url)}"><div class="share-actions"><button id="share-copy" class="primary">Copy link</button>${navigator.share?'<button id="share-native" class="secondary" aria-describedby="share-native-help" disabled>Preparing share…</button>':''}</div>${navigator.share?'<p id="share-native-help">Opens your device’s sharing options.</p>':''}<p id="share-status" role="status"></p><canvas id="share-preview" class="share-preview" role="img" aria-label="Your OCR Rush result card"></canvas><button id="share-download" class="secondary" disabled>Download result image</button><details class="share-post"><summary>Post text to use with your image</summary><label class="share-label" for="share-caption">Post text and link</label><textarea id="share-caption" readonly>${esc(caption)}</textarea><button id="share-caption-copy" class="secondary">Copy post text</button></details>`,'SHARE YOUR RESULT');
 const status=$('share-status'),canvas=$('share-preview'),native=$('share-native'),download=$('share-download');
 const linkField=$('share-link'),captionField=$('share-caption');
 let blob=null,file=null,shareImage=false;
 async function copy(value,field,success){
  try{await navigator.clipboard.writeText(value);status.textContent=success;}
  catch{field.closest('details')?.setAttribute('open','');field.focus();field.select();status.textContent='The text is selected. Press ⌘C on Mac or Ctrl+C on Windows, or use your phone’s Copy command.';}
 }
 $('share-copy').onclick=()=>copy(url,linkField,'Link copied. Paste it into a message or post.');
 $('share-caption-copy').onclick=()=>copy(caption,captionField,'Post text and link copied. Add the downloaded image to your post if you want to include the card.');
 download.onclick=()=>{
  try{saveBlob(blob,filename(result,campaign));status.textContent='Image download started. Use the link above with your image so others can play.';}
  catch{status.textContent='The image could not be downloaded. You can still copy the link above.';}
 };
 if(native)native.onclick=async()=>{
  native.disabled=true;status.textContent='';
  try{
   // Image creation happens before the click, preserving browser activation.
   const data=shareImage?{title:'OCR Rush · AWS architecture game',text:caption,files:[file]}:{title:'OCR Rush · AWS architecture game',text,url};
   await navigator.share(data);
   status.textContent='The result was handed to your selected app.';
  }catch(error){
   status.textContent=error.name==='AbortError'?'Sharing cancelled. You can try again or copy the link.':'The share menu could not send this result. Copy the link above, or download the image.';
  }finally{native.disabled=false;}
 };
 drawCard(canvas,{result,best,campaign});
 (async()=>{
  try{
   await document.fonts.ready;
   if(!canvas.isConnected)return;
   drawCard(canvas,{result,best,campaign});
   blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('Image unavailable');
   file=new File([blob],filename(result,campaign),{type:'image/png'});
   download.disabled=false;
   if(native){try{shareImage=!!navigator.canShare?.({files:[file],text:caption,title:'OCR Rush · AWS architecture game'});}catch{shareImage=false;}}
  }catch{if(canvas.isConnected)status.textContent='The result image is unavailable. You can still share the link.';}
  finally{if(native&&canvas.isConnected){native.textContent='Open share menu…';$('share-native-help').textContent=shareImage?'Opens your device’s sharing options with the image below and the game link.':'Opens your device’s sharing options with the game link.';native.disabled=false;}}
 })();
}
