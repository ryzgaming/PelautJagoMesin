"""Render potongan animasi GLB (strip frame) agar agen melihat gerak mesin, bukan menebak.

Jalankan:
  blender --background --python-exit-code 1 --python render_strip.py -- \
    --input model/internal/internal.glb --output qa/anim-r01 --frames 8 --view tiga_perempat
Alternatif bila modul bpy terpasang: python3 render_strip.py -- <argumen sama>

Hasil: frame_XX.png, strip.png (lembar kontak), strip.json (aksi, rentang frame, node yang
bergerak beserta perpindahan maksimum). Node yang tidak bergerak sama sekali padahal diharapkan
bergerak (piston, katup, poros) adalah temuan. Gambar tetap harus dibuka dan dinilai.
Sumbu Blender Z-up; depan +X, kanan -Y (sama dengan render_six.py).
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

VIEWS = {'depan': (1, 0, 0), 'belakang': (-1, 0, 0), 'kiri': (0, 1, 0), 'kanan': (0, -1, 0),
         'atas': (0, 0, 1), 'tiga_perempat': (1, -1, 1)}


def args_after_dashes():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--frames', type=int, default=8)
    ap.add_argument('--view', choices=VIEWS, default='tiga_perempat')
    ap.add_argument('--width', type=int, default=640)
    ap.add_argument('--height', type=int, default=480)
    ap.add_argument('--engine', choices=('WORKBENCH', 'EEVEE', 'CYCLES'), default='WORKBENCH')
    ap.add_argument('--xray', action='store_true', help='Workbench X-ray agar bagian dalam terlihat')
    a = ap.parse_args(args_after_dashes())
    if not a.input.is_file() or a.input.suffix.lower() not in ('.glb', '.gltf'):
        ap.error('Input GLB/glTF harus ada.')
    if a.frames < 2:
        ap.error('Minimal 2 frame.')
    if a.output.exists() and any(a.output.iterdir()):
        ap.error('Folder output harus kosong; jangan menimpa bukti lama.')
    a.output.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
    scene = bpy.context.scene
    actions = [x for x in bpy.data.actions]
    if not actions:
        raise SystemExit('GLB tidak berisi animasi (actions kosong). Ekspor ulang dengan animasi.')
    start = int(min(x.frame_range[0] for x in actions))
    end = int(max(x.frame_range[1] for x in actions))
    scene.frame_start, scene.frame_end = start, end
    # GLB dengan satu klip per objek diimpor sebagai strip NLA yang dibisukan; nyalakan semuanya
    # agar seluruh mekanisme bergerak bersama seperti di viewer.
    animated = [o for o in scene.objects if o.animation_data]
    for o in animated:
        for track in o.animation_data.nla_tracks:
            track.mute = False
            for strip in track.strips:
                strip.mute = False

    meshes = [o for o in scene.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    low = Vector([min(p[i] for p in pts) for i in range(3)])
    high = Vector([max(p[i] for p in pts) for i in range(3)])
    center, span = (low + high) / 2, max(high - low)

    frames = [round(start + (end - start) * i / (a.frames - 1)) for i in range(a.frames)]
    # Ukur perpindahan tiap objek beranimasi di sepanjang frame terpilih.
    track = {o.name: [] for o in scene.objects if o.animation_data or (o.parent and o.parent.animation_data)}
    for f in frames:
        scene.frame_set(f)
        for name in track:
            m = scene.objects[name].matrix_world
            track[name].append((m.translation.copy(), m.to_quaternion()))
    motion = {}
    for name, seq in track.items():
        move = max((p - seq[0][0]).length for p, _ in seq)
        turn = max(q.rotation_difference(seq[0][1]).angle for _, q in seq)
        motion[name] = {'translation_m': round(move, 5), 'rotation_deg': round(np.degrees(turn), 2)}

    # Nama mesin render berbeda antar versi Blender (WORKBENCH/BLENDER_WORKBENCH, EEVEE_NEXT/EEVEE).
    for engine in {'WORKBENCH': ['BLENDER_WORKBENCH', 'WORKBENCH'], 'EEVEE': ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'],
                   'CYCLES': ['CYCLES']}[a.engine]:
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if a.engine == 'WORKBENCH':
        shading = scene.display.shading
        shading.light, shading.color_type = 'STUDIO', 'MATERIAL'
        shading.show_xray, shading.xray_alpha = a.xray, 0.35
    if a.engine == 'CYCLES':
        scene.cycles.device, scene.cycles.samples, scene.cycles.use_denoising = 'CPU', 8, False
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = a.width, a.height, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('AnimWorld')
    scene.world.color = (0.07, 0.09, 0.11)
    cam_data = bpy.data.cameras.new('AnimCam')
    cam = bpy.data.objects.new('AnimCam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.lens = 50
    cam.location = center + Vector(VIEWS[a.view]).normalized() * span * 2.6
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.clip_start, cam_data.clip_end = span / 1000, span * 30
    sun = bpy.data.objects.new('AnimSun', bpy.data.lights.new('AnimSun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.6, -0.3, 0.8)
    scene.collection.objects.link(sun)

    paths = []
    for i, f in enumerate(frames):
        scene.frame_set(f)
        path = a.output / f'frame_{i:02d}.png'
        scene.render.filepath = str(path.resolve())
        bpy.ops.render.render(write_still=True)
        paths.append(path)

    cols = min(4, len(paths))
    rows = (len(paths) + cols - 1) // cols
    sheet = np.zeros((rows * a.height, cols * a.width, 4), dtype=np.float32)
    for i, p in enumerate(paths):
        img = bpy.data.images.load(str(p))
        px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
        r, c = i // cols, i % cols
        y0 = (rows - 1 - r) * a.height  # piksel Blender dimulai dari bawah
        sheet[y0:y0 + a.height, c * a.width:(c + 1) * a.width] = px
        bpy.data.images.remove(img)
    out = bpy.data.images.new('strip', cols * a.width, rows * a.height, alpha=True)
    out.pixels[:] = sheet.ravel()
    out.filepath_raw = str((a.output / 'strip.png').resolve())
    out.file_format = 'PNG'
    out.save()

    still = sorted(n for n, m in motion.items() if m['translation_m'] < 1e-5 and m['rotation_deg'] < 0.01)
    report = {'blender': bpy.app.version_string, 'input': str(a.input), 'view': a.view, 'engine': a.engine,
              'actions': [{'name': x.name, 'frame_range': list(x.frame_range)} for x in actions],
              'fps': scene.render.fps, 'frames': frames, 'animated_objects': len(animated),
              'motion': motion, 'animated_but_still': still,
              'status': 'UNVERIFIED sampai strip.png dilihat dan dinilai terhadap dokumen'}
    (a.output / 'strip.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ('actions', 'frames', 'animated_but_still')}, indent=1))


if __name__ == '__main__':
    main()
