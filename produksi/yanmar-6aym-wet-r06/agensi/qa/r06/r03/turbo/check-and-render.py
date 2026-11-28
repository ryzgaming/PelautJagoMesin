import bpy,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
import sys
root=Path(sys.argv[sys.argv.index('--')+1])
output=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'model/exterior/exterior.glb'))
parts={o.name:o for o in bpy.data.objects['RAK-TURBO'].children if o.type=='MESH'}
def tree(id):
 o=parts[f'EXT-EXHAUST-{id:02d}'];o.data.calc_loop_triangles()
 return BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices],[t.vertices[:] for t in o.data.loop_triangles],all_triangles=True)
bpy.context.view_layer.update()
r=json.load(open(root/'model/assemblies/RAK-TURBO.json'))
assert {v for a in r['bagian'] for v in a['object_ids']}==set(parts)
print('GROUP',len(parts))
ts={i:tree(i) for i in [2,3,4,20,21,22,23]}
counts={f'{i:02}:{j:02}':len(ts[i].overlap(ts[j])) for i in [2,3,4] for j in [20,21,22,23]}
print('BVH_COUNTS',counts)
import hashlib
digest=hashlib.sha256((root/'model/exterior/exterior.glb').read_bytes()).hexdigest()
(output/'mesh-check.json').write_text(json.dumps({'source_glb':str(root/'model/exterior/exterior.glb'),'sha256':digest,'matched_ids':sorted(parts),'stationary_shell_rotor_bearing_surface_intersections':counts},indent=2))
# Omit covers in the diagnostic below to give an unobstructed view along the shaft.
sc=bpy.context.scene
for o in sc.objects:
 if o.type=='MESH':o.hide_render=o.name not in parts
movers={item['object_id']:item for e in r['bagian'] for item in e['posisi']}
sc.render.engine='CYCLES'
sc.cycles.samples=16
sc.cycles.use_denoising=False
sc.world=bpy.data.worlds.new('Studio turbo')
sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.22,1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value=.55
camera=bpy.data.cameras.new('Turbo camera')
cam=bpy.data.objects.new('Turbo camera',camera)
sc.collection.objects.link(cam)
sc.camera=cam
cam.data.type='ORTHO'
sc.render.resolution_x=1250;sc.render.resolution_y=690;sc.render.resolution_percentage=100
def light(name,direction,power,size):
 lamp=bpy.data.lights.new(name,'AREA');lamp.energy=power;lamp.size=size
 obj=bpy.data.objects.new(name,lamp);sc.collection.objects.link(obj)
 target=Vector((.66,-.481,.68));obj.location=target+Vector(direction)
 obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
light('Key',(.7,-1.3,1.3),90,1.2)
light('Edge',(-.8,.8,1.1),66,.9)
light('Face',(.2,-1.3,-.5),25,.9)
original={id:o.location.copy() for id,o in parts.items()}
for label,ratio,width in [('rotor-detail',0,.44),('exploded',1,1.72)]:
 for id,obj in parts.items():
  obj.location=original[id]
  if ratio:
   m=movers.get(id);obj.hide_render=False
   if m:obj.location.x+=m['arah'][0]*m['jarak_m']*ratio
  else:
   obj.hide_render=int(id.rsplit('-',1)[1]) not in {20,21,22,23,24,25,26,28,29,30,31,33,37,38,39}
 center=Vector((.67 if not ratio else .97,-.481,.68))
 cam.location=center+Vector((.56,-1.25,.59))
 cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
 cam.data.ortho_scale=width
 sc.render.filepath=str(output/(label+'.png'))
 bpy.ops.render.render(write_still=True)
