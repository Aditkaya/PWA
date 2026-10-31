const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const run = promisify(execFile);

test('PHP rejects online mismatches and preserves offline HTTP 422 evidence for HRD review', async t => {
  let matched = false;
  let status = 200;
  let requests = 0;
  let message;
  const token = 'test-only-secret-with-at-least-32-characters';
  const server = http.createServer(async (req, res) => {
    requests++;
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    assert.equal(req.url, '/verify');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks));
    assert.ok(data.image && data.reference);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(message ? { message } : { matched }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const submit = async mode => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aypsis-face-test-'));
    try {
      const result = await run('php', [path.resolve(__dirname, '../../tests/attendance-face.php'), root, mode || ''], {
        env: { ...process.env, FACE_AI_TOKEN: token, FACE_AI_URL: `http://127.0.0.1:${server.address().port}` },
      });
      return JSON.parse(result.stdout);
    } finally {
      // Only the fresh temporary directory allocated by this test is removed.
      await fs.rm(root, { recursive: true, force: true });
    }
  };
  let result = await submit();
  assert.equal(result.status, 422); assert.equal(result.count, 0);
  matched = true;
  result = await submit();
  assert.equal(result.status, 200); assert.equal(result.count, 1);
  status = 503;
  result = await submit();
  assert.equal(result.status, 503); assert.equal(result.count, 0);
  result = await submit('missing');
  assert.equal(result.status, 422); assert.equal(result.count, 0);
  assert.equal(requests, 3, 'missing photos never reach the AI service');

  // The real engine throws for mismatches; server.cjs emits HTTP 422.
  status = 422;
  message = 'Wajah tidak cocok dengan foto terdaftar. Pastikan wajah terlihat jelas.';
  result = await submit();
  assert.equal(result.status, 422); assert.equal(result.count, 0);
  result = await submit('offline');
  assert.equal(result.status, 200); assert.equal(result.count, 1);
  assert.equal(result.body.is_approval, true);
  assert.equal(result.record.status, 'Persetujuan');
  assert.equal(result.record.waktu, '2026-10-30 21:00:00');
  assert.ok(result.record.foto);
  assert.ok(result.record.detail_lokasi.includes(message));
  assert.ok(result.record.keterangan.includes('[Offline: 30/10/2026 21:00]'));

  message = 'Foto wajah tidak valid.';
  result = await submit('offline');
  assert.equal(result.status, 422); assert.equal(result.count, 0);
  status = 503;
  message = 'Server validasi wajah tidak tersedia.';
  result = await submit('offline');
  assert.equal(result.status, 503); assert.equal(result.count, 0);
});
