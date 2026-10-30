export async function verifyExhibitPhysics({a,w,check,step,event}){
 const p=a.items.plush.api,d=p._debug,c=a.renderer.domElement;
 a.select('plush');a.front(true);step(360);
 const screen=point=>{const v=point.clone().project(a.camera),r=c.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
 function tagHit(){
  for(const x of [-.017,-.012,-.006,0,.006,.012,.017])for(const y of [.021,.016,.010,.003,-.005,-.013,-.021]){
   const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().set(x,y,0)));
   if(a.pick(pos.x,pos.y)?.object===p.tagMesh)return pos;
  }
  throw Error('No visible paper tag touch target');
 }
 const normal=()=>p.tagMesh.position.clone().set(0,0,1).applyQuaternion(p.tagMesh.quaternion);
 let previous=normal();
 const maps=p.tagMesh.material.slice(0,2).map(m=>m.map);
 check('paper tag front and back textures are complete',maps.every(t=>t?.image?.width>=500&&t.image.height>=600)&&maps[0]!==maps[1]);
 for(let i=0;i<4;i++){
  const h=tagHit();event('pointerdown',1,h.x,h.y);step(3);event('pointerup',1,h.x,h.y);
  check('tap starts an independent card turn '+i,a.state().tagTurning&&a.state().held);
  step(420);const current=normal(),dot=current.dot(previous);
  check('touch turns to alternate textured face '+i,dot<-.75&&current.z*previous.z<0,{dot,previousZ:previous.z,currentZ:current.z});
  previous=current;
 }
 const at=tagHit();event('pointerdown',1,at.x,at.y);step(2);
 const before=p.tagMesh.position.clone(),q=a.pivot.quaternion.clone();
 for(let j=1;j<=24;j++){event('pointermove',1,at.x+65*j/24,at.y-35*j/24);step(2);}
 check('touch drags paper tag without rotating the view',p.tagMesh.position.distanceTo(before)>.003&&q.equals(a.pivot.quaternion));
 event('pointerup',1,at.x+65,at.y-35);step(720);
 check('paper tag settles after release',p.isSleeping&&!a.state().pointers&&!p.tagTurning);

 a.front(true);step(300);
 let bead;
 const matrix=p.softRoot.matrix.clone();
 for(let i=0;i<p.chain.count;i++){
  if(i===d.exhibitionPin)continue;
  p.chain.beads.getMatrixAt(i,matrix);
  const pos=screen(p.tagMesh.position.clone().setFromMatrixPosition(matrix).applyMatrix4(p.chain.beads.matrixWorld));
  if(a.items.plush.interactionKind(a.pick(pos.x,pos.y))==='chain'){bead=pos;break;}
 }
 check('chain has a visible touch target',!!bead);
 const chain=d.bx.slice(),coreBefore=[d.core.x,d.core.y,d.core.z];
 check('held toy does not hide a fixed chain bead',d.exhibitionPin===-1&&Array.from(d.bim).every(v=>v>0));
 event('pointerdown',1,bead.x,bead.y);
 for(let i=1;i<=20;i++){event('pointermove',1,bead.x+55*i/20,bead.y+25*i/20);step(2);}
 check('drag deforms the actual bead chain',d.bx.some((v,i)=>Math.abs(v-chain[i])>.003));
 event('pointerup',1,bead.x+55,bead.y+25);step(720);
 check('free chain falls back while the held toy stays supported',p.isSleeping&&[d.core.x,d.core.y,d.core.z].every((v,i)=>Math.abs(v-coreBefore[i])<1e-9)&&d.exhibitionPin===-1,{sleeping:p.isSleeping,core:[d.core.x,d.core.y,d.core.z],coreBefore,tagAngular:Math.hypot(d.tag.wx,d.tag.wy,d.tag.wz),maxBeadSpeed:Math.max(...Array.from({length:d.N},(_,i)=>Math.hypot(d.bv[i*3],d.bv[i*3+1],d.bv[i*3+2]))),resets:p.stats.mechResets,gesture:d.gesture?.kind});
 const resting=d.bx.slice();step(300);
 check('settled beads remain exactly stationary',d.bx.every((v,i)=>v===resting[i]));

 const h=tagHit();event('pointerdown',1,h.x,h.y);event('pointerdown',2,h.x+80,h.y);
 check('second finger releases the paper tag for pinch',!d.gesture);
 event('pointermove',2,h.x+110,h.y);event('pointercancel',2,h.x+110,h.y);
 check('cancel clears all fingers and momentum',a.state().pointers===0&&a.state().angularVelocity.every(v=>v===0)&&!p.tagTurning);
 event('pointerdown',1,h.x,h.y);w.dispatchEvent(new w.Event('blur'));
 check('blur releases the physics grab',!d.gesture&&!a.state().pointers);
 a.front(true);step(300);
 check('interactive mechanism never uses emergency reset',p.stats.mechResets===0,p.stats.mechResets);
}

