"""Check source-to-viewer flow registration. All route coordinates are glTF world metres."""
from collections import defaultdict
from math import dist, isfinite

from assembly_scope import PLAN as ASSEMBLY_PLAN, digest, load

PLAN = 'model/flow/scope.json'
ROUTES = 'model/flow/routes.json'
GEOMETRY = 'qa/flow-geometry.json'
QA = 'qa/flow-inspection.json'
PROFILE = 'spesialis_jalur_fluida'


def new_plan(revision):
    return {'revision': revision, 'applicability': 'unknown', 'reason': '', 'specialist_agent_id': None,
            'source_refs': [], 'ports': {}, 'circuits': {}, 'links': {}, 'exchangers': {}}


def task(root):
    plan = load(root / PLAN)
    if plan.get('applicability') == 'not_applicable':
        return []
    return [{'domain': 'jalur_fluida', 'profile': PROFILE, 'title': 'Perpipaan, port dan animasi aliran',
             'applicability': plan['applicability'], 'revision': plan['revision'],
             'workspace': str(root.resolve()), 'plan': PLAN}]


def positive(number):
    return type(number) in (float, int) and isfinite(number) and number > 0


def point(xyz):
    return isinstance(xyz, list) and len(xyz) == 3 and all(type(v) in (float, int) and isfinite(v) for v in xyz)


def reach(start, graph):
    seen, todo = {start}, [start]
    while todo:
        for target in graph.get(todo.pop(), []):
            if target not in seen:
                seen.add(target)
                todo.append(target)
    return seen


def position_at(points, fraction):
    lengths = [dist(a, b) for a, b in zip(points, points[1:])]
    remaining = sum(lengths) * fraction
    for a, b, length in zip(points, points[1:], lengths):
        if length and remaining <= length:
            return [x + (y - x) * remaining / length for x, y in zip(a, b)]
        remaining -= length
    return points[-1]


def circuit_errors(plan):
    """Check continuity within operating modes; source endpoints mark open boundaries."""
    errors = []
    ports, links = plan['ports'], plan['links']
    for cid, circuit in plan['circuits'].items():
        forward, reverse, undirected = defaultdict(set), defaultdict(set), defaultdict(set)
        for edge in links.values():
            if edge['circuit'] != cid:
                continue
            a, b = edge['from'], edge['to']
            if a == b or ports[a]['medium'] != circuit['medium'] or ports[b]['medium'] != circuit['medium']:
                errors.append(f'{cid}: self-loop or crossed media at {a}, {b}')
            forward[a].add(b)
            reverse[b].add(a)
            undirected[a].add(b)
            undirected[b].add(a)
        if not undirected or reach(next(iter(undirected)), undirected) != set(undirected):
            errors.append(f'{cid}: disconnected or empty operating circuit')
            continue
        nodes = set(undirected)
        if circuit['topology'] == 'loop':
            first = next(iter(nodes))
            if reach(first, forward) != nodes or reach(first, reverse) != nodes:
                errors.append(f'{cid}: broken loop or wrong flow direction')
        elif circuit['topology'] == 'open':
            starts, ends = set(circuit['inlets']), set(circuit['outlets'])
            if (not starts or not ends or starts & ends or not (starts | ends) <= nodes or
                    set().union(*(reach(n, forward) for n in starts)) != nodes or
                    set().union(*(reach(n, reverse) for n in ends)) != nodes):
                errors.append(f'{cid}: orphan branch or reversed flow at an open boundary')
        else:
            errors.append(f'{cid}: unknown topology')
    used = {edge[k] for edge in links.values() for k in ('from', 'to')}
    if used != set(ports):
        errors.append('Orphan registered port or unknown source endpoint')
    for host, exchanger in plan['exchangers'].items():
        streams = exchanger['streams']
        groups = defaultdict(list)
        for stream in streams:
            groups[stream['mode']].append(stream)
        if not groups or any(len(entries) < 2 for entries in groups.values()):
            errors.append(f'{host}: exchanger media coverage is incomplete')
        for mode, entries in groups.items():
            graph, undirected = defaultdict(set), defaultdict(set)
            for edge in links.values():
                if edge.get('inside') == host and plan['circuits'][edge['circuit']]['mode'] == mode:
                    a, b = edge['from'], edge['to']
                    graph[a].add(b)
                    undirected[a].add(b)
                    undirected[b].add(a)
            occupied = set()
            for stream in entries:
                a, b = stream['inlet'], stream['outlet']
                path_nodes = reach(a, undirected)
                if a == b or b not in reach(a, graph) or occupied & path_nodes:
                    errors.append(f'{host}/{mode}: missing internal path or connected exchanger media')
                occupied.update(path_nodes)
    return errors


