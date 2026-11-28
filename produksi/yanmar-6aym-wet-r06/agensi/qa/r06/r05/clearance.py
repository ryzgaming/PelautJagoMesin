"""Minimum modeled triangle surface clearance between two separated components."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_line_line

p=argparse.ArgumentParser()
p.add_argument('asset',type=Path)
p.add_argument('out',type=Path)
p.add_argument('part_a')
p.add_argument('part_b')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.asset.resolve()))
bpy.context.view_layer.update()

def vertices_and_faces(name):
    object=bpy.data.objects[name]
    object.data.calc_loop_triangles()
    vertices=[object.matrix_world @ v.co for v in object.data.vertices]
    indices=[tuple(t.vertices) for t in object.data.loop_triangles if t.area>1e-12]
    tree=BVHTree.FromPolygons(vertices,indices,all_triangles=True)
    return vertices,indices,tree

av,af,at=vertices_and_faces(args.part_a)
bv,bf,bt=vertices_and_faces(args.part_b)
hits=at.overlap(bt)
minimum=0.0
candidate_triangles=0
if not hits:
    minimum=min(min(bt.find_nearest(v)[3] for v in av),min(at.find_nearest(v)[3] for v in bv))
    for ids in af:
        a=[av[i] for i in ids]
        center=sum(a,a[0]*0)/3
        radius=max((v-center).length for v in a)
        near=bt.find_nearest_range(center,radius+minimum+1e-6)
        for _,_,face_index,_ in near:
            b=[bv[i] for i in bf[face_index]]
            if any(min(v[k] for v in a)-minimum>max(v[k] for v in b) or
                   min(v[k] for v in b)-minimum>max(v[k] for v in a) for k in range(3)):
                continue
            candidate_triangles+=1
            for i,start in enumerate(a):
                end=a[(i+1)%3]
                for j,start_other in enumerate(b):
                    end_other=b[(j+1)%3]
                    points=intersect_line_line(start,end,start_other,end_other)
                    if not points:
                        continue
                    left,right=points
                    if (left-start).dot(left-end)<=1e-12 and (right-start_other).dot(right-end_other)<=1e-12:
                        minimum=min(minimum,(left-right).length)
args.out.write_text(json.dumps({'asset_sha256':hashlib.sha256(args.asset.read_bytes()).hexdigest(),
    'parts':[args.part_a,args.part_b],'triangle_crossing_pairs':len(hits),
    'surface_clearance_mm':minimum*1000,'edge_candidate_triangle_pairs':candidate_triangles,
    'method':'Triangle BVH intersection, both vertex-to-triangle closest distances plus interior segment-to-segment closest distances in radius-pruned candidate triangle pairs. Distance is for imported meshes.'},indent=2)+'\n')
print(f'Minimum mesh gap: {minimum*1000:.4f} mm; intersections: {len(hits)}')
