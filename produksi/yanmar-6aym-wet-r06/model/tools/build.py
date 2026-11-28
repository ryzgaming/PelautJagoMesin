#!/usr/bin/env python3
"""Build the Yanmar review model in a separate work directory using its packaged sources."""
import argparse
import ast
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MODEL = Path(__file__).resolve().parents[1]
SOURCE = MODEL / "source"
ROOT = MODEL.parent
LAYERS = ("internal", "exterior")


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def glb_meshes(path):
    with path.open("rb") as stream:
        magic, version, total = struct.unpack("<4sII", stream.read(12))
        size, kind = struct.unpack("<II", stream.read(8))
        if (magic, version, total, kind) != (b"glTF", 2, path.stat().st_size, 0x4e4f534a):
            raise ValueError(f"Invalid glTF binary: {path}")
        doc = json.loads(stream.read(size))
    return {node["name"] for node in doc["nodes"] if "mesh" in node}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=("all", "geometry", "metadata", "check"), default="all",
                        help="all=routes, Blender models, motion and function registry; metadata uses packaged GLBs")
    parser.add_argument("--output", type=Path, help="new output folder; default is a fresh temporary folder")
    parser.add_argument("--blender", default="blender", help="Blender 4.3.2 executable")
    parser.add_argument("--threads", default=4, type=int)
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("--threads must be positive")
    if args.output:
        stage = args.output.expanduser().resolve()
        if any(stage.is_relative_to(ROOT / x) for x in ("model", "ui-workspace", "agensi")):
            parser.error("Choose a new build folder outside model, ui-workspace and agensi")
        stage.mkdir(parents=True, exist_ok=False)
    else:
        stage = Path(tempfile.mkdtemp(prefix="yanmar-r06-build-"))
    print(f"Build output: {stage}", flush=True)
    project = stage / "project"
    shutil.copytree(SOURCE, project, ignore=shutil.ignore_patterns("*.blend", "__pycache__", "*.pyc"))
    for script in (project / "model").rglob("*.py"):
        ast.parse(script.read_text(encoding="utf-8"), filename=str(script))
    report = {"target": args.target, "python": sys.version.split()[0], "commands": [], "layers": {}}
    report_path = stage / "result.json"
    def record():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

    def run(name, argv):
        print(name, flush=True)
        log = stage / (name+".log")
        started = time.monotonic()
        with log.open("w", encoding="utf-8") as stream:
            proc = subprocess.run(argv, cwd=project, stdout=stream, stderr=subprocess.STDOUT,
                                  env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONUTF8": "1"})
        report["commands"].append({"name":name,"exit":proc.returncode,"elapsed_seconds":round(time.monotonic()-started,2)})
        record()
        if proc.returncode:
            raise SystemExit(f"{name} failed. See {log}")

    model = project / "model"
    scripts = [("water", "flow/make_water_lube.py"), ("routes", "flow/build_routes.py"),
               ("route-coverage", "flow/source_coverage.py")]
    for name, rel in scripts:
        run(name, [sys.executable, str(model / rel)])
    if args.target in ("all", "geometry"):
        blender = shutil.which(args.blender)
        if not blender:
            raise SystemExit("Blender was not found. Supply --blender /path/to/blender")
        report["blender"] = subprocess.check_output([blender, "--version"], text=True).splitlines()[0]
        for layer, script in (("internal", "build_internal.py"), ("exterior", "build.py")):
            run(layer, [blender, "--background", "--factory-startup", "--threads", str(args.threads),
                        "--python-exit-code", "1", "--python", str(model / layer / script), "--", "--export-only"])
    else:
        for layer in LAYERS:
            source_asset = MODEL / "assets" / (layer+".glb")
            if not source_asset.is_file():
                raise SystemExit(f"Required packaged asset missing: {source_asset}")
            shutil.copyfile(source_asset, model / layer / source_asset.name)
    if args.target in ("all", "metadata"):
        run("motion", [sys.executable, str(model / "motion/build_motion.py")])
        run("functions", [sys.executable, str(model / "motion/build_functions.py")])
    reference = json.loads((MODEL / "tools/reference.json").read_text())
    nodes = set()
    for layer in LAYERS:
        asset = model / layer / (layer+".glb")
        names = glb_meshes(asset)
        expected = {r["id"] for r in json.loads((SOURCE/"model"/layer/"inventory.json").read_text())["components"]}
        if names != expected:
            raise SystemExit(f"{layer} mesh IDs differ: missing={sorted(expected-names)}, additional={sorted(names-expected)}")
        digest = sha(asset)
        if args.target=="check" and digest!=reference["glb_sha256"][layer]:
            raise SystemExit(f"{layer} differs from the registered review SHA-256")
        report["layers"][layer] = {"mesh_count":len(names),"sha256":digest,"same_glb_bytes_as_review":digest==reference["glb_sha256"][layer]}
        if nodes.intersection(names):
            raise SystemExit("Duplicate mesh IDs across layers")
        nodes.update(names)
    routes = json.loads((model / "flow/routes.json").read_text())["routes"]
    functions = json.loads((model / "motion/functions.json").read_text())
    if set(functions["components"]) != nodes:
        raise SystemExit("Function registry coverage differs from the actual mesh IDs")
    report["routes"]=len(routes)
    report["mesh_count"]=len(nodes)
    report["assembly_recipes"]=len(list((model/"assemblies").glob("*.json")))
    report["status"]="passed"
    record()
    print(report_path)

if __name__ == "__main__":
    main()
