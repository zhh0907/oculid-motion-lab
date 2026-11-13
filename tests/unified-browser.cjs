const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa','unified');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':b);});
});
let browser;
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.OCULID_URL||`http://127.0.0.1:${server.address().port}/`;
  browser=await pw.chromium.launch({channel:process.env.PW_CHANNEL==='bundled'?undefined:(process.env.PW_CHANNEL||'chrome'),headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url+'migration.html');
  const legacy=await page.evaluate(async()=>{
    const {createLibrary,generatePatients}=await import('./patient-model.mjs');
    const library=generatePatients(createLibrary('old-bank-browser'),{count:3,template:'adduction',side:'left',seed:'unify-browser'});
    const value=JSON.stringify({library,activeId:library.patients[1].id});localStorage.setItem('binocular-motion-patients-v1',value);return value;
  });
  await page.click('#reviewPatients');assert.equal(await page.evaluate(()=>localStorage.getItem('oculid-motion-patients-v1')),null);
  await page.click('#applyMigration');assert.match(await page.locator('#migrationStatus').innerText(),/Imported/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('binocular-motion-patients-v1')),legacy);
  await page.goto(url);await page.waitForFunction(()=>!!window.oculid);
  assert.equal(await page.evaluate(()=>oculid.sim.patient.id),'P000002');
  await page.evaluate(()=>{for(let i=0;i<100;i++)oculid.sim.step([.3,.1,.7]);});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({run:oculid.sim.export(),time:oculid.sim.time,plant:oculid.sim.layer.snapshot(),previous:oculid.sim.previous,trace:oculid.sim.trace}));
  const before=await snapshot();
  for(const mode of ['eyes','face','compare','eyes','compare']){
    await page.selectOption('#displayMode',mode);await page.waitForTimeout(90);assert.equal(await snapshot(),before,'display must not mutate motion or recording');
    assert.equal(await page.evaluate(()=>oculid.view.head.group.visible),mode!=='eyes');
    assert.equal(await page.locator('#comparison').isVisible(),mode==='compare');
  }
  const paired=await page.evaluate(()=>({
    main:oculid.view.rigs.map(r=>[r.yaw.rotation.y,r.pitch.rotation.x]),reference:oculid.bare.rigs.map(r=>[r.yaw.rotation.y,r.pitch.rotation.x]),
    projection:oculid.view.camera.projectionMatrix.elements,referenceProjection:oculid.bare.camera.projectionMatrix.elements,
    pose:oculid.view.camera.matrixWorld.elements,referencePose:oculid.bare.camera.matrixWorld.elements
  }));
  assert.deepEqual(paired.main,paired.reference);assert.deepEqual(paired.projection,paired.referenceProjection);assert.deepEqual(paired.pose,paired.referencePose);
  await page.screenshot({path:path.join(out,'paired-desktop.png'),fullPage:true});
  await page.selectOption('#displayMode','eyes');await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'eyes-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.selectOption('#displayMode','compare');await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'paired-mobile.png'),fullPage:true});
  // The original workspace loads the very same migrated bank and keeps old run schema.
  await page.setViewportSize({width:1440,height:1100});await page.goto(url+'workspace.html');await page.waitForFunction(()=>!!window.lab);await page.click('#pause');
  assert.equal(await page.evaluate(()=>lab.patients.active.id),'P000002');
  const held=await page.evaluate(()=>JSON.stringify({current:lab.current,patient:lab.patients.layer.snapshot()}));
  for(const mode of ['eyes','face']){await page.selectOption('#displayMode',mode);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>JSON.stringify({current:lab.current,patient:lab.patients.layer.snapshot()})),held);}
  // A stale migration review cannot overwrite a library changed by another tab.
  await page.goto(url+'migration.html');await page.click('#reviewPatients');
  await page.evaluate(()=>{const k='oculid-motion-patients-v1',value=JSON.parse(localStorage.getItem(k));value.activeId=null;localStorage.setItem(k,JSON.stringify(value));});
  await page.click('#applyMigration');assert.match(await page.locator('#migrationStatus').innerText(),/changed in another tab/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('oculid-motion-patients-v1')).activeId),null);
  assert.deepEqual(errors,[]);
  const report={passed:true,version:'0.9.0',sharedLibrary:true,migrationReviewedAndLossless:true,staleMigrationProtected:true,displayStateInvariant:true,pairedAnglesAndCameraExact:true,workspaceSharedPatient:true,mobileLayout:true,errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
