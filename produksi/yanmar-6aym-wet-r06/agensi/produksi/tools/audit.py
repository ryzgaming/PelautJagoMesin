#!/usr/bin/env python3
"""Recheck generated staged model files, always writing reports into their build folder."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

PRODUCTION=Path(__file__).resolve().parents[1]
ROOT=PRODUCTION.parents[1]
VERIFY=["verify_driven_gears.py", "check_function_geometry.py", "verify_turbo_oil_drills.py"]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_directory", type=Path, help="directory containing result.json from build.py")
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--threads", type=int, default=3)
    args=parser.parse_args()
    stage=args.build_directory.expanduser().resolve()
    project=stage/"project"
    report=stage/"result.json"
    if any(stage.is_relative_to(ROOT / name) for name in ("model", "agensi", "ui-workspace", "runtime")) or not report.is_file() or json.loads(report.read_text()).get("status")!="passed":
        parser.error("Expected a successful, isolated build directory")
    blender=shutil.which(args.blender)
    if not blender:
        parser.error("Blender not found")
    output=project/"qa/r06"
    output.mkdir(parents=True, exist_ok=True)
    for name in VERIFY:
        script=output/name
        shutil.copyfile(PRODUCTION/"source/qa/r06"/name, script)
        args_blender=[blender,"--background","--factory-startup","--threads",str(args.threads),
                      "--python-exit-code","1","--python",str(script)]
        if name=="verify_driven_gears.py":
            args_blender.extend(["--","--water"])
        log=stage/(script.stem+".log")
        print(log, flush=True)
        with log.open("w") as stream:
            result=subprocess.run(args_blender, stdout=stream, stderr=subprocess.STDOUT, cwd=project)
        if result.returncode:
            sys.exit(f"Audit failed; see {log}")
    data=json.loads((output/"function-geometry.json").read_text())
    impeller=data["flexible_impeller"]
    if impeller["crossings_to_cam"] or impeller["crossings_to_housing"]:
        sys.exit("Impeller crosses housing or cam")
    for name in ("turbo-flinger-to-fixed","turbo-journal-to-housing","seal-coolant","seal-seawater"):
        if any(data[name].values()):
            sys.exit(f"Unexpected rotating contact in {name}")
    print(output)

if __name__=="__main__":
    main()
