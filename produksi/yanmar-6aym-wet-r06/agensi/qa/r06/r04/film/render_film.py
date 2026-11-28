"""Render the Yanmar training film offline from the released mesh, kinematics and route manifest.

Requirements: numpy, scipy, moderngl/glcontext (EGL), Pillow, ffmpeg.
python render_film.py --preview    # selected stills from current model
python render_film.py              # final MP4; the flow registry is mandatory
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import time

os.environ.setdefault("LP_NUM_THREADS", "3")
import moderngl as gl
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial.transform import Rotation

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEST = ROOT / "review/assets/film"
FPS = 24
DURATION = 19.75
W, H = 576, 864
U = lambda x: np.asarray(x, dtype="f4")
I = np.eye(4, dtype="f4")


def unit(x):
    return x / max(np.linalg.norm(x), 1e-12)


def tr(p):
    a = I.copy()
    a[:3, 3] = p
    return a


def rx(t):
    a = I.copy()
    a[1:3, 1:3] = [[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]]
    return a


def smooth(a, b, x):
    u = max(0, min(1, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def mix(a, b, x):
    return np.asarray(a) * (1 - x) + np.asarray(b) * x


class Model:
    def __init__(self):
        self.names = []
        self.base = []
        self.parents = []
        self.batches = [[] for _ in range(5)]
        self.iv = [[] for _ in range(5)]
        self.n = [0] * 5
        self.hashes = {}
        for layer in ("exterior", "internal"):
            self.load(layer)
        self.index = {n: i for i, n in enumerate(self.names)}
        self.base = U(self.base)
        self.parents = np.asarray(self.parents)
        self.world = self.transforms(self.base)
        self.inv = np.linalg.inv(self.world)
        self.kin = json.loads((ROOT / "model/internal/kinematics.json").read_text())

    def transforms(self, loc):
        w = loc.copy()
        for lvl in self.hierarchy[1:]:
            w[lvl] = w[self.parents[lvl]] @ loc[lvl]
        return w

    def load(self, layer):
        data = (ROOT / f"model/{layer}/{layer}.glb").read_bytes()
        self.hashes[layer] = hashlib.sha256(data).hexdigest()
        n = struct.unpack_from("<I", data, 12)[0]
        g = json.loads(data[20 : 20 + n])
        blob = data[28 + n :]
        ac = g["accessors"]
        bv = g["bufferViews"]
        nodes = g["nodes"]
        offset = len(self.names)

        def get(idx):
            a = ac[idx]
            v = bv[a["bufferView"]]
            dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}[
                a["componentType"]
            ]
            cols = {"SCALAR": 1, "VEC3": 3}[a["type"]]
            count = a["count"]
            return np.frombuffer(
                blob,
                dtype,
                count * cols,
                offset=v.get("byteOffset", 0) + a.get("byteOffset", 0),
            ).reshape((count, cols))

        par = {
            child: i
            for i, node in enumerate(nodes)
            for child in node.get("children", [])
        }
        for i, node in enumerate(nodes):
            name = node.get("name", "")
            self.names.append(name)
            self.parents.append(par[i] + offset if i in par else -1)
            mat = tr(node.get("translation", [0, 0, 0]))
            mat[:3, :3] = Rotation.from_quat(
                node.get("rotation", [0, 0, 0, 1])
            ).as_matrix() @ np.diag(node.get("scale", [1, 1, 1]))
            if "matrix" in node:
                mat = U(node["matrix"]).reshape(4, 4).T
            self.base.append(mat)
            if "mesh" not in node:
                continue
            if layer == "exterior":
                featured = (
                    name.startswith("EXT-ELECTRIC-")
                    and name not in ("EXT-ELECTRIC-03", "EXT-ELECTRIC-04")
                    or name.startswith("EXT-EXHAUST-")
                    and name
                    not in ("EXT-EXHAUST-01", "EXT-EXHAUST-05", "EXT-EXHAUST-110")
                    or name
                    in (
                        "EXT-FLYWHEEL-02",
                        "EXT-FLYWHEEL-20",
                        "EXT-FRONT-02",
                        "EXT-INTAKE-04",
                    )
                )
                duct_part = (
                    int(name.rsplit("-", 1)[1])
                    if name.startswith("EXT-INTAKE-")
                    else -1
                )
                cat = (
                    4
                    if duct_part == 5 or 50 <= duct_part <= 89
                    else (3 if featured else 0)
                )
            elif name.startswith(("INT-LINER", "INT-MAIN", "INT-OILPUMP")):
                cat = 2
            else:
                cat = 1
            for p in g["meshes"][node["mesh"]]["primitives"]:
                pos = get(p["attributes"]["POSITION"])
                norm = get(p["attributes"]["NORMAL"])
                attr = U(np.zeros((len(pos), 12)))
                attr[:, :3] = pos
                attr[:, 3:6] = norm
                m = g["materials"][p["material"]]["pbrMetallicRoughness"]
                attr[:, 6:9] = m.get("baseColorFactor", [0.3, 0.3, 0.3, 1])[:3]
                attr[:, 9] = m.get("metallicFactor", 1)
                attr[:, 10] = m.get("roughnessFactor", 0.5)
                attr[:, 11] = i + offset
                self.batches[cat].append(attr)
                self.iv[cat].append(
                    get(p["indices"]).reshape(-1).astype("u4") + self.n[cat]
                )
                self.n[cat] += len(pos)
        # Calculate topology once per model, independent of GLB node ordering.
        hierarchy = []
        depth = {}

        def level(i):
            if i not in depth:
                depth[i] = 0 if self.parents[i] < 0 else 1 + level(self.parents[i])
            return depth[i]

        for i in range(len(self.names)):
            d = level(i)
            while len(hierarchy) <= d:
                hierarchy.append([])
            hierarchy[d].append(i)
        self.hierarchy = [np.asarray(x) for x in hierarchy]

    def pose(self, angle, explode=0.0):
        k = self.kin
        loc = self.base.copy()

        def rot(name, t):
            if name in self.index:
                i = self.index[name]
                loc[i, :3, :3] = rx(t)[:3, :3] @ self.base[i, :3, :3]

        def move(name, dy, dz=0):
            if name in self.index:
                i = self.index[name]
                loc[i, 1, 3] += dy
                loc[i, 2, 3] += dz

        for name, factor in [
            (k["crank_root"], -1),
            (k["cam_root"], -0.5),
            ("EXT-FLYWHEEL-02", -1),
            ("EXT-FLYWHEEL-20", -1),
            ("EXT-FRONT-02", -1),
        ]:
            rot(name, angle * factor)
        r, l = k["throw_m"], k["rod_center_to_center_m"]

        def pin(t):
            y = r * math.cos(t)
            z = -r * math.sin(t)
            return y, z, y + math.sqrt(l * l - z * z)

        for c in k["cylinders"]:
            phase = math.radians(c["crankpin_phase_deg"])
            y0, z0, w0 = pin(phase)
            y, z, w = pin(angle + phase)
            move(c["piston_root"], w - w0)
            move(c["rod_root"], y - y0, z - z0)
            rot(c["rod_root"], math.atan2(-z, w - y) - math.atan2(-z0, w0 - y0))
        for v in k["valve_train"]:
            d = (math.degrees(angle) - v["lift_center_deg"] + 360) % 720 - 360
            win = v["half_window_deg"]
            lift = (
                0
                if abs(d) >= win
                else math.cos(math.pi * d / (2 * win)) ** 2 * v["lift_max_m"]
            )
            move(v["valve_root"], -lift)
            move(v["tappet_root"], lift * v["pushrod_ratio"])
            rot(v["rocker_root"], lift / v["rocker_lever_m"])
            for spring in v["springs"]:
                if spring in self.index:
                    loc[self.index[spring], :3, 1] *= 1 - lift / v["spring_height_m"]
        if explode:
            # Offsets apply to top-level assembly groups only. Member parts stay registered.
            offsets = {
                "HEADS": (0, 0.42, 0),
                "INTAKE": (0, 0.32, -0.18),
                "EXHAUST": (0, 0.25, 0.25),
                "OILPAN": (0, -0.35, 0),
                "COOLING": (0.14, 0, 0.22),
                "FRONT": (0.37, 0, 0),
                "FLYWHEEL": (-0.28, 0, 0),
                "FUEL": (0, 0.12, -0.26),
                "ELECTRIC": (0, -0.12, 0.22),
                "LUBE": (0, -0.1, -0.16),
                "INT-HEADS": (0, 0.3, 0),
                "INT-VALVE": (0, 0.35, 0),
                "INT-FUELINJ": (0, 0.45, 0),
                "INT-CAM": (0, -0.06, -0.15),
            }
            for group, off in offsets.items():
                idx = self.index.get("RAK-" + group)
                if idx is not None:
                    loc[idx, :3, 3] += U(off) * explode
        return self.transforms(loc)


VERT = """#version 330
in vec3 pos;in vec3 norm;in vec3 base;in float metal;in float rough;in float node;
uniform sampler2D matrixTex;uniform mat4 vp;
out vec3 wpos;out vec3 nrm;out vec3 color;out float met;out float rgh;
void main(){int i=int(node+.1);mat4 m=mat4(texelFetch(matrixTex,ivec2(0,i),0),texelFetch(matrixTex,ivec2(1,i),0),texelFetch(matrixTex,ivec2(2,i),0),texelFetch(matrixTex,ivec2(3,i),0));vec4 world=m*vec4(pos,1);wpos=world.xyz;nrm=mat3(m)*norm;met=metal;rgh=rough;color=base;gl_Position=vp*world;}"""
FRAG = """#version 330
in vec3 wpos;in vec3 nrm;in vec3 color;in float met;in float rgh;
uniform vec3 eye;uniform vec4 ignition;uniform float opacity;uniform float ghost;out vec4 frag;
void main(){
 vec3 n=normalize(nrm), v=normalize(eye-wpos);if(dot(n,v)<0)n=-n;
 float nv=clamp(dot(n,v),0.,1.);vec3 light=normalize(vec3(-.44,.91,-.39));vec3 h=normalize(light+v);vec3 ref=reflect(-v,n);
 float nd=max(0.,dot(n,light)), hemi=.46+.54*max(0.,n.y*.65+.35);
 vec3 c=color*(.52*hemi+.84*nd+.12*max(0.,dot(n,normalize(vec3(.7,.3,1.)))));
 float strip=smoothstep(.32,.64,ref.y)*(1.-smoothstep(.73,.96,ref.y));
 c+=mix(vec3(.04),color,.42)*(.48+met*1.15)*strip;
 c+=vec3(1.,.95,.83)*pow(max(0.,dot(n,h)),mix(85.,12.,rgh))*(.14+.66*met);
 c+=vec3(.18,.24,.25)*pow(1.-nv,3.)*(.5+met);c+=vec3(1.,.35,.028)*ignition.w*exp(-distance(wpos,ignition.xyz)*23.)*.72;c=pow(max(c,vec3(0)),vec3(.65));
 float fres=pow(1.-nv,1.8);
 c=mix(c,vec3(.38,.52,.55),ghost*(.25+.44*fres));
 frag=vec4(c,opacity*(ghost>.01?(0.10+.90*fres):1.));}"""
BGV = """#version 330
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}"""
BGF = """#version 330
in vec2 uv;out vec4 frag;uniform float shadow;
void main(){vec2 p=uv-vec2(.49,.56);float v=dot(p,p);
vec3 col=mix(vec3(.96,.97,.95),vec3(.75,.81,.80),min(v*1.3,1.));
float s=exp(-pow((uv.x-.49)/.34,2.)-pow((uv.y-.265)/.022,2.));col*=1.-shadow*s*.12;frag=vec4(col,1.);}"""
FLOWV = """#version 330
in vec3 pos;in vec3 norm;in float along;in float schematic;in float crankWeight;uniform mat4 vp;uniform float shaft;
out vec3 n;out float at;out float sch;vec3 aroundShaft(vec3 p){float c=cos(shaft),s=sin(shaft);return vec3(p.x,c*p.y+s*p.z,c*p.z-s*p.y);}
void main(){gl_Position=vp*vec4(mix(pos,aroundShaft(pos),crankWeight),1);at=along;sch=schematic;n=mix(norm,aroundShaft(norm),crankWeight);}"""
FLOWF = """#version 330
in vec3 n;in float at;in float sch;out vec4 frag;uniform vec3 tint;uniform float clock;uniform float bright;
void main(){float pos=fract(at/.145-clock*1.3);float pulse=smoothstep(.0,.13,pos)*(1.-smoothstep(.13,.47,pos));float lit=.64+.36*max(dot(normalize(n),normalize(vec3(-.4,.9,-.6))),0.);vec3 rgb=mix(tint*.76,vec3(.96,1.,.96),pulse*.85)*lit;
float band=fract(at/.045);float dash=smoothstep(.05,.13,band)*(1.-smoothstep(.55,.68,band));
float alpha=mix(.97,.10+.58*dash,sch)*bright;frag=vec4(rgb,alpha);}"""


def line_offsets(routes):
    """Carry traveled distance through a shared port so highlights do not reset at fittings."""
    import heapq

    adjacency = {}
    inputs = set()
    outputs = set()
    for r in routes:
        a, b = r["from"], r["to"]
        inputs.add(a)
        outputs.add(b)
        adjacency.setdefault(a, []).append(
            (b, np.linalg.norm(np.diff(U(r["points"]), axis=0), axis=1).sum())
        )
    distances = {}
    roots = sorted(inputs - outputs)
    for root in roots + sorted(inputs):
        if root in distances:
            continue
        distances[root] = 0.0
        queue = [(0.0, root)]
        while queue:
            cost, port = heapq.heappop(queue)
            if cost > distances[port]:
                continue
            for dest, ds in adjacency.get(port, []):
                if cost + ds < distances.get(dest, float("inf")):
                    distances[dest] = cost + ds
                    heapq.heappush(queue, (cost + ds, dest))
    return distances


def make_mesh_lines(paths):
    vv = []
    ii = []
    for points, r, schem, length, weights in paths:
        points = U(points)
        keep = np.r_[True, np.linalg.norm(np.diff(points, axis=0), axis=1) > 1e-7]
        points = points[keep]
        weights = U(weights)[keep]
        if len(points) < 2:
            continue
        start = len(vv)
        seg = np.diff(points, axis=0)
        lens = np.linalg.norm(seg, axis=1)
        directions = seg / lens[:, None]
        last = None
        for j, p in enumerate(points):
            u = unit(
                directions[max(0, j - 1)] + directions[min(j, len(directions) - 1)]
            )
            if last is None:
                last = unit(np.cross(u, [0, 1, 0] if abs(u[1]) < 0.9 else [1, 0, 0]))
            v = unit(last - u * np.dot(last, u))
            w = np.cross(u, v)
            last = v
            for k in range(10):
                rad = v * math.cos(2 * math.pi * k / 10) + w * math.sin(
                    2 * math.pi * k / 10
                )
                vv.append([*(p + r * rad), *rad, length, schem, weights[j]])
            if j < len(directions):
                length += lens[j]
                for k in range(10):
                    n = (k + 1) % 10
                    off = start + j * 10
                    ii.extend(
                        [
                            off + k,
                            off + n,
                            off + 10 + k,
                            off + n,
                            off + 10 + n,
                            off + 10 + k,
                        ]
                    )
    return U(vv), np.array(ii, dtype="u4")


def mat_vp(eye, target, extent):
    # Perspective projection with camera on an orbit at fixed local framing.
    f = 1 / math.tan(math.radians(29) / 2)
    near = 0.04
    far = 40
    p = U(
        [
            [f / (W / H), 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, -(far + near) / (far - near), -2 * near * far / (far - near)],
            [0, 0, -1, 0],
        ]
    )
    fwd = unit(target - eye)
    right = unit(np.cross(fwd, U([0, 1, 0])))
    up = np.cross(right, fwd)
    view = I.copy()
    view[:3, :3] = np.stack([right, up, -fwd])
    view[:3, 3] = -view[:3, :3] @ eye
    return p @ view


# Presentation colors shared with review/assets/studio.js.
PALETTE = {
    key: tuple(int(rgb[i : i + 2], 16) / 255 for i in (0, 2, 4))
    for key, rgb in {
        "fuel": "f6c55c",
        "lubrication": "ee9c42",
        "freshwater": "33d5eb",
        "seawater": "408ffe",
        "intake": "56d3f9",
        "exhaust": "ff7c55",
    }.items()
}
# Times in seconds, focal point, viewing direction in engine coordinates, visible vertical span.
SHOTS = [
    (
        0,
        1.3,
        "Mesin terpasang",
        "Enam silinder segaris",
        (0.68, 0.18, 0),
        (0.62, 0.36, -1),
        3.85,
        "",
        0.0,
    ),
    (
        1.3,
        3.45,
        "Gerak katup dan piston",
        "Rumah ditampilkan transparan",
        (0.65, 0.32, -0.045),
        (0.20, 0.14, -1),
        1.43,
        "",
        1.0,
    ),
    (
        3.45,
        4.73,
        "Aliran udara masuk",
        "Udara melewati pendingin menuju silinder",
        (0.65, 0.42, 0),
        (-0.36, 0.29, -1),
        3.15,
        "intake",
        1.0,
    ),
    (
        4.73,
        6.25,
        "Sambungan saluran udara",
        "Dua expansion joint di antara tiga ruas duct",
        (0.514, 0.863, 0.273),
        (0.11, 0.43, 1),
        0.84,
        "intake",
        1.0,
    ),
    (
        6.25,
        8.0,
        "Injeksi bahan bakar",
        "Pompa injeksi dan pipa tekanan tinggi",
        (0.63, 0.45, -0.22),
        (0.23, 0.31, -1),
        2.36,
        "fuel",
        1.0,
    ),
    (
        8.0,
        10.0,
        "Sirkuit pelumasan",
        "Oli menuju galeri dan bantalan",
        (0.63, 0.14, 0),
        (0.32, 0.14, -1),
        2.88,
        "lubrication",
        1.0,
    ),
    (
        10.0,
        12.0,
        "Sirkuit pendingin",
        "Mesin hangat, termostat terbuka",
        (0.66, 0.25, 0),
        (-0.62, 0.30, 0.92),
        3.29,
        "water",
        1.0,
    ),
    (
        12.0,
        14.0,
        "Langkah usaha",
        "Urutan silinder  1 · 4 · 2 · 6 · 3 · 5",
        (0.67, 0.34, 0),
        (0.44, 0.22, -1),
        2.33,
        "fire",
        1.0,
    ),
    (
        14.0,
        16.0,
        "Gas buang",
        "Katup buang membuka menuju manifold",
        (0.66, 0.53, 0.06),
        (0.25, 0.33, 1),
        2.92,
        "exhaust",
        1.0,
    ),
    (
        16.0,
        18.0,
        "Urai rakitan",
        "Gerakan mesin dijeda",
        (0.64, 0.19, 0),
        (0.62, 0.36, -1),
        4.3,
        "",
        0.42,
    ),
    (
        18.0,
        19.75,
        "Rapatkan rakitan",
        "Kembali ke posisi terpasang",
        (0.64, 0.19, 0),
        (0.62, 0.36, -1),
        4.1,
        "",
        0.05,
    ),
]


def shot(t):
    return next((v for v in SHOTS if v[0] <= t < v[1]), SHOTS[-1])


def font(size, bold=False):
    return ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans"
        + ("-Bold" if bold else "")
        + ".ttf",
        size,
    )


F = [font(16, True), font(24, True), font(34, True), font(19), font(14), font(14, True)]


def overlay(img, t, s):
    low = Image.new("RGB", img.size, (231, 237, 233))
    if s[8] > 0.0:
        a = (
            np.maximum(
                np.clip((np.arange(H) - (H - 167)) / 18.0, 0, 1),
                np.clip((97 - np.arange(H)) / 20.0, 0, 1),
            )
            * 0.96
        )
        img = Image.composite(
            low,
            img,
            Image.fromarray(np.broadcast_to(np.uint8(a[:, None] * 255), (H, W)).copy()),
        )
    d = ImageDraw.Draw(img)
    ink = (25, 44, 45)
    muted = (66, 86, 85)
    teal = (11, 99, 91)
    d.text((28, 22), "STUDIO MESIN", font=F[0], fill=teal)
    d.text((28, 47), "Yanmar 6AYM-WET", font=F[1], fill=ink)
    d.text((W - 28, 48), "KAJIAN 3D", anchor="ra", font=F[5], fill=muted)
    d.line((28, 84, W - 28, 84), fill=(160, 178, 174), width=1)
    cap = H - 151
    for a, b, *_ in SHOTS:
        x = 28 + (W - 56) * a / DURATION
        end = 28 + (W - 56) * b / DURATION - 3
        d.rounded_rectangle((x, cap, end, cap + 3), 2, fill=(175, 190, 187))
        if t > a:
            d.rounded_rectangle(
                (x, cap, max(x, min(end, 28 + (W - 56) * t / DURATION)), cap + 3),
                2,
                fill=teal,
            )
    d.text((28, cap + 15), s[2], font=F[2], fill=ink)
    d.text((29, cap + 62), s[3], font=F[3], fill=muted)
    info = {
        "intake": "Udara masuk",
        "fuel": "Bahan bakar",
        "exhaust": "Gas buang",
        "water": "Air tawar",
        "lubrication": "Oli pelumas",
        "fire": "Pembakaran ilustratif",
    }.get(s[7])
    if info:
        key = "freshwater" if s[7] == "water" else s[7]
        col = (
            tuple(int(v * 210) for v in PALETTE[key])
            if key in PALETTE
            else (231, 117, 28)
        )
        d.ellipse((30, cap + 104, 40, cap + 114), fill=col)
        d.text((49, cap + 98), info, font=F[5], fill=ink)
        if s[7] == "water":
            sea_color = tuple(int(v * 210) for v in PALETTE["seawater"])
            d.ellipse((143, cap + 104, 153, cap + 114), fill=sea_color)
            d.text((162, cap + 98), "Air laut", font=F[5], fill=ink)
        d.text(
            (W - 28, cap + 98),
            "D05 · Fig. 36"
            if s[2] == "Sambungan saluran udara"
            else ("Garis putus = skematis" if s[7] != "fire" else "Gerak diperlambat"),
            anchor="ra",
            font=F[4],
            fill=muted,
        )
    return img


BURN_V = """#version 330
in vec3 pos;uniform mat4 vp;uniform vec3 center;uniform vec3 scale;out vec3 local;
void main(){local=pos;gl_Position=vp*vec4(center+pos*scale,1);}"""
BURN_F = """#version 330
in vec3 local;uniform float strength;uniform float phase;out vec4 frag;
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),v=fract(p);v=v*v*(3.-2.*v);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),v.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),v.x),v.y),
mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),v.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),v.x),v.y),v.z);}
void main(){
vec3 q=local*vec3(3.1,1.7,3.1)+vec3(phase,.5-phase*2.,4.);
float f=.60*noise(q)+.28*noise(q*2.3)+.12*noise(q*5.1);
float heat=clamp(f*1.85-.39+(1.-length(local.xz))*.23,0.,1.);
vec3 col=mix(vec3(1.,.18,.01),vec3(1.,.92,.50),smoothstep(.22,.87,heat));
float alpha=strength*smoothstep(.12,.74,heat)*(.46+.54*(1.-abs(local.y)));
frag=vec4(col,alpha);}"""


class Renderer:
    def __init__(self):
        self.m = Model()
        self.ctx = c = gl.create_standalone_context(backend="egl")
        print(c.info["GL_RENDERER"], len(self.m.names), "nodes", flush=True)
        self.target = c.framebuffer(
            color_attachments=c.renderbuffer((W, H), components=4, samples=2),
            depth_attachment=c.depth_renderbuffer((W, H), samples=2),
        )
        self.out = c.simple_framebuffer((W, H))
        self.p = c.program(vertex_shader=VERT, fragment_shader=FRAG)
        self.bg = c.program(vertex_shader=BGV, fragment_shader=BGF)
        self.bvao = c.vertex_array(self.bg, [])
        self.tex = c.texture((4, len(self.m.names)), 4, dtype="f4")
        self.p["matrixTex"].value = 0
        self.va = []
        for v, i in zip(self.m.batches, self.m.iv):
            vb = c.buffer(np.concatenate(v).tobytes())
            ib = c.buffer(np.concatenate(i).tobytes())
            self.va.append(
                c.vertex_array(
                    self.p,
                    [
                        (
                            vb,
                            "3f 3f 3f 1f 1f 1f",
                            "pos",
                            "norm",
                            "base",
                            "metal",
                            "rough",
                            "node",
                        )
                    ],
                    ib,
                    index_element_size=4,
                )
            )
        del self.m.batches, self.m.iv
        self.fp = c.program(vertex_shader=FLOWV, fragment_shader=FLOWF)
        self.fv = {}
        path = ROOT / "model/flow/routes.json"
        self.routehash = hashlib.sha256(path.read_bytes()).hexdigest()
        routes = json.loads(path.read_text())["routes"]
        self.routes = len(routes)
        for system in PALETTE:
            members = [
                r
                for r in routes
                if r["system"] == system and r["kind"] in ("physical", "schematic")
            ]
            offsets = line_offsets(members)
            grouped = {}
            for r in members:
                key = r.get("event"), r.get("cylinder"), r["id"] == "hot-air-duct"
                grouped.setdefault(key, []).append(
                    (
                        U(r["points"]),
                        max(
                            0.005, min(0.014 if key[2] else 0.027, r["radius_m"] * 0.75)
                        ),
                        int(r["kind"] == "schematic"),
                        offsets[r["from"]],
                        r.get(
                            "motion_weights",
                            [1 if r.get("motion") == "crank" else 0] * len(r["points"]),
                        ),
                    )
                )
            if grouped:
                self.fv[system] = []
            for (event, cyl, hot_duct), selected in grouped.items():
                v, i = make_mesh_lines(selected)
                vao = c.vertex_array(
                    self.fp,
                    [
                        (
                            c.buffer(v.tobytes()),
                            "3f 3f 1f 1f 1f",
                            "pos",
                            "norm",
                            "along",
                            "schematic",
                            "crankWeight",
                        )
                    ],
                    c.buffer(i.tobytes()),
                    index_element_size=4,
                )
                self.fv[system].append((event, cyl, hot_duct, vao))
        self.bp = c.program(vertex_shader=BURN_V, fragment_shader=BURN_F)
        sphere = []
        ind = []
        for j in range(13):
            for i in range(33):
                a = 2 * math.pi * i / 32
                b = math.pi * j / 12
                sphere.append(
                    [math.cos(a) * math.sin(b), math.cos(b), math.sin(a) * math.sin(b)]
                )
                if j and i:
                    k = len(sphere) - 1
                    ind.extend([k - 34, k - 33, k, k - 34, k, k - 1])
        self.burn = c.vertex_array(
            self.bp,
            [(c.buffer(U(sphere).tobytes()), "3f", "pos")],
            c.buffer(np.array(ind, dtype="u4").tobytes()),
            index_element_size=4,
        )

    def render(self, t):
        c = self.ctx
        s = shot(t)
        a, b, _, _, target, view, extent, flow, xray = s
        local = (t - a) / (b - a)
        angle = (min(t, 16.0) - 12.0) * 6.0
        explode = smooth(16.04, 17.72, t) * (1.0 - smooth(18.08, 19.50, t))
        az = (0.05 if t < 16.0 else 0.035) * (local - 0.5)
        view = Rotation.from_rotvec([0, az, 0]).apply(unit(U(view)))
        target = U(target)
        if s[2] == "Gerak katup dan piston":
            target[0] += 0.19 * (local - 0.5)
        eye = target + view * extent / (2 * math.tan(math.radians(29) / 2))
        vp = mat_vp(eye, target, extent)
        vpbytes = vp.T.copy().tobytes()
        pose = self.m.pose(angle, explode)
        self.tex.write(pose.transpose(0, 2, 1).copy().tobytes())
        self.tex.use(0)
        self.target.use()
        self.target.depth_mask = True
        self.target.clear(0.9, 0.94, 0.92, 1, depth=1)
        c.disable(gl.DEPTH_TEST | gl.BLEND | gl.CULL_FACE)
        self.bg["shadow"].value = 1 - xray * 0.7
        self.bvao.render(vertices=3)
        c.enable(gl.DEPTH_TEST)
        c.depth_func = "<="
        self.p["vp"].write(vpbytes)
        self.p["eye"].value = tuple(eye)

        burn = None
        if flow == "fire":
            for cy in self.m.kin["cylinders"]:
                delta = (math.degrees(angle) - cy["firing_deg"]) % 720
                if delta <= 106:
                    # Crown mesh max local Y is .078 m. Below the liner deck, the
                    # combustion graphic also enters the modeled crown bowl.
                    piston = pose[self.m.index[cy["piston_root"]], 1, 3] + 0.078
                    h = (0.494 - piston + 0.012) / 2
                    burn = (
                        (cy["x_m"], 0.494 - h, 0),
                        h,
                        0.90 * (1.0 - smooth(55, 106, delta)),
                        delta / 106,
                    )
                    break
        self.p["ignition"].value = (*burn[0], burn[2]) if burn else (0, 0, 0, 0)

        def draw(cat, opacity, ghost):
            self.p["opacity"].value = opacity
            self.p["ghost"].value = ghost
            self.va[cat].render()

        close_duct = s[2] == "Sambungan saluran udara"
        if xray < 0.1:
            draw(4, 1, 0)
            draw(0, 1, 0)
            draw(3, 1, 0)
        else:
            if close_duct:
                draw(4, 1, 0)
            else:
                draw(1, 1, 0)
                draw(3, 1, 0)
            c.enable(gl.BLEND | gl.CULL_FACE)
            c.blend_func = (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            self.target.depth_mask = False
            draw(2, 0.47, 1)
            draw(0, 0.13 if close_duct else (0.24 if xray > 0.8 else 0.56), 1)
            if not close_duct:
                draw(4, 0.72, 1)
            else:
                draw(3, 0.2, 1)
            c.disable(gl.CULL_FACE)
        if flow:
            c.disable(gl.DEPTH_TEST)
            c.enable(gl.BLEND)
            self.target.depth_mask = False
            c.blend_func = (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            self.fp["vp"].write(vpbytes)
            self.fp["clock"].value = t
            self.fp["shaft"].value = angle
            for key in ("freshwater", "seawater") if flow == "water" else (flow,):
                if key not in self.fv:
                    continue
                self.fp["tint"].value = PALETTE[key]
                c.enable(gl.CULL_FACE)
                for event, number, hot_duct, vao in self.fv[key]:
                    if close_duct and not hot_duct:
                        continue
                    strength = 1.0
                    if event:
                        phase = next(
                            cy["firing_deg"]
                            for cy in self.m.kin["cylinders"]
                            if cy["number"] == number
                        )
                        center, width = {
                            "injection": (0, 20),
                            "intake": (450, 84),
                            "exhaust": (270, 84),
                        }[event]
                        delta = (math.degrees(angle) - phase - center + 360) % 720 - 360
                        strength = 0.22 + 0.78 * (
                            1.0 - smooth(width / 2, width, abs(delta))
                        )
                    self.fp["bright"].value = strength
                    vao.render()
                c.disable(gl.CULL_FACE)
            if burn:
                center, h, strength, phase = burn
                self.bp["vp"].write(vpbytes)
                self.bp["center"].value = center
                self.bp["scale"].value = (0.062, h, 0.062)
                self.bp["strength"].value = strength
                self.bp["phase"].value = phase
                self.burn.render()
        self.target.depth_mask = True
        c.copy_framebuffer(self.out, self.target)
        img = Image.frombytes(
            "RGB", (W, H), self.out.read(components=3, alignment=1)
        ).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        return overlay(img, t, s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    args = ap.parse_args()
    r = Renderer()
    DEST.mkdir(parents=True, exist_ok=True)
    if args.preview:
        sheet = Image.new("RGB", (4 * 230, 2 * 345))
        for i, t in enumerate([1.2, 3.5, 5.4, 7.6, 10.9, 12.82, 17.95, 19.73]):
            start = time.perf_counter()
            im = r.render(t)
            print(t, round(time.perf_counter() - start, 3), flush=True)
            im.save(HERE / f"sample-{i}.jpg", quality=92)
            sheet.paste(
                im.resize((230, 345), Image.Resampling.LANCZOS),
                ((i % 4) * 230, (i // 4) * 345),
            )
        sheet.save(HERE / "storyboard.jpg", quality=95)
        return
    assert set(r.fv) == set(PALETTE), "six reviewed systems required"
    video = DEST / "yanmar-6aym-r04.mp4"
    temp = HERE / "rendering.mp4"
    poster = DEST / "yanmar-6aym-r04.jpg"
    poster_temp = HERE / "poster-rendering.jpg"
    ff = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
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
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(temp),
        ],
        stdin=subprocess.PIPE,
    )
    for n in range(round(DURATION * FPS)):
        im = r.render(n / FPS)
        ff.stdin.write(im.tobytes())
        if n == round(4.0 * FPS):
            im.save(poster_temp, quality=92)
        if n % 48 == 0:
            print("Frame", n, flush=True)
    ff.stdin.close()
    if ff.wait():
        raise RuntimeError("ffmpeg failed")
    temp.replace(video)
    poster_temp.replace(poster)
    metadata = {
        "size": [W, H],
        "fps": FPS,
        "duration_s": DURATION,
        "frames": round(DURATION * FPS),
        "source_glb_sha256": r.m.hashes,
        "route_manifest_sha256": r.routehash,
        "kinematics_sha256": hashlib.sha256(
            (ROOT / "model/internal/kinematics.json").read_bytes()
        ).hexdigest(),
        "film_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "poster_sha256": hashlib.sha256(
            (DEST / "yanmar-6aym-r04.jpg").read_bytes()
        ).hexdigest(),
        "route_count": r.routes,
        "video_sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
        "renderer": r.ctx.info["GL_RENDERER"],
    }
    (HERE / "render.json").write_text(json.dumps(metadata, indent=2))
    print(metadata, flush=True)


if __name__ == "__main__":
    main()
