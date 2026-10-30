export async function verifyExhibitPhysics({a,w,check,step,event}){
 const p=a.items.plush.api,d=p._debug,c=a.renderer.domElement;
 a.select('plush');a.front(true);step(360);
 const screen=point=>{const v=point.clone().project(a.camera),r=c.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
 function tagHit(){
  for(const x of [-.014,0,.014])for(const y of [.018,.01,0,-.016]){
   const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().set(x,y,0)));
   if(a.pick(pos.x,pos.y)?.object===p.tagMesh)return pos;
  }
  throw Error('No visible paper tag touch target');
 }
 const normal=()=>p.tagMesh.position.clone().set(0,0,1).applyQuaternion(p.tagMesh.quaternion);
 const initial=normal(),maps=p.tagMesh.material.slice(0,2).map(m=>m.map);
 check('paper tag front and back textures are complete',maps.every(t=>t?.image?.width>=500&&t.image.height>=600)&&maps[0]!==maps[1]);
 for(let i=0;i<4;i++){
  const h=tagHit();event('pointerdown',1,h.x,h.y);step(3);event('pointerup',1,h.x,h.y);
  check('tap starts an independent card turn '+i,a.state().tagTurning&&a.state().held);
  step(420);const dot=normal().dot(initial);
  check('touch turns to alternate textured face '+i,i%2?dot>.75:dot<-.75,{dot});
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
 const chain=d.bx.slice(),pin=Array.from(d.bx.slice(d.exhibitionPin*3,d.exhibitionPin*3+3));
 event('pointerdown',1,bead.x,bead.y);
 for(let i=1;i<=20;i++){event('pointermove',1,bead.x+55*i/20,bead.y+25*i/20);step(2);}
 check('drag deforms the actual bead chain',d.bx.some((v,i)=>Math.abs(v-chain[i])>.003));
 event('pointerup',1,bead.x+55,bead.y+25);step(720);
 check('chain falls back under gravity and settles',p.isSleeping&&JSON.stringify(pin)===JSON.stringify(Array.from(d.bx.slice(d.exhibitionPin*3,d.exhibitionPin*3+3)))&&p.hooked);
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
 function tagHit(){
  for(const x of [-.014,0,.014])for(const y of [.018,.01,0,-.016]){
   const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().set(x,y,0)));
   if(a.pick(pos.x,pos.y)?.object===p.tagMesh)return pos;
  }
  throw Error('No visible tag target during responsive framing test');
 }
 for(const width of [320,390,430]){
  frame.style.width=width+'px';frame.style.height='844px';
  await waitFor(()=>w.innerWidth===width&&Math.abs(a.camera.aspect-width/844)<1e-6);
  a.select('plush');a.front(true);a.pickup();step(300);
  const initial=a.state().distance,bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,maxDistance:initial};
  for(let turn=0;turn<2;turn++){
   const h=tagHit();event('pointerdown',1,h.x,h.y);step(3);event('pointerup',1,h.x,h.y);
   for(let i=0;i<480;i++){
    step();
    for(const x of [-.0373/2,.0373/2])for(const y of [-.0486/2,.0486/2])for(const z of [-.00035/2,.00035/2]){
     const pos=screen(p.tagMesh.localToWorld(p.tagMesh.position.clone().set(x,y,z)));
     bounds.left=Math.min(bounds.left,pos.x);bounds.right=Math.max(bounds.right,pos.x);bounds.top=Math.min(bounds.top,pos.y);bounds.bottom=Math.max(bounds.bottom,pos.y);
    }
    bounds.maxDistance=Math.max(bounds.maxDistance,a.state().distance);
   }
  }
  check('complete automatic tag turn stays inside '+width+'px viewport',bounds.left>=8&&bounds.right<=width-8&&bounds.top>=76&&bounds.bottom<=820,bounds);
  const scale=initial/bounds.maxDistance;
  check('responsive framing preserves model size at '+width+'px',scale>=.85,{smallestScale:scale});
  check('tag settles and original framing returns at '+width+'px',p.isSleeping&&Math.abs(a.state().distance-initial)<.002,{initial,final:a.state().distance});
 }
 frame.style.width=oldWidth;frame.style.height=oldHeight;
 await waitFor(()=>w.innerWidth===parseInt(oldWidth)&&Math.abs(a.camera.aspect-parseInt(oldWidth)/parseInt(oldHeight))<1e-6);
 a.front(true);step(300);
}
