"""Decode every distributed frame, audit motion and inspect the six simulated combustion events."""

import collections
import hashlib
import json
import math
import struct
import subprocess
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial.transform import Rotation
from render_film import (
    HERE,
    ROOT,
    DEST,
    W,
    H,
    FPS,
    DURATION,
    SHOTS,
    U,
    unit,
    mat_vp,
    shot,
)


def read_mp4_atoms(video):
    names = []
    with video.open("rb") as f:
        while raw := f.read(8):
            size, typ = struct.unpack(">I4s", raw)
            names.append(typ.decode())
            if size < 8:
                break
            f.seek(size - 8, 1)
    return names


def check_motion_sources():
    from render_film import Model

    engine = Model()
    angles = np.linspace(0.0, 4 * np.pi, 145)
    poses = [engine.pose(angle) for angle in angles]
    delta = max(abs(poses[0] - poses[-1]).flatten())
    assert delta < 1e-5
    excursion = {}
    for cylinder in engine.kin["cylinders"]:
        node = engine.index[cylinder["piston_root"]]
        ys = [pose[node, 1, 3] for pose in poses]
        stroke = max(ys) - min(ys)
        assert abs(stroke - engine.kin["stroke_m"]) < 1e-5
        excursion[cylinder["number"]] = round(float(stroke), 6)
    idle = engine.pose(2.4)
    engine.pose(2.4, 1.0)
    reset_error = float(abs(engine.pose(2.4) - idle).max())
    assert reset_error < 1e-7
    graph = json.loads((ROOT / "model/flow/routes.json").read_text())
    ports = collections.defaultdict(list)
    for r in graph["routes"]:
        weights = r.get(
            "motion_weights", [int(r.get("motion") == "crank")] * len(r["points"])
        )
        for e, key in [(0, "from"), (-1, "to")]:
            p = np.asarray(r["points"][e])
            w = weights[e]
            rotated = np.stack(
                [
                    np.full_like(angles, p[0]),
                    p[1] * np.cos(angles) + p[2] * np.sin(angles),
                    p[2] * np.cos(angles) - p[1] * np.sin(angles),
                ],
                axis=-1,
            )
            ports[r[key]].append(p + w * (rotated - p))
    gaps = [
        float(np.linalg.norm(candidate - v[0], axis=1).max())
        for v in ports.values()
        for candidate in v[1:]
    ]
    assert max(gaps) < 1e-5
    return {
        "samples": len(angles),
        "piston_stroke_m": excursion,
        "mechanism_720_degree_return_max_matrix_element_delta": float(delta),
        "explosion_reset_max_matrix_element_delta": reset_error,
        "shared_route_ports": sum(len(v) > 1 for v in ports.values()),
        "largest_shared_port_endpoint_gap_m": max(gaps),
    }


