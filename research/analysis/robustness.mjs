import {SCENARIOS} from '../src/repair-cases.mjs';import {rulesFor,probesFor,yes,candidates} from '../src/diagnostic.mjs';import {save,mean} from './common.mjs';const rows=[];
for(const {event:e,id,intendedPolicy:r} of SCENARIOS){
 const rules=rulesFor(e),unique=new Map();for(const p of probesFor(e)){const s=rules.map(x=>Number(yes(e,x,p))).join('');if(s.includes('0')&&s.includes('1'))unique.set(s,p);}
 const ps=[...unique.values()],ks=ps.flatMap((p,i)=>ps.slice(i+1).map(q=>candidates(e,rules,[p,q].map(probe=>({probe,allowed:yes(e,r,probe)}))).length));
 rows.push({id,uniqueInformativeSignatures:ps.length,meanRemaining:mean(ks)});}
save('informative-random',rows);console.log(rows[0],rows.at(-1));
