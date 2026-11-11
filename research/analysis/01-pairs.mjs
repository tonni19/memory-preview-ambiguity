import {SCENARIOS,CASES} from '../src/repair-cases.mjs';
import {rulesFor,probesFor,yes,candidates,rank,compare} from '../src/diagnostic.mjs';
import {save,mean} from './common.mjs';
const rows=SCENARIOS.map(({event:e,intendedPolicy:r,id})=>{
 const rules=rulesFor(e),ps=probesFor(e),pair=CASES.filter(c=>c.scenario===id).slice(1).map(c=>c.context);
 function assess(tests){const kept=candidates(e,rules,tests.map(probe=>({probe,allowed:yes(e,r,probe)})));return {remaining:kept.length,bits:Math.log2(kept.length),disagreement:compare(e,kept,ps)};}
 const first=rank(e,rules,ps)[0].probe;
 const step=probes=>rank(e,candidates(e,rules,probes.map(probe=>({probe,allowed:yes(e,r,probe)}))),ps)[0].probe;
 const random=ps.flatMap((p,i)=>ps.slice(i+1).map(q=>assess([p,q])));
 const pool=Object.fromEntries(['remaining','bits','disagreement'].map(k=>[k,mean(random.map(x=>x[k]))]));
 const coherent=rules.filter(p=>p.recall||p.recommendation==='none');
 const fixed=ps.find(p=>p.purpose==='recommendation'&&p.person===e.person&&p.task!==e.task);
 const useful=[ps[0],ps[4],ps[5],ps[8]];
 const minimax=useful.flatMap((p,i)=>useful.slice(i+1).map(q=>{const bins={};for(const v of rules){const key=[yes(e,v,p),yes(e,v,q)].join();bins[key]=(bins[key]??0)+1;}return {p,q,worst:Math.max(...Object.values(bins))};}));
 return {id,type:e.evidence,initial:rules.length,authored:assess(pair),adaptive:assess([first,step([first])]),transfer:assess([pair[0],fixed]),random:pool,randomPairCount:random.length,coherent:coherent.length,coherentRemaining:candidates(e,coherent,pair.map(probe=>({probe,allowed:yes(e,r,probe)}))).length,prevented:pair[1],alwaysBlocked:rules.every(v=>!yes(e,v,pair[1])),greedy:[first,step([first])],minimax};
});
save('pairs',rows);console.log(rows.filter(x=>['desk','travel'].includes(x.id)).map(({id,authored,adaptive,transfer,random})=>({id,authored,adaptive,transfer,random})));
