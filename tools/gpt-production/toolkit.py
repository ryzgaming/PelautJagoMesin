#!/usr/bin/env python3
"""GPT production scaffolding. Contract checks do not certify geometry or agent activity."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

import assembly_scope
import flow_scope
import motion_scope

ROLES = ('documents', 'photos', 'video', 'dimension', 'fuel', 'lubrication',
         'intake-exhaust', 'freshwater', 'seawater', 'exterior', 'internals', 'integrator', 'qa')
VIEWS = ('depan', 'belakang', 'kiri', 'kanan', 'atas', 'tiga_perempat')
CHECKS = ('identity', 'dimensions', 'export', 'interfaces', 'inventory', 'kinematics',
          'collisions', 'viewer_desktop', 'viewer_mobile')
STATUSES = ('PASS', 'FAIL', 'UNVERIFIED', 'N/A')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def initialize(root, brand, model, ai_model):
    root = root.resolve()
    if root.exists() and any(root.iterdir()):
        raise ValueError('Folder kerja harus kosong; hasil lama tidak ditimpa.')
    if not brand.strip() or not model.strip() or not ai_model.strip():
        raise ValueError('Merek, model/varian dan ID GPT wajib diisi.')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    for folder in ('doc', 'foto', 'video', 'model/exterior', 'model/internal', 'model/systems',
                   'model/assemblies', 'qa', 'review'):
        (root / folder).mkdir(parents=True, exist_ok=True)
    spec = {'schema_version': 4, 'brand': brand, 'model': model, 'ai_model': ai_model,
            'revision': 'r01', 'purpose': 'educational', 'catalog_approval': None,
            'dimension_target_percent': 1, 'dimension_target_kind': 'educational_nominal_not_manufacturing'}
    write_json(root / 'job.json', spec)
    write_json(root / motion_scope.PLAN, motion_scope.new_plan(spec['revision']))
    write_json(root / flow_scope.PLAN, flow_scope.new_plan(spec['revision']))
    write_json(root / assembly_scope.PLAN, assembly_scope.new_plan(spec['revision']))
    write_json(root / assembly_scope.BOM, {'revision': spec['revision'], 'verified_by': None,
               'scope_status': 'unverified', 'toc_ref': {}, 'toc_family_ids': [], 'families': {}})
    write_json(root / 'model/datum.json', {'unit': 'm', 'status': 'UNVERIFIED', 'axes': None,
                                          'origin': None, 'dimensions': {}, 'source_refs': []})
    write_json(root / 'doc/sources.json', {'sources': [], 'conflicts': [], 'gaps': []})
    for part in ('exterior', 'internal'):
        write_json(root / 'model' / part / 'inventory.json', {'components': [], 'status': 'UNVERIFIED'})
    write_json(root / 'qa/review.json', {
        'schema_version': 1, 'revision': 'r01', 'qa_agent_id': None, 'roles': [], 'artifacts': [],
        'checks': {name: {'status': 'UNVERIFIED', 'reason': 'Belum diperiksa', 'evidence': []} for name in CHECKS},
        'views': {view: {'status': 'UNVERIFIED', 'render': None, 'reference': None,
                         'real_reference_inspected': False, 'reason': 'Belum diperiksa'} for view in VIEWS},
        'findings': [], 'verdict': 'UNVERIFIED'})
    return {'workspace': str(root), 'status': 'DRAFT', 'next': 'Run preflight, then use PROMPT-GPT.md with real subagents.'}


def preflight():
    commands = {name: shutil.which(name) for name in ('python3', 'blender', 'pdftotext', 'pdftoppm', 'ffmpeg', 'yt-dlp', 'node')}
    bpy = importlib.util.find_spec('bpy') is not None
    missing = [name for name in ('pdftotext', 'pdftoppm', 'node') if not commands[name]]
    if not commands['blender'] and not bpy:
        missing.append('blender_or_bpy')
    return {'python': sys.version.split()[0], 'commands': commands, 'bpy_importable': bpy,
            'missing': missing, 'requires_agent_verification': ['subagents', 'image_viewing', 'web_access', 'browser_control', 'selected_model'],
            'status': 'BLOCKED' if missing else 'NEEDS_RUNTIME_VERIFICATION',
            'note': 'No packages installed. Installed executable/module alone does not prove rendering works.'}


def check_review(root):
    root = root.resolve()
    job = json.loads((root / 'job.json').read_text())
    report = json.loads((root / 'qa/review.json').read_text())
    errors = []
    def require(condition, reason):
        if not condition:
            errors.append(reason)
    require(report.get('schema_version') == 1, 'Unsupported report schema')
    require(isinstance(job.get('revision'), str) and bool(job['revision']) and report.get('revision') == job['revision'], 'Revision mismatch')
    artifacts = report.get('artifacts', [])
    require(isinstance(artifacts, list) and bool(artifacts), 'No current artifacts')
    verified = set()
    for item in artifacts if isinstance(artifacts, list) else []:
        if not isinstance(item, dict) or not isinstance(item.get('path'), str):
            errors.append('Malformed artifact'); continue
        relative = Path(item['path'])
        path = (root / relative).resolve()
        if relative.is_absolute() or not path.is_relative_to(root) or not path.is_file():
            errors.append('Artifact outside workspace or missing: ' + item['path']); continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item.get('sha256') or item['path'] in verified:
            errors.append('Stale hash or duplicate artifact: ' + item['path']); continue
        verified.add(item['path'])
    for path in ('model/exterior/exterior.glb', 'model/internal/internal.glb', 'review/index.html', 'model/datum.json',
                 'model/exterior/inventory.json', 'model/internal/inventory.json', 'doc/sources.json'):
        require(path in verified, 'Missing artifact binding: ' + path)
    qa_id = report.get('qa_agent_id')
    require(isinstance(qa_id, str) and bool(qa_id.strip()), 'QA agent identity missing')
    records = report.get('roles', [])
    records = records if isinstance(records, list) else []
    ids = []
    for role in ROLES:
        matching = [r for r in records if isinstance(r, dict) and r.get('role') == role]
        require(len(matching) == 1, 'Missing/duplicate role: ' + role)
        if len(matching) != 1:
            continue
        record = matching[0]
        aid = record.get('agent_id')
        require(isinstance(aid, str) and bool(aid.strip()), 'Missing agent ID: ' + role)
        if isinstance(aid, str):
            ids.append(aid)
        require(record.get('state') == 'completed' and record.get('revision') == job.get('revision'), 'Role incomplete/stale: ' + role)
        require(isinstance(record.get('evidence'), list) and bool(record['evidence']) and
                all(p in verified for p in record['evidence']), 'Missing role evidence: ' + role)
        require((aid == qa_id) if role == 'qa' else (aid != qa_id), 'QA must be independent: ' + role)
    require(len(set(ids)) == len(ROLES), 'Each production role must use a separate agent')
    checks = report.get('checks', {})
    checks = checks if isinstance(checks, dict) else {}
    statuses = []
    for name in CHECKS:
        check = checks.get(name, {})
        check = check if isinstance(check, dict) else {}
        status = check.get('status', 'UNVERIFIED'); statuses.append(status)
        require(status in STATUSES, 'Invalid check status: ' + name)
        if status == 'N/A':
            require(isinstance(check.get('reason'), str) and bool(check['reason'].strip()), 'N/A reason required: ' + name)
        else:
            require(isinstance(check.get('evidence'), list) and bool(check['evidence']) and
                    all(p in verified for p in check['evidence']), 'Missing check evidence: ' + name)
    views = report.get('views', {})
    views = views if isinstance(views, dict) else {}
    real_views = 0
    for name in VIEWS:
        view = views.get(name, {})
        view = view if isinstance(view, dict) else {}
        status = view.get('status', 'UNVERIFIED'); statuses.append(status)
        require(status in ('PASS', 'FAIL', 'UNVERIFIED'), 'Invalid view status: ' + name)
        require(view.get('render') in verified, 'Missing rendered view: ' + name)
        if status == 'PASS':
            require(view.get('reference') in verified, 'Missing reference: ' + name)
        if view.get('real_reference_inspected') is True and view.get('reference') in verified:
            real_views += 1
    require(real_views >= 4, 'Fewer than four views with inspected real photo/video references')
    findings = report.get('findings', [])
    require(isinstance(findings, list), 'Malformed findings')
    open_findings = [f for f in findings if not isinstance(f, dict) or f.get('state') != 'closed'] if isinstance(findings, list) else [None]
    if job.get('schema_version', 1) >= 2 or (root / assembly_scope.PLAN).exists():
        try:
            coverage_errors, coverage_statuses = assembly_scope.inspect(root, job['revision'], verified, qa_id)
            errors.extend(coverage_errors)
            statuses.extend(coverage_statuses)
        except (OSError, ValueError, TypeError, KeyError, AttributeError, IndexError) as exc:
            errors.append(f'Invalid assembly evidence: {exc}')
    if job.get('schema_version', 1) >= 3 or (root / flow_scope.PLAN).exists():
        try:
            flow_errors, flow_statuses = flow_scope.inspect(root, job['revision'], verified, qa_id)
            errors.extend(flow_errors)
            statuses.extend(flow_statuses)
        except (OSError, ValueError, TypeError, KeyError, AttributeError, IndexError) as exc:
            errors.append(f'Invalid operating flow evidence: {exc}')
    if job.get('schema_version', 1) >= 4 or (root / motion_scope.PLAN).exists():
        try:
            motion_errors, motion_statuses = motion_scope.inspect(root, job['revision'], verified, qa_id)
            errors.extend(motion_errors)
            statuses.extend(motion_statuses)
        except (OSError, ValueError, TypeError, KeyError, AttributeError, IndexError) as exc:
            errors.append(f'Invalid motion evidence: {exc}')
    if 'FAIL' in statuses or any(isinstance(f, dict) and f.get('severity') in ('critical', 'major') for f in open_findings):
        verdict = 'FAIL'
    elif errors or open_findings or any(s not in ('PASS', 'N/A') for s in statuses):
        verdict = 'UNVERIFIED'
    else:
        verdict = 'PASS'
    ready = verdict == 'PASS' and report.get('verdict') == 'PASS'
    return {'audit_status': verdict, 'ready_for_private_review': ready, 'catalog_approved': False,
            'errors': errors, 'open_findings': len(open_findings),
            'note': 'Structural/hash checks only. Visual inspection, geometry measurements and agent activity require independent evidence.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init')
    init.add_argument('--workspace', type=Path, required=True)
    for field in ('brand', 'model', 'ai-model'):
        init.add_argument('--' + field, required=True)
    sub.add_parser('preflight')
    briefs = sub.add_parser('specialist-briefs', help='List specialist tasks for actual delegation')
    briefs.add_argument('--workspace', type=Path, required=True)
    candidates = sub.add_parser('motion-candidates', help='Return swept broad-phase pairs by operating condition')
    candidates.add_argument('--workspace', type=Path, required=True)
    gate = sub.add_parser('check-review')
    gate.add_argument('--workspace', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'init':
            result = initialize(args.workspace, args.brand, args.model, args.ai_model)
        elif args.command == 'specialist-briefs':
            result = list(assembly_scope.dispatch(args.workspace))
            if (args.workspace / flow_scope.PLAN).exists():
                result.extend(flow_scope.task(args.workspace))
            if (args.workspace / motion_scope.PLAN).exists():
                result.append(motion_scope.task(args.workspace))
        elif args.command == 'motion-candidates':
            result = motion_scope.candidate_manifest(args.workspace)
        elif args.command == 'preflight':
            result = preflight()
        else:
            result = check_review(args.workspace)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if args.command == 'check-review' and not result['ready_for_private_review'] else 0
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({'status': 'UNVERIFIED', 'error': str(exc)}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
