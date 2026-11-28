"""Measure solid interfaces on the two exported GLBs, including native seawater morph targets."""
import bpy
import hashlib
import json
import math
import runpy
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parents[2]
folder=root/'qa/r06'
p=root/'model/exterior/exterior.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p))
bpy.context.view_layer.update()
def world(x):return Vector((x[0],-x[2],x[1]))
def xyz(q):return (q.x,q.z,-q.y)
def rotate(p,axis,angle):
    p=world(p)
    return Matrix.Translation(p)@Matrix.Rotation(angle,4,world(axis))@Matrix.Translation(-p)
def translate(delta):return Matrix.Translation(world(delta))
identity=Matrix.Identity(4)
cache={}
def geom(name):
    if name not in cache:
        o=bpy.data.objects[name]
        o.data.calc_loop_triangles()
        vertices=[o.matrix_world@v.co for v in o.data.vertices]
        tri=[tuple(f.vertices) for f in o.data.loop_triangles if f.area>1e-14]
        tree=BVHTree.FromPolygons(vertices,tri,all_triangles=True)
        cache[name]=o,vertices,tri,tree
    return cache[name]
def get(name,op=None):
    _,v,t,b=geom(name)
    if op is None:return b
    return BVHTree.FromPolygons([op@x for x in v],t,all_triangles=True)
def overlap(a,b):return len(a.overlap(b))
def name(ns,i):return f'EXT-{ns}-{i:02d}'
def check(group,targets,fixed,matrices):
    rows={f'{x}/{y}':[] for x in targets for y in fixed}
    for transform in matrices:
        for x in targets:
            A=get(x,transform)
            for y in fixed:rows[x+'/'+y].append(overlap(A,get(y)))
    return {k:max(v) for k,v in rows.items()}
data={'exterior_sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
manifest=json.loads((root/'model/motion/drivetrain.json').read_text())['groups']
by={g['id']:g for g in manifest}
# Evaluate 180 dry geometry phases against the exact housing and cam, independent of renderer.
spec=runpy.run_path(str(root/'model/motion/seawater_vanes.py'))
o,v,t,_=geom('EXT-COOLING-35')
keys=o.data.shape_keys.key_blocks
keys_list=[keys['VANE_'+f'{i+1:02}'] for i in range(10)]
inv=o.matrix_world
deltas=[]
for key in keys_list:
    active=[]
    for i,(base,step) in enumerate(zip(keys[0].data,key.data)):
        delta=inv.to_3x3()@(step.co-base.co)
        if delta.length>1e-7:active.append((i,delta))
    deltas.append(active)
pivot=by['seawater-shaft']['pivot_m']
counts={'cam':[],'shell':[]}
tip=[]
for angle_i in range(181):
    angle=math.radians(angle_i*2)
    points=[x.copy() for x in v]
    for i,active in enumerate(deltas):
        w=spec['contact'](angle+i*math.tau/10)
        if w>1e-7:
            for j,d in active:points[j]+=w*d
    rotation=rotate(pivot,[1,0,0],angle)
    points=[rotation@x for x in points]
    tree=BVHTree.FromPolygons(points,t,all_triangles=True)
    for key,num in [('cam',374),('shell',4)]:
        counts[key].append(overlap(tree,get(name('COOLING',num))))
    if angle_i%4==0:
        cam=get('EXT-COOLING-374')
        s=min(cam.find_nearest(q)[3] for q in points)
        tip.append(s*1000)
data['flexible_impeller']=dict(shape_keys=[k.name for k in keys_list],affected_vertices=[len(v) for v in deltas],
    poses=181,crossings_to_cam=max(counts['cam']),crossings_to_housing=max(counts['shell']),
    sampled_cam_nearest_vertex_gap_mm=[min(tip),max(tip)])
for i in range(6):
    j=i+1
    G=by[f'thermostat-valve-{j}']
    pivot=G['pivot_m'];spring=by[f'thermostat-spring-{j}'];ap=world(spring['pivot_m'])
    # Spring and moving valve travel are compared with fixed frame, shell, thermal core and lid.
    fixed=[name('COOLING',n) for n in (55+i,1,50,61,62)]
    tr=[translate([0,-k*.0005,0]) for k in range(17)]
    sc=[Matrix.Translation(ap)@Matrix.Scale(1-k*.0005/.03445,4,world((0,1,0)))@Matrix.Translation(-ap) for k in range(17)]
    data[f'thermostat-{j}']={'temperatures_c':[G['opens_c'],G['full_open_c']],'max_travel_mm':8,'poses':17,
        'valve':check(j,[name('COOLING',330+i)],fixed,tr),'spring':check(j,[name('COOLING',340+i)],fixed,sc)}
for system,number in [('coolant',380),('seawater',381)]:
    center=by['coolant-shaft' if system=='coolant' else 'seawater-shaft']['pivot_m']
    rot=[rotate(center,(1,0,0),k*math.tau/48) for k in range(48)]
    data['seal-'+system]=check(system,[name('COOLING',number)],[name('COOLING',n) for n in ((3,24) if system=='coolant' else (4,39))],rot)
turbo=by['turbo-floating-bushes']
turbo_axis=turbo['pivot_m']
turbo_poses=[rotate(turbo_axis,(1,0,0),k*math.tau/96) for k in range(96)]
data['turbo-flinger-to-fixed']=check('turbo',[name('EXHAUST',28)],[name('EXHAUST',n) for n in (27,30,31)],turbo_poses)
data['turbo-journal-to-housing']=check('turbo',[name('EXHAUST',22),name('EXHAUST',23)],[name('EXHAUST',4)],turbo_poses)
data['cap-pressure']=check('cap',[name('COOLING',382)],[name('COOLING',2)], [translate([0,k*.0002,0]) for k in range(16)])
data['cap-return']=check('cap',[name('COOLING',384)],[name('COOLING',2)], [translate([0,-k*.0001,0]) for k in range(13)])
(folder/'function-geometry.json').write_text(json.dumps(data,indent=2)+'\n')
print('FUNCTION_GEOMETRY',json.dumps(data))
