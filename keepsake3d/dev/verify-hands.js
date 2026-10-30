export async function verifyHands(a, {THREE, check, step, snap}) {
  const p=a.modules.plush, m=a.modules.magnet;
  const canvas=a.renderer.domElement;
  let time=1000;
  const screen = v => { const q=v.clone().project(a.camera),r=canvas.getBoundingClientRect();return {x:r.left+(q.x+1)*r.width/2,y:r.top+(1-q.y)*r.height/2}; };
  const inf = (q,id=51) => { const r=canvas.getBoundingClientRect(),rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2((q.x-r.left)/r.width*2-1,1-(q.y-r.top)/r.height*2),a.camera);return {raycaster:rc,clientX:q.x,clientY:q.y,pointerId:id,pointerType:'touch',button:0,time:time+=1/60}; };
  const pw = (x,y,z) => p.__body.localToWorld(new THREE.Vector3(x,y,z));
  a.view('plush');await step(90);
  let q1=screen(pw(-.012,.082,.016)),q2=screen(pw(.012,.082,.016));
  check('plush first touch',p.pointerDown(inf(q1,51)));
  check('plush second touch',p.pointerDown(inf(q2,52)));
  for(let i=1;i<=24;i++) {const f=i/24;p.pointerMove(inf({x:q1.x+12*f,y:q1.y-9*f},51));p.pointerMove(inf({x:q2.x-12*f,y:q2.y+9*f},52));await step(2);}
  check('plush two-finger deformation bounded',p.stats.fleshDev>.0001&&p.stats.fleshDev<.025,{deformation:p.stats.fleshDev,kind:p._debug.gesture?.kind});
  await snap('plush-two-finger.jpg');
  p.pointerUp(inf(q2,52));p.pointerUp(inf(q1,51));await step(300);
  check('plush recovers shape',p.stats.fleshDev<.003,{deformation:p.stats.fleshDev});
  check('plush stays on hook after gentle pinch',p.hooked);
  p.reset();await step(90);
  const target=p.hook.position.clone();target.applyMatrix4(p.group.matrixWorld);
  a.controls.target.copy(target).add(new THREE.Vector3(0,-.06,0));a.camera.position.copy(a.controls.target).add(new THREE.Vector3(.02,.05,.65));a.controls.update();
  let start=screen(pw(0,.082,.017));check('plush hold to lift',p.pointerDown(inf(start,51)));await step(25);
  const end=screen(pw(.07,.25,.017));
  for(let i=1;i<=70;i++){p.pointerMove(inf({x:start.x+(end.x-start.x)*i/70,y:start.y+(end.y-start.y)*i/70},51));await step(2);}
  await step(60);check('lift removes plush from hook',!p.hooked,{hooked:p.hooked,core:[p._debug.core.x,p._debug.core.y,p._debug.core.z]});
  p.pointerUp(inf(end,51));await step(600);
  const body=p.__body,pa=body.geometry.attributes.position,v=new THREE.Vector3();let minY=Infinity;
  body.updateWorldMatrix(true,false);for(let i=0;i<pa.count;i+=2){v.fromBufferAttribute(pa,i).applyMatrix4(body.matrixWorld);minY=Math.min(minY,v.y);}
  check('plush table collision',minY>-.003&&minY<.01,{minY,coreY:p._debug.core.y});
  check('plush landing damped',Math.hypot(p._debug.core.vx,p._debug.core.vy,p._debug.core.vz)<.02);
  await snap('plush-on-table.jpg');p.reset();await step(90);

  a.view('magnet');await step(90);
  for(const name of ['magnet','card']) {
    const b=m.debug.bodies[name];
    if(name==='card') {
      b.rb.setTranslation({x:-.05,y:.004,z:.10},true);b.rb.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),true);
      b.rb.setLinvel({x:0,y:0,z:0},true);b.rb.setAngvel({x:0,y:0,z:0},true);await step(120);
    }
    const point=(x,y)=>b.root.localToWorld(new THREE.Vector3(x,y,name==='magnet'?.003:.0007));
    const y=name==='magnet'?-.009:.040;
    q1=screen(point(-.014,y));q2=screen(point(.014,y));
    check(name+' first touch',m.pointerDown(inf(q1,51)),{point:q1,flipped:b.flipped});
    check(name+' second touch',m.pointerDown(inf(q2,52)),{point:q2,firstHit:m.debug.gesture.hit?.target,kind:m.debug.gesture.kind,position:b.root.position.toArray(),quaternion:b.root.quaternion.toArray()});
    for(let i=1;i<=22;i++){m.pointerMove(inf({x:q1.x+7*i/22,y:q1.y},51));m.pointerMove(inf({x:q2.x-7*i/22,y:q2.y},52));await step(2);}
    check(name+' bend bounded',Math.abs(b.bend.k)>1e-3&&Math.abs(b.bend.k)<=b.bend.kMax*1.151,{curvature:b.bend.k,limit:b.bend.kMax});
    m.pointerUp(inf(q2,52));check(name+' remaining finger keeps holding',m.debug.gesture.kind==='move'&&m.debug.hold.body===b);m.pointerUp(inf(q1,51));await step(180);
    check(name+' bend springs back',Math.abs(b.bend.k)<1e-3,{curvature:b.bend.k});time+=1;
  }
  a.view('all');await step(90);
  const b=m.debug.bodies.magnet;
  start=screen(m.debug.point('magnet'));
  check('magnet grab for panel',m.pointerDown(inf(start,51)));await step(20);
  const panel=m.debug.physics.surfaces[0];
  const endpoint=panel.c.clone().add(new THREE.Vector3(0,.025,.002)).applyMatrix4(m.group.matrixWorld),end2=screen(endpoint);
  for(let i=1;i<=100;i++){m.pointerMove(inf({x:start.x+(end2.x-start.x)*i/100,y:start.y+(end2.y-start.y)*i/100},51));await step(3);}
  await step(180);await snap('magnet-at-panel-held.jpg');
  m.pointerUp(inf(end2,51));await step(240);
  check('magnet attaches to steel',m.debug.state.magnetOnFridge,{stage:m.stage,position:b.root.position.toArray(),surface:panel.c.toArray(),hold:m.debug.hold.mode});
  a.lamp({on:true,color:'warm',spot:2});
  await snap('magnet-on-panel.jpg');
  time+=1;
  const previousX=b.root.position.x;
  start=screen(m.debug.point('magnet'));check('grab attached magnet',m.pointerDown(inf(start,51)));await step(20);
  let dest=screen(m.debug.point('magnet').clone().add(new THREE.Vector3(.04,.015,0)));
  for(let i=1;i<=40;i++){m.pointerMove(inf({x:start.x+(dest.x-start.x)*i/40,y:start.y+(dest.y-start.y)*i/40},51));await step(3);}
  m.pointerUp(inf(dest,51));await step(120);
  check('slide on steel',m.debug.state.magnetOnFridge&&Math.abs(b.root.position.x-previousX)>.015,{position:b.root.position.toArray(),previousX});time+=1;
  start=screen(m.debug.point('magnet'));check('grab magnet to detach',m.pointerDown(inf(start,51)));await step(20);
  dest=screen(new THREE.Vector3(.3,.003,.07));
  for(let i=1;i<=70;i++){m.pointerMove(inf({x:start.x+(dest.x-start.x)*i/70,y:start.y+(dest.y-start.y)*i/70},51));await step(3);}
  m.pointerUp(inf(dest,51));await step(300);
  check('magnet detaches and rests',!m.debug.state.magnetOnFridge&&b.root.position.y<.03,{position:b.root.position.toArray(),stage:m.stage});
  // Regression: inspect the same bent surface that the vertex shader renders.
  const verts=[];
  b.root.updateWorldMatrix(true,true);
  const inverse=b.root.matrixWorld.clone().invert();
  b.root.traverse(o=>{if(o.isMesh&&o.material.visible!==false){const pa=o.geometry.attributes.position,mat=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<pa.count;i++)verts.push(new THREE.Vector3().fromBufferAttribute(pa,i).applyMatrix4(mat));}});
  function lowest(){let lo=Infinity;const bd=b.bend,k=bd.k,v=new THREE.Vector3();for(const p of verts){v.copy(p);if(Math.abs(k)>1e-4){const px=-bd.D.y,py=bd.D.x,dx=p.x-bd.C.x,dy=p.y-bd.C.y,u=dx*px+dy*py,z=p.z-bd.C.z,along=dx*bd.D.x+dy*bd.D.y,R=1/k,h=(R-z)*Math.sin(u*k);v.set(bd.C.x+bd.D.x*along+px*h,bd.C.y+bd.D.y*along+py*h,bd.C.z+R-(R-z)*Math.cos(u*k));}v.applyMatrix4(b.root.matrixWorld);lo=Math.min(lo,v.y);}return lo;}
  for(const [i,angles]of [[-Math.PI/2,0,0],[Math.PI/2,.4,.2],[.3,.5,1.1]].entries()){
    b.rb.setTranslation({x:.30,y:.11,z:.02},true);b.rb.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)),true);b.rb.setLinvel({x:.02,y:-1,z:0},true);b.rb.setAngvel({x:.1,y:.2,z:0},true);
    b.bend.active=true;b.bend.target=b.bend.kMax*(i===1?-1:1);let min=Infinity;
    for(let j=0;j<120;j++){await step(1);min=Math.min(min,lowest());}
    check('bent magnet clears table '+i,min>-.0002,{minY:min});
    b.bend.active=false;await step(300);check('magnet sleeps after rotated drop '+i,b.rb.isSleeping(),{v:b.rb.linvel(),w:b.rb.angvel(),minY:lowest(),p:b.root.position.toArray(),k:b.bend.k});
  }

}
