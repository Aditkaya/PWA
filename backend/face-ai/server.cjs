const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

function createServer({ token, worker }) {
  let ready = false;
  let active = null;
  let activeTimeout;
  const queue = [];
  const reply = (res, status, body) => {
    if (!res.destroyed && !res.writableEnded) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    }
  };
  const runNext = () => {
    if (active || !ready) return;
    while (queue.length && queue[0].res.destroyed) queue.shift();
    active = queue.shift() || null;
    if (active) {
      activeTimeout = setTimeout(() => {
        fail();
        void worker.terminate();
      }, 20000);
      worker.postMessage({ operation: active.operation, payload: active.payload });
    }
  };
  worker.on('message', message => {
    if (message.ready) ready = true;
    else if (active) {
      clearTimeout(activeTimeout);
      reply(active.res, message.error ? 422 : 200, message.error ? { message: message.error } : message.result);
      active = null;
    }
    runNext();
  });
  const fail = () => {
    clearTimeout(activeTimeout);
    ready = false;
    if (active) reply(active.res, 503, { message: 'Layanan AI tidak tersedia.' });
    active = null;
    while (queue.length) reply(queue.shift().res, 503, { message: 'Layanan AI tidak tersedia.' });
  };
  worker.on('error', fail);
  worker.on('exit', fail);

  const server = http.createServer(async (req, res) => {
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return reply(res, 401, { message: 'Unauthorized' });
    }
    if (req.method === 'GET' && req.url === '/health') return reply(res, ready ? 200 : 503, { ready });
    if (req.method !== 'POST' || !['/verify', '/validate'].includes(req.url)) return reply(res, 404, { message: 'Not found' });
    if (!ready) return reply(res, 503, { message: 'AI sedang disiapkan. Silakan coba lagi.' });
    if (queue.length >= 8) return reply(res, 503, { message: 'Server AI sedang sibuk. Silakan coba lagi.' });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 6000000) { reply(res, 413, { message: 'Foto terlalu besar.' }); return; }
        chunks.push(chunk);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      if (!payload || typeof payload.image !== 'string') return reply(res, 422, { message: 'Foto wajib diisi.' });
      if (!ready || queue.length >= 8) return reply(res, 503, { message: 'Server AI sedang sibuk. Silakan coba lagi.' });
      queue.push({ operation: req.url, payload, res });
      runNext();
    } catch {
      reply(res, 400, { message: 'Data foto tidak valid.' });
    }
  });
  server.requestTimeout = 15000;
  server.setTimeout(25000, socket => socket.destroy());
  return server;
}

if (require.main === module) {
  const filename = path.resolve(__dirname, '../config/face-ai.local.json');
  const config = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
  const token = process.env.FACE_AI_TOKEN || config.token;
  if (!token || token.length < 32) throw new Error('Jalankan npm run setup atau isi FACE_AI_TOKEN (minimal 32 karakter).');
  const modelDir = process.env.FACE_AI_MODEL_DIR || path.resolve(__dirname, 'models');
  const worker = new Worker(path.join(__dirname, 'worker.cjs'), { workerData: { modelDir } });
  const server = createServer({ token, worker });
  server.listen(Number(process.env.FACE_AI_PORT || 8001), '127.0.0.1', () => console.log('Layanan AI mendengarkan di 127.0.0.1:8001.'));
  let stopping = false;
  worker.once('exit', () => {
    if (!stopping) {
      server.closeAllConnections();
      server.close();
      process.exitCode = 1; // Allow the process supervisor to restart a failed worker.
    }
  });
  const shutdown = () => { stopping = true; server.close(); void worker.terminate(); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createServer };
