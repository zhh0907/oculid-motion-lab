// Integrated 3D geometry, inspection controls, presets and moving eyelid seams.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT||path.join(root,'qa','faces-v8');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':b);});});
let browser;
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await pw.chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[],requests=[];
  page.on('request',r=>requests.push(r.url()));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await page.goto(process.env.OCULID_URL||`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!!window.oculid);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.ok(!/\p{Script=Han}/u.test(await page.locator('body').innerText()));
  assert.deepEqual(await page.locator('#faceType option').evaluateAll(a=>a.map(x=>x.value)),['male','female']);
  const boundary=await page.evaluate(()=>{const h=oculid.view.head,p=h.geometry.attributes.position;return h.data.patches.map(a=>a.boundary.map(i=>[p.getX(i),p.getY(i),p.getZ(i)]));});
  const anatomy=await page.evaluate(()=>({head:oculid.view.head.inspection,eyes:oculid.view.rigs.map(r=>r.inspection),vertices:oculid.view.head.geometry.attributes.position.count}));
  assert.ok(anatomy.head.sharedBoundaryVertices.every(n=>n>=160));assert.equal(anatomy.head.photographicFaceTexture,false);
  assert.ok(anatomy.eyes.every(e=>e.irisDepth<e.corneaTip));
  assert.equal(await page.locator('input[type=color]').count(),0);
  const palette=await page.locator('#skin option').evaluateAll(options=>options.map(o=>o.value));assert.equal(palette.length,5);
  await page.selectOption('#path','static');await page.uncheck('#autoBlink');await page.selectOption('#model','ideal');
  await page.selectOption('#pattern','abduction');await page.selectOption('#patternSide','left');
  const patient=await page.evaluate(()=>oculid.sim.patient),checks=[];
  for(let i=0;i<palette.length;i++){
    await page.selectOption('#skin',palette[i]);assert.deepEqual(await page.evaluate(()=>oculid.sim.patient),patient);
    await page.evaluate(()=>{for(let j=0;j<400;j++)oculid.sim.step([-.4,.07,.7]);});await page.waitForTimeout(120);
    checks.push(await page.evaluate(()=>{const {angles,baseline}=oculid.sim.current;return {leftLimited:Math.abs(angles[0])<Math.abs(baseline[0])*.3,rightUnchanged:angles[2]===baseline[2],finite:oculid.view.rigs.every(r=>[...r.skinGeometry.attributes.position.array,...r.skinGeometry.attributes.uv.array].every(Number.isFinite))};}));
    await page.locator('#eyeFocus').screenshot({path:path.join(out,`skin-${i+1}.png`)});
  }
  assert.ok(checks.every(v=>v.leftLimited&&v.rightUnchanged&&v.finite));
  const motion=()=>page.evaluate(()=>({patient:oculid.sim.patient,time:oculid.sim.time,current:oculid.sim.current,layer:oculid.sim.layer.snapshot(),rows:oculid.sim.rows.length,trace:oculid.sim.trace.revision}));
  const points=()=>page.evaluate(()=>Array.from(oculid.view.head.geometry.attributes.position.array));
  const before=await motion(),male=await points();
  await page.selectOption('#faceType','female');await page.waitForTimeout(150);const female=await points();
  assert.deepEqual(await motion(),before);assert.ok(female.some((v,i)=>Math.abs(v-male[i])>.006));
  const apertureIndices=await page.evaluate(()=>oculid.view.head.data.patches.flatMap(a=>Array.from({length:a.count},(_,i)=>a.start+i)));
  for(const k of apertureIndices)assert.deepEqual(female.slice(k*3,k*3+3),male.slice(k*3,k*3+3));
  await page.selectOption('#faceType','male');await page.waitForTimeout(120);assert.deepEqual(await points(),male);
  await page.selectOption('#faceType','female');await page.waitForTimeout(120);assert.deepEqual(await points(),female);assert.deepEqual(await motion(),before);
  assert.equal(await page.evaluate(()=>oculid.sim.export().faceChanges.at(-1).faceType),'female');
  await page.selectOption('#faceType','male');
  await page.selectOption('#skin','#b98e79');await page.selectOption('#pattern','normal');await page.evaluate(()=>{for(let i=0;i<100;i++)oculid.sim.step([0,0,.7]);});await page.waitForTimeout(150);
  await page.click('#frontView');assert.equal(await page.locator('#orbitToggle').getAttribute('aria-pressed'),'false');
  await page.locator('#eyeFocus').screenshot({path:path.join(out,'front.png')});await page.screenshot({path:path.join(out,'page.png'),fullPage:true});
  for(const [name,target]of [['left',[-.8,0,.7]],['up',[0,.5,.7]],['down',[0,-.6,.7]]]){
    await page.evaluate(target=>{for(let i=0;i<200;i++)oculid.sim.step(target);},target);await page.waitForTimeout(120);await page.locator('#eyeFocus').screenshot({path:path.join(out,name+'.png')});
  }
  await page.evaluate(()=>{oculid.sim.appearance.openness=0;});await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>oculid.sim.frame().lids.map(l=>l.pupilVisibility)),[0,0]);await page.locator('#eyeFocus').screenshot({path:path.join(out,'closed.png')});
  await page.evaluate(()=>{oculid.sim.appearance.openness=1;for(let i=0;i<100;i++)oculid.sim.step([0,0,.7]);});
  assert.deepEqual(await page.evaluate(()=>{const h=oculid.view.head,p=h.geometry.attributes.position;return h.data.patches.map(a=>a.boundary.map(i=>[p.getX(i),p.getY(i),p.getZ(i)]));}),boundary);
  for(const type of ['male','female']){
    await page.selectOption('#faceType',type);await page.evaluate(()=>oculid.view.setView(.35,.03,.86));await page.waitForTimeout(150);await page.locator('#eyeFocus').screenshot({path:path.join(out,type+'.png')});
    if(type==='female'){
      await page.evaluate(()=>oculid.view.setView(1.1,0,.65));await page.waitForTimeout(120);await page.locator('#eyeFocus').screenshot({path:path.join(out,'female-side.png')});
      await page.evaluate(()=>{oculid.view.setView(0,0,.43);oculid.sim.appearance.openness=0;});await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>oculid.sim.frame().lids.map(l=>l.pupilVisibility)),[0,0]);await page.locator('#eyeFocus').screenshot({path:path.join(out,'female-closed.png')});
      await page.evaluate(()=>{oculid.sim.appearance.openness=1;for(let i=0;i<200;i++)oculid.sim.step([.7,-.35,.7]);});await page.waitForTimeout(120);await page.locator('#eyeFocus').screenshot({path:path.join(out,'female-gaze.png')});
      await page.evaluate(()=>{for(let i=0;i<100;i++)oculid.sim.step([0,0,.7]);});
    }
  }
  await page.selectOption('#faceType','male');await page.click('#frontView');
  const beforeInspection=await page.evaluate(()=>({patient:oculid.sim.patient,t:oculid.sim.time}));
  await page.click('#orbitToggle');const box=await page.locator('#eyeFocus canvas').first().boundingBox();
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.4+130,box.y+box.height*.5+8,{steps:8});await page.mouse.up();
  assert.ok(await page.evaluate(()=>oculid.view.orbit.yaw>.7));
  await page.evaluate(()=>oculid.view.setView(1.1,.02,.55));await page.waitForTimeout(120);await page.locator('#eyeFocus').screenshot({path:path.join(out,'side.png')});
  await page.evaluate(()=>oculid.view.setView(.48,.04,.92));await page.waitForTimeout(120);await page.locator('#eyeFocus').screenshot({path:path.join(out,'head.png')});
  for(const mode of ['clay','wire','skin']){
    await page.selectOption('#surfaceView',mode);assert.equal(await page.evaluate(()=>oculid.view.mode),mode);await page.waitForTimeout(120);
    await page.locator('#eyeFocus').screenshot({path:path.join(out,mode+'.png')});
  }
  assert.deepEqual(await page.evaluate(()=>({patient:oculid.sim.patient,t:oculid.sim.time})),beforeInspection);
  await page.click('#frontView');assert.ok(await page.evaluate(()=>oculid.view.orbit.yaw===0&&oculid.view.orbit.distance===.43&&!oculid.view.orbit.enabled));
  for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#eyeFocus').screenshot({path:path.join(out,`mobile-${width}.png`)});}
  assert.ok(!requests.some(u=>/Map-COL|face-reference/.test(u)));assert.deepEqual(errors,[]);
  const report={passed:true,version:'0.8.0',englishInterface:true,twoDistinct3DFaceShapes:true,reversibleShapeSwitch:true,shapeSwitchPreservesMotion:true,faceTimelineExport:true,fiveSkinPresets:true,noColourPicker:true,patientPreserved:true,finiteGeometry:true,wideGazeAndClosure:true,fixedSharedBoundaries:true,noPhotographicFaceRequests:true,orbitAndInspectionPreserveState:true,frontReset:true,anatomy,mobile:true,errors};fs.writeFileSync(path.join(out,'face-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
