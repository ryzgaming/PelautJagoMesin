"""Original R05 offline film. Samples GLTFLoader and the actual viewer at each video frame."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
from dataclasses import dataclass
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import ConvexHull
import moderngl as gl
from shaft_sections import SHAFT_MESHES, centerline
import engine_render as engine
from engine_render import HERE, ROOT, DEST, W, H, FPS, U, unit, mat_vp, F

DURATION = 28.75
START_END = 3.25
PREFIX = "yanmar-6aym-r05"


def hashes(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ids(stem, *nums):
    return [f"{stem}-{n:02d}" for n in nums]


@dataclass
class Study:
    name: str
    primary: str
    fixed: str
    members: list
    opaque: list
    view: tuple
    scale: float = 1.0
    axis: tuple = (1.0, 0.0, 0.0)
    note: str = "Gerak diperlambat"


studies = {
    "starter": Study(
        "Starter",
        "EXT-ELECTRIC-40",
        "EXT-ELECTRIC-02",
        ids("EXT-ELECTRIC", 2, *range(40, 54)),
        ids("EXT-ELECTRIC", 40, 46, 47, 48),
        (-0.45, 0.26, -1),
        1.05,
        note="Fase starter",
    ),
    "timing": Study(
        "Roda gigi timing",
        "INT-TIMING-01",
        "EXT-FLYWHEEL-01",
        ids("INT-TIMING", *range(1, 8), 11, 12) + ["EXT-FLYWHEEL-01"],
        ids("INT-TIMING", *range(1, 8)),
        (-1, 0.11, -0.25),
        1.00,
        note="Rasio model ilustratif",
    ),
    "belt": Study(
        "Sabuk alternator",
        "EXT-FRONT-05",
        "EXT-FRONT-03",
        ids("EXT-FRONT", 3, 4, 5, 6, 7, 8, 10, 13, 17, 18, 19, 20)
        + ids("EXT-ELECTRIC", 21, 24, 25),
        ids("EXT-FRONT", 4, 5, 6, 7, 10, 13, 17, 18, 19, 20)
        + ids("EXT-ELECTRIC", 21, 25),
        (1, 0.16, -0.17),
        1.05,
        note="Tanda pada sabuk",
    ),
    "alternator": Study(
        "Alternator",
        "EXT-ELECTRIC-21",
        "EXT-ELECTRIC-20",
        ids("EXT-ELECTRIC", 1, *range(20, 30)),
        ids("EXT-ELECTRIC", 21, 25),
        (0.50, 0.34, -1),
        1.03,
    ),
    "turbo": Study(
        "Turbocharger",
        "EXT-EXHAUST-20",
        "EXT-EXHAUST-03",
        ids("EXT-EXHAUST", 2, 3, 4, *range(20, 34), 41),
        ids("EXT-EXHAUST", 20, 21, 28, 33),
        (0.72, 0.35, -1),
        1.02,
        note="Laju turbo ilustratif",
    ),
    "freshwater": Study(
        "Pompa air tawar",
        "EXT-COOLING-20",
        "EXT-COOLING-03",
        ids("EXT-COOLING", 3, *range(20, 29)),
        ids("EXT-COOLING", 20, 21, 26),
        (0.93, 0.27, -0.52),
        1.12,
    ),
    "seawater": Study(
        "Pompa air laut",
        "EXT-COOLING-35",
        "EXT-COOLING-04",
        ids("EXT-COOLING", 4, *range(35, 46)),
        ids("EXT-COOLING", 35, 36, 41),
        (-0.94, 0.29, -0.51),
        1.12,
    ),
    "injection": Study(
        "Pompa injeksi",
        "EXT-FUEL-21",
        "EXT-FUEL-01",
        ids("EXT-FUEL", 1, *range(21, 53)),
        ids("EXT-FUEL", 21, *range(23, 41)),
        (0.33, 0.3, -1),
        1.02,
    ),
    "oil": Study(
        "Pompa oli",
        "INT-OILPUMP-03",
        "INT-OILPUMP-02",
        ids("INT-OILPUMP", *range(1, 10)),
        ids("INT-OILPUMP", 1, 3, 4),
        (-0.87, 0.21, -0.5),
        1.08,
    ),
}
# (end, title, caption, study ID or flow, model framing)
SCENES = [
    (1.25, "Mesin terpasang", "Mesin propulsi enam silinder segaris", "whole"),
    (3.25, "Motor starter", "Armature dan pinion bekerja saat start", "starter"),
    (5.5, "Roda gigi timing", "Putaran poros engkol diteruskan ke roda gigi", "timing"),
    (7.75, "Langkah usaha", "Poros engkol, piston, dan katup bergerak bersama", "fire"),
    (10.0, "Rotor alternator", "Rotor berputar di dalam stator", "alternator"),
    (
        12.25,
        "Poros turbocharger",
        "Roda turbin dan kompresor terhubung satu poros",
        "turbo",
    ),
    (13.75, "Udara pengisian", "Udara mengalir dari turbo melalui pendingin", "intake"),
    (
        15.75,
        "Pompa air tawar",
        "Potongan selubung memperlihatkan sudu impeler",
        "freshwater",
    ),
    (17.75, "Pompa air laut", "Lacak satu sudu pada impeler karet", "seawater"),
    (19.25, "Dua sirkuit pendingin", "Mesin hangat, termostat terbuka", "water"),
    (21.75, "Pompa injeksi", "Nok mengangkat tappet dan plunger", "injection"),
    (23.0, "Bahan bakar", "Pulsa injeksi menuju enam silinder", "fuel"),
    (25.0, "Pompa oli", "Putaran rotor di dalam rumah pompa", "oil"),
    (26.0, "Jalur pelumasan", "Oli menuju galeri dan bantalan", "lubrication"),
    (27.0, "Gas buang", "Gas dari silinder menggerakkan turbin", "exhaust"),
]
FULL = {
    "whole": ((0.66, 0.19, 0), (0.62, 0.36, -1), 3.8),
    "fire": ((0.66, 0.33, 0), (0.43, 0.22, -1), 2.45),
    "intake": ((0.66, 0.40, 0), (-0.36, 0.29, -1), 3.06),
    "water": ((0.66, 0.25, 0), (-0.62, 0.30, 0.92), 3.28),
    "fuel": ((0.64, 0.4, -0.1), (0.21, 0.29, -1), 2.69),
    "lubrication": ((0.64, 0.16, 0), (0.32, 0.17, -1), 2.93),
    "exhaust": ((0.66, 0.44, 0), (0.26, 0.32, 1), 2.94),
}
# Add a locked-camera study of the actual V-belt witness between timing and rotor.
SCENES = [
    (end + 1.75 if end > 7.75 else end, title, caption, k)
    for end, title, caption, k in SCENES
]
SCENES.insert(
    4, (9.5, "Sabuk alternator", "Tanda pada sabuk melintasi kedua puli", "belt")
)
SHOTS = []
start = 0.0
for end, title, caption, id in SCENES:
    target, view, ext = FULL.get(id, ((0, 0, 0), (0, 0, 1), 1.0))
    SHOTS.append(
        (
            start,
            end,
            title,
            caption,
            target,
            view,
            ext,
            id if id != "whole" else "",
            float(id != "whole"),
        )
    )
    start = end
engine.SHOTS = SHOTS
engine.DURATION = DURATION


def frame_state(t):
    start = min(START_END, t) * 1.45
    run = max(0.0, t - START_END) * 3.10
    return dict(
        phase="starting" if t < START_END else "running",
        start=start,
        run=run,
        angle=(start + run) % (4 * math.pi),
        time=t,
    )


def apply(mat, pts):
    return pts @ mat[:3, :3].T + mat[:3, 3]


class DriveFilm(engine.Renderer):
    def __init__(self, draft=False):
        super().__init__()
        self.draft = draft
        self.viewer_hash = hashes(ROOT / "review/assets/studio.js")
        self.bound_drive_hash = None
        if not draft:
            drive_file = ROOT / "model/motion/drivetrain.json"
            self.bound_drive_hash = hashes(drive_file)
            payload = json.loads((ROOT / "review/assets/data.json").read_text())
            assert payload.get("drivetrain") == json.loads(drive_file.read_text()), (
                "Prepared viewer does not match final drivetrain"
            )
        self.cam = {}
        self.markers = {}
        self.drives_path = ROOT / "model/motion/drivetrain.json"
        self.drive_registry = (
            json.loads(self.drives_path.read_text())
            if self.drives_path.exists()
            else {"groups": []}
        )
        self.driven_nodes = {
            name for k in self.drive_registry["groups"] for name in k["targets"]
        }
        self.model_points = {
            n: np.concatenate(v) for n, v in self.m.local_points.items()
        }
        self.scratch = tempfile.TemporaryDirectory(prefix="yanmar-r05-frames-")
        tmp = Path(self.scratch.name)
        geomnodes = [
            n for n in self.m.names if n in self.m.part_draws or n.startswith("MOT-")
        ]
        self.local_to_pose = np.array([self.m.index[n] for n in geomnodes])
        self.ticks = [frame_state(i / FPS) for i in range(round(DURATION * FPS))]
        (tmp / "input.json").write_text(
            json.dumps({"names": geomnodes, "frames": self.ticks})
        )
        env = os.environ.copy()
        if draft:
            env["YANMAR_FILM_DRAFT"] = "1"
        subprocess.run(
            [
                "node",
                str(HERE / "viewer_poses.mjs"),
                str(tmp / "input.json"),
                str(tmp / "poses.bin"),
            ],
            check=True,
            env=env,
        )
        meta = json.loads((tmp / "poses.bin.json").read_text())
        self.pose_hash = meta["sha256"]
        self.has_drives = meta["includesR05Drives"]
        ix = np.array(meta["indices"])
        self.local_to_pose = self.local_to_pose[ix]
        self.matrices = np.memmap(
            tmp / "poses.bin", "<f4", "r", shape=(len(self.ticks), len(ix), 4, 4)
        ).transpose(0, 1, 3, 2)
        self.views = [(s[0], s[1], s[7]) for s in SHOTS if s[7] in studies]
        for id, study in studies.items():
            self.setup_study(id, study)

    def shaft_checks(self):
        manifest = json.loads(self.drives_path.read_text())["groups"]
        checks = {}
        for id, name in SHAFT_MESHES.items():
            index = self.m.index[name]
            rest = self.m.world[index]
            world = apply(rest, self.model_points[name])
            center, consistent, total = centerline(world)
            spec = next(s for s in manifest if studies[id].primary in s["targets"])
            axis = unit(np.asarray(spec["axis"]))
            radial = center - np.asarray(spec["pivot_m"])
            radial -= axis * np.dot(radial, axis)
            p = apply(self.m.inv[index], center)
            restored = []
            for i in range(0, len(self.ticks), 3):
                w = apply(self.sample_pose(i / FPS)[index], p) - center
                restored.append(np.linalg.norm(w - axis * np.dot(w, axis)))
            checks[id] = {
                "mesh": name,
                "circular_sections": consistent,
                "candidate_sections": total,
                "independent_center_m": center.tolist(),
                "registry_pivot_m": spec["pivot_m"],
                "axis_offset_m": float(np.linalg.norm(radial)),
                "moving_geometric_axis_max_lateral_drift_m": float(max(restored)),
            }
        return checks

    def sample_angle(self, t):
        return self.ticks[min(len(self.ticks) - 1, round(t * FPS))]["angle"]

    def sample_pose(self, t):
        pose = self.m.world.copy()
        pose[self.local_to_pose] = self.matrices[
            min(len(self.ticks) - 1, max(0, round(t * FPS)))
        ]
        return pose

    def setup_study(self, id, study):
        missing = [
            n for n in [study.primary, study.fixed] if n not in self.model_points
        ]
        if missing and self.draft:
            return
        if missing:
            raise RuntimeError(f"{id}: absent meshes {missing}")
        if id != "timing":
            # Include every authored mesh in the same equipment assembly, including newly
            # split bearings, fasteners, starter planets and the injection-pump followers.
            parent = self.m.parents[self.m.index[study.primary]]
            while parent >= 0 and not self.m.names[parent].startswith("RAK-"):
                parent = self.m.parents[parent]
            if parent < 0:
                raise ValueError("Assembly missing for " + study.primary)
            descendants = []
            for name in self.model_points:
                ancestor = self.m.parents[self.m.index[name]]
                while ancestor >= 0 and ancestor != parent:
                    ancestor = self.m.parents[ancestor]
                if ancestor == parent:
                    descendants.append(name)
            study.members = list(dict.fromkeys([*study.members, *descendants]))
            study.opaque = list(
                dict.fromkeys(
                    [*study.opaque, *[n for n in descendants if n in self.driven_nodes]]
                )
            )
        study.members = [n for n in study.members if n in self.model_points]
        study.opaque = [n for n in study.opaque if n in self.model_points]
        world = lambda n: apply(self.m.world[self.m.index[n]], self.model_points[n])
        obj = np.concatenate([world(n) for n in study.opaque])
        direction = unit(U(study.view))
        right = unit(np.cross(-direction, [0, 1, 0]))
        up = unit(np.cross(right, -direction))
        center = (obj.min(axis=0) + obj.max(axis=0)) * 0.5
        width = np.ptp(obj @ right)
        height = np.ptp(obj @ up)
        extent = max(width / (W / H) * 1.35, height * 1.62, 0.12) * study.scale
        eye = center + direction * extent / (2 * math.tan(math.radians(29) / 2))
        vp = mat_vp(eye, center, extent)
        self.cam[id] = (eye, vp)
        local = self.model_points[study.primary]
        pts = world(study.primary)
        mid = (pts.min(0) + pts.max(0)) * 0.5
        v = pts - mid
        axis = unit(U(study.axis))
        radial = v - np.outer(v @ axis, axis)
        dist = np.linalg.norm(radial, axis=1)
        score = (
            dist / (dist.max() + 1e-7)
            + 0.25 * radial[:, 1] / (dist.max() + 1e-7)
            + 0.22 * (v @ direction) / max(0.001, np.ptp(v @ direction))
        )
        moving = local[np.argmax(score)]
        # Pick a real fixed housing vertex in frame. Camera and transform remain constant.
        fixedpts = world(study.fixed)
        fixed_goal = center + extent * (right * 0.20 + up * 0.16 + direction * 0.02)

        def project(points):
            hom = np.column_stack([points, np.ones(len(points))]) @ vp.T
            return (hom[:, :2] / hom[:, 3, None] * [1, -1] + 1) * [W / 2, H / 2]

        # Prefer an exposed point on the stationary rim: its marker should not appear
        # to sit on a spinning pulley merely because the housing is behind that pulley.
        opaque_outline = ConvexHull(
            np.unique(np.round(project(obj), 2), axis=0)
        ).equations
        pixels = project(fixedpts)
        clearance = (pixels @ opaque_outline[:, :2].T + opaque_outline[:, 2]).max(
            axis=1
        )
        on_screen = (
            (pixels[:, 0] > 25)
            & (pixels[:, 0] < W - 25)
            & (pixels[:, 1] > 108)
            & (pixels[:, 1] < H - 175)
        )
        choices = np.flatnonzero(on_screen & (clearance > 7))
        if not len(choices):
            choices = np.flatnonzero(on_screen)
        if not len(choices):
            choices = np.arange(len(fixedpts))
        selected = choices[
            np.argmin(np.linalg.norm(fixedpts[choices] - fixed_goal, axis=1))
        ]
        fixed = self.model_points[study.fixed][selected]
        self.markers[id] = (moving.copy(), fixed.copy())
        # The belt witness travels beyond its rest-position bounds. Verify the entire
        # sampled path against the unobstructed image area above the caption.
        begin, end, _ = next(x for x in self.views if x[2] == id)
        positions = np.asarray(
            [
                p
                for frame in range(math.ceil(begin * FPS), math.ceil(end * FPS))
                for p in self.projected(id, frame / FPS)
            ]
        )
        horizontal = np.abs(positions[:, 0] - W / 2) / (W / 2 - 27)
        vertical = np.maximum(
            (positions[:, 1] - H / 2) / (H - 186 - H / 2),
            (H / 2 - positions[:, 1]) / (H / 2 - 148),
        )
        expansion = max(horizontal.max(), vertical.max())
        if expansion > 1:
            eye = center + direction * extent * expansion * 1.035 / (
                2 * math.tan(math.radians(29) / 2)
            )
            self.cam[id] = (eye, mat_vp(eye, center, extent * expansion * 1.035))

    def draw_part(self, name, opacity, ghost):
        self.p["opacity"].value = opacity
        self.p["ghost"].value = ghost
        for cat, first, count in self.m.part_draws[name]:
            self.va[cat].render(vertices=count, first=first)

    def projected(self, id, t):
        st = studies[id]
        pose = self.sample_pose(t)
        vp = self.cam[id][1]
        out = []
        for n, p in zip([st.primary, st.fixed], self.markers[id]):
            w = apply(pose[self.m.index[n]], p)
            xy = vp @ U([*w, 1])
            out.append(((xy[0] / xy[3] + 1) * W / 2, (1 - xy[1] / xy[3]) * H / 2))
        return out

    def portrait(self, id, t):
        c = self.ctx
        st = studies[id]
        eye, vp = self.cam[id]
        self.tex.write(self.sample_pose(t).transpose(0, 2, 1).copy().tobytes())
        self.tex.use(0)
        self.target.use()
        self.target.depth_mask = True
        self.target.clear(0.91, 0.95, 0.93, 1, depth=1)
        c.disable(gl.DEPTH_TEST | gl.BLEND | gl.CULL_FACE)
        self.bg["shadow"].value = 0.35
        self.bvao.render(vertices=3)
        self.p["vp"].write(vp.T.copy().tobytes())
        self.p["eye"].value = tuple(eye)
        self.p["ignition"].value = (0, 0, 0, 0)
        c.enable(gl.DEPTH_TEST)
        c.depth_func = "<="
        for n in st.opaque:
            if id == "freshwater" and n == st.primary:
                # Remove only the upper front portion of the *authored* shroud for this cutaway.
                # A fixed world-space cut lets the modeled vanes pass continuously behind it.
                axle = apply(
                    self.m.world[self.m.index[st.primary]],
                    self.model_points[st.primary],
                )
                center = (axle.min(0) + axle.max(0)) / 2
                self.p["impellerSection"].value = (
                    float(center[0] + 0.003),
                    float(center[1] - 0.024),
                    1.0,
                )
            self.draw_part(n, 1, 0)
            self.p["impellerSection"].value = (0.0, 0.0, 0.0)

        c.enable(gl.CULL_FACE | gl.BLEND)
        c.blend_func = (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        self.target.depth_mask = False
        for n in st.members:
            if n not in st.opaque:
                self.draw_part(n, 0.56 if n == st.fixed else 0.37, 1)
        self.target.depth_mask = True
        c.copy_framebuffer(self.out, self.target)
        img = Image.frombytes(
            "RGB", (W, H), self.out.read(components=3, alignment=1)
        ).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        return img

    def render_frame(self, t, markers=True):
        s = engine.shot(t)
        id = s[7]
        if id not in studies:
            img = engine.Renderer.render(self, t)
            return engine.overlay(img, t, s)
        if id not in self.cam:
            return Image.new("RGB", (W, H), "#e4ece8")
        img = self.portrait(id, t)
        if markers:
            d = ImageDraw.Draw(img)
            orange = (241, 130, 44)
            grey = (56, 92, 96)
            # Locus of the same moving mesh vertex over the last seven frames, on a locked camera.
            samples = [
                self.projected(id, max(s[0], t - i / FPS))[0] for i in range(7, -1, -1)
            ]
            if len(set(samples)) > 1:
                d.line(samples, fill=(202, 113, 43), width=2)
            for (x, y), color in zip(self.projected(id, t), (orange, grey)):
                d.ellipse(
                    (x - 7, y - 7, x + 7, y + 7),
                    fill=(252, 251, 243),
                    outline=color,
                    width=2,
                )
                d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=color)
        img = engine.overlay(img, t, s)
        d = ImageDraw.Draw(img)
        h = H - 151 + 107
        d.ellipse((29, h - 5, 39, h + 5), fill=(223, 112, 32))
        moving_labels = {
            "starter": "Armature",
            "timing": "Gear engkol",
            "belt": "Tanda sabuk",
            "alternator": "Rotor",
            "turbo": "Kompresor",
            "freshwater": "Impeler",
            "seawater": "Impeler",
            "injection": "Poros nok",
            "oil": "Rotor",
        }
        fixed_label = {"alternator": "Stator tetap", "belt": "Pelindung tetap"}.get(
            id, "Rumah tetap"
        )
        d.text((47, h - 10), moving_labels[id], font=F[5], fill=(35, 56, 57))
        d.ellipse((179, h - 5, 189, h + 5), fill=(56, 92, 96))
        d.text((196, h - 10), fixed_label, font=F[5], fill=(35, 56, 57))
        d.text(
            (W - 29, h - 10),
            studies[id].note,
            font=F[4],
            anchor="ra",
            fill=(64, 86, 85),
        )
        return img


def write_native_phases(film):
    canvas = Image.new("RGB", (3 * 230, len(film.views) * 232), "#e8eeeb")
    d = ImageDraw.Draw(canvas)
    measurements = {}
    for row, (start, end, id) in enumerate(film.views):
        if id not in film.cam:
            continue
        frames = np.arange(int((start + 0.15) * FPS), int((end - 0.15) * FPS))
        pos = np.asarray([film.projected(id, i / FPS)[0] for i in frames])
        delta = np.linalg.norm(pos - pos[0], axis=1)
        far = int(np.argmax(delta))
        third = int(
            np.argmax(np.minimum(delta, np.linalg.norm(pos - pos[far], axis=1)))
        )
        indices = sorted({0, far, third})
        measurements[id] = {
            "frames": [int(frames[k]) for k in indices],
            "projected_excursion_px": float(delta.max()),
        }
        for col, k in enumerate(indices):
            i = frames[k]
            img = film.render_frame(i / FPS)
            sub = img.crop((0, 152, W, 686)).resize(
                (230, 210), Image.Resampling.LANCZOS
            )
            canvas.paste(sub, (230 * col, 232 * row))
            d.text(
                (230 * col + 7, 232 * row + 211),
                f"{studies[id].name}  ·  f{i}",
                font=F[4],
                fill="#253d3c",
            )
    canvas.save(HERE / "native-phases.jpg", quality=94)
    (HERE / "native-phase-samples.json").write_text(json.dumps(measurements, indent=2))
    print(json.dumps(measurements, indent=2), flush=True)


def encode(draft=False, preview=False, phases=False):
    film = DriveFilm(draft)
    DEST.mkdir(parents=True, exist_ok=True)
    if phases:
        write_native_phases(film)
        return
    if preview:
        sheet = Image.new("RGB", (4 * 192, 4 * 288), "#e9efeb")
        for i, s in enumerate(SHOTS):
            t = (s[0] + s[1]) * 0.5
            img = film.render_frame(t)
            sheet.paste(
                img.resize((192, 288), Image.Resampling.LANCZOS),
                ((i % 4) * 192, (i // 4) * 288),
            )
        sheet.save(HERE / "camera-samples.jpg", quality=94)
        return
    if draft or not film.has_drives:
        raise RuntimeError("Final uses the released drivetrain only.")
    for layer, expected in film.m.hashes.items():
        assert hashes(ROOT / f"review/assets/{layer}.glb") == expected, (
            f"Viewer and source {layer}.glb diverge"
        )
    shaft_stats = film.shaft_checks()
    (HERE / "mesh-axis-check.json").write_text(json.dumps(shaft_stats, indent=2))
    bad = {
        name: item
        for name, item in shaft_stats.items()
        if item["axis_offset_m"] > 0.0005
        or item["moving_geometric_axis_max_lateral_drift_m"] > 0.001
    }
    if bad:
        raise ValueError(
            "Relative shaft/housing axis mismatch before encoding: " + str(bad)
        )
    final = DEST / (PREFIX + ".mp4")
    poster = DEST / (PREFIX + ".jpg")
    temp = HERE / "encoding.mp4"
    poster_temp = HERE / "encoding.jpg"
    pipe = subprocess.Popen(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{W}x{H}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-an",
            "-vf",
            "scale=out_color_matrix=bt709",
            "-c:v",
            "libx264",
            "-threads",
            "2",
            "-preset",
            "veryfast",
            "-crf",
            "19",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-colorspace",
            "bt709",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(temp),
        ],
        stdin=subprocess.PIPE,
    )
    midpoints = {round((s[0] + s[1]) * 0.5 * FPS): j for j, s in enumerate(SHOTS)}
    sample_board = Image.new("RGB", (4 * 192, ((len(SHOTS) + 3) // 4) * 288), "#e9efeb")
    for i in range(round(DURATION * FPS)):
        img = film.render_frame(i / FPS)
        if i in midpoints:
            j = midpoints[i]
            sample_board.paste(
                img.resize((192, 288), Image.Resampling.LANCZOS),
                ((j % 4) * 192, (j // 4) * 288),
            )
            if SHOTS[j][7] == "freshwater":
                img.save(HERE / "freshwater-section.jpg", quality=92)
        if i == round(13.02 * FPS):
            img.save(poster_temp, quality=93)
        pipe.stdin.write(img.tobytes())
        if i % 96 == 0:
            print("Frame", i, flush=True)
    pipe.stdin.close()
    if pipe.wait():
        raise RuntimeError("Encoding failed")
    current_viewer = hashes(ROOT / "review/assets/studio.js")
    if current_viewer != film.viewer_hash:
        # UI/copy changes do not invalidate an identical full-frame matrix stream.
        tmp = Path(film.scratch.name)
        subprocess.run(
            [
                "node",
                str(HERE / "viewer_poses.mjs"),
                str(tmp / "input.json"),
                str(tmp / "recheck.bin"),
            ],
            check=True,
        )
        assert (
            json.loads((tmp / "recheck.bin.json").read_text())["sha256"]
            == film.pose_hash
        ), "Viewer motion changed during rendering"
    assert hashes(film.drives_path) == film.bound_drive_hash, (
        "Drivetrain changed during rendering"
    )
    for layer, h in film.m.hashes.items():
        assert hashes(ROOT / f"review/assets/{layer}.glb") == h, (
            "GLB changed during rendering"
        )
    temp.replace(final)
    poster_temp.replace(poster)
    sample_board.save(HERE / "camera-samples.jpg", quality=94)
    write_native_phases(film)
    samples = {}
    posehash = film.pose_hash
    for a, b, id in film.views:
        st = studies[id]
        frames = range(math.ceil((a + 0.12) * FPS), math.floor((b - 0.10) * FPS))
        report = []
        for i in frames:
            t = i / FPS
            pose = film.sample_pose(t)
            xy = film.projected(id, t)
            coords = [
                apply(pose[film.m.index[n]], p).tolist()
                for n, p in zip((st.primary, st.fixed), film.markers[id])
            ]
            report.append(
                dict(
                    frame=i,
                    moving_px=xy[0],
                    fixed_px=xy[1],
                    moving_m=coords[0],
                    fixed_m=coords[1],
                )
            )
        samples[id] = dict(moving_part=st.primary, fixed_part=st.fixed, frames=report)
    (HERE / "landmarks.json").write_text(json.dumps(samples, default=float))
    metadata = dict(
        video_sha256=hashes(final),
        poster_sha256=hashes(poster),
        source_glb_sha256=film.m.hashes,
        mesh_shaft_sections=shaft_stats,
        route_manifest_sha256=film.routehash,
        drivetrain_sha256=hashes(film.drives_path),
        viewer_sha256=hashes(ROOT / "review/assets/studio.js"),
        frame_matrices_sha256=posehash,
        kinematics_sha256=hashes(ROOT / "model/internal/kinematics.json"),
        render_sha256=hashes(Path(__file__)),
        draw_sha256=hashes(HERE / "engine_render.py"),
        sampler_sha256=hashes(HERE / "viewer_poses.mjs"),
        size=[W, H],
        duration_s=DURATION,
        fps=FPS,
        frames=round(DURATION * FPS),
        route_count=film.routes,
        bytes=final.stat().st_size,
    )
    (HERE / "render.json").write_text(json.dumps(metadata, indent=2))
    print(metadata, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--draft", action="store_true")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--phases", action="store_true")
    args = parser.parse_args()
    encode(args.draft, args.preview, args.phases)
