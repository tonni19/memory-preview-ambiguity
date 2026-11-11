import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {SCENARIOS,CASES} from './src/repair-cases.mjs';
import {previewRule,decide} from './src/repair.mjs';

export const root=fileURLToPath(new URL('.',import.meta.url));
export const event=SCENARIOS.find(s=>s.id==='desk').event;
export const questions=[
  {id:'lamp',text:'Which lamp would work beside the desk in my temporary workspace?',task:event.task},
  {id:'bookcase',text:'Which bookcase should I choose for my permanent apartment?',task:'permanent apartment'}
];
export const scopes={'none':'Never use this choice for recommendations.','same-task':'Use it only for recommendations about my temporary workspace.','same-person':'Use it for recommendations for me, including in other tasks.'};
export const choices={allow:'Allowed',block:'Blocked',unsure:'Unsure',skip:'Skip this question'};
export const version='desk-direct-preview-v1';
export function configuration(){
  const file=process.env.SURVEY_CONSENT_FILE;
  const information=file?readFileSync(resolve(file),'utf8').trim():'This is a practice run. Use fictional answers. Your entries are saved on this computer in a separate practice file. You can stop and discard them before submitting.';
  if(!information)throw Error('Consent file is empty.');
  return {mode:file?'study':'practice',information,consentHash:hash(information)};
}
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export function openStore(mode){
  const dir=resolve(process.env.SURVEY_DATA_DIR||join(root,'local-data'),mode);
  mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(join(dir,'survey.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, step TEXT NOT NULL, body TEXT NOT NULL);');
  return db;
}
export function policyFor(scope){
  const preview=previewRule(event,{condition:'B',policy:{recall:true,recommendation:scope,preference:false}});
  if(preview.status!=='ready')throw Error('Invalid rule');
  return preview.policy;
}
// Participant-facing wording for the shared fixture prompts; the fixtures themselves stay identical to research/src.
const wording={'Suggest a useful follow-up for temporary workspace.':'Suggest something else I need for my temporary workspace.'};
export function examples(policy){
  return CASES.filter(c=>c.scenario==='desk').slice(1).map(c=>({text:wording[c.prompt]??c.prompt,outcome:decide(event,policy,c.context).status}));
}
export function score(policy,q){
  return decide(event,policy,{person:event.person,task:q.task,purpose:'recommendation'}).status;
}
export function csvRows(records){
 const fields=['participant_code','mode','protocol','consent_fingerprint','consented_at','status','intention','saved_scope','preview_examples','probe_id','probe','prediction','outcome','prediction_score','fit_reported','feedback','submitted_at'];
 const rows=[fields];
 for(const {code,step,body} of records){
  const data=JSON.parse(body);
  for(const q of questions){
   const prediction=data.predictions?.[q.id]||'',outcome=data.outcomes?.[q.id]||'';
   const scored=['allow','block'].includes(prediction)?(prediction===outcome?'correct':'incorrect'):prediction;
   rows.push([code,data.mode,data.protocol,data.consentHash,data.started,step,data.intent,data.scope,data.preview?JSON.stringify(data.preview):'',q.id,q.text,prediction,outcome,scored,data.fit,data.feedback,data.submitted]);
  }
 }
 return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n')+'\r\n';
}
