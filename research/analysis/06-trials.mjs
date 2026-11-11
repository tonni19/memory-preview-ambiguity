import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {newRepairData,repairView,repairAction} from '../src/repair.mjs';import {save} from './common.mjs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {start}=await import('../ui/server.mjs');const server=start();await (await import('node:events')).once(server,'listening');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});try{
 const page=await browser.newPage({viewport:{width:900,height:860},deviceScaleFactor:2});
 page.on('pageerror',e=>console.error(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/workshop');await page.locator('#start').click();await page.locator('[data-step=repair]').click();
 if(!await page.locator('#condition').isVisible())await page.locator('details').filter({has:page.locator('#condition')}).locator('summary').click();
 await page.locator('#condition').selectOption('B');await page.locator('#recall').check();await page.locator('#recommendation').selectOption('same-task');await page.locator('#preview').click();try{await page.locator('#preview-result.ready').waitFor({timeout:5000});}catch(e){throw Error(await page.locator('#message').textContent());}
 const rows=[];for(const version of ['draft','saved']){
 if(version==='saved'){await page.locator('[data-step=repair]').click();await page.locator('#save').click();await page.locator('#rule-state.saved').waitFor();
 await page.locator('#new-conversation').click();await page.getByText('Conversation 2',{exact:true}).waitFor();await page.reload();await page.locator('#rule-state.saved').waitFor();}
 await page.locator('[data-step=test]').click();if(version==='draft')await page.locator('#use-preview').check();
 for(const task of ['original','different']){
 await page.locator('#task').selectOption(task);await page.locator('#purpose').selectOption('recommendation');
 await page.locator('#prompt').fill(task==='original'?'Can you suggest a matching shelf for this workspace?':'What furniture should I buy for my new home?');
 const done=page.waitForResponse(r=>r.url().endsWith('/action'));await page.locator('#test').click();await done;
 const outcome=task==='original'?'allow':'block';await page.locator('#test-result.'+outcome).waitFor();
 const result=JSON.parse(await page.locator('#test-result pre').textContent());assert.equal(result.records.length,task==='original'?1:0);
 assert.equal(result.ruleVersion,version==='draft'?'unsaved-preview':1);
 rows.push({version,task,outcome:result.decision.status,records:result.records.length,ruleVersion:result.ruleVersion});
 if(version==='saved')await page.screenshot({path:fileURLToPath(new URL('../paper/figures/'+outcome+'.png',import.meta.url)),fullPage:true});
 }}save('trials',rows);console.log(rows);
}finally{await browser.close();server.close();}
