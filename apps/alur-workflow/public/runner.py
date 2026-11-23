#!/usr/bin/env python3
"""Runner Alur Agen. Python 3.10+, toolkit produksi lokal, Codex CLI dan Blender."""
import argparse
import contextlib
import getpass
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from urllib import error, parse, request
from uuid import UUID, uuid4

DEFAULT_URL = "https://vkljhkzbuomcwqnsiope.supabase.co"
PUBLIC_KEY = "sb_publishable_M5Z_0Py3A402iX9vzTohFQ_ea9ghdzG"
FLOWS = ("fuel", "freshwater", "seawater", "lubrication", "intake-exhaust")
ROLES = ("evidence", *FLOWS, "exterior", "internals", "integrator", "qa")
REPORTS = {
    "evidence": "inventory.json", "exterior": "report.json", "internals": "report.json",
    "integrator": "review/index.html", "qa": "qa.json",
}
HEARTBEAT = 30


def blank():
    return dict.fromkeys(ROLES, "pending")


def read(path):
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def save(path, data):
    """Replace a journal atomically, including the token needed for a lost RPC reply."""
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


@contextlib.contextmanager
def lock(path):
    with path.open("a+b") as handle:
        try:
            if os.name == "nt":
                import msvcrt
                if path.stat().st_size == 0:
                    handle.write(b"0")
                    handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise BlockingIOError("Runner lain memegang kunci lokal.") from exc
        yield


class NetworkIssue(Exception):
    pass


class HttpFailure(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(f"Permintaan ke layanan ditolak (HTTP {code}).")


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def validate_origin(value):
    url = parse.urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.path not in ("", "/") or url.query or url.fragment):
        raise ValueError("URL Supabase harus berupa origin HTTPS.")
    return value.rstrip("/")


class Supabase:
    def __init__(self, url, key, email, password):
        self.url = validate_origin(url)
        self.key, self.email, self.password = key, email, password
        self.access = self.refresh = None
        self.until = 0
        self.client = request.build_opener(NoRedirect())

    def post(self, path, body, *, user=False):
        headers = {"apikey": self.key, "Content-Type": "application/json"}
        if user:
            headers["Authorization"] = "Bearer " + self.access
        req = request.Request(self.url + path, data=json.dumps(body).encode(), headers=headers)
        try:
            with self.client.open(req, timeout=15) as response:
                return json.load(response)
        except error.HTTPError as exc:
            if exc.code in (408, 425, 429) or exc.code >= 500:
                raise NetworkIssue from exc
            raise HttpFailure(exc.code) from None
        except (error.URLError, TimeoutError, ConnectionError, http.client.HTTPException, json.JSONDecodeError) as exc:
            raise NetworkIssue from exc

    def login(self):
        data = None
        if self.refresh:
            try:
                data = self.post("/auth/v1/token?grant_type=refresh_token", {"refresh_token": self.refresh})
            except HttpFailure as exc:
                if exc.code not in (400, 401, 403):
                    raise
        if data is None:
            data = self.post("/auth/v1/token?grant_type=password", {
                "email": self.email, "password": self.password
            })
        self.access, self.refresh = data["access_token"], data["refresh_token"]
        self.until = time.monotonic() + max(1, int(data["expires_in"]) - 30)

    def rpc(self, name, body):
        if not self.access or time.monotonic() >= self.until:
            self.login()
        path = "/rest/v1/rpc/alur_" + name
        try:
            return self.post(path, body, user=True)
        except HttpFailure as exc:
            if exc.code != 401:
                raise
        self.login()
        return self.post(path, body, user=True)


def retry(call):
    delay = 2
    while True:
        try:
            return call()
        except NetworkIssue:
            print(f"Koneksi terputus. Mencoba kembali dalam {delay} detik.", file=sys.stderr, flush=True)
            time.sleep(delay)
            delay = min(30, 2 * delay)


