"""Screen real external pipe mesh intersections across fluid media."""
import collections
import hashlib
import itertools
import json
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree

root,output=map(Path,sys.argv[sys.argv.index('--')+1:])
flow=root/'model/flow/routes.json'
graph=json.loads(flow.read_text())
ports={p['id']:p for p in graph['ports']}
bpy.ops.wm.read_factory_settings(use_empty=True)
paths={k:root/'model'/k/f'{k}.glb' for k in ('exterior','internal')}
for glb in paths.values():bpy.ops.import_scene.gltf(filepath=str(glb.resolve()))
bpy.context.view_layer.update()
assets={o.name:o for o in bpy.context.scene.objects}
routes=collections.defaultdict(list)
for route in graph['routes']:
    if route['kind']!='physical':continue
    ids=route['component_ids']
    tube=route.get('mesh') or route.get('mesh_id')
    if tube not in ids:
        terminals={ports[route[k]].get('component_id') for k in ('from','to')}
        tube=next((x for x in ids if x not in terminals),ids[0])
    routes[tube].append(route)
geometry={}
for id in routes:
    if id not in assets or assets[id].type!='MESH':continue
    obj=assets[id]
    co=[obj.matrix_world@v.co for v in obj.data.vertices]
    obj.data.calc_loop_triangles()
    faces=[tuple(t.vertices) for t in obj.data.loop_triangles if t.area>1e-14]
    tree=BVHTree.FromPolygons(co,faces,all_triangles=True)
    b=[(min(v[i] for v in co),max(v[i] for v in co)) for i in range(3)]
    geometry[id]=(tuple(co),faces,tree,b)

cross=[]
stats=collections.Counter()
for (a,ga),(b,gb) in itertools.combinations(geometry.items(),2):
    m1={r['system'] for r in routes[a]}
    m2={r['system'] for r in routes[b]}
    different=m1.isdisjoint(m2)
    stats['distinct_media_pipe_mesh_pairs' if different else 'same_media_pipe_mesh_pairs']+=1
    if not all(u[0]<=v[1] and v[0]<=u[1] for u,v in zip(ga[3],gb[3])):continue
    stats['pairs_with_overlapping_bbox']+=1
    p=ga[2].overlap(gb[2])
    if p:
        co=ga[0];fs=ga[1]
        points=[co[v] for t in {i for i,j in p} for v in fs[t]]
        region_blender=[(min(v[i] for v in points),max(v[i] for v in points)) for i in range(3)]
        mm=[(a*1000,b*1000) for a,b in region_blender]
        cross.append({'parts':[a,b],'media':[sorted(m1),sorted(m2)],'different_media':different,
                      'overlap_pairs':len(p),'crossing_bounds_mm_glb':[mm[0],mm[2],[-mm[1][1],-mm[1][0]]]})
doc={'hashes':{k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in paths.items()},
     'route_manifest_sha256':hashlib.sha256(flow.read_bytes()).hexdigest(),
     'method':'Actual GLB pipe meshes, AABB broad phase then exact zero-epsilon triangle BVH pair overlap. Representative tube mesh for each physical route. Multiple authored mating pieces may be excluded; occupancy/solid containment is outside this screen. Same-fluid intentional joint surfaces may cross.',
     'counts':stats,'missing_mesh':sorted(routes.keys()-geometry.keys()),
     'representatives':{id:[p['id'] for p in rows] for id,rows in routes.items()},
     'actual_surface_contact':cross}
output.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
