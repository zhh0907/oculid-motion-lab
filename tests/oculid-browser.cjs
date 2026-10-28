const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT||path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':b);});});
let browser;
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.OCULID_URL||`http://127.0.0.1:${server.address().port}/`;
  browser=await pw.chromium.launch({channel:process.env.PW_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url);await page.waitForFunction(()=>!!window.oculid);await page.selectOption('#path','static');await page.uncheck('#autoBlink');
  await page.waitForFunction(()=>oculid.sim.time>.15);await page.click('#pause');
  const held=await page.evaluate(()=>oculid.sim.current);await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>oculid.sim.current),held);
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  const invariants=await page.evaluate(()=>{
    const f=oculid.sim.frame();return {pose:oculid.view.rigs.flatMap(r=>[r.yaw.rotation.y*180/Math.PI,-r.pitch.rotation.x*180/Math.PI]),angles:f.angles,
      compare:oculid.bare.rigs.flatMap(r=>[r.yaw.rotation.y,r.pitch.rotation.x]),realistic:oculid.view.rigs.flatMap(r=>[r.yaw.rotation.y,r.pitch.rotation.x]),
      finite:oculid.view.rigs.every(r=>[r.skinGeometry,...r.cornerGeometries].every(g=>[...g.attributes.position.array].every(Number.isFinite))),triangles:oculid.view.renderer.info.render.triangles};
  });
  assert.deepEqual(invariants.compare,invariants.realistic);assert.ok(invariants.pose.every((v,i)=>Math.abs(v-invariants.angles[i])<1e-12));assert.ok(invariants.finite);assert.ok(invariants.triangles>1000);
  // Compare real rendered pixels, so a back-facing/missing iris fails the check.
  const irisPixels=await page.evaluate(()=>{
    const {renderer,camera,rigs}=oculid.view;const c=renderer.domElement,w=c.width,h=c.height,gl=renderer.getContext(),buf=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
    const x=Math.round((-.032-camera.left)/(camera.right-camera.left)*w),y=Math.round(h/2);let dark=0;
    for(let j=y-12;j<y+12;j++)for(let i=x-12;i<x+12;i++){const k=(j*w+i)*4;if(buf[k]+buf[k+1]+buf[k+2]<300)dark++;}return dark;
  });assert.ok(irisPixels>20,'pupil/iris should be visibly rendered');
  // Complete closure is visible in the renderer, and the pupil estimator is zero.
  await page.evaluate(()=>{oculid.sim.appearance.openness=0;});await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>oculid.sim.frame().lids.map(l=>l.pupilVisibility)),[0,0]);await page.screenshot({path:path.join(out,'closed.png')});
  await page.evaluate(()=>{oculid.sim.appearance.openness=1;});
  for(const pattern of ['conjugate','adduction','abduction']){
    await page.selectOption('#pattern',pattern);await page.evaluate(async pattern=>{const {demoTarget}=await import('./demo-presets.mjs');const end=pattern==='adduction'?11:4.5;for(let i=0;i<=end*250;i++)oculid.sim.step(demoTarget(i/250).target);},pattern);
    await page.waitForTimeout(50);const d=await page.evaluate(()=>oculid.sim.current);assert.ok(Math.abs(d.angles[0]-d.baseline[0])>15);if(pattern!=='conjugate')assert.equal(d.angles[2],d.baseline[2]);
  }
  await page.selectOption('#pattern','normal');await page.selectOption('#model','ideal');
  assert.equal(await page.locator('#rangePreset').inputValue(),'wide');
  await page.locator('#horizontalRange').evaluate(e=>{e.value='50';e.dispatchEvent(new Event('input'));});
  await page.evaluate(async()=>{const {targetAt}=await import('./src/simulation.mjs');const p=targetAt(4,'horizontal',.7,oculid.settings().targetRange);for(let i=0;i<150;i++)oculid.sim.step(p);});
  await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>oculid.sim.current.angles[0]<-48));
  await page.locator('#eyeFocus').screenshot({path:path.join(out,'wide-gaze.png')});
  await page.evaluate(()=>{oculid.sim.manualTime=oculid.sim.current.time-.1;});await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(()=>oculid.sim.frame().lids.map(l=>l.pupilVisibility)),[0,0]);
  await page.locator('#eyeFocus').screenshot({path:path.join(out,'wide-closed.png')});
  await page.selectOption('#rangePreset','legacy');assert.equal(await page.locator('#rangeControls').isVisible(),false);assert.equal(await page.evaluate(()=>oculid.settings().targetRange),null);
  await page.selectOption('#rangePreset','wide');await page.selectOption('#source','pointer');await page.click('#pause');
  const r=await page.locator('#eyeFocus').boundingBox();await page.mouse.move(r.x+r.width*.7,r.y+r.height*.4);await page.waitForFunction(()=>oculid.sim.current?.target[0]>.1);
  assert.ok(await page.evaluate(()=>oculid.sim.current.angles.every((v,i)=>v===oculid.sim.current.ideal[i])));
  await page.selectOption('#source','camera');
  assert.equal(await page.locator('#rangeSection').isVisible(),false);assert.equal(await page.evaluate(()=>oculid.settings().targetRange),null);
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test denial','NotAllowedError');};});await page.click('#cameraStart');await page.waitForFunction(()=>document.getElementById('cameraStatus').textContent.includes('denied'));
  assert.equal(await page.locator('#cameraStart').isEnabled(),true);
  await page.evaluate(()=>{window.qaTracked=true;window.qaTarget=[-.25,.1,.8];Object.defineProperty(oculid.finger,'tracked',{get:()=>qaTracked});oculid.finger.target=()=>[...qaTarget];});
  await page.waitForFunction(()=>oculid.sim.current?.target[1]===.1);
  const lost=await page.evaluate(()=>{qaTracked=false;return oculid.sim.current;});await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>oculid.sim.current),lost);
  await page.evaluate(()=>{qaTarget=[.21,-.12,.8];qaTracked=true;});await page.waitForFunction(()=>oculid.sim.current?.target[1]===-.12);
  await page.click('#pause');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#exportJson')]);await download.saveAs(path.join(out,'run.json'));const run=JSON.parse(fs.readFileSync(path.join(out,'run.json')));assert.equal(run.schema,'oculid-run-v1');assert.ok(run.samples.length);assert.equal(run.settings.source,'camera');
  const [csv]=await Promise.all([page.waitForEvent('download'),page.click('#exportCsv')]);await csv.saveAs(path.join(out,'run.csv'));assert.match(fs.readFileSync(path.join(out,'run.csv'),'utf8'),/left_pupil_visible/);
  await page.selectOption('#source','auto');await page.selectOption('#model','gru_expanded_520');
  for(const [width,height]of [[390,844],[320,740],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,`mobile-${width}.png`),fullPage:true});}
  const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto(url);await rp.waitForFunction(()=>!!window.oculid);assert.equal(await rp.evaluate(()=>oculid.playing),false);await reduced.close();
  assert.deepEqual(errors,[]);const report={passed:true,version:'0.3.0',angleDeltaDegrees:0,desktopAndMobile:true,renderedIris:true,fullClosure:true,wideGazeAndClosure:true,rangeControlsAndLegacyMode:true,cameraMappingUnaffectedByRange:true,threeCases:true,syntheticPointerAndInjectedCamera:true,trackingLossHold:true,exportJSONCSV:true,reducedMotion:true,physicalCameraTested:false,errors};fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