def snapshot(source, destination):
    """Copy only initialized input; never inherit old runs, owner approval or machine commands."""
    if destination.exists():
        raise ValueError("Folder eksekusi telah terisi.")
    with tempfile.TemporaryDirectory(dir=destination.parent) as tmp:
        staged = Path(tmp) / "project"
        staged.mkdir()
        for name in ("machine.json", "sources", "reference-ui"):
            item = source / name
            if name == "reference-ui" and not item.exists() and not item.is_symlink():
                continue
            if item.is_symlink():
                raise ValueError("Tautan simbolik pada input.")
            if name == "machine.json":
                if not item.is_file() or not read(item).get("model"):
                    raise ValueError("machine.json belum diinisialisasi.")
                shutil.copy2(item, staged / name)
                continue
            if not item.is_dir():
                raise ValueError("Direktori input belum tersedia.")
            for child in item.rglob("*"):
                mode = child.lstat().st_mode
                if not stat.S_ISREG(mode) and not stat.S_ISDIR(mode):
                    raise ValueError("Input memuat tautan atau berkas khusus.")
            shutil.copytree(item, staged / name)
        staged.rename(destination)


def supervise(source, production, job):
    """A detached supervisor owns the exit receipt even if HTTP or the polling CLI stops."""
    try:
        with lock(job / "worker.lock"):
            receipt = job / "exit.json"
            if receipt.exists():
                return
            if (job / "started.json").exists():
                # A previous supervisor disappeared without observing a child exit.
                # Its orphan may still be using this private snapshot. Never start it again.
                save(receipt, {"executed": False, "returncode": None})
                return
            save(job / "started.json", {"supervisor": os.getpid()})
            result = {"executed": False, "returncode": None}
            try:
                snapshot(source, job / "project")
                command = [sys.executable, str(production), "run", str(job / "project"), "--system-flows"]
                with (job / "production.log").open("wb") as output:
                    child = subprocess.Popen(command, cwd=production.parent, stdin=subprocess.DEVNULL,
                                             stdout=output, stderr=subprocess.STDOUT)
                    result = {"executed": True, "returncode": child.wait()}
            finally:
                save(receipt, result)
    except BlockingIOError:
        # A previous runner instance is still supervising this job.
        return


