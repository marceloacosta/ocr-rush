import {cp, readdir, readFile, rm, writeFile} from 'node:fs/promises';

const url=new URL(process.env.PUBLIC_URL||'https://www.marcelops.com/ocr-rush/');
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('PUBLIC_URL must be a clean HTTPS site URL, including its deployment path.');
const base=url.href.replace(/\/+$/,'');
const output=new URL('./dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await cp(new URL('./public/',import.meta.url),output,{recursive:true});
const escapeAttribute=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Resolve metadata for the game and standalone pages under the deployment path.
async function resolvePages(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())await resolvePages(file);
  else if(entry.name.endsWith('.html')){
   const html=(await readFile(file,'utf8')).replaceAll('__PUBLIC_URL__',escapeAttribute(base));
   if(html.includes('__PUBLIC_URL__'))throw Error('Unresolved public URL in build.');
   await writeFile(file,html);
  }
 }
}
await resolvePages(output);
await writeFile(new URL('.nojekyll',output),'');
console.log(`Built OCR Rush for ${base}/ in dist/`);
