import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {SCENARIOS} from '../src/repair-cases.mjs';
import {rulesFor,probesFor,candidates,rank,yes} from '../src/diagnostic.mjs';
import {workshopPreview} from './workshop-preview.mjs';
import {enumerate,permits} from '../src/extension.mjs';
export function start(port=0){const workshop=workshopPreview();return createServer(async(req,res)=>{try{
 if(await workshop(req,res))return;
 if(req.url==='/extended'&&req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(new URL('./extension.html',import.meta.url)));}
 if(req.url==='/expanded'&&req.method==='POST'){
  let raw='';for await(const c of req){raw+=c;if(raw.length>4096)throw Error('Large request');}
  const {rule,c}=JSON.parse(raw),e=SCENARIOS.find(s=>s.id==='lighting').event;
  const known=enumerate(e,4).find(r=>Object.entries(r).every(([k,v])=>rule[k]===v));
  if(!known||!['self','other'].includes(c.person)||!['original','different'].includes(c.task)||!Number.isInteger(c.day)||c.day<0||!['recall','recommendation','preference','trait','handoff','follow-up'].includes(c.purpose))throw Error('Unknown rule or request');
  const allowed=permits(e,known,{...c,task:c.task==='original'?e.task:'another task'});
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({outcome:allowed?'Allowed':'Blocked'}));
 }
 if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(new URL('./index.html',import.meta.url)));}
 if(req.url!='/preview'||req.method!=='POST'){res.writeHead(404);return res.end();}
 let body='';for await(const ch of req){body+=ch;if(body.length>8192)throw Error('Too many answers');}
 const {id,history}=JSON.parse(body);const s=SCENARIOS.find(x=>x.id===id);const e=s.event,ps=probesFor(e);
 if(!Array.isArray(history)||history.length>16||history.some(h=>!Number.isInteger(h.index)||!ps[h.index]||typeof h.allowed!=='boolean'))throw Error('Invalid answers');
 const remaining=candidates(e,rulesFor(e),history.map(h=>({probe:ps[h.index],allowed:h.allowed})));
 const best=remaining.length>1?rank(e,remaining,ps)[0]:null;
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({event:e.text,remaining:remaining.length,next:best?{...best,index:ps.indexOf(best.probe)}:null}));
 }catch{res.writeHead(400);res.end('Invalid request');}}).listen(port,'127.0.0.1');}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href)start(Number(process.argv[2]||4199));
