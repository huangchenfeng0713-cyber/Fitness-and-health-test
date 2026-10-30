// Short, tapered minky fibres. Roots interpolate the live soft mesh so the pile
// follows a dent or bend without detaching from the fabric.
import * as THREE from 'three';

export function createFur(baseMesh, opts = {}) {
  const base = baseMesh.geometry, pos = base.attributes.position, normal = base.attributes.normal;
  const uv = base.attributes.uv, rest = base.attributes.restPosition || pos;
  const seam = opts.seam || new Float32Array(pos.count);
  if (!base.attributes.furSeam) base.setAttribute('furSeam', new THREE.BufferAttribute(seam, 1));
  const count = opts.shells <= 8 ? 18000 : 42000;
  const indices = base.index?.array || Uint32Array.from({length:pos.count},(_,i)=>i);
  const cdf = new Float32Array(indices.length/3);
  const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3();
  let area=0, seed=127;
  const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let t=0;t<cdf.length;t++) {
    A.fromBufferAttribute(rest,indices[t*3]);B.fromBufferAttribute(rest,indices[t*3+1]);C.fromBufferAttribute(rest,indices[t*3+2]);
    area+=B.sub(A).cross(C.sub(A)).length()*.5;cdf[t]=area;
  }
  const rootIndices=new Uint32Array(count*3), weights=new Float32Array(count*3);
  const rootPos=new Float32Array(count*3),rootN=new Float32Array(count*3),rootFlow=new Float32Array(count*3);
  const rootUv=new Float32Array(count*2),rootRest=new Float32Array(count*3),rootSeam=new Float32Array(count),random=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
    const s=rnd()*area;let lo=0,hi=cdf.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<s)lo=mid+1;else hi=mid;}
    const r=Math.sqrt(rnd()),b=rnd(),w=[1-r,r*(1-b),r*b];
    for(let k=0;k<3;k++) {
      const v=indices[lo*3+k];rootIndices[i*3+k]=v;weights[i*3+k]=w[k];
      rootUv[i*2]+=uv.getX(v)*w[k];rootUv[i*2+1]+=uv.getY(v)*w[k];rootSeam[i]+=seam[v]*w[k];
      rootRest[i*3]+=rest.getX(v)*w[k];rootRest[i*3+1]+=rest.getY(v)*w[k];rootRest[i*3+2]+=rest.getZ(v)*w[k];
    }
    random[i*3]=rnd()*Math.PI*2;random[i*3+1]=.65+rnd()*.7;random[i*3+2]=rnd();
  }
  // Two joined trapezoids; position.x = ribbon width coordinate, position.y = height.
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,-.34,.48,0,.34,.48,0,0,1,0],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,.48,1,.48,.5,1],2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],3));
  // across = normal × lay, so reverse the 2D ribbon winding to face outward.
  // Back-facing ribbons were the source of the dark stippled hair appearance.
  g.setIndex([0,2,1,1,2,3,2,4,3]);
  const attr=(name,array,size)=>{const a=new THREE.InstancedBufferAttribute(array,size);a.setUsage(THREE.DynamicDrawUsage);g.setAttribute(name,a);return a;};
  const pa=attr('fRoot',rootPos,3),na=attr('fNormal',rootN,3),fa=attr('fFlow',rootFlow,3);
  attr('fUv',rootUv,2);attr('fRandom',random,3);attr('fSeam',rootSeam,1);
  g.instanceCount=count;
  const shared={uPile:{value:opts.furLength||.00085},uGravity:{value:new THREE.Vector3(0,-1,0)},uWind:{value:new THREE.Vector3()},
    uMask:{value:opts.maskMap||null},uHasMask:{value:opts.maskMap?1:0}};
  const original=baseMesh.material;
  // White pile takes the print colour only at ink, never the grey baked crease.
  const cc=document.createElement('canvas');cc.width=original.map.image.width;cc.height=original.map.image.height;
  const cx=cc.getContext('2d');cx.drawImage(original.map.image,0,0);const col=cx.getImageData(0,0,cc.width,cc.height);
  if(opts.maskMap?.image){cx.drawImage(opts.maskMap.image,0,0,cc.width,cc.height);const mask=cx.getImageData(0,0,cc.width,cc.height);
    for(let i=0;i<col.data.length;i+=4){const k=mask.data[i]/255;for(let j=0;j<3;j++)col.data[i+j]=Math.round(col.data[i+j]*k+246*(1-k));}}
  cx.putImageData(col,0,0);const pileMap=new THREE.CanvasTexture(cc);pileMap.flipY=original.map.flipY;pileMap.colorSpace=THREE.SRGBColorSpace;pileMap.anisotropy=8;
  const mat=new THREE.MeshPhysicalMaterial({map:pileMap,roughness:1,metalness:0,specularIntensity:0,sheen:.65,sheenRoughness:1,
    side:THREE.FrontSide,transparent:true,opacity:.48,depthWrite:false,alphaTest:.015});
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,shared);
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      attribute vec3 fRoot,fNormal,fFlow,fRandom; attribute vec2 fUv; attribute float fSeam;
      uniform float uPile,uHasMask; uniform sampler2D uMask; uniform vec3 uGravity,uWind;
      varying float vFHeight;`)
      .replace('#include <uv_vertex>',`#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = (mapTransform * vec3(fUv,1.0)).xy;
        #endif`)
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec3 fn=normalize(fNormal);
        vec3 ft=normalize(cross(fn,abs(fn.y)<.9?vec3(0,1,0):vec3(1,0,0)));
        vec3 fb=cross(fn,ft);
        vec3 comb=vec3(.16*sin(fRandom.x),.85,.22);
        comb-=fn*dot(comb,fn);
        if(length(comb)<.1)comb=ft*.75;
        vec3 across=normalize(cross(fn,comb));
        objectNormal=fn;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float ink=uHasMask>.5?texture2D(uMask,fUv).r:0.0;
        float height=position.y;
        float len=uPile*fRandom.y*mix(1.0,.22,ink)*mix(1.0,.28,fSeam);
        vec3 lay=comb+fFlow*.7+uWind;
        lay-=fn*dot(lay,fn);
        transformed=fRoot+fn*((.06+height*.18)*len)+lay*((height*.8+height*height*.2)*len)+across*(position.x*.00009);
        vFHeight=height;`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying float vFHeight;`)
      .replace('#include <map_fragment>',`#include <map_fragment>
      diffuseColor.rgb*=mix(.98,1.0,sqrt(vFHeight));
      // Most pile lies in the fabric; explicit fibres are only the soft fringe.
      // Fade them out over front-facing areas to avoid aliasing as black dots.
      float grazing=1.0-abs(dot(normalize(vNormal),normalize(vViewPosition)));
      diffuseColor.a*=smoothstep(.42,.88,grazing)*smoothstep(0.0,.25,vFHeight);`);
  };
  mat.customProgramCacheKey=()=> 'photo-pile-fringe-v2';
  const mesh=new THREE.Mesh(g,mat);mesh.name='short_minky_fibres';mesh.frustumCulled=false;mesh.receiveShadow=false;mesh.castShadow=false;mesh.userData.isFur=true;
  const group=new THREE.Group();group.add(mesh);
  const fabric=new THREE.MeshPhysicalMaterial({map:original.map,normalMap:original.normalMap,normalScale:original.normalScale?.clone(),
    roughness:1,metalness:0,specularIntensity:0,sheen:.5,sheenRoughness:1});
  // Fine pile at the roots provides texture between the explicit fibres.
  fabric.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n attribute float furSeam; varying float vSew;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n vSew=furSeam;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n varying float vSew;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        diffuseColor.rgb*=1.-.11*vSew;`);
  };
  baseMesh.material=fabric;
  let lastVersion=-1,dirty=true,active=false;
  function sync(){
    for(let i=0;i<count;i++) {
      const q=i*3;let x=0,y=0,z=0,nx=0,ny=0,nz=0;
      for(let k=0;k<3;k++){const v=rootIndices[q+k],w=weights[q+k];x+=pos.getX(v)*w;y+=pos.getY(v)*w;z+=pos.getZ(v)*w;nx+=normal.getX(v)*w;ny+=normal.getY(v)*w;nz+=normal.getZ(v)*w;}
      const l=Math.hypot(nx,ny,nz)||1;rootPos[q]=x;rootPos[q+1]=y;rootPos[q+2]=z;rootN[q]=nx/l;rootN[q+1]=ny/l;rootN[q+2]=nz/l;
    }
    pa.needsUpdate=true;na.needsUpdate=true;lastVersion=pos.version;
  }
  function stroke(p,d,strength=1,radius=.007){
    const r2=radius*radius;
    for(let i=0;i<count;i++){const q=i*3,dx=rootRest[q]-p.x,dy=rootRest[q+1]-p.y,dz=rootRest[q+2]-p.z,s=dx*dx+dy*dy+dz*dz;
      if(s>r2)continue;const w=Math.min(1,strength*Math.exp(-3*s/r2));rootFlow[q]+=(d.x-rootFlow[q])*w;rootFlow[q+1]+=(d.y-rootFlow[q+1])*w;rootFlow[q+2]+=(d.z-rootFlow[q+2])*w;}
    active=true;dirty=true;
  }
  function update(dt,gravity){
    if(gravity)shared.uGravity.value.copy(gravity);
    if(pos.version!==lastVersion)sync();
    if(active){const k=Math.exp(-dt/5);let max=0;for(let i=0;i<rootFlow.length;i++){rootFlow[i]*=k;max=Math.max(max,Math.abs(rootFlow[i]));}dirty=true;if(max<.002){rootFlow.fill(0);active=false;}}
    if(dirty){fa.needsUpdate=true;dirty=false;}
  }
  function bake() {
    sync();
    const image=opts.maskMap?.image;
    let mask=null,mw=0,mh=0;
    if(image){const c=document.createElement('canvas');mw=c.width=image.width;mh=c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);mask=ctx.getImageData(0,0,mw,mh).data;}
    const P=new Float32Array(count*5*3),N=new Float32Array(P.length),U=new Float32Array(count*5*2),colors=new Float32Array(P.length),I=new Uint32Array(count*9);
    const fn=new THREE.Vector3(),ft=new THREE.Vector3(),fb=new THREE.Vector3(),across=new THREE.Vector3(),lay=new THREE.Vector3(),v=new THREE.Vector3(),nn=new THREE.Vector3();
    const verts=[[-.5,0],[.5,0],[-.34,.48],[.34,.48],[0,1]],tri=[0,2,1,1,2,3,2,4,3];
    for(let i=0;i<count;i++){
      const q=i*3,uv0=i*2,angle=random[q];fn.fromArray(rootN,q);ft.crossVectors(fn,Math.abs(fn.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize();fb.crossVectors(fn,ft);
      lay.set(.16*Math.sin(angle),.85,.22);lay.addScaledVector(fn,-lay.dot(fn));if(lay.length()<.1)lay.copy(ft).multiplyScalar(.75);
      across.crossVectors(fn,lay).normalize();
      lay.addScaledVector(v.fromArray(rootFlow,q),.7).add(shared.uWind.value);lay.addScaledVector(fn,-lay.dot(fn));
      const mx=Math.min(mw-1,Math.max(0,Math.round(rootUv[uv0]*(mw-1)))),my=Math.min(mh-1,Math.max(0,Math.round(rootUv[uv0+1]*(mh-1))));
      const ink=mask?mask[(my*mw+mx)*4]/255:0,len=shared.uPile.value*random[q+1]*(1-.78*ink)*(1-.72*rootSeam[i]);
      nn.copy(fn);
      for(let k=0;k<5;k++){
        const [x,h]=verts[k],o=(i*5+k)*3,u=(i*5+k)*2;
        v.fromArray(rootPos,q).addScaledVector(fn,(.06+h*.18)*len).addScaledVector(lay,(h*.8+h*h*.2)*len).addScaledVector(across,x*.00009);v.toArray(P,o);nn.toArray(N,o);
        U[u]=rootUv[uv0];U[u+1]=rootUv[uv0+1];const ao=.97+.03*Math.sqrt(h);colors[o]=colors[o+1]=colors[o+2]=ao;
      }
      for(let k=0;k<9;k++)I[i*9+k]=i*5+tri[k];
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.setAttribute('uv',new THREE.BufferAttribute(U,2));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(new THREE.BufferAttribute(I,1));
    const material=new THREE.MeshPhysicalMaterial({map:pileMap,vertexColors:true,roughness:1,metalness:0,specularIntensity:0,sheen:.65,sheenRoughness:1,
      transparent:true,opacity:.2,depthWrite:false,alphaTest:.015});
    const baked=new THREE.Mesh(geo,material);baked.name='baked_minky_fibres';return baked;
  }
  sync();
  return {group,stroke,update,bake,materials:[mat],setWind:v=>shared.uWind.value.copy(v),setShellCount:n=>mesh.visible=n>0};
}
