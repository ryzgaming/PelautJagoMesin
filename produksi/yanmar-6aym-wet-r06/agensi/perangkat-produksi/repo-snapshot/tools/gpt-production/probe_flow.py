"""Re-import final GLBs and measure routed centerlines in the installed, assembled pose."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def world_point(point):
    return Vector((point[0], -point[2], point[1]))


def gltf_point(vector):
    return [vector.x, vector.z, -vector.y]


def bounds(points):
    return ([min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)])


def overlaps(a, b, margin):
    return all(a[0][i] <= b[1][i] + margin and b[0][i] <= a[1][i] + margin for i in range(3))


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(root):
    routes_path = root / 'model/flow/routes.json'
    routes = json.loads(routes_path.read_text())
    tolerance = routes['registration_tolerance_m']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    models = {}
    for unit in ('exterior', 'internal'):
        path = root / 'model' / unit / (unit + '.glb')
        models[unit] = fingerprint(path)
        bpy.ops.import_scene.gltf(filepath=str(path))
    objects, solids = {}, {}
    for obj in bpy.context.scene.objects:
        identifier = obj.get('id') or obj.get('part_id') or obj.name
        if identifier in objects:
            raise ValueError('Duplicate GLB object identifier ' + identifier)
        objects[identifier] = obj
        if obj.type == 'MESH':
            vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
            mesh_bounds = bounds(vertices)
            tree = BVHTree.FromPolygons(vertices, [list(p.vertices) for p in obj.data.polygons])
            solids[identifier] = mesh_bounds, tree
    result = {'revision': routes['revision'], 'model_sha256': models, 'routes_sha256': fingerprint(routes_path),
              'ports': {}, 'links': {}}
    for key, reg in routes['ports'].items():
        anchor = objects[reg['anchor']]
        ancestor = anchor.parent
        while ancestor is not None and ancestor != objects[reg['owner']]:
            ancestor = ancestor.parent
        if ancestor is None or reg['owner'] not in solids:
            raise ValueError(f'{key}: marker must belong to its installed owner mesh')
        result['ports'][key] = {'world': gltf_point(anchor.matrix_world.translation), 'owner': reg['owner']}
    for key, edge in routes['links'].items():
        if edge.get('status') != 'modeled':
            continue
        collisions, outside = set(), set()
        for span in edge['spans']:
            carrier = span['carrier']
            carrier_box = solids[carrier][0]
            points = [world_point(p) for p in span['points']]
            for i, (a, b) in enumerate(zip(points, points[1:])):
                if any(not overlaps(carrier_box, (p,p), tolerance) for p in (a,b)):
                    outside.add((carrier, i))
                direction = b - a
                length = direction.length
                if length == 0:
                    raise ValueError('Zero-length centerline segment: ' + key)
                direction.normalize()
                # Exclude only numerical contact at segment endpoints. Shells and
                # carrier walls remain in the BVH; a hidden span is probed as installed.
                epsilon = min(1e-6, length / 4)
                line_box = bounds((a,b))
                for name, (box, tree) in solids.items():
                    if overlaps(line_box, box, 0) and tree.ray_cast(
                            a + direction * epsilon, direction, length - 2 * epsilon)[0] is not None:
                        collisions.add((carrier, i, name))
        result['links'][key] = {'crossings': sorted(collisions), 'outside_carrier': sorted(outside)}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    result = probe(args.workspace)
    (args.workspace / 'qa/flow-geometry.json').write_text(json.dumps(result, indent=2) + '\n')
