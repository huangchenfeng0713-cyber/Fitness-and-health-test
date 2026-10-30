// Asset/physics verification in Node. This does not launch or control a browser.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const require=createRequire(import.meta.url);
const {Canvas,Image,ImageData,loadImage}=require(process.env.KEEPSAKE_CANVAS_MODULE || 'skia-canvas');
globalThis.self=globalThis;
globalThis.HTMLCanvasElement=Canvas;globalThis.HTMLImageElement=Image;globalThis.ImageBitmap=Image;globalThis.ImageData=ImageData;
globalThis.document={createElement:()=>new Canvas(1,1),createElementNS:()=>new Canvas(1,1)};
Canvas.prototype.toBlob=function(cb,type){this.toBuffer(type||'png').then(b=>cb(new Blob([b],{type:type||'image/png'})));};
globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.ProgressEvent=class{constructor(type,args){Object.assign(this,{type},args);}};
globalThis.FileReader=class{
 readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}
};
const ROOT=path.resolve(import.meta.dirname,'..'),OUT=path.join(ROOT,'dev/qa-output');
const report={method:'Node geometry, soft-body physics and standard GLB export',checks:[],errors:[],sourceHashes:{}};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));console.log('PASS',name);};
const readGLB=async file=>{const b=await fs.readFile(file);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
async function texture(file){const im=await loadImage(file),c=new Canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}

async function exportPlush(p,fur,part){
 const src=part==='body'?p.softRoot:p.group,saved=[];
 src.traverse(o=>{saved.push([o,o.userData]);const hidden=o.material&&(Array.isArray(o.material)?o.material.every(m=>!m.visible):!o.material.visible);o.userData={isFur:!!o.userData?.isFur,noExport:!!o.userData?.noExport||!!hidden};});
 let clone;try{clone=src.clone(true);}finally{for(const[o,u]of saved)o.userData=u;}
 if(part==='body'){clone.position.set(0,0,0);clone.quaternion.identity();clone.scale.set(1,1,1);clone.matrixAutoUpdate=true;clone.updateMatrix();}
 const drop=[];clone.traverse(o=>{
  if(o.userData?.isFur||o.userData?.noExport||o.isLight||o.type==='LineSegments')drop.push(o);
  if(o.isInstancedMesh){const m=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();o.instanceMatrix=o.instanceMatrix.clone();let kept=0;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(v,q,s);if(m.elements.every(Number.isFinite)&&Math.abs(s.x*s.y*s.z)>1e-20)o.setMatrixAt(kept++,m);}o.count=kept;if(!kept)o.visible=false;}
  if(o.isMesh){o.geometry=o.geometry.clone();for(const k of Object.keys(o.geometry.attributes))if(!['position','normal','uv','color'].includes(k))o.geometry.deleteAttribute(k);}
 });drop.forEach(o=>o.removeFromParent());
 const baked=fur.bake();
 if(part==='body'){
  const g=baked.geometry,pa=g.attributes.position,na=g.attributes.normal,idx=g.index.array;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();let outward=0;
  for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(pa,idx[i]);b.fromBufferAttribute(pa,idx[i+1]);c.fromBufferAttribute(pa,idx[i+2]);n.fromBufferAttribute(na,idx[i]);if(b.sub(a).cross(c.sub(a)).dot(n)>0)outward++;}
  check('fibre winding agrees with outward fabric normals',outward/(idx.length/3)>.999,{ratio:outward/(idx.length/3)});
 }
 (part==='body'?clone:clone.getObjectByName('plushSoftRoot')).add(baked);
 const result=await new GLTFExporter().parseAsync(clone,{binary:true,onlyVisible:true});
 baked.geometry.dispose();baked.material.dispose();return Buffer.from(result);
}

