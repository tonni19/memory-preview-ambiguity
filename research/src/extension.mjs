// Counterfactual vocabulary for fictional event permissions. A delegation never authorizes another person's preferences.
export const stages=['coherent','expiry','preference scope','delegation','follow-up'];
export function enumerate(e,stage){
 const rules=[];
 for(const recall of [false,true])for(const rec of ['none','task','person']){
  if(!recall&&rec!=='none')continue;
  const prefs=e.evidence==='explicit-preference'?(stage>=2?['none','task','person']:['none','task']):['none'];
  for(const pref of prefs)for(const expires of (stage>=1?[7,null]:[null]))
  for(const delegate of (stage>=3?[false,true]:[false]))for(const follow of (stage>=4?[false,true]:[false])){
  // Canonicalize expiry when nothing can be used, and require retrieval for the new permissions.
  if((delegate||follow)&&!recall)continue;
  if(!recall&&pref==='none'&&expires!==null)continue;
  rules.push({recall,rec,pref,expires,delegate,follow});}
 }return rules;
}
export function permits(e,r,c){if(!Number.isInteger(c.day)||c.day<0||r.expires!==null&&c.day>=r.expires)return false;
 const own=c.person===e.person,task=c.task===e.task;
 if(!own)return r.delegate&&c.person===(e.person==='self'?'other':'self')&&task&&c.purpose==='handoff';
 switch(c.purpose){case 'recall':return r.recall;case 'recommendation':return r.rec==='person'||r.rec==='task'&&task;
 case 'preference':return e.evidence==='explicit-preference'&&(r.pref==='person'||r.pref==='task'&&task);
 case 'follow-up':return r.follow&&task;default:return false;}
}
