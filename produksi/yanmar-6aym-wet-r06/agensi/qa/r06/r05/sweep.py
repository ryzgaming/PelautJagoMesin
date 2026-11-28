"""Compare actual Blender-imported triangle surfaces at sampled viewer poses."""
import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

cli = argparse.ArgumentParser()
cli.add_argument('root', type=Path)
cli.add_argument('transforms', type=Path)
cli.add_argument('output', type=Path)
cli.add_argument('--interval', type=float, default=12)
cli.add_argument('--only', default='')
args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
hashes = {}
for stem in ('exterior', 'internal'):
    asset = args.root / 'model' / stem / f'{stem}.glb'
    hashes[stem] = hashlib.sha256(asset.read_bytes()).hexdigest()
    bpy.ops.import_scene.gltf(filepath=str(asset.resolve()))
bpy.context.view_layer.update()
data = json.loads(args.transforms.read_text())
for stem, digest in hashes.items():
    assert data['hashes'][stem] == digest, f'{stem}: Runtime asset differs from mesh being swept'
assert not data['splitComponentTransforms'], 'One component has divergent primitive transforms'
geom = {}
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    obj.data.calc_loop_triangles()
    geom[obj.name] = ([obj.matrix_world @ v.co for v in obj.data.vertices],
                      [tuple(t.vertices) for t in obj.data.loop_triangles])
missing = sorted(set(data['meshes']) ^ geom.keys())
print('UNMATCHED moving IDs:', missing, flush=True)
part_filter = tuple(s for s in args.only.split(',') if s)
basis = Matrix(((1,0,0,0), (0,0,-1,0), (0,1,0,0), (0,0,0,1)))
basis_inverse = basis.inverted()
rest = {}
base_hits = {}
moving_hits = defaultdict(dict)
narrow_phase = 0

def selected(name):
    return not part_filter or name.startswith(part_filter)


def bounds(vertices):
    return tuple((min(v[i] for v in vertices), max(v[i] for v in vertices)) for i in range(3))

def build(vertices, faces):
    return bounds(vertices), BVHTree.FromPolygons(vertices, faces, all_triangles=True)

def world_delta(values):
    rows = [values[i::4] for i in range(4)]
    return basis @ Matrix(rows) @ basis_inverse

def candidate_pairs(current):
    ordered = sorted(current, key=lambda name: current[name][0][0][0])
    for i, a in enumerate(ordered):
        ab = current[a][0]
        for j in range(i + 1, len(ordered)):
            b = ordered[j]
            bb = current[b][0]
            if bb[0][0] > ab[0][1]:
                break
            if not (selected(a) or selected(b)):
                continue
            if all(ab[k][1] >= bb[k][0] and bb[k][1] >= ab[k][0] for k in (1, 2)):
                yield tuple(sorted((a, b)))

for name, (vertices, faces) in geom.items():
    rest[name] = build(vertices, faces)
for a, b in candidate_pairs(rest):
    narrow_phase += 1
    hits = rest[a][1].overlap(rest[b][1])
    if hits:
        base_hits[(a,b)] = len(hits)
print('Rest part pairs:', len(base_hits), 'narrow probes:', narrow_phase, flush=True)

sampled = []
def move_together(a,b):
    if a is None or b is None:
        return a is b
    return max(abs(x-y) for x,y in zip(a,b)) < 1e-8

for frame in data['frames']:
    degree = frame['degree']
    if degree % args.interval > 1e-7:
        continue
    sampled.append(degree)
    changes = frame['moved']
    current = dict(rest)
    for name, values in changes.items():
        if name in geom:
            m = world_delta(values)
            vertices, faces = geom[name]
            current[name] = build([m @ v for v in vertices], faces)
    for a, b in candidate_pairs(current):
        if move_together(changes.get(a),changes.get(b)):
            continue
        narrow_phase += 1
        hits = current[a][1].overlap(current[b][1])
        if hits:
            moving_hits[(a,b)][degree] = len(hits)
    if degree % 120 == 0:
        print('Pose', degree, 'motion pairs', len(moving_hits), flush=True)
report = {'hashes': hashes, 'parts': len(rest), 'component_ids': sorted(rest), 'runtime_hashes': data['hashes'], 'moving_unmatched': missing, 'static_pairs': [
    {'parts': pair, 'triangle_pairs': n} for pair, n in sorted(base_hits.items())],
    'sampled_degrees': sampled, 'narrow_phase_tests': narrow_phase, 'relative_transform_equality_tolerance':1e-8, 'moving_pairs': [
    {'parts': pair, 'static_triangle_pairs': base_hits.get(pair, 0), 'by_degree': hits}
    for pair, hits in sorted(moving_hits.items())]}
args.output.write_text(json.dumps(report, indent=2) + '\n')
