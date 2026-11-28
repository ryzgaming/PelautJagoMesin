"""Resolve each source circuit edge to the r04 route IDs or a specific coverage gap."""
from pathlib import Path
import json

HERE=Path(__file__).resolve().parent

def build(graph):
    ids={r['id'] for r in graph['routes']}
    mappings={
        'freshwater':[
            'FW-pump FW-pump-cooler','FW-oil-cooler FW-cooler-block','FW-cylinder-jacket FW-wet-exhaust','FW-to-stat',
            'FW-cold-bypass',
            'FW-thermostat FW-cooler-shell','FW-return',
            *['source-only|Limpahan atau pemulihan pada tutup bertekanan. Kondisi transien belum dianimasikan.']*4],
        'seawater':['SW-suction','SW-impeller SW-delivery','SW-air-cooler SW-transfer','SW-front-core'],
        'fuel':[
            'ship-boundary|Tangki dan separator berada di instalasi kapal.','ship-boundary|Rute dimulai di batas masuk mesin.',
            'feed-in','feed-hose filter-fitting','filter-head filter-pump-hose pump-fitting pump-gallery-in',
            ' '.join('pump-element-'+str(i) for i in range(1,7)),
            ' '.join(f'hp-pipe-{i} hp-head-{i}' for i in range(1,7)),
            ' '.join('nozzle-bore-'+str(i) for i in range(1,7)),
            'source-only|Katup kontrol overflow ditunjukkan di skema. Titik tapping pada pompa model belum dikenali.',
            'unresolved|Pipa balik di mesin dan terminasi overflow kapal membutuhkan konfirmasi.',
            'unresolved|Jalur drain terpisah ditunjukkan. Posisi fitting dan kondisi pengaliran belum diketahui.'],
        'intake-exhaust':['air-cleaner','compressor-scroll hot-air-duct','charge-air-core cold-air-elbow air-plenum-entry'],
        'lubrication':[
            'source-only|Volume karter berakhir di saringan pickup. Gerakan permukaan bebas tidak dimodelkan.',
            'LO-pickup','LO-pump LO-to-port LO-cooler-feed','source-only|Cabang safety valve hanya aktif saat relief.',
            'source-only|Drain relief ke karter.','source-only|Filter sentrifugal adalah cabang tersendiri.',
            'source-only|Return dari cabang sentrifugal terpisah.',
            'LO-plate-core LO-cooler-out','LO-filter LO-main-gallery',
            *['source-only|Cabang filter bypass, bergantung tekanan diferensial.']*2,
            *['source-only|Cabang pengaturan tekanan dan drain, bergantung kondisi operasi.']*2,
            *['source-only|Cabang dan tujuan muncul di skema servis. Titik 3D percabangan dan geometri bor belum dipastikan.']*5,
            'LO-turbo-supply LO-turbo-line LO-turbo-bearings',
            'source-only|Distribusi oli ke pompa injeksi terpisah dari solar. Titik pemasangan belum dikenali.',
            *['source-only|Jalur balik gravitasi dari komponen ke karter, tanpa pemetaan 3D terpisah.']*4,
            'LO-turbo-return LO-sump-return','source-only|Return pelumasan pompa injeksi ke karter belum dirutekan.']}
    if 'LO-main-bearing-1' in ids:
        mappings['lubrication'][15]=' '.join(r['id'] for r in graph['routes'] if r['id'].startswith(('LO-gallery-feed-','LO-main-bearing-','LO-main-film-','LO-crankpin-')))
        mappings['lubrication'][22]=' '.join(r['id'] for r in graph['routes'] if r['id'].startswith(('LO-rod-drain-','LO-reservoir-','LO-main-end-')))
    for i in range(1,7):
        mappings['intake-exhaust'] += [
            ' '.join([*(f'air-plenum-{j}' for j in range(1,i)),f'intake-runner-{i}',f'intake-head-{i}a',f'intake-head-{i}b']),
            f'exhaust-head-{i}a exhaust-head-{i}b exhaust-runner-{i} exhaust-plenum-{i}']
    mappings['intake-exhaust'] += ['exhaust-takeoff turbine-scroll','exhaust-elbow exhaust-flange']
    rows=[]
    for family,mapping in mappings.items():
        doc=json.loads((HERE.parent/'systems'/f'{family}.json').read_text())
        if len(doc['edges'])!=len(mapping):raise ValueError(f'Unmapped functional edge: {family}')
        for edge,ref in zip(doc['edges'],mapping):
            if '|' in ref:
                status,note=ref.split('|')
                assoc=[]
            else:
                status='routed'
                note='Setiap ruas menyatakan sendiri tingkat bukti serta apakah bentuk fisik atau skema.'
                assoc=ref.split()
                if invalid:=set(assoc)-ids:raise ValueError('Unknown routes: '+str(invalid))
            rows.append(dict(system=family,source_from=edge['from'],source_to=edge['to'],
                             status=status,route_ids=assoc,note=note,source_refs=edge['source_refs']))
    return {'links':rows,'conditional_outlets':[{'component_id':'EXT-INTAKE-14','id':'aircooler-condensate','basis':'D05 Fig. 37 ref.15, AUTO DRAIN','status':'source-only','note':'Penguras kondensat otomatis di bawah cooler. Outlet terbuka saat katup mengeluarkan cairan dan tidak disimulasikan pada kondisi hangat.'}],'additional_gaps':['D05 Fig. 90 / pipa leak-off berbeda dari delivery dan jalur overflow pompa. Penempatan tiap sambungan leak-off belum terkonfirmasi.']}

if __name__=='__main__':
    rows=build(json.loads((HERE/'routes.json').read_text()))
    (HERE/'source-coverage.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
