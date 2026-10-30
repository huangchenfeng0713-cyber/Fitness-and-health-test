"""Photo-traced, sewn plush reconstruction. Original reference images stay local.

The front outline is traced in the 900x1200 upright IMG_0510 view; rear colour
comes from IMG_0509. Side views constrain thickness, not an assumed sphere.
Absolute dimensions remain photographic estimates, not a calibrated scan.
"""
from pathlib import Path
import base64, copy, io, json, struct
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
from scipy import ndimage as ndi
from scipy.interpolate import splprep, splev
from scipy.sparse import coo_matrix
from scipy.spatial import cKDTree
from matplotlib.path import Path as Polygon
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'dev/revisions/shape-textile-before'
OUT = ROOT / 'dev/qa-output'
OUT.mkdir(parents=True, exist_ok=True)
register_heif_opener()
SCALE = .1 / 575
MID_Z = .0005

# Asymmetric outlines, including the long arms and the uninterrupted leg roots.
OUTLINES = [
 [(431,510),(377,511),(337,533),(310,569),(297,610),(297,653),
  (312,698),(338,731),(359,746),(362,767),(482,769),(488,747),
  (514,732),(543,704),(557,665),(554,630),(540,584),(516,548),(480,521)],
 [(363,757),(485,765),(489,807),(487,843),(494,888),(502,935),
  (503,977),(498,1019),(494,1053),(481,1081),(460,1087),(442,1076),
  (435,1055),(433,1017),(429,1010),(425,1017),(424,1046),(417,1070),
  (400,1078),(383,1070),(374,1049),(368,1015),(365,981),(364,945),
  (366,907),(364,870),(367,832),(361,800)],
 [(358,770),(347,782),(328,818),(313,861),(299,909),(300,930),
  (311,937),(329,933),(340,921),(349,899),(359,863),(366,835),(373,810),(373,790)],
 [(485,772),(500,793),(511,823),(526,861),(539,910),(543,935),
  (532,946),(517,945),(505,931),(496,907),(489,868),(483,836),(477,809)],
]

def smooth_outline(points):
    pts=np.asarray(points,float)
    tck,_=splprep([pts[:,0],pts[:,1]],s=2,per=True)
    return np.array(splev(np.linspace(0,1,1800,endpoint=False),tck)).T

outlines=[smooth_outline(p) for p in OUTLINES]

def normals(p,f):
    n=np.zeros_like(p)
    cross=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]])
    for k in range(3):np.add.at(n,f[:,k],cross)
    return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-12)

# A signed 2D outline distance with a thin stuffed cross-section. The profile
# narrows down the legs instead of appending spherical feet to a broad hem.
step=.00048
xs=np.arange(-.027,.027+step,step)
ys=np.arange(-.003,.104+step,step)
zs=np.arange(-.011,.012+step,step)
X,Y=np.meshgrid(xs,ys,indexing='ij')
pixel=np.column_stack([433+X.ravel()/SCALE,1085-Y.ravel()/SCALE])
field=np.full((len(xs),len(ys),len(zs)),10.,dtype=np.float32)
for part,outline in enumerate(outlines):
    inside=Polygon(outline).contains_points(pixel).reshape(X.shape)
    # Accurate contour distance avoids ridges from a coarse binary voxel edge.
    d=cKDTree(outline*SCALE).query(pixel*SCALE)[0].reshape(X.shape)
    d*=np.where(inside,1,-1)
    if part==0:
        radius=.0225;thickness=.00825
    elif part==1:
        radius=np.interp(Y,[0,.012,.023,.05],[.0043,.0047,.010,.010])
        thickness=np.interp(Y,[0,.012,.025,.06],[.00265,.0031,.0044,.0043])
    else:
        radius=.0047;thickness=.0033
    f=(np.maximum(1-d/radius,0)**2-1)[:,:,None]+((zs-MID_Z)/np.asarray(thickness)[...,None])**2
    # Smooth only the joining shoulders/neck; the two lower legs stay separate.
    k=.08
    h=np.clip(.5+.5*(f-field)/k,0,1)
    field=(f*(1-h)+field*h-k*h*(1-h)).astype(np.float32)

