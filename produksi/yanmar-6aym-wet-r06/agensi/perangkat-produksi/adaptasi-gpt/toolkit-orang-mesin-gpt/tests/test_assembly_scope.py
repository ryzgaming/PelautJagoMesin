import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import assembly_scope as scope
import toolkit


def write_glb(path, names):
    # A real GLB with named nodes sharing one nonempty triangle, sufficient to test ID reconciliation.
    binary = struct.pack('<9f', 0, 0, 0, 1, 0, 0, 0, 1, 0)
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(names)))}],
           'buffers': [{'byteLength': len(binary)}], 'bufferViews': [{'buffer': 0, 'byteLength': len(binary)}],
           'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3',
                          'min': [0, 0, 0], 'max': [1, 1, 0]}],
           'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
           'nodes': [{'name': name, 'mesh': 0} for name in names]}
    chunk = json.dumps(doc).encode()
    chunk += b' ' * (-len(chunk) % 4)
    path.write_bytes(struct.pack('<4sIIII', b'glTF', 2, 28 + len(chunk) + len(binary), len(chunk), 0x4E4F534A)
                     + chunk + struct.pack('<I4s', len(binary), b'BIN\x00') + binary)


class AssemblyScopeTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        toolkit.initialize(self.root, 'fixture', 'cooler', 'selected-model')
        self.plan = scope.new_plan('r01')
        for decision in self.plan['domains'].values():
            decision.update(applicability='not_applicable', reason='Only a synthetic cooler is in scope')
        self.plan['domains']['pendingin_penukar_panas'].update(
            applicability='active', reason='Fixture assembly', research_evidence=['doc/sources.json'])
        part = {'name': 'Shell', 'layer': 'outer', 'id': 'expected-shell', 'location': 'At cooler',
                'shape': {'basis': 'OBSERVED', 'description': 'Synthetic shape'},
                'source_refs': [{'path': 'doc/sources.json', 'locator': 'Test figure 1'}]}
        self.plan['assemblies'] = [{'id': 'ASM', 'domain': 'pendingin_penukar_panas', 'owner_agent_id': 'cooler-agent',
                                    'parts': [part, dict(part, name='Core', id='expected-core', layer='inner',
                                                         feature='heat_transfer_element', covers=['expected-shell'])]}]
        ref = {'path': 'doc/sources.json', 'locator': 'Fixture catalog'}
        self.bom = {'revision': 'r01', 'verified_by': 'qa', 'scope_status': 'complete', 'toc_ref': ref,
                    'toc_family_ids': ['Fig-A'], 'families': {'Fig-A': {'applicability': 'active', 'source_ref': ref, 'line_ids': ['1', '2']}}}
        for i, part in enumerate(self.plan['assemblies'][0]['parts'], 1):
            part.update(bom_lines=[{'family': 'Fig-A', 'id': str(i)}],
                        terminal={'kind': 'physical_service_part', 'reason': 'Fixture service leaf', 'source_ref': ref})
        self.verified = {scope.PLAN, scope.INSPECTION, scope.BOM, 'doc/sources.json', 'qa/viewer.png'}
        (self.root / 'qa/viewer.png').write_bytes(b'synthetic evidence')
        self.inspection = {'revision': 'r01', 'qa_agent_id': 'qa', 'model_sha256': {}, 'parts': {
            'expected-shell': {'status': 'modeled', 'reason': 'Fixture', 'mesh_ids': ['EXT-SHELL']},
            'expected-core': {'status': 'modeled', 'reason': 'Fixture', 'mesh_ids': ['INT-CORE'],
                              'viewer_evidence': ['qa/viewer.png'], 'viewer_check': {
                                  'action': 'xray', 'selected_mesh_id': 'INT-CORE', 'opened_covers': ['expected-shell']}}
        }}
        self.assets('exterior', ['EXT-SHELL'])
        self.assets('internal', ['INT-CORE'])

    def assets(self, unit, ids):
        folder = self.root / 'model' / unit
        path = folder / (unit + '.glb')
        write_glb(path, ids)
        self.inspection['model_sha256'][unit] = scope.digest(path)
        toolkit.write_json(folder / 'inventory.json', {'components': [{'id': i} for i in ids]})

    def inspect(self):
        toolkit.write_json(self.root / scope.BOM, self.bom)
        toolkit.write_json(self.root / scope.PLAN, self.plan)
        self.inspection['plan_sha256'] = scope.digest(self.root / scope.PLAN)
        toolkit.write_json(self.root / scope.INSPECTION, self.inspection)
        return scope.inspect(self.root, 'r01', self.verified, 'qa')

    def test_nested_core_contract_with_matching_ids(self):
        self.assertEqual(self.inspect(), ([], []))

    def test_mesh_counts_match_inventory_but_shell_hides_absent_core(self):
        self.assets('internal', ['INT-OTHER'])
        errors, statuses = self.inspect()
        self.assertIn('FAIL', statuses)
        self.assertTrue(any('expected-core' in error for error in errors))

    def test_existing_mesh_does_not_verify_an_unknown_core_shape(self):
        self.plan['assemblies'][0]['parts'][1]['shape']['basis'] = 'UNKNOWN'
        self.assertIn('UNVERIFIED', self.inspect()[1])

    def test_omitting_core_from_both_lists_still_fails(self):
        self.plan['assemblies'][0]['parts'].pop()
        self.inspection['parts'].pop('expected-core')
        self.assertIn('FAIL', self.inspect()[1])

    def test_selecting_shell_or_missing_browser_evidence_blocks_inner_review(self):
        core = self.inspection['parts']['expected-core']
        core['viewer_check']['selected_mesh_id'] = 'EXT-SHELL'
        self.assertTrue(self.inspect()[0])
        core['viewer_check']['selected_mesh_id'] = 'INT-CORE'
        core['viewer_evidence'] = []
        self.assertTrue(self.inspect()[0])

    def test_scope_can_extend_and_unknown_never_counts_as_success(self):
        self.plan['domains']['separation_bowl'] = {'applicability': 'unknown', 'title': 'Bowl separator'}
        self.assertTrue(self.inspect()[0])
        task = next(row for row in scope.dispatch(self.root) if row['domain'] == 'separation_bowl')
        self.assertEqual(task['title'], 'Bowl separator')
        self.assertIsNone(task['profile'])

    def test_entire_omitted_family_and_missing_terminal_reason_block_claim(self):
        self.bom['families']['Fig-B'] = dict(self.bom['families']['Fig-A'], line_ids=['12'])
        self.bom['toc_family_ids'].extend(['Fig-B', 'Fig-C'])
        core = self.plan['assemblies'][0]['parts'][1]
        core['parent_id'] = 'expected-shell'
        core['terminal'] = {'kind': 'supplied_as_assembly', 'reason': 'just assumed'}
        errors = self.inspect()[0]
        self.assertTrue(any('table of contents' in e for e in errors), errors)
        self.assertTrue(any('Fig-B/12' in e for e in errors), errors)
        self.assertTrue(any('terminal' in e for e in errors), errors)

    def test_stale_models_and_self_qa_block_review(self):
        self.inspection['model_sha256']['internal'] = hashlib.sha256(b'old GLB').hexdigest()
        self.plan['assemblies'][0]['owner_agent_id'] = 'qa'
        self.assertGreaterEqual(len(self.inspect()[0]), 2)


if __name__ == '__main__':
    unittest.main()
