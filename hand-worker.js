
let detector;
self.onmessage=async ({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,HandLandmarker}=await import('./vendor/mediapipe/vision_bundle.js');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
   self.postMessage({type:'ready'});
  }else{
   try{const r=detector.detectForVideo(data.image,data.timestamp);self.postMessage({type:'result',landmarks:r.landmarks[0]??null});}
   finally{data.image.close();}
  }
 }catch(e){self.postMessage({type:'error',message:String(e)});}
};
