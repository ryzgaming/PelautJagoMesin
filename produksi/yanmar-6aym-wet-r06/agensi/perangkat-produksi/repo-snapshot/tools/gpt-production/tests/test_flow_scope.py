import copy
from pathlib import Path
import tempfile
import unittest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flow_scope as flow
import toolkit

REFS = [{'path': 'doc/source', 'locator': 'Fixture figure'}]


class FlowTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        toolkit.initialize(self.root, 'fixture', 'flow', 'selected-model')
        self.plan = flow.new_plan('r01')
        self.plan.update(applicability='active', specialist_agent_id='routing-agent', source_refs=REFS,
                         carrier_ids=['housing'], exchangers={'cooler': {'streams': []}})
        self.routes = {'revision':'r01', 'ports':{}, 'links':{}, 'registration_tolerance_m':0.001,
                       'tolerance_basis':'Synthetic registration'}
        self.geometry = {'revision':'r01', 'ports':{}, 'links':{}, 'model_sha256':{}}
        self.qa = {'revision':'r01', 'qa_agent_id':'QA', 'runtime':{}, 'sections':{}}
        for unit in ('exterior','internal'):
            path = self.root / 'model' / unit / (unit + '.glb')
            path.write_bytes(b'fixture-for-checking-evidence-hashes')
            self.geometry['model_sha256'][unit] = flow.digest(path)
        self.ids = {flow.PLAN, flow.ROUTES, flow.GEOMETRY, flow.QA, 'doc/source', 'qa/frame'}
        for i, medium in enumerate(('oil','freshwater')):
            entry, end = medium + '-in', medium + '-out'
            pts = [[0,i,0], [1,i,0]]
            self.plan['circuits'][medium] = {'medium':medium,'mode':'normal', 'topology':'open',
                                             'inlets':[entry], 'outlets':[end], 'source_refs':REFS}
            self.plan['exchangers']['cooler']['streams'].append({'mode':'normal','inlet':entry,'outlet':end})
            self.plan['links'][medium] = {'from':entry,'to':end,'circuit':medium,'inside':'cooler',
                                          'direction_basis':'DOCUMENTED','source_refs':REFS}
            for key, p in zip((entry,end), pts):
                self.plan['ports'][key] = {'owner':'housing','medium':medium,'source_refs':REFS}
                self.routes['ports'][key] = {'owner':'housing','anchor':'marker-'+key}
                self.geometry['ports'][key] = {'owner':'housing','world':p}
            self.routes['links'][medium] = {'status':'modeled','geometry_basis':'OBSERVED','from':entry,'to':end,
                                             'source_refs':REFS,'spans':[{'carrier':'housing','passage':'void-'+medium,
                                                                        'kind':'hidden','points':pts}]}
            self.geometry['links'][medium] = {'crossings':[],'outside_carrier':[]}
            self.qa['sections'][medium] = {'lumen_open':True,'external_clearance':True,'evidence':['qa/frame']}
            for device in ('desktop','mobile'):
                obs = {'evidence':['qa/frame'], 'link':medium,'mechanism_moving':True,'samples':[]}
                self.qa['runtime'].setdefault(medium,{})[device] = obs
                for j, (state, f) in enumerate(zip(('running','running','paused','paused','resumed','resumed'),
                                                   (0.1,0.2,0.3,0.3,0.3,0.4))):
                    obs['samples'].append({'state':state,'fraction':f,'time_s':j,'visible':True,'world':[f,i,0]})

    def inspect(self):
        for file, obj in [(flow.PLAN,self.plan),(flow.ROUTES,self.routes)]:
            toolkit.write_json(self.root / file, obj)
        self.geometry['routes_sha256'] = flow.digest(self.root / flow.ROUTES)
        toolkit.write_json(self.root / flow.GEOMETRY, self.geometry)
        self.qa.update(scope_sha256=flow.digest(self.root / flow.PLAN),geometry_sha256=flow.digest(self.root / flow.GEOMETRY),
                       loaded_routes_sha256=flow.digest(self.root / flow.ROUTES))
        toolkit.write_json(self.root / flow.QA, self.qa)
        return flow.inspect(self.root,'r01',self.ids,'QA')

    def test_separate_media_can_share_housing(self):
        self.assertEqual(self.inspect(), ([],[]))

    def test_shared_passage_and_hidden_wall_crossing_rejected(self):
        self.routes['links']['oil']['spans'][0]['passage'] = 'void-freshwater'
        self.geometry['links']['oil']['crossings'] = [['housing',0,'wall']]
        errors = self.inspect()[0]
        self.assertTrue(any('Shared passage' in e for e in errors))
        self.assertTrue(any('intersects geometry' in e for e in errors))

    def test_separate_water_circuits_cannot_share_one_physical_core_channel(self):
        for p in self.plan['ports'].values():
            p['medium'] = 'water'
        for circuit in self.plan['circuits'].values():
            circuit['medium'] = 'water'
        for layout in self.routes['links'].values():
            layout['spans'][0]['passage'] = 'the-same-channel'
        self.assertTrue(any('Exchanger circuits share' in e for e in self.inspect()[0]))

    def test_omitted_exchanger_paths_fail_even_if_source_port_counts_match(self):
        toolkit.write_json(self.root / 'model/assembly-plan.json', {
            'assemblies':[{'domain':'pendingin_penukar_panas','id':'another-cooler'}]})
        self.assertTrue(any('another-cooler' in e for e in self.inspect()[0]))

    def test_orphan_inventory_carrier_and_unsupported_join(self):
        toolkit.write_json(self.root / 'model/exterior/inventory.json',
                           {'components':[{'id':'loose-spool','flow_carrier':True}]})
        self.plan['links']['oil']['source_refs'] = []
        errors = self.inspect()[0]
        self.assertTrue(any('Orphan fluid carrier' in e for e in errors))
        self.assertTrue(any('Unsubstantiated' in e for e in errors))

    def test_jump_and_reversed_source_direction(self):
        spans = self.routes['links']['oil']['spans']
        second = copy.deepcopy(spans[0])
        spans[0]['points'][-1] = [0.4,0,0]
        second['points'][0] = [0.6,0,0]
        spans.append(second)
        self.plan['links']['oil'].update({'from':'oil-out', 'to':'oil-in'})
        errors = self.inspect()[0]
        self.assertTrue(any('span jump' in e for e in errors))
        self.assertTrue(any('wrong installed direction' in e for e in errors))
        self.assertTrue(any('reversed flow' in e for e in errors))

    def test_false_pause_and_off_route_marker_rejected(self):
        trace = self.qa['runtime']['oil']['mobile']['samples']
        trace[3]['fraction'] += 0.01
        trace[3]['world'][0] += 0.01
        self.assertTrue(any('oil/mobile' in e for e in self.inspect()[0]))
        trace[3] = dict(trace[2], time_s=3)
        trace[5]['world'][2] = 0.3
        self.assertTrue(any('oil/mobile' in e for e in self.inspect()[0]))

    def test_hypothetical_passage_remains_unverified(self):
        self.routes['links']['oil']['geometry_basis'] = 'INFERRED'
        self.assertIn('UNVERIFIED',self.inspect()[1])

    def test_scheme_two_legacy_dispatch_has_no_new_mandatory_domain(self):
        self.assertEqual(flow.task(self.root)[0]['profile'],'spesialis_jalur_fluida')
        self.plan.update(applicability='not_applicable',reason='Dry fixture',source_refs=REFS)
        toolkit.write_json(self.root / flow.PLAN,self.plan)
        self.assertFalse(flow.task(self.root))
        self.assertEqual(flow.inspect(self.root,'r01',{flow.PLAN,'doc/source'},'QA'),([],[]))
