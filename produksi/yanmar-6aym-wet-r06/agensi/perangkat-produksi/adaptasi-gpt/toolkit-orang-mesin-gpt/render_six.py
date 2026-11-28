"""Run with Blender --background --python-exit-code 1 --python render_six.py -- --input model.glb --output renders.
Renders six views, not a geometry audit. Blender uses Z-up; front +X, right -Y.
"""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--samples', type=int, default=16)
    parser.add_argument('--width', type=int, default=1200)
    parser.add_argument('--height', type=int, default=900)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    if args.samples < 1 or min(args.width, args.height) < 32 or not args.input.is_file() or args.input.suffix.lower() not in ('.glb', '.gltf'):
        parser.error('Input GLB/glTF must exist; samples must be positive.')
    if args.output.exists() and any(args.output.iterdir()):
        parser.error('Output must be empty; preserve previous audit renders.')
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
    points = [obj.matrix_world @ Vector(v) for obj in bpy.context.scene.objects if obj.type == 'MESH' for v in obj.bound_box]
    if not points:
        raise ValueError('No meshes in input')
    low = Vector([min(v[i] for v in points) for i in range(3)])
    high = Vector([max(v[i] for v in points) for i in range(3)])
    center, span = (low + high) / 2, max(high - low)
    if span <= 0:
        raise ValueError('Degenerate model bounds')
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = args.samples
    # Some headless Blender builds have no OpenImageDenoise; keep CPU smoke renders portable.
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('QAWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.35, 0.35, 1)
    scene.view_settings.view_transform = 'Standard'
    light = bpy.data.lights.new('QALight', 'SUN')
    light.energy = 3
    lamp = bpy.data.objects.new('QALight', light)
    scene.collection.objects.link(lamp)
    lamp.rotation_euler = (0.5, -0.4, 0.6)
    material = bpy.data.materials.new('QANeutral')
    material.diffuse_color = (0.6, 0.6, 0.6, 1)
    camera = bpy.data.cameras.new('QACamera')
    obj = bpy.data.objects.new('QACamera', camera)
    scene.collection.objects.link(obj)
    scene.camera = obj
    camera.type = 'ORTHO'
    camera.ortho_scale = span * 1.8 * max(1, args.height / args.width)
    camera.clip_start, camera.clip_end = span / 1000, span * 30
    views = {'depan': (1, 0, 0), 'belakang': (-1, 0, 0), 'kiri': (0, 1, 0),
             'kanan': (0, -1, 0), 'atas': (0, 0, 1), 'tiga_perempat': (1, -1, 1)}
    for name, direction in views.items():
        obj.location = center + Vector(direction).normalized() * span * 4
        obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
        for mode in ('neutral', 'color'):
            scene.view_layers[0].material_override = material if mode == 'neutral' else None
            scene.render.filepath = str((args.output / f'{mode}_{name}.png').resolve())
            bpy.ops.render.render(write_still=True)
    (args.output / 'render-settings.json').write_text(json.dumps({'blender': bpy.app.version_string,
        'input': str(args.input), 'bounds': [list(low), list(high)], 'center': list(center),
        'ortho_scale': camera.ortho_scale, 'samples': args.samples, 'resolution': [args.width, args.height], 'views': views,
        'axes': 'Blender Z-up; front +X, right -Y; verify against datum before comparison',
        'status': 'UNVERIFIED until images are inspected'}, indent=2))


if __name__ == '__main__':
    main()
