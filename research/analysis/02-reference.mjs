import assert from 'node:assert/strict';
import {save,seeded} from './common.mjs';
import {decide,consequence,previewRule} from '../src/repair.mjs';
import {SCENARIOS,CASES,correctionText} from '../src/repair-cases.mjs';
import {rulesFor} from '../src/diagnostic.mjs';
// Construct permissions as a positive set. No call to the production gate constructs this set.
function reference(e,p,c){
 if(!p||!c||!['self','other'].includes(c.person)||typeof c.task!=='string'||!c.task.trim()||c.task.length>120||!['trait','recall','preference','recommendation'].includes(c.purpose))return 'unresolved';
 const permits=new Set();
 if(p.recall)permits.add('recall');
 if(p.recommendation==='same-person'||(p.recommendation==='same-task'&&e.task===c.task))permits.add('recommendation');
 if(e.evidence==='explicit-preference'&&p.preference&&e.task===c.task)permits.add('preference');
 return c.person===e.person&&permits.has(c.purpose)?'allow':'block';
}
const rng=seeded(20261108),pick=a=>a[Math.floor(rng()*a.length)];let mutantsDetected=0;
const counts={allow:0,block:0,unresolved:0};for(let i=0;i<10000;i++){
 const e=pick(SCENARIOS).event,p=pick([...rulesFor(e),null]);
 const c={person:pick(['self','other','unknown']),purpose:pick(['recall','preference','recommendation','trait','other']),task:pick([e.task,e.task.toUpperCase(),'unrelated',' ','x'.repeat(121)])};
 const oracle=reference(e,p,c);assert.equal(decide(e,p,c).status,oracle);counts[oracle]++;
 if(p&&decide(e,p,{...c,person:e.person}).status!==oracle)mutantsDetected++;
}assert(mutantsDetected>0);
let runs=0,contexts=0;
for(const s of SCENARIOS){const e=s.event;const base=CASES.filter(x=>x.scenario===s.id);
 const more=[{context:{person:e.person,purpose:'recommendation',task:'another fictional task'},expected:'block'}];
 if(e.evidence==='explicit-preference')more.push({context:{person:e.person,purpose:'recommendation',task:e.task},expected:'allow'});
 const cases=[...base,...more];contexts+=cases.length;
 for(const condition of ['A','B','C']){const rule=previewRule(e,{policy:s.intendedPolicy,text:correctionText(s.intendedPolicy),condition,examples:base.slice(1)});
 for(const t of cases){const result=consequence(e,rule.policy,t.context,'fictional request');assert.equal(result.decision.status,t.expected);runs++;}}
}
save('reference',{seed:20261108,cases:10000,mismatches:0,outcomes:counts,personMaskMutantDetected:mutantsDetected,contexts,sanityExecutions:runs});console.log(counts,mutantsDetected,contexts,runs);
