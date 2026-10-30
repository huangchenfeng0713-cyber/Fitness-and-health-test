import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createExhibitObjects,visibleBounds,exportExhibit} from './exhibit_objects.js';

const INLINE=window.__ASSETS__;
if(INLINE){
 THREE.DefaultLoadingManager.setURLModifier(url=>INLINE[url.replace(/^.*?assets\//,'')]||url);
 const native=window.fetch.bind(window);window.fetch=(url,o)=>native(INLINE[String(url).replace(/^.*?assets\//,'')]||url,o);
}
const $=s=>document.querySelector(s),canvas=$('#c');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality=matchMedia('(pointer: coarse)').matches?'low':'high';
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,3));renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.001,4);
const floatRig=new THREE.Group(),pivot=new THREE.Group();floatRig.name='floating_exhibition';floatRig.add(pivot);scene.add(floatRig);
RectAreaLightUniformsLib.init();
function softbox(color,intensity,w,h,x,y,z){const l=new THREE.RectAreaLight(color,intensity,w,h);l.position.set(x,y,z);l.lookAt(0,0,0);scene.add(l);return l;}
softbox(0xfff5e4,4.6,.24,.34,-.18,.16,.23);
softbox(0xd9e8ff,1.65,.20,.28,.20,.025,.12);
softbox(0xffead0,5.1,.14,.29,.08,.11,-.16);
const fill=new THREE.HemisphereLight(0xdce4ea,0x211d19,.20);scene.add(fill);
// An invisible studio reflection rig: broad highlights on metal, no room geometry.
const studio=new THREE.Scene();studio.background=new THREE.Color(0x111315);
for(const [x,y,z,w,h,color,power]of [[-.8,.8,1,1.1,1.9,0xfff3df,3],[1,.3,.3,.8,1.7,0xd6e3f8,1.6],[.4,1,-.6,.6,1.4,0xffffff,2.2]]){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m);
}
const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.035);scene.environment=env.texture;scene.environmentIntensity=.28;
studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
const items={};let current='plush',held=false,ready=false,time=0,zoom=1,distance=.5,targetDistance=.5,lastStage='',tapReleaseAt=0;
const pointers=new Map();let pinch=null,gesture=null,rotationVelocity=new THREE.Vector2();
const qx=new THREE.Quaternion(),qy=new THREE.Quaternion(),qz=new THREE.Quaternion(),axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),axisZ=new THREE.Vector3(0,0,1);
const raycaster=new THREE.Raycaster(),v2=new THREE.Vector2();
const stageHints={sealed:'轻点折叠封口 · 打开原包装',flapOpen:'轻点纸卡 · 沿袋口取出',cardOut:'轻点纸卡 · 顺着折痕展开',cardOpen:'轻点吸塑壳 · 轻轻拿出',blisterFree:'轻点冰箱贴 · 从壳中取出',magnetFree:'长按轻触 · 松手恢复'};
function status(){const i=items[current],text=!held?'轻点藏品，拿近一点':current==='magnet'?(i?.busy?'正在轻轻打开…':stageHints[i?.stage]||'单指转动，双指靠近细节'):'长按表面，轻触短绒';if($('#status').textContent!==text)$('#status').textContent=text;}
function updateLabels(){document.body.classList.toggle('holding',held);const i=items[current];if(!i)return;$('#itemName').textContent=i.title;$('#itemMaterial').textContent=i.material;$('#itemIndex').textContent=current==='plush'?'OBJECT 01 / 02':'OBJECT 02 / 02';$('#detailCopy').textContent=i.details;$('#repack').hidden=current!=='magnet';$('#returnItem').hidden=!held;document.querySelectorAll('[data-item]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.item===current)));status();}
function measure(item){
 const q=pivot.quaternion.clone(),fp=floatRig.position.clone(),sp=item.slot.position.clone();
 pivot.quaternion.identity();floatRig.position.set(0,0,0);item.slot.position.set(0,0,0);scene.updateMatrixWorld(true);
 const b=visibleBounds(item.boundsRoot);item.center=b.getCenter(new THREE.Vector3());item.size=b.getSize(new THREE.Vector3());
 pivot.quaternion.copy(q);floatRig.position.copy(fp);item.slot.position.copy(sp);scene.updateMatrixWorld(true);
 const vertical=item.size.y/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
 const horizontal=item.size.x/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
 item.fit=Math.max(vertical*1.72,horizontal*1.48,.075);
}
function frameTarget(){const i=items[current];if(i)targetDistance=i.fit*zoom*(held?.78:1);}
function front(instant=false){cancelGesture();pivot.quaternion.identity();rotationVelocity.set(0,0);zoom=1;const i=items[current];if(i){measure(i);i.slot.position.copy(i.center).negate();frameTarget();if(instant)distance=targetDistance;}}
function select(id){if(!items[id])return;cancelGesture();items[current]?.release();current=id;held=false;lastStage=items[id].stage;Object.values(items).forEach(i=>i.slot.visible=i.id===id);front();updateLabels();closeGallery(false);}
function pickup(){if(!ready)return;held=true;frameTarget();updateLabels();}
function putBack(){cancelGesture();held=false;front();updateLabels();}
function pick(x,y){const r=canvas.getBoundingClientRect();v2.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);raycaster.setFromCamera(v2,camera);scene.updateMatrixWorld(true);const root=items[current]?.boundsRoot;if(!root)return null;return raycaster.intersectObject(root,true).find(h=>{if(h.object.userData.noExport||h.object.userData.isFur)return false;let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return (Array.isArray(h.object.material)?h.object.material:[h.object.material]).some(m=>m.visible!==false);})||null;}
function marker(x,y,on){const m=$('#touchMark');m.hidden=!on;m.style.left=x+'px';m.style.top=y+'px';}
function rotate(dx,dy){const speed=.006;qx.setFromAxisAngle(axisX,dy*speed);qy.setFromAxisAngle(axisY,dx*speed);pivot.quaternion.premultiply(qy).premultiply(qx).normalize();rotationVelocity.set(dx*speed,dy*speed);}
function beginPinch(){const a=[...pointers.values()];if(a.length<2)return;items[current]?.release();marker(0,0,false);gesture=null;pinch={distance:Math.max(12,Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)),angle:Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x)};}
canvas.addEventListener('pointerdown',e=>{
 if(!ready||!$('#gallery').hidden||e.button>0)return;
 if(!$('#details').hidden){closeDetails();return;}
 e.preventDefault();rotationVelocity.set(0,0);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 try{canvas.setPointerCapture(e.pointerId);}catch{}
 if(pointers.size===1){gesture={id:e.pointerId,x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,at:time,moved:false,press:false,hit:pick(e.clientX,e.clientY)};}
 else beginPinch();
 document.body.classList.add('handling');
},{passive:false});
canvas.addEventListener('pointermove',e=>{
 const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size>=2){const a=[...pointers.values()],d=Math.max(12,Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)),angle=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);if(pinch){zoom=THREE.MathUtils.clamp(zoom*pinch.distance/d,.32,2.2);const da=Math.atan2(Math.sin(angle-pinch.angle),Math.cos(angle-pinch.angle));qz.setFromAxisAngle(axisZ,-THREE.MathUtils.clamp(da,-.35,.35));pivot.quaternion.premultiply(qz).normalize();}pinch={distance:d,angle};frameTarget();return;}
 if(!gesture)return;
 if(Math.hypot(e.clientX-gesture.x0,e.clientY-gesture.y0)>7)gesture.moved=true;
 if(gesture.press){const h=pick(e.clientX,e.clientY);if(h)items[current].touch(h,.65);marker(e.clientX,e.clientY,true);}else if(gesture.moved)rotate(dx,dy);
 gesture.x=e.clientX;gesture.y=e.clientY;
},{passive:false});
function pointerEnd(e){
 if(!pointers.has(e.pointerId))return;
 const cancelled=e.type==='pointercancel'||e.type==='lostpointercapture';
 const g=gesture;
 pointers.delete(e.pointerId);items[current]?.release();marker(0,0,false);
 if(!cancelled&&g&&g.id===e.pointerId&&!g.moved&&!g.press&&time-g.at<.4&&g.hit){
   if(!held)pickup();
   else if(current==='magnet'){items.magnet.advance();status();}
   else{items.plush.touch(g.hit,.45);tapReleaseAt=time+.16;}
 }
 if(cancelled)rotationVelocity.set(0,0);
 if(pointers.size===1){const[id,p]=[...pointers][0];gesture={id,x:p.x,y:p.y,x0:p.x,y0:p.y,at:time,moved:true,press:false,hit:null};pinch=null;}
 else if(!pointers.size){gesture=null;pinch=null;document.body.classList.remove('handling');}
}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('lostpointercapture',pointerEnd);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!ready)return;items[current].release();zoom=THREE.MathUtils.clamp(zoom*Math.exp(THREE.MathUtils.clamp(e.deltaY,-200,200)*.0016),.32,2.2);frameTarget();},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function cancelGesture(){pointers.clear();gesture=null;pinch=null;tapReleaseAt=0;rotationVelocity.set(0,0);items[current]?.release();marker(0,0,false);document.body.classList.remove('handling');}
addEventListener('blur',cancelGesture);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
function openGallery(){cancelGesture();closeDetails(false);$('#gallery').hidden=false;$('#openGallery').setAttribute('aria-expanded','true');$('#closeGallery').focus();}
function closeGallery(focus=true){$('#gallery').hidden=true;$('#openGallery').setAttribute('aria-expanded','false');if(focus)$('#openGallery').focus();}
function openDetails(){cancelGesture();$('#details').hidden=false;$('#openDetails').setAttribute('aria-expanded','true');$('#closeDetails').focus();}
function closeDetails(focus=true){$('#details').hidden=true;$('#openDetails').setAttribute('aria-expanded','false');if(focus)$('#openDetails').focus();}
$('#openGallery').addEventListener('click',openGallery);$('#closeGallery').addEventListener('click',()=>closeGallery());
$('#openDetails').addEventListener('click',()=>$('#details').hidden?openDetails():closeDetails());$('#closeDetails').addEventListener('click',()=>closeDetails());
$('#returnItem').addEventListener('click',putBack);$('#resetView').addEventListener('click',()=>{front();closeDetails();});
$('#repack').addEventListener('click',()=>{items.magnet.reset();held=false;lastStage='';front();updateLabels();closeDetails();});
document.querySelectorAll('[data-item]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.item)));
document.addEventListener('keydown',e=>{
 const modal=!$('#gallery').hidden?$('#gallery'):!$('#details').hidden?$('#details'):null;
 if(e.key==='Escape'){if(modal===$('#gallery'))closeGallery();else if(modal)closeDetails();else if(held)putBack();return;}
 if(modal&&e.key==='Tab'){const list=[...modal.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled),first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 if(!modal&&e.target===canvas){if(e.key==='Enter')held?putBack():pickup();if(e.key==='ArrowLeft')rotate(-12,0);if(e.key==='ArrowRight')rotate(12,0);if(e.key==='ArrowUp')rotate(0,-12);if(e.key==='ArrowDown')rotate(0,12);}
});
$('#downloadModel').addEventListener('click',async()=>{const b=$('#downloadModel');b.disabled=true;try{const glb=await exportExhibit(items[current]);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));a.download=items[current].title+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}finally{b.disabled=false;}});
function resize(){cancelGesture();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);if(ready){measure(items[current]);frameTarget();}}
addEventListener('resize',resize);
function tick(dt){
 dt=Math.min(.05,Math.max(0,dt));time+=dt;if(!ready)return;
 const item=items[current];item.update(dt);
 if(item.stage!==lastStage){lastStage=item.stage;measure(item);frameTarget();status();}
 if(item.busy){measure(item);frameTarget();}else if(current==='magnet')status();
 item.slot.position.lerp(item.center.clone().negate(),reduced?1:1-Math.exp(-dt*7));
 if(gesture&&!gesture.moved&&!gesture.press&&gesture.hit&&time-gesture.at>.36&&pointers.size===1){if(!held)pickup();gesture.press=item.touch(gesture.hit,.75);if(gesture.press)marker(gesture.x,gesture.y,true);}
 if(tapReleaseAt&&time>tapReleaseAt){item.release();tapReleaseAt=0;}
 if(!pointers.size&&!reduced&&rotationVelocity.length()>.0002){rotate(rotationVelocity.x/.006*.8,rotationVelocity.y/.006*.8);rotationVelocity.multiplyScalar(Math.exp(-dt*13));}
 distance+=(targetDistance-distance)*(reduced?1:1-Math.exp(-dt*7));
 floatRig.position.y=reduced||pointers.size?0:Math.sin(time*.6)*Math.min(item.size.y*.004,.0007);
 camera.position.set(0,0,distance);camera.lookAt(0,-item.size.y*.04,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
}
function snapshotState(){const i=items[current];return{current,held,stage:i?.stage,busy:!!i?.busy,zoom,distance,targetDistance,quaternion:pivot.quaternion.toArray(),pointers:pointers.size,pressure:items.plush?.pressure||0,visible:Object.values(items).filter(i=>i.slot.visible).map(i=>i.id),viewport:[innerWidth,innerHeight]};}
async function thumbnail(item){
 Object.values(items).forEach(i=>i.slot.visible=i===item);current=item.id;held=false;front(true);tick(.016);renderer.render(scene,camera);return canvas.toDataURL('image/png');
}
(async()=>{
 try{
  Object.assign(items,await createExhibitObjects({THREE,scene,camera,renderer,domElement:canvas,quality}));
  for(const item of Object.values(items)){const slot=new THREE.Group(),alignment=new THREE.Group();slot.name='display_'+item.id;alignment.quaternion.copy(item.alignment);alignment.add(item.root);slot.add(alignment);pivot.add(slot);item.slot=slot;slot.visible=false;measure(item);slot.position.copy(item.center).negate();}
  ready=true;const width=innerWidth,height=innerHeight;renderer.setPixelRatio(1);renderer.setSize(400,480,false);camera.aspect=400/480;camera.updateProjectionMatrix();
  for(const item of Object.values(items)){$(item.id==='plush'?'#previewPlush':'#previewMagnet').src=await thumbnail(item);}
  renderer.setPixelRatio(Math.min(devicePixelRatio,3));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();select('plush');front(true);tick(.016);
  if(renderer.compileAsync)await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
  const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{tick(clock.getDelta());renderer.render(scene,camera);});$('#loading').classList.add('done');$('#loading').setAttribute('aria-hidden','true');
  window.__app={scene,camera,renderer,items,pivot,select,pickup,putBack,front,pick,openGallery,closeGallery,state:snapshotState,
    step(n=1,dt=1/60){for(let i=0;i<n;i++)tick(dt);renderer.render(scene,camera);},
    async saveGLB(id,name,part=null){const glb=await exportExhibit(items[id],part);const bytes=new Uint8Array(glb),chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));await fetch('http://127.0.0.1:8876/save?name='+encodeURIComponent(name),{method:'POST',body:'data:model/gltf-binary;base64,'+btoa(chunks.join(''))});return glb.byteLength;}
  };
 }catch(e){console.error(e);$('#loading .loading-label').textContent='暂时无法载入藏品，请刷新重试。';$('#loading').dataset.error=String(e);}
})();
