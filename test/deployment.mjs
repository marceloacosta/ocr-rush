import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base='https://www.marcelops.com/ocr-rush/';
const live=process.argv.includes('--live');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[],failed=[];
 if(!live){
  // Exercise the built files at the exact production path before publishing.
  await context.route('https://www.marcelops.com/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(!pathname.startsWith('/ocr-rush/'))return route.fulfill({status:404,body:'Wrong asset path'});
   const relative=pathname.slice('/ocr-rush/'.length);
   const file=relative===''||relative.endsWith('/')?relative+'index.html':relative;
   try{
    const body=await readFile(new URL('../dist/'+file,import.meta.url));
    const type={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'}[file.split('.').at(-1)];
    await route.fulfill({status:200,body,contentType:type||'application/octet-stream'});
   }catch{await route.fulfill({status:404,body:'Missing asset'});}
  });
  await context.route('https://buildwithaws.substack.com/embed?*',route=>route.abort());
 }
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)failed.push(response.url());});
 async function checkShareImage(path){
  const imageUrl=base+path;
  assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),imageUrl);
  assert.equal(await page.locator('meta[property="og:image:secure_url"]').getAttribute('content'),imageUrl);
  assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'),imageUrl);
  assert.equal(await page.locator('meta[property="og:image:type"]').getAttribute('content'),'image/png');
  const size=await page.evaluate(async url=>{
   const image=new Image();image.src=url;await image.decode();
   return [image.naturalWidth,image.naturalHeight];
  },imageUrl);
  assert.deepEqual(size,[1200,630]);
 }
 const articleResponse=await page.goto(base+'article/',{waitUntil:'domcontentloaded'});
 assert.equal(articleResponse.status(),200);
 assert.match(await page.locator('h1').innerText(),/Can you get 10,000 invoices processed on time/);
 assert.equal(await page.locator('h2[id^="level-"]').count(),6);
 assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+'article/');
 assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),base+'article/');
 await checkShareImage('article/article-social-v1.png');
 assert.equal(await page.locator('.play-cta a').evaluate(a=>a.href),base);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`article overflow at ${width}`);
 }
 const articleText=await page.locator('.byline a[download]').evaluate(async a=>{
  const response=await fetch(a.href);
  return {status:response.status,text:await response.text()};
 });
 assert.equal(articleText.status,200);
 assert.match(articleText.text,/\[\*\*Play OCR Rush/);
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 assert.ok(await page.locator('#newsletter-dialog').isHidden());
 assert.ok(await page.locator('#start').isHidden());
 assert.ok(await page.locator('#start').isDisabled());
 assert.match(await page.locator('.newsletter-card .newsletter-return').innerText(),/Substack may open a new tab/);
 assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),base);
 await checkShareImage('ocr-rush-social-v2.png');
 assert.equal(await page.locator('.level-card').count(),6);
 assert.equal(await page.locator('.service-chips').count(),0);
 await page.evaluate(async()=>{for(const url of ['./brand-logo.png','./favicon.svg']){const image=new Image();image.src=url;await image.decode();}});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
 }
 if(live)await page.frameLocator('#newsletter-embed').getByRole('textbox',{name:'Email',exact:true}).waitFor({timeout:45000});
 await page.locator('#start').waitFor({state:'visible',timeout:12000});
 assert.ok(await page.locator('#start').isEnabled());
 await page.locator('#start').click();
 await page.locator('[data-power="demand"]').click();
 await page.locator('#run').click();
 await page.waitForFunction(()=>!document.getElementById('run').disabled);
 assert.ok(await page.locator('#next').isEnabled());
 await page.locator('#share').click();
 const caption=await page.locator('#share-caption').inputValue();
 const challenge=caption.split('\n').find(line=>line.startsWith(base));
 assert.ok(challenge,'Share caption must include a playable URL under /ocr-rush/');
 assert.ok(new URL(challenge).searchParams.has('design'));
 await page.goto(challenge,{waitUntil:'domcontentloaded'});
 assert.match(await page.locator('#welcome-challenge').innerText(),/shared challenge for level 1/i);
 await page.locator('#start').waitFor({state:'visible',timeout:12000});
 await page.locator('#start').click();
 await page.locator('#game').waitFor({state:'visible'});
 await page.locator('#architecture').click();
 assert.match(await page.locator('#dialog-body').innerText(),/Amazon ECR/);
 await page.keyboard.press('Escape');
 await page.locator('#reset').click();
 await page.locator('#run').click();
 await page.waitForFunction(()=>!document.getElementById('run').disabled);
 await page.locator('#share').click();
 const failedAttempt=await page.locator('#share-link').inputValue();
 assert.ok(new URL(failedAttempt).searchParams.has('design'));
 assert.match(await page.locator('#dialog-body').innerText(),/did not meet all the requirements/);
 await page.keyboard.press('Escape');
 // Reopening an unsuccessful shared run must override a different saved design.
 await page.locator('[data-power="demand"]').click();
 assert.ok(await page.locator('#share').isDisabled());
 await page.goto(failedAttempt,{waitUntil:'domcontentloaded'});
 assert.match(await page.locator('#welcome-challenge').innerText(),/shared attempt for level 1/i);
 await page.locator('#start').click();
 assert.equal(await page.locator('[data-power="warm"]').getAttribute('aria-pressed'),'true');
 await page.locator('#run').click();
 await page.waitForFunction(()=>!document.getElementById('run').disabled);
 await page.locator('#share').click();
 assert.equal(await page.locator('#share-link').inputValue(),failedAttempt);
 assert.deepEqual(errors,[]);
 assert.deepEqual(failed,[]);
 console.log(`PASS: ${live?'live deployment and Substack form':'built static site'} at ${base}; companion article, inline signup, delayed game entry, return note, assets, metadata, mobile layout, gameplay and exact passed/failed shared designs.`);
 await context.close();
}finally{await browser.close();}