def start_monitor(source, production, job):
    clean = {key: value for key, value in os.environ.items() if not key.upper().startswith("ALUR_")}
    options = {"start_new_session": True} if os.name == "posix" else {
        "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    }
    return subprocess.Popen(
        [sys.executable, str(Path(__file__).resolve()), "_supervise", str(source), str(production), str(job)],
        cwd=job, env=clean, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        **options,
    )


def run_root(project):
    state = read(project / "state.json")
    run = state.get("run", "")
    if not isinstance(run, str) or not re.fullmatch(r"runs/[0-9]+", run.replace("\\", "/")):
        raise ValueError("Run produksi tidak dikenali.")
    root = project / run
    if root.is_symlink() or root.parent.is_symlink() or not root.is_dir():
        raise ValueError("Folder run tidak valid.")
    return state, root


def observed(project):
    progress = blank()
    try:
        _, run = run_root(project)
    except (OSError, ValueError):
        return progress
    for role in ROLES:
        worker = "flow-" + role if role in FLOWS else role
        for folder in sorted(run.glob("r[0-9][0-9]/" + worker)):
            if not (folder / "process.log").is_file():
                continue
            progress[role] = "running"
            out = folder / "output"
            if not (folder / "answer.txt").is_file() or not (out / REPORTS.get(role, "flow.json")).is_file():
                continue
            progress[role] = "review"
            if role in FLOWS:
                try:
                    doc = read(out / "flow.json")
                    app = doc.get("applicability", {})
                    if (doc.get("status") == "NOT_APPLICABLE" and
                            app.get("status") == "DOES_NOT_APPLY" and app.get("source_refs")):
                        progress[role] = "not_applicable"
                except (ValueError, OSError, AttributeError):
                    pass
    return progress


def verify_review(project):
    state, run = run_root(project)
    if state.get("status") not in ("REVIEW_READY", "REVIEW_WITH_GAPS") or state.get("system_flows") is not True:
        raise ValueError("State belum siap direview.")
    round_no = state["round"]
    if type(round_no) is not int or not 1 <= round_no <= 3:
        raise ValueError("Putaran tidak valid.")
    round_dir = run / f"r{round_no:02d}"
    out = round_dir / "integrator/output"
    report = round_dir / "qa/output/qa.json"
    if project / state["artifact"] != out or project / state["qa"] != report:
        raise ValueError("Hasil berasal dari run lain.")
    for path in (out, report):
        if path.resolve() != path:
            raise ValueError("Hasil mengandung tautan.")
    hashes = {}
    for path in out.rglob("*"):
        if path.is_symlink():
            raise ValueError("Tautan pada artefak.")
        if path.is_file():
            h = hashlib.sha256()
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(1048576), b""):
                    h.update(block)
            hashes[path.relative_to(out).as_posix()] = h.hexdigest()
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    expected = {"review/index.html", "review/system-flows/index.html", "system-flow-review.json"}
    expected.update("review/system-flows/" + role + ".json" for role in FLOWS)
    if not expected.issubset(hashes) or digest != state.get("manifest_digest"):
        raise ValueError("Manifest review tidak cocok.")
    qa = read(report)
    if not isinstance(qa, dict) or qa.get("status") not in ("PASS", "FAIL", "UNVERIFIED"):
        raise ValueError("Laporan QA tidak tersedia.")
    if state["status"] == "REVIEW_READY" and (qa.get("status") != "PASS" or qa.get("artifact_hashes") != hashes):
        raise ValueError("QA tidak mengikat hasil yang dinyatakan siap.")
    return out / "review/index.html", state["status"]


def terminal(job, progress):
    receipt = read(job / "exit.json")
    if receipt.get("executed") is True and type(receipt.get("returncode")) is int and receipt["returncode"] == 0:
        try:
            link, state = verify_review(job / "project")
            if all(v in ("review", "not_applicable") for v in progress.values()):
                print(f"Review lokal: {link}", flush=True)
                return "review", "review_ready" if state == "REVIEW_READY" else "review_with_gaps"
        except (OSError, ValueError, KeyError, TypeError):
            pass
    for role, value in progress.items():
        if value == "running":
            progress[role] = "failed"
    print(f"Produksi belum menghasilkan review terverifikasi. Periksa {job}", file=sys.stderr)
    return "failed", "runner_failed"


def milestones(current, previous):
    # Each role is a workflow milestone: a completed first pass survives later repair rounds.
    result = dict(current)
    for role, value in previous.items():
        if value in ("review", "not_applicable", "failed") or (value == "running" and current[role] == "pending"):
            result[role] = value
    return result


def supervisor_available(job):
    try:
        with lock(job / "worker.lock"):
            return True
    except BlockingIOError:
        return False


