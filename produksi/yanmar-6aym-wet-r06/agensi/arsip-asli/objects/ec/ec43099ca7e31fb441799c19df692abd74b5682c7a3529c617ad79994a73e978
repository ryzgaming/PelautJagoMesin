"""Compare node transforms and mesh primitive payloads despite GLB offsets changing."""
from hashlib import sha256
from pathlib import Path
import json
import struct
import sys

before,after,out=map(Path,sys.argv[1:])

def inventory(path):
    raw=path.read_bytes()
    json_len,tag=struct.unpack_from('<II',raw,12)
    assert tag==0x4e4f534a
    meta=json.loads(raw[20:20+json_len])
    binbuf=memoryview(raw)[20+json_len+8:]
    accessors=meta['accessors']
    views=meta['bufferViews']
    size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
    def bytes_view(index, offset, row, n, stride=None):
        digest=sha256()
        view=views[index]
        start=view.get('byteOffset',0)+offset
        stride=stride or view.get('byteStride',row)
        if row==stride:
            digest.update(binbuf[start:start+n*row])
        else:
            for j in range(n):
                k=start+j*stride
                digest.update(binbuf[k:k+row])
        return digest.hexdigest()

    def payload(i):
        acc=accessors[i]
        row=size[acc['componentType']]*width[acc['type']]
        n=acc['count']
        dense=bytes_view(acc['bufferView'],acc.get('byteOffset',0),row,n) if 'bufferView' in acc else None
        sparse=None
        if 'sparse' in acc:
            s=acc['sparse']
            indices=s['indices']
            values=s['values']
            sparse=(s['count'],indices['componentType'],
                    bytes_view(indices['bufferView'],indices.get('byteOffset',0),size[indices['componentType']],s['count']),
                    bytes_view(values['bufferView'],values.get('byteOffset',0),row,s['count']))
        return acc['componentType'],acc['type'],n,acc.get('normalized',False),dense,sparse

    nodes=meta['nodes']
    parents={i:node['name'] for node in nodes for i in node.get('children',[])}
    rows={}
    for i,node in enumerate(nodes):
        key=node.get('name',f'node{i}')
        transform={label:node.get(label) for label in ('matrix','translation','rotation','scale')}
        result={'parent':parents.get(i),'transform':transform,'mesh':None}
        if 'mesh' in node:
            m=meta['meshes'][node['mesh']]
            prim=[]
            for g in m['primitives']:
                prim.append({'mode':g.get('mode',4),'indices':payload(g['indices']) if 'indices' in g else None,
                             'attributes':{a:payload(i) for a,i in g['attributes'].items()},
                             'morph_targets':[{a:payload(i) for a,i in target.items()} for target in g.get('targets',[])]})
            result['mesh']={'primitives':prim,'weights':m.get('weights',[])}
        rows[key]=result
    return sha256(raw).hexdigest(),rows

old,older=inventory(before)
new,newer=inventory(after)
distinct=sorted(older.keys()|newer.keys())
result={'before_sha256':old,'after_sha256':new,
        'unchanged_nodes':sum(older.get(k)==newer.get(k) for k in distinct),
        'modified_nodes':[k for k in sorted(older.keys()&newer.keys()) if older[k]!=newer[k]],
        'added_nodes':sorted(newer.keys()-older.keys()),'removed_nodes':sorted(older.keys()-newer.keys()),
        'method':'Compares local scene transform, parent, primitive indices and attributes including morph target payloads.'}
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
