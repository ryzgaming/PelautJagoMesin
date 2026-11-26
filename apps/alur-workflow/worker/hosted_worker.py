#!/usr/bin/env python3
"""Peralatan worker cloud Orang Mesin. Semua input JSON melalui stdin, tanpa kredensial."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import sys
import tempfile
from uuid import UUID

ROLES = ("evidence", "fuel", "freshwater", "seawater", "lubrication", "intake-exhaust",
         "exterior", "internals", "integrator", "qa")
# Function, argument order and cast names are code. Values are encoded only as JSON data.
RPC = {
    "claim": ("claim_session", (("owner_id", "uuid"), ("claim_token", "uuid"), ("lease_seconds", "integer"))),
    "claim_as": ("claim_session_as", (("owner_id", "uuid"), ("claim_token", "uuid"), ("lease_seconds", "integer"),
                                      ("worker", "text"))),
    "heartbeat": ("heartbeat_session", (("session_id", "uuid"), ("claim_token", "uuid"), ("lease_seconds", "integer"))),
    "history": ("read_prior_memory", (("session_id", "uuid"),)),
    "checkpoint": ("write_checkpoint", (("session_id", "uuid"), ("claim_token", "uuid"), ("role", "text"),
                    ("summary", "text"), ("sources", "jsonb"), ("decisions", "jsonb"),
                    ("open_questions", "jsonb"), ("status", "text"))),
    "finish": ("finish_session", (("session_id", "uuid"), ("claim_token", "uuid"),
                                  ("status", "text"), ("result_url", "text"))),
}


def sql(operation, data):
    """Only emit a call to a fixed private function. Free text never becomes SQL syntax."""
    name, fields = RPC[operation]
    data = dict(data)
    if operation in ("heartbeat", "claim", "claim_as"):
        data.setdefault("lease_seconds", 900)
    if operation == "finish":
        data.setdefault("result_url", None)
    if operation == "claim_as" and data.get("worker") not in ("codex", "claude"):
        raise ValueError("Worker harus codex atau claude.")
    if data.keys() != {key for key, _ in fields}:
        raise ValueError("Argumen RPC tidak sesuai kontrak.")
    for key, kind in fields:
        if kind == "uuid":
            data[key] = str(UUID(data[key]))
    doc = json.dumps(data, allow_nan=False, ensure_ascii=False).encode().hex()
    args = []
    for key, kind in fields:
        args.append(f"(v->'{key}')" if kind == "jsonb" else f"(v->>'{key}')::{kind}")
    return (f"with input(v) as (select convert_from(decode('{doc}','hex'),'UTF8')::jsonb) "
            f"select alur_machine_private.{name}({','.join(args)}) as result from input")


def save(path, obj):
    if any(parent.is_symlink() for parent in path.absolute().parents):
        raise ValueError("Tautan pada folder memori.")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(obj, stream, indent=2, ensure_ascii=False, allow_nan=False)
            stream.write("\n")
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def glb_details(path):
    with path.open("rb") as stream:
        magic, version, total = struct.unpack("<4sII", stream.read(12))
        if magic != b"glTF" or version != 2 or total != path.stat().st_size:
            raise ValueError("Header GLB tidak sah.")
        size, kind = struct.unpack("<I4s", stream.read(8))
        if kind != b"JSON" or size % 4 or not 0 < size <= min(total - 20, 64 * 1024 * 1024):
            raise ValueError("GLB kehilangan JSON.")
        doc = json.loads(stream.read(size))
        remaining, kind = struct.unpack("<I4s", stream.read(8))
        if kind != b"BIN\0" or not remaining or remaining != total - stream.tell():
            raise ValueError("GLB kehilangan buffer tersemat.")
    buffers = doc.get("buffers", [])
    if (len(buffers) != 1 or "uri" in buffers[0] or not 0 < buffers[0].get("byteLength", 0) <= remaining
            or doc.get("asset", {}).get("version") != "2.0"):
        raise ValueError("Buffer GLB tidak sesuai.")
    accessors = doc.get("accessors", [])
    views = doc.get("bufferViews", [])
    mesh_indices = {n["mesh"] for n in doc.get("nodes", []) if type(n.get("mesh")) is int}
    if not mesh_indices:
        raise ValueError("GLB tanpa node mesh.")
    count = 0
    for mesh_index, mesh in enumerate(doc.get("meshes", [])):
        for primitive in mesh.get("primitives", []):
            index = primitive.get("attributes", {}).get("POSITION")
            if type(index) is not int or not 0 <= index < len(accessors):
                raise ValueError("Primitif GLB tanpa koordinat.")
            position = accessors[index]
            view_index = position.get("bufferView")
            if (position.get("type") != "VEC3" or position.get("componentType") != 5126
                    or type(position.get("count")) is not int or position["count"] < 1
                    or type(view_index) is not int or not 0 <= view_index < len(views)):
                raise ValueError("Koordinat GLB tidak memiliki buffer float32.")
            view = views[view_index]
            stride, length = view.get("byteStride", 12), view.get("byteLength")
            base, offset = view.get("byteOffset", 0), position.get("byteOffset", 0)
            if (view.get("buffer") != 0 or any(type(i) is not int for i in (stride, length, base, offset))
                    or not 12 <= stride <= 252 or stride % 4 or base < 0 or offset < 0
                    or (base + offset) % 4 or length < 0 or base + length > buffers[0]["byteLength"]
                    or offset + stride * (position["count"] - 1) + 12 > length):
                raise ValueError("Koordinat mesh keluar dari buffer GLB.")
            if mesh_index in mesh_indices:
                count += position["count"]
    if not count:
        raise ValueError("GLB kosong.")
    return {"meshes": len(doc["meshes"]), "position_values": count}


def manifest(directory):
    """Fingerprint the actual standalone review payload, with at least one GLB and HTML entry."""
    files, models = {}, {}
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("Folder review tidak valid.")
    for path in sorted(directory.rglob("*")):
        mode = path.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        if not stat.S_ISREG(mode):
            raise ValueError("Berkas khusus atau tautan di hasil review.")
        key = path.relative_to(directory).as_posix()
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        files[key] = {"sha256": digest.hexdigest(), "bytes": path.stat().st_size}
        if path.suffix.lower() == ".glb":
            models[key] = glb_details(path)
    if not files.get("index.html", {}).get("bytes") or not models:
        raise ValueError("Review memerlukan index.html dan mesh GLB.")
    encoded = json.dumps(files, sort_keys=True, separators=(",", ":")).encode()
    return {"sha256": hashlib.sha256(encoded).hexdigest(), "files": files, "models": models}


def prepare(root, packet):
    """Create repeatable private handoffs for every role, including unconfirmed earlier work."""
    owner = str(UUID(packet["owner_id"]))
    claim = packet["session"]
    session_id = str(UUID(claim["id"]))
    identity = claim["machine_key"]
    history = packet["history"]
    if (str(UUID(history["account_id"])) != owner or history["session"]["id"] != session_id
            or history["session"]["machine_key"] != identity):
        raise ValueError("Riwayat tidak cocok dengan pemilik, mesin, atau sesi.")
    if not all(isinstance(claim[k], str) and claim[k].strip() for k in ("brand", "model", "machine_key")):
        raise ValueError("Identitas mesin kosong.")
    sessions = {session_id: claim}
    for entry in history["previous_sessions"]:
        if entry["machine_key"] != identity:
            raise ValueError("Riwayat memuat mesin berbeda.")
        sessions[str(UUID(entry["id"]))] = entry
    # A canonical checkpoint may predate the bounded session listing. Require a direct
    # account-and-machine scoped history response for each older session before including it.
    for extra in packet.get("older_histories", []):
        row = extra["session"]
        if extra["account_id"] != owner or row["machine_key"] != identity:
            raise ValueError("Pemilik atau varian riwayat lama berbeda.")
        sessions[str(UUID(row["id"]))] = row
    sections = {}
    for key in ("memory", "previous_memory", "canonical_memory"):
        section = history[key]
        if not isinstance(section, list):
            raise ValueError("Format memori tidak valid.")
        seen = set()
        for record in section:
            role = record["role"]
            origin = str(UUID(record["session_id"]))
            if role not in ROLES or role in seen:
                raise ValueError("Revisi per peran tidak unik.")
            if (origin not in sessions or (key == "memory") != (origin == session_id)
                    or record.get("account_id", owner) != owner or record.get("machine_key", identity) != identity):
                raise ValueError("Asal checkpoint di luar cakupan; periksa riwayat sesi sumber.")
            if key == "canonical_memory" and record.get("status") not in ("DOCUMENTED", "NOT_APPLICABLE"):
                raise ValueError("Status memori kanonis belum didukung.")
            seen.add(role)
        sections[key] = section
    # No lease/claim secret in files opened by subagents. Keep display strings separate from paths.
    dest = root / owner / session_id
    shared = {k: claim[k] for k in ("id", "machine_key", "brand", "model", "source_leads") if k in claim}
    revision = None
    if claim.get("source_product"):
        product = claim["source_product"]
        brief = claim.get("revision_brief")
        if (product not in {"shinko-gj-sim", "man-l2330h", "tanabe-h74", "alfa-laval-mab206s"}
                or not isinstance(brief, str) or not 1 <= len(brief.strip()) <= 1200
                or any(history["session"].get(key) != claim.get(key) for key in ("source_product", "revision_brief"))):
            raise ValueError("Tugas revisi tidak cocok dengan sesi.")
        revision = {"source_product": product, "workspace": "/workspace?product=" + product, "brief": brief}
        shared["revision_task"] = revision
    shared["previous_sessions"] = [{k: r[k] for k in ("id", "status", "updated_at") if k in r}
                                   for r in history["previous_sessions"]]
    shared.update(sections)
    save(dest / "context.json", shared)
    for role in ROLES:
        context = {"role": role, "machine": {k: claim[k] for k in ("id", "brand", "model", "machine_key")},
                   "shared_context": "../../context.json",
                   "own_checkpoint": next((r for r in sections["memory"] if r["role"] == role), None),
                   "previous_attempt": next((r for r in sections["previous_memory"] if r["role"] == role), None),
                   "canonical": next((r for r in sections["canonical_memory"] if r["role"] == role), None)}
        if revision:
            context["revision_task"] = revision
        save(dest / "roles" / role / "context.json", context)
    return dest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    command = parser.add_subparsers(dest="action", required=True)
    command.add_parser("rpc-spec", help="Cetak daftar tetap signature RPC untuk connector privat.")
    sql_cmd = command.add_parser("sql", help="Emit SQL untuk satu RPC privat. Input objek JSON via stdin.")
    sql_cmd.add_argument("operation", choices=RPC)
    prep = command.add_parser("prepare", help="Tulis input memori untuk 10 peran dari claim dan riwayat.")
    prep.add_argument("root", type=Path, help="Root privat worker di luar checkout.")
    check = command.add_parser("manifest", help="Hash HTML, model GLB dan seluruh aset review.")
    check.add_argument("review", type=Path)
    args = parser.parse_args()
    if args.action == "rpc-spec":
        print(json.dumps(RPC))
    elif args.action == "sql":
        print(sql(args.operation, json.load(sys.stdin)))
    elif args.action == "prepare":
        print(prepare(args.root, json.load(sys.stdin)))
    else:
        print(json.dumps(manifest(args.review), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (KeyError, OSError, ValueError, struct.error, TypeError) as exc:
        sys.exit(f"Worker: {exc}")
