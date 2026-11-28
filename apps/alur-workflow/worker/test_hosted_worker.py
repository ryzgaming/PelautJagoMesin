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

    def test_production_model_and_budget_reach_all_roles(self):
        for model in ("gpt-6.2-sol", "gpt-6.2-astra", "gpt-6.1-terra", "gpt-6-luna", "claude-opus-5-5"):
            options = {"ai_model": model, "budget_usd": 25}
            self.claim.update(options)
            folder = worker.prepare(self.root, self.packet)
            self.assertEqual(json.loads((folder / "context.json").read_text())["production_options"], options)
            for role in worker.ROLES:
                self.assertEqual(json.loads((folder / "roles" / role / "context.json").read_text())["production_options"], options)

    def test_production_options_must_match_history(self):
        self.claim.update(ai_model="gpt-6.2-sol", budget_usd=25)
        self.packet["history"]["session"] = dict(self.claim, ai_model="claude-opus-5-5")
        with self.assertRaisesRegex(ValueError, "Opsi produksi"):
            worker.prepare(self.root, self.packet)

    def test_codex_guide_is_delivered_to_all_roles_with_hash(self):
        self.claim.update(worker="codex")
        folder = worker.prepare(self.root, self.packet)
        guide = folder / "production-guide.json"
        digest = hashlib.sha256(guide.read_bytes()).hexdigest()
        data = json.loads(guide.read_text())
        self.assertIn("PROMPT-GPT.md", data)
        self.assertIn("QA", data["PROMPT-GPT.md"])
        specialists = json.loads(data["specialists.json"])
        self.assertIn("pendingin_penukar_panas", specialists)
        for profile in ["referensi_visual", "pemodel_eksterior", "qa_visual_viewer",
                        *(row["profile"] for row in specialists.values())]:
            self.assertIn("developer_instructions", data[f".codex/agents/{profile}.toml"])
        self.assertNotIn("not-for-workers", guide.read_text())
        for role in worker.ROLES:
            context = json.loads((folder / "roles" / role / "context.json").read_text())
            self.assertEqual(context["production_guide"], {"file": "../../production-guide.json", "sha256": digest})

    def brief_parts(self, brief, size=40):
        """Tiru read_flow_brief: teks brief dipotong per bagian, digest dihitung server."""
        text = json.dumps(brief, ensure_ascii=False)
        chunks = [text[i:i + size] for i in range(0, len(text), size)]
        digest = worker.sha256_text(text)
        info = {"flow_name": brief["flow_name"], "tasks": len(brief["tasks"]), "rules": len(brief["rules"]),
                "sha256": digest, "parts": len(chunks)}
        parts = [{"part": i, "parts": len(chunks), "sha256": digest, "text": c, "part_sha256": worker.sha256_text(c)}
                 for i, c in enumerate(chunks)]
        return info, parts

    def test_flow_brief_parts_are_verified_and_delivered_to_each_role(self):
        brief = {"version": 1, "flow_id": "bagan-1", "flow_name": "DRCE", "prompt": "MASTER PROMPT — standar ✓",
                 "tasks": [{"task": "Buat model 3D blok silinder", "agents": ["3D Modeling"]}],
                 "rules": ["Jangan menebak part number"], "unmatched": []}
        info, parts = self.brief_parts(brief)
        self.claim["flow_brief_info"] = info
        self.packet["history"]["session"] = dict(self.claim)
        save = lambda part: worker.save_brief_part(self.root, {"owner_id": self.owner, "session_id": self.sid, "result": part})
        with self.assertRaisesRegex(ValueError, "belum dibaca"):
            worker.prepare(self.root, self.packet)
        with self.assertRaisesRegex(ValueError, "rusak"):
            save(dict(parts[0], text=parts[0]["text"][:-1]))
        with self.assertRaisesRegex(ValueError, "tidak dikenal"):
            save(dict(parts[0], extra=1))
        for part in reversed(parts[1:]):
            self.assertEqual(save(part)["missing"], list(range(part["part"])))
        self.assertEqual(save(parts[0])["missing"], [])
        with self.assertRaisesRegex(ValueError, "tidak lagi dikirim"):
            worker.prepare(self.root, dict(self.packet, flow_brief=brief))
        self.packet["history"]["session"] = dict(self.claim, flow_brief_info=None)
        with self.assertRaisesRegex(ValueError, "klaim dan riwayat berbeda"):
            worker.prepare(self.root, self.packet)
        self.packet["history"]["session"] = dict(self.claim)
        folder = worker.prepare(self.root, self.packet)
        self.assertEqual(json.loads((folder / "flow-brief.json").read_text()), brief)
        shared = json.loads((folder / "context.json").read_text())["flow_brief"]
        self.assertEqual((shared["file"], shared["tasks"], shared["rules"], shared["sha256"]),
                         ("flow-brief.json", 1, 1, info["sha256"]))
        for role in worker.ROLES:
            ref = json.loads((folder / "roles" / role / "context.json").read_text())["flow_brief"]
            self.assertEqual(ref["file"], "../../flow-brief.json")
            self.assertEqual(ref["sha256"], info["sha256"])
        # Bagian yang cocok sendiri tetapi berasal dari brief lain ditolak oleh digest server.
        forged = "Z" + parts[0]["text"][1:]
        worker.save(folder / "brief-parts" / "part-000.json", dict(parts[0], text=forged, part_sha256=worker.sha256_text(forged)))
        with self.assertRaisesRegex(ValueError, "tidak utuh|tidak cocok"):
            worker.prepare(self.root, self.packet)
        # Klaim tanpa ringkasan brief tidak boleh melewatkan brief yang dimiliki sesi.
        del self.claim["flow_brief_info"]
        with self.assertRaisesRegex(ValueError, "klaim dan riwayat berbeda"):
            worker.prepare(self.root, self.packet)

    def test_flow_brief_rpc_is_fixed_and_encoded(self):
        sid, token = uid(), uid()
        query = worker.sql("brief", {"session_id": sid, "claim_token": token, "part": 2})
        self.assertIn("alur_machine_private.read_flow_brief((v->>'session_id')::uuid,(v->>'claim_token')::uuid,(v->>'part')::integer)", query)
        self.assertNotIn(sid, query)
        for bad in ({"session_id": sid, "claim_token": token}, {"session_id": sid, "claim_token": token, "part": -1},
                    {"session_id": sid, "claim_token": token, "part": "1"}, {"session_id": sid, "claim_token": token, "part": True}):
            with self.assertRaises(ValueError):
                worker.sql("brief", bad)

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
