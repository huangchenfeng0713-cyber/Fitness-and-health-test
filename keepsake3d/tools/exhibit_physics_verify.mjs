import * as THREE from 'three';
import {createExhibitMotion} from '../dev/generated-exhibit-motion.mjs';
import {verifyContactPhysics} from './contact_physics_verify.mjs';

export async function verifyExhibitionPhysics({createPlush, meshes, meta, tf, tb, check}) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .001, 4);
  const softMeshes = meshes.map(m => new THREE.Mesh(m.geometry.clone(), m.material));
  softMeshes.forEach((m, i) => {m.name = meshes[i].name; m.geometry.attributes.position.copy(m.geometry.attributes.restPosition);});
  const p = await createPlush({scene, camera, quality:'low'}, {
    softMeshes, attachPoint:new THREE.Vector3(...meta.attach_point_m),
    tagTextures:{front:tf, back:tb}, tagSize:{w:.0373,h:.0486,t:.00035}, tagHole:{x:.0054,y:.0075,d:.0032},
    hookPosition:new THREE.Vector3(0,.21,0), mount:'wall', exhibition:true,
    params:{fleshHz:120,mechSubsteps:4,mechIters:5,tagLinDamp:2.4,tagAngDamp:4,chainDamp:2.8},
  });
  const step = (seconds, hz=60) => {for(let i=0;i<Math.round(seconds*hz);i++)p.update(1/hz);p.group.updateMatrixWorld(true);};
  const d=p._debug, core=()=>new THREE.Vector3(d.core.x,d.core.y,d.core.z);
  const fixed=core();
  const attachment=()=>d.attachRest.clone().sub(d.com0).applyQuaternion(new THREE.Quaternion(d.core.qx,d.core.qy,d.core.qz,d.core.qw)).add(core());
  const meanHeight=()=>{const a=attachment();let h=0;for(let i=0;i<d.N;i++)h+=d.bx[i*3+1]-a.y;return h/d.N;};
  const chainStretch=()=>{
    let max=0;for(let i=0;i<d.N;i++){const j=(i+1)%d.N;
      max=Math.max(max,Math.hypot(d.bx[i*3]-d.bx[j*3],d.bx[i*3+1]-d.bx[j*3+1],d.bx[i*3+2]-d.bx[j*3+2])/(i===0?p.params.claspSegment:p.params.beadPitch));}
    return max;
  };
  step(6);
  check('exhibition sleeps under gravity',p.isSleeping);
  check('held toy supports a wholly dynamic chain below its sewn loop',d.bim.every(w=>w>0)&&meanHeight()<-.01,{meanHeight:meanHeight()});
  check('both tag faces have distinct full-size textures',p.tagMesh.material[0].map===tf && p.tagMesh.material[1].map===tb && tf!==tb && tf.image.width>=500 && tb.image.width>=500);
  const before=core(), chainBefore=d.bx.slice();
  p.nudge(new THREE.Vector3(.1,0,.04));let peakTravel=0;
  for(let f=0;f<15;f++){p.update(1/60);for(let i=0;i<d.N*3;i++)peakTravel=Math.max(peakTravel,Math.abs(d.bx[i]-chainBefore[i]));}
  check('input moves the flexible chain while the hand supports the toy',core().distanceTo(before)<1e-12 && peakTravel>.0001,{peakTravel,coreTravel:core().distanceTo(before)});
  check('no invisible bead supports the exhibition',d.bim.every(w=>w>0)&&core().distanceTo(fixed)<1e-12);
  step(10);check('released chain and body settle',p.isSleeping);
  const resting=d.bx.slice(), restTag=p.tagMesh.matrix.clone();step(5);
  check('sleep is exactly stationary',d.bx.every((v,i)=>v===resting[i]) && p.tagMesh.matrix.equals(restTag));

  p.reset();step(5);
  let face=new THREE.Vector3(0,0,1).applyQuaternion(p.tagMesh.quaternion);
  let peakStretch=0;
  for(let turn=0;turn<8;turn++){
    check('tag accepts turn '+turn,p.turnTag());
    for(let i=0;i<420;i++){p.update(1/60);peakStretch=Math.max(peakStretch,chainStretch());}
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(p.tagMesh.quaternion);
    const dot=face.dot(normal);
    check('tag shows the opposite face on every turn '+turn,dot<-.75&&face.z*normal.z<0,{dot,normal:normal.toArray()});
    face=normal;
  }
  check('repeated flips keep the held toy supported without pinning the chain',core().distanceTo(fixed)<1e-12&&d.bim.every(w=>w>0)&&p.stats.mechResets===0,{resets:p.stats.mechResets});
  check('chain link stretch stays bounded during flips',peakStretch<1.35,{peakStretch});
  step(10);check('repeated flips settle',p.isSleeping);
  verifyAssistedTurnBoundaries(p,check,'mobile');

  // A pointer actually grabs the card, drags off the object, then is cancelled.
  p.reset();step(5);camera.position.set(0,.17,.4);camera.lookAt(0,.15,0);camera.updateMatrixWorld();
  let info,hit=false;
  for(const x of [-.014,0,.014])for(const y of [.017,.008,0]){
    if(hit)continue;
    const point=p.tagMesh.localToWorld(new THREE.Vector3(x,y,0));
    const raycaster=new THREE.Raycaster(camera.position.clone(),point.sub(camera.position).normalize());
    info={part:'tag',raycaster,clientX:200,clientY:200,pointerId:3,pointerType:'touch',button:0,time:0};
    p.pointerDown(info);hit=d.gesture?.kind==='tag';if(!hit)p.cancelInteraction();
  }
  check('paper tag is independently grabbable',hit);
  const grabbed=p.tagMesh.position.clone();
  for(let i=1;i<=30;i++){
    const target=new THREE.Vector3(.05*i/30,.18,-.005);
    info.raycaster.ray.direction.copy(target.sub(camera.position).normalize());info.clientX=200+i*3;info.time=i/60;
    p.pointerMove(info);p.update(1/60);
  }
  check('drag moves the tag independently of the view',p.tagMesh.position.distanceTo(grabbed)>.004);
  p.cancelInteraction();step(12);
  check('cancel releases the tag and preserves hand support',!d.gesture&&p.isSleeping&&core().distanceTo(fixed)<1e-12);

  const poses=[];
  for(const hz of [30,60,120]){
    p.reset();step(5,hz);p.nudge(new THREE.Vector3(.09,0,.03));step(1,hz);
    poses.push({tag:new THREE.Vector3(d.tag.x,d.tag.y,d.tag.z),chain:d.bx.slice()});
  }
  const frameError=Math.max(...poses.map(v=>Math.max(v.tag.distanceTo(poses[0].tag),...v.chain.map((x,i)=>Math.abs(x-poses[0].chain[i])))));
  check('gravity trajectory agrees at 30, 60 and 120 Hz',frameError<.00015,{frameError});
  const initial=d.bx.slice();p.setGravity(new THREE.Vector3(-1,0,0));step(8);
  const a=attachment(),down=Array.from({length:d.N},(_,i)=>d.bx[i*3]-a.x).reduce((s,x)=>s+x,0)/d.N;
  check('changing world down wakes and reorients the free chain',down<-.01&&d.bx.some((x,i)=>Math.abs(x-initial[i])>.01),{meanAlongDown:down});
  const fabric=softMeshes[0].geometry.attributes.position.array;
  check('mechanism does not stretch sewn fabric',fabric.every((v,i)=>v===softMeshes[0].geometry.attributes.restPosition.array[i]));
  verifyContactPhysics({p,camera,check});
  p.dispose();softMeshes.forEach(m=>m.geometry.dispose());
  await verifyHighQualityTurns({createPlush,meshes,meta,tf,tb,check});
}

