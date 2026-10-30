"""Offline geometry/texture review renderer; no browser or external service."""
from pathlib import Path
import struct,json,io
import numpy as np
from PIL import Image,ImageDraw
from numba import njit
ROOT=Path(__file__).resolve().parents[1]

def load(path):
 raw=Path(path).read_bytes();n=struct.unpack_from('<I',raw,12)[0]
 d=json.loads(raw[20:20+n]);b=raw[28+n:]
 def ar(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];w={'VEC4':4,'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
  return np.frombuffer(b,dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']],count=a['count']*w,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,w).copy()
 def im(t):
  i=d['images'][d['textures'][t]['source']];v=d['bufferViews'][i['bufferView']];start=v.get('byteOffset',0)
  return np.asarray(Image.open(io.BytesIO(b[start:start+v['byteLength']])).convert('RGB')).astype(np.float32)/255
 out=[]
 for m in d['meshes']:
  for p in m['primitives']:
   a=p['attributes'];mat=d['materials'][p['material']];pbr=mat.get('pbrMetallicRoughness',{})
   tex=im(pbr['baseColorTexture']['index']) if 'baseColorTexture' in pbr else np.ones((1,1,3),np.float32)
   nm=im(mat['normalTexture']['index']) if 'normalTexture' in mat else np.full((1,1,3),[.5,.5,1],np.float32)
   pos=ar(a['POSITION']);uv=ar(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else np.zeros((len(pos),2),np.float32)
   out.append((m['name'],pos,ar(a['NORMAL']),uv,ar(p['indices']).reshape(-1,3).astype(np.int64),tex,nm,float(mat.get('normalTexture',{}).get('scale',0))))
 return out

@njit(cache=True)
def raster(pos,norm,uv,faces,texture,nmap,ns,project,depth,img,light):
 H,W=depth.shape
 for tri in faces:
  a,b,c=tri
  x0,y0,z0=project[a];x1,y1,z1=project[b];x2,y2,z2=project[c]
  den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
  if abs(den)<1e-8:continue
  # Edges of the real UV atlas define the tangent frame.
  du1=uv[b]-uv[a];du2=uv[c]-uv[a];e1=pos[b]-pos[a];e2=pos[c]-pos[a]
  det=du1[0]*du2[1]-du1[1]*du2[0]
  tangent=np.array([1.,0.,0.]);bitangent=np.array([0.,1.,0.])
  if abs(det)>1e-12:
   tangent=(e1*du2[1]-e2*du1[1])/det;bitangent=(e2*du1[0]-e1*du2[0])/det
   tangent/=max(np.sqrt((tangent*tangent).sum()),1e-12)
   bitangent/=max(np.sqrt((bitangent*bitangent).sum()),1e-12)
  xmin=max(0,int(np.floor(min(x0,x1,x2))));xmax=min(W-1,int(np.ceil(max(x0,x1,x2))))
  ymin=max(0,int(np.floor(min(y0,y1,y2))));ymax=min(H-1,int(np.ceil(max(y0,y1,y2))))
  for y in range(ymin,ymax+1):
   for x in range(xmin,xmax+1):
    f=((y1-y2)*(x+.5-x2)+(x2-x1)*(y+.5-y2))/den
    g=((y2-y0)*(x+.5-x2)+(x0-x2)*(y+.5-y2))/den;h=1-f-g
    if min(f,g,h)<-1e-5:continue
    z=z0*f+z1*g+z2*h
    if z<=depth[y,x]:continue
    v=uv[a]*f+uv[b]*g+uv[c]*h
    tu=min(texture.shape[1]-1,max(0,int(v[0]*(texture.shape[1]-1))))
    tv=min(texture.shape[0]-1,max(0,int(v[1]*(texture.shape[0]-1))))
    color=texture[tv,tu]
    n=norm[a]*f+norm[b]*g+norm[c]*h
    n/=max(np.sqrt((n*n).sum()),1e-10)
    if ns>0:
     tu=min(nmap.shape[1]-1,max(0,int(v[0]*(nmap.shape[1]-1))))
     tv=min(nmap.shape[0]-1,max(0,int(v[1]*(nmap.shape[0]-1))))
     q=nmap[tv,tu]*2-1
     n=n*q[2]+tangent*q[0]*ns+bitangent*q[1]*ns;n/=max(np.sqrt((n*n).sum()),1e-10)
    lum=.20+.87*max(0.,(n*light).sum())
    img[y,x]=np.minimum(1.,color*lum**.65)
    depth[y,x]=z

def render(meshes,direction,name):
 forward=np.array(direction,dtype=float);forward/=np.linalg.norm(forward)
 right=np.cross([0.,1.,0.],forward);right/=np.linalg.norm(right);up=np.cross(forward,right)
 R=np.array([right,up,forward]);width,height=1000,1000;scale=height/.132
 center=np.array([0,.059,0]);light=right*-.5+up*.8+forward;light/=np.linalg.norm(light)
 img=np.full((height,width,3),.045,np.float32);depth=np.full((height,width),-1e3)
 for _,p,n,uv,f,tex,nm,ns in meshes:
  pr=(p-center)@R.T;pr[:,0]=pr[:,0]*scale+width/2;pr[:,1]=height/2-pr[:,1]*scale
  raster(p.astype(float),n.astype(float),uv.astype(float),f,tex,nm,ns,pr,depth,img,light)
 out=ROOT/'dev/qa-output'/name;Image.fromarray(np.uint8(np.clip(img,0,1)*255)).save(out,quality=95)
 print(out)
if __name__=='__main__':
 meshes=load(ROOT/'assets/plush.glb')
 for direction,name in [([0,.02,1],'model-review-front.jpg'),([1,.05,.3],'model-review-side.jpg'),([0,.02,-1],'model-review-back.jpg')]:render(meshes,direction,name)
