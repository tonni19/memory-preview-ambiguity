import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {root} from './study.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const folder=mkdtempSync(join(tmpdir(),'memory-survey-qa-'));
const env={...process.env,SURVEY_DATA_DIR:folder,SURVEY_PORT:'0',SURVEY_CONSENT_FILE:''};
let server,browser;
async function start(extra={}){
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...env,...extra},stdio:['ignore','pipe','inherit']});
 const line=String((await once(server.stdout,'data'))[0]);return line.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
}
async function stop(){const closed=once(server,'exit');server.kill();await closed;server=null;}
try{
 let base=await start();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 async function click(name){await page.getByRole('button',{name,exact:true}).click();}
 async function begin(){
  await page.goto(base+'/survey');await page.getByRole('checkbox').check();await click('Begin');
  await page.getByRole('heading',{name:'What would you want?'}).waitFor();
 }
 await begin();await page.getByRole('textbox').fill('For the workspace only.');await click('Save and continue');
 await page.locator('input[value="same-task"]').check();await click('Preview this setting');await click('Save rule and continue');
 await page.reload();await page.getByRole('heading',{name:'What do you think will happen?'}).waitFor();
 assert(!(await page.content()).includes('Saved rule:'));
 await page.locator('input[name=lamp][value=allow]').check();
 await click('Save both predictions and see outcomes');assert(await page.locator('input[name=bookcase]').first().isVisible());
 await page.locator('input[name=bookcase][value=unsure]').check();await click('Save both predictions and see outcomes');
 assert.deepEqual(await page.locator('p strong').allTextContents(),['Allowed','Blocked']);
 await page.getByRole('radio',{name:'Partly',exact:true}).check();await click('Submit my response');
 await page.getByRole('heading',{name:'Response submitted'}).waitFor();
 await page.getByRole('link',{name:'Start the next session'}).click();assert(await page.getByRole('checkbox').isVisible());
 await begin();await page.locator('summary').click();await click('Discard my responses');await page.getByRole('heading',{name:'Session discarded'}).waitFor();
 await stop();base=await start();await page.goto(base+'/survey');await page.getByRole('checkbox').waitFor();
 const db=new DatabaseSync(join(folder,'practice','survey.sqlite'));
 const rows=db.prepare('SELECT * FROM sessions').all();assert.equal(rows.length,1);assert.equal(rows[0].step,'completed');db.close();
 const r=JSON.parse(rows[0].body);assert.equal(r.predictions.bookcase,'unsure');assert.equal(r.outcomes.bookcase,'block');assert.equal(r.fit,'partly');
 execFileSync(process.execPath,['export.mjs','practice'],{cwd:root,env});
 const exportsDir=join(folder,'exports','practice');const csv=readFileSync(join(exportsDir,readdirSync(exportsDir)[0]),'utf8');
 assert.equal(csv.trim().split('\r\n').length,3);assert(csv.includes('"unsure","block","unsure"'));
 await stop();const consent=join(folder,'test-information.txt');writeFileSync(consent,'Fictional QA information for automated test only.');
 base=await start({SURVEY_CONSENT_FILE:consent});
 await begin();await click('Save and continue');await page.locator('input[value="none"]').check();await click('Preview this setting');await click('Change my setting');
 await page.locator('input[value="same-person"]').check();await click('Preview this setting');await click('Save rule and continue');
 await page.locator('input[name=lamp][value=skip]').check();await page.locator('input[name=bookcase][value=allow]').check();await click('Save both predictions and see outcomes');
 assert.deepEqual(await page.locator('p strong').allTextContents(),['Allowed','Allowed']);
 const live=new DatabaseSync(join(folder,'study','survey.sqlite'));assert.equal(live.prepare('SELECT step FROM sessions').get().step,'reflect');live.close();
 console.log('PASS: participant entry, preview/edit, both predictions required, refresh, actual outcomes, submit, next-person isolation, discard, durable restart, CSV, independent practice and study stores. Test data in OS temp only.');
}finally{if(browser)await browser.close();if(server)await stop();}

