"""Audit installed motion, swept broad phase and evidence from the normal viewer entry point."""

import itertools
import math

from assembly_scope import digest, load

PLAN = "model/motion/register.json"
BOUNDS = "qa/motion-bounds.json"
QA = "qa/motion-inspection.json"
PROFILE = "spesialis_kinematika_benturan"
I = [[float(i == j) for j in range(4)] for i in range(4)]


def new_plan(revision):
    return {
        "revision": revision,
        "frame": "gltf_world_m",
        "specialist_agent_id": None,
        "modes": {},
        "bodies": {},
        "contact_interfaces": [],
    }


def task(root):
    plan = load(root / PLAN)
    return {
        "domain": "kinematika_benturan",
        "profile": PROFILE,
        "title": "Kinematika dan interferensi",
        "workspace": str(root.resolve()),
        "revision": plan["revision"],
        "plan": PLAN,
    }


def finite(x):
    return type(x) in (int, float) and math.isfinite(x)


def vector(v, size=3):
    return isinstance(v, list) and len(v) == size and all(finite(x) for x in v)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def rigid(m):
    if (
        not isinstance(m, list)
        or len(m) != 4
        or not all(vector(row, 4) for row in m)
        or any(abs(x - y) > 1e-6 for x, y in zip(m[3], I[3]))
    ):
        return False
    a, b, c = [row[:3] for row in m[:3]]
    cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    return (
        all(abs(dot(v, v) - 1) < 1e-5 for v in (a, b, c))
        and abs(dot(a, b)) < 1e-5
        and all(abs(x - y) < 1e-5 for x, y in zip(cross, c))
    )


def delta(law, phase, index):
    """Row-major rigid transform relative to the installed bind pose."""
    kind = law["kind"]
    if kind == "fixed":
        return I
    if kind == "poses":
        pose = law["poses"][index]
        if pose["driver_deg"] != phase or not rigid(pose["delta"]):
            raise ValueError("Invalid sampled phase or non-rigid pose")
        return pose["delta"]
    if kind != "rotation":
        raise ValueError("Unverified motion law")
    u, origin = law["axis"], law["origin_m"]
    ratio, offset, bind = law["ratio"], law["phase_deg"], law["bind_phase_deg"]
    if (
        not vector(u)
        or abs(dot(u, u) - 1) > 1e-6
        or not vector(origin)
        or not all(finite(v) for v in (ratio, offset, bind))
        or ratio == 0
    ):
        raise ValueError("Invalid rotation axis, pivot, ratio or phase")
    angle = math.radians(offset - bind + ratio * phase)
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = u
    skew = [[0, -z, y], [z, 0, -x], [-y, x, 0]]
    rot = [[(i == j) * c + (1 - c) * u[i] * u[j] + s * skew[i][j] for j in range(3)] for i in range(3)]
    return [row + [origin[i] - dot(row, origin)] for i, row in enumerate(rot)] + [I[3]]


def near_pose(expected, observed, xyz_tolerance, angle_tolerance):
    if not rigid(observed):
        return False
    if math.dist([row[3] for row in expected[:3]], [row[3] for row in observed[:3]]) > xyz_tolerance:
        return False
    trace = sum(dot(e[:3], o[:3]) for e, o in zip(expected[:3], observed[:3]))
    angle = math.degrees(math.acos(max(-1, min(1, (trace - 1) / 2))))
    return angle <= angle_tolerance


