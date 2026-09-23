import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.argv.includes('--live')?'https://www.marcelops.com/ocr-rush/article/':'http://localhost:4174/article/';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1100,height:900}});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'substack.html');
 await page.waitForFunction(()=>!document.querySelector('[data-copy="body"]').disabled);
 assert.equal(await page.locator('#body h2').count(),7);
 for(const field of ['title','subtitle']){
  await page.locator(`[data-copy="${field}"]`).click();
  await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes(' copied.'));
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#'+field).inputValue());
 }
 await page.locator('[data-copy="body"]').click();
 await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.startsWith('Formatted body copied.'));
 const clipboard=await page.evaluate(async()=>{
  const [item]=await navigator.clipboard.read();
  return {types:item.types,html:await (await item.getType('text/html')).text()};
 });
 assert.ok(clipboard.types.includes('text/html'));
 assert.ok(clipboard.types.includes('text/plain'));
 assert.ok(!clipboard.html.includes('localhost'));
 assert.ok(!clipboard.html.includes('document-journey.png'));
 // Exercise the browser's real rich-text paste, not just the serialized HTML.
 await page.evaluate(()=>{
  const target=document.createElement('div');
  target.id='paste-target';target.contentEditable='true';
  document.body.append(target);
 });
 await page.locator('#paste-target').focus();
 await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
 await page.locator('#paste-target h2').first().waitFor();
 assert.equal(await page.locator('#paste-target h2').count(),7);
 assert.equal(await page.locator('#paste-target h2').first().innerText(),'Level 1: Control the cost of occasional uploads');
 assert.ok(await page.locator('#paste-target strong').count()>0);
 const links=await page.locator('#paste-target a').evaluateAll(es=>es.map(a=>a.href));
 assert.ok(links.includes('https://www.marcelops.com/ocr-rush/'));
 assert.deepEqual(links.slice(-2),['https://buildwithaws.substack.com/','https://linkedin.com/in/marceloacostacavalero']);
 assert.ok(links.every(link=>link.startsWith('https://')));
 await page.locator('#paste-target').evaluate(node=>node.remove());
 for(const width of [320,390,1100]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
 }
 await page.screenshot({path:'/private/tmp/ocr-substack-export.png'});
 const documentResponse=await page.request.get(base+'ocr-rush-companion.docx');
 assert.equal(documentResponse.status(),200);
 assert.equal((await documentResponse.body()).subarray(0,2).toString(),'PK');
 const diagramResponse=await page.request.get(base+'document-journey.png');
 assert.equal(diagramResponse.status(),200);
 assert.equal((await diagramResponse.body()).subarray(1,4).toString(),'PNG');
 // A blocked clipboard must select the body and tell the user how to copy it.
 await page.evaluate(()=>{navigator.clipboard.write=async()=>{throw Error('Permission denied');};});
 await page.locator('[data-copy="body"]').click();
 await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.startsWith('The text is selected.'));
 assert.match(await page.evaluate(()=>getSelection().toString()),/Play OCR Rush/);
 assert.deepEqual(errors,[]);
 console.log(`PASS at ${base}: title/subtitle copy, HTML clipboard and real rich-text paste, seven headings, emphasis, public links, diagram download, Word download, mobile layout and clipboard fallback. No Substack draft was created.`);
}finally{await browser.close();}