p,f,_,_=marching_cubes(field,level=0,spacing=(step,step,step),gradient_direction='ascent')
p+=np.array([xs[0],ys[0],zs[0]])
edges=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1),axis=0)
row=np.r_[edges[:,0],edges[:,1]];col=np.r_[edges[:,1],edges[:,0]]
adj=coo_matrix((np.ones(len(row)),(row,col)),shape=(len(p),len(p))).tocsr()
degree=np.maximum(np.asarray(adj.sum(1)).ravel(),1)
# Remove the voxel stair steps, without rounding off the traced silhouette.
for _ in range(8):
    p+=.42*(adj@p/degree[:,None]-p)
    p-=.44*(adj@p/degree[:,None]-p)
if np.einsum('ij,ij->i',p[f[:,0]],np.cross(p[f[:,1]],p[f[:,2]])).sum()<0:f=f[:,[0,2,1]]
n=normals(p,f)

# Very shallow stitching; the photographed pile supplies fine texture.
band=np.clip((.045-p[:,1])/.004,0,1)*np.clip((.014-np.abs(p[:,0]))/.002,0,1)
dist=np.minimum.reduce([np.abs((p[:,1]+sgn*p[:,0]*.62+phase+.007)% .014-.007)
                         for sgn,phase in [(1,0),(-1,.005)]])
groove=np.exp(-(dist/.00030)**2)*band
facing=np.clip((np.abs(n[:,2])-.4)/.5,0,1)
p-=n*(.00018*groove*facing)[:,None]
n=normals(p,f)
# Duplicate only the front/back UV seam; smooth normals retain the sewn edge.
front=f[np.mean(p[f,2],axis=1)>=MID_Z]
back=f[np.mean(p[f,2],axis=1)<MID_Z]
PP=[];NN=[];UV=[];FF=[];offset=0
for side,faces in enumerate([front,back]):
    used,inv=np.unique(faces,return_inverse=True)
    v=p[used];PP.append(v);NN.append(n[used])
    UV.append(np.column_stack([(.25+v[:,0]/.12) if side==0 else (.75-v[:,0]/.12),.98214286-v[:,1]/.112]))
    FF.append(inv.reshape(-1,3)+offset);offset+=len(used)
body_p=np.concatenate(PP);body_n=np.concatenate(NN);body_uv=np.concatenate(UV);body_f=np.concatenate(FF)

def read_photo(name):
    return ImageOps.exif_transpose(Image.open(ROOT/'references'/name)).convert('RGB')

front_photo=read_photo('IMG_0510.HEIC')
rear_photo=read_photo('IMG_0509.HEIC')

