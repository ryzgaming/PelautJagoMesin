"""Build machine-readable results from inspected independent evidence at frozen hashes."""
import hashlib
import json
import math
from pathlib import Path
import sys

root = Path.cwd()
stage = sys.argv[1] if len(sys.argv)>1 else 'round2'
folder = root / 'qa' / stage
sub = f'qa/{stage}'
reimport = json.loads((folder/'reimport.json').read_text())
fit = json.loads((folder/'fit.json').read_text())
plan = json.loads((root/'production-progress.json').read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check(status, reason, *evidence):
    return {'status':status,'reason':reason,'evidence':list(evidence)}

def write(path,data):
    (root / path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

evidence = {}

def assert_asset(path, study):
    if sha(root/path) != study['sha256']:
        raise ValueError(f'Aset berubah sesudah diinspeksi: {path}')

ext, intr = (reimport['assets'][name] for name in ('exterior','internal'))
assert_asset('model/exterior/exterior.glb',ext)
assert_asset('model/internal/internal.glb',intr)
minxyz,maxxyz = reimport['overall_bounds_m']
l,h,w = [(b-a)*1000 for a,b in zip(minxyz,maxxyz)]
housing_face = -135.5
expected_brackets = {'catalog_L':(2000,l), 'catalog_W':(1305,w),
                     'catalog_H_vs_full_AABB_different_endpoints':(1431,h),
                     'GA_flange_y_from_CL':(988.5,maxxyz[1]*1000),
                     'GA_height_flange_to_sump':(1540,h),
                     'H_fig_flange_y_from_CL':(989,maxxyz[1]*1000),
                     'H_estimated_outer_flange_y':(1008,maxxyz[1]*1000),
                     'H_fig_crank_to_sump':(552,-minxyz[1]*1000),
                     'H_fig_mating_to_forward':(1823,maxxyz[0]*1000-housing_face),
                     'H_fig_projected_outer_l_estimated':(1952,l),
                     'H_fig_trial_candidate_upper_body_datum':(879,ext['geometry']['EXT-COOLING-01']['bounds_m'][1][1]*1000),
                     'H_fig_trial_candidate_body_H':(1431,(ext['geometry']['EXT-COOLING-01']['bounds_m'][1][1]-minxyz[1])*1000),
                     'H_fig_cylinder_1_to_6':(1000,reimport['measurements']['c1_to_c6_m']*1000)}
for i,liner in enumerate(reimport['measurements']['liners'],1):
    expected_brackets[f'cylinder_{i}_bore_nominal']=(155,liner['diameter']*1000)
for i,pin in enumerate(reimport['measurements']['pins'].values(),1):
    expected_brackets[f'cylinder_{i}_stroke_from_crankpin_throw']=(180,pin['throw_m']*2000)
measurements = {key:{'source_mm':nom,'model_mm':round(actual,5), 'delta_mm':round(actual-nom,5),
                     'delta_percent':round((actual-nom)*100/nom,5)} for key,(nom,actual) in expected_brackets.items()}
dimension_required = ['catalog_L','catalog_W','H_fig_flange_y_from_CL','H_fig_crank_to_sump','H_fig_mating_to_forward',
                      'H_fig_cylinder_1_to_6',*[key for key in measurements if key.startswith('cylinder_')]]
dimensions_bad = [key for key in dimension_required if abs(measurements[key]['delta_percent'])>1]
holes_f,holes_h = [len(fit['interfaces'][key]['detected_clear_angular_windows'])
                   for key in ('flywheel_drill_circle','housing_drill_circle')]
pad_map = fit['interfaces'].get('mount_clear_openings',{})
mount = [m for holes in pad_map.values() for m in holes if 22.8<=m['diameter_equivalent_mm']<=25.2]
mount_pads = fit['interfaces']['pad_bounds']
collisions = fit['sample_nonzero_counts']
min_valve = min(s['axial_valve_to_highest_crown_m'] for s in fit['samples'])*1000
static_hits = fit['interfaces']['installed_hits']
rear_nose_bad = any(v['block_triangle_pairs'] for k,v in static_hits.items() if k in ('INT-CRANK-08','INT-CRANK-09'))
topology = [i for asset in (ext,intr) for i,g in asset['geometry'].items()
            if g['negative_scale'] or not g['triangles'] or g['degenerate_triangles_below_1e-12_m2']]
map_bad = [asset['asset'] for asset in (ext,intr) if any(asset[k] for k in ('unmanifested_glb_meshes','inventory_missing_glb_mesh','wrong_parent','inventory_missing_sources'))]
mount_doc = ('Jumlah dan diameter 8×Ø24 dipisahkan dari 4×M16 jacking screw. Titik, toleransi dan penempatan '
             'dilihat terhadap GA01 tanpa rating. Pengukuran grid 1 mm melaporkan diameter luas ekuivalen.')
phase = [round(v['phase_degrees']) for v in reimport['measurements']['pins'].values()]
phase_bad = phase != [0,240,120,120,240,0]
r = f'{sub}/reimport.json'
f = f'{sub}/fit.json'
dim_source = 'doc/D03-p-17.png'
ga = 'foto/GA01.jpg'
browser = 'qa/browser-runtime.md'
dia = 'qa/dimensions.json'
checks = {
    'identity': check('PASS','Target edukasi H 555 kW pada 1840 rpm bertumpu D03 cetak 32–33. Model 6 segaris dengan turbo/intercooler dan heat exchanger. Gear YXH240/YXH240L serta peralatan kapal dikecualikan. GA01 tidak mencantumkan rating.',dim_source,ga,r),
    'dimensions': check('FAIL' if dimensions_bad else 'UNVERIFIED',
        f'AABB fisik L×W×H {l:.2f}×{w:.2f}×{h:.2f} mm. Nominal katalog 2000×1305×1431 mm. Datum flange +{maxxyz[1]*1000:.2f} mm dan sump {minxyz[1]*1000:.2f} mm terpisah. Nominal +879 mm terhadap titik badan yang sama belum dipastikan. Kriteria dimensi ekivalen yang melampaui 1%: {dimensions_bad}.',r,dim_source,ga,dia),
    'export': check('FAIL' if topology else 'PASS',
        f'Blender reimport kedua GLB, {ext["mesh_object_count"]}+{intr["mesh_object_count"]} mesh dan {ext["triangles"]+intr["triangles"]} triangle. Geometri bermasalah (mesh kosong/skala negatif/area ≤1e−12 m²): {topology}.',r),
    'interfaces': check('FAIL' if any((rear_nose_bad, holes_f!=12, holes_h!=16, len(mount)!=8)) else 'UNVERIFIED',
        f'Bukannya fitting manufaktur, hasil sampling cakupan mesh: flywheel {holes_f}/12, housing {holes_h}/16 bukaan di PCD 542,9/679,5. Kaki mencatat {len(mount)}/8 bukaan kira-kira Ø24 dan bidang −167 mm. Shaft dan liner sampel: {static_hits}. Ulir, clearance OEM, serta rincian dudukan seri belum diverifikasi.',f,r,ga),
    'inventory': check('FAIL' if map_bad else 'UNVERIFIED',
        f'Pemetaan inventaris ke node dan parent aktual {ext["mesh_object_count"]+intr["mesh_object_count"]} komponen. Status per node dari inventaris eksternal {ext["inventory_status_counts"]}, internal {intr["inventory_status_counts"]}. Semua ada locator; audit kelengkapan rincian katalog OEM tetap terbuka.',r,'model/exterior/inventory.json','model/internal/inventory.json','doc/evidence-doc.json'),
    'kinematics': check('FAIL' if phase_bad else 'UNVERIFIED',
        f'Fase geometris crankpin dari GLB righthanded +X adalah {phase}, konsisten dengan arah CCW dari flywheel dan urutan dokumentasi 1–4–2–6–3–5 pada demonstrasi 4 langkah. Stroke 180 mm dari diameter throw; valve/cam timing, profil dan pengoperasian unit belum diverifikasi.',r,dia,'model/internal/kinematics.json'),
    'collisions': check('FAIL' if collisions or rear_nose_bad else 'UNVERIFIED',
        f'Bidang mesh di {len(fit["samples"])} pose diskret ({len(fit["samples"])//73} silinder × 73). Temuan pasangan dinamis per jumlah pose {collisions}. Gap aksial min katup–titik crown tertinggi {min_valve:.3f} mm pada model. Cakupan pasangan dan interval tercatat; sweep kontinu, tight fit, gear engagement dan seluruh kontak OEM belum diverifikasi.',f),
    'viewer_desktop': check('UNVERIFIED','Preview gagal relay dan CUA gagal inisialisasi. Uji statis/mock belum memvalidasi interaksi desktop WebGL, fallback browser, atau perbandingan Shinko.',browser,'review/index.html','review/tools/state-check.mjs'),
    'viewer_mobile': check('UNVERIFIED','Tangkapan emulasi potret/lanskap dan uji HP nyata belum tersedia. Gestur, aksesibilitas visual dan kinerja ponsel belum diverifikasi.',browser,'review/index.html','review/tools/state-check.mjs'),
}
checks['interfaces']['reason']=checks['interfaces']['reason'].replace('Bukannya fitting manufaktur, hasil sampling cakupan mesh:','Sampling mesh mengukur')
visual = {
  'depan':('P09','PASS','Tampak depan P09 dan proyeksi D03 cocok pada tangki transversal, muka damper dan orientasi exhaust yang terlihat. Pipa bunker/kapal menghalangi bagian bawah P09.'),
  'belakang':('P06','PASS','P06 dan GA memperlihatkan kedua lingkar flywheel/housing, hub, rib casting dan tangki melintang. Foto unit gudang tidak memperlihatkan semua aksesori exhaust terpasang.'),
  'kiri':('P07','PASS','Sisi operasi memperlihatkan manifold panjang, pompa injeksi, dua canister di ujung flywheel, enam tutup inspeksi serta outlet elbow. Ukuran/detil setiap pipa tetap estimasi.'),
  'kanan':('P05','PASS','Siluet sisi non-operasi mengandung turbo, duct besar, dua filter menggantung dan starter mendekati flywheel. Sutra isolasi, bracket, kelistrikan dan jalur kecil belum terukur.'),
  'atas':('GA01','UNVERIFIED','Tampak teknik WET tanpa clutch memperlihatkan susunan enam bonnet, manifold longitudinal, turbo/exhaust di sisi kanan dan rakitan transversal dekat ujung. Foto P09/P10 memperlihatkan sebagian permukaan. Foto ortogonal H dan geometri tersembunyi belum terverifikasi.'),
  'tiga_perempat':('P08','PASS','P08 cocok pada guard miring, panjang intake, sisi pompa, canister dan posisi flywheel. Perbedaan perspektif dan kerangka kayu membatasi penilaian proporsi bawah.'),
}
views = {key:{'status':status,'render':f'{sub}/neutral_{key}.png','reference':f'foto/{photo}.jpg',
              'real_reference_inspected':photo!='GA01','reason':reason} for key,(photo,status,reason) in visual.items()}
findings = []
def finding(id,severity,state,part,source,impact,action,*evidence):
    findings.append({'id':id,'severity':severity,'state':state,'object':part,'source':source,
                     'impact':impact,'action':action,'evidence':list(evidence)})
finding('QA-YAN-01','major','open' if dimensions_bad else 'closed','EXT-COOLING-01, EXT-COOLING-05','D03 17/32–33, GA01',
        'Panjang dan lebar di luar target edukasi pada ekspor pertama.',
        f'Uji ulang hasil reimport memberi L {l:.2f} mm, W {w:.2f} mm. Sisa status tinggi nominal dicatat terpisah.',r,dia)
finding('QA-YAN-02','major','closed','EXT-BLOCK-14–17, EXT-EXHAUST-05','D03 17/33, GA01, P08/P09',
        'Gusset tampak terpisah dan celah sambungan bellows merusak bacaan bentuk sebelum perbaikan.',
        'Perbaikan lokal diperiksa pada render depan, samping dan 3/4.',views['depan']['render'],views['tiga_perempat']['render'])
finding('QA-YAN-03','major','open' if collisions or rear_nose_bad else 'closed','INT-PISTON–INT-LINER, EXT-BLOCK-01–INT-CRANK-08/09','D01 PDF 94, 97–99, 104–106',
        'R01 awal menembus liner pada dua ring C1 dan crankcase di hidung/flange crank.',
        'Ekspor hasil perbaikan diperiksa ulang dengan BVH dalam poses terukur. Cakupan sampling dicatat pada pemeriksaan benturan.',f)
finding('QA-YAN-04','major','open' if holes_f!=12 or holes_h!=16 or len(mount)!=8 else 'closed','EXT-FLYWHEEL-01/02, EXT-BLOCK-14–17','GA01 B3-48660-4450',
        'Hitungan bukaan menentukan pembelajaran antarmuka pemasangan.',
        f'Probe rilis: {holes_f}/12 flywheel, {holes_h}/16 housing, {len(mount)}/8 kaki. Toleransi dan ulir OEM tetap terbuka.',f,ga)
finding('QA-YAN-05','minor','open','Dokumentasi dan batas sumber','D01/D03/GA01, foto dan video',
        'Exact H dari atas, wall thickness, vendor fittings, OEM part list dan validasi dimensi pemasangan belum tercakup.',
        'Tambahkan foto ortogonal dengan identitas unit, parts book exact dan lembar antarmuka resolusi penuh. Video target menunggu frame drain/ports/top dengan varian terverifikasi.',ga,'foto/evidence-foto-top.json','video/evidence-video.json')
finding('QA-YAN-06','minor','open','Studio Gelap','README & WORKSPACE_UI',
        'Kesiapan review viewer tidak memiliki bukti WebGL desktop/HP pada runtime ini.',
        'Uji lewat relay dan CUA yang tersedia kemudian periksa viewport dan perangkat nyata dengan alur acceptance.',browser)
finding('QA-YAN-07','minor','open','Kinematika internal','D01 mesin H, D05 parsial',
        'Timing katup, relasi putaran aksesori, pin phasing dan fit fisik lengkap belum ditetapkan oleh prosedur uji unit.',
        'Pertahankan label demonstrasi. Lengkapi data timing dan cek simulasi penuh saat sumber tersedia.',r,'model/internal/kinematics.json')
if topology:
    finding('QA-YAN-08','major','open',', '.join(topology),'GLB final reimport','Kandidat triangle sub−1e−12 m² atau mesh tidak valid.','Periksa penyebab per mesh dan dampak shading. Ulangi audit setelah fixed.',r)
status = [x['status'] for x in [*checks.values(),*views.values()]]
verdict = 'FAIL' if 'FAIL' in status else 'UNVERIFIED' if 'UNVERIFIED' in status else 'PASS'
role_paths = {
    'documents':['doc/evidence-doc.json','doc/sources.json'], 'photos':['foto/evidence-foto.json','foto/evidence-foto-top.json'],
    'video':['video/evidence-video.json'], 'dimension':['model/datum.json','model/dimension-report.json'],
    'exterior':['model/exterior/exterior.glb','model/exterior/inventory.json'],
    'internals':['model/internal/internal.glb','model/internal/inventory.json'],
    'integrator':['review/index.html','qa/integration-fit.json'], 'qa':[r,f,'qa/acceptance.md']}
for name in ['fuel','lubrication','intake-exhaust','freshwater','seawater']:
    role_paths[name]=[f'model/systems/{name}.json']
roles = [
    {'role':it['role'].replace('_','-'),'agent_id':it['agent_id'],'state':'completed',
        'revision':plan['revision'],'evidence':role_paths[it['role'].replace('_','-')]}
    for it in plan['roles']
]
artifact_paths = sorted(set([*(e for it in [*roles,*checks.values(),*findings] for e in it['evidence']),
    *(e for it in views.values() for e in (it['render'],it['reference'])),
    f'{sub}/render-settings.json',f'{sub}/baseline.json',f'{sub}/neutral_baseline_v8_tiga_perempat.png',
    f'{sub}/neutral_internal.png','qa/inspect_glb.py','qa/fit_glb.py','review/assets/studio.js',
    'review/assets/studio.css','review/assets/data.json','review/assets/exterior.glb','review/assets/internal.glb']))
write(dia,{'source_note':'D03 PDF17 cetak32–33 dan GA01 publik. Saat datum/bidang tidak sepadan, selisih hanya deskriptif. Target 1% terbatas pada kecocokan nominal edukasi.', 'dimensions_mm':measurements,
    'mesh_extrema':reimport['extrema'],'axis_order':'GLB Y-up. AABB ditulis sebagai L X, W Z, H Y.',
    'upper_body_candidate_note':'Permukaan teratas housing cooler depan EXT-COOLING-01 y=865.5 mm dipakai sebagai kandidat pembanding terhadap +879. Filler neck terpisah. Kepastian identitas persis bidang leader UNVERIFIED.'})
report = {'schema_version':1,'revision':plan['revision'],'qa_agent_id':'/root/qa','roles':roles,
        'checks':checks,'views':views,'findings':findings,'verdict':verdict,
        'scope':'Yanmar 6AYM-WET H/555 kW @ 1840 rpm, model pembelajaran engine-only. Audit independen dua putaran reparasi, 6 proyeksi dari GLB netral dan sampel numerik dalam posed meshes. Tiap PASS hanya pada cakupan yang tertulis.',
        'blocking_scope':'Kesiapan gerbang review privat masih ditentukan oleh hasil kategori, temuan terbuka dan checker. Model hanya untuk audit privat dalam kondisi saat ini.',
        'artifacts':[{'path':p,'sha256':sha(root/p)} for p in artifact_paths]}
write('qa/qa.json',report)
write('qa/review.json',report)
print(verdict)
