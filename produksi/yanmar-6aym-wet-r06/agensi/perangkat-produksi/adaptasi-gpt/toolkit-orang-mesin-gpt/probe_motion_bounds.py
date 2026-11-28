"""Import the full assembled GLBs into Blender and report installed bounds in glTF world."""

import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion_scope import delta


def measure(workspace):
    register = json.loads((workspace / "model/motion/register.json").read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = {"revision": register["revision"], "model_sha256": {}, "world_bounds_m": {}}
    for unit in ("exterior", "internal"):
        path = workspace / "model" / unit / (unit + ".glb")
        result["model_sha256"][unit] = hashlib.sha256(path.read_bytes()).hexdigest()
        bpy.ops.import_scene.gltf(filepath=str(path))
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        key = obj.get("id") or obj.get("part_id") or obj.name
        if key in result["world_bounds_m"]:
            raise ValueError("Duplicate mesh ID: " + key)
        if not obj.data.vertices:
            raise ValueError("Empty mesh: " + key)
        coords = (obj.matrix_world @ v.co for v in obj.data.vertices)
        points = [(p.x, p.z, -p.y) for p in coords]
        result["world_bounds_m"][key] = [
            [fn(p[i] for p in points) for i in range(3)] for fn in (min, max)
        ]
    return result


def measure_pair(workspace, pair, mode, phase, bounds):
    """Measure the solid intersection at one exact pose. A zero sample does not clear a sweep."""
    register = json.loads((workspace / "model/motion/register.json").read_text())
    objects = {
        o.get("id") or o.get("part_id") or o.name: o
        for o in bpy.context.scene.objects
        if o.type == "MESH"
    }
    base = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    result = {
        "revision": register["revision"],
        "model_sha256": bounds["model_sha256"],
        "register_sha256": hashlib.sha256(
            (workspace / "model/motion/register.json").read_bytes()
        ).hexdigest(),
        "pair": list(pair),
        "mode": mode,
        "driver_deg": phase,
        "solver": "Blender EXACT INTERSECT",
        "status": "unverified",
        "intersection_volume_m3": None,
    }
    detached = []
    for key in pair:
        source = objects[key]
        law = next(r["modes"][mode] for r in register["bodies"].values() if key in r["mesh_ids"])
        index = next((i for i, p in enumerate(law.get("poses", [])) if p["driver_deg"] == phase), 0)
        matrix = base @ Matrix(delta(law, phase, index)) @ base.inverted() @ source.matrix_world
        bm = bmesh.new()
        try:
            bm.from_mesh(source.data)
            bm.transform(matrix)
            # Reunite only coincident GLB attribute seams. Never close a missing wall.
            unique, duplicates = {}, {}
            for vertex in bm.verts:
                coords = tuple(vertex.co)
                if coords in unique:
                    duplicates[vertex] = unique[coords]
                else:
                    unique[coords] = vertex
            if duplicates:
                bmesh.ops.weld_verts(bm, targetmap=duplicates)
            if not bm.faces or not all(e.is_manifold and e.is_contiguous for e in bm.edges):
                result["reason"] = "Open or inconsistently oriented solid: " + key
                return result
            geom = bpy.data.meshes.new("qa-solid-" + key)
            bm.to_mesh(geom)
        finally:
            bm.free()
        obj = bpy.data.objects.new("qa-solid-" + key, geom)
        bpy.context.collection.objects.link(obj)
        detached.append(obj)
    left, right = detached
    intersection = left.modifiers.new("QA intersection", "BOOLEAN")
    intersection.operation = "INTERSECT"
    intersection.solver = "EXACT"
    intersection.object = right
    eval_left = left.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = eval_left.to_mesh()
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        if bm.faces and not all(e.is_manifold and e.is_contiguous for e in bm.edges):
            result["reason"] = "Intersection result is not a closed solid"
            return result
        volume = abs(bm.calc_volume(signed=True)) if bm.faces else 0.0
        result.update(
            status="sampled_positive" if volume else "sampled_zero", intersection_volume_m3=volume
        )
    finally:
        bm.free()
        eval_left.to_mesh_clear()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--solid-pair", nargs=2, metavar=("A", "B"))
    parser.add_argument("--mode")
    parser.add_argument("--phase-deg", type=float)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    result = measure(args.workspace)
    if args.solid_pair:
        if (
            args.solid_pair[0] == args.solid_pair[1]
            or not args.mode
            or args.phase_deg is None
            or not args.output
        ):
            parser.error(
                "--solid-pair requires distinct IDs, --mode, --phase-deg and a separate --output"
            )
        if args.output.resolve() == (args.workspace / "qa/motion-bounds.json").resolve():
            parser.error("Preserve motion-bounds.json; write a separate pair evidence file")
        result = measure_pair(args.workspace, args.solid_pair, args.mode, args.phase_deg, result)
    target = args.output or args.workspace / "qa/motion-bounds.json"
    target.write_text(json.dumps(result, indent=2) + "\n")
