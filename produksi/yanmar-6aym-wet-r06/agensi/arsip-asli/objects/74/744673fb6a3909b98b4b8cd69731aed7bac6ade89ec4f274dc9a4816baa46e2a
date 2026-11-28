"""Exact BVH surface contact for specified pairs."""
import json, sys
from pathlib import Path
import bpy
from mathutils.bvhtree import BVHTree

arguments=sys.argv[sys.argv.index('--')+1:]
path=Path(arguments[0])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
bpy.context.view_layer.update()
cache={}
def group(id):
    if id not in cache:
        obj=bpy.data.objects[id]
        obj.data.calc_loop_triangles()
        vs=[obj.matrix_world@v.co for v in obj.data.vertices]
        fs=[tuple(f.vertices) for f in obj.data.loop_triangles]
        cache[id]=(vs,fs,BVHTree.FromPolygons(vs,fs,all_triangles=True))
    return cache[id]
for pair in arguments[1:]:
    ids=pair.split(',')
    va,fa,ta=group(ids[0])
    vb,fb,tb=group(ids[1])
    hits=ta.overlap(tb)
    points=[va[v] for i,j in hits for v in fa[i]]
    bounds=[[min(v[k] for v in points) for k in range(3)],[max(v[k] for v in points) for k in range(3)]] if points else None
    print('QA_PAIR '+json.dumps({'parts':ids,'crossing_pairs':len(hits),'blender_contact_bounds_m':bounds}))
