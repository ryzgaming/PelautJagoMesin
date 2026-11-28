"""Verify immutable model assets and IDs against production geometry."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('original',type=Path)
p.add_argument('package',type=Path)
p.add_argument('out',type=Path)
a=p.parse_args()

def glb(path):
    raw=path.read_bytes()
    magic,version,total,length,tag=struct.unpack_from('<4sIIII',raw,0)
    assert magic==b'glTF' and version==2 and total==len(raw) and tag==0x4e4f534a
    data=json.loads(raw[20:20+length])
    names=[n.get('extras',{}).get('id') or n.get('name') for n in data['nodes'] if 'mesh' in n]
    assert len(names)==len(set(names)) and all(names)
    return {'sha256':hashlib.sha256(raw).hexdigest(),'nodes':len(data['nodes']),'mesh_ids':names}
checks={}
ids=set()
for layer in ('exterior','internal'):
    src=a.original/'model'/layer/(layer+'.glb')
    expected=glb(src)
    candidates=[]
    for file in a.package.glob('model/**/'+layer+'.glb'):
        actual=glb(file)
        if actual==expected:
            candidates.append(file.relative_to(a.package).as_posix())
    assert candidates,'Missing byte-identical '+layer+' GLB'
    ids.update(expected['mesh_ids'])
    checks[layer]={'approved_sha256':expected['sha256'],'mesh_ids':expected['mesh_ids'],
                   'nodes':expected['nodes'],'identical_copies':candidates}
known=set()
registry=[]
for file in a.package.glob('model/**/*.json'):
    if file.name not in {'data.json','components.json','model.json'}:
        continue
    dataset=json.loads(file.read_text())
    for row in dataset.get('components',[]) if isinstance(dataset,dict) else []:
        if isinstance(row,dict) and row.get('id'):
            known.add(row['id'])
            registry.append(file.relative_to(a.package).as_posix())
quality=json.loads((a.original/'qa/r06/qa.json').read_text())
assert ids and len(ids)==1184
for f in ('exterior','internal'):
    assert checks[f]['approved_sha256']==quality['final_assets'][f+'.glb']
a.out.write_text(json.dumps({'identical':True,'total_mesh_ids':len(ids),'glbs':checks,
 'registry_paths':sorted(set(registry)),'registry_total':len(known),'not_in_found_registries':sorted(ids-known),
 'source_whole_geometry_status':quality['status']},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'mesh_ids':len(ids),'registry_total':len(known),'glbs':{k:v['identical_copies'] for k,v in checks.items()}}))
