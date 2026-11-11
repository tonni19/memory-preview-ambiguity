import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {newRepairData,repairView,repairAction} from '../src/repair.mjs';
const assets={'/workshop':['repair.html','text/html'],'/repair':['repair.html','text/html'],'/repair.css':['repair.css','text/css'],'/repair-client.mjs':['repair-client.mjs','text/javascript'],'/mark.svg':['mark.svg','image/svg+xml']};
export function workshopPreview(){const sessions=new Map();
return async(req,res)=>{
 if(req.method==='GET'&&Object.hasOwn(assets,req.url)){const [file,type]=assets[req.url];res.setHeader('content-type',type+'; charset=utf-8');res.end(await readFile(new URL('./workshop/'+file,import.meta.url)));return true;}
 if(!req.url.startsWith('/api/study/'))return false;
 res.setHeader('content-type','application/json');const key=(req.headers.cookie||'').match(/(?:^|; )workshop=([a-f0-9-]+)/)?.[1];let state=sessions.get(key);
 let result;if(req.url.endsWith('/config'))result={flow:'selective-repair-v1',ready:true};
 else if(req.url.endsWith('/session'))result={session:state?repairView(state.row):null};
 else if(req.method==='POST'){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('Origin mismatch');
 let raw='';for await(const c of req){raw+=c;if(raw.length>8192)throw Error('Large request');}const b=JSON.parse(raw);
 if(req.url.endsWith('/start')){const token=randomUUID();state={row:{participant_id:'fictional',revision:0,status:'active',protocol:{flow:'selective-repair-v1',implementationHash:'fixture'},data:{repair:newRepairData(),actions:[]}}};sessions.set(token,state);res.setHeader('set-cookie','workshop='+token+'; HttpOnly; SameSite=Strict; Path=/');}
 else if(state&&req.url.endsWith('/action')){await repairAction(state,b,{implementationHash:'fixture'});state.row.revision++;}
 else if(req.url.endsWith('/repair-detach')){sessions.delete(key);state=null;}else throw Error('Unknown action');
 result={session:state?repairView(state.row):null};}else throw Error('Unknown route');
 res.end(JSON.stringify(result));return true;};}
