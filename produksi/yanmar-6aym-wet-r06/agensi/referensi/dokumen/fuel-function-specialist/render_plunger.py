import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[2]; O=R/'doc/fuel-function-specialist'
for version in ['before','after','metered']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene
 p=(R.parent/'yanmar-6aym-wet-r05' if version=='before' else R)/'model/exterior/exterior.glb'
 bpy.ops.import_scene.gltf(filepath=str(p))
 obj=bpy.data.objects['EXT-FUEL-35'];world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
 for x in list(bpy.data.objects):
  if x!=obj:bpy.data.objects.remove(x,do_unlink=True)
 verts=[obj.matrix_world@v.co for v in obj.data.vertices]
 lo=Vector(tuple(min(v[i] for v in verts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in verts) for i in range(3)));center=(lo+hi)*.5
 if version=='metered':obj.matrix_world=Matrix.Translation(center)@Matrix.Rotation(.005/.0175,4,'Z')@Matrix.Translation(-center)@obj.matrix_world
 mat=bpy.data.materials.new('Neutral steel');mat.diffuse_color=(.45,.48,.52,1);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.45,.48,.52,1);bs.inputs['Metallic'].default_value=.05;bs.inputs['Roughness'].default_value=.55;obj.data.materials.clear();obj.data.materials.append(mat)
 for poly in obj.data.polygons:poly.material_index=0;poly.use_smooth=False
 bpy.ops.object.camera_add(location=center+Vector((.10,.025,.018)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.clip_start=.001;cam.data.type='ORTHO';cam.data.ortho_scale=.12;scene.camera=cam
 for loc,power,size in [((.04,-.05,.08),.4,.08),((-.05,-.01,.03),.3,.09),((.02,.06,.04),.5,.06)]:
  bpy.ops.object.light_add(type='AREA',location=center+Vector(loc));light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 scene.world=bpy.data.worlds.new('Graphite');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.09,.11,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=False
 scene.render.resolution_x=320;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(O/f'plunger-{version}.png');bpy.ops.render.render(write_still=True)
