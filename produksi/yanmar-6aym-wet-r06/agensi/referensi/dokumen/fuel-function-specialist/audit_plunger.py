import json,struct,hashlib
from pathlib import Path
from collections import Counter
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT.parent/'yanmar-6aym-wet-r05'
def load(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);o=20+n;ln=struct.unpack_from('<I',b,o)[0];return j,b[o+8:o+8+ln]
def acc(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];t={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']];c={'SCALAR':1,'VEC3':3,'VEC2':2,'VEC4':4}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);size=np.dtype(t).itemsize;stride=v.get('byteStride',size*c)
 return np.ndarray((a['count'],c),dtype=t,buffer=b,offset=off,strides=(stride,size)).copy()
def local(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape((4,4),order='F')
 x,y,z,w=n.get('rotation',[0,0,0,1]);R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 M=np.eye(4);M[:3,:3]=R@np.diag(n.get('scale',[1,1,1]));M[:3,3]=n.get('translation',[0,0,0]);return M
def mesh(path,name):
 j,b=load(path);nodes=j['nodes'];i=next(i for i,n in enumerate(nodes) if n.get('name')==name);parents={c:k for k,n in enumerate(nodes) for c in n.get('children',[])};M=local(nodes[i]);k=i
 while k in parents:k=parents[k];M=local(nodes[k])@M
 vertices=[];faces=[]
 for prim in j['meshes'][nodes[i]['mesh']]['primitives']:
  pos=acc(j,b,prim['attributes']['POSITION']);ix=acc(j,b,prim['indices']).ravel().reshape(-1,3);faces.extend(ix+len(vertices));vertices.extend(pos)
 v=np.array(vertices);f=np.array(faces);v=(M@np.c_[v,np.ones(len(v))].T).T[:,:3]
 unique,inv=np.unique(np.round(v,7),axis=0,return_inverse=True);ff=inv[f];edges=Counter(tuple(sorted(e)) for tri in ff for e in [(tri[0],tri[1]),(tri[1],tri[2]),(tri[2],tri[0])]);t=v[f]
 return {'min':v.min(axis=0).tolist(),'max':v.max(axis=0).tolist(),'volume':float(abs(np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])).sum()/6)), 'triangles':len(f),'nonmanifold_edges_rounded_1e_7':sum(n!=2 for n in edges.values())}
a=BASE/'model/exterior/exterior.glb';b=ROOT/'model/exterior/exterior.glb';rows=[]
for number in range(35,41):
 name=f'EXT-FUEL-{number:02d}';before=mesh(a,name);after=mesh(b,name);contained=all(y>=x-1e-6 for x,y in zip(before['min'],after['min'])) and all(y<=x+1e-6 for x,y in zip(before['max'],after['max']));rows.append({'id':name,'before':before,'after':after,'within_prior_outer_bounds':contained,'material_removed_m3':before['volume']-after['volume']})
r={'baseline_sha256':hashlib.sha256(a.read_bytes()).hexdigest(),'final_sha256':hashlib.sha256(b.read_bytes()).hexdigest(),'method':'Exported GLB vertex triangles, hierarchy transforms, bounds and signed volume. Edge incidence after1e-7m rounding; not complete solid selfintersection proof.','rows':rows}
(ROOT/'doc/fuel-function-specialist/plunger-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
