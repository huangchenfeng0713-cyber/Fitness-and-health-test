"""Check geometry buffers and transforms in each delivered glTF binary."""
from pathlib import Path
import sys, struct, json, numpy as np

def validate(path):
    raw=Path(path).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and total==len(raw), 'invalid GLB header'
    n,kind=struct.unpack_from('<I4s',raw,12);assert kind==b'JSON'
    doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
    arrays=[]
    for a in doc.get('accessors',[]):
        assert not a.get('sparse'), 'sparse accessor not checked'
        v=doc['bufferViews'][a['bufferView']]
        dt=np.dtype({5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*width)
        assert offset+(a['count']-1)*stride+width*dt.itemsize<=len(binary), 'buffer out of bounds'
        vals=np.ndarray((a['count'],width),dtype=dt,buffer=binary,offset=offset,strides=(stride,dt.itemsize))
        assert np.isfinite(vals).all(), 'non-finite accessor'
        arrays.append(vals)
    triangles=0
    for m in doc.get('meshes',[]):
        for p in m['primitives']:
            v=arrays[p['attributes']['POSITION']]
            if 'indices' in p:
                indices=arrays[p['indices']].ravel();assert indices.max()<len(v), 'invalid triangle index'
                triangles+=len(indices)//3
    for node in doc.get('nodes',[]):
        for key in ('matrix','translation','rotation','scale'):
            if key in node: assert np.isfinite(node[key]).all(), 'invalid transform'
        if 'rotation' in node:assert abs(np.linalg.norm(node['rotation'])-1)<.002, 'invalid quaternion'
    for im in doc.get('images',[]):assert 'bufferView' in im, 'external image dependency'
    print(Path(path).name,':',len(doc.get('meshes',[])),'meshes,',triangles,'triangles; finite, embedded textures')
    return True
if __name__=='__main__':
    for path in sys.argv[1:]:validate(path)
