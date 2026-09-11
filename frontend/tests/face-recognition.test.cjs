const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const calls = { detector: 0, landmarks: 0, recognition: 0, inference: 0, images: 0, revoked: 0 };
  const state = { failLoad: false, failImage: false, version: 1, detect: true };
  const descriptor = new Float32Array(128);
  const api = {
    TinyFaceDetectorOptions: class { constructor(options) { Object.assign(this, options); } },
    nets: Object.fromEntries([
      ['tinyFaceDetector', 'detector'], ['faceLandmark68Net', 'landmarks'], ['faceRecognitionNet', 'recognition'],
    ].map(([name, key]) => [name, { loadFromUri: async () => {
      calls[key]++;
      if (state.failLoad) throw new Error('offline');
    } }])),
    detectSingleFace: () => ({ withFaceLandmarks: () => ({ withFaceDescriptor: async () => {
      calls.inference++;
      return state.detect ? { descriptor } : undefined;
    } }) }),
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/faceRecognition.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: module.exports,
    require: () => api,
    Image: class { set src(_value) { queueMicrotask(() => state.failImage ? this.onerror() : this.onload()); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => calls.revoked++ },
    fetch: async url => {
      if (url.startsWith('/api/profile')) return {
        ok: true, json: async () => ({ data: { is_face_verified: true, face_verification_url: `/face.jpg?v=${state.version}` } }),
      };
      calls.images++;
      return { ok: true, blob: async () => ({}) };
    },
  });
  return { service: module.exports, calls, state, descriptor };
}

test('registration and concurrent attendance share one model download', async () => {
  const { service, calls } = setup();
  await Promise.all([service.loadFaceDetector(), service.loadFaceRecognition(), service.loadFaceRecognition()]);
  assert.equal(calls.detector, 1);
  assert.equal(calls.landmarks, 1);
  assert.equal(calls.recognition, 1);
});

test('a failed model download can be retried', async () => {
  const { service, state, calls } = setup();
  state.failLoad = true;
  await assert.rejects(service.loadFaceRecognition(), /offline/);
  state.failLoad = false;
  await service.loadFaceRecognition();
  assert.equal(calls.detector, 2);
  assert.equal(calls.recognition, 2);
});

test('profile cache avoids inference but invalidates on photo version, user and registration', async () => {
  const { service, calls, state, descriptor } = setup();
  const signal = new AbortController().signal;
  assert.equal(await service.loadFaceProfile(1, signal), descriptor);
  await service.loadFaceProfile(1, signal);
  assert.equal(calls.inference, 1);
  assert.equal(calls.images, 1);
  state.version++;
  await service.loadFaceProfile(1, signal);
  await service.loadFaceProfile(2, signal);
  service.clearFaceProfileCache();
  await service.loadFaceProfile(2, signal);
  assert.equal(calls.inference, 4);
  assert.equal(calls.revoked, 4);
});

test('missing faces fail closed and decoded image URLs are always released', async () => {
  const { service, state, calls } = setup();
  state.detect = false;
  await assert.rejects(service.loadFaceProfile(1, new AbortController().signal), /tidak terdeteksi/);
  assert.equal(calls.revoked, 1);
  state.failImage = true;
  await assert.rejects(service.loadFaceProfile(1, new AbortController().signal), /membaca foto/);
  assert.equal(calls.revoked, 2);
});

test('a closed session cannot perform profile inference or populate the cache', async () => {
  const { service, calls } = setup();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.loadFaceProfile(1, controller.signal), { name: 'AbortError' });
  assert.equal(calls.inference, 0);
  assert.equal(calls.revoked, 1);
  await service.loadFaceProfile(1, new AbortController().signal);
  assert.equal(calls.inference, 1);
});
