import copy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import motion_scope as motion
import toolkit

REF = [{"path": "doc/fixture", "locator": "Fixture drive diagram"}]
FIXED = {"kind": "fixed", "basis": "DOCUMENTED", "source_refs": REF}
ROTATION = {
    "kind": "rotation",
    "basis": "DOCUMENTED",
    "ratio": 1,
    "phase_deg": 0,
    "bind_phase_deg": 0,
    "axis": [0, 0, 1],
    "origin_m": [1, 0, 0],
    "source_refs": REF,
}


class MotionTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        toolkit.initialize(self.root, "fixture", "shaft", "selected-model")
        self.plan = motion.new_plan("r01")
        self.plan["specialist_agent_id"] = "specialist"
        self.mode = {
            "driver": "shaft",
            "cycle_deg": 360,
            "max_step_deg": 90,
            "position_tolerance_m": 0.0001,
            "angle_tolerance_deg": 0.01,
            "broadphase_margin_m": 0,
            "tolerance_basis": "Synthetic fixture",
            "source_refs": REF,
        }
        self.plan["modes"] = {"run": self.mode}
        self.plan["bodies"] = {
            "fixed": {
                "motion_class": "fixed",
                "mesh_ids": ["case"],
                "source_refs": REF,
                "modes": {"run": FIXED},
            },
            "drive": {
                "motion_class": "rotating",
                "mesh_ids": ["shaft", "nut"],
                "source_refs": REF,
                "modes": {"run": ROTATION},
            },
        }
        self.bounds = {
            "revision": "r01",
            "model_sha256": {},
            "world_bounds_m": {
                "shaft": [[1, 0, 0], [1.01, 0.01, 0.01]],
                "nut": [[1.99, 0, 0], [2.0, 0.01, 0.01]],
                "case": [[0.98, 0.99, 0], [1.02, 1.02, 0.1]],
            },
        }
        for unit, ids in [("exterior", ["case", "nut"]), ("internal", ["shaft"])]:
            path = self.root / "model" / unit / (unit + ".glb")
            path.write_bytes(b"fixture for hash binding")
            toolkit.write_json(
                path.with_name("inventory.json"), {"components": [{"id": k} for k in ids]}
            )
            self.bounds["model_sha256"][unit] = motion.digest(path)
        self.qa = {"revision": "r01", "qa_agent_id": "QA", "modes": {}}
        self.verified = {motion.PLAN, motion.BOUNDS, motion.QA, "doc/fixture", "qa/fixture"}
        self.prepare_modes()

    def prepare_modes(self):
        toolkit.write_json(self.root / motion.PLAN, self.plan)
        toolkit.write_json(self.root / motion.BOUNDS, self.bounds)
        by_mode = motion.candidate_manifest(self.root)["pairs_by_mode"]
        for mode, pairs in by_mode.items():
            phases = [0, 90, 180, 270, 360]
            controls = {k: True for k in ("play", "pause", "resume", "visible_motion_or_rest")}
            measured = {}
            for rec in self.plan["bodies"].values():
                law = rec["modes"][mode]
                matrices = [motion.delta(law, p, i) for i, p in enumerate(phases)]
                for name in rec["mesh_ids"]:
                    measured[name] = copy.deepcopy(matrices)
            trace = {
                "entry": "review/index.html",
                "actual_route": "/private/fixture/",
                "controls": controls,
                "loaded_model_sha256": self.bounds["model_sha256"],
                "phases_deg": phases,
                "evidence": ["qa/fixture"],
                "world_deltas": measured,
            }
            rows = [
                {
                    "pair": pair,
                    "method": "analytic_bound",
                    "result": "separated",
                    "separation_lower_bound_m": 0.01,
                    "evidence": ["qa/fixture"],
                }
                for pair in pairs
            ]
            self.qa["modes"][mode] = {
                "phases_deg": phases,
                "pairs": rows,
                "viewer": {"desktop": trace, "mobile": copy.deepcopy(trace)},
            }

    def inspect(self):
        toolkit.write_json(self.root / motion.PLAN, self.plan)
        toolkit.write_json(self.root / motion.BOUNDS, self.bounds)
        self.qa.update(
            register_sha256=motion.digest(self.root / motion.PLAN),
            bounds_sha256=motion.digest(self.root / motion.BOUNDS),
        )
        toolkit.write_json(self.root / motion.QA, self.qa)
        return motion.inspect(self.root, "r01", self.verified, "QA")

    def test_sourced_register_and_all_measured_followers(self):
        self.assertEqual(self.inspect(), ([], []))
        a = motion.delta(ROTATION, 90, 1)
        self.assertAlmostEqual(a[0][3], 1)
        self.assertAlmostEqual(a[1][3], -1)
        self.assertAlmostEqual(a[1][0], 1)

    def test_sweep_includes_pair_missing_in_assembled_rest_pose(self):
        self.assertNotIn(("case", "nut"), motion.broad_phase(self.bounds["world_bounds_m"], 0))
        mode = self.qa["modes"]["run"]
        rows = mode["pairs"]
        self.assertTrue(any(tuple(r["pair"]) == ("case", "nut") for r in rows))
        mode["pairs"] = [r for r in rows if tuple(r["pair"]) != ("case", "nut")]
        self.assertTrue(any("candidates omitted" in e for e in self.inspect()[0]))

    def test_sourced_contact_never_suppresses_measured_penetration(self):
        row = self.qa["modes"]["run"]["pairs"][0]
        self.plan["contact_interfaces"].append(
            {
                "pair": row["pair"],
                "interface": "inner-bearing",
                "modes": ["run"],
                "surface_features": ["race face", "seat"],
                "source_refs": REF,
            }
        )
        row.update(
            result="boundary_contact",
            interface="inner-bearing",
            surface_features=["race face", "seat"],
            overlap_volume_upper_bound_m3=0,
        )
        self.assertEqual(self.inspect(), ([], []))
        row["penetration_lower_bound_m"] = 0.002
        self.assertIn("FAIL", self.inspect()[1])

    def test_disabled_pair_and_undetected_unsampled_collision_cannot_pass(self):
        row = self.qa["modes"]["run"]["pairs"][0]
        row.update(
            enabled=False,
            method="sampled_solids_with_motion_bound",
            smallest_sampled_gap_m=0.004,
            maximum_unsampled_relative_travel_m=0.01,
        )
        errors, _ = self.inspect()
        self.assertTrue(any("narrow-phase proof" in e for e in errors))
        self.assertTrue(any("bound the interval" in e for e in errors))

    def test_interface_on_wrong_face_and_positive_volume_still_blocked(self):
        row = self.qa["modes"]["run"]["pairs"][0]
        self.plan["contact_interfaces"] = [
            {
                "pair": row["pair"],
                "interface": "seat",
                "modes": ["run"],
                "surface_features": ["seat-face", "shaft-face"],
                "source_refs": REF,
            }
        ]
        row.update(
            result="boundary_contact",
            interface="seat",
            surface_features=["outside wall", "shaft-face"],
            overlap_volume_upper_bound_m3=0,
        )
        self.assertTrue(any("no matching sourced interface" in e for e in self.inspect()[0]))
        row["overlap_volume_lower_bound_m3"] = 1e-8
        self.assertIn("FAIL", self.inspect()[1])

    def test_normal_viewer_entry_and_child_rotation_checked(self):
        trace = self.qa["modes"]["run"]["viewer"]["mobile"]
        trace["entry"] = "/debug/direct-call"
        self.assertTrue(any("normal viewer" in e for e in self.inspect()[0]))
        trace["entry"] = "review/index.html"
        trace["world_deltas"]["nut"][1] = motion.I
        self.assertIn("FAIL", self.inspect()[1])
        self.assertTrue(any("nut" in e for e in self.inspect()[0]))

    def test_local_instead_of_world_pivot_detected(self):
        wrong = dict(ROTATION, origin_m=[0, 0, 0])
        self.qa["modes"]["run"]["viewer"]["desktop"]["world_deltas"]["shaft"][1] = motion.delta(
            wrong, 90, 1
        )
        self.assertIn("FAIL", self.inspect()[1])

    def test_conditional_starter_visible_as_fixed_in_run(self):
        self.plan["modes"]["crank"] = copy.deepcopy(self.mode)
        self.plan["bodies"]["drive"].update(
            motion_class="conditional", modes={"run": FIXED, "crank": ROTATION}
        )
        self.plan["bodies"]["fixed"]["modes"]["crank"] = FIXED
        self.prepare_modes()
        self.assertEqual(self.inspect(), ([], []))
        self.qa["modes"]["run"]["viewer"]["desktop"]["world_deltas"]["shaft"][1] = motion.delta(
            ROTATION, 90, 1
        )
        self.assertIn("FAIL", self.inspect()[1])

    def test_unknown_source_baseline_and_duplicated_mesh_block_review(self):
        rec = self.plan["bodies"]["drive"]
        rec["mesh_ids"].append("case")
        rec["modes"]["run"] = dict(ROTATION, basis="INFERRED")
        errors, statuses = self.inspect()
        self.assertTrue(any("multiple bodies" in e for e in errors))
        self.assertIn("UNVERIFIED", statuses)
