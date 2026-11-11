import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
const root=fileURLToPath(new URL('.',import.meta.url));
const mode=process.argv[2];
const info=join(root,'configuration','participant-information.txt');
const data=join(root,'responses');
process.env.SURVEY_DATA_DIR=data;
delete process.env.SURVEY_CONSENT_FILE;
function open(target) {
 if(process.platform!=='win32'||process.env.PORTABLE_NO_OPEN==='1')return;
 const proc=spawn('explorer.exe',[target],{windowsHide:true,detached:true,stdio:'ignore'});
 proc.on('error',()=>console.log('Open manually: '+target));proc.unref();
}
async function main(){
 if(mode==='export'){
  process.argv[2]='study';
  await import('./survey/export.mjs');
  open(join(data,'exports','study'));return;
 }
 if(!['survey','interface','workshop'].includes(mode))throw Error('Choose survey, interface, workshop or export.');
 if(mode==='survey'){
  if(!existsSync(info)||!readFileSync(info,'utf8').trim())throw Error('Add your participant information as configuration/participant-information.txt, then run this launcher again. To try the interface immediately, use Open survey interface.cmd.');
  process.env.SURVEY_CONSENT_FILE=info;
 }
 const port=Number(process.env.PORTABLE_PORT||(mode==='workshop'?4199:mode==='survey'?4209:4208));
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORTABLE_PORT.');
 let url='http://127.0.0.1:'+port;
 if(mode==='workshop'){
  const {start}=await import('./research/ui/server.mjs');
  const server=start(port);await once(server,'listening');url+='/workshop';
 } else {
  process.env.SURVEY_PORT=String(port);
  await import('./survey/server.mjs');url+='/survey';
  const response=await fetch(url);if(response.status!==200)throw Error('Survey startup check failed.');
 }
 console.log('Open '+url+'. Keep this window open. Press Ctrl+C to stop.');open(url);
}
process.on('uncaughtException',err=>{console.error(err.code==='EADDRINUSE'?'That port is already in use. Close its current server and try again.':err.message);process.exit(1);});
main().catch(err=>{console.error(err.message);process.exit(1);});

