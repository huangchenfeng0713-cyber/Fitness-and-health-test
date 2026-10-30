import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPlush} from './plush_engine.js';
import {createFur} from './fur_strands.js';
import {createMagnetScene} from './magnet_scene.js';

// The original photo geometry is retained. Exhibit mode gives it a bounded,
// hand-held presentation instead of dropping it into a room simulation.
export function visibleBounds(root) {
  root.updateWorldMatrix(true,true);
  const box=new THREE.Box3(),part=new THREE.Box3(),mat=new THREE.Matrix4(),inst=new THREE.Matrix4();
  root.traverseVisible(o=>{
    if(!o.isMesh || o.userData.noExport || o.userData.isFur) return;
    if((Array.isArray(o.material)?o.material:[o.material]).every(m=>m.visible===false))return;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    if(o.isInstancedMesh) {
      for(let i=0;i<o.count;i++){o.getMatrixAt(i,inst);if(Math.abs(inst.determinant())<1e-16)continue;mat.multiplyMatrices(o.matrixWorld,inst);box.union(part.copy(o.geometry.boundingBox).applyMatrix4(mat));}
    }else box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}

export async function createExhibitObjects(ctx) {
  const {scene,renderer,quality}=ctx,ASSETS='./assets/';
  const anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const loadTexture=async p=>{const t=await new THREE.TextureLoader().loadAsync(ASSETS+p);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=anisotropy;return t;};
  async function plush() {
    const [gltf,meta,mask,tf,tb]=await Promise.all([
      new GLTFLoader().loadAsync(ASSETS+'plush.glb'),fetch(ASSETS+'plush_meta.json').then(r=>r.json()),
      loadTexture('tex/plush_masks.png'),loadTexture('tex/tag_front.png'),loadTexture('tex/tag_back.png')]);
    const meshes=[];gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{if(!o.isMesh)return;meshes.push(o);o.geometry.applyMatrix4(o.matrixWorld);o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.updateMatrix();o.geometry.setAttribute('restPosition',o.geometry.attributes.position.clone());if(o.material.map)o.material.map.anisotropy=anisotropy;o.castShadow=false;o.receiveShadow=false;});
    const body=meshes.find(m=>m.name==='plush_body');mask.flipY=false;mask.colorSpace=THREE.NoColorSpace;
    const seam=Float32Array.from(atob(meta.seam_u8_b64),s=>s.charCodeAt(0)/255);
    const fur=createFur(body,{shells:quality==='low'?8:16,maskMap:mask,seam});
    const api=await createPlush(ctx,{softMeshes:meshes,attachPoint:new THREE.Vector3(...meta.attach_point_m),
      tagTextures:{front:tf,back:tb},tagSize:{w:.0373,h:.0486,t:.00035},tagHole:{x:.0054,y:.0075,d:.0032},
      hookPosition:new THREE.Vector3(0,.21,0),origin:new THREE.Vector3(0,0,0),mount:'wall',wallZ:-.09,quality,
      exhibition:true,params:{fleshHz:120,mechSubsteps:4,mechIters:5,tagLinDamp:2.4,tagAngDamp:4,chainDamp:2.8}});
    for(let i=0;i<150;i++)api.update(1/60,i/60);
    api.hook.stand.visible=false;
    body.parent.add(fur.group);
    const rest=meshes.map(m=>({mesh:m,p:m.geometry.attributes.position.array.slice(),n:m.geometry.attributes.normal.array.slice()}));
    let contact=null,pressure=0,target=0,changed=false;
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),gravity=new THREE.Vector3();
    const worldQ=new THREE.Quaternion();
    function touch(hit,strength=1){
      if(hit?.object!==body) return false;
      contact=body.worldToLocal(hit.point.clone());
      normal.copy(hit.face?.normal||new THREE.Vector3(0,0,1));target=Math.min(1,strength);return true;
    }
    function release(){target=0;}
    function syncGravity(){
      // The view rotates the held toy; loose parts still fall toward world down.
      api.group.getWorldQuaternion(worldQ).invert();
      api.setGravity(gravity.set(0,-1,0).applyQuaternion(worldQ));
    }
    function update(dt){
      syncGravity();
      api.update(dt);
      const before=pressure;pressure+= (target-pressure)*(1-Math.exp(-dt*(target?18:9)));
      if(pressure<.0005&&!target)pressure=0;
      if(contact && (pressure!==before || changed)) {
        const radius=.013,depth=.00045*pressure;
        for(const s of rest){
          const a=s.mesh.geometry.attributes.position;
          for(let i=0;i<a.count;i++){
            const j=i*3,dx=s.p[j]-contact.x,dy=s.p[j+1]-contact.y,dz=s.p[j+2]-contact.z;
            const weight=Math.exp(-(dx*dx+dy*dy+dz*dz)/(radius*radius))*depth;
            a.setXYZ(i,s.p[j]-normal.x*weight,s.p[j+1]-normal.y*weight,s.p[j+2]-normal.z*weight);
          }
          a.needsUpdate=true;
        }
        changed=pressure!==0;
        if(pressure)fur.stroke(contact,point.set(.4,.9,.1),pressure*.18);
      }
      body.getWorldQuaternion(worldQ).invert();
      fur.update(dt,gravity.set(0,-1,0).applyQuaternion(worldQ));
    }
    return {id:'plush',root:api.group,alignment:new THREE.Quaternion(),api,body,fur,touch,release,update,
      get boundsRoot(){return api.group;},get busy(){return !api.isSleeping;},get grabbed(){return api.isGrabbed;},get stage(){return 'plush';},
      get pressure(){return pressure;},advance(){return false;},
      interactionKind(hit){return hit?.object===api.tagMesh?'tag':[api.chain.beads,api.chain.links,api.chain.clasp].includes(hit?.object)?'chain':null;},
      beginDrag(info,hit){
        const part=this.interactionKind(hit);let bead;
        if(part==='chain'){
          const i=hit.object===api.chain.clasp?0:hit.instanceId;
          if(Number.isInteger(i)){
            bead=i;
            if(hit.object!==api.chain.beads){
              const local=api.group.worldToLocal(hit.point.clone()),j=(i+1)%api.chain.count,bx=api._debug.bx;
              const distance=local.distanceToSquared(point.fromArray(bx,i*3));
              if(local.distanceToSquared(point.fromArray(bx,j*3))<distance)bead=j;
            }
          }
        }
        return api.pointerDown({...info,part,bead});
      },moveDrag(info){api.pointerMove(info);},endDrag(info){api.pointerUp(info);},
      flipTag(){return api.turnTag();},cancel(){api.cancelInteraction();release();},
      nudge(x,y){api.nudge(point.set(x*.075,-Math.abs(y)*.012,-y*.07));},
      resetMotion(){syncGravity();api.reset();},
      reset(){syncGravity();api.reset();target=0;pressure=0;for(const s of rest){s.mesh.geometry.attributes.position.array.set(s.p);s.mesh.geometry.attributes.position.needsUpdate=true;}},
      title:'毛绒挂件',material:'短绒织物 · 珠链 · 纸质吊牌',details:'约 100 mm 高。保留原照片中的不对称轮廓、交叉缝线和缝入身体的布标。短绒与较实的填充物只产生轻微压痕。轻点吊牌翻看另一面，拖动吊牌或珠链，松手后自然垂落。'};
  }
  async function magnet(){
    const api=await createMagnetScene({...ctx,assetsBase:ASSETS},{origin:new THREE.Vector3(0,0,0),quality,exhibition:true,animateReset:false,fridge:{enabled:false},area:{minX:-.5,maxX:.5,minZ:-.5,maxZ:.5},tunables:{shadowOpacity:0}});
    api.group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)m.map.anisotropy=anisotropy;}});
    let pressed=false,time=0;
    return {id:'magnet',root:api.group,alignment:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),api,
      get boundsRoot(){return api.exhibition.activeRoot;},get stage(){return api.stage;},get busy(){return api.exhibition.busy;},
      touch(){if(api.stage==='magnetFree'||api.stage==='cardOut'||api.stage==='cardOpen'){pressed=true;api.exhibition.bend(.5);return true;}return false;},
      release(){pressed=false;api.exhibition.bend(0);},
      advance(){return api.exhibition.advance();},
      update(dt){api.update(dt,time+=dt);api.exhibition.syncVisibility();},
      reset(){pressed=false;api.exhibition.reset();api.exhibition.syncVisibility();},
      title:'晴空塔冰箱贴',material:'金属质感 · 原装纸卡 · 透明包装',details:'约 50.3 × 49.8 mm。原包装按封口、纸卡、吸塑壳和冰箱贴的正常顺序打开。拿起后轻点藏品逐步拆封，长按取出的物件可轻微弯折。'};
  }
  const values=await Promise.all([plush(),magnet()]);
  for(const v of values){scene.remove(v.root);v.root.name='exhibit_'+v.id;}
  return Object.fromEntries(values.map(v=>[v.id,v]));
}