async function verifyHighQualityTurns({createPlush,meshes,meta,tf,tb,check}) {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.001,4);
  const softMeshes=meshes.map(m=>new THREE.Mesh(m.geometry.clone(),m.material));
  softMeshes.forEach((m,i)=>{m.name=meshes[i].name;m.geometry.attributes.position.copy(m.geometry.attributes.restPosition);});
  const p=await createPlush({scene,camera,quality:'high'},{
    softMeshes,attachPoint:new THREE.Vector3(...meta.attach_point_m),tagTextures:{front:tf,back:tb},
    hookPosition:new THREE.Vector3(0,.21,0),mount:'wall',exhibition:true,
    params:{fleshHz:120,mechSubsteps:4,mechIters:5,tagLinDamp:2.4,tagAngDamp:4,chainDamp:2.8},
  });
  const d=p._debug,normal=()=>new THREE.Vector3(0,0,1).applyQuaternion(p.tagMesh.quaternion);
  check('desktop verification uses the finer 2 mm collision SDF',p.params.sdfCell===.002,{sdfCell:p.params.sdfCell});
  for(let i=0;i<420;i++)p.update(1/60);
  let face=normal(),peakFacePen=0,peakBeadBodyPen=0,peakTagBodyPen=0,peakStretch=0;
  const held=[d.core.x,d.core.y,d.core.z];
  function contacts() {
    const tag=d.tag,T=tag.R,core=d.core,R=core.R;
    for(let i=0;i<d.N;i++) {
      const o=i*3,j=((i+1)%d.N)*3,x=d.bx[o]-tag.x,y=d.bx[o+1]-tag.y,z=d.bx[o+2]-tag.z;
      const lx=T[0]*x+T[3]*y+T[6]*z,ly=T[1]*x+T[4]*y+T[7]*z,lz=T[2]*x+T[5]*y+T[8]*z;
      if(Math.abs(lx)<.0165&&Math.abs(ly)<.022&&Math.hypot(lx+.01325,ly-.0168)>.0035)peakFacePen=Math.max(peakFacePen,.001375-Math.abs(lz));
      peakStretch=Math.max(peakStretch,Math.hypot(d.bx[o]-d.bx[j],d.bx[o+1]-d.bx[j+1],d.bx[o+2]-d.bx[j+2])/(i===0?.0034:.0032));
      const a=d.bx[o]-core.x,b=d.bx[o+1]-core.y,c=d.bx[o+2]-core.z;
      const rx=R[0]*a+R[3]*b+R[6]*c+d.com0.x,ry=R[1]*a+R[4]*b+R[7]*c+d.com0.y,rz=R[2]*a+R[5]*b+R[8]*c+d.com0.z;
      if(Math.hypot(rx-d.attachRest.x,ry-d.attachRest.y,rz-d.attachRest.z)>.011)peakBeadBodyPen=Math.max(peakBeadBodyPen,.0012-d.sdfSample(rx,ry,rz,false));
    }
    for(let ix=0;ix<=5;ix++)for(let iy=0;iy<=7;iy++) {
      const lx=(ix/5-.5)*.0358,ly=(iy/7-.5)*.0471;
      if(Math.hypot(lx+.01325,ly-.0168)<.0035)continue;
      const x=tag.x+T[0]*lx+T[1]*ly-core.x,y=tag.y+T[3]*lx+T[4]*ly-core.y,z=tag.z+T[6]*lx+T[7]*ly-core.z;
      peakTagBodyPen=Math.max(peakTagBodyPen,-d.sdfSample(R[0]*x+R[3]*y+R[6]*z+d.com0.x,R[1]*x+R[4]*y+R[7]*z+d.com0.y,R[2]*x+R[5]*y+R[8]*z+d.com0.z,false));
    }
  }
  for(let turn=0;turn<8;turn++) {
    check('desktop card accepts independent turn '+turn,p.turnTag());
    for(let i=0;i<480;i++){p.update(1/60);contacts();}
    const next=normal(),dot=face.dot(next);
    check('desktop card actually changes face and settles '+turn,dot<-.75&&face.z*next.z<0&&p.isSleeping,{dot,previousZ:face.z,currentZ:next.z,sleeping:p.isSleeping});
    face=next;
  }
  check('desktop turns preserve solid card, chain and plush contact',peakFacePen<.00015&&peakBeadBodyPen<.0006&&peakTagBodyPen<.00015,{peakFacePen,peakBeadBodyPen,peakTagBodyPen});
  check('desktop turns keep links attached without a hidden pin or reset',peakStretch<1.35&&d.bim.every(w=>w>0)&&[d.core.x,d.core.y,d.core.z].every((v,i)=>v===held[i])&&p.stats.mechResets===0,{peakStretch,resets:p.stats.mechResets});
  verifyAssistedTurnBoundaries(p,check,'desktop');
  p.dispose();softMeshes.forEach(m=>m.geometry.dispose());
}

