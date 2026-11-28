import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parents[2];p=R/'model/internal/internal.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update();scene=bpy.context.scene;rows=[]
for cylinder in range(1,7):
 obj=scene.objects[f'INT-FUELINJ-{cylinder}1-14'];obj.data.calc_loop_triangles();verts=[obj.matrix_world@v.co for v in obj.data.vertices];tree=BVHTree.FromPolygons(verts,[t.vertices[:] for t in obj.data.loop_triangles],all_triangles=True);origin=scene.objects[f'RAK-INJECTOR-{cylinder}'].matrix_world.translation
 for count,angle,diameter,h,clock in [(8,80,.30,2.72,0),(4,45,.22,1.22,math.pi/8)]:
  a=math.radians(angle)
  for i in range(count):
   phi=clock+math.tau*i/count;d=Vector((math.sin(a)*math.cos(phi),-math.sin(a)*math.sin(phi),-math.cos(a)));o=origin+Vector((0,0,h*.001))+d*.00020;hit=tree.ray_cast(o,d,.006)[0]
   rows.append({'cylinder':cylinder,'bank_holes':count,'angle_deg':2*angle,'nominal_diameter_mm':diameter,'clock_deg':math.degrees(phi),'centerline_open':hit is None})
r={'asset_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'method':'Blender GLB reimport, world triangle BVH rays6mm along72 nominal hole centerlines. Verifies unblocked centerlines, not full dimensional tolerance or hydraulic atomization.','passed':sum(r['centerline_open'] for r in rows),'total':len(rows),'rows':rows}
(R/'doc/fuel-function-specialist/nozzle-export-audit.json').write_text(json.dumps(r,indent=2));print(r['passed'],r['total'])
