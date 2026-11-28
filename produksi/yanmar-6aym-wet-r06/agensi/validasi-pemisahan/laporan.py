"""Bind the final delivery audit to the exact tested input hashes."""
from pathlib import Path
from hashlib import sha256
import json
import struct

qa=Path(__file__).resolve().parent
root=qa.parents[1]
def read(path): return json.loads((qa/path).read_text())

archive=read('inventaris.json')
browser=read('browser/ringkasan.json')
fallback=read('browser/fallback.json')
scope=read('batas-runtime.json')
geometry=read('model-identik.json')
assert geometry['identical'] and geometry['registry_total']==geometry['total_mesh_ids']==1184
assert not geometry['not_in_found_registries']
assert archive['r06_archive_paths_and_digests_match_original'] and not archive['archive_errors']
assert not archive['unsafe_symlinks']
assert browser['pass'] and browser['sameFrameFullMatrixIdentity'] and len(browser['results'])==4
screenshots=[]
for row in browser['results']:
    hashes=[f['hash'] for f in row['matrixRows']]
    assert len(set(hashes))==9 and hashes[-1]==hashes[0]
    img=qa/f'browser/{row["ui"]}-{row["name"]}.png'
    width,height=struct.unpack_from('>II',img.read_bytes(),16)
    w,h,_=row['initial']['canvas']['viewport']
    ratio=2 if row['name']=='hp' else 1
    assert (width,height)==(w*ratio,h*ratio)
    screenshots.append({'file':img.relative_to(qa).as_posix(),'pixels':[width,height],'cssViewport':[w,h],'dpr':ratio})
assert [x['ui'] for x in fallback]==['studio','minimal']
assert all(x['inventoryStillUsable'] and x['commandsDisabled'] for x in fallback)
assert all(not scope[key] for key in ('unresolved_relative_references','external_absolute_workspace_tokens',
                                      'active_core_DOM_tokens','minimal_Studio_specific_dependencies'))
assert all(scope['immutable_manifest'].values())
for path,sha in browser['fingerprints'].items():
    assert sha256((root/path).read_bytes()).hexdigest()==sha,f'Active file changed after browser QA: {path}'
source=sum(row['paths'] for row in archive['archive_revision_validation'])
assets=geometry['glbs']
result={
  'pemisahan_paket':'PASS',
  'qa_geometri_keseluruhan':geometry['source_whole_geometry_status'],
  'browser':{'chromium':'156.0.8078.79','playwright':'1.62.1','node':'24.22.3','rendering':'Chromium software WebGL via ANGLE SwiftShader'},
  'captured_viewports':screenshots,
  'browser_scenarios':len(browser['results']),'matrix_samples_per_scenario':len(browser['results'][0]['matrixRows']),
  'model_mesh_ids':geometry['total_mesh_ids'],'same_pose_world_matrices':browser['sameFrameFullMatrixIdentity'],
  'geometry_sha256':{key:value['approved_sha256'] for key,value in assets.items()},
  'exact_active_files_tested':browser['fingerprints'],
  'checked_local_link_count':len(scope['checked_relative_references']),
  'historical_paths_verified':source,
  'r06_archival_paths':next(r['paths'] for r in archive['archive_revision_validation'] if r['revision']=='r06'),
  'generated_caches_excluded_r06':next(r['excluded'] for r in archive['archive_revision_validation'] if r['revision']=='r06'),
  'original_r06_root_unchanged_in_audit':archive['r06_archive_paths_and_digests_match_original'],
  'reports':['model-identik.json','inventaris.json','batas-runtime.json','browser/ringkasan.json','browser/fallback.json'],
  'limits':['Physical phone and speaker fidelity were outside package QA.',
            'All-model geometry was not requalified. The 696 unclassified r05 surface-contact pairs and unverified OEM dimensions remain open.',
            'Historical agent briefs are reconstructed task briefs, not recovered chat transcripts.'],
}
(qa/'hasil.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
lines=['# Audit paket terpisah r06','',
       '**Pemisahan model, UI, dan agensi lulus.** Studio Gelap dan panel ringkas menjalankan modul mesin, inventaris, dan kedua GLB yang sama. Panel ringkas hanya memanggil API sesi. Studio memakai adaptor `workspace` untuk diagram dan panel rakitan yang lebih rinci. Kode inti menerima kontainer kanvas dan tidak mencari kontrol DOM atau mengimpor UI.','',
       f'Kedua GLB identik dengan r06 asli. Seluruh {geometry["total_mesh_ids"]:,} ID mesh cocok dengan registri komponen. Audit menelusuri {source:,} jalur arsip r01–r06 dan mengonfirmasi setiap entri memiliki objek yang benar. Semua 2.314 berkas r06 di luar 79 cache cocok dengan berkas sumber; master Blender, referensi, catatan agensi dan bukti QA ikut tersedia. Arsip membedakan profil asli dari brief tugas yang direkonstruksi.','',
       'Empat uji Chromium WebGL mencakup kedua UI pada 1280 × 800 dan emulasi HP 390 × 844 DPR 2. Tombol aktual menyelesaikan urutan start, jeda, lanjut, stop dan reset. Kedua UI bisa memilih EXT-FUEL-03. Uji kegagalan kedua GLB memperlihatkan pesan galat, menonaktifkan start dan mempertahankan akses inventaris.','',
       'Observer khusus QA mengambil matriks dunia dari 1.184 komponen pada sepuluh sampel waktu yang sama, termasuk reset. Hash matriks sama pada keempat skenario. Observer hanya ditambahkan pada respons modul di browser uji. Semua file aktif yang disimpan tetap sama sebelum dan setelah uji.','',
       'Browser menjalankan paket dari subpath HTTP dengan ANGLE SwiftShader. Pemeriksaan memetakan 35 rujukan HTML dan modul serta tidak menemukan jalur runtime absolut ke workspace pembuat. Perangkat fisik, ukuran OEM dan 696 persinggungan r05 yang belum diklasifikasikan tetap berstatus belum terverifikasi.','',
       '## Bukti','',
       '- [Hasil audit](hasil.json)',
       '- [Studio desktop](browser/studio-desktop.png) dan [HP](browser/studio-hp.png)',
       '- [Panel ringkas desktop](browser/minimal-desktop.png) dan [HP](browser/minimal-hp.png)',
       '- [Snapshot matriks dan status browser](browser/ringkasan.json)',
       '- [Uji tanpa GLB](browser/fallback.json)',
       '- [Pemetaan arsip dan berkas asli](inventaris.json)',
       '- [Batas modul dan jalur](batas-runtime.json)','']
lines=[line.replace('35 rujukan',f'{len(scope["checked_relative_references"])} rujukan') for line in lines]
(qa/'LAPORAN.md').write_text('\n'.join(lines))
print(json.dumps({'status':'PASS','captured_viewports':screenshots,
  'browser_scenarios':len(browser['results']),
                  'matrix_samples_each':result['matrix_samples_per_scenario'],'archive_paths':source},ensure_ascii=False))
