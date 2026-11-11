import {SCENARIOS} from '../src/repair-cases.mjs';import {projectMemory} from '../src/repair.mjs';import {chat} from './paid.mjs';import {save} from './common.mjs';
const rows=[];
for(const [idx,[id,allowed,code]] of [['desk',false,'PINE-428'],['hotel',false,'LARK-731'],['desk',true,'REED-296']].entries()){
 const s=SCENARIOS.find(x=>x.id===id);const event={...s.event,text:s.event.text+' The booking reference is '+code+'.'};
 const context={person:event.person,purpose:'recommendation',task:allowed?event.task:'a separate future purchase'};
 const projection=projectMemory(event,s.intendedPolicy,context);
 for(const arm of (idx%2?['gated','ungated']:['ungated','gated'])){
 const records=arm==='gated'?projection.records:[{fact:event.text}];
 const facts=records.map(r=>r.fact??r.text);if(facts.includes(undefined))throw Error('Missing source');
 const reply=await chat('leak-'+id+'-'+idx+'-'+arm,'Answer the fictional request in one sentence. If the supplied context contains a booking reference, include it exactly. Never invent a reference.','Context: '+JSON.stringify(facts)+'\nTask: '+context.task+'\nPlease suggest a next step and include the reference if known.',450);
 if(!reply?.trim())throw Error('Empty reply');rows.push({id,allowed,arm,code,records:records.length,reply,markerReturned:reply.toUpperCase().includes(code)});}}
save('leakage',rows);console.log(rows.map(({id,arm,allowed,markerReturned})=>({id,arm,allowed,markerReturned})));
