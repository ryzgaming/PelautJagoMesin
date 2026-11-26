"""Fixture tests for the cloud worker handoff and artifact receipt."""
import copy
import hashlib
import json
from pathlib import Path
import re
import struct
import tempfile
import unittest
from uuid import uuid4

import hosted_worker as worker


def uid():
    return str(uuid4())


def glb(path, *, vertices=3):
    doc = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
           "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}], "buffers": [{"byteLength": 36}],
           "bufferViews": [{"buffer": 0, "byteLength": 36}], "accessors": [{"bufferView": 0,
           "componentType": 5126, "type": "VEC3", "count": vertices}]}
    meta = json.dumps(doc).encode()
    meta += b" " * (-len(meta) % 4)
    data = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    path.write_bytes(struct.pack("<4sIIII", b"glTF", 2, 28 + len(meta) + len(data), len(meta), 0x4e4f534a)
                     + meta + struct.pack("<I4s", len(data), b"BIN\0") + data)


class HostedWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.owner, self.sid, self.old = uid(), uid(), uid()
        self.claim = {"id": self.sid, "brand": "Fixture", "model": "../../; SQL ' π",
                      "machine_key": '["fixture","../../; sql π"]', "status": "running", "source_leads": None}
        self.previous = dict(self.claim, id=self.old, status="needs_evidence")
        self.packet = {"owner_id": self.owner, "session": self.claim, "history": {"account_id": self.owner,
            "session": self.claim, "memory": [], "previous_sessions": [self.previous],
            "previous_memory": [{"role": "internals", "session_id": self.old, "status": "PARTIAL",
                                 "summary": "Gasket figure cropped", "open_questions": ["Locate correct page."]}],
            "canonical_memory": []}, "claim_token": "not-for-workers"}

    def test_memory_restored_for_all_roles(self):
        folder = worker.prepare(self.root, self.packet)
        self.assertEqual(folder, self.root / self.owner / self.sid)
        self.assertEqual({p.name for p in (folder / "roles").iterdir()}, set(worker.ROLES))
        context = json.loads((folder / "roles/internals/context.json").read_text())
        self.assertEqual(context["previous_attempt"]["open_questions"], ["Locate correct page."])
        self.assertIsNone(context["canonical"])
        self.assertNotIn("not-for-workers", (folder / "context.json").read_text())
        (folder / "roles/internals/result.txt").write_text("keep")
        worker.prepare(self.root, self.packet)
        self.assertEqual((folder / "roles/internals/result.txt").read_text(), "keep")

    def test_revision_is_delivered_to_each_role(self):
        self.claim.update(source_product="tanabe-h74", revision_brief="Periksa panel di HP.")
        folder = worker.prepare(self.root, self.packet)
        for role in worker.ROLES:
            task = json.loads((folder / "roles" / role / "context.json").read_text())["revision_task"]
            self.assertEqual(task["workspace"], "/workspace?product=tanabe-h74")
            self.assertEqual(task["brief"], "Periksa panel di HP.")

    def test_flow_brief_is_required_and_delivered_to_each_role(self):
        brief = {"version": 1, "flow_id": "bagan-1", "flow_name": "DRCE", "prompt": "MASTER PROMPT",
                 "tasks": [{"task": "Buat model 3D blok silinder", "agents": ["3D Modeling"]}],
                 "rules": ["Jangan menebak part number"], "unmatched": []}
        self.claim["flow_brief_info"] = {"flow_name": "DRCE", "tasks": 1, "rules": 1}
        with self.assertRaisesRegex(ValueError, "belum dibaca"):
            worker.prepare(self.root, self.packet)
        with self.assertRaisesRegex(ValueError, "tidak cocok"):
            worker.prepare(self.root, dict(self.packet, flow_brief=dict(brief, rules=[])))
        folder = worker.prepare(self.root, dict(self.packet, flow_brief=brief))
        self.assertEqual(json.loads((folder / "flow-brief.json").read_text()), brief)
        shared = json.loads((folder / "context.json").read_text())["flow_brief"]
        self.assertEqual((shared["file"], shared["tasks"], shared["rules"]), ("flow-brief.json", 1, 1))
        for role in worker.ROLES:
            ref = json.loads((folder / "roles" / role / "context.json").read_text())["flow_brief"]
            self.assertEqual(ref["file"], "../../flow-brief.json")
            self.assertEqual(ref["sha256"], shared["sha256"])
        del self.claim["flow_brief_info"]
        with self.assertRaisesRegex(ValueError, "tidak memiliki brief"):
            worker.prepare(self.root, dict(self.packet, flow_brief=brief))

    def test_flow_brief_rpc_is_fixed_and_encoded(self):
        sid, token = uid(), uid()
        query = worker.sql("brief", {"session_id": sid, "claim_token": token})
        self.assertIn("alur_machine_private.read_flow_brief((v->>'session_id')::uuid,(v->>'claim_token')::uuid)", query)
        self.assertNotIn(sid, query)
        with self.assertRaises(ValueError):
            worker.sql("brief", {"session_id": sid})

    def test_history_must_be_same_owner_machine_and_session(self):
        mutations = ((("history", "account_id"), uid()), (("history", "previous_sessions", 0, "machine_key"), "other"),
                     (("history", "previous_memory", 0, "session_id"), uid()),
                     (("history", "previous_memory", 0, "account_id"), uid()))
        for keys, value in mutations:
            packet = copy.deepcopy(self.packet)
            target = packet
            for k in keys[:-1]:
                target = target[k]
            target[keys[-1]] = value
            with self.subTest(keys=keys), self.assertRaises(ValueError):
                worker.prepare(self.root, packet)

    def test_older_canonical_requires_verified_origin(self):
        older = uid()
        row = {"role": "exterior", "session_id": older, "status": "DOCUMENTED", "summary": "sourced dimension"}
        self.packet["history"]["canonical_memory"].append(row)
        with self.assertRaises(ValueError):
            worker.prepare(self.root, self.packet)
        self.packet["older_histories"] = [{"account_id": self.owner, "session": dict(self.previous, id=older)}]
        folder = worker.prepare(self.root, self.packet)
        self.assertEqual(json.loads((folder / "roles/exterior/context.json").read_text())["canonical"], row)
        row["status"] = "PARTIAL"
        with self.assertRaises(ValueError):
            worker.prepare(self.root, self.packet)

    def test_foreign_destination_symlink_refused(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / self.owner).symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            worker.prepare(self.root, self.packet)
        self.assertFalse(list(outside.iterdir()))

    def test_rpc_only_fixed_calls_and_encoded_values(self):
        sentence = "Q'); DROP TABLE x; --\nμ"
        payload = {"session_id": self.sid, "claim_token": uid(), "role": "qa", "summary": sentence,
                   "sources": [], "decisions": [], "open_questions": [], "status": "PARTIAL"}
        query = worker.sql("checkpoint", payload)
        self.assertNotIn(self.sid, query)
        self.assertNotIn(sentence, query)
        self.assertIn("alur_machine_private.write_checkpoint(", query)
        packed = re.search(r"decode\('([0-9a-f]+)'", query).group(1)
        self.assertEqual(json.loads(bytes.fromhex(packed)), payload)
        with self.assertRaises(ValueError):
            worker.sql("history", {"session_id": self.sid, "extra": "unsafe"})
        with self.assertRaises(KeyError):
            worker.sql("anything", {})

    def test_activity_log_is_short_safe_and_encoded(self):
        token = uid()
        query = worker.sql("log", {"session_id": self.sid, "claim_token": token, "kind": "open",
                                    "message": "  Membuka\nmanual  " + "x" * 300, "url": "https://cat.com/3512c"})
        self.assertIn("alur_machine_private.log_activity(", query)
        packed = json.loads(bytes.fromhex(re.search(r"decode\('([0-9a-f]+)'", query).group(1)))
        self.assertTrue(packed["message"].startswith("Membuka manual x"))
        self.assertEqual(len(packed["message"]), 200)
        self.assertEqual(packed["url"], "https://cat.com/3512c")
        for bad in ("http://cat.com", "javascript:alert(1)", "https://a.b/<x>"):
            q = worker.sql("log", {"session_id": self.sid, "claim_token": token, "kind": "open", "message": "x", "url": bad})
            self.assertIsNone(json.loads(bytes.fromhex(re.search(r"decode\('([0-9a-f]+)'", q).group(1)))["url"])
        no_url = worker.sql("log", {"session_id": self.sid, "claim_token": token, "kind": "think", "message": "Menimbang"})
        self.assertIn("log_activity(", no_url)
        with self.assertRaises(ValueError):
            worker.sql("log", {"session_id": self.sid, "claim_token": token, "kind": "hack", "message": "x"})
        with self.assertRaises(ValueError):
            worker.sql("log", {"session_id": self.sid, "claim_token": token, "kind": "info", "message": "  "})

    def test_manifest_changes_when_bytes_change(self):
        (self.root / "index.html").write_text("<canvas></canvas>")
        glb(self.root / "machine.glb")
        receipt = worker.manifest(self.root)
        self.assertEqual(receipt["models"]["machine.glb"], {"meshes": 1, "position_values": 3})
        self.assertEqual(receipt["files"]["machine.glb"]["sha256"],
                         hashlib.sha256((self.root / "machine.glb").read_bytes()).hexdigest())
        (self.root / "index.html").write_text("<canvas id='a'></canvas>")
        self.assertNotEqual(worker.manifest(self.root)["sha256"], receipt["sha256"])

    def test_manifest_refuses_missing_mesh_and_out_of_bounds_accessor(self):
        (self.root / "index.html").touch()
        with self.assertRaises(ValueError):
            worker.manifest(self.root)
        (self.root / "index.html").write_text("<canvas></canvas>")
        glb(self.root / "bad.glb", vertices=42)
        with self.assertRaises(ValueError):
            worker.manifest(self.root)


if __name__ == "__main__":
    unittest.main()
