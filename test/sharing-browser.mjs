import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT,simulate} from '../public/model.js';
import {readChallenge,writeProgress,PROGRESS_KEY} from '../public/game.js';

export async function checkSharing(browser){
 const base='https://www.marcelops.com/ocr-rush/';
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 await context.route('https://buildwithaws.substack.com/embed?*',route=>route.abort());
 await context.route(base+'**',async route=>{
  const url=new URL(route.request().url());
  const response=await context.request.get('http://127.0.0.1:4174'+url.pathname.replace('/ocr-rush','')+url.search);
  await route.fulfill({response});
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install();
 const enter=async url=>{await page.goto(url);await page.clock.fastForward(8100);await page.locator('#start').click();};
 const run=async()=>{await page.locator('#run').click();await page.clock.runFor(2200);await page.waitForFunction(()=>!document.getElementById('run').disabled);};
 try{
  await enter(base);await run();await page.locator('#share').click();
  const failedURL=await page.locator('#share-link').inputValue(),failed=readChallenge(failedURL).result;
  assert.equal(failed.passed,false);assert.deepEqual(failed.config,DEFAULT);
  assert.match(await page.locator('#dialog-body').innerText(),/did not meet all the requirements/);
  await page.locator('#share-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),failedURL);
  const download=page.waitForEvent('download');await page.locator('#share-download').click();await (await download).saveAs('/private/tmp/ocr-failed-attempt.png');
  const png=await readFile('/private/tmp/ocr-failed-attempt.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
  // A recipient's previous saved design must not overwrite the shared attempt.
  const saved=simulate({...DEFAULT,power:'demand'},0);
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROGRESS_KEY,value:writeProgress([saved,null,null,null,null,null],0,saved.config)});
  await enter(failedURL);
  assert.match(await page.locator('#challenge-target').innerText(),/shared attempt/i);
  assert.equal(await page.locator('[data-power="warm"]').getAttribute('aria-pressed'),'true');
  await run();await page.locator('#share').click();assert.equal(await page.locator('#share-link').inputValue(),failedURL);
  await page.keyboard.press('Escape');await page.locator('[data-power="demand"]').click();assert.ok(await page.locator('#share').isDisabled());
  await run();assert.ok(await page.locator('#share').isEnabled());await page.locator('#share').click();
  const passedURL=await page.locator('#share-link').inputValue();assert.equal(readChallenge(passedURL).result.passed,true);
  await page.locator('.share-post summary').click();await page.locator('#share-caption-copy').click();
  const caption=await page.evaluate(()=>navigator.clipboard.readText());assert.match(caption,/completed level 1/);assert.ok(caption.endsWith(passedURL));
  await page.keyboard.press('Escape');await enter(passedURL);assert.equal(await page.locator('[data-power="demand"]').getAttribute('aria-pressed'),'true');await run();
  // Verify native payloads without invoking an external app or sending a post.
  await page.evaluate(()=>{
   window.__mode='file';
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.__mode==='file'});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
    if(window.__mode==='cancel')throw new DOMException('Cancelled','AbortError');
    if(window.__mode==='error')throw new DOMException('Unavailable','NotAllowedError');
    window.__payload={text:data.text,url:data.url,files:data.files?.map(f=>({name:f.name,type:f.type,size:f.size})),active:navigator.userActivation.isActive};
   }});
  });
  await page.setViewportSize({width:390,height:844});await page.locator('#share').click();
  await page.locator('#share-native').click();
  let payload=await page.evaluate(()=>window.__payload);
  assert.equal(payload.files.length,1);assert.equal(payload.files[0].type,'image/png');assert.ok(payload.files[0].size>0);assert.ok(payload.text.endsWith(passedURL));assert.ok(payload.active);
  assert.ok(await page.evaluate(()=>document.getElementById('dialog').scrollWidth<=document.getElementById('dialog').clientWidth));
  await page.screenshot({path:'/private/tmp/ocr-share-mobile.png'});
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__mode='link');await page.locator('#share').click();
  await page.locator('#share-native').click();payload=await page.evaluate(()=>window.__payload);assert.equal(payload.url,passedURL);assert.equal(payload.files,undefined);
  await page.evaluate(()=>window.__mode='cancel');await page.locator('#share-native').click();assert.match(await page.locator('#share-status').innerText(),/cancelled/);
  await page.evaluate(()=>window.__mode='error');await page.locator('#share-native').click();assert.match(await page.locator('#share-status').innerText(),/Copy the link/);
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Blocked','NotAllowedError');};});
  await page.locator('#share-copy').click();assert.match(await page.locator('#share-status').innerText(),/text is selected/);
  assert.equal(await page.locator('#share-link').evaluate(el=>el.selectionEnd-el.selectionStart),passedURL.length);
  const oldLink=new URL(failedURL);oldLink.searchParams.set('v','4');
  await enter(oldLink.href);assert.match(await page.locator('#challenge-target').innerText(),/failure rules were corrected/);
  // Previously completed levels are retained only if they pass under the new rules.
  await page.evaluate(({key,value})=>{localStorage.clear();localStorage.setItem(key,value);},{key:'ocr-rush-progress-v4',value:JSON.stringify({version:4,best:[saved.config,null,null,null,null,null],stage:0,config:saved.config})});
  await enter(base);assert.match(await page.locator('#progress-summary').innerText(),/1 of 6/);
  assert.equal(await page.locator('[data-power="demand"]').getAttribute('aria-pressed'),'true');
  // Local previews produce public URLs that work on a recipient's device.
  await enter('http://127.0.0.1:4174/');await run();await page.locator('#share').click();
  assert.ok((await page.locator('#share-link').inputValue()).startsWith(base));
  assert.deepEqual(errors,[]);
  console.log('PASS: failed/passed designs reopen exactly, saved progress cannot replace the shared design, stale runs cannot be shared, real clipboard and PNG download, mobile image/link payloads, cancellation, share errors and clipboard fallback.');
 }finally{await context.close();}
}
