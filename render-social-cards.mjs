import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('.',import.meta.url)).replace(/\/$/,'');
const source=await readFile(root+'/public/index.html','utf8');
const illustration=source.match(/<svg viewBox="0 0 500 360"[\s\S]*?<\/svg>/)[0];
const logo=(await readFile(root+'/public/brand-logo.png')).toString('base64');
const variants=[
 {path:'/public/ocr-rush-social-v2.png',label:'A FREE AWS ARCHITECTURE GAME',heading:'Can your AWS design<br>handle <em>10,000<br>documents?</em>',description:'Process PDFs on time and within budget.<br>Six levels. Free to play. No AWS account.',footer:'marcelops.com/ocr-rush'},
 {path:'/public/article/article-social-v1.png',label:'THE OCR RUSH COMPANION ARTICLE',heading:'Can you get<br><em>10,000 invoices</em><br>processed on time?',description:'Learn what it takes to run an AWS service<br>that turns PDFs into text and tables.',footer:'marcelops.com/ocr-rush/article'}
];
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 for(const variant of variants){
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f6f7fb;color:#18314e;font-family:'DM Sans',sans-serif}.card{position:relative;width:1200px;height:630px;padding:38px 52px;border-bottom:10px solid #ff6719}header{display:flex;align-items:center;justify-content:space-between;height:60px}header img{width:177px}header .brand{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:37px;letter-spacing:-1.5px}.brand span{color:#e95910;margin-left:6px}.copy{position:relative;z-index:1;margin-top:40px;width:675px}.label{font-size:12px;font-weight:700;letter-spacing:1.6px;color:#456a8b;margin:0 0 17px}h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:57px;line-height:1.08;letter-spacing:-2px;margin:0 0 23px}h1 em{font-style:normal;color:#0053b4}.description{font-size:22px;line-height:1.55;color:#48617c;margin:0}.art{position:absolute;width:470px;right:9px;top:153px;transform:rotate(-3deg)}.art svg{display:block;width:100%;height:auto}.ground{position:absolute;right:44px;top:136px;width:357px;height:357px;border-radius:50%;background:#e9eff8;z-index:-1}.footer{position:absolute;bottom:29px;left:52px;font-size:15px;font-weight:600;color:#526d88}.footer-rule{position:absolute;left:52px;right:52px;bottom:63px;border-top:1px solid #d4deeb}
</style></head><body><div class="card"><header><img src="data:image/png;base64,${logo}" alt="Build With AWS"><div class="brand">OCR<span>RUSH</span></div></header><div class="copy"><p class="label">${variant.label}</p><h1>${variant.heading}</h1><p class="description">${variant.description}</p></div><div class="art"><div class="ground"></div>${illustration}</div><div class="footer-rule"></div><div class="footer">${variant.footer}</div></div></body></html>`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:root+variant.path});
  console.log('Created '+variant.path+' (1200 × 630)');
 }
}finally{await browser.close();}
