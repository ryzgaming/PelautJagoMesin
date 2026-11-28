"""Localize exact moving overlap triangles and compare with static axial envelopes."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

root, transform_path, out, *cases = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
for stem in ('exterior','internal'):
    bpy.ops.import_scene.gltf(filepath=str((Path(root)/'model'/stem/f'{stem}.glb').resolve()))
bpy.context.view_layer.update()
frames = {f['degree']:f['moved'] for f in json.loads(Path(transform_path).read_text())['frames']}
basis = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
basis_inverse = basis.inverted()

def box(vs):
    return [[round(min(v[k] for v in vs),6), round(max(v[k] for v in vs),6)] for k in range(3)] if vs else None

report = []
for case in cases:
    a,b,degree=case.split(',')
    changes=frames.get(float(degree), {})
    geo=[]
    for part in (a,b):
        o=bpy.data.objects[part]
        o.data.calc_loop_triangles()
        vertices = [o.matrix_world @ v.co for v in o.data.vertices]
        if part in changes:
            cols=changes[part]
            delta=basis @ Matrix([cols[i::4] for i in range(4)]) @ basis_inverse
            vertices=[delta @ v for v in vertices]
        faces = [tuple(f.vertices) for f in o.data.loop_triangles]
        geo.append((vertices,faces,BVHTree.FromPolygons(vertices,faces,all_triangles=True)))
    hits = geo[0][2].overlap(geo[1][2])
    nearest_mm = min(min(g2[2].find_nearest(v)[3] for v in g1[0]) for g1,g2 in [geo,geo[::-1]])*1000
    report.append({'pair':[a,b], 'nearest_vertex_to_surface_mm':nearest_mm,'angle_deg':float(degree),'triangle_crossings':len(hits),
                   'AABB':[box(g[0]) for g in geo],
                   'contact_triangles_AABB':[box([g[0][v] for ids in hits for v in g[1][ids[k]]]) for k,g in enumerate(geo)]})
Path(out).write_text(json.dumps(report,indent=2)+'\n')
