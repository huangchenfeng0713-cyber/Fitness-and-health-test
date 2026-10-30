// Validate actual rendered geometry and decoded photos, including both concave cuts.
export function verifyMagnetTextures({a,check}){
 const meshes=a.items.magnet.api.debug.bodies.magnet.meshes;
 const front=meshes[1],back=meshes[2];
 check('magnet has distinct original front and back photos',[front,back].every(m=>m.material.map?.image?.width===1548&&m.material.map.image.height===1535)&&front.material.map!==back.material.map);
 for(const [name,mesh,sign] of [['front',front,1],['back',back,-1]]){
  const g=mesh.geometry,p=g.attributes.position,u=g.attributes.uv,n=g.attributes.normal,idx=g.index.array;
  check(name+' UVs cover valid image pixels',Array.from(u.array).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  check(name+' normals face outward',Array.from({length:n.count},(_,i)=>n.getZ(i)*sign>.999).every(Boolean));
  let folded=0,min=Infinity,max=0,precisionLimited=0;
  const cross=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  for(let j=0;j<idx.length;j+=3){
   const [i,k,l]=[idx[j],idx[j+1],idx[j+2]];
   const area=cross(p.getX(i),p.getY(i),p.getX(k),p.getY(k),p.getX(l),p.getY(l));
   const uvArea=cross(u.getX(i),u.getY(i),u.getX(k),u.getY(k),u.getX(l),u.getY(l));
   // Float32 UVs cannot resolve area ratios on nearly collinear, micron-size slivers.
   if(Math.abs(area)<1e-11)continue;
   if(uvArea<=0)folded++;
   const edge2=Math.max(...[[i,k],[k,l],[l,i]].map(([a,b])=>(p.getX(a)-p.getX(b))**2+(p.getY(a)-p.getY(b))**2));
   if(Math.abs(area)/edge2<1e-4){precisionLimited++;continue;}
   const scale=Math.abs(uvArea/area);min=Math.min(min,scale);max=Math.max(max,scale);
  }
  check(name+' triangles have no inverted or stretched UV islands',!folded&&max/min<1.5,{folded,areaScaleRatio:max/min,precisionLimited});
  const covers=(px,py)=>{
   const x=(px-774)/30000,y=(767.5-py)/30000;
   for(let j=0;j<idx.length;j+=3){
    const tri=[idx[j],idx[j+1],idx[j+2]],s=tri.map((k,i)=>{const l=tri[(i+1)%3];return cross(p.getX(k),p.getY(k),p.getX(l),p.getY(l),x,y);});
    if(s.every(v=>v>=-1e-13)||s.every(v=>v<=1e-13))return true;
   }
   return false;
  };
  check(name+' silhouette preserves the photographed tower-star notch',!covers(700,530)&&covers(760,540));
 }
 const img=back.material.map.image,canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const data=ctx.getImageData(400,960,800,200).data;
 let min=255,max=0,opaque=true;
 for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);opaque&&=data[i+3]===255;}
 check('back photo includes opaque detailed lettering instead of a fallback',opaque&&max-min>120,{contrast:max-min});

 // The backing paper is a separate object from the metal magnet. Its original
 // photo included the bed fabric above a bowed edge; decoding alone missed it.
 const card=a.items.magnet.api.debug.bodies.card;
 const panel=card.backPivot.children.find(o=>o.isMesh&&Array.isArray(o.material));
 const paperMap=panel.material[1].map,paper=paperMap.image;
 const pc=document.createElement('canvas');pc.width=paper.width;pc.height=paper.height;
 const pg=pc.getContext('2d',{willReadFrequently:true});pg.drawImage(paper,0,0);
 const top=pg.getImageData(500,0,280,70).data;
 let topMinimum=255;
 for(let i=0;i<top.length;i+=4)topMinimum=Math.min(topMinimum,(top[i]+top[i+1]+top[i+2])/3);
 check('backing card top samples paper instead of photographic fabric',paperMap.userData.photoRectified&&topMinimum>190,{topMinimum});
 const lineAt=(x,w)=>{
  const pixels=pg.getImageData(x,185,w,45).data,rows=[];
  for(let i=0;i<pixels.length;i+=4)if((pixels[i]+pixels[i+1]+pixels[i+2])/3<160)rows.push(Math.floor(i/4/w)+185);
  rows.sort((a,b)=>a-b);return {ink:rows.length,baseline:rows[Math.floor(rows.length/2)]};
 };
 const left=lineAt(130,170),right=lineAt(550,155);
 check('backing card printed line is level after photographic unbending',left.ink>100&&right.ink>100&&Math.abs(left.baseline-right.baseline)<8,{left,right});
 const barcode=pg.getImageData(80,970,360,100).data;
 let light=0,dark=255;
 for(let i=0;i<barcode.length;i+=4){light=Math.max(light,barcode[i]);dark=Math.min(dark,barcode[i]);}
 check('backing card keeps original detailed barcode ink',light-dark>140,{contrast:light-dark});
}
