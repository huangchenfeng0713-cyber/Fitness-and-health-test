const frame = document.querySelector('iframe');
const result = document.querySelector('#result');
const report = { checks: [], errors: [] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (name, body) => fetch('http://127.0.0.1:8876/save?name=' + encodeURIComponent(name), {method:'POST',body});
const check = (name, pass, detail) => { report.checks.push({name,pass,detail}); result.textContent=JSON.stringify(report,null,2); if(!pass) throw Error(name+': '+JSON.stringify(detail)); };
try {
  for (let i=0; i<120&&!frame.contentWindow.__app; i++) await sleep(250);
  const a=frame.contentWindow.__app;
  check('both modules load', !!(a?.modules.plush?._debug && a?.modules.magnet), a&&Object.keys(a.modules));
  a.renderer.setAnimationLoop(null);
  const p=a.modules.plush, m=a.modules.magnet;
  const snap = async name => { a.renderer.render(a.scene,a.camera); await post(name,a.renderer.domElement.toDataURL('image/jpeg',.92)); };
  const step = async n => { for(let i=0;i<n;i+=30){a.step(Math.min(30,n-i));await sleep(0);} };
  const bounds = () => Object.fromEntries(Object.entries(m.debug.bodies).map(([k,b])=>[k,{state:b.state,p:b.root.position.toArray(),mass:b.rb?.mass()}]));
  const screen = world => {const v=world.clone().project(a.camera),r=a.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
  let tm=100;
  const info = (pos,id=7,button=0) => {
    const r=a.renderer.domElement.getBoundingClientRect(),ndc={x:(pos.x-r.left)/r.width*2-1,y:1-(pos.y-r.top)/r.height*2};
    const rc=new (m.debug.gesture.rayW.constructor)();
    // Use Three loaded by the same development import map.
    const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(ndc,a.camera);
    return {raycaster,clientX:pos.x,clientY:pos.y,pointerId:id,pointerType:'touch',button,time:tm+=.04};
  };
  const THREE=await import('/node_modules/three/build/three.module.js');
  if(new URLSearchParams(location.search).has('visual')) {
    a.lamp({on:true,color:'white',spot:2});a.view('plush');await step(90);
    const center=p.__body.localToWorld(new THREE.Vector3(0,.06,0));
    a.controls.target.copy(center);a.camera.position.copy(center).add(new THREE.Vector3(.015,.005,.23));a.controls.update();
    await snap('diagnostic-fur.jpg');p.__fur.group.visible=false;await snap('diagnostic-base.jpg');
    const pa=p.__body.geometry.attributes.position,na=p.__body.geometry.attributes.normal;
    let out=0,n=0; for(let i=0;i<pa.count;i++){if(pa.getY(i)>.065){n++;if(pa.getX(i)*na.getX(i)+(pa.getY(i)-.082)*na.getY(i)+(pa.getZ(i)-.004)*na.getZ(i)>0)out++;}}
    report.normalRatio=out/n;report.material=p.__body.material.type;report.meshTransform=p.__body.matrixWorld.toArray();
    p.__fur.group.visible=true;
    p.softMeshes.forEach(x=>{x.receiveShadow=false; x.material.needsUpdate=true;});p.__fur.group.children.forEach(x=>{x.receiveShadow=false;x.material.needsUpdate=true;});
    await snap('diagnostic-no-shadow.jpg');
    const shells=p.__fur.group.children; report.sameGeometry=shells[0].geometry===p.__body.geometry;
    shells.forEach((s,i)=>s.visible=i===0);await snap('diagnostic-one-shell.jpg');
    shells[0].material=new THREE.MeshStandardMaterial({map:p.__body.material.map,roughness:1});
    await snap('diagnostic-plain-shell.jpg');
    throw new Error('visual diagnostic complete');
  }
  const tap = async name => { a.view('magnet');await step(65);const q=screen(m.debug.point(name));const rect=a.renderer.domElement.getBoundingClientRect();check('visible '+name,q.x>0&&q.x<rect.width&&q.y>65&&q.y<rect.height-145,{...q,target:a.controls.target.toArray(),focus:m.focus.target.toArray(),distance:m.focus.distance});const e=info(q);check('hit '+name,m.pointerDown(e),q);m.pointerUp({...e,time:tm+=.1});await step(140);tm+=1; };
  const states = ['flapOpen','cardOut','cardOpen','blisterFree','magnetFree'];
  await step(180);
  a.lamp({on:true,color:'white',spot:1}); a.view('plush'); await step(90); await snap('plush-front.jpg');
  const d=p._debug; check('plush finite', [d.core.x,d.core.y,d.core.z,...d.bx].every(Number.isFinite));
  const before=d.core.x; p.poke(new THREE.Vector3(0,.082,.018),new THREE.Vector3(.2,0,0));await step(30);
  check('plush responds', Math.abs(d.core.x-before)>1e-6,{delta:d.core.x-before}); await step(300);
  check('plush settles',Math.hypot(d.core.vx,d.core.vy,d.core.vz)<.02,{speed:Math.hypot(d.core.vx,d.core.vy,d.core.vz),sleeping:p.isSleeping});
  a.view('magnet');await step(60);await snap('magnet-packed.jpg');
  // Record a closer front and side view to check the sewn join and pile at actual size.
  if(new URLSearchParams(location.search).has('capture')) {
    a.view('plush');await step(90);
    const ctr=p.__body.localToWorld(new THREE.Vector3(0,.065,0));
    a.controls.target.copy(ctr);a.camera.position.copy(ctr).add(new THREE.Vector3(.012,.005,.19));a.controls.update();await step(1);
    await snap('plush-detail.jpg');
    a.camera.position.copy(ctr).add(new THREE.Vector3(.16,.015,.07));a.controls.update();await step(1);await snap('plush-seam.jpg');
    a.view('magnet');await step(90);
  }
  for(const [i,name] of ['flap','card','cardTop','blister','magnet'].entries()) { await tap(name);check('unpack '+states[i],m.stage===states[i],{stage:m.stage,bodies:bounds()}); }
  await snap('magnet-unpacked.jpg');
  const b=m.debug.bodies.magnet; const q=screen(m.debug.point('magnet'));
  let e=info(q);check('grab magnet',m.pointerDown(e));await step(20);
  for(let i=1;i<=30;i++){const t={x:q.x-150*i/30,y:q.y-30*i/30};m.pointerMove(info(t));await step(2);}
  m.pointerUp(info({x:q.x-150,y:q.y-30})); await step(300);
  check('rigid body settles on table',b.rb&&b.rb.isSleeping()&&b.root.position.y>-.005,bounds());
  await snap('magnet-dropped.jpg');
  const {verifyHands}=await import('./verify-hands.js');
  await verifyHands(a,{THREE,check,step,snap});
  for(const bb of Object.values(m.debug.bodies)) check(bb.name+' finite',[...bb.root.position.toArray(),...bb.root.quaternion.toArray()].every(Number.isFinite));
  m.reset();await step(120);check('repack',m.stage==='sealed',bounds());
  if(new URLSearchParams(location.search).has('export')) {
    p.reset();await step(90);
    check('export plush',await a.saveGLB('plush','plush-chain-tag.glb')>100000);
    check('export plush body with fibres',await a.saveGLB('plush','plush-body.glb','body')>100000);
    check('export packaged magnet',await a.saveGLB('magnet','magnet-packaged.glb')>100000);
    check('export magnet body',await a.saveGLB('magnet','magnet.glb','item')>100000);
  }
  a.view('all');await step(60);await snap('scene.jpg');
  a.lamp({on:false});a.cab(false);await step(30);await snap('lights-off.jpg');
  check('lights off',a.scene.environmentIntensity===0);
  a.view('plush');await step(90);
  for(let i=0;i<4;i++) {a.lamp({on:true,spot:i,color:'white',level:.75});await step(60);await snap('lamp-position-'+i+'.jpg');}
  a.lamp({on:true,spot:2,color:'warm',level:.75});await step(60);await snap('lamp-warm.jpg');
  a.lamp({on:true,spot:2,color:'white',level:.2});await step(30);await snap('lamp-dim.jpg');
  a.lamp({on:true,color:'warm'});await step(30);
} catch(e){report.errors.push(e.stack||String(e));}
await post('report.json',JSON.stringify(report,null,2));result.textContent=JSON.stringify(report,null,2);
