"""Measure actual charge-duct seats and open cut sections on reimported Blender geometry."""
import bisect
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root,output=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'model/exterior/exterior.glb'))
def tree(name):
    obj=bpy.data.objects[name]
    obj.data.calc_loop_triangles()
    pts=[obj.matrix_world@v.co for v in obj.data.vertices]
    return BVHTree.FromPolygons(pts,[t.vertices[:] for t in obj.data.loop_triangles if t.area>1e-14],all_triangles=True),pts
route=next(r for r in json.loads((root/'model/flow/routes.json').read_text())['routes'] if r['id']=='hot-air-duct')
def world(p):return Vector((p[0],-p[2],p[1]))
path=[world(p) for p in route['points']]
s=[0]
for a,b in zip(path,path[1:]):s.append(s[-1]+(b-a).length)
def point(d):
    j=min(len(path)-2,max(0,bisect.bisect_right(s,d)-1))
    return path[j].lerp(path[j+1],min(1,max(0,(d-s[j])/(s[j+1]-s[j]))))
scope={'EXT-INTAKE-05',*[f'EXT-INTAKE-{n}' for n in range(50,90)]}
geometry={name:tree(name) for name in scope}
def contact(a,b):
    ta,p=geometry[a]
    tb,q=geometry[b]
    return dict(pair=[a,b],nearest_vertex_surface_mm=round(1000*min(min(tb.find_nearest(k)[3] for k in p),min(ta.find_nearest(k)[3] for k in q)),4),triangle_pairs=len(ta.overlap(tb)))
interfaces=[];hardware=[]
for i,(station,r,j,g) in enumerate([(.301,5,52,54),(.377,50,52,55),(.477,50,53,56),(.553,51,53,57)]):
    rid,jid,gid=(f'EXT-INTAKE-{n:02d}' for n in (r,j,g))
    p=point(station)
    axis=(point(station+.001)-point(station-.001)).normalized()
    n=Vector((0,0,1))
    n=(n-axis*n.dot(axis)).normalized(); v=axis.cross(n)
    radial=[]
    for k in range(16):
        ray=n*math.cos(math.tau*k/16)+v*math.sin(math.tau*k/16)
        distance=geometry[gid][0].ray_cast(p,ray,.13)[3]
        radial.append(round(distance*1000,3) if distance is not None else None)
    interfaces.append(dict(arclength_m=station,gasket=gid,bore_radii_mm=radial,
                           rigid_side=contact(gid,rid),flexible_side=contact(gid,jid)))
    for q in range(4):
        bolt=f'EXT-INTAKE-{58+4*i+q}'
        nut=f'EXT-INTAKE-{74+4*i+q}'
        hardware.append(dict(bolt=bolt,nut=nut,bolt_to_cast_flange=contact(bolt,rid),
                    nut_to_joint_flange=contact(nut,jid)))
scope_ex=set(scope)|{'EXT-EXHAUST-03','EXT-INTAKE-02'}
foreign=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or obj.name in scope_ex:continue
    other,_=tree(obj.name)
    for name in scope:
        pairs=geometry[name][0].overlap(other)
        if pairs:foreign.append(dict(part=name,other=obj.name,triangle_pairs=len(pairs)))
graph=json.loads((root/'model/assemblies/RAK-CHARGEDUCT.json').read_text())
hashes={k:hashlib.sha256((root/path).read_bytes()).hexdigest() for k,path in [
    ('exterior','model/exterior/exterior.glb'),('routes','model/flow/routes.json')]}
output.write_text(json.dumps(dict(assets_sha256=hashes,recipe=graph['id'],children=len(graph['bagian']),interfaces=interfaces,
      fastener_pairs=hardware,unintended_exterior_contacts=foreign,
      method='Blender GLB reimport, 4 independent section planes, 16 radial rays through each gasket, plus triangle overlap and bidirectional nearest-vertex-to-face distance.'),indent=2)+'\n')
