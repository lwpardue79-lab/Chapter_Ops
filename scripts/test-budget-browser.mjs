// Isolated UI fixtures only. This server never connects to a production API.
import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = {
  budgets:[{id:'00000000-0000-0000-0000-000000000001',name:'Local browser fixture',starts_on:'2026-07-01',status:'Active',revision:1,updated_at:'2026-11-06T12:00:00Z'}],
  lines:[{id:'00000000-0000-0000-0000-000000000002',title:'Programs',category:'Programs',owner_position:'VPMD',kind:'expense',monthly_plan_cents:Array(12).fill(10000),actual_cents:[2500,...Array(11).fill(0)]}],
  entries:[],can_manage:true
};
fixture.budget=fixture.budgets[0];
const harness = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div class="app-shell"><aside class="sidebar">PRIVATE NAVIGATION</aside><main class="main"><header class="topbar">PRIVATE ACCOUNT</header><div id="appRoot"></div></main></div><div id="modalBackdrop" class="modal-backdrop hidden" role="dialog" aria-modal="true"><section class="modal" id="modal"></section></div><script src="/budget-core.js"></script><script src="/budget-ui.js"></script><script>
window.fixture=${JSON.stringify(fixture)}; window.role='manage';window.calls=[];window.failNext=false;
function render(){document.getElementById('appRoot').innerHTML=AOCommandBudgetUI.render();AOCommandBudgetUI.bind(document.getElementById('appRoot'));}
AOCommandBudgetUI.configure({can:(key)=>window.role!=='none'&&(key!=='budget.manage'||window.role==='manage'),context:()=>({client:{rpc:async(name,args)=>{calls.push({name,args});await new Promise(r=>setTimeout(r,40));if(failNext){failNext=false;return {error:{message:'Connection interrupted',code:'NETWORK'}};}if(name==='save_annual_budget'){if(args.p_action==='line'){const i=fixture.lines.findIndex(l=>l.id===args.p_data.id);const l={...args.p_data,actual_cents:Array(12).fill(0)};if(i<0)fixture.lines.push(l);else fixture.lines[i]=l;}fixture.budget.revision++;}const response=structuredClone(fixture);if(role==='read'){response.entries=[];response.can_manage=false;}return {data:response};}},userId:'local-user',organizationId:'local-chapter'}),render,openModal:(html)=>{document.getElementById('modal').innerHTML=html;document.getElementById('modalBackdrop').classList.remove('hidden');document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>document.getElementById('modalBackdrop').classList.add('hidden'));},closeModal:()=>document.getElementById('modalBackdrop').classList.add('hidden'),toast:(m)=>{window.lastToast=m;},download:(name,content)=>{window.downloaded={name,content};}});render();</script></body></html>`;
const server=http.createServer(async(req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(harness);return;}
  const file=req.url.slice(1);
  if(!['styles.css','budget-core.js','budget-ui.js'].includes(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(new URL(`../ao-command-web/${file}`,import.meta.url)));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('[data-budget-line=""]').waitFor();
 await page.locator('[data-budget-line=""]').click();
 await page.getByLabel('Line item',{exact:true}).fill('Saved local allocation');
 await page.getByLabel('Category',{exact:true}).fill('Programs');
 await page.getByLabel('Jul 2026',{exact:true}).fill('825.00');
 await page.evaluate(()=>{failNext=true;});
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByText('Connection interrupted NETWORK').waitFor();
 assert.equal(await page.getByLabel('Line item',{exact:true}).inputValue(),'Saved local allocation');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.locator('#modalBackdrop').waitFor({state:'hidden'});
 await page.getByText('Saved local allocation',{exact:true}).waitFor();
 const tokens=await page.evaluate(()=>calls.filter(c=>c.name==='save_annual_budget').map(c=>c.args.p_request_id));assert.equal(tokens[0],tokens[1]);
 await page.locator('[data-budget-refresh]').click();await page.getByText('Saved local allocation',{exact:true}).waitFor();
 await page.locator('[data-budget-alumni]').click();await page.getByRole('heading',{name:'Alpha Omega Chapter',exact:true}).waitFor();
 assert.equal(await page.locator('.sidebar').isVisible(),false);assert.equal(await page.locator('.topbar').isVisible(),false);
 assert.equal(await page.locator('[data-budget-entry]').count(),0);
 await page.screenshot({path:'/private/tmp/ao-budget-alumni.png',fullPage:true});
 await page.locator('[data-budget-export]').click();assert.ok((await page.evaluate(()=>downloaded.content)).includes('category'));
 await page.pdf({path:'/private/tmp/ao-command-alumni-budget-smoke.pdf',format:'Letter',printBackground:true});
 await page.locator('[data-budget-alumni-exit]').click();
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,`Page overflow at ${width}px`);
  await page.screenshot({path:`/private/tmp/ao-budget-${width}.png`,fullPage:true});
 }
 await page.evaluate(()=>{role='read';AOCommandBudgetUI.reset();render();});
 await page.locator('[data-budget-alumni]').waitFor();assert.equal(await page.locator('[data-budget-create]').count(),0);assert.equal(await page.locator('[data-budget-entry]').count(),0);
 await page.evaluate(()=>{role='none';AOCommandBudgetUI.reset();calls=[];render();});
 await page.getByRole('heading',{name:'Access restricted'}).waitFor();assert.equal(await page.evaluate(()=>calls.length),0);
 assert.deepEqual(errors,[]);console.log('PASS: budget save retry/input retention, idempotency token, readback, alumni privacy, CSV, PDF, 1440/768/390 layouts, read-only and unauthorized gates.');
} finally {await browser.close();server.close();}