def projected_photo(photo,px,py,which):
    # Sample real pile and ink, then gently remove wide photographic shading.
    a=np.asarray(photo,dtype=float)/255
    ratio=np.array([photo.width/900,photo.height/1200])
    coords=np.array([py*ratio[1],px*ratio[0]])
    c=np.stack([ndi.map_coordinates(a[:,:,i],coords,order=1,mode='nearest') for i in range(3)],axis=2)
    if which=='front':
        inside=np.zeros(px.shape,bool)
        pts=np.column_stack([px.ravel(),py.ravel()])
        for outline in outlines:inside|=Polygon(outline).contains_points(pts).reshape(px.shape)
    else:
        # Rear silhouette has a small photographic perspective difference.
        rear_outline=smooth_outline([(474,472),(419,478),(377,507),(347,549),(342,607),(348,665),
          (370,701),(406,728),(408,743),(384,756),(367,797),(355,842),(350,884),(358,901),
          (377,905),(390,887),(393,914),(385,954),(385,1004),(390,1038),(399,1071),(416,1087),
          (438,1083),(452,1064),(456,1010),(462,1011),(466,1067),(481,1084),(503,1079),
          (520,1045),(534,1005),(534,942),(526,885),(535,886),(548,918),(568,929),(587,922),
          (598,904),(595,878),(578,815),(562,767),(541,737),(542,719),(575,694),(597,658),
          (611,605),(606,549),(583,510),(541,484),(505,474)])
        inside=Polygon(rear_outline).contains_points(np.column_stack([px.ravel(),py.ravel()])).reshape(px.shape)
    if which=='front':
        printed=((py>580)&(py<676)&(px>380)&(px<490))|((py>853)&(py<1033)&(px>389)&(px<486))
    else:
        printed=((py>591)&(py<633)&(px>375)&(px<573))|((py>806)&(py<994)&(px>447)&(px<496))
    fabric=(c.mean(2)>.68)&((c.max(2)-c.min(2))<.22)
    good=ndi.binary_erosion(inside,iterations=8)&(fabric|printed)
    # Keep quilt/background pixels outside the garment out of every seam sample.
    nearest=ndi.distance_transform_edt(~good,return_distances=False,return_indices=True)
    c[~good]=c[nearest[0][~good],nearest[1][~good]]
    # The neck decoration is its own front-only cloth mesh.
    if which=='front':
        neck=(py>757)&(py<848)&(px>355)&(px<493)&((c[:,:,1]-c[:,:,0])>.065)
        neck=ndi.binary_dilation(neck,iterations=3)
        patchcoords=np.array([(550+(py-757)*.52)*ratio[1],(350+(px-355)*.22)*ratio[0]])
        patch=np.stack([ndi.map_coordinates(a[:,:,i],patchcoords,order=1,mode='nearest') for i in range(3)],axis=2)
        c[neck]=patch[neck]
    lum=c.mean(2)
    ink=np.clip((c[:,:,1]-c[:,:,0]-.025)*8,0,1)*np.clip((.82-c[:,:,0])*3,0,1)
    ink=np.maximum(ink,np.clip((c[:,:,2]-c[:,:,0]-.025)*7,0,1))
    # Edge-preserving division removes the large light gradient, not individual hairs.
    clean=np.where(ink>.1,.86,lum)
    broad=ndi.gaussian_filter(clean,45)
    gain=np.clip(.89/np.maximum(broad,.3),.9,1.19)
    c*= (1+(gain-1)*(1-ink*.8))[:,:,None]
    return np.clip(c,0,1),ink

size=2048
vv,uu=np.mgrid[:size,:size//2]
u=(uu+.5)/size;v=(vv+.5)/size
y=(.98214286-v)*.112;x=(u-.25)*.12
px=433+x/SCALE;py=1085-y/SCALE
front_tex,front_ink=projected_photo(front_photo,px,py,'front')
# Rear correspondences follow each landmark instead of copying the front face.
bpy=np.interp(py,[430,510,756,840,1010,1085,1140],[390,472,736,814,1005,1082,1140])
bc=np.interp(py,[510,756,840,1010,1085],[475,473,463,461,457])
ratio=np.interp(py,[510,756,840,1010,1085],[1.03,1.03,1.03,1.04,1.02])
# Back half has mirrored x UVs; source photo is naturally seen from the rear.
back_tex,back_ink=projected_photo(rear_photo,bc+(px-433)*ratio,bpy,'back')
atlas=np.concatenate([front_tex,back_tex],axis=1)
ink=np.concatenate([front_ink,back_ink],axis=1)
atlas_im=Image.fromarray(np.uint8(atlas*255))

# Microscopic pile relief, not the previous deep tiled/wavy normal texture.
luma=atlas.mean(2);fine=luma-ndi.gaussian_filter(luma,2.2)
fine*=1-ndi.maximum_filter(ink,size=5)
gy,gx=np.gradient(ndi.gaussian_filter(fine,.5))
nm=np.stack([-gx*.85,-gy*.85,np.ones_like(gx)],axis=2)
nm/=np.linalg.norm(nm,axis=2,keepdims=True)
normal_im=Image.fromarray(np.uint8(np.clip(nm*.5+.5,0,1)*255))
normal_im.save(ROOT/'assets/tex/plush_pile_normal.png')
mask=np.zeros((size,size,3),np.uint8);mask[:,:,0]=np.uint8(ink*255)
Image.fromarray(mask).resize((1024,1024),Image.Resampling.BILINEAR).save(ROOT/'assets/tex/plush_masks.png')

# Rebuild the GLB compactly, keeping the already photographed felt/cord/label art.
baseline=BASE/'plush.glb'
archived=baseline.exists()
if not archived:baseline=ROOT/'assets/plush.glb'
raw=baseline.read_bytes();jn=struct.unpack_from('<I',raw,12)[0]
old=json.loads(raw[20:20+jn]);oldbin=raw[28+jn:]
def old_ar(index):
    a=old['accessors'][index];bv=old['bufferViews'][a['bufferView']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    return np.frombuffer(oldbin,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],
      count=a['count']*width,offset=bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width).copy()
doc={'asset':{'version':'2.0','generator':'Photo-traced keepsake reconstruction'},'scene':0,
     'scenes':[{'nodes':list(range(5))}],'nodes':[],'meshes':[],'materials':copy.deepcopy(old['materials']),
     'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
     'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]}
binary=bytearray()
def view(data):
    binary.extend(b'\0'*(-len(binary)%4));start=len(binary);binary.extend(data)
    doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(data)})
    return len(doc['bufferViews'])-1
