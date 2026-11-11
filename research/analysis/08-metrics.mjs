import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {mean,save} from './common.mjs';import {rulesFor,probesFor,yes} from '../src/diagnostic.mjs';import {SCENARIOS} from '../src/repair-cases.mjs';
const read=name=>JSON.parse(readFileSync(new URL('./results/'+name+'.json',import.meta.url)));
const aliases=JSON.parse(readFileSync(new URL('./original-aliases.json',import.meta.url)));
const pairs=read('pairs');let aliasesBlocked=0;for(const {event:e,intendedPolicy:r} of SCENARIOS){const alias=aliases.find(x=>x.originalTask===e.task);assert.equal(alias.expected,'allow');const c={person:e.person,purpose:'recommendation',task:alias.alias};if(!yes(e,r,c))aliasesBlocked++;
 const rules=rulesFor(e),ps=probesFor(e),ids=e.evidence==='explicit-preference'?[0,4,5,8]:[0,4,5];
 assert.equal(new Set(rules.map(p=>ids.map(i=>yes(e,p,ps[i])).join())).size,rules.length);}
const metrics={meanCandidates:mean(pairs.map(x=>x.authored.remaining)),residualBits:mean(pairs.map(x=>x.authored.bits)),gainBits:mean(pairs.map(x=>Math.log2(x.initial)-x.authored.bits)),aliasesBlocked,actualSpend:read('paid-ledger').reduce((sum,r)=>sum+r.actual,0)};
save('metrics',metrics);
const labels={authored:'Authored',random:'Random',adaptive:'Adaptive',transfer:'Transfer'};
const rounded=n=>(Math.round((n+1e-10)*10)/10).toFixed(1);
const tex=Object.keys(labels).map(k=>{const cells=['desk','lighting'].flatMap(id=>{const m=pairs.find(x=>x.id===id)[k];return [Number.isInteger(m.remaining)?m.remaining:rounded(m.remaining),rounded(m.bits),rounded(m.disagreement*100)+'\\%'];});return [labels[k],...cells].join(' & ')+' \\\\';}).join('\n');
writeFileSync(new URL('../paper/preview-rows.tex',import.meta.url),tex+'\n');
const scores=read('match').scores;writeFileSync(new URL('../paper/match-rows.tex',import.meta.url),Object.entries(scores).map(([k,s])=>[k,s.tp,s.fp,s.fn,Math.round(s.precision*100)+'\\%',Math.round(s.recall*100)+'\\%'].join(' & ')+' \\\\').join('\n'));
console.log(metrics);

