"""Optional real two-session PostgreSQL race tests. No ports or remote DB access.
Run: python3 tests/agent-jobs-concurrency.py
Requires Docker; pulls only the pinned PostgreSQL image if absent.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

IMAGE = 'postgres:17-alpine@sha256:f9cf3e1f0066f0eb0c48707d864f0ac5941e9ff454a072077d97a4d278d07d73'
OWNER = '11111111-1111-4111-8111-111111111111'
ROOT = Path(__file__).resolve().parents[1]


class AgentJobRaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = 'alur-db-test-' + uuid.uuid4().hex[:12]
        subprocess.run(['docker','run','--detach','--rm','--network','none','--name',cls.container,
                        '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE], check=True, capture_output=True)
        cls.addClassCleanup(lambda: subprocess.run(['docker','rm','--force',cls.container],capture_output=True))
        for _ in range(100):
            ready = subprocess.run(['docker','exec',cls.container,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True)
            if ready.returncode == 0: break
            time.sleep(.1)
        else: raise RuntimeError('Local PostgreSQL startup timed out')
        cls.sql(f"""create role anon; create role authenticated; create schema auth;
          create table auth.users(id uuid primary key);
          create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
          grant usage on schema auth to authenticated;
          insert into auth.users values ('{OWNER}');""", check=True)
        cls.sql((ROOT/'apps/alur-workflow/supabase/agent-jobs.sql').read_text(),check=True)

    @classmethod
    def sql(cls, statement, check=False):
        return subprocess.run(['docker','exec','-i',cls.container,'psql','-X','-qAt','-U','postgres',
                               '-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True,check=check,timeout=20)

    def setUp(self):
        self.sql('truncate public.alur_agent_jobs cascade;',check=True)

    def user(self, expression, delay=False):
        result = self.sql(f"begin; set local role authenticated; set local request.jwt.claim.sub='{OWNER}'; select {expression};" +
                          ('select pg_sleep(0.2);' if delay else '') + 'commit;')
        return result

    def race(self, first, second):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.user, expression, True) for expression in (first,second)]
            return [f.result() for f in futures]

    @staticmethod
    def row(result):
        if result.returncode: raise AssertionError(result.stderr)
        return json.loads(result.stdout.strip().splitlines()[0]) if result.stdout.strip() else None

    def test_two_distinct_enqueue_requests_create_only_one_active_job(self):
        results = self.race(*(f"public.alur_enqueue_agent_job('h74','{uuid.uuid4()}')" for _ in range(2)))
        self.assertEqual(sorted(r.returncode for r in results),[0,3])
        self.assertEqual(self.sql('select count(*) from public.alur_agent_jobs;',check=True).stdout.strip(),'1')
        self.assertIn('active job',next(r.stderr for r in results if r.returncode))

    def test_two_identical_enqueue_retries_share_the_same_job(self):
        call = f"public.alur_enqueue_agent_job('h74','{uuid.uuid4()}')"
        results=self.race(call,call)
        self.assertEqual(self.row(results[0])['id'],self.row(results[1])['id'])

    def test_two_runners_cannot_claim_one_job(self):
        job=self.row(self.user(f"public.alur_enqueue_agent_job('h74','{uuid.uuid4()}')"))
        results=self.race(*(f"public.alur_claim_agent_job('h74','{uuid.uuid4()}')" for _ in range(2)))
        rows=[self.row(r) for r in results]
        self.assertEqual(sum(row is None for row in rows),1)
        self.assertEqual(next(row['id'] for row in rows if row),job['id'])

    def test_same_token_concurrent_retries_return_the_same_claim(self):
        self.user(f"public.alur_enqueue_agent_job('h74','{uuid.uuid4()}')")
        call=f"public.alur_claim_agent_job('h74','{uuid.uuid4()}')"
        rows=[self.row(r) for r in self.race(call,call)]
        self.assertEqual(rows[0],rows[1])

    def test_conflicting_terminal_writes_cannot_overwrite_the_winner(self):
        job=self.row(self.user(f"public.alur_enqueue_agent_job('h74','{uuid.uuid4()}')")); token=uuid.uuid4()
        self.user(f"public.alur_claim_agent_job('h74','{token}')")
        roles=['evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust']
        ready=json.dumps(dict.fromkeys(roles,'review')); pending=json.dumps(dict.fromkeys(roles,'pending'))
        calls=[f"public.alur_update_agent_job('{job['id']}','{token}','review','{ready}'::jsonb,'review_ready')",
               f"public.alur_update_agent_job('{job['id']}','{token}','failed','{pending}'::jsonb,'runner_failed')"]
        results=self.race(*calls)
        self.assertEqual(sorted(r.returncode for r in results),[0,3])
        self.assertIn('no longer running',next(r.stderr for r in results if r.returncode))
        winner=self.row(next(r for r in results if not r.returncode))
        persisted=self.row(self.user(f"to_jsonb(j)-'owner_id' from public.alur_agent_jobs j where id='{job['id']}'"))
        self.assertEqual(winner,persisted)


if __name__ == '__main__': unittest.main(verbosity=2)