def accessor(a,kind):
    a=np.asarray(a,dtype='<u4' if kind=='SCALAR' else '<f4')
    ac={'bufferView':view(a.tobytes()),'componentType':5125 if kind=='SCALAR' else 5126,'count':len(a),'type':kind}
    if kind!='SCALAR':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
    doc['accessors'].append(ac);return len(doc['accessors'])-1
def image(im,mime='image/jpeg'):
    buf=io.BytesIO();im.save(buf,'PNG' if mime=='image/png' else 'JPEG',quality=94,subsampling=0)
    doc['images'].append({'bufferView':view(buf.getvalue()),'mimeType':mime})
    doc['textures'].append({'source':len(doc['images'])-1,'sampler':0});return len(doc['textures'])-1
image(atlas_im)
corners=(365,762,370,838,475,840,486,767)
quad=tuple(x*(front_photo.width/900 if i%2==0 else front_photo.height/1200) for i,x in enumerate(corners))
image(front_photo.transform((640,380),Image.Transform.QUAD,quad,Image.Resampling.BICUBIC))
for tex_index in [2,3]:
    im=old['images'][old['textures'][tex_index]['source']];bv=old['bufferViews'][im['bufferView']]
    data=oldbin[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    image(Image.open(io.BytesIO(data)).convert('RGB'))
normal_index=image(normal_im,'image/png')
doc['materials'][0]['normalTexture']={'index':normal_index,'scale':.22}
for mat in doc['materials']:
    mat['pbrMetallicRoughness']['roughnessFactor']=1
doc['materials'][4]['doubleSided']=True

def mesh(name,pp,ff,uv,material,nn=None):
    if nn is None:nn=normals(pp,ff)
    doc['nodes'].append({'name':name,'mesh':len(doc['meshes'])})
    doc['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':accessor(pp,'VEC3'),
      'NORMAL':accessor(nn,'VEC3'),'TEXCOORD_0':accessor(uv,'VEC2')},'indices':accessor(ff.reshape(-1,1),'SCALAR'),'material':material}]})

mesh('plush_body',body_p,body_f,body_uv,0,body_n)

def cloth_grid(nx,ny,fn):
    pp=[];uv=[];ff=[]
    for j in range(ny+1):
        for i in range(nx+1):
            s,t=i/nx,j/ny;pp.append(fn(s,t));uv.append([s,t])
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;b=a+1;c=a+nx+1;d=c+1
            ff.extend([[a,c,b],[b,c,d]])
    return np.array(pp),np.array(ff),np.array(uv)