try{
 for(const file of ['assets/plush.glb','assets/plush_meta.json','assets/tex/plush_masks.png','src/fur_strands.js','src/plush_engine.js'])report.sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(ROOT,file))).digest('hex');
 const {createPlush}=await import('../dev/generated-plush-engine.mjs');
 const {createFur}=await import('../dev/generated-fur.mjs');
 const gltf=await readGLB(path.join(ROOT,'assets/plush.glb')),meshes=[];
 gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const m of meshes){m.updateMatrixWorld(true);m.geometry.applyMatrix4(m.matrixWorld);m.position.set(0,0,0);m.quaternion.identity();m.scale.set(1,1,1);m.updateMatrix();m.geometry.setAttribute('restPosition',m.geometry.attributes.position.clone());}
 const body=meshes.find(m=>m.name==='plush_body'),meta=JSON.parse(await fs.readFile(path.join(ROOT,'assets/plush_meta.json'),'utf8'));
 const mask=await texture(path.join(ROOT,'assets/tex/plush_masks.png'));mask.flipY=false;mask.colorSpace=THREE.NoColorSpace;
 const seam=Float32Array.from(Buffer.from(meta.seam_u8_b64,'base64'),x=>x/255);
 check('seam binding matches rebuilt photo-traced mesh',seam.length===body.geometry.attributes.position.count,{vertices:seam.length});
 const bp=body.geometry.attributes.restPosition;
 const depthIn=(y0,y1)=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<bp.count;i++)if(bp.getY(i)>y0&&bp.getY(i)<y1){lo=Math.min(lo,bp.getZ(i));hi=Math.max(hi,bp.getZ(i));}return hi-lo;};
 check('side-photo head depth is below 17 mm',depthIn(.065,.1)<.017,{depth:depthIn(.065,.1)});
 check('slim lower legs stay below 6.5 mm depth',depthIn(0,.009)<.0065,{depth:depthIn(0,.009)});
 const label=meshes.find(m=>m.name==='plush_label'),lp=label.geometry.attributes.restPosition;
 const labelBindings=meta.label_root_vertices.map(i=>{let closest=0,best=Infinity;for(let j=0;j<bp.count;j++){const d=(lp.getX(i)-bp.getX(j))**2+(lp.getY(i)-bp.getY(j))**2+(lp.getZ(i)-bp.getZ(j))**2;if(d<best){best=d;closest=j;}}return[i,closest];});
 const labelGap=()=>{const l=label.geometry.attributes.position,b=body.geometry.attributes.position;let gap=0;for(const[i,j]of labelBindings)gap=Math.max(gap,Math.hypot(l.getX(i)-b.getX(j),l.getY(i)-b.getY(j),l.getZ(i)-b.getZ(j)));return gap;};
 check('all label roots are buried within the side seam',labelGap()<.0012,{maxDistance:labelGap()});
 const fur=createFur(body,{shells:16,maskMap:mask,seam});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1280/800,.001,20);
 const canvas={style:{},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800})};
 const tf=await texture(path.join(ROOT,'assets/tex/tag_front.png')),tb=await texture(path.join(ROOT,'assets/tex/tag_back.png'));
 const p=await createPlush({THREE,scene,camera,domElement:canvas,quality:'high'},{softMeshes:meshes,attachPoint:new THREE.Vector3(...meta.attach_point_m),tagTextures:{front:tf,back:tb},tagSize:{w:.0373,h:.0486,t:.00035},tagHole:{x:.0054,y:.0075,d:.0032},hookPosition:new THREE.Vector3(-.13,.29,-.08),origin:new THREE.Vector3(-.13,0,-.08),quality:'high',mount:'wall',wallZ:-.112,onStroke:fur.stroke});
 body.parent.add(fur.group);
 let t=0;const step=n=>{for(let i=0;i<n;i++){p.update(1/60,t+=1/60);scene.updateMatrixWorld(true);fur.update(1/60);}camera.updateMatrixWorld();};
 step(120);
 check('revised mesh and hanging mechanism finite',[p._debug.core.x,p._debug.core.y,p._debug.core.z,...p._debug.bx].every(Number.isFinite));
 check('toy remains on hook at rest',p.hooked);
 const restY=body.geometry.attributes.position.array;
 check('white pile normal texture retained',!!body.material.normalMap);
 const cloth=meshes.find(m=>m.name==='plush_collar').geometry.attributes.position;let minZ=Infinity;for(let i=0;i<cloth.count;i++)minZ=Math.min(minZ,cloth.getZ(i));
 check('cloth remains exclusively on front',minZ>.0033,{minZ});
 const cx=p._debug.core.x;p.poke(new THREE.Vector3(0,.078,.017),new THREE.Vector3(.2,0,0));step(30);
 check('local touch still moves toy',Math.abs(p._debug.core.x-cx)>1e-5);
 step(300);check('toy settles after touch',Math.hypot(p._debug.core.vx,p._debug.core.vy,p._debug.core.vz)<.02);
 p.reset();step(90);
 const center=body.localToWorld(new THREE.Vector3(0,.078,.003)),q=body.getWorldQuaternion(new THREE.Quaternion());
 camera.position.copy(center).add(new THREE.Vector3(0,0,.30).applyQuaternion(q));camera.up.copy(new THREE.Vector3(0,1,0).applyQuaternion(q));camera.lookAt(center);camera.updateMatrixWorld();
 const screen=(x,y,z)=>{const v=body.localToWorld(new THREE.Vector3(x,y,z)).project(camera);return{x:(v.x+1)*640,y:(1-v.y)*400};};
 let time=100;
 const inf=(s,id)=>{const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(s.x/640-1,1-s.y/400),camera);return{raycaster:rc,clientX:s.x,clientY:s.y,pointerId:id,pointerType:'touch',button:0,time:time+=1/60};};
 let a=screen(-.010,.078,.017),b=screen(.010,.078,.017);
 let maxTapSpeed=0;
 for(let i=0;i<8;i++){
   const tap=screen(.008,.073,.010);check('light tap hits '+i,p.pointerDown(inf(tap,61)));
   p.pointerUp(inf(tap,61));
   for(let j=0;j<20;j++){step(1);maxTapSpeed=Math.max(maxTapSpeed,Math.hypot(p._debug.core.vx,p._debug.core.vy,p._debug.core.vz));}
 }
 check('repeated taps do not launch toy',maxTapSpeed<.1&&p.hooked,{maxSpeed:maxTapSpeed});
 step(180);a=screen(-.010,.078,.017);b=screen(.010,.078,.017);
 check('first finger hits shortened head',p.pointerDown(inf(a,51)));
 check('second finger hits shortened head',p.pointerDown(inf(b,52)));
 for(let i=1;i<=24;i++){p.pointerMove(inf({x:a.x+12*i/24,y:a.y-9*i/24},51));p.pointerMove(inf({x:b.x-12*i/24,y:b.y+9*i/24},52));step(2);}
 check('two-finger deformation stays within 2 mm sewn envelope',p.stats.fleshDev>.0001&&p.stats.fleshDev<=.002001,{deformation:p.stats.fleshDev});
 check('sewn label stays attached during two-finger interaction',labelGap()<.0013,{maxDistance:labelGap()});
 p.pointerUp(inf(b,52));p.pointerUp(inf(a,51));step(300);
 check('dense filling settles without rubber-like wobble',p.stats.fleshDev<.00015,{deformation:p.stats.fleshDev});
 // A lower-body pull specifically stresses the repaired seam attachment.
 a=screen(.008,.018,.004);
 check('lower-body contact is directly grabbable',p.pointerDown(inf(a,53)));
 for(let i=1;i<=40;i++){p.pointerMove(inf({x:a.x+80*i/40,y:a.y+35*i/40},53));step(2);}
 check('label root stays sewn under lower-body pull',labelGap()<.0013,{maxDistance:labelGap()});
 check('large drag cannot stretch the cloth envelope',p.stats.fleshDev<=.002001,{deformation:p.stats.fleshDev});
 p.pointerUp(inf(a,53));step(90);
 p.reset();step(90);
 camera.up.set(0,1,0);const target=p.hook.position.clone().applyMatrix4(p.group.matrixWorld);camera.position.copy(target).add(new THREE.Vector3(.02,-.01,.65));camera.lookAt(target.clone().add(new THREE.Vector3(0,-.06,0)));camera.updateMatrixWorld();
 a=screen(0,.078,.017);check('single finger can lift toy',p.pointerDown(inf(a,51)));step(25);
 b=screen(.07,.25,.017);
 for(let i=1;i<=70;i++){p.pointerMove(inf({x:a.x+(b.x-a.x)*i/70,y:a.y+(b.y-a.y)*i/70},51));step(2);}step(60);
 check('lifting unhooks toy',!p.hooked);
 p.pointerUp(inf(b,51));step(600);
 let minY=Infinity;const pa=body.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(body.matrixWorld);minY=Math.min(minY,v.y);}
 check('new lower body collides with table',minY>-.003&&minY<.01,{minY});
 check('landing stays weakly elastic and settles',Math.hypot(p._debug.core.vx,p._debug.core.vy,p._debug.core.vz)<.02);
 check('dropped toy enters sleep',p.isSleeping,{speed:Math.hypot(p._debug.core.vx,p._debug.core.vy,p._debug.core.vz)});
 const settled=[p._debug.core.x,p._debug.core.y,p._debug.core.z];step(300);
 check('sleeping toy stays still for five seconds',Math.hypot(p._debug.core.x-settled[0],p._debug.core.y-settled[1],p._debug.core.z-settled[2])<.00001);
 p.reset();step(120);
 for(const [part,name]of[['body','plush-body.glb'],[null,'plush-chain-tag.glb']]){
  const bytes=await exportPlush(p,fur,part);await fs.writeFile(path.join(OUT,name),bytes);check('export '+name,bytes.length>100000,{bytes:bytes.length});
  const read=await readGLB(path.join(OUT,name)),box=new THREE.Box3().setFromObject(read.scene),size=box.getSize(new THREE.Vector3());
  check('readback '+name,size.toArray().every(Number.isFinite)&&size.y>.09&&size.y<.3,{size:size.toArray()});
 }
}catch(e){report.errors.push(e.stack||String(e));console.error(e);process.exitCode=1;}
await fs.writeFile(path.join(OUT,'offline-plush-report.json'),JSON.stringify(report,null,2));
