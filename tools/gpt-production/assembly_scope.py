"""Reconcile a specialist's source-derived expectations with delivered meshes and QA evidence."""
import hashlib
import json
from pathlib import Path
import struct

REGISTRY = Path(__file__).with_name('specialists.json')
PLAN = 'model/assembly-plan.json'
INSPECTION = 'qa/assembly-inspection.json'
BOM = 'doc/bom-source-index.json'


def load(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def new_plan(revision):
    return {'revision': revision, 'domains': {
        key: {'applicability': 'unknown', 'reason': ''} for key in load(REGISTRY)
    }, 'assemblies': []}


def dispatch(root):
    """List real delegation tasks for the coordinator; do not claim agent execution."""
    plan = load(root / PLAN)
    registry = load(REGISTRY)
    for key, decision in plan['domains'].items():
        if decision['applicability'] == 'not_applicable':
            continue
        configuration = registry.get(key, decision)
        yield {'domain': key, 'profile': configuration.get('profile'),
               'title': configuration.get('title', key),
               'applicability': decision['applicability'], 'revision': plan['revision'],
               'workspace': str(root.resolve()), 'plan': PLAN}


def mesh_ids(path):
    """Read mesh-bearing nodes with POSITION data from the current GLB JSON chunk."""
    with path.open('rb') as stream:
        header = stream.read(20)
        if len(header) != 20:
            raise ValueError(f'Incomplete GLB header: {path.name}')
        magic, version, total, length, kind = struct.unpack('<4sIIII', header)
        if (magic != b'glTF' or version != 2 or total != path.stat().st_size
                or kind != 0x4E4F534A or not 0 < length <= total - 20):
            raise ValueError(f'Invalid GLB header: {path.name}')
        doc = json.loads(stream.read(length))
    meshes, accessors = doc['meshes'], doc['accessors']
    identifiers = set()
    for node in doc['nodes']:
        index = node.get('mesh')
        if not isinstance(index, int) or not 0 <= index < len(meshes):
            continue
        for primitive in meshes[index]['primitives']:
            pos = primitive.get('attributes', {}).get('POSITION')
            if isinstance(pos, int) and 0 <= pos < len(accessors) and accessors[pos].get('count', 0) > 0:
                extras = node.get('extras', {})
                identifier = extras.get('id') or extras.get('part_id') or node.get('name')
                if identifier:
                    if identifier in identifiers:
                        raise ValueError('Duplicate mesh ID: ' + identifier)
                    identifiers.add(identifier)
                break
    return identifiers


def inspect_bom(root, revision, verified, qa_id, plan, expected):
    """Cover every indexed OEM family/line and trace each branch to a service leaf."""
    if BOM not in verified:
        return ['Missing bound OEM family and line index: ' + BOM]
    doc = load(root / BOM)
    errors = []
    def bound(ref):
        return isinstance(ref, dict) and ref.get('path') in verified and bool(ref.get('locator'))
    if (doc.get('revision') != revision or doc.get('verified_by') != qa_id
            or doc.get('scope_status') != 'complete' or not bound(doc.get('toc_ref'))):
        errors.append('Full variant catalog index is incomplete or not independently checked')
    families = doc['families']
    if not families or not isinstance(families, dict):
        return errors + ['Empty catalog index']
    index_ids = doc.get('toc_family_ids', [])
    if not index_ids or len(index_ids) != len(set(index_ids)) or set(index_ids) != set(families):
        errors.append('Catalog table of contents and specialist family coverage disagree')
    rows = set()
    for family, group in families.items():
        if not bound(group.get('source_ref')):
            errors.append('Missing catalog section locator: ' + family)
        state = group.get('applicability')
        if state == 'not_applicable' and group.get('reason'):
            continue
        if state != 'active' or not group.get('line_ids'):
            errors.append('Unresolved or empty catalog family: ' + family)
            continue
        if len(set(group['line_ids'])) != len(group['line_ids']):
            errors.append('Duplicate catalog line in ' + family)
        for line in group['line_ids']:
            rows.add((family, line))
    mapped = set()
    for key, part in expected.items():
        for line in part.get('bom_lines', []):
            mapped.add((line['family'], line['id']))
    for line in sorted(rows - mapped):
        errors.append('Unrepresented OEM family/line: ' + '/'.join(line))
    for line in sorted(mapped - rows):
        errors.append('Expected part references an unindexed OEM line: ' + '/'.join(line))
    # A fastener repeated across assemblies can legitimately share a catalog line.
    for assembly in plan['assemblies']:
        parts = {p['id']: p for p in assembly['parts']}
        parents = {p.get('parent_id') for p in parts.values()}
        for key, part in parts.items():
            if not part.get('bom_lines') and not bound(part.get('additional_service_ref')):
                errors.append('Expected part needs BOM line or supplementary service locator: ' + key)
            chain = {key}
            parent = part.get('parent_id')
            while parent is not None:
                if parent in chain or parent not in parts:
                    errors.append('Assembly BOM cycle or unknown parent at ' + key)
                    break
                chain.add(parent)
                parent = parts[parent].get('parent_id')
            if key not in parents:
                terminal = part.get('terminal', {})
                if (terminal.get('kind') not in ('physical_service_part', 'supplied_as_assembly')
                        or not terminal.get('reason') or not bound(terminal.get('source_ref'))):
                    errors.append('Service leaf lacks sourced terminal reason: ' + key)
    return errors


def inspect(root, revision, verified, qa_id):
    """Return structural evidence errors and feature statuses, independently of mesh totals."""
    errors, statuses = [], []
    if PLAN not in verified or INSPECTION not in verified:
        return ['Missing hash binding for assembly plan or inspection'], ['UNVERIFIED']
    plan, report = load(root / PLAN), load(root / INSPECTION)
    if plan['revision'] != revision or report['revision'] != revision or report['plan_sha256'] != digest(root / PLAN):
        errors.append('Assembly plan or inspection is stale')
    if report.get('qa_agent_id') != qa_id:
        errors.append('Assembly inspection must identify the independent QA reviewer')
    available = set()
    for scope in ('exterior', 'internal'):
        path = root / 'model' / scope / (scope + '.glb')
        if report['model_sha256'].get(scope) != digest(path):
            errors.append('Stale assembly inspection of ' + scope)
        inventory = {row['id'] for row in load(path.with_name('inventory.json'))['components']}
        available.update(mesh_ids(path) & inventory)
    domains, assemblies = plan['domains'], plan['assemblies']
    if not domains.keys() >= load(REGISTRY).keys():
        errors.append('Missing specialist applicability decisions')
    seen_domains = set()
    seen_assemblies = set()
    owners = {}
    expected = {}
    for assembly in assemblies:
        aid, domain, owner = assembly['id'], assembly['domain'], assembly['owner_agent_id']
        if not aid or aid in seen_assemblies or not owner or owner == qa_id:
            errors.append(f'Missing/duplicate assembly or independent owner: {aid}')
        seen_assemblies.add(aid)
        if domain not in domains or domains[domain]['applicability'] != 'active':
            errors.append(f'Applicable assembly without active specialist: {aid}')
        if owner in owners and owners[owner] != domain:
            errors.append(f'Specialist assigned to multiple domains: {owner}')
        owners[owner] = domain
        seen_domains.add(domain)
        parts = assembly['parts']
        if not parts:
            errors.append('No expected parts for ' + aid)
        if domain == 'pendingin_penukar_panas' and not any(
                p.get('feature') == 'heat_transfer_element' and p.get('layer') == 'inner' for p in parts):
            errors.append(f'{aid}: missing expected heat_transfer_element')
            statuses.append('FAIL')
        local_ids = {p['id'] for p in parts}
        for part in parts:
            key = part['id']
            if not key or key in expected:
                errors.append('Empty/duplicate expected part: ' + key)
            expected[key] = part
            if not part.get('name') or not part.get('location') or part.get('layer') not in ('inner', 'outer'):
                errors.append('Missing name, locus or layer: ' + key)
            shape = part.get('shape', {})
            if (shape.get('basis') not in ('DOCUMENTED', 'OBSERVED', 'ESTIMATED', 'INFERRED', 'UNKNOWN')
                    or not shape.get('description')):
                errors.append('Missing description or evidence basis for expected shape: ' + key)
            refs = part.get('source_refs', [])
            if not refs or any(r.get('path') not in verified or not r.get('locator') for r in refs):
                errors.append('Missing bound source or locator: ' + key)
            covers = part.get('covers', [])
            if key in covers or not set(covers) <= local_ids:
                errors.append('Invalid cover references: ' + key)
    for key, decision in domains.items():
        state = decision['applicability']
        if not decision.get('reason') or state not in ('active', 'not_applicable'):
            errors.append('Unresolved applicability: ' + key)
        if state == 'active':
            research = decision.get('research_evidence', [])
            if not research or not set(research) <= verified:
                errors.append('Missing specialist research evidence: ' + key)
            if key not in seen_domains:
                errors.append('Active domain without accountable assembly: ' + key)
    if not expected:
        errors.append('Empty expected parts list')
    errors.extend(inspect_bom(root, revision, verified, qa_id, plan, expected))
    checks = report['parts']
    if checks.keys() != expected.keys():
        errors.append('Assembly inspection must account for every expected part exactly')
    used_mesh = {}
    for key in expected.keys() & checks.keys():
        row, part = checks[key], expected[key]
        state = row.get('status')
        if not row.get('reason'):
            errors.append('Missing reconciliation explanation: ' + key)
        if state == 'missing':
            statuses.append('FAIL')
        elif state in ('partial', 'unverified'):
            statuses.append('UNVERIFIED')
        elif state == 'not_applicable':
            if not row.get('reason') or part.get('feature') == 'heat_transfer_element':
                errors.append('Unsupported part exclusion: ' + key)
        elif state == 'modeled':
            if part.get('shape', {}).get('basis') == 'UNKNOWN':
                statuses.append('UNVERIFIED')
            ids = row.get('mesh_ids', [])
            if not ids or not set(ids) <= available:
                errors.append('Expected part has no matching GLB and inventory mesh: ' + key)
                statuses.append('FAIL')
            for identifier in ids:
                if identifier in used_mesh:
                    errors.append(f'{key} and {used_mesh[identifier]} share mesh {identifier}')
                used_mesh[identifier] = key
            if part['layer'] == 'inner':
                evidence = row.get('viewer_evidence', [])
                trace = row.get('viewer_check', {})
                covers = part.get('covers', [])
                if (not evidence or not set(evidence) <= verified
                        or trace.get('action') not in ('xray', 'isolate', 'explode', 'section', 'open-cover')
                        or trace.get('selected_mesh_id') not in ids
                        or not set(covers) <= set(trace.get('opened_covers', []))):
                    errors.append('No bound nested viewer inspection: ' + key)
        else:
            errors.append('Invalid realization status: ' + key)
    return errors, statuses
