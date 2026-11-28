"""Reject stale QA evidence or mechanical regressions in the complete exported meshes."""
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = root/'qa/r05/drivetrain'
def read(path):
    return json.loads(path.read_text())
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    starter = read(folder/'starter-final.json')
    flanks = read(folder/'flank-gap.json')
    housings = read(folder/'enclosures-final.json')
    inventory = read(root/'model/motion/shaft-inventory.json')
    model = read(root/'model/motion/drivetrain.json')
    exterior = digest(root/'model/exterior/exterior.glb')
    internal = digest(root/'model/internal/internal.glb')
    defects = []
    for name,report in [('starter',starter),('flanks',flanks),('enclosures',housings)]:
        if report.get('exterior_sha256') != exterior:
            defects.append(f'{name} was measured on a different exterior GLB')
    if starter.get('internal_sha256') != internal:
        defects.append('starter report internal GLB differs')
    if starter['missing_targets'] or starter['duplicate_targets'] or inventory['pending_meshes']:
        defects.append('motion targets are missing or driven more than once')
    if starter['starter_points'] < 49 or housings['samples'] < 24 or flanks['observed_pose_count'] < 181:
        defects.append('incomplete motion sweep')
    for label in ['starter_pinion_overlaps','pinion_vs_solid_flywheel','carrier_vs_fixed_annulus']:
        if max(starter[label]):
            defects.append(f'{label}: {max(starter[label])} crossing triangle pairs')
    if any(any(pair) for pair in starter['sun_planet_and_internal_ring_overlaps']):
        defects.append('planet/sun or planet/ring interpenetration')
    if any(any(checks.values()) for checks in starter['fork_in_start']):
        defects.append('fork crosses collar, nose, solenoid or coil in START')
    for pair,count in starter['engaged_static_pairs'].items():
        if count and pair != 'EXT-ELECTRIC-45 / EXT-ELECTRIC-49':
            defects.append(f'{pair}: {count} unintended assembled starter intersections')
    # The stationary planetary annulus is pressed into its stationary cast nose.
    # The two corresponding exceptions below bound a compression spring at its seat and
    # a round follower touching its eccentric. Housing interference is always a failure.
    rest_fits = {('EXT-FUEL-212','EXT-FUEL-239'),('EXT-FUEL-238','EXT-FUEL-240')}
    tested = set()
    for row in housings['pairs']:
        pair = row['moving'],row['against']
        tested.add(pair)
        if row['maximum'] and pair not in rest_fits:
            defects.append(f'{pair[0]} / {pair[1]}: max {row["maximum"]} in {row["poses_with_crossing"]} poses')
    required = {('EXT-FUEL-210','EXT-FUEL-12'),('EXT-FUEL-212','EXT-FUEL-12'),
                ('EXT-ELECTRIC-25','EXT-ELECTRIC-24'),('EXT-FRONT-04','EXT-ELECTRIC-25')}
    if not required.issubset(tested):
        defects.append('missing critical whole-assembly pairs')
    if not all(min(gap)>0 for gap in flanks['sampled_minimum_and_maximum_gap_mm'].values()):
        defects.append('starter projected tooth gaps are closed')
    report = dict(
        exterior_sha256=exterior,internal_sha256=internal,
        manifest_sha256=digest(root/'model/motion/drivetrain.json'),
        inventory_sha256=digest(root/'model/motion/shaft-inventory.json'),
        groups=len(model['groups']),components=inventory['counts'],
        tested_enclosure_pairs=len(housings['pairs']),enclosure_poses=housings['samples'],
        starter_tooth_clearance_poses=flanks['observed_pose_count'],
        starter_assembly_poses=starter['starter_points'],selected_drive_regressions=defects,
    )
    (folder/'release.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
    return 1 if defects else 0

if __name__ == '__main__':
    sys.exit(main())
