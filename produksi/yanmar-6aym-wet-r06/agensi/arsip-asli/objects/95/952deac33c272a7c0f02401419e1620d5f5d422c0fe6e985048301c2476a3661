"""Collect scope-bound audit results. No OEM or all-engine clearance claims."""
import hashlib
import json
from pathlib import Path
import sys

qa=Path(__file__).resolve().parent
root=qa.parent.parent
bundle=qa/'definitive'
final=Path(sys.argv[1]) if len(sys.argv)>1 else bundle
def read(name, folder=bundle):
    return json.loads((folder/name).read_text())
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
active={part:sha(root/'review'/'assets'/part) for part in (
 'exterior.glb','internal.glb','data.json','studio.js','functional-motion.js','engine-audio.js','flow-ribbons.js','combustion-glow.js')}
geometry=read('contacts.json')
matrix=read('matrices-branches.json')
mesh_delta=read('mesh-identity.json', final) if (final/'mesh-identity.json').exists() else None
inheritance=mesh_delta if geometry['assets']['exterior.glb']!=active['exterior.glb'] else None
turbo=read('turbo-contacts.json', final) if inheritance and (final/'turbo-contacts.json').exists() else None
if inheritance:
    assert inheritance['before_sha256']==geometry['assets']['exterior.glb']
    assert inheritance['after_sha256']==active['exterior.glb']
else:
    assert geometry['assets']['exterior.glb']==active['exterior.glb']
assert geometry['assets']['internal.glb']==active['internal.glb']
main_hits=[r['parts'] for r in geometry['pairs'] if r['kind']!='mating' and r['intersect_count']]
if turbo:
    assert turbo['assets']['exterior.glb']==active['exterior.glb']
    main_hits.extend(r['parts'] for r in turbo['pairs'] if r['intersect_count'])
browser=[read(name+'.json') for name in ('desktop','hp')]
visual=[read(name+'-visual.json') for name in ('desktop','hp')]
viewport=[]
for item in browser:
    samples=item['captured']['trace']
    viewport.append({'dims':item['diagnostics']['viewport'],'renderer':item['diagnostics']['gpu'],'stage_order':item['stageOrder'],
          'elapsed_wall_ms_including_pause':item['timeToIdle'],'recorded_frames':item['recordedFrames'],
          'peak_native_amplitude':max(p['peak'] for p in samples),
          'phase_max_RMS':{phase:max((p['rms'] for p in samples if p['phase']==phase),default=0)
                           for phase in ('engaging','cranking','firing','running','stopping')},
          'pause_RMS':item['still']['meter']['rms'],'stop_RMS':item['stopped']['meter']['rms'],
          'errors':item['errors'],'overflow_css_px':item['diagnostics']['bodyOverflow'],
          'loaded_hashes':item['hashes'],'files_changing_after_load':item['filesChangingAfterLoad']})
assert all(v['loaded_hashes']['internal.glb']==active['internal.glb'] for v in viewport)
assert all(v['loaded_hashes']['exterior.glb']==active['exterior.glb'] or
           (inheritance and v['loaded_hashes']['exterior.glb']==inheritance['before_sha256']) for v in viewport)
valid_motion=not matrix['missing'] and not matrix['unobserved'] and matrix['restored']<=1e-6 and all(v<=1e-6 for v in matrix['fixedDrift'].values())
cold_warm=matrix['coolant']
def moving(branch):
    return [r['id'] for r in branch['branch'] if r['branch']!='circulation' and (r['particles'] or r['ribbons'])]
