const frame=document.querySelector('iframe'),out=document.querySelector('pre');
const mobile=new URLSearchParams(location.search).has('mobile'),suffix=mobile?'mobile':'desktop';
if(mobile){frame.style.width='390px';frame.style.height='844px';}
const report={mode:suffix,checks:[],errors:[]};
const post=(name,body)=>fetch('http://127.0.0.1:8876/save?name='+name,{method:'POST',body});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});out.textContent=JSON.stringify(report,null,2);if(!pass)throw Error(name);};
const bootstrap=`<script>
window.__network=[];window.__runtimeErrors=[];
window.addEventListener('error',e=>window.__runtimeErrors.push(e.message));
window.addEventListener('unhandledrejection',e=>window.__runtimeErrors.push(String(e.reason)));
const oldFetch=window.fetch;window.fetch=(url,opts)=>{
 const address=typeof url==='string'?url:(url.url||String(url));
 if(!/^(data:|blob:)/.test(address)){window.__network.push(address);return Promise.reject(Error('Offline network request blocked'));}
 return oldFetch(url,opts);
};
${mobile?"const mm=window.matchMedia;window.matchMedia=q=>q==='(pointer: coarse)'?{matches:true,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(q);":""}
<\/script>`;
try {
  const html=await(await fetch('../dist/keepsake.html')).text();
  frame.srcdoc=html.replace('<head>','<head>'+bootstrap);
  for(let i=0;i<180&&!frame.contentWindow.__app;i++)await wait(250);
  const w=frame.contentWindow,a=w.__app;
  check('offline modules load',!!(a?.modules.plush?._debug&&a?.modules.magnet),w.__runtimeErrors);
  a.renderer.setAnimationLoop(null);a.step(120);
  const snap=async name=>{a.renderer.render(a.scene,a.camera);await post(name+'-'+suffix+'.jpg',a.renderer.domElement.toDataURL('image/jpeg',.92));};
  const p=a.modules.plush,b=p.__body;
  const point=b.localToWorld(b.position.clone().set(0,.082,.017)).project(a.camera),r=a.renderer.domElement.getBoundingClientRect();
  const x=(point.x+1)*r.width/2,y=(1-point.y)*r.height/2;
  const before=[p._debug.core.x,p._debug.core.y,p._debug.core.z];
  await a.gesture([[x,y],[x+8,y+3],[x+16,y+4]],{pointerType:'touch',holdFrames:15,stepsPerMove:4});
  check('native touch moves the plush',p.stats.fleshDev>1e-7||Math.hypot(p._debug.core.x-before[0],p._debug.core.y-before[1],p._debug.core.z-before[2])>1e-6);
  a.step(180);
  check('native touch routing',!p._debug.gesture&&a.controls.enabled&&p.stats.mechResets===0,{resets:p.stats.mechResets});
  p.reset();a.step(120);
  const doc=frame.contentDocument;
  doc.querySelector('[data-view="all"]').click();a.step(100);await snap('offline-scene');
  doc.querySelector('#btnLamp').click();
  check('lamp panel opens',!doc.querySelector('#lampPanel').hidden);
  doc.querySelector('[data-lamp-color="white"]').click();doc.querySelector('[data-lamp-spot="0"]').click();a.step(80);
  check('lamp controls select',doc.querySelector('[data-lamp-spot="0"]').classList.contains('on')&&doc.querySelector('[data-lamp-color="white"]').classList.contains('on'));
  doc.querySelector('#lampOn').click();a.cab(false);a.step(5);a.renderer.render(a.scene,a.camera);
  const gl=a.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let max=0;for(let i=0;i<pixels.length;i+=4)max=Math.max(max,pixels[i],pixels[i+1],pixels[i+2]);
  check('complete darkness when off',max<=1,{max});
  doc.querySelector('#lampOn').click();doc.querySelector('[data-lamp-color="warm"]').click();doc.querySelector('[data-lamp-spot="2"]').click();
  doc.querySelector('#btnLamp').click();doc.querySelector('[data-view="plush"]').click();a.step(100);await snap('offline-plush');
  check('no network dependencies',w.__network.length===0,{blocked:w.__network,resources:w.performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).length});
  check('no runtime errors',w.__runtimeErrors.length===0,w.__runtimeErrors);
  report.viewport=[w.innerWidth,w.innerHeight];report.fibres=p.__fur.group.children[0].geometry.instanceCount;
}catch(e){report.errors.push(e.stack||String(e));}
await post('offline-'+suffix+'.json',JSON.stringify(report,null,2));out.textContent=JSON.stringify(report,null,2);
