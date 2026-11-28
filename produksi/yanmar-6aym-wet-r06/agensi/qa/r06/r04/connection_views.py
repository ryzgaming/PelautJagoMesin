"""Isolated cylinder 3 contact diagnostic, fixed camera and filtering of both refs."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

arg=argparse.ArgumentParser()
arg.add_argument('baseline',type=Path)
arg.add_argument('model',type=Path)
arg.add_argument('output',type=Path)
arg.add_argument('--base-only',action='store_true')
args=arg.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output.mkdir(parents=True,exist_ok=True)
snapshots={}
sources=[('r03',args.baseline)] if args.base_only else [('r04',args.model)]
for label, root in sources:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    hashes={}
    for stem in ('exterior','internal'):
        path=root/'model'/stem/f'{stem}.glb'
        bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
        hashes[stem]=hashlib.sha256(path.read_bytes()).hexdigest()
    objs={o.name:o for o in scene.objects if o.type=='MESH'}
    solid={'EXT-FUEL-05','EXT-FUEL-15','INT-FUELINJ-31'}
    for obj in objs.values():
        obj.hide_render=obj.name not in solid
    scene.render.engine='CYCLES'
    scene.cycles.use_denoising=False
    scene.cycles.samples=16
    scene.render.threads_mode='FIXED'
    scene.render.threads=8
    scene.render.resolution_x,scene.render.resolution_y=1000,720
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Neutral gray')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.18,.22,1)

    def material(name,rgb):
        m=bpy.data.materials.new(name)
        m.use_nodes=True
        shader=m.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(*rgb,1)
        shader.inputs['Metallic'].default_value=.24
        shader.inputs['Roughness'].default_value=.40
        return m
    for key,color in [('EXT-FUEL-05',(.21,.54,.65)),('EXT-FUEL-15',(.42,.50,.57)),('INT-FUELINJ-31',(.63,.38,.19))]:
        mat=material('QA isolated '+key,color)
        for slot in objs[key].material_slots:slot.material=mat

    target=Vector((.61,.225,.56))
    light = bpy.data.lights.new('Key','AREA')
    light.energy=120
    light.size=1.1
    lamp=bpy.data.objects.new('Key',light)
    scene.collection.objects.link(lamp)
    lamp.location=target+Vector((.4,.2,.7))
    lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('QA match')
    camera=bpy.data.objects.new('QA match',data)
    scene.collection.objects.link(camera)
    scene.camera=camera
    data.type='ORTHO'
    data.ortho_scale=.70
    camera.location=target+Vector((.8,.4,.75))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str((args.output/f'{label}-no3-joint.png').resolve())
    bpy.ops.render.render(write_still=True)
    snapshots[label]={'assets':hashes,'shown':sorted(solid),'camera':list(camera.location),'target':list(target),
                      'ortho_scale_m':data.ortho_scale,'description':'No.3 rigid pressure pipe, fitting and inlet housing. Heads and other parts hidden to expose final connection. Colours for inspection.'}
    (args.output/f'{label}-no3-joint.json').write_text(json.dumps(snapshots[label],indent=2)+'\n')
