"""Reconcile the coverage baseline with nested recipes and physical flow meshes in the current GLBs."""
from pathlib import Path
from collections import defaultdict
import hashlib
import json
import struct

out = Path(__file__).resolve().parent
root = out.parents[1]
read = lambda p: json.loads(p.read_text())
base = read(out/'baseline-r02.json')
objects = base['by_object']
families = base['by_assembly']
systems = base['systems']
live, hashes = set(), {}
for layer in ('exterior','internal'):
    raw=(root/f'model/{layer}/{layer}.glb').read_bytes()
    n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n])
    hashes[layer]=hashlib.sha256(raw).hexdigest()
    for node in doc['nodes']:
        if 'mesh' in node and any(doc['accessors'][part['indices']]['count'] >=3 for part in doc['meshes'][node['mesh']]['primitives']):
            live.add(node['name'])
group_changes = defaultdict(list)
for path in sorted((root/'model/assemblies').glob('*.json')):
    recipe=read(path)
    family=recipe.get('parent_rakitan') or recipe.get('parent_assembly') or recipe.get('parent')
    if not family:
        continue
    if family.startswith('RAK-INT-') and family not in families:
        family = family.removeprefix('RAK-')
    part_entries=[(mesh,item) for item in recipe['bagian'] for mesh in item['object_ids']]
    anchor=recipe['acuan']['object_ids'][0]
    ids=set(x for x,_ in part_entries)
    if not ids <= live or len(ids) < 2 or anchor not in ids or family not in families:
        raise SystemExit(f'{recipe["id"]}: recipe has missing exported meshes or parent')
    label=recipe.get('content_name') or recipe['nama']
    notes=recipe.get('notes') or recipe.get('limits') or 'Bentuk dan dimensi detail mengikuti status bukti tiap komponen.'
    refs=recipe.get('source_refs') or recipe.get('sumber') or []
    row={'status':'PARTIAL','specialist':families[family]['specialist'],'summary':f'{label}: {len(ids)} objek tersedia dalam rakitan.','open':notes,
         'source_refs':refs,'recipe_mesh_ids':sorted(ids),'expected':[{'name':item['nama'],'status':'partial','mesh_ids':[mid],
             'role':item.get('role',item.get('peran')),'evidence_status':item.get('status','UNVERIFIED')} for mid,item in part_entries]}
    families[recipe['id']]=row
    for mid in ids:
        if mid in objects:
            objects[mid]={k:v for k,v in row.items() if k not in ('expected','recipe_mesh_ids')}
    group_changes[family].append((label,ids))
for key,changes in group_changes.items():
    updated=set().union(*(pair[1] for pair in changes))
    rec=families[key]
    added=', '.join(pair[0] for pair in changes)
    # Parent scopes can contain both repaired and unchanged assemblies, so use each
    # unchanged object's specific gap instead of copying a superseded blanket verdict.
    gaps=list(dict.fromkeys(x['open'] for mid,x in objects.items() if mid in rec['recipe_mesh_ids'] and mid not in updated))
    rec.update(summary='Rakitan dengan rincian di revisi ini: '+added+'.',
               open=gaps or ['Rincian geometri, serial dan bagian yang tertutup mengikuti bukti masing-masing rakitan.'])
    rec['baseline_expected_ref']='baseline-r02.json#/by_assembly/'+key+'/expected'
    rec.pop('expected',None)
for entry in systems.values():
    changed=[k for k in entry['assembly_keys'] if k in group_changes]
    if changed:
        entry['summary']='Hubungan fungsional tersedia di skema. Lihat rincian model dan batas bukti pada rakitan '+', '.join(changed)+'.'
flow_path=root/'model/flow/routes.json'
flow_meshes=defaultdict(list)
if flow_path.is_file():
    for route in read(flow_path)['routes']:
        mesh=route.get('mesh') or route.get('mesh_id')
        if not mesh:
            continue
        if mesh not in live:
            raise SystemExit(f'{route["id"]}: missing physical flow mesh {mesh}')
        flow_meshes[mesh].append(route)
for mesh,routes in flow_meshes.items():
    parent='RAK-'+mesh.split('-')[1] if mesh.startswith('EXT-') else 'INT-OILPUMP'
    parent_row=families.get(parent,{})
    refs=list(dict.fromkeys(ref for route in routes for ref in route.get('source_refs',[])))
    names=' / '.join(dict.fromkeys(route['name'] for route in routes))
    objects[mesh]={
        'status':'PARTIAL',
        'specialist':parent_row.get('specialist','Jalur fluida'),
        'summary':names,
        'open':'Jalur 3D dimodelkan untuk pembelajaran. Ukuran lokal dan posisi tersembunyi mengikuti status bukti tiap rute.',
        'source_refs':refs,'flow_route_ids':[route['id'] for route in routes],
    }
    if parent_row:
        mesh_ids=parent_row.setdefault('recipe_mesh_ids',[])
        if mesh not in mesh_ids:
            mesh_ids.append(mesh)
retired={}
if 'EXT-COOLING-07' not in live:
    replacements=['EXT-COOLING-302',*(f'EXT-COOLING-{i}' for i in range(55,61))]
    if not set(replacements)<=live:
        raise SystemExit('Legacy coolant rail replacement IDs are missing')
    retired['EXT-COOLING-07']={
        'replacement_mesh_ids':replacements,
        'summary':'Proxy rail lama digantikan oleh pipa sisi keluar pompa dan enam termostat di dalam rakitan penukar panas.',
    }
    objects.pop('EXT-COOLING-07',None)
    for family in families.values():
        if 'EXT-COOLING-07' in family.get('recipe_mesh_ids',[]):
            family['recipe_mesh_ids'].remove('EXT-COOLING-07')
revision = read(root/'job.json')['revision']
d={'revision':revision,'scope':f'Cakupan objek pada file {revision}. Audit terperinci baseline terdapat di baseline-r02.json. Mesh rakitan dan pipa belum membuktikan akurasi OEM, kelengkapan BOM, atau keberhasilan interaksi browser.','model_sha256':hashes,'by_assembly':families,'by_object':objects,'systems':systems,'physical_flow_mesh_count':len(flow_meshes),'retired_meshes':retired}
(out/'assembly-coverage.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('Updated',sum(map(len,group_changes.values())),'nested scopes and',len(flow_meshes),'flow meshes for',hashes['exterior'])
