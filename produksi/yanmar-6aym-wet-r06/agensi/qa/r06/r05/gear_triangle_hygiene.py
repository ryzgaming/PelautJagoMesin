"""Count degenerate and repeated encoded triangles on the final gear primitives without Blender cleanup."""
import hashlib,json,struct
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[2]
ids={*(f'INT-TIMING-{i:02d}' for i in (1,2,3,4,5,7,8,10)),
     'INT-OILPUMP-03','INT-OILPUMP-04','EXT-COOLING-26','EXT-COOLING-41'}
results={};hashes={}
for layer in ['internal','exterior']:
    raw=(root/'model'/layer/(layer+'.glb')).read_bytes()
    hashes[layer]=hashlib.sha256(raw).hexdigest()
    jsize=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+jsize])
    binary=memoryview(raw)[28+jsize:]
    def decode(i):
        ac=doc['accessors'][i]
        bv=doc['bufferViews'][ac['bufferView']]
        dims={'SCALAR':1,'VEC3':3}[ac['type']]
        scalar=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[ac['componentType']])
        stride=bv.get('byteStride',dims*scalar.itemsize)
        return np.ndarray((ac['count'],dims),dtype=scalar,buffer=binary,
            offset=bv.get('byteOffset',0)+ac.get('byteOffset',0),strides=(stride,scalar.itemsize))
    for node in doc['nodes']:
        key=node.get('name')
        if key not in ids:continue
        pts=[]
        for prim in doc['meshes'][node['mesh']]['primitives']:
            pos=decode(prim['attributes']['POSITION']).astype(np.float64)
            pts.append(pos[decode(prim['indices']).ravel()].reshape(-1,3,3))
        tri=np.concatenate(pts)
        area=.5*np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
        _,loc=np.unique(tri.reshape(-1,3),axis=0,return_inverse=True)
        counts=np.sort(loc.reshape(-1,3),axis=1)
        positive=counts[area>1e-13]
        seen=np.unique(positive,axis=0)
        results[key]=dict(encoded_triangles=len(area),exact_zero_area=int(np.sum(area==0)),area_at_most_1e13_inverse_m2=int(np.sum(area<=1e-13)),
            duplicate_positive_area_position_triplets=len(positive)-len(seen),positive_area_unique_triangles=len(seen))
assert set(results)==ids
report=dict(asset_sha256=hashes,method='Triangles measured directly from encoded position/index accessors. A repeated positive-area triangle means an identical unordered triple of encoded XYZ positions in the same mesh. BVH excludes faces of area ≤1e-13 m².',
            by_gear=results,sum_zero=sum(r['exact_zero_area'] for r in results.values()),
            sum_filtered=sum(r['area_at_most_1e13_inverse_m2'] for r in results.values()),
            sum_duplicate_positive=sum(r['duplicate_positive_area_position_triplets'] for r in results.values()),
            sum_triangles=sum(r['encoded_triangles'] for r in results.values()),
            impact='Any filtered zero/small-area faces have no useful sampled tooth contact surface. The exporter preserved the surrounding gear flanks; clean-up of redundant faces remains a source-mesh improvement. See the tooth sweep, measured outside diameters and flank distances in gear-mesh-release.json.')
(root/'qa/r05/exterior-final/gear-triangle-hygiene.json').write_text(json.dumps(report,indent=2)+'\n')
print('DEGENERATE',report['sum_triangles'],report['sum_zero'],report['sum_filtered'],report['sum_duplicate_positive'])
for k,r in results.items(): print(k,r['area_at_most_1e13_inverse_m2'],r['duplicate_positive_area_position_triplets'])
