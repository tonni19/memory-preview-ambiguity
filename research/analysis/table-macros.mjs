import {readFileSync,writeFileSync} from 'node:fs';
let tex='';for(const name of ['preview','match']){const file=new URL('../paper/'+name+'-rows.tex',import.meta.url);const body=readFileSync(file,'utf8').trimEnd().replace(/\\\\$/,'');tex+='\\newcommand{\\'+name+'rows}{%\n'+body+'%\n}\n';}
writeFileSync(new URL('../paper/results.tex',import.meta.url),tex);
