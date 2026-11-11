import {decide} from './repair.mjs';
export function rulesFor(e){return [false,true].flatMap(recall=>['none','same-task','same-person'].flatMap(recommendation=>(e.evidence==='explicit-preference'?[false,true]:[false]).map(preference=>({recall,recommendation,preference}))));}
export function probesFor(e){return ['recall','recommendation','preference','trait'].flatMap(purpose=>[e.person,e.person==='self'?'other':'self'].flatMap(person=>[e.task,'another fictional task'].map(task=>({purpose,person,task}))));}
export const yes=(e,r,p)=>decide(e,r,p).status==='allow';
export function candidates(e,rules,observed){return rules.filter(r=>observed.every(({probe,allowed})=>yes(e,r,probe)===allowed));}
export function rank(e,rules,probes){
 return probes.map(probe=>{const n=rules.filter(r=>yes(e,r,probe)).length;const p=n/rules.length;
 const bits=p>0&&p<1?-p*Math.log2(p)-(1-p)*Math.log2(1-p):0;return {probe,allow:n,block:rules.length-n,bits};}).sort((a,b)=>b.bits-a.bits);
}
export function compare(e,remaining,probes){if(remaining.length<2)return 0;
 return rank(e,remaining,probes).reduce((sum,q)=>sum+2*q.allow*q.block/(remaining.length*(remaining.length-1)),0)/probes.length;}
