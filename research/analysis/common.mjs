import {writeFileSync} from 'node:fs';
export const save=(name,data)=>writeFileSync(new URL('./results/'+name+'.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
export function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
export const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
