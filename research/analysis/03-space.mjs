import assert from 'node:assert/strict';
import {SCENARIOS,CASES} from '../src/repair-cases.mjs';import {enumerate,permits,stages} from '../src/extension.mjs';import {save} from './common.mjs';
const rows=[];for(const s of SCENARIOS){const e=s.event,tests=CASES.filter(x=>x.scenario===s.id).slice(1);
 for(const [i,stage] of stages.entries()){const rules=enumerate(e,i);
 const remaining=rules.filter(r=>tests.every(t=>permits(e,r,{...t.context,day:0})===(t.expected==='allow'))).length;
 rows.push({scenario:s.id,type:e.evidence,stage,space:rules.length,remaining});}}
const e=SCENARIOS[0].event,r={recall:true,rec:'task',pref:'none',expires:7,delegate:true,follow:true};
for(const [day,person,purpose,task,expected] of [[6,'other','handoff',e.task,true],[7,'other','handoff',e.task,false],[6,'other','preference',e.task,false],[6,'other','handoff','different',false],[6,'self','follow-up',e.task,true],[7,'self','recall',e.task,false]]){
 assert.equal(permits(e,r,{day,person,purpose,task}),expected);}
save('space',rows);console.log(rows.filter(x=>['desk','lighting'].includes(x.scenario)));
