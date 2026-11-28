"""Bind independent r03 findings to exact review assets."""
import collections, hashlib, json
from pathlib import Path
import sys

base=Path.cwd()
stage=Path(sys.argv[1]) if len(sys.argv)>1 else Path('qa/r03/frozen')
read=lambda p:json.loads((base/p).read_text())
sha=lambda p:hashlib.sha256((base/p).read_bytes()).hexdigest()
f=lambda n: str(stage/n)
nested=read(f('nested-reimport.json'))
r=read(f('reimport.json'))
fit=read(f('fit.json'))
fuel=read(f('fuel-fit.json'))
review=read('review/assets/data.json')
coverage=read('qa/coverage/assembly-coverage.json')
hashes={k:n['sha256'] for k,n in nested['assets'].items()}
for k,h in hashes.items():
    assert h==r['assets'][k]['sha256']==sha(f'model/{k}/{k}.glb')==sha(f'review/assets/{k}.glb')
assert hashes['exterior']==fuel['exterior_sha256']==read(f('r03-render.json'))['asset_sha256']
groups=nested['nested_assemblies']
inject=[v for k,v in groups.items() if k.startswith('RAK-INJECTOR-')]
probes=[x for group in inject for bank in group['nozzle_probe'] for x in bank['samples']]
assert len(inject)==6 and all(x['declared_count']==17 for x in inject)
assert len(probes)==72 and all(p['center_clear'] and all(p['offset_inner_clear']) and all(p['offset_outer_hits']) for p in probes)
assert all(not g['installed_crossings_nonzero'] for g in inject)
assert all(not any(g[k] for k in ('missing','without_mesh','parent_mismatch')) for g in groups.values())
assert all(not any(a[k] for k in ('wrong_parent','unmanifested_glb_meshes','inventory_missing_glb_mesh','inventory_missing_sources')) for a in r['assets'].values())
assert all(not g['degenerate_triangles_below_1e-12_m2'] and g['triangles']>0 and not g['negative_scale']
           for a in r['assets'].values() for g in a['geometry'].values())
assert len(fit['samples'])==438 and not fit['sample_nonzero_counts'] and not fuel['pipe_pair_crossings']
assert all(not any(x.values()) for x in fit['interfaces']['installed_hits'].values())
assert [len(fit['interfaces'][k]['detected_clear_angular_windows']) for k in ('flywheel_drill_circle','housing_drill_circle')]==[12,16]
assert sum(len(v) for v in fit['interfaces']['mount_clear_openings'].values())==8
mock=[f(n) for n in ('owner-row-mock.log','owner-61-section-mock.log','owner-11-exploded-mock.log')]
assert all((base/p).read_text().startswith('PASS: owner row/actions') for p in mock)
cams=[q for q in groups['RAK-INJECTION']['tested_shell_core'] if q['core']=='EXT-FUEL-21']
shell_hits=[q for name,g in groups.items() for q in g['tested_shell_core'] if q['mesh_triangle_crossing_pairs']]
rays=groups['RAK-AIRCOOLER']['through_axial_ray_steps_17mm']
assert not any(x['body_surface'] for x in rays) and any(x['core_surface'] for x in rays)
lo,hi=r['overall_bounds_m']
aabb={k:round(1e3*(hi[j]-lo[j]),4) for k,j in [('L',0),('W',2),('H_fisik',1)]}
limits=[2000,1305]
assert all(abs(aabb[k]-l)<l*.01 for k,l in zip(('L','W'),limits))
family={k:v['status'] for k,v in list(coverage['by_assembly'].items())[:21]}
recipes=sum(bool(x.get('parent')) for x in review['assemblies'].values())
summary={
    'injectors': len(inject),'selectable_per_injector':17,'injector_surface_pair_samples':6*17*16//2,
    'nozzle_holes_probed':len(probes),'mechanical_pose_samples':len(fit['samples']),
    'recipe_count_viewer':recipes,'owner_flows_gltf_mock':len(mock),
    'air_cooler_rays':{'all_axial':len(rays),'clear_of_shell':sum(not x['body_surface'] for x in rays),
                       'intersect_core':sum(x['core_surface'] for x in rays)},
    'mesh_count':{k:v['mesh_object_count'] for k,v in r['assets'].items()}}
n=f('nested-reimport.json')
cover='qa/coverage/assembly-coverage.json'
plates='model/internal/plates/injector-section-exploded.pdf'
def check(status,text,ev):return {'status':status,'scope':text,'evidence':ev}
checks={
    'injector_evidence_and_plates':check('PASS','TP2 source, two annotated plates and a shared 17-function legend. Verified mechanical layout and listed physical specifications against D01 and D05. No verification of operating pressure/lift in the asset.',[plates,'model/internal/evidence/D01-p150.png','model/internal/evidence/D05-fig79.png']),
    'injector_fit_sampled':check('PASS','Six groups and 72 actual holes; bounds probes around nominated axes are not precision metrology.',[n]),
    'owner_flow_logic':check('PASS','Actual GLTFLoader with mock DOM/renderer. Legacy parent row for cooler and injector #1/#6, X-ray, cutaway, explode/reset/repack/back. Direct links #6 section and #1 exploded.',mock),
    'cooler_core_geometry':check('PASS','Clear body/core surface samples; visual tube bundle in assembled X-ray and exploded.',[n,f('r03-xray.png'),f('r03-exploded-xray.png'),'qa/r03/baseline-r02-xray.png']),
    'pump_and_accessory_fit':check('FAIL' if shell_hits else 'PASS','Sampled installed casing/core and Bosch shell/inner pairs. Fit beyond tested pair surfaces remains outside the sample.',[n,f('fuel-fit.json')]),
    'model_geometry_and_parentage':check('PASS','Export reimport and inventory matched. Six neutral external renders and one internal viewed. Assembly envelope retained and 438 discrete poses clear in sampled pairs.',[f('reimport.json'),f('fit.json')]),
    'oem_scope':check('UNVERIFIED','Incomplete BOM and exact per-serial fit, detail dimensions including nominal body-height datum, and continuous physical service motion.',[cover,'doc/cooler-specialist/BOM-Fig37.json',n]),
    'viewer_desktop_mobile':check('UNVERIFIED','Preview relay/CUA failed. Actual WebGL, gestures, device performance and viewport layout are not verified.',['qa/integration-viewer-r03.md'])}
verdict='FAIL' if any(c['status']=='FAIL' for c in checks.values()) else 'UNVERIFIED'
renders=[f('neutral_'+p+'.png') for p in ('depan','belakang','kiri','kanan','atas','tiga_perempat','internal')]
files=set(renders+[p for v in checks.values() for p in v['evidence']]+[f('r03-core-removed.png'),f('r03-render.json'),
       'qa/r03/QA.md','qa/r03/acceptance.md','review/index.html','review/assets/studio.js','review/assets/data.json',
       'model/exterior/exterior.glb','model/internal/internal.glb','model/exterior/inventory.json','model/internal/inventory.json'])
report={'revision':'r03','qa_agent_id':'/root/qa','verdict':verdict,'ready_for_private_review':False,'asset_sha256':hashes,
        'summary':summary,'aabb_mm':aabb,'family_coverage':family,'checks':checks,
        'bosch_cam_shell_sample':cams,'remaining_fit_crossings':shell_hits,'renders_visually_inspected':renders,
        'artifacts':[{'path':p,'sha256':sha(p)} for p in sorted(files)]}
(base/'qa/r03/qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(verdict, json.dumps(summary))
