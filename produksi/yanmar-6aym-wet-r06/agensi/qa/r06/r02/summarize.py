import hashlib
import json
from pathlib import Path

root=Path.cwd()
qa=root/'qa/r02'
read=lambda p:json.loads((root/p).read_text())
sha=lambda path:hashlib.sha256((root/path).read_bytes()).hexdigest()
ri='qa/r02/final/reimport.json'
fi='qa/r02/final/fuel-fit.json'
si='qa/r02/final/fit.json'
oi='qa/r02/final/ga-overlay.json'
ci='qa/photo-match/r02-cameras.json'
bi='qa/integration-viewer.md'
r,f,s=map(read,(ri,fi,si))
ext,intl=(r['assets'][name]['sha256'] for name in ('exterior','internal'))
assert ext==f['exterior_sha256']==read(oi)['asset_sha256']==read(ci)['sha256']
for label,expected in [('exterior',ext),('internal',intl)]:
    assert sha(f'model/{label}/{label}.glb')==sha(f'review/assets/{label}.glb')==expected
assert [f[k] for k in ('fitting_count','pipe_count','paired_filter_count')]==[6,6,2]
assert not f['pipe_pair_crossings']
assert not s['sample_nonzero_counts'] and len(s['samples'])==438
assert all(not any(v.values()) for v in s['interfaces']['installed_hits'].values())
assert [len(s['interfaces'][k]['detected_clear_angular_windows']) for k in ('flywheel_drill_circle','housing_drill_circle')]==[12,16]
assert sum(len(row) for row in s['interfaces']['mount_clear_openings'].values())==8
assert not any(v for a in r['assets'].values() for k,v in a.items() if k in (
    'inventory_missing_sources','unmanifested_glb_meshes','inventory_missing_glb_mesh','wrong_parent'))
assert not any(g['negative_scale'] or not g['triangles'] or g['degenerate_triangles_below_1e-12_m2']
               for a in r['assets'].values() for g in a['geometry'].values())
lo,hi=r['overall_bounds_m']
aabb={k:round(1e3*(hi[j]-lo[j]),4) for k,j in [('L',0),('W',2),('H_fisik',1)]}
assert abs(aabb['L']-2000)<=20 and abs(aabb['W']-1305)<=13.05
pc=['qa/photo-match/P07-comparison.jpg','qa/photo-match/P08-comparison.jpg','foto/P14.jpg',ci]
gc=[oi,'qa/r02/final/ga-overlay-depan.png','qa/r02/final/ga-overlay-kanan.png']
def check(status,scope,evidence):
    return {'status':status,'scope':scope,'evidence':evidence}
checks={
 'identity':check('PASS','H 555 kW 1840 rpm engine-only, 6 silinder segaris.',[ri,'doc/D03-p-17.png']),
 'photo_landmarks':check('PASS','Visual P07/P08/P14 mendukung posisi dan relief rumah pompa, governor, baris fitting dan pasangan tabung. Detail tersembunyi tetap perkiraan.',pc),
 'fuel_mesh':check('PASS','6 fitting, 6 pipa, 2 tabung. 15 pasang pipa tanpa crossing BVH dan setiap pipa masuk head model yang dimaksud.',[fi]),
 'export_mapping':check('PASS','589 node cocok dengan parent inventaris. 545687 triangle, nol degenerasi pada ambang 1e−12 m².',[ri]),
 'sample_fit':check('PASS','438 pose, 6×73 per 10°. Nol crossing pada pasangan yang diuji. Probe 12/16 bukaan flywheel/housing serta 8 kaki.',[si]),
 'nominal_lw_flange':check('PASS','Dimensi L/W dalam 1% nominal dan datum flange +989 mm, sump −552 mm.',[ri,*gc]),
 'nominal_body_height':check('UNVERIFIED','Padanan bidang +879 untuk tinggi nominal 1431 mm belum dipastikan. AABB fisik mencakup flange.',[ri,*gc]),
 'oem_detail_and_photo_top':check('UNVERIFIED','GA tidak menyebut rating. Foto atas H ortogonal, casting rinci, rute tertutup, parts list dan toleransi belum lengkap.',gc+pc+['foto/evidence-foto-top.json','video/evidence-video.json']),
 'mechanics_full_scope':check('UNVERIFIED','Timing fisik dan fit kontinu/seluruh pasangan belum tersampel.',[si,'model/internal/kinematics.json']),
 'viewer_desktop':check('UNVERIFIED','Mock GLTFLoader lulus. Relay dan CUA gagal, WebGL, layout dan fallback browser aktual belum diuji.',[bi]),
 'viewer_mobile':check('UNVERIFIED','Portrait/landscape browser, gestur dan performa HP nyata belum diuji.',[bi]),
}
findings=[
 {'id':'R02-QA-01','state':'closed','issue':'Persilangan dua pasangan pipa pada ekspor awal.',
  'initial_triangle_pairs':[62,42],'final_triangle_pairs':[0,0],'evidence':['qa/r02/initial-fuel/fuel-fit.json',fi]},
 {'id':'R02-QA-02','state':'open','issue':'Padanan bidang tinggi nominal, exact OEM, foto atas ortogonal H, rute tertutup dan video target.','evidence':gc+pc},
 {'id':'R02-QA-03','state':'open','issue':'Timing dan clearance mekanis penuh di luar 438 pose diskret.','evidence':[si]},
 {'id':'R02-QA-04','state':'open','issue':'Akses browser aktual dan HP gagal pada relay/CUA.','evidence':[bi]},
]
render_names=['depan','belakang','kiri','kanan','atas','tiga_perempat','internal']
renders=[f'qa/r02/final/neutral_{n}.png' for n in render_names]
paths=sorted(set([p for a in [*checks.values(),*findings] for p in a['evidence']]+renders+[
    'qa/r02/acceptance.md','qa/r02/QA.md','qa/r02/final/render-settings.json','model/exterior/exterior.glb',
    'model/internal/internal.glb','review/index.html','review/assets/exterior.glb','review/assets/internal.glb']))
status={'revision':'r02','qa_agent_id':'/root/qa','verdict':'UNVERIFIED','ready_for_private_review':False,
        'scope':'6AYM-WET H engine-only, perbaikan sisi operasi, pemeriksaan reimport dan regresi mekanis dasar.',
        'aabb_mm':aabb,'nominal_catalogue_h_mm':1431,'physical_flange_y_mm':989,'sump_y_mm':-552,
        'assets_sha256':{'exterior':ext,'internal':intl},'checks':checks,'findings':findings,
        'neutral_renders_visually_inspected':renders,
        'artifacts':[{'path':p,'sha256':sha(p)} for p in paths]}
(qa/'qa.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
print('r02 scope UNVERIFIED. Hash evidence consistent.')
