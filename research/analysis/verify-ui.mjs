import {start} from '../ui/server.mjs';import assert from 'node:assert/strict';import {once} from 'node:events';
const server=start();await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
try{for(const id of ['desk','lighting']){const history=[];let last=Infinity;for(let i=0;i<6;i++){const r=await fetch(base+'/preview',{method:'POST',body:JSON.stringify({id,history})});const v=await r.json();assert(v.remaining<last);last=v.remaining;
if(!v.next)break;assert(v.next.bits>0);history.push({index:v.next.index,allowed:i%2===0});}assert.equal(last,1);}
assert.equal((await fetch(base+'/preview',{method:'POST',body:JSON.stringify({id:'missing',history:[]})})).status,400);console.log('Interactive endpoints resolved both types and rejected invalid input.');}
finally{server.close();}