def motion_ok(samples, points, tolerance):
    sequence = ('running', 'running', 'paused', 'paused', 'resumed', 'resumed')
    if [s.get('state') for s in samples] != list(sequence):
        return False
    for sample in samples:
        f = sample['fraction']
        if (type(f) not in (int, float) or not 0 <= f <= 1 or not point(sample['world'])
                or sample.get('visible') is not True or dist(sample['world'], position_at(points, f)) > tolerance):
            return False
    times = [s['time_s'] for s in samples]
    if any(type(t) not in (int, float) or not isfinite(t) for t in times) or any(a >= b for a, b in zip(times, times[1:])):
        return False
    a, b, c, d, e, f = [s['fraction'] for s in samples]
    return a < b <= c and abs(c - d) <= 1e-7 and abs(d - e) <= 1e-7 and e < f


def inspect(root, revision, verified, qa_id):
    errors, statuses = [], []
    if PLAN not in verified:
        return ['Source flow plan not bound to review'], ['UNVERIFIED']
    plan = load(root / PLAN)
    def fail(reason):
        errors.append(reason)
        statuses.append('FAIL')
    def sourced(record):
        refs = record.get('source_refs')
        return bool(refs) and all(r.get('path') in verified and r.get('locator') for r in refs)
    if plan.get('revision') != revision or not sourced(plan):
        errors.append('Missing current source for operating flow scope')
    if plan['applicability'] == 'not_applicable':
        fluid_domains = {'pendingin_penukar_panas', 'pendingin_pompa_katup', 'injeksi_bahan_bakar',
                        'pelumasan_pompa', 'turbo_udara_gas'}
        if any(a['domain'] in fluid_domains for a in load(root / ASSEMBLY_PLAN)['assemblies']):
            errors.append('Inapplicable flow scope contradicts active fluid assemblies')
        if not plan.get('reason'):
            errors.append('Missing reason for inapplicable flow')
        return errors, statuses
    if plan['applicability'] != 'active' or not plan.get('specialist_agent_id') or plan['specialist_agent_id'] == qa_id:
        errors.append('No independent flow specialist or unresolved applicability')
    if not {ROUTES, GEOMETRY, QA} <= verified:
        return errors + ['Missing installed routes, Blender probe or runtime QA'], ['UNVERIFIED']
    routes, geometry, qa = (load(root / path) for path in (ROUTES, GEOMETRY, QA))
    if (any(d.get('revision') != revision for d in (routes, geometry, qa))
            or qa.get('qa_agent_id') != qa_id or not qa_id
            or qa.get('geometry_sha256') != digest(root / GEOMETRY)
            or qa.get('scope_sha256') != digest(root / PLAN) or geometry.get('routes_sha256') != digest(root / ROUTES)):
        errors.append('Flow evidence is stale or not independently reviewed')
    for scope in ('exterior', 'internal'):
        if geometry['model_sha256'].get(scope) != digest(root / 'model' / scope / (scope + '.glb')):
            errors.append('Flow registration model changed: ' + scope)
    for assembly in load(root / ASSEMBLY_PLAN)['assemblies']:
        if assembly['domain'] == 'pendingin_penukar_panas' and assembly['id'] not in plan['exchangers']:
            errors.append('No isolated operating paths for heat exchanger: ' + assembly['id'])
    if not plan['links'] or not plan['circuits'] or not plan['ports']:
        return errors + ['Empty operating circuit'], ['UNVERIFIED']
    topology = circuit_errors(plan)
    if topology:
        statuses.append('FAIL')
        errors.extend(topology)
    if set(plan['ports']) != set(routes['ports']) or set(plan['links']) != set(routes['links']):
        errors.append('Installed route IDs differ from source ports or links')
    if len({reg['anchor'] for reg in routes['ports'].values()}) != len(routes['ports']):
        errors.append('Multiple physical ports share one GLB anchor')
    tolerance = routes['registration_tolerance_m']
    if not positive(tolerance) or not routes.get('tolerance_basis'):
        raise ValueError('Unspecified registration tolerance and basis')
    points_by_link = {}
    carriers = set()
    occupied = {}
    for identity, edge in plan['links'].items():
        delivered = routes['links'].get(identity, {})
        if (not sourced(edge) or not sourced(plan['ports'][edge['from']]) or not sourced(plan['ports'][edge['to']])
                or not sourced(plan['circuits'][edge['circuit']])):
            errors.append('Unsubstantiated join, port or operating condition: ' + identity)
        if delivered.get('status') != 'modeled':
            statuses.append('UNVERIFIED')
            continue
        if (delivered.get('geometry_basis') not in ('OBSERVED', 'DOCUMENTED')
                or edge.get('direction_basis') not in ('OBSERVED','DOCUMENTED')):
            statuses.append('UNVERIFIED')
        if not sourced(delivered) or (delivered.get('from'), delivered.get('to')) != (edge['from'], edge['to']):
            errors.append('Unsupported physical route or wrong installed direction: ' + identity)
        spans = delivered['spans']
        if not spans:
            errors.append('Empty route ' + identity)
            continue
        points = []
        for span in spans:
            pts = span['points']
            if len(pts) < 2 or not all(point(p) for p in pts) or any(dist(a,b) == 0 for a,b in zip(pts, pts[1:])):
                raise ValueError('Invalid centerline: ' + identity)
            if points and dist(points[-1], pts[0]) > tolerance:
                fail('Discontinuous span jump: ' + identity)
            points.extend(pts)
            carriers.add(span['carrier'])
            if not span.get('carrier') or not span.get('passage') or span.get('kind') not in ('exposed', 'hidden'):
                errors.append('Unregistered carrier, passage or span kind: ' + identity)
            circuit = plan['circuits'][edge['circuit']]
            medium = circuit['medium']
            signature = tuple(tuple(p) for p in pts)
            for k in [('passage', span['passage']), ('line', min(signature, signature[::-1]))]:
                if k in occupied and occupied[k] != medium:
                    fail('Shared passage or coincident centerline across media: ' + identity)
                occupied[k] = medium
                host = edge.get('inside')
                if host in plan['exchangers']:
                    isolation_key = (host, circuit['mode'], k)
                    if isolation_key in occupied and occupied[isolation_key] != edge['circuit']:
                        fail('Exchanger circuits share a physical passage: ' + identity)
                    occupied[isolation_key] = edge['circuit']
        points_by_link[identity] = points
        if edge.get('inside') and not any(span['kind'] == 'hidden' for span in spans):
            fail('Internal passage omitted: ' + identity)
        for endpoint, coordinate in [('from', points[0]), ('to', points[-1])]:
            port_id = edge[endpoint]
            registered = geometry['ports'][port_id]
            if (registered['owner'] != plan['ports'][port_id]['owner'] or not point(registered['world'])
                    or dist(coordinate, registered['world']) > tolerance):
                fail('Centerline misses installed port: ' + port_id)
        probe = geometry['links'].get(identity, {})
        if probe.get('crossings') or probe.get('outside_carrier'):
            fail('Installed centerline intersects geometry or leaves carrier bounds: ' + identity)
        elif probe.get('crossings') != [] or probe.get('outside_carrier') != []:
            errors.append('Incomplete installed geometry probe: ' + identity)
    if set(geometry['links']) != set(points_by_link):
        errors.append('Geometry probe covers different active routes')
    if qa.get('loaded_routes_sha256') != digest(root / ROUTES):
        errors.append('Browser route payload does not match installed routes')
    if not set(plan['links']) == set(qa.get('sections', {})):
        errors.append('Missing route cross-section inspection')
    for identity in points_by_link:
        section = qa.get('sections', {}).get(identity, {})
        evidence = section.get('evidence', [])
        if (section.get('lumen_open') is not True or section.get('external_clearance') is not True
                or not evidence or not set(evidence) <= verified):
            errors.append('Bore, gap or internal void unverified: ' + identity)
    marked = set(plan.get('carrier_ids', []))
    for unit in ('exterior','internal'):
        inventory = load(root / 'model' / unit / 'inventory.json')
        marked.update(row['id'] for row in inventory['components'] if row.get('flow_carrier') is True)
    if marked != carriers:
        fail('Orphan fluid carrier or unregistered pipe/passage')
    for cid in plan['circuits']:
        for device in ('desktop', 'mobile'):
            observation = qa.get('runtime', {}).get(cid, {}).get(device, {})
            evidence = observation.get('evidence', [])
            identity = observation.get('link')
            if (not evidence or not set(evidence) <= verified or identity not in points_by_link
                    or plan['links'][identity]['circuit'] != cid or observation.get('mechanism_moving') is not True
                    or not motion_ok(observation.get('samples', []), points_by_link[identity], tolerance)):
                errors.append(f'{cid}/{device}: visible play/pause/resume under motion unverified')
    return errors, statuses
