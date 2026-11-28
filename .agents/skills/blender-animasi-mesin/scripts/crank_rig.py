"""Animasi mekanisme engkol yang benar secara kinematika: poros engkol, batang penghubung, piston
dan katup, satu siklus 720° yang berulang mulus, lalu ekspor GLB beranimasi.

Jalankan pada .blend hasil modeler (objek sudah bernama ID stabil):
  blender model.blend --background --python-exit-code 1 --python crank_rig.py -- \
    --config rig.json --output model/internal/internal-anim.glb

rig.json (satuan meter/derajat, sudut engkol 0° = TMA silinder dengan phase_deg 0):
{
  "fps": 30, "cycle_frames": 96, "rest_crank_deg": 0,
  "crank": {"object": "crankshaft", "axis": "X"},
  "stroke_m": 0.3, "rod_length_m": 0.6,
  "cylinders": [{"piston": "piston_1", "rod": "conrod_1", "phase_deg": 0, "bore_axis": "Z"}],
  "valves": [{"object": "valve_in_1", "open_deg": 350, "close_deg": 590, "lift_m": 0.02,
              "axis": "-Z", "phase_deg": 0}],
  "basis": {"firing_order": "DOCUMENTED manual hlm. 12", "valve_timing": "ESTIMATED"}
}
- phase_deg silinder = sudut engkol saat silinder itu di TMA pembakaran, dari firing order dokumen.
- Origin batang penghubung harus di pena piston (small end); rotasi diayun di sumbu poros engkol.
- Pose model di file = sudut engkol rest_crank_deg; gerakan dihitung relatif terhadap pose itu.
- Katup: angkatan (1-cos)/2 di antara open_deg..close_deg (sudut siklus 0–720). Isi dari diagram
  timing katup; bila tidak ada, tulis "ESTIMATED" di basis dan pertahankan penanda di viewer.
Hasil: GLB dengan satu klip "siklus" (interpolasi linear, frame akhir = frame awal) dan
<output>.rig.json berisi parameter + basis untuk QA.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

AXES = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1)),
        '-X': Vector((-1, 0, 0)), '-Y': Vector((0, -1, 0)), '-Z': Vector((0, 0, -1))}


def piston_drop(theta, r, l):
    """Jarak piston turun dari TMA (meter) untuk sudut engkol theta (rad); rumus slider-crank."""
    return (r + l) - (r * math.cos(theta) + math.sqrt(l * l - (r * math.sin(theta)) ** 2))


def rod_swing(theta, r, l):
    """Sudut ayun batang (rad) di sumbu engkol. Pena engkol bergeser +r·sinθ ke arah (sumbu × bore),
    sehingga ujung besar batang (di -bore dari pena piston) harus berputar -asin(r·sinθ/l)."""
    return -math.asin(r * math.sin(theta) / l)


def valve_lift(cycle_deg, open_deg, close_deg, lift):
    span = (close_deg - open_deg) % 720
    t = (cycle_deg - open_deg) % 720
    return lift * (1 - math.cos(2 * math.pi * t / span)) / 2 if t <= span else 0.0


def obj(name):
    o = bpy.data.objects.get(name)
    if not o:
        raise SystemExit(f'Objek tidak ditemukan: {name}')
    return o


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--config', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--blend', type=Path, help='buka .blend ini dulu (dipakai saat dijalankan lewat modul bpy)')
    a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    if a.blend:
        bpy.ops.wm.open_mainfile(filepath=str(a.blend.resolve()))
    cfg = json.loads(a.config.read_text())
    r, l = cfg['stroke_m'] / 2, cfg['rod_length_m']
    if not (0 < r < l):
        raise SystemExit('stroke/2 harus lebih kecil dari panjang batang.')
    frames, fps = int(cfg.get('cycle_frames', 96)), int(cfg.get('fps', 30))
    rest = math.radians(cfg.get('rest_crank_deg', 0))
    scene = bpy.context.scene
    scene.render.fps, scene.frame_start, scene.frame_end = fps, 0, frames
    crank = obj(cfg['crank']['object'])
    crank_axis = AXES[cfg['crank'].get('axis', 'X')]
    base = {}

    # Blender 4.4+: satu action berlapis "siklus" dengan slot per objek → satu klip di GLB.
    shared = bpy.data.actions.new('siklus') if hasattr(bpy.types, 'ActionSlot') else None

    def remember(o):
        if o.name not in base:
            base[o.name] = (o.location.copy(), o.rotation_euler.copy())
            o.rotation_mode = 'XYZ'
            if shared:
                o.animation_data_create().action = shared
        return base[o.name]

    remember(crank)
    for f in range(frames + 1):
        cycle = 720.0 * f / frames  # derajat engkol yang sudah ditempuh
        theta = math.radians(cycle)
        loc0, rot0 = base[crank.name]
        crank.rotation_euler = (Matrix.Rotation(theta, 4, crank_axis) @ rot0.to_matrix().to_4x4()).to_euler('XYZ', rot0)
        crank.keyframe_insert('rotation_euler', frame=f)
        for cyl in cfg['cylinders']:
            ph = math.radians(cyl.get('phase_deg', 0))
            ang, ang0 = theta - ph, rest - ph
            axis = AXES[cyl.get('bore_axis', 'Z')]
            drop = piston_drop(ang, r, l) - piston_drop(ang0, r, l)
            p = obj(cyl['piston']); ploc, _ = remember(p)
            p.location = ploc - axis * drop
            p.keyframe_insert('location', frame=f)
            if cyl.get('rod'):
                rod = obj(cyl['rod']); rloc, rrot = remember(rod)
                rod.location = rloc - axis * drop
                swing = rod_swing(ang, r, l) - rod_swing(ang0, r, l)
                rod.rotation_euler = (Matrix.Rotation(swing, 4, crank_axis) @ rrot.to_matrix().to_4x4()).to_euler('XYZ', rrot)
                rod.keyframe_insert('location', frame=f)
                rod.keyframe_insert('rotation_euler', frame=f)
        for v in cfg.get('valves', []):
            o = obj(v['object']); vloc, _ = remember(o)
            c = (cycle - v.get('phase_deg', 0)) % 720
            o.location = vloc + AXES[v.get('axis', '-Z')] * valve_lift(c, v['open_deg'], v['close_deg'], v['lift_m'])
            o.keyframe_insert('location', frame=f)

    # Putaran terus-menerus: interpolasi linear (tanpa ease) agar loop tidak tersendat.
    for act in bpy.data.actions:
        curves = list(getattr(act, 'fcurves', []))
        for layer in getattr(act, 'layers', []):
            for strip in layer.strips:
                for bag in getattr(strip, 'channelbags', []):
                    curves += list(bag.fcurves)
        for fc in curves:
            for k in fc.keyframe_points:
                k.interpolation = 'LINEAR'
    a.output.parent.mkdir(parents=True, exist_ok=True)
    kw = dict(filepath=str(a.output.resolve()), export_format='GLB', export_animations=True, export_force_sampling=True)
    # Satu klip "siklus" untuk seluruh mekanisme (Blender 4.4+); versi lama: satu klip per objek,
    # viewer memutar semua klip bersamaan.
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if 'export_merge_animation' in props:
        kw.update(export_animation_mode='ACTIONS', export_merge_animation='ACTION')
    bpy.ops.export_scene.gltf(**kw)
    meta = dict(cfg, output=str(a.output), seconds_per_cycle_at_export=frames / fps,
                note='Di viewer: mixer.timeScale = (rpm/60/2) * (frames/fps) agar 1 siklus = 2 putaran pada rpm aktual')
    Path(str(a.output) + '.rig.json').write_text(json.dumps(meta, indent=2))
    print(json.dumps({'output': str(a.output), 'frames': frames, 'fps': fps, 'cylinders': len(cfg['cylinders'])}))


if __name__ == '__main__':
    main()
