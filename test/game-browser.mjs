import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT,simulate,VERSION} from '../public/model.js';
import {challengeURL,writeProgress,PROGRESS_KEY} from '../public/game.js';
export async function checkGame(browser){
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),errors=[];
 await context.route('https://buildwithaws.substack.com/embed?*',r=>r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 const go=async url=>{const response=await page.goto(url);await page.clock.fastForward(8100);return response;};
 const reload=async()=>{await page.reload();await page.clock.fastForward(8100);};
 const origin='http://127.0.0.1:4174';
 const run=async()=>{await page.locator('#run').click();await page.clock.runFor(2200);await page.waitForFunction(()=>!document.getElementById('run').disabled);};
 try{
  const response=await go(origin);assert.ok(!(await response.text()).includes('__PUBLIC_URL__'));
  assert.match(await page.locator('.welcome-copy').innerText(),/architecture game/i);assert.match(await page.locator('.welcome-copy').innerText(),/six levels/i);assert.equal(await page.locator('.level-card').count(),6);assert.match(await page.locator('#level-map').innerText(),/what you’ll learn/i);
  assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),origin+'/ocr-rush-social-v2.png');assert.equal((await page.request.get(origin+'/ocr-rush-social-v2.png')).status(),200);
  await page.screenshot({path:'/private/tmp/ocr-game-welcome.png',fullPage:true});
  await page.locator('#start').click();assert.match(await page.locator('#progress-summary').innerText(),/0 of 6/);await run();assert.match(await page.locator('#progress-summary').innerText(),/0 of 6/);
  await page.locator('[data-power="demand"]').click();await run();assert.match(await page.locator('#progress-summary').innerText(),/1 of 6/);assert.match(await page.locator('#level-reward').innerText(),/Level 1 complete/);
  await page.locator('#share').click();assert.equal(await page.locator('#share-preview').getAttribute('width'),'1200');assert.match(await page.locator('#share-caption').inputValue(),/1\/6 levels completed/);assert.doesNotMatch(await page.locator('#share-caption').inputValue(),/localhost|127\.0\.0\.1/);
  await page.locator('#share-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#share-link').inputValue());
  const download=page.waitForEvent('download');await page.locator('#share-download').click();await (await download).saveAs('/private/tmp/ocr-game-share.png');const png=await readFile('/private/tmp/ocr-game-share.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
  await page.keyboard.press('Escape');await reload();assert.match(await page.locator('#welcome-progress').innerText(),/1 of 6 levels completed/);assert.match(await page.locator('#start').innerText(),/Continue playing/);await page.locator('#start').click();assert.equal(await page.locator('[data-power="demand"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-contract="0"]').getAttribute('aria-label'),'Level 1: Receipt uploads, completed');
  await reload();await page.locator('#start').click();await page.locator('[data-contract="2"]').click();assert.match(await page.locator('#level-position').innerText(),/LEVEL 3 OF 6/);
  for(const width of [320,390,760,1024,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`game overflow ${width}`);await reload();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`welcome overflow ${width}`);assert.ok(await page.evaluate(()=>{const top=s=>document.querySelector(s).getBoundingClientRect().top;return top('.welcome h1')<top('#level-map')&&top('.newsletter-card')<top('#level-map');}),`welcome reading order ${width}`);if(width===390)await page.screenshot({path:'/private/tmp/ocr-game-welcome-mobile.png',fullPage:true});await page.locator('#start').click();}
  const target=simulate({...DEFAULT,power:'demand',layout:2},0);assert.ok(target.passed);await go(challengeURL(origin,target));assert.match(await page.locator('#welcome-challenge').innerText(),/shared challenge for level 1/i);await page.locator('#start').click();await page.locator('#reset').click();await page.locator('[data-power="demand"]').click();await run();assert.match(await page.locator('.challenge-comparison').innerText(),/less than the shared design/);
  const designs=[{power:'demand'},{workers:4,power:'scheduled',quota:4},{workers:4,power:'scheduled',quota:4,queue:'sqs',recovery:true},{workers:4,power:'scheduled',quota:4,layout:4},{workers:4,power:'scheduled',quota:4,queue:'sqs',recovery:true,dlq:true},{workers:8,power:'demand',layout:2,quota:8}];
  const best=designs.map((c,i)=>simulate({...DEFAULT,...c},i));assert.ok(best.every(r=>r.passed));
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROGRESS_KEY,value:writeProgress(best,5,best[5].config)});
  await go(origin);await page.locator('#start').click();assert.match(await page.locator('#progress-summary').innerText(),/6 of 6/);await page.locator('#view-completion').click();assert.match(await page.locator('#share-caption').inputValue(),/completed all six levels/);
  const completion=page.waitForEvent('download');await page.locator('#share-download').click();await (await completion).saveAs('/private/tmp/ocr-game-completion.png');await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
 const blocked=await browser.newContext();await blocked.route('https://buildwithaws.substack.com/embed?*',r=>r.abort());
 try{await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));const p=await blocked.newPage();await p.goto(origin);await p.locator('#start').click();assert.match(await p.locator('#save-status').innerText(),/unavailable/);}finally{await blocked.close();}
 // A routed test origin exercises public sharing without publishing or contacting a social service.
 const publicContext=await browser.newContext({reducedMotion:'reduce'});
 await publicContext.route('https://buildwithaws.substack.com/embed?*',r=>r.abort());
 await publicContext.route('https://ocr-game.test/**',async route=>{const u=new URL(route.request().url()),r=await publicContext.request.get(origin+u.pathname+u.search);await route.fulfill({response:r});});
 try{
  await publicContext.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});Object.defineProperty(navigator,'share',{value:async data=>{window.__shared=data;},configurable:true});});
  const p=await publicContext.newPage();await p.goto('https://ocr-game.test/');await p.locator('#start').click();await p.locator('[data-power="demand"]').click();await p.locator('#run').click();await p.waitForFunction(()=>!document.getElementById('run').disabled);await p.locator('#share').click();const caption=await p.locator('#share-caption').inputValue();assert.ok(caption.includes(`https://ocr-game.test/?contract=quiet&v=${VERSION}&design=`));await p.locator('#share-native').click();const data=await p.evaluate(()=>window.__shared);assert.ok(data.url.includes('design='));assert.match(data.text,/completed level 1/);
 }finally{await publicContext.close();}
 console.log('PASS: game onboarding, six learning levels, earned completion, saved progress, local caption/image sharing, reproducible challenges, public share fallback, metadata and mobile layouts.');
}
