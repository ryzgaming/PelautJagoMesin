"""Cross-check Y-up Three.js world matrices and manual direction evidence."""
import argparse
import json
import math
import re
from pathlib import Path

cli = argparse.ArgumentParser()
cli.add_argument('capture', type=Path)
cli.add_argument('out', type=Path)
cli.add_argument('--phase', choices=['running', 'starting'], default='running')
args = cli.parse_args()
data = json.loads(args.capture.read_text())
nodes = {entry['name']: entry for entry in data['pivotData']}
stations={item['id'] for item in (data.get('drivetrain') or {}).get('stationary',[])}
fixed = [r for r in data['tracked'] if r in stations or r.startswith(('EXT-INTAKE-', 'EXT-EXHAUST-01', 'EXT-HEADS-', 'EXT-BLOCK-', 'EXT-OILPAN-')) or re.fullmatch(r'EXT-FUEL-4\d\d',r)]
stationary_routings = [r for r in stations if r not in data['meshes']]
checks = []
direction_by_manual = {
    'INT-TIMING-01': -1, 'INT-TIMING-02': 1, 'INT-TIMING-03': 1,
    'INT-TIMING-04': -1, 'INT-TIMING-05': 1, 'INT-TIMING-06': -1,
    'INT-TIMING-07': 1, 'INT-TIMING-08': -1, 'INT-TIMING-09': 1,
    'INT-TIMING-10': 1, 'EXT-COOLING-26': 1, 'EXT-COOLING-41': -1,
}

def transform(values, point):
    return [sum(values[k*4+i] * point[k] for k in range(3)) + values[12+i] for i in range(3)]

for group in (data.get('drivetrain') or {}).get('groups', []):
    if group.get('kind') != 'spin':
        continue
    ratio = group.get('ratio', 0) if group.get('mode') in (args.phase, 'both', None) else 0
    axis = group.get('axis', [1,0,0])
    axis = [n / math.hypot(*axis) for n in axis]
    pivot = group.get('pivot_m', [0,0,0])
    axial_shift = group.get('mode_offset_m',0) if args.phase=='starting' and group.get('mode')=='starting' else 0
    pivot_shifted = [pivot[i]+axis[i]*axial_shift for i in range(3)]
    engage = group.get('mode_angle_rad',0) if args.phase=='starting' and group.get('mode')=='starting' else 0
    one_crank_degree_rad = ratio*math.pi/180+engage
    for target in group.get('targets', []):
        entry = nodes.get(target)
        if entry is None:
            checks.append({'group': group['id'], 'target': target, 'status': 'UNVERIFIED', 'reason': 'No exact-name pivot record'})
            continue
        matrix = entry['relative']
        skew = [matrix[6]-matrix[9],matrix[8]-matrix[2],matrix[1]-matrix[4]]
        rad = math.atan2(sum(axis[i]*skew[i] for i in range(3))/2, (sum(matrix[i] for i in (0,5,10))-1)/2)
        ratio_error = abs(math.degrees(math.atan2(math.sin(rad-one_crank_degree_rad),math.cos(rad-one_crank_degree_rad))))
        offaxis = math.dist(transform(matrix,[pivot[i]+axis[i] for i in range(3)]),
                            [pivot_shifted[i]+axis[i] for i in range(3)])
        drift = math.dist(transform(matrix,pivot),pivot_shifted)
        expected_sign = direction_by_manual.get(target)
        manual_ok = expected_sign is None or abs(ratio) < 1e-9 or rad * axis[0] * expected_sign > 0
        checks.append({'group': group['id'], 'target': target,
                       'ratio': ratio, 'measured_ratio': math.degrees(rad-engage),
                       'ratio_error': ratio_error, 'pivot_drift_m': drift,
                       'axis_endpoint_drift_m': offaxis, 'manual_sign_consistent': manual_ok,
                       'status': 'PASS' if ratio_error < 1e-6 and drift < 1e-7 and offaxis < 1e-7 and manual_ok else 'FAIL'})

legacy = []
for spec in data['configuration']['rotators']:
    node = nodes.get(spec['node'])
    if node:
        matrix = node['relative']
        ratio = math.degrees(math.atan2(matrix[6], matrix[5]))
        legacy.append({'id':spec['node'], 'declared':spec['factor'], 'measured':ratio})

