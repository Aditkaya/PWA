const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Small hook harness: exercise the real modal's effects with a controllable
// camera, inference and GPS, without requiring physical camera permissions.
function setup() {
  const hooks = [];
  let cursor = 0, dirty = true, timerId = 0;
  let effects = [];
  const timers = new Map();
  const captures = [];
  const toasts = [];
  let resolveSubmission;
  let rejectSubmission;
  let gpsSuccess;
  let gpsError;
  let shutter;
  let retry;
  let tree;
  let now = Date.now();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const requests = [];
  const geocodes = [];
  const context = new Proxy({}, { get: () => () => {} });
  const canvas = () => ({ width: 640, height: 480, getContext: () => context, toDataURL: () => 'verified-photo' });
  const video = {
    paused: false, ended: false, videoWidth: 640, videoHeight: 480,
    set srcObject(value) { this.stream = value; if (value) queueMicrotask(() => this.onloadeddata?.()); },
    get srcObject() { return this.stream; },
  };
  const react = {
    useRef(initial) {
      const i = cursor++;
      return hooks[i] ??= { current: initial };
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => {
        const next = typeof value === 'function' ? value(hooks[i]) : value;
        if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true; }
      }];
    },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = cursor++;
      const prev = hooks[i];
      if (!prev || !deps || deps.some((dep, index) => !Object.is(dep, prev.deps[index]))) {
        effects.push(() => { prev?.cleanup?.(); hooks[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const jsx = (type, props) => {
    if (type === 'button' && props['aria-label'] === 'Ambil foto untuk absen') shutter = props;
    if (type === 'button' && props['aria-label'] === 'Cari ulang GPS') retry = props;
    if (props?.ref && type === 'video') props.ref.current = video;
    if (props?.ref && type === 'canvas') props.ref.current ??= canvas();
    return { type, props };
  };
  const t = new Proxy({}, { get: (_target, key) => key });
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/components/CameraModal.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: module.exports, console, AbortController, Error, Date: Clock,
    window: { isSecureContext: true },
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-dom') return { createPortal: value => value };
      if (name === 'face-api.js' || name.includes('faceRecognition')) throw new Error('Mobile must not load AI');
      if (name.includes('lang.store')) return { useLangStore: () => ({ lang: 'id' }) };
      if (name.includes('auth.store')) return { useAuthStore: () => ({ user: { id: 1 } }) };
      if (name.includes('translations')) return { translations: { id: t } };
      if (name.includes('ToastContext')) return { useToast: () => ({ showToast: message => toasts.push(message) }) };
      return {};
    },
    document: { body: {}, createElement: canvas },
    navigator: {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      geolocation: { watchPosition: (success, error) => { gpsSuccess = success; gpsError = error; return 1; }, clearWatch() {} },
    },
    fetch: async url => {
      requests.push(url);
      if (url.includes('/reverse?')) return new Promise(resolve => geocodes.push(name => resolve({ ok: true, json: async () => ({ display_name: name }) })));
      return { json: async () => ({ data: [{ latitude: -6.2, longitude: 106.8, radius: 50, nama_lokasi: 'Kantor' }] }) };
    },
    Image: class { set src(_value) { queueMicrotask(() => this.onload?.()); } },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {},
  });
  const props = { isOpen: true, attendanceType: 'masuk', onClose() {}, onCapture: (...args) => { captures.push(args); return new Promise((resolve, reject) => { resolveSubmission = resolve; rejectSubmission = reject; }); } };
  async function settle() {
    for (let n = 0; n < 12; n++) {
      if (dirty) {
        dirty = false; cursor = 0; effects = [];
        tree = module.exports.default(props);
        effects.forEach(fn => fn());
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  return {
    captures, toasts, settle, requests, geocodes,
    get text() { return JSON.stringify(tree); },
    get shutterDisabled() { return shutter.disabled; },
    click: () => { if (!shutter.disabled) void shutter.onClick(); },
    gps: (accuracy = 11, latitude = -6.2, timestamp = now) => gpsSuccess({ timestamp, coords: { latitude, longitude: 106.8, accuracy } }),
    gpsError: () => gpsError({ code: 2 }),
    advance: ms => { now += ms; dirty = true; },
    forceClick: () => shutter.onClick(),
    retry: () => retry.onClick(),
    runTimers: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.fn()); },
    resolve: () => resolveSubmission(),
    reject: message => rejectSubmission(new Error(message)),
    close: () => { props.isOpen = false; dirty = true; },
  };
}

test('camera opens without AI or auto-submit; manual double click sends one photo', async () => {
  const camera = setup();
  await camera.settle();
  assert.equal(camera.captures.length, 0);
  assert.equal(camera.shutterDisabled, true);
  camera.gps(); await camera.settle();
  assert.equal(camera.shutterDisabled, false);
  assert.equal(camera.captures.length, 0);
  camera.click(); camera.click(); await camera.settle();
  assert.equal(camera.captures.length, 1);
  assert.equal(camera.captures[0][1].lat, -6.2);
  assert.equal(camera.shutterDisabled, true);
  camera.resolve(); await camera.settle();
});

test('server rejection keeps the camera available for another manual photo', async () => {
  const camera = setup();
  await camera.settle(); camera.gps(); await camera.settle();
  camera.click(); await camera.settle();
  camera.reject('Wajah tidak cocok'); await camera.settle();
  assert.equal(camera.shutterDisabled, false);
  assert.ok(camera.text.includes('Wajah tidak cocok'));
  camera.click(); await camera.settle();
  assert.equal(camera.captures.length, 2);
  camera.resolve(); await camera.settle();
});

test('late server errors after closing do not affect a closed modal', async () => {
  const camera = setup();
  await camera.settle(); camera.gps(); await camera.settle();
  camera.click(); camera.close(); await camera.settle();
  camera.reject('Server gagal'); await camera.settle();
  assert.deepEqual(camera.toasts, []);
});

test('coarse or unknown accuracy cannot submit or report outside the radius', async () => {
  const camera = setup();
  await camera.settle();
  for (const accuracy of [2000, null, NaN, -1, 0]) {
    camera.gps(accuracy, -6.21); await camera.settle();
    assert.equal(camera.shutterDisabled, true);
    assert.equal(camera.text.includes('outOfRange Kantor'), false);
    await camera.forceClick();
    assert.equal(camera.captures.length, 0);
  }
  camera.gps(50, -6.21); await camera.settle();
  assert.equal(camera.shutterDisabled, false);
  assert.ok(camera.text.includes('outOfRange Kantor'));
});

test('expired location is blocked even before rerender and recovers on a fresh fix', async () => {
  const camera = setup();
  await camera.settle(); camera.gps(); await camera.settle();
  camera.advance(30001);
  await camera.forceClick();
  assert.equal(camera.captures.length, 0);
  await camera.settle();
  assert.equal(camera.shutterDisabled, true);
  camera.gps(); await camera.settle();
  assert.equal(camera.shutterDisabled, false);
  camera.click(); await camera.settle();
  assert.equal(camera.captures[0][1].accuracy, 11);
  assert.equal(camera.captures[0][1].locationAgeMs, 0);
  camera.resolve(); await camera.settle();
});

test('retry clears old coordinates and requires a new accurate fix', async () => {
  const camera = setup();
  await camera.settle(); camera.gps(); await camera.settle();
  camera.gpsError(); await camera.settle();
  assert.equal(camera.shutterDisabled, true);
  camera.retry(); await camera.settle();
  assert.equal(camera.shutterDisabled, true);
  camera.gps(); await camera.settle();
  assert.equal(camera.shutterDisabled, false);
});

test('address follows corrected coordinates and ignores late lookup results', async () => {
  const camera = setup();
  await camera.settle(); camera.gps(2000); await camera.settle();
  camera.runTimers(); await camera.settle();
  assert.equal(camera.geocodes.length, 0);
  camera.gps(11); await camera.settle();
  camera.runTimers(); await camera.settle();
  camera.gps(11, -6.21); await camera.settle();
  camera.runTimers(); await camera.settle();
  camera.geocodes[1]('Alamat terbaru'); await camera.settle();
  camera.geocodes[0]('Alamat lama'); await camera.settle();
  assert.ok(camera.text.includes('Alamat terbaru'));
  assert.equal(camera.text.includes('Alamat lama'), false);
});
