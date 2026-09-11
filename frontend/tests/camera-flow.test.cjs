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
  let shutter;
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
    exports: module.exports, console, AbortController, Error,
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
      geolocation: { watchPosition: success => { gpsSuccess = success; return 1; }, clearWatch() {} },
    },
    fetch: async () => ({ json: async () => ({ data: [] }) }),
    Image: class { set src(_value) { queueMicrotask(() => this.onload?.()); } },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {},
  });
  const props = { isOpen: true, attendanceType: 'masuk', onClose() {}, onCapture: (...args) => { captures.push(args); return new Promise((resolve, reject) => { resolveSubmission = resolve; rejectSubmission = reject; }); } };
  async function settle() {
    for (let n = 0; n < 12; n++) {
      if (dirty) {
        dirty = false; cursor = 0; effects = [];
        module.exports.default(props);
        effects.forEach(fn => fn());
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  return {
    captures, toasts, settle,
    get shutterDisabled() { return shutter.disabled; },
    click: () => { if (!shutter.disabled) void shutter.onClick(); },
    gps: () => gpsSuccess({ coords: { latitude: -6.2, longitude: 106.8 } }),
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
  assert.deepEqual(camera.toasts, ['Wajah tidak cocok']);
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
