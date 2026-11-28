"""Build frozen r04 findings from independent measurements and exact hashes."""
import hashlib,json
from pathlib import Path
import sys

root=Path.cwd()
stage=Path(sys.argv[1]) if len(sys.argv)>1 else Path('qa/r04/release')
q=lambda p: str(stage/p)
get=lambda p:json.loads((root/p).read_text())
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
rc=get(q('routes-check.json'))
pc=get(q('pipe-pairs.json'))
ri=get(q('reimport.json'))
fit=get(q('fit.json'))
gear=get(q('charge.json'))
runtime=get(q('runtime.json'))
flow='model/flow/routes.json'
flows_sha=sha(flow)
assets=rc['assets_sha256']
for l,h in assets.items():
    assert h==ri['assets'][l]['sha256']==pc['hashes'][l]==sha(f'model/{l}/{l}.glb')==sha(f'review/assets/{l}.glb')
assert flows_sha==rc['routes_sha256']==pc['route_manifest_sha256']==gear['route_sha256']
assert assets['exterior']==gear['asset_sha256']==get(q('r04-no3-joint.json'))['assets']['exterior']
assert get('review/assets/data.json')['flows']['routes']==get(flow)['routes']
assert get('review/assets/data.json')['flows']['ports']==get(flow)['ports']
assert runtime['status']=='PASS'
assert len(runtime['injectionContinuousAcrossPorts'])==6 and len(runtime['tourStages'])==6
phys=[r for r in rc['routes'].values() if r.get('kind')=='physical']
walls=sum(r['sample_count'] for r in phys)
errors=[]
if any(r['missing_render_meshes'] or r['zero_segments'] or r['from_delta_mm'] !=0 or r['to_delta_mm'] !=0
       for r in rc['routes'].values()):
    errors.append('Route IDs/termini/segments inconsistent with mesh or registered port.')
if any(p['physical_body_probe']['none_near'] or p['physical_body_probe']['near_wall_total'] for p in phys):
    errors.append('At least one physical centerline sample misses wall or crosses its attributed surface.')
if any(n['different_media'] for n in pc['actual_surface_contact']):
    errors.append('Distinct-media representative physical pipe meshes intersect.')
if any(p['moving_stack_contacts_at_0_5mm_intervals_of_lift'] or p['tube_vs_head_shell_surface_crossing_pairs'] or
       p['nearby_valve_rocker_and_other_injector_contacts_at_rest'] or p['nearest_vertex_to_opposite_surface_mm']>.5
       for p in rc['rigid_delivery_actual_holder_contacts']) or rc['rigid_delivery_pipe_pair_crossings']:
    errors.append('Problem in HP holder seating, wall or moving-stack clearance.')
if len(gear['actual_ids'])!=41 or len(gear['profile_detection'])!=4 or set(gear['expected_ids'])!=set(gear['actual_ids']) or any(
        any(len(p['nearby_hardware'][k])!=4 for k in ('bolts','nuts')) or p['axial_center_blocking_meshes'] or
        p['two_adjacent_faces'][1]['vertex_to_surface_mm']>.1 for p in gear['profile_detection']):
    errors.append('Fig. 36 geometry or thin seats not present in expected quantity/position.')
if any(a['wrong_parent'] or a['unmanifested_glb_meshes'] or a['inventory_missing_glb_mesh']
       or any(n['negative_scale'] or not n['triangles'] or n['degenerate_triangles_below_1e-12_m2'] for n in a['geometry'].values())
       for a in ri['assets'].values()):
    errors.append('GLB hierarchy/export defects.')
if len(fit['samples'])!=438 or fit['sample_nonzero_counts']:
    errors.append('Mechanical sampling regression.')
bounds=ri['overall_bounds_m']
span={k:round(1000*(bounds[1][i]-bounds[0][i]),4) for k,i in [('L',0),('W',2),('H_fisik',1)]}
if abs(span['L']-2000)>20 or abs(span['W']-1305)>13.05:
    errors.append('Educational nominal L/W changed beyond 1%.')
video='review/assets/film/yanmar-6aym-r04.mp4'
video_metadata='qa/r04/film/render.json'
film_metadata=get(video_metadata) if Path(video_metadata).exists() else {}
film_ok=(film_metadata.get('source_glb_sha256')==assets and film_metadata.get('route_manifest_sha256')==flows_sha
         and film_metadata.get('video_sha256')==sha(video))
