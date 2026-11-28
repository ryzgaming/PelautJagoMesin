"""Reimport assembled tooth sections in Blender and measure their two-dimensional flank clearances."""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np

root, output = map(Path,sys.argv[sys.argv.index('--')+1:sys.argv.index('--')+3])
sys.path.insert(0,str(root/'model/motion'))
import starter
asset=root/'model/exterior/exterior.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset))
center=np.array([starter.SHAFT_Y,starter.SHAFT_Z])
offset=np.array([starter.PLANET_RAD,0])
specs=[
 ('fly','EXT-FLYWHEEL-20',-.074,[0,0],(.309,.318),'max'),
 ('pin','EXT-ELECTRIC-48',-.064,center,(.0124,.021),'max'),
 ('sun','EXT-ELECTRIC-40',-.005,center,(.010,.015),'max'),
 ('planet','EXT-ELECTRIC-54',-.005,center+offset,(.010,.015),'max'),
 ('ring','EXT-ELECTRIC-45',-.008,center,(.033,.041),'min'),
]
loops={}
for key,node,x,c,band,method in specs:
    samples={}
    obj=bpy.data.objects[node]
    for v in obj.data.vertices:
        q=obj.matrix_world@v.co
        if abs(q.x-x)>1e-6:continue
        yz=np.array([q.z,-q.y])-c
        rad=float(np.linalg.norm(yz))
        if not band[0]<rad<band[1]:continue
        angle=round(math.atan2(yz[1],yz[0])%math.tau,5)
        if angle not in samples or (rad>samples[angle][0])==(method=='max'):
            samples[angle]=rad,yz
    loops[key]=np.array([v[1] for _,v in sorted(samples.items())])
def rotate(vertices,angle):
    c,s=math.cos(angle),math.sin(angle)
    return vertices@np.array([[c,s],[-s,c]])
def one_side(vertices,edges):
    origins,deltas=edges
    rel=vertices[:,None,:]-origins[None,:,:]
    squared=np.sum(deltas*deltas,axis=1)
    t=np.clip(np.sum(rel*deltas[None,:,:],axis=2)/np.maximum(squared,1e-20),0,1)
    return np.min(np.sum((rel-t[:,:,None]*deltas[None,:,:])**2,axis=2))

def gap(a,b,target,radius):
    # A small radial window on each contour keeps every segment that can approach
    # the other wheel. Segments keep their original neighboring vertices.
    def select(v):
        w=np.roll(v,-1,axis=0)
        close=np.minimum(np.linalg.norm(v-target,axis=1),np.linalg.norm(w-target,axis=1))<radius
        return v[close],(v[close],(w-v)[close])
    va,ea=select(a)
    vb,eb=select(b)
    return 1000*math.sqrt(min(one_side(va,eb),one_side(vb,ea)))

metrics={'flywheel_pinion':[],'sun_planet':[],'annulus_planet':[]}
for a in np.linspace(0,math.radians(2),181):
    fly=rotate(loops['fly'],-a)
    pin=rotate(loops['pin'],18*a)+center
    planet=rotate(loops['planet'],-54*a)+offset
    sun=rotate(loops['sun'],54*a)
    ring_void=rotate(loops['ring'],-18*a)
    metrics['flywheel_pinion'].append(gap(fly,pin,center*(.315/.3325),.012))
    metrics['sun_planet'].append(gap(sun,planet,offset/2,.013))
    metrics['annulus_planet'].append(gap(ring_void,planet,offset*1.5,.014))
result=dict(exterior_sha256=hashlib.sha256(asset.read_bytes()).hexdigest(),
    vertices={k:len(v) for k,v in loops.items()},observed_pose_count=181,crank_sweep_deg=2,
    sampled_minimum_and_maximum_gap_mm={k:[min(v),max(v)] for k,v in metrics.items()},
    description='Transverse projected tooth outlines from Blender-reimported glTF mesh sections. Distances measured on actual triangle-generated polygon edges, without bearing compliance or oil film.')
output.write_text(json.dumps(result,indent=2)+'\n')