firing_order = data['configuration']['firing_order']
piston_checks=[]
for i in range(1,7):
    component=f'INT-PISTON-{10*i+1}'
    samples=[(frame['degree'], frame['moved'].get(component,[0]*16)[13]) for frame in data['frames']]
    lift=[value for _,value in samples]
    at_firing=next((value for degree,value in samples if degree==firing_order.index(i)*120), None)
    piston_checks.append({'id':component,'stroke_m':max(lift)-min(lift),
                          'travel_from_TDC_at_firing_m':max(lift)-at_firing if at_firing is not None else None})

result = {'documented_firing_order_matches':firing_order==[1,4,2,6,3,5],
          'pistons':piston_checks, 'revision':data['revision'], 'phase':args.phase, 'checks':checks, 'legacy':legacy,
          'fixed_examples_moved':fixed,'stationary_components_missing':stationary_routings, 'viewer_restoration_matrix_error':data['resetError'],
          'pose_mesh_count':len(data['meshes']), 'moved_mesh_count':len(data['tracked'])}
args.out.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'total':len(checks),'failed':[r for r in checks if r['status']!='PASS'],
                  'fixed_examples_moved':fixed,'reset_error':data['resetError']}))

identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
motion_checks=[]
for group in (data.get('drivetrain') or {}).get('groups', []):
    if group['kind']=='spin':
        continue
    axis=group.get('axis',[1,0,0])
    axis=[n/math.hypot(*axis) for n in axis]
    pivot=group.get('pivot_m',[0,0,0])
    for target in group.get('targets',[]):
        samples=[f['moved'].get(target,identity) for f in data['frames']]
        max_element_change=max(abs(n-i) for m in samples for n,i in zip(m,identity))
        is_active=group['mode'] in ('both',args.phase)
        reason=None
        if target not in data['meshes']:
            reason='MISSING_TARGET'
        elif is_active and max_element_change<1e-9:
            reason='NO_MOTION'
        elif not is_active and max_element_change>=1e-9:
            reason='MOTION_IN_WRONG_PHASE'
        axis_error=None
        if group['kind']=='reciprocate':
            def lateral(m):
                displacement=[a-b for a,b in zip(transform(m,pivot),pivot)]
                along=sum(d*a for d,a in zip(displacement,axis))
                return math.dist(displacement,[a*along for a in axis])
            axis_error=max(map(lateral,samples))
        elif group['kind'] in ('spring','rock'):
            axis_error=max(math.dist(transform(m,pivot),pivot) for m in samples)
        if axis_error is not None and axis_error>1e-7:
            reason='AXIS_OR_ANCHOR_DRIFT'
        motion_checks.append({'group':group['id'], 'target':target,'kind':group['kind'],
                              'max_matrix_element_change':max_element_change,
                              'axis_or_anchor_error_m':axis_error, 'failure':reason})
valves=[]
for cylinder in range(1,7):
    for suffix in (30,37,50,57):
        part=f'INT-VALVE-{100*cylinder+suffix}'
        values=[f['moved'].get(part,identity)[13] for f in data['frames']]
        valves.append({'id':part,'sampled_y_stroke_m':max(values)-min(values),
                       'lateral_drift_m':max(math.hypot(matrix[12],matrix[14]) for frame in data['frames']
                           if (matrix:=frame['moved'].get(part,identity)))})
result['poppet_motion']=valves
source_speed=[]
for target,expected in [('EXT-COOLING-26',2533),('EXT-COOLING-41',1572)]:
    sample=next((item for item in checks if item['target']==target and 'measured_ratio' in item),None)
    if sample:
        rpm=abs(sample['measured_ratio'])*1900
        source_speed.append({'id':target,'document_crank_rpm':1900,'document_rpm':expected,
                             'sampled_equivalent_rpm':rpm,
                             'within_rounding_to_whole_rpm':abs(rpm-expected)<=.5})
result['source_document_pump_speed']=source_speed
result['non_spin_checks']=motion_checks
result['motion_failures']=[r for r in motion_checks if r['failure']]
args.out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'non_spin_count':len(motion_checks), 'non_spin_failures':result['motion_failures']}))