export async function exportExhibit(item,part=null){
  const src=part==='body'&&item.api.softRoot?item.api.softRoot:part==='item'&&item.id==='magnet'?item.api.debug.bodies.magnet.root:item.root;
  const saved=[];src.traverse(o=>{saved.push([o,o.userData]);const hidden=o.material&&(Array.isArray(o.material)?o.material.every(m=>!m.visible):!o.material.visible);o.userData={isFur:!!o.userData?.isFur,noExport:!!o.userData?.noExport||!!hidden};});
  let copy;try{copy=src.clone(true);}finally{for(const[o,u]of saved)o.userData=u;}
  copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.updateMatrix();
  const drop=[],exportMaterials=new Map();
  function standard(material){
    if(!material.userData?.fresnel)return material;
    if(!exportMaterials.has(material))exportMaterials.set(material,new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.02,depthWrite:false,side:THREE.DoubleSide,roughness:.2,metalness:0,specularIntensity:.05,normalMap:material.normalMap,normalScale:material.normalScale?.clone()}));
    return exportMaterials.get(material);
  }
  copy.traverse(o=>{
    if(o.userData.isFur||o.userData.noExport||o.isLight||o.type==='LineSegments')drop.push(o);
    if(o.isInstancedMesh){const m=new THREE.Matrix4();o.instanceMatrix=o.instanceMatrix.clone();let n=0;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(Math.abs(m.determinant())>1e-16)o.setMatrixAt(n++,m);}o.count=n;if(!n)o.visible=false;}
    if(o.isMesh){o.geometry=o.geometry.clone();for(const k of Object.keys(o.geometry.attributes))if(!['position','normal','uv','color'].includes(k))o.geometry.deleteAttribute(k);o.material=Array.isArray(o.material)?o.material.map(standard):standard(o.material);}
  });drop.forEach(o=>o.removeFromParent());
  let baked;if(item.fur){baked=item.fur.bake();(part==='body'?copy:copy.getObjectByName('plushSoftRoot')).add(baked);}
  try{return await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true});}finally{copy.traverse(o=>o.geometry?.dispose());if(baked)baked.material.dispose();for(const m of exportMaterials.values())m.dispose();}
}