def main():
    video = DEST / "yanmar-6aym-r04.mp4"
    probe = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(video),
            ]
        )
    )
    stream = probe["streams"][0]
    count = round(DURATION * FPS)
    assert (
        stream["codec_name"] == "h264"
        and stream["pix_fmt"] == "yuv420p"
        and stream["r_frame_rate"] == f"{FPS}/1"
    )
    assert int(stream["nb_frames"]) == count and [
        stream["width"],
        stream["height"],
    ] == [W, H]
    atoms = read_mp4_atoms(video)
    assert atoms.index("moov") < atoms.index("mdat")
    m = json.loads((ROOT / "model/internal/kinematics.json").read_text())
    fire_by_frame = {
        round((12 + math.radians(c["firing_deg"] + 56) / 6) * FPS): c
        for c in m["cylinders"]
    }
    chapter_by_frame = {
        round(((s[0] + s[1]) / 2) * FPS): i for i, s in enumerate(SHOTS)
    }
    changes = collections.defaultdict(list)
    burns = []
    unique = set()
    prev = None
    sheet = Image.new("RGB", (4 * 230, 3 * 345))
    moments = Image.new("RGB", (3 * 240, 2 * 200))
    dec = subprocess.Popen(
        [
            "ffmpeg",
            "-v",
            "error",
            "-threads",
            "2",
            "-i",
            str(video),
            "-vf",
            f"scale={W // 2}:{H // 2}",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
        stdout=subprocess.PIPE,
    )
    for frame in range(count):
        data = dec.stdout.read(W * H * 3 // 4)
        assert len(data) == W * H * 3 // 4
        img = Image.frombytes("RGB", (W // 2, H // 2), data)
        rgb = np.asarray(img).astype(float)
        crop = rgb[60:340, 12:-12]
        unique.add(hashlib.sha256(crop.tobytes()).hexdigest())
        if prev is not None:
            changes[shot(frame / FPS)[2]].append(
                round(float(np.mean(np.abs(crop - prev))), 3)
            )
        prev = crop
        if frame in chapter_by_frame:
            i = chapter_by_frame[frame]
            sheet.paste(
                img.resize((230, 345), Image.Resampling.LANCZOS),
                ((i % 4) * 230, (i // 4) * 345),
            )
        c = fire_by_frame.get(frame)
        if c is None:
            continue
        s = shot(frame / FPS)
        assert s[7] == "fire"
        local = (frame / FPS - s[0]) / (s[1] - s[0])
        az = 0.05 * (local - 0.5)
        v = Rotation.from_rotvec([0, az, 0]).apply(unit(U(s[5])))
        target = U(s[4])
        eye = target + v * s[6] / (2 * math.tan(math.radians(29) / 2))
        p = mat_vp(eye, target, s[6]) @ U([c["x_m"], 0.462, 0, 1])
        x = (p[0] / p[3] + 1) * W / 4
        y = (1 - p[1] / p[3]) * H / 4
        region = rgb[
            max(0, int(y) - 10) : int(y) + 11, max(0, int(x) - 11) : int(x) + 12
        ]
        hot = (
            (region[:, :, 0] > 186)
            & (region[:, :, 0] - region[:, :, 1] > 58)
            & (region[:, :, 1] - region[:, :, 2] > 19)
        )
        burns.append(
            {
                "cylinder": c["number"],
                "frame": frame,
                "pixels_orange_in_expected_23x21_roi": int(hot.sum()),
            }
        )
        display = img.crop((int(x) - 60, int(y) - 43, int(x) + 60, int(y) + 45)).resize(
            (240, 176), Image.Resampling.LANCZOS
        )
        j = len(burns) - 1
        ox = (j % 3) * 240
        oy = (j // 3) * 200
        moments.paste(display, (ox, oy))
        ImageDraw.Draw(moments).text(
            (ox + 8, oy + 180), f"Silinder {c['number']}  |  f{frame}", fill="white"
        )
    assert len(dec.stdout.read()) == 0 and dec.wait() == 0
    sheet.save(HERE / "decoded-storyboard.jpg", quality=94)
    moments.save(HERE / "decoded-combustion.jpg", quality=94)
    result = {
        "video_sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
        "size_bytes": video.stat().st_size,
        "dimensions": [W, H],
        "fps": FPS,
        "frames": count,
        "duration_s": float(probe["format"]["duration"]),
        "codec": stream["codec_name"],
        "pixel_format": stream["pix_fmt"],
        "fast_start": True,
        "different_engine_region_images": len(unique),
        "median_engine_region_delta_by_scene": {
            k: round(float(np.median(v)), 2) for k, v in changes.items()
        },
        "combustion_frames": burns,
    }
    result["source_motion_numeric_check"] = check_motion_sources()
    (HERE / "decoded-qa.json").write_text(json.dumps(result, indent=2))
    assert (
        len(unique) > 0.99 * count
        and len(burns) == 6
        and all(b["pixels_orange_in_expected_23x21_roi"] >= 8 for b in burns)
    ), result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
