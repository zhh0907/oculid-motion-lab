// Integration tests inject fingertip positions at the camera boundary; no physical camera is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),artifacts=process.env.QA_OUTPUT||path.join(os.tmpdir(),'binocular-patient-qa');
fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.wasm':'application/wasm'};
  fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':body);});
});
const report={checks:[],errors:[],physicalCameraTested:false};
let browser;
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/workspace.html`;
  browser=await pw.chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  async function expand(page){await page.locator('details').evaluateAll(es=>es.forEach(e=>e.open=true));}
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url);await page.waitForFunction(()=>!!window.lab);
  assert.deepEqual(await page.locator('#mode option:not([hidden])').evaluateAll(es=>es.map(e=>e.value)),['gru_expanded_520_new','gru_dynamics_long_new','ideal']);
  assert.equal(await page.locator('#mode').inputValue(),'gru_expanded_520_new');
  assert.equal(await page.locator('#advancedControls').getAttribute('open'),null);
  assert.equal(await page.locator('#patientFiles').getAttribute('open'),null);
  assert.equal(await page.locator('#patientLookup').isVisible(),false);
  assert.equal(await page.locator('#patientGeneratePanel').getAttribute('open'),'');
  assert.equal(await page.locator('#longResults,#expansionResults,#results').count(),0);
  await page.screenshot({path:path.join(artifacts,'simple-desktop-new.png')});
  await expand(page);
  await page.locator('#patientSeed').fill('clinical-review-batch');
  await page.locator('#patientCount').fill('30');await page.locator('#patientGenerate').click();
  const library=await page.evaluate(()=>lab.patients.library);
  assert.equal(library.patients.length,30);assert.equal(await page.evaluate(()=>lab.patients.active.id),'P000001');
  assert.deepEqual([0,1,2].map(s=>library.patients.filter(p=>p.stratum===s).length),[10,10,10]);
  await page.locator('#patientNumber').fill('17');await page.locator('#patientNumber').press('Enter');
  const chosen=await page.evaluate(()=>lab.patients.active);assert.equal(chosen.id,'P000017');
  await page.reload();await page.waitForFunction(()=>!!window.lab);await expand(page);assert.deepEqual(await page.evaluate(()=>lab.patients.active),chosen);
  assert.equal(await page.evaluate(()=>lab.patients.library.patients.length),30);
  report.checks.push('30 balanced fixed profiles; numeric lookup and active patient survive refresh');
  await page.locator('#source').selectOption('synthetic');await page.locator('#mode').selectOption('ideal');
  await page.locator('#path').selectOption('manual');
  async function target(x,y,z){await page.evaluate(([x,y,z])=>{for(const [id,value]of Object.entries({x,y,z})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input'));}},[x,y,z]);await page.waitForTimeout(450);}
  await target(-.4,.2,.7);
  let current=await page.evaluate(()=>lab.current);
  assert.ok(current.a[0]>current.baseline[0]+1);assert.ok(current.a[2]>current.baseline[2]+1);
  assert.equal(current.a[1],current.baseline[1]);assert.equal(current.a[3],current.baseline[3]);
  for(const [x,y,z]of [[.4,-.2,.6],[0,.3,.25],[-.2,-.3,1.5]]){await target(x,y,z);current=await page.evaluate(()=>lab.current);assert.ok(current.a.every(Number.isFinite));assert.deepEqual(await page.evaluate(()=>lab.patients.active),chosen);}
  for(const mode of ['gru_expanded_520_new','gru_dynamics_long_new']){
    await page.locator('#mode').selectOption(mode);await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>lab.current.baseline.every(Number.isFinite)));
    assert.equal(await page.evaluate(()=>lab.exportRun().run.controller),mode);
  }
  await page.locator('#mode').selectOption('ideal');await page.waitForTimeout(300);
  await page.locator('#pause').click();
  const run=await page.evaluate(()=>lab.exportRun());
  const {PatientLayer}=await import('../patient-model.mjs');const layer=new PatientLayer(run.run.patient);layer.restoreState(run.run.layerInitialState);
  for(const s of run.samples){const out=layer.step(s.referenceAngles,s.dtSeconds);out.forEach((v,i)=>assert.ok(Math.abs(v-s.outputAngles[i])<1e-9));}
  assert.ok(run.samples.length>50);report.checks.push('Arbitrary diagonal/depth targets; captured run reconstructs patient outputs from saved state + inputs');
  async function download(id){const event=page.waitForEvent('download');await page.locator(id).click();return fs.readFileSync(await(await event).path(),'utf8');}
  assert.deepEqual(JSON.parse(await download('#patientExport')),library);
  const runDownload=JSON.parse(await download('#patientRunExport'));assert.equal(runDownload.run.patient.id,chosen.id);
  const csv=await download('#export');assert.ok(csv.includes('reference_left_yaw'));assert.ok(csv.includes('P000017'));
  await page.locator('#patientNumber').fill('999999');await page.locator('#patientApply').click();assert.deepEqual(await page.evaluate(()=>lab.patients.active),chosen);
  const bankFile=path.join(artifacts,'library.json');fs.writeFileSync(bankFile,JSON.stringify(library));
  const fresh=await browser.newContext();const freshPage=await fresh.newPage();await freshPage.goto(url);await freshPage.waitForFunction(()=>!!window.lab);
  await freshPage.locator('#patientImport').setInputFiles(bankFile);await freshPage.waitForFunction(()=>lab.patients.library.patients.length===30);
  await freshPage.locator('#patientNumber').fill('17');await freshPage.locator('#patientApply').click();assert.deepEqual(await freshPage.evaluate(()=>lab.patients.active),chosen);
  await fresh.close();
  const storageKey='oculid-motion-patients-v1';
  const blocked=await browser.newContext();
  await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage unavailable');};Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  const volatile=await blocked.newPage();await volatile.goto(url);await volatile.waitForFunction(()=>!!window.lab);
  await volatile.locator('#patientGenerate').click();assert.equal(await volatile.evaluate(()=>lab.patients.library.patients.length),30);
  assert.match(await volatile.locator('#patientStorage').innerText(),/unavailable/);await blocked.close();
  const corruptContext=await browser.newContext();const corruptPage=await corruptContext.newPage();
  await corruptPage.goto(url);await corruptPage.waitForFunction(()=>!!window.lab);
  await corruptPage.evaluate(key=>localStorage.setItem(key,'broken JSON'),storageKey);await corruptPage.reload();await corruptPage.waitForFunction(()=>!!window.lab);
  assert.equal(await corruptPage.locator('#patientGenerate').isDisabled(),true);
  assert.equal(await corruptPage.evaluate(key=>localStorage.getItem(key),storageKey),'broken JSON');
  await corruptPage.locator('#patientImport').setInputFiles(bankFile);await corruptPage.waitForFunction(()=>lab.patients.library.patients.length===30);
  await corruptPage.reload();await corruptPage.waitForFunction(()=>!!window.lab);assert.equal(await corruptPage.evaluate(()=>lab.patients.library.patients.length),30);
  await corruptContext.close();
  const sibling=await context.newPage();await sibling.goto(url);await sibling.waitForFunction(()=>!!window.lab);
  await sibling.locator('#patientNumber').fill('18');await sibling.locator('#patientApply').click();
  await page.locator('#patientNumber').fill('17');
  await page.locator('#patientApply').click();
  assert.match(await page.locator('#patientStorage').innerText(),/Another tab/);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).activeId,storageKey),'P000018');
  await sibling.close();await page.reload();await page.waitForFunction(()=>!!window.lab);await expand(page);
  await page.locator('#patientNumber').fill('17');await page.locator('#patientApply').click();
  // The original test was paused before reloading; restore that state for later checks.
  await page.locator('#pause').click();
  report.checks.push('Unavailable storage stays usable; corrupt libraries survive until backup restore; stale tabs cannot overwrite newer saved state');
  const bad=structuredClone(library);bad.patients[0].capacity+=.00001;
  const badFile=path.join(artifacts,'conflict.json');fs.writeFileSync(badFile,JSON.stringify(bad));
  await page.locator('#patientImport').setInputFiles(badFile);await page.waitForFunction(()=>document.querySelector('#patientMessage').textContent.includes('Conflicting'));
  assert.deepEqual(await page.evaluate(()=>lab.patients.library),library);
  await expand(page);await page.locator('#patientTemplate').selectOption('adduction');assert.equal(await page.locator('#patientSideLabel').innerText(),'Affected eye');
  await page.locator('#patientSide').selectOption('right');await page.locator('#patientSeed').fill('second-batch');await page.locator('#patientGenerate').click();
  assert.equal(await page.evaluate(()=>lab.patients.active.id),'P000031');assert.equal(await page.evaluate(()=>lab.patients.library.patients.length),60);
  assert.deepEqual(await page.evaluate(()=>lab.patients.library.patients.slice(0,30)),library.patients);
  report.checks.push('Patient/run JSON and CSV exports; portable restore; atomic collision rejection; append does not change existing IDs');
  // Resume and inject arbitrary live target positions through the same FingerCamera boundary.
  await page.locator('#pause').click();await page.locator('#source').selectOption('camera');
  await page.evaluate(()=>{window.qaTracked=true;window.qaTarget=[-.35,.2,.6];Object.defineProperty(lab.finger,'tracked',{get:()=>window.qaTracked,configurable:true});lab.finger.target=()=>[...window.qaTarget];});
  await page.waitForTimeout(400);current=await page.evaluate(()=>lab.current);
  assert.ok(current.a[2]>current.baseline[2]+1);assert.equal(current.a[0],current.baseline[0]);assert.equal(current.a[1],current.baseline[1]);
  const before=await page.evaluate(()=>{window.qaTracked=false;return {a:lab.current.a,state:lab.patients.layer.snapshot(),count:lab.exportRun().samples.length,patient:lab.patients.active};});
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>({a:lab.current.a,state:lab.patients.layer.snapshot(),count:lab.exportRun().samples.length,patient:lab.patients.active})),before);
  await page.evaluate(()=>{qaTarget=[.3,-.2,1.2];qaTracked=true;});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>lab.current.patientId),'P000031');
  await page.locator('#patientDisable').click();await page.waitForTimeout(80);current=await page.evaluate(()=>lab.current);assert.deepEqual(current.a,current.baseline);
  report.checks.push('Live camera boundary uses patient layer; tracking loss freezes state; normal reference is exact bypass');
  await page.locator('#patientNumber').fill('17');await page.locator('#patientApply').click();
  await page.locator('#source').selectOption('data');await page.waitForFunction(()=>document.querySelector('#source').value==='data'&&!document.querySelector('#source').disabled,null,{timeout:60000});
  await page.locator('#pause').click();
  for(const mode of await page.locator('#mode option:not(:disabled)').evaluateAll(es=>es.map(e=>e.value))){await page.locator('#mode').selectOption(mode);await page.waitForTimeout(20);assert.ok(await page.evaluate(()=>lab.current.a.every(Number.isFinite)));}
  await page.locator('#scrub').evaluate(e=>{e.value=500;e.dispatchEvent(new Event('input'));});
  let scrubRun=await page.evaluate(()=>lab.exportRun());assert.ok(scrubRun.samples.length);
  const resumed=new PatientLayer(scrubRun.run.patient);resumed.restoreState(scrubRun.run.layerInitialState);
  assert.deepEqual(resumed.step(scrubRun.samples[0].referenceAngles,1/scrubRun.run.fps),scrubRun.samples[0].outputAngles);
  report.checks.push('Only two learned controllers plus geometric reference; advanced controls and exports collapsed by default');
  report.checks.push('All supported replay controllers and history-aware seeking remain functional');
  await page.locator('#source').selectOption('camera');
  await page.locator('details').evaluateAll(es=>es.forEach(e=>e.open=false));
  await page.screenshot({path:path.join(artifacts,'simple-desktop-patient.png')});
  for(const [width,height]of [[320,740],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    await page.locator('.app-menu').click();await page.locator('#patientNumber').scrollIntoViewIfNeeded();
    assert.deepEqual(await page.locator('.drawer-tabs button').allTextContents(),['Setup','More']);
    await page.getByRole('button',{name:'More',exact:true}).click();
    await page.locator('#advancedControls').evaluate(e=>e.open=true);
    assert.equal(await page.locator('#mode').isVisible(),true);
    await page.locator('#advancedControls').evaluate(e=>e.open=false);
    await page.getByRole('button',{name:'Setup',exact:true}).click();
    const dimensions=await page.evaluate(()=>({screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,drawer:document.querySelector('.drawer-content').clientWidth,drawerScroll:document.querySelector('.drawer-content').scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.screen+1);assert.ok(dimensions.drawerScroll<=dimensions.drawer+1);
    await page.screenshot({path:path.join(artifacts,`patients-${width}.png`)});
    await page.locator('.drawer-close').click();await page.screenshot({path:path.join(artifacts,`live-${width}.png`)});
  }
  report.checks.push('Patient controls work inside mobile tools drawer without horizontal overflow at 320/390/844 px');
  await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(150);
  assert.equal(await page.locator('#settings > #advancedControls').count(),1);
  assert.equal(await page.locator('#patientNumber').isVisible(),true);
  assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
