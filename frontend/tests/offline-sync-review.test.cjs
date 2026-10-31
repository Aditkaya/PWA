const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('retry sends yesterday rejected photo and timestamp unchanged, then removes queue after HRD review acceptance', async () => {
  const original = {
    id: 'offline_yesterday', user_id: 1, tipe: 'Selesai Lembur',
    foto_base64: 'data:image/jpeg;base64,original-photo', waktu_offline: '2026-10-30 21:00:00',
    created_at: 1, status: 'failed', error_message: 'Wajah tidak cocok dengan foto terdaftar.',
    latitude: -6.2, longitude: 106.8, gps_accuracy: 11, location_age_ms: 0,
  };
  const items = new Map([[original.id, original]]);
  const requests = [];
  const db = {
    transaction() {
      const tx = {
        objectStore() {
          return {
            getAll() { const request = {}; queueMicrotask(() => { request.result = [...items.values()]; request.onsuccess(); }); return request; },
            delete(id) { items.delete(id); queueMicrotask(() => tx.oncomplete()); },
            put(item) { items.set(item.id, item); queueMicrotask(() => tx.oncomplete()); },
          };
        },
      };
      return tx;
    },
  };
  const indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess(); }); return request; } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/offlineQueue.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, indexedDB, window: { indexedDB }, console, FormData, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, form: options.body });
      return { ok: true, json: async () => ({ status: 'Persetujuan', is_approval: true }) };
    },
  });
  await exports.syncOfflineAttendances(1);
  assert.equal(requests.length, 0); // Previously rejected items require the retry action.
  const result = await exports.syncOfflineAttendances(1, undefined, true);
  assert.equal(result.success, 1);
  assert.equal(result.approval, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].form.get('foto_base64'), original.foto_base64);
  assert.equal(requests[0].form.get('waktu_offline'), original.waktu_offline);
  assert.equal(requests[0].form.get('tipe'), 'Selesai Lembur');
  assert.equal(requests[0].form.get('is_offline'), '1');
  assert.equal(items.size, 0);
});
