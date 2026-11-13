// Preserve the requested observation interval, then wait for actual animation
// frames. A fixed sleep alone races the renderer on software-only machines.
exports.settle=async function settle(page,milliseconds){
  await page.waitForTimeout(milliseconds);
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Renderer did not advance within 120 seconds')),120000);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));
  }));
};