export async function verifyResponsiveTagFraming({a,w,frame,check,step,event,waitFor}){
 const oldWidth=frame.style.width,oldHeight=frame.style.height,p=a.items.plush.api;
 const screen=point=>{const v=point.clone().project(a.camera);return{x:(v.x+1)*w.innerWidth/2,y:(1-v.y)*w.innerHeight/2};};
 function bodyHeight(){
  // Measure the rendered model itself: camera distance alone misses depth pan.
  const v=p.tagMesh.position.clone();let low=Infinity,high=-Infinity;
  for(const mesh of p.softMeshes){const pos=mesh.geometry.attributes.position;
   for(let i=0;i<pos.count;i+=8){v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).project(a.camera);low=Math.min(low,v.y);high=Math.max(high,v.y);}
  }
  return (high-low)*w.innerHeight/2;
 }
 function tagHit(){
  for(const x of [-.017,-.012,-.006,0,.006,.012,.017])for(const y of [.021,.016,.010,.003,-.005,-.013,-.021]){
   const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().set(x,y,0)));
   if(a.pick(pos.x,pos.y)?.object===p.tagMesh)return pos;
  }
  throw Error('No visible tag target during responsive framing test');
 }
 for(const width of [320,390,430]){
  frame.style.width=width+'px';frame.style.height='844px';
  await waitFor(()=>w.innerWidth===width&&Math.abs(a.camera.aspect-width/844)<1e-6);
  a.select('plush');a.front(true);a.pickup();step(300);
  const initial=a.state().distance,initialHeight=bodyHeight(),bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,maxDistance:initial,minBodyHeight:initialHeight};
  for(let turn=0;turn<4;turn++){
   const previous=p.tagMesh.position.clone().set(0,0,1).applyQuaternion(p.tagMesh.quaternion);
   const h=tagHit();event('pointerdown',1,h.x,h.y);step(3);event('pointerup',1,h.x,h.y);
   for(let i=0;i<480;i++){
    step();
    const vertices=p.tagMesh.geometry.attributes.position;
    for(let vertex=0;vertex<vertices.count;vertex++){
     const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().fromBufferAttribute(vertices,vertex)));
     bounds.left=Math.min(bounds.left,pos.x);bounds.right=Math.max(bounds.right,pos.x);bounds.top=Math.min(bounds.top,pos.y);bounds.bottom=Math.max(bounds.bottom,pos.y);
    }
    bounds.maxDistance=Math.max(bounds.maxDistance,a.state().distance);bounds.minBodyHeight=Math.min(bounds.minBodyHeight,bodyHeight());
   }
   const normal=p.tagMesh.position.clone().set(0,0,1).applyQuaternion(p.tagMesh.quaternion),dot=previous.dot(normal);
   check('responsive turn exposes the opposite face '+width+'px #'+turn,dot<-.75&&previous.z*normal.z<0,{dot,normalZ:normal.z});
  }
  check('complete automatic tag turn stays inside '+width+'px viewport',bounds.left>=8&&bounds.right<=width-8&&bounds.top>=76&&bounds.bottom<=820,bounds);
  const scale=bounds.minBodyHeight/initialHeight;
  check('responsive framing preserves actual model height at '+width+'px',scale>=.85,{smallestScale:scale,initialHeight,minHeight:bounds.minBodyHeight,cameraDistanceRatio:initial/bounds.maxDistance});
  // Free contact can leave the card in a different resting pose. Keep the same
  // full-motion size/bounds requirements above, and require the camera to stop
  // with that actual pose rather than forcing it back to the old pinned pose.
  const restingDistance=a.state().distance,restingTag=p.tagMesh.position.clone();step(300);
  check('tag and framing remain steady after release at '+width+'px',p.isSleeping&&Math.abs(a.state().distance-restingDistance)<1e-6&&p.tagMesh.position.distanceTo(restingTag)<1e-9,{initial,restingDistance,final:a.state().distance});
 }
 frame.style.width=oldWidth;frame.style.height=oldHeight;
 await waitFor(()=>w.innerWidth===parseInt(oldWidth)&&Math.abs(a.camera.aspect-parseInt(oldWidth)/parseInt(oldHeight))<1e-6);
 a.front(true);step(300);
}
