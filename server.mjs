import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const escapeAttribute=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configuredOrigin=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL):null;
if(configuredOrigin&&!['http:','https:'].includes(configuredOrigin.protocol))throw Error('PUBLIC_URL must use HTTP or HTTPS');
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  let data=await readFile(file);
  if(path.extname(file)==='.html'){
   // PUBLIC_URL sets the canonical HTTPS origin behind a public reverse proxy.
   // Local previews use their requested host; no public hostname is invented.
   const origin=(configuredOrigin||new URL('http://'+(req.headers.host||'localhost:4174'))).origin;
   data=Buffer.from(data.toString().replaceAll('__PUBLIC_URL__',escapeAttribute(origin)));
  }
  res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4174),'127.0.0.1',()=>console.log('OCR Rush → http://localhost:'+Number(process.env.PORT||4174)));
