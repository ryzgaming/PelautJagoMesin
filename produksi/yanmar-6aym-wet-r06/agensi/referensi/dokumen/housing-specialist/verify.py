from pathlib import Path
import bpy,json,sys
from math import pi,cos,sin
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'exterior.glb'))
def tree(id):
    ob=bpy.data.objects[id];m=ob.data
    return BVHTree.FromPolygons([ob.matrix_world@v.co for v in m.vertices],[p.vertices[:] for p in m.polygons])
w=tree('EXT-FLYWHEEL-02'); h=tree('EXT-FLYWHEEL-01');g=tree('EXT-FLYWHEEL-20')
def holes(tree, n, pcd):
    return sum(tree.ray_cast(Vector((-.22,-pcd/2*sin(i*2*pi/n),pcd/2*cos(i*2*pi/n))),Vector((1,0,0)),.11)[0] is None for i in range(n))
result={'gear_disk_surface_pairs':len(w.overlap(g)), 'gear_housing_surface_pairs':len(h.overlap(g)), 'disk_housing_surface_pairs':len(w.overlap(h)),
        'flywheel_holes_open_primary_depth':holes(w,12,.5429),'sae_holes_open_primary_depth':holes(h,16,.6795),
        'disk_pivot':list(bpy.data.objects['EXT-FLYWHEEL-02'].matrix_world.translation),
        'gear_pivot':list(bpy.data.objects['EXT-FLYWHEEL-20'].matrix_world.translation)}
bonnets=[json.loads((root.parent/'assemblies'/f'RAK-BONNET-{i}.json').read_text()) for i in range(1,7)]
result['bonnet_nested_mesh_count']=[len(recipe['bagian']) for recipe in bonnets]
result['distinct_nodes_resolve']=all(all(bpy.data.objects.get(x) for part in recipe['bagian'] for x in part['object_ids']) for recipe in bonnets)
from mathutils import Matrix
from math import radians
ob_d=bpy.data.objects['EXT-FLYWHEEL-02']; ob_g=bpy.data.objects['EXT-FLYWHEEL-20']
base_d=ob_d.matrix_world.copy(); base_g=ob_g.matrix_world.copy()
counts={}
for ang in [0, .5, 1, 1.5, 2, 8.3, 15, 22.5, 45, 90, 137, 200, 275, 359]:
    rotate=Matrix.Rotation(radians(ang),4,'X')
    ob_d.matrix_world=rotate @ base_d; ob_g.matrix_world=rotate @ base_g
    wt=tree('EXT-FLYWHEEL-02');gt=tree('EXT-FLYWHEEL-20')
    counts[str(ang)]=[len(wt.overlap(h)),len(gt.overlap(h)),len(wt.overlap(gt))]
result['sampled_degrees_disk_housing_gear_housing_disk_gear']=counts
print('HOUSING_RESULT '+json.dumps(result))
