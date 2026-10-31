const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/attendanceHistory.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { mergeAttendanceHistory, getOvertimeSession, attendanceTimestamp } = exportsObject;
const now = Date.parse('2026-10-31T09:48:00+07:00');
const record = (id, type, occurred_at, extra = {}) => ({
  id, type, occurred_at, date: occurred_at.slice(0, 10), time: occurred_at.slice(11, 16), status: 'Selesai', ...extra,
});
const queued = (id, tipe, waktu_offline, extra = {}) => ({
  id, tipe, waktu_offline, user_id: 1, created_at: 1, foto_base64: 'photo', status: 'pending', ...extra,
});

test('older offline overtime end cannot hide yesterday 17:00 server start', () => {
  const start = record(2, 'Mulai Lembur', '2026-10-30 17:00:00');
  const oldEnd = queued('old', 'Selesai Lembur', '2026-10-29 20:00:00');
  const history = mergeAttendanceHistory([start], [oldEnd]);
  assert.equal(history[0].id, start.id);
  assert.equal(getOvertimeSession(history, now).start.id, start.id);
});

test('offline start remains active while server history refresh has no pending record', () => {
  const start = queued('start', 'Mulai Lembur', '2026-10-30 17:00:00');
  const oldEnd = record(1, 'Selesai Lembur', '2026-10-29 20:00:00');
  for (const server of [[], [oldEnd], [record(3, 'Masuk', '2026-10-31 08:00:00'), oldEnd]]) {
    assert.equal(getOvertimeSession(mergeAttendanceHistory(server, [start]), now).start.id, 'start');
  }
});

test('synced overnight start continues the same session when queue is removed', () => {
  const queue = [queued('start', 'Mulai Lembur', '2026-10-30 17:00:00')];
  const server = [record(9, 'lembur_masuk', '2026-10-30 17:00:00')];
  assert.ok(getOvertimeSession(mergeAttendanceHistory([], queue), now).start);
  assert.ok(getOvertimeSession(mergeAttendanceHistory(server, queue), now).start);
  assert.equal(getOvertimeSession(mergeAttendanceHistory(server, []), now).start.id, 9);
});

test('failed offline end does not close a server session and evidence is retained', () => {
  const queue = [queued('end', 'Selesai Lembur', '2026-10-30 21:00:00', { status: 'failed', error_message: 'Ditolak' })];
  const start = record(1, 'Mulai Lembur', '2026-10-30 17:00:00');
  assert.equal(getOvertimeSession(mergeAttendanceHistory([start], queue), now).start.id, 1);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].error_message, 'Ditolak');
});

test('latest successful end closes session regardless of input ordering or work date', () => {
  const start = record(1, 'Mulai Lembur', '2026-10-30 17:00:00');
  const end = record(2, 'lembur_pulang', '2026-10-31 02:00:00', { date: '2026-10-30', actual_date: '2026-10-31' });
  const session = getOvertimeSession([start, end], now);
  assert.equal(session.start, undefined);
  assert.equal(session.end.id, 2);
});

test('offline end closes the session before sync and a newer start opens the next one', () => {
  const start = record(1, 'Mulai Lembur', '2026-10-30 17:00:00');
  const end = queued('end', 'Selesai Lembur', '2026-10-31 02:00:00');
  assert.equal(getOvertimeSession(mergeAttendanceHistory([start], [end]), now).start, undefined);
  const next = record(3, 'Mulai Lembur', '2026-10-31 09:00:00');
  assert.equal(getOvertimeSession(mergeAttendanceHistory([start, next], [end]), now).start.id, 3);
});

test('timestamps handle WIB, ISO offsets, and actual date fallback consistently', () => {
  const base = record(1, 'Mulai Lembur', '2026-10-30 17:00:00');
  const iso = { ...base, occurred_at: '2026-10-30T10:00:00Z' };
  const fallback = { ...base, occurred_at: undefined, date: '2026-10-29', actual_date: '2026-10-30' };
  assert.equal(attendanceTimestamp(base), attendanceTimestamp(iso));
  assert.equal(attendanceTimestamp(base), attendanceTimestamp(fallback));
});

test('future starts and sessions older than 24h are not treated as active', () => {
  for (const time of ['2026-10-29 17:00:00', '2026-10-31 17:00:00']) {
    assert.equal(getOvertimeSession([record(1, 'Mulai Lembur', time)], now).start, undefined);
  }
});
