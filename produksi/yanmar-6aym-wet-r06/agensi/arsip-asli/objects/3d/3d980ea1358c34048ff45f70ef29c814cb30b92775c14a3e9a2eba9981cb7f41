"""Bind the independent mesh, pose and clearance evidence for one r05 handoff."""
import argparse
import hashlib
import json
from pathlib import Path

cli=argparse.ArgumentParser()
cli.add_argument('evidence',type=Path)
cli.add_argument('--draft-only',action='store_true')
args=cli.parse_args()
folder=args.evidence
qa=Path(__file__).resolve().parent
prod=qa.parent.parent

def read(name):
    return json.loads((folder/name).read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def path(name):
    return (folder/name).resolve().relative_to(qa).as_posix()

combined=read('sweep-comparison.json')
classes=read('sweep-classified.json')
idle=read('running-pivots.json')
run_capture=read('running-sweep-matrices.json')
start_capture=read('starting-sweep-matrices.json')
start=read('starting-pivots.json')
clearance=read('filter-clearance.json')
routing=read('routes-check.json')
intake=read('intake-r05.json')
fine=read('starter-fine-sweep.json') if (folder/'starter-fine-sweep.json').is_file() else None
centers=read('concentric.json') if (folder/'concentric.json').is_file() else None
assets=combined['assets']
assert assets==classes['assets']==routing['assets_sha256']
if fine:
    assert fine['hashes']==assets
if centers:
    assert all(centers['hashes'][k]==v for k,v in assets.items())
assert assets['exterior']==clearance['asset_sha256']==intake['assets_sha256']['exterior']
assert all(digest(prod/'review'/'assets'/(stem+'.glb'))==value for stem,value in assets.items())
assert run_capture['hashes']==start_capture['hashes']
assert all(run_capture['hashes'][stem]==value for stem,value in assets.items())
data_digest=digest(prod/'review/assets/data.json')
runtime_digest=digest(prod/'review/assets/studio.js')
assert run_capture['hashes']['data']==data_digest
matrix_same_as_current_runtime=run_capture['hashes']['studio']==runtime_digest
state_checks={f:(folder/f).is_file() and 'PASS:' in (folder/f).read_text()
              for f in ('viewer-state.log','viewer-operation.log')}
motion_errors=[item for phase in (idle,start) for item in phase['checks'] if item['status']!='PASS']
motion_errors += [i for phase in (idle,start) for i in phase['motion_failures']]
stationary=[item for phase in (idle,start) for item in phase['fixed_examples_moved']]
failed_contacts=[item for item in classes['pairs'] if item['status']=='FAIL']
unclassified=classes['counts']['UNVERIFIED']
route_faults=[
                  key for key,value in routing['routes'].items() if value['missing_render_meshes'] or
                  any((value.get('physical_body_probe') or {}).get(k,[]) for k in ('none_near','near_wall_below_point2_mm'))]
filter_pass=clearance['triangle_crossing_pairs']==0 and clearance['surface_clearance_mm']>0
source_speeds=idle['source_document_pump_speed']
speeds_pass=len(source_speeds)==2 and all(a['within_rounding_to_whole_rpm'] for a in source_speeds)
motion_pass=not motion_errors and not stationary and speeds_pass
family_counts={phase:{k:combined[phase][k] for k in ('parts','static_crossing_pairs','relative_moving_crossing_pairs','narrow_tests')} | {
    'poses':len(combined[phase]['sampled_degrees'])} for phase in ('r04','idle','starter')}
axis_targets={'EXT-COOLING-21','EXT-COOLING-36','INT-OILPUMP-01','EXT-EXHAUST-21',
              'EXT-FUEL-21','EXT-ELECTRIC-40','EXT-ELECTRIC-48','EXT-ELECTRIC-21'}
axis_errors=[row for row in (centers or {}).get('parts',[]) if row['id'] in axis_targets and
             (row.get('missing') or row.get('radial_bounding_midpoint_offset_mm',0)>1)]
status='FAIL' if axis_errors or failed_contacts or not motion_pass or not filter_pass or route_faults else 'UNVERIFIED'
docs={
    'status':status,
    'ready_for_private_review':False,
    'eligible_for_owner_inspection':not args.draft_only,
    'owner_draft_available':not args.draft_only,
    'assets':assets,
    'viewer_pose_capture_hashes':run_capture['hashes'],
    'viewer_pose_runtime_sha_matches_current':matrix_same_as_current_runtime,
    'strict_viewer_harness':state_checks,
    'categories':{
        'owner_air_cleaner_contact':'PASS' if filter_pass else 'FAIL',
        'viewer_motion':'PASS' if motion_pass else 'FAIL',
        'whole_engine_triangle_sweep': 'FAIL' if failed_contacts else 'UNVERIFIED',
        'mechanical_oem_fidelity':'UNVERIFIED',
        'webgl_on_physical_devices':'UNVERIFIED',
        'physical_route_geometry':'FAIL' if route_faults else 'PASS',
    },
    'filter_min_mesh_gap_mm':clearance['surface_clearance_mm'],
    'sampled_mesh_sweeps':family_counts,
    'distinct_pair_classifications':classes['counts'],
    'contact_motion_subtotals':classes['motion_subtotals'],
    'observed_blockers':[{'parts':r['parts'],'reason':r['reason']} for r in failed_contacts],
    'motion_errors':motion_errors,
    'shaft_alignment_flags':axis_errors,
    'stationary_examples_moved':stationary,
    'document_pump_speed_comparison':source_speeds,
    'route_gaps_on_sample':route_faults,
    'evidence':{name:path(name) for name in ('sweep-comparison.json','sweep-classified.json','running-pivots.json',
                'starting-pivots.json','filter-clearance.json','routes-check.json','intake-r05.json',
                'concentric.json','starter-fine-sweep.json','viewer-state.log','viewer-operation.log') if (folder/name).is_file()},
}
(qa/'qa.json').write_text(json.dumps(docs,ensure_ascii=False,indent=2)+'\n')
md=['# Audit independen r05','',
    f"**Status menyeluruh {status}.** Area filter yang dilaporkan {'lulus' if filter_pass else 'gagal'} uji lokal pada pose rakit. Pada r04, filter udara turbo menembus manifold gas buang dengan 741 pasangan segitiga berpotongan. R05 mengukur jarak antarmuka minimum sebesar {clearance['surface_clearance_mm']:.2f} mm pada mesh. Kamera dan pencahayaan sama pada kedua gambar. Jarak fisik pada mesin belum terukur. [Lihat perbandingan](perbandingan-filter.jpg)",'',
    f"Uji ulang Blender mencakup {family_counts['idle']['parts']} mesh. Mode idle disapu dalam {family_counts['idle']['poses']} pose dan starter dalam {family_counts['starter']['poses']} pose. Matriks posisi berasal dari GLTFLoader dan fungsi pose aktual viewer. Uji ini menghitung pasangan segitiga yang berpotongan pada setiap sampel dan melewatkan komponen yang bergerak sebagai satu unit kaku.",'',
    f"Pada gabungan sampel ada {classes['distinct_observed_pairs']} pasangan permukaan berpotongan: {classes['counts']['INTENTIONAL_FIT']} pasangan pemasangan yang telah diklasifikasi, {classes['counts']['FAIL']} cacat terkonfirmasi, dan {unclassified} pasangan belum diputuskan satu per satu. Dari yang belum diputuskan, {classes['motion_subtotals']['relative_moving']['UNVERIFIED']} pasangan mengalami gerak relatif dan {classes['motion_subtotals']['installed_only']['UNVERIFIED']} hanya terdeteksi pada konfigurasi rakit. Jumlah pasangan segitiga tidak menunjukkan kedalaman penetrasi. Deteksi permukaan ini belum membuktikan ketiadaan benturan kontinu atau volume tertanam seluruhnya.",'',
    "Arah crank dilihat dari flywheel, urutan pengapian 1–4–2–6–3–5, dan stroke 180 mm merujuk D01 PDF 13. Arah hubungan gear diperiksa terhadap D01 PDF 112. D01 PDF 163–164 mencantumkan pompa air laut 1.572 rpm dan pompa air tawar 2.533 rpm pada crank 1.900 rpm. Titik pusat, jumlah gigi, clearance, profil gerak dan fase yang belum tersedia pada gambar teknik tetap estimasi; rotasi turbo dan rotor oli memakai laju ilustratif.",
    '',
    f"Uji matriks mengukur {len(idle['checks'])} target rotasi murni dan {len(idle['non_spin_checks'])} target lainnya. Perangkat riil dan WebGL belum terverifikasi karena managed preview gagal membuka relay dan browser tidak dapat diinisialisasi. Film dan uji matriks bukan pengganti pemeriksaan perangkat.",
    '', '## Cacat terkonfirmasi yang tersisa', '']
if fine:
    md[4]+=' Starter juga diperiksa terpisah pada '+str(len(fine['sampled_degrees']))+' pose rapat di 24° awal crank.'
if failed_contacts:
    md.extend(f"- {' dan '.join(row['parts'])}. {row['reason']}" for row in failed_contacts)
else:
    md.append("Tidak ada pada pasangan yang selesai diklasifikasi. Pasangan belum diklasifikasi tetap terbuka.")
md.extend(['', '## Bukti', '', *[f"- [{name}]({file})" for name,file in docs['evidence'].items()], ''])
(qa/'QA.md').write_text('\n'.join(md))
print(json.dumps({'status':status,'filter_clearance_mm':clearance['surface_clearance_mm'],'motion_errors':len(motion_errors),'contacts':classes['counts'],'route_gaps_on_sample':route_faults}))
