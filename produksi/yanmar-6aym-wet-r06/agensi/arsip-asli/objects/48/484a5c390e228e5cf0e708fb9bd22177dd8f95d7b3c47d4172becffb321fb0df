"""r03 disconnected delivery-to-holder distances from actual GLB surfaces."""
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

base,out=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
assets={}
for label in ('external','internal'):
    folder='exterior' if label=='external' else label
    glb=base/'model'/folder/f'{folder}.glb'
    bpy.ops.import_scene.gltf(filepath=str(glb.resolve()))
    assets[label]=hashlib.sha256(glb.read_bytes()).hexdigest()
bpy.context.view_layer.update()
objs={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
def geom(name):
    obj=objs[name]
    obj.data.calc_loop_triangles()
    pts=[obj.matrix_world@v.co for v in obj.data.vertices]
    tri=[tuple(p.vertices) for p in obj.data.loop_triangles]
    return pts, BVHTree.FromPolygons(pts,tri,all_triangles=True)
rows=[]
for n in range(1,7):
    pipe=f'EXT-FUEL-{n+2:02d}'
    holder=f'INT-FUELINJ-{10*n+1}'
    p,a=geom(pipe)
    q,b=geom(holder)
    distance=min(min(b.find_nearest(v)[3] for v in p),min(a.find_nearest(v)[3] for v in q))
    rows.append({'pipe':pipe,'injector_holder':holder,'surface_pair_intersections':len(a.overlap(b)),
                 'closest_vertex_surface_proxy_mm':distance*1000})
(out/'baseline-r03.json').write_text(json.dumps({'method':'Minimum of sampled reimported vertices versus opposite mesh surfaces, and BVH triangle overlaps. Positive gaps here mean no contact represented between pressure pipe and holder for sampled supports. Neighboring head geometry may occlude the gap. Not a continuous minimum or a pressure-seal test.', 'assets':assets,'fuel_links':rows},indent=2)+'\n')
