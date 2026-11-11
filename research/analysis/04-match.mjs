import {readFileSync} from 'node:fs';import {embeddingModel,call,chat} from './paid.mjs';import {save,seeded} from './common.mjs';
const data=JSON.parse(readFileSync(new URL('./task-pairs.json',import.meta.url)));
const texts=[...new Set(data.flatMap(row=>[row.source,row.request]))];const embedded=await call('embeddings',{model:embeddingModel,input:texts,dimensions:256},true);
const vectors=new Map(embedded.data.map(x=>[texts[x.index],x.embedding]));if(vectors.size!==texts.length)throw Error('Missing embeddings');
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);const cos=(a,b)=>dot(a,b)/Math.sqrt(dot(a,a)*dot(b,b));
const shuffled=[...data];const rng=seeded(31415);for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
const choices=new Map();for(let i=0;i<shuffled.length;i+=12){const batch=shuffled.slice(i,i+12);
 const reply=await chat('judge-'+i,'Decide if the second request continues the same concrete task for the same beneficiary and occasion. A change of owner, occasion or goal is different even with similar words. Return only a JSON array of 12 integers 1 (same) or 0 (different), in order.',JSON.stringify(batch.map(r=>[r.source,r.request])),400);
 const parse=s=>{try{return JSON.parse(s.match(/\[[\s\S]*?\]/)?.[0]??'null');}catch{return null;}};
 const valid=a=>Array.isArray(a)&&a.length===batch.length&&a.every(x=>[0,1].includes(x));
 let answers=parse(reply);
 if(!valid(answers))answers=parse(await chat('judge-retry-'+i,'Classify each pair: 1 for same concrete task, beneficiary and occasion, else 0. Return only a JSON array of twelve digits in order.',JSON.stringify(batch.map(r=>[r.source,r.request])),1200));
 if(!valid(answers))throw Error('Incomplete classifications');batch.forEach((r,j)=>choices.set(r.id,!!answers[j]));}
const rows=data.map(r=>({...r,cosine:cos(vectors.get(r.source),vectors.get(r.request)),exact:r.request===r.source,judge:choices.get(r.id)}));
function metrics(rows,pred){let tp=0,fp=0,tn=0,fn=0;for(const r of rows){if(pred(r)){if(r.same)tp++;else fp++;}else if(r.same)fn++;else tn++;}return {tp,fp,tn,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp/(tp+fn),f1:2*tp/(2*tp+fp+fn)};}
const dev=rows.filter(r=>r.split==='development'),test=rows.filter(r=>r.split==='held-out');
const thresholds=[...new Set(dev.map(r=>r.cosine))].sort((a,b)=>b-a);
const threshold=thresholds.map(t=>({t,f:metrics(dev,r=>r.cosine>=t).f1})).sort((a,b)=>b.f-a.f)[0].t;
const scores={exact:metrics(test,r=>r.exact),embedding:metrics(test,r=>r.cosine>=threshold),judge:metrics(test,r=>r.judge)};
save('match',{threshold,scores,rows});console.log(scores);
