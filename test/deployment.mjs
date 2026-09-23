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
   const file=pathname.slice('/ocr-rush/'.length)||'index.html';
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
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),base);
 assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),base+'social-preview.png');
 assert.equal(await page.locator('.level-card').count(),6);
 assert.equal(await page.locator('.service-chips').count(),0);
 await page.evaluate(async()=>{for(const url of ['./social-preview.png','./brand-logo.png','./favicon.svg']){const image=new Image();image.src=url;await image.decode();}});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
 }
 if(live)await page.frameLocator('#newsletter-embed').getByRole('textbox',{name:'Email',exact:true}).waitFor({timeout:45000});
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
 await page.locator('#start').click();
 await page.locator('#architecture').click();
 assert.match(await page.locator('#dialog-body').innerText(),/Amazon ECR/);
 assert.deepEqual(errors,[]);
 assert.deepEqual(failed,[]);
 console.log(`PASS: ${live?'live deployment and Substack form':'built static site'} at ${base}; assets, metadata, mobile layout, gameplay and playable challenges.`);
 await context.close();
}finally{await browser.close();}
