import assert from 'node:assert/strict';
import {SCENARIOS,CASES} from '../src/repair-cases.mjs';
import {rulesFor,probesFor,yes,candidates,rank,compare} from '../src/diagnostic.mjs';
import {save} from './common.mjs';
// Which candidate requests can separate rules, how few identify a rule exactly, and what two tests leave open.
const name=(e,p)=>[p.purpose,p.person===e.person?'original person':'other person',p.task===e.task?'original task':'other task'].join(', ');
const label=r=>[r.recall?'recall on':'recall off','recommendation '+r.recommendation,r.preference?'preference on':'preference off'].join('; ');
const rows=SCENARIOS.map(({event:e,intendedPolicy:target,id})=>{
 const rules=rulesFor(e),ps=probesFor(e),pattern=p=>rules.map(r=>Number(yes(e,r,p))).join('');
 const informative=ps.filter(p=>{const s=pattern(p);return s.includes('0')&&s.includes('1');});
 const distinct=[...new Map(informative.map(p=>[pattern(p),p])).values()];
 // Smallest set of requests giving every rule a distinct answer pattern (exhaustive over subsets).
 let best=null;
 for(let mask=1;mask<(1<<distinct.length);mask++){
  const sub=distinct.filter((_,i)=>mask>>i&1);if(best&&sub.length>=best.length)continue;
  if(new Set(rules.map(r=>sub.map(p=>Number(yes(e,r,p))).join(''))).size===rules.length)best=sub;
 }
 const lowerBound=Math.ceil(Math.log2(rules.length));assert.equal(best.length,lowerBound);
 // Adaptive suggestions followed to the end, for every possible target rule.
 const steps=rules.map(t=>{const seen=[];let left=rules;while(left.length>1){const top=rank(e,left,ps)[0];assert.ok(top.bits>0);seen.push({probe:top.probe,allowed:yes(e,t,top.probe)});left=candidates(e,rules,seen);}assert.deepEqual(left[0],t);return seen.length;});
 // What two tests leave open on the authored target.
 const after=tests=>candidates(e,rules,tests.map(probe=>({probe,allowed:yes(e,target,probe)}))).map(label);
 const first=rank(e,rules,ps)[0].probe,second=rank(e,candidates(e,rules,[{probe:first,allowed:yes(e,target,first)}]),ps)[0].probe;
 const pair=CASES.filter(c=>c.scenario===id).slice(1).map(c=>c.context);
 const transfer=ps.find(p=>p.purpose==='recommendation'&&p.person===e.person&&p.task!==e.task);
 // Per-rule view of the authored pair, for the paper's grid figure.
 const kept=new Set(candidates(e,rules,pair.map(probe=>({probe,allowed:yes(e,target,probe)}))).map(label));
 const authoredGrid=rules.map(r=>({recall:r.recall,recommendation:r.recommendation,preference:r.preference,compatible:kept.has(label(r)),intended:label(r)===label(target)}));
 assert.equal(authoredGrid.filter(x=>x.compatible).length,kept.size);assert.ok(authoredGrid.find(x=>x.intended).compatible);
 const gridFor=tests=>{const keep=new Set(after(tests));return rules.map(r=>({recall:r.recall,recommendation:r.recommendation,preference:r.preference,compatible:keep.has(label(r)),intended:label(r)===label(target)}));};
 const adaptiveGrid=gridFor([first,second]),transferGrid=gridFor([pair[0],transfer]);
 // Ties: every request that splits as evenly as the suggested one, at each of the two adaptive steps.
 const tied=(left)=>{const r=rank(e,left,ps);return r.filter(q=>Math.abs(q.bits-r[0].bits)<1e-12).map(q=>q.probe);};
 const afterFirst=candidates(e,rules,[{probe:first,allowed:yes(e,target,first)}]);
 const firstTies=[...new Map(tied(rules).map(p=>[rules.map(r=>yes(e,r,p)).join(),p])).values()];
 const secondTies=[...new Map(tied(afterFirst).map(p=>[afterFirst.map(r=>yes(e,r,p)).join(),p])).values()];
 const adaptiveSecondChoices=secondTies.map(p=>({test:name(e,p),leaves:after([first,p]),grid:gridFor([first,p])}));
 // Every two-test sequence the even-split criterion permits, whichever way each tie is broken.
 const uniq=(left,list)=>[...new Map(list.map(p=>[left.map(r=>yes(e,r,p)).join(),p])).values()];
 const adaptivePaths=uniq(rules,tied(rules)).flatMap(a=>{const left=candidates(e,rules,[{probe:a,allowed:yes(e,target,a)}]);
  return uniq(left,tied(left)).map(b=>{const rest=candidates(e,rules,[a,b].map(probe=>({probe,allowed:yes(e,target,probe)})));
   return {tests:[name(e,a),name(e,b)],leaves:rest.map(label),scopesLeft:[...new Set(rest.map(r=>r.recommendation))],disagreement:compare(e,rest,ps)};});});
 return {id,type:e.evidence,rules:rules.length,authoredGrid,adaptiveGrid,transferGrid,adaptiveFirstTies:firstTies.map(p=>name(e,p)),adaptiveSecondChoices,adaptivePaths,requests:ps.length,invariantRequests:ps.length-informative.length,informativeRequests:informative.length,distinctPatterns:distinct.length,
  lowerBound,minimumIdentifying:best.length,identifyingSet:best.map(p=>name(e,p)),adaptiveWorstCaseAnswers:Math.max(...steps),
  adaptiveTests:[first,second].map(p=>name(e,p)),adaptiveLeaves:after([first,second]),transferLeaves:after([pair[0],transfer])};
});
for(const type of ['single-choice','explicit-preference']){const same=rows.filter(r=>r.type===type).map(({id,...rest})=>JSON.stringify(rest));assert.equal(new Set(same).size,1);}
save('identify',rows);
console.log(rows.filter(r=>['desk','lighting'].includes(r.id)));
