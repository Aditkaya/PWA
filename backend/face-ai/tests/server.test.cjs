const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createServer } = require('../server.cjs');

async function setup(t) {
  const worker = new EventEmitter();
  worker.sent = [];
  worker.postMessage = value => worker.sent.push(value);
  const token = 'test-only-secret-with-at-least-32-characters';
  const server = createServer({ token, worker });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (route, body, authorized = true) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: authorized ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { worker, request };
}

test('private service requires a token and rejects work until models are ready', async t => {
  const { worker, request } = await setup(t);
  assert.equal((await request('/health', undefined, false)).status, 401);
  assert.equal((await request('/verify', { image: 'abc' })).status, 503);
  worker.emit('message', { ready: true, backend: 'tensorflow' });
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ready: true, backend: 'tensorflow' });
});

test('verification returns server match result and worker failure fails closed', async t => {
  const { worker, request } = await setup(t);
  worker.emit('message', { ready: true });
  const result = request('/verify', { image: 'abc', reference: 'def' });
  while (!worker.sent.length) await new Promise(resolve => setTimeout(resolve, 5));
  worker.emit('message', { result: { matched: false } });
  assert.deepEqual(await (await result).json(), { matched: false });
  const pending = request('/validate', { image: 'abc' });
  while (worker.sent.length < 2) await new Promise(resolve => setTimeout(resolve, 5));
  worker.emit('error', new Error('worker stopped'));
  assert.equal((await pending).status, 503);
});

test('invalid and absent image requests never reach inference', async t => {
  const { worker, request } = await setup(t);
  worker.emit('message', { ready: true });
  assert.equal((await request('/validate', {})).status, 422);
  assert.equal((await request('/other', { image: 'abc' })).status, 404);
  assert.equal(worker.sent.length, 0);
});