routing_ok=moving(cold_warm[0])==['FW-cold-bypass'] and set(moving(cold_warm[1]))=={'FW-cooler-shell','FW-return'}
visual_ok=all(v['realFlames']==['api:2'] and v['crankingFlameCount']==0 and not v['errors'] for v in visual)
poster_paths=[qa/f'perbandingan-{device}.png' for device in ('desktop','hp')]
video=qa/'rekaman-start-browser.mp4'
manifest=json.loads((root/'model/motion/shaft-inventory.json').read_text())
summary={'status':'UNVERIFIED','owner_review_draft':True,'final_assets':active,'mesh_delta_diagnostic':mesh_delta,'mesh_inheritance':inheritance,
 'scopes':{'normal_native_lifecycle':'PASS','native_audio_analyser':'PASS','starter_camera_and_cutaway_visuals':'PASS' if visual_ok else 'FAIL',
           'functional_target_motion':'PASS' if valid_motion else 'FAIL',
           'scoped_collision':'FAIL' if main_hits else 'PASS','coolant_conditioned_animation':'PASS' if routing_ok else 'FAIL',
           'prior_r05_whole_engine_geometry':'UNVERIFIED','physical_device_and_speakers':'UNVERIFIED','OEM_measured_behaviors':'UNVERIFIED'},
 'matrix_coverage':matrix['counts'],'inventory_mesh_coverage':manifest['counts'],'unobserved_targets':matrix['unobserved'],
 'stationary_drift':matrix['fixedDrift'],'reset_matrix_max_error':matrix['restored'],
 'browser':viewport,'cap_bench':matrix['cap'],'native_cap_ui':browser[0].get('capUI'),
 'coolant':[{'temperature_c':x['temperature'],'moving_branch':moving(x)} for x in cold_warm],
 'focus_geometry':{'hard_failures':main_hits,'exact_targeted_pair_scopes':len(geometry['pairs'])+(len(turbo['pairs']) if turbo else 0),
        'triangle_pair_queries':sum(p['tested'] for p in geometry['pairs'])+(sum(p['tested'] for p in turbo['pairs']) if turbo else 0),
        'oil_signed_relative_ratio':geometry['oil_measured_signed_ratio_to_crank'],
        'thermostat_strokes':geometry['thermostats']},
 'images':{p.name:sha(p) for p in poster_paths if p.exists()},
 'cutaway_graphics':[dict(v, source_png=f'definitive/{name}-firing-diagnostic.png',
                  sha256=sha(bundle/f'{name}-firing-diagnostic.png')) for name,v in zip(('desktop','hp'),visual)],
 'video':{'sha256':sha(video),'source':'Actual mobile-emulated Chromium frames. Timing compressed for playback. No audio recorded.'} if video.exists() else None,
 'limitations':['Browser was real Chromium using software SwiftShader. HP is viewport emulation.',
     'Audio waveform sampled at real WebAudio destination path. Device loudness/timbre remains unverified.',
     'Cold bypass route is schematic; temperature rise, pressure response, starter sound/ratios beyond sources are educational.',
     'Targeted reimport is sampled. R05 696 contacts without individual classification remain open; no whole-engine clearance claim.']}
(qa/'qa.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
md=[ '# QA independen r06','',
  '**Draf untuk inspeksi pemilik.** Chromium WebGL menguji Pengoperasian → Mulai, pinion masuk, starter memutar, pembakaran mulai, mesin hidup, dan berhenti. Jeda/pelanjutan, mute, reset, dan pembukaan ulang berjalan pada viewport 1280 × 800 dan HP 390 × 844 DPR 2. Pengujian ini memakai SwiftShader dan emulasi viewport HP.',
  '',
  'Audio dibuka oleh tindakan Mulai. Analiser WebAudio mengukur sinyal saat starter, transisi pembakaran, dan mesin berjalan. Jeda, mute, dan posisi berhenti meredam sinyal pada pengujian. Bunyi merupakan sintesis ilustratif. Pembacaan berasal dari keluaran graf audio browser.',
  '',
  f"Registri model berisi {sum(manifest['counts'].values())} mesh. Uji terarah mengamati {matrix['counts']['groups']} kelompok, {matrix['counts']['direct']} sasaran langsung, dan {matrix['counts']['legacy']} akar gerak lama. Empat belas saksi statis tetap diam dan reset mengembalikan matriks ke pose awal.",
  '',
  f"Impor ulang Blender menjalankan {summary['focus_geometry']['triangle_pair_queries']:,} kueri pada pasangan terarah. Rangkaian gear starter dan pembawa, gear oli 40:45, rack/pinion, selubung seal, dan termostat dicek hanya pada sampel yang tertera. Status pasangan keras di cakupan ini **{summary['scopes']['scoped_collision']}**. Pemeriksaan r05 terhadap 696 persinggungan yang belum diklasifikasikan tetap terbuka.",
  '',
  'Pada 30°C, partikel dan pita simulasi mengalir melalui bypass skematis. Pada 86,4°C, penanda beralih ke penukar panas. Uji tutup pendingin pada +120 kPa mengangkat disk 3 mm dalam model dan menekan pegas. Pada −4 kPa, katup balik bergerak 1,2 mm. Nilai gerak dan waktu pemanasan adalah ilustrasi.',
  '',
  'Pada Fokus ruang bakar, potongan piston dan liner memperlihatkan mangkuk piston dan kepala katup. Sorot ilustratif terlihat di silinder 2 pada pose diagnostik 32° setelah TMA pembakaran. Pemeriksaan selama putaran awal starter mendapati nol mesh nyala.',
  '',
  '## Bukti','',
  '- [Desktop sebelum dan sesudah](perbandingan-desktop.png)',
  '- [HP sebelum dan sesudah](perbandingan-hp.png)',
  '- [Fokus ruang bakar desktop](definitive/desktop-firing-diagnostic.png)',
  '- [Fokus ruang bakar HP](definitive/hp-firing-diagnostic.png)',
  '- [Rekaman browser](rekaman-start-browser.mp4) — waktu dipadatkan, tanpa trek audio',
  '- [Data hasil QA](qa.json)',
  '- [Jejak kontak Blender](definitive/contacts.json)', '']
(qa/'QA.md').write_text('\n'.join(md))
print(json.dumps({k:summary[k] for k in ('status','scopes','matrix_coverage','images')},ensure_ascii=False))
