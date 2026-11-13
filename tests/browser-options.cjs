// CI has no physical GPU. Explicitly select Chromium's software renderer for
// these isolated, local test pages; the application and geometry are unchanged.
module.exports={
  channel:process.env.PW_CHANNEL==='bundled'?undefined:(process.env.PW_CHANNEL||'chrome'),
  headless:true,
  args:process.env.PW_SOFTWARE_GL==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]
};
