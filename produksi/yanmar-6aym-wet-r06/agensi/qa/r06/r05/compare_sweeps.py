"""Summarize named hard-interface suspects from exact Blender sweeps."""
import argparse
import json
from pathlib import Path

cli=argparse.ArgumentParser()
cli.add_argument('baseline',type=Path)
cli.add_argument('running',type=Path)
cli.add_argument('starting',type=Path)
cli.add_argument('output',type=Path)
args=cli.parse_args()

def read(path):
    data=json.loads(path.read_text())
    return data, {tuple(part['parts']):part['triangle_pairs'] for part in data['static_pairs']}, {
        tuple(part['parts']):part['by_degree'] for part in data['moving_pairs']}

def stats(target,named):
    data,static,moving=target
    p=tuple(sorted(named))
    hits=moving.get(p,{})
    return {'both_meshes_present': all(i in data['component_ids'] for i in p) if 'component_ids' in data else None, 'at_rest_triangle_pairs':static.get(p,0),'moving_sample_count':len(data['sampled_degrees']),
            'samples_with_surface_crossings':len(hits),'max_moving_triangle_pairs':max(hits.values(),default=0),
            'worst_crank_deg':max(hits,key=hits.get) if hits else None}

groups={
    'air cleaner and exhaust manifold':[('EXT-INTAKE-04','EXT-EXHAUST-01')],
    'cold air elbow interfaces':[('EXT-INTAKE-03','EXT-INTAKE-01'),('EXT-INTAKE-03','EXT-INTAKE-02')],
    'damper and stationary case/guard':[('EXT-FRONT-02','EXT-FRONT-01'),('EXT-FRONT-02','EXT-FRONT-03')],
    'crank and stationary bearing surfaces':[
        ('INT-CRANK-23','INT-MAIN-11'),('INT-CRANK-74','INT-MAIN-71'),
        ('INT-CRANK-23','INT-MAIN-THRUST-2-1'),('INT-CRANK-21','INT-MAIN-THRUST-2-1'),
        ('INT-CRANK-72','INT-MAIN-71'),('EXT-BLOCK-01','INT-CRANK-07')],
    'front gears neighboring sixth crank and piston':[
        ('INT-TIMING-08','INT-CRANK-74'),('INT-TIMING-08','INT-CRANK-72'),
        ('INT-TIMING-10','INT-PISTON-61'),('INT-TIMING-10','INT-PISTON-67')],
    'filters neighboring pumps and seawater gear':[
        ('EXT-FUEL-110','EXT-FUEL-12'),('EXT-FUEL-100','EXT-COOLING-41'),('EXT-FUEL-100','EXT-COOLING-45'),
        ('EXT-FUEL-100','EXT-COOLING-38')],
    'timing moving parts and stationary casting':[
        ('INT-TIMING-02','EXT-BLOCK-01'),('INT-TIMING-07','EXT-BLOCK-01'),('INT-TIMING-04','EXT-BLOCK-01'),
        ('INT-TIMING-05','EXT-BLOCK-01'),('INT-TIMING-07','EXT-OILPAN-01'),('INT-TIMING-08','EXT-FRONT-01')],
    'sw neighboring injection gear':[
        ('INT-TIMING-05','EXT-COOLING-04'),('INT-TIMING-05','EXT-COOLING-45'),
        ('INT-TIMING-05','EXT-COOLING-36')],
    'starter pinion neighboring casing and intended engagement':[
        ('EXT-ELECTRIC-48','EXT-BLOCK-15'),('EXT-ELECTRIC-48','EXT-FLYWHEEL-01'),
        ('EXT-ELECTRIC-48','EXT-FLYWHEEL-20'),('EXT-ELECTRIC-40','EXT-ELECTRIC-43')],
    'gear profiles neighboring members':[
        ('INT-TIMING-01','INT-TIMING-02'),('INT-TIMING-03','INT-TIMING-04'),
        ('INT-TIMING-04','INT-TIMING-05'),('INT-TIMING-05','EXT-COOLING-41'),
        ('INT-TIMING-01','INT-TIMING-07'),('INT-TIMING-08','INT-TIMING-10'),
        ('INT-TIMING-08','EXT-COOLING-26')],
}
old,now_run,now_start=map(read,(args.baseline,args.running,args.starting))
assert now_run[0]['hashes']==now_start[0]['hashes']
report={'baseline_hashes':old[0]['hashes'], 'assets':now_run[0]['hashes']}
for phase,target in [('r04',old),('idle',now_run),('starter',now_start)]:
    d,static,moving=target
    report[phase]={'parts':d['parts'],'sampled_degrees':d['sampled_degrees'],'narrow_tests':d['narrow_phase_tests'],
                   'static_crossing_pairs':len(static),'relative_moving_crossing_pairs':len(moving),
                   'unmatched_component_ids':d['moving_unmatched']}
report['selected_interfaces']={name:[{'parts':parts,'baseline':stats(old,parts),'idle':stats(now_run,parts),
                                    'starter':stats(now_start,parts)} for parts in pairs] for name,pairs in groups.items()}
args.output.write_text(json.dumps(report,indent=2)+'\n')