def box_envelope(box, law):
    low, high = box
    if not vector(low) or not vector(high) or any(a > b for a, b in zip(low, high)):
        raise ValueError("Invalid installed GLB bounds")
    if law["kind"] == "fixed":
        return box
    corners = list(itertools.product(*zip(low, high)))
    if law["kind"] == "rotation":
        # Full orbit of all eight corners: conservative even if only an arc is used.
        u, origin = law["axis"], law["origin_m"]
        bands = []
        for p in corners:
            h = dot([v - o for v, o in zip(p, origin)], u)
            center = [o + h * n for o, n in zip(origin, u)]
            radius = math.dist(p, center)
            bands.append(
                [
                    (
                        c - radius * math.sqrt(max(0, 1 - n * n)),
                        c + radius * math.sqrt(max(0, 1 - n * n)),
                    )
                    for c, n in zip(center, u)
                ]
            )
        return [
            [(min if j == 0 else max)(band[i][j] for band in bands) for i in range(3)] for j in range(2)
        ]
    if law.get("interpolation") != "linear_translation_slerp":
        raise ValueError("Swept bound for this position interpolation is unknown")
    # Bounds of linearly interpolated translations plus a sphere for every rigid orientation.
    radius = max(math.sqrt(dot(c, c)) for c in corners)
    t = [[row[3] for row in p["delta"][:3]] for p in law["poses"]]
    return [
        [min(p[i] for p in t) - radius for i in range(3)],
        [max(p[i] for p in t) + radius for i in range(3)],
    ]


def broad_phase(boxes, margin):
    """Sweep-and-prune includes static/static, attached pairs and candidates between poses."""
    active, pairs = [], set()
    for name, (low, high) in sorted(boxes.items(), key=lambda item: item[1][0][0]):
        active = [(k, a, b) for k, a, b in active if b[0] + margin >= low[0]]
        for k, a, b in active:
            if all(b[i] + margin >= low[i] and high[i] + margin >= a[i] for i in (1, 2)):
                pairs.add(tuple(sorted((name, k))))
        active.append((name, low, high))
    return pairs


def candidate_manifest(root):
    plan, bounds = load(root / PLAN), load(root / BOUNDS)
    if bounds["revision"] != plan["revision"]:
        raise ValueError("Stale bounds for motion candidate generation")
    result = {}
    for mode, spec in plan["modes"].items():
        boxes = {}
        for body in plan["bodies"].values():
            law = body["modes"][mode]
            if law["kind"] == "unknown":
                raise ValueError("Resolve unknown motion before enumerating swept pairs")
            for part in body["mesh_ids"]:
                boxes[part] = box_envelope(bounds["world_bounds_m"][part], law)
        if boxes.keys() != bounds["world_bounds_m"].keys():
            raise ValueError("Every installed mesh must appear in the motion register")
        result[mode] = sorted(broad_phase(boxes, spec["broadphase_margin_m"]))
    return {"revision": plan["revision"], "pairs_by_mode": result}


