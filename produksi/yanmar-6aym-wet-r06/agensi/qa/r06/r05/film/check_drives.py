"""Decode the released MP4 and compare two real GLB landmarks through each locked-camera sequence."""

import hashlib
import json
import subprocess
import struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from render_drives import (
    HERE,
    DEST,
    PREFIX,
    W,
    H,
    FPS,
    DURATION,
    SHOTS,
    studies,
    frame_state,
    hashes,
    ROOT,
    F,
)


def decode():
    video = DEST / (PREFIX + ".mp4")
    meta = json.loads((HERE / "render.json").read_text())
    if hashes(video) != meta["video_sha256"]:
        raise ValueError("MP4 changed after rendering")
    checks = {
        "drivetrain_sha256": ROOT / "model/motion/drivetrain.json",
        "viewer_sha256": ROOT / "review/assets/studio.js",
        "route_manifest_sha256": ROOT / "model/flow/routes.json",
    }
    for key, path in checks.items():
        assert hashes(path) == meta[key], key
    for layer, h in meta["source_glb_sha256"].items():
        assert hashes(ROOT / f"review/assets/{layer}.glb") == h, layer
    stream = json.loads(
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
    track = stream["streams"][0]
    assert (
        track["pix_fmt"] == "yuv420p"
        and track["codec_name"] == "h264"
        and track["r_frame_rate"] == f"{FPS}/1"
    )
    assert int(track["nb_frames"]) == round(DURATION * FPS) and [
        track["width"],
        track["height"],
    ] == [W, H]
    with video.open("rb") as f:
        atoms = []
        while header := f.read(8):
            size, id = struct.unpack(">I4s", header)
            atoms.append(id)
            assert size >= 8
            f.seek(size - 8, 1)
    assert atoms.index(b"moov") < atoms.index(b"mdat")
    raw = json.loads((HERE / "landmarks.json").read_text())
    manifest = json.loads((ROOT / "model/motion/drivetrain.json").read_text())
    stage_checks = {}
    capture = {}
    frame_info = {}
    for key, v in raw.items():
        rows = v["frames"]
        world = np.asarray([r["moving_m"] for r in rows])
        fixed = np.asarray([r["fixed_m"] for r in rows])
        xy = np.asarray([r["moving_px"] for r in rows])
        travelled = np.linalg.norm(world - world[0], axis=1)
        case_shift = float(np.linalg.norm(fixed - fixed[0], axis=1).max())
        screen = np.linalg.norm(xy - xy[0], axis=1)
        specs = [g for g in manifest["groups"] if v["moving_part"] in g["targets"]]
        if not specs:
            raise ValueError("No authored R05 driver: " + key)
        st = specs[0]
        radial_spread = None
        measured = {}

        def clock(row):
            t = frame_state(row["frame"] / FPS)
            return (
                t["run"]
                if st["mode"] == "running"
                else t["start"]
                if st["mode"] == "starting"
                else t["start"] + t["run"]
            )

        clocks = np.asarray([clock(row) for row in rows])
        if st["kind"] == "belt":
            path = np.asarray(st["path_m"])
            seg = np.diff(path, axis=0)
            lens = np.linalg.norm(seg, axis=1)
            cum = np.r_[0.0, np.cumsum(lens)]
            marks = []
            res = []
            for q in world:
                u = np.clip(
                    ((q - path[:-1]) * seg).sum(axis=1)
                    / np.maximum(lens * lens, 1e-16),
                    0,
                    1,
                )
                distance = np.linalg.norm(path[:-1] + u[:, None] * seg - q, axis=1)
                j = int(np.argmin(distance))
                marks.append(cum[j] + u[j] * lens[j])
                res.append(distance[j])
            arc = (
                np.unwrap(np.asarray(marks) * 2 * np.pi / cum[-1])
                * cum[-1]
                / (2 * np.pi)
            )
            observed = (arc[-1] - arc[0]) / (clocks[-1] - clocks[0])
            measured = {
                "maximum_witness_offset_from_belt_pitchline_m": round(
                    float(max(res)), 6
                ),
                "measured_travel_m_per_crank_rad": round(float(observed), 6),
                "authored_travel_m_per_crank_rad": st["travel_m_per_rad"],
            }
            assert (
                max(res) < 0.014 and abs(observed - st["travel_m_per_rad"]) < 0.006
            ), measured
        if st["kind"] == "spin":
            v0 = np.asarray(st["axis"])
            v0 = v0 / np.linalg.norm(v0)
            rel = world - np.asarray(st["pivot_m"])
            radii = np.linalg.norm(rel - np.outer(rel @ v0, v0), axis=1)
            radial_spread = float(np.ptp(radii))
            assert radial_spread < 4e-6, (key, radial_spread)
            flat = rel - np.outer(rel @ v0, v0)
            a, b = flat[:-1], flat[1:]
            steps = np.arctan2(np.cross(a, b) @ v0, (a * b).sum(axis=1))
            residual = (steps - st["ratio"] * np.diff(clocks) + np.pi) % (
                2 * np.pi
            ) - np.pi
            angular_error = float(np.max(np.abs(np.degrees(residual))))
            measured = {
                "sampled_signed_ratio": round(
                    float(steps.sum() / (clocks[-1] - clocks[0])), 5
                ),
                "authored_signed_ratio": st["ratio"],
                "maximum_step_angle_error_degrees": round(angular_error, 5),
            }
            assert angular_error < 0.04, (key, measured)
        assert travelled.max() > 0.001 and screen.max() > 4 and case_shift < 2e-6, (
            key,
            travelled.max(),
            screen.max(),
            case_shift,
        )
        middle = int(np.argmax(screen))
        before = 0
        third = int(
            np.argmax(
                np.minimum(
                    np.linalg.norm(xy - xy[0], axis=1),
                    np.linalg.norm(xy - xy[middle], axis=1),
                )
            )
        )
        phases = sorted(set([before, middle, third]))
        assert len(phases) == 3
        selected = [rows[i]["frame"] for i in phases]
        stage_checks[key] = {
            "moving_part": v["moving_part"],
            "stationary_part": v["fixed_part"],
            "driver": st["id"],
            "driver_kind": st["kind"],
            **measured,
            "max_landmark_travel_m": round(float(travelled.max()), 7),
            "stationary_drift_m": round(case_shift, 9),
            "fixed_axis_radius_spread_m": round(radial_spread, 8)
            if radial_spread is not None
            else None,
            "max_projected_excursion_px": round(float(screen.max()), 3),
            "phase_frames": selected,
        }
        for i in phases:
            capture[rows[i]["frame"]] = (key, rows[i])
        for row in rows:
            frame_info[row["frame"]] = (key, row)
    story = Image.new("RGB", (5 * 192, ((len(SHOTS) + 4) // 5) * 288), "#e8f0ed")
    strip_width, strip_head, row_height, tile_width = 720, 122, 256, 224
    strip = Image.new(
        "RGB", (strip_width, strip_head + len(raw) * row_height + 12), "#eaf0ed"
    )
    sd = ImageDraw.Draw(strip)
    sd.text((19, 11), "STUDIO MESIN  /  R05", font=F[0], fill="#11685e")
    sd.text((18, 39), "Gerak penggerak Yanmar 6AYM-WET", font=F[1], fill="#162c2e")
    sd.ellipse((20, 84, 30, 94), fill="#e8822f")
    sd.text((40, 79), "Titik pada bagian bergerak", font=F[4], fill="#263f40")
    sd.ellipse((302, 84, 312, 94), fill="#385c60")
    sd.text((322, 79), "Titik pada bagian tetap", font=F[4], fill="#263f40")
    chapter = {round(((s[0] + s[1]) * 0.5) * FPS): i for i, s in enumerate(SHOTS)}
    pics = {}
    unique = set()
    max_error = {id: [0.0, 0.0] for id in raw}
    ff = subprocess.Popen(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-threads",
            "2",
            "-i",
            str(video),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
        stdout=subprocess.PIPE,
    )
    for i in range(round(DURATION * FPS)):
        rgb = ff.stdout.read(W * H * 3)
        assert len(rgb) == W * H * 3
        a = np.frombuffer(rgb, dtype=np.uint8).reshape(H, W, 3)
        unique.add(hashlib.sha256(a[105:694:3, 12:-12:3].tobytes()).digest())
        if i in chapter:
            j = chapter[i]
            story.paste(
                Image.frombytes("RGB", (W, H), rgb).resize(
                    (192, 288), Image.Resampling.LANCZOS
                ),
                ((j % 5) * 192, (j // 5) * 288),
            )
        if i in frame_info:
            key, row = frame_info[i]
            # Locate the two markers from the encoded RGB samples, independent of the matrices.
            for k, (field, target) in enumerate(
                [("moving_px", [241, 130, 44]), ("fixed_px", [56, 92, 96])]
            ):
                x, y = row[field]
                cx, cy = int(round(x)), int(round(y))
                roi = a[cy - 5 : cy + 6, cx - 5 : cx + 6].astype(float)
                assert roi.shape == (11, 11, 3), (key, field, "outside image")
                near = np.argwhere(
                    np.linalg.norm(roi - np.asarray(target), axis=2) < 68
                )
                if not len(near):
                    raise ValueError(
                        f"{key} {field} tracking mark missing at frame {i}"
                    )
                offset = np.linalg.norm(near.mean(0) - 5)
                max_error[key][k] = max(max_error[key][k], float(offset))
        if i in capture:
            key, row = capture[i]
            pics[i] = a.copy()
            j = stage_checks[key]["phase_frames"].index(i)
            k = list(raw).index(key)
            x = 16 + j * (tile_width + 8)
            y = strip_head + k * row_height
            if j == 0:
                sd.line((16, y, strip_width - 16, y), fill="#acbcb7")
                sd.text((17, y + 7), studies[key].name, font=F[0], fill="#203735")
            crop = (
                Image.frombytes("RGB", (W, H), rgb)
                .crop((0, 148, W, 687))
                .resize((tile_width, 193), Image.Resampling.LANCZOS)
            )
            strip.paste(crop, (x, y + 34))
            label = f"{i / FPS:.2f}".replace(".", ",") + " detik"
            sd.text(
                (x + tile_width // 2, y + 229),
                label,
                anchor="ma",
                font=F[4],
                fill="#364f50",
            )
    assert not ff.stdout.read() and ff.wait() == 0
    for key, stats in stage_checks.items():
        mask = np.zeros((H, W), bool)
        mask[146:695, 14:-14] = True
        # Remove all marker/trail positions throughout this scene before measuring geometry image changes.
        for row in raw[key]["frames"]:
            for p in [row["moving_px"], row["fixed_px"]]:
                x, y = map(round, p)
                mask[max(0, y - 15) : y + 16, max(0, x - 15) : x + 16] = False
        pairs = [
            (pics[fa], pics[fb])
            for j, fa in enumerate(stats["phase_frames"])
            for fb in stats["phase_frames"][j + 1 :]
        ]
        changed = max(
            int(
                np.sum(
                    np.max(
                        np.abs(pa[mask].astype(float) - pb[mask].astype(float)), axis=1
                    )
                    > 12
                )
            )
            for pa, pb in pairs
        )
        stats["unmarked_geometry_pixels_delta_over_12"] = int(changed)
        stats["largest_visible_tracking_offset_px"] = round(max_error[key][0], 2)
        stats["largest_visible_fixed_tracking_offset_px"] = round(max_error[key][1], 2)
        assert changed > 100, (key, "geometry motion outside marks", changed)
    story.save(HERE / "decoded-storyboard.jpg", quality=93)
    strip.save(HERE / "decoded-phases.jpg", quality=94)
    (DEST / (PREFIX + "-phases.jpg")).write_bytes(
        (HERE / "decoded-phases.jpg").read_bytes()
    )
    result = {
        "video_sha256": hashes(video),
        "duration_s": float(stream["format"]["duration"]),
        "decoded_frames": round(DURATION * FPS),
        "distinct_machine_area_images": len(unique),
        "codec": track["codec_name"],
        "pixel_format": track["pix_fmt"],
        "faststart": True,
        "phase_sheet_sha256": hashes(HERE / "decoded-phases.jpg"),
        "locked_camera_phase_checks": stage_checks,
    }
    (HERE / "decoded-qa.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    decode()
