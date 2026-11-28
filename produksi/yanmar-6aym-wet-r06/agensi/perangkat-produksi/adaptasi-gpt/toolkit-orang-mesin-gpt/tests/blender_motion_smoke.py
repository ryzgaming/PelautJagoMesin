"""Run with blender -b --python-exit-code 1 --python tests/blender_motion_smoke.py."""

import bpy, pathlib, tempfile, json, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import probe_motion_bounds as probe
import motion_scope as motion

with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    register = motion.new_plan("fixture")
    register["modes"] = {"run": {"broadphase_margin_m": 0}}
    for unit, name, center in [("exterior", "clamp", (1, 0, 1)), ("internal", "rotor_tip", (2, 0, 0))]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.mesh.primitive_cube_add(size=0.1)
        o = bpy.context.object
        o.name = name
        o["id"] = name
        parent = bpy.data.objects.new("mount_" + name, None)
        bpy.context.scene.collection.objects.link(parent)
        parent.location = center
        o.parent = parent
        path = root / "model" / unit / (unit + ".glb")
        path.parent.mkdir(parents=True)
        bpy.ops.export_scene.gltf(filepath=str(path), export_extras=True)
        law = (
            {"kind": "fixed"}
            if name == "clamp"
            else {
                "kind": "rotation",
                "origin_m": [1, 0, 0],
                "axis": [0, 0, 1],
                "ratio": 1,
                "phase_deg": 0,
                "bind_phase_deg": 0,
            }
        )
        register["bodies"][name] = {"mesh_ids": [name], "modes": {"run": law}}
    (root / "model/motion").mkdir()
    (root / "qa").mkdir()
    (root / motion.PLAN).write_text(json.dumps(register))
    out = probe.measure(root)
    boxes = out["world_bounds_m"]
    assert abs(boxes["clamp"][0][1] - 0.95) < 1e-4, boxes
    assert not motion.broad_phase(boxes, 0)
    (root / motion.BOUNDS).write_text(json.dumps(out))
    assert motion.candidate_manifest(root)["pairs_by_mode"]["run"] == [("clamp", "rotor_tip")]
    zero = probe.measure_pair(root, ["clamp", "rotor_tip"], "run", 0, out)
    out = probe.measure(root)
    positive = probe.measure_pair(root, ["clamp", "rotor_tip"], "run", 90, out)
    print(
        "NARROW_PHASE",
        zero["status"],
        positive["status"],
        positive.get("intersection_volume_m3"),
        zero.get("reason"),
    )
    assert (
        zero["status"] == "sampled_zero"
        and positive["status"] == "sampled_positive"
        and abs(positive["intersection_volume_m3"] - 0.001) < 1e-6
    ), (zero, positive)
    print(
        "BLENDER_MOTION_FIXTURE_OK: translated parent, Y-up, disjoint rest bounds and swept collision candidate"
    )
