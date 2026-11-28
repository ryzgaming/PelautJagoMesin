"""Write an exterior comparison tied to the imported r05 GLB and its model audit."""
import argparse
from hashlib import sha256
import json
import struct
from pathlib import Path

cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('evidence_dir',type=Path)
args=cli.parse_args()
qa=Path(__file__).resolve().parent
root=qa.parent.parent
evidence=args.evidence_dir.resolve()
def read(path):
    return json.loads(path.read_text())
def rel(path):
    return path.resolve().relative_to(root).as_posix()
asset=root/'model/exterior/exterior.glb'
digest=sha256(asset.read_bytes()).hexdigest()
current=read(evidence/'exterior-static.json')
baseline=read(qa/'static-r04-baseline.json')
assert current['assets_sha256']['exterior']==digest
imported=read(evidence/'reimport.json')
assert imported['assets']['exterior']['sha256']==digest
settings=read(evidence/'render-settings.json')
assert settings['assets']['exterior']==digest
assert (evidence/'enam-sudut.jpg').is_file()
view=read(evidence/'intake-r05.json')
assert view['assets_sha256']['exterior']==digest
gap=read(evidence/'filter-clearance.json')
assert gap['asset_sha256']==digest
sync=read(evidence/'source-sync.json')
recipes=read(evidence/'exterior-recipes.json')
exterior=imported['assets']['exterior']
def mesh_names(glb):
    container=glb.read_bytes()
    json_size=struct.unpack_from('<I',container,12)[0]
    doc=json.loads(container[20:20+json_size])
    return {n['name'] for n in doc['nodes'] if 'mesh' in n}
old_asset=root.parent/'yanmar-6aym-wet-r04/model/exterior/exterior.glb'
assert sha256(old_asset.read_bytes()).hexdigest()==baseline['assets_sha256']['exterior']
prior_ids, present_ids=mesh_names(old_asset),mesh_names(asset)
assert not prior_ids-present_ids
assert not any(exterior[key] for key in ('inventory_missing_glb_mesh','unmanifested_glb_meshes','wrong_parent','inventory_missing_sources'))
assert sync['model_sha256']['exterior']==digest


def hits(report):
    return {frozenset((row['a'],row['b'])):row['surface_pairs'] for row in report['pairs']}
before,after=hits(baseline),hits(current)
pairs=[
    ('EXT-INTAKE-04','EXT-EXHAUST-01'),
    ('EXT-INTAKE-03','EXT-INTAKE-01'),
    ('EXT-INTAKE-03','EXT-INTAKE-02'),
    *(('EXT-INTAKE-01',f'EXT-HEADS-{i:02d}') for i in range(1,7)),
    ('EXT-FRONT-02','EXT-FRONT-01'),
    ('EXT-FRONT-02','EXT-FRONT-03'),
    ('INT-CRANK-07','EXT-BLOCK-01'),
    ('INT-CAM-01','EXT-BLOCK-01'),
    ('INT-TIMING-04','EXT-FLYWHEEL-01'),
    ('EXT-FLYWHEEL-20','EXT-FLYWHEEL-01'),
    ('EXT-ELECTRIC-48','EXT-BLOCK-15'),
    ('EXT-ELECTRIC-40','EXT-FLYWHEEL-01'),
    ('EXT-ELECTRIC-21','EXT-FRONT-01'),
    ('EXT-FUEL-100','EXT-COOLING-41'),
    ('EXT-FUEL-110','EXT-FUEL-12'),
]
old_path=asset.parent/'compare.json'
old=read(old_path)
if old['revision']=='r04':
    (asset.parent/'compare-r04.json').write_text(old_path.read_text())
else:
    old=read(asset.parent/'compare-r04.json')
low,high=imported['overall_bounds_m']
nominal=old['dimensions']
measurements=(1000*(high[0]-low[0]),1000*(high[2]-low[2]),1000*(high[1]-low[1]),1000*(high[1]-low[1]))
dims=[]
for original, measured in zip(nominal,measurements):
    error=(measured/original['nominal_mm']-1)*100
    dims.append(original|{'measured_mm':round(measured,6),'difference_pct':round(error,6),'status':'PASS' if abs(error)<1 else 'FAIL'})
out={
    'revision':'r05',
    'machine_model':old['machine_model'],
    'glb_sha256':digest,
    'r04_baseline_sha256':baseline['assets_sha256']['exterior'],
    'route_sha256':sha256((root/'model/flow/routes.json').read_bytes()).hexdigest(),
    'status':'FAIL' if any(d['status']=='FAIL' for d in dims) else 'UNVERIFIED',
    'dimensions':dims,
    'dimensions_scope':old['dimensions_scope'],
    'exterior_mesh_count':exterior['mesh_object_count'],
    'r04_exterior_mesh_ids_preserved':len(prior_ids),
    'r05_additional_exterior_mesh_ids':len(present_ids-prior_ids),
    'triangles':exterior['triangles'],
    'triangle_area_at_most_1e_minus_12_m2':{k:v['degenerate_triangles_below_1e-12_m2']
        for k,v in exterior['geometry'].items() if v['degenerate_triangles_below_1e-12_m2']},
    'assembled_mesh_pairs_screened':{'r04':baseline['aabb_candidate_pairs'],'r05':current['aabb_candidate_pairs']},
    'assembled_mesh_pairs_with_crossings':{'r04':baseline['surface_crossing_pair_count'],'r05':current['surface_crossing_pair_count']},
    'exterior_nested_recipe_count':recipes['nested_count'],
    'static_target_contacts':[{'parts':pair,'r04':before.get(frozenset(pair),0),'r05':after.get(frozenset(pair),0)} for pair in pairs],
    'static_limit':'Kontak antarpermukaan pada pose rakit. Kontak flange, gasket, sambungan dan perakitan tetap memerlukan klasifikasi. Tidak menguji seluruh siklus gerak.',
    'air_cleaner_exhaust_minimum_mesh_gap_mm':gap['surface_clearance_mm'],
    'air_cleaner_physical_gap_status':'ESTIMATED',
    'before':rel(qa/'intake-r04.png'),
    'after':rel(evidence/'intake-r05.png'),
    'same_camera_estimated_from_reported_view':view['estimated_camera_match'],
    'neutral_multiview':rel(evidence/'enam-sudut.jpg'),
    'neutral_render_settings':rel(evidence/'render-settings.json'),
    'static_report':rel(evidence/'exterior-static.json'),
    'import_report':rel(evidence/'reimport.json'),
    'routing':{'merged_route_count':sync['merged_route_count'],'physical_route_count':sync['physical_route_count'],
               'port_count':sync['port_count'],'report':rel(evidence/'source-sync.json')},
    'known_limits':'Dimensi lokal casting, profil gigi, toleransi, dan jarak fisik menunggu gambar atau pengukuran unit aktual.',
}
old_path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
