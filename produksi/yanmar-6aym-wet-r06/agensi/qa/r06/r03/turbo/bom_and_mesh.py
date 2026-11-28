"""Verify published diagram IDs against GLB and positions exported from variant Fig. 32."""
import hashlib
import json
from pathlib import Path
import struct
import sys

fixture=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
job=here.parents[2]
fig=json.loads((job/'qa/catalog/figures/32.json').read_text())
recipe=json.loads((fixture/'model/assemblies/RAK-TURBO.json').read_text())
raw=(fixture/'model/exterior/exterior.glb').read_bytes()
length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+length])
nodes={o['name']:o for o in gltf['nodes']}
mapped={}
for item in recipe['bagian']:
    for key in item['object_ids']:
        assert key in nodes and 'mesh' in nodes[key]
        mapped.setdefault(item['nomor_oem'],[]).append(key)
out=[]
for pos in fig['positions']:
    ids=mapped.get(pos['partNo'],[])
    if pos['referenceNo']=='1':
        ids=['RAK-TURBO']
        assert 'RAK-TURBO' in nodes
    assert len(ids)==int(pos['quantity']),(pos,ids)
    out.append({**pos,'model_ids':ids,'geometry_status':'ESTIMATED','basis':'Posisi dan jumlah katalog WET, bentuk dari gambar potongan dan skema, detail geometri serta varian serial belum terukur.'})
result={'source':fig['source'],'fig':32,'serial_matched':False,'glb_sha256':hashlib.sha256(raw).hexdigest(),'positions':out}
(here/'fig32-to-glb.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(len(out),'positions,',sum(len(o['model_ids']) for o in out)-1,'individual nodes and 1 assembly.')
