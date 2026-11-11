import assert from 'node:assert/strict';
import {SCENARIOS} from '../src/repair-cases.mjs';
import {rulesFor,probesFor,yes,candidates} from '../src/diagnostic.mjs';
import {enumerate,permits} from '../src/extension.mjs';
import {save,mean} from './common.mjs';
// (1) Every preview an editor could show: one allowed and one blocked request, for each possible saved rule.
// (2) Whether "one test per setting" still holds once permissions depend on each other (the sensitivity model).
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function previews(e,target){
 const rules=rulesFor(e),ps=probesFor(e),invariant=p=>new Set(rules.map(r=>yes(e,r,p))).size===1;
 const allowed=ps.filter(p=>yes(e,target,p)),blocked=ps.filter(p=>!yes(e,target,p));
 const pairs=allowed.flatMap(a=>blocked.map(b=>({a,b})));
 const left=pairs.map(({a,b})=>candidates(e,rules,[{probe:a,allowed:true},{probe:b,allowed:false}]).length);
 return {pairs:pairs.length,blockedEliminatesNothing:pairs.filter(({b})=>invariant(b)).length,meanRulesLeft:pairs.length?mean(left):null,minRulesLeft:pairs.length?Math.min(...left):null,identifying:left.filter(k=>k===1).length};
}
// Smallest fixed test set and adaptive depth for an arbitrary rule list and request menu.
function identify(rules,menu,allow){
 const pattern=p=>rules.map(r=>Number(allow(r,p))).join('');
 const distinct=[...new Map(menu.filter(p=>{const s=pattern(p);return s.includes('0')&&s.includes('1');}).map(p=>[pattern(p),p])).values()];
 const sig=distinct.map(pattern);
 assert.equal(new Set(rules.map((_,i)=>sig.map(s=>s[i]).join(''))).size,rules.length,'menu cannot separate all rules');
 let fixed=null;
 search:for(let size=1;size<=distinct.length;size++){
  const pick=[];const go=(start)=>{if(pick.length===size)return new Set(rules.map((_,i)=>pick.map(j=>sig[j][i]).join(''))).size===rules.length;
   for(let j=start;j<distinct.length;j++){pick.push(j);if(go(j+1))return true;pick.pop();}return false;};
  if(go(0)){fixed=size;break search;}
 }
 // Greedy adaptive questioning (most even split), followed for every target rule.
 const depth=rules.map((_,t)=>{let alive=rules.map((_,i)=>i),n=0;while(alive.length>1){let best=null;
   for(const s of sig){const yesCount=alive.filter(i=>s[i]==='1').length;const score=Math.min(yesCount,alive.length-yesCount);if(!best||score>best.score)best={s,score};}
   assert.ok(best.score>0);alive=alive.filter(i=>best.s[i]===best.s[t]);n++;}return n;});
 return {rules:rules.length,requests:menu.length,distinctInformative:distinct.length,lowerBound:Math.ceil(Math.log2(rules.length)),fixedSet:fixed,adaptiveMean:mean(depth),adaptiveMin:Math.min(...depth),adaptiveMax:Math.max(...depth)};
}
const out={};
for(const id of ['desk','lighting']){
 const {event:e,intendedPolicy:target}=SCENARIOS.find(s=>s.id===id),rules=rulesFor(e);
 const perRule=rules.map(r=>({rule:r,...previews(e,r)}));
 const intended=perRule.find(x=>same(x.rule,target));
 const all=perRule.filter(x=>x.pairs>0);
 const base=identify(rules,probesFor(e),(r,p)=>yes(e,r,p));
 // Sensitivity model at its largest stage: expiry, cross-task preference, handoff and follow-up, with recall required first.
 const other=e.person==='self'?'other':'self';
 const menu=[0,7].flatMap(day=>[e.person,other].flatMap(person=>[e.task,'another fictional task'].flatMap(task=>['recall','recommendation','preference','handoff','follow-up','trait'].map(purpose=>({day,person,task,purpose})))));
 const extended=identify(enumerate(e,4),menu,(r,c)=>permits(e,r,c));
 out[id]={type:e.evidence,intended,allRules:{rulesWithAPreview:all.length,pairs:all.reduce((s,x)=>s+x.pairs,0),blockedEliminatesNothing:all.reduce((s,x)=>s+x.blockedEliminatesNothing,0),identifying:all.reduce((s,x)=>s+x.identifying,0)},perRule,original:base,extended};
}
save('previews',out);
for(const [id,v] of Object.entries(out))console.log(id,JSON.stringify({intended:{...v.intended,rule:undefined},allRules:v.allRules,original:v.original,extended:v.extended}));
