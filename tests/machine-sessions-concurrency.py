"""Optional isolated, two-session PostgreSQL races for hosted machine workflow.
Run python3 tests/machine-sessions-concurrency.py; Docker required, no exposed ports.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

IMAGE='postgres:17-alpine@sha256:f9cf3e1f0066f0eb0c48707d864f0ac5941e9ff454a072077d97a4d278d07d73'
OWNER='11111111-1111-4111-8111-111111111111'
ROOT=Path(__file__).resolve().parents[1]

class MachineRaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container='machine-db-test-'+uuid.uuid4().hex[:12]
        subprocess.run(['docker','run','--detach','--rm','--network','none','--name',cls.container,
                        '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],check=True,capture_output=True)
        cls.addClassCleanup(lambda:subprocess.run(['docker','rm','--force',cls.container],capture_output=True))
        for _ in range(100):
            if subprocess.run(['docker','exec',cls.container,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
            time.sleep(.1)
        else: raise RuntimeError('Local PostgreSQL startup timed out')
        cls.sql(f"""create role anon;create role authenticated;create role service_role bypassrls;
            create schema auth;create table auth.users(id uuid primary key);
            create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            grant usage on schema auth to authenticated;insert into auth.users values('{OWNER}');
            create table public.admins(user_id uuid primary key references auth.users(id));insert into public.admins values('{OWNER}');""",check=True)
        cls.sql((ROOT/'apps/alur-workflow/supabase/machine-sessions.sql').read_text(),check=True)
    @classmethod
    def sql(cls,statement,check=False):
        return subprocess.run(['docker','exec','-i',cls.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],
                              input=statement,text=True,capture_output=True,check=check,timeout=20)
    def setUp(self): self.sql('truncate public.alur_machine_sessions cascade;',check=True)
    def expression(self,expr,user=False,delay=False):
        auth=f"set local role authenticated;set local request.jwt.claim.sub='{OWNER}';" if user else ''
        return self.sql('begin;'+auth+'select '+expr+';'+('select pg_sleep(.2);' if delay else '')+'commit;')
    @staticmethod
    def row(r):
        if r.returncode:raise AssertionError(r.stderr)
        return json.loads(r.stdout.strip().splitlines()[0]) if r.stdout.strip() else None
    def race(self,a,b,user=False):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            fs=[pool.submit(self.expression,x,user,True) for x in (a,b)]
            return [f.result() for f in fs]
    def enqueue(self):return self.row(self.expression(f"public.alur_enqueue_machine_session('YANMAR','6AYM-WET','{uuid.uuid4()}')",user=True))
    def claim_call(self,token=None):return f"alur_machine_private.claim_session('{OWNER}','{token or uuid.uuid4()}',900)"
    def test_normalized_identity_race_has_only_one_active_session(self):
        a=f"public.alur_enqueue_machine_session('YANMAR','6AYM-WET','{uuid.uuid4()}')"
        b=f"public.alur_enqueue_machine_session(' yanmar ',' 6aym-wet ','{uuid.uuid4()}')"
        results=self.race(a,b,True)
        self.assertEqual(sorted(x.returncode for x in results),[0,3]);self.assertIn('active session',next(x.stderr for x in results if x.returncode))
    def test_idempotent_enqueue_race_has_one_identity(self):
        call=f"public.alur_enqueue_machine_session('YANMAR','6AYM-WET','{uuid.uuid4()}')"
        rows=[self.row(r) for r in self.race(call,call,True)];self.assertEqual(rows[0],rows[1])
    def test_two_workers_claim_only_once(self):
        s=self.enqueue();rows=[self.row(r) for r in self.race(self.claim_call(),self.claim_call())]
        self.assertEqual(sum(x is None for x in rows),1);self.assertEqual(next(x for x in rows if x)['session']['id'],s['id'])
    def test_same_token_concurrent_retry_is_identical(self):
        self.enqueue();call=self.claim_call();rows=[self.row(r) for r in self.race(call,call)];self.assertEqual(rows[0],rows[1])
    def test_expired_lease_recovery_has_one_winner_and_old_token_cannot_write(self):
        s=self.enqueue();old=self.row(self.expression(self.claim_call()))
        self.sql("update alur_machine_private.leases set expires_at=now()-interval '1 minute';",check=True)
        rows=[self.row(r) for r in self.race(self.claim_call(),self.claim_call())];self.assertEqual(sum(x is None for x in rows),1)
        winner=next(x for x in rows if x);self.assertNotEqual(winner['claim_token'],old['claim_token'])
        stale=self.expression(f"alur_machine_private.heartbeat_session('{s['id']}','{old['claim_token']}',900)")
        self.assertNotEqual(stale.returncode,0);self.assertIn('Lease lost',stale.stderr)
        active=self.sql('select count(*) from alur_machine_private.leases where revoked_at is null;',check=True)
        self.assertEqual(active.stdout.strip(),'1')
    def test_parallel_checkpoint_revisions_append_without_overwrite(self):
        self.enqueue();c=self.row(self.expression(self.claim_call()));s=c['session']['id'];t=c['claim_token']
        def call(text):return f"alur_machine_private.write_checkpoint('{s}','{t}','evidence','{text}','[]'::jsonb,'[]'::jsonb,'[\"Need official drawing\"]'::jsonb,'UNVERIFIED')"
        rows=[self.row(r) for r in self.race(call('First draft'),call('Another draft'))]
        self.assertEqual(sorted(x['revision'] for x in rows),[1,2])
        self.assertEqual(self.sql('select count(*) from public.alur_machine_memory;',check=True).stdout.strip(),'2')
    def test_identical_checkpoint_concurrent_retry_does_not_add_revision(self):
        self.enqueue();c=self.row(self.expression(self.claim_call()));s=c['session']['id'];t=c['claim_token']
        call=f"alur_machine_private.write_checkpoint('{s}','{t}','evidence','Same draft','[]'::jsonb,'[]'::jsonb,'[\"Need official drawing\"]'::jsonb,'UNVERIFIED')"
        rows=[self.row(r) for r in self.race(call,call)];self.assertEqual(rows[0],rows[1]);self.assertEqual(rows[0]['revision'],1)

if __name__=='__main__':unittest.main(verbosity=2)
