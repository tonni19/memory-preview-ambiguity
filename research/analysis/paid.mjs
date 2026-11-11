import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {publicResponse} from './public-cache.mjs';
const dir=new URL('./results/',import.meta.url),ledger=new URL('paid-ledger.json',dir), cap=.10;
const api='https://openrouter.ai/api/v1/',key=process.env.OPENROUTER_API_KEY;
export const chatModel='google/gemini-3.8-flash',embeddingModel='openai/text-embedding-3-small';
export async function call(name,body,embedding=false){
 const file=new URL(name+'.json',dir),hash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 if(existsSync(file)){const old=JSON.parse(readFileSync(file));if(old.hash!==hash)throw Error('Changed request: use a separate study directory and budget');return old.response;}
 if(!key)throw Error('Missing OpenRouter key');
 const book=existsSync(ledger)?JSON.parse(readFileSync(ledger)):[];
 const models=await fetch(api+(embedding?'embeddings/models':'models')).then(r=>r.json());
 const price=models.data.find(m=>m.id===body.model)?.pricing;if(!price||!Number.isFinite(+price.prompt)||!Number.isFinite(+price.completion))throw Error('Unknown price');
 const bound=(512+Buffer.byteLength(JSON.stringify(body)))*Number(price.prompt)+(body.max_tokens||0)*Math.max(+price.completion,+(price.internal_reasoning||0))+Number(price.request||0);
 if(book.reduce((sum,x)=>sum+x.reserve,0)+bound>cap)throw Error('Budget exhausted');
 if(book.some(x=>x.name===name))throw Error('Existing pending charge: investigate before retrying');
 const entry={name,reserve:bound};book.push(entry);writeFileSync(ledger,JSON.stringify(book,null,2));
 const res=await fetch(api+(embedding?'embeddings':'chat/completions'),{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});if(!res.ok)throw Error('OpenRouter HTTP '+res.status);
 const response=await res.json();if(response.error)throw Error('Provider returned an error');
 entry.actual=response.usage?.cost??null;const clean=publicResponse(response);writeFileSync(file,JSON.stringify({hash,response:clean}));writeFileSync(ledger,JSON.stringify(book,null,2));return clean;
}
export async function chat(name,system,user,max_tokens){const r=await call(name,{model:chatModel,messages:[{role:'system',content:system},{role:'user',content:user}],reasoning:{effort:'low'},temperature:0,max_tokens});return r.choices[0].message.content;}