def inspect(root, revision, verified, qa_id):
    if not {PLAN, BOUNDS, QA} <= verified:
        return ["Missing bound motion register, installed bounds or independent inspection"], [
            "UNVERIFIED"
        ]
    plan, bounds, qa = (load(root / p) for p in (PLAN, BOUNDS, QA))
    errors, statuses = [], []

    def sourced(row):
        refs = row.get("source_refs", [])
        return bool(refs) and all(ref.get("path") in verified and ref.get("locator") for ref in refs)

    def fail(reason):
        errors.append(reason)
        statuses.append("FAIL")

    if (
        any(d.get("revision") != revision for d in (plan, bounds, qa))
        or plan.get("frame") != "gltf_world_m"
        or qa.get("qa_agent_id") != qa_id
        or not qa_id
        or not plan.get("specialist_agent_id")
        or plan.get("specialist_agent_id") == qa_id
        or qa.get("register_sha256") != digest(root / PLAN)
        or qa.get("bounds_sha256") != digest(root / BOUNDS)
    ):
        errors.append("Stale or unowned motion evidence")
    names = set()
    for unit in ("exterior", "internal"):
        path = root / "model" / unit / (unit + ".glb")
        if bounds["model_sha256"].get(unit) != digest(path):
            errors.append(f"Installed bounds are stale for {unit}")
        ids = [r["id"] for r in load(path.with_name("inventory.json"))["components"]]
        if len(set(ids)) != len(ids) or names.intersection(ids):
            errors.append("Ambiguous mesh identities across inventory")
        names.update(ids)
    boxes = bounds["world_bounds_m"]
    owners = {}
    bodies, modes = plan["bodies"], plan["modes"]
    if not bodies or not modes:
        return errors + ["Empty motion classification or operating modes"], ["UNVERIFIED"]
    for body, record in bodies.items():
        ids = record["mesh_ids"]
        if not ids or not sourced(record) or set(record["modes"]) != set(modes):
            errors.append("Unsourced body or missing mode: " + body)
        kinds = {law["kind"] for law in record["modes"].values()}
        classification = record.get("motion_class")
        if (
            classification == "fixed"
            and kinds != {"fixed"}
            or classification == "rotating"
            and kinds != {"rotation"}
            or classification == "linkage"
            and kinds != {"poses"}
            or classification == "conditional"
            and len(modes) < 2
            or classification not in ("fixed", "rotating", "linkage", "conditional")
        ):
            errors.append("Inconsistent installed motion classification: " + body)
        for part in ids:
            if part in owners:
                errors.append("Mesh assigned to multiple bodies: " + part)
            owners[part] = body
    if not names or names != set(boxes) or names != set(owners):
        return errors + ["Every installed mesh needs exactly one motion body and bound"], ["UNVERIFIED"]
    if any(qa.get(k) for k in ("ignored_pairs", "excluded_mesh_ids", "disabled_collisions")):
        errors.append("Collision exclusions cannot certify installed motion")
    contacts = {}
    for rule in plan.get("contact_interfaces", []):
        pair = tuple(sorted(rule["pair"]))
        allowed_modes = rule.get("modes", [])
        if (
            len(pair) != 2
            or pair[0] == pair[1]
            or not set(pair) <= names
            or not rule.get("interface")
            or not sourced(rule)
            or not allowed_modes
            or not set(allowed_modes) <= set(modes)
            or not rule.get("surface_features")
        ):
            errors.append("Unsubstantiated contact interface: " + str(pair))
        for allowed_mode in allowed_modes:
            contacts[(pair, allowed_mode, rule.get("interface"))] = rule
    if set(qa["modes"]) != set(modes):
        errors.append("Operating mode omitted or invented")
    for mode, spec in modes.items():
        independent = qa["modes"][mode]
        phases = independent["phases_deg"]
        cycle, step = spec["cycle_deg"], spec["max_step_deg"]
        if (
            not sourced(spec)
            or not spec.get("driver")
            or not finite(cycle)
            or cycle <= 0
            or not finite(step)
            or step <= 0
            or not vector(phases, len(phases))
            or len(phases) < 3
            or phases[0] != 0
            or phases[-1] != cycle
            or any(not 0 < b - a <= step + 1e-8 for a, b in zip(phases, phases[1:]))
        ):
            errors.append("Incomplete source cycle or sampled phase coverage: " + mode)
            continue
        pos_tol, ang_tol = spec["position_tolerance_m"], spec["angle_tolerance_deg"]
        if (
            not all(finite(v) and v > 0 for v in (pos_tol, ang_tol))
            or not spec.get("tolerance_basis")
            or not finite(spec["broadphase_margin_m"])
            or spec["broadphase_margin_m"] < 0
        ):
            errors.append("Unexplained motion tolerance: " + mode)
            continue
        swept, expected = {}, {}
        for body, rec in bodies.items():
            law = rec["modes"][mode]
            if law.get("kind") == "unknown" or not sourced(law):
                errors.append("Unverified driven state: " + body + "/" + mode)
                continue
            if law.get("basis") not in ("OBSERVED", "DOCUMENTED"):
                statuses.append("UNVERIFIED")
            series = [delta(law, p, i) for i, p in enumerate(phases)]
            if law["kind"] == "rotation" and any(
                abs((b - a) * law["ratio"]) >= 180 for a, b in zip(phases, phases[1:])
            ):
                errors.append("Angular sampling aliases drive direction or ratio: " + body)
            if law["kind"] != "fixed" and all(
                near_pose(series[0], v, pos_tol, ang_tol) for v in series[1:]
            ):
                errors.append("Moving body appears fixed at all comparison phases: " + body)
            for part in rec["mesh_ids"]:
                swept[part] = box_envelope(boxes[part], law)
                expected[part] = series
        if set(swept) != names:
            continue
        candidates = broad_phase(swept, spec["broadphase_margin_m"])
        covered = set()
        for check in independent["pairs"]:
            pair = tuple(sorted(check["pair"]))
            if pair in covered or len(pair) != 2:
                errors.append("Ambiguous pair decision: " + str(pair))
            covered.add(pair)
            resolution = check.get("result")
            if (
                check.get("enabled") is False
                or check.get("skip")
                or check.get("ignore")
                or check.get("method")
                not in (
                    "continuous_solid",
                    "analytic_bound",
                    "swept_separation",
                    "sampled_solids_with_motion_bound",
                )
                or not check.get("evidence")
                or not set(check["evidence"]) <= verified
            ):
                errors.append("Missing swept narrow-phase proof: " + str(pair))
            if check.get("method") == "sampled_solids_with_motion_bound":
                bound = check.get("maximum_unsampled_relative_travel_m")
                gap = check.get("smallest_sampled_gap_m")
                if (
                    not finite(bound)
                    or bound < 0
                    or not finite(gap)
                    or gap <= bound
                    or resolution != "separated"
                ):
                    errors.append("Discrete poses do not bound the interval: " + str(pair))
            if resolution == "separated" and not (
                finite(check.get("separation_lower_bound_m")) and check["separation_lower_bound_m"] > 0
            ):
                errors.append("Missing positive separation bound: " + str(pair))
            if resolution == "penetration" or any(
                finite(check.get(metric)) and check[metric] > 0
                for metric in ("penetration_lower_bound_m", "overlap_volume_lower_bound_m3")
            ):
                fail("Positive-volume or positive-depth interference: " + str(pair))
            elif resolution == "boundary_contact":
                if (
                    check.get("overlap_volume_upper_bound_m3") != 0
                    or type(check.get("overlap_volume_upper_bound_m3")) is bool
                ):
                    errors.append("Contact has no bound ruling out solid overlap: " + str(pair))
                rule = contacts.get((pair, mode, check.get("interface")))
                if rule is None or check.get("surface_features") != rule.get("surface_features"):
                    errors.append("Boundary contact has no matching sourced interface: " + str(pair))
            elif resolution != "separated":
                errors.append("Unresolved swept pair: " + str(pair))
        if candidates != covered:
            errors.append(
                f"{mode}: swept candidates omitted or extra pairs ({len(candidates-covered)} missing)"
            )
        for device in ("desktop", "mobile"):
            trace = independent.get("viewer", {}).get(device, {})
            evidence = trace.get("evidence", [])
            controls = trace.get("controls", {})
            if (
                trace.get("entry") != "review/index.html"
                or not trace.get("actual_route")
                or any(
                    controls.get(k) is not True
                    for k in ("play", "pause", "resume", "visible_motion_or_rest")
                )
                or not evidence
                or not set(evidence) <= verified
                or set(trace.get("world_deltas", {})) != names
            ):
                errors.append("Missing normal viewer evidence: " + mode + "/" + device)
                continue
            if (
                trace.get("loaded_model_sha256") != bounds["model_sha256"]
                or trace.get("phases_deg") != phases
            ):
                errors.append("Viewer model hashes or comparison phases differ: " + mode + "/" + device)
                continue
            for part, series in expected.items():
                observed = trace["world_deltas"][part]
                if isinstance(observed, str):
                    observed = trace["measured_series"][observed]
                if len(observed) != len(series) or any(
                    not near_pose(a, b, pos_tol, ang_tol) for a, b in zip(series, observed)
                ):
                    fail(
                        "Viewer pose, ratio, phase, pivot or follower differs: "
                        + mode
                        + "/"
                        + device
                        + "/"
                        + part
                    )
    return errors, statuses