function verifyAssistedTurnBoundaries(p,check,label) {
  const d=p._debug,step=n=>{for(let i=0;i<n;i++)p.update(1/60);};
  const finite=()=>[d.tag.x,d.tag.y,d.tag.z,d.tag.qx,d.tag.qy,d.tag.qz,d.tag.qw,...d.bx].every(Number.isFinite);
  // A horizontal card has no projected face direction. The second fixture also
  // makes FWD parallel to gravity, requiring the independent SIDE fallback.
  for(const [name,down] of [['horizontal card',new THREE.Vector3(0,-1,0)],['vertical view',new THREE.Vector3(0,0,-1)]]) {
    p.setGravity(down);p.reset();step(300);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),down);
    d.tag.setPose(d.tag.x,d.tag.y,d.tag.z,q);
    const resets=p.stats.mechResets,accepted=p.turnTag();step(12);
    check(label+' turn has a finite basis for '+name,accepted&&finite()&&p.stats.mechResets===resets,{resets:p.stats.mechResets-resets});
    p.cancelInteraction();step(480);
    check(label+' releases '+name+' back to free physics',!p.tagTurning&&finite()&&d.bim.every(w=>w>0)&&p.stats.mechResets===resets,{sleeping:p.isSleeping,angularSpeed:Math.hypot(d.tag.wx,d.tag.wy,d.tag.wz),maxBeadSpeed:Math.max(...Array.from({length:d.N},(_,i)=>Math.hypot(...d.bv.slice(i*3,i*3+3)))),resets:p.stats.mechResets-resets});
  }
  p.setGravity(new THREE.Vector3(0,-1,0));p.reset();step(300);
  const resets=p.stats.mechResets,held=[d.core.x,d.core.y,d.core.z];let accepted=true;
  for(let i=0;i<5;i++){accepted=p.turnTag()&&accepted;step(18);}
  p.cancelInteraction();step(480);
  check(label+' survives five rapid turn restarts and release',accepted&&!p.tagTurning&&p.isSleeping&&finite()&&d.bim.every(w=>w>0)&&[d.core.x,d.core.y,d.core.z].every((v,i)=>v===held[i])&&p.stats.mechResets===resets,{sleeping:p.isSleeping,resets:p.stats.mechResets-resets});
}

