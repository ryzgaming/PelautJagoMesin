"""Inspect triangle geometry of the frozen r02 delivery, not only inventory entries."""
import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np

root = Path(sys.argv[1])
out = Path(__file__).resolve().parent
models = {}
probes = {}
for layer in ('exterior', 'internal'):
    raw = (root / f'model/{layer}/{layer}.glb').read_bytes()
    n, kind = struct.unpack_from('<II', raw, 12)
    doc = json.loads(raw[20:20+n])
    body = memoryview(raw)[28+n:]
    def accessor(i):
        acc = doc['accessors'][i]
        view = doc['bufferViews'][acc['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}[acc['componentType']]
        cols = {'VEC3': 3, 'SCALAR': 1}[acc['type']]
        dt = np.dtype(dtype)
        shift = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        return np.ndarray((acc['count'], cols), dtype=dt, buffer=body, offset=shift,
                          strides=(view.get('byteStride', cols*dt.itemsize), dt.itemsize))
    rows = {}
    for node in doc['nodes']:
        if 'mesh' not in node:
            continue
        pieces = []
        for prim in doc['meshes'][node['mesh']]['primitives']:
            assert prim.get('mode',4) == 4
            xyz = accessor(prim['attributes']['POSITION'])
            triangles = xyz[accessor(prim['indices']).reshape(-1,3)].astype(float)
            pieces.append(triangles)
        triangles = np.concatenate(pieces)
        low = triangles.min(axis=(0,1))
        high = triangles.max(axis=(0,1))
        name = node['name']
        rows[name] = {'triangles': len(triangles), 'local_size_m': np.round(high-low,5).tolist()}
        if name in ('EXT-INTAKE-02','EXT-COOLING-01','EXT-LUBE-05','EXT-COOLING-03','EXT-COOLING-04'):
            # Along local X sample seven Y/Z lines through the middle of each housing.
            # Intersect y-z projections using barycentric weights; duplicate coplanar hits
            # at a triangle seam collapse to one coordinate.
            t, counts = triangles, []
            for yf,zf in ((.44,.34),(.46,.45),(.49,.54),(.51,.39),(.53,.61),(.57,.56),(.55,.49)):
                q = (low + (high-low)*np.array([0,yf,zf]))[1:]
                p = t[:,0,1:]; u=t[:,1,1:]-p; v=t[:,2,1:]-p; delta=q-p
                det = u[:,0]*v[:,1]-u[:,1]*v[:,0]
                valid = abs(det)>1e-14
                u,v,delta,det,tv = u[valid],v[valid],delta[valid],det[valid],t[valid]
                b=(delta[:,0]*v[:,1]-delta[:,1]*v[:,0])/det
                c=(u[:,0]*delta[:,1]-u[:,1]*delta[:,0])/det
                inside=(b>=0)&(c>=0)&(b+c<=1)
                x=tv[:,0,0]+b*(tv[:,1,0]-tv[:,0,0])+c*(tv[:,2,0]-tv[:,0,0])
                counts.append({'y_z_fraction':[yf,zf],'surfaces_x_m':np.unique(np.round(x[inside],5)).tolist()})
            probes[name]=counts
    ids={r['id'] for r in json.loads((root/f'model/{layer}/inventory.json').read_text())['components']}
    assert set(rows)==ids
    models[layer]={'sha256':hashlib.sha256(raw).hexdigest(),'mesh_nodes':rows}
report={'baseline':'r02','models':models,'local_x_probe':probes,'method':'Actual GLB triangle accessors, exact ID/mesh membership, local axis-aligned node extent; selected housing local-X line intersections are spot checks, not a watertightness or completeness proof.'}
(out/'r02-mesh-audit.json').write_text(json.dumps(report,indent=2)+'\n')
