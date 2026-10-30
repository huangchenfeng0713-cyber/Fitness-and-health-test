import * as THREE from 'three';

// Repeated real pointer constraints, followed by a continuously awake settling
// window. This catches the release-only tagAlign kick and contact feedback that
// can disappear from tests which inspect only an already sleeping final pose.
export function verifyContactPhysics({p, camera, check}) {
  const d=p._debug, zero=new THREE.Vector3(), samples=[], trials=[];
  p.setGravity(new THREE.Vector3(0,-1,0));p.reset();
  for(let i=0;i<420;i++)p.update(1/60);
  p.group.updateMatrixWorld(true);
  camera.position.set(0,.15,.4);camera.lookAt(0,.14,0);camera.updateMatrixWorld();
  let clock=0, contactFrames=0, peakPenetration=0, peakStretch=0;
  function sample() {
    const t=d.tag,T=t.R;
    for(let i=0;i<d.N;i++) {
      const k=i*3,j=((i+1)%d.N)*3,x=d.bx[k]-t.x,y=d.bx[k+1]-t.y,z=d.bx[k+2]-t.z;
      const lx=T[0]*x+T[3]*y+T[6]*z,ly=T[1]*x+T[4]*y+T[7]*z,lz=T[2]*x+T[5]*y+T[8]*z;
      // Interior printed area only: exclude the genuine hole and rounded edges.
      if(Math.abs(lx)<.0165&&Math.abs(ly)<.022&&Math.hypot(lx+.01325,ly-.0168)>.0035)
        peakPenetration=Math.max(peakPenetration,.001375-Math.abs(lz));
      peakStretch=Math.max(peakStretch,Math.hypot(d.bx[k]-d.bx[j],d.bx[k+1]-d.bx[j+1],d.bx[k+2]-d.bx[j+2])/(i===0?.0034:.0032));
    }
    if(d.beadTagActive.some(Boolean))contactFrames++;
    return {angular:Math.hypot(t.wx,t.wy,t.wz),bead:Math.max(...Array.from({length:d.N},(_,i)=>Math.hypot(d.bv[i*3],d.bv[i*3+1],d.bv[i*3+2])))};
  }
  function tick(awake=false){if(awake)p.nudge(zero);p.update(1/60);clock+=1/60;p.group.updateMatrixWorld(true);const s=sample();samples.push(s);return s;}
  const info=(point,id=21)=>({part:'tag',raycaster:new THREE.Raycaster(camera.position.clone(),point.clone().sub(camera.position).normalize()),pointerId:id,pointerType:'touch',button:0,clientX:200+point.x*3000,clientY:400-point.y*3000,time:clock});
  for(let trial=0;trial<8;trial++) {
    const point=p.tagMesh.localToWorld(new THREE.Vector3(.012,-.017,0));
    const down=info(point);check('repeated contact drag starts on the card '+trial,p.pointerDown(down)&&d.gesture?.kind==='tag');
    const target=new THREE.Vector3().fromArray(d.bx,((trial*4+6)%d.N)*3).applyMatrix4(p.group.matrixWorld);
    target.x+=trial%2?.012:-.012;target.y+=trial%3?.008:-.008;
    for(let i=1;i<=48;i++) {
      const to=point.clone().lerp(target,i/48);to.x+=Math.sin(i*Math.PI/8)*.006;
      p.pointerMove(info(to));tick();
    }
    const before=new THREE.Quaternion(d.tag.qx,d.tag.qy,d.tag.qz,d.tag.qw);
    p.pointerUp(info(target));const first=tick();
    const jump=before.angleTo(new THREE.Quaternion(d.tag.qx,d.tag.qy,d.tag.qz,d.tag.qw));
    const tail=[];let peak=first.angular;
    for(let i=0;i<480;i++){const s=tick(true);peak=Math.max(peak,s.angular);if(i>=360)tail.push(s);}
    trials.push({trial,firstAngular:first.angular,firstPoseJump:jump,peakAngular:peak,tailAngular:Math.max(...tail.map(s=>s.angular)),tailBead:Math.max(...tail.map(s=>s.bead))});
  }
  check('continuous card/chain dragging exercises solid contact',contactFrames>100,{contactFrames});
  check('release never reintroduces the one-frame alignment kick',trials.every(t=>t.firstAngular<30&&t.firstPoseJump<.5),trials);
  check('all eight releases settle while sleep is deliberately kept awake',trials.every(t=>t.tailAngular<.08&&t.tailBead<.005),trials);
  check('beads stay outside the printed card faces',peakPenetration<.00015,{peakPenetration});
  check('contact solver keeps link stretch bounded',peakStretch<1.4,{peakStretch});
  check('contact repetitions do not pin a bead or reset the mechanism',d.bim.every(w=>w>0)&&p.stats.mechResets===0,{resets:p.stats.mechResets});
  for(let i=0;i<300;i++)p.update(1/60);
  check('normal sleeping remains available after awake contact verification',p.isSleeping);

  // Pull the clasp and other visible strands across the held head. Previously
  // both participants had zero inverse mass, producing NaN on the first move.
  p.reset();for(let i=0;i<420;i++)p.update(1/60);p.group.updateMatrixWorld(true);
  const held=new THREE.Vector3(d.core.x,d.core.y,d.core.z),chainTrials=[];
  for(const bead of [0,12,22,31]) {
    const point=new THREE.Vector3().fromArray(d.bx,bead*3).applyMatrix4(p.group.matrixWorld),initial=d.bx.slice();
    const start={...info(point,22),part:'chain',bead};
    check('hand can take the actual chain particle '+bead,p.pointerDown(start)&&d.gesture?.kind==='bead');
    const target=point.clone().add(new THREE.Vector3(.025,-.012,0));let moved=0;
    for(let i=1;i<=30;i++) {
      p.pointerMove({...info(point.clone().lerp(target,i/30),22),part:'chain',bead});tick();
      for(let j=0;j<d.bx.length;j++)moved=Math.max(moved,Math.abs(d.bx[j]-initial[j]));
    }
    const remainedGrabbed=d.gesture?.kind==='bead';
    p.pointerUp(info(target,22));const tail=[];
    for(let i=0;i<480;i++){const s=tick(true);if(i>=360)tail.push(s);}
    chainTrials.push({bead,moved,remainedGrabbed,tailAngular:Math.max(...tail.map(s=>s.angular)),tailBead:Math.max(...tail.map(s=>s.bead))});
  }
  check('chain pulls remain live when a bead presses against the held toy',chainTrials.every(t=>t.remainedGrabbed&&t.moved>.003),chainTrials);
  check('released chain contacts settle without relying on sleep',chainTrials.every(t=>t.tailAngular<.08&&t.tailBead<.005),chainTrials);
  check('chain/body contacts never reset or dislodge the held toy',p.stats.mechResets===0&&d.bim.every(w=>w>0)&&held.distanceTo(new THREE.Vector3(d.core.x,d.core.y,d.core.z))<1e-12,{resets:p.stats.mechResets});
}
