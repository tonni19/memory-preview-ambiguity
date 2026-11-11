import {openStore,csvRows,root} from './study.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const mode=process.argv[2]||'practice';
if(!['practice','study'].includes(mode))throw Error('Expected practice or study.');
const store=openStore(mode);
const records=store.prepare('SELECT code,step,body FROM sessions ORDER BY rowid').all();
store.close();
const location=join(process.env.SURVEY_DATA_DIR?resolve(process.env.SURVEY_DATA_DIR):root,'exports',mode);
mkdirSync(location,{recursive:true});
const file=join(location,'responses-'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv');
writeFileSync(file,csvRows(records),{flag:'wx'});
console.log(records.length+' sessions exported to '+file);

