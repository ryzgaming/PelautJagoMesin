"""Independent assembled geometry inspection for r02's fuel-system changes."""
from pathlib import Path
import hashlib
import json
import sys
from itertools import combinations

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root,out=map(Path,sys.argv[sys.argv.index('--')+1:])
asset=root/'model/exterior/exterior.glb'
inv=json.loads((asset.parent/'inventory.json').read_text())['components']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset.resolve()))
bpy.context.view_layer.update()
scene={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
structures = {}
triangles_by_id={}
vertices = {}
def read(id):
    obj=scene[id]
    obj.data.calc_loop_triangles()
    xyz=[obj.matrix_world @ v.co for v in obj.data.vertices]
    triangles=[tuple(p.vertices) for p in obj.data.loop_triangles if p.area>1e-12]
    vertices[id]=xyz
    triangles_by_id[id]=triangles
    structures[id]=BVHTree.FromPolygons(xyz, triangles, all_triangles=True, epsilon=0)

def distance(a,b):
    t=structures[b]
    return min(v for p in vertices[a] if (v:=t.find_nearest(p)[3]) is not None)
def overlaps(a,b):
    return len(structures[a].overlap(structures[b]))
def alias(xyz):
    return (xyz[0],xyz[2],-xyz[1])
def mean(points):
    return sum(points,Vector((0,0,0)))/len(points)
def range_m(id):
    points=vertices[id]
    return [alias([min(p[i] for p in points) for i in range(3)]),alias([max(p[i] for p in points) for i in range(3)])]

names={p['id']:p['name'] for p in inv if p['id'].startswith('EXT-FUEL')}
pipes=[id for id,n in names.items() if 'pipa injeksi silinder' in n.lower()]
fittings=[id for id,n in names.items() if any(k in n.lower() for k in ('delivery','fitting','union','outlet'))]
canisters=[id for id,n in names.items() if n.lower().startswith('canister filter bahan bakar')]
for id in {*names,*[f'EXT-HEADS-{j:02d}' for j in range(1,7)]}:
    read(id)

reported=[]
for rank,pipe in enumerate(pipes,1):
    points=vertices[pipe]
    y_low=min(p.z for p in points)
    y_high=max(p.z for p in points)
    ulo=mean([p for p in points if p.z-y_low<.005])
    uhi=mean([p for p in points if y_high-p.z<.005])
    head=f'EXT-HEADS-{rank:02d}'
    reported.append({'pipe':pipe,'label':names[pipe],'lowest_endpoint_band_center_m':list(alias(ulo)),
                     'highest_endpoint_band_center_m':list(alias(uhi)),
                     'nearest_fitting_from_pipe_base_mm':sorted([(round(structures[id].find_nearest(ulo)[3]*1000,3),id) for id in fittings]),
                     'nearest_pipe_vertex_to_corresponding_head_mm':distance(pipe,head)*1000,
                     'corresponding_head_triangle_crossings':overlaps(pipe,head),
                     'intended_fitting_triangle_crossings':overlaps(pipe,f'EXT-FUEL-{rank+12:02d}')})

crossings=[]
for a,b in combinations(pipes,2):
    pairs=structures[a].overlap(structures[b])
    if pairs:
        pts=[vertices[a][v] for f in {pair[0] for pair in pairs} for v in triangles_by_id[a][f]]
        crossings.append({'first':a,'second':b,'triangle_pairs':len(pairs),'approx_contact_centroid_m':alias(mean(pts))})
report={'exterior_sha256' :hashlib.sha256(asset.read_bytes()).hexdigest(),
        'method':'Reimport Blender, map Y-up. Endpoint-band means are geometric proxies, not pipe centerline endpoints. At the head, nearest vertex/surface and triangle crossings indicate visual entry, not a seal or OEM physical fit. Pipe-to-pipe BVH signals surface crossing only.',
        'part_names':names,'pipe_count':len(pipes),'fitting_count':len(fittings),'paired_filter_count':len(canisters),
        'part_bounds_blender_remapped':{id:{'x': [min(p.x for p in vertices[id]),max(p.x for p in vertices[id])],
                                          'y': [min(p.z for p in vertices[id]),max(p.z for p in vertices[id])],
                                          'z': [-max(p.y for p in vertices[id]),-min(p.y for p in vertices[id])]} for id in names},
        'pipe_endpoints':reported,
        'pipe_pair_crossings':crossings,
        'fuel_filter_housing_contact':[[id,distance(id,'EXT-FUEL-09')*1000,overlaps(id,'EXT-FUEL-09')] for id in canisters],
}
(out/'fuel-fit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
