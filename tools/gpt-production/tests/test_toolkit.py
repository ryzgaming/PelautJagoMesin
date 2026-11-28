import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('gpt_toolkit', Path(__file__).resolve().parents[1] / 'toolkit.py')
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)


class ToolkitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'job'
        t.initialize(self.root, 'Synthetic fixture', 'Not a real machine', 'gpt-6.2-sol')

    def report(self):
        return json.loads((self.root / 'qa/review.json').read_text())

    def put(self, report):
        t.write_json(self.root / 'qa/review.json', report)
        return t.check_review(self.root)

    def valid_contract_fixture(self):
        # Not a GLB/model audit: intentionally synthetic bytes test hash and report contracts only.
        paths = ['model/exterior/exterior.glb', 'model/internal/internal.glb', 'review/index.html',
                 'model/datum.json', 'model/exterior/inventory.json', 'model/internal/inventory.json', 'doc/sources.json', 'qa/evidence.txt']
        paths += [f'qa/{v}.png' for v in t.VIEWS]
        paths += [f'foto/{v}.png' for v in t.VIEWS]
        artifacts = []
        for path in paths:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(b'SYNTHETIC CONTRACT FIXTURE, NOT A MODEL')
            artifacts.append({'path': path, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        report = self.report()
        report.update(qa_agent_id='agent-qa', verdict='PASS', artifacts=artifacts)
        report['roles'] = [{'role': role, 'agent_id': 'agent-' + role, 'state': 'completed',
                            'revision': 'r01', 'evidence': ['qa/evidence.txt']} for role in t.ROLES]
        report['checks'] = {k: {'status': 'PASS', 'evidence': ['qa/evidence.txt']} for k in t.CHECKS}
        report['views'] = {v: {'status': 'PASS', 'render': f'qa/{v}.png', 'reference': f'foto/{v}.png',
                               'real_reference_inspected': True} for v in t.VIEWS}
        return report

    def test_new_job_is_unverified_and_never_overwrites(self):
        self.assertFalse(t.check_review(self.root)['ready_for_private_review'])
        with self.assertRaises(ValueError):
            t.initialize(self.root, 'X', 'Y', 'Z')

    def test_complete_contract_is_not_catalog_approval(self):
        result = self.put(self.valid_contract_fixture())
        self.assertTrue(result['ready_for_private_review'], result)
        self.assertFalse(result['catalog_approved'])

    def test_historical_pass_with_missing_fields_is_rejected(self):
        self.assertFalse(self.put({'verdict': 'PASS'})['ready_for_private_review'])

    def test_stale_hash_or_revision_blocks_review(self):
        report = self.valid_contract_fixture()
        (self.root / 'model/exterior/exterior.glb').write_bytes(b'changed')
        self.assertFalse(self.put(report)['ready_for_private_review'])
        report = self.valid_contract_fixture()
        report['revision'] = 'r00'
        self.assertFalse(self.put(report)['ready_for_private_review'])

    def test_qa_must_be_independent(self):
        report = self.valid_contract_fixture()
        report['qa_agent_id'] = 'agent-exterior'
        self.assertFalse(self.put(report)['ready_for_private_review'])

    def test_unverified_fail_and_open_findings_override_pass(self):
        for status in ('UNVERIFIED', 'FAIL'):
            report = self.valid_contract_fixture()
            report['checks']['collisions']['status'] = status
            result = self.put(report)
            self.assertEqual(result['audit_status'], status)
            self.assertFalse(result['ready_for_private_review'])
        report = self.valid_contract_fixture()
        report['findings'] = [{'id': 'Q1', 'severity': 'minor', 'state': 'open'}]
        self.assertFalse(self.put(report)['ready_for_private_review'])

    def test_four_real_views_are_required(self):
        report = self.valid_contract_fixture()
        for view in list(t.VIEWS)[:3]:
            report['views'][view]['real_reference_inspected'] = False
        self.assertFalse(self.put(report)['ready_for_private_review'])

    def test_external_artifact_and_missing_role_block_review(self):
        report = self.valid_contract_fixture()
        report['artifacts'][0]['path'] = '../outside.glb'
        report['roles'].pop()
        self.assertFalse(self.put(report)['ready_for_private_review'])

    def test_na_needs_reason(self):
        report = self.valid_contract_fixture()
        report['checks']['kinematics'] = {'status': 'N/A'}
        self.assertFalse(self.put(report)['ready_for_private_review'])


if __name__ == '__main__':
    unittest.main()