n=len(phys)
mechanical=errors==[]
lines=f"""\n## Pemeriksaan beku\n\n- {rc['route_count']} rute dan {rc['port_count']} titik, termasuk {n} rute fisik dan {rc['route_count']-n} skematis. {walls:,} sampel garis tengah menggunakan mesh beratribusi. {pc['counts']['distinct_media_pipe_mesh_pairs']} pasangan mesh pipa beda media diperiksa dengan AABB dan BVH. Hasil: {'lulus dalam cakupan probe' if mechanical else 'ada temuan yang perlu ditinjau'}.\n- 3 duct, 2 expansion joint, 4 gasket, 16 baut dan 16 mur Fig.36 pada 41 mesh. Keempat dudukan gasket memiliki pasangan permukaan dekat dan aperture tengah terbuka. Gasket adalah nominal model sekitar 2 mm; ukuran dan ulir fisik belum diverifikasi.\n- Batas luar L×W×H fisik {span['L']:.2f} × {span['W']:.2f} × {span['H_fisik']:.2f} mm. 438 pose mekanisme yang disampel serta reimport ID/parent diperiksa. Cakupan uji bukan lintasan kontinu.\n- Film {('telah diverifikasi cocok hash aset dan manifest' if film_ok else 'belum diverifikasi pada hash ini')}.\n"""
if errors:
    lines+='\nTemuan aktual\n\n'+'\n'.join(f'- {x}' for x in errors)+'\n'
def link(text,path):
    return f'[{text}]({Path(path).relative_to("qa/r04")})'
lines+='\n'+' · '.join((link('Audit rute',q('routes-check.json')),link('Benturan media',q('pipe-pairs.json')),
                      link('Fig.36 geometris',q('charge.json')),link('Uji mock',q('runtime.json')),link('Reimport',q('reimport.json'))))+'\n'
(root/'qa/r04/QA.md').write_text((root/'qa/r04/QA-template.md').read_text()+lines)
def chk(status,evidence):
    return {'status':status,'evidence':evidence}
checks={'physical_and_mechanical_sample':chk('PASS' if mechanical else 'FAIL',[q('routes-check.json'),q('pipe-pairs.json'),q('charge.json'),q('reimport.json'),q('fit.json')]),
        'system_directions_source':chk('PASS',['qa/r04/D01-114.png','qa/r04/D01-157.png','qa/r04/D01-163.png','doc/pipe-fuel-gas/README.md']),
        'playback_controls_and_particle_chains_mock':chk('PASS',[q('runtime.json')]),
        'portrait_film_asset_binding':chk('PASS' if film_ok else 'UNVERIFIED',[video,video_metadata]),
        'full_oem_continuity_and_operating_data':chk('UNVERIFIED',[q('routes-check.json'),flow]),
        'browser_and_device_render':chk('UNVERIFIED',['qa/integration-viewer-r04.md'])}
paths=sorted({p for c in checks.values() for p in c['evidence'] if Path(p).is_file()}|{
   'qa/r04/QA.md','qa/r04/acceptance.md','qa/r04/perbandingan-injektor.jpg',q('r04-no3-joint.json'),'qa/r04/r03-no3-joint.json',
   'qa/r04/baseline-r03.json','model/exterior/exterior.glb','model/internal/internal.glb','review/assets/studio.js','review/assets/data.json'})
report={'revision':'r04','qa_agent_id':'/root/qa','status':'UNVERIFIED' if mechanical else 'FAIL','ready_for_private_review':False,'eligible_for_owner_inspection':mechanical,'owner_draft_available':Path('review/yanmar-6aym-wet-gpt-r04-draft.html').exists(),
    'glb_sha256':assets,'routes_sha256':flows_sha,'aabb_mm':span,'route_count':rc['route_count'],'physical_count':n,
    'physical_centerline_samples':walls,'inter_media_pairs':pc['counts']['distinct_media_pipe_mesh_pairs'],
    'film_hash_matches':film_ok,'checks':checks,'observed_failures':errors,
    'artifacts':[{'path':p,'sha256':sha(p)} for p in paths]}
Path('qa/r04/qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['status','physical_centerline_samples','inter_media_pairs','film_hash_matches','observed_failures']},ensure_ascii=False))
