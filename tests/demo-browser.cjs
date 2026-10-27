// Integration tests inject fingertip positions at the camera boundary; no physical camera is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const http=require('node:http');
let pw;try{pw=require('playwright');}catch{pw=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=process.env.DEMO_ROOT||path.resolve(__dirname,'..'),artifacts=process.env.QA_OUTPUT||path.join(os.tmpdir(),'binocular-patient-qa');
fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.wasm':'application/wasm'};
  fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':body);});
});
let browser;
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=process.env.DEMO_URL||`http://127.0.0.1:${server.address().port}/demo.html`;
  browser=await pw.chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:960}});
  await context.addInitScript(()=>localStorage.setItem('binocular-motion-patients-v1','existing library must not change'));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url);await page.waitForFunction(()=>!!window.demo);
  assert.equal(await page.locator('[data-case]').count(),3);
  assert.equal(await page.locator('select,input:not([type=hidden]),#patientGenerate').count(),0);
  await page.waitForFunction(()=>demo.current?.time>.1);
  assert.equal(await page.locator('[aria-pressed=true]').count(),1);
  await page.locator('#pauseDemo').click();
  const fixed=await page.evaluate(()=>demo.current);await page.waitForTimeout(80);assert.deepEqual(await page.evaluate(()=>demo.current),fixed);
  for(const key of ['conjugate','adduction','abduction']){
    await page.locator(`[data-case=${key}]`).click();
    const result=await page.evaluate(async key=>{
      const {demoTarget}=await import('./demo-presets.mjs?v=demo1');
      const end=key==='adduction'?11:4.5;
      for(let i=0;i<=end*250;i++)demo.sim.step(demoTarget(i/250).target);
      return demo.current;
    },key);
    assert.equal(result.caseKey,key);assert.equal(await page.locator(`[data-case=${key}]`).getAttribute('aria-pressed'),'true');
    assert.ok(Math.abs(result.output[0]-result.baseline[0])>15);
    if(key!=='conjugate')assert.equal(result.output[2],result.baseline[2]);
    await page.waitForTimeout(60);await page.screenshot({path:path.join(artifacts,`demo-${key}-desktop.png`)});
  }
  await page.locator('#restartDemo').click();assert.equal(await page.evaluate(()=>demo.current),null);
  await page.locator('#pauseDemo').click();await page.waitForFunction(()=>demo.current?.time>.1);
  // Permission rejection must leave an operable automatic demo and expose the reason.
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test denial','NotAllowedError');};});
  await page.locator('#cameraStart').click();await page.waitForFunction(()=>demo.input==='auto');
  assert.match(await page.locator('#cameraStatus').innerText(),/denied|拒绝/);
  assert.equal(await page.locator('#cameraStart').isVisible(),true);
  // Exercise the live-input route without accessing physical camera hardware.
  await page.evaluate(()=>{
    window.qaTracked=true;window.qaTarget=[-.36,.15,.7];
    Object.defineProperty(demo.finger,'tracked',{get:()=>qaTracked});demo.finger.target=()=>[...qaTarget];
    demo.finger.start=async()=>{demo.finger.stream={getTracks:()=>[]};document.getElementById('cameraStop').disabled=false;};
  });
  await page.locator('#cameraStart').click();await page.waitForFunction(()=>demo.current?.target[1]===.15);
  assert.equal(await page.locator('#cameraPanel').isVisible(),true);
  await page.locator('#cameraPreview').evaluate(e=>e.style.transform='scaleX(-1)');
  assert.equal(await page.locator('#cameraPreview').evaluate(e=>getComputedStyle(e).transform),'none');
  const held=await page.evaluate(()=>{qaTracked=false;return demo.current;});await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>demo.current),held);
  await page.evaluate(()=>{qaTarget=[.25,-.2,1.1];qaTracked=true;});await page.waitForFunction(()=>demo.current?.target[1]===-.2);
  assert.equal(await page.evaluate(()=>demo.current.output[1]===demo.current.baseline[1]),true);
  await page.locator('#cameraStop').click();assert.equal(await page.evaluate(()=>demo.input),'auto');assert.equal(await page.locator('#cameraPanel').isVisible(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('binocular-motion-patients-v1')),'existing library must not change');
  await page.locator('#pauseDemo').click();
  for(const [width,height]of [[320,740],[390,844],[844,390]]){
    await page.setViewportSize({width,height});
    await page.locator('[data-case=adduction]').click();
    await page.evaluate(async()=>{const {demoTarget}=await import('./demo-presets.mjs?v=demo1');for(let i=0;i<=2750;i++)demo.sim.step(demoTarget(i/250).target);});
    await page.waitForTimeout(80);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const sizes=await page.locator('.eye-view canvas').evaluateAll(es=>es.map(e=>({w:e.clientWidth,h:e.clientHeight})));
    assert.deepEqual(sizes[0],sizes[1]);
    await page.screenshot({path:path.join(artifacts,`demo-mobile-${width}.png`),fullPage:true});
  }
  await page.reload();await page.waitForFunction(()=>!!window.demo);assert.equal(await page.evaluate(()=>demo.sim.case.key),'conjugate');
  const reduced=await browser.newContext({reducedMotion:'reduce'});const rp=await reduced.newPage();await rp.goto(url);await rp.waitForFunction(()=>!!window.demo);
  assert.equal(await rp.evaluate(()=>demo.playing),false);await rp.locator('#pauseDemo').click();await rp.waitForFunction(()=>demo.current?.time>.05);await reduced.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({threeCases:true,strongDeficits:true,automaticAndLive:true,permissionFailureRecoverable:true,patientLibraryUntouched:true,mobileOverflow:false,physicalCameraTested:false,errors},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
