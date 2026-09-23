import assert from 'node:assert/strict';

// Read-only check of the real, hosted form. Never submits an email to Substack.
export async function checkNewsletter(browser){
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 const page=await context.newPage();
 try{
  const now=new Date('2026-09-23T12:00:00Z');
  await page.clock.install({time:new Date(now.getTime()-1000)});
  await page.clock.pauseAt(now);
  await page.goto('http://127.0.0.1:4174/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('#newsletter-dialog').isHidden());
  assert.ok(await page.locator('#start').isHidden());
  assert.ok(await page.locator('#start').isDisabled());
  assert.equal(await page.locator('#play-wait').innerText(),'You can play for free in 8 seconds.');
  assert.match(await page.locator('.newsletter-card .newsletter-return').innerText(),/Substack may open a new tab/);
  await page.clock.fastForward(7000);
  assert.equal(await page.locator('#play-wait').innerText(),'You can play for free in 1 second.');
  await page.clock.fastForward(999);
  assert.ok(await page.locator('#start').isHidden());
  await page.clock.fastForward(1);
  assert.ok(await page.locator('#start').isVisible());
  assert.ok(await page.locator('#start').isEnabled());
  assert.ok(await page.locator('#play-wait').isHidden());
  await page.clock.resume();
  const signup=page.frameLocator('#newsletter-embed');
  await signup.getByRole('textbox',{name:'Email',exact:true}).waitFor({timeout:45000});
  assert.match(await page.locator('#newsletter-embed').getAttribute('src'),/^https:\/\/buildwithaws\.substack\.com\/embed\?/);
  assert.match(await signup.locator('body').innerText(),/Subscribe/);
  const form=signup.locator('form');
  assert.match(await form.getAttribute('action'),/^\/api\/v1\/free/);
  assert.equal(await form.getAttribute('method'),'post');
  assert.ok(await page.locator('#start').isEnabled());
  assert.ok(await page.locator('#newsletter-invite').isHidden());
  assert.equal(await page.locator('#newsletter-dialog-embed').getAttribute('src'),null);
  await page.screenshot({path:'/private/tmp/ocr-newsletter-desktop.png',fullPage:true});
  for(const width of [320,390,760,1440]){
   await page.setViewportSize({width,height:900});
   // Substack's own responsive layout updates after the parent viewport resizes.
   await page.waitForTimeout(500);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);
   const metrics=await signup.locator('body').evaluate(body=>{
    const input=body.querySelector('input[type=email]').getBoundingClientRect();
    const button=body.querySelector('button[type=submit]').getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,scrollWidth:body.scrollWidth,input:input.toJSON(),button:button.toJSON()};
   });
   assert.ok(metrics.scrollWidth<=metrics.width,`embed overflow at ${width}`);
   assert.ok(metrics.input.width>=100&&metrics.input.left>=0&&metrics.input.top>=0&&metrics.button.right<=metrics.width&&metrics.button.bottom<=metrics.height,`clipped form at ${width}`);
   if(width===390)await page.screenshot({path:'/private/tmp/ocr-newsletter-mobile.png',fullPage:true});
  }
  await page.locator('#start').click();
  await page.locator('[data-power="demand"]').click();
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.getElementById('run').disabled);
  assert.ok(await page.locator('#newsletter-invite').isVisible());
  const result=await page.locator('#result-checks').innerText();
  await page.locator('#newsletter-open').click();
  assert.ok(await page.locator('#newsletter-dialog').isVisible());
  await page.frameLocator('#newsletter-dialog-embed').getByRole('textbox',{name:'Email',exact:true}).waitFor({timeout:45000});
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#newsletter-dialog').isHidden());
  assert.equal(await page.locator('#result-checks').innerText(),result);
  await page.waitForFunction(()=>document.activeElement===document.getElementById('newsletter-open'));
  await page.locator('#newsletter-dismiss').click();
  assert.ok(await page.locator('#newsletter-invite').isHidden());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#start').click();
  await page.locator('[data-power="demand"]').click();
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.getElementById('run').disabled);
  assert.ok(await page.locator('#newsletter-invite').isHidden());
  assert.ok(await page.locator('#next').isEnabled());
 }finally{await context.close();}

 // A blocked embed must not prevent the game from opening.
 const blocked=await browser.newContext({reducedMotion:'reduce'});
 try{
  await blocked.route('https://buildwithaws.substack.com/embed?*',route=>route.abort());
  const page=await blocked.newPage();
  await page.goto('http://127.0.0.1:4174/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('#start').isHidden());
  assert.ok(await page.locator('#newsletter-dialog').isHidden());
  assert.equal(await page.locator('.newsletter-card .newsletter-fallback').getAttribute('href'),'https://buildwithaws.substack.com/subscribe');
  await page.locator('#start').click();
  assert.ok(await page.locator('#game').isVisible());
 }finally{await blocked.close();}
 console.log('PASS: inline Substack form, return note, play button hidden for 8 seconds then enabled without signup, desktop/mobile sizing, contextual invitation, dismissal, preserved results and blocked-embed fallback. No subscription submitted.');
}
