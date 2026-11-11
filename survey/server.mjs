import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {configuration,openStore,hash,token,version,scopes,choices,policyFor,examples,questions,score} from './study.mjs';
import {page} from './views.mjs';
const config=configuration(),db=openStore(config.mode);
const css=readFileSync(new URL('./style.css',import.meta.url));
const bindPort=Number(process.env.SURVEY_PORT||4208);
const cookieName='memory_survey_'+config.mode;
const getCookie=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
const setCookie=(res,value)=>res.setHeader('Set-Cookie',cookieName+'='+value+'; Path=/; HttpOnly; SameSite=Strict'+(value?'':'; Max-Age=0'));
const steps={intent:'intent',rule:'rule',edit:'preview',confirm:'preview',predictions:'predict',finish:'reflect'};
function fail(reason){throw new Error(reason);}
function option(data,key,options){
 const v=data.get(key);
 if(!Object.hasOwn(options,v))fail('Select a response before continuing.');
 return v;
}
function note(data,key){
 const v=(data.get(key)||'').trim();if(v.length>1000)fail('Please keep each written answer under 1,001 characters.');
 return v;
}
async function handle(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 const host='127.0.0.1:'+server.address().port;
 if(req.headers.host!==host&&req.headers.host!=='localhost:'+server.address().port){res.writeHead(403);return res.end();}
 const show=(s,r={},msg='',status=200)=>{res.writeHead(status,{'content-type':'text/html; charset=utf-8'});res.end(page(config,s,r,msg));};
 const redirect=(url='/survey')=>{res.writeHead(303,{Location:url});res.end();};
 const path=req.url.split('?')[0];
 if(req.method==='GET'){
  if(path==='/style.css'){res.writeHead(200,{'Content-Type':'text/css'});return res.end(css);}
  if(path==='/'||path==='/survey'){
   let t=getCookie(req);if(!t||!/^[a-f0-9]{64}$/.test(t)){t=token();setCookie(res,t);}
   const row=db.prepare('SELECT * FROM sessions WHERE key=?').get(hash(t));
   if(!row)return show('welcome');
   if(row.step==='completed'){setCookie(res,'');return show('done',{code:row.code});}
   return show(row.step,JSON.parse(row.body));
  }
  if(path==='/discarded')return show('discarded');
  res.writeHead(404);return res.end();
 }
 if(req.method!=='POST'||req.headers.origin!=='http://'+req.headers.host||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){res.writeHead(403);return res.end();}
 const t=getCookie(req);if(!t||!/^[a-f0-9]{64}$/.test(t))return show('missing',{},'Open the survey on this device to begin.',409);
 const key=hash(t),action=path.slice(1);
 let body='';for await(const chunk of req){body+=chunk;if(body.length>20000){res.writeHead(413);return res.end();}}
 const data=new URLSearchParams(body);
 const row=db.prepare('SELECT * FROM sessions WHERE key=?').get(key);
 try{
  if(action==='begin'){
   if(row)return redirect();
   if(data.get('agree')!=='yes')return show('welcome',{},'Please read the information and confirm before beginning.',400);
   const record={started:new Date().toISOString(),protocol:version,mode:config.mode,consentHash:config.consentHash,information:config.information};
   db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(key,randomUUID(),'intent',JSON.stringify(record));
   return redirect();
  }
  if(!row)return show('missing',{},'This session is no longer active.',409);
  if(row.step==='completed')return redirect();
  if(action==='discard'){db.prepare('DELETE FROM sessions WHERE key=?').run(key);setCookie(res,'');return redirect('/discarded');}
  if(!Object.hasOwn(steps,action)){res.writeHead(404);return res.end();}
  if(steps[action]!==row.step)return redirect();
  const r=JSON.parse(row.body);let next;
  switch(action){
   case 'intent':r.intent=note(data,'intent');next='rule';break;
   case 'rule':r.scope=option(data,'scope',scopes);r.preview=examples(policyFor(r.scope));next='preview';break;
   case 'edit':next='rule';break;
   case 'confirm':r.ruleSavedAt=new Date().toISOString();next='predict';break;
   case 'predictions':{
    const predictions=Object.fromEntries(questions.map(q=>[q.id,option(data,q.id,choices)]));
    r.predictions=predictions;r.predictedAt=new Date().toISOString();
    r.outcomes=Object.fromEntries(questions.map(q=>[q.id,score(policyFor(r.scope),q)]));next='reflect';break;
   }
   case 'finish':r.fit=option(data,'fit',{yes:1,partly:1,no:1,unsure:1,skip:1});r.feedback=note(data,'feedback');r.submitted=new Date().toISOString();next='completed';break;
  }
  db.prepare('UPDATE sessions SET step=?,body=? WHERE key=? AND step=?').run(next,JSON.stringify(r),key,row.step);
  return redirect();
 }catch(err){if(!['Select a response before continuing.','Please keep each written answer under 1,001 characters.'].includes(err.message))throw err;
  return show(row?.step||'welcome',row?JSON.parse(row.body):{},err.message,400);}
}
const server=createServer((req,res)=>handle(req,res).catch(err=>{
 console.error('Survey request failed:',err.code||err.name);
 if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
 res.end('The server could not finish saving. Refresh on this device and check the current step.');
}));
server.listen(bindPort,'127.0.0.1',()=>console.log('Ready: http://127.0.0.1:'+server.address().port+'/survey ('+config.mode+')'));

