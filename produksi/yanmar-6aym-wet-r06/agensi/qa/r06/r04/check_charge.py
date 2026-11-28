"""Fig.36 inspection: identities, four actual axial seats, aperture and fastener geometry."""
import hashlib,itertools,json,math,sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root,out=map(Path,sys.argv[sys.argv.index('--')+1:])
a=root/'model/exterior/exterior.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.resolve()))
bpy.context.view_layer.update()
objs={o.name:o for o in bpy.context.scene.objects}
A=lambda n:f'EXT-INTAKE-{n:02d}'
data={}
def world(x):
    return Vector((x[0],-x[2],x[1]))
def bbox(points):
    return [(min(x[k] for x in points),max(x[k] for x in points)) for k in range(3)]
def centroid(points):
    return sum(points,Vector())/len(points)
for n in [5,*range(50,90)]:
    ob=objs.get(A(n))
    if not ob:continue
    assert ob.type=='MESH'
    ob.data.calc_loop_triangles()
    verts=[ob.matrix_world@v.co for v in ob.data.vertices]
    tris=[tuple(p.vertices) for p in ob.data.loop_triangles]
    data[n]={'obj':ob,'p':verts,'b':bbox(verts),'triangles':len(tris),
             'bvh':BVHTree.FromPolygons(verts,tris,all_triangles=True),'center':centroid(verts)}
flow=root/'model/flow/routes.json'
route=next(r for r in json.loads(flow.read_text())['routes'] if r['id']=='hot-air-duct')
points=list(map(world,route['points']))
section=[]
stations=[]
primary=[5,50,51,52,53]
gaskets=[54,55,56,57]
for no in gaskets:
    if no not in data:continue
    g=data[no]
    # Find actual gasket bounding midpoint and nearest polyline segment to recover
    # centerline registration independently of authored arclength metadata.
    origin=Vector([(lo+hi)/2 for lo,hi in g['b']])
    candidates=[]
    along=0
    for s,t in zip(points,points[1:]):
        d=t-s
        if d.length==0:continue
        mu=max(0,min(1,(origin-s).dot(d)/d.length_squared))
        src=s.lerp(t,mu)
        candidates.append(((origin-src).length,src,d.normalized(),along+mu*d.length))
        along+=d.length
    dist,src,axis,distance=min(candidates,key=lambda x:x[0])
    near=[]
    for n in primary:
        if n not in data:continue
        b=data[n]
        fit=min(b['bvh'].find_nearest(p)[3] for p in g['p'])*1000
        near.append({'part':A(n),'vertex_to_surface_mm':fit,
                     'overlap_pairs':len(g['bvh'].overlap(b['bvh']))})
    near.sort(key=lambda x:x['vertex_to_surface_mm'])
    apertures=[n for n in (no,*primary) if n in data and data[n]['bvh'].ray_cast(src-axis*.018,axis,.036)[0] is not None]
    behind=[(p-src).dot(axis) for p in g['p']]
    verts=np.array([tuple(p) for p in g['p']])
    mean=verts.mean(axis=0)
    _,off=np.linalg.eigh(np.cov((verts-mean).T))
    fitted_normal=off[:,0]
    spans=(verts-mean)@fitted_normal
    normal_depth=float(spans.max()-spans.min())*1000
    fast={}
    for label,span in [('bolts',range(58,74)),('nuts',range(74,90))]:
        fast[label]=[A(i) for i in span if i in data and
                       abs((data[i]['center']-src).dot(axis))<.038 and
                       (data[i]['center']-src).length<.10]
    stations.append((src,axis))
    section.append({'gasket':A(no),'along_m':distance,
        'plane_midpoint_to_centerline_mm':dist*1000,
        'projected_gasket_axial_thickness_mm':1000*(max(behind)-min(behind)),
        'gasket_thickness_along_fitted_own_normal_mm':normal_depth,
        'two_adjacent_faces':near[:2],'axial_center_blocking_meshes':[A(n) for n in apertures],
        'nearby_hardware':fast})
for sec in section:
    sec['nearby_hardware']={'bolts':[],'nuts':[]}
for label,span in [('bolts',range(58,74)),('nuts',range(74,90))]:
    for n in span:
        if n not in data or not stations:continue
        v=data[n]['center']
        idx=min(range(len(stations)),key=lambda i:(v-stations[i][0]).length)
        section[idx]['nearby_hardware'][label].append(A(n))
result={'method':'Blender reimport under final hash. Gasket center from bounding midpoint, direction from nearest segment of physical centerline. 36 mm axial center ray spans gasket and close end faces. Nearest vertex/surface sampled on both sides; Fasteners assigned uniquely to the nearest measured gasket center. This determines group count, not thread fit. Fit of seats and renderer geometry only, exact thread and pressure seal remain undetermined.',
        'asset_sha256':hashlib.sha256(a.read_bytes()).hexdigest(),
        'route_sha256':hashlib.sha256(flow.read_bytes()).hexdigest(),
        'expected_ids':[A(n) for n in [5,*range(50,90)]],
        'actual_ids':[A(n) for n in data],
        'mesh_parents':{A(n):v['obj'].parent.name if v['obj'].parent else None for n,v in data.items()},
        'profile_detection':section}
out.write_text(json.dumps(result,indent=2)+'\n')
