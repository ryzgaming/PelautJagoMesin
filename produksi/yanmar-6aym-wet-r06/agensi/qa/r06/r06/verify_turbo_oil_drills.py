"""Cast the installed housing only along oil passages in the reimported GLB."""
import bpy
import hashlib
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[2]
glb=root/'model/exterior/exterior.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
housing=bpy.data.objects['EXT-EXHAUST-04']
housing.data.calc_loop_triangles()
points=[housing.matrix_world@v.co for v in housing.data.vertices]
faces=[tuple(t.vertices) for t in housing.data.loop_triangles]
tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
def world(x,y,z):return Vector((.6+x,-(.481+z),.68+y))
tube={
    'feed_boss_through_casting':((.077,.064,0),(.077,.030,0)),
    'supply_to_hot_bush':((.077,.030,0),(.041,.030,0)),
    'supply_to_cold_bush':((.077,.030,0),(.092,.030,0)),
    'hot_bush_outer_oil_groove':((.041,.030,0),(.041,.0153,0)),
    'cold_bush_outer_oil_groove':((.092,.030,0),(.092,.0153,0))
}
result={}
for name,(initial,terminal) in tube.items():
    first,last=world(*initial),world(*terminal)
    direction=last-first
    hit=tree.ray_cast(first,direction.normalized(),direction.length)
    result[name]={'length_mm':direction.length*1000,'open':hit[0] is None}
result['exterior_sha256']=hashlib.sha256(glb.read_bytes()).hexdigest()
(root/'qa/r06/turbo-oil-drills.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(row['open'] for row in result.values() if isinstance(row,dict)),result
print(result)
