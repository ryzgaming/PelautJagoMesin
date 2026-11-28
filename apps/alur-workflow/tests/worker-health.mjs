import test from 'node:test';
import assert from 'node:assert/strict';
import {workerHealth,finishedToday,usageLinks} from '../src/features/settings/worker-health.ts';

const settings = {primary_worker: 'claude', claude_enabled: true, codex_enabled: true, takeover_minutes: 75};
const now = Date.parse('2026-11-26T10:00:00Z'); // 17.00 WIB
const ago = m => new Date(now - m * 60000).toISOString();

test('status pekerja dari aktivitas terakhir', () => {
  assert.equal(workerHealth('codex', {...settings, codex_enabled: false}, ago(1), [], now).label, 'Dijeda');
  assert.equal(workerHealth('codex', settings, null, [], now).label, 'Belum pernah jalan');
  assert.equal(workerHealth('claude', settings, ago(20), [], now).label, 'Siap');
  assert.equal(workerHealth('claude', settings, ago(95), [], now).label, 'Kemungkinan token habis');
  // Pekerjaan panjang: heartbeat sesi berjalan menghitung sebagai aktivitas.
  const running = [{status: 'running', worker: 'claude', updated_at: ago(3), brand: 'Caterpillar', model: '3512C'}];
  const busy = workerHealth('claude', settings, ago(150), running, now);
  assert.equal(busy.label, 'Sedang bekerja');
  assert.match(busy.detail, /Caterpillar 3512C/);
  // Batas mengikuti waktu ambil alih bila lebih panjang dari 90 menit.
  assert.equal(workerHealth('claude', {...settings, takeover_minutes: 180}, ago(120), [], now).label, 'Siap');
});

test('mesin selesai hari ini dihitung per pekerja dalam WIB', () => {
  const rows = [
    {status: 'review', worker: 'claude', updated_at: '2026-11-26T09:00:00Z'},
    {status: 'needs_evidence', worker: 'claude', updated_at: '2026-11-25T18:00:00Z'}, // 01.00 WIB tgl 26
    {status: 'review', worker: 'claude', updated_at: '2026-11-25T16:00:00Z'}, // 23.00 WIB tgl 25
    {status: 'running', worker: 'claude', updated_at: '2026-11-26T09:30:00Z'},
    {status: 'review', worker: 'codex', updated_at: '2026-11-26T09:00:00Z'},
  ];
  assert.equal(finishedToday('claude', rows, now), 2);
  assert.equal(finishedToday('codex', rows, now), 1);
  assert.ok(usageLinks.claude.startsWith('https://claude.ai/'));
});
