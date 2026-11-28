"""Screen all assembled GLB mesh pairs and report exact surface crossings after AABB pruning."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from collections import defaultdict
from itertools import combinations

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--pair',nargs=2,action='append',default=[])
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
root=args.workspace.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
hashes={}
for layer in ('exterior','internal'):
    asset=root/'model'/layer/(layer+'.glb')
    bpy.ops.import_scene.gltf(filepath=str(asset))
    hashes[layer]=hashlib.sha256(asset.read_bytes()).hexdigest()
bpy.context.view_layer.update()

def xyz(p):
    return [p.x,p.z,-p.y]

objects={obj.name:obj for obj in bpy.context.scene.objects if obj.type=='MESH'}
cache={}
def geo(name):
    if name in cache:
        return cache[name]
    obj=objects[name]
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    obj.data.calc_loop_triangles()
    faces=[tuple(t.vertices) for t in obj.data.loop_triangles if t.area>1e-13]
    assert points and faces,name
    low=Vector([min(v[i] for v in points) for i in range(3)])
    high=Vector([max(v[i] for v in points) for i in range(3)])
    return cache.setdefault(name,(points,faces,low,high,None))

def tree(name):
    p,f,a,b,t=geo(name)
    if t is None:
        t=BVHTree.FromPolygons(p,f,all_triangles=True)
        cache[name]=p,f,a,b,t
    return t

def compare(a,b):
    pairs=tree(a).overlap(tree(b))
    result={'a':a,'b':b,'surface_pairs':len(pairs)}
    if pairs:
        contacts=[]
        for index,name in enumerate((a,b)):
            xyzs,faces,*_=geo(name)
            points=[xyzs[n] for i in {pair[index] for pair in pairs} for n in faces[i]]
            low=[min(p[i] for p in points) for i in range(3)]
            high=[max(p[i] for p in points) for i in range(3)]
            contacts.append([[low[0],low[2],-high[1]],[high[0],high[2],-low[1]]])
        result['glTF_crossing_face_bounds_m']=contacts
    return result

tested=0
hits=[]
if args.pair:
    for a,b in args.pair:
        tested+=1
        hits.append(compare(a,b))
else:
    spans=sorted([(name,*geo(name)[2:4]) for name in objects],key=lambda item:item[1].x)
    for index,(a,lo,hi) in enumerate(spans):
        for b,p,q in spans[index+1:]:
            if p.x>hi.x:
                break
            if any(p[i]>hi[i] or q[i]<lo[i] for i in (1,2)):
                continue
            tested+=1
            row=compare(a,b)
            if row['surface_pairs']:
                hits.append(row)
hits.sort(key=lambda row:-row['surface_pairs'])
args.output.write_text(json.dumps({'assets_sha256':hashes,'mesh_count':len(objects),'aabb_candidate_pairs':tested,
    'surface_crossing_pair_count':sum(bool(r['surface_pairs']) for r in hits),
    'method':'Assembled Blender GLB reimport, world AABB broad phase, triangle BVH overlap. Surface crossings include intended threads, interference fits and overlaps within an educational assembly. Solid penetration and motion are distinct checks.',
    'pairs':hits},indent=2)+'\n')