def collar(s,t):
    x=(-70+121*s)*SCALE
    pinch=np.exp(-((s-.52)/.19)**2)
    y=(1085-(762+80*t+2*pinch*(1-2*t)))*SCALE
    z=.0050-.0010*((s-.5)*2)**2+.00050*np.sin(np.pi*t)*(1-pinch*.7)
    return [x,y,z]
cp,cf,cu=cloth_grid(40,24,collar)
# Add a back skin and hem thickness without wrapping around the toy's neck.
count=len(cp);bp=cp.copy();bp[:,2]-=.00035
edge=list(range(41))+[j*41+40 for j in range(1,25)]+[24*41+i for i in range(39,-1,-1)]+[j*41 for j in range(23,0,-1)]
side=[]
for a,b in zip(edge,edge[1:]+edge[:1]):side.extend([[a,b,a+count],[b,b+count,a+count]])
mesh('plush_collar',np.r_[cp,bp],np.r_[cf,cf[:,::-1]+count,np.array(side)],np.r_[cu,cu],1)
for i in [2,3]:
    op=old['meshes'][i]['primitives'][0];attrs=op['attributes'];v=old_ar(attrs['POSITION'])
    if archived:v[:,1]-=.0022;v[:,2]-=.0020
    ouv=old_ar(attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else np.zeros((len(v),2))
    mesh(old['meshes'][i]['name'],v,old_ar(op['indices']).reshape(-1,3),ouv,i,old_ar(attrs['NORMAL']))

# The label root follows the actual side edge, 0.7 mm buried inside its seam.
# It is a curved, finely subdivided cloth patch, embedded in the same lattice.
def right_edge(y):
    # Actual mesh cross-section, evaluated close to the side join.
    near=(np.abs(p[:,1]-y)<.0007)&(np.abs(p[:,2]-MID_Z)<.0013)&(p[:,0]>0)
    return float(np.max(p[near,0])) if near.any() else .011
def label(s,t):
    y=.0180-.0103*t
    root=right_edge(y)-.0007
    return [root+.0066*s,y-.0011*s*s,MID_Z+.0006*np.sin(s*np.pi)-.0009*s*s]
lp,lf,lu=cloth_grid(20,28,label)
mesh('plush_label',lp,lf,lu,4)

doc['buffers'][0]['byteLength']=len(binary)
jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary+=b'\0'*(-len(binary)%4)
result=struct.pack('<4sII',b'glTF',2,28+len(jb)+len(binary))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(ROOT/'assets/plush.glb').write_bytes(result)
seam=np.exp(-((body_p[:,2]-MID_Z)/.00048)**2)
meta=json.loads(((BASE if archived else ROOT/'assets')/'plush_meta.json').read_text());meta.update(
    height_m=float(np.ptp(body_p[:,1])),head_top_m=float(body_p[:,1].max()),
    attach_point_m=[0,.115712,-.0012],felt_top_m=.116362,
    seam_u8_b64=base64.b64encode(np.uint8(seam*255)).decode(),
    appearance_revision='photo-traced asymmetrical outline, thin sewn cross-section, tapered continuous legs, seated label, photographic short pile',
    note='Front/back independently projected from original photographs. Collar is a separate front-only cloth. Side seam weights follow the new body vertex order.',
    estimated_dimensions_mm={'head_width':45.5,'head_height':44.8,'head_depth':16.5,'body_width':24.5,'body_depth':8.8,'leg_tip_depth':5.3},
    label_root_vertices=list(range(0,len(lp),21)),label_root_burial_m=.0007,
)
(ROOT/'assets/plush_meta.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf-8')
atlas_im.save(OUT/'photo-atlas-review.jpg',quality=95)
print(json.dumps({'body_vertices':len(body_p),'body_triangles':len(body_f),'dimensions_mm':np.ptp(body_p,axis=0).tolist(),'glb_bytes':len(result)}))
