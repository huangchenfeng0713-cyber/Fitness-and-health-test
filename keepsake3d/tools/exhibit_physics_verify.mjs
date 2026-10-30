import * as THREE from 'three';
import {createExhibitMotion} from '../dev/generated-exhibit-motion.mjs';

export async function verifyExhibitionPhysics({createPlush, meshes, meta, tf, tb, check}) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .001, 4);
  const softMeshes = meshes.map(m => new THREE.Mesh(m.geometry.clone(), m.material));
  softMeshes.forEach((m, i) => {m.name = meshes[i].name; m.geometry.attributes.position.copy(m.geometry.attributes.restPosition);});
  const p = await createPlush({scene, camera, quality:'low'}, {
    softMeshes, attachPoint:new THREE.Vector3(...meta.attach_point_m),
    tagTextures:{front:tf, back:tb}, tagSize:{w:.0373,h:.0486,t:.00035}, tagHole:{x:.0054,y:.0075,d:.0032},
    hookPosition:new THREE.Vector3(0,.21,0), mount:'wall', exhibition:true,
    params:{fleshHz:120,mechSubsteps:4,mechIters:3,tagLinDamp:2.4,tagAngDamp:4,chainDamp:2.8},
  });
  const step = (seconds, hz=60) => {for(let i=0;i<Math.round(seconds*hz);i++)p.update(1/hz);p.group.updateMatrixWorld(true);};
  const d=p._debug, core=()=>new THREE.Vector3(d.core.x,d.core.y,d.core.z);
  const pin=()=>Array.from(d.bx.slice(d.exhibitionPin*3,d.exhibitionPin*3+3));
  const fixed=pin();
  const chainStretch=()=>{
    let max=0;for(let i=0;i<d.N;i++){const j=(i+1)%d.N;
      max=Math.max(max,Math.hypot(d.bx[i*3]-d.bx[j*3],d.bx[i*3+1]-d.bx[j*3+1],d.bx[i*3+2]-d.bx[j*3+2])/(i===0?p.params.claspSegment:p.params.beadPitch));}
    return max;
  };
  step(6);
  check('exhibition sleeps under gravity',p.isSleeping);
  check('both tag faces have distinct full-size textures',p.tagMesh.material[0].map===tf && p.tagMesh.material[1].map===tb && tf!==tb && tf.image.width>=500 && tb.image.width>=500);
  const before=core(), chainBefore=d.bx.slice();
  p.nudge(new THREE.Vector3(.1,0,.04));step(.25);
  check('input moves body and flexible chain',core().distanceTo(before)>.001 && d.bx.some((v,i)=>Math.abs(v-chainBefore[i])>.001));
  check('suspension stays attached during a flick',JSON.stringify(pin())===JSON.stringify(fixed));
  step(10);check('released chain and body settle',p.isSleeping);
  const resting=d.bx.slice(), restTag=p.tagMesh.matrix.clone();step(5);
  check('sleep is exactly stationary',d.bx.every((v,i)=>v===resting[i]) && p.tagMesh.matrix.equals(restTag));

  p.reset();step(5);
  const face=new THREE.Vector3(0,0,1).applyQuaternion(p.tagMesh.quaternion);
  let peakStretch=0;
  for(let turn=0;turn<8;turn++){
    check('tag accepts turn '+turn,p.turnTag());
    for(let i=0;i<420;i++){p.update(1/60);peakStretch=Math.max(peakStretch,chainStretch());}
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(p.tagMesh.quaternion);
    const dot=face.dot(normal);
    check('tag shows alternate face '+turn,turn%2===0?dot<-.75:dot>.75,{dot});
  }
  check('repeated flips never detach or reset the mechanism',JSON.stringify(pin())===JSON.stringify(fixed)&&p.stats.mechResets===0,{resets:p.stats.mechResets});
  check('chain link stretch stays bounded during flips',peakStretch<1.35,{peakStretch});
  step(10);check('repeated flips settle',p.isSleeping);

  // A pointer actually grabs the card, drags off the object, then is cancelled.
  p.reset();step(5);camera.position.set(0,.17,.4);camera.lookAt(0,.15,0);camera.updateMatrixWorld();
  let info,hit=false;
  for(const x of [-.014,0,.014])for(const y of [.017,.008,0]){
    if(hit)continue;
    const point=p.tagMesh.localToWorld(new THREE.Vector3(x,y,0));
    const raycaster=new THREE.Raycaster(camera.position.clone(),point.sub(camera.position).normalize());
    info={raycaster,clientX:200,clientY:200,pointerId:3,pointerType:'touch',button:0,time:0};
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
  check('cancel releases the tag and preserves suspension',!d.gesture&&p.isSleeping&&JSON.stringify(pin())===JSON.stringify(fixed));

  const poses=[];
  for(const hz of [30,60,120]){
    p.reset();step(5,hz);p.nudge(new THREE.Vector3(.09,0,.03));step(1,hz);
    poses.push(core());
  }
  const frameError=Math.max(...poses.map(v=>v.distanceTo(poses[0])));
  check('gravity trajectory agrees at 30, 60 and 120 Hz',frameError<.00015,{frameError});
  const fabric=softMeshes[0].geometry.attributes.position.array;
  check('mechanism does not stretch sewn fabric',fabric.every((v,i)=>v===softMeshes[0].geometry.attributes.restPosition.array[i]));
  p.dispose();softMeshes.forEach(m=>m.geometry.dispose());
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
