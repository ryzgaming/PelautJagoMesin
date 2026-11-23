"""Contract tests with synthetic project files and an actual local fixture subprocess."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("alur_runner", ROOT / "public/runner.py")
runner = importlib.util.module_from_spec(SPEC)
with patch.object(sys, "dont_write_bytecode", True):
    SPEC.loader.exec_module(runner)
real_sleep = time.sleep


def put(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def fixture_run(project, status="REVIEW_READY"):
    """Produce native-shaped files for assertions; not a CAD or live AI run."""
    run = project / "runs/1001"
    for role in runner.ROLES:
        name = "flow-" + role if role in runner.FLOWS else role
        folder = run / ("r00" if role in ("evidence", *runner.FLOWS) else "r01") / name
        put(folder / "process.log", "fixture")
        put(folder / "answer.txt", "finished")
        put(folder / "output" / runner.REPORTS.get(role, "flow.json"), {
            "status": "NOT_APPLICABLE" if role == "fuel" else "DOCUMENTED",
            "applicability": {"status": "DOES_NOT_APPLY", "source_refs": [{"source_id": "fixture"}]},
        })
    out = run / "r01/integrator/output"
    put(out / "review/system-flows/index.html", "fixture")
    for role in runner.FLOWS:
        put(out / f"review/system-flows/{role}.json", {"system": role})
    put(out / "system-flow-review.json", {"fixture": True})
    hashes = {p.relative_to(out).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in out.rglob("*") if p.is_file()}
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    report = run / "r01/qa/output/qa.json"
    put(report, {"status": "PASS" if status == "REVIEW_READY" else "UNVERIFIED", "artifact_hashes": hashes})
    put(project / "state.json", {"run": "runs/1001", "system_flows": True, "status": status,
        "round": 1, "artifact": out.relative_to(project).as_posix(), "qa": report.relative_to(project).as_posix(),
        "manifest_digest": digest})


class FakeAPI:
    def __init__(self):
        self.calls = []
        self.job_id = str(uuid4())
        self.claim = {"id": self.job_id, "project_key": "kapal", "status": "running",
                      "command": "must never run from RPC", "project": "/fake-remote-input"}
        self.lose_claim_reply = True
        self.interrupt_terminal = False

    def rpc(self, method, data):
        self.calls.append((method, data))
        if method == "claim_agent_job":
            if self.lose_claim_reply:
                self.lose_claim_reply = False
                raise runner.NetworkIssue()
            return self.claim
        if data["p_status"] in ("review", "failed") and self.interrupt_terminal:
            self.interrupt_terminal = False
            raise KeyboardInterrupt()
        return {}


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.source = self.base / "machine"
        put(self.source / "machine.json", {"name": "motor", "model": "fixture"})
        put(self.source / "sources/catalogue.json", {"private": "source-body"})
        self.control = self.source / ".alur-runner"
        self.control.mkdir()
        self.journal = self.control / "journal.json"
        self.production = self.base / "production.py"
        self.production.write_text(
            "import sys,os\nfrom pathlib import Path\n"
            f"sys.path.insert(0, {str(Path(__file__).resolve().parent)!r})\n"
            "from test_runner import fixture_run\n"
            "assert sys.argv[1::2] == ['run', '--system-flows']\n"
            "assert 'ALUR_PASSWORD' not in os.environ\n"
            "product = Path(sys.argv[2])\n"
            "with (product.parent/'fixture-executions').open('a') as log: log.write('1')\n"
            "fixture_run(product)\n"
        )

    def run_one(self, api):
        with patch.object(runner.time, "sleep", side_effect=lambda _: real_sleep(0.02)):
            return runner.process_one(api, "kapal", self.source, self.production, self.control, self.journal)

    def test_actual_subprocess_retry_crash_and_resume(self):
        api = FakeAPI()
        api.interrupt_terminal = True
        with patch.dict(os.environ, {"ALUR_PASSWORD": "not-in-worker-env"}):
            with self.assertRaises(KeyboardInterrupt):
                self.run_one(api)
        record = runner.read(self.journal)
        self.assertNotIn("not-in-worker", self.journal.read_text())
        self.assertTrue(self.run_one(api))
        claims = [p for method, p in api.calls if method == "claim_agent_job"]
        self.assertEqual(len(claims), 2)
        self.assertEqual(claims[0], claims[1])
        job = self.control / "jobs" / api.job_id
        self.assertEqual((job / "fixture-executions").read_text(), "1")
        self.assertEqual(runner.read(job / "exit.json"), {"executed": True, "returncode": 0})
        self.assertEqual(api.calls[-1][1], api.calls[-2][1])
        self.assertEqual(record["terminal"]["p_note"], "review_ready")
        self.assertEqual(record["terminal"]["p_progress"]["fuel"], "not_applicable")
        for method, data in api.calls:
            if method == "update_agent_job":
                self.assertEqual(set(data), {"p_job_id", "p_claim_token", "p_status", "p_note", "p_progress"})
        self.assertNotIn("source-body", json.dumps(api.calls))
        self.assertFalse(self.journal.exists())

    def test_second_monitor_reconnects_while_child_runs(self):
        api = FakeAPI()
        job = self.control / "jobs" / api.job_id
        job.mkdir(parents=True)
        put(self.journal, {"token": str(uuid4()), "job": api.job_id})
        self.production.write_text("import time; time.sleep(0.30)\n" + self.production.read_text())
        first = runner.start_monitor(self.source, self.production, job)
        try:
            for _ in range(150):
                if (job / "started.json").exists():
                    break
                real_sleep(0.02)
            self.assertTrue((job / "started.json").exists())
            self.assertTrue(self.run_one(api))
            self.assertEqual((job / "fixture-executions").read_text(), "1")
            self.assertFalse(any(method == "claim_agent_job" for method, _ in api.calls))
        finally:
            first.wait(timeout=10)

    def test_fresh_snapshot_skips_previous_outputs(self):
        fixture_run(self.source)
        put(self.source / "owner-approval.json", {"approved": True})
        dest = self.base / "snapshot"
        runner.snapshot(self.source, dest)
        self.assertEqual(sorted(p.name for p in dest.iterdir()), ["machine.json", "sources"])
        if os.name != "nt":
            (self.source / "sources/escape").symlink_to(self.base)
            with self.assertRaises(ValueError):
                runner.snapshot(self.source, self.base / "refuse")

    def test_foreign_claim_cannot_launch(self):
        api = FakeAPI()
        api.claim["project_key"] = "../other"
        with self.assertRaises(ValueError):
            self.run_one(api)
        self.assertFalse((self.control / "jobs").exists())

    def test_crashed_supervisor_is_not_rerun(self):
        job = self.base / "interrupted"
        job.mkdir()
        put(job / "started.json", {"supervisor": 0})
        runner.supervise(self.source, self.production, job)
        self.assertEqual(runner.read(job / "exit.json"), {"executed": False, "returncode": None})
        self.assertFalse((job / "fixture-executions").exists())

    def test_nonzero_exit_wins_over_stale_review_state(self):
        job = self.base / "job"
        fixture_run(job / "project")
        for exit_status in ({"executed": False, "returncode": 0}, {"executed": True, "returncode": 8}):
            put(job / "exit.json", exit_status)
            self.assertEqual(runner.terminal(job, runner.observed(job / "project"))[0], "failed")

    def test_review_with_gaps_and_changed_manifest(self):
        job = self.base / "job"
        project = job / "project"
        fixture_run(project, "REVIEW_WITH_GAPS")
        put(job / "exit.json", {"executed": True, "returncode": 0})
        self.assertEqual(runner.terminal(job, runner.observed(project)), ("review", "review_with_gaps"))
        put(project / "runs/1001/r01/integrator/output/review/index.html", "changed")
        self.assertEqual(runner.terminal(job, runner.observed(project))[0], "failed")
        doc = runner.read(project / "state.json")
        doc["run"] = "../other"
        put(project / "state.json", doc)
        with self.assertRaises(ValueError):
            runner.verify_review(project)

    def test_repair_rounds_keep_completed_milestones(self):
        fixture_run(self.source)
        seen = runner.observed(self.source)
        for role in ("exterior", "internals", "integrator", "qa"):
            put(self.source / f"runs/1001/r02/{role}/process.log", "second round")
        latest = runner.observed(self.source)
        self.assertEqual(latest["exterior"], "running")
        self.assertEqual(runner.milestones(latest, seen), seen)

    def test_auth_refresh_on_expiry_and_rpc_401(self):
        api = runner.Supabase("https://example.invalid", "public", "local", "password")
        grants = []
        rpc_calls = []
        def send(path, data, *, user=False):
            if user:
                rpc_calls.append(api.access)
                if len(rpc_calls) == 2:
                    raise runner.HttpFailure(401)
                return {"ok": True}
            grants.append((path, data))
            return {"access_token": f"a{len(grants)}", "refresh_token": f"r{len(grants)}", "expires_in": 3600}
        with patch.object(api, "post", side_effect=send):
            api.rpc("claim_agent_job", {})
            api.rpc("claim_agent_job", {})
            api.until = 0
            api.rpc("claim_agent_job", {})
        self.assertEqual(rpc_calls, ["a1", "a1", "a2", "a3"])
        self.assertEqual([d.get("refresh_token") for _, d in grants], [None, "r1", "r2"])
        for url in ("http://unsafe", "https://user:password@x", "https://host/evil", "https://host/?x"):
            with self.assertRaises(ValueError):
                runner.validate_origin(url)


if __name__ == "__main__":
    unittest.main()