export function verifyExhibitMotion(check){
  const angles=[];
  for(const hz of [30,60,120]){
    const pivot=new THREE.Group(),m=createExhibitMotion(pivot);m.begin(0);
    for(let i=1;i<=12;i++)m.drag(.006,.02,0,i/60);
    m.release(.2);const release=pivot.quaternion.clone();
    for(let i=0;i<hz;i++)m.update(1/hz);
    check('release has real inertia at '+hz+' Hz',release.angleTo(pivot.quaternion)>.05);
    angles.push(pivot.quaternion.clone());
    for(let i=0;i<hz*3;i++)m.update(1/hz);
    check('rotation stops at '+hz+' Hz',m.velocity.length()===0);
  }
  const error=Math.max(...angles.map(q=>q.angleTo(angles[0])));
  check('rotation travel is frame-rate independent',error<1e-6,{error});
  const pivot=new THREE.Group(),m=createExhibitMotion(pivot);m.begin(1);m.drag(0,.1,0,1.02);m.release(1.3);
  const q=pivot.quaternion.clone();m.update(1/60);
  check('holding still before release discards stale velocity',q.equals(pivot.quaternion));
  m.begin(2);m.drag(.2,0,0,2.02);m.release(2.02,true);
  check('cancel discards release momentum',m.velocity.length()===0);
  m.update(NaN);m.update(Infinity);check('invalid clock values cannot corrupt rotation',pivot.quaternion.toArray().every(Number.isFinite));
}