def process_one(api, project_key, source, production, control, journal):
    record = read(journal) if journal.exists() else {"token": str(uuid4())}
    save(journal, record)
    token = record["token"]
    if "job" not in record:
        claimed = retry(lambda: api.rpc("claim_agent_job", {"p_project_key": project_key, "p_claim_token": token}))
        if claimed is None:
            journal.unlink()
            return False
        if not isinstance(claimed, dict) or claimed.get("project_key") != project_key or claimed.get("status") != "running":
            raise ValueError("Jawaban claim tidak cocok dengan pasangan lokal.")
        record["job"] = str(UUID(claimed["id"]))
        save(journal, record)
    job_id = str(UUID(record["job"]))
    job = control / "jobs" / job_id
    job.mkdir(parents=True, exist_ok=True, mode=0o700)
    def update(payload):
        return api.rpc("update_agent_job", {"p_job_id": job_id, "p_claim_token": token, **payload})
    if "terminal" not in record:
        previous = record.get("progress", blank())
        monitor = None
        next_send = 0
        while True:
            receipt = job / "exit.json"
            if (not receipt.exists() and (monitor is None or monitor.poll() is not None)
                    and supervisor_available(job)):
                monitor = start_monitor(source, production, job)
            if receipt.exists():
                if monitor is not None:
                    monitor.wait()
                progress = milestones(observed(job / "project"), previous)
                status, note = terminal(job, progress)
                record["terminal"] = {"p_status": status, "p_note": note, "p_progress": progress}
                save(journal, record)
                break
            progress = milestones(observed(job / "project"), previous)
            if progress != previous or time.monotonic() >= next_send:
                record["progress"] = previous = progress
                save(journal, record)
                retry(lambda: update({"p_status": "running", "p_progress": progress, "p_note": "running"}))
                next_send = time.monotonic() + HEARTBEAT
            time.sleep(2)
    retry(lambda: update(record["terminal"]))
    journal.unlink()
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog=(
        "Masuk dengan akun dashboard Anda. Perintah yang sama menyambung kembali ke job lama. "
        "Hasil dan log tersimpan di PROJECT/.alur-runner/jobs/<id>/. "
        "Supervisor yang berhenti tanpa bukti keluar dilaporkan gagal saat Anda menyambung kembali."
    ))
    parser.add_argument("--toolkit", type=Path, required=True, help="Folder tepercaya berisi production.py.")
    parser.add_argument("--project", type=Path, required=True, help="Proyek lokal yang sudah di-init.")
    parser.add_argument("--project-key", required=True, help="Kunci proyek yang sama dengan dashboard.")
    parser.add_argument("--url", default=os.getenv("ALUR_SUPABASE_URL", DEFAULT_URL))
    parser.add_argument("--anon-key", default=os.getenv("ALUR_SUPABASE_ANON_KEY", PUBLIC_KEY))
    parser.add_argument("--email", default=os.getenv("ALUR_EMAIL"))
    parser.add_argument("--once", action="store_true", help="Periksa antrean sekali; tunggu job terpilih selesai.")
    args = parser.parse_args()
    source = args.project.resolve()
    production = args.toolkit.resolve() / "production.py"
    if not production.is_file() or not (source / "machine.json").is_file() or not (source / "sources").is_dir():
        parser.error("Periksa folder toolkit dan project lokal yang telah di-init.")
    if len(args.project_key) > 64 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.project_key):
        parser.error("project-key tidak valid.")
    url = validate_origin(args.url)
    email = (args.email or input("Email dashboard: ")).strip()
    password = os.getenv("ALUR_PASSWORD") or getpass.getpass("Kata sandi dashboard: ")
    api = Supabase(url, args.anon_key, email, password)
    control = source / ".alur-runner"
    control.mkdir(mode=0o700, exist_ok=True)
    identity = json.dumps([url, email.casefold(), args.project_key, str(production)])
    journal = control / (hashlib.sha256(identity.encode()).hexdigest() + ".json")
    with lock(control / "runner.lock"):
        while True:
            ran = process_one(api, args.project_key, source, production, control, journal)
            if args.once:
                break
            if not ran:
                time.sleep(10)


if __name__ == "__main__":
    try:
        if len(sys.argv) == 5 and sys.argv[1] == "_supervise":
            supervise(*(Path(value) for value in sys.argv[2:]))
        else:
            main()
    except KeyboardInterrupt:
        print("Pemantauan dihentikan. Gunakan perintah yang sama untuk menyambung kembali.", file=sys.stderr)
        sys.exit(130)
    except (OSError, ValueError, KeyError, HttpFailure) as exc:
        print(f"Runner berhenti: {exc}", file=sys.stderr)
        sys.exit(1)
