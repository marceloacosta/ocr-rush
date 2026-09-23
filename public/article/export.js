const status=document.getElementById('copy-status');
const body=document.getElementById('body');
const buttons=[...document.querySelectorAll('[data-copy]')];
const publicGame='https://www.marcelops.com/ocr-rush/';

function selectForManualCopy(target){
 target.focus();
 if(target instanceof HTMLTextAreaElement)target.select();
 else{
  const range=document.createRange();
  range.selectNodeContents(target);
  const selection=getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
 }
 status.textContent='The text is selected. Press ⌘C on Mac or Ctrl+C on Windows, then paste into Substack.';
}

try{
 const response=await fetch('./index.html');
 if(!response.ok)throw Error('Article unavailable');
 const article=new DOMParser().parseFromString(await response.text(),'text/html');
 document.getElementById('title').value=article.querySelector('h1').textContent;
 document.getElementById('subtitle').value=article.querySelector('.subtitle').textContent;
 // Only semantic article text is copied. The diagram is supplied as a separate
 // upload so the pasted article never depends on a localhost image URL.
 for(const element of article.querySelector('.article-body').children){
  if(element.tagName==='FIGURE')continue;
  const block=document.createElement(element.tagName==='H2'?'h2':'p');
  if(element.tagName==='H2'){
   const label=element.querySelector('.level-label');
   const prefix=label?label.textContent+': ':'';
   label?.remove();
   block.textContent=prefix+element.textContent;
  }else{
   block.innerHTML=element.innerHTML;
   for(const link of block.querySelectorAll('a')){
    if(link.getAttribute('href')==='../')link.href=publicGame;
    if(!link.href.startsWith('https://'))throw Error('Non-public export link');
   }
   for(const span of block.querySelectorAll('span'))span.replaceWith(span.textContent);
  }
  for(const node of [block,...block.querySelectorAll('*')]){
   for(const attribute of [...node.attributes])if(attribute.name!=='href')node.removeAttribute(attribute.name);
  }
  body.append(block);
 }
 buttons.forEach(button=>button.disabled=false);
 status.textContent='Ready to copy. The game link points to the public site.';
}catch{
 status.textContent='The article could not be loaded. Reload this page or download the Word document above.';
}

for(const button of buttons)button.addEventListener('click',async()=>{
 const target=document.getElementById(button.dataset.copy);
 const text=target===body?body.innerText:target.value;
 try{
  if(target===body){
   await navigator.clipboard.write([new ClipboardItem({
    'text/html':new Blob([body.innerHTML],{type:'text/html'}),
    'text/plain':new Blob([text],{type:'text/plain'})
   })]);
  }else await navigator.clipboard.writeText(text);
  status.textContent=target===body?'Formatted body copied. Paste into the Substack body with ⌘V or Ctrl+V. Add the diagram separately if you want to include it.':`${button.dataset.copy==='title'?'Title':'Subtitle'} copied. Paste it into the matching Substack field.`;
 }catch{selectForManualCopy(target);}
});
