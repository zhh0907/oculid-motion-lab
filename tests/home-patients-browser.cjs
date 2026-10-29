const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT||path.join(root,'qa','patients-v4');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':b);});
});
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.OCULID_URL||`http://127.0.0.1:${server.address().port}/`;
 browser=await pw.chromium.launch({channel:process.env.PW_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url);await page.waitForFunction(()=>!!window.oculid);
 await page.selectOption('#pattern','conjugate');await page.selectOption('#patternSide','right');
 assert.equal(await page.evaluate(()=>oculid.sim.patient.side),'right');assert.match(await page.locator('#patientActive').innerText(),/Example/);
 await page.locator('#patientGeneratePanel>summary').click();await page.fill('#patientCount','30');
 await page.locator('#patientGeneratePanel details>summary').click();await page.fill('#patientSeed','browser-v4');await page.click('#patientGenerate');
 const library=await page.evaluate(()=>oculid.patients.bank.library);assert.equal(library.patients.length,30);
 assert.deepEqual([0,1,2].map(i=>library.patients.filter(p=>p.stratum===i).length),[10,10,10]);
 await page.fill('#patientNumber','17');await page.press('#patientNumber','Enter');const patient=await page.evaluate(()=>oculid.sim.patient);assert.equal(patient.id,'P000017');
 await page.click('#patientNext');assert.equal(await page.evaluate(()=>oculid.sim.patient.id),'P000018');await page.click('#patientPrevious');
 await page.reload();await page.waitForFunction(()=>!!window.oculid);assert.deepEqual(await page.evaluate(()=>oculid.sim.patient),patient);
 await page.selectOption('#model','ideal');assert.deepEqual(await page.evaluate(()=>oculid.sim.patient),patient);
 // A single fixed profile applies to multi-axis and depth input, with matching chart data.
 await page.evaluate(()=>{for(let i=0;i<4000;i++)oculid.sim.step([.5*Math.sin(i*.004),.22*Math.cos(i*.006),.7+.2*Math.sin(i*.003)]);});
 await page.waitForFunction(()=>oculid.trace.lastDraw?.count>700);
 const current=await page.evaluate(()=>({frame:oculid.sim.current,latest:oculid.trace.lastDraw.latest,run:oculid.sim.export()}));
 assert.ok(current.frame.angles.some((v,i)=>Math.abs(v-current.frame.baseline[i])>1));assert.equal(current.run.patientLibraryId,library.libraryId);
 const projected=await page.evaluate(()=>oculid.rails.state);
 for(let i=0;i<2;i++){const angle=current.frame.angles[2*i]*Math.PI/180,pitch=current.frame.angles[2*i+1]*Math.PI/180;assert.ok(Math.abs(projected[i].position-Math.sin(angle)*Math.cos(pitch)*.01055/.0132)<1e-12);}
 await page.locator('#eyePositionRails').screenshot({path:path.join(out,'eye-rails.png')});
 assert.equal(current.latest.time,current.run.samples.find(s=>s.time===current.latest.time).time);
 assert.deepEqual(current.latest.angles,current.run.samples.find(s=>s.time===current.latest.time).angles);
 await page.locator('.trajectory-card').screenshot({path:path.join(out,'horizontal.png')});
 await page.selectOption('#traceView','xy');await page.waitForFunction(()=>oculid.trace.lastDraw?.mode==='xy');
 await page.locator('.trajectory-card').screenshot({path:path.join(out,'xy.png')});await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 await page.selectOption('#traceView','vertical');await page.waitForFunction(()=>oculid.trace.lastDraw?.mode==='vertical');
 // Clearing a graph does not alter the patient, recording, or current plant state.
 const prior=await page.evaluate(()=>({time:oculid.sim.time,count:oculid.sim.rows.length,state:oculid.sim.layer.snapshot(),patient:oculid.sim.patient}));
 await page.click('#traceClear');await page.waitForFunction(()=>oculid.trace.lastDraw?.count===0);
 assert.deepEqual(await page.evaluate(()=>({time:oculid.sim.time,count:oculid.sim.rows.length,state:oculid.sim.layer.snapshot(),patient:oculid.sim.patient})),prior);
 // Actual playback advances the chart; pause holds it. Camera loss holds both clocks.
 await page.selectOption('#source','camera');await page.evaluate(()=>{window.qaTracked=true;Object.defineProperty(oculid.finger,'tracked',{get:()=>qaTracked});oculid.finger.target=()=>[.4,.12,.7];});
 await page.click('#pause');await page.waitForFunction(()=>oculid.trace.lastDraw?.count>8);await page.click('#pause');
 const heldRails=await page.evaluate(()=>oculid.rails.state);
 const held=await page.evaluate(()=>oculid.sim.trace.revision);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>oculid.sim.trace.revision),held);assert.deepEqual(await page.evaluate(()=>oculid.rails.state),heldRails);
 await page.click('#pause');await page.evaluate(()=>{qaTracked=false;});await page.waitForTimeout(80);const lost=await page.evaluate(()=>({time:oculid.sim.time,revision:oculid.sim.trace.revision}));const lostRails=await page.evaluate(()=>oculid.rails.state);
 await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>({time:oculid.sim.time,revision:oculid.sim.trace.revision})),lost);assert.deepEqual(await page.evaluate(()=>oculid.rails.state),lostRails);assert.match(await page.locator('#railsStatus').innerText(),/Waiting for fingertip/);
 const segment=await page.evaluate(()=>oculid.sim.trace.samples().at(-1).segment);await page.evaluate(()=>{qaTracked=true;});await page.waitForFunction(s=>oculid.sim.trace.samples().at(-1)?.segment>s,segment);await page.click('#pause');
 assert.deepEqual(await page.evaluate(()=>oculid.sim.patient),patient);
 const [runDownload]=await Promise.all([page.waitForEvent('download'),page.click('#exportJson')]);await runDownload.saveAs(path.join(out,'run.json'));
 const exported=JSON.parse(fs.readFileSync(path.join(out,'run.json')));assert.deepEqual(exported.patient,patient);assert.equal(exported.patientLibraryId,library.libraryId);
 const [csvDownload]=await Promise.all([page.waitForEvent('download'),page.click('#exportCsv')]);await csvDownload.saveAs(path.join(out,'run.csv'));assert.match(fs.readFileSync(path.join(out,'run.csv'),'utf8'),/patient_id,patient_library_id,patient_template,patient_side/);
 await page.locator('#patientFiles>summary').click();const [bankDownload]=await Promise.all([page.waitForEvent('download'),page.click('#patientExport')]);await bankDownload.saveAs(path.join(out,'patients.json'));
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'patients.json'))),library);
 const workspace=await context.newPage();await workspace.goto(new URL('workspace.html',url).href);await workspace.waitForFunction(()=>!!window.lab);assert.match(await workspace.locator('#patientActive').innerText(),/P000017/);await workspace.close();
 const separate=await browser.newContext({reducedMotion:'reduce'}),imported=await separate.newPage();await imported.goto(url);await imported.waitForFunction(()=>!!window.oculid);
 await imported.setInputFiles('#patientImport',path.join(out,'patients.json'));await imported.waitForFunction(()=>oculid.patients.bank.library.patients.length===30);
 await imported.fill('#patientNumber','17');await imported.click('#patientApply');assert.deepEqual(await imported.evaluate(()=>oculid.sim.patient),patient);
 const bad=JSON.parse(JSON.stringify(library));bad.patients[0].capacity+=.000001;
 await imported.setInputFiles('#patientImport',{name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await imported.waitForFunction(()=>document.getElementById('patientMessage').classList.contains('error'));
 assert.deepEqual(await imported.evaluate(()=>oculid.patients.bank.library),library);await separate.close();
 await page.selectOption('#source','auto');await page.selectOption('#traceView','horizontal');
 await page.evaluate(()=>{for(let i=0;i<1000;i++)oculid.sim.step([.4*Math.sin(i*.008),.15,.7]);});
 for(const [width,height]of [[390,844],[320,740],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.trajectory-card').screenshot({path:path.join(out,`chart-${width}.png`)});
   await page.locator('#eyePositionRails').screenshot({path:path.join(out,`rails-${width}.png`)});
   await page.selectOption('#traceView','xy');await page.waitForFunction(()=>oculid.trace.lastDraw?.mode==='xy');
   await page.locator('.trajectory-card').screenshot({path:path.join(out,`xy-${width}.png`)});await page.selectOption('#traceView','horizontal');
 }
 await page.click('#patientNormal');assert.equal(await page.evaluate(()=>oculid.sim.patient),null);assert.equal(await page.evaluate(()=>oculid.sim.trace.length),0);
 // Obvious unilateral impairment leaves one eye marker behind its normal reference.
 await page.setViewportSize({width:1440,height:1100});await page.selectOption('#pattern','abduction');await page.selectOption('#patternSide','left');
 await page.evaluate(()=>{oculid.sim.appearance.blink=false;for(let i=0;i<800;i++)oculid.sim.step([-.7,0,.7]);});
 await page.waitForFunction(()=>oculid.rails.state[0].position<-.05);
 const limited=await page.evaluate(()=>oculid.rails.state);assert.ok(Math.abs(limited[0].position)<.12);assert.ok(limited[0].reference<-.5);assert.equal(limited[1].position,limited[1].reference);
 await page.locator('#eyePositionRails').screenshot({path:path.join(out,'rails-limited.png')});
 await page.evaluate(()=>{oculid.sim.manualTime=oculid.sim.current.time-.1;});await page.waitForFunction(()=>document.querySelectorAll('.rail-marker.is-occluded').length===2);
 assert.deepEqual(await page.evaluate(()=>oculid.rails.state.map(s=>s.position)),limited.map(s=>s.position));
 assert.deepEqual(errors,[]);const report={passed:true,thirtyBalancedPatients:true,numberRecallAndPersistence:true,modelChangePreservesPatient:true,workspaceSharesLibrary:true,portableImportAndConflicts:true,arbitrary3DTargets:true,threeTraceViews:true,liveEyeRails:true,railGeometryMatchesEyes:true,unilateralRailLimitation:true,occlusionIndication:true,independentClear:true,pauseAndTrackingLoss:true,reacquisitionGap:true,patientRunExports:true,mobileWidths:[320,390,844],physicalCameraTested:false,errors};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
